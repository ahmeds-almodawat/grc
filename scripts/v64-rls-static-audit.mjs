import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const outDir = path.join(root, 'release', 'v64');
fs.mkdirSync(outDir, { recursive: true });

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => path.join(dir, name));
}

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ');
}

function normalizeTableName(raw) {
  return raw
    .replace(/if\s+not\s+exists\s+/i, '')
    .replace(/"/g, '')
    .trim()
    .replace(/^public\./i, '')
    .toLowerCase();
}

function isSensitiveTable(name) {
  return /(ovr|evidence|audit|role|user|profile|approval|export|backup|restore|release|security|rls|incident|patient|department|organization|task|project|risk|compliance|control|policy|finding|notification)/i.test(name);
}

const files = listSqlFiles(migrationsDir);
const tables = new Map();
const rlsEnabled = new Set();
const policies = new Map();
const sources = [];

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const sql = stripComments(fs.readFileSync(file, 'utf8'));
  sources.push(rel);

  for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")/gi)) {
    const table = normalizeTableName(match[1]);
    if (!tables.has(table)) tables.set(table, { table, created_in: rel, sensitive: isSensitiveTable(table) });
  }

  for (const match of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")\s+enable\s+row\s+level\s+security/gi)) {
    rlsEnabled.add(normalizeTableName(match[1]));
  }

  for (const match of sql.matchAll(/create\s+policy\s+(?:if\s+not\s+exists\s+)?(?:"[^"]+"|[a-zA-Z_][\w]*)\s+on\s+((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")/gi)) {
    const table = normalizeTableName(match[1]);
    policies.set(table, (policies.get(table) || 0) + 1);
  }
}

const findings = [];
for (const table of [...tables.values()].sort((a, b) => a.table.localeCompare(b.table))) {
  const hasRls = rlsEnabled.has(table.table);
  const policyCount = policies.get(table.table) || 0;
  if (!hasRls) {
    findings.push({
      severity: table.sensitive ? 'critical' : 'medium',
      code: 'RLS_NOT_ENABLED',
      table: table.table,
      created_in: table.created_in,
      message: 'Table is created in migrations but no explicit ALTER TABLE ... ENABLE ROW LEVEL SECURITY was found.'
    });
  } else if (policyCount === 0 && table.sensitive) {
    findings.push({
      severity: 'high',
      code: 'RLS_NO_POLICY_FOUND',
      table: table.table,
      created_in: table.created_in,
      message: 'Sensitive table has RLS enabled but no CREATE POLICY was detected in migrations.'
    });
  }
}

const summary = {
  generated_at: new Date().toISOString(),
  migration_files_scanned: files.length,
  created_tables_detected: tables.size,
  tables_with_explicit_rls: rlsEnabled.size,
  tables_with_detected_policies: policies.size,
  findings_total: findings.length,
  critical: findings.filter((f) => f.severity === 'critical').length,
  high: findings.filter((f) => f.severity === 'high').length,
  medium: findings.filter((f) => f.severity === 'medium').length,
  strict_passed: findings.filter((f) => ['critical', 'high'].includes(f.severity)).length === 0,
  note: 'Static audit only. Final proof requires applying migrations to staging and running supabase/tests/v64_persona_security_tests.sql.'
};

const report = { summary, findings, sources };
fs.writeFileSync(path.join(outDir, 'v64-rls-static-audit.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'V64_RLS_STATIC_AUDIT.md'), `# v6.4 RLS Static Audit\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n## Findings\n\n${findings.slice(0, 200).map((f) => `- **${f.severity}** ${f.code} on \`${f.table}\` (${f.created_in}) — ${f.message}`).join('\n') || 'No critical/high findings detected by static scan.'}\n`);

console.log('v6.4 RLS static audit complete.');
console.log(JSON.stringify(summary, null, 2));
if (strict && !summary.strict_passed) {
  console.error('v6.4 strict RLS audit failed. Fix critical/high findings or document safe exceptions before production.');
  process.exit(1);
}
