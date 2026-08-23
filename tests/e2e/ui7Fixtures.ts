import type { Page, Route } from '@playwright/test';
import { PATCH83V_ORGANIZATION_ID, PATCH83V_USER_ID } from './patch83vTestHarness';

const REQUESTER_ID = '00000000-0000-4000-8000-000000000171';
const DELEGATOR_ID = '00000000-0000-4000-8000-000000000172';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000173';

const people = [
  { id: PATCH83V_USER_ID, full_name_en: 'UI Review Admin', full_name_ar: 'مسؤول مراجعة الواجهة' },
  { id: REQUESTER_ID, full_name_en: 'Dr. Lina Haddad', full_name_ar: 'د. لينا حداد' },
  { id: DELEGATOR_ID, full_name_en: 'Omar Al-Salem', full_name_ar: 'عمر السالم' },
  { id: OTHER_USER_ID, full_name_en: 'Noura Al-Harbi', full_name_ar: 'نورة الحربي' },
];

function approvalRequest(overrides: Record<string, unknown>) {
  return {
    id: '00000000-0000-4000-8000-000000000181',
    organization_id: PATCH83V_ORGANIZATION_ID,
    request_code: 'APR-2026-0181',
    workflow_type: 'document_control',
    linked_item_type: 'policy',
    linked_item_id: '00000000-0000-4000-8000-000000000191',
    action_type: 'publish',
    department_id: '00000000-0000-4000-8000-000000000081',
    requested_by: REQUESTER_ID,
    requested_at: '2026-08-20T08:00:00.000Z',
    request_reason: 'Approve the Clinical Governance Policy v4.2 for controlled publication',
    request_status: 'pending',
    required_approval_count: 1,
    received_approval_count: 0,
    authority_rule_id: '00000000-0000-4000-8000-000000000201',
    due_date: '2026-08-26',
    escalation_required: false,
    escalation_level_current: null,
    escalated_to: null,
    final_decision: null,
    final_decision_by: null,
    final_decision_at: null,
    final_decision_note: null,
    created_at: '2026-08-20T08:00:00.000Z',
    updated_at: '2026-08-20T08:00:00.000Z',
    ...overrides,
  };
}

export const ui7ApprovalRequests = [
  approvalRequest({}),
  approvalRequest({
    id: '00000000-0000-4000-8000-000000000182',
    request_code: 'APR-2026-0182',
    workflow_type: 'capa',
    linked_item_type: 'capa',
    linked_item_id: '00000000-0000-4000-8000-000000000192',
    action_type: 'close',
    request_reason: 'Approve effectiveness-review gate for CAPA-0042',
    requested_at: '2026-08-10T08:00:00.000Z',
    due_date: '2026-08-18',
    escalation_required: true,
    escalation_level_current: 'level_1',
    authority_rule_id: '00000000-0000-4000-8000-000000000202',
  }),
  approvalRequest({
    id: '00000000-0000-4000-8000-000000000183',
    request_code: 'APR-2026-0183',
    workflow_type: 'risk',
    linked_item_type: 'risk',
    linked_item_id: '00000000-0000-4000-8000-000000000193',
    action_type: 'accept',
    request_reason: 'Risk acceptance submitted by the signed-in actor',
    requested_by: PATCH83V_USER_ID,
    authority_rule_id: '00000000-0000-4000-8000-000000000203',
    due_date: '2026-08-28',
  }),
  approvalRequest({
    id: '00000000-0000-4000-8000-000000000184',
    request_code: 'APR-2026-0184',
    workflow_type: 'evidence',
    linked_item_type: 'evidence',
    linked_item_id: '00000000-0000-4000-8000-000000000194',
    action_type: 'verify',
    request_reason: 'Delegated verification of the medication control evidence pack',
    authority_rule_id: '00000000-0000-4000-8000-000000000204',
    due_date: '2026-08-25',
  }),
  approvalRequest({
    id: '00000000-0000-4000-8000-000000000185',
    request_code: 'APR-2026-0185',
    workflow_type: 'audit_finding',
    linked_item_type: 'audit_finding',
    linked_item_id: '00000000-0000-4000-8000-000000000195',
    action_type: 'close',
    request_reason: 'Audit finding AF-0026 closure decision',
    request_status: 'approved',
    received_approval_count: 1,
    final_decision: 'approved',
    final_decision_by: PATCH83V_USER_ID,
    final_decision_at: '2026-08-21T09:30:00.000Z',
    final_decision_note: 'Closure evidence independently verified.',
    due_date: '2026-08-22',
    authority_rule_id: '00000000-0000-4000-8000-000000000205',
  }),
  approvalRequest({
    id: '00000000-0000-4000-8000-000000000186',
    request_code: 'APR-2026-0186',
    workflow_type: 'compliance_obligation',
    linked_item_type: 'compliance_obligation',
    linked_item_id: '00000000-0000-4000-8000-000000000196',
    action_type: 'approve_assessment',
    request_reason: 'Return incomplete obligation assessment for correction',
    request_status: 'returned',
    received_approval_count: 1,
    final_decision: 'returned',
    final_decision_by: OTHER_USER_ID,
    final_decision_at: '2026-08-19T11:00:00.000Z',
    final_decision_note: 'Add the missing regulator source evidence.',
    authority_rule_id: '00000000-0000-4000-8000-000000000206',
  }),
  approvalRequest({
    id: '00000000-0000-4000-8000-000000000187',
    request_code: 'APR-2026-0187',
    workflow_type: 'project',
    linked_item_type: 'project',
    linked_item_id: '00000000-0000-4000-8000-000000000197',
    action_type: 'close',
    request_reason: 'Closed strategic project decision remains immutable',
    request_status: 'rejected',
    received_approval_count: 1,
    final_decision: 'rejected',
    final_decision_by: PATCH83V_USER_ID,
    final_decision_at: '2026-08-18T10:00:00.000Z',
    final_decision_note: 'Required evidence gate was not met.',
    authority_rule_id: '00000000-0000-4000-8000-000000000207',
  }),
];

