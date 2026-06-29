import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

type GrcSupabaseGlobal = typeof globalThis & {
  __grcSupabaseClient__?: SupabaseClient;
  __grcSupabaseConfigKey__?: string;
};

function buildConfigKey(): string {
  return `${supabaseUrl ?? 'missing-url'}:${supabaseAnonKey?.slice(0, 12) ?? 'missing-key'}`;
}

function createConfiguredSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  const grcGlobal = globalThis as GrcSupabaseGlobal;
  const configKey = buildConfigKey();

  if (grcGlobal.__grcSupabaseClient__ && grcGlobal.__grcSupabaseConfigKey__ === configKey) {
    return grcGlobal.__grcSupabaseClient__;
  }

  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'grc-control-center-auth',
    },
    global: {
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

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.');
  }
  return supabase;
}
