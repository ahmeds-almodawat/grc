import type { Page, Route } from '@playwright/test';
import { PATCH83V_ORGANIZATION_ID, PATCH83V_USER_ID } from './patch83vTestHarness';

const departments = [
  { id: 'dept-quality', name_en: 'Quality & Patient Safety', name_ar: 'الجودة وسلامة المرضى' },
  { id: 'dept-clinical', name_en: 'Clinical Services', name_ar: 'الخدمات السريرية' },
  { id: 'dept-operations', name_en: 'Hospital Operations', name_ar: 'عمليات المستشفى' },
];
const owners = [
  { id: PATCH83V_USER_ID, full_name_en: 'UI Review Admin', full_name_ar: 'مسؤول مراجعة الواجهة' },
  { id: 'profile-clinical', full_name_en: 'Dr. Lina Haddad', full_name_ar: 'د. لينا حداد' },
  { id: 'profile-ops', full_name_en: 'Omar Al-Salem', full_name_ar: 'عمر السالم' },
];

const riskBlueprints = [
  ['RISK-CLN-014', 'Medication administration error', 'Clinical', 'critical', 25, 16, true, 'in_progress'],
  ['RISK-INF-009', 'Privileged access misuse', 'Information Security', 'high', 20, 12, true, 'planned'],
  ['RISK-GOV-021', 'Controlled document review delay', 'Governance', 'medium', 12, 8, false, 'in_progress'],
  ['RISK-OPS-017', 'Critical equipment interruption', 'Operational', 'high', 20, 15, true, 'delayed'],
  ['RISK-FIN-006', 'Revenue-cycle reconciliation error', 'Financial', 'medium', 9, 6, false, 'completed'],
  ['RISK-PEO-011', 'Specialist competency coverage', 'People', 'medium', 12, 6, false, 'planned'],
  ['RISK-CLN-028', 'Diagnostic result escalation delay', 'Clinical', 'critical', 25, 20, true, 'in_progress'],
  ['RISK-SUP-004', 'Essential supplier concentration', 'Supply Chain', 'high', 16, 12, true, 'planned'],
  ['RISK-DAT-013', 'Evidence retention integrity', 'Information Security', 'medium', 12, 9, false, 'in_progress'],
  ['RISK-REP-002', 'Patient experience deterioration', 'Strategic', 'low', 6, 4, false, 'not_required'],
] as const;

export const ui3Risks = riskBlueprints.map((entry, index) => {
  const department = departments[index % departments.length];
  const owner = owners[index % owners.length];
  const residualScore = entry[5];
  return {
    id: `risk-ui3-${index + 1}`,
    organization_id: PATCH83V_ORGANIZATION_ID,
    department_id: department.id,
    risk_code: entry[0],
    title: entry[1],
    description: index === 0
      ? 'Wrong-patient, wrong-dose, or omitted-dose exposure where independent verification and escalation controls are not consistently evidenced.'
      : 'Governed enterprise risk retained for deterministic UI-3 visual review.',
    category: entry[2],
    owner_id: owner.id,
    risk_owner_id: owner.id,
    treatment_owner_id: owner.id,
    likelihood: Math.max(1, Math.ceil(Number(entry[4]) / 5)),
    impact: 5,
    inherent_likelihood: Math.max(1, Math.ceil(Number(entry[4]) / 5)),
    inherent_impact: 5,
    residual_likelihood: Math.max(1, Math.ceil(residualScore / 5)),
    residual_impact: Math.min(5, Math.max(1, Math.ceil(residualScore / Math.max(1, Math.ceil(residualScore / 5))))),
    inherent_score: entry[4],
    residual_score: residualScore,
    risk_level: entry[3],
    response_type: 'mitigate',
    status: 'open',
    lifecycle_status: 'treatment_in_progress',
    appetite_threshold: 10,
    appetite_breached: entry[6],
    appetite_breach_reason: entry[6] ? 'Residual exposure exceeds the approved appetite threshold.' : null,
    treatment_required: entry[3] !== 'low',
    treatment_status: entry[7],
    treatment_plan_summary: 'Strengthen preventive control execution, evidence capture, and owner review.',
    treatment_due_date: index === 3 ? '2026-08-10' : '2026-10-15',
    next_review_date: index === 2 ? '2026-08-12' : '2026-09-30',
    review_overdue: index === 2,
    last_reviewed_at: '2026-08-18T09:00:00.000Z',
    departments: department,
    owner,
    risk_owner: owner,
  };
});

