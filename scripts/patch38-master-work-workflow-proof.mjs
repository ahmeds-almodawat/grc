import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch38');
const migrationPath = 'supabase/migrations/099_patch38_unified_work_queue_hospital_master_data.sql';
const runtimeSecurityPath = 'release/v700/runtime-security-bridge-audit.json';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function runNode(script) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

const migration = await read(migrationPath);
const runtimeRun = runNode('v700-runtime-security-bridge-audit.mjs');
const runtimeSecurity = JSON.parse(await read(runtimeSecurityPath));
const findings = [];

if (runtimeRun.status !== 0) findings.push(`v700-runtime-security-bridge-audit.mjs failed: ${runtimeRun.stderr || runtimeRun.stdout}`);

const functions = [
  'patch38_service_role_required',
  'patch38_actor_has_master_data_authority',
  'record_unified_work_queue_event',
  'create_hospital_location',
  'update_hospital_location_status',
  'create_hospital_service',
  'update_hospital_service_status',
  'create_hospital_clinical_area',
  'update_hospital_clinical_area_status',
  'create_hospital_committee',
  'update_hospital_committee_status',
  'create_hospital_job_title',
  'update_hospital_job_title_status',
  'create_hospital_quality_indicator',
  'update_hospital_quality_indicator_status',
  'create_hospital_ownership_mapping',
  'deactivate_hospital_ownership_mapping',
  'get_my_work_queue',
  'get_department_work_queue',
  'get_executive_workload_summary',
  'get_governance_operating_summary',
];

for (const fn of functions) {
  const marker = `function public.${fn}`;
  const start = migration.indexOf(marker);
  const slice = start >= 0 ? migration.slice(start, start + 3500) : '';
  if (start < 0) findings.push(`${fn} is missing`);
  if (!slice.includes('security definer')) findings.push(`${fn} is not security definer`);
  if (!slice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute privileges are not revoked`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) findings.push(`${fn} is not service-role only`);
}

for (const view of [
  'v_patch38_hospital_location_register',
  'v_patch38_hospital_service_register',
  'v_patch38_clinical_area_register',
  'v_patch38_committee_register',
  'v_patch38_job_title_register',
  'v_patch38_quality_indicator_register',
  'v_patch38_master_data_exception_register',
  'v_patch38_master_data_ownership_register',
  'v_patch38_unified_work_queue',
  'v_patch38_my_work_queue',
  'v_patch38_department_work_queue',
  'v_patch38_overdue_work_queue',
  'v_patch38_escalated_work_queue',
  'v_patch38_waiting_for_review_queue',
  'v_patch38_executive_workload_summary',
  'v_patch38_user_workload_summary',
  'v_patch38_department_workload_summary',
  'v_patch38_governance_operating_summary',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) findings.push(`${view} is missing security_invoker`);
}

for (const marker of [
  'hospital_location_created',
  'hospital_location_status_updated',
  'hospital_service_created',
  'hospital_service_status_updated',
  'hospital_clinical_area_created',
  'hospital_clinical_area_status_updated',
  'hospital_committee_created',
  'hospital_committee_status_updated',
  'hospital_job_title_created',
  'hospital_job_title_status_updated',
  'hospital_quality_indicator_created',
  'hospital_quality_indicator_status_updated',
  'hospital_ownership_mapping_created',
  'hospital_ownership_mapping_deactivated',
  'my_work_queue_viewed',
  'department_work_queue_viewed',
  'executive_workload_summary_viewed',
  'governance_operating_summary_viewed',
]) {
  if (!migration.includes(`'${marker}'`)) findings.push(`${marker} event logging marker is missing`);
}

if (Number(runtimeSecurity.service_role_only_rpc_called_by_frontend ?? 999) !== 0) findings.push(`service_role_only_rpc_called_by_frontend is ${runtimeSecurity.service_role_only_rpc_called_by_frontend}`);
if (Number(runtimeSecurity.remaining_broad_security_definer_execute_grants ?? 999) !== 0) findings.push(`remaining_broad_security_definer_execute_grants is ${runtimeSecurity.remaining_broad_security_definer_execute_grants}`);
if (/\b(fake|demo|fallback record|mock record)\b/i.test(migration)) findings.push('Non-live record wording found in Patch 38 migration');
if (/^(<<<<<<<|=======|>>>>>>>)$/m.test(migration)) findings.push('Conflict marker found in Patch 38 migration');

const report = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  runtime_security_status: runtimeSecurity.status,
  remaining_broad_security_definer_execute_grants: runtimeSecurity.remaining_broad_security_definer_execute_grants,
  service_role_only_rpc_called_by_frontend: runtimeSecurity.service_role_only_rpc_called_by_frontend,
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch38-workflow-proof.json'), `${JSON.stringify(report, null, 2)}\n`);
if (findings.length) {
  console.error(`Patch 38 workflow proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 38 workflow proof passed.');
}
