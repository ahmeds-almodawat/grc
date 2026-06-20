import fs from 'node:fs';
import { writeMarkdown, readJson, STATUS_PENDING, PRODUCTION_READY } from './v91-common.mjs';

const proof = readJson('release/v700/proof-suite-all.json');
const lint = readJson('release/v91/approval-readiness-lint.json');
const failedCommands = Array.isArray(proof.failed_commands) ? proof.failed_commands : [];

writeMarkdown('release/v91/final-blocker-dashboard.md', [
  '# v9.1 Final Blocker Dashboard',
  '',
  'Generated: ' + new Date().toISOString(),
  '',
  '| Area | Status | Notes |',
  '| --- | --- | --- |',
  '| Proof suite | ' + (proof.status || 'unknown') + ' | Passed: ' + (proof.passed_count ?? 'unknown') + ', Failed: ' + (proof.failed_count ?? 'unknown') + ' |',
  '| Failed commands | ' + (failedCommands.length ? failedCommands.join(', ') : 'None') + ' | Expected blocker until human signoff is complete |',
  '| Approval lint | ' + (lint.lint_status || lint.status || 'not_run') + ' | Issues: ' + (lint.issue_count ?? lint.issues ?? 'unknown') + ' |',
  '| Controlled pilot | ' + STATUS_PENDING + ' | Human approval pending |',
  '| Production ready | No | Production remains out of scope |',
  '',
  '## Final blocker',
  '',
  'Real Management/Admin, IT, and Quality signoff plus OVR confidentiality confirmation.',
  '',
  '## Required files',
  '',
  '- release/v674/approvals/pilot-signoff.json',
  '- release/v674/approvals/ovr-confidentiality-confirmation.json',
  '',
  '## Post-approval commands',
  '',
  '- npm run v674:signoff-check',
  '- npm run v674:sync-manual-evidence',
  '- npm run v66:strict-proof',
  '- npm run proof:all'
]);
console.log('v9.1 final blocker dashboard generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: PRODUCTION_READY, report: 'release/v91/final-blocker-dashboard.md' }, null, 2));
