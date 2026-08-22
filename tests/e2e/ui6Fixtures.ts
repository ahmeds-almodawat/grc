import type { Page, Route } from '@playwright/test';
import { PATCH83V_ORGANIZATION_ID, PATCH83V_USER_ID } from './patch83vTestHarness';

const people = [
  { id: PATCH83V_USER_ID, en: 'UI Review Admin', ar: 'مسؤول مراجعة الواجهة' },
  { id: 'profile-lina-ui6', en: 'Dr. Lina Haddad', ar: 'د. لينا حداد' },
  { id: 'profile-omar-ui6', en: 'Omar Al-Salem', ar: 'عمر السالم' },
  { id: 'profile-noura-ui6', en: 'Noura Al-Harbi', ar: 'نورة الحربي' },
  { id: 'profile-maha-ui6', en: 'Maha Al-Rashid', ar: 'مها الراشد' },
];

const departments = [
  { id: 'dept-quality', name_en: 'Quality & Patient Safety', name_ar: 'الجودة وسلامة المرضى' },
  { id: 'dept-clinical', name_en: 'Clinical Services', name_ar: 'الخدمات السريرية' },
  { id: 'dept-it', name_en: 'Digital Transformation', name_ar: 'التحول الرقمي' },
  { id: 'dept-compliance', name_en: 'Compliance', name_ar: 'الامتثال' },
];

const projectBlueprints = [
  { title: 'Enterprise Clinical Governance Upgrade', category: 'governance', source: 'strategic_goal', status: 'active', risk: 'medium', progress: 72, start: '2026-07-01', end: '2026-11-30', owner: 1, sponsor: 0, department: 0 },
  { title: 'Medication Safety Control Hardening', category: 'patient_safety', source: 'risk', status: 'active', risk: 'high', progress: 58, start: '2026-08-01', end: '2026-12-20', owner: 2, sponsor: 1, department: 1 },
  { title: 'Internal Audit Finding Remediation', category: 'assurance', source: 'audit_finding', status: 'at_risk', risk: 'high', progress: 41, start: '2026-06-15', end: '2026-10-15', owner: 3, sponsor: 0, department: 0 },
  { title: 'Regulatory Obligations Data Renewal', category: 'compliance', source: 'compliance_requirement', status: 'delayed', risk: 'critical', progress: 34, start: '2026-05-01', end: '2026-09-30', owner: 4, sponsor: 0, department: 3, delay: 'Regulator source-file mapping requires validated ownership before the remaining obligations can migrate.' },
  { title: 'CAPA-0042 Corrective Action Delivery', category: 'corrective_action', source: 'manual', status: 'active', risk: 'medium', progress: 66, start: '2026-07-15', end: '2026-11-12', owner: 1, sponsor: 0, department: 0 },
  { title: 'OVR High-Alert Medication Follow-up', category: 'corrective_action', source: 'incident_ovr', status: 'active', risk: 'high', progress: 49, start: '2026-08-10', end: '2026-12-15', owner: 2, sponsor: 1, department: 1 },
  { title: 'Policy and SOP Control Alignment', category: 'document_governance', source: 'policy_gap', status: 'closed', risk: 'low', progress: 100, start: '2026-03-01', end: '2026-07-31', owner: 4, sponsor: 0, department: 3 },
  { title: 'Enterprise Evidence Repository Rollout', category: 'digital_transformation', source: 'ceo_decision', status: 'draft', risk: 'medium', progress: 0, start: '2026-10-01', end: '2027-02-28', owner: 3, sponsor: 0, department: 2 },
] as const;

