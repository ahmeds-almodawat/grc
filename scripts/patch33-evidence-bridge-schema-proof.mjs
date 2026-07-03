import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch33');
const migrationPath = 'supabase/migrations/096_patch33_evidence_bridge_live_operation.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'create table if not exists public.evidence_bridge_links',
  'create table if not exists public.evidence_collection_requests',
  'create table if not exists public.evidence_bridge_reviews',
  'create table if not exists public.evidence_bridge_events',
];

const requiredViews = [
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
];

const requiredFunctions = [
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
  'record_evidence_bridge_event',
  'get_clause_evidence_bridge',
  'get_live_evidence_readiness_summary',
];

const requiredFields = [
  'clause_id uuid',
  'control_id uuid',
  'evidence_id uuid',
  'document_id uuid',
  'sop_id uuid',
  'linked_entity_type text not null',
  "bridge_role text not null default 'supporting'",
  "evidence_status text not null default 'pending_review'",
  "freshness_status text not null default 'unknown'",
  'valid_from date',
  'valid_until date',
  'owner_user_id uuid',
  'department_id uuid',
  'assigned_to_user_id uuid',
  'assigned_to_department_id uuid',
  "priority text not null default 'medium'",
  "status text not null default 'open'",
  "review_status text not null default 'pending_review'",
  'event_type text not null',
  'event_summary text not null',
];

const requiredRls = [
  'alter table public.evidence_bridge_links enable row level security',
  'alter table public.evidence_collection_requests enable row level security',
  'alter table public.evidence_bridge_reviews enable row level security',
  'alter table public.evidence_bridge_events enable row level security',
];

const requiredPolicies = [
  'evidence_bridge_links_read_governance',
  'evidence_bridge_links_write_governance',
  'evidence_collection_requests_read_assigned_or_governance',
  'evidence_collection_requests_write_governance',
  'evidence_collection_requests_update_assigned_owner',
  'evidence_bridge_reviews_read_governance',
  'evidence_bridge_reviews_write_reviewers',
  'evidence_bridge_events_read_governance',
  'evidence_bridge_events_insert_governance',
];

const report = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  migration_found: true,
  missing_tables: missing(migration, requiredTables),
  missing_views: missing(migration, requiredViews),
  missing_functions: missing(migration, requiredFunctions),
  missing_fields: missing(migration, requiredFields),
  missing_rls_enablement: missing(migration, requiredRls),
  missing_policies: missing(migration, requiredPolicies),
};

const blockers = [
  ...report.missing_tables,
  ...report.missing_views,
  ...report.missing_functions,
  ...report.missing_fields,
  ...report.missing_rls_enablement,
  ...report.missing_policies,
];

const proof = {
  ...report,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch33-schema-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 33 evidence bridge schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 33 evidence bridge schema proof passed.');
}
