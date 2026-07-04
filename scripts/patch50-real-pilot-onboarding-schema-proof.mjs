import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/109_patch50_real_pilot_master_data_onboarding.sql');
const outDir = path.join(root, 'release/patch50');
const outPath = path.join(outDir, 'patch50-schema-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();
const grantExecuteLines = sql.split(/\r?\n/).filter(line => /^\s*grant\s+execute\s+on\s+function/i.test(line));

const tables = [
  'real_pilot_onboarding_reviews',
  'real_pilot_setup_checklist_items',
  'real_pilot_master_data_exceptions',
  'real_pilot_onboarding_events',
];

const views = [
  'v_patch50_real_pilot_onboarding_review_register',
  'v_patch50_department_setup_checklist_register',
  'v_patch50_missing_department_owner_register',
  'v_patch50_pilot_participant_setup_gap_register',
  'v_patch50_pilot_role_assignment_gap_register',
  'v_patch50_pilot_training_gap_register',
  'v_patch50_pilot_signoff_assignment_gap_register',
  'v_patch50_inactive_or_unconfirmed_participant_register',
  'v_patch50_real_pilot_master_data_exception_register',
  'v_patch50_real_pilot_launch_blocker_register',
  'v_patch50_real_pilot_setup_summary',
  'v_patch50_production_readiness_real_pilot_setup_overlay',
];

const functions = [
  'record_real_pilot_onboarding_event',
  'create_real_pilot_onboarding_review',
  'update_real_pilot_onboarding_review_status',
  'create_real_pilot_setup_checklist_item',
  'update_real_pilot_setup_checklist_item_status',
  'create_real_pilot_master_data_exception',
  'update_real_pilot_master_data_exception_status',
  'get_real_pilot_setup_summary',
  'get_production_readiness_real_pilot_setup_overlay',
];

const mutatingFunctions = functions.filter(fn => !fn.startsWith('get_'));

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...tables.map(table => ({ name: `table exists: ${table}`, passed: lower.includes(`create table if not exists public.${table}`) })),
  ...tables.map(table => ({ name: `RLS enabled: ${table}`, passed: lower.includes(`alter table public.${table} enable row level security`) })),
  { name: 'read policies exist', passed: ['patch50_reviews_read', 'patch50_checklist_read', 'patch50_exceptions_read', 'patch50_events_read'].every(token => lower.includes(token)) },
  { name: 'write policies exist', passed: ['patch50_reviews_write', 'patch50_checklist_write', 'patch50_exceptions_write', 'patch50_events_write'].every(token => lower.includes(token)) },
  ...views.map(view => ({ name: `view exists: ${view}`, passed: lower.includes(`view public.${view}`) })),
  ...views.map(view => {
    const alterPattern = new RegExp(`alter\\s+view\\s+if\\s+exists\\s+public\\.${view}\\s+set\\s*\\([^)]*security_invoker\\s*=\\s*true`, 'i');
    return { name: `explicit security_invoker view: ${view}`, passed: alterPattern.test(sql) };
  }),
  ...functions.map(fn => ({ name: `function exists: ${fn}`, passed: lower.includes(`function public.${fn}`) })),
  { name: 'mutating functions are service-role-gated', passed: lower.includes('patch50_service_role_required') && (sql.match(/perform public\.patch50_service_role_required\(\)/g) ?? []).length >= mutatingFunctions.length },
  { name: 'no broad execute grant for mutating functions', passed: !grantExecuteLines.some(line => mutatingFunctions.some(fn => line.includes(`public.${fn}`)) && /\bauthenticated\b/i.test(line)) },
  { name: 'no destructive data operations', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql) },
  { name: 'no fake or seeded pilot records', passed: !/\b(fake|demo|mock|sample|seed)\b/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '50',
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
