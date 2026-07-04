import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/108_patch49_controlled_pilot_activation_department_signoff.sql');
const outDir = path.join(root, 'release/patch49');
const outPath = path.join(outDir, 'patch49-schema-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();
const grantExecuteLines = sql.split(/\r?\n/).filter(line => /^\s*grant\s+execute\s+on\s+function/i.test(line));

const tables = [
  'controlled_pilot_activation_runs',
  'controlled_pilot_departments',
  'controlled_pilot_department_signoffs',
  'controlled_pilot_participants',
  'controlled_pilot_activation_events',
];

const views = [
  'v_patch49_controlled_pilot_activation_register',
  'v_patch49_department_pilot_readiness_register',
  'v_patch49_department_signoff_register',
  'v_patch49_missing_department_owner_register',
  'v_patch49_overdue_department_signoff_register',
  'v_patch49_pilot_participant_coverage',
  'v_patch49_controlled_pilot_blockers',
  'v_patch49_controlled_pilot_go_no_go_summary',
  'v_patch49_production_readiness_pilot_activation_overlay',
];

const functions = [
  'record_controlled_pilot_activation_event',
  'create_controlled_pilot_activation_run',
  'update_controlled_pilot_activation_status',
  'create_controlled_pilot_department',
  'update_controlled_pilot_department_status',
  'create_controlled_pilot_department_signoff',
  'update_controlled_pilot_department_signoff_status',
  'create_controlled_pilot_participant',
  'update_controlled_pilot_participant_status',
  'get_controlled_pilot_go_no_go_summary',
  'get_production_readiness_pilot_activation_overlay',
];

const mutatingFunctions = functions.filter(fn => !fn.startsWith('get_'));

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...tables.map(table => ({ name: `table exists: ${table}`, passed: lower.includes(`create table if not exists public.${table}`) })),
  ...tables.map(table => ({ name: `RLS enabled: ${table}`, passed: lower.includes(`alter table public.${table} enable row level security`) })),
  { name: 'read policies exist', passed: ['patch49_activation_runs_read', 'patch49_departments_read', 'patch49_signoffs_read', 'patch49_participants_read', 'patch49_events_read'].every(token => lower.includes(token)) },
  { name: 'write policies exist', passed: ['patch49_activation_runs_write', 'patch49_departments_write', 'patch49_signoffs_write', 'patch49_participants_write', 'patch49_events_write'].every(token => lower.includes(token)) },
  ...views.map(view => ({ name: `view exists: ${view}`, passed: lower.includes(`view public.${view}`) })),
  ...views.map(view => {
    const alterPattern = new RegExp(`alter\\s+view\\s+if\\s+exists\\s+public\\.${view}\\s+set\\s*\\([^)]*security_invoker\\s*=\\s*true`, 'i');
    return { name: `explicit security_invoker view: ${view}`, passed: alterPattern.test(sql) };
  }),
  ...functions.map(fn => ({ name: `function exists: ${fn}`, passed: lower.includes(`function public.${fn}`) })),
  { name: 'mutating functions are service-role-gated', passed: lower.includes('patch49_service_role_required') && (sql.match(/perform public\.patch49_service_role_required\(\)/g) ?? []).length >= mutatingFunctions.length },
  { name: 'no broad execute grant for mutating functions', passed: !grantExecuteLines.some(line => mutatingFunctions.some(fn => line.includes(`public.${fn}`)) && /\bauthenticated\b/i.test(line)) },
  { name: 'no destructive data operations', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql) },
  { name: 'no seeded pilot records', passed: !/\b(fake|demo|mock|sample|seed)\b/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '49',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  tables,
  views,
  functions,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
