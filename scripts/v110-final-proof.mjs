import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release/v110');
const required = [
  'v110-enterprise-static-audit.json',
  'v110-enterprise-report.md',
  'v110-uat-scenario-matrix.md'
];
const missing = required.filter(name => !fs.existsSync(path.join(releaseDir, name)));
let audit = null;
const auditPath = path.join(releaseDir, 'v110-enterprise-static-audit.json');
if (fs.existsSync(auditPath)) audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const report = {
  generated_at: new Date().toISOString(),
  status: missing.length === 0 && audit?.status === 'passed' ? 'passed' : 'failed',
  failed_count: missing.length + (audit?.status === 'passed' ? 0 : 1),
  missing,
  static_audit_status: audit?.status ?? 'missing',
  production_readiness: 'not_asserted',
  expected_remaining_blockers: [
    'v66 human approval gate until Management/Admin, IT, and Quality approvals are completed',
    'staging persona SQL proof before broad production use',
    'manual UAT signoff for enterprise modules'
  ]
};
fs.writeFileSync(path.join(releaseDir, 'v110-final-proof.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(releaseDir, 'v110-final-proof.md'), `# v11.0 Final Proof\n\n- Generated: ${report.generated_at}\n- Status: **${report.status}**\n- Failed count: ${report.failed_count}\n- Production readiness: **not asserted**\n\n## Expected remaining blockers\n\n${report.expected_remaining_blockers.map(x => `- ${x}`).join('\n')}\n`);
console.log('v11.0 final proof complete.');
console.log(JSON.stringify({ status: report.status, failed_count: report.failed_count, report: 'release/v110/v110-final-proof.json' }, null, 2));
if (report.status !== 'passed') process.exit(1);
