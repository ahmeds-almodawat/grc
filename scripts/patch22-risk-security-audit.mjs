import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'patch22');
const findings = [];

function read(rel) {
  const filePath = path.join(root, rel);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function addCheck(name, passed, severity = 'high', detail = '') {
  findings.push({ name, passed: Boolean(passed), severity, detail });
}

function scanFiles(dir, matcher = () => true) {
  const start = path.join(root, dir);
  if (!fs.existsSync(start)) return [];
  const files = [];
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(entry.name)) stack.push(full);
      } else if (matcher(full)) {
        files.push(full);
      }
    }
  }
  return files;
}

const migration = read('supabase/migrations/084_patch22_risk_workflow_hardening.sql');
const bridge = read('supabase/functions/privileged-action/index.ts');
const grcApi = read('src/lib/grcApi.ts');
const risksPage = read('src/pages/Risks.tsx');

const destructivePatterns = [
  /drop\s+table/i,
  /truncate\s+/i,
  /delete\s+from\s+public\.risks/i,
  /alter\s+table\s+public\.risks\s+disable\s+row\s+level\s+security/i,
  /drop\s+column/i,
];
for (const pattern of destructivePatterns) {
  addCheck(`migration avoids destructive pattern ${pattern}`, !pattern.test(migration), 'critical');
}

for (const table of ['risk_kri_indicators', 'risk_reassessment_history', 'risk_workflow_events']) {
  addCheck(`${table} has RLS enabled`, migration.includes(`alter table public.${table} enable row level security`), 'critical');
  addCheck(`${table} has read policy`, migration.includes(`${table}_read`), 'critical');
}

addCheck('risk KRI write is RLS constrained', migration.includes('risk_kri_indicators_write') && migration.includes('owner_id = auth.uid() or public.can_manage_grc()'), 'critical');
addCheck('reassessment history direct writes are not granted to authenticated', !/grant\s+insert\s+on\s+public\.risk_reassessment_history\s+to\s+authenticated/i.test(migration), 'critical');
addCheck('workflow event direct writes are not granted to authenticated', !/grant\s+insert\s+on\s+public\.risk_workflow_events\s+to\s+authenticated/i.test(migration), 'critical');

const views = [
  'v_patch22_risk_workflow_queue',
  'v_patch22_risk_appetite_breaches',
  'v_patch22_risk_treatment_queue',
  'v_patch22_risk_kri_alerts',
  'v_patch22_executive_risk_escalations',
  'v_patch22_risk_closure_blockers',
];
for (const view of views) {
  addCheck(`${view} is SECURITY INVOKER`, migration.includes(`alter view public.${view} set (security_invoker = true)`), 'critical');
  addCheck(`${view} grants select only to authenticated`, migration.includes(`grant select on public.${view} to authenticated`), 'high');
}

addCheck('workflow bridge is SECURITY DEFINER', /create or replace function\s+public\.patch22_risk_workflow_bridge[\s\S]+?security definer/i.test(migration), 'critical');
addCheck('workflow bridge sets search_path', /public\.patch22_risk_workflow_bridge[\s\S]+?set search_path = public, pg_temp/i.test(migration), 'critical');
addCheck('workflow bridge requires service role', migration.includes('PATCH22_RISK_SERVICE_ROLE_REQUIRED'), 'critical');
addCheck('workflow bridge revoke blocks public anon authenticated', migration.includes('revoke all on function public.patch22_risk_workflow_bridge(uuid, text, jsonb) from public, anon, authenticated'), 'critical');
addCheck('workflow bridge execute is service-role only', migration.includes('grant execute on function public.patch22_risk_workflow_bridge(uuid, text, jsonb) to service_role'), 'critical');
addCheck('write-event helper is service-role only', migration.includes('grant execute on function public.patch22_write_risk_event(uuid, uuid, text, text, text, text, uuid) to service_role'), 'critical');
addCheck('bridge validates active actor', migration.includes('PATCH22_RISK_ACTIVE_ACTOR_REQUIRED'), 'critical');
addCheck('bridge validates organization scope', migration.includes('PATCH22_RISK_CROSS_ORGANIZATION_DENIED'), 'critical');
addCheck('bridge validates authorized roles or owners', migration.includes('PATCH22_RISK_NOT_AUTHORIZED') && migration.includes('v_can_manage or v_is_owner'), 'critical');
addCheck('closure approval uses blocker view', migration.includes('from public.v_patch22_risk_closure_blockers'), 'critical');
addCheck('acceptance approval requires authorized role', migration.includes('PATCH22_RISK_ACCEPTANCE_APPROVER_REQUIRED'), 'critical');
addCheck('closure approval requires authorized role', migration.includes('PATCH22_RISK_CLOSURE_APPROVER_REQUIRED'), 'critical');

addCheck('edge bridge contains Patch 22 action allow-list', bridge.includes('patch22RiskActions'), 'critical');
addCheck('edge bridge calls RPC with service client', bridge.includes("serviceClient.rpc('patch22_risk_workflow_bridge'"), 'critical');
addCheck('edge bridge passes authenticated actor id', bridge.includes('p_actor_id: userData.user.id'), 'critical');
addCheck('edge bridge maps authorization failures to 403', bridge.includes('authorizationFailure') && bridge.includes('403'), 'high');
addCheck('frontend calls privileged action bridge', grcApi.includes('invokePrivilegedAction<RiskWorkflowActionResult>'), 'critical');
addCheck('frontend does not call Patch 22 RPC directly', !grcApi.includes(".rpc('patch22_risk_workflow_bridge'") && !risksPage.includes(".rpc('patch22_risk_workflow_bridge'"), 'critical');

const srcFiles = scanFiles('src', (file) => /\.(ts|tsx|js|jsx)$/.test(file));
const directServiceRoleReferences = [];
for (const file of srcFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (/SUPABASE_SERVICE_ROLE_KEY|serviceRoleKey|service_role_key/i.test(text)) {
    directServiceRoleReferences.push(path.relative(root, file));
  }
}
addCheck('browser source has no service-role key usage', directServiceRoleReferences.length === 0, 'critical', directServiceRoleReferences.join(', '));

addCheck('migration does not grant delete on Patch 22 tables', !/grant\s+delete\s+on\s+public\.(risk_kri_indicators|risk_reassessment_history|risk_workflow_events)/i.test(migration), 'critical');
addCheck('migration does not add authenticated delete policies', !/for\s+delete\s+(to\s+authenticated)?/i.test(migration), 'critical');
addCheck('Patch 22 does not alter Patch 20 importer', !read('scripts/import-real-grc-pack.mjs').includes('Patch 22'), 'medium');

const failed = findings.filter((finding) => !finding.passed);
const critical = failed.filter((finding) => finding.severity === 'critical').length;
const high = failed.filter((finding) => finding.severity === 'high').length;
const medium = failed.filter((finding) => finding.severity === 'medium').length;
const status = critical || high ? 'failed' : 'passed';
const report = {
  generated_at: new Date().toISOString(),
  patch: 'Patch 22',
  status,
  summary: {
    critical,
    high,
    medium,
    total: findings.length,
    passed: findings.filter((finding) => finding.passed).length,
    failed: failed.length,
  },
  findings,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'risk-security-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('Patch 22 risk security audit complete.');
console.log(report.summary);
if (status !== 'passed') {
  process.exitCode = 1;
}
