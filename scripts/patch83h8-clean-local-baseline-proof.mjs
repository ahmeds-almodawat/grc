import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h8/patch83h8-clean-local-baseline-design.md';
const jsonPath = 'release/patch83h8/patch83h8-clean-local-baseline-design.json';
const matrixPath = 'release/patch83h8/patch83h8-baseline-option-matrix.md';

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
assert(mdContent.includes('016') && mdContent.includes('missing remotely'), 'Report records remote 016 missing');
assert(mdContent.includes('022') && mdContent.includes('applied remotely'), 'Report records remote 022 present');
assert(mdContent.includes('055') && mdContent.includes('applied remotely'), 'Report records remote 055 present');
assert(mdContent.includes('166') && mdContent.includes('local-only'), 'Report records remote 166 missing');

assert(mdContent.includes('out-of-order'), 'Report rejects restoring 016 without reconciliation');
assert(mdContent.includes('partial') || mdContent.includes('Partial'), 'Report rejects partial pre-022 stub');
assert(mdContent.includes('checksum') || mdContent.includes('editing 022 is unsafe'), 'Report rejects editing 022 plus repair');

assert(mdContent.includes('localhost') || mdContent.includes('127.0.0.1'), 'Report includes localhost-only safety controls');
assert(mdContent.includes('checksum') && mdContent.includes('Drift Detection') || mdContent.includes('Drift detection'), 'Report includes checksum and drift detection');
assert(mdContent.includes('Patch 83H.9'), 'Report includes exact 83H.9 implementation sequence');
assert(mdContent.includes('No repair applied'), 'Report states no repair applied');
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
assert(pkg.scripts['patch83h8:proof'], 'package.json contains patch83h8:proof');

console.log('✅ Patch 83H.8 proof passed. Clean local baseline design complete.');
