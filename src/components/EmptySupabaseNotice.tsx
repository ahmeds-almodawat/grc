import { isSupabaseConfigured } from '../lib/supabase';
import { useI18n } from '../i18n/I18nContext';

export function EmptySupabaseNotice() {
  const { t } = useI18n();
  if (isSupabaseConfigured) return null;

  return (
    <div className="notice-banner">
      <strong>{t('dataConnection.required')}</strong> {t('dataConnection.unavailable')}{' '}
      <code>VITE_SUPABASE_URL</code> {t('dataConnection.and')} <code>VITE_SUPABASE_ANON_KEY</code>{' '}
      {t('dataConnection.configurationSuffix')} <code>.env</code>.
    </div>
  );
}
