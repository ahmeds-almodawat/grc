#!/usr/bin/env node
import { loadEvidence, deriveGates, deriveOverall, writeJson, writeMd, mdTable } from './v75-common.mjs';

const evidence = loadEvidence();
const gates = deriveGates(evidence);
const overall = deriveOverall(gates);
const generatedAt = new Date().toISOString();

const proof = evidence.proofAll || {};
const moduleAcceptance = evidence.moduleAcceptance || {};
const runtime = evidence.runtimeSecurity || {};
const persona = evidence.personaProof || {};

const readout = {
  generated_at: generatedAt,
  executive_status: overall,
  production_ready: false,
  proof_summary: {
    status: proof.status ?? 'unknown',
    passed_count: proof.passed_count ?? null,
    failed_count: proof.failed_count ?? null,
    failed_commands: proof.failed_commands ?? []
  },
  module_acceptance: {
    status: moduleAcceptance.status ?? 'unknown',
    strict_passed: moduleAcceptance.strict_passed ?? null,
    total_modules: moduleAcceptance.total_modules ?? null,
    failed: moduleAcceptance.failed ?? null,
    blocking_failures: moduleAcceptance.blocking_failures ?? null
  },
  runtime_security: {
    status: runtime.status ?? 'unknown',
    service_role_only_rpc_called_by_frontend: runtime.service_role_only_rpc_called_by_frontend ?? null
  },
  persona_proof: {
    strict_passed: persona.strict_passed ?? null,
    authenticated_personas: persona.authenticated_personas ?? persona.authenticated_personas_passed ?? null,
    required_scenarios: persona.required_scenarios ?? persona.required_scenarios_passed ?? null
  }
};

writeJson('release/v75/executive-controlled-pilot-readout.json', readout);

const rows = [
  { Area: 'Technical build', Status: 'Passed locally when npm run ci:static passes', Decision: 'Accept as technical prerequisite only' },
  { Area: 'Module acceptance', Status: `${moduleAcceptance.status ?? 'unknown'}; strict_passed=${moduleAcceptance.strict_passed ?? 'unknown'}`, Decision: 'Review warnings; no technical blocker if failed=0/blocking=0' },
  { Area: 'Runtime security bridge', Status: `${runtime.status ?? 'unknown'}`, Decision: 'Accept for controlled-pilot review if latest audit remains passed' },
  { Area: 'Authenticated persona proof', Status: `strict_passed=${persona.strict_passed ?? 'unknown'}`, Decision: 'Accept for controlled-pilot review; staging proof remains future phase' },
  { Area: 'Human signoff', Status: 'Required before pilot', Decision: 'Management/Admin, IT, Quality must approve with real names/dates' },
  { Area: 'OVR confidentiality', Status: 'Required before pilot', Decision: 'IT and Quality must confirm no real patient/confidential OVR data' },
  { Area: 'Production readiness', Status: 'Not ready', Decision: 'Separate future staging/live validation required' }
];

const md = `# Executive Controlled-Pilot Readout

Generated: ${generatedAt}

## Executive status

\`${overall}\`

## Decision statement

The GRC Control Center has strong technical controlled-pilot evidence, but it must not proceed to pilot until real Management/Admin, IT, and Quality signoff plus IT/Quality confidentiality confirmation are completed. It is not production ready.

## Summary table

${mdTable(rows, ['Area', 'Status', 'Decision'])}

## Proof suite summary

\`\`\`json
${JSON.stringify(readout.proof_summary, null, 2)}
\`\`\`

## Controlled pilot conditions

- 5–15 internal users only.
- Synthetic/non-confidential data only.
- No real patient identifiers.
- No confidential OVR details.
- No production rollout.
- No regulatory reliance.

## Recommendation

Approve only a limited controlled internal pilot after the approval files pass validation and \`npm run proof:all\` is fully passed.
`;

writeMd('release/v75/executive-controlled-pilot-readout.md', md);

console.log('v7.5 executive readout generated.');
console.log(JSON.stringify({ status: overall, report: 'release/v75/executive-controlled-pilot-readout.md' }, null, 2));
