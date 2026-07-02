import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch26');
const migrationPath = 'supabase/migrations/089_patch26_document_control_sop_governance.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const migration = await read(migrationPath);
const findings = [];

for (const fn of [
  'patch26_write_document_event',
  'submit_document_for_review',
  'approve_document_version',
  'reject_document_version',
  'activate_document_version',
  'start_document_revision',
  'retire_controlled_document',
  'link_document_to_item',
  'record_document_acknowledgment',
]) {
  const marker = `function public.${fn}`;
  const start = migration.indexOf(marker);
  const slice = start >= 0 ? migration.slice(start, start + 4500) : '';
  if (start < 0) findings.push(`${fn} is missing`);
  if (!slice.includes('security definer')) findings.push(`${fn} is not security definer`);
  if (!slice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!slice.includes("current_setting('request.jwt.claim.role'")) findings.push(`${fn} is missing service-role guard`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute grants are not revoked`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) {
    findings.push(`${fn} is not service-role only`);
  }
}

for (const table of [
  'controlled_documents',
  'document_versions',
  'document_review_events',
  'document_links',
  'document_acknowledgment_requirements',
  'document_acknowledgments',
]) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) {
    findings.push(`${table} RLS is not enabled`);
  }
}

for (const view of [
  'v_patch26_document_control_register',
  'v_patch26_active_sops',
  'v_patch26_documents_due_for_review',
  'v_patch26_expired_documents',
  'v_patch26_pending_document_reviews',
  'v_patch26_pending_document_approvals',
  'v_patch26_superseded_documents',
  'v_patch26_staff_acknowledgment_gaps',
  'v_patch26_document_link_index',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const eventType of [
  'submitted_for_review',
  'approved',
  'rejected',
  'activated',
  'revision_started',
  'retired',
  'linked',
  'acknowledged',
]) {
  if (!migration.includes(`'${eventType}'`)) findings.push(`${eventType} event is missing`);
}

const report = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
  skipped_scope: [
    'No full SOP editor UI',
    'No file upload UI',
    'No training workflow',
    'No approval authority matrix',
    'No CAPA workflow',
  ],
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch26-workflow-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 26 workflow proof failed: ${findings.join('; ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 26 workflow proof passed.');
}