export const ui7ApprovalRules = ui7ApprovalRequests.map((request, index) => ({
  id: request.authority_rule_id,
  organization_id: PATCH83V_ORGANIZATION_ID,
  workflow_type: request.workflow_type,
  action_type: request.action_type,
  department_id: request.department_id,
  approver_user_id: index === 3 ? DELEGATOR_ID : null,
  approver_role: index === 1 ? 'super_admin' : null,
  allow_self_approval: false,
  conflict_of_interest_block: true,
  active_flag: true,
  effective_date: '2026-01-01',
  expiry_date: null,
  rule_code: `RULE-UI7-${index + 1}`,
  rule_name: `UI-7 governed authority ${index + 1}`,
}));

export const ui7ApprovalStages = ui7ApprovalRequests.slice(0, 5).map((request, index) => ({
  id: `00000000-0000-4000-8000-00000000022${index}`,
  approval_request_id: request.id,
  stage_key: 'final_authority',
  stage_name: index === 3 ? 'Delegated evidence authority' : 'Final governed authority',
  stage_order: 1,
  assigned_user_id: index === 3 ? DELEGATOR_ID : index === 1 ? null : PATCH83V_USER_ID,
  assigned_role: index === 1 ? 'super_admin' : null,
  stage_status: request.request_status === 'pending' ? 'in_progress' : 'completed',
  allow_self_approval: false,
  required_decision_count: 1,
  received_decision_count: request.received_approval_count,
  started_at: request.requested_at,
  completed_at: request.final_decision_at,
}));

export const ui7ApprovalDelegations = [{
  id: '00000000-0000-4000-8000-000000000231',
  organization_id: PATCH83V_ORGANIZATION_ID,
  delegator_id: DELEGATOR_ID,
  delegate_id: PATCH83V_USER_ID,
  workflow_type: 'evidence',
  action_type: 'verify',
  department_id: null,
  effective_from: '2026-08-01T00:00:00.000Z',
  effective_to: '2026-09-01T00:00:00.000Z',
  delegation_reason: 'Planned leave with controlled evidence-review continuity.',
  active_flag: true,
  delegator_name: 'Omar Al-Salem',
  delegate_name: 'UI Review Admin',
}];

