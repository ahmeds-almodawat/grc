import { describe, expect, it } from 'vitest';
import {
  configurationErrorResult,
  emptyResult,
  getLiveResultMessage,
  isLive,
  liveResult,
  queryErrorResult,
  unauthorizedResult,
  unwrapLiveResult
} from '../../src/lib/liveResult';

describe('v6.5 live result contract', () => {
  it('marks real Supabase data as live', () => {
    const result = liveResult([{ id: 'p1' }]);
    expect(result.status).toBe('live');
    expect(result.isLive).toBe(true);
    expect(isLive(result)).toBe(true);
    expect(unwrapLiveResult(result, [])).toHaveLength(1);
  });

  it('does not fake data for empty/error/unauthorized states', () => {
    const empty = emptyResult<unknown[]>();
    const unauthorized = unauthorizedResult<unknown[]>();
    const config = configurationErrorResult<unknown[]>();
    const query = queryErrorResult<unknown[]>(new Error('boom'));

    for (const result of [empty, unauthorized, config, query]) {
      expect(result.isLive).toBe(false);
      expect(result.data).toBeNull();
      expect(isLive(result)).toBe(false);
      expect(unwrapLiveResult(result, [])).toEqual([]);
    }
  });

  it('returns Arabic empty-state messages', () => {
    expect(getLiveResultMessage(emptyResult(), true)).toContain('لا توجد بيانات');
    expect(getLiveResultMessage(unauthorizedResult(), true)).toContain('صلاحية');
  });
});
