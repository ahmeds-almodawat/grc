import { evaluateApprovals, readProofSuite, mdTable, writeText, writeJson, status, productionReady } from './v94-common.mjs';

const approvals = evaluateApprovals();
const proof = readProofSuite();
const gateBlocked = approvals.failed > 0 || (proof.failed_count ?? 1) > 0;
const scenarios = [
  ['Current state', gateBlocked ? 'Blocked' : 'Ready for strict proof confirmation', approvals.failed > 0 ? 'Approval files incomplete' : 'Approval files structurally complete'],
  ['After real approvals', 'Run required commands', 'v674:signoff-check, v674:sync-manual-evidence, v66:strict-proof, proof:all'],
  ['Controlled pilot launch', 'Allowed only if proof passes', 'Requires strict proof success and management decision'],
  ['Production launch', 'Not allowed', 'Production proof is outside current controlled-pilot gate']
];

const md = [
  '# v9.4 Final Gate Simulator',
  '',
  '## Current gate inputs',
  '',
  mdTable(['Input', 'Value'], [
    ['Approval fields missing or invalid', approvals.failed],
    ['Proof passed count', proof.passed_count ?? 'unknown'],
    ['Proof failed count', proof.failed_count ?? 'unknown'],
    ['Failed proof commands', proof.failed_commands.join(', ') || 'none'],
    ['Production ready', productionReady ? 'Yes' : 'No']
  ]),
  '',
  '## Gate simulation',
  '',
  mdTable(['Scenario', 'Decision', 'Reason / Required action'], scenarios),
  '',
  '## Final judgment',
  '',
  gateBlocked ? 'The final controlled-pilot gate remains blocked until real human approval evidence is complete and strict proof passes.' : 'Approval structure appears complete. Run strict proof before any controlled-pilot decision.',
  '',
  'Production remains not ready.'
].join('\n');

writeText('final-gate-simulator.md', md);
writeJson('final-gate-simulator.json', { status, production_ready: productionReady, approval_missing_or_invalid: approvals.failed, proof, gate_blocked: gateBlocked });
console.log('v9.4 final gate simulator generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, gate_blocked: gateBlocked, approval_missing_or_invalid: approvals.failed, proof_failed_count: proof.failed_count, report: 'release/v94/final-gate-simulator.md' }, null, 2));