const obligationBlueprints = [
  ['OBL-CBAHI-MM-05', 'Safe medication administration and independent verification', 'CBAHI', 'CBAHI Hospital Standards', 'MM.5.2', 'critical', 'partial_compliance', 1, 1, false],
  ['OBL-MOH-IC-12', 'Communicable disease notification within statutory window', 'Ministry of Health', 'MOH Regulatory Manual', 'IC.12', 'high', 'compliant', 0, 0, false],
  ['OBL-PDPL-07', 'Personal data access and disclosure governance', 'SDAIA', 'Personal Data Protection Law', 'Article 7', 'critical', 'noncompliant', 2, 2, true],
  ['OBL-CBAHI-LD-04', 'Leadership accountability for quality and safety', 'CBAHI', 'CBAHI Hospital Standards', 'LD.4.1', 'high', 'compliant', 0, 0, false],
  ['OBL-SFDA-23', 'Medication storage temperature monitoring', 'SFDA', 'Medication Safety Code', '23.4', 'high', 'insufficient_evidence', 1, 1, false],
  ['OBL-ISO-7101-08', 'Healthcare quality management evaluation', 'ISO', 'ISO 7101:2023', '8.2', 'medium', 'compliant', 0, 0, false],
  ['OBL-MOH-EM-03', 'Emergency preparedness exercise and after-action review', 'Ministry of Health', 'Emergency Preparedness Standard', '3.6', 'high', 'partial_compliance', 1, 1, true],
  ['OBL-CBAHI-HR-09', 'Clinical competency validation and renewal', 'CBAHI', 'CBAHI Hospital Standards', 'HR.9.1', 'high', null, 0, 0, false],
  ['OBL-NCA-ECC-2', 'Cybersecurity identity and access management', 'NCA', 'Essential Cybersecurity Controls', '2-2', 'critical', 'compliant', 0, 0, false],
  ['OBL-MOH-REC-06', 'Clinical record retention and integrity', 'Ministry of Health', 'Health Records Standard', '6.3', 'medium', 'not_applicable', 0, 0, false],
] as const;

export const ui3Obligations = obligationBlueprints.map((entry, index) => ({
  id: `obligation-ui3-${index + 1}`,
  organization_id: PATCH83V_ORGANIZATION_ID,
  obligation_code: entry[0],
  title: entry[1],
  requirement_text: index === 0
    ? 'The organization shall implement independent verification, traceable administration records, variance escalation, and periodic effectiveness review for high-alert medication.'
    : 'The organization shall maintain governed evidence demonstrating conformity with the cited external requirement.',
  regulatory_body: entry[2],
  framework: entry[3],
  clause_reference: entry[4],
  applicability: 'applicable',
  owner_id: owners[index % owners.length].id,
  department_id: departments[index % departments.length].id,
  risk_level: entry[5],
  status: index === 7 ? 'not_started' : 'in_progress',
  review_frequency: 'annual',
  last_reviewed_at: index === 7 ? null : '2026-08-16T08:30:00.000Z',
  next_review_date: index === 6 ? '2026-08-10' : index === 4 ? '2026-09-04' : '2027-02-01',
  evidence_required: true,
  notes: null,
  latest_assessment_id: entry[6] ? `assessment-ui3-${index + 1}` : null,
  latest_assessment_code: entry[6] ? `ASM-2026-${String(index + 1).padStart(3, '0')}` : null,
  latest_assessment_date: entry[6] ? '2026-08-16' : null,
  latest_assessment_result: entry[6],
  latest_assessment_status: entry[6] ? 'approved' : null,
  open_finding_count: entry[7],
  open_remediation_count: entry[8],
  has_overdue_remediation: entry[9],
}));

