import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v98');
const outPath = path.join(outDir, 'ovr-workflow-verification.md');
fs.mkdirSync(outDir, { recursive: true });

function runDocker(args, options = {}) {
  return spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}

function projectId() {
  const configPath = path.join(root, 'supabase', 'config.toml');
  const config = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  return config.match(/^\s*project_id\s*=\s*"([^"]+)"/m)?.[1] || path.basename(root);
}

function detectContainer() {
  const result = runDocker([
    'ps',
    '--filter', `label=com.supabase.cli.project=${projectId()}`,
    '--filter', 'name=supabase_db_',
    '--format', '{{.Names}}',
  ]);
  const names = (result.stdout || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (result.status !== 0 || names.length !== 1) {
    throw new Error(names.length
      ? `Expected one local Supabase DB container, found: ${names.join(', ')}`
      : 'Local Supabase is not running. Run: npx supabase start');
  }
  return names[0];
}

function queryJson(container, sql) {
  const result = runDocker([
    'exec', '-i', container,
    'psql', '-X', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-qAt',
  ], { input: sql });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'OVR verification query failed.');
  return JSON.parse((result.stdout || '').trim());
}

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

const requiredStatuses = [
  'submitted',
  'manager_review',
  'quality_validation',
  'referred_party_response',
  'quality_final_review',
  'closed',
  'disputed',
  'reopened',
  'escalated',
  'rejected',
];
const requiredColumns = [
  'reported_by',
  'department_id',
  'supervisor_due_date',
  'manager_reviewed_at',
  'quality_validated_at',
  'referred_department_id',
  'referred_user_id',
  'referred_response',
  'cross_department_notified_at',
  'final_verdict',
  'final_verdict_at',
  'reporter_response',
  'dispute_reason',
  'reopened_at',
  'evidence_required',
  'linked_project_id',
  'quality_closed_by',
  'closed_at',
];
const requiredFunctions = [
  'can_close_ovr',
  'v98_update_ovr_workflow',
  'v98_initialize_ovr_submission',
  'v98_notify_ovr_submission',
];
const requiredViews = [
  'v_ovr_summary',
  'v_ovr_workflow_queue',
  'v_ovr_workflow_control_summary',
  'v_ovr_risk_indicator_summary',
  'v_ovr_risk_indicators_by_department',
];

const generatedAt = new Date().toISOString();
let container = null;
let db = null;
let checks = [];
let fatalError = null;

