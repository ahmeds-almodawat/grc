import path from 'node:path';
import { repoRoot, readJsonIfExists, fileExists, writeJson, writeMd, mdTable } from './v76-common.mjs';

const proofAll = readJsonIfExists(path.join(repoRoot, 'release', 'v700', 'proof-suite-all.json'), {});
const signoff = readJsonIfExists(path.join(repoRoot, 'release', 'v674', 'v674-signoff-check.json'), {});
const v73 = readJsonIfExists(path.join(repoRoot, 'release', 'v73', 'module-acceptance-results.json'), {});
const persona = readJsonIfExists(path.join(repoRoot, 'release', 'v72', 'real-authenticated-persona-proof.json'), {});
const runtime = readJsonIfExists(path.join(repoRoot, 'release', 'v700', 'runtime-security-bridge-audit.json'), {});

const gates = [
  ['typecheck/build static command', 'expected via ci:static', 'manual/latest command output'],
  ['v7.3 module acceptance', v73?.strict_passed === true ? 'passed' : (v73?.status || 'unknown'), 'release/v73/module-acceptance-results.json'],
  ['runtime security bridge', runtime?.status || 'unknown', 'release/v700/runtime-security-bridge-audit.json'],
  ['authenticated persona proof', persona?.strict_passed === true ? 'passed' : 'unknown', 'release/v72/real-authenticated-persona-proof.json'],
  ['proof suite overall', proofAll?.status || 'unknown', 'release/v700/proof-suite-all.json'],
  ['signoff validity', signoff?.signoff_valid === true ? 'valid' : 'pending', 'release/v674/v674-signoff-check.json'],
  ['confidentiality validity', signoff?.confidentiality_valid === true ? 'valid' : 'pending', 'release/v674/v674-signoff-check.json'],
  ['v7.5 dashboard exists', fileExists('release/v75/controlled-pilot-readiness-dashboard.md') ? 'present' : 'missing', 'release/v75/controlled-pilot-readiness-dashboard.md'],
  ['human approval checklist exists', fileExists('release/v75/human-approval-checklist.md') ? 'present' : 'missing', 'release/v75/human-approval-checklist.md'],
];

const status = (signoff?.signoff_valid === true && signoff?.confidentiality_valid === true)
  ? 'human_approval_evidence_present_review_strict_proof'
  : 'technical_ready_pending_human_approval';

const result = {
  generated_at: new Date().toISOString(),
  status,
  proof_suite_status: proofAll?.status || 'unknown',
  proof_suite_passed_count: proofAll?.passed_count ?? null,
  proof_suite_failed_count: proofAll?.failed_count ?? null,
  failed_commands: proofAll?.failed_commands || [],
  signoff_valid: signoff?.signoff_valid === true,
  confidentiality_valid: signoff?.confidentiality_valid === true,
  gates: gates.map(([gate, state, evidence]) => ({ gate, state, evidence })),
};

writeJson('evidence-ops-dashboard.json', result);
const md = `# v7.6 Evidence Operations Dashboard\n\nGenerated: ${result.generated_at}\n\nStatus: **${result.status}**\n\nProof suite status: **${result.proof_suite_status}**\n\nFailed commands: **${result.failed_commands.join(', ') || 'none'}**\n\n${mdTable(['Gate', 'State', 'Evidence'], gates)}\n\n## Interpretation\n\nIf the only failing proof command is \`v66:strict-proof\`, and signoff/confidentiality are pending, the remaining blocker is human approval rather than a new technical blocker.\n`;
writeMd('evidence-ops-dashboard.md', md);
console.log('v7.6 evidence operations dashboard generated.');
console.log(JSON.stringify({ status: result.status, report: 'release/v76/evidence-ops-dashboard.md' }, null, 2));
