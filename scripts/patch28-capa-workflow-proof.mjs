import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch28');
const migrationPath = 'supabase/migrations/091_patch28_capa_action_plan_hardening.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const migration = await read(migrationPath);
const findings = [];

const serviceRoleFunctions = [
  'patch28_write_capa_event',
  'create_capa_action_plan',
  'assign_capa_action_plan',
  'submit_capa_action_plan',
  'approve_capa_action_plan',
  'reject_capa_action_plan',
  'create_capa_action_item',
  'update_capa_action_item_status',
  'submit_capa_completion',
  'validate_capa_completion',
  'reject_capa_completion',
  'request_capa_due_date_extension',
  'approve_capa_due_date_extension',
  'reject_capa_due_date_extension',
  'start_capa_effectiveness_review',
  'complete_capa_effectiveness_review',
  'request_capa_closure',
  'approve_capa_closure',
  'reject_capa_closure',
  'escalate_capa',
  'reopen_capa_with_reason',
  'cancel_capa_with_reason',
  'link_capa_to_item',
  'mark_repeat_capa',
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

for (const fn of serviceRoleFunctions) {
  const start = migration.indexOf(`function public.${fn}`);
  const slice = start >= 0 ? migration.slice(start, start + 4500) : '';
  if (!slice.includes("current_setting('request.jwt.claim.role'") && fn !== 'patch28_write_capa_event') {
    findings.push(`${fn} is missing service-role guard`);
  }
}

for (const table of [
  'capa_action_plans',
  'capa_action_items',
  'capa_events',
  'capa_due_date_extensions',
  'capa_effectiveness_reviews',
  'capa_links',
]) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) {
    findings.push(`${table} RLS is not enabled`);
  }
}

for (const view of [
  'v_patch28_capa_register',
  'v_patch28_open_capa_queue',
  'v_patch28_overdue_capa',
  'v_patch28_capa_action_item_queue',
  'v_patch28_capa_closure_blockers',
  'v_patch28_capa_evidence_gap_dashboard',
  'v_patch28_capa_effectiveness_review_queue',
  'v_patch28_capa_executive_escalations',
  'v_patch28_repeat_capa_signals',
  'v_patch28_capa_link_index',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const eventType of [
  'created',
  'assigned',
  'action_plan_submitted',
  'approved',
  'rejected',
  'action_item_created',
  'action_item_updated',
  'completion_submitted',
  'validation_approved',
  'extension_requested',
  'extension_approved',
  'extension_rejected',
  'effectiveness_review_started',
  'effectiveness_review_passed',
  'closure_requested',
  'closed',
  'reopened',
  'cancelled',
  'escalated',
  'linked',
]) {
  if (!migration.includes(`'${eventType}'`)) findings.push(`${eventType} event is missing`);
}

for (const behavior of [
  'PATCH28_CAPA_CLOSURE_BLOCKED',
  'PATCH28_REOPEN_REASON_REQUIRED',
  'PATCH28_EXTENSION_REASON_REQUIRED',
  'PATCH28_REJECTION_REASON_REQUIRED',
  'PATCH28_CANCEL_REASON_REQUIRED',
  'PATCH28_ESCALATION_REASON_REQUIRED',
  'incomplete_action_items',
  'evidence_gate_not_satisfied',
  'effectiveness_review_not_passed',
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
    'No UI redesign',
    'No Patch 20 import changes',
    'No Patch 21 OVR workflow rewrite',
    'No Patch 22 risk workflow rewrite',
    'No Patch 23 evidence bridge rewrite',
    'No Patch 24 audit findings rewrite',
    'No Patch 25 compliance rewrite',
    'No Patch 26 document control rewrite',
    'No Patch 27 approval authority rewrite',
    'No Patch 29 training workflow',
  ],
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch28-workflow-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 28 CAPA workflow proof failed: ${findings.join('; ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 28 CAPA workflow proof passed.');
}
