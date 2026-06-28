export type V130WorkstreamKey =
  | 'executive_overview'
  | 'ovr_quality'
  | 'risk_controls'
  | 'audit_assurance'
  | 'compliance_obligations'
  | 'capa_actions'
  | 'vendor_resilience'
  | 'data_quality'
  | 'manual_approvals';

export type V130MaturityBand = 'pilot' | 'controlled' | 'maturing' | 'board_ready';

export interface V130WorkbenchCard {
  key: V130WorkstreamKey;
  title: string;
  arabicTitle: string;
  maturity: V130MaturityBand;
  headline: string;
  executiveQuestion: string;
  nextBestAction: string;
  proofSignal: string;
  riskIfIgnored: string;
}

export interface V130GuidedUatStep {
  id: string;
  actor: string;
  scenario: string;
  expectedResult: string;
  evidenceToCapture: string;
  stopCondition: string;
}

export interface V130RoleCoachPrompt {
  role: string;
  tone: 'operator' | 'manager' | 'auditor' | 'executive';
  prompt: string;
  allowedActions: string[];
  deniedActions: string[];
}

export const v130MaturityLabels: Record<V130MaturityBand, string> = {
  pilot: 'Pilot only',
  controlled: 'Controlled use',
  maturing: 'Maturing module',
  board_ready: 'Board-ready evidence',
};

