import { isSupabaseConfigured } from '../lib/supabase';

export function EmptySupabaseNotice() {
  if (isSupabaseConfigured) return null;

  return (
    <div className="notice-banner">
      <strong>Demo mode:</strong> Supabase is not configured yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
      <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code> to use live database data.
    </div>
  );
}
