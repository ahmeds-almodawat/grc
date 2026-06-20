import { mdTable, writeText, writeJson, status, productionReady } from './v94-common.mjs';

const risks = [
  ['Approval incompleteness', 'Pilot cannot start until real signoff is complete', 'High', 'Do not bypass gate; complete approval JSON files', 'Management'],
  ['Scope creep', 'Pilot expands beyond 15 users or internal-only scope', 'High', 'Freeze pilot scope; require new approval for expansion', 'Pilot Lead'],
  ['Confidential data exposure', 'Real patient identifiers or confidential OVR details used accidentally', 'High', 'Use synthetic/non-confidential data only; Quality/IT review', 'Quality / IT'],
  ['Access misconfiguration', 'Unauthorized users access pilot data', 'Medium', 'Access review before day 0 and daily monitoring', 'IT'],
  ['Unresolved pilot blockers', 'Issues accumulate without remediation', 'Medium', 'Use issue log, severity, owner, and due date', 'Pilot Operator'],
  ['Production confusion', 'Controlled pilot mistaken for production readiness', 'High', 'Keep production_ready=false until production proof exists', 'Management / IT']
];

const md = [
  '# v9.4 Pilot Risk Acceptance Register',
  '',
  mdTable(['Risk', 'Description', 'Severity', 'Control', 'Owner'], risks),
  '',
  '## Acceptance rule',
  '',
  'Risks may only be accepted for the controlled internal pilot boundary. This register does not authorize production use.'
].join('\n');

writeText('risk-acceptance-register.md', md);
writeJson('risk-acceptance-register.json', { status, production_ready: productionReady, risks: risks.length });
console.log('v9.4 risk acceptance register generated.');
console.log(JSON.stringify({ status, production_ready: productionReady, risks: risks.length, report: 'release/v94/risk-acceptance-register.md' }, null, 2));
