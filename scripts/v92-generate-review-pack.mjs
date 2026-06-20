import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v92');
fs.mkdirSync(outDir, { recursive: true });
const generatedAt = new Date().toISOString();

const reports = [
  'release/v92/approval-field-map.md',
  'release/v92/approval-redline-checklist.md',
  'release/v92/signoff-packet-index.md',
  'release/v92/final-proof-run-sequence.md'
];
const missing = reports.filter((r) => !fs.existsSync(r));
const rows = reports.map((r) => '| ' + r + ' | ' + (fs.existsSync(r) ? 'Available' : 'Missing') + ' |').join('\n');

const md = [
  '# v9.2 Signoff Evidence QA Review Pack',
  '',
  'Generated: ' + generatedAt,
  '',
  '| Item | Value |',
  '| --- | --- |',
  '| Status | technical_ready_pending_human_approval |',
  '| Production ready | No |',
  '| Approval gate bypassed | No |',
  '| Missing reports | ' + missing.length + ' |',
  '',
  '## Reports',
  '',
  '| Report | Status |',
  '| --- | --- |',
  rows,
  '',
  '## Final judgment',
  '',
  'v9.2 improves final signoff evidence QA only. It does not reduce the need for real approvals.',
  ''
].join('\n');

fs.writeFileSync(path.join(outDir, 'v92-review-pack.md'), md);
console.log('v9.2 review pack generated.');
console.log(JSON.stringify({ status: 'technical_ready_pending_human_approval', production_ready: false, missing_reports: missing.length, report: 'release/v92/v92-review-pack.md' }, null, 2));