export const ui6Projects = projectBlueprints.map((project, index) => ({
  id: `project-ui6-${index + 1}`,
  organization_id: PATCH83V_ORGANIZATION_ID,
  division_id: null,
  department_id: departments[project.department].id,
  unit_id: null,
  title: project.title,
  description: `Governed delivery record for ${project.title.toLowerCase()}, with accountable ownership and source lineage.`,
  category: project.category,
  source_type: project.source,
  source_reference_id: project.source === 'manual' ? null : `${project.source}-ui6-${index + 1}`,
  owner_id: people[project.owner].id,
  sponsor_id: people[project.sponsor].id,
  created_by: PATCH83V_USER_ID,
  start_date: project.start,
  target_end_date: project.end,
  priority: index === 3 ? 'critical' : index < 6 ? 'high' : 'medium',
  risk_level: project.risk,
  status: project.status,
  progress_percent: project.progress,
  evidence_required: true,
  closure_approval_required: true,
  delay_reason: 'delay' in project ? project.delay : null,
  cancellation_reason: null,
  created_at: '2026-06-01T08:00:00.000Z',
  updated_at: '2026-08-22T08:00:00.000Z',
  departments: departments[project.department],
  owner: { full_name_en: people[project.owner].en, full_name_ar: people[project.owner].ar },
  sponsor: { full_name_en: people[project.sponsor].en, full_name_ar: people[project.sponsor].ar },
}));

export const ui6Milestones = ui6Projects.flatMap((project, projectIndex) => [0, 1].map((offset) => ({
  id: `milestone-ui6-${projectIndex + 1}-${offset + 1}`,
  organization_id: PATCH83V_ORGANIZATION_ID,
  project_id: project.id,
  title: offset === 0 ? 'Governed design and owner acceptance' : 'Evidence-backed implementation gate',
  description: 'Controlled milestone with explicit evidence and accountable owner.',
  owner_id: project.owner_id,
  start_date: project.start_date,
  due_date: offset === 0 ? `2026-${String(8 + (projectIndex % 3)).padStart(2, '0')}-25` : `2026-${String(10 + (projectIndex % 2)).padStart(2, '0')}-20`,
  status: project.status === 'closed' ? 'closed' : project.status === 'delayed' && offset === 1 ? 'delayed' : offset === 0 ? 'approved' : 'in_progress',
  progress_percent: project.status === 'closed' ? 100 : offset === 0 ? 100 : project.progress_percent,
  evidence_required: true,
  delay_reason: project.status === 'delayed' && offset === 1 ? 'Dependent source mapping has not passed owner validation.' : null,
  created_at: '2026-06-02T08:00:00.000Z',
  updated_at: '2026-08-21T08:00:00.000Z',
  owner: project.owner,
})));

export const ui6Tasks = ui6Projects.flatMap((project, projectIndex) => [0, 1, 2].map((offset) => ({
  id: `task-ui6-${projectIndex + 1}-${offset + 1}`,
  organization_id: PATCH83V_ORGANIZATION_ID,
  project_id: project.id,
  milestone_id: `milestone-ui6-${projectIndex + 1}-${offset < 2 ? 1 : 2}`,
  title: ['Confirm accountable scope', 'Complete controlled implementation', 'Submit independent evidence'][offset],
  description: 'Governed project execution task.',
  owner_id: project.owner_id,
  assigned_to: project.owner_id,
  start_date: project.start_date,
  due_date: offset === 0 ? '2026-08-14' : offset === 1 ? '2026-09-18' : '2026-11-08',
  status: project.status === 'closed' ? 'closed' : project.status === 'delayed' && offset === 1 ? 'delayed' : offset === 0 ? 'closed' : 'in_progress',
  progress_percent: project.status === 'closed' || offset === 0 ? 100 : offset === 1 ? project.progress_percent : 20,
  evidence_required: offset !== 0,
  delay_reason: project.status === 'delayed' && offset === 1 ? 'Source-owner validation is incomplete and escalation remains open.' : null,
  created_at: '2026-06-03T08:00:00.000Z',
  updated_at: '2026-08-20T08:00:00.000Z',
  owner: project.owner,
  assignee: project.owner,
})));

