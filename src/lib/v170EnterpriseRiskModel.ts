export type V170RiskStageStatus = 'pilot-ready' | 'in-progress' | 'needs-operational-data' | 'next-maturity-layer';

export interface V170RiskLifecycleStep {
  id: string;
  title: string;
  description: string;
  evidence: string;
  owner: string;
  status: V170RiskStageStatus;
}

export interface V170RiskCapability {
  id: string;
  title: string;
  professionalPurpose: string;
  executionExpectation: string;
  maturityStage: 'Foundation' | 'Professional workflow' | 'ERM execution' | 'Advanced analytics';
  status: V170RiskStageStatus;
}

export interface V170RiskAppetiteMetric {
  id: string;
  metric: string;
  appetiteStatement: string;
  warningThreshold: string;
  breachThreshold: string;
  escalation: string;
}

export interface V170RiskTreatmentItem {
  id: string;
  riskTheme: string;
  treatmentStrategy: 'Avoid' | 'Reduce' | 'Transfer' | 'Accept' | 'Exploit / enhance';
  controlLink: string;
  monitoringCadence: string;
  ownerEvidence: string;
}

export interface V170RiskTraceabilityItem {
  id: string;
  risk: string;
  linkedControl: string;
  test: string;
  evidence: string;
  issueOrCapa: string;
  reportOutput: string;
}

export const v170RiskExecutionChain =
  'Risk Identification → Assessment → Appetite / KRI → Treatment → Control Linkage → Monitoring → Escalation → Executive Risk Reporting';

export const v170RiskLifecycleSteps: V170RiskLifecycleStep[] = [
  {
    id: 'risk-identification',
    title: 'Risk Identification',
    description: 'Capture strategic, operational, clinical, financial, compliance and technology risks using a consistent taxonomy.',
    evidence: 'Risk source, scenario, cause, consequence, category and accountable owner.',
    owner: 'Risk owner with Governance oversight',
    status: 'pilot-ready',
  },
  {
    id: 'risk-assessment',
    title: 'Risk Assessment and Scoring',
    description: 'Assess inherent likelihood/impact, control effectiveness and residual exposure.',
    evidence: 'Assessment rationale, scoring matrix, reviewer decision and reassessment date.',
    owner: 'Risk owner / GRC reviewer',
    status: 'pilot-ready',
  },
  {
    id: 'appetite-kri',
    title: 'Risk Appetite and KRI Monitoring',
    description: 'Define appetite, warning thresholds and breach triggers for material risks.',
    evidence: 'KRI trend, threshold breach, escalation note and management action.',
    owner: 'Executive / Committee owner',
    status: 'in-progress',
  },
  {
    id: 'risk-treatment',
    title: 'Risk Treatment Plan',
    description: 'Select reduce, transfer, avoid or accept response and convert treatment into assigned action.',
    evidence: 'Treatment decision, target date, assigned control/CAPA and acceptance approval where needed.',
    owner: 'Department owner',
    status: 'pilot-ready',
  },
  {
    id: 'control-linkage',
    title: 'Control Linkage and Testing',
    description: 'Connect risks to controls and prove that controls are designed and operating effectively.',
    evidence: 'Control owner, test frequency, test result, evidence file and exception handling.',
    owner: 'Control owner / Internal audit',
    status: 'in-progress',
  },
  {
    id: 'monitoring-escalation',
    title: 'Monitoring and Escalation',
    description: 'Monitor high and out-of-appetite risks until residual exposure returns within tolerance.',
    evidence: 'Review notes, escalated issue, CAPA status and next committee reporting date.',
    owner: 'Governance / Risk committee',
    status: 'in-progress',
  },
  {
    id: 'executive-reporting',
    title: 'Executive Risk Reporting',
    description: 'Report top risks, appetite breaches, KRIs, treatment progress and assurance gaps to leadership.',
    evidence: 'Executive summary, heatmap, trend, decision and action follow-up.',
    owner: 'Governance / Executive sponsor',
    status: 'needs-operational-data',
  },
];

export const v170RiskCapabilities: V170RiskCapability[] = [
  {
    id: 'enterprise-register',
    title: 'Enterprise Risk Register',
    professionalPurpose: 'Single source of truth for material risks across departments, processes and strategic objectives.',
    executionExpectation: 'Every material risk has owner, category, inherent/residual score, treatment, control link and review date.',
    maturityStage: 'Foundation',
    status: 'pilot-ready',
  },
  {
    id: 'risk-scoring',
    title: 'Risk Assessment and Scoring',
    professionalPurpose: 'Make likelihood, impact, control effectiveness and residual exposure explicit and reviewable.',
    executionExpectation: 'Scoring is supported by rationale, evidence and periodic reassessment.',
    maturityStage: 'Foundation',
    status: 'pilot-ready',
  },
  {
    id: 'risk-appetite',
    title: 'Risk Appetite and KRI Monitoring',
    professionalPurpose: 'Translate leadership tolerance into measurable indicators and breach triggers.',
    executionExpectation: 'KRIs show warning/breach levels, owners, trend, escalation and committee reporting.',
    maturityStage: 'ERM execution',
    status: 'in-progress',
  },
  {
    id: 'treatment-plans',
    title: 'Risk Treatment Plan',
    professionalPurpose: 'Move risks from register visibility into owned mitigation or approved acceptance.',
    executionExpectation: 'Treatment decisions are tracked to control, project, CAPA or formal risk acceptance.',
    maturityStage: 'Professional workflow',
    status: 'pilot-ready',
  },
  {
    id: 'control-assurance',
    title: 'Control Linkage and Testing',
    professionalPurpose: 'Prove that key controls address priority risks and are tested with evidence.',
    executionExpectation: 'Each top risk has mapped controls, test frequency, evidence and exception workflow.',
    maturityStage: 'ERM execution',
    status: 'in-progress',
  },
  {
    id: 'risk-reporting',
    title: 'Executive Risk Reporting',
    professionalPurpose: 'Give executives an honest view of exposure, appetite breaches and assurance gaps.',
    executionExpectation: 'Risk reports show top risks, movement, breaches, overdue treatments and decisions required.',
    maturityStage: 'Professional workflow',
    status: 'needs-operational-data',
  },
];