const assessments = [
  {
    id: 'assessment-ui3-1', organization_id: PATCH83V_ORGANIZATION_ID, obligation_id: 'obligation-ui3-1', assessment_code: 'ASM-2026-001', assessment_title: 'Q3 high-alert medication compliance assessment', assessment_period_start: '2026-07-01', assessment_period_end: '2026-08-15', assessment_date: '2026-08-16', assessment_method: 'combined', scope_description: 'Inpatient, emergency, and critical-care medication administration samples.', department_id: 'dept-clinical', responsible_owner_id: 'profile-clinical', reviewer_id: PATCH83V_USER_ID, result: 'partial_compliance', workflow_status: 'in_review', conclusion_summary: 'Independent checks are designed appropriately; evidence completeness remains below target in two sampled units.', evidence_reference: 'EVD-MED-2026-044', evidence_file_id: 'evidence-ui3-1', governance_review_id: 'review-compliance-1', created_by: PATCH83V_USER_ID, reviewed_by: null, reviewed_at: null, approved_by: null, approved_at: null, created_at: '2026-08-16T08:30:00.000Z', updated_at: '2026-08-16T08:30:00.000Z',
  },
  {
    id: 'assessment-ui3-0', organization_id: PATCH83V_ORGANIZATION_ID, obligation_id: 'obligation-ui3-1', assessment_code: 'ASM-2026-000', assessment_title: 'Q2 high-alert medication baseline assessment', assessment_period_start: '2026-04-01', assessment_period_end: '2026-06-30', assessment_date: '2026-07-03', assessment_method: 'document_review', scope_description: 'Baseline document and evidence review.', department_id: 'dept-clinical', responsible_owner_id: 'profile-clinical', reviewer_id: PATCH83V_USER_ID, result: 'compliant', workflow_status: 'approved', conclusion_summary: 'The sampled evidence met the approved baseline.', evidence_reference: 'EVD-MED-2026-021', evidence_file_id: 'evidence-ui3-2', governance_review_id: 'review-compliance-0', created_by: PATCH83V_USER_ID, reviewed_by: PATCH83V_USER_ID, reviewed_at: '2026-07-04T09:00:00.000Z', approved_by: PATCH83V_USER_ID, approved_at: '2026-07-04T09:00:00.000Z', created_at: '2026-07-03T08:00:00.000Z', updated_at: '2026-07-04T09:00:00.000Z',
  },
];

const findings = [{
  id: 'finding-ui3-1', organization_id: PATCH83V_ORGANIZATION_ID, assessment_id: 'assessment-ui3-1', obligation_id: 'obligation-ui3-1', finding_code: 'FND-CMP-2026-017', finding_description: 'Independent double-check evidence was incomplete for 4 of 30 sampled high-alert medication administrations.', severity: 'high', materiality: 'major', finding_status: 'remediation_in_progress', responsible_owner_id: 'profile-clinical', department_id: 'dept-clinical', due_date: '2026-09-15', evidence_reference: 'EVD-MED-2026-044', evidence_file_id: 'evidence-ui3-1', root_cause_category: 'workflow_execution', root_cause_description: 'The bedside verification step is completed, but the electronic record requires a separate confirmation that is inconsistently captured.', created_by: PATCH83V_USER_ID, reviewed_by: PATCH83V_USER_ID, reviewed_at: '2026-08-17T10:00:00.000Z', closed_at: null, created_at: '2026-08-16T10:30:00.000Z',
}];

const remediations = [{
  id: 'remediation-ui3-1', organization_id: PATCH83V_ORGANIZATION_ID, finding_id: 'finding-ui3-1', action_code: 'REM-2026-031', action_description: 'Add a mandatory electronic co-signature checkpoint and validate completion in a 30-record follow-up sample.', owner_id: 'profile-clinical', due_date: '2026-09-15', action_status: 'in_progress', evidence_reference: 'EVD-REM-2026-009', evidence_file_id: 'evidence-ui3-3', completed_at: null, created_at: '2026-08-17T11:00:00.000Z',
}];

