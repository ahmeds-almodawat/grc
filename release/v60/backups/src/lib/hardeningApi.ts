import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type BackupHealthCheck = {
  organization_id: string;
  check_key: string;
  severity: Severity;
  area: string;
  title_en: string;
  title_ar: string;
  details_en: string;
  details_ar: string;
  record_count: number;
  action_path: string;
  created_at: string;
};

export type WorkflowBlocker = {
  organization_id: string;
  item_type: string;
  item_id: string;
  title: string;
  status: string;
  department_id: string | null;
  owner_id: string | null;
  due_date: string | null;
  blocker_key: string;
  blocker_en: string;
  blocker_ar: string;
  created_at: string;
};

export type PrintReportDefinition = {
  organization_id: string;
  report_key: string;
  name_en: string;
  name_ar: string;
  source_view: string;
  category_en: string;
  category_ar: string;
  printable: boolean;
  exportable: boolean;
};

export type DashboardKpi = {
  label_en: string;
  label_ar: string;
  value: number | string;
  tone: 'neutral' | 'good' | 'warning' | 'danger';
  hint_en?: string;
  hint_ar?: string;
};

export type DepartmentHeatmapRow = {
  department_id?: string | null;
  department_name_en?: string | null;
  department_name_ar?: string | null;
  department?: string | null;
  risk_score?: number | null;
  total_score?: number | null;
  critical_risks?: number | null;
  overdue_items?: number | null;
  major_ovrs?: number | null;
};

export type RadarProfileRow = {
  organization_id?: string;
  dimension?: string;
  dimension_en?: string;
  dimension_ar?: string;
  score?: number;
  value?: number;
};

const fallbackHealth: BackupHealthCheck[] = [
  {
    organization_id: 'demo',
    check_key: 'projects_missing_owner_or_due_date',
    severity: 'high',
    area: 'projects',
    title_en: 'Active projects missing owner or due date',
    title_ar: 'مشاريع نشطة بدون مالك أو تاريخ مستهدف',
    details_en: 'Every active project/action plan needs an owner and target end date.',
    details_ar: 'كل مشروع أو خطة عمل نشطة تحتاج إلى مالك وتاريخ انتهاء مستهدف.',
    record_count: 3,
    action_path: '/projects',
    created_at: new Date().toISOString(),
  },
  {
    organization_id: 'demo',
    check_key: 'overdue_items_without_delay_reason',
    severity: 'critical',
    area: 'workflow',
    title_en: 'Overdue items missing delay reason',
    title_ar: 'بنود متأخرة بدون سبب تأخير',
    details_en: 'Overdue projects, milestones, and tasks must have a delay reason.',
    details_ar: 'يجب تسجيل سبب التأخير للبنود المتأخرة.',
    record_count: 5,
    action_path: '/escalations',
    created_at: new Date().toISOString(),
  },
  {
    organization_id: 'demo',
    check_key: 'old_browser_backup_packages',
    severity: 'medium',
    area: 'backup',
    title_en: 'No recent browser backup package',
    title_ar: 'لا توجد حزمة نسخ احتياطي حديثة من المتصفح',
    details_en: 'Create an external backup package at least weekly during rollout.',
    details_ar: 'يفضل إنشاء حزمة نسخ احتياطي خارجية أسبوعياً أثناء الإطلاق.',
    record_count: 1,
    action_path: '/admin/import-export',
    created_at: new Date().toISOString(),
  },
];

const fallbackBlockers: WorkflowBlocker[] = [
  {
    organization_id: 'demo',
    item_type: 'project',
    item_id: 'demo-1',
    title: 'Authority matrix implementation',
    status: 'active',
    department_id: null,
    owner_id: null,
    due_date: null,
    blocker_key: 'missing_due_date',
    blocker_en: 'Project has no target end date',
    blocker_ar: 'المشروع بدون تاريخ مستهدف',
    created_at: new Date().toISOString(),
  },
  {
    organization_id: 'demo',
    item_type: 'task',
    item_id: 'demo-2',
    title: 'Upload evidence for OVR corrective action',
    status: 'in_progress',
    department_id: null,
    owner_id: null,
    due_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    blocker_key: 'missing_delay_reason',
    blocker_en: 'Task is overdue without delay reason',
    blocker_ar: 'المهمة متأخرة بدون سبب تأخير',
    created_at: new Date().toISOString(),
  },
];

const fallbackReports: PrintReportDefinition[] = [
  {
    organization_id: 'demo',
    report_key: 'executive_summary',
    name_en: 'Executive GRC Summary',
    name_ar: 'ملخص الحوكمة والمخاطر التنفيذي',
    source_view: 'v_executive_grc_summary',
    category_en: 'Executive',
    category_ar: 'تنفيذي',
    printable: true,
    exportable: true,
  },
  {
    organization_id: 'demo',
    report_key: 'backup_health_check',
    name_en: 'Backup Health Check',
    name_ar: 'فحص سلامة النسخ الاحتياطي',
    source_view: 'v_backup_health_check',
    category_en: 'System health',
    category_ar: 'سلامة النظام',
    printable: true,
    exportable: true,
  },
  {
    organization_id: 'demo',
    report_key: 'workflow_blockers',
    name_en: 'Workflow Blockers',
    name_ar: 'عوائق سير العمل',
    source_view: 'v_workflow_blockers',
    category_en: 'Workflow',
    category_ar: 'سير العمل',
    printable: true,
    exportable: true,
  },
];

