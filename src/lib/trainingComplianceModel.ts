import type { AuthRole, AuthRoleAssignment } from '../auth/authTypes';

export type TrainingAssignmentState =
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'waived'
  | 'cancelled'
  | string;

export type CompetencyAssessmentResult = 'passed' | 'failed' | 'needs_retraining' | 'pending';

export interface TrainingCompliancePersona {
  canViewMyObligations: boolean;
  canStartOwnTraining: boolean;
  canAcknowledgeOwnVersion: boolean;
  canViewTeamCompliance: boolean;
  canCertifyCompletionCandidate: boolean;
  canRecordCompetencyCandidate: boolean;
  canAdministerAssignmentCandidate: boolean;
  canViewGovernanceCompliance: boolean;
  canPublishObligations: boolean;
  canDecideRollout: boolean;
  isReadOnlyGlobal: boolean;
}

export interface AssignmentRowActionEligibility {
  canCertifyCompletion: boolean;
  canRecordCompetency: boolean;
  canWaive: boolean;
  canCancel: boolean;
  canReopen: boolean;
}

export type LiveReadStatus = 'loading' | 'error' | 'success';

export const E2B2_LEGACY_UNSUPPORTED_ACTIONS = [
  'create_training_program',
  'assign_training_program_to_user',
  'assign_training_program_to_department',
  'acknowledge_training_assignment',
  'link_training_evidence',
] as const;

export const E2B2_RELEASED_MUTATION_ACTIONS = [
  'record_document_acknowledgment',
  'start_training_assignment',
  'complete_training_assignment',
  'record_competency_assessment',
  'waive_training_assignment_with_reason',
  'cancel_training_assignment_with_reason',
  'reopen_training_assignment_with_reason',
  'decide_sop_rollout_requirements',
  'publish_sop_training_obligations',
] as const;

const globalMutationRoles = new Set<AuthRole>([
  'super_admin',
  'governance_admin',
  'compliance_officer',
]);

const readOnlyGlobalRoles = new Set<AuthRole>(['executive', 'auditor']);
const managerMutationRoles = new Set<AuthRole>(['department_manager', 'division_head']);

export function hasTrainingRole(
  roles: readonly AuthRoleAssignment[] | null | undefined,
  candidates: Iterable<AuthRole>,
): boolean {
  const candidateSet = new Set(candidates);
  return (roles ?? []).some((assignment) => candidateSet.has(assignment.role));
}

export function getTrainingCompliancePersona(
  roles: readonly AuthRoleAssignment[] | null | undefined,
): TrainingCompliancePersona {
  const hasGlobalMutation = hasTrainingRole(roles, globalMutationRoles);
  const hasManager = hasTrainingRole(roles, managerMutationRoles);
  const isReadOnlyGlobal = hasTrainingRole(roles, readOnlyGlobalRoles);
  const isEmployeeLike = hasTrainingRole(roles, ['employee', 'viewer', 'project_owner', 'milestone_owner', 'task_owner']);

  return {
    canViewMyObligations: isEmployeeLike || hasManager || hasGlobalMutation || isReadOnlyGlobal,
    canStartOwnTraining: isEmployeeLike || hasManager || hasGlobalMutation || isReadOnlyGlobal,
    canAcknowledgeOwnVersion: isEmployeeLike || hasManager || hasGlobalMutation || isReadOnlyGlobal,
    canViewTeamCompliance: hasManager || hasGlobalMutation,
    canCertifyCompletionCandidate: hasManager || hasGlobalMutation,
    canRecordCompetencyCandidate: hasManager || hasGlobalMutation,
    canAdministerAssignmentCandidate: hasManager || hasGlobalMutation,
    canViewGovernanceCompliance: hasGlobalMutation || isReadOnlyGlobal,
    canPublishObligations: hasGlobalMutation,
    canDecideRollout: hasGlobalMutation,
    isReadOnlyGlobal,
  };
}

export function canShowEmployeeStart(status: TrainingAssignmentState): boolean {
  return status === 'assigned' || status === 'overdue';
}

export function canShowCompletionCertification(status: TrainingAssignmentState): boolean {
  return status === 'assigned' || status === 'in_progress' || status === 'overdue';
}

export function canShowWaiveOrCancel(status: TrainingAssignmentState): boolean {
  return status === 'assigned' || status === 'in_progress' || status === 'overdue';
}

export function canShowReopen(status: TrainingAssignmentState): boolean {
  return status === 'completed' || status === 'waived' || status === 'cancelled';
}

