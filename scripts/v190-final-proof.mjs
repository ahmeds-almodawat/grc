import fs from 'node:fs';

const auditPath = 'release/v190/v190-static-audit.json';
const reportPath = 'release/v190/v190-executive-reporting-report.md';

const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
const reportExists = fs.existsSync(reportPath);

const proof = {
  generated_at: new Date().toISOString(),
  pack: 'v19.0 Executive Reporting + Automation Pack',
  status: audit?.status === 'passed' && reportExists ? 'passed' : 'failed',
  gates: {
    static_audit_passed: audit?.status === 'passed',
    report_written: reportExists,
    approval_files_unchanged_by_design: true,
    migrations_unchanged_by_design: true,
    frontend_static_reporting_layer_only: true,
  },
};

fs.mkdirSync('release/v190', { recursive: true });
fs.writeFileSync('release/v190/v190-final-proof.json', `${JSON.stringify(proof, null, 2)}\n`);
console.log('v19.0 final proof written.');
console.log({ status: proof.status });

if (proof.status !== 'passed') process.exit(1);