const ui6Risks = [
  { id: 'risk-ui6-project-2', risk_code: 'RISK-0018', title: 'Medication verification control may not sustain under peak workload', category: 'clinical', risk_level: 'high', source_project_id: 'project-ui6-2', owner: ui6Projects[1].owner },
  { id: 'risk-ui6-project-3', risk_code: 'RISK-0024', title: 'Audit remediation dependency may miss the committee cycle', category: 'governance', risk_level: 'high', source_project_id: 'project-ui6-3', owner: ui6Projects[2].owner },
  { id: 'risk-ui6-project-4', risk_code: 'RISK-0031', title: 'Regulatory source mapping remains incomplete', category: 'compliance', risk_level: 'critical', source_project_id: 'project-ui6-4', owner: ui6Projects[3].owner },
].map(row => ({ ...row, organization_id: PATCH83V_ORGANIZATION_ID, description: row.title, inherent_likelihood: 4, inherent_impact: 4, residual_likelihood: 3, residual_impact: 4, risk_score: 12, residual_score: 10, appetite_threshold: 8, risk_owner_id: null, control_owner_id: null, treatment_owner_id: null, executive_sponsor_id: null, owner_id: null, department_id: null, treatment_strategy: 'mitigate', treatment_status: 'in_progress', treatment_due_date: '2026-10-30', next_review_date: '2026-09-20', status: 'active', escalation_status: 'open', owner: row.owner }));

const evidenceBlueprints = [
  { id: 'evidence-ui6-1', code: 'EVD-0042', title: 'Medication Control Validation Pack', type: 'control_evidence', status: 'accepted', sensitivity: 'confidential', uploader: 'Dr. Lina Haddad', reviewer: 'Maha Al-Rashid', expiry: '2027-02-28' },
  { id: 'evidence-ui6-2', code: 'EVD-0043', title: 'Internal Audit Corrective Action Proof', type: 'audit_evidence', status: 'pending_review', sensitivity: 'internal', uploader: 'Omar Al-Salem', reviewer: 'UI Review Admin', expiry: null },
  { id: 'evidence-ui6-3', code: 'EVD-0044', title: 'Regulatory Mapping Workbook', type: 'compliance_evidence', status: 'rejected', sensitivity: 'confidential', uploader: 'Noura Al-Harbi', reviewer: 'Maha Al-Rashid', expiry: '2026-09-18' },
  { id: 'evidence-ui6-4', code: 'EVD-0045', title: 'Restricted Patient Safety Investigation', type: 'investigation_evidence', status: 'accepted', sensitivity: 'restricted', uploader: 'Dr. Lina Haddad', reviewer: 'UI Review Admin', expiry: null },
  { id: 'evidence-ui6-5', code: 'EVD-0046', title: 'CAPA Implementation Completion Set', type: 'capa_evidence', status: 'accepted', sensitivity: 'internal', uploader: 'Maha Al-Rashid', reviewer: 'Omar Al-Salem', expiry: null },
  { id: 'evidence-ui6-6', code: 'EVD-0047', title: 'OVR Competency Reinforcement Record', type: 'training_evidence', status: 'submitted', sensitivity: 'confidential', uploader: 'Noura Al-Harbi', reviewer: 'UI Review Admin', expiry: '2026-10-12' },
  { id: 'evidence-ui6-7', code: 'EVD-0048', title: 'Policy and SOP Alignment Approval', type: 'document_evidence', status: 'accepted', sensitivity: 'internal', uploader: 'Maha Al-Rashid', reviewer: 'UI Review Admin', expiry: null },
  { id: 'evidence-ui6-8', code: 'EVD-0049', title: 'Project Milestone Design Signoff', type: 'project_evidence', status: 'accepted', sensitivity: 'internal', uploader: 'UI Review Admin', reviewer: 'Maha Al-Rashid', expiry: null },
] as const;

