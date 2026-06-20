import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v97');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;
const rows = [
  [
    "Freeze boundary",
    "No more planning packs unless a real blocker appears",
    "Project Lead",
    "Recommended"
  ],
  [
    "Approval-only changes",
    "Limit changes to real approval files and final proof evidence after signoff",
    "Project Lead",
    "Recommended"
  ],
  [
    "No production declaration",
    "Do not mark production ready from controlled-pilot evidence",
    "Management / IT",
    "Required"
  ],
  [
    "No real patient data",
    "Keep pilot synthetic/non-confidential until explicitly approved otherwise",
    "Quality",
    "Required"
  ],
  [
    "Post-approval verification",
    "Run exact final proof sequence before any pilot launch decision",
    "Project Lead",
    "Required"
  ]
];
const tableRows = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');

const md = [
  '# v9.7 Release Freeze Attestation Template',
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

fs.writeFileSync(path.join(outDir, 'release-freeze-attestation-template.md'), md);
console.log('v9.7 release freeze attestation template generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, report: 'release/v97/release-freeze-attestation-template.md' }, null, 2));
