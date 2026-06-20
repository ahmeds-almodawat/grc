import { status, productionReady, writeMarkdown, markdownTable, finalBoundary, generatedAt } from './v95-common.mjs';

const rows = [
  ['1', 'Confirm controlled-pilot scope', 'Management/Admin', 'Pending real approval'],
  ['2', 'Confirm IT technical acceptance', 'IT', 'Pending real approval'],
  ['3', 'Confirm Quality acceptance', 'Quality', 'Pending real approval'],
  ['4', 'Confirm OVR confidentiality', 'IT + Quality', 'Pending real confirmation'],
  ['5', 'Run final proof sequence', 'Project Lead', 'After approval'],
  ['6', 'Archive approval evidence', 'Project Lead / Audit', 'After final proof']
];

const md = `# v9.5 Approval Execution Workspace

Generated: ${generatedAt()}

## Status

${markdownTable(['Item', 'Value'], [
  ['Status', status],
  ['Production ready', productionReady ? 'Yes' : 'No'],
  ['Primary blocker', 'Real human approval evidence']
])}

## Execution board

${markdownTable(['Step', 'Task', 'Owner', 'Status'], rows)}

## Boundary

${finalBoundary()}
`;

const report = writeMarkdown('approval-execution-workspace.md', md);
console.log('v9.5 approval execution workspace generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, tasks: rows.length, report }, null, 2));
