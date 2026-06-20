import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v90');
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const status = 'technical_ready_pending_human_approval';
const productionReady = false;

const rows = [
  ['Technical evidence', 'Summarize typecheck, build, runtime security, persona proof, restore proof, and repo health', 'Project Lead', 'Ready'],
  ['Operational evidence', 'Summarize pilot console, issue log, monitoring, access review, and closeout dashboard', 'Pilot Operator', 'Ready'],
  ['Human approval', 'Management/Admin, IT, Quality, and confidentiality confirmation', 'Approvers', 'Pending'],
  ['Controlled pilot decision', 'Approve / defer / reject controlled internal pilot', 'Management', 'Pending'],
  ['Production decision', 'Explicitly not production-ready until live staging and production proof are completed', 'Management / IT', 'Not ready']
];

const tableRows = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');

const md = [
  '# v9.0 Controlled-Pilot Final Decision Dossier',
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
  '## Final decision dossier',
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
].join('\n');

fs.writeFileSync(path.join(outDir, 'v90-controlled-pilot-final-dossier.md'), md);
fs.writeFileSync(path.join(outDir, 'v90-final-decision-dossier.md'), md);

console.log('v9.0 Controlled-Pilot Final Decision Dossier generated.');
console.log(JSON.stringify({
  status,
  production_ready: productionReady,
  reports: [
    'release/v90/v90-controlled-pilot-final-dossier.md',
    'release/v90/v90-final-decision-dossier.md'
  ]
}, null, 2));