export const v130WorkbenchCards: V130WorkbenchCard[] = [
  {
    key: 'executive_overview',
    title: 'Executive Control Room',
    arabicTitle: 'غرفة التحكم التنفيذية',
    maturity: 'controlled',
    headline: 'One page view for readiness, open issues, and go/no-go blockers.',
    executiveQuestion: 'Can leadership see what is ready, what is blocked, and who owns the next action?',
    nextBestAction: 'Review proof summary, overdue actions, approval blockers, and unresolved UAT issues daily during pilot.',
    proofSignal: 'Proof suite, UAT readiness, restore dry-run, and approval status are visible together.',
    riskIfIgnored: 'Leadership may approve a pilot without seeing the true blockers or manual evidence gaps.',
  },
  {
    key: 'ovr_quality',
    title: 'OVR / Quality Workbench',
    arabicTitle: 'منصة الجودة وبلاغات OVR',
    maturity: 'controlled',
    headline: 'Operational quality flow from report to validation to closure.',
    executiveQuestion: 'Are OVRs moving through the correct people without exposing confidential data?',
    nextBestAction: 'Run same-department and cross-department OVR UAT with Quality validation and reporter dispute.',
    proofSignal: 'Synthetic OVR E2E scenarios pass and no real patient identifiers are used in pilot.',
    riskIfIgnored: 'OVR may become only a reporting form, not a closed-loop quality improvement workflow.',
  },
  {
    key: 'risk_controls',
    title: 'Risk + Control Foundation',
    arabicTitle: 'أساس المخاطر والضوابط',
    maturity: 'maturing',
    headline: 'Risk register linked to control ownership, evidence, and treatment decisions.',
    executiveQuestion: 'Can each major risk be linked to control coverage and residual exposure?',
    nextBestAction: 'Select 10 pilot risks and map them to preventive, detective, and corrective controls.',
    proofSignal: 'Risk-control mapping exists with owners, review dates, appetite, and treatment status.',
    riskIfIgnored: 'The platform may look like a workflow tool instead of a real risk program.',
  },
  {
    key: 'audit_assurance',
    title: 'Audit Assurance Workbench',
    arabicTitle: 'منصة المراجعة والتأكيد',
    maturity: 'maturing',
    headline: 'Audit planning, workpapers, findings, and follow-up evidence in one governed path.',
    executiveQuestion: 'Can Audit test control design and operating effectiveness using evidence?',
    nextBestAction: 'Create one pilot audit engagement and one follow-up review with management action owners.',
    proofSignal: 'Audit universe, engagement, workpaper, finding, action plan, and follow-up are linked.',
    riskIfIgnored: 'Findings may be recorded without assurance traceability or follow-up discipline.',
  },
  {
    key: 'compliance_obligations',
    title: 'Compliance Obligations',
    arabicTitle: 'الالتزامات النظامية',
    maturity: 'maturing',
    headline: 'Regulations, policies, accreditation requirements, controls, and owners mapped together.',
    executiveQuestion: 'Can compliance owners prove which requirements are covered and which are overdue?',
    nextBestAction: 'Load a small obligation set for Quality, IT/security, and governance pilot requirements.',
    proofSignal: 'Obligations show owner, source, control link, due date, evidence, and status.',
    riskIfIgnored: 'Compliance gaps may stay hidden until inspection, audit, or accreditation review.',
  },
  {
    key: 'capa_actions',
    title: 'CAPA / Corrective Actions',
    arabicTitle: 'الإجراءات التصحيحية والوقائية',
    maturity: 'controlled',
    headline: 'Single remediation layer for OVRs, audit findings, risks, and compliance gaps.',
    executiveQuestion: 'Are action plans truly assigned, due, evidenced, and closed?',
    nextBestAction: 'Use CAPA as the default closure path for material OVRs, audit findings, and risk issues.',
    proofSignal: 'CAPA owner, due date, source, status, evidence, and effectiveness check are present.',
    riskIfIgnored: 'Issues may be closed administratively without verifying effective remediation.',
  },
  {
    key: 'vendor_resilience',
    title: 'Vendor + Resilience',
    arabicTitle: 'الموردون واستمرارية الأعمال',
    maturity: 'pilot',
    headline: 'Later-phase enterprise risk layer for third parties, BIA, plans, and drills.',
    executiveQuestion: 'Which vendors and downtime scenarios could interrupt critical operations?',
    nextBestAction: 'Keep this as a phase-two module unless leadership requires immediate vendor/BCP visibility.',
    proofSignal: 'Critical vendors, risk ratings, BIA records, continuity plans, and exercise results are tracked.',
    riskIfIgnored: 'The platform may miss operational resilience risks outside direct hospital workflows.',
  },
  {
    key: 'data_quality',
    title: 'Data Quality Guardrails',
    arabicTitle: 'حوكمة جودة البيانات',
    maturity: 'controlled',
    headline: 'Detect missing owners, stale review dates, orphan controls, and overdue actions.',
    executiveQuestion: 'Can we trust the dashboards enough to use them in a decision meeting?',
    nextBestAction: 'Review data-quality findings before every pilot review and before any board-style report.',
    proofSignal: 'Rules, findings, severity, owner, and remediation due dates are defined.',
    riskIfIgnored: 'Dashboards may look polished but carry incomplete or stale data.',
  },
  {
    key: 'manual_approvals',
    title: 'Manual Approval Closure',
    arabicTitle: 'إغلاق الاعتمادات اليدوية',
    maturity: 'pilot',
    headline: 'The final technical blocker remains real Management/Admin, IT, and Quality signoff.',
    executiveQuestion: 'Have the right people reviewed evidence and approved the controlled pilot scope?',
    nextBestAction: 'Complete the two approval JSON files only after real evidence review and manual UAT.',
    proofSignal: 'v66 strict proof changes from manual evidence required to controlled pilot ready.',
    riskIfIgnored: 'The platform may be treated as approved without documented accountable signoff.',
  },
];

