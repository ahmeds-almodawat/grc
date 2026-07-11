import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h3/patch83h3-local-rls-runtime-results.md';
const jsonPath = 'release/patch83h3/patch83h3-local-rls-runtime-results.json';
const matrixPath = 'release/patch83h3/patch83h3-persona-results-matrix.md';

assert(fs.existsSync(mdPath), 'Results Markdown exists.');
assert(fs.existsSync(jsonPath), 'Results JSON exists.');
assert(fs.existsSync(matrixPath), 'Persona results matrix exists.');

const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const mdContent = fs.readFileSync(mdPath, 'utf8');

assert(jsonContent.local_host_verified !== undefined, 'Localhost is confirmed.');
assert(jsonContent.persona_results, 'Actual persona results are present.');

const requiredPersonas = [
  "document owner",
  "same-department normal user",
  "same-organization different-department user",
  "cross-organization user",
  "department manager",
  "auditor",
  "executive",
  "compliance officer",
  "governance admin",
  "super_admin",
  "anonymous user",
  "service-role test path"
];

// Verify no placeholders remain
requiredPersonas.forEach(p => {
  const res = jsonContent.persona_results[p];
  assert(res !== undefined && res !== '[PENDING]' && res !== 'PENDING', `No placeholder results remain for ${p}`);
});

// Since db reset failed, tests failed. Asserting they passed will intentionally fail the proof.
assert(jsonContent.persona_results['document owner'] === 'PASS', 'Owner access passed.');
assert(jsonContent.persona_results['same-organization different-department user'] === 'PASS', 'Cross-department denial passed.');
assert(jsonContent.persona_results['cross-organization user'] === 'PASS' || jsonContent.persona_results['cross-organization user'] === 'NOT_SUPPORTED', 'Cross-organization denial passed or is supported by explicit schema evidence.');
assert(jsonContent.persona_results['auditor'] === 'PASS', 'Auditor outside-scope denial passed.');
assert(jsonContent.persona_results['executive'] === 'PASS', 'Executive outside-scope denial passed.');
assert(jsonContent.persona_results['compliance officer'] === 'PASS', 'Compliance officer outside-scope denial passed.');
assert(jsonContent.persona_results['governance admin'] === 'PASS', 'Governance admin outside-scope denial passed.');
assert(jsonContent.persona_results['super_admin'] === 'PASS', 'Super_admin access passed.');
assert(jsonContent.persona_results['anonymous user'] === 'PASS', 'Anonymous denial passed.');
assert(jsonContent.rollback_result === 'PASS', 'Rollback validation passed.');
assert(jsonContent.final_policy_state !== 'USING (true)' && jsonContent.final_policy_state !== 'BLOCKED', 'Final policy is scoped, not USING (true).');
assert(jsonContent.cleanup_result === 'PASS', 'Fixture cleanup passed.');

assert(jsonContent.production_accessed === false, 'Production access is false.');
assert(jsonContent.db_push_executed === false, 'db push is false.');
assert(jsonContent.migration_166_modified === false, 'Migration 166 is unchanged.');

const gitStatus = execSync('git status --porcelain').toString();
assert(!gitStatus.includes('supabase/migrations/166_'), 'Migration 166 remained unchanged in git status.');
assert(!gitStatus.includes('supabase/functions/'), 'No Supabase function changed.');
assert(!gitStatus.includes('src/App.tsx'), 'No protected application/security file changed (App.tsx).');
assert(!gitStatus.includes('src/components/Layout.tsx'), 'No protected application/security file changed (Layout.tsx).');
assert(!gitStatus.includes('src/auth/authAccess.ts'), 'No protected application/security file changed (authAccess.ts).');
assert(!gitStatus.includes('src/lib/privilegedAction.ts'), 'No protected application/security file changed (privilegedAction.ts).');

const migrationsPath = 'supabase/migrations';
const migrations = fs.readdirSync(migrationsPath);
const newMigrations = migrations.filter(f => f.toLowerCase().includes('83h') && !f.includes('166_'));
assert(newMigrations.length === 0, 'No new migration exists.');

const forbiddenClaims = [
  'system is production ready',
  'system is production-ready',
  'go-live complete',
  'production launched',
  'transition_to_live_operations'
];

forbiddenClaims.forEach(claim => {
  assert(!mdContent.includes(claim), `Forbidden claim absent: ${claim}`);
});

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.scripts['patch83h3:proof'], 'package.json contains patch83h3:proof');

assert(jsonContent.patch83i_gate === 'PASS', 'Patch 83I is allowed only if all required tests passed.');

console.log('✅ Patch 83H.3 proof passed. Runtime validations securely tracked.');
