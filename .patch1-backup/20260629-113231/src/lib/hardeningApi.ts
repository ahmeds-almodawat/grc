import { emptyLiveArray } from './liveData';
import { createClient } from '@supabase/supabase-js';
import { requireServerBridge } from './privilegedAction';

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

const liveEmptyHealth: BackupHealthCheck[] = emptyLiveArray<BackupHealthCheck>();

const liveEmptyBlockers: WorkflowBlocker[] = emptyLiveArray<WorkflowBlocker>();

const liveEmptyReports: PrintReportDefinition[] = emptyLiveArray<PrintReportDefinition>();

export function isLiveMode() {
  return Boolean(supabase);
}

export async function fetchBackupHealthChecks(): Promise<BackupHealthCheck[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_backup_health_check')
    .select('*')
    .order('severity', { ascending: true });
  if (error) {
    console.warn('Health check emptyRows:', error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchWorkflowBlockers(): Promise<WorkflowBlocker[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_workflow_blockers')
    .select('*')
    .limit(200);
  if (error) {
    console.warn('Workflow blockers emptyRows:', error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchPrintReportIndex(): Promise<PrintReportDefinition[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('v_print_report_index')
    .select('*')
    .order('category_en');
  if (error) {
    console.warn('Report index emptyRows:', error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchReportRows(sourceView: string, limit = 500): Promise<Record<string, unknown>[]> {
  if (!supabase) {
    if (sourceView === 'v_backup_health_check') return liveEmptyHealth as unknown as Record<string, unknown>[];
    if (sourceView === 'v_workflow_blockers') return liveEmptyBlockers as unknown as Record<string, unknown>[];
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
  void createdBy;
  return requireServerBridge(
    'System health snapshot creation',
    'create_system_health_snapshot',
  );
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
