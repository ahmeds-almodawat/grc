import { supabase, isSupabaseConfigured } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type ProductionGoNoGoSummary = {
  organization_id: string;
  cycle_count: number;
  go_ready_cycles: number;
  blocked_or_deferred_cycles: number;
  avg_readiness_score: number;
  latest_target_launch_at: string | null;
};

export type ProductionGoNoGoEvidenceQueueRow = {
  organization_id: string;
  cycle_id: string;
  cycle_code: string;
  cycle_name: string;
  decision_status: string;
  pending_persona_runs: number;
  pending_restore_proofs: number;
  pending_access_reviews: number;
  pending_confidentiality_checks: number;
  pending_decisions: number;
  readiness_signal: string;
};

export type ProductionGoNoGoDecisionQueueRow = {
  organization_id: string;
  id: string;
  cycle_id: string;
  cycle_code: string;
  cycle_name: string;
  decision_code: string;
  decision_type: string;
  decision_status: string;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_evidence_url: string | null;
  decision_signal: string;
};

export type ProductionGoNoGoMonitoringRow = {
  organization_id: string;
  cycle_id: string;
  cycle_code: string;
  cycle_name: string;
  monitoring_area: string;
  check_frequency: string;
  check_status: string;
  owner_name: string | null;
  latest_checked_at: string | null;
  evidence_url: string | null;
  monitoring_signal: string;
};

export async function getProductionGoNoGoSummary(): Promise<LiveResult<ProductionGoNoGoSummary>> {
  if (!isSupabaseConfigured || !supabase) {
    return configurationErrorResult<ProductionGoNoGoSummary>('Supabase is not configured for production go/no-go summary.');
  }

  const { data, error } = await supabase
    .from('v_production_go_no_go_summary')
    .select('*')
    .maybeSingle();

  if (error) {
    return queryErrorResult<ProductionGoNoGoSummary>(error, 'Unable to load production go/no-go summary.');
  }

  if (!data) {
    return emptyResult<ProductionGoNoGoSummary>('No production go/no-go cycles loaded yet.');
  }

  return liveResult(data as ProductionGoNoGoSummary);
}

export async function getProductionGoNoGoEvidenceQueue(): Promise<LiveResult<ProductionGoNoGoEvidenceQueueRow[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return configurationErrorResult<ProductionGoNoGoEvidenceQueueRow[]>('Supabase is not configured for production go/no-go evidence queue.');
  }

  const { data, error } = await supabase
    .from('v_production_go_no_go_evidence_queue')
    .select('*')
    .order('cycle_code', { ascending: true });

  if (error) {
    return queryErrorResult<ProductionGoNoGoEvidenceQueueRow[]>(error, 'Unable to load production go/no-go evidence queue.');
  }

  if (!data || data.length === 0) {
    return emptyResult<ProductionGoNoGoEvidenceQueueRow[]>('No production go/no-go evidence queue loaded yet.');
  }

  return liveResult(data as ProductionGoNoGoEvidenceQueueRow[]);
}

export async function getProductionGoNoGoDecisionQueue(): Promise<LiveResult<ProductionGoNoGoDecisionQueueRow[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return configurationErrorResult<ProductionGoNoGoDecisionQueueRow[]>('Supabase is not configured for production go/no-go decision queue.');
  }

  const { data, error } = await supabase
    .from('v_production_go_no_go_decision_queue')
    .select('*')
    .order('decision_code', { ascending: true });

  if (error) {
    return queryErrorResult<ProductionGoNoGoDecisionQueueRow[]>(error, 'Unable to load production go/no-go decision queue.');
  }

  if (!data || data.length === 0) {
    return emptyResult<ProductionGoNoGoDecisionQueueRow[]>('No production go/no-go decisions loaded yet.');
  }

  return liveResult(data as ProductionGoNoGoDecisionQueueRow[]);
}

export async function getProductionGoNoGoMonitoringDashboard(): Promise<LiveResult<ProductionGoNoGoMonitoringRow[]>> {
  if (!isSupabaseConfigured || !supabase) {
    return configurationErrorResult<ProductionGoNoGoMonitoringRow[]>('Supabase is not configured for production go/no-go monitoring dashboard.');
  }

  const { data, error } = await supabase
    .from('v_production_go_no_go_monitoring_dashboard')
    .select('*')
    .order('monitoring_area', { ascending: true });

  if (error) {
    return queryErrorResult<ProductionGoNoGoMonitoringRow[]>(error, 'Unable to load production go/no-go monitoring dashboard.');
  }

  if (!data || data.length === 0) {
    return emptyResult<ProductionGoNoGoMonitoringRow[]>('No production go/no-go monitoring checks loaded yet.');
  }

  return liveResult(data as ProductionGoNoGoMonitoringRow[]);
}
