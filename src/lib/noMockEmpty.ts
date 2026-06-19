export function emptyLiveObject<T>(label?: string): T {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[GRC live-data empty state] ${label || 'single-record query'} returned no live data.`);
  }
  return {} as T;
}
