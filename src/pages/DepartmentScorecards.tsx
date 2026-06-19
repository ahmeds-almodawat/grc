import { Download, ShieldCheck } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getDepartmentScorecards } from '../lib/enterpriseApi';
import { exportRows } from '../lib/exportUtils';
import { useI18n } from '../i18n/I18nContext';

const tone = (signal: string) => signal === 'critical' || signal === 'at_risk' ? 'danger' : signal === 'watch' ? 'warning' : 'good';

export function DepartmentScorecards() {
  const { t, language } = useI18n();
  const scorecards = useAsyncData(getDepartmentScorecards, []);
  const rows = scorecards.data ?? [];
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.controlScore, 0) / rows.length) : 0;

  return (
    <section className="page-section enterprise-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('scorecards.eyebrow')}</p>
          <h3>{t('scorecards.title')}</h3>
          <p className="section-subtitle">{t('scorecards.subtitle')}</p>
        </div>
        <button className="primary-button" onClick={() => exportRows('department_scorecards', rows as unknown as Record<string, unknown>[], 'csv')}><Download size={16} /> CSV</button>
      </div>

      <div className="stats-grid">
        <KpiTile label={t('scorecards.avgScore')} value={`${average}%`} tone={average < 65 ? 'danger' : average < 80 ? 'warning' : 'good'} />
        <KpiTile label={t('scorecards.criticalDepartments')} value={rows.filter(r => r.signal === 'critical').length} tone="danger" />
        <KpiTile label={t('scorecards.watchDepartments')} value={rows.filter(r => r.signal === 'watch' || r.signal === 'at_risk').length} tone="warning" />
        <KpiTile label={t('scorecards.totalDepartments')} value={rows.length} />
      </div>

      <ModernCard title={t('scorecards.controlMatrix')} subtitle={t('scorecards.controlMatrixHint')}>
        <DataState loading={scorecards.loading} error={scorecards.error} empty={!rows.length}>
          <div className="department-score-grid">
            {rows.map(row => (
              <article className={`department-scorecard expanded ${row.signal}`} key={row.departmentId}>
                <div className="scorecard-title-row">
                  <ShieldCheck size={20} />
                  <div><h4>{language === 'ar' ? row.departmentNameAr : row.departmentNameEn}</h4><p>{row.latestExecutiveNote || t('scorecards.noNote')}</p></div>
                </div>
                <div className="scorebar"><span style={{ width: `${row.controlScore}%` }} /></div>
                <div className="scorecard-metric-grid">
                  <strong>{row.controlScore}%</strong>
                  <StatusPill tone={tone(row.signal)}>{row.signal}</StatusPill>
                  <span>{t('scorecards.projects')}: {row.activeProjects}</span>
                  <span>{t('scorecards.tasks')}: {row.overdueTasks}</span>
                  <span>{t('scorecards.risks')}: {row.criticalRisks}</span>
                  <span>OVR: {row.openOvrs}</span>
                </div>
              </article>
            ))}
          </div>
        </DataState>
      </ModernCard>
    </section>
  );
}
