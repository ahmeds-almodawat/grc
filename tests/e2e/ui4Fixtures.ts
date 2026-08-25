import type { Page, Route } from '@playwright/test';
import { PATCH83V_ORGANIZATION_ID, PATCH83V_USER_ID } from './patch83vTestHarness';

const owners = [
  { id: PATCH83V_USER_ID, full_name_en: 'UI Review Admin', full_name_ar: 'مسؤول مراجعة الواجهة' },
  { id: 'profile-auditor', full_name_en: 'Omar Al-Qahtani', full_name_ar: 'عمر القحطاني' },
  { id: 'profile-it', full_name_en: 'Fatimah Al-Ghamdi', full_name_ar: 'فاطمة الغامدي' },
];
const departments = [
  { id: 'dept-audit', name_en: 'Internal Audit', name_ar: 'المراجعة الداخلية' },
  { id: 'dept-it', name_en: 'Information Technology', name_ar: 'تقنية المعلومات' },
  { id: 'dept-quality', name_en: 'Quality & Patient Safety', name_ar: 'الجودة وسلامة المرضى' },
];

const auditBlueprints = [
  ['F-2026-001', 'Inadequate access review process', 'IT General Controls', 'high', 'management_response_submitted', 'Access Management'],
  ['F-2026-002', 'Privileged accounts not monitored', 'IT General Controls', 'high', 'action_plan_in_progress', 'Access Management'],
  ['F-2026-003', 'Change management bypass', 'IT General Controls', 'medium', 'evidence_required', 'Change Management'],
  ['F-2026-004', 'Backup test not evidenced', 'Business Continuity Audit', 'medium', 'closure_requested', 'Backup & Recovery'],
  ['F-2026-005', 'Incident logging incomplete', 'Cybersecurity Audit', 'low', 'closed', 'Incident Management'],
  ['F-2026-006', 'Password policy exception', 'Cybersecurity Audit', 'medium', 'issued', 'Access Management'],
  ['F-2026-007', 'User access not deprovisioned', 'HR & Payroll Audit', 'high', 'management_response_required', 'Access Management'],
  ['F-2026-008', 'Shared accounts in use', 'Financial Statements Audit', 'low', 'closed', 'Financial Controls'],
] as const;

export const ui4AuditFindings = auditBlueprints.map((entry, index) => {
  const department = index % 2 ? departments[1] : departments[2];
  const owner = owners[index % owners.length];
  const closed = entry[4] === 'closed';
  return {
    id: `audit-finding-ui4-${index + 1}`,
    organization_id: PATCH83V_ORGANIZATION_ID,
    department_id: department.id,
    responsible_department_id: department.id,
    finding_code: entry[0],
    audit_title: entry[2],
    title: entry[1],
    description: index === 0 ? 'Access reviews are not performed periodically for all user accounts, including privileged and service accounts.' : 'The audit procedure identified a control execution gap requiring governed management response.',
    observed_condition: index === 0 ? 'Quarterly access certification omitted privileged and service identities in two sampled business applications.' : 'The sampled control did not retain complete execution evidence.',
    effect_impact: 'Increased risk of unauthorized access, incomplete accountability, or delayed issue detection.',
    recommendation: 'Implement an accountable control owner review, retain evidence, and verify effectiveness after remediation.',
    criteria: entry[5],
    finding_classification: index === 7 ? 'advisory_observation' : 'formal_finding',
    finding_date: `2026-06-${String(8 + index).padStart(2, '0')}`,
    audit_period_end_date: '2026-05-31',
    risk_level: entry[3],
    severity_level: entry[3],
    due_date: `2026-0${index < 4 ? '6' : '7'}-${String(20 + index).padStart(2, '0')}`,
    original_due_date: `2026-0${index < 4 ? '6' : '7'}-${String(20 + index).padStart(2, '0')}`,
    status: closed ? 'closed' : 'open',
    finding_status: entry[4],
    workflow_stage: closed ? 'closed' : entry[4].includes('response') ? 'management_response' : entry[4].includes('action') ? 'action_plan' : entry[4].includes('evidence') ? 'evidence' : 'closure_request',
    management_response_status: entry[4].includes('response_submitted') ? 'submitted' : closed ? 'accepted' : 'required',
    management_response: index === 0 ? 'Management agrees that the review population must include privileged and service identities.' : null,
    management_response_due_date: '2026-06-20',
    corrective_action_status: closed ? 'completed' : entry[4].includes('action') ? 'in_progress' : 'required',
    corrective_action_plan: index === 0 ? 'Automate the quarterly identity population and require owner certification.' : null,
    corrective_action_due_date: '2026-07-20',
    root_cause_summary: 'The control population is assembled manually and lacks an authoritative identity-source reconciliation.',
    root_cause: 'Manual population completeness control.',
    evidence_required: true,
    minimum_accepted_evidence_count: 1,
    evidence_gate_status: closed ? 'accepted' : 'pending',
    closure_validation_status: closed ? 'accepted' : 'not_requested',
    closed_at: closed ? '2026-07-15T10:00:00.000Z' : null,
    owner_id: owner.id,
    finding_owner_id: owner.id,
    audit_manager_id: 'profile-auditor',
    responsible_owner_id: owner.id,
    auditor_id: 'profile-auditor',
    created_by: 'profile-auditor',
    reviewed_by: 'profile-auditor',
    created_at: `2026-06-${String(8 + index).padStart(2, '0')}T09:00:00.000Z`,
    departments: department,
    owner,
  };
});

