import { status, productionReady, writeMarkdown, markdownTable, finalBoundary, generatedAt } from './v95-common.mjs';

const rows = [
  ['1', 'npm run v674:signoff-check', 'Validate approval JSON files'],
  ['2', 'npm run v674:sync-manual-evidence', 'Sync manual evidence flags after approval'],
  ['3', 'npm run v66:strict-proof', 'Confirm controlled-pilot go/no-go gate'],
  ['4', 'npm run proof:all', 'Run complete proof suite']
];

const md = `# v9.5 Final Proof Dry-Run Plan

Generated: ${generatedAt()}

Run this only after real approvers complete approval JSON files.

${markdownTable(['Step', 'Command', 'Purpose'], rows)}

## Expected result after valid approval

proof:all should pass with zero failed commands.

## Boundary

${finalBoundary()}
`;

const report = writeMarkdown('final-proof-dryrun-plan.md', md);
console.log('v9.5 final proof dry-run plan generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, commands: rows.length, report }, null, 2));
