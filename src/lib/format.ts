type DisplayLanguage = 'en' | 'ar';

const arabicDisplayValues: Record<string, string> = {
  accepted: 'مقبول',
  active: 'نشط',
  accept: 'قبول',
  avoid: 'تجنب',
  approved: 'معتمد',
  archived: 'مؤرشف',
  assigned_only: 'المسند إليه فقط',
  cancelled: 'ملغى',
  closed: 'مغلق',
  completed: 'مكتمل',
  critical: 'حرج',
  department: 'القسم',
  clinical: 'سريري',
  committee_decision: 'قرار لجنة',
  compliance: 'امتثال',
  ceo_decision: 'قرار الرئيس التنفيذي',
  draft: 'مسودة',
  employee: 'موظف',
  facility_engineering: 'هندسة المرافق',
  financial: 'مالي',
  executive: 'تنفيذي',
  failed: 'راسب',
  global: 'عام',
  governance_admin: 'مدير الحوكمة',
  high: 'عالٍ',
  hr: 'موارد بشرية',
  inactive: 'غير نشط',
  in_progress: 'قيد التنفيذ',
  invited: 'مدعو',
  it_cybersecurity: 'تقنية المعلومات والأمن السيبراني',
  legal: 'قانوني',
  locked: 'مقفل',
  low: 'منخفض',
  medium: 'متوسط',
  manual: 'يدوي',
  monitor: 'مراقبة',
  open: 'مفتوح',
  overdue: 'متأخر',
  operational: 'تشغيلي',
  other: 'أخرى',
  passed: 'ناجح',
  pending: 'قيد الانتظار',
  pending_approval: 'بانتظار الاعتماد',
  pending_review: 'بانتظار المراجعة',
  rejected: 'مرفوض',
  reduce: 'تقليل',
  reputation: 'سمعة',
  revenue_cycle: 'دورة الإيرادات',
  retired: 'ملغى',
  super_admin: 'مدير النظام',
  strategic: 'استراتيجي',
  supply_chain: 'سلسلة الإمداد',
  patient_safety: 'سلامة المرضى',
  procurement: 'مشتريات',
  transfer: 'نقل',
  under_review: 'قيد المراجعة',
  viewer: 'مشاهد',
  waived: 'معفى',
};

function displayLanguage(language?: DisplayLanguage): DisplayLanguage {
  if (language) return language;
  return typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
}

export function humanize(value: string | null | undefined, language?: DisplayLanguage) {
  if (!value) return '—';
  if (displayLanguage(language) === 'ar' && arabicDisplayValues[value.toLowerCase()]) {
    return arabicDisplayValues[value.toLowerCase()];
  }
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = typeof document !== 'undefined' && document.documentElement.lang === 'ar'
    ? 'ar-SA'
    : undefined;
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function ownerName(owner?: { full_name_en: string | null; full_name_ar: string | null } | null) {
  return displayLanguage() === 'ar'
    ? owner?.full_name_ar || owner?.full_name_en || 'غير مسند'
    : owner?.full_name_en || owner?.full_name_ar || 'Unassigned';
}

export function departmentName(department?: { name_en: string | null; name_ar: string | null } | null) {
  return displayLanguage() === 'ar'
    ? department?.name_ar || department?.name_en || 'على مستوى المنشأة'
    : department?.name_en || department?.name_ar || 'Company-wide';
}
