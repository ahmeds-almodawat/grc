import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h7/patch83h7-remote-migration-history-verification.md';
const jsonPath = 'release/patch83h7/patch83h7-remote-migration-history-verification.json';
const matrixPath = 'release/patch83h7/patch83h7-local-remote-migration-matrix.md';

assert(fs.existsSync(mdPath), 'Markdown design exists.');
assert(fs.existsSync(jsonPath), 'JSON design exists.');
assert(fs.existsSync(matrixPath), 'Comparison matrix exists.');

const mdContent = fs.readFileSync(mdPath, 'utf8');

const gitStatus = execSync('git status --porcelain').toString();

assert(!gitStatus.includes('supabase/migrations/'), 'No migration file changed.');
assert(!gitStatus.includes('supabase/functions/'), 'No Supabase function changed.');
assert(!gitStatus.includes('src/App.tsx'), 'No protected application/security file changed (App.tsx).');
assert(!gitStatus.includes('src/components/Layout.tsx'), 'No protected application/security file changed (Layout.tsx).');
assert(!gitStatus.includes('src/auth/authAccess.ts'), 'No protected application/security file changed (authAccess.ts).');
assert(!gitStatus.includes('src/lib/privilegedAction.ts'), 'No protected application/security file changed (privilegedAction.ts).');

const migrationsPath = 'supabase/migrations';
const migrations = fs.readdirSync(migrationsPath);
const newMigrations = migrations.filter(f => {
  const match = f.match(/^(\d+)_/);
  return match && parseInt(match[1]) > 166;
});
assert(newMigrations.length === 0, 'No new migration exists.');

// Verifications
assert(mdContent.includes('read-only'), 'Report states read-only investigation');
assert(mdContent.includes('production modified: false') || mdContent.includes('production_modified: false'), 'Report states production_modified=false');
assert(mdContent.includes('db push executed: false') || mdContent.includes('db_push_executed: false'), 'Report states db_push_executed=false');
assert(mdContent.includes('migration repair executed: false') || mdContent.includes('migration_repair_executed: false'), 'Report states migration_repair_executed=false');
assert(mdContent.includes('SQL changes applied: false') || mdContent.includes('sql_changes_applied: false'), 'Report states sql_changes_applied=false');

assert(mdContent.includes('016:'), 'Report records remote status of 016');
assert(mdContent.includes('022:'), 'Report records remote status of 022');
assert(mdContent.includes('055:'), 'Report records remote status of 055');
assert(mdContent.includes('166:'), 'Report records remote status of 166');

assert(mdContent.includes('Option A Assessment'), 'Option A assessment is explicit');
assert(mdContent.includes('out-of-order migration risk') || mdContent.includes('Out-of-order migration risk'), 'Out-of-order risk is documented');
assert(mdContent.includes('Duplicate migration risk') || mdContent.includes('duplicate migration risk'), 'Duplicate version risk is documented');

assert(mdContent.includes('No repair was applied'), 'Report states no repair was applied');
assert(mdContent.includes('Patch 83H') && mdContent.includes('blocked'), 'Patch 83H runtime validation remains blocked');
assert(mdContent.includes('Patch 83I') && mdContent.includes('blocked'), 'Patch 83I remains blocked');

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
assert(pkg.scripts['patch83h7:proof'], 'package.json contains patch83h7:proof');

console.log('✅ Patch 83H.7 proof passed. Remote migration history verification complete.');