const riskControls = [
  { id: 'risk-control-1', risk_id: 'risk-ui3-1', control_code: 'CTRL-MED-01', title: 'Two patient identifiers and medication rights verification', description: 'Preventive bedside verification.', control_type: 'preventive', frequency: 'continuous', effectiveness: 'effective', design_effectiveness: 'effective', operating_effectiveness: 'effective', key_control: true, owner_id: 'profile-clinical', evidence_required: true, last_tested_at: '2026-07-20', next_test_date: '2026-10-20', is_active: true, created_at: '2026-01-01' },
  { id: 'risk-control-2', risk_id: 'risk-ui3-1', control_code: 'CTRL-MED-02', title: 'Independent high-alert medication double-check', description: 'Second authorized clinician verification.', control_type: 'preventive', frequency: 'continuous', effectiveness: 'partially_effective', design_effectiveness: 'effective', operating_effectiveness: 'partially_effective', key_control: true, owner_id: 'profile-clinical', evidence_required: true, last_tested_at: '2026-08-16', next_test_date: '2026-09-30', is_active: true, created_at: '2026-01-01' },
  { id: 'risk-control-3', risk_id: 'risk-ui3-1', control_code: 'CTRL-MED-03', title: 'Medication variance monitoring and escalation', description: 'Detective exception monitoring.', control_type: 'detective', frequency: 'monthly', effectiveness: 'effective', design_effectiveness: 'effective', operating_effectiveness: 'effective', key_control: false, owner_id: PATCH83V_USER_ID, evidence_required: true, last_tested_at: '2026-08-01', next_test_date: '2026-09-01', is_active: true, created_at: '2026-01-01' },
];
const riskTreatments = [
  { id: 'risk-treatment-1', risk_id: 'risk-ui3-1', title: 'Electronic independent-check hard stop', description: 'Require a second authenticated sign-off before administration.', owner_id: 'profile-clinical', due_date: '2026-09-15', status: 'in_progress', progress_percent: 68, evidence_required: true, delay_reason: null, created_at: '2026-05-01' },
  { id: 'risk-treatment-2', risk_id: 'risk-ui3-1', title: 'Targeted competency observation', description: 'Observe high-alert medication execution across sampled units.', owner_id: PATCH83V_USER_ID, due_date: '2026-10-01', status: 'planned', progress_percent: 25, evidence_required: true, delay_reason: null, created_at: '2026-06-01' },
];
const riskKris = [
  { id: 'risk-kri-1', risk_id: 'risk-ui3-1', kri_code: 'KRI-MED-01', name_en: 'Incomplete independent checks per 100 administrations', name_ar: 'عمليات التحقق المستقل غير المكتملة لكل 100 عملية إعطاء', current_value: 4.2, threshold_warning: 2, threshold_critical: 4, direction: 'lower_is_better', status: 'critical', measured_at: '2026-08-16', owner_id: 'profile-clinical' },
  { id: 'risk-kri-2', risk_id: 'risk-ui3-1', kri_code: 'KRI-MED-02', name_en: 'High-alert medication near misses', name_ar: 'حالات كادت أن تقع للأدوية عالية الخطورة', current_value: 3, threshold_warning: 3, threshold_critical: 6, direction: 'lower_is_better', status: 'warning', measured_at: '2026-08-15', owner_id: PATCH83V_USER_ID },
];
const riskHistory = [
  { id: 'risk-revision-ui3-1', organization_id: PATCH83V_ORGANIZATION_ID, risk_id: 'risk-ui3-1', previous_likelihood: 5, previous_impact: 5, previous_score: 25, new_likelihood: 5, new_impact: 5, new_score: 25, previous_residual_likelihood: 4, previous_residual_impact: 4, previous_residual_score: 16, new_residual_likelihood: 4, new_residual_impact: 4, new_residual_score: 16, change_reason: 'Quarterly review confirmed persistent exposure while electronic hard-stop remediation remains in progress.', changed_by: PATCH83V_USER_ID, changed_at: '2026-08-18T09:00:00.000Z', assessment_status: 'approved', governance_review_id: 'review-risk-revision-1', reviewed_by: PATCH83V_USER_ID, reviewed_at: '2026-08-18T12:00:00.000Z', review_rationale: 'Approved with exact document version snapshot.' },
  { id: 'risk-revision-ui3-0', organization_id: PATCH83V_ORGANIZATION_ID, risk_id: 'risk-ui3-1', previous_likelihood: 5, previous_impact: 5, previous_score: 25, new_likelihood: 5, new_impact: 5, new_score: 25, previous_residual_likelihood: 5, previous_residual_impact: 4, previous_residual_score: 20, new_residual_likelihood: 4, new_residual_impact: 4, new_residual_score: 16, change_reason: 'Independent verification control reduced likelihood by one band.', changed_by: PATCH83V_USER_ID, changed_at: '2026-05-18T09:00:00.000Z', assessment_status: 'approved', governance_review_id: 'review-risk-revision-0', reviewed_by: PATCH83V_USER_ID, reviewed_at: '2026-05-18T11:00:00.000Z', review_rationale: 'Approved after control evidence review.' },
];
const riskEvents = [
  { id: 'risk-event-1', organization_id: PATCH83V_ORGANIZATION_ID, risk_id: 'risk-ui3-1', from_status: 'assessed', to_status: 'treatment_in_progress', action: 'treatment_updated', note: 'Electronic hard-stop implementation moved to active delivery.', actor_id: PATCH83V_USER_ID, created_at: '2026-08-18T12:10:00.000Z' },
  { id: 'risk-event-2', organization_id: PATCH83V_ORGANIZATION_ID, risk_id: 'risk-ui3-1', from_status: 'identified', to_status: 'assessed', action: 'risk_reassessed', note: 'Residual scoring and Governance Context were reviewed.', actor_id: PATCH83V_USER_ID, created_at: '2026-08-18T09:00:00.000Z' },
];

