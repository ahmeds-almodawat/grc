import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('release', 'v92');
fs.mkdirSync(outDir, { recursive: true });
const generatedAt = new Date().toISOString();

const commands = [
  'npm run v674:signoff-check',
  'npm run v674:sync-manual-evidence',
  'npm run v66:strict-proof',
  'npm run proof:all'
];

const rows = commands.map((cmd, index) => '| ' + (index + 1) + ' | ' + cmd + ' | Run after real approvals only |').join('\n');

const md = [
  '# v9.2 Final Proof Run Sequence',
  '',
  'Generated: ' + generatedAt,
  '',
  '| Step | Command | Condition |',
  '| --- | --- | --- |',
  rows,
  '',
  '## Expected final outcome after valid real approvals',
  '',
  '- v674:signoff-check strict_passed true',
  '- v66:strict-proof passed',
  '- proof:all fully passed',
  '',
  '## Expected outcome before real approvals',
  '',
  '- v66:strict-proof remains blocked',
  '- proof:all remains failed_review_required',
  ''
].join('\n');

fs.writeFileSync(path.join(outDir, 'final-proof-run-sequence.md'), md);
console.log('v9.2 final proof run sequence generated.');
console.log(JSON.stringify({ status: 'technical_ready_pending_human_approval', production_ready: false, commands: commands.length, report: 'release/v92/final-proof-run-sequence.md' }, null, 2));
