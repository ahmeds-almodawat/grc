import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch35');
const migrationPath = 'supabase/migrations/097_patch35_accreditation_clause_owner_workflow.sql';
const runtimeSecurityPath = 'release/v700/runtime-security-bridge-audit.json';

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

const runtimeRun = runNode('v700-runtime-security-bridge-audit.mjs');
const migration = await readFile(path.join(root, migrationPath), 'utf8');
const runtimeSecurity = JSON.parse(await readFile(path.join(root, runtimeSecurityPath), 'utf8'));
const findings = [];

if (runtimeRun.status !== 0) {
  findings.push(`v700-runtime-security-bridge-audit.mjs failed: ${runtimeRun.stderr || runtimeRun.stdout}`);
}

const serviceRoleFunctions = [
  'patch35_service_role_required',
  'patch35_actor_has_accreditation_workflow_authority',
  'record_accreditation_workflow_event',
  'assign_accreditation_clause_owner',
  'transfer_accreditation_clause_owner',
  'create_accreditation_review_cycle',
  'start_accreditation_review_cycle',
  'complete_accreditation_review_cycle',
  'create_accreditation_clause_review_task',
  'submit_accreditation_clause_task',
  'approve_accreditation_clause_task',
  'reject_accreditation_clause_task',
  'reopen_accreditation_clause_task',
  'signoff_accreditation_clause',
  'reject_accreditation_clause_signoff',
  'escalate_accreditation_clause_task',
  'acknowledge_accreditation_escalation',
  'resolve_accreditation_escalation',
  'get_accreditation_operations_dashboard',
  'get_clause_owner_workload',
];

for (const fn of serviceRoleFunctions) {
  const marker = `function public.${fn}`;
  const start = migration.indexOf(marker);
  const slice = start >= 0 ? migration.slice(start, start + 5200) : '';
  if (start < 0) findings.push(`${fn} is missing`);
  if (!slice.includes('security definer')) findings.push(`${fn} is not security definer`);
  if (!slice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute privileges are not revoked`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) {
    findings.push(`${fn} is not service-role only`);
  }
}

for (const view of [
  'v_patch35_clause_owner_register',
  'v_patch35_active_review_cycles',
  'v_patch35_clause_owner_task_queue',
  'v_patch35_overdue_clause_tasks',
  'v_patch35_clause_reviewer_signoff_queue',
  'v_patch35_department_accreditation_workload',
  'v_patch35_clause_blocker_summary',
  'v_patch35_clause_signoff_register',
  'v_patch35_escalation_register',
  'v_patch35_accreditation_operations_dashboard',
  'v_patch35_executive_accreditation_workflow_summary',
  'v_patch35_ready_for_survey_review_queue',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const eventType of [
  'owner_assigned',
  'owner_transferred',
  'review_cycle_created',
  'review_cycle_started',
  'review_cycle_completed',
  'task_created',
  'task_submitted',
  'task_approved',
  'task_rejected',
  'task_reopened',
  'clause_signed_off',
  'clause_signoff_rejected',
  'task_escalated',
  'escalation_acknowledged',
  'escalation_resolved',
]) {
  if (!migration.includes(`'${eventType}'`)) findings.push(`${eventType} event logging marker is missing`);
}

for (const marker of [
  'PATCH35_SERVICE_ROLE_REQUIRED',
  'PATCH35_ACCREDITATION_WORKFLOW_AUTHORITY_REQUIRED',
  'PATCH35_REVIEW_AUTHORITY_REQUIRED',
  'PATCH35_REJECTION_REASON_REQUIRED',
  'PATCH35_REOPEN_REASON_REQUIRED',
  'PATCH35_SIGNOFF_AUTHORITY_REQUIRED',
  'PATCH35_ESCALATION_REASON_REQUIRED',
  'public.v_patch33_clause_control_evidence_bridge',
  "linked_entity_type in ('sop','document','capa','training_program','training_assignment','risk','audit_finding')",
  "evidence_status in ('missing','pending_collection','pending_review','rejected','stale','expired')",
]) {
  if (!migration.includes(marker)) findings.push(`${marker} marker is missing`);
}

const changedFiles = [
  'supabase/migrations/097_patch35_accreditation_clause_owner_workflow.sql',
  'scripts/patch35-accreditation-workflow-schema-proof.mjs',
];

for (const file of changedFiles) {
  const source = await readFile(path.join(root, file), 'utf8');
  if (/\b(mock|demo|sample)\b/i.test(source)) {
    findings.push(`Non-live runtime data wording found in ${file}`);
  }
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
  runtime_security_path: runtimeSecurityPath,
  owner_assignment_statuses: ['active', 'inactive', 'transferred', 'suspended'],
  review_cycle_statuses: ['draft', 'active', 'completed', 'cancelled', 'archived'],
  task_statuses: ['open', 'in_progress', 'submitted', 'under_review', 'approved', 'rejected', 'overdue', 'reopened', 'escalated', 'waived', 'cancelled'],
  signoff_statuses: ['pending', 'signed_off', 'rejected', 'reopened', 'waived'],
  escalation_statuses: ['open', 'acknowledged', 'resolved', 'cancelled'],
  service_role_only_rpc_called_by_frontend: runtimeSecurity.service_role_only_rpc_called_by_frontend,
  remaining_broad_security_definer_execute_grants: runtimeSecurity.remaining_broad_security_definer_execute_grants,
  runtime_security_status: runtimeSecurity.status,
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch35-workflow-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 35 accreditation workflow proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 35 accreditation workflow proof passed.');
}
