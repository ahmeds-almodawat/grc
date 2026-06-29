import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type RealWorkflowExecutionSummary = {
  organization_id: string;
  execution_item_count: number;
  active_item_count: number;
  overdue_item_count: number;
  evidence_attention_count: number;
  open_gap_count: number;
  open_capa_count: number;
  pending_exception_count: number;
  management_response_count: number;
  open_finding_count: number;
};

export type RealActionQueueRow = {
  organization_id: string;
  execution_item_id: string;
  module_key: string;
  source_type: string;
  source_code: string | null;
  item_title: string;
  execution_status: string;
  priority: string;
  owner_name: string | null;
  reviewer_name: string | null;
  approver_name: string | null;
  due_date: string | null;
  queue_signal: string;
};

export type RealEvidenceReviewQueueRow = {
  organization_id: string;
  evidence_submission_id: string;
  item_title: string | null;
  requirement_code: string | null;
  evidence_taxonomy_code: string | null;
  evidence_title: string;
  submitted_by_name: string | null;
  evidence_status: string;
  confidentiality_level: string;
  review_due_date: string | null;
  queue_signal: string;
};

export type RealGapCapaQueueRow = {
  organization_id: string;
  gap_code: string;
  gap_title: string;
  requirement_code: string | null;
  department_code: string | null;
  closure_status: string;
  owner_name: string | null;
  due_date: string | null;
  capa_count: number;
  failed_retest_count: number;
  queue_signal: string;
};

export type RealManagementResponseQueueRow = {
  organization_id: string;
  response_code: string;
  finding_code: string | null;
  finding_title: string;
  response_owner_name: string | null;
  response_status: string;
  target_date: string | null;
  severity: string | null;
  queue_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load real workflow execution data.',
    );
  }

  try {
    let query = supabase.from(viewName).select('*');

    if (options.order) {
      query = query.order(options.order, { ascending: options.ascending ?? true });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return queryErrorResult<T[]>(error, `Unable to load ${viewName}.`);
    }

    if (!data || data.length === 0) {
      return emptyResult<T[]>(`No records returned from ${viewName}.`);
    }

    return liveResult(data as T[], 'supabase');
  } catch (error) {
    return queryErrorResult<T[]>(error, `Unexpected error while loading ${viewName}.`);
  }
}

export async function getRealWorkflowExecutionSummary(): Promise<LiveResult<RealWorkflowExecutionSummary>> {
  const result = await selectView<RealWorkflowExecutionSummary>('v_real_workflow_execution_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<RealWorkflowExecutionSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<RealWorkflowExecutionSummary>('No real workflow execution summary row returned.');
}

export function getRealActionQueue(): Promise<LiveResult<RealActionQueueRow[]>> {
  return selectView<RealActionQueueRow>('v_real_action_queue', {
    order: 'due_date',
    ascending: true,
    limit: 200,
  });
}

export function getRealEvidenceReviewQueue(): Promise<LiveResult<RealEvidenceReviewQueueRow[]>> {
  return selectView<RealEvidenceReviewQueueRow>('v_real_evidence_review_queue', {
    order: 'review_due_date',
    ascending: true,
    limit: 200,
  });
}

export function getRealGapCapaQueue(): Promise<LiveResult<RealGapCapaQueueRow[]>> {
  return selectView<RealGapCapaQueueRow>('v_real_gap_capa_queue', {
    order: 'due_date',
    ascending: true,
    limit: 200,
  });
}

export function getRealManagementResponseQueue(): Promise<LiveResult<RealManagementResponseQueueRow[]>> {
  return selectView<RealManagementResponseQueueRow>('v_real_management_response_queue', {
    order: 'target_date',
    ascending: true,
    limit: 200,
  });
}
