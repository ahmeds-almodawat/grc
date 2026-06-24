import { isSupabaseConfigured } from '../lib/supabase';

export function EmptySupabaseNotice() {
  if (isSupabaseConfigured) return null;

  return (
    <div className="notice-banner">
      <strong>Data connection required:</strong> Supabase is not configured. Live counts and records are unavailable
      until <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> are set in <code>.env</code>.
    </div>
  );
}
