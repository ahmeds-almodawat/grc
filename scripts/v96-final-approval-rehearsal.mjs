import { STATUS_PENDING, writeReport } from './v96-common.mjs';

const steps = [
  ['1', 'Open approver brief and packet index', 'Pilot Lead'],
  ['2', 'Confirm controlled internal pilot scope and max users', 'Management/Admin'],
  ['3', 'Confirm environment/security evidence reviewed', 'IT'],
  ['4', 'Confirm OVR confidentiality boundary', 'Quality and IT'],
  ['5', 'Enter real approval JSON values', 'Assigned evidence owner'],
  ['6', 'Run v674 checks and v66 strict proof', 'Project Lead'],
  ['7', 'Capture proof output and commit evidence', 'Project Lead']
];
const rows = steps.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`).join('\n');
const report = writeReport('final-approval-rehearsal.md', 'v9.6 Final Approval Rehearsal', [
  '## Rehearsal sequence',
  '',
  '| Step | Action | Owner |',
  '| --- | --- | --- |',
  rows
]);
console.log('v9.6 final approval rehearsal generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: false, steps: steps.length, report }, null, 2));
