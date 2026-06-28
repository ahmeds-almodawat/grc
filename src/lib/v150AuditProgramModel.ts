export type V150AuditLifecycleStatus =
  | 'Not started'
  | 'Planned'
  | 'In progress'
  | 'Evidence pending'
  | 'Management response pending'
  | 'Follow-up'
  | 'Closed';

export type V150AssuranceLevel = 'Covered' | 'Partially covered' | 'Uncovered' | 'Overdue follow-up';

export interface V150AuditWorkflowStep {
  id: string;
  title: string;
  objective: string;
  output: string;
  owner: string;
}

export interface V150AuditUniverseItem {
  id: string;
  auditableArea: string;
  riskRating: 'Critical' | 'High' | 'Medium' | 'Low';
  owner: string;
  lastAudit: string;
  nextPlannedAudit: string;
  assuranceCoverage: V150AssuranceLevel;
}

export interface V150AnnualAuditPlanItem {
  id: string;
  engagement: string;
  priority: 'Critical' | 'High' | 'Medium';
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  auditOwner: string;
  status: V150AuditLifecycleStatus;
}

export interface V150WorkpaperChecklistItem {
  id: string;
  title: string;
  purpose: string;
  requiredEvidence: string;
  status: 'Required' | 'Ready template' | 'Reviewer checkpoint';
}

export interface V150EvidenceRequestItem {
  id: string;
  request: string;
  ownerDepartment: string;
  dueDate: string;
  status: 'Requested' | 'Received' | 'Overdue' | 'Blocked';
  blockerFlag: boolean;
}

export interface V150AuditMetric {
  label: string;
  value: string;
  interpretation: string;
  state: 'healthy' | 'warning' | 'attention';
}

export const v150AuditProgramWorkflowChain =
  'Audit Universe → Annual Audit Plan → Engagement Planning → Workpapers → Evidence Requests → Findings → Management Response → Action Plan Follow-up → Closure → Assurance Reporting';

export const v150AuditWorkflow: V150AuditWorkflowStep[] = [
  {
    id: 'audit-universe',
    title: 'Audit Universe',
    objective: 'Maintain a risk-ranked inventory of auditable departments, processes, systems and obligations.',
    output: 'Auditable area with risk rating, owner, prior coverage and next review need.',
    owner: 'Chief Audit Executive / Governance',
  },
  {
    id: 'annual-plan',
    title: 'Annual Audit Plan',
    objective: 'Convert the universe into a board/committee-approved annual audit plan based on risk and assurance gaps.',
    output: 'Prioritized engagement plan by quarter, owner and status.',
    owner: 'Audit leadership',
  },
  {
    id: 'engagement-planning',
    title: 'Engagement Planning',
    objective: 'Define scope, objectives, criteria, risks, controls, samples and resource plan before fieldwork.',
    output: 'Planning memo and risk/control matrix.',
    owner: 'Engagement lead',
  },
  {
    id: 'workpapers',
    title: 'Workpapers',
    objective: 'Document procedures, evidence, testing results, conclusions and reviewer sign-off.',
    output: 'Indexed workpaper file with review status.',
    owner: 'Auditor / Reviewer',
  },
  {
    id: 'evidence-requests',
    title: 'Evidence Requests',
    objective: 'Track evidence requests to departments with due dates, blockers and escalation visibility.',
    output: 'Evidence request tracker and overdue/blocker list.',
    owner: 'Audit team and department owner',
  },
  {
    id: 'findings',
    title: 'Findings',
    objective: 'Convert exceptions into rated findings with cause, risk, recommendation and owner.',
    output: 'Draft/final finding with risk level and due date.',
    owner: 'Audit lead',
  },
  {
    id: 'management-response',
    title: 'Management Response',
    objective: 'Capture accountable response, action plan, target date and acceptance of residual risk where applicable.',
    output: 'Management response and corrective action commitment.',
    owner: 'Management action owner',
  },
  {
    id: 'follow-up-closure',
    title: 'Action Plan Follow-up / Closure',
    objective: 'Verify evidence and prevent departments from closing their own audit issues without review.',
    output: 'Closure approval, rejection reason or overdue escalation.',
    owner: 'Audit / Governance',
  },
  {
    id: 'assurance-reporting',
    title: 'Assurance Reporting',
    objective: 'Summarize assurance coverage, high-risk gaps, overdue findings and readiness for committee reporting.',
    output: 'Assurance coverage summary and audit opinion indicator.',
    owner: 'Audit committee / Executive governance',
  },
];

