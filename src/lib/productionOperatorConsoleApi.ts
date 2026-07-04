import {
  getBackupRestoreOperationsDashboard,
  getBlockingLimitations,
  getGoNoGoDashboard,
  getHospitalAdoptionReadinessReviews,
  getHospitalDepartmentLaunchPacks,
  getHospitalOperationsLaunchBlockers,
  getHospitalOperationsReadinessOverlay,
  getHospitalPolicyAttestationReadiness,
  getHospitalSupportReadinessRecords,
  getKnownLimitationsRegister,
  getLivePilotExecutionOverlay,
  getLivePilotWorkflowBlockers,
  getPilotAcceptedLimitations,
  getPilotClosureBlockers,
  getPilotClosureGoLiveOverlay,
  getProductionGoLiveDecisions,
  getProductionHypercareBlockers,
  getProductionHypercareIssues,
  getProductionHypercareOverlay,
  getProductionReadinessSignoffRegister,
  getRealPilotLaunchBlockers,
  getRealPilotSetupOverlay,
  getRuntimeAccessReviewBlockers,
  getRuntimeAccessReviewOverlay,
} from './productionReadinessApi';

export type OperatorStatus = 'Safe to operate' | 'Operate with limitations' | 'Action required' | 'Blocked' | 'Evidence required';

export interface ProductionOperatorConsoleData {
  status: OperatorStatus;
  reason: string;
  nextRequiredAction: string;
  owner: string;
  lastReviewedAt: string | null;
  evidenceState: string;
  readiness: any;
  realPilot: any;
  livePilot: any;
  closure: any;
  hypercare: any;
  hospital: any;
  access: any;
  limitations: any[];
  blockingLimitations: any[];
  acceptedLimitations: any[];
  signoffs: any[];
  backup: any[];
  departmentLaunchPacks: any[];
  departmentBlockers: any[];
  realPilotBlockers: any[];
  liveWorkflowBlockers: any[];
  closureBlockers: any[];
  hypercareBlockers: any[];
  accessBlockers: any[];
  hypercareIssues: any[];
  supportReadiness: any[];
  policyAttestations: any[];
  adoptionReadiness: any[];
  goLiveDecisions: any[];
}

const evidenceText = 'Evidence has not been recorded.';

const numberValue = (value: unknown) => Number(value ?? 0) || 0;

const hasAnyData = (...items: unknown[]) => items.some(item => {
  if (Array.isArray(item)) return item.length > 0;
  return item && typeof item === 'object' && Object.keys(item as Record<string, unknown>).length > 0;
});

function deriveStatus(data: Omit<ProductionOperatorConsoleData, 'status' | 'reason' | 'nextRequiredAction' | 'owner' | 'lastReviewedAt' | 'evidenceState'>) {
  const criticalHypercare = numberValue(data.hypercare?.high_critical_hypercare_issues)
    + data.hypercareIssues.filter(issue => ['critical', 'high'].includes(String(issue.severity ?? '').toLowerCase())).length;
  const blockedDepartments = numberValue(data.hospital?.blocked_departments)
    + data.departmentLaunchPacks.filter(row => row.launch_status === 'blocked').length;
  const failedRecovery = data.backup.filter(row => ['failed', 'blocked'].includes(String(row.operation_status ?? row.status ?? '').toLowerCase())).length;
  const missingExecutiveSignoff = data.goLiveDecisions.filter(row => ['pending', 'rejected', 'deferred'].includes(String(row.decision_status ?? '').toLowerCase())).length;
  const hardBlockers = data.blockingLimitations?.length ?? 0;

  if (hardBlockers || criticalHypercare || blockedDepartments || failedRecovery || missingExecutiveSignoff) {
    return {
      status: 'Blocked' as OperatorStatus,
      reason: 'Critical blockers, department readiness gaps, recovery issues, or executive decisions require attention.',
      nextRequiredAction: 'Review critical blockers and assign owners before continuing wider operation.',
    };
  }

  const actionItems = numberValue(data.hypercare?.overdue_hypercare_issues)
    + numberValue(data.hypercare?.missed_cadence_events)
    + numberValue(data.hospital?.missing_owner_count)
    + numberValue(data.hospital?.incomplete_launch_checklist_items)
    + numberValue(data.hospital?.policy_attestation_gaps)
    + numberValue(data.hospital?.training_incomplete_count)
    + numberValue(data.hospital?.support_readiness_blockers)
    + data.accessBlockers.length
    + data.departmentBlockers.length
    + data.realPilotBlockers.length
    + data.liveWorkflowBlockers.length
    + data.closureBlockers.length;

  if (actionItems) {
    return {
      status: 'Action required' as OperatorStatus,
      reason: 'One or more departments, support areas, access reviews, or readiness gates need owner action.',
      nextRequiredAction: 'Clear overdue items, missing owners, readiness blockers, and evidence gaps.',
    };
  }

  const hasLimitations = data.limitations.length > 0 || data.acceptedLimitations.length > 0
    || numberValue(data.hospital?.ready_with_limitations_departments) > 0
    || String(data.closure?.production_go_live_readiness_status ?? '').includes('limitation');

  if (!hasAnyData(data.hospital, data.hypercare, data.closure, data.access, data.backup, data.departmentLaunchPacks)) {
    return {
      status: 'Evidence required' as OperatorStatus,
      reason: evidenceText,
      nextRequiredAction: 'Record operational evidence, department launch packs, recovery checks, access reviews, and signoffs.',
    };
  }

  if (hasLimitations) {
    return {
      status: 'Operate with limitations' as OperatorStatus,
      reason: 'Limitations are recorded and should remain under active review.',
      nextRequiredAction: 'Review accepted limitations and confirm executive approval conditions.',
    };
  }

  return {
    status: 'Safe to operate' as OperatorStatus,
    reason: 'No current operational blockers are recorded in the readiness views.',
    nextRequiredAction: 'Continue daily monitoring and evidence review.',
  };
}