const persistentRiskLinks = [
  linkFixture('link-risk-policy', 'risk', 'risk-ui3-1', null, 'policy', 'POL-001 · Enterprise Clinical Governance Policy', 'policy-1', null, 'confirmed', 'primary', 'complied', 'adequate', { version_label: null }),
  linkFixture('link-risk-sop', 'risk', 'risk-ui3-1', null, 'sop', 'SOP-001 · Safe Medication Administration Procedure', 'sop-1', null, 'confirmed', 'contributing', 'partial_adherence', 'implementation_gap', { version_label: null }),
  linkFixture('link-risk-restricted', 'risk', 'risk-ui3-1', null, 'policy', '[restricted]', 'policy-restricted', null, 'under_review', null, null, null, {}),
];
const revisionRiskLinks = [
  linkFixture('link-risk-revision-policy', 'risk', 'risk-ui3-1', 'risk-revision-ui3-1', 'policy', 'POL-001 · Enterprise Clinical Governance Policy', 'policy-1', 'policy-version-1', 'confirmed', 'primary', 'complied', 'adequate', { version_label: '2.0', version_effective_date: '2026-01-15' }),
  linkFixture('link-risk-revision-sop', 'risk', 'risk-ui3-1', 'risk-revision-ui3-1', 'sop_step', 'SOP-001 Step 03 · Independent double-check', 'sop-1', 'sop-version-1', 'confirmed', 'contributing', 'partial_adherence', 'implementation_gap', { version_label: '3.0', version_effective_date: '2026-02-01' }),
];
const complianceLinks = [
  linkFixture('link-cmp-obligation', 'compliance_assessment', 'assessment-ui3-1', null, 'compliance_obligation', 'OBL-CBAHI-MM-05 · Safe medication administration', null, null, 'confirmed', 'primary', 'complied', 'adequate', {}),
  linkFixture('link-cmp-policy', 'compliance_assessment', 'assessment-ui3-1', null, 'policy_requirement', 'POL-001 Requirement 03 · Independent verification governance', 'policy-1', 'policy-version-1', 'confirmed', 'primary', 'partial_adherence', 'adequate', { version_label: '2.0', version_effective_date: '2026-01-15' }),
  linkFixture('link-cmp-sop', 'compliance_assessment', 'assessment-ui3-1', null, 'sop_step', 'SOP-001 Step 03 · Independent double-check', 'sop-1', 'sop-version-1', 'confirmed', 'contributing', 'partial_adherence', 'implementation_gap', { version_label: '3.0', version_effective_date: '2026-02-01' }),
];

function linkFixture(id: string, sourceType: string, sourceId: string, revisionId: string | null, targetType: string, label: string, documentId: string | null, versionId: string | null, decisionType: string, significance: string | null, adherence: string | null, adequacy: string | null, snapshot: Record<string, unknown>) {
  return { link_id: id, organization_id: PATCH83V_ORGANIZATION_ID, review_id: `review-${id}`, source_entity_type: sourceType, source_entity_id: sourceId, source_revision_id: revisionId, root_source_entity_type: sourceType, root_source_entity_id: sourceId, target_criterion_type: targetType, target_document_id: documentId, target_version_id: versionId, target_policy_requirement_id: targetType === 'policy_requirement' ? 'policy-requirement-3' : null, target_sop_step_id: targetType === 'sop_step' ? 'sop-step-3' : null, target_compliance_obligation_id: targetType === 'compliance_obligation' ? 'obligation-ui3-1' : null, target_accreditation_clause_id: null, target_control_id: null, target_display_label: label, target_confidentiality_level: label === '[restricted]' ? 'restricted' : 'internal', relationship_origin: 'direct', resolution_date: '2026-08-16', resolution_method: versionId ? 'resolver_exact' : 'persistent_context', resolution_snapshot: snapshot, current_decision_id: `decision-${id}-current`, decision_type: decisionType, significance, adherence_status: adherence, adequacy_status: adequacy, inherited: false, root_event_key: `ROOT-${id.toUpperCase()}`, created_at: '2026-08-16T09:00:00.000Z' };
}

