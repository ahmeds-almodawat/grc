import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h6/patch83h6-safe-migration-chain-repair-design.md';
const jsonPath = 'release/patch83h6/patch83h6-safe-migration-chain-repair-design.json';
const matrixPath = 'release/patch83h6/patch83h6-option-comparison-matrix.md';

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
assert(mdContent.includes('f2271a3'), 'Report references f2271a3');
assert(mdContent.includes('614d833'), 'Report references 614d833');
assert(mdContent.includes('original 016'), 'Report references original 016');
assert(mdContent.includes('current 055'), 'Report references current 055');
assert(mdContent.includes('migration 022'), 'Report references migration 022');
assert(mdContent.includes('Scenario 1'), 'Report includes scenario 1');
assert(mdContent.includes('Scenario 2'), 'Report includes scenario 2');
assert(mdContent.includes('Scenario 3'), 'Report includes scenario 3');
assert(mdContent.includes('Scenario 4'), 'Report includes scenario 4');
assert(mdContent.includes('Scenario 5'), 'Report includes scenario 5');
assert(mdContent.includes('Option A'), 'Report compares Option A');
assert(mdContent.includes('Option F'), 'Report compares Option F');
assert(mdContent.includes('out-of-order'), 'Report includes migration-history risk analysis');
assert(mdContent.includes('Pre-implementation Evidence Required') || mdContent.includes('Pre-implementation evidence required'), 'Report requires remote migration-history evidence');
assert(mdContent.includes('Stop/Go Gates'), 'Report includes stop/go gates');
assert(mdContent.includes('Rollback Strategy'), 'Report includes rollback strategy');
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
assert(pkg.scripts['patch83h6:proof'], 'package.json contains patch83h6:proof');

console.log('✅ Patch 83H.6 proof passed. Migration chain repair design complete.');
