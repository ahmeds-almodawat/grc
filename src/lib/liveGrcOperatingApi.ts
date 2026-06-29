import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type LiveGrcOperatingSummary = {
  risk_count: number;
  active_risk_count: number;
  control_count: number;
  weak_control_count: number;
  active_obligation_count: number;
  open_capa_count: number;
  evidence_attention_count: number;
  closed_packet_count: number;
};

export type LiveGrcRiskControlMapRow = {
  organization_id: string;
  risk_id: string;
  risk_code: string;
  risk_title: string;
  residual_score: number | null;
  risk_status: string;
  control_id: string | null;
  control_code: string | null;
  control_title: string | null;
  design_effectiveness: string | null;
  operating_effectiveness: string | null;
  coverage_type: string | null;
  coverage_strength: string | null;
  next_test_due_date: string | null;
};

export type LiveGrcCapaQueueRow = {
  organization_id: string;
  capa_id: string;
  capa_code: string;
  source_type: string;
  title: string;
  owner_name: string | null;
  due_date: string | null;
  capa_status: string;
  queue_signal: 'overdue' | 'due_soon' | 'ready_for_retest' | 'normal' | string;
};

export type LiveGrcObligationDashboardRow = {
  organization_id: string;
  source_authority: string;
  obligation_type: string;
  obligation_status: string;
  obligation_count: number;
  nearest_due_date: string | null;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live GRC operating data.',
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

export async function getLiveGrcOperatingSummary(): Promise<LiveResult<LiveGrcOperatingSummary>> {
  const result = await selectView<LiveGrcOperatingSummary>('v_live_grc_operating_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<LiveGrcOperatingSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<LiveGrcOperatingSummary>('No live GRC summary row returned.');
}

export function getLiveGrcRiskControlMap(): Promise<LiveResult<LiveGrcRiskControlMapRow[]>> {
  return selectView<LiveGrcRiskControlMapRow>('v_live_grc_risk_control_map', {
    order: 'residual_score',
    ascending: false,
    limit: 150,
  });
}

export function getLiveGrcCapaQueue(): Promise<LiveResult<LiveGrcCapaQueueRow[]>> {
  return selectView<LiveGrcCapaQueueRow>('v_live_grc_capa_queue', {
    order: 'due_date',
    ascending: true,
    limit: 100,
  });
}

export function getLiveGrcObligationDashboard(): Promise<LiveResult<LiveGrcObligationDashboardRow[]>> {
  return selectView<LiveGrcObligationDashboardRow>('v_live_grc_obligation_dashboard', {
    order: 'nearest_due_date',
    ascending: true,
    limit: 100,
  });
}
