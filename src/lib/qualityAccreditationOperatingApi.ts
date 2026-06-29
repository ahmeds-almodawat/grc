import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type QualityAccreditationOperatingSummary = {
  organization_id: string;
  requirement_operation_count: number;
  ready_requirement_count: number;
  gap_score_count: number;
  indicator_count: number;
  submitted_measurement_count: number;
  active_tracer_count: number;
  open_observation_count: number;
  open_rca_capa_count: number;
  evidence_pack_attention_count: number;
};

export type QualityAccreditationRequirementRow = {
  organization_id: string;
  standard_code: string;
  chapter_code: string | null;
  requirement_reference: string;
  requirement_title: string | null;
  department_name: string | null;
  owner_name: string | null;
  applicability_status: string;
  readiness_status: string;
  target_survey_date: string | null;
  scoring_count: number;
  gap_count: number;
  evidence_submitted_count: number;
  last_scored_at: string | null;
};

export type QualityIndicatorDashboardRow = {
  organization_id: string;
  indicator_code: string;
  indicator_name: string;
  indicator_domain: string;
  owner_name: string | null;
  target_direction: string;
  target_value: number | null;
  measured_value: number | null;
  measurement_status: string | null;
  period_end: string | null;
  performance_signal: string;
};

export type QualityTracerRoundDashboardRow = {
  organization_id: string;
  tracer_code: string;
  tracer_title: string;
  tracer_type: string;
  department_name: string | null;
  tracer_status: string;
  round_date: string | null;
  lead_reviewer_name: string | null;
  observation_count: number;
  open_observation_count: number;
  high_risk_observation_count: number;
};

export type QualityRcaCapaDashboardRow = {
  organization_id: string;
  case_code: string;
  source_type: string;
  source_reference: string | null;
  case_title: string;
  department_name: string | null;
  case_status: string;
  severity: string;
  effectiveness_status: string;
  owner_name: string | null;
  due_date: string | null;
  case_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load quality/accreditation operating data.',
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

export async function getQualityAccreditationOperatingSummary(): Promise<LiveResult<QualityAccreditationOperatingSummary>> {
  const result = await selectView<QualityAccreditationOperatingSummary>('v_quality_accreditation_operating_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<QualityAccreditationOperatingSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<QualityAccreditationOperatingSummary>('No quality/accreditation operating summary row returned.');
}

export function getQualityAccreditationRequirementDashboard(): Promise<LiveResult<QualityAccreditationRequirementRow[]>> {
  return selectView<QualityAccreditationRequirementRow>('v_quality_accreditation_requirement_dashboard', {
    order: 'requirement_reference',
    ascending: true,
    limit: 200,
  });
}

export function getQualityIndicatorDashboard(): Promise<LiveResult<QualityIndicatorDashboardRow[]>> {
  return selectView<QualityIndicatorDashboardRow>('v_quality_indicator_dashboard', {
    order: 'indicator_code',
    ascending: true,
    limit: 150,
  });
}

export function getQualityTracerRoundDashboard(): Promise<LiveResult<QualityTracerRoundDashboardRow[]>> {
  return selectView<QualityTracerRoundDashboardRow>('v_quality_tracer_round_dashboard', {
    order: 'round_date',
    ascending: false,
    limit: 150,
  });
}

export function getQualityRcaCapaDashboard(): Promise<LiveResult<QualityRcaCapaDashboardRow[]>> {
  return selectView<QualityRcaCapaDashboardRow>('v_quality_rca_capa_dashboard', {
    order: 'due_date',
    ascending: true,
    limit: 150,
  });
}
