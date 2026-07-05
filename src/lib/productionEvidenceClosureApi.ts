import {
  getBackupRestoreOperationsDashboard,
  getBlockingLimitations,
  getHospitalAdoptionReadinessReviews,
  getHospitalDepartmentLaunchPacks,
  getHospitalOperationsLaunchBlockers,
  getHospitalPolicyAttestationReadiness,
  getHospitalSupportReadinessRecords,
  getKnownLimitationsRegister,
  getPilotAcceptedLimitations,
  getProductionGoLiveDecisions,
  getProductionHypercareBlockers,
  getProductionReadinessSignoffRegister,
  getRuntimeAccessReviewBlockers,
} from './productionReadinessApi';
import { invokePrivilegedAction } from './privilegedAction';

export type EvidenceClosureStatus =
  | 'open'
  | 'under_review'
  | 'accepted_with_limitation'
  | 'closed'
  | 'overdue'
  | 'blocked'
  | 'evidence_required';

export type EvidenceClosureRecommendation =
  | 'Ready for executive review'
  | 'Review required'
  | 'Blocked'
  | 'Evidence required';

export interface ProductionEvidenceClosureItem {
  id: string;
  category: string;
  title: string;
  departmentOrScope: string;
  owner: string;
  reviewer: string;
  dueDate: string;
  evidenceState: EvidenceClosureStatus;
  reviewerState: string;
  blockerState: string;
  nextAction: string;
  description: string;
  requiredEvidence: string;
  linkedEvidenceReferences: string[];
  comments: string;
  closureDecisionState: string;
  limitationState: string;
}

export type ControlledEvidenceClosureActionType =
  | 'add_note'
  | 'ready_for_review'
  | 'request_more_evidence'
  | 'accept_with_limitation'
  | 'close_as_verified'
  | 'reopen_with_reason';

