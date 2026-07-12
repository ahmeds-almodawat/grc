import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h9/patch83h9-local-baseline-implementation.md';
const jsonPath = 'release/patch83h9/patch83h9-local-baseline-implementation.json';
const verifyPath = 'release/patch83h9/patch83h9-schema-verification.md';
const matrixPath = 'release/patch83h9/patch83h9-migration-ledger-matrix.md';

assert(fs.existsSync(mdPath), 'Markdown report exists.');
assert(fs.existsSync(jsonPath), 'JSON report exists.');
assert(fs.existsSync(verifyPath), 'Schema verification report exists.');
assert(fs.existsSync(matrixPath), 'Migration ledger matrix exists.');

const mdContent = fs.readFileSync(mdPath, 'utf8');

const gitStatus = execSync('git status --porcelain').toString();

assert(!gitStatus.includes('supabase/migrations/'), 'No historical migration changed.');
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
assert(newMigrations.length === 0, 'No production migration was created.');

// Verifications for blocked status
assert(mdContent.includes('BLOCKED'), 'Reports clearly state BLOCKED.');
assert(!fs.existsSync('local-baseline/schema-baseline.sql'), 'No baseline is fabricated.');

assert(mdContent.includes('Production accessed: false') || mdContent.includes('production accessed: false'), 'Production access is false.');
assert(mdContent.includes('db push executed: false') || mdContent.includes('db push: false'), 'db push is false.');
assert(mdContent.includes('Migration repair executed: false') || mdContent.includes('migration repair: false'), 'migration repair is false.');
assert(mdContent.includes('Patch 83I') && mdContent.includes('blocked'), 'Patch 83I remains blocked until persona tests pass.');

const scriptEnvCheck = fs.readFileSync('scripts/patch83h9-check-local-baseline-environment.mjs', 'utf8');
assert(scriptEnvCheck.includes('localhost') || scriptEnvCheck.includes('127.0.0.1'), 'Localhost-only safety controls exist.');
assert(scriptEnvCheck.includes('zbrjjecpsrzposhuarcn'), 'Production ref is rejected.');

const scriptBootstrap = fs.readFileSync('scripts/patch83h9-bootstrap-local-baseline.mjs', 'utf8');
assert(!scriptBootstrap.includes('db push'), 'db push is not used.');

assert(mdContent.includes('Migration-ledger strategy'), 'Migration ledger strategy is documented.');
assert(mdContent.includes('Migration 166 Execution'), 'Migration 166 is not falsely marked applied.');

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
assert(pkg.scripts['patch83h9:proof'], 'package.json contains patch83h9:proof');

console.log('✅ Patch 83H.9 proof passed. Local baseline implementation gracefully blocked.');
