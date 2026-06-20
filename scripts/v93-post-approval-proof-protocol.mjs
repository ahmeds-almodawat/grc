import { STATUS, PRODUCTION_READY, writeJson, writeMd, table, printResult } from './v93-common.mjs';

const commands = [
  ['1', 'npm run v674:signoff-check', 'Validates real approval and confidentiality files'],
  ['2', 'npm run v674:sync-manual-evidence', 'Syncs manual evidence status'],
  ['3', 'npm run v66:strict-proof', 'Runs strict go/no-go gate'],
  ['4', 'npm run proof:all', 'Confirms final proof suite status']
];

writeJson('release/v93/post-approval-proof-protocol.json', {
  generated_at: new Date().toISOString(),
  status: STATUS,
  production_ready: PRODUCTION_READY,
  commands: commands.map(([step, command, purpose]) => ({ step, command, purpose }))
});

writeMd('release/v93/post-approval-proof-protocol.md', [
  '# v9.3 Post-Approval Proof Protocol',
  '',
  ...table(['Step', 'Command', 'Purpose'], commands),
  '',
  '## Expected after valid real approval',
  '',
  '- `v674:signoff-check` strict passed.',
  '- `v66:strict-proof` passed.',
  '- `proof:all` fully passed.',
  '',
  'If these do not pass, fix the approval or evidence issue. Do not weaken the gate.',
  ''
]);

printResult('v9.3 post-approval proof protocol generated.', {
  status: STATUS,
  production_ready: PRODUCTION_READY,
  commands: commands.length,
  report: 'release/v93/post-approval-proof-protocol.md'
});