export interface ControlledEvidenceClosureActionRequest {
  evidenceId: string;
  actionType: ControlledEvidenceClosureActionType;
  actionReason?: string;
  actionNote?: string;
  previousState?: EvidenceClosureStatus | string;
  hasBlocker?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ControlledEvidenceClosureActionResult {
  id: string;
  evidence_id: string;
  action_type: ControlledEvidenceClosureActionType;
  previous_state: string | null;
  next_state: string;
  created_at: string;
  message: string;
}

export interface ControlledEvidenceClosureActionHistoryRow {
  id: string;
  evidence_id: string;
  action_type: ControlledEvidenceClosureActionType;
  action_reason: string | null;
  action_note: string | null;
  previous_state: string | null;
  next_state: string;
  actor_id: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface ControlledEvidenceClosureActionAvailability {
  actionType: ControlledEvidenceClosureActionType;
  label: string;
  available: boolean;
  reasonRequired: boolean;
  disabledReason: string;
  nextStateLabel: string;
  warning: string;
}

export interface EvidenceClosureHandoff {
  recommendedNextAction: string;
  safeManagementDestination: string;
  destinationPage: 'productionReadiness';
  directClosureAvailability: string;
  requiredEvidenceBeforeClosure: string;
  reviewerDecisionNeeded: string;
  limitationDecisionNeeded: string;
}

export interface EvidenceReviewerDecisionReadiness {
  readiness: string;
  requiredReviewerAction: string;
  closureDecisionState: string;
  closureBlockerReason: string;
  evidenceNeededBeforeReview: string;
  limitationDecisionNeeded: string;
  sourceWorkflowDestination: string;
  closureAvailability: string;
}

export interface EvidenceOwnershipDueDateReadiness {
  ownerState: string;
  reviewerState: string;
  dueDateState: string;
  overdueStatus: string;
  blockedStatus: string;
  escalationReadinessState: string;
  nextAccountableParty: string;
  ownerDisplay: string;
  reviewerDisplay: string;
  missingWarnings: string[];
}

export interface ExecutiveClosureRecommendationReadiness {
  recommendationState: EvidenceClosureRecommendation;
  recommendationReason: string;
  blockingIssuesCount: number;
  evidenceRequiredCount: number;
  reviewRequiredCount: number;
  overdueEvidenceCount: number;
  missingAssignmentCount: number;
  requiredExecutiveActions: string[];
  caveat: string;
}

export interface DepartmentEvidenceRegisterRow {
  department: string;
  launchReadiness: string;
  missingEvidenceCount: number;
  trainingEvidence: string;
  policyEvidence: string;
  supportEvidence: string;
  adoptionEvidence: string;
  owner: string;
  nextAction: string;
}

export interface DepartmentEvidenceCoverageReadiness {
  coverageState: string;
  missingEvidenceCategories: string[];
  ownerReviewerReadinessSummary: string;
  dueDateOverdueSummary: string;
  blockerEscalationSummary: string;
  nextSourceWorkflowDestination: string;
  priorityState: string;
  caveat: string;
}

export interface PolicySopAttestationReadiness {
  readinessState: string;
  missingAttestationEvidenceSummary: string;
  ownerReviewerReadiness: string;
  dueDateOrOverdueState: string;
  sourceWorkflowDestination: string;
  executiveImpact: string;
  caveat: string;
}

export interface BackupRestoreDrEvidenceReadiness {
  readinessState: string;
  missingRecoveryEvidenceSummary: string;
  ownerReviewerReadiness: string;
  dueDateOrOverdueState: string;
  sourceWorkflowDestination: string;
  executiveImpact: string;
  caveat: string;
}

export interface AccessReviewSecurityEvidenceReadiness {
  readinessState: string;
  missingSecurityEvidenceSummary: string;
  ownerReviewerReadiness: string;
  dueDateOrOverdueState: string;
  sourceWorkflowDestination: string;
  executiveImpact: string;
  caveat: string;
}

export interface TrainingAdoptionSupportEvidenceReadiness {
  readinessState: string;
  missingAdoptionEvidenceSummary: string;
  ownerReviewerReadiness: string;
  dueDateOrOverdueState: string;
  sourceWorkflowDestination: string;
  executiveImpact: string;
  caveat: string;
}

export type ExecutiveGoNoGoDecisionState =
  | 'No-go: blockers unresolved'
  | 'Conditional go review'
  | 'Review required'
  | 'Ready for executive decision review';

export interface ExecutiveGoNoGoDecisionPack {
  decisionPackState: ExecutiveGoNoGoDecisionState;
  recommendationReason: string;
  unresolvedBlockerSummary: string;
  acceptedLimitationSummary: string;
  controlledClosureActionSummary: string;
  evidenceClosureSummary: {
    verifiedEvidenceCount: number;
    readyForReviewCount: number;
    requiringMoreEvidenceCount: number;
    reopenedEvidenceCount: number;
  };
  requiredExecutiveReviewItems: string[];
  requiredOperationalActionsBeforeDecision: string[];
  caveat: string;
  productionLaunchAuthorityCaveat: string;
}

export interface ProductionEvidenceClosureData {
  overview: {
    totalEvidenceGaps: number;
    openGaps: number;
    underReview: number;
    acceptedWithLimitation: number;
    closed: number;
    overdue: number;
    blocked: number;
    evidenceRequired: number;
    nextRequiredAction: string;
    owner: string;
  };
  intakeQueue: ProductionEvidenceClosureItem[];
  departmentRegister: DepartmentEvidenceRegisterRow[];
  executivePack: {
    unresolvedBlockers: number;
    acceptedLimitationsRequiringReview: number;
    missingSignoffs: number;
    recoveryEvidenceState: string;
    departmentReadinessGaps: number;
    finalRecommendationState: EvidenceClosureRecommendation;
  };
}

const evidenceMissing = 'Evidence has not been recorded.';
const reviewRequired = 'Review required.';
const ownerAction = 'Awaiting owner action.';
const noBlocker = 'No blocker currently recorded.';
const sourceWorkflowClosure = 'Closure must be completed in the source workflow.';
const evidenceLevelCaveat = 'Evidence closure does not approve production launch.';

export const controlledEvidenceClosureActionTypes: ControlledEvidenceClosureActionType[] = [
  'add_note',
  'ready_for_review',
  'request_more_evidence',
  'accept_with_limitation',
  'close_as_verified',
  'reopen_with_reason',
];

const categoryRequiredEvidence: Record<string, string> = {
  'Department launch': 'Department owner, launch checklist, participant coverage, support path, and launch decision evidence.',
  'Training adoption': 'Training completion, adoption review, and follow-up evidence.',
  'Policy/SOP attestation': 'Policy or SOP acknowledgement evidence by required audience.',
  'Support readiness': 'Named support owner, escalation path, response readiness, and runbook evidence.',
  'Backup/Restore/DR': 'Backup, restore, and recovery assurance evidence.',
  'Access/Security review': 'Access review decision, limitation, or remediation evidence.',
  'Executive signoff': 'Named executive decision and signoff evidence.',
  'Accepted limitations': 'Risk acceptance, limitation owner, review date, and executive awareness evidence.',
  'Other production evidence': 'Recorded readiness, limitation, or closure evidence.',
};

const actionLabels: Record<ControlledEvidenceClosureActionType, string> = {
  add_note: 'Add note',
  ready_for_review: 'Ready for review',
  request_more_evidence: 'Request more evidence',
  accept_with_limitation: 'Accept with limitation',
  close_as_verified: 'Close as verified',
  reopen_with_reason: 'Reopen with reason',
};

const actionNextStateLabels: Record<ControlledEvidenceClosureActionType, string> = {
  add_note: 'No state change',
  ready_for_review: 'Under review',
  request_more_evidence: 'Evidence required',
  accept_with_limitation: 'Accepted with limitation',
  close_as_verified: 'Closed as verified',
  reopen_with_reason: 'Open',
};

const numberValue = (value: unknown) => Number(value ?? 0) || 0;

function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function normalizeStatus(value: unknown): EvidenceClosureStatus {
  const normalized = String(value ?? '').toLowerCase();
  if (['approved', 'accepted', 'attested', 'ready', 'complete', 'completed', 'closed', 'verified'].includes(normalized)) return 'closed';
  if (['under_review', 'ready_for_review', 'pending_review', 'submitted'].includes(normalized)) return 'under_review';
  if (['approved_with_limitation', 'accepted_with_limitation', 'ready_with_limitations'].includes(normalized)) return 'accepted_with_limitation';
  if (['overdue', 'late'].includes(normalized)) return 'overdue';
  if (['blocked', 'failed', 'rejected'].includes(normalized)) return 'blocked';
  if (['evidence_required', 'missing', 'pending', 'planning', 'not_started', ''].includes(normalized)) return 'evidence_required';
  return 'open';
}

export function getEvidenceClosureHandoff(item?: Pick<ProductionEvidenceClosureItem, 'category' | 'evidenceState' | 'reviewerState' | 'limitationState' | 'requiredEvidence'>): EvidenceClosureHandoff {
  const state = item?.evidenceState ?? 'evidence_required';
  const requiresReviewerDecision = ['under_review', 'open', 'evidence_required', 'overdue', 'blocked'].includes(state);
  const limitationText = String(item?.limitationState ?? '').toLowerCase();
  const requiresLimitationDecision = state === 'accepted_with_limitation'
    || limitationText.includes('limitation')
    || limitationText.includes('exception');

  return {
    recommendedNextAction: state === 'closed'
      ? 'Keep evidence available for executive review.'
      : state === 'under_review'
        ? 'Reviewer decision required.'
        : state === 'accepted_with_limitation'
          ? 'Limitation or exception decision required before closure.'
          : state === 'blocked'
            ? 'Resolve the blocker or record an accepted limitation in the source register.'
            : state === 'overdue'
              ? 'Record evidence in the source register and send for review.'
              : 'Record evidence in the source register.',
    safeManagementDestination: 'Production Readiness Center',
    destinationPage: 'productionReadiness',
    directClosureAvailability: 'No closure action is available from this screen.',
    requiredEvidenceBeforeClosure: item?.requiredEvidence || categoryRequiredEvidence[item?.category ?? ''] || evidenceMissing,
    reviewerDecisionNeeded: requiresReviewerDecision ? 'Reviewer decision required.' : 'Reviewer decision recorded.',
    limitationDecisionNeeded: requiresLimitationDecision ? 'Limitation or exception decision required.' : 'No limitation decision currently recorded.',
  };
}

function hasRecordedEvidence(item?: Pick<ProductionEvidenceClosureItem, 'linkedEvidenceReferences'>) {
  return Boolean(item?.linkedEvidenceReferences.some(reference => reference && reference !== evidenceMissing));
}

export function getControlledEvidenceClosureActionLabel(actionType: ControlledEvidenceClosureActionType) {
  return actionLabels[actionType];
}

export function getControlledEvidenceClosureNextStateLabel(actionType: ControlledEvidenceClosureActionType) {
  return actionNextStateLabels[actionType];
}

export function requiresControlledEvidenceClosureReason(actionType: ControlledEvidenceClosureActionType) {
  return ['request_more_evidence', 'accept_with_limitation', 'reopen_with_reason'].includes(actionType);
}

export function getControlledEvidenceClosureActionAvailability(
  item: ProductionEvidenceClosureItem | undefined,
  actionType: ControlledEvidenceClosureActionType,
): ControlledEvidenceClosureActionAvailability {
  const reasonRequired = requiresControlledEvidenceClosureReason(actionType);
  const state = item?.evidenceState ?? 'evidence_required';
  const evidenceRecorded = hasRecordedEvidence(item);
  const blocked = item?.evidenceState === 'blocked' || !isMissingValue(item?.blockerState);
  const closed = state === 'closed';
  let available = Boolean(item);
  let disabledReason = item ? '' : 'Evidence item required.';
  let warning = '';

  if (actionType === 'ready_for_review' && (!evidenceRecorded || closed || blocked)) {
    available = false;
    disabledReason = !evidenceRecorded
      ? 'Evidence required before review.'
      : blocked
        ? 'Blocked.'
        : 'Closed in source workflow.';
  }
  if (actionType === 'request_more_evidence' && closed) {
    available = false;
    disabledReason = 'Closed in source workflow.';
  }
  if (actionType === 'accept_with_limitation') {
    warning = 'Executive review is still required for accepted limitations.';
    if (closed) {
      available = false;
      disabledReason = 'Closed in source workflow.';
    }
  }
  if (actionType === 'close_as_verified') {
    warning = evidenceLevelCaveat;
    if (!evidenceRecorded || blocked || state === 'evidence_required' || state === 'overdue') {
      available = false;
      disabledReason = blocked
        ? 'Blocked.'
        : !evidenceRecorded || state === 'evidence_required'
          ? 'Evidence required before review.'
          : 'Owner action required.';
    }
  }
  if (actionType === 'reopen_with_reason' && !['closed', 'accepted_with_limitation'].includes(state)) {
    available = false;
    disabledReason = 'Reopen is available after closure or limitation acceptance.';
  }

  return {
    actionType,
    label: actionLabels[actionType],
    available,
    reasonRequired,
    disabledReason,
    nextStateLabel: actionNextStateLabels[actionType],
    warning,
  };
}

export function getAvailableControlledEvidenceClosureActions(item?: ProductionEvidenceClosureItem) {
  return controlledEvidenceClosureActionTypes
    .map(actionType => getControlledEvidenceClosureActionAvailability(item, actionType))
    .filter(action => action.available);
}

export function validateControlledEvidenceClosureActionRequest(
  request: ControlledEvidenceClosureActionRequest,
  item?: ProductionEvidenceClosureItem,
) {
  if (!request.evidenceId.trim()) return 'Evidence identifier is required.';
  if (requiresControlledEvidenceClosureReason(request.actionType) && !request.actionReason?.trim()) {
    return 'Reason required.';
  }
  const availability = getControlledEvidenceClosureActionAvailability(item, request.actionType);
  if (!availability.available) return availability.disabledReason || 'Controlled evidence action is not available.';
  if (request.actionType === 'close_as_verified' && (request.hasBlocker || item?.evidenceState === 'blocked' || !isMissingValue(item?.blockerState))) {
    return 'Blocked.';
  }
  return '';
}

export function getControlledEvidenceClosureHistoryDisplay(row?: ControlledEvidenceClosureActionHistoryRow | ControlledEvidenceClosureActionResult) {
  if (!row) return 'Action history has not been recorded.';
  const actionType = 'action_type' in row ? row.action_type : 'add_note';
  const nextState = 'next_state' in row ? row.next_state : '';
  return `${getControlledEvidenceClosureActionLabel(actionType)} recorded. Next state: ${nextState || 'No state change'}.`;
}

function isMissingValue(value?: string) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return !normalized
    || normalized === evidenceMissing.toLowerCase()
    || normalized === reviewRequired.toLowerCase()
    || normalized === ownerAction.toLowerCase()
    || normalized === noBlocker.toLowerCase()
    || normalized === 'not assigned'
    || normalized === 'none';
}

function parseDueDate(value?: string) {
  if (isMissingValue(value)) return null;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

export function getEvidenceOwnerDisplay(value?: string) {
  return isMissingValue(value) ? 'Owner not assigned.' : String(value);
}

export function getEvidenceOwnershipState(item?: Pick<ProductionEvidenceClosureItem, 'owner' | 'reviewer'>) {
  const ownerMissing = isMissingValue(item?.owner);
  const reviewerMissing = isMissingValue(item?.reviewer);
  return {
    ownerState: ownerMissing ? 'Owner missing' : 'Owner assigned',
    reviewerState: reviewerMissing ? 'Reviewer missing' : 'Reviewer assigned',
    nextAccountableParty: ownerMissing
      ? 'Owner action required.'
      : reviewerMissing
        ? 'Reviewer action required.'
        : 'Awaiting reviewer action.',
    ownerDisplay: getEvidenceOwnerDisplay(item?.owner),
    reviewerDisplay: reviewerMissing ? 'Reviewer not assigned.' : String(item?.reviewer),
    missingWarnings: [
      ownerMissing ? 'Owner not assigned.' : '',
      reviewerMissing ? 'Reviewer not assigned.' : '',
    ].filter(Boolean),
  };
}

export function getEvidenceDueDateState(item?: Pick<ProductionEvidenceClosureItem, 'dueDate' | 'evidenceState'>) {
  const dueDate = parseDueDate(item?.dueDate);
  if (!dueDate) {
    return {
      dueDateState: 'Due date missing',
      overdueStatus: item?.evidenceState === 'overdue' ? 'Overdue.' : 'Due date not recorded.',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = dueDate.getTime() - today.getTime();
  const dueSoonMs = 7 * 24 * 60 * 60 * 1000;

  if (diffMs < 0 || item?.evidenceState === 'overdue') {
    return { dueDateState: 'Due date recorded', overdueStatus: 'Overdue.' };
  }
  if (diffMs <= dueSoonMs) {
    return { dueDateState: 'Due date recorded', overdueStatus: 'Due soon.' };
  }
  return { dueDateState: 'Due date recorded', overdueStatus: 'No overdue status recorded.' };
}

export function getEvidenceEscalationReadiness(item?: Pick<ProductionEvidenceClosureItem, 'evidenceState' | 'blockerState' | 'owner' | 'reviewer' | 'dueDate'>) {
  const ownership = getEvidenceOwnershipState(item);
  const dueDate = getEvidenceDueDateState(item);
  const blocked = item?.evidenceState === 'blocked' || !isMissingValue(item?.blockerState);
  const escalationNeeded = blocked
    || dueDate.overdueStatus === 'Overdue.'
    || ownership.ownerState === 'Owner missing'
    || ownership.reviewerState === 'Reviewer missing';

  return {
    blockedStatus: blocked ? 'Blocked.' : noBlocker,
    escalationReadinessState: escalationNeeded ? 'Escalation may be required.' : 'No escalation currently indicated.',
  };
}

export function getEvidenceOwnershipDueDateReadiness(item?: ProductionEvidenceClosureItem): EvidenceOwnershipDueDateReadiness {
  const ownership = getEvidenceOwnershipState(item);
  const dueDate = getEvidenceDueDateState(item);
  const escalation = getEvidenceEscalationReadiness(item);
  const missingWarnings = [
    ...ownership.missingWarnings,
    dueDate.dueDateState === 'Due date missing' ? 'Due date not recorded.' : '',
  ].filter(Boolean);

  return {
    ...ownership,
    ...dueDate,
    ...escalation,
    nextAccountableParty: escalation.blockedStatus === 'Blocked.'
      ? 'Owner action required.'
      : dueDate.overdueStatus === 'Overdue.'
        ? 'Owner action required.'
        : ownership.nextAccountableParty,
    missingWarnings,
  };
}

export function getExecutiveClosureBlockers(data?: ProductionEvidenceClosureData, signals?: { ownerMissingCount?: number; reviewerMissingCount?: number }) {
  const pack = data?.executivePack;
  const overview = data?.overview;
  const blockingIssuesCount = numberValue(pack?.unresolvedBlockers) + numberValue(overview?.blocked);
  const recoveryEvidenceMissing = String(pack?.recoveryEvidenceState ?? '').trim() === evidenceMissing;
  const evidenceRequiredCount = numberValue(overview?.evidenceRequired)
    + numberValue(pack?.departmentReadinessGaps)
    + (recoveryEvidenceMissing ? 1 : 0);
  const reviewRequiredCount = numberValue(overview?.underReview)
    + numberValue(overview?.openGaps)
    + numberValue(pack?.missingSignoffs)
    + numberValue(pack?.acceptedLimitationsRequiringReview);
  const overdueEvidenceCount = numberValue(overview?.overdue);
  const missingAssignmentCount = numberValue(signals?.ownerMissingCount) + numberValue(signals?.reviewerMissingCount);

  return {
    blockingIssuesCount,
    evidenceRequiredCount,
    reviewRequiredCount,
    overdueEvidenceCount,
    missingAssignmentCount,
  };
}

export function getExecutiveClosureReadinessReason(blockers: ReturnType<typeof getExecutiveClosureBlockers>) {
  if (blockers.blockingIssuesCount > 0) return 'Blocking issues must be resolved or formally accepted before executive review.';
  if (blockers.evidenceRequiredCount > 0) return 'Recorded evidence is required before closure.';
  if (blockers.overdueEvidenceCount > 0) return 'Overdue evidence requires owner follow-up before executive review.';
  if (blockers.missingAssignmentCount > 0) return 'Missing owner or reviewer assignments require follow-up before executive review.';
  if (blockers.reviewRequiredCount > 0) return 'Reviewer decisions, limitations, or executive signoffs remain open.';
  return 'Recorded evidence and source workflow status support executive review.';
}

export function getExecutiveRequiredActions(data?: ProductionEvidenceClosureData, signals?: { ownerMissingCount?: number; reviewerMissingCount?: number }) {
  const pack = data?.executivePack;
  const blockers = getExecutiveClosureBlockers(data, signals);
  const actions = [
    blockers.blockingIssuesCount > 0 ? 'Resolve blockers or record accepted limitations in the source workflow.' : '',
    blockers.evidenceRequiredCount > 0 ? 'Recorded evidence is required before closure.' : '',
    blockers.overdueEvidenceCount > 0 ? 'Assign overdue evidence follow-up.' : '',
    blockers.missingAssignmentCount > 0 ? 'Assign missing owners and reviewers.' : '',
    numberValue(pack?.missingSignoffs) > 0 ? 'Executive signoff required.' : '',
    numberValue(pack?.acceptedLimitationsRequiringReview) > 0 ? 'Open limitations require executive review.' : '',
    'Closure depends on source workflow status.',
  ].filter(Boolean);

  return actions.length ? actions : ['Ready for executive review.'];
}

export function getExecutiveClosureRecommendation(data?: ProductionEvidenceClosureData, signals?: { ownerMissingCount?: number; reviewerMissingCount?: number }): ExecutiveClosureRecommendationReadiness {
  const blockers = getExecutiveClosureBlockers(data, signals);
  const hasNoEvidenceItems = !data || numberValue(data.overview.totalEvidenceGaps) === 0;
  
  let recommendationState: EvidenceClosureRecommendation = blockers.blockingIssuesCount > 0
    ? 'Blocked'
    : hasNoEvidenceItems || blockers.evidenceRequiredCount > 0
      ? 'Evidence required'
      : blockers.overdueEvidenceCount > 0 || blockers.missingAssignmentCount > 0 || blockers.reviewRequiredCount > 0
        ? 'Review required'
        : 'Ready for executive review';

  return {
    recommendationState,
    recommendationReason: getExecutiveClosureReadinessReason(blockers),
    ...blockers,
    requiredExecutiveActions: getExecutiveRequiredActions(data, signals),
    caveat: 'Executive review depends on recorded evidence and source workflow status.',
  };
}

export async function recordControlledEvidenceClosureAction(
  request: ControlledEvidenceClosureActionRequest,
): Promise<ControlledEvidenceClosureActionResult> {
  return invokePrivilegedAction<ControlledEvidenceClosureActionResult>('record_production_evidence_closure_action', {
    evidence_id: request.evidenceId,
    action_type: request.actionType,
    action_reason: request.actionReason ?? null,
    action_note: request.actionNote ?? null,
    previous_state: request.previousState ?? null,
    has_blocker: Boolean(request.hasBlocker),
    metadata: {
      ...(request.metadata ?? {}),
      evidence_level_closure_only: true,
    },
  });
}

export async function getControlledEvidenceClosureActionHistory(
  evidenceId: string,
): Promise<ControlledEvidenceClosureActionHistoryRow[]> {
  return invokePrivilegedAction<ControlledEvidenceClosureActionHistoryRow[]>('get_production_evidence_closure_action_history', {
    evidence_id: evidenceId,
  });
}

function categoryMissing(value?: string) {
  return isMissingValue(value) || normalizeStatus(value) === 'evidence_required';
}

export function getDepartmentMissingEvidenceCategories(row?: DepartmentEvidenceRegisterRow) {
  if (!row) return ['Department launch'];
  return [
    row.missingEvidenceCount > 0 || categoryMissing(row.launchReadiness) ? 'Department launch' : '',
    categoryMissing(row.trainingEvidence) ? 'Training adoption' : '',
    categoryMissing(row.policyEvidence) ? 'Policy/SOP attestation' : '',
    categoryMissing(row.supportEvidence) ? 'Support readiness' : '',
    categoryMissing(row.adoptionEvidence) ? 'Adoption evidence' : '',
  ].filter(Boolean);
}

export function getDepartmentEvidenceCoverageState(row?: DepartmentEvidenceRegisterRow) {
  if (!row) return 'Evidence required';
  const status = normalizeStatus(row.launchReadiness);
  if (status === 'blocked') return 'Blocked';
  if (row.owner === ownerAction) return 'Owner action required';
  if (getDepartmentMissingEvidenceCategories(row).length > 0) return 'Evidence required';
  if (status === 'under_review' || row.nextAction === reviewRequired) return 'Review required';
  return 'Coverage complete in source data';
}

export function getDepartmentEvidencePriority(row?: DepartmentEvidenceRegisterRow) {
  const coverageState = getDepartmentEvidenceCoverageState(row);
  if (coverageState === 'Blocked') return 'High priority';
  if (coverageState === 'Owner action required' || coverageState === 'Evidence required') return 'Priority follow-up';
  if (coverageState === 'Review required') return 'Review priority';
  return 'Monitor';
}

export function getDepartmentEvidenceNextSourceWorkflow(row?: DepartmentEvidenceRegisterRow) {
  if (!row) return 'Manage source evidence in Production Readiness Center.';
  const missing = getDepartmentMissingEvidenceCategories(row);
  if (row.owner === ownerAction) return 'Assign department owner in Production Readiness Center.';
  if (missing.includes('Support readiness')) return 'Manage support readiness in Production Readiness Center.';
  if (missing.includes('Policy/SOP attestation')) return 'Manage policy/SOP evidence in Production Readiness Center.';
  if (missing.includes('Training adoption') || missing.includes('Adoption evidence')) return 'Manage training and adoption evidence in Production Readiness Center.';
  return 'Manage source evidence in Production Readiness Center.';
}

export function getDepartmentEvidenceCoverage(row?: DepartmentEvidenceRegisterRow): DepartmentEvidenceCoverageReadiness {
  const coverageState = getDepartmentEvidenceCoverageState(row);
  const missingEvidenceCategories = getDepartmentMissingEvidenceCategories(row);
  const blocked = coverageState === 'Blocked';
  const ownerMissing = row?.owner === ownerAction;

  return {
    coverageState,
    missingEvidenceCategories: missingEvidenceCategories.length ? missingEvidenceCategories : ['No missing category currently recorded.'],
    ownerReviewerReadinessSummary: ownerMissing
      ? 'Owner action required.'
      : coverageState === 'Review required'
        ? 'Reviewer action required.'
        : 'Review required.',
    dueDateOverdueSummary: 'Due date not recorded.',
    blockerEscalationSummary: blocked
      ? 'Blocked.'
      : ownerMissing || missingEvidenceCategories.length > 0
        ? 'Escalation may be required.'
        : noBlocker,
    nextSourceWorkflowDestination: getDepartmentEvidenceNextSourceWorkflow(row),
    priorityState: getDepartmentEvidencePriority(row),
    caveat: 'Coverage depends on recorded source evidence.',
  };
}

function isPolicySopAttestationItem(item?: Pick<ProductionEvidenceClosureItem, 'category' | 'title' | 'requiredEvidence'>) {
  const text = `${item?.category ?? ''} ${item?.title ?? ''} ${item?.requiredEvidence ?? ''}`.toLowerCase();
  return text.includes('policy') || text.includes('sop') || text.includes('attestation') || text.includes('acknowledgement');
}

export function getPolicySopAttestationGapSummary(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow) {
  if (!source) return 'Attestation evidence required.';
  if ('policyEvidence' in source) {
    return categoryMissing(source.policyEvidence) ? 'Missing policy/SOP attestation evidence.' : 'Policy/SOP attestation evidence recorded.';
  }
  if (!isPolicySopAttestationItem(source)) return 'No policy/SOP attestation gap currently recorded for this item.';
  if (!hasRecordedEvidence(source)) return 'Attestation evidence required.';
  if (source.evidenceState === 'blocked') return 'Policy/SOP attestation evidence is blocked.';
  if (source.evidenceState === 'overdue') return 'Overdue attestation evidence.';
  return source.evidenceState === 'closed' ? 'Policy/SOP attestation evidence recorded.' : 'Review required.';
}

export function getPolicySopAttestationSourceDestination(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow) {
  if (source && 'policyEvidence' in source && categoryMissing(source.policyEvidence)) {
    return 'Manage attestation evidence in Production Readiness Center.';
  }
  if (source && !('policyEvidence' in source) && isPolicySopAttestationItem(source)) {
    return 'Manage attestation evidence in Production Readiness Center.';
  }
  return 'Manage source evidence in Production Readiness Center.';
}

export function getPolicySopAttestationExecutiveImpact(data?: ProductionEvidenceClosureData) {
  const missingDepartmentPolicyEvidence = data?.departmentRegister.filter(row => categoryMissing(row.policyEvidence)).length ?? 0;
  const missingPolicyItems = data?.intakeQueue.filter(item => isPolicySopAttestationItem(item) && item.evidenceState !== 'closed').length ?? 0;
  const missingTotal = missingDepartmentPolicyEvidence + missingPolicyItems;
  if (missingTotal > 0) return `Executive review required for ${missingTotal} policy/SOP attestation evidence gap${missingTotal === 1 ? '' : 's'}.`;
  return 'No executive policy/SOP attestation evidence impact currently recorded.';
}

export function getPolicySopAttestationReadiness(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow, data?: ProductionEvidenceClosureData): PolicySopAttestationReadiness {
  const isDepartmentRow = Boolean(source && 'policyEvidence' in source);
  const policyRelevant = isDepartmentRow || isPolicySopAttestationItem(source as ProductionEvidenceClosureItem | undefined);
  const ownership = isDepartmentRow
    ? { ownerState: (source as DepartmentEvidenceRegisterRow).owner === ownerAction ? 'Owner missing' : 'Owner assigned', reviewerState: 'Reviewer missing' }
    : getEvidenceOwnershipState(source as ProductionEvidenceClosureItem | undefined);
  const dueDate = isDepartmentRow
    ? { dueDateState: 'Due date missing', overdueStatus: 'Due date not recorded.' }
    : getEvidenceDueDateState(source as ProductionEvidenceClosureItem | undefined);
  const itemState = !isDepartmentRow ? (source as ProductionEvidenceClosureItem | undefined)?.evidenceState : undefined;
  const departmentPolicyMissing = isDepartmentRow ? categoryMissing((source as DepartmentEvidenceRegisterRow).policyEvidence) : false;

  const readinessState = !policyRelevant || departmentPolicyMissing || itemState === 'evidence_required'
    ? 'Attestation evidence required'
    : itemState === 'blocked'
      ? 'Blocked'
      : itemState === 'overdue'
        ? 'Overdue'
        : ownership.ownerState === 'Owner missing'
          ? 'Owner action required'
          : ownership.reviewerState === 'Reviewer missing'
            ? 'Reviewer action required'
            : itemState === 'closed'
              ? 'Attestation evidence recorded'
              : 'Review required';

  return {
    readinessState,
    missingAttestationEvidenceSummary: getPolicySopAttestationGapSummary(source),
    ownerReviewerReadiness: ownership.ownerState === 'Owner missing'
      ? 'Owner action required.'
      : ownership.reviewerState === 'Reviewer missing'
        ? 'Reviewer action required.'
        : 'Review required.',
    dueDateOrOverdueState: dueDate.overdueStatus === 'Overdue.' ? 'Overdue attestation evidence.' : dueDate.overdueStatus,
    sourceWorkflowDestination: getPolicySopAttestationSourceDestination(source),
    executiveImpact: getPolicySopAttestationExecutiveImpact(data),
    caveat: 'Attestation readiness depends on recorded source evidence.',
  };
}

function isBackupRestoreDrItem(item?: Pick<ProductionEvidenceClosureItem, 'category' | 'title' | 'requiredEvidence'>) {
  const text = `${item?.category ?? ''} ${item?.title ?? ''} ${item?.requiredEvidence ?? ''}`.toLowerCase();
  return text.includes('backup') || text.includes('restore') || text.includes('dr') || text.includes('recovery');
}

export function getBackupRestoreDrGapSummary(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow) {
  if (!source) return 'Backup evidence required. Restore test evidence required. DR evidence required.';
  if ('supportEvidence' in source) {
    return categoryMissing(source.supportEvidence)
      ? 'Recovery support evidence required.'
      : 'Recovery support evidence recorded.';
  }
  if (!isBackupRestoreDrItem(source)) return 'No backup, restore, or DR evidence gap currently recorded for this item.';
  if (!hasRecordedEvidence(source)) return 'Backup evidence required. Restore test evidence required. DR evidence required.';
  if (source.evidenceState === 'blocked') return 'Recovery evidence is blocked.';
  if (source.evidenceState === 'overdue') return 'Overdue recovery evidence.';
  if (source.evidenceState === 'closed') return 'Backup evidence recorded. Restore evidence recorded. DR evidence recorded.';
  return 'Review required.';
}

export function getBackupRestoreDrSourceDestination(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow) {
  if (source && !('supportEvidence' in source) && isBackupRestoreDrItem(source)) {
    return 'Manage recovery evidence in Production Readiness Center.';
  }
  return 'Manage recovery evidence in Production Readiness Center.';
}

export function getBackupRestoreDrExecutiveImpact(data?: ProductionEvidenceClosureData) {
  const missingRecoveryItems = data?.intakeQueue.filter(item => isBackupRestoreDrItem(item) && item.evidenceState !== 'closed').length ?? 0;
  const recoveryStateMissing = String(data?.executivePack.recoveryEvidenceState ?? '').trim() === evidenceMissing;
  const missingTotal = missingRecoveryItems + (recoveryStateMissing ? 1 : 0);
  if (missingTotal > 0) return `Executive review required for ${missingTotal} backup, restore, or DR evidence gap${missingTotal === 1 ? '' : 's'}.`;
  return 'No executive backup, restore, or DR evidence impact currently recorded.';
}

export function getBackupRestoreDrEvidenceReadiness(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow, data?: ProductionEvidenceClosureData): BackupRestoreDrEvidenceReadiness {
  const isDepartmentRow = Boolean(source && 'supportEvidence' in source);
  const recoveryRelevant = !source || isDepartmentRow || isBackupRestoreDrItem(source as ProductionEvidenceClosureItem | undefined);
  const ownership = isDepartmentRow
    ? { ownerState: (source as DepartmentEvidenceRegisterRow).owner === ownerAction ? 'Owner missing' : 'Owner assigned', reviewerState: 'Reviewer missing' }
    : getEvidenceOwnershipState(source as ProductionEvidenceClosureItem | undefined);
  const dueDate = isDepartmentRow
    ? { dueDateState: 'Due date missing', overdueStatus: 'Due date not recorded.' }
    : getEvidenceDueDateState(source as ProductionEvidenceClosureItem | undefined);
  const itemState = !isDepartmentRow ? (source as ProductionEvidenceClosureItem | undefined)?.evidenceState : undefined;
  const departmentRecoveryMissing = isDepartmentRow ? categoryMissing((source as DepartmentEvidenceRegisterRow).supportEvidence) : false;

  const readinessState = !recoveryRelevant || departmentRecoveryMissing || itemState === 'evidence_required'
    ? 'Backup evidence required'
    : itemState === 'blocked'
      ? 'Blocked'
      : itemState === 'overdue'
        ? 'Overdue'
        : ownership.ownerState === 'Owner missing'
          ? 'Owner action required'
          : ownership.reviewerState === 'Reviewer missing'
            ? 'Reviewer action required'
            : itemState === 'closed'
              ? 'Backup evidence recorded'
              : 'Review required';

  return {
    readinessState,
    missingRecoveryEvidenceSummary: getBackupRestoreDrGapSummary(source),
    ownerReviewerReadiness: ownership.ownerState === 'Owner missing'
      ? 'Owner action required.'
      : ownership.reviewerState === 'Reviewer missing'
        ? 'Reviewer action required.'
        : 'Review required.',
    dueDateOrOverdueState: dueDate.overdueStatus === 'Overdue.' ? 'Overdue recovery evidence.' : dueDate.overdueStatus,
    sourceWorkflowDestination: getBackupRestoreDrSourceDestination(source),
    executiveImpact: getBackupRestoreDrExecutiveImpact(data),
    caveat: 'Recovery readiness depends on recorded source evidence.',
  };
}

function isAccessReviewSecurityItem(item?: Pick<ProductionEvidenceClosureItem, 'category' | 'title' | 'requiredEvidence'>) {
  const text = `${item?.category ?? ''} ${item?.title ?? ''} ${item?.requiredEvidence ?? ''}`.toLowerCase();
  return text.includes('access')
    || text.includes('security')
    || text.includes('permission')
    || text.includes('role')
    || text.includes('identity');
}

export function getAccessReviewSecurityGapSummary(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow) {
  if (!source) return 'Access review evidence required. Security review evidence required.';
  if ('supportEvidence' in source) return 'Security review evidence required.';
  if (!isAccessReviewSecurityItem(source)) return 'No access review or security evidence gap currently recorded for this item.';
  if (!hasRecordedEvidence(source)) return 'Access review evidence required. Security review evidence required.';
  if (source.evidenceState === 'blocked') return 'Security evidence is blocked.';
  if (source.evidenceState === 'overdue') return 'Overdue security evidence.';
  if (source.evidenceState === 'closed') return 'Access review evidence recorded. Security evidence recorded.';
  return 'Review required.';
}

export function getAccessReviewSecuritySourceDestination(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow) {
  if (source && !('supportEvidence' in source) && isAccessReviewSecurityItem(source)) {
    return 'Manage security evidence in Production Readiness Center.';
  }
  return 'Manage security evidence in Production Readiness Center.';
}

export function getAccessReviewSecurityExecutiveImpact(data?: ProductionEvidenceClosureData) {
  const missingSecurityItems = data?.intakeQueue.filter(item => isAccessReviewSecurityItem(item) && item.evidenceState !== 'closed').length ?? 0;
  if (missingSecurityItems > 0) {
    return `Executive review required for ${missingSecurityItems} access review or security evidence gap${missingSecurityItems === 1 ? '' : 's'}.`;
  }
  return 'No executive access review or security evidence impact currently recorded.';
}

export function getAccessReviewSecurityEvidenceReadiness(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow, data?: ProductionEvidenceClosureData): AccessReviewSecurityEvidenceReadiness {
  const isDepartmentRow = Boolean(source && 'supportEvidence' in source);
  const securityRelevant = !source || isDepartmentRow || isAccessReviewSecurityItem(source as ProductionEvidenceClosureItem | undefined);
  const ownership = isDepartmentRow
    ? { ownerState: (source as DepartmentEvidenceRegisterRow).owner === ownerAction ? 'Owner missing' : 'Owner assigned', reviewerState: 'Reviewer missing' }
    : getEvidenceOwnershipState(source as ProductionEvidenceClosureItem | undefined);
  const dueDate = isDepartmentRow
    ? { dueDateState: 'Due date missing', overdueStatus: 'Due date not recorded.' }
    : getEvidenceDueDateState(source as ProductionEvidenceClosureItem | undefined);
  const itemState = !isDepartmentRow ? (source as ProductionEvidenceClosureItem | undefined)?.evidenceState : undefined;

  const readinessState = !securityRelevant || itemState === 'evidence_required'
    ? 'Access review evidence required'
    : itemState === 'blocked'
      ? 'Blocked'
      : itemState === 'overdue'
        ? 'Overdue'
        : ownership.ownerState === 'Owner missing'
          ? 'Owner action required'
          : ownership.reviewerState === 'Reviewer missing'
            ? 'Reviewer action required'
            : itemState === 'closed'
              ? 'Access review evidence recorded'
              : 'Review required';

  return {
    readinessState,
    missingSecurityEvidenceSummary: getAccessReviewSecurityGapSummary(source),
    ownerReviewerReadiness: ownership.ownerState === 'Owner missing'
      ? 'Owner action required.'
      : ownership.reviewerState === 'Reviewer missing'
        ? 'Reviewer action required.'
        : 'Review required.',
    dueDateOrOverdueState: dueDate.overdueStatus === 'Overdue.' ? 'Overdue security evidence.' : dueDate.overdueStatus,
    sourceWorkflowDestination: getAccessReviewSecuritySourceDestination(source),
    executiveImpact: getAccessReviewSecurityExecutiveImpact(data),
    caveat: 'Security readiness depends on recorded source evidence.',
  };
}

function isTrainingAdoptionSupportItem(item?: Pick<ProductionEvidenceClosureItem, 'category' | 'title' | 'requiredEvidence'>) {
  const text = `${item?.category ?? ''} ${item?.title ?? ''} ${item?.requiredEvidence ?? ''}`.toLowerCase();
  return text.includes('training')
    || text.includes('adoption')
    || text.includes('support')
    || text.includes('onboarding')
    || text.includes('user readiness');
}

export function getTrainingAdoptionSupportGapSummary(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow) {
  if (!source) return 'Training evidence required. Adoption evidence required. Support readiness evidence required.';
  if ('trainingEvidence' in source) {
    const missing = [
      categoryMissing(source.trainingEvidence) ? 'Training evidence required.' : '',
      categoryMissing(source.adoptionEvidence) ? 'Adoption evidence required.' : '',
      categoryMissing(source.supportEvidence) ? 'Support readiness evidence required.' : '',
    ].filter(Boolean);
    return missing.length ? missing.join(' ') : 'Training evidence recorded. Adoption evidence recorded. Support evidence recorded.';
  }
  if (!isTrainingAdoptionSupportItem(source)) return 'No training, adoption, or support evidence gap currently recorded for this item.';
  if (!hasRecordedEvidence(source)) return 'Training evidence required. Adoption evidence required. Support readiness evidence required.';
  if (source.evidenceState === 'blocked') return 'Training, adoption, or support evidence is blocked.';
  if (source.evidenceState === 'overdue') return 'Overdue adoption evidence.';
  if (source.evidenceState === 'closed') return 'Training evidence recorded. Adoption evidence recorded. Support evidence recorded.';
  return 'Review required.';
}

export function getTrainingAdoptionSupportSourceDestination(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow) {
  if (source && 'trainingEvidence' in source) {
    if (categoryMissing(source.supportEvidence)) return 'Manage support readiness in Production Readiness Center.';
    return 'Manage adoption evidence in Production Readiness Center.';
  }
  if (source && !('trainingEvidence' in source) && isTrainingAdoptionSupportItem(source)) {
    return 'Manage adoption evidence in Production Readiness Center.';
  }
  return 'Manage adoption evidence in Production Readiness Center.';
}

export function getTrainingAdoptionSupportExecutiveImpact(data?: ProductionEvidenceClosureData) {
  const missingDepartmentEvidence = data?.departmentRegister.filter(row =>
    categoryMissing(row.trainingEvidence) || categoryMissing(row.adoptionEvidence) || categoryMissing(row.supportEvidence)
  ).length ?? 0;
  const missingItems = data?.intakeQueue.filter(item => isTrainingAdoptionSupportItem(item) && item.evidenceState !== 'closed').length ?? 0;
  const missingTotal = missingDepartmentEvidence + missingItems;
  if (missingTotal > 0) return `Executive review required for ${missingTotal} training, adoption, or support evidence gap${missingTotal === 1 ? '' : 's'}.`;
  return 'No executive training, adoption, or support evidence impact currently recorded.';
}

export function getTrainingAdoptionSupportEvidenceReadiness(source?: ProductionEvidenceClosureItem | DepartmentEvidenceRegisterRow, data?: ProductionEvidenceClosureData): TrainingAdoptionSupportEvidenceReadiness {
  const isDepartmentRow = Boolean(source && 'trainingEvidence' in source);
  const operationalRelevant = !source || isDepartmentRow || isTrainingAdoptionSupportItem(source as ProductionEvidenceClosureItem | undefined);
  const ownership = isDepartmentRow
    ? { ownerState: (source as DepartmentEvidenceRegisterRow).owner === ownerAction ? 'Owner missing' : 'Owner assigned', reviewerState: 'Reviewer missing' }
    : getEvidenceOwnershipState(source as ProductionEvidenceClosureItem | undefined);
  const dueDate = isDepartmentRow
    ? { dueDateState: 'Due date missing', overdueStatus: 'Due date not recorded.' }
    : getEvidenceDueDateState(source as ProductionEvidenceClosureItem | undefined);
  const itemState = !isDepartmentRow ? (source as ProductionEvidenceClosureItem | undefined)?.evidenceState : undefined;
  const departmentTrainingMissing = isDepartmentRow ? categoryMissing((source as DepartmentEvidenceRegisterRow).trainingEvidence) : false;
  const departmentAdoptionMissing = isDepartmentRow ? categoryMissing((source as DepartmentEvidenceRegisterRow).adoptionEvidence) : false;
  const departmentSupportMissing = isDepartmentRow ? categoryMissing((source as DepartmentEvidenceRegisterRow).supportEvidence) : false;

  const readinessState = !operationalRelevant || departmentTrainingMissing || itemState === 'evidence_required'
    ? 'Training evidence required'
    : departmentAdoptionMissing
      ? 'Adoption evidence required'
      : departmentSupportMissing
        ? 'Support readiness evidence required'
        : itemState === 'blocked'
          ? 'Blocked'
          : itemState === 'overdue'
            ? 'Overdue'
            : ownership.ownerState === 'Owner missing'
              ? 'Owner action required'
              : ownership.reviewerState === 'Reviewer missing'
                ? 'Reviewer action required'
                : itemState === 'closed'
                  ? 'Training evidence recorded'
                  : 'Review required';

  return {
    readinessState,
    missingAdoptionEvidenceSummary: getTrainingAdoptionSupportGapSummary(source),
    ownerReviewerReadiness: ownership.ownerState === 'Owner missing'
      ? 'Owner action required.'
      : ownership.reviewerState === 'Reviewer missing'
        ? 'Reviewer action required.'
        : 'Review required.',
    dueDateOrOverdueState: dueDate.overdueStatus === 'Overdue.' ? 'Overdue adoption evidence.' : dueDate.overdueStatus,
    sourceWorkflowDestination: getTrainingAdoptionSupportSourceDestination(source),
    executiveImpact: getTrainingAdoptionSupportExecutiveImpact(data),
    caveat: 'Operational adoption readiness depends on recorded source evidence.',
  };
}

export function getExecutiveGoNoGoEvidenceClosureSummary(
  recentActions: Array<ControlledEvidenceClosureActionHistoryRow | ControlledEvidenceClosureActionResult> = [],
) {
  const count = (actionType: ControlledEvidenceClosureActionType) =>
    recentActions.filter(action => action.action_type === actionType).length;

  return {
    verifiedEvidenceCount: count('close_as_verified'),
    readyForReviewCount: count('ready_for_review'),
    requiringMoreEvidenceCount: count('request_more_evidence'),
    reopenedEvidenceCount: count('reopen_with_reason'),
  };
}

export function getExecutiveGoNoGoBlockerSummary(
  data?: ProductionEvidenceClosureData,
  signals?: { ownerMissingCount?: number; reviewerMissingCount?: number },
) {
  const blockers = getExecutiveClosureBlockers(data, signals);
  const parts = [
    blockers.blockingIssuesCount > 0 ? `${blockers.blockingIssuesCount} unresolved blocker${blockers.blockingIssuesCount === 1 ? '' : 's'}.` : '',
    blockers.overdueEvidenceCount > 0 ? `${blockers.overdueEvidenceCount} overdue evidence item${blockers.overdueEvidenceCount === 1 ? '' : 's'}.` : '',
    blockers.missingAssignmentCount > 0 ? `${blockers.missingAssignmentCount} missing owner or reviewer assignment${blockers.missingAssignmentCount === 1 ? '' : 's'}.` : '',
    blockers.evidenceRequiredCount > 0 ? `${blockers.evidenceRequiredCount} evidence requirement${blockers.evidenceRequiredCount === 1 ? '' : 's'} still open.` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : noBlocker;
}

export function getExecutiveGoNoGoLimitationSummary(data?: ProductionEvidenceClosureData) {
  const limitationCount = numberValue(data?.executivePack.acceptedLimitationsRequiringReview)
    + numberValue(data?.overview.acceptedWithLimitation);
  return limitationCount > 0
    ? `Accepted limitations require executive review: ${limitationCount}.`
    : 'No accepted limitation requiring executive review is currently recorded.';
}

export function getExecutiveGoNoGoRequiredActions(
  data?: ProductionEvidenceClosureData,
  signals?: { ownerMissingCount?: number; reviewerMissingCount?: number },
  recentActions: Array<ControlledEvidenceClosureActionHistoryRow | ControlledEvidenceClosureActionResult> = [],
) {
  const blockers = getExecutiveClosureBlockers(data, signals);
  const evidenceSummary = getExecutiveGoNoGoEvidenceClosureSummary(recentActions);
  const actions = [
    blockers.blockingIssuesCount > 0 ? 'Resolve unresolved blockers or document accepted limitations before decision review.' : '',
    blockers.evidenceRequiredCount > 0 || evidenceSummary.requiringMoreEvidenceCount > 0 ? 'Complete requested evidence before executive decision.' : '',
    blockers.overdueEvidenceCount > 0 ? 'Clear overdue evidence owner follow-up.' : '',
    blockers.missingAssignmentCount > 0 ? 'Assign missing owners and reviewers.' : '',
    numberValue(data?.executivePack.acceptedLimitationsRequiringReview) > 0 || evidenceSummary.reopenedEvidenceCount > 0 ? 'Review accepted limitations and reopened evidence.' : '',
    numberValue(data?.executivePack.missingSignoffs) > 0 ? 'Complete required executive review items.' : '',
  ].filter(Boolean);
  return actions.length ? actions : ['Prepare executive decision review pack.'];
}

export function getExecutiveGoNoGoRecommendation(
  data?: ProductionEvidenceClosureData,
  signals?: { ownerMissingCount?: number; reviewerMissingCount?: number },
  recentActions: Array<ControlledEvidenceClosureActionHistoryRow | ControlledEvidenceClosureActionResult> = [],
): ExecutiveGoNoGoDecisionState {
  const blockers = getExecutiveClosureBlockers(data, signals);
  const evidenceSummary = getExecutiveGoNoGoEvidenceClosureSummary(recentActions);
  const limitationCount = numberValue(data?.executivePack.acceptedLimitationsRequiringReview)
    + numberValue(data?.overview.acceptedWithLimitation);

  if (blockers.blockingIssuesCount > 0 || blockers.overdueEvidenceCount > 0) return 'No-go: blockers unresolved';
  if (limitationCount > 0) return 'Conditional go review';
  if (
    blockers.evidenceRequiredCount > 0
    || blockers.reviewRequiredCount > 0
    || blockers.missingAssignmentCount > 0
    || evidenceSummary.readyForReviewCount > 0
    || evidenceSummary.requiringMoreEvidenceCount > 0
    || evidenceSummary.reopenedEvidenceCount > 0
  ) return 'Review required';
  return 'Ready for executive decision review';
}

export function getExecutiveGoNoGoDecisionPack(
  data?: ProductionEvidenceClosureData,
  signals?: { ownerMissingCount?: number; reviewerMissingCount?: number },
  recentActions: Array<ControlledEvidenceClosureActionHistoryRow | ControlledEvidenceClosureActionResult> = [],
): ExecutiveGoNoGoDecisionPack {
  const decisionPackState = getExecutiveGoNoGoRecommendation(data, signals, recentActions);
  const evidenceClosureSummary = getExecutiveGoNoGoEvidenceClosureSummary(recentActions);
  const controlledActionCount = recentActions.length;
  const requiredOperationalActionsBeforeDecision = getExecutiveGoNoGoRequiredActions(data, signals, recentActions);
  const requiredExecutiveReviewItems = [
    numberValue(data?.executivePack.acceptedLimitationsRequiringReview) > 0 ? 'Accepted limitations require executive review.' : '',
    numberValue(data?.executivePack.missingSignoffs) > 0 ? 'Missing executive review items remain open.' : '',
    decisionPackState === 'Conditional go review' ? 'Conditional go review requires limitation owner and executive review.' : '',
    decisionPackState === 'Ready for executive decision review' ? 'Ready for executive decision review.' : '',
  ].filter(Boolean);

  return {
    decisionPackState,
    recommendationReason: decisionPackState === 'No-go: blockers unresolved'
      ? getExecutiveGoNoGoBlockerSummary(data, signals)
      : decisionPackState === 'Conditional go review'
        ? getExecutiveGoNoGoLimitationSummary(data)
        : decisionPackState === 'Review required'
          ? 'Evidence, reviewer decisions, assignments, or required executive review items remain open.'
          : 'Evidence closure signals support executive decision review.',
    unresolvedBlockerSummary: getExecutiveGoNoGoBlockerSummary(data, signals),
    acceptedLimitationSummary: getExecutiveGoNoGoLimitationSummary(data),
    controlledClosureActionSummary: controlledActionCount
      ? `Controlled evidence action history includes ${controlledActionCount} recorded action${controlledActionCount === 1 ? '' : 's'}.`
      : 'Controlled evidence action history has not been recorded for this session.',
    evidenceClosureSummary,
    requiredExecutiveReviewItems: requiredExecutiveReviewItems.length ? requiredExecutiveReviewItems : ['No additional executive review item currently recorded.'],
    requiredOperationalActionsBeforeDecision,
    caveat: 'Evidence-level closure does not approve production launch.',
    productionLaunchAuthorityCaveat: 'Production launch requires separate executive authority.',
  };
}

export function getClosureDecisionState(item?: Pick<ProductionEvidenceClosureItem, 'evidenceState' | 'closureDecisionState'>) {
  if (!item) return reviewRequired;
  if (item.evidenceState === 'closed') return 'Closed in source workflow';
  if (item.evidenceState === 'accepted_with_limitation') return 'Limitation decision required.';
  return item.closureDecisionState || reviewRequired;
}

export function getClosureBlockerReason(item?: Pick<ProductionEvidenceClosureItem, 'evidenceState' | 'blockerState' | 'linkedEvidenceReferences'>) {
  if (!item) return 'Evidence required before review.';
  if (item.evidenceState === 'blocked') return item.blockerState || 'Blocked.';
  if (!hasRecordedEvidence(item)) return 'Evidence required before review.';
  if (item.evidenceState === 'overdue') return 'Owner action required.';
  return 'Closure unavailable from this screen';
}

export function getReviewerDecisionReadiness(item?: ProductionEvidenceClosureItem): EvidenceReviewerDecisionReadiness {
  const handoff = getEvidenceClosureHandoff(item);
  const evidenceRecorded = hasRecordedEvidence(item);
  const state = item?.evidenceState ?? 'evidence_required';
  const limitationText = String(item?.limitationState ?? '').toLowerCase();
  const limitationNeeded = state === 'accepted_with_limitation'
    || limitationText.includes('limitation')
    || limitationText.includes('exception');
  const readiness = state === 'closed'
    ? 'Closed in source workflow'
    : state === 'blocked'
      ? 'Blocked'
      : limitationNeeded
        ? 'Limitation decision required'
        : !evidenceRecorded || state === 'evidence_required'
          ? 'Evidence required'
          : state === 'open' || state === 'overdue'
            ? 'Owner action required'
            : state === 'under_review'
              ? 'Reviewer decision required'
              : 'Ready for review';

  return {
    readiness,
    requiredReviewerAction: readiness === 'Reviewer decision required'
      ? 'Reviewer decision required.'
      : readiness === 'Ready for review'
        ? 'Ready for review.'
        : readiness === 'Evidence required'
          ? 'Evidence required before review.'
          : readiness === 'Owner action required'
            ? 'Owner action required.'
            : readiness === 'Limitation decision required'
              ? 'Limitation decision required.'
              : readiness === 'Blocked'
                ? 'Blocked.'
                : reviewRequired,
    closureDecisionState: getClosureDecisionState(item),
    closureBlockerReason: getClosureBlockerReason(item),
    evidenceNeededBeforeReview: handoff.requiredEvidenceBeforeClosure,
    limitationDecisionNeeded: limitationNeeded ? 'Limitation decision required.' : 'No limitation decision currently recorded.',
    sourceWorkflowDestination: handoff.safeManagementDestination,
    closureAvailability: sourceWorkflowClosure,
  };
}

function evidenceRefs(row: Record<string, any>) {
  return [
    row.evidence_reference,
    row.evidence_references,
    row.evidence_url,
    row.file_path,
    row.audit_note,
  ].flatMap(value => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function makeItem(category: string, row: Record<string, any>, index: number, defaults: Partial<ProductionEvidenceClosureItem>): ProductionEvidenceClosureItem {
  const status = normalizeStatus(
    row.evidence_status
    ?? row.review_status
    ?? row.signoff_status
    ?? row.launch_status
    ?? row.support_status
    ?? row.adoption_status
    ?? row.attestation_status
    ?? row.operation_status
    ?? row.status
    ?? row.blocker_type
  );
  const refs = evidenceRefs(row);

  return {
    id: textValue(row.id, row.launch_pack_id, `${category}-${index}`),
    category,
    title: textValue(defaults.title, row.title, row.launch_label, row.policy_title, row.operation_type, row.blocker_area, row.decision_level, category),
    departmentOrScope: textValue(row.department_name, row.scope_name, row.pilot_scope, row.launch_label, defaults.departmentOrScope, 'Hospital-wide'),
    owner: textValue(row.owner_name, row.owner_role, row.department_owner_name, row.department_owner_user_id, row.signoff_role, defaults.owner, ownerAction),
    reviewer: textValue(row.reviewer_name, row.reviewer_role, row.signer_user_id, defaults.reviewer, reviewRequired),
    dueDate: textValue(row.due_at, row.due_date, row.target_date, row.review_due_date, defaults.dueDate, reviewRequired),
    evidenceState: status,
    reviewerState: textValue(row.review_status, row.signoff_status, row.decision_status, defaults.reviewerState, reviewRequired),
    blockerState: textValue(row.blocker_reason, row.blocker_summary, row.blocker_type, defaults.blockerState, noBlocker),
    nextAction: textValue(row.next_action_required, row.action_required, row.readiness_summary, defaults.nextAction, reviewRequired),
    description: textValue(row.description, row.readiness_summary, row.blocker_summary, row.limitation_summary, defaults.description, reviewRequired),
    requiredEvidence: textValue(defaults.requiredEvidence, row.required_evidence, row.evidence_required, evidenceMissing),
    linkedEvidenceReferences: refs.length ? refs : [evidenceMissing],
    comments: textValue(row.review_notes, row.audit_note, row.limitation_summary, row.rejection_reason, defaults.comments, reviewRequired),
    closureDecisionState: textValue(row.decision_status, row.signoff_status, row.review_status, defaults.closureDecisionState, reviewRequired),
    limitationState: textValue(row.limitation_summary, row.limitation_status, row.severity, defaults.limitationState, reviewRequired),
  };
}

function departmentEvidenceRow(row: Record<string, any>, support: any[], adoption: any[], policy: any[]): DepartmentEvidenceRegisterRow {
  const department = textValue(row.department_name, row.launch_label, 'Department');
  const supportRow = support.find(item => item.department_name === department || item.launch_pack_id === row.id);
  const adoptionRow = adoption.find(item => item.department_name === department || item.launch_pack_id === row.id);
  const policyRows = policy.filter(item => item.department_name === department || item.launch_pack_id === row.id);
  const missingEvidenceCount = [
    row.evidence_reference,
    supportRow?.evidence_reference,
    adoptionRow?.evidence_reference,
    ...policyRows.map(item => item.evidence_reference),
  ].filter(value => !value).length;

  return {
    department,
    launchReadiness: textValue(row.launch_status, row.readiness_status, reviewRequired),
    missingEvidenceCount,
    trainingEvidence: textValue(row.training_status, adoptionRow?.training_status, reviewRequired),
    policyEvidence: policyRows.some(item => normalizeStatus(item.attestation_status) === 'closed') ? 'Recorded' : reviewRequired,
    supportEvidence: textValue(supportRow?.support_status, reviewRequired),
    adoptionEvidence: textValue(adoptionRow?.adoption_status, reviewRequired),
    owner: textValue(row.owner_name, row.department_owner_name, row.department_owner_user_id, ownerAction),
    nextAction: textValue(row.next_action_required, row.readiness_summary, supportRow?.next_action_required, adoptionRow?.next_action_required, reviewRequired),
  };
}

export async function getProductionEvidenceClosureData(): Promise<ProductionEvidenceClosureData> {
  const [
    departmentLaunchPacks,
    departmentBlockers,
    supportReadiness,
    policyAttestations,
    adoptionReadiness,
    backupReadiness,
    accessBlockers,
    signoffs,
    limitations,
    blockingLimitations,
    acceptedLimitations,
    goLiveDecisions,
    hypercareBlockers,
  ] = await Promise.all([
    getHospitalDepartmentLaunchPacks(),
    getHospitalOperationsLaunchBlockers(),
    getHospitalSupportReadinessRecords(),
    getHospitalPolicyAttestationReadiness(),
    getHospitalAdoptionReadinessReviews(),
    getBackupRestoreOperationsDashboard(),
    getRuntimeAccessReviewBlockers(),
    getProductionReadinessSignoffRegister(),
    getKnownLimitationsRegister(),
    getBlockingLimitations(),
    getPilotAcceptedLimitations(),
    getProductionGoLiveDecisions(),
    getProductionHypercareBlockers(),
  ]);

  const intakeQueue = [
    ...departmentLaunchPacks.map((row, index) => makeItem('Department launch', row, index, {
      requiredEvidence: 'Department owner, launch checklist, participant coverage, support path, and launch decision evidence.',
    })),
    ...adoptionReadiness.map((row, index) => makeItem('Training adoption', row, index, {
      title: 'Training and adoption evidence',
      requiredEvidence: 'Training completion, user adoption review, and follow-up evidence.',
    })),
    ...policyAttestations.map((row, index) => makeItem('Policy/SOP attestation', row, index, {
      requiredEvidence: 'Policy or SOP acknowledgement evidence by required audience.',
    })),
    ...supportReadiness.map((row, index) => makeItem('Support readiness', row, index, {
      requiredEvidence: 'Named support owner, escalation path, response readiness, and runbook evidence.',
    })),
    ...backupReadiness.map((row, index) => makeItem('Backup/Restore/DR', row, index, {
      title: 'Recovery assurance evidence',
      requiredEvidence: 'Backup, restore, and recovery assurance evidence.',
    })),
    ...accessBlockers.map((row, index) => makeItem('Access/Security review', row, index, {
      requiredEvidence: 'Access review decision, limitation, or remediation evidence.',
    })),
    ...signoffs.map((row, index) => makeItem('Executive signoff', row, index, {
      requiredEvidence: 'Named decision and signoff evidence.',
    })),
    ...acceptedLimitations.map((row, index) => makeItem('Accepted limitations', row, index, {
      requiredEvidence: 'Risk acceptance, limitation owner, review date, and executive awareness evidence.',
    })),
    ...goLiveDecisions.map((row, index) => makeItem('Executive signoff', row, index + 1000, {
      title: 'Executive decision evidence',
      requiredEvidence: 'Named decision and signoff evidence.',
    })),
    ...limitations.map((row, index) => makeItem('Other production evidence', row, index, {
      requiredEvidence: 'Recorded limitation or readiness evidence.',
    })),
    ...departmentBlockers.map((row, index) => makeItem('Department launch', row, index + 1000, {
      requiredEvidence: 'Closure evidence for the department launch blocker.',
    })),
    ...blockingLimitations.map((row, index) => makeItem('Accepted limitations', row, index + 1000, {
      requiredEvidence: 'Formal blocker closure or accepted limitation evidence.',
    })),
    ...hypercareBlockers.map((row, index) => makeItem('Support readiness', row, index + 1000, {
      requiredEvidence: 'Hypercare cadence, support ownership, or issue closure evidence.',
    })),
  ];

  const uniqueItems = Array.from(new Map(intakeQueue.map(item => [`${item.category}-${item.id}-${item.title}`, item])).values());
  const departmentRegister = departmentLaunchPacks.map(row => departmentEvidenceRow(row, supportReadiness, adoptionReadiness, policyAttestations));
  const statusCount = (status: EvidenceClosureStatus) => uniqueItems.filter(item => item.evidenceState === status).length;
  const unresolvedBlockers = departmentBlockers.length + accessBlockers.length + blockingLimitations.length + hypercareBlockers.length;
  const missingSignoffs = signoffs.filter(row => ['pending', 'rejected', 'blocked', 'evidence_required', ''].includes(String(row.signoff_status ?? row.decision_status ?? '').toLowerCase())).length;
  const recoveryEvidenceState = backupReadiness.length
    ? backupReadiness.some(row => ['failed', 'blocked', 'evidence_required'].includes(String(row.operation_status ?? row.status ?? '').toLowerCase()))
      ? reviewRequired
      : 'Recorded'
    : evidenceMissing;
  const departmentReadinessGaps = departmentRegister.filter(row => row.missingEvidenceCount > 0 || ['blocked', 'evidence_required'].includes(String(row.launchReadiness).toLowerCase())).length;
  const finalRecommendationState: EvidenceClosureRecommendation = unresolvedBlockers
    ? 'Blocked'
    : uniqueItems.length === 0 || statusCount('evidence_required') > 0
      ? 'Evidence required'
      : missingSignoffs || statusCount('under_review') || statusCount('open')
        ? 'Review required'
        : acceptedLimitations.length
          ? 'Review required'
          : 'Ready for executive review';

  return {
    overview: {
      totalEvidenceGaps: uniqueItems.length,
      openGaps: statusCount('open'),
      underReview: statusCount('under_review'),
      acceptedWithLimitation: statusCount('accepted_with_limitation') + acceptedLimitations.length,
      closed: statusCount('closed'),
      overdue: statusCount('overdue'),
      blocked: statusCount('blocked') + unresolvedBlockers,
      evidenceRequired: statusCount('evidence_required'),
      nextRequiredAction: finalRecommendationState === 'Blocked'
        ? 'Clear blockers or record approved limitations before executive review.'
        : finalRecommendationState === 'Evidence required'
          ? 'Record missing evidence references and assign reviewers.'
          : 'Review pending closure items and signoffs.',
      owner: ownerAction,
    },
    intakeQueue: uniqueItems,
    departmentRegister,
    executivePack: {
      unresolvedBlockers,
      acceptedLimitationsRequiringReview: acceptedLimitations.length,
      missingSignoffs,
      recoveryEvidenceState,
      departmentReadinessGaps,
      finalRecommendationState,
    },
  };
}
