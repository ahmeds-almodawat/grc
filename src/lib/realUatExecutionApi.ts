import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type RealUatExecutionSummary = {
  organization_id: string;
  cycle_count: number;
  active_cycle_count: number;
  script_count: number;
  run_count: number;
  passed_run_count: number;
  failed_or_blocked_run_count: number;
  open_finding_count: number;
  high_open_finding_count: number;
  passed_sql_proof_count: number;
  signed_area_count: number;
  ready_evidence_pack_count: number;
};

export type RealUatRunQueueRow = {
  organization_id: string;
  cycle_code: string | null;
  cycle_name: string | null;
  cycle_status: string | null;
  environment_name: string | null;
  script_code: string;
  script_title: string;
  module_key: string;
  test_priority: string;
  persona_group: string | null;
  persona_name: string | null;
  run_code: string | null;
  run_status: string | null;
  evidence_review_status: string | null;
  executed_by_name: string | null;
  execution_finished_at: string | null;
  queue_signal: string;
};

export type RealUatFindingRetestRow = {
  organization_id: string;
  cycle_code: string | null;
  cycle_name: string | null;
  finding_code: string;
  finding_title: string;
  severity: string;
  finding_status: string;
  owner_name: string | null;
  due_date: string | null;
  retest_count: number;
  passed_retest_count: number;
  failed_retest_count: number;
  queue_signal: string;
};

export type RealUatSignoffReadinessRow = {
  organization_id: string;
  cycle_code: string;
  cycle_name: string;
  signoff_area: string;
  signer_name: string | null;
  signer_title: string | null;
  signoff_status: string;
  signed_at: string | null;
  queue_signal: string;
};

export type RealUatEvidencePackReadinessRow = {
  organization_id: string;
  cycle_code: string | null;
  cycle_name: string | null;
  pack_code: string;
  pack_title: string;
  accreditation_scope: string;
  pack_status: string;
  required_artifact_count: number;
  accepted_artifact_count: number;
  open_gap_count: number;
  owner_name: string | null;
  target_review_date: string | null;
  queue_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load real UAT execution evidence.',
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

export async function getRealUatExecutionSummary(): Promise<LiveResult<RealUatExecutionSummary>> {
  const result = await selectView<RealUatExecutionSummary>('v_real_uat_execution_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<RealUatExecutionSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<RealUatExecutionSummary>('No real UAT execution summary row returned.');
}

export function getRealUatRunQueue(): Promise<LiveResult<RealUatRunQueueRow[]>> {
  return selectView<RealUatRunQueueRow>('v_real_uat_run_queue', {
    order: 'script_code',
    ascending: true,
    limit: 200,
  });
}

export function getRealUatFindingRetestQueue(): Promise<LiveResult<RealUatFindingRetestRow[]>> {
  return selectView<RealUatFindingRetestRow>('v_real_uat_finding_retest_queue', {
    order: 'due_date',
    ascending: true,
    limit: 200,
  });
}

export function getRealUatSignoffReadiness(): Promise<LiveResult<RealUatSignoffReadinessRow[]>> {
  return selectView<RealUatSignoffReadinessRow>('v_real_uat_signoff_readiness', {
    order: 'signoff_area',
    ascending: true,
    limit: 100,
  });
}

export function getRealUatEvidencePackReadiness(): Promise<LiveResult<RealUatEvidencePackReadinessRow[]>> {
  return selectView<RealUatEvidencePackReadinessRow>('v_real_uat_evidence_pack_readiness', {
    order: 'target_review_date',
    ascending: true,
    limit: 100,
  });
}
