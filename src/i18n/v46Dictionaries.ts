export type SupportedLanguage = 'en' | 'ar';

export const v46StatusLabels: Record<string, Record<SupportedLanguage, string>> = {
  draft: { en: 'Draft', ar: 'مسودة' },
  submitted: { en: 'Submitted', ar: 'مقدم' },
  under_supervisor_review: { en: 'Under supervisor/HOD review', ar: 'قيد مراجعة المشرف / رئيس القسم' },
  under_quality_review: { en: 'Under Quality review', ar: 'قيد مراجعة الجودة' },
  returned_for_clarification: { en: 'Returned for clarification', ar: 'معاد للتوضيح' },
  action_plan_required: { en: 'Action plan required', ar: 'مطلوب خطة إجراء' },
  corrective_action_in_progress: { en: 'Corrective action in progress', ar: 'الإجراء التصحيحي قيد التنفيذ' },
  evidence_submitted: { en: 'Evidence submitted', ar: 'تم تقديم الدليل' },
  quality_closure_review: { en: 'Quality closure review', ar: 'مراجعة إغلاق الجودة' },
  major_escalation: { en: 'Major escalation', ar: 'تصعيد جسيم' },
  rca_required: { en: 'RCA required', ar: 'مطلوب تحليل السبب الجذري' },
  closed: { en: 'Closed', ar: 'مغلق' },
  rejected: { en: 'Rejected', ar: 'مرفوض' },
  cancelled: { en: 'Cancelled', ar: 'ملغى' },
  delayed: { en: 'Delayed', ar: 'متأخر' },
  at_risk: { en: 'At risk', ar: 'معرض للتأخر' },
  approved: { en: 'Approved', ar: 'معتمد' },
  pending: { en: 'Pending', ar: 'معلق' }
};

export const v46RoleLabels: Record<string, Record<SupportedLanguage, string>> = {
  super_admin: { en: 'Super Admin', ar: 'مدير النظام العام' },
  executive: { en: 'Executive', ar: 'تنفيذي' },
  governance_admin: { en: 'Governance Admin', ar: 'مسؤول الحوكمة' },
  division_head: { en: 'Division Head', ar: 'رئيس القطاع' },
  department_manager: { en: 'Department Manager', ar: 'مدير القسم' },
  project_owner: { en: 'Project Owner', ar: 'مالك المشروع' },
  task_owner: { en: 'Task Owner', ar: 'مالك المهمة' },
  auditor: { en: 'Auditor', ar: 'مراجع' },
  compliance_officer: { en: 'Compliance Officer', ar: 'مسؤول الالتزام' },
  quality_manager: { en: 'Quality Manager', ar: 'مدير الجودة' },
  quality_officer: { en: 'Quality Officer', ar: 'مسؤول الجودة' },
  viewer: { en: 'Viewer', ar: 'مطلع' },
  employee: { en: 'Employee', ar: 'موظف' }
};

export const v46OvrSeverityLabels: Record<string, Record<SupportedLanguage, string>> = {
  level_1: { en: 'Near miss - Level 1', ar: 'شبه خطأ - المستوى 1' },
  level_2: { en: 'No apparent injury - Level 2', ar: 'لا توجد إصابة ظاهرة - المستوى 2' },
  level_3: { en: 'Minor - Level 3', ar: 'بسيط - المستوى 3' },
  level_4: { en: 'Major - Level 4', ar: 'جسيم - المستوى 4' },
  sentinel: { en: 'Sentinel event', ar: 'حدث جلل' }
};

export const v46OvrCategoryLabels: Record<string, Record<SupportedLanguage, string>> = {
  medication: { en: 'Medication', ar: 'الأدوية' },
  treatment_blood_transfusion: { en: 'Treatment & blood transfusion', ar: 'العلاج ونقل الدم' },
  dama: { en: 'DAMA', ar: 'الخروج على مسؤولية المريض' },
  needle_stick_sharp_injury: { en: 'Needle stick / sharp injury', ar: 'وخز إبرة / إصابة حادة' },
  behavioral_patient: { en: 'Behavioral - patient', ar: 'سلوكي - مريض' },
  practice_variance_medical: { en: 'Practice variance - medical', ar: 'انحراف ممارسة - طبي' },
  practice_variance_nursing: { en: 'Practice variance - nursing', ar: 'انحراف ممارسة - تمريضي' },
  falls_injury: { en: 'Falls / injury', ar: 'السقوط / الإصابة' },
  environment_of_care: { en: 'Environment of care', ar: 'بيئة الرعاية' },
  miscellaneous: { en: 'Miscellaneous', ar: 'متفرقات' },
  damaged_material: { en: 'Damaged material', ar: 'ممتلكات تالفة' },
  other: { en: 'Other', ar: 'أخرى' }
};

export function v46Label(dict: Record<string, Record<SupportedLanguage, string>>, key: string | null | undefined, lang: SupportedLanguage = 'en') {
  if (!key) return '';
  return dict[key]?.[lang] ?? key.replace(/_/g, ' ');
}
