import { writeMarkdown, STATUS_PENDING, PRODUCTION_READY } from './v91-common.mjs';

writeMarkdown('release/v91/post-signoff-proof-runbook.md', [
  '# v9.1 Post-Signoff Proof Runbook',
  '',
  'Generated: ' + new Date().toISOString(),
  '',
  '## Run after real approvals are completed',
  '',
  '1. npm run v674:signoff-check',
  '2. npm run v674:sync-manual-evidence',
  '3. npm run v66:strict-proof',
  '4. npm run proof:all',
  '',
  '## Expected final result',
  '',
  '- v674 signoff check strict passed.',
  '- v66 strict proof passed.',
  '- proof:all fully passed.',
  '',
  '## Current safety note',
  '',
  'This runbook does not approve production. It closes only the controlled-pilot manual evidence blocker.',
  '',
  '- Status: ' + STATUS_PENDING,
  '- Production ready: ' + PRODUCTION_READY
]);
console.log('v9.1 post-signoff proof runbook generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: PRODUCTION_READY, report: 'release/v91/post-signoff-proof-runbook.md' }, null, 2));
