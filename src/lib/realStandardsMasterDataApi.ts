import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type RealStandardsMasterSummary = {
  organization_id: string;
  standards_library_count: number;
  license_verified_count: number;
  requirement_count: number;
  measurable_element_count: number;
  department_count: number;
  committee_count: number;
  evidence_taxonomy_count: number;
  document_count: number;
  control_count: number;
  pending_applicability_count: number;
};

export type RealStandardsReadinessRow = {
  organization_id: string;
  framework_code: string | null;
  version_label: string | null;
  chapter_code: string | null;
  requirement_code: string;
  requirement_title: string | null;
  applicability_status: string;
  responsible_department_name: string | null;
  priority: string;
  measurable_element_count: number;
  open_element_count: number;
  readiness_signal: string;
};

export type RealMasterDataCoverageRow = {
  organization_id: string;
  master_data_type: string;
  item_code: string;
  item_name: string;
  item_status: string;
};

export type RealControlEvidenceMapRow = {
  organization_id: string;
  control_code: string;
  control_name: string;
  control_domain: string;
  control_owner_name: string | null;
  owner_department_code: string | null;
  evidence_taxonomy_code: string | null;
  evidence_taxonomy_name: string | null;
  linked_requirement_code: string | null;
  is_key_control: boolean;
  mapping_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load real standards and master data.',
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

export async function getRealStandardsMasterSummary(): Promise<LiveResult<RealStandardsMasterSummary>> {
  const result = await selectView<RealStandardsMasterSummary>('v_real_standards_master_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<RealStandardsMasterSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<RealStandardsMasterSummary>('No standards/master summary row returned.');
}

export function getRealStandardsReadinessQueue(): Promise<LiveResult<RealStandardsReadinessRow[]>> {
  return selectView<RealStandardsReadinessRow>('v_real_standards_readiness_queue', {
    order: 'priority',
    ascending: true,
    limit: 200,
  });
}

export function getRealMasterDataCoverage(): Promise<LiveResult<RealMasterDataCoverageRow[]>> {
  return selectView<RealMasterDataCoverageRow>('v_real_master_data_coverage', {
    order: 'master_data_type',
    ascending: true,
    limit: 250,
  });
}

export function getRealControlEvidenceMap(): Promise<LiveResult<RealControlEvidenceMapRow[]>> {
  return selectView<RealControlEvidenceMapRow>('v_real_control_evidence_map', {
    order: 'control_code',
    ascending: true,
    limit: 200,
  });
}
