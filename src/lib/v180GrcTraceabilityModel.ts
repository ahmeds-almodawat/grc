export type V180AssuranceRating = 'Strong' | 'Adequate' | 'Partial' | 'Gap';
export type V180LinkStatus = 'linked' | 'partial' | 'missing' | 'watch';

export interface V180TraceabilityNode {
  id: string;
  label: string;
  description: string;
  owner: string;
  evidenceRequired: string;
  status: V180LinkStatus;
}

export interface V180AssuranceArea {
  area: string;
  riskTheme: string;
  firstLine: V180AssuranceRating;
  secondLine: V180AssuranceRating;
  thirdLine: V180AssuranceRating;
  executiveSignal: V180AssuranceRating;
  nextAction: string;
}

export interface V180TraceabilityGap {
  id: string;
  severity: 'Blocker' | 'High' | 'Medium' | 'Low';
  gap: string;
  impact: string;
  remediation: string;
  owner: string;
}

export const v180TraceabilityChain =
  'Risk → Control → Test → Evidence → Issue → CAPA → Audit → Compliance → Board Reporting';

export const v180TraceabilityNodes: V180TraceabilityNode[] = [
  {
    id: 'risk',
    label: 'Risk',
    description: 'Enterprise risk register with owner, score, appetite position and review cadence.',
    owner: 'Risk owner / Governance',
    evidenceRequired: 'Risk assessment, scoring rationale and treatment decision.',
    status: 'linked',
  },
  {
    id: 'control',
    label: 'Control',
    description: 'Preventive, detective, corrective or directive control linked to the risk driver.',
    owner: 'Control owner',
    evidenceRequired: 'Control design, frequency, owner and mapped obligation or risk.',
    status: 'linked',
  },
  {
    id: 'test',
    label: 'Test',
    description: 'Operating effectiveness check, sample, procedure and conclusion.',
    owner: 'Compliance / Audit',
    evidenceRequired: 'Test procedure, sample basis, exception log and reviewer sign-off.',
    status: 'partial',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    description: 'Accepted proof file or metadata supporting completion or closure.',
    owner: 'Evidence reviewer',
    evidenceRequired: 'Accepted evidence, review note and rejection/revision history.',
    status: 'linked',
  },
  {
    id: 'issue',
    label: 'Issue',
    description: 'Finding, non-compliance, incident or control exception requiring action.',
    owner: 'Issue owner',
    evidenceRequired: 'Root cause, severity, due date, management response and escalation status.',
    status: 'partial',
  },
  {
    id: 'capa',
    label: 'CAPA',
    description: 'Corrective and preventive action with owner, due date and verification.',
    owner: 'Department owner',
    evidenceRequired: 'Action plan, completion proof and independent closure review.',
    status: 'watch',
  },
  {
    id: 'audit',
    label: 'Audit',
    description: 'Assurance view over risks, controls, evidence quality and unresolved findings.',
    owner: 'Internal Audit',
    evidenceRequired: 'Workpapers, findings, management response and follow-up status.',
    status: 'partial',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    description: 'Obligation, regulatory change, compliance test and policy attestation view.',
    owner: 'Compliance owner',
    evidenceRequired: 'Obligation source, control mapping, test result and compliance evidence.',
    status: 'linked',
  },
  {
    id: 'board',
    label: 'Board Reporting',
    description: 'Executive assurance pack showing material gaps, overdue actions and coverage.',
    owner: 'Governance / Executive',
    evidenceRequired: 'Board-ready summary, assurance map and open blocker/high issue list.',
    status: 'watch',
  },
];

export const v180AssuranceMap: V180AssuranceArea[] = [
  {
    area: 'Clinical quality and patient safety',
    riskTheme: 'High-consequence operational risk',
    firstLine: 'Adequate',
    secondLine: 'Partial',
    thirdLine: 'Partial',
    executiveSignal: 'Partial',
    nextAction: 'Confirm OVR-to-CAPA-to-evidence traceability before expanding pilot data.',
  },
  {
    area: 'Regulatory obligations',
    riskTheme: 'MOH, CBAHI, Civil Defense, HR and ZATCA compliance',
    firstLine: 'Adequate',
    secondLine: 'Adequate',
    thirdLine: 'Partial',
    executiveSignal: 'Adequate',
    nextAction: 'Add compliance testing evidence and unresolved obligation aging to the board view.',
  },
  {
    area: 'Financial and operational controls',
    riskTheme: 'Delegation, approvals, evidence and exception follow-up',
    firstLine: 'Partial',
    secondLine: 'Partial',
    thirdLine: 'Gap',
    executiveSignal: 'Partial',
    nextAction: 'Map top financial controls to test results and audit follow-up before broad rollout.',
  },
  {
    area: 'Information security and access',
    riskTheme: 'RLS, persona boundaries, privileged actions and audit trail',
    firstLine: 'Adequate',
    secondLine: 'Adequate',
    thirdLine: 'Partial',
    executiveSignal: 'Adequate',
    nextAction: 'Keep persona proof, RLS review and backup checks attached to production evidence.',
  },
];

export const v180TraceabilityGaps: V180TraceabilityGap[] = [
  {
    id: 'gap-high-risk-coverage',
    severity: 'High',
    gap: 'High-risk areas need visible assurance coverage before production sign-off.',
    impact: 'Executives may see open risk counts without knowing whether first, second and third line assurance exists.',
    remediation: 'Use the assurance map to flag uncovered high-risk areas and require an owner/action before go-live.',
    owner: 'Governance / Internal Audit',
  },
  {
    id: 'gap-control-evidence',
    severity: 'Medium',
    gap: 'Some controls can exist without a clearly displayed test/evidence chain.',
    impact: 'A control may look implemented while operating effectiveness is not yet proven.',
    remediation: 'Require control test status and accepted evidence before reporting the control as assured.',
    owner: 'Compliance / Control owner',
  },
  {
    id: 'gap-capa-closure',
    severity: 'Medium',
    gap: 'CAPA closure should not rely only on department self-confirmation.',
    impact: 'Corrective actions can close without independent review and audit-ready evidence.',
    remediation: 'Show independent evidence review and closure acceptance in the traceability chain.',
    owner: 'Quality / Audit',
  },
];

export const v180ExecutiveMetrics = [
  { label: 'Traceability chain', value: '9 steps', hint: v180TraceabilityChain },
  { label: 'Assurance lines', value: '3 lines', hint: 'First line ownership, second line compliance/risk, third line audit.' },
  { label: 'High-risk coverage', value: 'Watch', hint: 'Uncovered high-risk areas must be visible before go/no-go.' },
  { label: 'Closure rule', value: 'Evidence-based', hint: 'Issue/CAPA closure requires accepted evidence and review trail.' },
];

export function v180RatingClass(rating: V180AssuranceRating | V180LinkStatus | V180TraceabilityGap['severity']) {
  return rating.toLowerCase().replace(/\s+/g, '-');
}
