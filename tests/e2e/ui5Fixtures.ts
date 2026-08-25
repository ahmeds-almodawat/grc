import type { Page, Route } from '@playwright/test';
import { PATCH83V_ORGANIZATION_ID, PATCH83V_USER_ID } from './patch83vTestHarness';

const departments = [
  { id: 'dept-clinical', name_en: 'Clinical Services', name_ar: 'الخدمات السريرية' },
  { id: 'dept-quality', name_en: 'Quality & Patient Safety', name_ar: 'الجودة وسلامة المرضى' },
  { id: 'dept-operations', name_en: 'Hospital Operations', name_ar: 'عمليات المستشفى' },
];
const people = [
  { id: PATCH83V_USER_ID, en: 'UI Review Admin', ar: 'مسؤول مراجعة الواجهة' },
  { id: 'profile-lina', en: 'Dr. Lina Haddad', ar: 'د. لينا حداد' },
  { id: 'profile-omar', en: 'Omar Al-Salem', ar: 'عمر السالم' },
  { id: 'profile-noura', en: 'Noura Al-Harbi', ar: 'نورة الحربي' },
];
const trainingPrograms = [
  ['Medication Safety and High-Alert Medicines', 'medication_safety'],
  ['Patient Identification and Verification', 'patient_safety'],
  ['Infection Prevention Annual Update', 'infection_control'],
  ['Emergency Preparedness and Code Response', 'emergency'],
  ['Information Privacy and Access Control', 'privacy'],
  ['Incident Reporting and Just Culture', 'quality'],
] as const;
const assignmentStates = ['completed', 'in_progress', 'assigned', 'overdue', 'completed', 'waived'] as const;

export const ui5TrainingAssignments = Array.from({ length: 18 }, (_, index) => {
  const program = trainingPrograms[index % trainingPrograms.length];
  const person = people[index % people.length];
  const department = departments[index % departments.length];
  const status = assignmentStates[index % assignmentStates.length];
  return {
    id: `training-assignment-ui5-${index + 1}`,
    program_id: `training-program-ui5-${index % trainingPrograms.length + 1}`,
    assigned_to_user_id: person.id,
    assigned_to_role: null,
    assigned_to_department_id: department.id,
    due_date: `2026-${String(9 + (index % 3)).padStart(2, '0')}-${String(10 + (index % 16)).padStart(2, '0')}`,
    status,
    assigned_at: '2026-08-01T08:00:00.000Z',
    completed_at: status === 'completed' ? '2026-08-18T10:30:00.000Z' : null,
    completion_evidence_id: status === 'completed' ? `evidence-training-ui5-${index + 1}` : null,
    program_title: program[0],
    program_title_ar: null,
    training_type: program[1],
    assigned_user_name_en: person.en,
    assigned_user_name_ar: person.ar,
    department_name_en: department.name_en,
    department_name_ar: department.name_ar,
  };
});

const ui5AcknowledgmentGaps = [0, 1, 2, 3, 4].map((index) => {
  const person = people[index % people.length];
  const department = departments[index % departments.length];
  return {
    program_id: `training-program-ui5-${index + 1}`,
    sop_title: `${trainingPrograms[index % trainingPrograms.length][0]} Procedure`,
    sop_title_ar: null,
    linked_sop_id: `sop-${index % 5 + 1}`,
    user_id: person.id,
    user_name_en: person.en,
    user_name_ar: person.ar,
    department_id: department.id,
    department_name_en: department.name_en,
    department_name_ar: department.name_ar,
    version_id: `sop-version-${index % 5 + 1}`,
    due_date: `2026-09-${String(12 + index).padStart(2, '0')}`,
    document_code: `SOP-${String(index + 1).padStart(3, '0')}`,
    version_label: `${2 + index}.0`,
  };
});

