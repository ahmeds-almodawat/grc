import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v86');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;

const rows = [
  [
    "Pilot launch evidence",
    "Capture launch decision, scope, users, dates, and operator assignment",
    "Pilot Lead",
    "Pending human approval"
  ],
  [
    "Daily monitoring evidence",
    "Collect daily checklist output, blockers, incidents, and escalations",
    "Pilot Operator",
    "Ready"
  ],
  [
    "Issue log evidence",
    "Track issue severity, owner, due date, resolution, and residual risk",
    "Pilot Operator",
    "Ready"
  ],
  [
    "Access review evidence",
    "Confirm only approved pilot users have access",
    "IT",
    "Pending human approval"
  ],
  [
    "Closeout evidence",
    "Collect acceptance, issues, learnings, and exit decision",
    "Quality / Management",
    "Pending"
  ]
];
const tableRows = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\\n');

const md = [
  '# v8.6 Pilot Execution Evidence',
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
  '## Execution evidence checklist',
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

fs.writeFileSync(path.join(outDir, 'v86-pilot-execution-evidence.md'), md);

console.log('v8.6 Pilot Execution Evidence generated.');
console.log(JSON.stringify({
  status,
  production_ready: productionReady,
  report: 'release/v86/v86-pilot-execution-evidence.md'
}, null, 2));