const auditContracts = ui4AuditFindings.map((finding, index) => ({
  organization_id: PATCH83V_ORGANIZATION_ID,
  audit_finding_id: finding.id,
  finding_code: finding.finding_code,
  finding_classification: finding.finding_classification,
  finding_date: finding.finding_date,
  audit_period_end_date: finding.audit_period_end_date,
  criteria_resolution_date: finding.audit_period_end_date,
  confirmed_criterion_count: index === 5 ? 0 : 2,
  dispute_count: index === 0 ? 1 : 0,
  criterion_gate_satisfied: index !== 5 || finding.finding_classification === 'advisory_observation',
}));

const auditDisputes = [{
  id: 'audit-dispute-ui4-1', organization_id: PATCH83V_ORGANIZATION_ID,
  audit_finding_id: 'audit-finding-ui4-1', governance_link_id: 'link-audit-policy',
  dispute_type: 'scope_correction',
  dispute_statement: 'Management confirms the issue but requests the sampled application scope be stated explicitly.',
  proposed_correction: 'Limit the condition to the two sampled business applications.',
  evidence_reference: 'EVD-AUD-2026-041', created_by: PATCH83V_USER_ID, created_at: '2026-06-18T09:00:00.000Z',
}];

const capaBlueprints = [
  ['CAPA-2026-001', 'Access control review', 'corrective_action', 'audit_finding', 'high', 'in_progress', 5, 3],
  ['CAPA-2026-002', 'Supplier assessment update', 'corrective_action', 'compliance_finding', 'medium', 'action_plan_approved', 4, 2],
  ['CAPA-2026-003', 'Data backup verification', 'corrective_action', 'audit_finding', 'high', 'effectiveness_review_pending', 4, 4],
  ['CAPA-2026-004', 'User provisioning cleanup', 'correction', 'ovr', 'critical', 'overdue', 5, 2],
  ['CAPA-2026-005', 'Policy communication', 'preventive_action', 'internal_issue', 'medium', 'closed', 3, 3],
  ['CAPA-2026-006', 'Incident response training', 'corrective_action', 'risk', 'high', 'completion_submitted', 4, 4],
  ['CAPA-2026-007', 'Vendor oversight review', 'preventive_action', 'compliance_assessment', 'low', 'draft', 2, 0],
  ['CAPA-2026-008', 'Risk assessment process', 'improvement_action', 'risk', 'medium', 'closure_requested', 4, 4],
  ['CAPA-2026-009', 'Evidence retention control', 'corrective_action', 'audit_finding', 'high', 'validation_rejected', 3, 3],
  ['CAPA-2026-010', 'Emergency exercise follow-up', 'effectiveness_action', 'compliance_finding', 'medium', 'effectiveness_review_passed', 4, 4],
] as const;

