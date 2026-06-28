import fs from 'node:fs';

const auditPath = 'release/v130/v130-ux-static-audit.json';
const reportPath = 'release/v130/v130-executive-polish-report.md';
const uatPath = 'release/v130/v130-guided-uat-script.md';

const failures = [];
if (!fs.existsSync(auditPath)) failures.push(`${auditPath} missing`);
if (!fs.existsSync(reportPath)) failures.push(`${reportPath} missing`);
if (!fs.existsSync(uatPath)) failures.push(`${uatPath} missing`);

let audit = null;
if (fs.existsSync(auditPath)) {
  audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  if (audit.status !== 'passed') failures.push('v13 UX static audit did not pass');
}

const result = {
  generated_at: new Date().toISOString(),
  status: failures.length === 0 ? 'passed' : 'failed',
  failed_count: failures.length,
  failures,
  production_readiness_asserted: false,
  database_migration_included: false,
  manual_approval_bypass: false,
  expected_remaining_external_blocker: 'v66:strict-proof until real approvals are completed',
};

fs.mkdirSync('release/v130', { recursive: true });
fs.writeFileSync('release/v130/v130-final-proof.json', `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync('release/v130/v130-final-proof.md', `# v13.0 Final Proof\n\nStatus: **${result.status}**\n\nFailed count: ${result.failed_count}\n\nDatabase migration included: **no**\n\nProduction readiness asserted: **no**\n\nExpected remaining blocker outside v13: **${result.expected_remaining_external_blocker}**\n`);
fs.writeFileSync('release/v130/v130-validation-summary.md', `# v13.0 Validation Summary\n\n- UX static audit: ${audit?.status ?? 'missing'}\n- Executive polish report: ${fs.existsSync(reportPath) ? 'generated' : 'missing'}\n- Guided UAT script: ${fs.existsSync(uatPath) ? 'generated' : 'missing'}\n- Final proof: ${result.status}\n- DB migration: none\n`);

console.log('v13.0 final proof complete.');
console.log(JSON.stringify({ status: result.status, failed_count: result.failed_count, report: 'release/v130/v130-final-proof.json' }, null, 2));

if (result.status !== 'passed') process.exit(1);
