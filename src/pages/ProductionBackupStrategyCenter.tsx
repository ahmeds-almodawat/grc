import { ArchiveRestore, RefreshCcw, ShieldAlert } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getBackupStrategies, getRestoreVerifications } from '../lib/stabilizationApi';

function tone(signal: string): 'good' | 'warning' | 'danger' | 'neutral' {
  if (['ok', 'verified', 'passed', 'active'].includes(signal)) return 'good';
  if (['restore_test_needed', 'needs_work', 'planned', 'draft'].includes(signal)) return 'warning';
  if (['overdue', 'not_active', 'failed', 'blocked'].includes(signal)) return 'danger';
  return 'neutral';
}

export function ProductionBackupStrategyCenter() {
  const { t } = useI18n();
  const strategies = useAsyncData(getBackupStrategies, []);
  const restore = useAsyncData(getRestoreVerifications, []);

  const refresh = async () => {
    await Promise.all([strategies.refresh(), restore.refresh()]);
  };

  const data = strategies.data ?? [];
  const restoreRows = restore.data ?? [];

  return (
    <div className="page-stack ultra-stabilization-page">
      <section className="hero-panel modern-hero">
        <div>
          <p className="eyebrow">{t('backupStrategy.eyebrow')}</p>
          <h1>{t('backupStrategy.title')}</h1>
          <p>{t('backupStrategy.subtitle')}</p>
        </div>
        <button className="ghost-button" onClick={refresh}><RefreshCcw size={16} />{t('common.refresh', 'Refresh')}</button>
      </section>

      <DataState loading={strategies.loading || restore.loading} error={strategies.error ?? restore.error} empty={!data.length && !restoreRows.length}>
        <>
          <div className="modern-grid modern-grid--four">
            <KpiTile label={t('backupStrategy.strategies')} value={data.length} />
            <KpiTile label={t('backupStrategy.notActive')} value={data.filter(item => item.backupSignal === 'not_active').length} tone="danger" />
            <KpiTile label={t('backupStrategy.restoreNeeded')} value={data.filter(item => item.backupSignal === 'restore_test_needed').length} tone="warning" />
            <KpiTile label={t('backupStrategy.restoreRuns')} value={restoreRows.length} />
          </div>

          <div className="modern-grid modern-grid--two">
            <ModernCard title={t('backupStrategy.strategyRegister')} subtitle={t('backupStrategy.strategyHint')}>
              <div className="ultra-list">
                {data.map(strategy => (
                  <div className="ultra-list-row" key={strategy.id}>
                    <div className="ultra-row-icon"><ShieldAlert size={17} /></div>
                    <div className="ultra-row-main">
                      <strong>{strategy.title}</strong>
                      <span>{strategy.strategyCode} · {strategy.backupType} · {strategy.frequency}</span>
                      <small>{strategy.notes}</small>
                    </div>
                    <div className="ultra-row-actions">
                      <StatusPill tone={tone(strategy.backupSignal)}>{strategy.backupSignal}</StatusPill>
                      <StatusPill tone={tone(strategy.status)}>{strategy.status}</StatusPill>
                    </div>
                  </div>
                ))}
              </div>
            </ModernCard>

            <ModernCard title={t('backupStrategy.restoreRegister')} subtitle={t('backupStrategy.restoreHint')}>
              <div className="ultra-list">
                {restoreRows.map(row => (
                  <div className="ultra-list-row" key={row.id}>
                    <div className="ultra-row-icon"><ArchiveRestore size={17} /></div>
                    <div className="ultra-row-main">
                      <strong>{row.scenarioName}</strong>
                      <span>{row.verificationCode} · {row.strategyCode ?? t('common.none', 'None')}</span>
                      <small>{row.evidenceNote ?? row.failureNote ?? '—'}</small>
                    </div>
                    <div className="ultra-row-actions">
                      <StatusPill tone={tone(row.verificationSignal)}>{row.verificationSignal}</StatusPill>
                      <StatusPill tone={tone(row.status)}>{row.status}</StatusPill>
                    </div>
                  </div>
                ))}
              </div>
            </ModernCard>
          </div>
        </>
      </DataState>
    </div>
  );
}
