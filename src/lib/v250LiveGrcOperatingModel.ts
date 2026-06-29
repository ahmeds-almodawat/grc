export type V250ReadinessState = 'ready' | 'monitoring' | 'evidence_required' | 'blocked' | 'review_required';

export interface V250OperatingCycle {
  code: string;
  title: string;
  cadence: string;
  owner: string;
  evidenceRule: string;
  readiness: V250ReadinessState;
}

export interface V250DataBridgeItem {
  source: string;
  target: string;
  bridgeStatus: V250ReadinessState;
  controlPoint: string;
  reviewer: string;
}

export interface V250AccessReviewItem {
  role: string;
  segregationRule: string;
  reviewCadence: string;
  evidenceRequired: string;
  status: V250ReadinessState;
}

export interface V250OperatingMetric {
  label: string;
  value: string;
  status: V250ReadinessState;
  note: string;
}

export const v250LiveGrcOperatingChain =
  'Operating Cycle → Data Intake → Edge Bridge Review → Access Review → Evidence Snapshot → Production Exception → Management Sign-off';

export const v250OperatingCycles: V250OperatingCycle[] = [
  {
    code: 'MONTHLY-RISK-REVIEW',
    title: 'Monthly enterprise risk review',
    cadence: 'Monthly',
    owner: 'Risk owner + executive sponsor',
    evidenceRule: 'Risk movement, KRI breach and treatment decision evidence must be captured before board reporting.',
    readiness: 'evidence_required'
  },
  {
    code: 'QUARTERLY-CONTROL-TESTING',
    title: 'Quarterly control testing cycle',
    cadence: 'Quarterly',
    owner: 'Control owner + assurance reviewer',
    evidenceRule: 'Each failed test must create an exception/CAPA with accepted evidence before closure.',
    readiness: 'monitoring'
  },
  {
    code: 'COMPLIANCE-OBLIGATION-CHECK',
    title: 'Compliance obligation status check',
    cadence: 'Monthly / regulatory trigger',
    owner: 'Compliance officer',
    evidenceRule: 'Obligation status changes require source reference, mapped control and evidence snapshot.',
    readiness: 'review_required'
  },
  {
    code: 'AUDITOR-EVIDENCE-PACK',
    title: 'External auditor evidence pack cycle',
    cadence: 'Before external review',
    owner: 'Governance admin + audit lead',
    evidenceRule: 'Only reviewed records and accepted evidence should enter the read-only auditor pack.',
    readiness: 'blocked'
  }
];

export const v250DataBridgeItems: V250DataBridgeItem[] = [
  {
    source: 'Framework requirements and control library',
    target: 'Crosswalk coverage dashboard',
    bridgeStatus: 'evidence_required',
    controlPoint: 'Requirement-to-control mapping must be approved before reporting coverage.',
    reviewer: 'Compliance officer'
  },
  {
    source: 'Control test results',
    target: 'CAPA and assurance reporting',
    bridgeStatus: 'monitoring',
    controlPoint: 'Failed test results must create exception records and cannot silently disappear.',
    reviewer: 'Internal audit lead'
  },
  {
    source: 'Evidence files and integrity hashes',
    target: 'Auditor evidence workspace',
    bridgeStatus: 'review_required',
    controlPoint: 'Evidence must be accepted and indexed before external-auditor export.',
    reviewer: 'Governance admin'
  },
  {
    source: 'User role and privilege changes',
    target: 'SoD and access review log',
    bridgeStatus: 'blocked',
    controlPoint: 'Privileged access changes must be reviewed before production reliance.',
    reviewer: 'IT manager / security reviewer'
  }
];

export const v250AccessReviewItems: V250AccessReviewItem[] = [
  {
    role: 'Governance administrator',
    segregationRule: 'Can configure workflow but should not approve own evidence or close own CAPA.',
    reviewCadence: 'Monthly during pilot, quarterly after stabilization',
    evidenceRequired: 'Role export, reviewer sign-off and exception list',
    status: 'evidence_required'
  },
  {
    role: 'Risk owner / control owner',
    segregationRule: 'Can own treatment and evidence, but final assurance status must be independently reviewed.',
    reviewCadence: 'Quarterly',
    evidenceRequired: 'Assigned controls, tests and open exceptions report',
    status: 'monitoring'
  },
  {
    role: 'Internal auditor',
    segregationRule: 'Can test and report, but should not approve management remediation as the owner.',
    reviewCadence: 'Each engagement',
    evidenceRequired: 'Engagement access review and finding approval trail',
    status: 'review_required'
  },
  {
    role: 'External auditor / read-only reviewer',
    segregationRule: 'Read/export only; no record changes, no evidence acceptance, no workflow closure.',
    reviewCadence: 'Each audit window',
    evidenceRequired: 'Read-only workspace manifest and export hash',
    status: 'blocked'
  }
];

export const v250OperatingMetrics: V250OperatingMetric[] = [
  {
    label: 'Live data policy',
    value: 'Bridge-gated',
    status: 'review_required',
    note: 'New professional tables remain blocked to direct authenticated access until reviewed org-scoped policies or Edge bridges are approved.'
  },
  {
    label: 'Operating cycles',
    value: '4',
    status: 'evidence_required',
    note: 'Risk, control testing, compliance and auditor-pack cycles are defined but require real owner evidence.'
  },
  {
    label: 'Access review model',
    value: 'SoD-aware',
    status: 'monitoring',
    note: 'The platform now has an explicit role review and evidence expectation for production reliance.'
  },
  {
    label: 'Production reliance',
    value: 'Not automatic',
    status: 'blocked',
    note: 'This pack intentionally does not turn on broad writes; production use still needs staged approval and live access review.'
  }
];
