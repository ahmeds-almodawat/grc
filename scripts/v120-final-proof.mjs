import fs from 'node:fs';
import path from 'node:path';
const releaseDir = path.join('release', 'v120');
fs.mkdirSync(releaseDir, { recursive: true });
const required = [
  'supabase/migrations/054_v120_operational_polish_data_quality_suite.sql',
  'scripts/v120-install-package-scripts.mjs',
  'scripts/v120-polish-static-audit.mjs',
  'scripts/v120-generate-polish-report.mjs',
  'scripts/v120-generate-uat-matrix.mjs',
  'scripts/v120-final-proof.mjs',
  'src/styles/v120-polish.css',
  'src/lib/v120EnterprisePolish.ts',
  'release/v120/README.md',
  'release/v120/v120-polish-static-audit.json',
  'release/v120/v120-polish-report.md',
  'release/v120/v120-uat-scenario-matrix.md',
  'README_APPLY_V120_OPERATIONAL_POLISH_DATA_QUALITY_SUITE.md'
];
const missing = required.filter(file => !fs.existsSync(file));
let audit = null;
try { audit = JSON.parse(fs.readFileSync(path.join(releaseDir, 'v120-polish-static-audit.json'), 'utf8')); } catch {}
const report = {
  generated_at: new Date().toISOString(),
  status: missing.length === 0 && audit?.status === 'passed' ? 'passed' : 'failed',
  failed_count: missing.length + (audit?.status === 'passed' ? 0 : 1),
  missing,
  static_audit_status: audit?.status ?? 'missing',
  production_readiness: 'not_asserted',
  expected_remaining_blockers: [
    'v66 human approval gate until Management/Admin, IT, and Quality approvals are completed',
    'local Docker migration apply proof for v12.0',
    'staging persona SQL proof before broad production use',
    'manual UAT signoff for polish/data-quality workflows'
  ]
};
fs.writeFileSync(path.join(releaseDir, 'v120-final-proof.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(releaseDir, 'v120-final-proof.md'), `# v12.0 Final Proof\n\n- Generated: ${report.generated_at}\n- Status: **${report.status}**\n- Failed count: ${report.failed_count}\n- Production readiness: **not asserted**\n\n## Expected remaining blockers\n\n${report.expected_remaining_blockers.map(x => `- ${x}`).join('\n')}\n`);
console.log('v12.0 final proof complete.');
console.log(JSON.stringify({ status: report.status, failed_count: report.failed_count, report: 'release/v120/v120-final-proof.json' }, null, 2));
if (report.status !== 'passed') process.exit(1);
