import fs from 'node:fs';
import { status, productionReady, writeMarkdown, markdownTable, finalBoundary, generatedAt } from './v95-common.mjs';

const reports = [
  ['Approval execution workspace', 'release/v95/approval-execution-workspace.md'],
  ['Approval QA summary', 'release/v95/approval-qa-summary.md'],
  ['Approval evidence binder index', 'release/v95/approval-evidence-binder-index.md'],
  ['Approver action drafts', 'release/v95/approver-action-drafts.md'],
  ['Final proof dry-run plan', 'release/v95/final-proof-dryrun-plan.md']
];

const rows = reports.map(([name, file]) => [name, file, fs.existsSync(file) ? 'Present' : 'Missing']);
const missing = rows.filter((row) => row[2] === 'Missing').length;

const md = `# v9.5 Approval Execution Workspace Review Pack

Generated: ${generatedAt()}

## Status

${markdownTable(['Item', 'Value'], [
  ['Status', status],
  ['Production ready', productionReady ? 'Yes' : 'No'],
  ['Missing reports', String(missing)]
])}

## Reports

${markdownTable(['Report', 'Path', 'Status'], rows)}

## Final judgment

The v9.5 pack helps execute and QA the real approval process. It does not replace human approvals.

## Boundary

${finalBoundary()}
`;

const report = writeMarkdown('v95-review-pack.md', md);
console.log('v9.5 review pack generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, missing_reports: missing, report }, null, 2));