const evidenceLinks = [
  ['evidence-ui6-1', 'risk', 'risk-ui6-project-2', 'RISK-0018 · Medication verification control', true],
  ['evidence-ui6-1', 'capa', 'capa-ui6-42', 'CAPA-0042 · Medication control corrective action', false],
  ['evidence-ui6-1', 'project', 'project-ui6-2', 'Medication Safety Control Hardening', false],
  ['evidence-ui6-2', 'audit_finding', 'audit-finding-ui6-26', 'AF-0026 · Internal audit remediation', true],
  ['evidence-ui6-2', 'project', 'project-ui6-3', 'Internal Audit Finding Remediation', false],
  ['evidence-ui6-3', 'compliance', 'compliance-ui6-17', 'COMP-0017 · Regulatory mapping', true],
  ['evidence-ui6-3', 'project', 'project-ui6-4', 'Regulatory Obligations Data Renewal', false],
  ['evidence-ui6-4', 'ovr', 'ovr-ui5-1', 'OVR-2026-001 · Patient safety investigation', true],
  ['evidence-ui6-5', 'capa', 'capa-ui6-42', 'CAPA-0042 · Corrective action delivery', true],
  ['evidence-ui6-5', 'project', 'project-ui6-5', 'CAPA-0042 Corrective Action Delivery', false],
  ['evidence-ui6-6', 'ovr', 'ovr-ui5-1', 'OVR-2026-001 · Competency follow-up', true],
  ['evidence-ui6-6', 'task', 'task-ui6-6-3', 'Submit independent evidence', false],
  ['evidence-ui6-7', 'policy', 'policy-1', 'POL-001 · Enterprise Clinical Governance Policy', true],
  ['evidence-ui6-7', 'project', 'project-ui6-7', 'Policy and SOP Control Alignment', false],
  ['evidence-ui6-8', 'project', 'project-ui6-1', 'Enterprise Clinical Governance Upgrade', true],
  ['evidence-ui6-8', 'milestone', 'milestone-ui6-1-1', 'Governed design and owner acceptance', false],
  ['evidence-ui6-8', 'task', 'task-ui6-1-1', 'Confirm accountable scope', false],
] as const;

const ui6EvidencePack = evidenceLinks.map(([evidenceId, itemType, itemId, itemTitle, primary], index) => {
  const evidence = evidenceBlueprints.find(row => row.id === evidenceId)!;
  return {
    organization_id: PATCH83V_ORGANIZATION_ID,
    linked_item_type: itemType,
    linked_item_id: itemId,
    linked_item_title: itemTitle,
    evidence_file_id: evidence.id,
    evidence_code: evidence.code,
    evidence_title: evidence.title,
    file_name: evidence.sensitivity === 'restricted' ? 'restricted-investigation.enc' : `${evidence.code.toLowerCase()}-${evidence.type}.pdf`,
    evidence_type: evidence.type,
    sensitivity_level: evidence.sensitivity,
    review_status: evidence.status,
    reviewer_id: PATCH83V_USER_ID,
    reviewer_name: evidence.reviewer,
    reviewed_at: evidence.status === 'accepted' ? '2026-08-21T09:00:00.000Z' : null,
    is_primary: primary,
    required_for_closure: primary,
    required_for_acceptance: itemType === 'audit_finding' || itemType === 'capa',
    required_for_approval: itemType === 'project' || itemType === 'milestone',
    required_for_treatment: itemType === 'risk',
    linked_at: `2026-08-${String(10 + (index % 10)).padStart(2, '0')}T09:00:00.000Z`,
  };
});

