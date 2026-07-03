import { supabase } from './supabase';
import { invokePrivilegedAction, throwRpcActionError } from './privilegedAction';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

type WorkQueuePayload = Record<string, unknown>;

export interface UnifiedWorkQueueRow {
  source_module?: string | null;
  work_type?: string | null;
  work_id?: string;
  work_title?: string | null;
  work_description?: string | null;
  work_status?: string | null;
  priority?: string | null;
  assigned_to_user_id?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  is_overdue?: boolean | null;
  waiting_for_review?: boolean | null;
  is_escalated?: boolean | null;
  linked_entity_id?: string | null;
  linked_entity_type?: string | null;
  [key: string]: unknown;
}

export interface WorkloadSummaryRow {
  source_module?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_name?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  open_work_count?: number | null;
  overdue_work_count?: number | null;
  waiting_for_review_count?: number | null;
  escalated_work_count?: number | null;
  nearest_due_date?: string | null;
  [key: string]: unknown;
}

export interface GovernanceOperatingSummaryRow {
  open_work_count?: number | null;
  my_work_count?: number | null;
  overdue_work_count?: number | null;
  escalated_work_count?: number | null;
  waiting_for_review_count?: number | null;
  master_data_exception_count?: number | null;
  executive_signal?: string | null;
  [key: string]: unknown;
}

async function selectPatch38View<T>(viewName: string, options: { order?: string; ascending?: boolean; limit?: number } = {}): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live work queue data.');
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

async function runWorkQueueAction(action: string, rpcName: string, payload: WorkQueuePayload) {
  try {
    return await invokePrivilegedAction(rpcName, payload);
  } catch (error) {
    return throwRpcActionError(error, action, rpcName);
  }
}

export function getUnifiedWorkQueue(): Promise<LiveResult<UnifiedWorkQueueRow[]>> {
  return selectPatch38View<UnifiedWorkQueueRow>('v_patch38_unified_work_queue', { order: 'due_date', ascending: true, limit: 300 });
}

export function getMyWorkQueue(): Promise<LiveResult<UnifiedWorkQueueRow[]>> {
  return selectPatch38View<UnifiedWorkQueueRow>('v_patch38_my_work_queue', { order: 'due_date', ascending: true, limit: 300 });
}

export function getDepartmentWorkQueue(): Promise<LiveResult<UnifiedWorkQueueRow[]>> {
  return selectPatch38View<UnifiedWorkQueueRow>('v_patch38_department_work_queue', { order: 'due_date', ascending: true, limit: 300 });
}

export function getOverdueWorkQueue(): Promise<LiveResult<UnifiedWorkQueueRow[]>> {
  return selectPatch38View<UnifiedWorkQueueRow>('v_patch38_overdue_work_queue', { order: 'due_date', ascending: true, limit: 300 });
}

export function getEscalatedWorkQueue(): Promise<LiveResult<UnifiedWorkQueueRow[]>> {
  return selectPatch38View<UnifiedWorkQueueRow>('v_patch38_escalated_work_queue', { order: 'created_at', ascending: false, limit: 300 });
}

export function getWaitingForReviewQueue(): Promise<LiveResult<UnifiedWorkQueueRow[]>> {
  return selectPatch38View<UnifiedWorkQueueRow>('v_patch38_waiting_for_review_queue', { order: 'due_date', ascending: true, limit: 300 });
}

export function getExecutiveWorkloadSummary(): Promise<LiveResult<WorkloadSummaryRow[]>> {
  return selectPatch38View<WorkloadSummaryRow>('v_patch38_executive_workload_summary', { order: 'overdue_work_count', ascending: false, limit: 100 });
}

export function getUserWorkloadSummary(): Promise<LiveResult<WorkloadSummaryRow[]>> {
  return selectPatch38View<WorkloadSummaryRow>('v_patch38_user_workload_summary', { order: 'overdue_work_count', ascending: false, limit: 100 });
}

export function getDepartmentWorkloadSummary(): Promise<LiveResult<WorkloadSummaryRow[]>> {
  return selectPatch38View<WorkloadSummaryRow>('v_patch38_department_workload_summary', { order: 'overdue_work_count', ascending: false, limit: 100 });
}

export function getGovernanceOperatingSummary(): Promise<LiveResult<GovernanceOperatingSummaryRow[]>> {
  return selectPatch38View<GovernanceOperatingSummaryRow>('v_patch38_governance_operating_summary', { limit: 1 });
}

export function recordUnifiedWorkQueueEvent(payload: WorkQueuePayload) {
  return runWorkQueueAction('Record Unified Work Queue Event', 'record_unified_work_queue_event', payload);
}

export function requestMyWorkQueue(payload: WorkQueuePayload) {
  return runWorkQueueAction('Get My Work Queue', 'get_my_work_queue', payload);
}

export function requestDepartmentWorkQueue(payload: WorkQueuePayload) {
  return runWorkQueueAction('Get Department Work Queue', 'get_department_work_queue', payload);
}

export function requestExecutiveWorkloadSummary(payload: WorkQueuePayload) {
  return runWorkQueueAction('Get Executive Workload Summary', 'get_executive_workload_summary', payload);
}

export function requestGovernanceOperatingSummary(payload: WorkQueuePayload) {
  return runWorkQueueAction('Get Governance Operating Summary', 'get_governance_operating_summary', payload);
}
