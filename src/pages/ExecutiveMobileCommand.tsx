import { BellRing, CheckCircle2, ChevronRight, ShieldAlert } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { getCommandStream, getCommandSummary } from '../lib/commandCenterApi';
import { useI18n } from '../i18n/I18nContext';
import { isEmptyLiveObject } from '../lib/liveData';

export function ExecutiveMobileCommand() {
  const { t } = useI18n();
  const summary = useAsyncData(getCommandSummary, []);
  const stream = useAsyncData(getCommandStream, []);
  const data = isEmptyLiveObject(summary.data) ? null : summary.data;
  return (
    <section className="page-section mobile-command-page">
      <div className="mobile-command-hero">
        <p>{t('mobileCommand.eyebrow')}</p>
        <h3>{t('mobileCommand.title')}</h3>
        <span>{new Date().toLocaleDateString()}</span>
      </div>
      <DataState
        loading={summary.loading}
        error={summary.error}
        empty={!data}
        emptyTitle="Mobile command summary is not available"
        emptyMessage="No live executive summary is configured or visible for this account."
      >
        {data && <div className="mobile-kpi-strip"><div><strong>{data.criticalNow}</strong><span>{t('command.criticalNow')}</span></div><div><strong>{data.pendingExecutiveDecisions}</strong><span>{t('command.pendingDecisions')}</span></div><div><strong>{data.departmentPressure}</strong><span>{t('command.pressureDepartments')}</span></div></div>}
      </DataState>
      <div className="mobile-action-card"><BellRing size={18} /><div><strong>{t('mobileCommand.dailyFocus')}</strong><p>{t('mobileCommand.dailyFocusText')}</p></div><ChevronRight size={18} /></div>
      <DataState
        loading={stream.loading}
        error={stream.error}
        empty={!stream.data?.length}
        emptyTitle="No command items"
        emptyMessage="No live items in your scope currently require executive follow-up."
      >
        <div className="mobile-command-feed">
          {(stream.data ?? []).slice(0, 8).map(item => (
            <article className={`mobile-command-item ${item.riskLevel}`} key={item.id}>
              <div><ShieldAlert size={18} /><strong>{item.title}</strong></div>
              <p>{item.reason}</p>
              <div className="mobile-command-meta"><StatusBadge status={item.status} /><span>{item.department}</span><span>{item.dueDate ?? '—'}</span></div>
            </article>
          ))}
        </div>
      </DataState>
      <div className="mobile-done-rules"><CheckCircle2 size={18} /><span>{t('mobileCommand.rule')}</span></div>
    </section>
  );
}
