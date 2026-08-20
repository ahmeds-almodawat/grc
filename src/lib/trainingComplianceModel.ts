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
    canViewTeamCompliance: hasManager,
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

export function isE2B3ReconcileReleasedInUi(): false {
  return false;
}
