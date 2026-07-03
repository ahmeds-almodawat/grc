import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch37');
const migrationPath = 'supabase/migrations/098_patch37_audit_ovr_clinical_governance_engine.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'create table if not exists public.audit_execution_engagements',
  'create table if not exists public.audit_execution_programs',
  'create table if not exists public.audit_execution_test_steps',
  'create table if not exists public.audit_execution_samples',
  'create table if not exists public.audit_execution_results',
  'create table if not exists public.audit_execution_findings',
  'create table if not exists public.audit_execution_signoffs',
  'create table if not exists public.ovr_rca_cases',
  'create table if not exists public.ovr_capa_evidence_links',
  'create table if not exists public.clinical_governance_escalations',
  'create table if not exists public.clinical_governance_events',
];

const requiredViews = [
  'v_patch37_audit_engagement_register',
  'v_patch37_audit_test_step_queue',
  'v_patch37_audit_sample_result_register',
  'v_patch37_audit_finding_register',
  'v_patch37_audit_findings_requiring_capa_or_evidence',
  'v_patch37_audit_signoff_queue',
  'v_patch37_ovr_rca_case_register',
  'v_patch37_ovr_capa_evidence_bridge',
  'v_patch37_clinical_governance_escalation_register',
  'v_patch37_overdue_audit_ovr_governance_items',
  'v_patch37_department_clinical_governance_workload',
  'v_patch37_executive_clinical_governance_summary',
];

const requiredFunctions = [
  'create_audit_execution_engagement',
  'start_audit_execution_engagement',
  'close_audit_execution_engagement',
  'create_audit_execution_program',
  'create_audit_execution_test_step',
  'update_audit_execution_test_step_status',
  'create_audit_execution_sample',
  'record_audit_execution_result',
  'create_audit_execution_finding',
  'link_audit_finding_to_capa',
  'link_audit_finding_to_evidence_bridge',
  'signoff_audit_execution_engagement',
  'reject_audit_execution_signoff',
  'reopen_audit_execution_engagement',
  'create_ovr_rca_case',
  'update_ovr_rca_status',
  'close_ovr_rca_case',
  'link_ovr_to_capa_evidence_or_clause',
  'escalate_clinical_governance_item',
  'acknowledge_clinical_governance_escalation',
  'resolve_clinical_governance_escalation',
  'record_clinical_governance_event',
  'get_clinical_governance_summary',
  'get_audit_execution_summary',
];

const requiredRls = [
  'alter table public.audit_execution_engagements enable row level security',
  'alter table public.audit_execution_programs enable row level security',
  'alter table public.audit_execution_test_steps enable row level security',
  'alter table public.audit_execution_samples enable row level security',
  'alter table public.audit_execution_results enable row level security',
  'alter table public.audit_execution_findings enable row level security',
  'alter table public.audit_execution_signoffs enable row level security',
  'alter table public.ovr_rca_cases enable row level security',
  'alter table public.ovr_capa_evidence_links enable row level security',
  'alter table public.clinical_governance_escalations enable row level security',
  'alter table public.clinical_governance_events enable row level security',
];

const requiredPolicies = [
  'audit_execution_engagements_read',
  'audit_execution_engagements_write',
  'audit_execution_programs_read',
  'audit_execution_programs_write',
  'audit_execution_test_steps_read',
  'audit_execution_test_steps_write_governance',
  'audit_execution_test_steps_update_assignee',
  'audit_execution_samples_read',
  'audit_execution_samples_write',
  'audit_execution_results_read',
  'audit_execution_results_write',
  'audit_execution_findings_read',
  'audit_execution_findings_write',
  'audit_execution_signoffs_read',
  'audit_execution_signoffs_write',
  'ovr_rca_cases_read',
  'ovr_rca_cases_write',
  'ovr_capa_evidence_links_read',
  'ovr_capa_evidence_links_write',
  'clinical_governance_escalations_read',
  'clinical_governance_escalations_write',
  'clinical_governance_events_read',
  'clinical_governance_events_insert',
];

const requiredStatusSets = [
  "'planned','active','fieldwork','reporting','closed','cancelled'",
  "'not_started','in_progress','completed','failed','not_applicable','waived'",
  "'pending','passed','failed','exception','not_applicable'",
  "'open','under_review','capa_required','evidence_required','accepted','closed','waived'",
  "'pending','signed_off','rejected','reopened','waived'",
  "'open','in_progress','awaiting_review','capa_required','closed','waived','cancelled'",
  "'low','medium','high','critical','sentinel'",
  "'active','inactive','pending_review','accepted','rejected'",
  "'department','quality','medical_director','executive','sentinel'",
  "'open','acknowledged','action_required','resolved','cancelled'",
];

const requiredIntegrations = [
  'references public.accreditation_clauses',
  'references public.evidence_bridge_links',
  'public.v_patch33_clause_control_evidence_bridge',
  "linked_entity_type in ('capa','evidence_bridge','accreditation_clause','risk','audit_finding','document','training','control')",
  'ovr_id uuid',
  'linked_capa_id uuid',
];

const proof = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  migration_found: true,
  required_table_count: requiredTables.length,
  required_view_count: requiredViews.length,
  required_function_count: requiredFunctions.length,
  missing_tables: missing(migration, requiredTables),
  missing_views: missing(migration, requiredViews),
  missing_functions: missing(migration, requiredFunctions),
  missing_rls_enablement: missing(migration, requiredRls),
  missing_policies: missing(migration, requiredPolicies),
  missing_status_sets: missing(migration, requiredStatusSets),
  missing_integrations: missing(migration, requiredIntegrations),
};

const blockers = [
  ...proof.missing_tables,
  ...proof.missing_views,
  ...proof.missing_functions,
  ...proof.missing_rls_enablement,
  ...proof.missing_policies,
  ...proof.missing_status_sets,
  ...proof.missing_integrations,
];

const report = {
  ...proof,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
  blockers,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch37-schema-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 37 clinical governance schema proof failed:\n- ${blockers.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 37 clinical governance schema proof passed.');
}
