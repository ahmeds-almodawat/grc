import { STATUS_PENDING, writeReport } from './v96-common.mjs';

const controls = [
  ['Freeze approval evidence after signoff', 'Do not modify approval JSON after final proof except through documented change control', 'Pending signoff'],
  ['Capture proof outputs', 'Save v674, v66, and proof:all outputs after approvals', 'Ready'],
  ['Protect final branch', 'Commit signoff evidence and proof outputs on dedicated branch/PR', 'Ready'],
  ['Record approver meeting result', 'Attach meeting minutes or reference to approved internal meeting note', 'Pending signoff'],
  ['Do not expand scope silently', 'Any change above 15 users or real data requires new approval', 'Ready']
];
const rows = controls.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`).join('\n');
const report = writeReport('evidence-lock-plan.md', 'v9.6 Evidence Lock Plan', [
  '## Lock controls',
  '',
  '| Control | Action | Status |',
  '| --- | --- | --- |',
  rows
]);
console.log('v9.6 evidence lock plan generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: false, controls: controls.length, report }, null, 2));
