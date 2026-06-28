export type V200GateStatus = 'passed' | 'review_required' | 'blocked';
export type V200GateDomain = 'uat' | 'issues' | 'approvals' | 'security' | 'backup' | 'confidentiality' | 'release';

export interface V200ReadinessGate {
  id: string;
  domain: V200GateDomain;
  title: string;
  purpose: string;
  requiredEvidence: string[];
  owner: string;
  status: V200GateStatus;
  productionImpact: string;
}

export interface V200ScenarioClosureItem {
  id: string;
  persona: string;
  scenario: string;
  expectedEvidence: string;
  status: 'not_started' | 'ready_for_execution' | 'needs_review';
}

export interface V200HardeningControl {
  id: string;
  area: 'Security/RLS' | 'Backup/Restore' | 'Data confidentiality' | 'Release control';
  control: string;
  closureRule: string;
  status: V200GateStatus;
}

export interface V200ReadinessSummary {
  recommendation: 'Controlled production start: ready' | 'Controlled production start: review required' | 'Controlled production start: not ready';
  reason: string;
  blockingIssues: number;
  reviewRequiredItems: number;
  evidencePosition: string;
}

export const v200ProductionReadinessChain =
  'UAT → Issues → Approvals → Security/RLS → Backup/Restore → Confidentiality → Production Go/No-Go';

export const v200ControlledProductionScope = {
  title: 'Controlled production readiness only',
  statement:
    'Controlled internal pilot using synthetic and non-confidential operational data only. No real patient identifiers. No confidential OVR details. No production-wide rollout until UAT closure and production approval are complete.',
  maxUsers: '10–15 approved internal users',
  dataRule: 'Synthetic or non-confidential operational data only',
};

export const v200ScenarioClosureItems: V200ScenarioClosureItem[] = [
  {
    id: 'uat-super-admin-login',
    persona: 'Super Admin',
    scenario: 'Login, open command/admin areas, confirm permitted access only.',
    expectedEvidence: 'Screenshot or tester note confirming successful access and no unexpected denial.',
    status: 'ready_for_execution',
  },
  {
    id: 'uat-governance-admin',
    persona: 'Governance Admin',
    scenario: 'Review governance/risk/compliance/audit workspaces and controlled actions.',
    expectedEvidence: 'Tester note confirming governed actions and restricted admin boundaries.',
    status: 'ready_for_execution',
  },
  {
    id: 'uat-quality-user',
    persona: 'Quality',
    scenario: 'Validate OVR and confirm evidence/closure rules are visible.',
    expectedEvidence: 'OVR workflow screenshot or test log with synthetic data only.',
    status: 'ready_for_execution',
  },
  {
    id: 'uat-auditor-readonly',
    persona: 'Auditor',
    scenario: 'Confirm read-only access to audit/risk evidence without unauthorized editing.',
    expectedEvidence: 'Tester note confirming edit buttons are hidden or blocked.',
    status: 'ready_for_execution',
  },
  {
    id: 'uat-manager-flow',
    persona: 'Department Manager',
    scenario: 'Respond to assigned action/finding and submit evidence metadata.',
    expectedEvidence: 'Evidence queue entry and management response note.',
    status: 'ready_for_execution',
  },
  {
    id: 'uat-employee-restricted',
    persona: 'Employee',
    scenario: 'Confirm employee cannot see restricted audit/governance/security records.',
    expectedEvidence: 'Restricted page/access denial screenshot or tester note.',
    status: 'ready_for_execution',
  },
  {
    id: 'uat-external-denial',
    persona: 'External/unauthorized',
    scenario: 'Confirm unauthorized user is denied protected pages and data.',
    expectedEvidence: 'Access denial evidence without exposing sensitive data.',
    status: 'ready_for_execution',
  },
  {
    id: 'uat-end-to-end-chain',
    persona: 'Cross-functional',
    scenario: 'Trace Risk → Control → Test → Evidence → Issue → CAPA → Audit/Compliance reporting.',
    expectedEvidence: 'Traceability note showing the chain without real patient/confidential data.',
    status: 'ready_for_execution',
  },
];