export async function getProductionOperatorConsoleData(): Promise<ProductionOperatorConsoleData> {
  const [
    readiness,
    realPilot,
    livePilot,
    closure,
    hypercare,
    hospital,
    access,
    limitations,
    blockingLimitations,
    acceptedLimitations,
    signoffs,
    backup,
    departmentLaunchPacks,
    departmentBlockers,
    realPilotBlockers,
    liveWorkflowBlockers,
    closureBlockers,
    hypercareBlockers,
    accessBlockers,
    hypercareIssues,
    supportReadiness,
    policyAttestations,
    adoptionReadiness,
    goLiveDecisions,
  ] = await Promise.all([
    getGoNoGoDashboard(),
    getRealPilotSetupOverlay(),
    getLivePilotExecutionOverlay(),
    getPilotClosureGoLiveOverlay(),
    getProductionHypercareOverlay(),
    getHospitalOperationsReadinessOverlay(),
    getRuntimeAccessReviewOverlay(),
    getKnownLimitationsRegister(),
    getBlockingLimitations(),
    getPilotAcceptedLimitations(),
    getProductionReadinessSignoffRegister(),
    getBackupRestoreOperationsDashboard(),
    getHospitalDepartmentLaunchPacks(),
    getHospitalOperationsLaunchBlockers(),
    getRealPilotLaunchBlockers(),
    getLivePilotWorkflowBlockers(),
    getPilotClosureBlockers(),
    getProductionHypercareBlockers(),
    getRuntimeAccessReviewBlockers(),
    getProductionHypercareIssues(),
    getHospitalSupportReadinessRecords(),
    getHospitalPolicyAttestationReadiness(),
    getHospitalAdoptionReadinessReviews(),
    getProductionGoLiveDecisions(),
  ]);

  const base = {
    readiness,
    realPilot,
    livePilot,
    closure,
    hypercare,
    hospital,
    access,
    limitations,
    blockingLimitations,
    acceptedLimitations,
    signoffs,
    backup,
    departmentLaunchPacks,
    departmentBlockers,
    realPilotBlockers,
    liveWorkflowBlockers,
    closureBlockers,
    hypercareBlockers,
    accessBlockers,
    hypercareIssues,
    supportReadiness,
    policyAttestations,
    adoptionReadiness,
    goLiveDecisions,
  };
  const derived = deriveStatus(base);

  return {
    ...base,
    ...derived,
    owner: 'Awaiting owner action.',
    lastReviewedAt: new Date().toISOString(),
    evidenceState: hasAnyData(hospital, hypercare, closure, access, backup, departmentLaunchPacks)
      ? 'Review required.'
      : evidenceText,
  };
}
