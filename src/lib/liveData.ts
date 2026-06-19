export type LiveDataStatus = 'live' | 'empty' | 'error';

/**
 * Production-safe empty object for singleton summary APIs.
 *
 * This intentionally does NOT provide mock/demo/sample values.
 * It only lets TypeScript and the UI handle an empty live-data state
 * without silently presenting fake numbers.
 */
export function emptyLiveObject<T extends object>(source = 'live-data-empty'): T {
  return {
    __liveDataStatus: 'empty' as LiveDataStatus,
    __liveDataSource: source,
  } as unknown as T;
}

/**
 * Production-safe empty array for list APIs.
 */
export function emptyLiveArray<T>(): T[] {
  return [];
}

export function isEmptyLiveObject(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      '__liveDataStatus' in value &&
      (value as { __liveDataStatus?: string }).__liveDataStatus === 'empty'
  );
}