const competencyResults = ['passed', 'failed', 'needs_retraining', 'pending'] as const;
const competencyAreas = ['Medication verification', 'Patient identification', 'Aseptic technique', 'Emergency response', 'Privacy incident handling'];
const ui5CompetencyGaps = Array.from({ length: 12 }, (_, index) => {
  const person = people[index % people.length];
  const result = competencyResults[index % competencyResults.length];
  return {
    user_id: person.id,
    user_name_en: person.en,
    user_name_ar: person.ar,
    competency_area: competencyAreas[index % competencyAreas.length],
    result,
    score: result === 'passed' ? 92 - index : result === 'failed' ? 58 + index : null,
    assessed_at: result === 'pending' ? null : '2026-08-17T09:00:00.000Z',
    assessor_user_id: 'profile-quality',
    assessor_name_en: 'Maha Al-Rashid',
    assessor_name_ar: 'مها الراشد',
    assignment_id: `training-assignment-ui5-${index + 1}`,
    document_version_id: `sop-version-${index % 5 + 1}`,
    due_date: `2026-10-${String(10 + index).padStart(2, '0')}`,
    document_code: `SOP-${String(index % 5 + 1).padStart(3, '0')}`,
    version_label: `${index % 3 + 2}.0`,
  };
});

export const ui5TrainingMatrix = trainingPrograms.map((program, index) => ({
  sop_version_id: `sop-version-${index + 1}`,
  document_id: `sop-${index + 1}`,
  organization_id: PATCH83V_ORGANIZATION_ID,
  document_code: `SOP-${String(index + 1).padStart(3, '0')}`,
  document_title: `${program[0]} Procedure`,
  version_number: index + 2,
  version_label: `${index + 2}.0`,
  document_status: 'published',
  training_required: true,
  acknowledgment_required: index !== 5,
  competency_assessment_required: index < 4,
  target_population_count: 24 + index * 7,
  training_target_count: 24 + index * 7,
  acknowledgment_target_count: index !== 5 ? 24 + index * 7 : 0,
  competency_target_count: index < 4 ? 18 + index * 5 : 0,
  assigned_count: 20 + index * 6,
  in_progress_count: 4 + index,
  completed_count: 14 + index * 4,
  overdue_count: index % 3 + 1,
  waived_count: index % 2,
  cancelled_count: 0,
  acknowledged_count: index !== 5 ? 17 + index * 4 : 0,
  acknowledgment_gap_count: index !== 5 ? 3 + index : 0,
  competency_passed_count: index < 4 ? 13 + index * 3 : 0,
  competency_failed_count: index < 4 ? index + 1 : 0,
  competency_pending_count: index < 4 ? 4 : 0,
  renewal_due_count: index < 4 ? index + 2 : 0,
}));

const ui5TrainingPrograms = trainingPrograms.map((program, index) => ({
  id: `training-program-ui5-${index + 1}`,
  title: program[0],
  title_ar: null,
  training_type: program[1],
  linked_document_id: index % 2 === 1 ? `policy-${index + 1}` : `sop-${index + 1}`,
  linked_sop_id: index % 2 === 0 ? `sop-${index + 1}` : null,
  department_name_en: departments[index % departments.length].name_en,
  department_name_ar: departments[index % departments.length].name_ar,
  owner_name_en: 'Maha Al-Rashid',
  owner_name_ar: 'مها الراشد',
  active: true,
}));

const ovrStatuses = ['submitted', 'manager_review', 'quality_validation', 'referred_party_response', 'quality_final_review', 'corrective_action_in_progress', 'closed'] as const;
const ovrCategories = ['medications', 'falls_injury', 'practice_nursing', 'environment', 'needle_stick', 'treatment_blood'];
const ovrSeverities = ['level_2', 'level_3', 'level_4', 'level_1', 'sentinel'] as const;
const ovrScenarios = [
  'Reporter uncertain which governed documents apply',
  'Policy suggestion only, pending investigator decision',
  'SOP suggestion only, pending investigator decision',
  'Policy and SOP suggestions retained separately',
  'Multiple Policy and SOP suggestions retained',
  'Confirmed Policy noncompliance',
  'Confirmed SOP procedure failure',
  'Correct compliance with control failure despite compliance',
  'SOP document adequacy classified as unclear',
  'Missing SOP document gap identified',
  'Training and competency gap identified for governed follow-up',
  'Authorized emergency deviation, not a normal violation',
  'Rejected reporter suggestion retained in append-only history',
  'Corrected decision supersedes prior decision without deletion',
  'High-severity OVR requiring governance authority review',
  'OVR root event inherited by CAPA without duplicate counting',
  'OVR root event inherited by Audit without duplicate counting',
  'Document adequacy finding linked to governed document review trigger',
] as const;

