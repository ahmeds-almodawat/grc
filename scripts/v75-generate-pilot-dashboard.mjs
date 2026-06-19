#!/usr/bin/env node
import { loadEvidence, deriveGates, deriveOverall, writeJson, writeMd, mdTable, statusIcon } from './v75-common.mjs';

const evidence = loadEvidence();
const gates = deriveGates(evidence);
const overall = deriveOverall(gates);

const generatedAt = new Date().toISOString();
const dashboard = {
  generated_at: generatedAt,
  status: overall,
  production_ready: false,
  controlled_pilot_note: 'This dashboard does not approve the pilot. Real human signoff is still required unless the approval gates are passed.',
  gates
};

writeJson('release/v75/controlled-pilot-readiness-dashboard.json', dashboard);

const rows = gates.map((gate) => ({
  Gate: gate.name,
  Status: `${statusIcon(gate.status)} ${gate.status}`,
  Basis: gate.basis
}));

const md = `# v7.5 Controlled-Pilot Readiness Dashboard

Generated: ${generatedAt}

## Overall status

\`${overall}\`

## Production readiness

\`not_ready\`

This dashboard is for controlled-pilot readiness review only. It does not approve production use and does not bypass human signoff.

## Gate summary

${mdTable(rows, ['Gate', 'Status', 'Basis'])}

## Interpretation

- ✅ Passed: evidence exists and the relevant check indicates readiness for controlled-pilot review.
- 🟡 Pending/review required: a human or contextual approval remains required.
- ❌ Not ready: cannot be treated as ready for that gate.

## Correct next commands

After real human approval files are completed:

\`\`\`powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
\`\`\`

## Non-bypass statement

v7.5 intentionally does not modify approval files, bypass \`v66:strict-proof\`, change RLS, change runtime bridge logic, or mark the system production ready.
`;

writeMd('release/v75/controlled-pilot-readiness-dashboard.md', md);

console.log('v7.5 controlled-pilot readiness dashboard generated.');
console.log(JSON.stringify({ status: overall, gates: gates.length, report: 'release/v75/controlled-pilot-readiness-dashboard.md' }, null, 2));
