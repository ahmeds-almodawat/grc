import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as configuredSupabase } from './supabase';

const offlineError = new Error(
  'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to use live data.'
);

function createOfflineQuery(): any {
  const result = { data: null, error: offlineError };
  const query: any = {
    select: () => query,
    insert: () => query,
    update: () => query,
    upsert: () => query,
    delete: () => query,
    eq: () => query,
    neq: () => query,
    gt: () => query,
    gte: () => query,
    lt: () => query,
    lte: () => query,
    is: () => query,
    in: () => query,
    contains: () => query,
    containedBy: () => query,
    rangeGt: () => query,
    rangeGte: () => query,
    rangeLt: () => query,
    rangeLte: () => query,
    rangeAdjacent: () => query,
    overlaps: () => query,
    textSearch: () => query,
    match: () => query,
    not: () => query,
    or: () => query,
    filter: () => query,
    order: () => query,
    limit: () => query,
    range: () => query,
    abortSignal: () => query,
    single: async () => result,
    maybeSingle: async () => result,
    csv: async () => null,
    geojson: async () => null,
    explain: async () => result,
    rollback: () => query,
    returns: () => query,
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (reason: unknown) => unknown) => Promise.resolve(result).catch(reject),
    finally: (onFinally?: () => void) => Promise.resolve(result).finally(onFinally)
  };
  return query;
}

const offlineSupabase = {
  from: () => createOfflineQuery(),
  rpc: () => createOfflineQuery(),
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: offlineError }),
      download: async () => ({ data: null, error: offlineError }),
      remove: async () => ({ data: null, error: offlineError }),
      list: async () => ({ data: null, error: offlineError }),
      getPublicUrl: () => ({ data: { publicUrl: '' } })
    })
  },
  auth: {
    getUser: async () => ({ data: { user: null }, error: offlineError }),
    getSession: async () => ({ data: { session: null }, error: offlineError }),
    signOut: async () => ({ error: null })
  }
} as unknown as SupabaseClient;

// Some newer patch files expect a non-null `supabase` export from `./supabaseClient`.
// The original starter uses `./supabase` where the client can be null in demo mode.
// This bridge keeps TypeScript happy and allows emptyRows/demo data to render safely
// when Supabase environment variables are not configured.
export const supabase = (configuredSupabase ?? offlineSupabase) as SupabaseClient;
export const isSupabaseLive = Boolean(configuredSupabase);