export const ui7ApprovalDecisions = [
  { decision_id: '00000000-0000-4000-8000-000000000241', approval_request_id: ui7ApprovalRequests[4].id, request_code: 'APR-2026-0185', workflow_type: 'audit_finding', action_type: 'close', linked_item_type: 'audit_finding', linked_item_id: ui7ApprovalRequests[4].linked_item_id, approver_id: PATCH83V_USER_ID, approver_name: 'UI Review Admin', approver_role: 'super_admin', decision: 'approved', decision_note: 'Closure evidence independently verified.', decided_at: '2026-08-21T09:30:00.000Z' },
  { decision_id: '00000000-0000-4000-8000-000000000242', approval_request_id: ui7ApprovalRequests[5].id, request_code: 'APR-2026-0186', workflow_type: 'compliance_obligation', action_type: 'approve_assessment', linked_item_type: 'compliance_obligation', linked_item_id: ui7ApprovalRequests[5].linked_item_id, approver_id: OTHER_USER_ID, approver_name: 'Noura Al-Harbi', approver_role: 'compliance_officer', decision: 'returned', decision_note: 'Add the missing regulator source evidence.', decided_at: '2026-08-19T11:00:00.000Z' },
  { decision_id: '00000000-0000-4000-8000-000000000243', approval_request_id: ui7ApprovalRequests[6].id, request_code: 'APR-2026-0187', workflow_type: 'project', action_type: 'close', linked_item_type: 'project', linked_item_id: ui7ApprovalRequests[6].linked_item_id, approver_id: PATCH83V_USER_ID, approver_name: 'UI Review Admin', approver_role: 'super_admin', decision: 'rejected', decision_note: 'Required evidence gate was not met.', decided_at: '2026-08-18T10:00:00.000Z' },
];

const workRow = (overrides: Record<string, unknown>) => ({
  source_module: 'training', work_type: 'training_assignment', work_id: 'work-ui7-1', work_title: 'Annual medication safety competency', work_description: 'Complete the governed competency assessment.', work_status: 'assigned', priority: 'high', assigned_to_user_id: PATCH83V_USER_ID, department_id: 'dept-quality', department_name: 'Quality & Patient Safety', due_date: '2026-08-17', created_at: '2026-08-01T08:00:00.000Z', is_overdue: true, waiting_for_review: false, is_escalated: false, linked_entity_id: 'training-ui7-1', linked_entity_type: 'training_program', ...overrides,
});

export const ui7MyWork = [
  workRow({}),
  workRow({ source_module: 'evidence_bridge', work_type: 'evidence_collection_request', work_id: 'work-ui7-2', work_title: 'Verify medication control evidence', work_description: 'Evidence pack is awaiting governed verification.', work_status: 'under_review', priority: 'high', due_date: '2026-08-25', is_overdue: false, waiting_for_review: true, linked_entity_id: 'evidence-ui7-1', linked_entity_type: 'evidence' }),
  workRow({ source_module: 'audit', work_type: 'audit_finding', work_id: 'work-ui7-3', work_title: 'Respond to audit finding AF-0026', work_description: 'Management response and accountable action are due.', work_status: 'action_required', priority: 'critical', due_date: '2026-08-27', is_overdue: false, linked_entity_id: 'audit-ui7-1', linked_entity_type: 'audit_finding' }),
  workRow({ source_module: 'capa', work_type: 'capa_action_item', work_id: 'work-ui7-4', work_title: 'Complete CAPA-0042 independent verification', work_description: 'Blocked until the source evidence owner submits the signed pack.', work_status: 'blocked', priority: 'high', due_date: '2026-08-20', is_overdue: true, is_escalated: true, linked_entity_id: 'capa-ui7-1', linked_entity_type: 'capa' }),
  workRow({ source_module: 'document', work_type: 'document_acknowledgment', work_id: 'work-ui7-5', work_title: 'Clinical Governance Policy acknowledgment', work_description: 'Acknowledgment completed and retained in source history.', work_status: 'completed', priority: null, due_date: '2026-08-21', is_overdue: false, linked_entity_id: 'policy-ui7-1', linked_entity_type: 'policy' }),
  workRow({ source_module: 'clinical_governance', work_type: 'governance_notice', work_id: 'work-ui7-6', work_title: 'Committee decision published for information', work_description: 'Informational notice; no action is available.', work_status: 'recorded', priority: 'low', due_date: null, is_overdue: false, linked_entity_id: 'notice-ui7-1', linked_entity_type: 'committee_decision' }),
];

