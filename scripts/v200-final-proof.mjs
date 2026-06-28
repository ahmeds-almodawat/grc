import fs from 'node:fs';

const auditPath = 'release/v200/v200-static-audit.json';
const reportPath = 'release/v200/v200-production-readiness-report.md';
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
const reportExists = fs.existsSync(reportPath);
const status = audit?.status === 'passed' && reportExists ? 'passed' : 'failed';

const proof = {
  generated_at: new Date().toISOString(),
  status,
  audit_status: audit?.status ?? 'missing',
  report_exists: reportExists,
  recommendation: 'controlled_production_start_review_required_until_real_uat_closure_and_final_go_no_go',
  no_fake_uat_results: true,
  no_approval_json_changes_required: true,
  output: 'release/v200/v200-final-proof.json',
};

fs.mkdirSync('release/v200', { recursive: true });
fs.writeFileSync('release/v200/v200-final-proof.json', `${JSON.stringify(proof, null, 2)}\n`);
console.log('v20.0 final proof written.');
console.log({ status });
if (status !== 'passed') process.exit(1);
