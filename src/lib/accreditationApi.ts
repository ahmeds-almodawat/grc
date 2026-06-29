import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type AccreditationReadinessSummary = {
  standard_code: string;
  standard_name_en: string;
  standard_name_ar: string | null;
  standard_version_id: string;
  version_label: string;
  content_status: string;
  approval_status: string;
  chapter_count: number;
  requirement_count: number;
  measurable_element_count: number;
  evidence_rule_count: number;
  open_gap_count: number;
  latest_snapshot_at: string | null;
  latest_readiness_score: number | null;
};

export type AccreditationRequirementMatrixRow = {
  standard_code: string;
  version_label: string;
  chapter_code: string;
  chapter_title_en: string;
  requirement_id: string;
  requirement_code: string;
  requirement_title_en: string;
  requirement_title_ar: string | null;
  requirement_type: string;
  priority: 'critical' | 'high' | 'normal' | 'low' | string;
  measurable_element_count: number;
  evidence_rule_count: number;
  crosswalk_count: number;
};

export type AccreditationGapDashboardRow = {
  organization_id: string;
  standard_code: string;
  version_label: string;
  requirement_code: string;
  requirement_title_en: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  gap_status: string;
  gap_count: number;
  nearest_due_date: string | null;
};

async function selectAccreditationView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live accreditation data.',
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

export function getAccreditationReadinessSummary(): Promise<LiveResult<AccreditationReadinessSummary[]>> {
  return selectAccreditationView<AccreditationReadinessSummary>('v_accreditation_readiness_summary', {
    order: 'standard_code',
    ascending: true,
    limit: 100,
  });
}

export function getAccreditationRequirementMatrix(): Promise<LiveResult<AccreditationRequirementMatrixRow[]>> {
  return selectAccreditationView<AccreditationRequirementMatrixRow>('v_accreditation_requirement_matrix', {
    order: 'requirement_code',
    ascending: true,
    limit: 250,
  });
}

export function getAccreditationGapDashboard(): Promise<LiveResult<AccreditationGapDashboardRow[]>> {
  return selectAccreditationView<AccreditationGapDashboardRow>('v_accreditation_gap_dashboard', {
    order: 'nearest_due_date',
    ascending: true,
    limit: 100,
  });
}
