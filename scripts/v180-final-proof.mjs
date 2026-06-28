import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v180');
const auditPath = path.join(releaseDir, 'v180-static-audit.json');
const reportPath = path.join(releaseDir, 'v180-grc-traceability-report.md');

const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
const reportExists = fs.existsSync(reportPath);
const passed = audit?.status === 'passed' && reportExists;

const proof = {
  version: 'v18.0',
  name: 'GRC Traceability + Assurance Map Pack',
  status: passed ? 'passed' : 'failed',
  generated_at: new Date().toISOString(),
  evidence: {
    static_audit: audit?.status ?? 'missing',
    report: reportExists ? 'present' : 'missing',
    professional_chain: 'Risk → Control → Test → Evidence → Issue → CAPA → Audit → Compliance → Board Reporting',
  },
  limitations: [
    'Does not create fake UAT results.',
    'Does not alter manual approval evidence.',
    'Does not change Supabase migrations or proof:all logic.',
  ],
};

fs.writeFileSync(path.join(releaseDir, 'v180-final-proof.json'), JSON.stringify(proof, null, 2));
console.log('v18.0 final proof written.');
console.log({ status: proof.status });
if (!passed) process.exit(1);
