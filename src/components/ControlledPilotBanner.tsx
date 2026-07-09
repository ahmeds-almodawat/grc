import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export function ControlledPilotBanner({ compact = false, context = 'hospital' }: { compact?: boolean, context?: 'hospital' | 'internal' }) {
  const { t } = useI18n();

  if (context === 'internal') {
    return (
      <div className={`controlled-pilot-banner ${compact ? 'controlled-pilot-banner--compact' : ''}`} style={{ background: 'rgba(254, 243, 199, 0.92)', border: '1px solid #fcd34d', color: '#b45309' }}>
        <AlertTriangle size={compact ? 14 : 17} />
        <strong style={{ color: '#92400e' }}>Internal readiness tool</strong>
        <span style={{ borderInlineStart: '1px solid #fcd34d' }}>Requires authorized review before operational reliance</span>
        <span style={{ borderInlineStart: '1px solid #fcd34d' }}>Evidence and signoff must be verified before operational use</span>
      </div>
    );
  }

  return (
    <div className={`controlled-pilot-banner ${compact ? 'controlled-pilot-banner--compact' : ''}`}>
      <ShieldCheck size={compact ? 14 : 17} />
      <strong>{t('pilot.hospitalWorkspace') || 'Hospital governance workspace'}</strong>
      <span>{t('pilot.controlledWorkspace') || 'Controlled operating workspace'}</span>
      <span>{t('pilot.readinessManaged') || 'Readiness status is managed by authorized administrators'}</span>
    </div>
  );
}
