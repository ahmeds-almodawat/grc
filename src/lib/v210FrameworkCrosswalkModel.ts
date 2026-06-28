export type V210FrameworkCode =
  | 'ISO_31000'
  | 'COSO_ERM'
  | 'ISO_37301'
  | 'IIA_GIAS'
  | 'ISO_27001'
  | 'NIST_CSF'
  | 'SOC_2'
  | 'CBAHI';

export type V210CoverageStatus = 'covered' | 'partial' | 'gap' | 'planned' | 'not_applicable';

export interface V210Framework {
  code: V210FrameworkCode;
  name: string;
  purpose: string;
  professionalUse: string;
  coverageStatus: V210CoverageStatus;
  requiredBackbone: string[];
}

export interface V210BackboneTable {
  table: string;
  purpose: string;
  liveUse: string;
  closureRule: string;
}

export interface V210TraceabilityStep {
  id: string;
  label: string;
  owner: string;
  requiredEvidence: string;
  assuranceQuestion: string;
}

export interface V210CoverageMetric {
  label: string;
  value: string;
  status: V210CoverageStatus;
  note: string;
}

export interface V210ContextPanel {
  context: 'risk' | 'control' | 'compliance' | 'audit' | 'evidence' | 'governance' | 'executive';
  title: string;
  objective: string;
  primaryQuestion: string;
  requiredLinks: string[];
}

export const v210ProfessionalTraceabilityChain =
  'Requirement → Risk → Control → Test → Evidence → Issue → CAPA → Closure → Report';

export const v210Frameworks: V210Framework[] = [
  {
    code: 'ISO_31000',
    name: 'ISO 31000 Risk Management',
    purpose: 'Risk principles, framework, process, evaluation, treatment, monitoring and communication.',
    professionalUse: 'Shows that enterprise risks are registered, scored, owned, treated and reviewed.',
    coverageStatus: 'partial',
    requiredBackbone: ['Risk register', 'Risk scoring', 'Risk treatment', 'KRI monitoring', 'Risk review evidence'],
  },
  {
    code: 'COSO_ERM',
    name: 'COSO ERM',
    purpose: 'Connects risk to strategy, performance, governance, appetite and executive reporting.',
    professionalUse: 'Shows board-level risk posture, appetite breaches, trends and strategy impact.',
    coverageStatus: 'partial',
    requiredBackbone: ['Risk appetite', 'Performance link', 'Executive dashboard', 'Board reporting'],
  },
  {
    code: 'ISO_37301',
    name: 'ISO 37301 Compliance Management System',
    purpose: 'Compliance obligations, controls, monitoring, improvement, evidence and management review.',
    professionalUse: 'Shows obligations are known, assigned, monitored, tested and escalated.',
    coverageStatus: 'partial',
    requiredBackbone: ['Obligations register', 'Compliance tests', 'Policy link', 'Evidence', 'Corrective actions'],
  },
  {
    code: 'IIA_GIAS',
    name: 'IIA Global Internal Audit Standards',
    purpose: 'Internal audit governance, planning, engagement work, results, follow-up and quality.',
    professionalUse: 'Shows audit universe, audit plan, workpapers, findings, management responses and follow-up.',
    coverageStatus: 'partial',
    requiredBackbone: ['Audit universe', 'Engagements', 'Workpapers', 'Findings', 'Follow-up'],
  },
  {
    code: 'ISO_27001',
    name: 'ISO 27001 / Annex A',
    purpose: 'Information security management controls, assets, access, suppliers, operations and incidents.',
    professionalUse: 'Useful when the GRC scope includes information security or privacy assurance.',
    coverageStatus: 'planned',
    requiredBackbone: ['Scope assets', 'Security controls', 'Incidents', 'Supplier risk', 'Access control evidence'],
  },
  {
    code: 'NIST_CSF',
    name: 'NIST Cybersecurity Framework',
    purpose: 'Cybersecurity outcomes across identify, protect, detect, respond, recover and govern.',
    professionalUse: 'Useful for cybersecurity posture reporting and control coverage mapping.',
    coverageStatus: 'planned',
    requiredBackbone: ['Asset scope', 'Control mapping', 'Security events', 'Recovery evidence'],
  },
  {
    code: 'SOC_2',
    name: 'SOC 2 Trust Services Criteria',
    purpose: 'Security, availability, processing integrity, confidentiality and privacy criteria.',
    professionalUse: 'Useful for external assurance style control evidence and test support.',
    coverageStatus: 'planned',
    requiredBackbone: ['Control owner', 'Test evidence', 'Exception log', 'Management response'],
  },
  {
    code: 'CBAHI',
    name: 'CBAHI / Healthcare Accreditation Crosswalk',
    purpose: 'Healthcare compliance and patient-safety oriented accreditation mapping.',
    professionalUse: 'Useful for Saudi healthcare alignment where relevant to hospital operations.',
    coverageStatus: 'planned',
    requiredBackbone: ['Healthcare obligations', 'Quality evidence', 'Incident/OVR link', 'CAPA closure'],
  },
];

