import { writeMarkdown, readJson, STATUS_PENDING, PRODUCTION_READY } from './v91-common.mjs';

const lint = readJson('release/v91/approval-readiness-lint.json');
const issueCount = lint.issue_count ?? lint.issues ?? 'unknown';

writeMarkdown('release/v91/v91-review-pack.md', [
  '# v9.1 Manual Approval Evidence Finalization Review Pack',
  '',
  'Generated: ' + new Date().toISOString(),
  '',
  '## Overall status',
  '',
  '| Item | Status |',
  '| --- | --- |',
  '| Controlled pilot readiness | Strong pending human approval |',
  '| Approval lint | ' + (lint.lint_status || lint.status || 'not_run') + ' |',
  '| Approval issues | ' + issueCount + ' |',
  '| Production ready | No |',
  '| Approval bypass | No |',
  '| RLS / migrations changed | No |',
  '| Runtime bridge changed | No |',
  '',
  '## Generated artifacts',
  '',
  '- release/v91/approval-readiness-lint.md',
  '- release/v91/approver-brief.md',
  '- release/v91/signoff-meeting-minutes-template.md',
  '- release/v91/post-signoff-proof-runbook.md',
  '- release/v91/final-blocker-dashboard.md',
  '',
  '## Final judgment',
  '',
  'v9.1 helps finalize real human approval evidence. It does not complete or simulate approval.',
  '',
  'The project remains ' + STATUS_PENDING + ' and production_ready = ' + PRODUCTION_READY + '.',
  '',
  'The remaining blocker is real Management/Admin, IT, and Quality signoff plus OVR confidentiality confirmation.'
]);
console.log('v9.1 review pack generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: PRODUCTION_READY, report: 'release/v91/v91-review-pack.md' }, null, 2));
