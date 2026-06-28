
import { Download, Link2, TimerReset } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getCommitteeAutomation } from '../lib/automationApi';
import { exportRows } from '../lib/exportUtils';
import { useI18n } from '../i18n/I18nContext';
import { AutomationAlertPanel } from '../components/v190/AutomationAlertPanel';

const tone = (signal: string) => signal === 'overdue' ? 'danger' : signal === 'due_soon' || signal === 'needs_project_or_evidence' ? 'warning' : signal === 'closed' ? 'good' : 'neutral';

export function CommitteeActionAutomationCenter() {
  const { t, language } = useI18n();
  const decisions = useAsyncData(getCommitteeAutomation, []);
  const rows = decisions.data ?? [];

  return (
    <section className="page-section automation-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('committeeAuto.eyebrow')}</p>
          <h3>{t('committeeAuto.title')}</h3>
          <p className="section-subtitle">{t('committeeAuto.subtitle')}</p>
        </div>

      <AutomationAlertPanel context="committee" />
        <button className="primary-button" onClick={() => exportRows('committee_action_automation', rows as unknown as Record<string, unknown>[], 'csv')}><Download size={16} /> CSV</button>
      </div>
      <div className="stats-grid">
        <KpiTile label={t('committeeAuto.total')} value={rows.length} />
        <KpiTile label={t('committeeAuto.overdue')} value={rows.filter(r => r.automationSignal === 'overdue').length} tone="danger" />
        <KpiTile label={t('committeeAuto.dueSoon')} value={rows.filter(r => r.automationSignal === 'due_soon').length} tone="warning" />
        <KpiTile label={t('committeeAuto.needsLink')} value={rows.filter(r => r.automationSignal === 'needs_project_or_evidence').length} />
      </div>
      <ModernCard title={t('committeeAuto.queue')} subtitle={t('committeeAuto.queueHint')}>
        <DataState loading={decisions.loading} error={decisions.error} empty={!rows.length}>
          <div className="committee-action-grid">
            {rows.map(row => (
              <article className={`committee-action-card ${row.automationSignal}`} key={row.id}>
                <div className="automation-rule-head"><strong>{row.title}</strong><StatusPill tone={tone(row.automationSignal)}>{row.automationSignal}</StatusPill></div>
                <p>{row.decisionText}</p>
                <div className="automation-meta-row"><span>{row.committeeName}</span><span>{row.meetingDate}</span><span>{language === 'ar' ? row.departmentNameAr : row.departmentNameEn}</span></div>
                <div className="automation-meta-row"><span><TimerReset size={14} /> {row.dueDate ?? '-'}</span><span>{t('committeeAuto.owner')}: {language === 'ar' ? row.ownerNameAr : row.ownerNameEn}</span><span><Link2 size={14} /> {row.linkedProjectId ? t('committeeAuto.linked') : t('committeeAuto.notLinked')}</span></div>
              </article>
            ))}
          </div>
        </DataState>
      </ModernCard>
    </section>
  );
}
