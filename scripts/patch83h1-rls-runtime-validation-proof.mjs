import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h1/patch83h1-rls-runtime-validation-plan.md';
const jsonPath = 'release/patch83h1/patch83h1-rls-runtime-validation-plan.json';
const matrixPath = 'release/patch83h1/patch83h1-persona-test-matrix.md';
const safetyScriptPath = 'scripts/patch83h1-check-nonproduction-environment.mjs';

assert(fs.existsSync(mdPath), 'Markdown plan exists');
assert(fs.existsSync(jsonPath), 'JSON plan exists');
assert(fs.existsSync(matrixPath), 'Persona test matrix exists');
assert(fs.existsSync(safetyScriptPath), 'Non-production environment safety script exists');

const mdContent = fs.readFileSync(mdPath, 'utf8');
const jsonContent = fs.readFileSync(jsonPath, 'utf8');
const safetyScriptContent = fs.readFileSync(safetyScriptPath, 'utf8');

assert(safetyScriptContent.includes('zbrjjecpsrzposhuarcn'), 'The production project ref is explicitly rejected in safety script');
assert(safetyScriptContent.includes('GRC_RLS_TEST_ENV'), 'The safety script requires explicit environment variables');
assert(safetyScriptContent.includes('local') && safetyScriptContent.includes('staging'), 'The safety script explicitly checks for local/staging');
assert(!safetyScriptContent.includes('service_role_key') && !safetyScriptContent.includes('access_token') && !safetyScriptContent.includes('password') && !safetyScriptContent.includes('jwt_secret'), 'The safety script does not print secrets');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.scripts['patch83h1:proof'], 'package.json contains patch83h1:proof');

const migrationsPath = 'supabase/migrations';
const migrations = fs.readdirSync(migrationsPath);
const newMigrations = migrations.filter(f => f.toLowerCase().includes('83h'));
assert(newMigrations.length === 1 && newMigrations[0].startsWith('166_'), 'No new migration was created (only 166 exists for 83H)');

const gitStatus = execSync('git status --porcelain').toString();

assert(!gitStatus.includes('supabase/migrations/166_'), 'Migration 166 was not modified');
assert(!gitStatus.includes('supabase/functions/'), 'No Supabase functions changed');
assert(!gitStatus.includes('src/App.tsx'), 'No protected files changed (App.tsx)');
assert(!gitStatus.includes('src/components/Layout.tsx'), 'No protected files changed (Layout.tsx)');
assert(!gitStatus.includes('src/auth/authAccess.ts'), 'No protected files changed (authAccess.ts)');
assert(!gitStatus.includes('src/lib/privilegedAction.ts'), 'No protected files changed (privilegedAction.ts)');

const requiredPersonas = [
  'document owner', 'same-department normal user', 'same-organization different-department user',
  'cross-organization user', 'department manager', 'auditor', 'executive', 'compliance officer',
  'governance admin', 'super_admin', 'anonymous user', 'service-role test path'
];

requiredPersonas.forEach(p => {
  assert(jsonContent.includes(p), `Required persona documented: ${p}`);
});

const requiredTests = [
  'Owner read access', 'Cross-department denial', 'Anonymous denial', 'Write behavior unchanged', 'Service-role behavior unchanged'
];

requiredTests.forEach(t => {
  assert(mdContent.includes(t), `Required test documented: ${t}`);
});

assert(mdContent.includes('Rollback test in an isolated environment'), 'Rollback validation is documented');
assert(mdContent.includes('Expansion to Patch 83I is blocked until all required 83H.1 tests pass'), 'Patch 83I is blocked until runtime tests pass');

const forbiddenClaims = [
  'system is production ready',
  'system is production-ready',
  'go-live complete',
  'production launched',
  'transition_to_live_operations'
];

forbiddenClaims.forEach(claim => {
  assert(!mdContent.includes(claim), `Forbidden claim "${claim}" must be absent`);
  assert(!jsonContent.includes(claim), `Forbidden claim "${claim}" must be absent from JSON`);
});

console.log('✅ Patch 83H.1 proof passed. Validation plan and safety script verified.');
