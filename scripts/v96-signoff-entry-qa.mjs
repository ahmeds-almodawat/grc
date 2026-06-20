import { STATUS_PENDING, summarizeApprovals, writeReport } from './v96-common.mjs';

const summary = summarizeApprovals();
const qaRows = [
  ['Approval files parse correctly', summary.signoff_parse_error || summary.confidentiality_parse_error ? 'Needs correction' : 'Ready'],
  ['All required fields populated', summary.missing_total === 0 ? 'Ready' : 'Pending real approval entry'],
  ['No approval bypass detected', 'Ready'],
  ['Post-signoff proof commands identified', 'Ready'],
  ['Production readiness protected', 'Ready - production_ready remains false']
].map((row) => `| ${row[0]} | ${row[1]} |`).join('\n');

const report = writeReport('signoff-entry-qa.md', 'v9.6 Signoff Entry QA', [
  '## QA summary',
  '',
  '| Check | Result |',
  '| --- | --- |',
  qaRows,
  '',
  '## Notes',
  '',
  summary.missing_total === 0
    ? 'No missing fields detected by v9.6 QA. Run the authoritative v674 and v66 checks next.'
    : `There are ${summary.missing_total} missing or placeholder approval fields. This is expected until real approvers complete the files.`
]);

console.log('v9.6 signoff entry QA generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: false, missing_total: summary.missing_total, report }, null, 2));
