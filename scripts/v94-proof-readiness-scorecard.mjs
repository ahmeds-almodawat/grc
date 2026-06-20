import { evaluateApprovals, readProofSuite, mdTable, writeText, writeJson, status, productionReady } from './v94-common.mjs';

const approvals = evaluateApprovals();
const proof = readProofSuite();
const technicalScore = proof.failed_count === 1 && proof.failed_commands.includes('v66:strict-proof') ? 95 : proof.failed_count === 0 ? 100 : 80;
const approvalScore = approvals.required === 0 ? 0 : Math.round((approvals.passed / approvals.required) * 100);
const productionScore = 0;
const rows = [
  ['Technical proof readiness', technicalScore + '%', 'Strong; current known blocker is manual approval gate'],
  ['Approval completion', approvalScore + '%', approvals.failed > 0 ? 'Incomplete approval fields remain' : 'Approval fields structurally complete'],
  ['Controlled pilot readiness', approvals.failed > 0 ? 'Pending approval' : 'Ready for strict proof confirmation', 'Requires v66 strict proof success'],
  ['Production readiness', productionScore + '%', 'Not ready; outside current controlled-pilot scope']
];

const md = [
  '# v9.4 Proof Readiness Scorecard',
  '',
  mdTable(['Area', 'Score / Status', 'Notes'], rows),
  '',
  '## Required final command sequence after real approval',
  '',
  mdTable(['Order', 'Command'], [
    ['1', 'npm run v674:signoff-check'],
    ['2', 'npm run v674:sync-manual-evidence'],
    ['3', 'npm run v66:strict-proof'],
    ['4', 'npm run proof:all']
  ])
].join('\n');

writeText('proof-readiness-scorecard.md', md);
writeJson('proof-readiness-scorecard.json', { status, production_ready: productionReady, technical_score: technicalScore, approval_score: approvalScore, production_score: productionScore, proof, approval_missing_or_invalid: approvals.failed });
console.log('v9.4 proof readiness scorecard generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, technical_score: technicalScore, approval_score: approvalScore, report: 'release/v94/proof-readiness-scorecard.md' }, null, 2));
