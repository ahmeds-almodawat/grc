export type V220ControlTestStatus = 'planned' | 'in_progress' | 'passed' | 'failed' | 'deferred' | 'requires_management_action';

export type V220AssuranceTone = 'good' | 'warning' | 'danger' | 'neutral';

export interface V220ControlTestingStep {
  id: string;
  title: string;
  owner: string;
  objective: string;
  requiredEvidence: string;
  output: string;
  status: V220ControlTestStatus;
}

export interface V220CapaStep {
  id: string;
  title: string;
  owner: string;
  trigger: string;
  requiredBeforeClosure: string;
  escalationRule: string;
  status: V220ControlTestStatus;
}

export interface V220AssuranceMetric {
  label: string;
  value: string;
  tone: V220AssuranceTone;
  explanation: string;
}

export const v220ControlTestingChain = 'Control → Test → Result → Exception → Issue → CAPA → Evidence → Closure';

export const v220ControlTestingWorkflow: V220ControlTestingStep[] = [
  {
    id: 'control-scope',
    title: 'Control scope and objective',
    owner: 'Control Owner / Governance',
    objective: 'Confirm the control objective, related risk, framework requirement, frequency, and accountable owner before testing starts.',
    requiredEvidence: 'Control description, linked risk, linked framework requirement, prior test history.',
    output: 'Approved control test plan',
    status: 'planned',
  },
  {
    id: 'test-procedure',
    title: 'Test procedure and sample selection',
    owner: 'Audit / Compliance Testing',
    objective: 'Define the procedure, sample population, sample size, period under review, and pass/fail criteria.',
    requiredEvidence: 'Population report, sampling basis, test procedure checklist.',
    output: 'Defensible test workpaper',
    status: 'planned',
  },
  {
    id: 'test-execution',
    title: 'Execute control test',
    owner: 'Tester',
    objective: 'Perform the test against selected samples and record result, exception, and reviewer notes.',
    requiredEvidence: 'Screenshots, exported reports, reconciliations, approvals, supporting documents.',
    output: 'Passed / failed / exception result',
    status: 'in_progress',
  },
  {
    id: 'exception-triage',
    title: 'Exception triage',
    owner: 'Risk / Audit / Compliance',
    objective: 'Classify failed tests by severity, root cause, impacted requirement, and need for issue or CAPA.',
    requiredEvidence: 'Exception analysis, severity rationale, management acknowledgement.',
    output: 'Issue or accepted exception decision',
    status: 'requires_management_action',
  },
  {
    id: 'closure-evidence',
    title: 'Evidence-based closure',
    owner: 'Independent Reviewer',
    objective: 'Close only after evidence proves remediation, retesting is complete when required, and reviewer signs off.',
    requiredEvidence: 'CAPA completion proof, retest result, closure approval note.',
    output: 'Assurance-ready closure record',
    status: 'planned',
  },
];

export const v220CapaExecutionWorkflow: V220CapaStep[] = [
  {
    id: 'issue-create',
    title: 'Create issue from failed control test',
    owner: 'Tester / Audit / Compliance',
    trigger: 'Control test failed, evidence missing, KRI breached, audit finding raised, or compliance obligation gap identified.',
    requiredBeforeClosure: 'Issue severity, owner, due date, root cause, and linked control/risk/framework requirement.',
    escalationRule: 'High and blocker issues require governance visibility immediately.',
    status: 'requires_management_action',
  },
  {
    id: 'management-response',
    title: 'Management response',
    owner: 'Process Owner',
    trigger: 'Issue assigned to responsible department or control owner.',
    requiredBeforeClosure: 'Management response, remediation plan, target date, and responsible owner.',
    escalationRule: 'No response before due date moves to overdue management action.',
    status: 'in_progress',
  },
  {
    id: 'capa-action',
    title: 'CAPA / corrective action plan',
    owner: 'Action Owner',
    trigger: 'Root cause requires corrective or preventive action.',
    requiredBeforeClosure: 'CAPA action, due date, implementation evidence, and effectiveness check requirement.',
    escalationRule: 'Overdue CAPA is reported to executive/committee view.',
    status: 'planned',
  },
  {
    id: 'retest',
    title: 'Retest and effectiveness check',
    owner: 'Independent Tester',
    trigger: 'CAPA submitted as complete.',
    requiredBeforeClosure: 'Retest procedure, result, evidence, reviewer conclusion.',
    escalationRule: 'Failed retest reopens issue and keeps closure blocked.',
    status: 'planned',
  },
];

export const v220AssuranceMetrics: V220AssuranceMetric[] = [
  {
    label: 'Control test discipline',
    value: 'Defined',
    tone: 'good',
    explanation: 'Control tests must have objective, method, sample, result, evidence, and reviewer conclusion.',
  },
  {
    label: 'Closure gate',
    value: 'Evidence required',
    tone: 'warning',
    explanation: 'Failed controls and CAPA items should not close without accepted evidence and independent review.',
  },
  {
    label: 'Escalation rule',
    value: 'Overdue high issues escalate',
    tone: 'danger',
    explanation: 'High-risk failed tests, overdue CAPA, and failed retests must appear in executive reporting.',
  },
  {
    label: 'Accreditation posture',
    value: 'Audit-ready chain',
    tone: 'good',
    explanation: 'The chain supports requirement-to-control-to-test-to-evidence-to-CAPA traceability.',
  },
];

export const v220RequiredEvidence = [
  'control test plan',
  'sample selection basis',
  'test result and exception log',
  'management response',
  'CAPA implementation evidence',
  'retest and closure approval',
];
