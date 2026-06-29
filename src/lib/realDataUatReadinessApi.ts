import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type RealDataActivationSummary = {
  organization_id: string;
  import_batch_count: number;
  active_import_count: number;
  failed_validation_count: number;
  pending_license_confirmation_count: number;
  mapping_set_count: number;
  pending_mapping_count: number;
};

export type RealDataImportQualityQueueRow = {
  organization_id: string;
  batch_code: string;
  source_domain: string;
  source_name: string;
  batch_status: string;
  content_license_status: string;
  uploaded_by_name: string | null;
  record_count: number;
  error_count: number;
  failed_rule_count: number;
  warning_rule_count: number;
  queue_signal: string;
};

export type UatReadinessDashboardRow = {
  organization_id: string;
  cycle_code: string;
  cycle_name: string;
  cycle_status: string;
  planned_end_date: string | null;
  scenario_count: number;
  passed_run_count: number;
  failed_or_blocked_run_count: number;
  open_finding_count: number;
  readiness_signal: string;
};

export type UatFindingQueueRow = {
  organization_id: string;
  finding_code: string;
  finding_title: string;
  severity: string;
  finding_status: string;
  owner_name: string | null;
  due_date: string | null;
  queue_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load real-data activation and UAT readiness data.',
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

export async function getRealDataActivationSummary(): Promise<LiveResult<RealDataActivationSummary>> {
  const result = await selectView<RealDataActivationSummary>('v_real_data_activation_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<RealDataActivationSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<RealDataActivationSummary>('No real-data activation summary row returned.');
}

export function getRealDataImportQualityQueue(): Promise<LiveResult<RealDataImportQualityQueueRow[]>> {
  return selectView<RealDataImportQualityQueueRow>('v_real_data_import_quality_queue', {
    order: 'batch_code',
    ascending: true,
    limit: 150,
  });
}

export function getUatReadinessDashboard(): Promise<LiveResult<UatReadinessDashboardRow[]>> {
  return selectView<UatReadinessDashboardRow>('v_uat_readiness_dashboard', {
    order: 'planned_end_date',
    ascending: true,
    limit: 150,
  });
}

export function getUatFindingsQueue(): Promise<LiveResult<UatFindingQueueRow[]>> {
  return selectView<UatFindingQueueRow>('v_uat_findings_queue', {
    order: 'due_date',
    ascending: true,
    limit: 150,
  });
}
