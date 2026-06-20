import { STATUS, PRODUCTION_READY, writeJson, writeMd, table, printResult } from './v93-common.mjs';

const tasks = [
  ['Management/Admin', 'Confirm controlled internal pilot scope', 'pilot-signoff.json', 'Pending real approval'],
  ['Management/Admin', 'Confirm maximum pilot users from 1 to 15', 'pilot-signoff.json', 'Pending real approval'],
  ['IT', 'Confirm technical evidence reviewed', 'pilot-signoff.json', 'Pending real approval'],
  ['IT', 'Confirm OVR confidentiality technical boundary', 'ovr-confidentiality-confirmation.json', 'Pending real approval'],
  ['Quality', 'Confirm quality/OVR pilot boundary', 'pilot-signoff.json', 'Pending real approval'],
  ['Quality', 'Confirm no real patient identifiers / confidential OVR details', 'ovr-confidentiality-confirmation.json', 'Pending real approval'],
  ['Project Lead', 'Run post-signoff proof commands after approval', 'terminal evidence', 'Waiting for approval'],
  ['Audit', 'Review final proof result and retain packet', 'proof:all output', 'Waiting for approval']
];

writeJson('release/v93/approver-task-board.json', {
  generated_at: new Date().toISOString(),
  status: STATUS,
  production_ready: PRODUCTION_READY,
  tasks: tasks.map(([owner, task, target, state]) => ({ owner, task, target, state }))
});

writeMd('release/v93/approver-task-board.md', [
  '# v9.3 Approver Task Board',
  '',
  ...table(['Owner', 'Task', 'Target', 'State'], tasks),
  '',
  '## Rule',
  '',
  'Only real approvers may complete approval fields. Do not use placeholder names, placeholder roles, or artificial decisions.',
  ''
]);

printResult('v9.3 approver task board generated.', {
  status: STATUS,
  production_ready: PRODUCTION_READY,
  tasks: tasks.length,
  report: 'release/v93/approver-task-board.md'
});