export const v150AuditUniverse: V150AuditUniverseItem[] = [
  {
    id: 'universe-clinical-quality',
    auditableArea: 'Clinical quality and patient safety governance',
    riskRating: 'Critical',
    owner: 'Quality',
    lastAudit: 'Not audited in controlled pilot',
    nextPlannedAudit: 'Q1 pilot engagement',
    assuranceCoverage: 'Partially covered',
  },
  {
    id: 'universe-ovr-capa',
    auditableArea: 'OVR to CAPA lifecycle',
    riskRating: 'High',
    owner: 'Quality / Operations',
    lastAudit: 'Static workflow proof',
    nextPlannedAudit: 'Q1 pilot walkthrough',
    assuranceCoverage: 'Covered',
  },
  {
    id: 'universe-access-control',
    auditableArea: 'Access control and persona permissions',
    riskRating: 'High',
    owner: 'IT / Governance',
    lastAudit: 'v13.1 persona proof',
    nextPlannedAudit: 'Q1 RLS verification',
    assuranceCoverage: 'Covered',
  },
  {
    id: 'universe-compliance-obligations',
    auditableArea: 'Regulatory compliance obligations and evidence',
    riskRating: 'High',
    owner: 'Compliance',
    lastAudit: 'Not audited in controlled pilot',
    nextPlannedAudit: 'Q2 compliance testing',
    assuranceCoverage: 'Uncovered',
  },
];

export const v150AnnualAuditPlan: V150AnnualAuditPlanItem[] = [
  {
    id: 'plan-ovr-capa',
    engagement: 'OVR to CAPA controlled workflow review',
    priority: 'High',
    quarter: 'Q1',
    auditOwner: 'Audit / Quality reviewer',
    status: 'Planned',
  },
  {
    id: 'plan-access',
    engagement: 'Persona access and restricted data review',
    priority: 'Critical',
    quarter: 'Q1',
    auditOwner: 'IT / Governance reviewer',
    status: 'In progress',
  },
  {
    id: 'plan-compliance',
    engagement: 'Compliance obligation evidence readiness review',
    priority: 'High',
    quarter: 'Q2',
    auditOwner: 'Compliance reviewer',
    status: 'Not started',
  },
];

export const v150WorkpaperChecklist: V150WorkpaperChecklistItem[] = [
  {
    id: 'wp-planning-memo',
    title: 'Planning memo',
    purpose: 'Defines audit scope, objectives, criteria, methodology and exclusions.',
    requiredEvidence: 'Approved scope and engagement owner assignment.',
    status: 'Required',
  },
  {
    id: 'wp-risk-control-matrix',
    title: 'Risk/control matrix',
    purpose: 'Links risks to controls, procedures and testing objectives.',
    requiredEvidence: 'Risk, control and test mapping.',
    status: 'Ready template',
  },
  {
    id: 'wp-test-procedures',
    title: 'Test procedures',
    purpose: 'Defines sampling, walkthrough and substantive test steps.',
    requiredEvidence: 'Procedure checklist and sample basis.',
    status: 'Ready template',
  },
  {
    id: 'wp-evidence-files',
    title: 'Evidence files',
    purpose: 'Captures evidence, reviewer notes and exceptions.',
    requiredEvidence: 'Linked evidence or controlled pilot sample screenshots.',
    status: 'Reviewer checkpoint',
  },
  {
    id: 'wp-conclusion-signoff',
    title: 'Conclusion and reviewer sign-off',
    purpose: 'Documents conclusion, reviewer decision and closure recommendation.',
    requiredEvidence: 'Reviewer sign-off or returned-for-fix reason.',
    status: 'Reviewer checkpoint',
  },
];

export const v150EvidenceRequests: V150EvidenceRequestItem[] = [
  {
    id: 'ev-access-matrix',
    request: 'Current pilot persona access matrix and restricted-page proof.',
    ownerDepartment: 'IT / Governance',
    dueDate: 'Day 1 UAT',
    status: 'Requested',
    blockerFlag: false,
  },
  {
    id: 'ev-ovr-capa',
    request: 'Synthetic OVR to CAPA lifecycle walkthrough evidence.',
    ownerDepartment: 'Quality',
    dueDate: 'Day 2 UAT',
    status: 'Requested',
    blockerFlag: false,
  },
  {
    id: 'ev-compliance',
    request: 'Sample compliance obligation with evidence and due-date owner.',
    ownerDepartment: 'Compliance',
    dueDate: 'Day 3 UAT',
    status: 'Blocked',
    blockerFlag: true,
  },
];

export const v150AuditMetrics: V150AuditMetric[] = [
  {
    label: 'High-risk areas covered',
    value: '2 / 4',
    interpretation: 'Core access and OVR workflows have pilot proof; compliance testing still needs execution.',
    state: 'warning',
  },
  {
    label: 'Uncovered high-risk areas',
    value: '1',
    interpretation: 'Compliance obligation testing should be scheduled before broad production.',
    state: 'attention',
  },
  {
    label: 'Overdue follow-ups',
    value: '0',
    interpretation: 'No overdue follow-ups are claimed because this is not real UAT outcome data.',
    state: 'healthy',
  },
  {
    label: 'Audit opinion indicator',
    value: 'Controlled pilot only',
    interpretation: 'Sufficient for controlled UAT workflow validation, not broad production assurance.',
    state: 'warning',
  },
];
