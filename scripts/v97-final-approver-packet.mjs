import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v97');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;
const rows = [
  [
    "Management/Admin",
    "Review controlled pilot scope, user limit, evidence summary, and decision options",
    "Management/Admin",
    "Pending"
  ],
  [
    "IT",
    "Review restore dry-run, security definer audit, runtime bridge proof, and access boundary",
    "IT",
    "Pending"
  ],
  [
    "Quality",
    "Review OVR confidentiality, no real patient identifiers, and controlled pilot constraints",
    "Quality",
    "Pending"
  ],
  [
    "Audit",
    "Review evidence completeness and no bypass of strict proof gate",
    "Audit",
    "Ready"
  ],
  [
    "Project Lead",
    "Run final proof commands after approvals and preserve outputs",
    "Project Lead",
    "Pending"
  ]
];
const tableRows = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');

const md = [
  '# v9.7 Final Approver Packet',
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

fs.writeFileSync(path.join(outDir, 'final-approver-packet.md'), md);
console.log('v9.7 final approver packet generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, report: 'release/v97/final-approver-packet.md' }, null, 2));
