import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/110_patch51_live_pilot_workflow_execution_evidence.sql');
const outDir = path.join(root, 'release/patch51');
const outPath = path.join(outDir, 'patch51-schema-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();
const grantExecuteLines = sql.split(/\r?\n/).filter(line => /^\s*grant\s+execute\s+on\s+function/i.test(line));

const tables = ['live_pilot_workflow_runs', 'live_pilot_workflow_steps', 'live_pilot_evidence_captures', 'live_pilot_execution_issues', 'live_pilot_workflow_events'];
const views = [
  'v_patch51_live_pilot_workflow_run_register',
  'v_patch51_live_pilot_workflow_step_register',
  'v_patch51_live_pilot_evidence_capture_register',
  'v_patch51_live_pilot_execution_issue_register',
  'v_patch51_pending_workflow_walkthrough_register',
  'v_patch51_failed_workflow_walkthrough_register',
  'v_patch51_missing_workflow_evidence_register',
  'v_patch51_workflow_execution_blocker_register',
  'v_patch51_live_pilot_workflow_summary',
  'v_patch51_production_readiness_live_pilot_execution_overlay',
];
const functions = [
  'record_live_pilot_workflow_event',
  'create_live_pilot_workflow_run',
  'update_live_pilot_workflow_run_status',
  'create_live_pilot_workflow_step',
  'update_live_pilot_workflow_step_status',
  'create_live_pilot_evidence_capture',
  'update_live_pilot_evidence_capture_status',
  'create_live_pilot_execution_issue',
  'update_live_pilot_execution_issue_status',
  'get_live_pilot_workflow_summary',
  'get_production_readiness_live_pilot_execution_overlay',
];
const mutatingFunctions = functions.filter(fn => !fn.startsWith('get_'));

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...tables.map(table => ({ name: `table exists: ${table}`, passed: lower.includes(`create table if not exists public.${table}`) })),
  ...tables.map(table => ({ name: `RLS enabled: ${table}`, passed: lower.includes(`alter table public.${table} enable row level security`) })),
  { name: 'read policies exist', passed: ['patch51_runs_read', 'patch51_steps_read', 'patch51_evidence_read', 'patch51_issues_read', 'patch51_events_read'].every(token => lower.includes(token)) },
  { name: 'write policies exist', passed: ['patch51_runs_write', 'patch51_steps_write', 'patch51_evidence_write', 'patch51_issues_write', 'patch51_events_write'].every(token => lower.includes(token)) },
  ...views.map(view => ({ name: `view exists: ${view}`, passed: lower.includes(`view public.${view}`) })),
  ...views.map(view => {
    const alterPattern = new RegExp(`alter\\s+view\\s+if\\s+exists\\s+public\\.${view}\\s+set\\s*\\([^)]*security_invoker\\s*=\\s*true`, 'i');
    return { name: `explicit security_invoker view: ${view}`, passed: alterPattern.test(sql) };
  }),
  ...functions.map(fn => ({ name: `function exists: ${fn}`, passed: lower.includes(`function public.${fn}`) })),
  { name: 'mutating functions are service-role-gated', passed: lower.includes('patch51_service_role_required') && (sql.match(/perform public\.patch51_service_role_required\(\)/g) ?? []).length >= mutatingFunctions.length },
  { name: 'no broad execute grant for mutating functions', passed: !grantExecuteLines.some(line => mutatingFunctions.some(fn => line.includes(`public.${fn}`)) && /\bauthenticated\b/i.test(line)) },
  { name: 'no destructive data operations', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(sql) },
  { name: 'no fake or seeded workflow records', passed: !/\b(fake|demo|mock|sample|seed)\b/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = { patch: '51', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed, tables, views, functions };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
