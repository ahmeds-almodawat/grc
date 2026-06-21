import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v97');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;
const rows = [
  [
    "v674 signoff check",
    "Capture output after approvals are filled",
    "Project Lead",
    "Pending"
  ],
  [
    "v674 sync manual evidence",
    "Capture output showing manual evidence synchronized",
    "Project Lead",
    "Pending"
  ],
  [
    "v66 strict proof",
    "Capture output showing strict proof passed",
    "Project Lead",
    "Pending"
  ],
  [
    "proof:all",
    "Capture final 17 passed / 0 failed output after approval gate passes",
    "Project Lead",
    "Pending"
  ],
  [
    "Git commit",
    "Commit approval support and evidence outputs without fabricating approval content",
    "Project Lead",
    "Pending"
  ]
];
const tableRows = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');

const md = [
  '# v9.7 Proof Capture Index',
  '',
  'Generated: ' + generatedAt,
  '',
  '## Status',
  '',
  '| Item | Value |',
  '| --- | --- |',
  '| Status | ' + status + ' |',
  '| Production ready | ' + (productionReady ? 'Yes' : 'No') + ' |',
  '| Approval gate bypassed | No |',
  '| Manual approval still required | Yes |',
  '',
  '## Details',
  '',
  '| Area | Action / Evidence | Owner | State |',
  '| --- | --- | --- | --- |',
  tableRows,
  '',
  '## Safety boundary',
  '',
  'This v9.7 output does not fill approvals, bypass strict proof, modify RLS, change migrations, change runtime bridge logic, or mark production ready.',
  '',
  '## Required final action',
  '',
  'Complete the real approval files, then run v674 signoff check, sync manual evidence, v66 strict proof, and proof:all.',
  ''
].join('\n');

fs.writeFileSync(path.join(outDir, 'proof-capture-index.md'), md);
console.log('v9.7 proof capture index generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, report: 'release/v97/proof-capture-index.md' }, null, 2));
