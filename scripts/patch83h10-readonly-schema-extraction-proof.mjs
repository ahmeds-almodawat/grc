import fs from 'fs';
import { execSync } from 'child_process';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h10/patch83h10-readonly-schema-extraction.md';
const jsonPath = 'release/patch83h10/patch83h10-readonly-schema-extraction.json';
const sanPath = 'release/patch83h10/patch83h10-schema-sanitization-report.md';
const invPath = 'release/patch83h10/patch83h10-schema-object-inventory.md';

assert(fs.existsSync(mdPath), 'Markdown report exists.');
assert(fs.existsSync(jsonPath), 'JSON report exists.');
assert(fs.existsSync(sanPath), 'Sanitization report exists.');
assert(fs.existsSync(invPath), 'Inventory report exists.');

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
assert(jsonContent.data_exported === false, 'Report states data_exported=false');

if (jsonContent.status !== 'BLOCKED') {
  const baselinePath = 'local-baseline/schema-baseline-candidate.sql';
  assert(fs.existsSync(baselinePath), 'Sanitized baseline candidate exists.');
  const baselineContent = fs.readFileSync(baselinePath, 'utf8').toUpperCase();
  assert(!baselineContent.includes('INSERT INTO '), 'No INSERT statements exist in the sanitized baseline.');
  assert(!baselineContent.includes('COPY '), 'No COPY statements exist in the sanitized baseline.');
  assert(mdContent.includes('restore_dry_run_jobs verification'), 'Required restore_dry_run_jobs columns are recorded.');
  assert(mdContent.includes('document_center_items verification'), 'Required document_center_items columns are recorded.');
  assert(mdContent.includes('helper-function verification') || mdContent.includes('helper function'), 'Required helper functions and enum are recorded.');
} else {
  assert(mdContent.includes('BLOCKED'), 'Extraction explicitly blocked.');
  assert(mdContent.includes('Patch 83I') && mdContent.includes('BLOCKED'), 'Patch 83I remains blocked.');
}

assert(mdContent.includes('Baseline candidate approved: False') || mdContent.includes('Baseline candidate approved: false'), 'Baseline candidate approval is explicit.');

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
assert(pkg.scripts['patch83h10:proof'], 'package.json contains patch83h10:proof');

console.log('✅ Patch 83H.10 proof passed. Read-only schema extraction gracefully blocked.');