export const ui7ProjectWork = [{
  id: 'task-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, item_type: 'task', title: 'Validate project milestone evidence gate', due_date: '2026-08-29', status: 'in_progress', progress_percent: 60, project_id: 'project-ui7-1', milestone_id: 'milestone-ui7-1', project_title: 'Enterprise Clinical Governance Upgrade', department_name: 'Quality & Patient Safety', departments: { name_en: 'Quality & Patient Safety', name_ar: 'الجودة وسلامة المرضى' }, assignment_id: 'assignment-ui7-1', assignment_status: 'accepted', assigned_at: '2026-08-12T08:00:00.000Z', responded_at: '2026-08-12T09:00:00.000Z', decline_reason: null, assigned_by_name: 'Dr. Lina Haddad',
}];

function governance(overrides: Record<string, unknown>) {
  return { link_id: 'gov-ui7-1', decision_type: 'confirmed', significance: 'violation', adherence_status: 'not_complied', adequacy_status: null, inherited: false, counts_as_violation: true, confirmed_noncompliance: true, confirmed_procedure_failure: false, document_inadequacy: false, training_gap: false, control_failure: false, relationship_origin: 'reviewer_confirmed', root_event_key: 'ovr:root-001', root_source_entity_type: 'ovr', root_source_entity_id: 'root-001', source_entity_type: 'ovr', source_entity_id: 'ovr-ui7-1', target_criterion_type: 'policy', target_document_id: 'policy-ui7-1', target_version_id: 'policy-version-ui7-42', target_display_label: 'POL-001 · Clinical Governance Policy v4.2', created_at: '2026-08-20T08:00:00.000Z', ...overrides };
}

export const ui7GovernanceTruth = [
  governance({}),
  governance({ link_id: 'gov-ui7-2', target_criterion_type: 'sop', target_document_id: 'sop-ui7-1', target_version_id: 'sop-version-ui7-31', target_display_label: 'SOP-014 · Medication Verification v3.1', adherence_status: 'procedure_not_followed', confirmed_noncompliance: false, confirmed_procedure_failure: true }),
  governance({ link_id: 'gov-ui7-3', source_entity_type: 'capa', source_entity_id: 'capa-ui7-1', inherited: true, relationship_origin: 'inherited_from_source', target_criterion_type: 'sop', target_document_id: 'sop-ui7-1', target_version_id: 'sop-version-ui7-31', target_display_label: 'SOP-014 · Medication Verification v3.1', adherence_status: 'procedure_not_followed', confirmed_noncompliance: false, confirmed_procedure_failure: true }),
  governance({ link_id: 'gov-ui7-4', decision_type: 'rejected', root_event_key: 'ovr:root-002', root_source_entity_id: 'root-002', relationship_origin: 'reporter_suggested', target_document_id: 'policy-ui7-2', target_display_label: 'POL-019 · Rejected suggestion' }),
  governance({ link_id: 'gov-ui7-5', decision_type: null, root_event_key: 'ovr:root-003', root_source_entity_id: 'root-003', relationship_origin: 'reporter_suggested', target_document_id: 'sop-ui7-2', target_criterion_type: 'sop', target_display_label: 'SOP-029 · Pending suggestion' }),
  governance({ link_id: 'gov-ui7-6', significance: 'context_only', root_event_key: 'ovr:root-004', root_source_entity_id: 'root-004', target_document_id: 'policy-ui7-3', target_display_label: 'POL-022 · Context relationship' }),
  governance({ link_id: 'gov-ui7-7', root_event_key: 'ovr:root-005', root_source_entity_id: 'root-005', adherence_status: 'complied', adequacy_status: 'control_failed_despite_compliance', counts_as_violation: false, confirmed_noncompliance: false, control_failure: true, document_inadequacy: true, target_document_id: 'policy-ui7-4', target_version_id: 'policy-version-ui7-40', target_display_label: 'POL-031 · High Alert Medication Control v4.0' }),
  governance({ link_id: 'gov-ui7-8', root_event_key: 'ovr:root-006', root_source_entity_id: 'root-006', adherence_status: 'complied', adequacy_status: 'training_competency_gap', counts_as_violation: false, confirmed_noncompliance: false, training_gap: true, document_inadequacy: true, target_criterion_type: 'sop', target_document_id: 'sop-ui7-3', target_version_id: 'sop-version-ui7-20', target_display_label: 'SOP-041 · Competency Escalation v2.0' }),
  governance({ link_id: 'gov-ui7-9', root_event_key: 'audit:root-007', root_source_entity_type: 'audit_finding', root_source_entity_id: 'root-007', source_entity_type: 'audit_finding', source_entity_id: 'audit-ui7-1', adherence_status: 'complied', adequacy_status: 'unclear', counts_as_violation: false, confirmed_noncompliance: false, document_inadequacy: true, target_document_id: 'policy-ui7-5', target_version_id: 'policy-version-ui7-11', target_display_label: 'POL-044 · Audit Response Governance v1.1' }),
  governance({ link_id: 'gov-ui7-10', root_event_key: 'ovr:root-008', root_source_entity_id: 'root-008', source_entity_id: 'ovr-ui7-repeat', target_criterion_type: 'sop', target_document_id: 'sop-ui7-1', target_version_id: 'sop-version-ui7-31', target_display_label: 'SOP-014 · Medication Verification v3.1', adherence_status: 'procedure_not_followed', confirmed_noncompliance: false, confirmed_procedure_failure: true, created_at: '2026-08-22T08:00:00.000Z' }),
];

