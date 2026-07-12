import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h10a/patch83h10a-schema-extraction-connectivity.md';
const jsonPath = 'release/patch83h10a/patch83h10a-schema-extraction-connectivity.json';
const matPath = 'release/patch83h10a/patch83h10a-connectivity-matrix.md';
const valPath = 'release/patch83h10a/patch83h10a-schema-validation.md';

assert(fs.existsSync(mdPath), 'Markdown report exists.');
assert(fs.existsSync(jsonPath), 'JSON report exists.');
assert(fs.existsSync(matPath), 'Connectivity matrix exists.');
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

assert(jsonContent.data_exported === false, 'Report states data_exported=false');
assert(jsonContent.production_modified === false, 'Report states production_modified=false');
assert(jsonContent.db_push_executed === false, 'Report states db_push_executed=false');
assert(jsonContent.sql_changes_applied === false, 'Report states sql_changes_applied=false');
assert(jsonContent.credentials_committed === false, 'Report states credentials_committed=false');
assert(jsonContent.secret_values_printed === false, 'Report states secret_values_printed=false');
assert(jsonContent.status === 'BLOCKED', 'Report states BLOCKED due to no secure credential method');
assert(mdContent.includes('Patch 83I') && mdContent.includes('blocked'), 'Patch 83I remains blocked.');

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
assert(pkg.scripts['patch83h10a:proof'], 'package.json contains patch83h10a:proof');

console.log('✅ Patch 83H.10A proof passed. Diagnostics recorded securely.');
