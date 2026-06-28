export type V160ComplianceMaturityStage =
  | 'Foundation'
  | 'Professional workflow'
  | 'Managed CMS'
  | 'Assurance ready'
  | 'Advanced automation';

export type V160ComplianceStatus = 'Implemented' | 'Partially implemented' | 'Next maturity layer';

export interface V160ComplianceCapability {
  id: string;
  title: string;
  standardBasis: string;
  purpose: string;
  workflowLink: string;
  evidenceRequired: string[];
  maturityStage: V160ComplianceMaturityStage;
  status: V160ComplianceStatus;
}

export interface V160ComplianceExecutionStep {
  id: string;
  title: string;
  owner: string;
  output: string;
  controlPoint: string;
}

export interface V160RegulatoryChangeItem {
  id: string;
  source: string;
  changeType: string;
  impactArea: string;
  requiredAction: string;
  targetDate: string;
  status: 'Monitor' | 'Assess' | 'Implement' | 'Verify';
}

export interface V160ComplianceTestingItem {
  id: string;
  test: string;
  scope: string;
  frequency: string;
  evidence: string;
  result: 'Ready' | 'Needs evidence' | 'Needs owner';
}

export interface V160PolicyAttestationItem {
  id: string;
  policy: string;
  audience: string;
  attestation: string;
  evidence: string;
  riskIfMissing: string;
}

export interface V160ComplianceMetric {
  label: string;
  value: string;
  interpretation: string;
}

export const v160ComplianceExecutionChain =
  'Obligation → Regulatory Change → Policy / Control → Compliance Test → Evidence → Issue → CAPA → Management Reporting';

export const v160ComplianceExecutionSteps: V160ComplianceExecutionStep[] = [
  {
    id: 'obligation-register',
    title: 'Obligation register',
    owner: 'Compliance owner',
    output: 'A complete list of regulatory, contractual, accreditation and internal policy obligations.',
    controlPoint: 'Every obligation needs an owner, due date, risk level and evidence requirement.',
  },
  {
    id: 'regulatory-change',
    title: 'Regulatory change assessment',
    owner: 'Compliance + responsible department',
    output: 'Impact assessment, implementation action, due date and verification method.',
    controlPoint: 'No change is closed until implementation evidence is reviewed.',
  },
  {
    id: 'policy-control-link',
    title: 'Policy / control link',
    owner: 'Governance + process owner',
    output: 'A mapped policy, procedure, control or training requirement that addresses the obligation.',
    controlPoint: 'High-risk obligations require a control or policy link before they are marked compliant.',
  },
  {
    id: 'compliance-testing',
    title: 'Compliance testing',
    owner: 'Compliance tester / auditor',
    output: 'Testing result, sample, evidence, exception and conclusion.',
    controlPoint: 'Failed testing creates an issue or CAPA rather than a manual closure.',
  },
  {
    id: 'evidence-review',
    title: 'Evidence review',
    owner: 'Compliance reviewer',
    output: 'Evidence accepted, rejected or requested again with comments.',
    controlPoint: 'Compliance status cannot be upgraded without evidence review.',
  },
  {
    id: 'issue-capa-reporting',
    title: 'Issue / CAPA / reporting',
    owner: 'Compliance + accountable leader',
    output: 'Non-compliance issue, corrective action, owner, due date and management reporting.',
    controlPoint: 'Open high-risk non-compliance must be visible to executive governance.',
  },
];

export const v160ComplianceCapabilities: V160ComplianceCapability[] = [
  {
    id: 'obligations-register',
    title: 'Compliance Obligations Register',
    standardBasis: 'ISO 37301 CMS requirement identification and access to compliance obligations',
    purpose: 'Centralize MOH, Civil Defense, CBAHI, HR, ZATCA, contracts and internal policy obligations.',
    workflowLink: 'Feeds due dates, risk level, evidence and accountable owner into compliance monitoring.',
    evidenceRequired: ['regulator/source reference', 'owner assignment', 'due/expiry date', 'evidence requirement'],
    maturityStage: 'Foundation',
    status: 'Implemented',
  },
  {
    id: 'regulatory-change',
    title: 'Regulatory Change Management',
    standardBasis: 'ISO 37301 change management and continual improvement expectation',
    purpose: 'Capture new or changed obligations and turn them into assessed implementation actions.',
    workflowLink: 'Regulatory change links to policy updates, control changes, training and verification.',
    evidenceRequired: ['change source', 'impact assessment', 'implementation owner', 'verification evidence'],
    maturityStage: 'Professional workflow',
    status: 'Partially implemented',
  },
  {
    id: 'compliance-testing',
    title: 'Compliance Testing Program',
    standardBasis: 'ISO 37301 monitoring, measurement, analysis and evaluation',
    purpose: 'Move from calendar tracking to evidence-based compliance testing and exception handling.',
    workflowLink: 'Test result can create issue, CAPA, audit finding or management escalation.',
    evidenceRequired: ['test procedure', 'sample / scope', 'test evidence', 'conclusion', 'review sign-off'],
    maturityStage: 'Professional workflow',
    status: 'Partially implemented',
  },
  {
    id: 'policy-attestation',
    title: 'Policy and Attestation Link',
    standardBasis: 'ISO 37301 awareness, communication and documented information',
    purpose: 'Confirm affected users acknowledge key policies and regulatory requirements.',
    workflowLink: 'Policy gaps can become training tasks or non-compliance issues.',
    evidenceRequired: ['policy version', 'target audience', 'attestation result', 'exceptions list'],
    maturityStage: 'Managed CMS',
    status: 'Next maturity layer',
  },
  {
    id: 'non-compliance-workflow',
    title: 'Non-compliance Issue Workflow',
    standardBasis: 'ISO 37301 nonconformity, corrective action and continual improvement',
    purpose: 'Route failed obligations and testing exceptions into issue/CAPA ownership.',
    workflowLink: 'Non-compliance issue links back to obligation, evidence, control and CAPA closure.',
    evidenceRequired: ['issue record', 'root cause', 'corrective action', 'closure evidence', 'review decision'],
    maturityStage: 'Assurance ready',
    status: 'Partially implemented',
  },
  {
    id: 'management-reporting',
    title: 'Compliance Management Reporting',
    standardBasis: 'ISO 37301 governing body and top management reporting',
    purpose: 'Give leadership visibility on high-risk obligations, overdue evidence and unresolved exceptions.',
    workflowLink: 'Dashboards summarize readiness, blockers, overdue actions and executive decisions required.',
    evidenceRequired: ['summary dashboard', 'high-risk exceptions', 'committee actions', 'management review output'],
    maturityStage: 'Assurance ready',
    status: 'Partially implemented',
  },
];

