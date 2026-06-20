import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v92');
fs.mkdirSync(outDir, { recursive: true });
const generatedAt = new Date().toISOString();

const evidence = [
  ['Technical proof summary', 'release/v700/proof-suite-all.json'],
  ['Approval validator output', 'release/v674/v674-signoff-check.json'],
  ['Manual approval files', 'release/v674/approvals/'],
  ['v9.1 approval lint', 'release/v91/approval-readiness-lint.md'],
  ['v9.2 approval field map', 'release/v92/approval-field-map.md'],
  ['v9.2 redline checklist', 'release/v92/approval-redline-checklist.md'],
  ['Post-signoff runbook', 'release/v91/post-signoff-proof-runbook.md']
];

const rows = evidence.map((item) => '| ' + item[0] + ' | ' + item[1] + ' | ' + (fs.existsSync(item[1]) ? 'Available' : 'Check after generation') + ' |').join('\n');

const md = [
  '# v9.2 Signoff Packet Index',
  '',
  'Generated: ' + generatedAt,
  '',
  '| Evidence item | Path | Status |',
  '| --- | --- | --- |',
  rows,
  '',
  '## Usage',
  '',
  'Use this index during the final approval meeting so every approver knows exactly what they are approving.',
  ''
].join('\n');

fs.writeFileSync(path.join(outDir, 'signoff-packet-index.md'), md);
console.log('v9.2 signoff packet index generated.');
console.log(JSON.stringify({ status: 'technical_ready_pending_human_approval', production_ready: false, evidence_items: evidence.length, report: 'release/v92/signoff-packet-index.md' }, null, 2));
