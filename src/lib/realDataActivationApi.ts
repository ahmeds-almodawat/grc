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
  program_count: number;
  active_program_count: number;
  dataset_count: number;
  ready_dataset_count: number;
  source_file_count: number;
  blocked_source_count: number;
  high_open_validation_count: number;
  pending_approval_count: number;
  pending_signoff_count: number;
};

export type RealDataActivationQueueRow = {
  organization_id: string;
  program_code: string;
  program_name: string;
  activation_scope: string;
  activation_stage: string;
  dataset_code: string;
  dataset_name: string;
  dataset_domain: string;
  target_module: string;
  dataset_status: string;
  expected_record_count: number | null;
  loaded_record_count: number | null;
  rejected_record_count: number | null;
  owner_name: string | null;
  due_date: string | null;
  queue_signal: string;
};

export type RealDataValidationQueueRow = {
  organization_id: string;
  program_code: string | null;
  dataset_code: string | null;
  dataset_name: string | null;
  severity: string;
  result_status: string;
  finding_title: string;
  remediation_owner_name: string | null;
  remediation_due_date: string | null;
  queue_signal: string;
};

export type RealDataApprovalQueueRow = {
  organization_id: string;
  program_code: string | null;
  dataset_code: string | null;
  dataset_name: string | null;
  approval_stage: string;
  approval_status: string;
  approver_role: string | null;
  approver_name: string | null;
  decided_at: string | null;
  queue_signal: string;
};

export type RealDataCutoverReadinessRow = {
  organization_id: string;
  program_code: string;
  program_name: string;
  activation_stage: string;
  dataset_count: number;
  ready_dataset_count: number;
  blocking_validation_count: number;
  pending_approval_count: number;
  approved_signoff_count: number;
  signoff_count: number;
  readiness_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load real data activation records.',
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
  return first ? liveResult(first, 'supabase') : emptyResult<RealDataActivationSummary>('No real data activation summary row returned.');
}

export function getRealDataActivationQueue(): Promise<LiveResult<RealDataActivationQueueRow[]>> {
  return selectView<RealDataActivationQueueRow>('v_real_data_activation_queue', {
    order: 'due_date',
    ascending: true,
    limit: 200,
  });
}

export function getRealDataValidationQueue(): Promise<LiveResult<RealDataValidationQueueRow[]>> {
  return selectView<RealDataValidationQueueRow>('v_real_data_validation_queue', {
    order: 'remediation_due_date',
    ascending: true,
    limit: 200,
  });
}

export function getRealDataApprovalQueue(): Promise<LiveResult<RealDataApprovalQueueRow[]>> {
  return selectView<RealDataApprovalQueueRow>('v_real_data_approval_queue', {
    order: 'approval_stage',
    ascending: true,
    limit: 200,
  });
}

export function getRealDataCutoverReadiness(): Promise<LiveResult<RealDataCutoverReadinessRow[]>> {
  return selectView<RealDataCutoverReadinessRow>('v_real_data_cutover_readiness', {
    order: 'program_code',
    ascending: true,
    limit: 100,
  });
}