export const ui5OvrReports = ovrScenarios.map((scenario, index) => {
  const department = departments[index % departments.length];
  const status = ovrStatuses[index % ovrStatuses.length];
  return {
    id: `ovr-ui5-${index + 1}`,
    organization_id: PATCH83V_ORGANIZATION_ID,
    ovr_number: `OVR-2026-${String(index + 1).padStart(3, '0')}`,
    logging_number: `QPS-${String(410 + index)}`,
    occurrence_date: `2026-08-${String(5 + index).padStart(2, '0')}`,
    occurrence_time: '09:30:00',
    occurrence_location: index % 2 ? 'Outpatient Clinic' : 'Medical Ward 3A',
    involved_person_type: 'patient',
    person_involved_name: null,
    mrn_or_id_no: null,
    department_id: department.id,
    brief_description: index === 0 ? 'High-alert medication dose reached the bedside before the independent verification was documented.' : scenario,
    occurrence_category: ovrCategories[index % ovrCategories.length],
    severity_level: ovrSeverities[index % ovrSeverities.length],
    injury_type: index % 4 === 0 ? 'Temporary harm' : null,
    supervisor_investigation: 'Process handoff and independent-check evidence were reviewed using the 5 Whys method.',
    corrective_action: 'Introduce a hard-stop verification control and monitor thirty consecutive transactions.',
    quality_manager_comments: 'Workload, handoff design, and competency reinforcement were contributing factors.',
    referred_department_id: department.id,
    referred_user_id: 'profile-lina',
    referred_response: 'Department response documented and action owner confirmed.',
    reported_by: PATCH83V_USER_ID,
    supervisor_id: 'profile-omar',
    quality_reviewer_id: PATCH83V_USER_ID,
    quality_validated_at: status === 'submitted' ? null : '2026-08-19T09:00:00.000Z',
    final_verdict: status === 'quality_final_review' || status === 'closed' ? 'System and execution factors confirmed; governed actions required.' : null,
    evidence_required: true,
    status,
    corrective_action_required: index % 2 === 0,
    linked_project_id: status === 'corrective_action_in_progress' ? `project-ovr-ui5-${index + 1}` : null,
    created_at: `2026-08-${String(5 + index).padStart(2, '0')}T10:00:00.000Z`,
    departments: { name_en: department.name_en, name_ar: department.name_ar },
    reporter: { full_name_en: 'UI Review Admin', full_name_ar: 'مسؤول مراجعة الواجهة' },
    owner: { full_name_en: 'Dr. Lina Haddad', full_name_ar: 'د. لينا حداد' },
  };
});

