import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export function ControlledPilotBanner({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();

  return (
    <div className={`controlled-pilot-banner ${compact ? 'controlled-pilot-banner--compact' : ''}`}>
      <ShieldCheck size={compact ? 14 : 17} />
      <strong>{t('pilot.controlled')}</strong>
      <span>{t('pilot.syntheticOnly')}</span>
      <span>{t('pilot.notProduction')}</span>
    </div>
  );
}
