import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v97');
fs.mkdirSync(outDir, { recursive: true });
const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;
const reports = [
  'release/v97/approval-record-integrity-audit.md',
  'release/v97/evidence-lock-manifest.md',
  'release/v97/signoff-change-log-template.md',
  'release/v97/final-approver-packet.md',
  'release/v97/proof-capture-index.md',
  'release/v97/release-freeze-attestation-template.md'
];
const missing = reports.filter((file) => !fs.existsSync(file));
const rows = reports.map((file) => '| ' + file + ' | ' + (fs.existsSync(file) ? 'Present' : 'Missing') + ' |').join('\n');
const md = [
  '# v9.7 Approval Record Integrity / Evidence Lock Review Pack',
  '',
  'Generated: ' + generatedAt,
  '',
  '## Overall status',
  '',
  '| Item | Status |',
  '| --- | --- |',
  '| Status | ' + status + ' |',
  '| Production ready | ' + (productionReady ? 'Yes' : 'No') + ' |',
  '| Missing reports | ' + missing.length + ' |',
  '| Approval gate bypassed | No |',
  '',
  '## Reports',
  '',
  '| Report | State |',
  '| --- | --- |',
  rows,
  '',
  '## Final judgment',
  '',
  'v9.7 improves approval record integrity, evidence locking, final approver packet preparation, and proof capture indexing. It does not complete or replace real human approvals.',
  '',
  'The project remains technical_ready_pending_human_approval and production_ready = false.',
  ''
].join('\n');
fs.writeFileSync(path.join(outDir, 'v97-review-pack.md'), md);
console.log('v9.7 review pack generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, missing_reports: missing.length, report: 'release/v97/v97-review-pack.md' }, null, 2));
