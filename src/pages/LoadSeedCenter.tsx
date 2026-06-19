import { DatabaseZap, RefreshCcw } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getLoadTestSeedStatus } from '../lib/stabilizationApi';

function signalTone(signal: string): 'good' | 'warning' | 'danger' | 'neutral' {
  if (signal === 'healthy') return 'good';
  if (signal === 'watch' || signal === 'planned') return 'warning';
  if (signal === 'blocked') return 'danger';
  return 'neutral';
}

export function LoadSeedCenter() {
  const { t } = useI18n();
  const { data, loading, error, refresh } = useAsyncData(getLoadTestSeedStatus, []);
  const users = data?.reduce((sum, batch) => sum + batch.targetUsers, 0) ?? 0;
  const tasks = data?.reduce((sum, batch) => sum + batch.targetTasks, 0) ?? 0;
  const ovr = data?.reduce((sum, batch) => sum + batch.targetOvrReports, 0) ?? 0;
  const rows = data?.reduce((sum, batch) => sum + batch.targetTotalRows, 0) ?? 0;

  return (
    <div className="page-stack ultra-stabilization-page">
      <section className="hero-panel modern-hero">
        <div>
          <p className="eyebrow">{t('loadSeed.eyebrow')}</p>
          <h1>{t('loadSeed.title')}</h1>
          <p>{t('loadSeed.subtitle')}</p>
        </div>
        <button className="ghost-button" onClick={refresh}><RefreshCcw size={16} />{t('common.refresh', 'Refresh')}</button>
      </section>

      <DataState loading={loading} error={error} empty={!data?.length}>
        {data && (
          <>
            <div className="modern-grid modern-grid--four">
              <KpiTile label={t('loadSeed.targetUsers')} value={users.toLocaleString()} />
              <KpiTile label={t('loadSeed.targetTasks')} value={tasks.toLocaleString()} />
              <KpiTile label={t('loadSeed.targetOvr')} value={ovr.toLocaleString()} />
              <KpiTile label={t('loadSeed.targetRows')} value={rows.toLocaleString()} tone="warning" />
            </div>

            <ModernCard title={t('loadSeed.batches')} subtitle={t('loadSeed.batchesHint')}>
              <div className="seed-grid">
                {data.map(batch => (
                  <article className="seed-card" key={batch.id}>
                    <div className="seed-card__top">
                      <div className="seed-icon"><DatabaseZap size={18} /></div>
                      <div>
                        <strong>{batch.title}</strong>
                        <span>{batch.batchCode}</span>
                      </div>
                      <StatusPill tone={signalTone(batch.performanceSignal)}>{batch.performanceSignal}</StatusPill>
                    </div>
                    <div className="seed-metrics">
                      <span>{t('loadSeed.departments')}: <strong>{batch.targetDepartments}</strong></span>
                      <span>{t('loadSeed.users')}: <strong>{batch.targetUsers.toLocaleString()}</strong></span>
                      <span>{t('loadSeed.projects')}: <strong>{batch.targetProjects}</strong></span>
                      <span>{t('loadSeed.tasks')}: <strong>{batch.targetTasks.toLocaleString()}</strong></span>
                      <span>{t('loadSeed.ovr')}: <strong>{batch.targetOvrReports}</strong></span>
                      <span>{t('loadSeed.evidence')}: <strong>{batch.targetEvidenceFiles.toLocaleString()}</strong></span>
                    </div>
                    <div className="seed-footer">
                      <StatusPill tone={signalTone(batch.status)}>{batch.status}</StatusPill>
                      {batch.durationMs && <span>{batch.durationMs}ms</span>}
                    </div>
                    {batch.performanceNote && <small>{batch.performanceNote}</small>}
                  </article>
                ))}
              </div>
            </ModernCard>
          </>
        )}
      </DataState>
    </div>
  );
}
