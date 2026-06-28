import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const staticAuditPath = path.join(root, 'release/v220/v220-static-audit.json');
const staticAudit = fs.existsSync(staticAuditPath) ? JSON.parse(fs.readFileSync(staticAuditPath, 'utf8')) : null;
const passed = staticAudit?.status === 'passed';
const proof = {
  generated_at: new Date().toISOString(),
  version: 'v22.0',
  status: passed ? 'passed' : 'failed',
  evidence: {
    static_audit: 'release/v220/v220-static-audit.json',
    report: 'release/v220/v220-control-testing-report.md',
    migration: 'supabase/migrations/058_v220_control_testing_capa_execution.sql',
  },
  statement: 'v22 adds a control testing and CAPA execution backbone. It does not claim accreditation or fake live assurance evidence.',
};
fs.mkdirSync(path.join(root, 'release/v220'), { recursive: true });
fs.writeFileSync(path.join(root, 'release/v220/v220-final-proof.json'), JSON.stringify(proof, null, 2));
console.log('v22.0 final proof written.');
console.log({ status: proof.status });
if (!passed) process.exit(1);
