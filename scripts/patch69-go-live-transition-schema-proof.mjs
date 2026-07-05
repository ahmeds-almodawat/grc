import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/115_patch69_go_live_environment_transition.sql');
const outDir = path.join(root, 'release/patch69');
const outPath = path.join(outDir, 'patch69-schema-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();

const tables = [
  'employee_import_staging',
  'staging_validation_cycles',
  'staging_validation_check_results',
  'patch13_sql_proof_runs',
  'patch14_staging_persona_sql_runs',
  'patch14_backup_restore_proof_runs',
  'production_go_no_go_staging_persona_runs',
  'staging_migration_evidence_runs',
  'staging_migration_evidence_events'
];

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  { name: 'lock function exists', passed: lower.includes('create or replace function public.trg_enforce_live_environment_lock()') },
  ...tables.map(table => ({ name: `lock trigger defined: ${table}`, passed: lower.includes(`'${table}'`) })),
  { name: 'trigger iterates correctly', passed: lower.includes('foreach t in array tables loop') && lower.includes('create trigger trg_lock_%1$s') },
  { name: 'no destructive data operations', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '69',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\n❌ patch69 schema proof failed:');
  failed.forEach(f => console.error(`  - ${f.name}`));
  process.exit(1);
}

console.log(`\n✅ patch69 schema proof passed. (${checks.length} checks)`);
