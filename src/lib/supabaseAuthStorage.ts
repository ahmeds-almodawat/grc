export const GRC_LEGACY_AUTH_STORAGE_KEY = 'grc-control-center-auth';
export const GRC_AUTH_STORAGE_KEY_PREFIX = `${GRC_LEGACY_AUTH_STORAGE_KEY}:`;

export interface BrowserStorageLike {
  getItem(key: string): string | null | undefined;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SupabaseAuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseSupabaseUrl(rawUrl: string | undefined): URL | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : null;
  } catch {
    return null;
  }
}

export function supabaseProjectRefFromUrl(rawUrl: string | undefined): string | null {
  const parsed = parseSupabaseUrl(rawUrl);
  if (!parsed) return null;
  return parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1]?.toLowerCase() ?? null;
}

export function supabaseAuthStorageKeyForUrl(rawUrl: string | undefined): string {
  const projectRef = supabaseProjectRefFromUrl(rawUrl);
  return projectRef
    ? `${GRC_AUTH_STORAGE_KEY_PREFIX}${projectRef}`
    : GRC_LEGACY_AUTH_STORAGE_KEY;
}

function decodeJwtPayload(token: string): JsonObject | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isAuthenticatedAudience(value: unknown): boolean {
  return value === 'authenticated'
    || (Array.isArray(value) && value.includes('authenticated'));
}

export function isSupabaseSessionUsable(
  session: unknown,
  supabaseUrl: string | undefined,
  nowMs = Date.now(),
): boolean {
  if (!isObject(session) || !isObject(session.user)) return false;
  if (
    typeof session.access_token !== 'string'
    || !session.access_token
    || typeof session.refresh_token !== 'string'
    || !session.refresh_token
    || typeof session.expires_at !== 'number'
    || !Number.isFinite(session.expires_at)
    || typeof session.user.id !== 'string'
    || !session.user.id
  ) {
    return false;
  }

  const nowSeconds = Math.floor(nowMs / 1_000);
  if (session.expires_at <= nowSeconds) return false;

  const projectRef = supabaseProjectRefFromUrl(supabaseUrl);
  if (!projectRef) {
    // Local Supabase and the repository's fully mocked browser suites use
    // non-JWT synthetic sessions. They still receive structural and expiry
    // validation, while hosted projects additionally require issuer binding.
    return true;
  }

  const parsedUrl = parseSupabaseUrl(supabaseUrl);
  const payload = decodeJwtPayload(session.access_token);
  if (!parsedUrl || !payload) return false;
  return payload.iss === `${parsedUrl.origin}/auth/v1`
    && payload.sub === session.user.id
    && typeof payload.exp === 'number'
    && Number.isFinite(payload.exp)
    && payload.exp > nowSeconds
    && isAuthenticatedAudience(payload.aud);
}

export function isPersistedSupabaseSessionUsable(
  rawValue: string,
  supabaseUrl: string | undefined,
  nowMs = Date.now(),
): boolean {
  try {
    return isSupabaseSessionUsable(JSON.parse(rawValue) as unknown, supabaseUrl, nowMs);
  } catch {
    return false;
  }
}

function normalizeStoredValue(value: string | null | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

export function createSupabaseAuthStorage({
  backingStorage,
  supabaseUrl,
  now = () => Date.now(),
}: {
  backingStorage: BrowserStorageLike;
  supabaseUrl: string | undefined;
  now?: () => number;
}): SupabaseAuthStorage {
  const authStorageKey = supabaseAuthStorageKeyForUrl(supabaseUrl);
  const verifierKey = `${authStorageKey}-code-verifier`;

  const read = (key: string): string | null => {
    try {
      return normalizeStoredValue(backingStorage.getItem(key));
    } catch {
      return null;
    }
  };

  const removePair = (key: string) => {
    try {
      backingStorage.removeItem(key);
    } catch {
      // A blocked storage backend is equivalent to unavailable persistence.
    }
    try {
      backingStorage.removeItem(`${key}-code-verifier`);
    } catch {
      // A blocked storage backend is equivalent to unavailable persistence.
    }
  };

  const isUsable = (value: string) => (
    isPersistedSupabaseSessionUsable(value, supabaseUrl, now())
  );

  return {
    getItem(key: string): string | null {
      const stored = read(key);
      if (key !== authStorageKey) return stored;

      if (stored !== null) {
        if (isUsable(stored)) return stored;
        removePair(authStorageKey);
        return null;
      }

      if (authStorageKey === GRC_LEGACY_AUTH_STORAGE_KEY) return null;
      const legacy = read(GRC_LEGACY_AUTH_STORAGE_KEY);
      if (legacy === null || !isUsable(legacy)) return null;

      // Preserve a valid active session only after its JWT proves that the
      // legacy shared slot belongs to this exact Supabase project.
      try {
        backingStorage.setItem(authStorageKey, legacy);
      } catch {
        return null;
      }
      removePair(GRC_LEGACY_AUTH_STORAGE_KEY);
      return legacy;
    },

    setItem(key: string, value: string): void {
      if (key === authStorageKey && !isUsable(value)) {
        removePair(authStorageKey);
        return;
      }
      backingStorage.setItem(key, value);
    },

    removeItem(key: string): void {
      if (key !== authStorageKey) {
        backingStorage.removeItem(key);
        return;
      }

      removePair(authStorageKey);
      if (authStorageKey === GRC_LEGACY_AUTH_STORAGE_KEY) return;

      const legacy = read(GRC_LEGACY_AUTH_STORAGE_KEY);
      if (legacy !== null && isUsable(legacy)) {
        removePair(GRC_LEGACY_AUTH_STORAGE_KEY);
      }
    },
  };
}