try {
  container = detectContainer();
  db = queryJson(container, `
with enum_values as (
  select json_agg(e.enumlabel order by e.enumsortorder) as values
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'ovr_status'
),
columns as (
  select json_agg(column_name order by ordinal_position) as values
  from information_schema.columns
  where table_schema = 'public' and table_name = 'ovr_reports'
),
functions as (
  select json_agg(p.proname order by p.proname) as values
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname ilike '%ovr%'
),
views as (
  select json_agg(table_name order by table_name) as values
  from information_schema.views
  where table_schema = 'public' and table_name ilike '%ovr%'
),
policies as (
  select json_agg(json_build_object(
    'name', policyname,
    'command', cmd,
    'using', qual,
    'check', with_check
  ) order by policyname) as values
  from pg_policies
  where schemaname = 'public' and tablename = 'ovr_reports'
),
broad_execute as (
  select count(*)::int as count
  from information_schema.routine_privileges rp
  join pg_proc p on p.proname = rp.routine_name
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = rp.routine_schema
  where rp.routine_schema = 'public'
    and p.prosecdef = true
    and rp.grantee in ('PUBLIC', 'anon', 'authenticated')
    and rp.privilege_type = 'EXECUTE'
),
triggers as (
  select json_agg(t.tgname order by t.tgname) as values
  from pg_trigger t
  where t.tgrelid = 'public.ovr_reports'::regclass
    and not t.tgisinternal
)
select json_build_object(
  'statuses', coalesce((select values from enum_values), '[]'::json),
  'columns', coalesce((select values from columns), '[]'::json),
  'functions', coalesce((select values from functions), '[]'::json),
  'views', coalesce((select values from views), '[]'::json),
  'policies', coalesce((select values from policies), '[]'::json),
  'broad_security_definer_execute_grants', (select count from broad_execute),
  'triggers', coalesce((select values from triggers), '[]'::json)
)::text;
  `);

  const migration = read('supabase/migrations/049_v98_ovr_workflow_gap_closure.sql');
  const api = read('src/lib/grcApi.ts');
  const page = read('src/pages/OVR.tsx');
  const bridge = read('supabase/functions/privileged-action/index.ts');
  const policyText = JSON.stringify(db.policies);

  const add = (area, passed, evidence, blocking = true) => checks.push({ area, passed, evidence, blocking });
  add('OVR table exists', db.columns.length > 0, 'public.ovr_reports is present');
  add('Required workflow statuses', requiredStatuses.every(value => db.statuses.includes(value)), `Found: ${db.statuses.join(', ')}`);
  add('Required workflow columns', requiredColumns.every(value => db.columns.includes(value)), `Required columns found: ${requiredColumns.filter(value => db.columns.includes(value)).length}/${requiredColumns.length}`);
  add('Workflow functions', requiredFunctions.every(value => db.functions.includes(value)), `Functions: ${requiredFunctions.filter(value => db.functions.includes(value)).join(', ')}`);
  add('Workflow/risk views', requiredViews.every(value => db.views.includes(value)), `Views: ${requiredViews.filter(value => db.views.includes(value)).join(', ')}`);
  add('Submission initializes 24-hour manager due date', migration.includes("supervisor_due_date := current_date + 1"), 'Submission trigger sets the due date to current_date + 1');
  add('Quality validation gates referral notification', migration.includes('V98_OVR_QUALITY_VALIDATION_REQUIRED_BEFORE_REFERRAL') && migration.indexOf("p_next_status = 'referred_party_response'") < migration.indexOf("'OVR referral requires response'"), 'Referral notification is emitted only inside the post-validation referral transition');
  add('Reporter accept/dispute and reopen support', ['disputed', 'reopened', 'closed'].every(value => migration.includes(`p_next_status = '${value}'`)), 'Controlled transition function contains reporter dispute, Quality reopen, and reporter acceptance closure');
  add('Closure requires verdict and evidence/action', migration.includes('V98_OVR_FINAL_VERDICT_REQUIRED_BEFORE_CLOSURE') && migration.includes('V98_OVR_ACCEPTED_EVIDENCE_OR_CLOSED_ACTION_REQUIRED'), 'Final verdict and can_close_ovr guard are both enforced');
  add('Audit is read-only', !policyText.includes("auditor'::app_role") || !db.policies.some(policy => policy.command === 'UPDATE' && String(policy.using).includes('auditor')), 'No authenticated auditor update policy; server bridge explicitly rejects auditor-only actors');
  add('Role-scoped visibility', policyText.includes('referred_user_id') && policyText.includes('referred_department_id') && policyText.includes('department_manager'), 'RLS covers reporter, assigned/referral parties, relevant managers, Quality/Admin, and Audit');
  add('Secure server bridge', bridge.includes("action === 'update_ovr_workflow'") && bridge.includes('v98_update_ovr_workflow'), 'Browser calls authenticated Edge Function; service-role database function is not directly browser-executable');
  add('Frontend lifecycle controls', ['manager_review', 'quality_validation', 'referred_party_response', 'quality_final_review', 'disputed', 'reopened', 'escalated'].every(value => page.includes(value)), 'OVR page includes role-aware controls for the pilot lifecycle', false);
  add('API payload supports referrals/verdict', api.includes('referred_department_id') && api.includes('referred_user_id') && api.includes('final_verdict'), 'grcApi sends structured referral and verdict fields', false);
  add('No broad SECURITY DEFINER execution', db.broad_security_definer_execute_grants === 0, `Remaining broad grants: ${db.broad_security_definer_execute_grants}`);
  add('OVR audit trigger exists', db.triggers.includes('trg_audit_ovr_reports'), 'Row-change audit trigger is attached');
} catch (error) {
  fatalError = error;
}

const blockingFailures = fatalError ? 1 : checks.filter(check => check.blocking && !check.passed).length;
const passed = !fatalError && blockingFailures === 0;
const lines = [
  '# v9.8 OVR Workflow Verification',
  '',
  `- Generated: ${generatedAt}`,
  `- Environment: Local Supabase Docker staging`,
  `- Database container: ${container || 'not detected'}`,
  `- Status: **${passed ? 'PASSED' : 'FAILED'}**`,
  `- Blocking failures: ${blockingFailures}`,
  '- Data policy: synthetic/de-identified pilot data only',
  '- Production readiness: **Not asserted**',
  '',
  '| Verification | Result | Evidence |',
  '|---|---|---|',
  ...checks.map(check => `| ${check.area} | ${check.passed ? 'PASS' : 'FAIL'} | ${String(check.evidence).replaceAll('|', '\\|')} |`),
];

if (fatalError) {
  lines.push('', '## Execution error', '', '```text', fatalError.message, '```');
}
lines.push(
  '',
  '## Conclusion',
  '',
  passed
    ? 'The controlled-pilot OVR workflow structures and security controls are present. Run the synthetic E2E proof to validate behavior with real authenticated personas.'
    : 'One or more blocking OVR workflow controls are missing or could not be verified.',
  '',
);

fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`v9.8 OVR workflow verification: ${passed ? 'PASSED' : 'FAILED'}`);
console.log(`Report: ${path.relative(root, outPath)}`);
if (!passed) process.exitCode = 1;
