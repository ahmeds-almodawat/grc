import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const auditPath = path.join(root, 'release/v240/v240-static-audit.json');
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
const failures = [];

if (!audit) failures.push('Missing v24 static audit report.');
if (audit && audit.status !== 'passed') failures.push('v24 static audit did not pass.');
if (!fs.existsSync(path.join(root, 'release/v240/v240-assurance-sod-auditor-report.md'))) failures.push('Missing v24 assurance report.');

const result = {
  generated_at: new Date().toISOString(),
  status: failures.length ? 'failed' : 'passed',
  failures,
  assurance_chain: 'Framework Requirement → Control → Test → Evidence Integrity → SoD Check → Immutable Log → Auditor Pack → Assurance Opinion',
  scope: 'Static schema/UI readiness proof for assurance, SoD, immutable audit and auditor evidence pack.'
};

fs.mkdirSync(path.join(root, 'release/v240'), { recursive: true });
fs.writeFileSync(path.join(root, 'release/v240/v240-final-proof.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log('v24.0 final proof written.');
console.log({ status: result.status, failures: failures.length });
if (failures.length) process.exit(1);
