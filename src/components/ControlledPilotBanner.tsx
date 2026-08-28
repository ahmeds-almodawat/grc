import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export function ControlledPilotBanner({ compact = false, context = 'hospital' }: { compact?: boolean, context?: 'hospital' | 'internal' }) {
  const { t } = useI18n();

  if (context === 'internal') {
    return (
      <div className={`controlled-pilot-banner controlled-pilot-banner--internal ${compact ? 'controlled-pilot-banner--compact' : ''}`}>
        <AlertTriangle size={compact ? 14 : 17} />
        <strong>Internal readiness tool</strong>
        <span>Requires authorized review before operational reliance</span>
        <span>Evidence and signoff must be verified before operational use</span>
      </div>
    );
  }

  return (
    <div className={`controlled-pilot-banner ${compact ? 'controlled-pilot-banner--compact' : ''}`}>
      <ShieldCheck size={compact ? 14 : 17} />
      <strong>{t('pilot.hospitalWorkspace') || 'Hospital governance workspace'}</strong>
      <span>{t('pilot.controlledWorkspace') || 'Controlled operating workspace'}</span>
      <span>{t('pilot.readinessManaged') || 'Access and changes follow assigned roles'}</span>
    </div>
  );
}
