import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch35');
const migrationPath = 'supabase/migrations/097_patch35_accreditation_clause_owner_workflow.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'create table if not exists public.accreditation_clause_owner_assignments',
  'create table if not exists public.accreditation_review_cycles',
  'create table if not exists public.accreditation_clause_review_tasks',
  'create table if not exists public.accreditation_clause_signoffs',
  'create table if not exists public.accreditation_workflow_escalations',
  'create table if not exists public.accreditation_workflow_events',
];

const requiredViews = [
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
];

const requiredFunctions = [
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
  'record_accreditation_workflow_event',
  'get_accreditation_operations_dashboard',
  'get_clause_owner_workload',
];

const requiredRls = [
  'alter table public.accreditation_clause_owner_assignments enable row level security',
  'alter table public.accreditation_review_cycles enable row level security',
  'alter table public.accreditation_clause_review_tasks enable row level security',
  'alter table public.accreditation_clause_signoffs enable row level security',
  'alter table public.accreditation_workflow_escalations enable row level security',
  'alter table public.accreditation_workflow_events enable row level security',
];

const requiredPolicies = [
  'accreditation_clause_owner_assignments_read',
  'accreditation_clause_owner_assignments_write',
  'accreditation_review_cycles_read',
  'accreditation_review_cycles_write',
  'accreditation_clause_review_tasks_read',
  'accreditation_clause_review_tasks_write_governance',
  'accreditation_clause_review_tasks_update_owner',
  'accreditation_clause_signoffs_read',
  'accreditation_clause_signoffs_write',
  'accreditation_workflow_escalations_read',
  'accreditation_workflow_escalations_write',
  'accreditation_workflow_events_read',
  'accreditation_workflow_events_insert',
];

const requiredIntegrations = [
  'references public.accreditation_clauses',
  'public.v_patch33_clause_control_evidence_bridge',
  'accreditation_clauses c',
  'accreditation_standards s',
];

const requiredStatuses = [
  "'active','inactive','transferred','suspended'",
  "'draft','active','completed','cancelled','archived'",
  "'open','in_progress','submitted','under_review','approved','rejected','overdue'",
  "'pending','signed_off','rejected','reopened','waived'",
  "'open','acknowledged','resolved','cancelled'",
];

const report = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  migration_found: true,
  missing_tables: missing(migration, requiredTables),
  missing_views: missing(migration, requiredViews),
  missing_functions: missing(migration, requiredFunctions),
  missing_rls_enablement: missing(migration, requiredRls),
  missing_policies: missing(migration, requiredPolicies),
  missing_integrations: missing(migration, requiredIntegrations),
  missing_status_sets: missing(migration, requiredStatuses),
};

const blockers = [
  ...report.missing_tables,
  ...report.missing_views,
  ...report.missing_functions,
  ...report.missing_rls_enablement,
  ...report.missing_policies,
  ...report.missing_integrations,
  ...report.missing_status_sets,
];

const proof = {
  ...report,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch35-schema-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 35 accreditation workflow schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 35 accreditation workflow schema proof passed.');
}
