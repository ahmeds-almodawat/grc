import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v97');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;
const rows = [
  [
    "Approval file edits",
    "Record who edited each approval file, when, and based on which meeting decision",
    "Project Lead",
    "Template ready"
  ],
  [
    "Scope changes",
    "Record any changes to pilot scope or maximum pilot users",
    "Management",
    "Template ready"
  ],
  [
    "Confidentiality assertions",
    "Record reviewer confirmation that no real patient identifiers or confidential OVR details are used",
    "IT / Quality",
    "Template ready"
  ],
  [
    "Proof rerun",
    "Record exact command timestamps and outcomes after approval completion",
    "Project Lead",
    "Template ready"
  ],
  [
    "Exception handling",
    "Record any rejected, deferred, or conditional approval decision",
    "Management",
    "Template ready"
  ]
];
const tableRows = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');

const md = [
  '# v9.7 Signoff Change Log Template',
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

fs.writeFileSync(path.join(outDir, 'signoff-change-log-template.md'), md);
console.log('v9.7 signoff change log template generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, report: 'release/v97/signoff-change-log-template.md' }, null, 2));
