import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type FinalRuntimeSecurityClosureSummary = {
  organization_id: string;
  open_warning_count: number;
  high_warning_count: number;
  open_v65_warning_count: number;
  rpc_review_queue_count: number;
  active_exception_count: number;
  open_client_check_count: number;
  proof_attention_count: number;
};

export type FinalWarningClosureQueueRow = {
  organization_id: string;
  item_code: string;
  item_title: string;
  item_source: string;
  severity: string;
  item_status: string;
  owner_name: string | null;
  due_date: string | null;
  queue_signal: string;
};

export type RpcReviewQueueRow = {
  organization_id: string;
  rpc_name: string;
  source_file: string | null;
  source_line: number | null;
  transport: string;
  current_classification: string;
  approved_classification: string | null;
  review_status: string;
  risk_rating: string;
  mitigation_plan: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  queue_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load Patch 15 hardening data.',
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

export async function getFinalRuntimeSecurityClosureSummary(): Promise<LiveResult<FinalRuntimeSecurityClosureSummary>> {
  const result = await selectView<FinalRuntimeSecurityClosureSummary>('v_patch15_final_security_closure_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<FinalRuntimeSecurityClosureSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<FinalRuntimeSecurityClosureSummary>('No Patch 15 summary row returned.');
}

export function getFinalWarningClosureQueue(): Promise<LiveResult<FinalWarningClosureQueueRow[]>> {
  return selectView<FinalWarningClosureQueueRow>('v_patch15_warning_closure_queue', {
    order: 'due_date',
    ascending: true,
    limit: 150,
  });
}

export function getRpcReviewQueue(): Promise<LiveResult<RpcReviewQueueRow[]>> {
  return selectView<RpcReviewQueueRow>('v_patch15_rpc_review_queue', {
    order: 'rpc_name',
    ascending: true,
    limit: 150,
  });
}
