import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/105_patch45_runtime_action_authorization_review.sql');
const outDir = path.join(root, 'release/patch45');
const outPath = path.join(outDir, 'patch45-schema-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();
const grantExecuteLines = sql.split(/\r?\n/).filter(line => /^\s*grant\s+execute\s+on\s+function/i.test(line));

const tables = ['runtime_action_reviews', 'runtime_action_review_events'];
const views = [
  'v_patch45_runtime_action_register',
  'v_patch45_unclassified_runtime_action_register',
  'v_patch45_privileged_runtime_action_register',
  'v_patch45_direct_browser_rpc_exception_register',
  'v_patch45_runtime_authorization_summary',
  'v_patch45_access_review_evidence_register',
  'v_patch45_production_security_readiness_overlay',
];
const functions = [
  'record_runtime_action_review_event',
  'create_runtime_action_review',
  'update_runtime_action_review_status',
  'get_runtime_authorization_summary',
  'get_production_security_readiness_overlay',
];

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...tables.map(table => ({ name: `table exists: ${table}`, passed: lower.includes(`create table if not exists public.${table}`) })),
  ...tables.map(table => ({ name: `RLS enabled: ${table}`, passed: lower.includes(`alter table public.${table} enable row level security`) })),
  { name: 'read policies exist', passed: lower.includes('patch45_runtime_action_reviews_read') && lower.includes('patch45_runtime_action_events_read') },
  { name: 'write policies exist', passed: lower.includes('patch45_runtime_action_reviews_write') && lower.includes('patch45_runtime_action_events_write') },
  ...views.map(view => ({ name: `view exists: ${view}`, passed: lower.includes(`view public.${view}`) })),
  ...views.map(view => ({ name: `security_invoker view: ${view}`, passed: lower.includes(`view public.${view}\nwith (security_invoker = true)`) })),
  ...functions.map(fn => ({ name: `function exists: ${fn}`, passed: lower.includes(`function public.${fn}`) })),
  { name: 'mutating functions are service-role-gated', passed: lower.includes('patch45_service_role_required') && (sql.match(/perform public\.patch45_service_role_required\(\)/g) ?? []).length >= 3 },
  { name: 'no broad execute grant for mutating functions', passed: !grantExecuteLines.some(line => /public\.(record_runtime_action_review_event|create_runtime_action_review|update_runtime_action_review_status)/i.test(line) && /authenticated/i.test(line)) },
  { name: 'no destructive data operations', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '45',
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