export const ui4Capas = capaBlueprints.map((entry, index) => ({
  id: `capa-ui4-${index + 1}`, organization_id: PATCH83V_ORGANIZATION_ID,
  capa_code: entry[0], capa_title: entry[1],
  capa_description: index === 0 ? 'Review and remediate incomplete privileged-access certification across critical systems.' : 'Governed corrective and preventive action retained for deterministic UI-4 review.',
  capa_type: entry[2], source_type: entry[3],
  source_id: entry[3] === 'audit_finding' ? `audit-finding-ui4-${Math.min(index + 1, 8)}` : `source-ui4-${index + 1}`,
  source_reference: entry[3] === 'audit_finding' ? ui4AuditFindings[Math.min(index, 7)].finding_code : `SRC-${String(index + 1).padStart(3, '0')}`,
  department_id: departments[index % departments.length].id,
  department_name: departments[index % departments.length].name_en,
  capa_owner_id: owners[index % owners.length].id,
  capa_owner_name: owners[index % owners.length].full_name_en,
  action_owner_id: owners[index % owners.length].id,
  action_owner_name: owners[index % owners.length].full_name_en,
  reviewer_id: 'profile-auditor', reviewer_name: 'Omar Al-Qahtani', approver_id: PATCH83V_USER_ID, approver_name: 'UI Review Admin',
  validator_id: 'profile-auditor', effectiveness_reviewer_id: 'profile-auditor',
  severity_level: entry[4], risk_level: entry[4], priority_level: entry[4],
  root_cause_category: 'control_execution', root_cause_summary: 'The source control lacked an authoritative completeness check and retained evidence.',
  containment_summary: 'Restrict elevated changes until the population is reconciled.', correction_summary: 'Reconcile current access and remove unsupported identities.',
  corrective_action_summary: 'Automate source population, owner certification, and exception escalation.', preventive_action_summary: 'Monitor completion and repeat-issue signals quarterly.',
  capa_status: entry[5], workflow_stage: entry[5], due_date: index === 3 ? '2026-08-10' : `2026-09-${String(10 + index).padStart(2, '0')}`,
  revised_due_date: null, completion_due_date: '2026-09-30', started_at: '2026-06-15T09:00:00.000Z',
  completed_at: entry[5] === 'closed' ? '2026-08-01T09:00:00.000Z' : null,
  completion_submitted_at: ['completion_submitted','effectiveness_review_pending','effectiveness_review_passed','closure_requested','closed'].includes(entry[5]) ? '2026-08-05T09:00:00.000Z' : null,
  validation_required: true, validation_status: ['effectiveness_review_pending','effectiveness_review_passed','closure_requested','closed'].includes(entry[5]) ? 'approved' : entry[5] === 'validation_rejected' ? 'rejected' : 'pending',
  validation_note: null, validation_rejection_reason: entry[5] === 'validation_rejected' ? 'Evidence population is incomplete.' : null,
  effectiveness_review_required: true, effectiveness_review_due_date: '2026-09-15',
  effectiveness_review_status: entry[5] === 'closed' || entry[5] === 'effectiveness_review_passed' || entry[5] === 'closure_requested' ? 'passed' : 'pending',
  effectiveness_review_completed_at: entry[5] === 'closed' ? '2026-08-20T09:00:00.000Z' : null,
  evidence_required: true, minimum_accepted_evidence_count: 1,
  evidence_gate_status: ['effectiveness_review_pending','effectiveness_review_passed','closure_requested','closed'].includes(entry[5]) ? 'accepted' : 'pending',
  action_item_count: entry[6], completed_action_item_count: entry[7],
  closure_requested_at: ['closure_requested','closed'].includes(entry[5]) ? '2026-08-21T09:00:00.000Z' : null,
  closed_at: entry[5] === 'closed' ? '2026-08-22T09:00:00.000Z' : null,
  closure_rejection_reason: null, closure_blocker: null,
  overdue_flag: entry[5] === 'overdue', overdue_days: entry[5] === 'overdue' ? 12 : 0,
  escalation_required: entry[5] === 'overdue', executive_visible: entry[4] === 'critical', repeat_issue_flag: index === 8,
  reopen_reason: null, created_by: PATCH83V_USER_ID, created_at: `2026-06-${String(10 + index).padStart(2, '0')}T09:00:00.000Z`, updated_at: '2026-08-22T09:00:00.000Z',
}));

