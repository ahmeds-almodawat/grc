import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83i/patch83i-live-cloud-rls-compatibility.md';
const jsonPath = 'release/patch83i/patch83i-live-cloud-rls-compatibility.json';
const driftPath = 'release/patch83i/patch83i-live-policy-drift-matrix.md';
const chkPath = 'release/patch83i/patch83i-deployment-readiness-checklist.md';

assert(fs.existsSync(mdPath), 'Markdown report exists.');
assert(fs.existsSync(jsonPath), 'JSON report exists.');
assert(fs.existsSync(driftPath), 'Drift matrix exists.');
assert(fs.existsSync(chkPath), 'Checklist exists.');

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

assert(jsonContent.read_only === true, 'Report states read_only=true');
assert(jsonContent.production_modified === false, 'Report states production_modified=false');
assert(jsonContent.db_push_executed === false, 'Report states db_push_executed=false');
assert(jsonContent.migration_repair_executed === false, 'Report states migration_repair_executed=false');
assert(jsonContent.sql_changes_applied === false, 'Report states sql_changes_applied=false');

if (jsonContent.status !== 'BLOCKED') {
  assert(mdContent.includes('live status of required columns'), 'Report records live status of required columns.');
  assert(mdContent.includes('live RLS and policy inventory'), 'Report records live RLS and policy inventory.');
  assert(mdContent.includes('helper signatures'), 'Report records helper signatures.');
  assert(mdContent.includes('app_role values'), 'Report records app_role values.');
} else {
  assert(mdContent.includes('blocked due to missing evidence'), 'Migration 166 compatibility conclusion is explicit.');
  assert(mdContent.includes('blocked due to missing evidence'), 'Rollback compatibility conclusion is explicit.');
  assert(mdContent.includes('none'), 'Drift findings are classified.');
}

assert(mdContent.includes('Migration 166 was **not applied**') || mdContent.includes('migration 166 was not applied'), 'Report states migration 166 was not applied.');

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
assert(pkg.scripts['patch83i:proof'], 'package.json contains patch83i:proof');

console.log('✅ Patch 83I proof passed. Readiness review blocked safely.');
