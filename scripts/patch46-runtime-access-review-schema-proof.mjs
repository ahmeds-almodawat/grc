import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/106_patch46_runtime_access_review_signoff_closure.sql');
const outDir = path.join(root, 'release/patch46');
const outPath = path.join(outDir, 'patch46-schema-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();
const grantExecuteLines = sql.split(/\r?\n/).filter(line => /^\s*grant\s+execute\s+on\s+function/i.test(line));

const tables = ['runtime_action_review_signoffs', 'runtime_action_review_signoff_events'];
const views = [
  'v_patch46_runtime_access_review_register',
  'v_patch46_pending_runtime_access_reviews',
  'v_patch46_overdue_runtime_access_reviews',
  'v_patch46_runtime_access_review_blockers',
  'v_patch46_runtime_access_review_summary',
  'v_patch46_runtime_action_risk_acceptance_register',
  'v_patch46_production_readiness_access_review_overlay',
];
const functions = [
  'record_runtime_action_review_signoff_event',
  'create_runtime_action_review_signoff',
  'update_runtime_action_review_signoff_status',
  'get_runtime_access_review_summary',
  'get_production_readiness_access_review_overlay',
];

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...tables.map(table => ({ name: `table exists: ${table}`, passed: lower.includes(`create table if not exists public.${table}`) })),
  ...tables.map(table => ({ name: `RLS enabled: ${table}`, passed: lower.includes(`alter table public.${table} enable row level security`) })),
  { name: 'read policies exist', passed: lower.includes('patch46_runtime_action_review_signoffs_read') && lower.includes('patch46_runtime_action_review_signoff_events_read') },
  { name: 'write policies exist', passed: lower.includes('patch46_runtime_action_review_signoffs_write') && lower.includes('patch46_runtime_action_review_signoff_events_write') },
  ...views.map(view => ({ name: `view exists: ${view}`, passed: lower.includes(`view public.${view}`) })),
  ...views.map(view => {
    const alterPattern = new RegExp(`alter\\s+view\\s+if\\s+exists\\s+public\\.${view}\\s+set\\s*\\([^)]*security_invoker\\s*=\\s*true`, 'i');
    return { name: `explicit security_invoker view: ${view}`, passed: alterPattern.test(sql) };
  }),
  ...functions.map(fn => ({ name: `function exists: ${fn}`, passed: lower.includes(`function public.${fn}`) })),
  { name: 'mutating functions are service-role-gated', passed: lower.includes('patch46_service_role_required') && (sql.match(/perform public\.patch46_service_role_required\(\)/g) ?? []).length >= 3 },
  { name: 'no broad execute grant for mutating functions', passed: !grantExecuteLines.some(line => /public\.(record_runtime_action_review_signoff_event|create_runtime_action_review_signoff|update_runtime_action_review_signoff_status)/i.test(line) && /authenticated/i.test(line)) },
  { name: 'no destructive data operations', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '46',
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