const actionItems = ui4Capas.flatMap((capa, capaIndex) => Array.from({ length: Math.min(capa.action_item_count, 5) }, (_, index) => ({
  id: `capa-action-${capaIndex + 1}-${index + 1}`, capa_id: capa.id,
  action_item_code: `ACT-${capaIndex + 1}-${index + 1}`,
  action_item_title: ['Review current user roles','Identify excessive access','Define required access matrix','Remove excessive access','Obtain management approval'][index],
  action_item_description: 'Execute the approved action and retain evidence of completion.',
  action_owner_id: owners[index % owners.length].id, department_id: departments[index % departments.length].id,
  priority_level: index < 2 ? 'high' : 'medium', due_date: `2026-09-${String(5 + index * 4).padStart(2, '0')}`,
  status: index < capa.completed_action_item_count ? 'completed' : index === capa.completed_action_item_count ? 'in_progress' : 'open',
  progress_percent: index < capa.completed_action_item_count ? 100 : index === capa.completed_action_item_count ? 45 : 0,
  completion_note: index < capa.completed_action_item_count ? 'Completion evidence retained.' : null,
  completed_at: index < capa.completed_action_item_count ? '2026-08-18T09:00:00.000Z' : null,
  evidence_required: true, evidence_gate_status: index < capa.completed_action_item_count ? 'accepted' : 'pending',
  created_at: '2026-06-20T09:00:00.000Z', updated_at: '2026-08-22T09:00:00.000Z',
})));

const capaEvents = ui4Capas.flatMap((capa) => [
  { id: `event-${capa.id}-1`, capa_id: capa.id, action_item_id: null, event_type: 'created', from_status: null, to_status: 'draft', actor_id: PATCH83V_USER_ID, event_note: 'CAPA created from governed source.', rejection_reason: null, created_at: capa.created_at },
  { id: `event-${capa.id}-2`, capa_id: capa.id, action_item_id: null, event_type: 'assigned', from_status: 'draft', to_status: 'assigned', actor_id: PATCH83V_USER_ID, event_note: 'Accountable owner assigned.', rejection_reason: null, created_at: '2026-06-21T09:00:00.000Z' },
]);

const effectivenessReviews = ui4Capas.map((capa, index) => ({
  id: `effectiveness-${index + 1}`, capa_id: capa.id, review_due_date: '2026-09-15', reviewer_id: 'profile-auditor',
  review_method: 'Review of system access reports and repeat-issue monitoring after implementation.',
  review_result: capa.effectiveness_review_status === 'passed' ? 'effective' : 'pending',
  review_note: capa.effectiveness_review_status === 'passed' ? 'No exceptions identified in the verification sample.' : null,
  evidence_required: true, completed_at: capa.effectiveness_review_status === 'passed' ? '2026-08-20T09:00:00.000Z' : null,
  created_at: '2026-08-01T09:00:00.000Z',
}));

const closureBlockers = ui4Capas.map((capa) => {
  const complete = capa.completed_action_item_count >= capa.action_item_count;
  const evidence = capa.evidence_gate_status === 'accepted';
  const validation = capa.validation_status === 'approved';
  const effectiveness = capa.effectiveness_review_status === 'passed';
  return {
    organization_id: PATCH83V_ORGANIZATION_ID, capa_id: capa.id, capa_code: capa.capa_code, capa_title: capa.capa_title, capa_status: capa.capa_status,
    has_incomplete_action_items: !complete, has_evidence_blocker: !evidence, has_validation_blocker: !validation,
    has_effectiveness_blocker: !effectiveness, blocker_reason: !complete ? 'incomplete_action_items' : !evidence ? 'evidence_gate_not_satisfied' : !validation ? 'validation_approval_required' : !effectiveness ? 'effectiveness_review_not_passed' : null,
    can_close: complete && evidence && validation && effectiveness,
  };
});

const governanceLinks = [
  linkFixture('link-audit-policy', 'audit_finding', 'audit-finding-ui4-1', 'policy_requirement', 'POL-IT-004 Requirement 4.2 · Quarterly access review', 'policy-1', 'policy-version-1', false),
  linkFixture('link-audit-sop', 'audit_finding', 'audit-finding-ui4-1', 'sop_step', 'SOP-IT-009 Step 03 · Identity population reconciliation', 'sop-1', 'sop-version-1', false),
  linkFixture('link-capa-policy', 'capa', 'capa-ui4-1', 'policy_requirement', 'POL-IT-004 Requirement 4.2 · Quarterly access review', 'policy-1', 'policy-version-1', true),
  linkFixture('link-capa-sop', 'capa', 'capa-ui4-1', 'sop_step', 'SOP-IT-009 Step 03 · Identity population reconciliation', 'sop-1', 'sop-version-1', true),
];

