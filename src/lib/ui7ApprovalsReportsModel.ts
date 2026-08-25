import type { AuthRole } from '../auth/authTypes';

export type Ui7Actionability = 'actionable' | 'read_only' | 'blocked' | 'completed';
export type Ui7WorkBucket = 'pending' | 'due_soon' | 'overdue' | 'completed' | 'delegated';

export interface Ui7WorkItem {
  id: string;
  sourceModule: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  description: string | null;
  owner: string | null;
  requester: string | null;
  dueDate: string | null;
  status: string;
  priority: string | null;
  severity: string | null;
  requiredAction: string;
  route: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  actionability: Ui7Actionability;
  blockedReason: string | null;
  delegated: boolean;
  assignment_id?: string | null;
  assignment_status?: string | null;
}

export interface Ui7ApprovalRequest {
  id: string;
  organization_id: string;
  request_code: string | null;
  workflow_type: string;
  linked_item_type: string;
  linked_item_id: string | null;
  action_type: string;
  department_id: string | null;
  requested_by: string | null;
  requested_at: string;
  request_reason: string | null;
  request_status: string;
  required_approval_count: number;
  received_approval_count: number;
  authority_rule_id: string | null;
  due_date: string | null;
  escalation_required: boolean;
  escalation_level_current: string | null;
  escalated_to: string | null;
  final_decision: string | null;
  final_decision_by: string | null;
  final_decision_at: string | null;
  final_decision_note: string | null;
  updated_at: string | null;
  requester_name?: string | null;
}

export interface Ui7ApprovalRule {
  id: string;
  organization_id: string;
  workflow_type: string;
  action_type: string;
  department_id: string | null;
  approver_user_id: string | null;
  approver_role: string | null;
  allow_self_approval: boolean;
  conflict_of_interest_block: boolean;
  active_flag: boolean;
  effective_date: string | null;
  expiry_date: string | null;
  rule_code: string | null;
  rule_name: string;
}

