import { supabase } from './supabase';
import { invokePrivilegedAction, throwRpcActionError } from './privilegedAction';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type AccreditationWorkflowPayload = Record<string, unknown>;

export type AccreditationWorkflowStatus =
  | 'active'
  | 'inactive'
  | 'transferred'
  | 'suspended'
  | 'draft'
  | 'completed'
  | 'cancelled'
  | 'archived'
  | 'open'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'overdue'
  | 'reopened'
  | 'escalated'
  | 'waived'
  | 'pending'
  | 'signed_off'
  | 'acknowledged'
  | 'resolved'
  | string;

export type AccreditationWorkflowPriority = 'low' | 'medium' | 'high' | 'critical' | string;

export interface AccreditationWorkflowActionResult {
  id?: string;
  status?: string;
  result?: JsonValue;
  [key: string]: unknown;
}

export interface ClauseOwnerRegisterRow {
  owner_assignment_id?: string;
  clause_id?: string;
  framework?: string | null;
  standard_code?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  criticality?: AccreditationWorkflowPriority | null;
  owner_user_id?: string | null;
  owner_name?: string | null;
  owner_department_id?: string | null;
  owner_department_name?: string | null;
  reviewer_user_id?: string | null;
  reviewer_name?: string | null;
  reviewer_department_id?: string | null;
  reviewer_department_name?: string | null;
  assignment_status?: AccreditationWorkflowStatus | null;
  due_date?: string | null;
  active?: boolean | null;
  assigned_at?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface ReviewCycleRow {
  id?: string;
  cycle_name?: string | null;
  cycle_type?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  status?: AccreditationWorkflowStatus | null;
  created_by?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface ClauseTaskQueueRow {
  id?: string;
  cycle_id?: string | null;
  clause_id?: string | null;
  owner_assignment_id?: string | null;
  task_type?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_department_id?: string | null;
  priority?: AccreditationWorkflowPriority | null;
  status?: AccreditationWorkflowStatus | null;
  due_date?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  outcome_notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  framework?: string | null;
  standard_code?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  criticality?: AccreditationWorkflowPriority | null;
  assigned_to_name?: string | null;
  assigned_department_name?: string | null;
  cycle_name?: string | null;
  is_overdue?: boolean | null;
  [key: string]: unknown;
}

export interface DepartmentAccreditationWorkloadRow {
  department_id?: string | null;
  department_name?: string | null;
  open_task_count?: number | null;
  overdue_task_count?: number | null;
  high_priority_task_count?: number | null;
  pending_review_count?: number | null;
  nearest_due_date?: string | null;
  [key: string]: unknown;
}

export interface ClauseBlockerSummaryRow {
  clause_id?: string;
  framework?: string | null;
  standard_code?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  workflow_blocker_count?: number | null;
  evidence_blocker_count?: number | null;
  dependency_link_count?: number | null;
  open_escalation_count?: number | null;
  signed_off_count?: number | null;
  [key: string]: unknown;
}

export interface ClauseSignoffRegisterRow {
  id?: string;
  cycle_id?: string | null;
  clause_id?: string | null;
  task_id?: string | null;
  signoff_type?: string | null;
  signoff_status?: AccreditationWorkflowStatus | null;
  signed_by?: string | null;
  signed_at?: string | null;
  signoff_notes?: string | null;
  created_at?: string | null;
  framework?: string | null;
  standard_code?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  signed_by_name?: string | null;
  cycle_name?: string | null;
  [key: string]: unknown;
}

export interface EscalationRegisterRow {
  id?: string;
  clause_id?: string | null;
  task_id?: string | null;
  cycle_id?: string | null;
  escalation_level?: string | null;
  escalation_reason?: string | null;
  escalation_status?: AccreditationWorkflowStatus | null;
  escalated_to_user_id?: string | null;
  escalated_to_department_id?: string | null;
  escalated_by?: string | null;
  escalated_at?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  framework?: string | null;
  standard_code?: string | null;
  clause_code?: string | null;
  clause_title?: string | null;
  escalated_to_name?: string | null;
  escalated_to_department_name?: string | null;
  [key: string]: unknown;
}

export interface AccreditationOperationsDashboardRow {
  active_owner_assignment_count?: number | null;
  active_review_cycle_count?: number | null;
  open_task_count?: number | null;
  overdue_task_count?: number | null;
  reviewer_signoff_queue_count?: number | null;
  blocked_clause_count?: number | null;
  signed_off_clause_count?: number | null;
  open_escalation_count?: number | null;
  executive_signal?: string | null;
  [key: string]: unknown;
}

async function selectPatch35View<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live accreditation workflow data.',
    );
  }

  try {
    let query = supabase.from(viewName).select('*');

    if (options.order) query = query.order(options.order, { ascending: options.ascending ?? true });
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) return queryErrorResult<T[]>(error, `Unable to load ${viewName}.`);
    if (!data || data.length === 0) return emptyResult<T[]>(`No records returned from ${viewName}.`);
    return liveResult(data as T[], 'supabase');
  } catch (error) {
    return queryErrorResult<T[]>(error, `Unexpected error while loading ${viewName}.`);
  }
}

async function runAccreditationWorkflowAction(
  action: string,
  rpcName: string,
  payload: AccreditationWorkflowPayload,
): Promise<AccreditationWorkflowActionResult> {
  try {
    return await invokePrivilegedAction<AccreditationWorkflowActionResult>(rpcName, payload);
  } catch (error) {
    return throwRpcActionError(error, action, rpcName);
  }
}