function linkFixture(id: string, sourceType: string, sourceId: string, targetType: string, label: string, documentId: string, versionId: string, inherited: boolean) {
  return {
    link_id: id, organization_id: PATCH83V_ORGANIZATION_ID, review_id: `review-${sourceType}-${sourceId}`,
    source_entity_type: sourceType, source_entity_id: sourceId, source_revision_id: null,
    root_source_entity_type: inherited ? 'audit_finding' : sourceType,
    root_source_entity_id: inherited ? 'audit-finding-ui4-1' : sourceId,
    target_criterion_type: targetType, target_document_id: documentId, target_version_id: versionId,
    target_policy_requirement_id: targetType === 'policy_requirement' ? 'policy-requirement-3' : null,
    target_sop_step_id: targetType === 'sop_step' ? 'sop-step-3' : null,
    target_compliance_obligation_id: null, target_accreditation_clause_id: null, target_control_id: null,
    target_display_label: label, target_confidentiality_level: 'internal', relationship_origin: inherited ? 'inherited' : 'direct',
    resolution_date: '2026-05-31', resolution_method: inherited ? 'inherited' : 'resolver_exact',
    resolution_snapshot: { version_label: '2.0', version_effective_date: '2026-01-15' },
    current_decision_id: `decision-${id}`, decision_type: 'confirmed', significance: 'primary',
    adherence_status: 'noncompliance', adequacy_status: 'adequate', inherited,
    root_event_key: 'ROOT-AUDIT-FINDING-UI4-1', created_at: '2026-06-10T09:00:00.000Z',
  };
}

const governanceReviews = [
  { id: 'review-audit_finding-audit-finding-ui4-1', organization_id: PATCH83V_ORGANIZATION_ID, source_entity_type: 'audit_finding', source_entity_id: 'audit-finding-ui4-1', source_revision_id: null, source_date: '2026-05-31', applicability_date: '2026-05-31', review_status: 'completed', review_outcome: 'confirmed_relationship', uncertainty_recorded: false, reviewed_by: 'profile-auditor', reviewed_at: '2026-06-12T09:00:00.000Z', review_rationale: 'Auditor confirmed exact governed criteria.', created_by: 'profile-auditor', created_at: '2026-06-10T09:00:00.000Z', updated_at: '2026-06-12T09:00:00.000Z' },
  { id: 'review-capa-capa-ui4-1', organization_id: PATCH83V_ORGANIZATION_ID, source_entity_type: 'capa', source_entity_id: 'capa-ui4-1', source_revision_id: null, source_date: '2026-06-10', applicability_date: '2026-06-10', review_status: 'under_review', review_outcome: null, uncertainty_recorded: false, reviewed_by: null, reviewed_at: null, review_rationale: 'Inherited source governance links.', created_by: PATCH83V_USER_ID, created_at: '2026-06-10T09:00:00.000Z', updated_at: '2026-06-10T09:00:00.000Z' },
];
const decisions = governanceLinks.map((link) => ({ id: link.current_decision_id, organization_id: PATCH83V_ORGANIZATION_ID, link_id: link.link_id, decision_type: 'confirmed', significance: 'primary', adherence_status: 'noncompliance', adequacy_status: 'adequate', actor_id: 'profile-auditor', decided_at: '2026-06-12T09:00:00.000Z', rationale: link.inherited ? 'Inherited source determination.' : 'Auditor confirmed exact criterion.', correction_reason: null, supersedes_decision_id: null }));
const lineage = [{ parent_link_id: 'link-audit-policy', child_link_id: 'link-capa-policy', lineage_type: 'inherited_from', created_at: '2026-06-20T09:00:00.000Z' }, { parent_link_id: 'link-audit-sop', child_link_id: 'link-capa-sop', lineage_type: 'inherited_from', created_at: '2026-06-20T09:00:00.000Z' }];

function selectedValue(url: URL, key: string) {
  const value = url.searchParams.get(key) ?? '';
  return value.startsWith('eq.') ? value.slice(3) : value;
}