const ui6ReviewQueue = evidenceBlueprints.filter(row => row.status !== 'accepted').map((row, index) => ({
  organization_id: PATCH83V_ORGANIZATION_ID,
  evidence_file_id: row.id,
  evidence_code: row.code,
  evidence_title: row.title,
  file_name: `${row.code.toLowerCase()}-${row.type}.pdf`,
  evidence_type: row.type,
  sensitivity_level: row.sensitivity,
  review_status: row.status,
  legacy_status: row.status === 'pending_review' || row.status === 'submitted' ? 'submitted' : row.status,
  review_required: true,
  review_due_date: `2026-09-${String(8 + index).padStart(2, '0')}`,
  revision_required: row.status === 'rejected',
  revision_due_date: row.status === 'rejected' ? '2026-09-12' : null,
  expiry_date: row.expiry,
  renewal_required: Boolean(row.expiry),
  is_current_version: true,
  locked_at: null,
  uploaded_by: `uploader-ui6-${index + 1}`,
  uploaded_by_name: row.uploader,
  evidence_owner_id: `owner-ui6-${index + 1}`,
  owner_name: row.uploader,
  reviewer_id: PATCH83V_USER_ID,
  reviewer_name: row.reviewer,
  created_at: `2026-08-${String(18 - index).padStart(2, '0')}T08:00:00.000Z`,
  queue_reason: row.status === 'rejected' ? 'revision_required' : 'pending_review',
}));

const ui6Sensitive = evidenceBlueprints.filter(row => ['confidential', 'restricted'].includes(row.sensitivity)).map((row, index) => ({
  organization_id: PATCH83V_ORGANIZATION_ID,
  evidence_file_id: row.id,
  evidence_code: row.code,
  evidence_title: row.title,
  file_name: row.sensitivity === 'restricted' ? 'restricted-investigation.enc' : `${row.code.toLowerCase()}-${row.type}.pdf`,
  sensitivity_level: row.sensitivity,
  classification_reason: 'Governed source contains restricted operational evidence.',
  review_status: row.status,
  evidence_owner_id: `owner-sensitive-ui6-${index + 1}`,
  owner_name: row.uploader,
  reviewer_id: PATCH83V_USER_ID,
  reviewer_name: row.reviewer,
  expiry_date: row.expiry,
  renewal_required: Boolean(row.expiry),
  renewal_due_date: row.expiry,
  locked_at: row.status === 'accepted' ? '2026-08-21T09:00:00.000Z' : null,
  locked_by: row.status === 'accepted' ? PATCH83V_USER_ID : null,
  locked_by_name: row.status === 'accepted' ? 'UI Review Admin' : null,
  created_at: `2026-08-${String(15 + index).padStart(2, '0')}T08:00:00.000Z`,
}));

const ui6Gaps = [
  { requirement_id: 'requirement-ui6-1', requirement_code: 'REQ-EVD-01', linked_item_type: 'project', linked_item_id: 'project-ui6-4', requirement_title: 'Approved regulatory mapping evidence', required_for_gate: 'closure', minimum_accepted_files: 1, accepted_evidence_count: 0, waiver_active: false, waiver_approved_at: null, due_date: '2026-09-15', gate_status: 'overdue', can_close: false, gap_reason: 'accepted_evidence_missing' },
  { requirement_id: 'requirement-ui6-2', requirement_code: 'REQ-EVD-02', linked_item_type: 'audit_finding', linked_item_id: 'audit-finding-ui6-26', requirement_title: 'Independent corrective-action verification', required_for_gate: 'acceptance', minimum_accepted_files: 1, accepted_evidence_count: 0, waiver_active: false, waiver_approved_at: null, due_date: '2026-09-30', gate_status: 'pending', can_close: false, gap_reason: 'review_pending' },
].map(row => ({ organization_id: PATCH83V_ORGANIZATION_ID, ...row }));

const ui6Gates = ui6Gaps.map(row => ({ ...row }));

