import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83j/patch83j-cloud-migration-166-application.md';
const jsonPath = 'release/patch83j/patch83j-cloud-migration-166-application.json';
const valPath = 'release/patch83j/patch83j-post-application-policy-verification.md';

assert(fs.existsSync(mdPath), 'Markdown report exists.');
assert(fs.existsSync(jsonPath), 'JSON report exists.');
assert(fs.existsSync(valPath), 'Validation report exists.');

const mdContent = fs.readFileSync(mdPath, 'utf8');
const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const gitStatus = execSync('git status --porcelain').toString();

assert(!gitStatus.includes('supabase/migrations/'), 'No existing migration changed.');
assert(!gitStatus.includes('supabase/functions/'), 'No Supabase function changed.');
assert(!gitStatus.includes('src/App.tsx'), 'No application/security file changed (App.tsx).');
assert(!gitStatus.includes('src/components/Layout.tsx'), 'No application/security file changed (Layout.tsx).');
assert(!gitStatus.includes('src/auth/authAccess.ts'), 'No application/security file changed (authAccess.ts).');
assert(!gitStatus.includes('src/lib/privilegedAction.ts'), 'No application/security file changed (privilegedAction.ts).');

const migrationsPath = 'supabase/migrations';
const migrations = fs.readdirSync(migrationsPath);
const newMigrations = migrations.filter(f => {
  const match = f.match(/^(\d+)_/);
  return match && parseInt(match[1]) > 166;
});
assert(newMigrations.length === 0, 'No new migration exists.');

assert(jsonContent.unrelated_migrations_applied === false, 'Report states unrelated_migrations_applied=false');
assert(jsonContent.migration_repair_executed === false, 'Report states migration_repair_executed=false');
assert(jsonContent.db_reset_executed === false, 'Report states db_reset_executed=false');
assert(jsonContent.production_data_changed === false, 'Report states production_data_changed=false');
assert(mdContent.includes('Patch 83K persona tests required next'), 'Patch 83K persona tests required next.');

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
assert(pkg.scripts['patch83j:proof'], 'package.json contains patch83j:proof');

console.log('✅ Patch 83J proof passed. Migration 166 applied successfully.');