export interface Ui7ApprovalStage {
  id: string;
  approval_request_id: string;
  stage_key: string;
  stage_name: string;
  stage_order: number;
  assigned_user_id: string | null;
  assigned_role: string | null;
  stage_status: string;
  allow_self_approval: boolean;
  required_decision_count: number;
  received_decision_count: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface Ui7ApprovalDelegation {
  id: string;
  organization_id: string;
  delegator_id: string;
  delegate_id: string;
  workflow_type: string | null;
  action_type: string | null;
  department_id: string | null;
  effective_from: string;
  effective_to: string;
  delegation_reason: string | null;
  active_flag: boolean;
  delegator_name: string | null;
  delegate_name: string | null;
}

export interface Ui7ApprovalDecision {
  decision_id: string;
  approval_request_id: string;
  request_code: string | null;
  workflow_type: string;
  action_type: string;
  linked_item_type: string;
  linked_item_id: string | null;
  approver_id: string | null;
  approver_name: string | null;
  approver_role: string | null;
  decision: string;
  decision_note: string | null;
  decided_at: string;
}

export interface Ui7ApprovalAuthority {
  actionable: boolean;
  reason: string;
  delegated: boolean;
  stage: Ui7ApprovalStage | null;
}

export interface Ui7GovernanceTruthRow {
  link_id: string;
  decision_type: string | null;
  significance: string | null;
  adherence_status: string | null;
  adequacy_status: string | null;
  inherited: boolean;
  counts_as_violation?: boolean;
  confirmed_noncompliance?: boolean;
  confirmed_procedure_failure?: boolean;
  document_inadequacy?: boolean;
  training_gap?: boolean;
  control_failure?: boolean;
  relationship_origin: string;
  root_event_key: string;
  root_source_entity_type: string;
  root_source_entity_id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_criterion_type: string;
  target_document_id: string | null;
  target_version_id: string | null;
  target_display_label: string | null;
  created_at: string;
}

export interface Ui7GovernanceAttribution {
  documentId: string;
  versionId: string | null;
  label: string;
  rootEvents: string[];
  count: number;
}

export interface Ui7GovernanceAnalytics {
  policyNonconformities: Ui7GovernanceAttribution[];
  sopProcedureFailures: Ui7GovernanceAttribution[];
  globalRootIncidentCount: number;
  correctComplianceEvents: Ui7GovernanceTruthRow[];
  documentReviewCandidates: Ui7GovernanceAttribution[];
  trainingGapDocuments: Ui7GovernanceAttribution[];
}

export interface Ui7SourceResult<T> {
  rows: T[];
  available: boolean;
  message: string | null;
}

const FINAL_WORK_STATUSES = new Set(['approved', 'cancelled', 'closed', 'completed', 'rejected', 'resolved', 'waived']);
const OPEN_APPROVAL_STATUSES = new Set(['pending', 'partially_approved', 'escalated']);

export function ui7WorkBucket(item: Ui7WorkItem, now = new Date()): Ui7WorkBucket {
  if (item.actionability === 'completed' || FINAL_WORK_STATUSES.has(item.status)) return 'completed';
  if (item.delegated) return 'delegated';
  if (!item.dueDate) return 'pending';
  const due = new Date(`${item.dueDate.slice(0, 10)}T23:59:59`);
  if (due.getTime() < now.getTime()) return 'overdue';
  if (due.getTime() <= now.getTime() + 7 * 86_400_000) return 'due_soon';
  return 'pending';
}

function delegationMatches(
  delegation: Ui7ApprovalDelegation,
  request: Ui7ApprovalRequest,
  actorId: string,
  delegatorId: string | null,
  now: Date,
) {
  return delegation.active_flag
    && delegation.delegate_id === actorId
    && (!delegatorId || delegation.delegator_id === delegatorId)
    && (!delegation.workflow_type || delegation.workflow_type === request.workflow_type)
    && (!delegation.action_type || delegation.action_type === request.action_type)
    && (!delegation.department_id || delegation.department_id === request.department_id)
    && new Date(delegation.effective_from).getTime() <= now.getTime()
    && new Date(delegation.effective_to).getTime() >= now.getTime();
}

export function approvalAuthorityForActor(input: {
  request: Ui7ApprovalRequest;
  rules: Ui7ApprovalRule[];
  stages: Ui7ApprovalStage[];
  delegations: Ui7ApprovalDelegation[];
  actorId: string;
  actorRoles: AuthRole[];
  now?: Date;
}): Ui7ApprovalAuthority {
  const { request, rules, stages, delegations, actorId, actorRoles } = input;
  const now = input.now ?? new Date();
  const stage = stages
    .filter((row) => row.approval_request_id === request.id && row.stage_status === 'in_progress')
    .sort((left, right) => left.stage_order - right.stage_order)[0] ?? null;

  if (!OPEN_APPROVAL_STATUSES.has(request.request_status)) {
    return { actionable: false, reason: 'This decision is complete and immutable.', delegated: false, stage };
  }
  if (request.organization_id.length === 0) {
    return { actionable: false, reason: 'Organization scope is unavailable.', delegated: false, stage };
  }
  if (actorRoles.length === 1 && actorRoles[0] === 'viewer') {
    return { actionable: false, reason: 'Viewer access is read-only.', delegated: false, stage };
  }

  const rule = rules.find((row) => row.id === request.authority_rule_id) ?? null;
  if (!stage && !rule) {
    return { actionable: false, reason: 'No active approval authority rule is matched.', delegated: false, stage };
  }
  const selfApprovalAllowed = stage?.allow_self_approval ?? rule?.allow_self_approval ?? false;
  if (request.requested_by === actorId && !selfApprovalAllowed) {
    return { actionable: false, reason: 'Separation of duties blocks self-approval.', delegated: false, stage };
  }

  if (stage) {
    if (stage.assigned_user_id === actorId) return { actionable: true, reason: 'Assigned approver.', delegated: false, stage };
    if (stage.assigned_role && actorRoles.includes(stage.assigned_role as AuthRole)) {
      return { actionable: true, reason: `Authorized ${stage.assigned_role} stage.`, delegated: false, stage };
    }
    const delegated = delegations.some((row) => delegationMatches(row, request, actorId, stage.assigned_user_id, now));
    return delegated
      ? { actionable: true, reason: 'Active delegation for this approval stage.', delegated: true, stage }
      : { actionable: false, reason: 'This approval stage is assigned to another authority.', delegated: false, stage };
  }

  if (rule?.approver_user_id === actorId) return { actionable: true, reason: 'Named approval authority.', delegated: false, stage };
  if (rule?.approver_role && actorRoles.includes(rule.approver_role as AuthRole)) {
    return { actionable: true, reason: `Authorized ${rule.approver_role} role.`, delegated: false, stage };
  }
  const delegated = delegations.some((row) => delegationMatches(row, request, actorId, rule?.approver_user_id ?? null, now));
  return delegated
    ? { actionable: true, reason: 'Active delegated authority.', delegated: true, stage }
    : { actionable: false, reason: 'The signed-in user is not the current approver.', delegated: false, stage };
}

function qualifiesConfirmed(row: Ui7GovernanceTruthRow) {
  return row.decision_type === 'confirmed'
    && row.significance !== 'context_only'
    && row.relationship_origin !== 'reporter_suggested';
}

function uniqueByRoot(rows: Ui7GovernanceTruthRow[]) {
  const map = new Map<string, Ui7GovernanceTruthRow>();
  for (const row of rows) if (!map.has(row.root_event_key)) map.set(row.root_event_key, row);
  return [...map.values()];
}

function groupDocuments(rows: Ui7GovernanceTruthRow[]): Ui7GovernanceAttribution[] {
  const groups = new Map<string, { row: Ui7GovernanceTruthRow; roots: Set<string> }>();
  for (const row of rows) {
    const key = row.target_document_id ?? `${row.target_criterion_type}:${row.target_display_label ?? row.link_id}`;
    const group = groups.get(key) ?? { row, roots: new Set<string>() };
    group.roots.add(row.root_event_key);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([documentId, group]) => ({
    documentId,
    versionId: group.row.target_version_id,
    label: group.row.target_display_label || 'Governed document',
    rootEvents: [...group.roots],
    count: group.roots.size,
  })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function buildGovernanceAnalytics(rows: Ui7GovernanceTruthRow[]): Ui7GovernanceAnalytics {
  const confirmed = rows.filter(qualifiesConfirmed);
  const direct = confirmed.filter((row) => !row.inherited);
  const policyRows = direct.filter((row) =>
    ['policy', 'policy_requirement'].includes(row.target_criterion_type)
    && Boolean(row.counts_as_violation ?? row.confirmed_noncompliance),
  );
  const sopRows = direct.filter((row) =>
    ['sop', 'sop_step'].includes(row.target_criterion_type)
    && Boolean(row.counts_as_violation ?? row.confirmed_procedure_failure)
    && (row.confirmed_procedure_failure ?? row.adherence_status === 'procedure_not_followed'),
  );
  const adequacyStatuses = new Set([
    'unclear', 'incomplete', 'conflicting', 'obsolete_version_used', 'missing_policy', 'missing_sop',
    'implementation_gap', 'training_competency_gap', 'control_failed_despite_compliance',
  ]);
  const reviewRows = direct.filter((row) =>
    Boolean(row.document_inadequacy)
    || adequacyStatuses.has(row.adequacy_status ?? ''),
  );
  const trainingRows = direct.filter((row) => row.training_gap || row.adequacy_status === 'training_competency_gap');
  const correctComplianceEvents = uniqueByRoot(direct.filter((row) =>
    row.adherence_status === 'complied'
    && (row.control_failure || row.adequacy_status === 'control_failed_despite_compliance'),
  ));

  return {
    policyNonconformities: groupDocuments(policyRows),
    sopProcedureFailures: groupDocuments(sopRows),
    globalRootIncidentCount: new Set([...policyRows, ...sopRows].map((row) => row.root_event_key)).size,
    correctComplianceEvents,
    documentReviewCandidates: groupDocuments(reviewRows),
    trainingGapDocuments: groupDocuments(trainingRows),
  };
}

export function metricValue(sourceAvailable: boolean, value: number): number | null {
  return sourceAvailable ? value : null;
}

export function permissionScopedOptions<T>(rows: T[], value: (row: T) => string | null | undefined): string[] {
  return [...new Set(rows.map(value).filter((item): item is string => Boolean(item)))].sort((left, right) => left.localeCompare(right));
}
