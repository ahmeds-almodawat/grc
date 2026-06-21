import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v97');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;
const rows = [
  [
    "Proof suite evidence",
    "Lock latest proof:all report and note the single expected approval-gate failure if approvals are pending",
    "Project Lead",
    "Ready"
  ],
  [
    "Approval evidence",
    "Lock pilot signoff and OVR confidentiality files only after real approvers complete them",
    "Approvers",
    "Pending"
  ],
  [
    "Release evidence",
    "Preserve v7.3 through v9.7 generated reports as controlled-pilot support evidence",
    "Audit",
    "Ready"
  ],
  [
    "Change freeze",
    "Freeze further planning packs unless a specific defect or approval issue is found",
    "Project Lead",
    "Recommended"
  ],
  [
    "Post-signoff evidence",
    "Capture clean v674, v66, and proof:all outputs after real approvals",
    "Project Lead",
    "Pending"
  ]
];
const tableRows = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');

const md = [
  '# v9.7 Evidence Lock Manifest',
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

fs.writeFileSync(path.join(outDir, 'evidence-lock-manifest.md'), md);
console.log('v9.7 evidence lock manifest generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, report: 'release/v97/evidence-lock-manifest.md' }, null, 2));
