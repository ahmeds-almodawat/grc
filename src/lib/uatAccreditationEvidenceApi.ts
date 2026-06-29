import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type UatEvidenceSummary = {
  organization_id: string;
  scenario_count: number;
  passed_scenario_count: number;
  failed_or_blocked_scenario_count: number;
  evidence_capture_count: number;
  accepted_evidence_count: number;
  open_failure_count: number;
  pending_signoff_count: number;
  average_readiness_score: number | null;
};

export type UatRoleScenarioQueueRow = {
  organization_id: string;
  scenario_code: string;
  scenario_title: string;
  role_key: string;
  module_key: string;
  accreditation_domain: string | null;
  scenario_status: string;
  risk_level: string;
  owner_name: string | null;
  step_count: number;
  evidence_count: number;
  open_failure_count: number;
  queue_signal: string;
};

export type AccreditationEvidencePackReadinessRow = {
  organization_id: string;
  framework_code: string;
  department_name: string | null;
  evidence_item_count: number;
  accepted_count: number;
  gap_count: number;
  nearest_gap_due_date: string | null;
  readiness_signal: string;
};

export type UatFailedRetestQueueRow = {
  organization_id: string;
  failure_code: string;
  failure_title: string;
  severity: string;
  failure_status: string;
  owner_name: string | null;
  due_date: string | null;
  scenario_code: string;
  scenario_title: string;
  latest_retest_round: number | null;
  latest_retest_at: string | null;
  queue_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load UAT and accreditation evidence data.',
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

export async function getUatEvidenceSummary(): Promise<LiveResult<UatEvidenceSummary>> {
  const result = await selectView<UatEvidenceSummary>('v_patch13_uat_evidence_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<UatEvidenceSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<UatEvidenceSummary>('No UAT evidence summary row returned.');
}

export function getUatRoleScenarioQueue(): Promise<LiveResult<UatRoleScenarioQueueRow[]>> {
  return selectView<UatRoleScenarioQueueRow>('v_patch13_role_scenario_queue', {
    order: 'scenario_code',
    ascending: true,
    limit: 200,
  });
}

export function getAccreditationEvidencePackReadiness(): Promise<LiveResult<AccreditationEvidencePackReadinessRow[]>> {
  return selectView<AccreditationEvidencePackReadinessRow>('v_patch13_evidence_pack_readiness', {
    order: 'framework_code',
    ascending: true,
    limit: 200,
  });
}

export function getUatFailedRetestQueue(): Promise<LiveResult<UatFailedRetestQueueRow[]>> {
  return selectView<UatFailedRetestQueueRow>('v_patch13_failed_retest_queue', {
    order: 'due_date',
    ascending: true,
    limit: 200,
  });
}