export const v170RiskAppetiteMetrics: V170RiskAppetiteMetric[] = [
  {
    id: 'liquidity-delay',
    metric: 'Government payer collection delay',
    appetiteStatement: 'Maintain cash runway and escalation before collection delay creates payroll or supplier risk.',
    warningThreshold: 'DSO trend worsening or expected delay above approved tolerance.',
    breachThreshold: 'Cash runway below leadership-approved minimum or critical payment dependency blocked.',
    escalation: 'Escalate to Finance / Executive committee with mitigation and payment prioritization.',
  },
  {
    id: 'regulatory-expiry',
    metric: 'Critical regulatory obligation expiry',
    appetiteStatement: 'No critical license or accreditation obligation should expire without owner action and evidence.',
    warningThreshold: 'Expiry within warning window without complete evidence.',
    breachThreshold: 'Expired or failed obligation without approved exception and CAPA.',
    escalation: 'Escalate to Compliance, department owner and executive sponsor.',
  },
  {
    id: 'high-risk-open',
    metric: 'Open high / critical risk treatment overdue',
    appetiteStatement: 'High risks must have visible treatment progress and no unsupported closure.',
    warningThreshold: 'Treatment due within 14 days with no evidence update.',
    breachThreshold: 'Treatment overdue or residual score remains high after planned control date.',
    escalation: 'Convert to issue/CAPA and add to committee action tracker.',
  },
];

export const v170RiskTreatmentItems: V170RiskTreatmentItem[] = [
  {
    id: 'reduce-control',
    riskTheme: 'Operational process failure',
    treatmentStrategy: 'Reduce',
    controlLink: 'Preventive / detective control with monthly test cycle.',
    monitoringCadence: 'Monthly until residual risk is stable.',
    ownerEvidence: 'Control test evidence, exception log and owner sign-off.',
  },
  {
    id: 'transfer-insurance',
    riskTheme: 'High financial exposure',
    treatmentStrategy: 'Transfer',
    controlLink: 'Insurance / contract clause review with renewal evidence.',
    monitoringCadence: 'Quarterly and before renewal.',
    ownerEvidence: 'Policy, contract, coverage note and decision record.',
  },
  {
    id: 'accept-exception',
    riskTheme: 'Residual exposure within appetite',
    treatmentStrategy: 'Accept',
    controlLink: 'Formal exception / risk acceptance with expiry date.',
    monitoringCadence: 'Every committee cycle until expiry.',
    ownerEvidence: 'Executive approval, rationale, review date and trigger conditions.',
  },
];

export const v170RiskTraceabilityItems: V170RiskTraceabilityItem[] = [
  {
    id: 'trace-01',
    risk: 'High residual compliance risk',
    linkedControl: 'License renewal owner review and evidence gate',
    test: 'Compliance testing calendar verification',
    evidence: 'Renewal file, due-date proof and reviewer note',
    issueOrCapa: 'Non-compliance issue and CAPA if test fails',
    reportOutput: 'Compliance risk heatmap and executive exception report',
  },
  {
    id: 'trace-02',
    risk: 'Operational revenue leakage risk',
    linkedControl: 'Daily reconciliation and exception approval control',
    test: 'Sample-based control test with variance follow-up',
    evidence: 'Reconciliation file, variance list and sign-off',
    issueOrCapa: 'Audit finding or CAPA for repeated failure',
    reportOutput: 'Risk trend, open treatment and assurance coverage status',
  },
  {
    id: 'trace-03',
    risk: 'Cyber / access control risk',
    linkedControl: 'Role review and privileged access certification',
    test: 'Access review test with removed-user validation',
    evidence: 'User export, reviewer approval and removal evidence',
    issueOrCapa: 'Security issue and corrective action tracking',
    reportOutput: 'Top technology risk and overdue access action report',
  },
];

export function getV170RiskReadiness() {
  const total = v170RiskCapabilities.length;
  const pilotReady = v170RiskCapabilities.filter(item => item.status === 'pilot-ready').length;
  const inProgress = v170RiskCapabilities.filter(item => item.status === 'in-progress').length;
  const needsData = v170RiskCapabilities.filter(item => item.status === 'needs-operational-data').length;

  return {
    total,
    pilotReady,
    inProgress,
    needsData,
    recommendation:
      pilotReady >= 3 && inProgress >= 2
        ? 'Ready for controlled ERM workflow pilot using synthetic or non-confidential risks.'
        : 'Keep v17 in preparation until the minimum ERM workflow capabilities are visible.',
  };
}
