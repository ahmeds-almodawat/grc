import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/112_patch53_golive_hypercare_operating_cadence.sql');
const outDir = path.join(root, 'release/patch53');
const outPath = path.join(outDir, 'patch53-schema-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();
const grantExecuteLines = sql.split(/\r?\n/).filter(line => /^\s*grant\s+execute\s+on\s+function/i.test(line));

const tables = ['production_hypercare_periods', 'production_hypercare_issues', 'production_operating_cadence_events', 'production_adoption_feedback', 'production_hypercare_events'];
const views = [
  'v_patch53_hypercare_period_register',
  'v_patch53_hypercare_issue_register',
  'v_patch53_open_high_critical_hypercare_issue_register',
  'v_patch53_overdue_hypercare_issue_register',
  'v_patch53_operating_cadence_event_register',
  'v_patch53_missed_operating_cadence_register',
  'v_patch53_department_adoption_feedback_register',
  'v_patch53_missing_department_feedback_register',
  'v_patch53_low_adoption_register',
  'v_patch53_hypercare_blocker_register',
  'v_patch53_hypercare_stability_summary',
  'v_patch53_production_readiness_hypercare_overlay',
];
const functions = [
  'record_production_hypercare_event',
  'create_production_hypercare_period',
  'update_production_hypercare_period_status',
  'create_production_hypercare_issue',
  'update_production_hypercare_issue_status',
  'create_production_operating_cadence_event',
  'update_production_operating_cadence_event_status',
  'create_production_adoption_feedback',
  'update_production_adoption_feedback_status',
  'get_production_hypercare_stability_summary',
  'get_production_readiness_hypercare_overlay',
];
const mutatingFunctions = functions.filter(fn => !fn.startsWith('get_'));

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...tables.map(table => ({ name: `table exists: ${table}`, passed: lower.includes(`create table if not exists public.${table}`) })),
  ...tables.map(table => ({ name: `RLS enabled: ${table}`, passed: lower.includes(`alter table public.${table} enable row level security`) })),
  { name: 'read policies exist', passed: ['patch53_periods_read', 'patch53_issues_read', 'patch53_cadence_read', 'patch53_feedback_read', 'patch53_events_read'].every(token => lower.includes(token)) },
  { name: 'write policies exist', passed: ['patch53_periods_write', 'patch53_issues_write', 'patch53_cadence_write', 'patch53_feedback_write', 'patch53_events_write'].every(token => lower.includes(token)) },
  ...views.map(view => ({ name: `view exists: ${view}`, passed: lower.includes(`view public.${view}`) })),
  ...views.map(view => {
    const alterPattern = new RegExp(`alter\\s+view\\s+if\\s+exists\\s+public\\.${view}\\s+set\\s*\\([^)]*security_invoker\\s*=\\s*true`, 'i');
    return { name: `explicit security_invoker view: ${view}`, passed: alterPattern.test(sql) };
  }),
  ...functions.map(fn => ({ name: `function exists: ${fn}`, passed: lower.includes(`function public.${fn}`) })),
  { name: 'mutating functions are service-role-gated', passed: lower.includes('patch53_service_role_required') && (sql.match(/perform public\.patch53_service_role_required\(\)/g) ?? []).length >= mutatingFunctions.length },
  { name: 'no broad execute grant for mutating functions', passed: !grantExecuteLines.some(line => mutatingFunctions.some(fn => line.includes(`public.${fn}`)) && /\bauthenticated\b/i.test(line)) },
  { name: 'no destructive data operations', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql) },
  { name: 'no pre-stable hypercare records inserted', passed: !/\binsert\s+into\s+public\.(production_hypercare_periods|production_hypercare_issues|production_operating_cadence_events|production_adoption_feedback)[\s\S]{0,500}'(stable|completed|resolved|closed|adopted)'/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = { patch: '53', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed, tables, views, functions };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
