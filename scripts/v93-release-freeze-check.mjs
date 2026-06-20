import { STATUS, PRODUCTION_READY, proofSummary, writeJson, writeMd, table, printResult } from './v93-common.mjs';

const proof = proofSummary();
const checks = [
  ['Working tree', 'Run git status before and after approval', 'Manual check required'],
  ['Proof baseline', 'Latest proof summary available', proof.status],
  ['Approval freeze', 'Do not alter unrelated release artifacts after signoff', 'Required'],
  ['Post-approval proof', 'Run v674 signoff check, sync, v66 strict proof, proof all', 'Required'],
  ['Production boundary', 'Do not mark production ready after controlled pilot approval', 'Required']
];

writeJson('release/v93/release-freeze-check.json', {
  generated_at: new Date().toISOString(),
  status: STATUS,
  production_ready: PRODUCTION_READY,
  checks: checks.map(([area, action, state]) => ({ area, action, state }))
});

writeMd('release/v93/release-freeze-check.md', [
  '# v9.3 Release Freeze Check',
  '',
  ...table(['Area', 'Action', 'State'], checks),
  '',
  '## Freeze rule',
  '',
  'After approvals are completed, avoid new non-approval changes until final proof is captured.',
  ''
]);

printResult('v9.3 release freeze check generated.', {
  status: STATUS,
  production_ready: PRODUCTION_READY,
  checks: checks.length,
  report: 'release/v93/release-freeze-check.md'
});
