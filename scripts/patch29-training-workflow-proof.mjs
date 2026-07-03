import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch29');
const migrationPath = 'supabase/migrations/092_patch29_training_acknowledgment_governance.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const migration = await read(migrationPath);
const findings = [];

const serviceRoleFunctions = [
  'create_training_program',
  'assign_training_program_to_user',
  'assign_training_program_to_department',
  'start_training_assignment',
  'complete_training_assignment',
  'acknowledge_training_assignment',
  'waive_training_assignment_with_reason',
  'cancel_training_assignment_with_reason',
  'record_competency_assessment',
  'reopen_training_assignment_with_reason',
  'link_training_evidence',
];

for (const fn of serviceRoleFunctions) {
  const marker = `function public.${fn}`;
  const start = migration.indexOf(marker);
  const slice = start >= 0 ? migration.slice(start, start + 4500) : '';
  if (start < 0) {
    findings.push(`${fn} is missing`);
    continue;
  }
  if (!slice.includes('security definer')) findings.push(`${fn} is not security definer`);
  if (!slice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute privileges are not revoked`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) {
    findings.push(`${fn} is not service-role only`);
  }
}

for (const fn of serviceRoleFunctions) {
  const start = migration.indexOf(`function public.${fn}`);
  const slice = start >= 0 ? migration.slice(start, start + 4500) : '';
  if (!slice.includes("current_setting('request.jwt.claim.role'")) {
    findings.push(`${fn} is missing service-role guard`);
  }
}

for (const table of [
  'training_programs',
  'training_assignments',
  'training_acknowledgments',
  'competency_assessments',
  'training_events',
]) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) {
    findings.push(`${table} RLS is not enabled`);
  }
}

for (const view of [
  'v_patch29_training_program_register',
  'v_patch29_training_assignment_queue',
  'v_patch29_overdue_training_assignments',
  'v_patch29_sop_acknowledgment_gap',
  'v_patch29_competency_gap_dashboard',
  'v_patch29_training_evidence_index',
  'v_patch29_training_executive_summary',
  'v_patch29_accreditation_training_readiness',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const eventType of [
  'created',
  'assigned',
  'started',
  'completed',
  'acknowledged',
  'waived',
  'cancelled',
  'assessed',
  'reopened',
  'evidence_linked',
]) {
  if (!migration.includes(`'${eventType}'`)) {
    findings.push(`event type ${eventType} is not logged/referenced`);
  }
}

const proof = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  findings,
  status: findings.length ? 'failed' : 'passed',
  blocking_count: findings.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch29-workflow-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 29 Training workflow proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 29 Training workflow proof passed.');
}
