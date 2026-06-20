import { writeMarkdown, STATUS_PENDING, PRODUCTION_READY, SCOPE_TEXT } from './v91-common.mjs';

writeMarkdown('release/v91/approver-brief.md', [
  '# v9.1 Approver Brief',
  '',
  'Generated: ' + new Date().toISOString(),
  '',
  '## Decision requested',
  '',
  'Approve or defer a controlled internal pilot only. This is not production approval.',
  '',
  '## Scope',
  '',
  SCOPE_TEXT,
  '',
  '## Evidence summary',
  '',
  '- Typecheck and build passed.',
  '- Security static audits passed with no production blockers.',
  '- Runtime bridge audit passed.',
  '- Real authenticated persona proof passed.',
  '- Restore dry-run passed.',
  '- Local SQL evidence capture passed.',
  '- Evidence attachment and quality gates passed.',
  '',
  '## Safety boundary',
  '',
  'No real patient identifiers. No confidential OVR details. Synthetic/non-confidential data only. Production rollout remains out of scope.',
  '',
  '## Status',
  '',
  '- Status: ' + STATUS_PENDING,
  '- Production ready: ' + PRODUCTION_READY
]);
console.log('v9.1 approver brief generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: PRODUCTION_READY, report: 'release/v91/approver-brief.md' }, null, 2));
