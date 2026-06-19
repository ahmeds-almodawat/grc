
import { Download, Gauge, TrendingUp } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getKriBreachRegister, getRiskAppetiteDashboard } from '../lib/automationApi';
import { exportRows } from '../lib/exportUtils';
import { useI18n } from '../i18n/I18nContext';

const appetiteTone = (status: string) => status === 'critical' ? 'danger' : status === 'warning' || status === 'watch' ? 'warning' : 'good';

export function RiskAppetiteKriCenter() {
  const { t, language } = useI18n();
  const appetite = useAsyncData(getRiskAppetiteDashboard, []);
  const breaches = useAsyncData(getKriBreachRegister, []);
  const appetiteRows = appetite.data ?? [];
  const breachRows = breaches.data ?? [];

  return (
    <section className="page-section automation-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('kri.eyebrow')}</p>
          <h3>{t('kri.title')}</h3>
          <p className="section-subtitle">{t('kri.subtitle')}</p>
        </div>
        <button className="primary-button" onClick={() => exportRows('risk_appetite_kri_breaches', [...appetiteRows, ...breachRows] as unknown as Record<string, unknown>[], 'csv')}><Download size={16} /> CSV</button>
      </div>

      <div className="stats-grid">
        <KpiTile label={t('kri.appetiteBreaches')} value={appetiteRows.filter(r => r.appetiteStatus !== 'normal').length} tone="danger" />
        <KpiTile label={t('kri.criticalKri')} value={breachRows.filter(r => r.breachLevel === 'critical').length} tone="danger" />
        <KpiTile label={t('kri.warningKri')} value={breachRows.filter(r => r.breachLevel === 'warning').length} tone="warning" />
        <KpiTile label={t('kri.watchKri')} value={breachRows.filter(r => r.breachLevel === 'watch').length} />
      </div>

      <ModernCard title={t('kri.appetiteDashboard')} subtitle={t('kri.appetiteDashboardHint')}>
        <DataState loading={appetite.loading} error={appetite.error} empty={!appetiteRows.length}>
          <div className="appetite-grid">
            {appetiteRows.map(row => (
              <article className={`appetite-card ${row.appetiteStatus}`} key={row.id}>
                <div className="automation-rule-head"><strong><Gauge size={16} /> {language === 'ar' ? row.titleAr : row.titleEn}</strong><StatusPill tone={appetiteTone(row.appetiteStatus)}>{row.appetiteStatus}</StatusPill></div>
                <div className="threshold-row"><span>{t('kri.maxResidual')}: <b>{row.maxResidualScore}</b></span><span>{t('kri.actualResidual')}: <b>{row.actualMaxResidualScore}</b></span></div>
                <div className="threshold-row"><span>{t('kri.criticalRisks')}: <b>{row.criticalOpenRisks}/{row.maxCriticalRisks}</b></span><span>{t('kri.highRisks')}: <b>{row.highOpenRisks}/{row.maxHighRisks}</b></span></div>
                <div className="appetite-bar"><span style={{ width: `${Math.min(100, (row.actualMaxResidualScore / 25) * 100)}%` }} /></div>
              </article>
            ))}
          </div>
        </DataState>
      </ModernCard>

      <ModernCard title={t('kri.breachRegister')} subtitle={t('kri.breachRegisterHint')}>
        <DataState loading={breaches.loading} error={breaches.error} empty={!breachRows.length}>
          <div className="table-card compact-table"><table><thead><tr><th>{t('kri.kri')}</th><th>{t('common.department')}</th><th>{t('kri.value')}</th><th>{t('common.status')}</th><th>{t('kri.owner')}</th></tr></thead><tbody>
            {breachRows.map(row => <tr key={row.id}><td><TrendingUp size={14} /> {language === 'ar' ? row.titleAr : row.titleEn}</td><td>{language === 'ar' ? row.departmentNameAr : row.departmentNameEn}</td><td>{row.value} {row.unitLabel}</td><td><StatusPill tone={appetiteTone(row.breachLevel)}>{row.breachLevel}</StatusPill></td><td>{language === 'ar' ? row.ownerNameAr : row.ownerNameEn}</td></tr>)}
          </tbody></table></div>
        </DataState>
      </ModernCard>
    </section>
  );
}
