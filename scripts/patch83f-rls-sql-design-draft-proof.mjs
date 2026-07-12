import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83f/patch83f-rls-sql-design-draft.md';
const sqlPath = 'release/patch83f/patch83f-rls-sql-design-draft.sql.txt';
const jsonPath = 'release/patch83f/patch83f-rls-sql-design-draft.json';

assert(fs.existsSync(mdPath), 'Markdown report exists');
assert(fs.existsSync(sqlPath), 'SQL draft exists as .sql.txt');
assert(fs.existsSync(jsonPath), 'JSON report exists');

const mdContent = fs.readFileSync(mdPath, 'utf8');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');
const jsonContent = fs.readFileSync(jsonPath, 'utf8');

const migrationsPath = 'supabase/migrations';
if (fs.existsSync(migrationsPath)) {
  const migrations = fs.readdirSync(migrationsPath);
  const newMigration = migrations.find(f => f.toLowerCase().includes('83f'));
  assert(!newMigration, 'No .sql migration file was created under supabase/migrations');
}

assert(mdContent.includes('Patch 82V') && mdContent.includes('Patch 82W') && mdContent.includes('Patch 83E'), 'Report references Patch 82V, 82W, and 83E');
assert(sqlContent.includes('documentation-only') && sqlContent.includes('do not run directly'), 'SQL draft contains documentation-only / do not run directly warning');

const sqlPatterns = [
  'organization-scoped read',
  'department-scoped read',
  'owner/assignee-scoped read',
  'role-based write',
  'auditor read-only',
  'super_admin/governance_admin elevated read',
  'service-role-only write',
  'append-only audit/event tables'
];

sqlPatterns.forEach(pattern => {
  assert(sqlContent.toLowerCase().includes(pattern.toLowerCase()), `SQL draft includes required policy-pattern section: ${pattern}`);
});

const parsedJson = JSON.parse(jsonContent);
assert(parsedJson.draft_entries && parsedJson.draft_entries.length > 0, 'JSON includes draft entries');
const entry = parsedJson.draft_entries[0];
assert('affected_area' in entry, 'JSON entry has affected_area');
assert('proposed_policy_pattern' in entry, 'JSON entry has proposed_policy_pattern');
assert('required_columns' in entry, 'JSON entry has required_columns');
assert('helper_dependency' in entry, 'JSON entry has helper_dependency');
assert('positive_tests' in entry, 'JSON entry has positive_tests');
assert('negative_tests' in entry, 'JSON entry has negative_tests');
assert('rollback_note' in entry, 'JSON entry has rollback_note');
assert('migration_readiness' in entry, 'JSON entry has migration_readiness');

const forbiddenClaims = [
  'system is production ready',
  'go-live complete',
  'production launched',
  'transition_to_live_operations'
];

forbiddenClaims.forEach(claim => {
  assert(!mdContent.includes(claim), `Forbidden claim "${claim}" must be absent from Markdown`);
  assert(!jsonContent.includes(claim), `Forbidden claim "${claim}" must be absent from JSON`);
  assert(!sqlContent.includes(claim), `Forbidden claim "${claim}" must be absent from SQL text`);
});

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.scripts['patch83f:proof'], 'package.json contains patch83f:proof');

console.log('✅ Patch 83F proof passed. RLS SQL design draft verified.');
