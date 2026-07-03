import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch37');
const migrationPath = 'supabase/migrations/098_patch37_audit_ovr_clinical_governance_engine.sql';
const apiPath = 'src/lib/clinicalGovernanceApi.ts';
const pagePath = 'src/pages/ClinicalGovernanceCenter.tsx';
const appPath = 'src/App.tsx';
const runtimeSecurityPath = 'release/v700/runtime-security-bridge-audit.json';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function runNode(script) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

const migration = await read(migrationPath);
const api = await read(apiPath);
const page = await read(pagePath);
const app = await read(appPath);
const packageJson = JSON.parse(await read('package.json'));
const findings = [];

const runtimeRun = runNode('v700-runtime-security-bridge-audit.mjs');
if (runtimeRun.status !== 0) {
  findings.push(`v700-runtime-security-bridge-audit.mjs failed: ${runtimeRun.stderr || runtimeRun.stdout}`);
}
const runtimeSecurity = JSON.parse(await read(runtimeSecurityPath));

const functions = [
  'patch37_service_role_required',
  'patch37_actor_has_clinical_governance_authority',
  'record_clinical_governance_event',
  'create_audit_execution_engagement',
  'start_audit_execution_engagement',
  'close_audit_execution_engagement',
  'create_audit_execution_program',
  'create_audit_execution_test_step',
  'update_audit_execution_test_step_status',
  'create_audit_execution_sample',
  'record_audit_execution_result',
  'create_audit_execution_finding',
  'link_audit_finding_to_capa',
  'link_audit_finding_to_evidence_bridge',
  'signoff_audit_execution_engagement',
  'reject_audit_execution_signoff',
  'reopen_audit_execution_engagement',
  'create_ovr_rca_case',
  'update_ovr_rca_status',
  'close_ovr_rca_case',
  'link_ovr_to_capa_evidence_or_clause',
  'escalate_clinical_governance_item',
  'acknowledge_clinical_governance_escalation',
  'resolve_clinical_governance_escalation',
  'get_clinical_governance_summary',
  'get_audit_execution_summary',
];

