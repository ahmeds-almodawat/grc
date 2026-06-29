import { supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type ProfessionalWorkbenchSummary = {
  organization_id: string;
  audit_engagement_count: number;
  open_review_note_count: number;
  risk_assessment_count: number;
  appetite_breach_count: number;
  control_test_count: number;
  failed_control_test_count: number;
  obligation_count: number;
  breached_obligation_count: number;
  open_issue_count: number;
  overdue_issue_count: number;
  open_capa_count: number;
};

export type ProfessionalAuditQueueRow = {
  organization_id: string;
  engagement_code: string;
  engagement_title: string;
  audit_domain: string;
  risk_rating: string;
  engagement_stage: string;
  lead_auditor_name: string | null;
  auditee_owner_name: string | null;
  target_report_date: string | null;
  program_count: number;
  open_review_note_count: number;
  queue_signal: string;
};

export type ProfessionalRiskComplianceQueueRow = {
  organization_id: string;
  queue_type: string;
  item_code: string;
  item_title: string;
  item_status: string;
  owner_name: string | null;
  due_date: string | null;
  queue_signal: string;
};

export type ProfessionalIssueCapaQueueRow = {
  organization_id: string;
  issue_code: string;
  issue_title: string;
  issue_source: string;
  severity: string;
  issue_status: string;
  owner_name: string | null;
  due_date: string | null;
  capa_count: number;
  failed_retest_count: number;
  queue_signal: string;
};

async function selectView<T>(
  viewName: string,
  options: { order?: string; ascending?: boolean; limit?: number } = {},
): Promise<LiveResult<T[]>> {
  if (!supabase) {
    return configurationErrorResult<T[]>(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load professional workbench data.',
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

export async function getProfessionalWorkbenchSummary(): Promise<LiveResult<ProfessionalWorkbenchSummary>> {
  const result = await selectView<ProfessionalWorkbenchSummary>('v_professional_workbench_summary', { limit: 1 });

  if (result.status !== 'live') {
    return result as unknown as LiveResult<ProfessionalWorkbenchSummary>;
  }

  const first = result.data[0];
  return first ? liveResult(first, 'supabase') : emptyResult<ProfessionalWorkbenchSummary>('No professional workbench summary row returned.');
}

export function getProfessionalAuditQueue(): Promise<LiveResult<ProfessionalAuditQueueRow[]>> {
  return selectView<ProfessionalAuditQueueRow>('v_professional_audit_queue', {
    order: 'target_report_date',
    ascending: true,
    limit: 150,
  });
}

export function getProfessionalRiskComplianceQueue(): Promise<LiveResult<ProfessionalRiskComplianceQueueRow[]>> {
  return selectView<ProfessionalRiskComplianceQueueRow>('v_professional_risk_compliance_queue', {
    order: 'due_date',
    ascending: true,
    limit: 150,
  });
}

export function getProfessionalIssueCapaQueue(): Promise<LiveResult<ProfessionalIssueCapaQueueRow[]>> {
  return selectView<ProfessionalIssueCapaQueueRow>('v_professional_issue_capa_queue', {
    order: 'due_date',
    ascending: true,
    limit: 150,
  });
}
