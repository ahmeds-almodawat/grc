export type V140ProfessionalDomain = 'risk' | 'compliance' | 'audit' | 'governance';

export type V140WorkflowStepId =
  | 'risk'
  | 'control'
  | 'test'
  | 'evidence'
  | 'issue'
  | 'capa'
  | 'audit'
  | 'compliance'
  | 'reporting';

export interface V140WorkflowStep {
  id: V140WorkflowStepId;
  title: string;
  purpose: string;
  output: string;
}

export interface V140Capability {
  id: string;
  domain: V140ProfessionalDomain;
  title: string;
  professionalExpectation: string;
  workflowRole: string;
  evidence: string[];
  maturityStage: 'Foundation' | 'Controlled pilot' | 'Professional workflow' | 'Next maturity layer' | 'Advanced automation';
  status: 'Ready for controlled pilot' | 'Needs workflow depth' | 'Next maturity layer';
}

export interface V140DomainProfile {
  domain: V140ProfessionalDomain;
  title: string;
  standardsAnchor: string;
  maturityScore: number;
  recommendation: string;
  capabilities: V140Capability[];
}

export const v140ProfessionalWorkflowChain = 'Risk → Control → Test → Evidence → Issue → CAPA → Audit / Compliance Reporting';

export const v140ProfessionalWorkflow: V140WorkflowStep[] = [
  {
    id: 'risk',
    title: 'Risk',
    purpose: 'Identify, assess and own the uncertainty that can affect objectives.',
    output: 'Risk register, inherent/residual rating, owner and treatment direction.',
  },
  {
    id: 'control',
    title: 'Control',
    purpose: 'Map preventive, detective and corrective controls to key risks and obligations.',
    output: 'Controls library, control owners, frequency and control intent.',
  },
  {
    id: 'test',
    title: 'Test',
    purpose: 'Assess control design and operating effectiveness through repeatable procedures.',
    output: 'Control test result, exceptions, sample notes and effectiveness conclusion.',
  },
  {
    id: 'evidence',
    title: 'Evidence',
    purpose: 'Attach traceable proof for decisions, controls, obligations, findings and closure.',
    output: 'Evidence file, reviewer, date, source module and integrity record.',
  },
  {
    id: 'issue',
    title: 'Issue',
    purpose: 'Create a controlled issue/finding when risk, audit, compliance or OVR gaps are found.',
    output: 'Issue register entry with severity, owner, due date and source link.',
  },
  {
    id: 'capa',
    title: 'CAPA',
    purpose: 'Convert issues into corrective/preventive action with ownership and due dates.',
    output: 'CAPA case, action items, evidence and closure review.',
  },
  {
    id: 'audit',
    title: 'Audit',
    purpose: 'Plan assurance work, execute engagements, document workpapers and follow up findings.',
    output: 'Audit universe, annual plan, engagement file, workpapers and follow-up status.',
  },
  {
    id: 'compliance',
    title: 'Compliance',
    purpose: 'Track obligations, regulatory changes, testing, attestations and non-compliance.',
    output: 'Obligations register, testing result, policy link and compliance issue.',
  },
  {
    id: 'reporting',
    title: 'Reporting',
    purpose: 'Report maturity, assurance coverage, open exposure and go/no-go readiness.',
    output: 'Executive dashboard, board pack, assurance map and decision summary.',
  },
];