export const v200ReadinessGates: V200ReadinessGate[] = [
  {
    id: 'gate-uat-closure',
    domain: 'uat',
    title: 'UAT closure evidence',
    purpose: 'Confirm pilot scenarios were executed by approved users and results are recorded.',
    requiredEvidence: ['scenario pass/fail summary', 'tester notes', 'open issue list'],
    owner: 'Governance / Quality',
    status: 'review_required',
    productionImpact: 'No controlled production start until blocker/high UAT issues are resolved or formally accepted.',
  },
  {
    id: 'gate-blocker-high-issues',
    domain: 'issues',
    title: 'Open blocker/high issue gate',
    purpose: 'Prevent launch with unresolved blocker/high defects affecting security, workflow, or evidence closure.',
    requiredEvidence: ['issue log', 'severity review', 'owner/action/date'],
    owner: 'Project owner',
    status: 'review_required',
    productionImpact: 'Blocks production if any blocker issue remains open.',
  },
  {
    id: 'gate-approval-evidence',
    domain: 'approvals',
    title: 'Manual approval evidence summary',
    purpose: 'Verify management, IT, and Quality approvals are present and match the controlled scope.',
    requiredEvidence: ['pilot signoff', 'confidentiality confirmation', 'signoff check output'],
    owner: 'Management / IT / Quality',
    status: 'passed',
    productionImpact: 'Supports controlled pilot only; broad production still requires closure approval.',
  },
  {
    id: 'gate-security-rls',
    domain: 'security',
    title: 'Security and RLS checklist',
    purpose: 'Confirm roles/personas, RLS, privileged functions, and runtime bridges remain validated.',
    requiredEvidence: ['persona proof', 'RLS proof', 'runtime bridge proof', 'CI proof'],
    owner: 'IT / Governance',
    status: 'review_required',
    productionImpact: 'Blocks production if persona proof or direct privileged access checks fail.',
  },
  {
    id: 'gate-backup-restore',
    domain: 'backup',
    title: 'Backup and restore readiness',
    purpose: 'Confirm restore dry-run and evidence table integrity are available before controlled production.',
    requiredEvidence: ['restore dry-run output', 'backup health check', 'rollback note'],
    owner: 'IT',
    status: 'review_required',
    productionImpact: 'Controlled production should not start without verified restore path.',
  },
  {
    id: 'gate-confidentiality',
    domain: 'confidentiality',
    title: 'Data confidentiality confirmation',
    purpose: 'Confirm the pilot/prod-start data boundary excludes patient identifiers and confidential OVR details.',
    requiredEvidence: ['confidentiality confirmation', 'pilot data rule', 'user instruction note'],
    owner: 'Quality / IT',
    status: 'passed',
    productionImpact: 'Any real patient/confidential OVR use requires a separate privacy/security approval.',
  },
  {
    id: 'gate-release-index',
    domain: 'release',
    title: 'Final release evidence index',
    purpose: 'Make the final go/no-go decision traceable to proof files, approvals, UAT closure, and security checks.',
    requiredEvidence: ['release/v200 report', 'proof:all output', 'CI output', 'tag/commit reference'],
    owner: 'Project owner',
    status: 'review_required',
    productionImpact: 'Turns technical proof into a management decision pack.',
  },
];

export const v200HardeningControls: V200HardeningControl[] = [
  {
    id: 'hardening-persona-boundaries',
    area: 'Security/RLS',
    control: 'Persona access boundaries remain validated after each patch.',
    closureRule: 'proof:all and persona proof must pass after v20 is applied.',
    status: 'review_required',
  },
  {
    id: 'hardening-service-role',
    area: 'Security/RLS',
    control: 'No direct service-role frontend RPC paths for privileged actions.',
    closureRule: 'Runtime bridge proof must report no service-role-only RPC called by frontend.',
    status: 'review_required',
  },
  {
    id: 'hardening-restore',
    area: 'Backup/Restore',
    control: 'Restore dry-run remains valid and evidence tables are verified.',
    closureRule: 'Restore dry-run evidence must pass before approving production start.',
    status: 'review_required',
  },
  {
    id: 'hardening-data-boundary',
    area: 'Data confidentiality',
    control: 'Pilot and controlled production start remain non-confidential unless separately approved.',
    closureRule: 'No patient identifiers or confidential OVR details are entered during controlled pilot.',
    status: 'passed',
  },
  {
    id: 'hardening-release-control',
    area: 'Release control',
    control: 'Final checkpoint tag and CI status are captured before production decision.',
    closureRule: 'Go/no-go record must include commit/tag, CI run, and proof:all output.',
    status: 'review_required',
  },
];

export function getV200ReadinessSummary(): V200ReadinessSummary {
  const blockingIssues = v200ReadinessGates.filter(gate => gate.status === 'blocked').length;
  const reviewRequiredItems = v200ReadinessGates.filter(gate => gate.status === 'review_required').length;
  return {
    recommendation: blockingIssues > 0
      ? 'Controlled production start: not ready'
      : reviewRequiredItems > 0
        ? 'Controlled production start: review required'
        : 'Controlled production start: ready',
    reason: 'v20 is a production decision framework. It does not fake UAT closure; real scenario results and final management approval must be reviewed before production start.',
    blockingIssues,
    reviewRequiredItems,
    evidencePosition: 'Technical proof can support controlled production only after UAT closure, security/restore checks, confidentiality confirmation, and final go/no-go evidence are indexed.',
  };
}