const allLinks = [...persistentRiskLinks, ...revisionRiskLinks, ...complianceLinks];
const reviews = [
  { id: 'review-risk-persistent', organization_id: PATCH83V_ORGANIZATION_ID, source_entity_type: 'risk', source_entity_id: 'risk-ui3-1', source_revision_id: null, source_date: '2026-08-18', applicability_date: '2026-08-18', review_status: 'completed', review_outcome: 'confirmed_relationship', uncertainty_recorded: false, reviewed_by: PATCH83V_USER_ID, reviewed_at: '2026-08-18T11:30:00.000Z', review_rationale: 'Persistent governance relationships confirmed for the active Risk.', created_by: PATCH83V_USER_ID, created_at: '2026-08-18T09:00:00.000Z', updated_at: '2026-08-18T11:30:00.000Z' },
  { id: 'review-risk-revision-1', organization_id: PATCH83V_ORGANIZATION_ID, source_entity_type: 'risk', source_entity_id: 'risk-ui3-1', source_revision_id: 'risk-revision-ui3-1', source_date: '2026-08-18', applicability_date: '2026-08-18', review_status: 'completed', review_outcome: 'confirmed_relationship', uncertainty_recorded: false, reviewed_by: PATCH83V_USER_ID, reviewed_at: '2026-08-18T12:00:00.000Z', review_rationale: 'Exact approved Policy and SOP versions retained for this reassessment.', created_by: PATCH83V_USER_ID, created_at: '2026-08-18T09:00:00.000Z', updated_at: '2026-08-18T12:00:00.000Z' },
  { id: 'review-compliance-1', organization_id: PATCH83V_ORGANIZATION_ID, source_entity_type: 'compliance_assessment', source_entity_id: 'assessment-ui3-1', source_revision_id: null, source_date: '2026-08-16', applicability_date: '2026-08-16', review_status: 'completed', review_outcome: 'document_gap', uncertainty_recorded: false, reviewed_by: PATCH83V_USER_ID, reviewed_at: '2026-08-17T09:30:00.000Z', review_rationale: 'Internal documents are adequate; electronic execution evidence has an implementation gap.', created_by: PATCH83V_USER_ID, created_at: '2026-08-16T09:00:00.000Z', updated_at: '2026-08-17T09:30:00.000Z' },
];
const decisions = allLinks.flatMap((item, index) => {
  const current = { id: `decision-${item.link_id}-current`, organization_id: PATCH83V_ORGANIZATION_ID, link_id: item.link_id, decision_type: item.decision_type, significance: item.significance, adherence_status: item.adherence_status, adequacy_status: item.adequacy_status, actor_id: PATCH83V_USER_ID, decided_at: '2026-08-17T09:00:00.000Z', rationale: item.decision_type === 'confirmed' ? 'Relationship confirmed against the governed source and permitted evidence.' : 'Pending reviewer determination.', correction_reason: index === 1 ? 'Corrected after additional evidence review.' : null, supersedes_decision_id: index === 1 ? `decision-${item.link_id}-original` : null };
  return index === 1 ? [{ ...current, id: `decision-${item.link_id}-original`, decision_type: 'rejected', decided_at: '2026-08-16T09:00:00.000Z', rationale: 'Initial evidence was incomplete.', correction_reason: null, supersedes_decision_id: null }, current] : [current];
});
const lineage = [{ parent_link_id: 'link-risk-policy', child_link_id: 'link-risk-revision-policy', lineage_type: 'derived_from', created_at: '2026-08-18T09:10:00.000Z' }];
const evidence = [{ decision_id: 'decision-link-cmp-sop-current', evidence_file_id: 'evidence-ui3-1', organization_id: PATCH83V_ORGANIZATION_ID, evidence_role: 'primary', added_by: PATCH83V_USER_ID, created_at: '2026-08-17T09:00:00.000Z' }];

