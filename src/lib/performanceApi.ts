import { supabase } from './supabase';
import { emptyLiveObject, emptyLiveArray } from './liveData';

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

const liveEmptySummary: UiPerformanceSummary = emptyLiveObject<UiPerformanceSummary>('liveEmptySummary');

const liveEmptyGates: MobileReadinessGate[] = emptyLiveArray<MobileReadinessGate>();

const liveEmptyPressure: ModulePressureRow[] = emptyLiveArray<ModulePressureRow>();

function logFallback(label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[GRC performance emptyRows] ${label}`, error);
}

export async function getUiPerformanceSummary(): Promise<UiPerformanceSummary> {
  if (!supabase) return emptyLiveObject<UiPerformanceSummary>('getUiPerformanceSummary');
  try {
    const { data, error } = await supabase
      .from('v_ui_performance_summary')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ?? liveEmptySummary;
  } catch (error) {
    logFallback('getUiPerformanceSummary', error);
    return emptyLiveObject<UiPerformanceSummary>('getUiPerformanceSummary');
  }
}

export async function getMobileReadinessGates(): Promise<MobileReadinessGate[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_mobile_readiness_gates')
      .select('*')
      .order('severity', { ascending: true });
    if (error) throw error;
    return data?.length ? data : liveEmptyGates;
  } catch (error) {
    logFallback('getMobileReadinessGates', error);
    return [];
  }
}

export async function getModulePressureRows(): Promise<ModulePressureRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('v_module_payload_pressure')
      .select('*')
      .order('pressure_score', { ascending: false });
    if (error) throw error;
    return data?.length ? data : liveEmptyPressure;
  } catch (error) {
    logFallback('getModulePressureRows', error);
    return [];
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
