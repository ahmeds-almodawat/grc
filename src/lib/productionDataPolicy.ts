export type DataMode = 'live' | 'empty' | 'demo';

export const isProductionBuild = import.meta.env.MODE === 'production';
export const isDemoDataEnabled =
  import.meta.env.VITE_ALLOW_DEMO_DATA === 'true' && import.meta.env.MODE !== 'production';

export function resolveRows<T>(liveRows: T[] | null | undefined, explicitDemoRows: T[] = []): { rows: T[]; mode: DataMode } {
  if (Array.isArray(liveRows) && liveRows.length > 0) return { rows: liveRows, mode: 'live' };
  if (isDemoDataEnabled && explicitDemoRows.length > 0) return { rows: explicitDemoRows, mode: 'demo' };
  return { rows: [], mode: 'empty' };
}

export function resolveRecord<T>(liveRecord: T | null | undefined, explicitDemoRecord: T | null = null): { record: T | null; mode: DataMode } {
  if (liveRecord) return { record: liveRecord, mode: 'live' };
  if (isDemoDataEnabled && explicitDemoRecord) return { record: explicitDemoRecord, mode: 'demo' };
  return { record: null, mode: 'empty' };
}

export function productionDataWarning(context: string): string {
  return `No live data available for ${context}. Check Supabase connection, RLS, or imported production records.`;
}

export function arabicProductionDataWarning(context: string): string {
  return `لا توجد بيانات فعلية متاحة لـ ${context}. يرجى التحقق من اتصال Supabase أو صلاحيات RLS أو استيراد البيانات الفعلية.`;
}