export const ui7ReportTables: Record<string, unknown[]> = {
  v_confirmed_governance_criteria_truth: ui7GovernanceTruth,
  risks: [
    { id: 'risk-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Quality & Patient Safety', risk_code: 'RISK-0018', title: 'Medication verification control may fail under peak workload', status: 'active', risk_level: 'critical', inherent_score: 20, residual_score: 12, treatment_required: true, treatment_status: 'in_progress', treatment_due_date: '2026-08-15', updated_at: '2026-08-22T08:00:00.000Z' },
    { id: 'risk-ui7-2', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Compliance', risk_code: 'RISK-0024', title: 'Regulatory mapping ownership delay', status: 'active', risk_level: 'high', inherent_score: 16, residual_score: 8, treatment_required: true, treatment_status: 'in_progress', treatment_due_date: '2026-09-30', updated_at: '2026-08-21T08:00:00.000Z' },
  ],
  v_ui3_compliance_obligation_register: [
    { id: 'comp-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Compliance', obligation_code: 'OBL-0017', title: 'Quarterly regulator reporting obligation', status: 'active', latest_assessment_result: 'partially_compliant', next_review_date: '2026-09-10', updated_at: '2026-08-21T08:00:00.000Z' },
    { id: 'comp-ui7-2', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Clinical Services', obligation_code: 'OBL-0018', title: 'Clinical credential verification obligation', status: 'active', latest_assessment_result: 'compliant', next_review_date: '2026-10-10', updated_at: '2026-08-20T08:00:00.000Z' },
  ],
  compliance_remediation_actions: [{ id: 'rem-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Compliance', action_description: 'Complete regulator source mapping', action_status: 'in_progress', due_date: '2026-08-19', created_at: '2026-08-01T08:00:00.000Z' }],
  audit_findings: [{ id: 'audit-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Quality & Patient Safety', finding_code: 'AF-0026', finding_title: 'Independent closure evidence was incomplete', finding_status: 'open', severity: 'major', due_date: '2026-08-18', repeat_finding_flag: true, created_at: '2026-08-05T08:00:00.000Z' }],
  v_patch28_capa_register: [
    { id: 'capa-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Quality & Patient Safety', capa_code: 'CAPA-0042', capa_title: 'Medication verification corrective action', capa_status: 'in_progress', due_date: '2026-08-18', source_type: 'ovr', updated_at: '2026-08-22T08:00:00.000Z' },
    { id: 'capa-ui7-2', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Compliance', capa_code: 'CAPA-0043', capa_title: 'Regulatory mapping corrective action', capa_status: 'completed', due_date: '2026-08-10', source_type: 'audit', updated_at: '2026-08-20T08:00:00.000Z' },
  ],
  capa_effectiveness_reviews: [
    { id: 'effect-ui7-1', capa_id: 'capa-ui7-2', review_result: 'passed', created_at: '2026-08-21T08:00:00.000Z' },
    { id: 'effect-ui7-2', capa_id: 'capa-ui7-1', review_result: 'failed', recurrence_detected: true, created_at: '2026-08-22T08:00:00.000Z' },
  ],
  v_patch29_training_assignment_queue: [{ id: 'training-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Quality & Patient Safety', program_title: 'Medication safety competency refresher', status: 'assigned', due_date: '2026-08-17', assigned_at: '2026-08-01T08:00:00.000Z' }],
  v_patch29_competency_gap_dashboard: [{ id: 'competency-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Quality & Patient Safety', title: 'Medication verification competency gap', status: 'failed', assessed_at: '2026-08-18T08:00:00.000Z' }],
  ovr_reports: [
    { id: 'ovr-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Clinical Services', ovr_number: 'OVR-2026-001', brief_description: 'High alert medication verification event', status: 'under_review', severity_level: 'level_4', occurrence_date: '2026-08-19', created_at: '2026-08-19T08:00:00.000Z' },
    { id: 'ovr-ui7-repeat', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Clinical Services', ovr_number: 'OVR-2026-008', brief_description: 'Repeat event after CAPA effectiveness failure', status: 'under_review', severity_level: 'level_3', occurrence_date: '2026-08-22', created_at: '2026-08-22T08:00:00.000Z' },
  ],
  projects: [{ id: 'project-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Quality & Patient Safety', title: 'Enterprise Clinical Governance Upgrade', status: 'at_risk', source_type: 'strategic_goal', updated_at: '2026-08-22T08:00:00.000Z' }],
  milestones: [{ id: 'milestone-ui7-1', project_id: 'project-ui7-1', title: 'Independent evidence gate', status: 'in_progress', due_date: '2026-08-18', updated_at: '2026-08-22T08:00:00.000Z' }],
  tasks: [{ id: 'task-ui7-1', project_id: 'project-ui7-1', title: 'Validate project milestone evidence', status: 'in_progress', due_date: '2026-08-18', updated_at: '2026-08-22T08:00:00.000Z' }],
  v_patch23_evidence_review_queue: [{ id: 'evidence-ui7-1', organization_id: PATCH83V_ORGANIZATION_ID, department_name: 'Quality & Patient Safety', evidence_code: 'EVD-0042', evidence_title: 'Medication Control Validation Pack', review_status: 'pending_review', sensitivity_level: 'confidential', due_date: '2026-08-25', created_at: '2026-08-20T08:00:00.000Z' }],
  approval_requests: ui7ApprovalRequests,
  v_patch27_approval_decision_history: ui7ApprovalDecisions,
};

export interface Ui7FixtureProof {
  decisionRequests: Array<Record<string, unknown>>;
}

function requestJson(route: Route) {
  try { return JSON.parse(route.request().postData() || '{}') as Record<string, unknown>; }
  catch { return {}; }
}

async function fulfill(route: Route, response: unknown) {
  const rows = Array.isArray(response) ? response : response ? [response] : [];
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' }, body: route.request().method() === 'HEAD' ? '' : JSON.stringify(response) });
}

export async function installUi7FixtureData(page: Page, options: { unavailableTables?: string[] } = {}): Promise<Ui7FixtureProof> {
  const proof: Ui7FixtureProof = { decisionRequests: [] };
  const unavailable = new Set(options.unavailableTables ?? []);
  await page.route('**/functions/v1/**', async route => {
    const body = requestJson(route);
    if (body.action === 'f1r2_list_my_work') return fulfill(route, { ok: true, action: body.action, result: ui7ProjectWork });
    if (body.action === 'ui7_record_approval_decision') {
      proof.decisionRequests.push(body);
      return fulfill(route, { ok: true, action: body.action, result: { approval_request_id: body.approval_request_id, request_status: body.decision } });
    }
    return route.fallback();
  });
  await page.route('**/rest/v1/**', async route => {
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.fallback();
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop() ?? '';
    if (unavailable.has(table)) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Permission restricted test source.' }) });
    if (table === 'v_patch38_my_work_queue') return fulfill(route, ui7MyWork);
    if (table === 'v_patch27_active_approval_delegations') return fulfill(route, ui7ApprovalDelegations);
    if (table === 'v_patch27_active_authority_rules') return fulfill(route, ui7ApprovalRules);
    if (table === 'approval_request_stages') return fulfill(route, ui7ApprovalStages);
    if (table === 'profiles' && !(url.searchParams.get('select') ?? '').includes('organizations(name_en)')) return fulfill(route, people);
    if (table in ui7ReportTables) return fulfill(route, ui7ReportTables[table]);
    return route.fallback();
  });
  return proof;
}
