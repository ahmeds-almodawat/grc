import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch32');
const migrationPath = 'supabase/migrations/095_patch32_accreditation_traceability_matrix.sql';
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
  'patch32_actor_has_accreditation_authority',
  'record_accreditation_traceability_event',
  'create_accreditation_standard',
  'create_accreditation_clause',
  'link_accreditation_clause_entity',
  'unlink_accreditation_clause_entity',
  'assess_accreditation_clause',
  'mark_accreditation_clause_not_applicable',
  'reopen_accreditation_clause_assessment',
  'get_accreditation_clause_traceability',
  'get_accreditation_readiness_summary',
];

for (const fn of serviceRoleFunctions) {
  const marker = `function public.${fn}`;
  const start = migration.indexOf(marker);
  const slice = start >= 0 ? migration.slice(start, start + 5000) : '';
  if (start < 0) findings.push(`${fn} is missing`);
  if (!slice.includes('security definer')) findings.push(`${fn} is not security definer`);
  if (!slice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute privileges are not revoked`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) {
    findings.push(`${fn} is not service-role only`);
  }
}

for (const view of [
  'v_patch32_accreditation_clause_register',
  'v_patch32_clause_traceability_matrix',
  'v_patch32_clause_evidence_gap_summary',
  'v_patch32_clause_sop_document_gap_summary',
  'v_patch32_clause_capa_risk_audit_summary',
  'v_patch32_clause_training_readiness_summary',
  'v_patch32_department_accreditation_readiness',
  'v_patch32_accreditation_executive_summary',
  'v_patch32_accreditation_exception_register',
  'v_patch32_accreditation_review_queue',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const entityType of [
  'control',
  'sop',
  'document',
  'evidence',
  'capa',
  'risk',
  'audit_finding',
  'training_program',
  'training_assignment',
  'approval_authority',
  'policy',
]) {
  if (!migration.includes(`'${entityType}'`)) findings.push(`${entityType} link type is missing`);
}

for (const assessmentStatus of [
  'not_assessed',
  'ready',
  'partial_gap',
  'major_gap',
  'not_applicable',
  'pending_evidence',
  'pending_owner_review',
]) {
  if (!migration.includes(`'${assessmentStatus}'`)) findings.push(`${assessmentStatus} assessment status is missing`);
}

for (const marker of [
  'record_accreditation_traceability_event',
  "'standard_created'",
  "'clause_created'",
  "'entity_linked'",
  "'entity_unlinked'",
  "'clause_assessed'",
  "'marked_not_applicable'",
  "'assessment_reopened'",
  'PATCH32_SERVICE_ROLE_REQUIRED',
  'PATCH32_ACCREDITATION_AUTHORITY_REQUIRED',
  'PATCH32_UNLINK_REASON_REQUIRED',
  'PATCH32_NOT_APPLICABLE_REASON_REQUIRED',
  'PATCH32_REOPEN_REASON_REQUIRED',
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
  supported_link_types: [
    'control',
    'sop',
    'document',
    'evidence',
    'capa',
    'risk',
    'audit_finding',
    'training_program',
    'training_assignment',
    'approval_authority',
    'policy',
  ],
  supported_assessment_statuses: [
    'not_assessed',
    'ready',
    'partial_gap',
    'major_gap',
    'not_applicable',
    'pending_evidence',
    'pending_owner_review',
  ],
  service_role_only_rpc_called_by_frontend: runtimeSecurity.service_role_only_rpc_called_by_frontend,
  remaining_broad_security_definer_execute_grants: runtimeSecurity.remaining_broad_security_definer_execute_grants,
  runtime_security_status: runtimeSecurity.status,
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch32-traceability-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 32 accreditation traceability proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 32 accreditation traceability proof passed.');
}
