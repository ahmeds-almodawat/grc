import fs from 'node:fs';
import { status, productionReady, writeMarkdown, markdownTable, finalBoundary, generatedAt } from './v95-common.mjs';

const items = [
  ['Proof suite summary', 'release/v700/proof-suite-all.json'],
  ['Signoff check', 'release/v674/v674-signoff-check.json'],
  ['Restore dry-run', 'release/v674/restore-integrity-dryrun.json'],
  ['Authenticated persona proof', 'release/v72/real-authenticated-persona-proof.json'],
  ['Runtime bridge audit', 'release/v700/runtime-security-bridge-audit.json'],
  ['Pilot signoff JSON', 'release/v674/approvals/pilot-signoff.json'],
  ['OVR confidentiality JSON', 'release/v674/approvals/ovr-confidentiality-confirmation.json'],
  ['Approval execution workspace', 'release/v95/approval-execution-workspace.md']
];

const rows = items.map(([name, file]) => [name, file, fs.existsSync(file) ? 'Present' : 'Missing']);
const missing = rows.filter((row) => row[2] === 'Missing').length;

const md = `# v9.5 Approval Evidence Binder Index

Generated: ${generatedAt()}

## Evidence items

${markdownTable(['Evidence item', 'Path', 'Status'], rows)}

## Missing count

${missing}

## Boundary

${finalBoundary()}
`;

const report = writeMarkdown('approval-evidence-binder-index.md', md);
console.log('v9.5 approval evidence binder index generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, evidence_items: rows.length, missing_count: missing, report }, null, 2));
