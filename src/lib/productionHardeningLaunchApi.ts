import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type ProductionHardeningSummary = {
  organization_id: string;
  open_client_warning_count: number;
  open_v65_warning_count: number;
  passed_persona_sql_count: number;
  passed_restore_proof_count: number;
  active_freeze_count: number;
  approved_go_no_go_pack_count: number;
  pending_launch_signoff_count: number;
  launch_decision_count: number;
  red_monitoring_check_count: number;
};

export type ProductionHardeningQueueRow = {
  organization_id: string;
  queue_type: string;
  item_code: string;
  item_title: string;
  item_status: string;
  severity: string;
  owner_name: string | null;
  due_date: string | null;
  queue_signal: string;
};

export type LaunchReadinessDashboardRow = {
  organization_id: string;
  pack_code: string;
  pack_title: string;
  pack_status: string;
  summary_score: number;
  launch_recommendation: string;
  board_meeting_date: string | null;
  signed_count: number;
  pending_count: number;
  rejected_count: number;
  latest_decision_status: string | null;
  readiness_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load production hardening data.',
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

export async function getProductionHardeningSummary(): Promise<LiveResult<ProductionHardeningSummary>> {
  const result = await selectView<ProductionHardeningSummary>('v_patch14_production_hardening_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<ProductionHardeningSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<ProductionHardeningSummary>('No production hardening summary row returned.');
}

export function getProductionHardeningQueue(): Promise<LiveResult<ProductionHardeningQueueRow[]>> {
  return selectView<ProductionHardeningQueueRow>('v_patch14_hardening_queue', {
    order: 'due_date',
    ascending: true,
    limit: 200,
  });
}

export function getLaunchReadinessDashboard(): Promise<LiveResult<LaunchReadinessDashboardRow[]>> {
  return selectView<LaunchReadinessDashboardRow>('v_patch14_launch_readiness_dashboard', {
    order: 'board_meeting_date',
    ascending: true,
    limit: 100,
  });
}
