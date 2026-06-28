import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v210');
const auditPath = path.join(releaseDir, 'v210-static-audit.json');
const reportPath = path.join(releaseDir, 'v210-framework-crosswalk-report.md');
const proofPath = path.join(releaseDir, 'v210-final-proof.json');

const audit = fs.existsSync(auditPath)
  ? JSON.parse(fs.readFileSync(auditPath, 'utf8'))
  : null;

const proof = {
  generated_at: new Date().toISOString(),
  version: 'v21.0',
  status: audit?.status === 'passed' && fs.existsSync(reportPath) ? 'passed' : 'failed',
  audit_status: audit?.status ?? 'missing',
  report_exists: fs.existsSync(reportPath),
  framework_crosswalk_ready: audit?.status === 'passed',
  production_claim: 'not_claimed',
  note: 'v21 is a framework crosswalk/backbone readiness pack. It does not claim external accreditation or production certification.',
};

fs.mkdirSync(releaseDir, { recursive: true });
fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');

console.log('v21.0 final proof written.');
console.log({ status: proof.status });

if (proof.status !== 'passed') {
  process.exitCode = 1;
}
