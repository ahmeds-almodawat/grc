import { Languages, RefreshCcw } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import { getTranslationCoverage } from '../lib/stabilizationApi';

function statusTone(status: string): 'good' | 'warning' | 'danger' | 'neutral' {
  if (status === 'complete') return 'good';
  if (['missing_ar', 'missing_en', 'blocked'].includes(status)) return 'danger';
  if (['needs_review', 'needs_rtl_review'].includes(status)) return 'warning';
  return 'neutral';
}

export function TranslationCoverageCenter() {
  const { t } = useI18n();
  const { data, loading, error, refresh } = useAsyncData(getTranslationCoverage, []);
  const avg = data?.length ? Math.round(data.reduce((sum, item) => sum + item.coveragePercent, 0) / data.length) : 0;
  const missingAr = data?.reduce((sum, item) => sum + item.missingArCount, 0) ?? 0;
  const missingEn = data?.reduce((sum, item) => sum + item.missingEnCount, 0) ?? 0;
  const rtlPending = data?.filter(item => !item.rtlChecked).length ?? 0;

  return (
    <div className="page-stack ultra-stabilization-page">
      <section className="hero-panel modern-hero">
        <div>
          <p className="eyebrow">{t('translation.eyebrow')}</p>
          <h1>{t('translation.title')}</h1>
          <p>{t('translation.subtitle')}</p>
        </div>
        <button className="ghost-button" onClick={refresh}><RefreshCcw size={16} />{t('common.refresh', 'Refresh')}</button>
      </section>

      <DataState loading={loading} error={error} empty={!data?.length}>
        {data && (
          <>
            <div className="modern-grid modern-grid--four">
              <KpiTile label={t('translation.avgCoverage')} value={`${avg}%`} tone={avg >= 95 ? 'good' : avg >= 85 ? 'warning' : 'danger'} />
              <KpiTile label={t('translation.missingArabic')} value={missingAr} tone={missingAr ? 'danger' : 'good'} />
              <KpiTile label={t('translation.missingEnglish')} value={missingEn} tone={missingEn ? 'danger' : 'good'} />
              <KpiTile label={t('translation.rtlPending')} value={rtlPending} tone={rtlPending ? 'warning' : 'good'} />
            </div>

            <ModernCard title={t('translation.coverageTable')} subtitle={t('translation.coverageHint')}>
              <div className="coverage-list">
                {data.map(row => (
                  <div className="coverage-row" key={row.id}>
                    <div className="coverage-icon"><Languages size={17} /></div>
                    <div className="coverage-main">
                      <div className="coverage-title">
                        <strong>{row.screenName}</strong>
                        <StatusPill tone={statusTone(row.computedStatus)}>{row.computedStatus}</StatusPill>
                      </div>
                      <span>{row.moduleKey} · {row.labelGroup}</span>
                      <div className="progress-bar"><span style={{ width: `${row.coveragePercent}%` }} /></div>
                      {row.reviewerNote && <small>{row.reviewerNote}</small>}
                    </div>
                    <div className="coverage-stats">
                      <strong>{row.coveragePercent}%</strong>
                      <span>AR -{row.missingArCount}</span>
                      <span>EN -{row.missingEnCount}</span>
                      <span>{row.rtlChecked ? t('translation.rtlDone') : t('translation.rtlNeeded')}</span>
                    </div>
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
