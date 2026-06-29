import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const auditPath = path.join(root, 'release/v230/v230-static-audit.json');
const reportPath = path.join(root, 'release/v230/v230-compliance-hardening-report.md');
const failures = [];

if (!fs.existsSync(auditPath)) {
  failures.push('Missing v230 static audit output.');
}
if (!fs.existsSync(reportPath)) {
  failures.push('Missing v230 compliance hardening report.');
}
if (fs.existsSync(auditPath)) {
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  if (audit.status !== 'passed') {
    failures.push('v230 static audit did not pass.');
  }
}

const proof = {
  generated_at: new Date().toISOString(),
  status: failures.length ? 'failed' : 'passed',
  failures,
  chain: 'Policy → Attestation → Regulatory Change → Vendor Risk → Incident → Evidence → CAPA → Management Reporting',
  production_note: 'v23 creates a professional compliance-hardening backbone but does not claim certification or external accreditation.'
};

const outDir = path.join(root, 'release/v230');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'v230-final-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);
console.log('v23.0 final proof written.');
console.log({ status: proof.status, failures: failures.length });
if (failures.length) {
  process.exitCode = 1;
}