export const v210BackboneTables: V210BackboneTable[] = [
  {
    table: 'v210_frameworks',
    purpose: 'Master list of frameworks, standards and accreditation references.',
    liveUse: 'Feeds the framework selector and coverage dashboard.',
    closureRule: 'A framework is reportable only after requirements are loaded and mapped.',
  },
  {
    table: 'v210_framework_requirements',
    purpose: 'Requirement, clause, domain or standard statement that must be covered.',
    liveUse: 'Defines the exact accreditation requirement to be mapped.',
    closureRule: 'A requirement cannot be considered covered without a mapped control or documented not-applicable rationale.',
  },
  {
    table: 'v210_framework_mappings',
    purpose: 'Maps requirements to controls, risks, obligations, audits, evidence or CAPA records.',
    liveUse: 'Turns separate GRC modules into an auditable crosswalk.',
    closureRule: 'Coverage requires owner, status, evidence status, review date and next review date.',
  },
  {
    table: 'v210_grc_relationships',
    purpose: 'Generic relationship graph between risks, controls, tests, evidence, issues, CAPA, audits and reports.',
    liveUse: 'Powers traceability views and uncovered-high-risk warnings.',
    closureRule: 'A high-risk item should not be reported as assured without control, test and evidence relationships.',
  },
  {
    table: 'v210_scope_assets',
    purpose: 'Assets, processes, systems, departments or services in professional GRC scope.',
    liveUse: 'Provides the scope boundary for ISO/security/compliance/audit review.',
    closureRule: 'In-scope critical assets require linked risks, owners and controls.',
  },
];

export const v210TraceabilitySteps: V210TraceabilityStep[] = [
  {
    id: 'requirement',
    label: 'Requirement / Standard',
    owner: 'Compliance / Governance',
    requiredEvidence: 'Framework requirement or regulation clause.',
    assuranceQuestion: 'Which standard, law or accreditation requirement is being addressed?',
  },
  {
    id: 'risk',
    label: 'Risk',
    owner: 'Risk Owner',
    requiredEvidence: 'Risk assessment, inherent/residual score and treatment decision.',
    assuranceQuestion: 'What could go wrong if this requirement is not controlled?',
  },
  {
    id: 'control',
    label: 'Control',
    owner: 'Control Owner',
    requiredEvidence: 'Control design, owner, frequency and operating procedure.',
    assuranceQuestion: 'What control prevents, detects or corrects the risk?',
  },
  {
    id: 'test',
    label: 'Control Test',
    owner: 'Audit / Compliance Testing',
    requiredEvidence: 'Test procedure, sample, result and exception decision.',
    assuranceQuestion: 'Was the control tested and did it operate effectively?',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    owner: 'Evidence Reviewer',
    requiredEvidence: 'Accepted evidence files, reviewer notes and audit trail.',
    assuranceQuestion: 'What proof supports the test, closure or compliance claim?',
  },
  {
    id: 'issue',
    label: 'Issue / Finding',
    owner: 'Audit / Compliance / Quality',
    requiredEvidence: 'Severity, root cause, owner and management response.',
    assuranceQuestion: 'What remains open and what is the impact?',
  },
  {
    id: 'capa',
    label: 'CAPA / Action Plan',
    owner: 'Action Owner',
    requiredEvidence: 'Corrective action, due date, implementation proof and review.',
    assuranceQuestion: 'What action fixes the root cause and how is closure proven?',
  },
  {
    id: 'closure',
    label: 'Closure / Report',
    owner: 'Governance / Executive',
    requiredEvidence: 'Closure approval, final status and management report.',
    assuranceQuestion: 'Is the item ready to report as closed, covered or accepted risk?',
  },
];

