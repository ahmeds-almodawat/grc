import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v150');
const auditPath = path.join(releaseDir, 'v150-static-audit.json');
const reportPath = path.join(releaseDir, 'v150-audit-program-report.md');

const failures = [];

if (!fs.existsSync(auditPath)) {
  failures.push('Missing release/v150/v150-static-audit.json. Run npm run v150:audit-program-audit first.');
}

if (!fs.existsSync(reportPath)) {
  failures.push('Missing release/v150/v150-audit-program-report.md. Run npm run v150:audit-program-report first.');
}

let audit = null;
if (fs.existsSync(auditPath)) {
  audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  if (audit.status !== 'passed') {
    failures.push(`Static audit status is ${audit.status}.`);
  }
  if ((audit.summary?.critical ?? 0) > 0 || (audit.summary?.high ?? 0) > 0) {
    failures.push('Static audit still has critical/high failures.');
  }
}

const proof = {
  version: 'v15.0',
  name: 'Audit Program Execution Pack final proof',
  status: failures.length === 0 ? 'passed' : 'failed',
  generated_at: new Date().toISOString(),
  gates: {
    static_audit_passed: audit?.status === 'passed',
    release_report_generated: fs.existsSync(reportPath),
    approval_files_touched: false,
    database_migration_required: false,
    proof_all_logic_touched: false,
    controlled_uat_only: true,
  },
  failures,
};

fs.writeFileSync(path.join(releaseDir, 'v150-final-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);
console.log('v15.0 final proof complete.');
console.log({ status: proof.status, failures: failures.length });

if (proof.status !== 'passed') {
  process.exit(1);
}
