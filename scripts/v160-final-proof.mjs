import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v160');
const auditPath = path.join(releaseDir, 'v160-static-audit.json');
const reportPath = path.join(releaseDir, 'v160-compliance-management-report.md');

const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
const reportExists = fs.existsSync(reportPath);

const checks = [
  { id: 'static-audit-passed', passed: audit?.status === 'passed' },
  { id: 'report-generated', passed: reportExists },
  { id: 'no-critical-static-gaps', passed: (audit?.critical ?? 1) === 0 },
  { id: 'no-high-static-gaps', passed: (audit?.high ?? 1) === 0 },
];

const failed = checks.filter(check => !check.passed);
const proof = {
  version: 'v16.0',
  pack: 'Compliance Management System Execution Pack',
  status: failed.length === 0 ? 'passed' : 'failed',
  generated_at: new Date().toISOString(),
  checks,
  failed_count: failed.length,
  recommendation:
    failed.length === 0
      ? 'Ready for controlled compliance management pilot validation.'
      : 'Do not commit v16 until failed proof checks are corrected.',
};

fs.mkdirSync(releaseDir, { recursive: true });
fs.writeFileSync(path.join(releaseDir, 'v160-final-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

console.log('v16.0 final proof complete.');
console.log({ status: proof.status, failed_count: proof.failed_count });

if (proof.status !== 'passed') {
  process.exit(1);
}
