import { supabase } from './supabase';

export type SetupReadinessRow = {
  check_key: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  area: 'organization' | 'users' | 'workflow' | 'risk' | 'ovr' | 'backup' | 'reports';
  severity: 'good' | 'warning' | 'critical';
  current_count: number;
  target_count: number;
  is_complete: boolean;
  action_hint_en: string;
  action_hint_ar: string;
};

export type TrainingChecklistRow = {
  id: string;
  audience: 'executive' | 'governance' | 'department_manager' | 'quality' | 'auditor' | 'employee';
  title_en: string;
  title_ar: string;
  objective_en: string;
  objective_ar: string;
  estimated_minutes: number;
  sort_order: number;
};

const fallbackReadiness: SetupReadinessRow[] = [
  {
    check_key: 'organization_structure',
    title_en: 'Organization structure',
    title_ar: 'الهيكل التنظيمي',
    description_en: 'Divisions, departments and units/stations are ready for assignment.',
    description_ar: 'تم تجهيز القطاعات والإدارات والوحدات/المحطات للتكليف.',
    area: 'organization',
    severity: 'warning',
    current_count: 3,
    target_count: 50,
    is_complete: false,
    action_hint_en: 'Import all 50 departments and station/unit codes before rollout.',
    action_hint_ar: 'استورد جميع الإدارات الخمسين وأكواد الوحدات/المحطات قبل التشغيل.'
  },
  {
    check_key: 'user_roles',
    title_en: 'User roles and scopes',
    title_ar: 'أدوار ونطاقات المستخدمين',
    description_en: 'Users have scoped roles so employees only see assigned work.',
    description_ar: 'تم ضبط أدوار المستخدمين بنطاقات محددة ليظهر للموظف ما يخصه فقط.',
    area: 'users',
    severity: 'critical',
    current_count: 0,
    target_count: 1,
    is_complete: false,
    action_hint_en: 'Assign at least one Super Admin, Governance Admin and Quality reviewer.',
    action_hint_ar: 'عيّن على الأقل مسؤولاً عاماً ومسؤول حوكمة ومراجع جودة.'
  },
  {
    check_key: 'backup_export',
    title_en: 'Backup/export readiness',
    title_ar: 'جاهزية النسخ والتصدير',
    description_en: 'Export Center can produce backup and custom report packages.',
    description_ar: 'مركز التصدير قادر على إنشاء نسخ بيانات وتقارير مخصصة.',
    area: 'backup',
    severity: 'good',
    current_count: 1,
    target_count: 1,
    is_complete: true,
    action_hint_en: 'Run a test export after importing real departments and users.',
    action_hint_ar: 'نفذ تجربة تصدير بعد استيراد الإدارات والمستخدمين الحقيقيين.'
  }
];

const fallbackTraining: TrainingChecklistRow[] = [
  {
    id: 'exec-01',
    audience: 'executive',
    title_en: 'Executive control room review',
    title_ar: 'مراجعة غرفة التحكم التنفيذية',
    objective_en: 'Read critical risks, escalations, overdue actions and pending approvals.',
    objective_ar: 'قراءة المخاطر الحرجة والتصعيدات والإجراءات المتأخرة والموافقات المعلقة.',
    estimated_minutes: 20,
    sort_order: 1
  },
  {
    id: 'quality-01',
    audience: 'quality',
    title_en: 'OVR investigation and closure',
    title_ar: 'تحقيق وإغلاق بلاغات OVR',
    objective_en: 'Review OVRs, confirm severity, request evidence and close only after Quality approval.',
    objective_ar: 'مراجعة بلاغات OVR وتأكيد الشدة وطلب الأدلة والإغلاق بعد اعتماد الجودة فقط.',
    estimated_minutes: 35,
    sort_order: 2
  },
  {
    id: 'manager-01',
    audience: 'department_manager',
    title_en: 'Department action ownership',
    title_ar: 'ملكية إجراءات الإدارة',
    objective_en: 'Update milestones, require delay reasons and upload evidence before closure.',
    objective_ar: 'تحديث المعالم وطلب أسباب التأخير ورفع الأدلة قبل الإغلاق.',
    estimated_minutes: 30,
    sort_order: 3
  }
];

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC demo fallback] ${label}`, error);
}

export async function getSetupReadiness(): Promise<SetupReadinessRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_setup_readiness_checklist')
      .select('*')
      .order('area', { ascending: true })
      .order('severity', { ascending: true });
    if (error) throw error;
    return (data as SetupReadinessRow[])?.length ? (data as SetupReadinessRow[]) : fallbackReadiness;
  } catch (error) {
    logFallback('setup readiness', error);
    return [];
  }
}

export async function getTrainingChecklist(): Promise<TrainingChecklistRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('grc_training_checklist')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data as TrainingChecklistRow[])?.length ? (data as TrainingChecklistRow[]) : fallbackTraining;
  } catch (error) {
    logFallback('training checklist', error);
    return [];
  }
}
