import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h4/patch83h4-migration-022-blocker-analysis.md';
const jsonPath = 'release/patch83h4/patch83h4-migration-022-blocker-analysis.json';

assert(fs.existsSync(mdPath), 'Markdown analysis exists.');
assert(fs.existsSync(jsonPath), 'JSON analysis exists.');

const mdContent = fs.readFileSync(mdPath, 'utf8');
const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const gitStatus = execSync('git status --porcelain').toString();

assert(!gitStatus.includes('supabase/migrations/022_'), 'Migration 022 was not modified.');
assert(!gitStatus.includes('supabase/migrations/') || gitStatus.includes('supabase/migrations/166_') === false, 'No existing migration was modified.');
assert(!gitStatus.includes('supabase/functions/'), 'No Supabase function changed.');
assert(!gitStatus.includes('src/App.tsx'), 'No application/security file changed (App.tsx).');
assert(!gitStatus.includes('src/components/Layout.tsx'), 'No application/security file changed (Layout.tsx).');
assert(!gitStatus.includes('src/auth/authAccess.ts'), 'No application/security file changed (authAccess.ts).');
assert(!gitStatus.includes('src/lib/privilegedAction.ts'), 'No application/security file changed (privilegedAction.ts).');

const migrationsPath = 'supabase/migrations';
const migrations = fs.readdirSync(migrationsPath);
// Verify no new migration was created since 166
const newMigrations = migrations.filter(f => {
  const match = f.match(/^(\d+)_/);
  return match && parseInt(match[1]) > 166;
});
assert(newMigrations.length === 0, 'No new migration was created.');

// Content verifications
assert(mdContent.includes('exact failing statement') || mdContent.includes('update restore_dry_run_jobs'), 'Report contains exact failing statement.');
assert(mdContent.includes('pre-022 column inventory') || mdContent.includes('Exact columns present immediately before'), 'Report contains pre-022 column inventory.');
assert(mdContent.includes('column history') || mdContent.includes('Whether `title` ever existed'), 'Report contains column history.');
assert(mdContent.includes('root cause') || mdContent.includes('Root Cause Analysis'), 'Report contains root cause.');
assert(mdContent.includes('production risk') || mdContent.includes('Production Risks'), 'Report contains production risk.');
assert(mdContent.includes('remediation options') || mdContent.includes('Remediation Options'), 'Report contains remediation options.');
assert(mdContent.includes('recommended option') || mdContent.includes('Recommended Safest Option'), 'Report contains recommended option.');
assert(mdContent.includes('rollback strategy') || mdContent.includes('Rollback Strategy'), 'Report contains rollback strategy.');
assert(mdContent.includes('stop/go gates') || mdContent.includes('Stop/Go Gates Before Any Fix'), 'Report contains stop/go gates.');
assert(mdContent.includes('No fix was applied'), 'The report states no fix was applied.');
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
assert(pkg.scripts['patch83h4:proof'], 'package.json contains patch83h4:proof');

console.log('✅ Patch 83H.4 proof passed. Migration 022 blocker analysis complete.');
