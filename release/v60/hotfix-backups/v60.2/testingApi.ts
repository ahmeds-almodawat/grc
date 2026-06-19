import { supabase } from './supabase';

export type QaReadinessSummary = {
  organization_id: string;
  total_gates: number;
  passed_gates: number;
  warning_gates: number;
  blocked_gates: number;
  critical_blockers: number;
  high_blockers: number;
  permission_warnings: number;
  workflow_blockers: number;
  active_test_runs: number;
  completed_test_runs: number;
  failed_test_results: number;
  readiness_score: number;
  last_test_run_at: string | null;
};

export type DeploymentGate = {
  organization_id: string;
  gate_key: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  status: 'passed' | 'warning' | 'blocked' | 'not_tested' | string;
  title_en: string;
  title_ar: string;
  details_en: string;
  details_ar: string;
  record_count: number;
  action_path: string | null;
};

export type QaTestCase = {
  id: string;
  category: string;
  test_key: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  expected_result_en: string;
  expected_result_ar: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | string;
  test_type: 'manual' | 'sql_check' | 'workflow_check' | 'permission_check' | string;
  is_active: boolean;
};

export type PermissionPersona = {
  persona_key: string;
  role_name: string;
  scope_name: string;
  expected_visibility_en: string;
  expected_visibility_ar: string;
  must_block_en: string;
  must_block_ar: string;
  test_steps_en: string;
  test_steps_ar: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low' | string;
};

export type QaRun = {
  id: string;
  title: string;
  scope: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  blocked_cases: number;
};

const now = new Date().toISOString();

const fallbackSummary: QaReadinessSummary = {
  organization_id: 'demo',
  total_gates: 12,
  passed_gates: 7,
  warning_gates: 3,
  blocked_gates: 2,
  critical_blockers: 1,
  high_blockers: 2,
  permission_warnings: 4,
  workflow_blockers: 6,
  active_test_runs: 1,
  completed_test_runs: 2,
  failed_test_results: 3,
  readiness_score: 68,
  last_test_run_at: now
};

const fallbackGates: DeploymentGate[] = [
  {
    organization_id: 'demo',
    gate_key: 'workflow_evidence_closure',
    category: 'workflow',
    severity: 'critical',
    status: 'blocked',
    title_en: 'Evidence-based closure enforcement',
    title_ar: 'فرض الإغلاق بالأدلة',
    details_en: 'Some items still need accepted evidence before closure.',
    details_ar: 'بعض البنود ما زالت تحتاج أدلة مقبولة قبل الإغلاق.',
    record_count: 6,
    action_path: '/workflow-blockers'
  },
  {
    organization_id: 'demo',
    gate_key: 'permission_scope_review',
    category: 'permissions',
    severity: 'high',
    status: 'warning',
    title_en: 'Access scope review',
    title_ar: 'مراجعة نطاقات الصلاحيات',
    details_en: 'Global and broad access should be reviewed before rollout.',
    details_ar: 'يجب مراجعة الصلاحيات العامة والواسعة قبل التشغيل.',
    record_count: 4,
    action_path: '/access-control'
  },
  {
    organization_id: 'demo',
    gate_key: 'backup_recent_package',
    category: 'backup',
    severity: 'high',
    status: 'passed',
    title_en: 'Recent export/backup package',
    title_ar: 'حزمة تصدير/نسخ حديثة',
    details_en: 'A recent browser backup/export package exists.',
    details_ar: 'توجد حزمة تصدير/نسخ حديثة من المتصفح.',
    record_count: 0,
    action_path: '/import-export'
  }
];

const fallbackCases: QaTestCase[] = [
  {
    id: 'case-1',
    category: 'permissions',
    test_key: 'employee_assigned_only',
    title_en: 'Employee sees assigned work only',
    title_ar: 'الموظف يرى الأعمال المسندة له فقط',
    description_en: 'Login as an employee and verify they cannot view unrelated department projects, audit findings or approvals.',
    description_ar: 'ادخل كمستخدم موظف وتحقق من عدم قدرته على رؤية مشاريع أو ملاحظات مراجعة أو موافقات لا تخصه.',
    expected_result_en: 'Only assigned tasks, evidence requests and own submitted OVRs are visible.',
    expected_result_ar: 'تظهر فقط المهام وطلبات الأدلة المسندة وبلاغات OVR الخاصة به.',
    priority: 'critical',
    test_type: 'permission_check',
    is_active: true
  },
  {
    id: 'case-2',
    category: 'workflow',
    test_key: 'close_without_evidence_blocked',
    title_en: 'Closure without accepted evidence is blocked',
    title_ar: 'منع الإغلاق بدون دليل مقبول',
    description_en: 'Try closing an evidence-required project, milestone, task, audit finding or OVR without accepted evidence.',
    description_ar: 'حاول إغلاق مشروع أو مرحلة أو مهمة أو ملاحظة مراجعة أو OVR يتطلب دليلاً دون دليل مقبول.',
    expected_result_en: 'System blocks closure and shows a clear reason.',
    expected_result_ar: 'النظام يمنع الإغلاق ويعرض سبباً واضحاً.',
    priority: 'critical',
    test_type: 'workflow_check',
    is_active: true
  },
  {
    id: 'case-3',
    category: 'backup',
    test_key: 'backup_export_restore_dry_run',
    title_en: 'Export package and restore dry-run are documented',
    title_ar: 'توثيق حزمة التصدير وتجربة الاستعادة الجافة',
    description_en: 'Create an external export package and record a restore dry-run result before production rollout.',
    description_ar: 'أنشئ حزمة تصدير خارجية وسجل نتيجة تجربة استعادة جافة قبل التشغيل الفعلي.',
    expected_result_en: 'Backup metadata exists and the readiness gate passes.',
    expected_result_ar: 'توجد بيانات النسخ ويجتاز بند الجاهزية.',
    priority: 'high',
    test_type: 'manual',
    is_active: true
  }
];