export function getClauseOwnerRegister(): Promise<LiveResult<ClauseOwnerRegisterRow[]>> {
  return selectPatch35View<ClauseOwnerRegisterRow>('v_patch35_clause_owner_register', { order: 'due_date', ascending: true, limit: 250 });
}

export function getActiveReviewCycles(): Promise<LiveResult<ReviewCycleRow[]>> {
  return selectPatch35View<ReviewCycleRow>('v_patch35_active_review_cycles', { order: 'starts_on', ascending: false, limit: 100 });
}

export function getClauseOwnerTaskQueue(): Promise<LiveResult<ClauseTaskQueueRow[]>> {
  return selectPatch35View<ClauseTaskQueueRow>('v_patch35_clause_owner_task_queue', { order: 'due_date', ascending: true, limit: 250 });
}

export function getOverdueClauseTasks(): Promise<LiveResult<ClauseTaskQueueRow[]>> {
  return selectPatch35View<ClauseTaskQueueRow>('v_patch35_overdue_clause_tasks', { order: 'due_date', ascending: true, limit: 250 });
}

export function getClauseReviewerSignoffQueue(): Promise<LiveResult<ClauseTaskQueueRow[]>> {
  return selectPatch35View<ClauseTaskQueueRow>('v_patch35_clause_reviewer_signoff_queue', { order: 'due_date', ascending: true, limit: 250 });
}

export function getDepartmentAccreditationWorkload(): Promise<LiveResult<DepartmentAccreditationWorkloadRow[]>> {
  return selectPatch35View<DepartmentAccreditationWorkloadRow>('v_patch35_department_accreditation_workload', { order: 'overdue_task_count', ascending: false, limit: 250 });
}

export function getClauseBlockerSummary(): Promise<LiveResult<ClauseBlockerSummaryRow[]>> {
  return selectPatch35View<ClauseBlockerSummaryRow>('v_patch35_clause_blocker_summary', { order: 'workflow_blocker_count', ascending: false, limit: 250 });
}

export function getClauseSignoffRegister(): Promise<LiveResult<ClauseSignoffRegisterRow[]>> {
  return selectPatch35View<ClauseSignoffRegisterRow>('v_patch35_clause_signoff_register', { order: 'created_at', ascending: false, limit: 250 });
}

export function getEscalationRegister(): Promise<LiveResult<EscalationRegisterRow[]>> {
  return selectPatch35View<EscalationRegisterRow>('v_patch35_escalation_register', { order: 'escalated_at', ascending: false, limit: 250 });
}

export function getAccreditationOperationsDashboard(): Promise<LiveResult<AccreditationOperationsDashboardRow[]>> {
  return selectPatch35View<AccreditationOperationsDashboardRow>('v_patch35_accreditation_operations_dashboard', { limit: 1 });
}

export function getExecutiveAccreditationWorkflowSummary(): Promise<LiveResult<AccreditationOperationsDashboardRow[]>> {
  return selectPatch35View<AccreditationOperationsDashboardRow>('v_patch35_executive_accreditation_workflow_summary', { limit: 1 });
}

export function getReadyForSurveyReviewQueue(): Promise<LiveResult<ClauseBlockerSummaryRow[]>> {
  return selectPatch35View<ClauseBlockerSummaryRow>('v_patch35_ready_for_survey_review_queue', { order: 'standard_code', ascending: true, limit: 250 });
}

export function assignAccreditationClauseOwner(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Assign Accreditation Clause Owner', 'assign_accreditation_clause_owner', payload);
}

export function transferAccreditationClauseOwner(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Transfer Accreditation Clause Owner', 'transfer_accreditation_clause_owner', payload);
}

export function createAccreditationReviewCycle(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Create Accreditation Review Cycle', 'create_accreditation_review_cycle', payload);
}

export function startAccreditationReviewCycle(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Start Accreditation Review Cycle', 'start_accreditation_review_cycle', payload);
}

export function completeAccreditationReviewCycle(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Complete Accreditation Review Cycle', 'complete_accreditation_review_cycle', payload);
}

export function createAccreditationClauseReviewTask(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Create Accreditation Clause Review Task', 'create_accreditation_clause_review_task', payload);
}

export function submitAccreditationClauseTask(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Submit Accreditation Clause Task', 'submit_accreditation_clause_task', payload);
}

export function approveAccreditationClauseTask(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Approve Accreditation Clause Task', 'approve_accreditation_clause_task', payload);
}

export function rejectAccreditationClauseTask(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Reject Accreditation Clause Task', 'reject_accreditation_clause_task', payload);
}

export function reopenAccreditationClauseTask(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Reopen Accreditation Clause Task', 'reopen_accreditation_clause_task', payload);
}

export function signoffAccreditationClause(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Signoff Accreditation Clause', 'signoff_accreditation_clause', payload);
}

export function rejectAccreditationClauseSignoff(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Reject Accreditation Clause Signoff', 'reject_accreditation_clause_signoff', payload);
}

export function escalateAccreditationClauseTask(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Escalate Accreditation Clause Task', 'escalate_accreditation_clause_task', payload);
}

export function acknowledgeAccreditationEscalation(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Acknowledge Accreditation Escalation', 'acknowledge_accreditation_escalation', payload);
}

export function resolveAccreditationEscalation(payload: AccreditationWorkflowPayload): Promise<AccreditationWorkflowActionResult> {
  return runAccreditationWorkflowAction('Resolve Accreditation Escalation', 'resolve_accreditation_escalation', payload);
}
