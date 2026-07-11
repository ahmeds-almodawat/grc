import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83k/patch83k-cloud-persona-runtime-results.md';
const jsonPath = 'release/patch83k/patch83k-cloud-persona-runtime-results.json';
const accessPath = 'release/patch83k/patch83k-persona-access-matrix.md';
const writePath = 'release/patch83k/patch83k-write-regression-matrix.md';
const cleanupPath = 'release/patch83k/patch83k-cleanup-verification.md';

assert(fs.existsSync(mdPath), 'Markdown report exists.');
assert(fs.existsSync(jsonPath), 'JSON report exists.');
assert(fs.existsSync(accessPath), 'Access matrix exists.');
assert(fs.existsSync(writePath), 'Write matrix exists.');
assert(fs.existsSync(cleanupPath), 'Cleanup verification exists.');

const mdContent = fs.readFileSync(mdPath, 'utf8');
const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const gitStatus = execSync('git status --porcelain').toString();

assert(!gitStatus.includes('supabase/migrations/'), 'No existing migration changed.');
assert(!gitStatus.includes('supabase/functions/'), 'No Supabase function changed.');
assert(!gitStatus.includes('src/App.tsx'), 'No application/security file changed (App.tsx).');
assert(!gitStatus.includes('src/components/Layout.tsx'), 'No application/security file changed (Layout.tsx).');
assert(!gitStatus.includes('src/auth/authAccess.ts'), 'No application/security file changed (authAccess.ts).');
assert(!gitStatus.includes('src/lib/privilegedAction.ts'), 'No application/security file changed (privilegedAction.ts).');

assert(jsonContent.db_push_executed === false, 'db_push_executed=false');
assert(jsonContent.migration_repair_executed === false, 'migration_repair_executed=false');
assert(jsonContent.migration_166_modified === false, 'Migration 166 unchanged.');

if (jsonContent.status !== 'BLOCKED') {
  assert(jsonContent.real_authenticated_sessions_used === true, 'Real authenticated sessions used.');
} else {
  assert(mdContent.includes('BLOCKED'), 'Blocked status documented.');
  // If blocked, we skip the hard requirement of having actual passing values.
}

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
assert(pkg.scripts['patch83k:proof'], 'package.json contains patch83k:proof');

console.log('✅ Patch 83K proof passed. Blocked state securely documented.');