const fallbackPersonas: PermissionPersona[] = [
  {
    persona_key: 'executive_global',
    role_name: 'executive',
    scope_name: 'global',
    expected_visibility_en: 'All dashboards, critical risks, major OVRs, approvals and executive reports.',
    expected_visibility_ar: 'كل اللوحات والمخاطر الحرجة وبلاغات OVR الكبرى والموافقات والتقارير التنفيذية.',
    must_block_en: 'Direct database admin actions and unauthorized clinical closure if not Quality role.',
    must_block_ar: 'إجراءات الإدارة الفنية المباشرة والإغلاق السريري إذا لم يكن ضمن دور الجودة.',
    test_steps_en: 'Login, open each executive page, confirm visibility, attempt restricted closure actions.',
    test_steps_ar: 'تسجيل الدخول، فتح الصفحات التنفيذية، تأكيد الرؤية، ومحاولة إجراءات الإغلاق المقيدة.',
    risk_level: 'high'
  },
  {
    persona_key: 'department_manager_department',
    role_name: 'department_manager',
    scope_name: 'department',
    expected_visibility_en: 'Own department projects, tasks, OVRs, evidence requests and follow-up queues.',
    expected_visibility_ar: 'مشاريع ومهام وبلاغات OVR وطلبات الأدلة وقوائم المتابعة الخاصة بإدارته.',
    must_block_en: 'Other departments, global access control, audit closure approval and Quality-only OVR closure.',
    must_block_ar: 'الإدارات الأخرى، صلاحيات الوصول العامة، إغلاق المراجعة، وإغلاق OVR المخصص للجودة.',
    test_steps_en: 'Login as two department managers and verify cross-department data is isolated.',
    test_steps_ar: 'ادخل كمديرين من إدارتين مختلفتين وتحقق من عزل بيانات الإدارات.',
    risk_level: 'critical'
  },
  {
    persona_key: 'employee_assigned_only',
    role_name: 'employee',
    scope_name: 'assigned_only',
    expected_visibility_en: 'My Work, assigned evidence requests, comments and own OVR submissions.',
    expected_visibility_ar: 'أعمالي، طلبات الأدلة المسندة، التعليقات، وبلاغات OVR الخاصة به.',
    must_block_en: 'Executive dashboard details, unrelated projects, other employees, access control and approvals.',
    must_block_ar: 'تفاصيل اللوحة التنفيذية والمشاريع غير المرتبطة وبيانات الموظفين الآخرين والصلاحيات والموافقات.',
    test_steps_en: 'Login, search for unrelated department data, and confirm no results are visible.',
    test_steps_ar: 'سجل الدخول وابحث عن بيانات إدارة غير مرتبطة وتأكد من عدم ظهورها.',
    risk_level: 'critical'
  }
];

const fallbackRuns: QaRun[] = [
  {
    id: 'run-1',
    title: 'Pre-rollout smoke test',
    scope: 'production-readiness',
    status: 'in_progress',
    started_at: now,
    completed_at: null,
    total_cases: 18,
    passed_cases: 11,
    failed_cases: 3,
    blocked_cases: 4
  }
];

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC QA fallback] ${label}`, error);
}

export async function getQaReadinessSummary(): Promise<QaReadinessSummary> {
  if (!supabase) return emptyLiveObject<QaReadinessSummary>('getQaReadinessSummary');
  try {
    const { data, error } = await supabase.from('v_qa_readiness_summary').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return (data as QaReadinessSummary | null) ?? fallbackSummary;
  } catch (error) {
    logFallback('summary', error);
    return emptyLiveObject<QaReadinessSummary>('getQaReadinessSummary');
  }
}

export async function getDeploymentGates(): Promise<DeploymentGate[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_deployment_readiness_gates')
      .select('*')
      .order('status', { ascending: true })
      .order('severity', { ascending: true });
    if (error) throw error;
    return (data as DeploymentGate[] | null) ?? [];
  } catch (error) {
    logFallback('deployment gates', error);
    return [];
  }
}

export async function getQaTestCases(): Promise<QaTestCase[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_qa_test_case_library')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('priority', { ascending: true });
    if (error) throw error;
    return (data as QaTestCase[] | null) ?? [];
  } catch (error) {
    logFallback('test cases', error);
    return [];
  }
}

export async function getPermissionPersonas(): Promise<PermissionPersona[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('v_permission_test_personas').select('*');
    if (error) throw error;
    return (data as PermissionPersona[] | null) ?? [];
  } catch (error) {
    logFallback('permission personas', error);
    return [];
  }
}

export async function getQaRuns(): Promise<QaRun[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_qa_test_runs_summary')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return (data as QaRun[] | null) ?? [];
  } catch (error) {
    logFallback('qa runs', error);
    return [];
  }
}

export async function seedDefaultQaTestPlan(): Promise<number> {
  if (!supabase) return fallbackCases.length;
  try {
    const { data, error } = await supabase.rpc('seed_default_qa_test_cases');
    if (error) throw error;
    return Number(data ?? 0);
  } catch (error) {
    logFallback('seed default QA test plan', error);
    return 0;
  }
}

export function exportRowsAsCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const keys = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key));
    return set;
  }, new Set<string>()));

  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
  };

  const csv = [keys.join(','), ...rows.map(row => keys.map(key => escape(row[key])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
