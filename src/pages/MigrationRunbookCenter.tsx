import { ClipboardList, RefreshCcw } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getMigrationRunbook } from '../lib/stabilizationApi';

function tone(status: string): 'good' | 'warning' | 'danger' | 'neutral' {
  if (status === 'verified') return 'good';
  if (status === 'warning' || status === 'pending') return 'warning';
  if (status === 'blocked') return 'danger';
  return 'neutral';
}

export function MigrationRunbookCenter() {
  const { t } = useI18n();
  const { data, loading, error, refresh } = useAsyncData(getMigrationRunbook, []);
  const verified = data?.filter(item => item.status === 'verified').length ?? 0;
  const pending = data?.filter(item => item.status === 'pending').length ?? 0;
  const blocked = data?.filter(item => item.status === 'blocked').length ?? 0;

  return (
    <div className="page-stack ultra-stabilization-page">
      <section className="hero-panel modern-hero">
        <div>
          <p className="eyebrow">{t('migrationRunbook.eyebrow')}</p>
          <h1>{t('migrationRunbook.title')}</h1>
          <p>{t('migrationRunbook.subtitle')}</p>
        </div>
        <button className="ghost-button" onClick={refresh}><RefreshCcw size={16} />{t('common.refresh', 'Refresh')}</button>
      </section>

      <DataState loading={loading} error={error} empty={!data?.length}>
        {data && (
          <>
            <div className="modern-grid modern-grid--four">
              <KpiTile label={t('migrationRunbook.total')} value={data.length} />
              <KpiTile label={t('migrationRunbook.verified')} value={verified} tone="good" />
              <KpiTile label={t('migrationRunbook.pending')} value={pending} tone="warning" />
              <KpiTile label={t('migrationRunbook.blocked')} value={blocked} tone={blocked ? 'danger' : 'good'} />
            </div>

            <ModernCard title={t('migrationRunbook.runbook')} subtitle={t('migrationRunbook.runbookHint')}>
              <div className="migration-timeline">
                {data.map(item => (
                  <div className="migration-step" key={item.id}>
                    <div className="migration-seq">{item.sequenceNo}</div>
                    <div className="migration-body">
                      <div className="migration-title">
                        <strong>{item.migrationFile}</strong>
                        <StatusPill tone={tone(item.status)}>{item.status}</StatusPill>
                      </div>
                      <span>{item.releaseTag} · {item.purpose}</span>
                      {item.verificationQuery && <code>{item.verificationQuery}</code>}
                      {item.expectedResult && <small>{item.expectedResult}</small>}
                    </div>
                    <div className="migration-icon"><ClipboardList size={17} /></div>
                  </div>
                ))}
              </div>
            </ModernCard>
          </>
        )}
      </DataState>
    </div>
  );
}