const ovrGovernanceLinks = [
  { link_id: 'link-ovr-ui5-policy', organization_id: PATCH83V_ORGANIZATION_ID, review_id: 'review-ovr-ui5-1', source_entity_type: 'ovr', source_entity_id: 'ovr-ui5-1', source_revision_id: null, root_source_entity_type: 'ovr', root_source_entity_id: 'ovr-ui5-1', target_criterion_type: 'policy_requirement', target_document_id: 'policy-1', target_version_id: 'policy-version-1', target_policy_requirement_id: 'policy-requirement-3', target_sop_step_id: null, target_compliance_obligation_id: null, target_accreditation_clause_id: null, target_control_id: null, target_display_label: 'POL-001 Requirement 03 · Independent verification governance', target_confidentiality_level: 'internal', relationship_origin: 'reporter_suggested', resolution_date: '2026-08-05', resolution_method: 'resolver_exact', resolution_snapshot: { version_label: '2.0', version_effective_date: '2026-01-15' }, current_decision_id: 'decision-ovr-ui5-policy', decision_type: 'confirmed', significance: 'primary', adherence_status: 'procedure_not_followed', adequacy_status: 'adequate', inherited: false, root_event_key: 'ovr:ovr-ui5-1', created_at: '2026-08-06T09:00:00.000Z' },
  { link_id: 'link-ovr-ui5-sop', organization_id: PATCH83V_ORGANIZATION_ID, review_id: 'review-ovr-ui5-1', source_entity_type: 'ovr', source_entity_id: 'ovr-ui5-1', source_revision_id: null, root_source_entity_type: 'ovr', root_source_entity_id: 'ovr-ui5-1', target_criterion_type: 'sop_step', target_document_id: 'sop-1', target_version_id: 'sop-version-1', target_policy_requirement_id: null, target_sop_step_id: 'sop-step-3', target_compliance_obligation_id: null, target_accreditation_clause_id: null, target_control_id: null, target_display_label: 'SOP-001 Step 03 · Independent double-check', target_confidentiality_level: 'internal', relationship_origin: 'investigator_confirmed', resolution_date: '2026-08-05', resolution_method: 'resolver_exact', resolution_snapshot: { version_label: '3.0', version_effective_date: '2026-02-01' }, current_decision_id: 'decision-ovr-ui5-sop', decision_type: 'confirmed', significance: 'contributing', adherence_status: 'partial_adherence', adequacy_status: 'training_competency_gap', inherited: false, root_event_key: 'ovr:ovr-ui5-1', created_at: '2026-08-06T09:05:00.000Z' },
];
const ovrReview = { id: 'review-ovr-ui5-1', organization_id: PATCH83V_ORGANIZATION_ID, source_entity_type: 'ovr', source_entity_id: 'ovr-ui5-1', source_revision_id: null, source_date: '2026-08-05', applicability_date: '2026-08-05', review_status: 'completed', review_outcome: 'confirmed_relationship', uncertainty_recorded: true, reviewed_by: PATCH83V_USER_ID, reviewed_at: '2026-08-07T09:00:00.000Z', review_rationale: 'Exact occurrence-date policy and SOP criteria confirmed; uncertainty retained for a contributing training gap.', created_by: PATCH83V_USER_ID, created_at: '2026-08-06T09:00:00.000Z', updated_at: '2026-08-07T09:00:00.000Z' };
const ovrDecisions = ovrGovernanceLinks.map(link => ({ id: link.current_decision_id, organization_id: PATCH83V_ORGANIZATION_ID, link_id: link.link_id, decision_type: 'confirmed', significance: link.significance, adherence_status: link.adherence_status, adequacy_status: link.adequacy_status, actor_id: PATCH83V_USER_ID, decided_at: '2026-08-07T08:00:00.000Z', rationale: 'Investigator confirmed against permitted evidence.', correction_reason: null, supersedes_decision_id: null }));

function selectedValue(url: URL, key: string) {
  const value = url.searchParams.get(key) ?? '';
  return value.startsWith('eq.') ? value.slice(3) : value;
}

async function fulfill(route: Route, response: unknown) {
  const length = Array.isArray(response) ? response.length : response ? 1 : 0;
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', 'content-range': length ? `0-${length - 1}/${length}` : '*/0' }, body: route.request().method() === 'HEAD' ? '' : JSON.stringify(response) });
}

