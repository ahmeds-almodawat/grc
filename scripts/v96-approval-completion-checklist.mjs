import { STATUS_PENDING, summarizeApprovals, writeReport } from './v96-common.mjs';

const summary = summarizeApprovals();
const signoffList = summary.signoff_missing.length ? summary.signoff_missing.map((x) => `- [ ] ${x}`).join('\n') : '- [x] No missing signoff fields detected by v9.6 QA.';
const confidentialityList = summary.confidentiality_missing.length ? summary.confidentiality_missing.map((x) => `- [ ] ${x}`).join('\n') : '- [x] No missing confidentiality fields detected by v9.6 QA.';

const report = writeReport('approval-completion-checklist.md', 'v9.6 Approval Completion Checklist', [
  '## Approval file status',
  '',
  `| Item | Value |`,
  `| --- | --- |`,
  `| Pilot signoff file exists | ${summary.signoff_exists ? 'Yes' : 'No'} |`,
  `| Confidentiality file exists | ${summary.confidentiality_exists ? 'Yes' : 'No'} |`,
  `| Missing fields total | ${summary.missing_total} |`,
  `| Approval complete by v9.6 QA | ${summary.approval_complete ? 'Yes' : 'No'} |`,
  '',
  '## Pilot signoff missing fields',
  '',
  signoffList,
  '',
  '## Confidentiality missing fields',
  '',
  confidentialityList
]);

console.log('v9.6 approval completion checklist generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: false, missing_total: summary.missing_total, report }, null, 2));
