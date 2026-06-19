import { supabase } from './supabase';

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

const fallbackSummary: SecurityGovernanceSummary = {
  organization_id: 'demo',
  security_score: 82,
  active_sensitive_roles: 7,
  stale_global_roles: 1,
  unresolved_access_warnings: 4,
  pending_security_reviews: 3,
  high_risk_audit_events_30d: 2,
  retention_rules_active: 8,
  pending_retention_actions: 5,
  last_review_at: now
};

const fallbackFindings: SecurityAccessFinding[] = [
  {
    finding_key: 'sensitive_global_roles',
    severity: 'critical',
    title_en: 'Sensitive global roles require review',
    title_ar: 'الأدوار الحساسة بنطاق عام تحتاج مراجعة',
    details_en: 'Super admin, executive and governance admin roles should be reviewed before rollout and quarterly after go-live.',
    details_ar: 'يجب مراجعة أدوار مدير النظام والتنفيذي ومسؤول الحوكمة قبل التشغيل ثم ربع سنوياً بعد الإطلاق.',
    record_count: 7,
    action_path: '/access-control'
  },
  {
    finding_key: 'broad_employee_scope',
    severity: 'high',
    title_en: 'Broad scope assigned to limited roles',
    title_ar: 'نطاق واسع لأدوار محدودة',
    details_en: 'Employees/viewers should not have global or division-wide access unless explicitly approved.',
    details_ar: 'يجب ألا يحصل الموظفون أو المشاهدون على صلاحية عامة أو على مستوى قطاع إلا باعتماد صريح.',
    record_count: 2,
    action_path: '/access-control'
  },
  {
    finding_key: 'missing_department_scope',
    severity: 'medium',
    title_en: 'Scoped roles missing department references',
    title_ar: 'أدوار محددة النطاق بدون إدارة مرتبطة',
    details_en: 'Department managers and scoped reviewers must be linked to their department to keep RLS predictable.',
    details_ar: 'يجب ربط مديري الإدارات والمراجعين المحددين بإداراتهم لضمان وضوح سياسات الوصول.',
    record_count: 3,
    action_path: '/access-control'
  }
];

const fallbackRetention: DataRetentionReadiness[] = [
  { rule_key: 'audit_logs', title_en: 'Audit logs retention', title_ar: 'مدة حفظ سجلات التدقيق', target_table: 'audit_logs', retention_months: 84, status: 'active', records_past_retention: 0, requires_approval: true, last_reviewed_at: now, next_review_date: '2026-09-30' },
  { rule_key: 'ovr_reports', title_en: 'OVR report retention', title_ar: 'مدة حفظ بلاغات OVR', target_table: 'ovr_reports', retention_months: 120, status: 'active', records_past_retention: 0, requires_approval: true, last_reviewed_at: now, next_review_date: '2026-09-30' },
  { rule_key: 'evidence_files', title_en: 'Evidence metadata retention', title_ar: 'مدة حفظ بيانات الأدلة', target_table: 'evidence_files', retention_months: 84, status: 'active', records_past_retention: 5, requires_approval: true, last_reviewed_at: now, next_review_date: '2026-09-30' },
  { rule_key: 'ui_performance_events', title_en: 'UI performance signal cleanup', title_ar: 'تنظيف إشارات أداء الواجهة', target_table: 'ui_performance_events', retention_months: 12, status: 'active', records_past_retention: 0, requires_approval: false, last_reviewed_at: now, next_review_date: '2026-07-31' }
];

const fallbackTimeline: SensitiveActivityTimeline[] = [
  { id: 'demo-1', activity_type: 'role_review', severity: 'high', actor_name: 'Governance Admin', summary_en: 'Quarterly review requested for global executive roles.', summary_ar: 'تم طلب مراجعة ربع سنوية للأدوار التنفيذية ذات النطاق العام.', source_table: 'user_roles', source_record_id: null, created_at: now },
  { id: 'demo-2', activity_type: 'retention_review', severity: 'medium', actor_name: 'System', summary_en: 'Evidence metadata retention queue has items requiring approval.', summary_ar: 'قائمة حفظ بيانات الأدلة تحتوي على بنود تحتاج اعتماداً.', source_table: 'data_retention_rules', source_record_id: null, created_at: now },
  { id: 'demo-3', activity_type: 'security_exception', severity: 'critical', actor_name: 'Super Admin', summary_en: 'Temporary global access exception should expire after rollout wave testing.', summary_ar: 'استثناء صلاحية عام مؤقت يجب أن ينتهي بعد اختبار دفعة التشغيل.', source_table: 'security_review_events', source_record_id: null, created_at: now }
];

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC security fallback] ${label}`, error);
}

export async function getSecurityGovernanceSummary(): Promise<SecurityGovernanceSummary> {
  if (!supabase) return emptyLiveObject<SecurityGovernanceSummary>('getSecurityGovernanceSummary');
  try {
    const { data, error } = await supabase
      .from('v_security_governance_summary')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ?? fallbackSummary;
  } catch (error) {
    logFallback('getSecurityGovernanceSummary', error);
    return emptyLiveObject<SecurityGovernanceSummary>('getSecurityGovernanceSummary');
  }
}

export async function getSecurityAccessFindings(): Promise<SecurityAccessFinding[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_security_access_findings')
      .select('*')
      .order('record_count', { ascending: false });
    if (error) throw error;
    return data?.length ? data : fallbackFindings;
  } catch (error) {
    logFallback('getSecurityAccessFindings', error);
    return [];
  }
}

export async function getDataRetentionReadiness(): Promise<DataRetentionReadiness[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_data_retention_readiness')
      .select('*')
      .order('records_past_retention', { ascending: false });
    if (error) throw error;
    return data?.length ? data : fallbackRetention;
  } catch (error) {
    logFallback('getDataRetentionReadiness', error);
    return [];
  }
}

export async function getSensitiveActivityTimeline(): Promise<SensitiveActivityTimeline[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_sensitive_activity_timeline')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return data?.length ? data : fallbackTimeline;
  } catch (error) {
    logFallback('getSensitiveActivityTimeline', error);
    return [];
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
