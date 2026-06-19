import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const outDir = path.join(root, 'release', 'v64');
fs.mkdirSync(outDir, { recursive: true });

const files = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => path.join(migrationsDir, file))
  : [];

function normalizeFunctionName(name) {
  return (name || '')
    .replace(/^public\./i, '')
    .replace(/"/g, '')
    .trim()
    .toLowerCase();
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ');
}

function collectFunctionBlocks(sql, file) {
  const starts = [...sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z_][\w."]*)\s*\(/gi,
  )];
  return starts.map((match, index) => ({
    file,
    function_name: normalizeFunctionName(match[1]),
    block: sql.slice(match.index, starts[index + 1]?.index ?? sql.length),
  }));
}

const sqlFiles = files.map((file) => ({
  file,
  relative: path.relative(root, file).replaceAll('\\', '/'),
  sql: stripSqlComments(fs.readFileSync(file, 'utf8')),
}));
const allSql = sqlFiles.map(({ sql }) => sql).join('\n');

const globalSearchPathFixes = new Set();
const globalRevokes = new Set();
const finalSecurityInvokerFunctions = new Set();
const globalBroadGrants = [];

for (const { sql } of sqlFiles) {
  for (const match of sql.matchAll(
    /alter\s+function\s+(?:if\s+exists\s+)?([a-zA-Z_][\w."]*)(?:\s*\([^)]*\))?\s+set\s+search_path\s*=/gi,
  )) {
    globalSearchPathFixes.add(normalizeFunctionName(match[1]));
  }
  for (const match of sql.matchAll(
    /revoke\s+(?:all|execute)\s+on\s+function\s+(?:if\s+exists\s+)?([a-zA-Z_][\w."]*)(?:\s*\([^)]*\))?\s+from\s+(public|anon|authenticated)/gi,
  )) {
    globalRevokes.add(normalizeFunctionName(match[1]));
  }
  for (const match of sql.matchAll(
    /alter\s+function\s+([a-zA-Z_][\w."]*)\s*\([^;]*?\)\s+security\s+invoker/gi,
  )) {
    finalSecurityInvokerFunctions.add(normalizeFunctionName(match[1]));
  }
  for (const match of sql.matchAll(
    /grant\s+execute\s+on\s+function\s+([^\s(]+)[\s\S]{0,250}\s+to\s+(public|anon|authenticated)/gi,
  )) {
    globalBroadGrants.push({
      function_name: normalizeFunctionName(match[1]),
      role: match[2].toLowerCase(),
    });
  }
}

const hasGlobalSecurityDefinerLockdown =
  /p\.prosecdef\s*=\s*true/i.test(allSql)
  && /revoke\s+all\s+on\s+function\s+%s\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i.test(allSql);

const findings = [];
const functionBlocks = [];

for (const { relative, sql } of sqlFiles) {
  for (const fn of collectFunctionBlocks(sql, relative)) {
    if (!/\bsecurity\s+definer\b/i.test(fn.block)) continue;
    if (finalSecurityInvokerFunctions.has(fn.function_name)) continue;

    const hasSearchPath =
      /set\s+search_path\s*=/i.test(fn.block)
      || /set_config\s*\(\s*'search_path'/i.test(fn.block)
      || globalSearchPathFixes.has(fn.function_name);
    const hasRevoke =
      hasGlobalSecurityDefinerLockdown
      || globalRevokes.has(fn.function_name)
      || /revoke\s+(?:all|execute)\s+on\s+function/i.test(fn.block);

    functionBlocks.push({
      file: relative,
      function_name: fn.function_name,
      has_search_path: hasSearchPath,
      has_public_revoke: hasRevoke,
    });

    if (!hasSearchPath) {
      findings.push({
        severity: 'high',
        code: 'SECURITY_DEFINER_NO_SEARCH_PATH',
        file: relative,
        function_name: fn.function_name,
        message: 'SECURITY DEFINER function should set a fixed search_path.',
      });
    }
    if (!hasRevoke) {
      findings.push({
        severity: 'medium',
        code: 'SECURITY_DEFINER_EXECUTE_NOT_REVOKED',
        file: relative,
        function_name: fn.function_name,
        message: 'No explicit or global broad-role revoke was found.',
      });
    }
  }
}

const securityDefinerNames = new Set(functionBlocks.map((item) => item.function_name));
for (const grant of globalBroadGrants) {
  if (!securityDefinerNames.has(grant.function_name)) continue;
  if (hasGlobalSecurityDefinerLockdown || globalRevokes.has(grant.function_name)) continue;

  findings.push({
    severity: grant.role === 'public' ? 'critical' : 'high',
    code: 'BROAD_FUNCTION_EXECUTE_GRANT',
    function_name: grant.function_name,
    role: grant.role,
    message: `SECURITY DEFINER function may remain executable by ${grant.role}.`,
  });
}

const summary = {
  generated_at: new Date().toISOString(),
  migration_files_scanned: files.length,
  security_definer_functions_detected: functionBlocks.length,
  global_security_definer_lockdown_detected: hasGlobalSecurityDefinerLockdown,
  findings_total: findings.length,
  critical: findings.filter((finding) => finding.severity === 'critical').length,
  high: findings.filter((finding) => finding.severity === 'high').length,
  medium: findings.filter((finding) => finding.severity === 'medium').length,
  strict_passed: findings.filter(
    (finding) => ['critical', 'high'].includes(finding.severity),
  ).length === 0,
  note:
    'Static scan strips SQL comments, honors later SECURITY INVOKER changes, and recognizes the v6.7.3 dynamic blanket revoke. The live v6.7.3 database audit remains authoritative for effective grants.',
};

fs.writeFileSync(
  path.join(outDir, 'v64-security-function-audit.json'),
  JSON.stringify({
    summary,
    functionBlocks,
    globalSearchPathFixes: [...globalSearchPathFixes],
    globalRevokes: [...globalRevokes],
    finalSecurityInvokerFunctions: [...finalSecurityInvokerFunctions],
    findings,
  }, null, 2),
);
fs.writeFileSync(
  path.join(outDir, 'V64_SECURITY_FUNCTION_AUDIT.md'),
  `# v6.4 Security Function Audit

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

## Findings

${findings.map((finding) =>
    `- **${finding.severity}** ${finding.code} in ${finding.file || 'migration scan'} / ${finding.function_name}: ${finding.message}`,
  ).join('\n') || 'No critical/high findings detected.'}
`,
);

console.log('v6.4 security function audit complete.');
console.log(JSON.stringify(summary, null, 2));
if (strict && !summary.strict_passed) {
  console.error('v6.4 strict function audit failed.');
  process.exit(1);
}
