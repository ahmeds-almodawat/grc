export type V190Signal = 'good' | 'watch' | 'warning' | 'critical';

export interface V190ExecutiveMetric {
  id: string;
  label: string;
  value: string;
  signal: V190Signal;
  interpretation: string;
  escalationRule: string;
}

export interface V190BoardReportSection {
  id: string;
  title: string;
  purpose: string;
  requiredEvidence: string[];
  decisionUse: string;
  maturity: 'board-ready' | 'management-ready' | 'needs-live-data';
}

export interface V190AutomationAlert {
  id: string;
  title: string;
  trigger: string;
  owner: string;
  cadence: string;
  escalation: string;
  signal: V190Signal;
}

export interface V190ManagementView {
  id: string;
  title: string;
  status: 'ready' | 'watch' | 'not-ready';
  rationale: string;
  requiredInputs: string[];
}

export const v190ExecutiveReportingChain =
  'Risk → KRI → Control → Evidence → Issue/CAPA → Audit/Compliance → Committee Action → Board Pack';

export const v190ExecutiveMetrics: V190ExecutiveMetric[] = [
  {
    id: 'risk-pressure',
    label: 'Enterprise risk pressure',
    value: 'High-risk exposure with owner and treatment visibility',
    signal: 'watch',
    interpretation: 'Board and executive teams should focus on high residual risks, overdue reviews and appetite breaches.',
    escalationRule: 'Escalate when a high or critical risk has no treatment owner, no control linkage or an overdue review.',
  },
  {
    id: 'assurance-coverage',
    label: 'Assurance coverage',
    value: 'Audit and compliance coverage over key risk areas',
    signal: 'warning',
    interpretation: 'A professional program must show what is covered by audit, compliance testing, controls and management review.',
    escalationRule: 'Escalate uncovered high-risk areas and stale assurance ratings to the governance committee.',
  },
  {
    id: 'evidence-closure',
    label: 'Evidence-based closure',
    value: 'Closure depends on accepted evidence',
    signal: 'good',
    interpretation: 'Items should not be treated as closed unless evidence has been submitted, reviewed and accepted.',
    escalationRule: 'Block closure reporting when evidence is rejected, missing or still awaiting review.',
  },
  {
    id: 'action-aging',
    label: 'Action and CAPA aging',
    value: 'Overdue corrective actions and committee decisions',
    signal: 'warning',
    interpretation: 'Aging actions show execution risk and should be highlighted before board and committee meetings.',
    escalationRule: 'Escalate overdue high-priority actions to the action owner, executive sponsor and committee secretary.',
  },
];

export const v190BoardReportSections: V190BoardReportSection[] = [
  {
    id: 'one-page-scorecard',
    title: 'One-page executive GRC scorecard',
    purpose: 'Summarize risk pressure, compliance exposure, audit backlog, evidence health and action aging.',
    requiredEvidence: ['latest risk register summary', 'open audit findings', 'compliance due/overdue list', 'CAPA aging report'],
    decisionUse: 'Used by executives to decide whether the GRC program is operating within acceptable tolerance.',
    maturity: 'board-ready',
  },
  {
    id: 'risk-appetite-report',
    title: 'Risk appetite and KRI breach report',
    purpose: 'Show appetite breaches, KRI trend warnings and treatment ownership.',
    requiredEvidence: ['KRI breach list', 'risk appetite thresholds', 'risk treatment actions', 'owner responses'],
    decisionUse: 'Used to approve escalation, treatment funding or risk acceptance.',
    maturity: 'management-ready',
  },
  {
    id: 'assurance-coverage-report',
    title: 'Assurance coverage and gaps',
    purpose: 'Show where audit, compliance testing and controls provide coverage over key risks.',
    requiredEvidence: ['audit universe', 'annual audit plan', 'control testing history', 'compliance testing calendar'],
    decisionUse: 'Used to prioritize audits, control tests and compliance reviews.',
    maturity: 'board-ready',
  },
  {
    id: 'action-accountability-report',
    title: 'Action accountability and overdue items',
    purpose: 'Track overdue CAPA, audit follow-up, compliance remediation and committee actions.',
    requiredEvidence: ['action owner list', 'due dates', 'evidence status', 'management response'],
    decisionUse: 'Used to assign accountability and unblock delays.',
    maturity: 'management-ready',
  },
];

export const v190AutomationAlerts: V190AutomationAlert[] = [
  {
    id: 'kri-breach-alert',
    title: 'KRI breach alert',
    trigger: 'A KRI exceeds appetite threshold or deteriorates for two consecutive periods.',
    owner: 'Risk owner / Governance',
    cadence: 'Daily check during controlled pilot; weekly summary for executives.',
    escalation: 'Risk owner → Governance Admin → Executive sponsor',
    signal: 'critical',
  },
  {
    id: 'capa-overdue-alert',
    title: 'CAPA overdue alert',
    trigger: 'Corrective action is overdue or evidence is missing after the due date.',
    owner: 'Action owner / Department manager',
    cadence: 'Daily until cleared.',
    escalation: 'Action owner → Department manager → Committee',
    signal: 'warning',
  },
  {
    id: 'audit-aging-alert',
    title: 'Audit finding aging alert',
    trigger: 'High audit finding remains open or management response is late.',
    owner: 'Internal Audit / Finding owner',
    cadence: 'Weekly audit follow-up.',
    escalation: 'Finding owner → Audit → Governance committee',
    signal: 'warning',
  },
  {
    id: 'compliance-aging-alert',
    title: 'Compliance obligation aging alert',
    trigger: 'Obligation is due within 30 days, overdue, or missing evidence.',
    owner: 'Compliance officer',
    cadence: 'Daily for critical obligations, weekly for routine obligations.',
    escalation: 'Compliance officer → Responsible department → Executive sponsor',
    signal: 'critical',
  },
  {
    id: 'board-pack-readiness-alert',
    title: 'Board pack readiness alert',
    trigger: 'Board pack is missing high-risk, audit, compliance or CAPA summaries.',
    owner: 'Governance secretary',
    cadence: 'Before every committee or board pack cycle.',
    escalation: 'Governance secretary → Executive sponsor',
    signal: 'watch',
  },
];

export const v190ManagementViews: V190ManagementView[] = [
  {
    id: 'controlled-pilot-view',
    title: 'Controlled pilot executive view',
    status: 'ready',
    rationale: 'Use synthetic and non-confidential data to test whether the management reporting chain is understandable and actionable.',
    requiredInputs: ['pilot scope', 'scenario results', 'open high issues', 'evidence status', 'approval evidence'],
  },
  {
    id: 'board-go-no-go-view',
    title: 'Board go/no-go management view',
    status: 'watch',
    rationale: 'Requires UAT closure, no open blockers, accepted evidence and final production hardening checks.',
    requiredInputs: ['UAT closure summary', 'security/RLS checklist', 'backup restore proof', 'open blocker/high issues', 'final signoff'],
  },
];
