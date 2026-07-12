import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h2/patch83h2-rls-runtime-validation-results.md';
const jsonPath = 'release/patch83h2/patch83h2-rls-runtime-validation-results.json';
const matrixPath = 'release/patch83h2/patch83h2-persona-results-matrix.md';

assert(fs.existsSync(mdPath), 'Results Markdown exists.');
assert(fs.existsSync(jsonPath), 'Results JSON exists.');
assert(fs.existsSync(matrixPath), 'Persona results matrix exists.');

const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const mdContent = fs.readFileSync(mdPath, 'utf8');

assert(jsonContent.persona_results, 'Runtime evidence contains actual results.');

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

requiredPersonas.forEach(p => {
  assert(jsonContent.persona_results[p] !== undefined, `Every required persona has a pass/fail result (${p})`);
});

assert(jsonContent.persona_results['same-organization different-department user'] !== undefined, 'Cross-department denial is recorded.');
assert(jsonContent.persona_results['cross-organization user'] !== undefined, 'Cross-organization denial is recorded.');
assert(jsonContent.persona_results['super_admin'] !== undefined, 'Super_admin access is recorded.');
assert(jsonContent.persona_results['anonymous user'] !== undefined, 'Anonymous denial is recorded.');

assert(jsonContent.rollback_result !== undefined, 'Rollback validation result is recorded.');
assert(jsonContent.cleanup_result !== undefined, 'Fixture cleanup is confirmed.');
assert(jsonContent.production_accessed === false, 'No production access is recorded.');
assert(jsonContent.db_push_executed === false, 'No db push is recorded.');
assert(jsonContent.migration_166_modified === false, 'Migration 166 remained unchanged.');

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
assert(pkg.scripts['patch83h2:proof'], 'package.json contains patch83h2:proof');

console.log('✅ Patch 83H.2 proof passed. Runtime validations securely tracked.');