export function isNonSelfAssignmentSubject(
  actorUserId: string | null | undefined,
  subjectUserId: string | null | undefined,
): boolean {
  const actor = actorUserId?.trim();
  const subject = subjectUserId?.trim();
  return Boolean(actor && subject && actor !== subject);
}

export function canAdministerAssignmentRow(
  persona: TrainingCompliancePersona,
  actorUserId: string | null | undefined,
  subjectUserId: string | null | undefined,
): boolean {
  return persona.canAdministerAssignmentCandidate
    && isNonSelfAssignmentSubject(actorUserId, subjectUserId);
}

export function getAssignmentRowActionEligibility(input: {
  persona: TrainingCompliancePersona;
  actorUserId: string | null | undefined;
  subjectUserId: string | null | undefined;
  status: TrainingAssignmentState;
}): AssignmentRowActionEligibility {
  const isNonSelf = isNonSelfAssignmentSubject(input.actorUserId, input.subjectUserId);
  return {
    canCertifyCompletion:
      input.persona.canCertifyCompletionCandidate
      && isNonSelf
      && canShowCompletionCertification(input.status),
    canRecordCompetency:
      input.persona.canRecordCompetencyCandidate
      && isNonSelf,
    canWaive:
      input.persona.canAdministerAssignmentCandidate
      && isNonSelf
      && canShowWaiveOrCancel(input.status),
    canCancel:
      input.persona.canAdministerAssignmentCandidate
      && isNonSelf
      && canShowWaiveOrCancel(input.status),
    canReopen:
      input.persona.canAdministerAssignmentCandidate
      && isNonSelf
      && canShowReopen(input.status),
  };
}

export function isReasonLengthValid(reason: string): boolean {
  const trimmed = reason.trim();
  return trimmed.length >= 3 && trimmed.length <= 1000;
}

export function isRolloutRationaleValid(rationale: string): boolean {
  const trimmed = rationale.trim();
  return trimmed.length >= 5 && trimmed.length <= 4000;
}

export function formatCompetencyScore(score: number | null | undefined): string {
  return typeof score === 'number' && Number.isFinite(score) ? String(score) : '-';
}

export function formatLiveMetric(value: number, status: LiveReadStatus): string {
  return status === 'success' ? String(value) : '-';
}

export function isMyObligationsLoading(input: {
  assignmentsLoading: boolean;
  acknowledgmentGapsLoading: boolean;
  competencyGapsLoading: boolean;
}): boolean {
  return input.assignmentsLoading
    || input.acknowledgmentGapsLoading
    || input.competencyGapsLoading;
}

export function isTeamComplianceLoading(input: {
  assignmentsLoading: boolean;
  acknowledgmentGapsLoading: boolean;
  competencyGapsLoading: boolean;
}): boolean {
  return isMyObligationsLoading(input);
}

export function isTeamComplianceEmpty(input: {
  assignmentCount: number;
  acknowledgmentGapCount: number;
  competencyGapCount: number;
}): boolean {
  return input.assignmentCount === 0
    && input.acknowledgmentGapCount === 0
    && input.competencyGapCount === 0;
}

export function buildRecordDocumentAcknowledgmentPayload(input: {
  document_id: string;
  version_id: string;
  acknowledgment_note?: string | null;
}): {
  document_id: string;
  version_id: string;
  acknowledgment_method: 'web_ui';
  acknowledgment_note: string | null;
} {
  return {
    document_id: input.document_id,
    version_id: input.version_id,
    acknowledgment_method: 'web_ui',
    acknowledgment_note: input.acknowledgment_note?.trim() || null,
  };
}

export function buildStartTrainingPayload(assignmentId: string): { assignment_id: string } {
  return { assignment_id: assignmentId };
}

export function buildRecordCompetencyAssessmentPayload(input: {
  assignment_id?: string | null;
  user_id: string;
  competency_area: string;
  result: CompetencyAssessmentResult;
  score?: number | null;
  evidence_id?: string | null;
  notes?: string | null;
}): {
  assignment_id: string | null;
  user_id: string;
  competency_area: string;
  result: CompetencyAssessmentResult;
  score: number | null;
  evidence_id: string | null;
  notes: string | null;
} {
  return {
    assignment_id: input.assignment_id || null,
    user_id: input.user_id,
    competency_area: input.competency_area.trim(),
    result: input.result,
    score: typeof input.score === 'number' && Number.isFinite(input.score) ? input.score : null,
    evidence_id: input.evidence_id?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

export function isE2B3ReconcileReleasedInUi(): false {
  return false;
}
