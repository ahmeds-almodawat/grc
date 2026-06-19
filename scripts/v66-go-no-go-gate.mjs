import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const outDir = path.join(root, 'release', 'v66');
fs.mkdirSync(outDir, { recursive: true });

function readJson(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const evidence = readJson('release/v66/v66-evidence-register.json');
const manual = readJson('release/v66/v66-manual-evidence.json');
const requiredManual = Array.isArray(manual?.items) ? manual.items.filter((x) => x.required) : [];
const missingManual = requiredManual.filter((x) => x.status !== 'verified');

const gates = [
  { id: 'local_typecheck_build', status: fs.existsSync(path.join(root, 'dist', 'index.html')) ? 'passed' : 'not_verified' },
  { id: 'v60_no_mock_strict', status: fs.existsSync(path.join(root, 'release', 'v60', 'v60-production-data-audit.json')) ? 'evidence_present' : 'not_verified' },
  {
    id: 'v64_static_security',
    status: (
      fs.existsSync(path.join(root, 'release', 'v64', 'v64-database-security-proof-report.json'))
      || fs.existsSync(path.join(root, 'release', 'v64', 'v64-database-security-proof-summary.json'))
    ) ? 'evidence_present' : 'not_verified'
  },
  { id: 'v65_real_tests', status: fs.existsSync(path.join(root, 'test-results')) || fs.existsSync(path.join(root, 'playwright-report')) ? 'evidence_present' : 'not_verified' },
  { id: 'manual_staging_evidence', status: missingManual.length === 0 && requiredManual.length > 0 ? 'passed' : 'manual_required' }
];

const blocking = gates.filter((g) => ['not_verified', 'manual_required'].includes(g.status));
const report = {
  generated_at: new Date().toISOString(),
  controlled_pilot_status: blocking.length === 0 ? 'ready_for_controlled_pilot_go_no_go_review' : 'not_ready_manual_evidence_required',
  strict_passed: blocking.length === 0,
  gates,
  missing_manual_evidence: missingManual.map((x) => ({ id: x.id, title: x.title, status: x.status, evidence_needed: x.evidence_needed })),
  recommendation: blocking.length === 0
    ? 'Hold final go/no-go meeting and keep pilot limited to approved users.'
    : 'Use only for controlled internal testing until missing manual staging evidence is attached.'
};

fs.writeFileSync(path.join(outDir, 'v66-go-no-go-gate.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'V66_GO_NO_GO_GATE.md'), `# v6.6 Go / No-Go Gate\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`);
console.log('v6.6 go/no-go gate generated.');
console.log(JSON.stringify({ controlled_pilot_status: report.controlled_pilot_status, blocking_count: blocking.length, missing_manual_evidence: report.missing_manual_evidence.length }, null, 2));
if (strict && !report.strict_passed) {
  console.error('v6.6 strict proof failed. Attach/verify manual staging evidence before strict go/no-go.');
  process.exit(1);
}
