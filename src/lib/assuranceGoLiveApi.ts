import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type AssuranceGoLiveSummary = {
  organization_id: string;
  critical_gate_count: number;
  critical_gate_not_approved_count: number;
  signoff_required_count: number;
  signoff_signed_count: number;
  restore_exercise_count: number;
  failed_restore_exercise_count: number;
  training_campaign_count: number;
  training_overdue_count: number;
  monitoring_check_count: number;
  monitoring_failed_count: number;
  open_auditor_session_count: number;
  go_decision_count: number;
};

export type AssuranceGateDashboardRow = {
  organization_id: string;
  gate_code: string;
  gate_name: string;
  gate_area: string;
  gate_owner_name: string | null;
  is_critical: boolean;
  gate_status: string;
  evidence_required_count: number;
  evidence_accepted_count: number;
  due_date: string | null;
  gate_signal: string;
};

export type AssuranceExternalAuditorPortalRow = {
  organization_id: string;
  package_code: string | null;
  package_title: string | null;
  package_status: string | null;
  auditor_name: string;
  auditor_email: string | null;
  access_scope: string;
  session_status: string;
  starts_at: string | null;
  expires_at: string | null;
  last_accessed_at: string | null;
};

export type AssuranceSignoffReadinessRow = {
  organization_id: string;
  readiness_type: string;
  item_code: string;
  item_area: string | null;
  owner_name: string | null;
  item_status: string;
  readiness_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load assurance and go-live data.',
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

export async function getAssuranceGoLiveSummary(): Promise<LiveResult<AssuranceGoLiveSummary>> {
  const result = await selectView<AssuranceGoLiveSummary>('v_assurance_go_live_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<AssuranceGoLiveSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<AssuranceGoLiveSummary>('No assurance go-live summary row returned.');
}

export function getAssuranceGateDashboard(): Promise<LiveResult<AssuranceGateDashboardRow[]>> {
  return selectView<AssuranceGateDashboardRow>('v_assurance_gate_dashboard', {
    order: 'due_date',
    ascending: true,
    limit: 150,
  });
}

export function getAssuranceExternalAuditorPortal(): Promise<LiveResult<AssuranceExternalAuditorPortalRow[]>> {
  return selectView<AssuranceExternalAuditorPortalRow>('v_assurance_external_auditor_portal', {
    order: 'expires_at',
    ascending: true,
    limit: 150,
  });
}

export function getAssuranceSignoffReadiness(): Promise<LiveResult<AssuranceSignoffReadinessRow[]>> {
  return selectView<AssuranceSignoffReadinessRow>('v_assurance_signoff_readiness', {
    order: 'item_code',
    ascending: true,
    limit: 200,
  });
}
