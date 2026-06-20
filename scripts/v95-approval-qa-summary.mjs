import { status, productionReady, writeMarkdown, markdownTable, finalBoundary, generatedAt, readJson } from './v95-common.mjs';

const signoffReport = readJson('release/v674/v674-signoff-check.json', {});
const proof = readJson('release/v700/proof-suite-all.json', {});

const rows = [
  ['Signoff valid', String(Boolean(signoffReport.signoff_valid))],
  ['Confidentiality valid', String(Boolean(signoffReport.confidentiality_valid))],
  ['Signoff strict passed', String(Boolean(signoffReport.strict_passed))],
  ['Proof passed count', String(proof.passed_count ?? 'unknown')],
  ['Proof failed count', String(proof.failed_count ?? 'unknown')],
  ['Known failed command', Array.isArray(proof.failed_commands) ? proof.failed_commands.join(', ') : 'unknown']
];

const md = `# v9.5 Approval QA Summary

Generated: ${generatedAt()}

## Current gate readout

${markdownTable(['Check', 'Value'], rows)}

## Interpretation

A pending or false value here is expected until real approvers complete the two approval JSON files.

## Boundary

${finalBoundary()}
`;

const report = writeMarkdown('approval-qa-summary.md', md);
console.log('v9.5 approval QA summary generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, report }, null, 2));
