import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/111_patch52_pilot_closure_remediation_golive_decision.sql');
const outDir = path.join(root, 'release/patch52');
const outPath = path.join(outDir, 'patch52-schema-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();
const grantExecuteLines = sql.split(/\r?\n/).filter(line => /^\s*grant\s+execute\s+on\s+function/i.test(line));

const tables = ['pilot_closure_reviews', 'pilot_remediation_actions', 'pilot_accepted_limitations', 'production_golive_decisions', 'pilot_closure_events'];
const views = [
  'v_patch52_pilot_closure_review_register',
  'v_patch52_pilot_remediation_action_register',
  'v_patch52_overdue_remediation_action_register',
  'v_patch52_open_high_critical_remediation_register',
  'v_patch52_accepted_limitation_register',
  'v_patch52_expiring_limitation_register',
  'v_patch52_production_golive_decision_register',
  'v_patch52_missing_golive_decision_register',
  'v_patch52_pilot_closure_blocker_register',
  'v_patch52_pilot_closure_summary',
  'v_patch52_production_readiness_golive_decision_overlay',
];
const functions = [
  'record_pilot_closure_event',
  'create_pilot_closure_review',
  'update_pilot_closure_review_status',
  'create_pilot_remediation_action',
  'update_pilot_remediation_action_status',
  'create_pilot_accepted_limitation',
  'update_pilot_accepted_limitation_status',
  'create_production_golive_decision',
  'update_production_golive_decision_status',
  'get_pilot_closure_summary',
  'get_production_readiness_golive_decision_overlay',
];
const mutatingFunctions = functions.filter(fn => !fn.startsWith('get_'));

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...tables.map(table => ({ name: `table exists: ${table}`, passed: lower.includes(`create table if not exists public.${table}`) })),
  ...tables.map(table => ({ name: `RLS enabled: ${table}`, passed: lower.includes(`alter table public.${table} enable row level security`) })),
  { name: 'read policies exist', passed: ['patch52_closure_reviews_read', 'patch52_remediation_read', 'patch52_limitations_read', 'patch52_golive_read', 'patch52_events_read'].every(token => lower.includes(token)) },
  { name: 'write policies exist', passed: ['patch52_closure_reviews_write', 'patch52_remediation_write', 'patch52_limitations_write', 'patch52_golive_write', 'patch52_events_write'].every(token => lower.includes(token)) },
  ...views.map(view => ({ name: `view exists: ${view}`, passed: lower.includes(`view public.${view}`) })),
  ...views.map(view => {
    const alterPattern = new RegExp(`alter\\s+view\\s+if\\s+exists\\s+public\\.${view}\\s+set\\s*\\([^)]*security_invoker\\s*=\\s*true`, 'i');
    return { name: `explicit security_invoker view: ${view}`, passed: alterPattern.test(sql) };
  }),
  ...functions.map(fn => ({ name: `function exists: ${fn}`, passed: lower.includes(`function public.${fn}`) })),
  { name: 'mutating functions are service-role-gated', passed: lower.includes('patch52_service_role_required') && (sql.match(/perform public\.patch52_service_role_required\(\)/g) ?? []).length >= mutatingFunctions.length },
  { name: 'no broad execute grant for mutating functions', passed: !grantExecuteLines.some(line => mutatingFunctions.some(fn => line.includes(`public.${fn}`)) && /\bauthenticated\b/i.test(line)) },
  { name: 'no destructive data operations', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql) },
  { name: 'no pre-approved closure or go-live records inserted', passed: !/\binsert\s+into\s+public\.(pilot_closure_reviews|pilot_remediation_actions|pilot_accepted_limitations|production_golive_decisions)[\s\S]{0,500}'(approved|approved_for_golive|approved_with_limitations|completed|accepted)'/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = { patch: '52', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed, tables, views, functions };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
