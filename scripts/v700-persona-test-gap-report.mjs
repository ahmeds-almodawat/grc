import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v700');
fs.mkdirSync(outDir, { recursive: true });
const strict = process.argv.includes('--strict');
const proofPath = path.join(root, 'release', 'v72', 'real-authenticated-persona-proof.json');

const requiredPersonas = [
  'Super Admin',
  'Executive',
  'Quality',
  'Auditor',
  'Department Manager A',
  'Department Manager B',
  'Employee A',
  'Employee B',
];
const requiredScenarios = [
  'same organization access allowed',
  'cross organization denial',
  'cross department denial',
  'confidential OVR denial',
  'evidence access scope',
  'self approval prevention',
  'role administration authorization',
  'export and backup denial for normal users',
  'anonymous access denial',
];

let realProof = null;
let proofReadError = null;
if (fs.existsSync(proofPath)) {
  try {
    realProof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
  } catch (error) {
    proofReadError = error.message;
  }
}

const proofPersonas = new Set(realProof?.required_personas || []);
const proofScenarios = new Set(
  (realProof?.results || [])
    .filter((result) => result.passed)
    .map((result) => result.scenario),
);
const missingPersonas = requiredPersonas.filter((persona) => !proofPersonas.has(persona));
const missingScenarios = requiredScenarios.filter((scenario) => !proofScenarios.has(scenario));
const proofPassed = Boolean(
  realProof?.strict_passed
  && realProof?.cleanup_status === 'passed'
  && missingPersonas.length === 0
  && missingScenarios.length === 0,
);

const report = {
  generated_at: new Date().toISOString(),
  status: proofPassed
    ? 'real_authenticated_persona_proof_passed'
    : 'real_authenticated_persona_tests_required',
  proof_file: fs.existsSync(proofPath)
    ? 'release/v72/real-authenticated-persona-proof.json'
    : null,
  proof_read_error: proofReadError,
  required_personas: requiredPersonas,
  required_scenarios: requiredScenarios,
  missing_personas: missingPersonas,
  missing_scenarios: missingScenarios,
  authenticated_personas_passed: realProof?.authenticated_personas_passed ?? 0,
  required_persona_count: requiredPersonas.length,
  required_scenarios_passed: realProof?.required_scenarios_passed ?? 0,
  required_scenario_count: requiredScenarios.length,
  runtime_bridge_actions_verified: realProof?.runtime_bridge_actions_verified ?? 0,
  synthetic_data_only: realProof?.synthetic_data_only ?? null,
  cleanup_status: realProof?.cleanup_status ?? 'not_run',
  exit_condition:
    'Authenticated Supabase clients prove all required allow/deny paths and clean up their synthetic local fixtures.',
};

fs.writeFileSync(
  path.join(outDir, 'real-persona-test-gap-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outDir, 'REAL_PERSONA_TEST_GAP_REPORT.md'),
  `# v7.2 Real Persona Test Report

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`
`,
);

console.log('v7.2 real persona test report complete.');
console.log(JSON.stringify({
  status: report.status,
  authenticated_personas: `${report.authenticated_personas_passed}/${report.required_persona_count}`,
  required_scenarios: `${report.required_scenarios_passed}/${report.required_scenario_count}`,
  runtime_bridge_actions_verified: report.runtime_bridge_actions_verified,
  report: 'release/v700/real-persona-test-gap-report.json',
}, null, 2));

if (strict && !proofPassed) process.exit(1);
