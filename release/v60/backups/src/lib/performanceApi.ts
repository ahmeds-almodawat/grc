import { supabase } from './supabase';

export type UiPerformanceSummary = {
  organization_id: string | null;
  total_events: number;
  avg_load_ms: number;
  p95_load_ms: number;
  mobile_events: number;
  slow_events: number;
  last_event_at: string | null;
  performance_score: number;
};

export type MobileReadinessGate = {
  gate_key: string;
  status: 'passed' | 'warning' | 'blocked' | string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  title_en: string;
  title_ar: string;
  details_en: string;
  details_ar: string;
  record_count: number;
  action_path: string | null;
};

export type ModulePressureRow = {
  module_key: string;
  module_name_en: string;
  module_name_ar: string;
  open_items: number;
  overdue_items: number;
  critical_items: number;
  pressure_score: number;
};

export type UiPerformanceEventInput = {
  page_key: string;
  event_type?: string;
  load_ms?: number | null;
  viewport_width?: number | null;
  viewport_height?: number | null;
  device_category?: string | null;
  language?: string | null;
  details?: Record<string, unknown>;
};

const now = new Date().toISOString();

const fallbackSummary: UiPerformanceSummary = {
  organization_id: 'demo',
  total_events: 34,
  avg_load_ms: 612,
  p95_load_ms: 1480,
  mobile_events: 11,
  slow_events: 3,
  last_event_at: now,
  performance_score: 86
};

const fallbackGates: MobileReadinessGate[] = [
  {
    gate_key: 'mobile_shell',
    status: 'passed',
    severity: 'medium',
    title_en: 'Responsive shell enabled',
    title_ar: 'تفعيل الهيكل المتجاوب',
    details_en: 'Sidebar, navigation and page cards are prepared for tablet and mobile widths.',
    details_ar: 'تم تجهيز القائمة الجانبية والتنقل والبطاقات لعرض الأجهزة اللوحية والجوال.',
    record_count: 0,
    action_path: null
  },
  {
    gate_key: 'heavy_queues',
    status: 'warning',
    severity: 'high',
    title_en: 'Operational queues need monitoring',
    title_ar: 'قوائم المتابعة التشغيلية تحتاج مراقبة',
    details_en: 'Large queues should be filtered before daily manager review to avoid slow screens.',
    details_ar: 'يجب تصفية القوائم الكبيرة قبل مراجعة المدير اليومية لتجنب بطء الشاشات.',
    record_count: 8,
    action_path: '/operations'
  },
  {
    gate_key: 'touch_targets',
    status: 'passed',
    severity: 'low',
    title_en: 'Touch-friendly controls',
    title_ar: 'أزرار مناسبة للمس',
    details_en: 'Primary controls use comfortable spacing for tablet/mobile operation.',
    details_ar: 'تستخدم الأزرار الرئيسية مسافات مناسبة للتشغيل عبر الجوال والأجهزة اللوحية.',
    record_count: 0,
    action_path: null
  }
];

const fallbackPressure: ModulePressureRow[] = [
  { module_key: 'projects', module_name_en: 'Projects & Actions', module_name_ar: 'المشاريع وخطط العمل', open_items: 28, overdue_items: 5, critical_items: 3, pressure_score: 78 },
  { module_key: 'ovr', module_name_en: 'OVR / Incidents', module_name_ar: 'بلاغات OVR / الحوادث', open_items: 14, overdue_items: 2, critical_items: 4, pressure_score: 74 },
  { module_key: 'approvals', module_name_en: 'Approvals', module_name_ar: 'الموافقات', open_items: 19, overdue_items: 7, critical_items: 1, pressure_score: 68 },
  { module_key: 'audit', module_name_en: 'Audit Follow-up', module_name_ar: 'متابعة المراجعة', open_items: 9, overdue_items: 3, critical_items: 2, pressure_score: 63 }
];

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC performance fallback] ${label}`, error);
}

export async function getUiPerformanceSummary(): Promise<UiPerformanceSummary> {
  if (!supabase) return fallbackSummary;
  try {
    const { data, error } = await supabase
      .from('v_ui_performance_summary')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ?? fallbackSummary;
  } catch (error) {
    logFallback('getUiPerformanceSummary', error);
    return fallbackSummary;
  }
}

export async function getMobileReadinessGates(): Promise<MobileReadinessGate[]> {
  if (!supabase) return fallbackGates;
  try {
    const { data, error } = await supabase
      .from('v_mobile_readiness_gates')
      .select('*')
      .order('severity', { ascending: true });
    if (error) throw error;
    return data?.length ? data : fallbackGates;
  } catch (error) {
    logFallback('getMobileReadinessGates', error);
    return fallbackGates;
  }
}

export async function getModulePressureRows(): Promise<ModulePressureRow[]> {
  if (!supabase) return fallbackPressure;
  try {
    const { data, error } = await supabase
      .from('v_module_payload_pressure')
      .select('*')
      .order('pressure_score', { ascending: false });
    if (error) throw error;
    return data?.length ? data : fallbackPressure;
  } catch (error) {
    logFallback('getModulePressureRows', error);
    return fallbackPressure;
  }
}

export async function logUiPerformanceEvent(input: UiPerformanceEventInput): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('ui_performance_events').insert({
      page_key: input.page_key,
      event_type: input.event_type ?? 'manual_signal',
      load_ms: input.load_ms ?? null,
      viewport_width: input.viewport_width ?? null,
      viewport_height: input.viewport_height ?? null,
      device_category: input.device_category ?? null,
      language: input.language ?? null,
      details: input.details ?? {}
    });
    if (error) throw error;
    return true;
  } catch (error) {
    logFallback('logUiPerformanceEvent', error);
    return false;
  }
}

export function getBrowserSnapshot() {
  if (typeof window === 'undefined') {
    return {
      load_ms: null,
      viewport_width: null,
      viewport_height: null,
      device_category: 'unknown'
    };
  }

  const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const loadMs = navEntry ? Math.round(navEntry.loadEventEnd || navEntry.domContentLoadedEventEnd || performance.now()) : Math.round(performance.now());
  const width = window.innerWidth;
  const deviceCategory = width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

  return {
    load_ms: loadMs > 0 ? loadMs : Math.round(performance.now()),
    viewport_width: width,
    viewport_height: window.innerHeight,
    device_category: deviceCategory
  };
}
