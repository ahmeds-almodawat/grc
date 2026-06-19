import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const outDir = path.join(root, 'release', 'v64');
fs.mkdirSync(outDir, { recursive: true });

const files = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort().map((f) => path.join(migrationsDir, f))
  : [];

function cleanName(raw) {
  return raw.replace(/"/g, '').replace(/^public\./i, '').toLowerCase();
}
function isSensitiveView(view) {
  return /(ovr|evidence|audit|role|user|profile|approval|export|backup|release|security|risk|compliance|finding|control)/i.test(view);
}

const viewState = new Map();
const allOccurrences = [];

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const sql = fs.readFileSync(file, 'utf8');

  for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")/gi)) {
    const view = cleanName(match[1]);
    const near = sql.slice(Math.max(0, match.index - 400), Math.min(sql.length, match.index + 1000));
    const hasSecurityInvoker = /security_invoker\s*=\s*true/i.test(near) || /with\s*\([^)]*security_invoker\s*=\s*true/i.test(near);
    const sensitive = isSensitiveView(view);
    const prior = viewState.get(view) || { view, files: [], has_security_invoker: false, sensitive };
    prior.files.push(rel);
    prior.has_security_invoker = prior.has_security_invoker || hasSecurityInvoker;
    prior.sensitive = prior.sensitive || sensitive;
    viewState.set(view, prior);
    allOccurrences.push({ view, file: rel, occurrence: 'create_view', has_security_invoker: hasSecurityInvoker, sensitive });
  }

  for (const match of sql.matchAll(/alter\s+view\s+(?:if\s+exists\s+)?((?:public\.)?[a-zA-Z_][\w]*|"[^"]+")\s+set\s*\([^)]*security_invoker\s*=\s*true/gi)) {
    const view = cleanName(match[1]);
    const sensitive = isSensitiveView(view);
    const prior = viewState.get(view) || { view, files: [], has_security_invoker: false, sensitive };
    prior.files.push(rel);
    prior.has_security_invoker = true;
    prior.sensitive = prior.sensitive || sensitive;
    viewState.set(view, prior);
    allOccurrences.push({ view, file: rel, occurrence: 'alter_view_security_invoker', has_security_invoker: true, sensitive });
  }
}

const views = [...viewState.values()].sort((a, b) => a.view.localeCompare(b.view));
const findings = [];
for (const item of views) {
  const firstFile = item.files[0] || 'unknown';
  if (item.sensitive && !item.has_security_invoker) {
    findings.push({ severity: 'high', code: 'SENSITIVE_VIEW_WITHOUT_SECURITY_INVOKER', view: item.view, file: firstFile, message: 'Sensitive view should use security_invoker where supported, or be protected by safe RPC/policies.' });
  } else if (!item.has_security_invoker) {
    findings.push({ severity: 'medium', code: 'VIEW_WITHOUT_SECURITY_INVOKER', view: item.view, file: firstFile, message: 'View does not show security_invoker=true in static scan.' });
  }
}

const summary = {
  generated_at: new Date().toISOString(),
  migration_files_scanned: files.length,
  views_detected: views.length,
  findings_total: findings.length,
  critical: 0,
  high: findings.filter((f) => f.severity === 'high').length,
  medium: findings.filter((f) => f.severity === 'medium').length,
  strict_passed: findings.filter((f) => f.severity === 'high').length === 0,
  note: 'Static scan deduplicates views and recognizes later ALTER VIEW ... SET (security_invoker=true). Final proof still requires staging verification.'
};

fs.writeFileSync(path.join(outDir, 'v64-view-security-audit.json'), JSON.stringify({ summary, views, allOccurrences, findings }, null, 2));
fs.writeFileSync(path.join(outDir, 'V64_VIEW_SECURITY_AUDIT.md'), `# v6.4 View Security Audit\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n## Findings\n${findings.slice(0, 250).map((f) => `- **${f.severity}** ${f.code} on \`${f.view}\` (${f.file}) — ${f.message}`).join('\n') || 'No high-risk view findings detected.'}\n`);
console.log('v6.4 view security audit complete.');
console.log(JSON.stringify(summary, null, 2));
if (strict && !summary.strict_passed) {
  console.error('v6.4 strict view audit failed.');
  process.exit(1);
}
