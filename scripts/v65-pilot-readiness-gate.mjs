import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v65');
fs.mkdirSync(outDir, { recursive: true });

function readJson(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const inputs = {
  noMock: readJson('release/v60/v60-production-data-audit.json'),
  dbSecurity: readJson('release/v64/v64-database-security-proof-summary.json'),
  authSmoke: readJson('release/v65/v65-auth-security-smoke.json'),
  workflow: readJson('release/v65/v65-workflow-contract-tests.json'),
  assets: readJson('release/v65/v65-test-assets-audit.json')
};

const gates = [
  { code: 'TYPECHECK_BUILD', status: 'passed_by_previous_phase', required: true, evidence: 'v65 phase runner typecheck/build' },
  { code: 'NO_MOCK_STATIC', status: inputs.noMock?.summary?.production_blocking_findings === 0 ? 'passed' : 'missing_or_failed', required: true, evidence: 'release/v60/v60-production-data-audit.json' },
  { code: 'DB_SECURITY_STATIC', status: inputs.dbSecurity?.database_security_status === 'static_ready_pending_staging_persona_sql' ? 'passed' : 'missing_or_failed', required: true, evidence: 'release/v64/v64-database-security-proof-summary.json' },
  { code: 'AUTH_SMOKE', status: inputs.authSmoke?.summary?.strict_passed ? 'passed' : 'missing_or_failed', required: true, evidence: 'release/v65/v65-auth-security-smoke.json' },
  { code: 'WORKFLOW_CONTRACTS', status: inputs.workflow?.summary?.strict_passed ? 'passed' : 'missing_or_failed', required: true, evidence: 'release/v65/v65-workflow-contract-tests.json' },
  { code: 'TEST_ASSETS', status: inputs.assets?.summary?.strict_passed ? 'passed' : 'missing_or_failed', required: true, evidence: 'release/v65/v65-test-assets-audit.json' },
  { code: 'STAGING_PERSONA_SQL', status: 'manual_required', required: true, evidence: 'Run supabase/tests/v64_persona_security_tests.sql in staging and attach output.' },
  { code: 'RESTORE_DRY_RUN', status: 'manual_required', required: true, evidence: 'Restore staging backup and verify table/storage samples.' },
  { code: 'PILOT_SIGNOFF', status: 'manual_required', required: true, evidence: 'IT + Quality + Admin signoff before real pilot.' }
];

const blocking = gates.filter((g) => g.required && !['passed', 'passed_by_previous_phase'].includes(g.status));
const summary = {
  generated_at: new Date().toISOString(),
  gates_total: gates.length,
  automated_gates_passed: gates.filter((g) => ['passed', 'passed_by_previous_phase'].includes(g.status)).length,
  manual_gates_required: gates.filter((g) => g.status === 'manual_required').length,
  blocking_count: blocking.length,
  controlled_pilot_status: blocking.length === 0 ? 'ready_for_controlled_pilot' : 'not_ready_manual_evidence_required',
  recommendation: 'Use for controlled internal testing only until staging persona SQL, restore dry-run, and pilot signoff are attached.'
};

fs.writeFileSync(path.join(outDir, 'v65-pilot-readiness-gate.json'), JSON.stringify({ summary, gates }, null, 2));
fs.writeFileSync(path.join(outDir, 'V65_PILOT_READINESS_GATE.md'), `# v6.5 Pilot Readiness Gate\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n## Gates\n\n${gates.map((g) => `- **${g.status}** ${g.code} — ${g.evidence}`).join('\n')}\n\n## Pilot rule\n\nDo not enter confidential OVR or patient-identifying data until staging persona SQL and restore dry-run evidence pass.\n`);

console.log('v6.5 pilot readiness gate generated.');
console.log(JSON.stringify(summary, null, 2));
// Do not fail on manual_required gates. This report is meant to expose remaining real-world proof.