const ui6Legacy = evidenceBlueprints.map((row, index) => ({
  id: row.id,
  organization_id: PATCH83V_ORGANIZATION_ID,
  item_type: ui6EvidencePack.find(link => link.evidence_file_id === row.id)?.linked_item_type || 'project',
  item_title: ui6EvidencePack.find(link => link.evidence_file_id === row.id)?.linked_item_title || 'Governed source',
  file_name: row.sensitivity === 'restricted' ? 'restricted-investigation.enc' : `${row.code.toLowerCase()}-${row.type}.pdf`,
  file_path: `private/${row.id}`,
  file_type: 'application/pdf',
  file_size: 128000 + index * 24000,
  description: row.title,
  status: row.status === 'pending_review' ? 'submitted' : row.status,
  evidence_code: row.code,
  evidence_title: row.title,
  evidence_type: row.type,
  sensitivity_level: row.sensitivity,
  review_status: row.status,
  revision_required: row.status === 'rejected',
  expiry_date: row.expiry,
  renewal_required: Boolean(row.expiry),
  locked_at: row.status === 'accepted' ? '2026-08-21T09:00:00.000Z' : null,
  uploaded_by_name: row.uploader,
  reviewed_by_name: row.reviewer,
  created_at: `2026-08-${String(18 - index).padStart(2, '0')}T08:00:00.000Z`,
}));

const ui6CapaLinks = [{ link_id: 'capa-link-ui6-1', organization_id: PATCH83V_ORGANIZATION_ID, capa_id: 'capa-ui6-42', capa_code: 'CAPA-0042', capa_title: 'Medication control corrective action', linked_item_type: 'project', linked_item_id: 'project-ui6-5', link_type: 'corrective_action', required_flag: true, created_by: PATCH83V_USER_ID, created_at: '2026-08-10T08:00:00.000Z' }];

const ui6Approvals = [{ id: 'approval-ui6-1', organization_id: PATCH83V_ORGANIZATION_ID, item_type: 'project', item_id: 'project-ui6-3', item_title: 'Internal Audit Finding Remediation', requested_by_name: 'Noura Al-Harbi', approver_name: 'UI Review Admin', status: 'pending', request_note: 'Review recovery schedule and evidence gate.', decision_note: null, requested_at: '2026-08-20T08:00:00.000Z', decided_at: null }];

function selectedValue(url: URL, key: string) {
  const value = url.searchParams.get(key) ?? '';
  return value.startsWith('eq.') ? value.slice(3) : value;
}

async function fulfill(route: Route, response: unknown) {
  const length = Array.isArray(response) ? response.length : response ? 1 : 0;
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', 'content-range': length ? `0-${length - 1}/${length}` : '*/0' }, body: route.request().method() === 'HEAD' ? '' : JSON.stringify(response) });
}

export async function installUi6FixtureData(page: Page) {
  await page.route('**/rest/v1/**', async route => {
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.fallback();
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop() ?? '';
    if (table === 'projects') return fulfill(route, ui6Projects);
    if (table === 'milestones') {
      const projectId = selectedValue(url, 'project_id');
      return fulfill(route, projectId ? ui6Milestones.filter(row => row.project_id === projectId) : ui6Milestones);
    }
    if (table === 'tasks') {
      const projectId = selectedValue(url, 'project_id');
      return fulfill(route, projectId ? ui6Tasks.filter(row => row.project_id === projectId) : ui6Tasks);
    }
    if (table === 'risks') return fulfill(route, ui6Risks);
    if (table === 'v_patch28_capa_link_index') return fulfill(route, ui6CapaLinks);
    if (table === 'v_pending_approvals_expanded') return fulfill(route, ui6Approvals);
    if (table === 'v_patch23_evidence_pack_index') return fulfill(route, ui6EvidencePack);
    if (table === 'v_patch23_evidence_review_queue') return fulfill(route, ui6ReviewQueue);
    if (table === 'v_patch23_sensitive_evidence_register') return fulfill(route, ui6Sensitive);
    if (table === 'v_patch23_evidence_gap_dashboard') return fulfill(route, ui6Gaps);
    if (table === 'v_patch23_evidence_closure_gate_status') return fulfill(route, ui6Gates);
    if (table === 'v_evidence_review_queue') return fulfill(route, ui6Legacy);
    return route.fallback();
  });
}