export const v210CoverageMetrics: V210CoverageMetric[] = [
  {
    label: 'Framework crosswalk',
    value: 'Live-ready',
    status: 'partial',
    note: 'v21 adds the backbone model and schema contract; live data entry/API wiring comes next.',
  },
  {
    label: 'Risk-control-obligation linkage',
    value: 'Mapped model',
    status: 'partial',
    note: 'Relationship graph supports cross-module traceability from risk through evidence and reporting.',
  },
  {
    label: 'Scope assets',
    value: 'Schema added',
    status: 'planned',
    note: 'Critical assets/processes can be linked to risk, controls and framework requirements.',
  },
  {
    label: 'External audit evidence',
    value: 'Requires v24',
    status: 'planned',
    note: 'Final export and auditor workspace should use the v21 crosswalk as the source of truth.',
  },
];

export const v210ContextPanels: V210ContextPanel[] = [
  {
    context: 'risk',
    title: 'Risk crosswalk backbone',
    objective: 'Make each enterprise risk traceable to framework requirements, controls, tests and executive reporting.',
    primaryQuestion: 'Can this risk be connected to an obligation or standard requirement and a tested control?',
    requiredLinks: ['framework requirement', 'risk owner', 'control', 'test result', 'evidence', 'CAPA if gap remains'],
  },
  {
    context: 'compliance',
    title: 'Compliance obligation crosswalk',
    objective: 'Map obligations and regulatory changes to controls, tests, evidence and corrective actions.',
    primaryQuestion: 'Which requirement is covered, partially covered, a gap or not applicable?',
    requiredLinks: ['obligation', 'policy/control', 'compliance test', 'evidence', 'issue/CAPA', 'management report'],
  },
  {
    context: 'audit',
    title: 'Audit assurance crosswalk',
    objective: 'Link audit universe, engagement workpapers and findings to risks, controls and framework coverage.',
    primaryQuestion: 'Can audit prove coverage and follow-up for high-risk requirements?',
    requiredLinks: ['audit universe item', 'engagement', 'workpaper', 'finding', 'management response', 'follow-up evidence'],
  },
  {
    context: 'evidence',
    title: 'Evidence integrity crosswalk',
    objective: 'Prevent closure claims without accepted evidence and trace each file to its requirement, control or issue.',
    primaryQuestion: 'What requirement or risk does this evidence support?',
    requiredLinks: ['evidence item', 'related requirement/control/test', 'review status', 'closure decision'],
  },
  {
    context: 'governance',
    title: 'Governance assurance map',
    objective: 'Show management which frameworks, risks, controls and obligations are covered or still exposed.',
    primaryQuestion: 'Can the board see coverage, gaps, assurance and owner accountability?',
    requiredLinks: ['framework', 'coverage status', 'owner', 'gap', 'CAPA', 'board report'],
  },
  {
    context: 'executive',
    title: 'Executive framework coverage',
    objective: 'Convert GRC records into a board-ready coverage and readiness view.',
    primaryQuestion: 'Which frameworks are ready for external review and which require remediation?',
    requiredLinks: ['scorecard', 'uncovered high-risk area', 'overdue CAPA', 'assurance rating', 'go/no-go recommendation'],
  },
  {
    context: 'control',
    title: 'Control assurance crosswalk',
    objective: 'Map controls to multiple standards and prove design and operating effectiveness.',
    primaryQuestion: 'Which requirements does this control satisfy and was it tested?',
    requiredLinks: ['control', 'framework requirement', 'test plan', 'test result', 'exception', 'evidence'],
  },
];

export function v210PanelForContext(context: V210ContextPanel['context']) {
  return v210ContextPanels.find(panel => panel.context === context) ?? v210ContextPanels[4];
}
