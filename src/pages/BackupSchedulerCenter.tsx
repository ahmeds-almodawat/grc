import { CalendarClock, DatabaseBackup, Play, RefreshCcw } from 'lucide-react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { getBackupScheduleReadiness, recordBackupPlanRun } from '../lib/enterpriseApi';
import { useI18n } from '../i18n/I18nContext';
import { useState } from 'react';
import { actionErrorMessage } from '../lib/privilegedAction';

const tone = (status: string) => status === 'healthy' ? 'good' : status === 'failed' || status === 'never_run' ? 'danger' : 'warning';

export function BackupSchedulerCenter() {
  const { t, language } = useI18n();
  const plans = useAsyncData(getBackupScheduleReadiness, []);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const rows = plans.data ?? [];

  async function markRun(planId: string) {
    setMessage('');
    setActionError('');
    try {
      const id = await recordBackupPlanRun(planId, 'completed');
      setMessage(`${t('backupScheduler.runRecorded')}: ${id}`);
      await plans.refresh();
    } catch (actionFailure) {
      setActionError(actionErrorMessage(actionFailure));
    }
  }

  return (
    <section className="page-section enterprise-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('backupScheduler.eyebrow')}</p>
          <h3>{t('backupScheduler.title')}</h3>
          <p className="section-subtitle">{t('backupScheduler.subtitle')}</p>
        </div>
        <button className="ghost-button" onClick={() => plans.refresh()}><RefreshCcw size={16} /> {t('common.refresh', 'Refresh')}</button>
      </div>
      {message && <div className="success-banner">{message}</div>}
      {actionError && <div className="notice-banner danger">{actionError}</div>}
      <div className="stats-grid">
        <KpiTile label={t('backupScheduler.totalPlans')} value={rows.length} />
        <KpiTile label={t('backupScheduler.neverRun')} value={rows.filter(r => r.readinessStatus === 'never_run').length} tone="danger" />
        <KpiTile label={t('backupScheduler.restoreDue')} value={rows.filter(r => r.readinessStatus === 'restore_test_due').length} tone="warning" />
        <KpiTile label={t('backupScheduler.healthy')} value={rows.filter(r => r.readinessStatus === 'healthy').length} tone="good" />
      </div>
      <ModernCard title={t('backupScheduler.plans')} subtitle={t('backupScheduler.plansHint')}>
        <DataState loading={plans.loading} error={plans.error} empty={!rows.length}>
          <div className="backup-plan-grid">
            {rows.map(plan => (
              <article className={`backup-plan-card ${plan.readinessStatus}`} key={plan.id}>
                <div className="backup-plan-head"><DatabaseBackup size={20} /><strong>{language === 'ar' ? plan.titleAr : plan.titleEn}</strong><StatusPill tone={tone(plan.readinessStatus)}>{plan.readinessStatus}</StatusPill></div>
                <p><CalendarClock size={14} /> {plan.frequency} · {t('backupScheduler.nextDue')}: {plan.nextDueAt ? new Date(plan.nextDueAt).toLocaleDateString() : '—'}</p>
                <div className="backup-plan-meta"><span>{t('backupScheduler.retention')}: {plan.retentionDays}</span><span>{t('backupScheduler.runs')}: {plan.runCount}</span><span>{plan.lastStatus ?? 'not run'}</span></div>
                <button className="ghost-button compact-button" onClick={() => markRun(plan.id)}><Play size={14} /> {t('backupScheduler.markRun')}</button>
              </article>
            ))}
          </div>
        </DataState>
      </ModernCard>
    </section>
  );
}
