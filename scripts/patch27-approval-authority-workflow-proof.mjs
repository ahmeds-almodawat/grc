import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch27');
const migrationPath = 'supabase/migrations/090_patch27_approval_authority_matrix.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const migration = await read(migrationPath);
const findings = [];

const serviceRoleFunctions = [
  'patch27_write_authority_event',
  'create_approval_authority_rule',
  'request_workflow_approval',
  'record_approval_decision',
  'reject_approval_request',
  'return_approval_request_for_correction',
  'escalate_approval_request',
  'cancel_approval_request',
  'update_approval_authority_rule',
  'disable_approval_authority_rule',
  'create_approval_delegation',
  'revoke_approval_delegation',
  'override_approval_request_with_reason',
];

for (const fn of serviceRoleFunctions) {
  const marker = `function public.${fn}`;
  const start = migration.indexOf(marker);
  const slice = start >= 0 ? migration.slice(start, start + 4500) : '';
  if (start < 0) findings.push(`${fn} is missing`);
  if (!slice.includes('security definer')) findings.push(`${fn} is not security definer`);
  if (!slice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute grants are not revoked`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) {
    findings.push(`${fn} is not service-role only`);
  }
}

for (const fn of [
  'patch27_write_authority_event',
  'create_approval_authority_rule',
  'request_workflow_approval',
  'record_approval_decision',
  'escalate_approval_request',
  'cancel_approval_request',
  'update_approval_authority_rule',
  'disable_approval_authority_rule',
  'create_approval_delegation',
  'revoke_approval_delegation',
  'override_approval_request_with_reason',
]) {
  const start = migration.indexOf(`function public.${fn}`);
  const slice = start >= 0 ? migration.slice(start, start + 4500) : '';
  if (!slice.includes("current_setting('request.jwt.claim.role'")) {
    findings.push(`${fn} is missing service-role guard`);
  }
}

for (const helper of ['resolve_approval_authority_rule', 'check_user_approval_authority']) {
  if (!migration.includes(`function public.${helper}`)) findings.push(`${helper} is missing`);
  if (!migration.includes(`grant execute on function public.${helper}`) || !migration.includes('to authenticated, service_role')) {
    findings.push(`${helper} is not granted to authenticated/service_role`);
  }
}

for (const table of [
  'approval_authority_rules',
  'approval_requests',
  'approval_decisions',
  'approval_authority_events',
  'approval_delegations',
  'approval_authority_overrides',
]) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) {
    findings.push(`${table} RLS is not enabled`);
  }
}

for (const view of [
  'v_patch27_active_authority_rules',
  'v_patch27_pending_approval_requests',
  'v_patch27_overdue_approval_requests',
  'v_patch27_approval_decision_history',
  'v_patch27_authority_rule_coverage',
  'v_patch27_executive_approval_queue',
  'v_patch27_approval_bottlenecks',
  'v_patch27_unmatched_approval_requests',
  'v_patch27_active_approval_delegations',
  'v_patch27_approval_override_register',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const eventType of [
  'rule_created',
  'rule_updated',
  'rule_disabled',
  'request_created',
  'approver_matched',
  'no_rule_matched',
  'approval_recorded',
  'rejection_recorded',
  'returned_for_correction',
  'escalated',
  'cancelled',
  'final_approved',
  'final_rejected',
]) {
  if (!migration.includes(`'${eventType}'`)) findings.push(`${eventType} event is missing`);
}

for (const behavior of [
  'PATCH27_SELF_APPROVAL_BLOCKED',
  'PATCH27_OVERRIDE_REASON_REQUIRED',
  'v_rule_id is not null',
  'No active authority rule matched this request.',
]) {
  if (!migration.includes(behavior)) findings.push(`${behavior} behavior marker is missing`);
}

const report = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
  skipped_scope: [
    'No broad UI redesign',
    'No Patch 28 CAPA workflow',
    'No Patch 29 training workflow',
    'No prior workflow rewrites',
  ],
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch27-workflow-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 27 workflow proof failed: ${findings.join('; ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 27 workflow proof passed.');
}
