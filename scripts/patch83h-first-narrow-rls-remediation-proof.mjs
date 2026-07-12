import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ' + message);
    process.exit(1);
  }
}

const mdPath = 'release/patch83h/patch83h-first-narrow-rls-remediation.md';
const jsonPath = 'release/patch83h/patch83h-first-narrow-rls-remediation.json';

assert(fs.existsSync(mdPath), 'Markdown report exists');
assert(fs.existsSync(jsonPath), 'JSON report exists');

const mdContent = fs.readFileSync(mdPath, 'utf8');
const jsonContent = fs.readFileSync(jsonPath, 'utf8');

const reportSections = [
  'Selected Table',
  'Existing Policy Inventory',
  'Access Behavior Before',
  'Access Behavior After',
  'Positive Test',
  'Negative Test',
  'Rollback SQL',
  'Known Limitations',
  'local/staging validation only',
  'not applied to production',
  'no supabase db push',
  'one-table scope only'
];

reportSections.forEach(section => {
  assert(mdContent.toLowerCase().includes(section.toLowerCase()), `Report contains section or statement: ${section}`);
});

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
});

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.scripts['patch83h:proof'], 'package.json contains patch83h:proof');

const migrationsPath = 'supabase/migrations';
const migrations = fs.readdirSync(migrationsPath);
const newMigrations = migrations.filter(f => f.toLowerCase().includes('83h'));
assert(newMigrations.length === 1, 'Exactly one new Patch 83H migration exists');

const migrationPath = path.join(migrationsPath, newMigrations[0]);
const migrationContent = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

assert(!migrationContent.includes('using (true)'), 'Migration does not contain USING (true)');
assert(!migrationContent.includes('with check (true)'), 'Migration does not contain WITH CHECK (true)');
assert(!migrationContent.includes('to anon'), 'Migration does not contain anon grants');
assert(!migrationContent.includes('service_role_key'), 'Migration does not contain service-role secrets');
assert(!migrationContent.includes('db push'), 'Migration does not contain db push');
assert(!migrationContent.includes('db reset'), 'Migration does not contain destructive reset commands');
assert(!migrationContent.includes('repair'), 'Migration does not contain migration repair');

const targetTable = 'document_center_items';
const otherTables = ['ovr_reports', 'risks', 'evidence_files', 'projects', 'tasks'];
otherTables.forEach(t => {
  assert(!migrationContent.includes(`on public.${t}`) && !migrationContent.includes(`on ${t}`), `Migration does not affect table ${t}`);
});
assert(migrationContent.includes(targetTable), `Migration affects target table ${targetTable}`);

console.log('✅ Patch 83H proof passed. Narrow RLS remediation verified.');