for (const fn of functions) {
  const marker = `function public.${fn}`;
  const start = migration.indexOf(marker);
  const slice = start >= 0 ? migration.slice(start, start + 4200) : '';
  if (start < 0) findings.push(`${fn} is missing from migration`);
  if (!slice.includes('security definer')) findings.push(`${fn} is not security definer`);
  if (!slice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute privileges are not revoked`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) {
    findings.push(`${fn} is not service-role only`);
  }
}

for (const view of [
  'v_patch37_audit_engagement_register',
  'v_patch37_audit_test_step_queue',
  'v_patch37_audit_sample_result_register',
  'v_patch37_audit_finding_register',
  'v_patch37_audit_findings_requiring_capa_or_evidence',
  'v_patch37_audit_signoff_queue',
  'v_patch37_ovr_rca_case_register',
  'v_patch37_ovr_capa_evidence_bridge',
  'v_patch37_clinical_governance_escalation_register',
  'v_patch37_overdue_audit_ovr_governance_items',
  'v_patch37_department_clinical_governance_workload',
  'v_patch37_executive_clinical_governance_summary',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
  if (!api.includes(view)) findings.push(`${view} is not referenced by clinicalGovernanceApi.ts`);
}

for (const eventType of [
  'audit_engagement_created',
  'audit_engagement_started',
  'audit_engagement_closed',
  'audit_program_created',
  'audit_test_step_created',
  'audit_test_step_status_updated',
  'audit_sample_created',
  'audit_result_recorded',
  'audit_finding_created',
  'audit_finding_linked_to_capa',
  'audit_finding_linked_to_evidence_bridge',
  'audit_engagement_signed_off',
  'audit_signoff_rejected',
  'audit_engagement_reopened',
  'ovr_rca_case_created',
  'ovr_rca_status_updated',
  'ovr_rca_case_closed',
  'ovr_link_created',
  'clinical_governance_item_escalated',
  'clinical_governance_escalation_acknowledged',
  'clinical_governance_escalation_resolved',
  'clinical_governance_summary_viewed',
  'audit_execution_summary_viewed',
]) {
  if (!migration.includes(`'${eventType}'`)) findings.push(`${eventType} event logging marker is missing`);
}

for (const rpc of functions.filter(fn => !fn.startsWith('patch37_') && fn !== 'record_clinical_governance_event')) {
  if (!api.includes(`'${rpc}'`)) findings.push(`${rpc} is not wrapped by clinicalGovernanceApi.ts`);
}

for (const section of [
  'Audit engagement register',
  'Audit test step queue',
  'Audit findings',
  'Findings requiring CAPA or evidence',
  'Audit signoff queue',
  'OVR RCA cases',
  'OVR-CAPA-evidence bridge',
  'Clinical governance escalations',
  'Overdue audit/OVR governance items',
  'Department clinical governance workload',
]) {
  if (!page.includes(section)) findings.push(`${section} section is missing from ClinicalGovernanceCenter`);
}

if (!app.includes("import { ClinicalGovernanceCenter } from './pages/ClinicalGovernanceCenter';")) {
  findings.push('ClinicalGovernanceCenter import is missing from App.tsx');
}
if (!app.includes("id: 'clinicalGovernance'") || !app.includes('<ClinicalGovernanceCenter />')) {
  findings.push('Clinical Governance tab integration is missing from App.tsx');
}

if (packageJson.scripts['patch37:schema-proof'] !== 'node scripts/patch37-clinical-governance-schema-proof.mjs') {
  findings.push('patch37:schema-proof package script is missing or incorrect');
}
if (packageJson.scripts['patch37:workflow-proof'] !== 'node scripts/patch37-clinical-governance-workflow-proof.mjs') {
  findings.push('patch37:workflow-proof package script is missing or incorrect');
}
if (packageJson.scripts['patch37:all'] !== 'npm run typecheck && npm run build && npm run patch37:schema-proof && npm run patch37:workflow-proof && npm run v700:runtime-security') {
  findings.push('patch37:all package script is missing or incorrect');
}

for (const [file, source] of [
  [migrationPath, migration],
  [apiPath, api],
  [pagePath, page],
  [appPath, app],
]) {
  if (/\b(fake|demo|fallback record|mock record)\b/i.test(source)) {
    findings.push(`Non-live record wording found in ${file}`);
  }
  if (/^(<<<<<<<|=======|>>>>>>>)$/m.test(source)) {
    findings.push(`Conflict marker found in ${file}`);
  }
}

if (/supabase\.rpc\s*\(/.test(api)) {
  findings.push('clinicalGovernanceApi.ts uses direct browser RPC instead of the authenticated bridge');
}
if (/service[_-]?role/i.test(api) || /service[_-]?role/i.test(page)) {
  findings.push('Service-role wording or exposure found in frontend Patch 37 files');
}

if (Number(runtimeSecurity.service_role_only_rpc_called_by_frontend ?? 999) !== 0) {
  findings.push(`service_role_only_rpc_called_by_frontend is ${runtimeSecurity.service_role_only_rpc_called_by_frontend}`);
}
if (Number(runtimeSecurity.remaining_broad_security_definer_execute_grants ?? 999) !== 0) {
  findings.push(`remaining_broad_security_definer_execute_grants is ${runtimeSecurity.remaining_broad_security_definer_execute_grants}`);
}

const report = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  api_path: apiPath,
  page_path: pagePath,
  runtime_security_path: runtimeSecurityPath,
  required_function_count: functions.length,
  runtime_security_status: runtimeSecurity.status,
  remaining_broad_security_definer_execute_grants: runtimeSecurity.remaining_broad_security_definer_execute_grants,
  service_role_only_rpc_called_by_frontend: runtimeSecurity.service_role_only_rpc_called_by_frontend,
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch37-workflow-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 37 clinical governance workflow proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 37 clinical governance workflow proof passed.');
}
