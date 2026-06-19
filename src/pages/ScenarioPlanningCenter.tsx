import { Download, TriangleAlert } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getScenarioMatrix } from '../lib/enterpriseApi';
import { exportRows } from '../lib/exportUtils';
import { useI18n } from '../i18n/I18nContext';

const tone = (level: string) => level === 'critical' ? 'danger' : level === 'high' ? 'warning' : 'neutral';

export function ScenarioPlanningCenter() {
  const { t, language } = useI18n();
  const scenarios = useAsyncData(getScenarioMatrix, []);
  const rows = scenarios.data ?? [];

  return (
    <section className="page-section enterprise-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('scenario.eyebrow')}</p>
          <h3>{t('scenario.title')}</h3>
          <p className="section-subtitle">{t('scenario.subtitle')}</p>
        </div>
        <button className="primary-button" onClick={() => exportRows('risk_scenario_matrix', rows as unknown as Record<string, unknown>[], 'csv')}><Download size={16} /> CSV</button>
      </div>
      <div className="stats-grid">
        <KpiTile label={t('scenario.total')} value={rows.length} />
        <KpiTile label={t('scenario.critical')} value={rows.filter(r => r.exposureLevel === 'critical').length} tone="danger" />
        <KpiTile label={t('scenario.high')} value={rows.filter(r => r.exposureLevel === 'high').length} tone="warning" />
        <KpiTile label={t('scenario.avgExposure')} value={rows.length ? Math.round(rows.reduce((s, r) => s + r.exposureScore, 0) / rows.length) : 0} />
      </div>
      <ModernCard title={t('scenario.matrix')} subtitle={t('scenario.matrixHint')}>
        <DataState loading={scenarios.loading} error={scenarios.error} empty={!rows.length}>
          <div className="scenario-matrix-grid">
            {rows.map(scenario => (
              <article className={`scenario-card large ${scenario.exposureLevel}`} key={scenario.id}>
                <div className="scenario-head"><strong><TriangleAlert size={16} /> {language === 'ar' ? scenario.titleAr : scenario.titleEn}</strong><StatusPill tone={tone(scenario.exposureLevel)}>{scenario.exposureLevel}</StatusPill></div>
                <div className="scenario-score-line"><span>P {scenario.probability}</span><span>I {scenario.impact}</span><strong>{scenario.exposureScore}/25</strong></div>
                <p>{scenario.mitigationSummary}</p>
                <div className="scenario-triggers">{scenario.triggerIndicators?.map(trigger => <span key={trigger}>{trigger}</span>)}</div>
              </article>
            ))}
          </div>
        </DataState>
      </ModernCard>
    </section>
  );
}
