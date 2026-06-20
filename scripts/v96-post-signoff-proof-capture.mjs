import { STATUS_PENDING, writeReport } from './v96-common.mjs';

const commands = [
  'npm run v674:signoff-check',
  'npm run v674:sync-manual-evidence',
  'npm run v66:strict-proof',
  'npm run proof:all'
];
const rows = commands.map((cmd, index) => `| ${index + 1} | \`${cmd}\` | Capture terminal output and generated release evidence |`).join('\n');
const report = writeReport('post-signoff-proof-capture.md', 'v9.6 Post-Signoff Proof Capture', [
  '## Command sequence',
  '',
  '| Order | Command | Evidence to capture |',
  '| --- | --- | --- |',
  rows,
  '',
  '## Expected result after real approvals',
  '',
  '- v674 signoff check strict_passed true',
  '- v66 strict proof passed',
  '- proof:all passed with no failed commands'
]);
console.log('v9.6 post-signoff proof capture generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: false, commands: commands.length, report }, null, 2));
