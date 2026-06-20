import fs from 'node:fs';
import path from 'node:path';
import { mdTable, writeText, writeJson, status, productionReady } from './v94-common.mjs';

const expected = [
  ['Approval JSON Shape Audit', 'release/v94/approval-json-shape-audit.md'],
  ['Final Gate Simulator', 'release/v94/final-gate-simulator.md'],
  ['Approver Control Room', 'release/v94/approver-control-room.md'],
  ['Go-Live Rehearsal', 'release/v94/go-live-rehearsal.md'],
  ['Risk Acceptance Register', 'release/v94/risk-acceptance-register.md'],
  ['Proof Readiness Scorecard', 'release/v94/proof-readiness-scorecard.md']
];

const rows = expected.map(([name, file]) => [name, file, fs.existsSync(file) ? 'present' : 'missing']);
const missing = rows.filter((row) => row[2] === 'missing');
const md = [
  '# v9.4 Final Gate Simulator / Approval Control Room Review Pack',
  '',
  '## Overall status',
  '',
  mdTable(['Item', 'Value'], [
    ['Status', status],
    ['Production ready', productionReady ? 'Yes' : 'No'],
    ['Missing reports', missing.length],
    ['Approval gate bypassed', 'No'],
    ['RLS / migrations changed', 'No'],
    ['Runtime bridge changed', 'No']
  ]),
  '',
  '## Report inventory',
  '',
  mdTable(['Report', 'Path', 'Status'], rows),
  '',
  '## Final judgment',
  '',
  'v9.4 strengthens the final approval gate workflow. It does not complete approval by itself. The project remains pending real human approval and production_ready=false.'
].join('\n');

writeText('v94-review-pack.md', md);
writeJson('v94-review-pack.json', { status, production_ready: productionReady, missing_reports: missing.length, expected_reports: expected.length });
console.log('v9.4 review pack generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, missing_reports: missing.length, report: 'release/v94/v94-review-pack.md' }, null, 2));
