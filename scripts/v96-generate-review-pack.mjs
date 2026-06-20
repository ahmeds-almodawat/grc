import fs from 'node:fs';
import path from 'node:path';
import { STATUS_PENDING, OUT_DIR, ensureOutDir, summarizeApprovals } from './v96-common.mjs';

ensureOutDir();
const generatedAt = new Date().toISOString();
const expected = [
  ['Approval Completion Checklist', 'release/v96/approval-completion-checklist.md'],
  ['Signoff Entry QA', 'release/v96/signoff-entry-qa.md'],
  ['Evidence Lock Plan', 'release/v96/evidence-lock-plan.md'],
  ['Final Approval Rehearsal', 'release/v96/final-approval-rehearsal.md'],
  ['Post-Signoff Proof Capture', 'release/v96/post-signoff-proof-capture.md'],
  ['Controlled-Pilot Release Note Draft', 'release/v96/controlled-pilot-release-note.md']
];
const missing = expected.filter((item) => !fs.existsSync(item[1]));
const summary = summarizeApprovals();
const rows = expected.map((item) => `| ${item[0]} | ${item[1]} | ${fs.existsSync(item[1]) ? 'Generated' : 'Missing'} |`).join('\n');
const md = [
  '# v9.6 Approval Closure Control Review Pack',
  '',
  `Generated: ${generatedAt}`,
  '',
  '## Status',
  '',
  '| Item | Value |',
  '| --- | --- |',
  `| Status | ${STATUS_PENDING} |`,
  '| Production ready | No |',
  `| Missing approval fields by v9.6 QA | ${summary.missing_total} |`,
  `| Missing reports | ${missing.length} |`,
  '',
  '## Included reports',
  '',
  '| Report | Path | Status |',
  '| --- | --- | --- |',
  rows,
  '',
  '## Final judgment',
  '',
  'v9.6 gives the approval process a closure-control layer. It does not replace real approval or strict proof.',
  '',
  'The next action remains completion of pilot-signoff.json and ovr-confidentiality-confirmation.json by real approvers only.',
  ''
].join('\n');
const outPath = path.join(OUT_DIR, 'v96-review-pack.md');
fs.writeFileSync(outPath, md);
console.log('v9.6 review pack generated.');
console.log(JSON.stringify({ status: STATUS_PENDING, production_ready: false, missing_reports: missing.length, missing_approval_fields: summary.missing_total, report: 'release/v96/v96-review-pack.md' }, null, 2));