export const v130GuidedUatSteps: V130GuidedUatStep[] = [
  {
    id: 'V130-UAT-01',
    actor: 'Super Admin',
    scenario: 'Open the executive workspace and confirm only controlled-pilot language is used.',
    expectedResult: 'No broad production readiness claim appears; blockers and next actions are clear.',
    evidenceToCapture: 'Screenshot of landing dashboard and proof/approval blocker card.',
    stopCondition: 'Any screen says full production ready without v66 approvals.',
  },
  {
    id: 'V130-UAT-02',
    actor: 'Quality / Governance Admin',
    scenario: 'Create or review an OVR scenario and verify CAPA handoff language.',
    expectedResult: 'The user can understand the route from OVR to validation, action plan, evidence, and closure.',
    evidenceToCapture: 'Screenshot of OVR workflow and CAPA handoff guidance.',
    stopCondition: 'Workflow allows closure without required owner/evidence where policy requires it.',
  },
  {
    id: 'V130-UAT-03',
    actor: 'Auditor',
    scenario: 'Review risk-control-audit readiness in read-only mode.',
    expectedResult: 'Auditor can view assurance context but cannot perform privileged admin actions.',
    evidenceToCapture: 'Screenshot of denied edit/admin action and accessible read-only evidence.',
    stopCondition: 'Auditor can change users, roles, imports, backups, or workflow bridge actions.',
  },
  {
    id: 'V130-UAT-04',
    actor: 'Department Manager',
    scenario: 'Check assigned actions and overdue items from the manager viewpoint.',
    expectedResult: 'Manager sees actionable next steps without unrelated organization-wide admin functions.',
    evidenceToCapture: 'Screenshot of My Work/action view and hidden admin functions.',
    stopCondition: 'Manager can see unrelated confidential OVR details or external organization data.',
  },
  {
    id: 'V130-UAT-05',
    actor: 'External synthetic employee',
    scenario: 'Try to access primary organization records and admin surfaces.',
    expectedResult: 'Primary organization access is denied safely and clearly.',
    evidenceToCapture: 'Screenshot of safe denied/empty state.',
    stopCondition: 'External user sees Al Modawat records, departments, OVRs, evidence, or admin actions.',
  },
];

export const v130RoleCoachPrompts: V130RoleCoachPrompt[] = [
  {
    role: 'super_admin',
    tone: 'operator',
    prompt: 'Use this role to configure pilot users, departments, controlled evidence, and proof readiness. Do not use it for normal daily operations.',
    allowedActions: ['Admin setup', 'Access control', 'Scenario Lab', 'Evidence review', 'Proof review'],
    deniedActions: ['Faking approvals', 'Entering real patient identifiers during pilot'],
  },
  {
    role: 'governance_admin',
    tone: 'manager',
    prompt: 'Use this role to coordinate risk, compliance, CAPA, and OVR governance decisions during controlled pilot.',
    allowedActions: ['Workflow validation', 'Risk-control review', 'CAPA oversight', 'Issue triage'],
    deniedActions: ['Bypassing IT/Quality approval', 'Editing users unless explicitly authorized'],
  },
  {
    role: 'auditor',
    tone: 'auditor',
    prompt: 'Use this role to validate evidence, test read-only access, and confirm auditability without changing operational records.',
    allowedActions: ['Read evidence', 'Review proof', 'Inspect reports', 'Document findings'],
    deniedActions: ['Create users', 'Change roles', 'Approve workflows as management'],
  },
  {
    role: 'executive',
    tone: 'executive',
    prompt: 'Use this role to review readiness, blockers, trends, and decisions without performing operational workflow actions.',
    allowedActions: ['Dashboard review', 'Board pack review', 'Decision log review'],
    deniedActions: ['Operational closure', 'Direct database repair', 'Manual signoff without evidence review'],
  },
];

export function getV130WorkbenchByKey(key: V130WorkstreamKey): V130WorkbenchCard | undefined {
  return v130WorkbenchCards.find((card) => card.key === key);
}

export function getV130CardsByMaturity(maturity: V130MaturityBand): V130WorkbenchCard[] {
  return v130WorkbenchCards.filter((card) => card.maturity === maturity);
}

export function buildV130ExecutiveNarrative(cards: V130WorkbenchCard[] = v130WorkbenchCards): string {
  const controlled = cards.filter((card) => card.maturity === 'controlled').length;
  const maturing = cards.filter((card) => card.maturity === 'maturing').length;
  const pilot = cards.filter((card) => card.maturity === 'pilot').length;
  const boardReady = cards.filter((card) => card.maturity === 'board_ready').length;

  return [
    `Controlled modules: ${controlled}`,
    `Maturing modules: ${maturing}`,
    `Pilot-only modules: ${pilot}`,
    `Board-ready modules: ${boardReady}`,
    'Do not claim full production readiness until real approvals, staging/persona SQL proof, and manual UAT signoff are complete.',
  ].join(' | ');
}

export function getV130StopConditions(): string[] {
  return Array.from(new Set(v130GuidedUatSteps.map((step) => step.stopCondition)));
}