export async function installUi5FixtureData(page: Page) {
  await page.route('**/rest/v1/**', async route => {
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.fallback();
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop() ?? '';
    const sourceId = selectedValue(url, 'source_entity_id');
    const ovrId = selectedValue(url, 'ovr_id');
    if (table === 'v_patch29_training_program_register') return fulfill(route, ui5TrainingPrograms);
    if (table === 'v_patch29_training_assignment_queue') return fulfill(route, ui5TrainingAssignments);
    if (table === 'v_patch29_sop_acknowledgment_gap') return fulfill(route, ui5AcknowledgmentGaps);
    if (table === 'v_patch29_competency_gap_dashboard') return fulfill(route, ui5CompetencyGaps);
    if (table === 'v_sop_training_compliance_matrix') return fulfill(route, ui5TrainingMatrix);
    if (table === 'v_ovr_summary') return fulfill(route, [{ organization_id: PATCH83V_ORGANIZATION_ID, total_reports: 18, open_reports: 15, under_quality_review: 5, corrective_actions_required: 9, sentinel_events: 3, near_miss_level_1: 3 }]);
    if (table === 'ovr_reports') return fulfill(route, ui5OvrReports);
    if (table === 'v_ovr_workflow_control_summary') return fulfill(route, [{ organization_id: PATCH83V_ORGANIZATION_ID, pending_supervisor_review: 3, pending_quality_review: 4, returned_for_clarification: 1, pending_evidence_review: 5, major_open_ovrs: 4, overdue_ovr_workflow_items: 2 }]);
    if (table === 'v_ovr_workflow_queue') return fulfill(route, ui5OvrReports.slice(0, 8).map((report, index) => ({ id: report.id, organization_id: report.organization_id, ovr_number: report.ovr_number, title: report.brief_description, department_name: report.departments?.name_en, owner_name: report.owner?.full_name_en, occurrence_date: report.occurrence_date, status: report.status, severity_level: report.severity_level, workflow_stage: report.status, due_date: `2026-09-${String(10 + index).padStart(2, '0')}`, is_overdue: index < 2, risk_level: index < 2 ? 'critical' : index < 5 ? 'high' : 'medium' })));
    if (table === 'v_f1_ovr_governed_version_links') return fulfill(route, ovrId === 'ovr-ui5-1' ? [{ link_id: 'legacy-f1-ovr-ui5-1', ovr_id: 'ovr-ui5-1', organization_id: PATCH83V_ORGANIZATION_ID, document_id: 'policy-1', document_type: 'policy', document_code: 'POL-001', document_title: 'Enterprise Clinical Governance Policy', version_id: 'policy-version-1', version_number: 2, version_label: '2.0', approved_at: '2026-01-10T09:00:00.000Z', approved_by: PATCH83V_USER_ID, effective_date: '2026-01-15', expiry_date: null, locked_at: '2026-01-10T09:00:00.000Z', is_current_version: true, superseded_by_version_id: null, created_by: PATCH83V_USER_ID, created_at: '2026-08-06T09:00:00.000Z', is_historical_version: false }] : []);
    if (table === 'v_f2_ovr_governance_feedback') return fulfill(route, []);
    if (table === 'v_current_governance_criteria_links' && sourceId.startsWith('ovr-ui5-')) return fulfill(route, sourceId === 'ovr-ui5-1' ? ovrGovernanceLinks : []);
    if (table === 'governance_linkage_reviews' && sourceId.startsWith('ovr-ui5-')) return fulfill(route, sourceId === 'ovr-ui5-1' ? [ovrReview] : []);
    if (table === 'governance_criteria_link_decisions' && (url.searchParams.get('link_id') || '').includes('ovr-ui5')) return fulfill(route, ovrDecisions);
    if (table === 'governance_criteria_link_lineage' && ((url.searchParams.get('parent_link_id') || '').includes('ovr-ui5') || (url.searchParams.get('child_link_id') || '').includes('ovr-ui5'))) return fulfill(route, []);
    if (table === 'governance_criteria_link_evidence' && (url.searchParams.get('decision_id') || '').includes('ovr-ui5')) return fulfill(route, []);
    return route.fallback();
  });
}
