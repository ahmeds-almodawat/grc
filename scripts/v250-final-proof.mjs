import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const auditPath = path.join(root, 'release/v250/v250-static-audit.json');
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
const failures = [];
if (!audit) failures.push('v25 static audit report missing.');
if (audit && audit.status !== 'passed') failures.push('v25 static audit did not pass.');

const proof = {
  generated_at: new Date().toISOString(),
  status: failures.length ? 'failed' : 'passed',
  failures,
  professional_chain: 'Operating Cycle → Data Intake → Edge Bridge Review → Access Review → Evidence Snapshot → Production Exception → Management Sign-off',
  production_reliance: 'review_required_until_real_live_bridge_and_access_review_evidence_is_approved'
};
fs.mkdirSync(path.join(root, 'release/v250'), { recursive: true });
fs.writeFileSync(path.join(root, 'release/v250/v250-final-proof.json'), JSON.stringify(proof, null, 2));
console.log('v25.0 final proof written.');
console.log({ status: proof.status });
if (failures.length) process.exit(1);
