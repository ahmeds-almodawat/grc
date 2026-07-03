import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult
} from './liveResult';

export interface UnifiedQueueItem {
  queue_item_id: string;
  source_module: string;
  source_entity_type: string;
  source_entity_id: string;
  title: string;
  description: string | null;
  assigned_to_user_id: string | null;
  assigned_to_department_id: string | null;
  due_date: string | null;
  status: string;
  priority: string | null;
  severity: string | null;
  is_overdue: boolean;
  is_escalated: boolean;
  is_blocked: boolean;
  evidence_required: boolean;
  evidence_status: string | null;
  waiting_for_review: boolean;
  next_action: string | null;
  source_route_key: string | null;
  source_context: any | null;
  created_at: string | null;
  updated_at: string | null;
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

export interface EvidenceGateOverlayRow {
  queue_item_id: string;
  source_module: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  title: string | null;
  work_status: string | null;
  priority: string | null;
  severity: string | null;
  due_date: string | null;
  gate_status: string | null;
  accepted_evidence_count: number | null;
  missing_evidence_count: number | null;
  active_waiver_id: string | null;
  evaluated_at: string | null;
  evidence_gate_next_action: string | null;
  [key: string]: unknown;
}

async function selectView<T>(viewName: string, options: { order?: string; ascending?: boolean; limit?: number; filters?: Record<string, any> } = {}): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>('Supabase is not configured.');
  }
  try {
    let query = supabase.from(viewName).select('*');
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query = query.eq(key, value);
      }
    }
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

export const unifiedWorkQueueApi = {
  fetchMyWorkQueue(): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_my_operations_queue', { order: 'due_date', ascending: true });
  },

  fetchDepartmentWorkQueue(): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_department_operations_queue', { order: 'due_date', ascending: true });
  },

  fetchExecutiveWorkQueue(): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_executive_operations_queue', { order: 'severity', ascending: true, limit: 100 });
  },

  fetchOverdueWorkQueue(): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_unified_operations_queue', { filters: { is_overdue: true }, order: 'due_date', ascending: true });
  },

  fetchEscalatedWorkQueue(): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_escalated_operations_queue', { order: 'due_date', ascending: true });
  },

  fetchBlockedWorkQueue(): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_blocked_operations_queue', { order: 'due_date', ascending: true });
  },

  fetchWaitingForReviewQueue(): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_waiting_for_review_queue', { order: 'due_date', ascending: true });
  },

  fetchEvidenceRequiredQueue(): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_evidence_required_queue', { order: 'due_date', ascending: true });
  },

  fetchMissingOwnerQueue(): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_missing_owner_queue', { order: 'due_date', ascending: true });
  },

  fetchMasterDataRoutingExceptions(): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_master_data_routing_exceptions', { order: 'due_date', ascending: true });
  },

  fetchGovernanceOperatingSummary(): Promise<LiveResult<GovernanceOperatingSummaryRow[]>> {
    return selectView<GovernanceOperatingSummaryRow>('v_patch42_executive_operations_summary', { limit: 1 });
  },

  fetchEvidenceGateOverlay(): Promise<LiveResult<EvidenceGateOverlayRow[]>> {
    return selectView<EvidenceGateOverlayRow>('v_patch43_queue_evidence_gate_overlay', { order: 'due_date', ascending: true, limit: 250 });
  },
  
  fetchQueueItemDetailContext(queue_item_id: string): Promise<LiveResult<UnifiedQueueItem[]>> {
    return selectView<UnifiedQueueItem>('v_patch42_queue_item_detail_context', { filters: { queue_item_id }, limit: 1 });
  }
};
