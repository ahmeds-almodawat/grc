import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  isPatch83uCredentialGovernanceEnabled,
  PATCH83U_FRONTEND_CONTRACT_VERSION,
} from '../config/featureFlags';
import {
  createSupabaseAuthStorage,
  isSupabaseSessionUsable,
  supabaseAuthStorageKeyForUrl,
  supabaseProjectRefFromUrl,
} from './supabaseAuthStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const patch83uCredentialGovernanceEnabled = isPatch83uCredentialGovernanceEnabled();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseProjectRef = supabaseProjectRefFromUrl(supabaseUrl);
export const supabaseAuthStorageKey = supabaseAuthStorageKeyForUrl(supabaseUrl);

type GrcSupabaseGlobal = typeof globalThis & {
  __grcSupabaseClient__?: SupabaseClient;
  __grcSupabaseConfigKey__?: string;
};

function buildConfigKey(): string {
  const patch83uContract = patch83uCredentialGovernanceEnabled
    ? PATCH83U_FRONTEND_CONTRACT_VERSION
    : 'disabled';
  return `${supabaseUrl ?? 'missing-url'}:${supabaseAnonKey?.slice(0, 12) ?? 'missing-key'}:${patch83uContract}:${supabaseAuthStorageKey}:validated-storage-v1`;
}

function patch83uDataBoundaryFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!patch83uCredentialGovernanceEnabled) return globalThis.fetch(input, init);

  const requestUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  let pathname = '';
  try {
    pathname = new URL(requestUrl).pathname;
  } catch {
    // A malformed or non-HTTP request must not gain the compatibility header.
    return globalThis.fetch(input, init);
  }

  const isProtectedDataBoundary = pathname === '/rest/v1'
    || pathname.startsWith('/rest/v1/')
    || pathname === '/storage/v1'
    || pathname.startsWith('/storage/v1/');
  if (!isProtectedDataBoundary) return globalThis.fetch(input, init);

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  headers.set('x-patch83u-frontend-contract-version', PATCH83U_FRONTEND_CONTRACT_VERSION);
  return globalThis.fetch(input, { ...init, headers });
}

function createConfiguredSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  const grcGlobal = globalThis as GrcSupabaseGlobal;
  const configKey = buildConfigKey();
  let authStorage;
  try {
    authStorage = typeof globalThis.localStorage === 'undefined'
      ? undefined
      : createSupabaseAuthStorage({
          backingStorage: globalThis.localStorage,
          supabaseUrl,
        });
  } catch {
    authStorage = undefined;
  }

  if (grcGlobal.__grcSupabaseClient__ && grcGlobal.__grcSupabaseConfigKey__ === configKey) {
    return grcGlobal.__grcSupabaseClient__;
  }

  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: supabaseAuthStorageKey,
      storage: authStorage,
    },
    global: {
      fetch: patch83uDataBoundaryFetch,
      headers: {
        'X-Client-Info': 'grc-control-center',
      },
    },
  });

  grcGlobal.__grcSupabaseClient__ = client;
  grcGlobal.__grcSupabaseConfigKey__ = configKey;

  return client;
}

export const supabase = createConfiguredSupabaseClient();

export function isCurrentSupabaseSessionUsable(session: unknown): boolean {
  return isSupabaseSessionUsable(session, supabaseUrl);
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.');
  }
  return supabase;
}