export const v140DomainProfiles: Record<V140ProfessionalDomain, V140DomainProfile> = {
  risk: {
    domain: 'risk',
    title: 'Risk management maturity',
    standardsAnchor: 'ISO 31000 / COSO ERM',
    maturityScore: 74,
    recommendation: 'Strengthen the risk-to-control-to-CAPA chain before broad rollout.',
    capabilities: [
      {
        id: 'enterprise-risk-register',
        domain: 'risk',
        title: 'Enterprise Risk Register',
        professionalExpectation: 'A single controlled register for strategic, operational, clinical, financial and compliance risks.',
        workflowRole: 'Starts the professional GRC chain and links objectives to controls and treatment.',
        evidence: ['Risk statement', 'Owner', 'Inherent/residual scoring', 'Review date'],
        maturityStage: 'Professional workflow',
        status: 'Ready for controlled pilot',
      },
      {
        id: 'risk-assessment-scoring',
        domain: 'risk',
        title: 'Risk Assessment and Scoring',
        professionalExpectation: 'Consistent likelihood, impact, inherent risk, residual risk and risk level rules.',
        workflowRole: 'Prioritizes treatment, control testing and executive attention.',
        evidence: ['Scoring rationale', 'Risk level', 'Treatment direction', 'Reviewer note'],
        maturityStage: 'Controlled pilot',
        status: 'Needs workflow depth',
      },
      {
        id: 'risk-appetite-kri',
        domain: 'risk',
        title: 'Risk Appetite / KRI Monitoring',
        professionalExpectation: 'Defined appetite thresholds and KRIs that indicate when exposure is moving outside tolerance.',
        workflowRole: 'Turns risk reporting into monitoring instead of static registration.',
        evidence: ['KRI definition', 'Threshold', 'Measurement date', 'Escalation rule'],
        maturityStage: 'Next maturity layer',
        status: 'Next maturity layer',
      },
      {
        id: 'risk-control-treatment',
        domain: 'risk',
        title: 'Control Mapping and Treatment Plan',
        professionalExpectation: 'Each material risk should have controls, treatment actions, due dates and accountable owners.',
        workflowRole: 'Connects risk to control, test, issue and CAPA records.',
        evidence: ['Mapped controls', 'Treatment owner', 'Due date', 'CAPA/issue link'],
        maturityStage: 'Professional workflow',
        status: 'Ready for controlled pilot',
      },
    ],
  },
  compliance: {
    domain: 'compliance',
    title: 'Compliance management maturity',
    standardsAnchor: 'ISO 37301',
    maturityScore: 68,
    recommendation: 'Move from obligation tracking into obligation testing, regulatory change and attestation evidence.',
    capabilities: [
      {
        id: 'obligations-register',
        domain: 'compliance',
        title: 'Compliance Obligations Register',
        professionalExpectation: 'A controlled list of regulatory, licensing, policy and contractual obligations.',
        workflowRole: 'Defines what must be monitored, evidenced and tested.',
        evidence: ['Regulator/source', 'Requirement owner', 'Due/expiry date', 'Evidence required'],
        maturityStage: 'Professional workflow',
        status: 'Ready for controlled pilot',
      },
      {
        id: 'regulatory-change',
        domain: 'compliance',
        title: 'Regulatory Change Management',
        professionalExpectation: 'Capture regulatory updates, assess impact and assign implementation actions.',
        workflowRole: 'Feeds new risks, policy changes and compliance tests.',
        evidence: ['Change source', 'Impact assessment', 'Owner', 'Implementation status'],
        maturityStage: 'Next maturity layer',
        status: 'Next maturity layer',
      },
      {
        id: 'compliance-testing',
        domain: 'compliance',
        title: 'Compliance Testing',
        professionalExpectation: 'Periodic checks that obligations are operating as expected and supported by evidence.',
        workflowRole: 'Creates compliance issues and CAPA when obligations fail.',
        evidence: ['Test procedure', 'Sample/evidence', 'Result', 'Reviewer conclusion'],
        maturityStage: 'Professional workflow',
        status: 'Needs workflow depth',
      },
      {
        id: 'policy-attestation',
        domain: 'compliance',
        title: 'Policy / Attestation Link',
        professionalExpectation: 'Policies are versioned, communicated and attested where required.',
        workflowRole: 'Links obligations to policy control and employee acknowledgement.',
        evidence: ['Policy version', 'Approver', 'Attestation list', 'Exceptions'],
        maturityStage: 'Controlled pilot',
        status: 'Needs workflow depth',
      },
    ],
  },
  audit: {
    domain: 'audit',
    title: 'Internal audit maturity',
    standardsAnchor: 'IIA Global Internal Audit Standards',
    maturityScore: 61,
    recommendation: 'Prioritize audit universe, annual plan, engagement workpapers and finding follow-up depth.',
    capabilities: [
      {
        id: 'audit-universe',
        domain: 'audit',
        title: 'Audit Universe',
        professionalExpectation: 'A risk-based inventory of auditable entities, processes, departments and systems.',
        workflowRole: 'Feeds annual audit plan and assurance coverage reporting.',
        evidence: ['Auditable entity', 'Risk rating', 'Last audit date', 'Coverage rationale'],
        maturityStage: 'Professional workflow',
        status: 'Needs workflow depth',
      },
      {
        id: 'annual-audit-plan',
        domain: 'audit',
        title: 'Annual Audit Plan',
        professionalExpectation: 'A prioritized plan approved through governance and aligned to risk exposure.',
        workflowRole: 'Converts risk universe into scheduled assurance work.',
        evidence: ['Plan year', 'Priority', 'Scope', 'Approval record'],
        maturityStage: 'Professional workflow',
        status: 'Needs workflow depth',
      },
      {
        id: 'engagement-workpapers',
        domain: 'audit',
        title: 'Engagements / Workpapers',
        professionalExpectation: 'Engagement work is documented, reviewed and traceable to evidence and conclusions.',
        workflowRole: 'Produces findings and assurance conclusions.',
        evidence: ['Audit program', 'Workpaper reference', 'Reviewer', 'Conclusion'],
        maturityStage: 'Controlled pilot',
        status: 'Needs workflow depth',
      },
      {
        id: 'findings-follow-up',
        domain: 'audit',
        title: 'Findings and Follow-up',
        professionalExpectation: 'Findings remain open until evidence is reviewed and remediation is accepted.',
        workflowRole: 'Connects audit results to issue register and CAPA closure.',
        evidence: ['Finding', 'Action plan', 'Submitted evidence', 'Audit closure decision'],
        maturityStage: 'Professional workflow',
        status: 'Ready for controlled pilot',
      },
    ],
  },
  governance: {
    domain: 'governance',
    title: 'Executive governance maturity',
    standardsAnchor: 'COSO ERM / Board reporting / assurance governance',
    maturityScore: 70,
    recommendation: 'Use dashboards, traceability and assurance maps to convert module activity into decisions.',
    capabilities: [
      {
        id: 'executive-grc-dashboard',
        domain: 'governance',
        title: 'Executive GRC Dashboard',
        professionalExpectation: 'Executive view of material risks, high issues, overdue CAPA, compliance exposure and audit coverage.',
        workflowRole: 'Aggregates the risk-control-test-evidence-issue-CAPA chain.',
        evidence: ['KPI snapshot', 'Open high exposure', 'Overdue actions', 'Board/committee date'],
        maturityStage: 'Professional workflow',
        status: 'Ready for controlled pilot',
      },
      {
        id: 'assurance-map',
        domain: 'governance',
        title: 'Assurance Map',
        professionalExpectation: 'Shows which risks and obligations are covered by management controls, compliance and audit.',
        workflowRole: 'Prevents false confidence and highlights assurance gaps.',
        evidence: ['Risk/control coverage', 'Compliance test', 'Audit coverage', 'Gap owner'],
        maturityStage: 'Next maturity layer',
        status: 'Next maturity layer',
      },
      {
        id: 'board-reporting',
        domain: 'governance',
        title: 'Committee / Board Reporting',
        professionalExpectation: 'Structured reporting for decisions, exceptions, risk acceptance and follow-up.',
        workflowRole: 'Turns operational GRC records into governance action.',
        evidence: ['Agenda', 'Decision', 'Owner', 'Follow-up status'],
        maturityStage: 'Controlled pilot',
        status: 'Needs workflow depth',
      },
      {
        id: 'cross-module-traceability',
        domain: 'governance',
        title: 'Cross-module Traceability Graph',
        professionalExpectation: 'Clear links across risk, controls, tests, evidence, issues, CAPA, audit and compliance.',
        workflowRole: 'Makes the platform feel like a professional GRC system rather than separate dashboards.',
        evidence: ['Source record', 'Linked control/test', 'Issue/CAPA link', 'Report trace'],
        maturityStage: 'Professional workflow',
        status: 'Needs workflow depth',
      },
    ],
  },
};

export const v140MustHaveModules = [
  'Enterprise Risk Register',
  'Risk Assessment and Scoring',
  'Risk Appetite / KRI Monitoring',
  'Controls Library',
  'Control Testing',
  'Evidence Management',
  'CAPA / Corrective Action Management',
  'Audit Universe',
  'Audit Planning',
  'Audit Engagements / Workpapers',
  'Audit Findings and Follow-up',
  'Compliance Obligations Register',
  'Policy and Document Control',
  'Issue / Finding Register',
  'Executive GRC Dashboard',
];

export const v140NextMaturityModules = [
  'Regulatory Change Management',
  'Compliance Testing',
  'Third-Party / Vendor Risk',
  'Training and Attestation',
  'Exception / Risk Acceptance Management',
  'Root Cause Analysis',
  'Committee / Board Reporting',
  'Business Continuity / Resilience',
];

export const v140AdvancedModules = [
  'Automated control monitoring',
  'Predictive risk indicators',
  'Heatmaps and trend analytics',
  'Cross-module traceability graph',
  'AI-assisted audit planning',
  'Full assurance map',
];

export function v140DomainProfile(domain: V140ProfessionalDomain) {
  return v140DomainProfiles[domain];
}