async function fulfill(route: Route, response: unknown) {
  const length = Array.isArray(response) ? response.length : response ? 1 : 0;
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', 'content-range': length ? `0-${length - 1}/${length}` : '*/0' }, body: route.request().method() === 'HEAD' ? '' : JSON.stringify(response) });
}

export async function installUi4FixtureData(page: Page) {
  await page.route('**/rest/v1/**', async (route) => {
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.fallback();
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop() ?? '';
    const sourceId = selectedValue(url, 'source_entity_id');
    const findingId = selectedValue(url, 'audit_finding_id');
    const capaId = selectedValue(url, 'capa_id');
    if (table === 'audit_findings') return fulfill(route, ui4AuditFindings);
    if (table === 'v_patch24_audit_finding_workflow_queue') return fulfill(route, ui4AuditFindings.filter((finding) => finding.finding_status !== 'closed').map((finding) => ({ ...finding, audit_finding_id: finding.id })));
    if (table === 'v_patch24_overdue_audit_findings') return fulfill(route, ui4AuditFindings.slice(1, 4).map((finding, index) => ({ ...finding, audit_finding_id: finding.id, days_overdue: index + 3 })));
    if (table === 'v_patch24_audit_closure_gate_status') return fulfill(route, ui4AuditFindings.map((finding, index) => ({ organization_id: PATCH83V_ORGANIZATION_ID, audit_finding_id: finding.id, finding_code: finding.finding_code, title: finding.title, finding_status: finding.finding_status, workflow_stage: finding.workflow_stage, severity_level: finding.severity_level, evidence_required: true, minimum_accepted_evidence_count: 1, accepted_evidence_count: index === 4 || index === 7 ? 1 : 0, approved_waiver_count: 0, waiver_approved_at: null, evidence_gate_status: index === 4 || index === 7 ? 'accepted' : 'pending', can_close: index === 4 || index === 7, closure_blocker: index === 4 || index === 7 ? null : 'Accepted evidence and independent validation are required.', closure_requested_at: null, closure_validation_status: finding.closure_validation_status })));
    if (table === 'audit_finding_validation_events') return fulfill(route, findingId ? [{ id: `audit-event-${findingId}`, organization_id: PATCH83V_ORGANIZATION_ID, audit_finding_id: findingId, validation_type: 'finding_issued', from_status: 'draft', to_status: 'issued', actor_id: 'profile-auditor', note: 'Finding issued after independent criteria review.', created_at: '2026-06-15T09:00:00.000Z' }] : []);
    if (table === 'v_ui4_audit_criteria_contract') return fulfill(route, auditContracts);
    if (table === 'audit_finding_criteria_disputes') return fulfill(route, auditDisputes.filter((row) => !findingId || row.audit_finding_id === findingId));
    if (table === 'v_patch28_capa_register') return fulfill(route, ui4Capas);
    if (table === 'capa_action_items') return fulfill(route, actionItems.filter((row) => !capaId || row.capa_id === capaId));
    if (table === 'capa_events') return fulfill(route, capaEvents.filter((row) => !capaId || row.capa_id === capaId));
    if (table === 'capa_effectiveness_reviews') return fulfill(route, effectivenessReviews.filter((row) => !capaId || row.capa_id === capaId));
    if (table === 'v_patch28_capa_closure_blockers') return fulfill(route, closureBlockers.filter((row) => !capaId || row.capa_id === capaId));
    if (table === 'v_patch28_capa_link_index') return fulfill(route, ui4Capas.filter((row) => !capaId || row.id === capaId).map((row) => ({ link_id: `source-link-${row.id}`, organization_id: row.organization_id, capa_id: row.id, capa_code: row.capa_code, capa_title: row.capa_title, linked_item_type: row.source_type, linked_item_id: row.source_id, link_type: 'source', required_flag: true, created_by: PATCH83V_USER_ID, created_at: row.created_at })));
    if (table === 'v_current_governance_criteria_links') return fulfill(route, governanceLinks.filter((row) => !sourceId || row.source_entity_id === sourceId));
    if (table === 'governance_linkage_reviews') return fulfill(route, governanceReviews.filter((row) => !sourceId || row.source_entity_id === sourceId));
    if (table === 'governance_criteria_link_decisions') return fulfill(route, decisions);
    if (table === 'governance_criteria_link_lineage') return fulfill(route, lineage);
    if (table === 'governance_criteria_link_evidence') return fulfill(route, []);
    return route.fallback();
  });
}
