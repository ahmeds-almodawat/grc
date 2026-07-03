import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/100_patch39_hospital_quality_infection_governance_pack.sql');
const reportPath = path.join(root, 'release/patch39/patch39-schema-proof.json');

const requiredTables = [
  'infection_control_surveillance_events',
  'clinical_quality_indicator_results',
  'hospital_committee_meetings',
  'hospital_committee_actions',
  'clinical_credentialing_records',
  'facility_biomedical_safety_evidence',
  'hospital_governance_events',
];

const requiredViews = [
  'v_patch39_infection_control_register',
  'v_patch39_infection_control_open_actions',
  'v_patch39_quality_indicator_performance',
  'v_patch39_quality_indicator_off_target_register',
  'v_patch39_committee_meeting_register',
  'v_patch39_committee_action_queue',
  'v_patch39_overdue_committee_actions',
  'v_patch39_credentialing_expiry_register',
  'v_patch39_privileging_competency_gap_register',
  'v_patch39_facility_biomedical_safety_register',
  'v_patch39_facility_safety_evidence_gap_register',
  'v_patch39_hospital_governance_work_queue',
  'v_patch39_accreditation_blocker_summary',
  'v_patch39_department_hospital_governance_scorecard',
  'v_patch39_executive_hospital_quality_summary',
];

const requiredFunctions = [
  'create_infection_control_surveillance_event',
  'update_infection_control_event_status',
  'close_infection_control_event',
  'record_clinical_quality_indicator_result',
  'update_clinical_quality_indicator_status',
  'create_hospital_committee_meeting',
  'update_committee_meeting_status',
  'create_hospital_committee_action',
  'update_committee_action_status',
  'complete_committee_action',
  'create_clinical_credentialing_record',
  'update_credentialing_record_status',
  'mark_credentialing_record_reviewed',
  'create_facility_biomedical_safety_evidence',
  'update_facility_biomedical_safety_status',
  'mark_facility_biomedical_safety_checked',
  'link_hospital_governance_item_to_evidence_bridge',
  'link_hospital_governance_item_to_accreditation_clause',
  'record_hospital_governance_event',
  'get_hospital_quality_summary',
  'get_department_hospital_governance_scorecard',
];

function assertIncludes(content, marker, failures) {
  if (!content.includes(marker)) failures.push(marker);
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const failures = [];
if (!fs.existsSync(migrationPath)) failures.push('migration file missing');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();

for (const table of requiredTables) {
  assertIncludes(lower, `create table if not exists public.${table}`, failures);
  assertIncludes(lower, `alter table public.${table} enable row level security`, failures);
  assertIncludes(lower, `create policy`, failures);
}
for (const view of requiredViews) {
  assertIncludes(lower, `create or replace view public.${view}`, failures);
  assertIncludes(lower, `alter view public.${view} set (security_invoker = true)`, failures);
}
for (const fn of requiredFunctions) {
  assertIncludes(lower, `create or replace function public.${fn}`, failures);
}

const requiredMarkers = [
  "'hai_surveillance'",
  "'outbreak'",
  "'hand_hygiene_audit'",
  "'isolation_check'",
  "'sterilization_check'",
  "'infection_control_round'",
  "'exposure_event'",
  "'not_assessed'",
  "'on_target'",
  "'off_target'",
  "'watch'",
  "'critical'",
  "'minutes_pending'",
  "'minutes_approved'",
  "'privilege'",
  "'competency'",
  "'scope_of_practice'",
  "'facility_safety'",
  "'biomedical_equipment'",
  "'emergency_preparedness'",
  'hospital_master_locations',
  'hospital_master_services',
  'hospital_master_committees',
  'hospital_master_job_titles',
  'hospital_master_quality_indicators',
  'evidence_bridge_links',
  'accreditation_clauses',
  'v_patch39_hospital_governance_work_queue',
];

for (const marker of requiredMarkers) assertIncludes(lower, marker.toLowerCase(), failures);

const report = {
  patch: 39,
  status: failures.length === 0 ? 'passed' : 'failed',
  checked_at: new Date().toISOString(),
  tables_checked: requiredTables.length,
  views_checked: requiredViews.length,
  functions_checked: requiredFunctions.length,
  failures,
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error('Patch 39 schema proof failed.');
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log('Patch 39 schema proof passed.');
