import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/107_patch47_staging_migration_persona_evidence_closure.sql');
const outDir = path.join(root, 'release/patch47');
const outPath = path.join(outDir, 'patch47-schema-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();
const grantExecuteLines = sql.split(/\r?\n/).filter(line => /^\s*grant\s+execute\s+on\s+function/i.test(line));

const tables = ['staging_migration_evidence_runs', 'staging_migration_evidence_events'];
const views = [
  'v_patch47_staging_migration_evidence_register',
  'v_patch47_latest_staging_migration_evidence',
  'v_patch47_staging_persona_sql_evidence',
  'v_patch47_staging_security_blockers',
  'v_patch47_staging_evidence_summary',
  'v_patch47_production_readiness_staging_overlay',
];
const functions = [
  'create_staging_migration_evidence_run',
  'update_staging_migration_evidence_run_status',
  'record_staging_migration_evidence_event',
  'get_staging_evidence_summary',
  'get_production_readiness_staging_overlay',
];

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...tables.map(table => ({ name: `table exists: ${table}`, passed: lower.includes(`create table if not exists public.${table}`) })),
  ...tables.map(table => ({ name: `RLS enabled: ${table}`, passed: lower.includes(`alter table public.${table} enable row level security`) })),
  { name: 'read policies exist', passed: lower.includes('patch47_staging_migration_evidence_runs_read') && lower.includes('patch47_staging_migration_evidence_events_read') },
  { name: 'write policies exist', passed: lower.includes('patch47_staging_migration_evidence_runs_write') && lower.includes('patch47_staging_migration_evidence_events_write') },
  ...views.map(view => ({ name: `view exists: ${view}`, passed: lower.includes(`view public.${view}`) })),
  ...views.map(view => {
    const pattern = new RegExp(`alter\\s+view\\s+if\\s+exists\\s+public\\.${view}\\s+set\\s*\\([^)]*security_invoker\\s*=\\s*true`, 'i');
    return { name: `explicit security_invoker view: ${view}`, passed: pattern.test(sql) };
  }),
  ...functions.map(fn => ({ name: `function exists: ${fn}`, passed: lower.includes(`function public.${fn}`) })),
  { name: 'mutating functions are service-role-gated', passed: lower.includes('patch47_service_role_required') && (sql.match(/perform public\.patch47_service_role_required\(\)/g) ?? []).length >= 3 },
  { name: 'no broad execute grant for mutating functions', passed: !grantExecuteLines.some(line => /public\.(record_staging_migration_evidence_event|create_staging_migration_evidence_run|update_staging_migration_evidence_run_status)/i.test(line) && /authenticated/i.test(line)) },
  { name: 'no destructive data operations', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = { patch: '47', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed, tables, views, functions };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
