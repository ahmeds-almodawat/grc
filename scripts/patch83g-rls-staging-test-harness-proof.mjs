import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83g/patch83g-rls-staging-test-harness-plan.md';
const jsonPath = 'release/patch83g/patch83g-rls-staging-test-harness-plan.json';
const sqlPath = 'release/patch83g/patch83g-rls-test-case-template.sql.txt';

assert(fs.existsSync(mdPath), 'Markdown report exists');
assert(fs.existsSync(jsonPath), 'JSON report exists');
assert(fs.existsSync(sqlPath), 'SQL template exists');

// Verify no .sql equivalent exists
const sqlExt = sqlPath.replace('.sql.txt', '.sql');
assert(!fs.existsSync(sqlExt), 'No .sql equivalent exists');

const mdContent = fs.readFileSync(mdPath, 'utf8');
const jsonContent = fs.readFileSync(jsonPath, 'utf8');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

// SQL specific checks
assert(sqlContent.includes('documentation-only') && sqlContent.includes('do not run directly'), 'SQL template states documentation-only and not to run directly');

// MD specific checks
assert(mdContent.includes('Patch 82V') && mdContent.includes('Patch 82W') && mdContent.includes('Patch 83E') && mdContent.includes('Patch 83F'), 'Report references Patches 82V, 82W, 83E, 83F');
assert(mdContent.includes('makes no production database changes') || mdContent.includes('no production database changes'), 'Report states no production DB changes');
assert(mdContent.includes('creates no migration') || mdContent.includes('no migration'), 'Report states no migrations');
assert(mdContent.includes('changes no policies') || mdContent.includes('no policies'), 'Report states no policy changes');
assert(mdContent.includes('supabase db push'), 'Report states no supabase db push');

const requiredPersonas = [
  'normal user',
  'department manager',
  'auditor/read-only',
  'compliance or governance admin',
  'super_admin',
  'cross-department user'
];

requiredPersonas.forEach(persona => {
  assert(mdContent.includes(persona), `Required persona: ${persona} is present in MD`);
  assert(jsonContent.includes(persona), `Required persona: ${persona} is present in JSON`);
});

const testCategories = [
  'positive read access',
  'negative read access',
  'allowed write access',
  'denied write access',
  'cross-department denial',
  'cross-organization denial',
  'auditor read-only enforcement',
  'owner/assignee access',
  'privileged action path',
  'service-role-only write path',
  'append-only audit/event enforcement',
  'anonymous access denial'
];

testCategories.forEach(category => {
  assert(mdContent.includes(category), `Test category: ${category} is present in MD`);
  assert(jsonContent.includes(category), `Test category: ${category} is present in JSON`);
});

const stopGoGates = [
  'staging/local environment confirmed',
  'production ref rejected',
  'persona matrix complete',
  'negative tests defined',
  'rollback procedure documented',
  'no unresolved schema assumptions',
  'no service-role secret stored in repository',
  'explicit user approval required before Patch 83H'
];

stopGoGates.forEach(gate => {
  assert(mdContent.includes(gate), `Stop/Go gate: ${gate} is present in MD`);
  assert(jsonContent.includes(gate), `Stop/Go gate: ${gate} is present in JSON`);
});

assert(mdContent.includes('rollback confirmation') || jsonContent.includes('rollback confirmation'), 'Rollback evidence requirements are present');

const migrationsPath = 'supabase/migrations';
if (fs.existsSync(migrationsPath)) {
  const migrations = fs.readdirSync(migrationsPath);
  const newMigration = migrations.find(f => f.toLowerCase().includes('83g'));
  assert(!newMigration, 'No .sql migration file was created under supabase/migrations');
}

const functionsPath = 'supabase/functions';
if (fs.existsSync(functionsPath)) {
  const functions = fs.readdirSync(functionsPath);
  const newFunction = functions.find(f => f.toLowerCase().includes('83g'));
  assert(!newFunction, 'No function file was created under supabase/functions');
}

const forbiddenClaims = [
  'system is production ready',
  'system is production-ready',
  'go-live complete',
  'production launched',
  'transition_to_live_operations'
];

forbiddenClaims.forEach(claim => {
  assert(!mdContent.includes(claim), `Forbidden claim "${claim}" must be absent from Markdown`);
  assert(!jsonContent.includes(claim), `Forbidden claim "${claim}" must be absent from JSON`);
  assert(!sqlContent.includes(claim), `Forbidden claim "${claim}" must be absent from SQL`);
});

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.scripts['patch83g:proof'], 'package.json contains patch83g:proof');

console.log('✅ Patch 83G proof passed. RLS staging test harness plan verified.');
