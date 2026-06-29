import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type AuditEvidenceGovernanceSummary = {
  organization_id: string;
  engagement_count: number;
  open_finding_count: number;
  evidence_version_count: number;
  verified_hash_count: number;
  immutable_event_count: number;
  active_auditor_session_count: number;
  critical_gate_not_approved_count: number;
};

export type AuditEngagementDashboardRow = {
  organization_id: string;
  engagement_code: string;
  title: string;
  engagement_type: string;
  engagement_status: string;
  lead_auditor_name: string | null;
  target_report_date: string | null;
  finding_count: number;
  open_finding_count: number;
  workpaper_count: number;
  evidence_request_count: number;
};

export type EvidenceIntegrityIndexRow = {
  organization_id: string;
  source_type: string;
  evidence_code: string;
  evidence_title: string;
  version_no: number;
  version_status: string;
  hash_algorithm: string | null;
  integrity_status: string | null;
  verified_at: string | null;
  chain_hash: string | null;
  related_event_count: number;
};

export type ProductionGovernanceGateRow = {
  organization_id: string;
  gate_code: string;
  gate_name: string;
  gate_area: string;
  is_critical: boolean;
  gate_status: string;
  owner_name: string | null;
  due_date: string | null;
  evidence_item_count: number;
  accepted_evidence_count: number;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load audit/evidence governance data.',
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

export async function getAuditEvidenceGovernanceSummary(): Promise<LiveResult<AuditEvidenceGovernanceSummary>> {
  const result = await selectView<AuditEvidenceGovernanceSummary>('v_patch4_audit_evidence_governance_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<AuditEvidenceGovernanceSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<AuditEvidenceGovernanceSummary>('No audit/evidence governance summary row returned.');
}

export function getAuditEngagementDashboard(): Promise<LiveResult<AuditEngagementDashboardRow[]>> {
  return selectView<AuditEngagementDashboardRow>('v_patch4_audit_engagement_dashboard', {
    order: 'target_report_date',
    ascending: true,
    limit: 150,
  });
}

export function getEvidenceIntegrityIndex(): Promise<LiveResult<EvidenceIntegrityIndexRow[]>> {
  return selectView<EvidenceIntegrityIndexRow>('v_patch4_evidence_integrity_index', {
    order: 'evidence_code',
    ascending: true,
    limit: 150,
  });
}

export function getProductionGovernanceGateDashboard(): Promise<LiveResult<ProductionGovernanceGateRow[]>> {
  return selectView<ProductionGovernanceGateRow>('v_patch4_production_governance_gate_dashboard', {
    order: 'gate_code',
    ascending: true,
    limit: 150,
  });
}
