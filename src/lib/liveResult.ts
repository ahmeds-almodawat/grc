export type LiveDataStatus = 'live' | 'empty' | 'unauthorized' | 'configuration_error' | 'query_error';

export type LiveResultSource = 'supabase' | 'edge_function' | 'browser_storage' | 'system';

export type LiveResult<T> =
  | {
      status: 'live';
      data: T;
      source: LiveResultSource;
      isLive: true;
      generatedAt: string;
      message?: string;
    }
  | {
      status: Exclude<LiveDataStatus, 'live'>;
      data: null;
      source: LiveResultSource;
      isLive: false;
      generatedAt: string;
      message: string;
      errorCode?: string;
      error?: unknown;
    };

const now = () => new Date().toISOString();

export function liveResult<T>(data: T, source: LiveResultSource = 'supabase', message?: string): LiveResult<T> {
  return { status: 'live', data, source, isLive: true, generatedAt: now(), message };
}

export function emptyResult<T>(message = 'No live data available.', source: LiveResultSource = 'supabase'): LiveResult<T> {
  return { status: 'empty', data: null, source, isLive: false, generatedAt: now(), message };
}

export function unauthorizedResult<T>(
  message = 'You are not authorized to view this data.',
  source: LiveResultSource = 'supabase',
): LiveResult<T> {
  return { status: 'unauthorized', data: null, source, isLive: false, generatedAt: now(), message, errorCode: 'UNAUTHORIZED' };
}

export function configurationErrorResult<T>(
  message = 'Live data source is not configured.',
  source: LiveResultSource = 'supabase',
): LiveResult<T> {
  return { status: 'configuration_error', data: null, source, isLive: false, generatedAt: now(), message, errorCode: 'CONFIGURATION_ERROR' };
}

export function queryErrorResult<T>(
  error: unknown,
  message = 'Live data query failed.',
  source: LiveResultSource = 'supabase',
): LiveResult<T> {
  return { status: 'query_error', data: null, source, isLive: false, generatedAt: now(), message, errorCode: 'QUERY_ERROR', error };
}

export function isLive<T>(result: LiveResult<T>): result is Extract<LiveResult<T>, { status: 'live' }> {
  return result.status === 'live';
}

export function unwrapLiveResult<T>(result: LiveResult<T>, emptyRows: T): T {
  return result.status === 'live' ? result.data : emptyRows;
}

export function getLiveResultMessage<T>(result: LiveResult<T>, arabic = false): string {
  if (result.status === 'live') return result.message || (arabic ? 'بيانات فعلية' : 'Live data');
  if (arabic) {
    if (result.status === 'empty') return 'لا توجد بيانات فعلية متاحة.';
    if (result.status === 'unauthorized') return 'ليست لديك صلاحية لعرض هذه البيانات.';
    if (result.status === 'configuration_error') return 'مصدر البيانات الفعلية غير مهيأ.';
    if (result.status === 'query_error') return 'تعذر تحميل البيانات الفعلية.';
  }
  return result.message;
}

export function liveSuccess<T>(data: T, source: LiveResultSource = 'supabase', message?: string): LiveResult<T> {
  return liveResult(data, source, message);
}

export function liveEmpty<T>(message?: string, source: LiveResultSource = 'supabase'): LiveResult<T> {
  return emptyResult<T>(message, source);
}

export function liveError<T>(err: unknown, source: LiveResultSource = 'supabase'): LiveResult<T> {
  return queryErrorResult<T>(err, err instanceof Error ? err.message : String(err), source);
}

export function liveForbidden<T>(reason: string, source: LiveResultSource = 'supabase'): LiveResult<T> {
  return unauthorizedResult<T>(reason, source);
}

export function assertLiveSuccess<T>(result: LiveResult<T>): T {
  if (result.status === 'live') return result.data;
  throw new Error(getLiveResultMessage(result));
}
