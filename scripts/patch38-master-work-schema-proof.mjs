import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch38');
const migrationPath = 'supabase/migrations/099_patch38_unified_work_queue_hospital_master_data.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'create table if not exists public.hospital_master_locations',
  'create table if not exists public.hospital_master_services',
  'create table if not exists public.hospital_master_clinical_areas',
  'create table if not exists public.hospital_master_committees',
  'create table if not exists public.hospital_master_job_titles',
  'create table if not exists public.hospital_master_quality_indicators',
  'create table if not exists public.hospital_master_ownership_mappings',
  'create table if not exists public.unified_work_queue_events',
];

const requiredViews = [
  'v_patch38_hospital_location_register',
  'v_patch38_hospital_service_register',
  'v_patch38_clinical_area_register',
  'v_patch38_committee_register',
  'v_patch38_job_title_register',
  'v_patch38_quality_indicator_register',
  'v_patch38_master_data_exception_register',
  'v_patch38_master_data_ownership_register',
  'v_patch38_unified_work_queue',
  'v_patch38_my_work_queue',
  'v_patch38_department_work_queue',
  'v_patch38_overdue_work_queue',
  'v_patch38_escalated_work_queue',
  'v_patch38_waiting_for_review_queue',
  'v_patch38_executive_workload_summary',
  'v_patch38_user_workload_summary',
  'v_patch38_department_workload_summary',
  'v_patch38_governance_operating_summary',
];

const requiredFunctions = [
  'create_hospital_location',
  'update_hospital_location_status',
  'create_hospital_service',
  'update_hospital_service_status',
  'create_hospital_clinical_area',
  'update_hospital_clinical_area_status',
  'create_hospital_committee',
  'update_hospital_committee_status',
  'create_hospital_job_title',
  'update_hospital_job_title_status',
  'create_hospital_quality_indicator',
  'update_hospital_quality_indicator_status',
  'create_hospital_ownership_mapping',
  'deactivate_hospital_ownership_mapping',
  'record_unified_work_queue_event',
  'get_my_work_queue',
  'get_department_work_queue',
  'get_executive_workload_summary',
  'get_governance_operating_summary',
];

const requiredRls = requiredTables.map(table => `alter table ${table.replace('create table if not exists ', '')} enable row level security`);
const requiredPolicies = [
  'hospital_master_locations_read',
  'hospital_master_locations_write',
  'hospital_master_services_read',
  'hospital_master_services_write',
  'hospital_master_clinical_areas_read',
  'hospital_master_clinical_areas_write',
  'hospital_master_committees_read',
  'hospital_master_committees_write',
  'hospital_master_job_titles_read',
  'hospital_master_job_titles_write',
  'hospital_master_quality_indicators_read',
  'hospital_master_quality_indicators_write',
  'hospital_master_ownership_mappings_read',
  'hospital_master_ownership_mappings_write',
  'unified_work_queue_events_read',
  'unified_work_queue_events_insert',
];

const requiredTypeMarkers = [
  "'hospital','building','floor','ward','clinic','department_area','support_area','external_site','hospital_area'",
  "'clinical','non_clinical','diagnostic','support','administrative','outsourced'",
  "'quality','patient_safety','infection_control','medication_safety','credentialing','executive','risk','audit','governance'",
  "'physician','nurse','allied_health','admin','support','leadership','contractor','employee'",
  "'higher_is_better','lower_is_better','range'",
  "'department','location','service','clinical_area','committee','job_title','quality_indicator','user'",
  "'accreditation_clause','evidence_request','audit_engagement','audit_finding','ovr','rca_case','capa','training_assignment','document','approval','risk','committee_action'",
];

const requiredSourceMarkers = [
  'public.v_patch35_clause_owner_task_queue',
  'public.v_patch33_evidence_collection_queue',
  'public.v_patch29_training_assignment_queue',
  'public.v_patch37_audit_test_step_queue',
  'public.v_patch37_audit_finding_register',
  'public.v_patch37_ovr_rca_case_register',
  'public.capa_action_items',
  'public.document_acknowledgment_requirements',
  'public.approval_requests',
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
  missing_type_markers: missing(migration, requiredTypeMarkers),
  missing_unified_queue_sources: missing(migration, requiredSourceMarkers),
};

const blockers = [
  ...proof.missing_tables,
  ...proof.missing_views,
  ...proof.missing_functions,
  ...proof.missing_rls_enablement,
  ...proof.missing_policies,
  ...proof.missing_type_markers,
  ...proof.missing_unified_queue_sources,
];

const report = { ...proof, status: blockers.length ? 'failed' : 'passed', blocking_count: blockers.length, blockers };
await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch38-schema-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 38 schema proof failed:\n- ${blockers.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 38 schema proof passed.');
}
