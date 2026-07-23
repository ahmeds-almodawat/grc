import { describe, expect, it, vi } from 'vitest';
import {
  createSupabaseAuthStorage,
  GRC_LEGACY_AUTH_STORAGE_KEY,
  isPersistedSupabaseSessionUsable,
  supabaseAuthStorageKeyForUrl,
} from '../../src/lib/supabaseAuthStorage';

const STAGING_REF = 'zghsgzrdwbqdrpuxanac';
const PRODUCTION_REF = 'zbrjjecpsrzposhuarcn';
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const PRODUCTION_URL = `https://${PRODUCTION_REF}.supabase.co`;
const NOW_MS = Date.UTC(2026, 6, 19, 0, 0, 0);
const USER_ID = '00000000-0000-4000-8000-000000000111';

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function encodeJwtPayload(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.synthetic-signature`;
}

function persistedSession(projectUrl: string, expiresAt: number): string {
  return JSON.stringify({
    access_token: encodeJwtPayload({
      iss: `${projectUrl}/auth/v1`,
      sub: USER_ID,
      aud: 'authenticated',
      exp: expiresAt,
    }),
    refresh_token: 'synthetic-refresh-value',
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: USER_ID,
      aud: 'authenticated',
    },
  });
}

function stagingStorage(backingStorage: MemoryStorage) {
  return createSupabaseAuthStorage({
    backingStorage,
    supabaseUrl: STAGING_URL,
    now: () => NOW_MS,
  });
}

describe('project-scoped Supabase Auth storage', () => {
  it('returns null for missing values and normalizes an undefined backing result', () => {
    const backingStorage = {
      getItem: vi.fn(() => undefined),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const storage = createSupabaseAuthStorage({
      backingStorage,
      supabaseUrl: STAGING_URL,
      now: () => NOW_MS,
    });

    expect(storage.getItem(supabaseAuthStorageKeyForUrl(STAGING_URL))).toBeNull();
    expect(storage.getItem('unrelated-key')).toBeNull();
  });

  it('removes corrupt current-project JSON and returns signed-out state', () => {
    const backingStorage = new MemoryStorage();
    const key = supabaseAuthStorageKeyForUrl(STAGING_URL);
    backingStorage.setItem(key, '{not-json');
    backingStorage.setItem(`${key}-code-verifier`, 'synthetic-verifier');

    expect(stagingStorage(backingStorage).getItem(key)).toBeNull();
    expect(backingStorage.getItem(key)).toBeNull();
    expect(backingStorage.getItem(`${key}-code-verifier`)).toBeNull();
  });

  it('removes an expired current-project session and returns signed-out state', () => {
    const backingStorage = new MemoryStorage();
    const key = supabaseAuthStorageKeyForUrl(STAGING_URL);
    const expiredAt = Math.floor(NOW_MS / 1_000) - 1;
    backingStorage.setItem(key, persistedSession(STAGING_URL, expiredAt));

    expect(stagingStorage(backingStorage).getItem(key)).toBeNull();
    expect(backingStorage.getItem(key)).toBeNull();
  });

  it('never imports a production-project session from the legacy shared key', () => {
    const backingStorage = new MemoryStorage();
    const key = supabaseAuthStorageKeyForUrl(STAGING_URL);
    const future = Math.floor(NOW_MS / 1_000) + 3_600;
    backingStorage.setItem(
      GRC_LEGACY_AUTH_STORAGE_KEY,
      persistedSession(PRODUCTION_URL, future),
    );

    expect(stagingStorage(backingStorage).getItem(key)).toBeNull();
    expect(backingStorage.getItem(key)).toBeNull();
    expect(backingStorage.getItem(GRC_LEGACY_AUTH_STORAGE_KEY)).not.toBeNull();
  });

  it('preserves a valid active current-project session', () => {
    const backingStorage = new MemoryStorage();
    const key = supabaseAuthStorageKeyForUrl(STAGING_URL);
    const future = Math.floor(NOW_MS / 1_000) + 3_600;
    backingStorage.setItem(key, persistedSession(STAGING_URL, future));

    expect(stagingStorage(backingStorage).getItem(key)).not.toBeNull();
    expect(backingStorage.getItem(key)).not.toBeNull();
  });

  it('migrates a provably current-project legacy session without discarding it', () => {
    const backingStorage = new MemoryStorage();
    const key = supabaseAuthStorageKeyForUrl(STAGING_URL);
    const future = Math.floor(NOW_MS / 1_000) + 3_600;
    backingStorage.setItem(
      GRC_LEGACY_AUTH_STORAGE_KEY,
      persistedSession(STAGING_URL, future),
    );

    expect(stagingStorage(backingStorage).getItem(key)).not.toBeNull();
    expect(backingStorage.getItem(key)).not.toBeNull();
    expect(backingStorage.getItem(GRC_LEGACY_AUTH_STORAGE_KEY)).toBeNull();
  });

  it('removes the current-project slot and verifier without removing another project', () => {
    const backingStorage = new MemoryStorage();
    const key = supabaseAuthStorageKeyForUrl(STAGING_URL);
    const future = Math.floor(NOW_MS / 1_000) + 3_600;
    backingStorage.setItem(key, persistedSession(STAGING_URL, future));
    backingStorage.setItem(`${key}-code-verifier`, 'synthetic-verifier');
    backingStorage.setItem(
      GRC_LEGACY_AUTH_STORAGE_KEY,
      persistedSession(PRODUCTION_URL, future),
    );

    stagingStorage(backingStorage).removeItem(key);

    expect(backingStorage.getItem(key)).toBeNull();
    expect(backingStorage.getItem(`${key}-code-verifier`)).toBeNull();
    expect(backingStorage.getItem(GRC_LEGACY_AUTH_STORAGE_KEY)).not.toBeNull();
  });

  it('derives deterministic, distinct cloud-project namespaces', () => {
    expect(supabaseAuthStorageKeyForUrl(STAGING_URL))
      .toBe(`grc-control-center-auth:${STAGING_REF}`);
    expect(supabaseAuthStorageKeyForUrl(PRODUCTION_URL))
      .toBe(`grc-control-center-auth:${PRODUCTION_REF}`);
    expect(supabaseAuthStorageKeyForUrl(STAGING_URL))
      .not.toBe(supabaseAuthStorageKeyForUrl(PRODUCTION_URL));
  });

  it('validates issuer, subject, audience and expiry without network access', () => {
    const future = Math.floor(NOW_MS / 1_000) + 3_600;
    expect(isPersistedSupabaseSessionUsable(
      persistedSession(STAGING_URL, future),
      STAGING_URL,
      NOW_MS,
    )).toBe(true);
    expect(isPersistedSupabaseSessionUsable(
      persistedSession(PRODUCTION_URL, future),
      STAGING_URL,
      NOW_MS,
    )).toBe(false);
  });
});
