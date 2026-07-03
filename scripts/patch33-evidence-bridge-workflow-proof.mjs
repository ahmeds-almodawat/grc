import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch33');
const migrationPath = 'supabase/migrations/096_patch33_evidence_bridge_live_operation.sql';
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
  'patch33_actor_has_evidence_bridge_authority',
  'patch33_actor_can_submit_request',
  'record_evidence_bridge_event',
  'create_evidence_bridge_link',
  'update_evidence_bridge_status',
  'create_evidence_collection_request',
  'submit_evidence_collection_request',
  'review_evidence_bridge_submission',
  'accept_evidence_bridge_submission',
  'reject_evidence_bridge_submission',
  'waive_evidence_collection_request',
  'reopen_evidence_collection_request',
  'mark_evidence_bridge_not_applicable',
  'refresh_evidence_freshness_status',
  'get_clause_evidence_bridge',
  'get_live_evidence_readiness_summary',
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
  'v_patch33_clause_control_evidence_bridge',
  'v_patch33_live_evidence_gap_register',
  'v_patch33_evidence_collection_queue',
  'v_patch33_overdue_evidence_requests',
  'v_patch33_stale_expired_evidence_register',
  'v_patch33_evidence_review_queue',
  'v_patch33_department_evidence_readiness',
  'v_patch33_clause_evidence_readiness',
  'v_patch33_capa_training_sop_evidence_dependencies',
  'v_patch33_accreditation_live_readiness_summary',
  'v_patch33_evidence_exception_register',
  'v_patch33_executive_evidence_bridge_summary',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const evidenceStatus of [
  'missing',
  'pending_collection',
  'pending_review',
  'accepted',
  'rejected',
  'stale',
  'expired',
  'not_applicable',
]) {
  if (!migration.includes(`'${evidenceStatus}'`)) findings.push(`${evidenceStatus} evidence status is missing`);
}

for (const requestStatus of [
  'open',
  'in_progress',
  'submitted',
  'under_review',
  'accepted',
  'rejected',
  'overdue',
  'cancelled',
  'waived',
]) {
  if (!migration.includes(`'${requestStatus}'`)) findings.push(`${requestStatus} request status is missing`);
}

for (const reviewStatus of ['pending_review', 'accepted', 'rejected', 'needs_rework', 'waived']) {
  if (!migration.includes(`'${reviewStatus}'`)) findings.push(`${reviewStatus} review status is missing`);
}

for (const freshnessStatus of ['current', 'due_soon', 'stale', 'expired', 'unknown']) {
  if (!migration.includes(`'${freshnessStatus}'`)) findings.push(`${freshnessStatus} freshness status is missing`);
}

for (const relationshipType of [
  'clause',
  'control',
  'evidence',
  'document',
  'sop',
  'capa',
  'risk',
  'audit_finding',
  'training_program',
  'training_assignment',
]) {
  if (!migration.includes(`'${relationshipType}'`)) findings.push(`${relationshipType} relationship type is missing`);
}

for (const marker of [
  'record_evidence_bridge_event',
  "'bridge_link_created'",
  "'bridge_status_updated'",
  "'collection_request_created'",
  "'collection_request_submitted'",
  "'submission_reviewed'",
  "'submission_accepted'",
  "'submission_rejected'",
  "'collection_request_waived'",
  "'collection_request_reopened'",
  "'bridge_marked_not_applicable'",
  "'freshness_refreshed'",
  'valid_until < current_date',
  "valid_until <= current_date + interval '30 days'",
  'PATCH33_SERVICE_ROLE_REQUIRED',
  'PATCH33_EVIDENCE_BRIDGE_AUTHORITY_REQUIRED',
  'PATCH33_REVIEW_AUTHORITY_REQUIRED',
  'PATCH33_REJECTION_REASON_REQUIRED',
  'PATCH33_WAIVER_REASON_REQUIRED',
  'PATCH33_REOPEN_REASON_REQUIRED',
  'PATCH33_NOT_APPLICABLE_REASON_REQUIRED',
]) {
  if (!migration.includes(marker)) findings.push(`${marker} marker is missing`);
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
  supported_relationship_types: [
    'clause',
    'control',
    'evidence',
    'document',
    'sop',
    'capa',
    'risk',
    'audit_finding',
    'training_program',
    'training_assignment',
  ],
  supported_evidence_statuses: [
    'missing',
    'pending_collection',
    'pending_review',
    'accepted',
    'rejected',
    'stale',
    'expired',
    'not_applicable',
  ],
  supported_request_statuses: [
    'open',
    'in_progress',
    'submitted',
    'under_review',
    'accepted',
    'rejected',
    'overdue',
    'cancelled',
    'waived',
  ],
  supported_review_statuses: ['pending_review', 'accepted', 'rejected', 'needs_rework', 'waived'],
  supported_freshness_statuses: ['current', 'due_soon', 'stale', 'expired', 'unknown'],
  service_role_only_rpc_called_by_frontend: runtimeSecurity.service_role_only_rpc_called_by_frontend,
  remaining_broad_security_definer_execute_grants: runtimeSecurity.remaining_broad_security_definer_execute_grants,
  runtime_security_status: runtimeSecurity.status,
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch33-workflow-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 33 evidence bridge workflow proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 33 evidence bridge workflow proof passed.');
}
