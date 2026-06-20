import { mdTable, writeText, writeJson, status, productionReady } from './v94-common.mjs';

const steps = [
  ['Day -1', 'Freeze pilot scope and confirm approved user list', 'Pilot Lead / IT', 'Pending approval'],
  ['Day -1', 'Run final proof sequence after real approval', 'Project Lead', 'Pending approval'],
  ['Day 0', 'Enable only controlled-pilot users', 'IT', 'Not started'],
  ['Day 0', 'Run smoke test with synthetic/non-confidential data', 'Pilot Operator', 'Not started'],
  ['Day 1', 'Review daily monitoring, issues, access, and feedback', 'Pilot Operator / Quality', 'Not started'],
  ['Day 1', 'Escalate blockers and update issue log', 'Pilot Lead', 'Not started'],
  ['Closeout', 'Decide continue, pause, expand, or remediate', 'Management / Quality / IT', 'Not started']
];

const md = [
  '# v9.4 Controlled Pilot Go-Live Rehearsal',
  '',
  mdTable(['Timing', 'Step', 'Owner', 'Status'], steps),
  '',
  '## Constraints',
  '',
  '- Synthetic/non-confidential data only.',
  '- 5 to 15 internal pilot users only.',
  '- No real patient identifiers.',
  '- No confidential OVR details.',
  '- No production rollout.'
].join('\n');

writeText('go-live-rehearsal.md', md);
writeJson('go-live-rehearsal.json', { status, production_ready: productionReady, steps: steps.length });
console.log('v9.4 go-live rehearsal generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, steps: steps.length, report: 'release/v94/go-live-rehearsal.md' }, null, 2));