export function isLiveMode() {
  return Boolean(supabase);
}

export async function fetchBackupHealthChecks(): Promise<BackupHealthCheck[]> {
  if (!supabase) return fallbackHealth;
  const { data, error } = await supabase
    .from('v_backup_health_check')
    .select('*')
    .order('severity', { ascending: true });
  if (error) {
    console.warn('Health check fallback:', error.message);
    return fallbackHealth;
  }
  return data ?? [];
}

export async function fetchWorkflowBlockers(): Promise<WorkflowBlocker[]> {
  if (!supabase) return fallbackBlockers;
  const { data, error } = await supabase
    .from('v_workflow_blockers')
    .select('*')
    .limit(200);
  if (error) {
    console.warn('Workflow blockers fallback:', error.message);
    return fallbackBlockers;
  }
  return data ?? [];
}

export async function fetchPrintReportIndex(): Promise<PrintReportDefinition[]> {
  if (!supabase) return fallbackReports;
  const { data, error } = await supabase
    .from('v_print_report_index')
    .select('*')
    .order('category_en');
  if (error) {
    console.warn('Report index fallback:', error.message);
    return fallbackReports;
  }
  return data ?? [];
}

export async function fetchReportRows(sourceView: string, limit = 500): Promise<Record<string, unknown>[]> {
  if (!supabase) {
    if (sourceView === 'v_backup_health_check') return fallbackHealth as unknown as Record<string, unknown>[];
    if (sourceView === 'v_workflow_blockers') return fallbackBlockers as unknown as Record<string, unknown>[];
    return [];
  }

  const { data, error } = await supabase.from(sourceView).select('*').limit(limit);
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function createHealthSnapshot(organizationId: string, createdBy?: string | null): Promise<string | null> {
  if (!supabase || organizationId === 'demo') return null;
  const { data, error } = await supabase.rpc('create_system_health_snapshot', {
    p_organization_id: organizationId,
    p_created_by: createdBy ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function logExport(params: {
  organizationId?: string | null;
  exportType: string;
  exportScope: string;
  fileName: string;
  format: string;
  rowCount: number;
  status?: string;
  filters?: Record<string, unknown>;
}) {
  if (!supabase || !params.organizationId || params.organizationId === 'demo') return;
  const { error } = await supabase.from('export_logs').insert({
    organization_id: params.organizationId,
    export_type: params.exportType,
    export_scope: params.exportScope,
    file_name: params.fileName,
    format: params.format,
    row_count: params.rowCount,
    status: params.status ?? 'completed',
    filters: params.filters ?? {},
  });
  if (error) console.warn('Export log failed:', error.message);
}

export function buildHardeningKpis(health: BackupHealthCheck[], blockers: WorkflowBlocker[]): DashboardKpi[] {
  const activeWarnings = health.filter((row) => row.record_count > 0);
  const critical = activeWarnings.filter((row) => row.severity === 'critical').length;
  const high = activeWarnings.filter((row) => row.severity === 'high').length;
  const blockerCount = blockers.length;
  const cleanChecks = health.filter((row) => row.record_count === 0).length;

  return [
    {
      label_en: 'Critical health warnings',
      label_ar: 'تحذيرات حرجة',
      value: critical,
      tone: critical > 0 ? 'danger' : 'good',
      hint_en: 'Must be fixed before production rollout.',
      hint_ar: 'يجب معالجتها قبل الإطلاق الفعلي.',
    },
    {
      label_en: 'High warnings',
      label_ar: 'تحذيرات عالية',
      value: high,
      tone: high > 0 ? 'warning' : 'good',
      hint_en: 'Important governance and access issues.',
      hint_ar: 'مشكلات مهمة في الحوكمة والصلاحيات.',
    },
    {
      label_en: 'Workflow blockers',
      label_ar: 'عوائق سير العمل',
      value: blockerCount,
      tone: blockerCount > 0 ? 'warning' : 'good',
      hint_en: 'Items missing owner, due date, delay reason, or evidence.',
      hint_ar: 'بنود ينقصها مالك أو تاريخ أو سبب تأخير أو دليل.',
    },
    {
      label_en: 'Clean checks',
      label_ar: 'فحوصات سليمة',
      value: cleanChecks,
      tone: 'good',
      hint_en: 'Health checks with zero findings.',
      hint_ar: 'فحوصات لم تظهر بها ملاحظات.',
    },
  ];
}
