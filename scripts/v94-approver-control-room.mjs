import { evaluateApprovals, mdTable, writeText, writeJson, status, productionReady } from './v94-common.mjs';

const approvals = evaluateApprovals();
const tasks = [
  ['Management/Admin', 'Review controlled pilot scope and approve or reject pilot-signoff.json', 'Pending real approval'],
  ['IT', 'Confirm evidence review, access boundary, staging proof, and IT signoff fields', 'Pending real approval'],
  ['Quality', 'Confirm quality scope, OVR confidentiality, and Quality signoff fields', 'Pending real approval'],
  ['Pilot Lead', 'Prepare approval packet and ensure no placeholders remain', approvals.failed > 0 ? 'Action needed' : 'Ready for proof'],
  ['Audit / Reviewer', 'Review v9.4 gate simulator and v9.3 command center outputs', 'Ready'],
  ['Project Owner', 'Run post-approval proof protocol after real signoff', 'Pending approval completion']
];

const md = [
  '# v9.4 Approver Control Room',
  '',
  '## Approver task board',
  '',
  mdTable(['Owner', 'Task', 'Status'], tasks),
  '',
  '## Approval readiness',
  '',
  mdTable(['Metric', 'Value'], [
    ['Required approval fields', approvals.required],
    ['Passed fields', approvals.passed],
    ['Missing or invalid fields', approvals.failed],
    ['Lint status', approvals.status]
  ]),
  '',
  '## Rule',
  '',
  'No person should approve unless the controlled internal pilot scope is understood and no real patient identifiers or confidential OVR details will be used.'
].join('\n');

writeText('approver-control-room.md', md);
writeJson('approver-control-room.json', { status, production_ready: productionReady, tasks: tasks.length, approval_missing_or_invalid: approvals.failed });
console.log('v9.4 approver control room generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, tasks: tasks.length, approval_missing_or_invalid: approvals.failed, report: 'release/v94/approver-control-room.md' }, null, 2));
