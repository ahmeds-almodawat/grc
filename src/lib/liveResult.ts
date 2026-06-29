export type LiveDataStatus = 'live' | 'empty' | 'unauthorized' | 'configuration_error' | 'query_error';

export type LiveResultSource = 'supabase' | 'edge_function' | 'browser_storage' | 'system';

type LiveSuccess<T> = {
  status: 'live';
  data: T;
  source: LiveResultSource;
  isLive: true;
  generatedAt: string;
  message?: string;
};

type LiveNonSuccess<T> = {
  status: Exclude<LiveDataStatus, 'live'>;
  data: null;
  source: LiveResultSource;
  isLive: false;
  generatedAt: string;
  message: string;
  errorCode?: string;
  error?: unknown;
};

export type LiveResult<T> = LiveSuccess<T> | LiveNonSuccess<T>;

function now() {
  return new Date().toISOString();
}

export function liveResult<T>(
  data: T,
  source: LiveResultSource = 'supabase',
  message?: string,
): LiveResult<T> {
  return { status: 'live', data, source, isLive: true, generatedAt: now(), message };
}

export function emptyResult<T>(
  message = 'No live data available.',
  source: LiveResultSource = 'supabase',
): LiveResult<T> {
  return { status: 'empty', data: null, source, isLive: false, generatedAt: now(), message };
}

export function unauthorizedResult<T>(
  message = 'You are not authorized to view this data.',
  source: LiveResultSource = 'supabase',
): LiveResult<T> {
  return {
    status: 'unauthorized',
    data: null,
    source,
    isLive: false,
    generatedAt: now(),
    message,
    errorCode: 'UNAUTHORIZED',
  };
}

export function configurationErrorResult<T>(
  message = 'Live data source is not configured.',
  source: LiveResultSource = 'supabase',
): LiveResult<T> {
  return {
    status: 'configuration_error',
    data: null,
    source,
    isLive: false,
    generatedAt: now(),
    message,
    errorCode: 'CONFIGURATION_ERROR',
  };
}

export function queryErrorResult<T>(
  error: unknown,
  message = 'Live data query failed.',
  source: LiveResultSource = 'supabase',
): LiveResult<T> {
  return {
    status: 'query_error',
    data: null,
    source,
    isLive: false,
    generatedAt: now(),
    message,
    errorCode: 'QUERY_ERROR',
    error,
  };
}

export function isLive<T>(result: LiveResult<T>): result is Extract<LiveResult<T>, { status: 'live' }> {
  return result.status === 'live' && result.isLive;
}

export function unwrapLiveResult<T>(result: LiveResult<T>, emptyRows: T): T {
  return isLive(result) ? result.data : emptyRows;
}

export function getLiveResultMessage<T>(result: LiveResult<T>, arabic = false): string {
  if (!arabic) return result.message ?? 'Live data loaded.';

  switch (result.status) {
    case 'live':
      return result.message ?? '\u062a\u0645 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629.';
    case 'empty':
      return '\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u062a\u0627\u062d\u0629.';
    case 'unauthorized':
      return '\u0644\u0627 \u062a\u0648\u062c\u062f \u0644\u062f\u064a\u0643 \u0635\u0644\u0627\u062d\u064a\u0629 \u0644\u0639\u0631\u0636 \u0647\u0630\u0647 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a.';
    case 'configuration_error':
      return '\u0645\u0635\u062f\u0631 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u063a\u064a\u0631 \u0645\u0647\u064a\u0623.';
    case 'query_error':
      return '\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629.';
  }
}

export function liveSuccess<T>(
  data: T,
  source: LiveResultSource = 'supabase',
  message?: string,
): LiveResult<T> {
  return liveResult(data, source, message);
}

export function liveEmpty<T>(
  message?: string,
  source: LiveResultSource = 'supabase',
): LiveResult<T> {
  return emptyResult<T>(message, source);
}

export function liveError<T>(
  err: unknown,
  source: LiveResultSource = 'supabase',
): LiveResult<T> {
  return queryErrorResult<T>(err, undefined, source);
}

export function liveForbidden<T>(
  reason: string,
  source: LiveResultSource = 'supabase',
): LiveResult<T> {
  return unauthorizedResult<T>(reason, source);
}

export function assertLiveSuccess<T>(result: LiveResult<T>): T {
  if (isLive(result)) return result.data;
  throw new Error(getLiveResultMessage(result));
}
