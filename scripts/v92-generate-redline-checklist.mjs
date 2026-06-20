import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v92');
fs.mkdirSync(outDir, { recursive: true });
const generatedAt = new Date().toISOString();

const items = [
  ['Pilot scope', 'Confirm controlled internal pilot, synthetic/non-confidential data, no production rollout'],
  ['Maximum pilot users', 'Confirm integer from 1 to 15'],
  ['Management/Admin approval', 'Real name, role, date, decision, scope'],
  ['IT approval', 'Real name, role, date, decision, scope, evidence reviewed'],
  ['Quality approval', 'Real name, role, date, decision, scope, evidence reviewed'],
  ['OVR confidentiality - IT', 'Real reviewer and decision confirming confidentiality scope'],
  ['OVR confidentiality - Quality', 'Real reviewer and decision confirming confidentiality scope'],
  ['No real patient identifiers', 'Statement must be true'],
  ['No confidential OVR details', 'Statement must be true'],
  ['Controlled pilot users only', 'Statement must be true']
];

const rows = items.map((item) => '| ' + item[0] + ' | ' + item[1] + ' | Pending reviewer completion |').join('\n');

const md = [
  '# v9.2 Approval Redline Checklist',
  '',
  'Generated: ' + generatedAt,
  '',
  '| Area | Required reviewer confirmation | Status |',
  '| --- | --- | --- |',
  rows,
  '',
  '## Non-negotiable rule',
  '',
  'Do not enter placeholder names, fake dates, or assumed decisions. If an approver has not approved, leave the field incomplete and keep the gate blocked.',
  ''
].join('\n');

fs.writeFileSync(path.join(outDir, 'approval-redline-checklist.md'), md);
console.log('v9.2 approval redline checklist generated.');
console.log(JSON.stringify({ status: 'technical_ready_pending_human_approval', production_ready: false, items: items.length, report: 'release/v92/approval-redline-checklist.md' }, null, 2));
