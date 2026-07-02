import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch28');
const migrationPath = 'supabase/migrations/091_patch28_capa_action_plan_hardening.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'create table if not exists public.capa_action_plans',
  'create table if not exists public.capa_action_items',
  'create table if not exists public.capa_events',
  'create table if not exists public.capa_due_date_extensions',
  'create table if not exists public.capa_effectiveness_reviews',
  'create table if not exists public.capa_links',
];

const requiredViews = [
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
];

const requiredFields = [
  'organization_id uuid not null',
  'capa_code text',
  'capa_title text not null',
  'capa_type text not null',
  'source_type text not null',
  'source_id uuid',
  'source_reference text',
  'severity_level text',
  'priority_level text',
  'root_cause_summary text',
  'containment_summary text',
  'corrective_action_summary text',
  'preventive_action_summary text',
  'owner_id uuid',
  'approver_id uuid',
  'validator_id uuid',
  'effectiveness_reviewer_id uuid',
  'due_date date',
  'original_due_date date',
  'completion_due_date date',
  'evidence_required boolean default true',
  'minimum_accepted_evidence_count integer default 1',
  'evidence_requirement_id uuid',
  'evidence_gate_status text',
  'action_item_count integer default 0',
  'completed_action_item_count integer default 0',
  'effectiveness_review_required boolean default false',
  'effectiveness_review_status text default',
  'closure_requested_at timestamptz',
  'closed_at timestamptz',
  'reopened_at timestamptz',
  'cancelled_at timestamptz',
  'escalation_level text',
  'repeat_issue_flag boolean default false',
  'repeat_of_capa_id uuid',
  'rejection_reason text',
  'reopen_reason text',
  'cancel_reason text',
  "status text not null default 'open'",
  'extension_reason text not null',
  'review_status text default',
  'linked_item_type text not null',
  'required_flag boolean default false',
];

const requiredSourceTypes = [
  'ovr',
  'risk',
  'audit_finding',
  'compliance_obligation',
  'evidence_gap',
  'document_control',
  'inspection',
  'management_review',
  'customer_complaint',
  'internal_issue',
  'other',
];

const requiredStatuses = [
  'draft',
  'assigned',
  'in_progress',
  'submitted',
  'approved',
  'rejected',
  'completed',
  'validated',
  'effectiveness_review_pending',
  'effectiveness_review_passed',
  'effectiveness_review_failed',
  'closure_requested',
  'closed',
  'reopened',
  'cancelled',
  'overdue',
  'escalated',
];

const requiredLinkTargets = [
  'ovr',
  'risk',
  'audit_finding',
  'compliance_obligation',
  'evidence_requirement',
  'evidence_file',
  'document_control',
  'approval_request',
  'project',
  'task',
  'training',
];

const report = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  migration_found: true,
  missing_tables: missing(migration, requiredTables),
  missing_views: missing(migration, requiredViews),
  missing_fields: missing(migration, requiredFields),
  missing_source_types: missing(migration, requiredSourceTypes),
  missing_statuses: missing(migration, requiredStatuses),
  missing_link_targets: missing(migration, requiredLinkTargets),
};

const blockers = [
  ...report.missing_tables,
  ...report.missing_views,
  ...report.missing_fields,
  ...report.missing_source_types,
  ...report.missing_statuses,
  ...report.missing_link_targets,
];

const proof = {
  ...report,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch28-schema-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 28 CAPA schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 28 CAPA schema proof passed.');
}
