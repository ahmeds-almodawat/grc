import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';

export type SecurityGovernanceSummary = {
  organization_id: string | null;
  security_score: number;
  active_sensitive_roles: number;
  stale_global_roles: number;
  unresolved_access_warnings: number;
  pending_security_reviews: number;
  high_risk_audit_events_30d: number;
  retention_rules_active: number;
  pending_retention_actions: number;
  last_review_at: string | null;
};

export type SecurityAccessFinding = {
  finding_key: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  title_en: string;
  title_ar: string;
  details_en: string;
  details_ar: string;
  record_count: number;
  action_path: string | null;
};

export type DataRetentionReadiness = {
  rule_key: string;
  title_en: string;
  title_ar: string;
  target_table: string;
  retention_months: number;
  status: 'active' | 'draft' | 'paused' | string;
  records_past_retention: number;
  requires_approval: boolean;
  last_reviewed_at: string | null;
  next_review_date: string | null;
};

export type SensitiveActivityTimeline = {
  id: string;
  activity_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  actor_name: string | null;
  summary_en: string;
  summary_ar: string;
  source_table: string | null;
  source_record_id: string | null;
  created_at: string;
};

export type SecurityReviewEventInput = {
  activity_type: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  summary_en: string;
  summary_ar: string;
  source_table?: string | null;
  source_record_id?: string | null;
  metadata?: Record<string, unknown>;
};

const now = new Date().toISOString();

const liveEmptySummary: SecurityGovernanceSummary = emptyLiveObject<SecurityGovernanceSummary>('liveEmptySummary');

const liveEmptyFindings: SecurityAccessFinding[] = emptyLiveArray<SecurityAccessFinding>();

const liveEmptyRetention: DataRetentionReadiness[] = emptyLiveArray<DataRetentionReadiness>();

const liveEmptyTimeline: SensitiveActivityTimeline[] = emptyLiveArray<SensitiveActivityTimeline>();

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC security emptyRows] ${label}`, error);
}

export async function getSecurityGovernanceSummary(): Promise<SecurityGovernanceSummary> {
  if (!supabase) return emptyLiveObject<SecurityGovernanceSummary>('getSecurityGovernanceSummary');
  try {
    const { data, error } = await supabase
      .from('v_security_governance_summary')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ?? liveEmptySummary;
  } catch (error) {
    logFallback('getSecurityGovernanceSummary', error);
    return emptyLiveObject<SecurityGovernanceSummary>('getSecurityGovernanceSummary');
  }
}

export async function getSecurityAccessFindings(): Promise<SecurityAccessFinding[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from('v_security_access_findings')
      .select('*')
      .order('record_count', { ascending: false });
    if (error) throw error;
    return data?.length ? data : liveEmptyFindings;
  } catch (error) {
    logFallback('getSecurityAccessFindings', error);
    return emptyLiveArray<any>();
  }
}

export async function getDataRetentionReadiness(): Promise<DataRetentionReadiness[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from('v_data_retention_readiness')
      .select('*')
      .order('records_past_retention', { ascending: false });
    if (error) throw error;
    return data?.length ? data : liveEmptyRetention;
  } catch (error) {
    logFallback('getDataRetentionReadiness', error);
    return emptyLiveArray<any>();
  }
}

export async function getSensitiveActivityTimeline(): Promise<SensitiveActivityTimeline[]> {
  if (!supabase) return emptyLiveArray<any>();
  try {
    const { data, error } = await supabase
      .from('v_sensitive_activity_timeline')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return data?.length ? data : liveEmptyTimeline;
  } catch (error) {
    logFallback('getSensitiveActivityTimeline', error);
    return emptyLiveArray<any>();
  }
}

export async function logSecurityReviewEvent(input: SecurityReviewEventInput): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('security_review_events').insert({
      actor_id: userData.user?.id ?? null,
      activity_type: input.activity_type,
      severity: input.severity ?? 'medium',
      summary_en: input.summary_en,
      summary_ar: input.summary_ar,
      source_table: input.source_table ?? null,
      source_record_id: input.source_record_id ?? null,
      metadata: input.metadata ?? {}
    });
    if (error) throw error;
    return true;
  } catch (error) {
    logFallback('logSecurityReviewEvent', error);
    return false;
  }
}