export const v160RegulatoryChangePipeline: V160RegulatoryChangeItem[] = [
  {
    id: 'REG-CHANGE-001',
    source: 'MOH / Healthcare regulator',
    changeType: 'Operational requirement',
    impactArea: 'Clinical operations and quality governance',
    requiredAction: 'Assess impact, assign owner, update policy/control and collect implementation evidence.',
    targetDate: '30 days from notice',
    status: 'Assess',
  },
  {
    id: 'REG-CHANGE-002',
    source: 'Civil Defense / facility safety',
    changeType: 'License or facility compliance',
    impactArea: 'Engineering, safety and emergency readiness',
    requiredAction: 'Verify expiry, inspection evidence, action plan and responsible leader.',
    targetDate: 'Before renewal window',
    status: 'Implement',
  },
  {
    id: 'REG-CHANGE-003',
    source: 'Internal governance policy',
    changeType: 'Policy revision',
    impactArea: 'Authority matrix, approvals and documentation',
    requiredAction: 'Update controlled document, communicate affected users and capture attestation.',
    targetDate: 'Next committee cycle',
    status: 'Verify',
  },
];

export const v160ComplianceTestingCalendar: V160ComplianceTestingItem[] = [
  {
    id: 'TEST-001',
    test: 'License expiry evidence test',
    scope: 'High-risk operating licenses and statutory certificates',
    frequency: 'Monthly',
    evidence: 'Current license, renewal proof, owner confirmation and exception log.',
    result: 'Ready',
  },
  {
    id: 'TEST-002',
    test: 'Policy attestation sample test',
    scope: 'Critical policies assigned to selected departments',
    frequency: 'Quarterly',
    evidence: 'Policy version, target users, attestation completion and overdue list.',
    result: 'Needs evidence',
  },
  {
    id: 'TEST-003',
    test: 'Regulatory change closure test',
    scope: 'Recently closed regulatory changes',
    frequency: 'Quarterly',
    evidence: 'Impact assessment, owner action, implementation evidence and reviewer approval.',
    result: 'Needs owner',
  },
];

export const v160PolicyAttestationItems: V160PolicyAttestationItem[] = [
  {
    id: 'ATT-001',
    policy: 'Incident and OVR handling policy',
    audience: 'Quality, clinical leaders and department managers',
    attestation: 'Required for controlled pilot users',
    evidence: 'Acknowledgement record and exception list',
    riskIfMissing: 'Users may record confidential details or bypass approved routing.',
  },
  {
    id: 'ATT-002',
    policy: 'Evidence handling and confidentiality policy',
    audience: 'Audit, compliance, governance and pilot administrators',
    attestation: 'Required before evidence upload',
    evidence: 'Signed acknowledgement or system attestation',
    riskIfMissing: 'Evidence may include restricted or patient-identifiable data.',
  },
  {
    id: 'ATT-003',
    policy: 'Authority matrix and approval delegation',
    audience: 'Executives, governance admins and process owners',
    attestation: 'Required for decision owners',
    evidence: 'Policy version and acknowledgement status',
    riskIfMissing: 'Actions may be approved by the wrong authority level.',
  },
];

export const v160ComplianceProgramMetrics: V160ComplianceMetric[] = [
  {
    label: 'Critical obligations with evidence',
    value: 'Target: 100%',
    interpretation: 'High-risk obligations should not be marked compliant without reviewed evidence.',
  },
  {
    label: 'Regulatory changes assessed on time',
    value: 'Target: > 95%',
    interpretation: 'New requirements need documented impact assessment and implementation owner.',
  },
  {
    label: 'Compliance tests with conclusion',
    value: 'Target: > 90%',
    interpretation: 'Testing should produce conclusion, exceptions and follow-up actions.',
  },
  {
    label: 'Open high-risk non-compliance',
    value: 'Target: 0 overdue',
    interpretation: 'High-risk overdue issues should be escalated to governance and tracked to CAPA.',
  },
];

export function getV160ComplianceReadiness() {
  const implemented = v160ComplianceCapabilities.filter(item => item.status === 'Implemented').length;
  const partial = v160ComplianceCapabilities.filter(item => item.status === 'Partially implemented').length;
  const next = v160ComplianceCapabilities.filter(item => item.status === 'Next maturity layer').length;
  const total = v160ComplianceCapabilities.length;
  const readinessPercent = Math.round(((implemented + partial * 0.6) / total) * 100);

  return {
    total,
    implemented,
    partial,
    next,
    readinessPercent,
    recommendation:
      readinessPercent >= 80
        ? 'Ready for controlled compliance pilot execution with evidence review discipline.'
        : 'Continue controlled pilot only; improve policy attestation, testing and regulatory change evidence before broad rollout.',
  };
}
