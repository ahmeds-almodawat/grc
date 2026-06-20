import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v87');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;

const rows = [
  [
    "Access control",
    "Test role separation and persona restrictions",
    "IT / Audit",
    "Ready"
  ],
  [
    "OVR confidentiality",
    "Verify no real patient identifiers or confidential OVR details in pilot",
    "Quality / IT",
    "Pending human approval"
  ],
  [
    "Evidence integrity",
    "Confirm release evidence and generated packs remain traceable",
    "Audit",
    "Ready"
  ],
  [
    "Restore readiness",
    "Reference restore dry-run evidence and rollback plan",
    "IT",
    "Ready"
  ],
  [
    "Change control",
    "Confirm pilot changes are branch/PR controlled",
    "Project Lead",
    "Ready"
  ]
];
const tableRows = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\\n');

const md = [
  '# v8.7 Control Testing Effectiveness',
  '',
  'Generated: ' + generatedAt,
  '',
  '## Status',
  '',
  '| Item | Value |',
  '| --- | --- |',
  '| Status | ' + status + ' |',
  '| Production ready | ' + (productionReady ? 'Yes' : 'No') + ' |',
  '| Human approval | Pending |',
  '| Approval gate bypassed | No |',
  '',
  '## Control testing matrix',
  '',
  '| Area | Evidence / Action | Owner | Status |',
  '| --- | --- | --- | --- |',
  tableRows,
  '',
  '## Safety boundary',
  '',
  'This pack does not modify approval files, RLS policies, migrations, runtime bridge logic, Supabase functions, or production readiness gates.',
  '',
  '## Final judgment',
  '',
  'The project remains technical_ready_pending_human_approval and production_ready = false.',
  '',
  'The remaining blocker is real Management/Admin, IT, and Quality signoff plus OVR confidentiality confirmation.',
  ''
].join('\\n');

fs.writeFileSync(path.join(outDir, 'v87-control-testing-effectiveness.md'), md);

console.log('v8.7 Control Testing Effectiveness generated.');
console.log(JSON.stringify({
  status,
  production_ready: productionReady,
  report: 'release/v87/v87-control-testing-effectiveness.md'
}, null, 2));