const events = [
  { id: 'cmp-event-1', organization_id: PATCH83V_ORGANIZATION_ID, assessment_id: 'assessment-ui3-1', finding_id: null, remediation_action_id: null, event_type: 'assessment_created', from_status: null, to_status: 'draft', actor_id: PATCH83V_USER_ID, event_note: 'Assessment opened for Q3 review.', metadata: {}, created_at: '2026-08-16T08:30:00.000Z' },
  { id: 'cmp-event-2', organization_id: PATCH83V_ORGANIZATION_ID, assessment_id: 'assessment-ui3-1', finding_id: 'finding-ui3-1', remediation_action_id: null, event_type: 'finding_recorded', from_status: null, to_status: 'open', actor_id: PATCH83V_USER_ID, event_note: 'Evidence completeness gap recorded.', metadata: {}, created_at: '2026-08-16T10:30:00.000Z' },
  { id: 'cmp-event-3', organization_id: PATCH83V_ORGANIZATION_ID, assessment_id: 'assessment-ui3-1', finding_id: 'finding-ui3-1', remediation_action_id: 'remediation-ui3-1', event_type: 'remediation_created', from_status: null, to_status: 'planned', actor_id: PATCH83V_USER_ID, event_note: 'Electronic hard-stop remediation initiated.', metadata: {}, created_at: '2026-08-17T11:00:00.000Z' },
];

function selectedValue(url: URL, key: string) {
  const value = url.searchParams.get(key) ?? '';
  if (value.startsWith('eq.')) return value.slice(3);
  return value;
}

async function fulfill(route: Route, response: unknown) {
  const request = route.request();
  const length = Array.isArray(response) ? response.length : response ? 1 : 0;
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', 'content-range': length ? `0-${length - 1}/${length}` : '*/0' }, body: request.method() === 'HEAD' ? '' : JSON.stringify(response) });
}

export async function installUi3FixtureData(page: Page) {
  await page.route('**/rest/v1/**', async (route) => {
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.fallback();
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop() ?? '';
    const sourceId = selectedValue(url, 'source_entity_id');
    if (table === 'risks') return fulfill(route, ui3Risks);
    if (table === 'risk_controls') return fulfill(route, riskControls);
    if (table === 'risk_mitigation_actions') return fulfill(route, riskTreatments);
    if (table === 'risk_kri_indicators') return fulfill(route, riskKris);
    if (table === 'risk_reassessment_history') return fulfill(route, riskHistory);
    if (table === 'risk_workflow_events') return fulfill(route, riskEvents);
    if (table === 'v_ui3_compliance_obligation_register') return fulfill(route, ui3Obligations);
    if (table === 'compliance_obligations') return fulfill(route, ui3Obligations);
    if (table === 'compliance_assessments') return fulfill(route, assessments);
    if (table === 'compliance_findings') return fulfill(route, findings);
    if (table === 'compliance_remediation_actions') return fulfill(route, remediations);
    if (table === 'compliance_workflow_events') return fulfill(route, events);
    if (table === 'control_library_items') return fulfill(route, riskControls.map((item) => ({ id: item.id, control_code: item.control_code, title: item.title, control_type: item.control_type, is_active: item.is_active })));
    if (table === 'accreditation_clauses') return fulfill(route, [{ id: 'clause-ui3-1', clause_code: 'MM.5.2', clause_number: 'MM.5.2', clause_title: 'Safe medication administration', title: 'Safe medication administration', active: true }]);
    if (table === 'evidence_files') return fulfill(route, [{ id: 'evidence-ui3-1', file_name: 'High-alert medication sample review.pdf', file_type: 'application/pdf', description: 'Approved sampled evidence review.' }, { id: 'evidence-ui3-2', file_name: 'Medication governance approval.pdf', file_type: 'application/pdf', description: 'Governance approval record.' }, { id: 'evidence-ui3-3', file_name: 'Electronic hard-stop implementation plan.pdf', file_type: 'application/pdf', description: 'Remediation implementation evidence.' }]);
    if (table === 'v_current_governance_criteria_links') {
      const rows = sourceId ? allLinks.filter((item) => item.source_entity_id === sourceId) : allLinks;
      return fulfill(route, rows);
    }
    if (table === 'governance_linkage_reviews') {
      const revisionFilter = selectedValue(url, 'source_revision_id');
      return fulfill(route, reviews.filter((item) => item.source_entity_id === sourceId && (revisionFilter.startsWith('is.') ? item.source_revision_id === null : !revisionFilter || item.source_revision_id === revisionFilter)));
    }
    if (table === 'governance_criteria_link_decisions') return fulfill(route, decisions);
    if (table === 'governance_criteria_link_lineage') return fulfill(route, lineage);
    if (table === 'governance_criteria_link_evidence') return fulfill(route, evidence);
    return route.fallback();
  });
}
