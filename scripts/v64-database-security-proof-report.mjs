import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v64');
fs.mkdirSync(outDir, { recursive: true });

function readJson(name) {
  const file = path.join(outDir, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const rls = readJson('v64-rls-static-audit.json');
const fns = readJson('v64-security-function-audit.json');
const views = readJson('v64-view-security-audit.json');
const generatedAt = new Date().toISOString();
const sections = [
  ['RLS static audit', rls?.summary],
  ['Security function audit', fns?.summary],
  ['View security audit', views?.summary]
];

const highRisk = [
  ...(rls?.findings || []),
  ...(fns?.findings || []),
  ...(views?.findings || [])
].filter((f) => ['critical', 'high'].includes(f.severity));

const overall = {
  generated_at: generatedAt,
  rls_static_strict_passed: Boolean(rls?.summary?.strict_passed),
  function_static_strict_passed: Boolean(fns?.summary?.strict_passed),
  view_static_strict_passed: Boolean(views?.summary?.strict_passed),
  high_risk_findings: highRisk.length,
  database_security_status: highRisk.length === 0 ? 'static_ready_pending_staging_persona_sql' : 'needs_security_remediation',
  warning: 'Static readiness does not equal production proof. Run the SQL persona tests in staging.'
};

const md = `# v6.4 Database Security Proof Report\n\nGenerated: ${generatedAt}\n\n## Overall\n\n\`\`\`json\n${JSON.stringify(overall, null, 2)}\n\`\`\`\n\n## Audit summaries\n\n${sections.map(([title, summary]) => `### ${title}\n\n\`\`\`json\n${JSON.stringify(summary || { missing: true }, null, 2)}\n\`\`\``).join('\n\n')}\n\n## High-risk findings\n\n${highRisk.slice(0, 100).map((f) => `- **${f.severity}** ${f.code}: ${f.table || f.view || f.function_name || f.file} — ${f.message}`).join('\n') || 'No high-risk static findings. Run staging SQL persona tests next.'}\n\n## Required staging proof\n\n- Apply migrations to a fresh Supabase staging database.\n- Run \`supabase/tests/v64_persona_security_tests.sql\`.\n- Test five real users: Admin, Super User, Audit, Manager, Employee.\n- Attach SQL output to release evidence.\n`;
fs.writeFileSync(path.join(outDir, 'V64_DATABASE_SECURITY_PROOF_REPORT.md'), md);
fs.writeFileSync(path.join(outDir, 'v64-database-security-proof-summary.json'), JSON.stringify(overall, null, 2));
console.log('v6.4 database security proof report generated.');
console.log(JSON.stringify(overall, null, 2));
