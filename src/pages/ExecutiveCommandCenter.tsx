import { AlertTriangle, ArrowRight, DatabaseBackup, FileSearch, Landmark, ShieldAlert } from 'lucide-react';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { getCommandStream, getCommandSummary } from '../lib/commandCenterApi';
import { useI18n } from '../i18n/I18nContext';
import { isEmptyLiveObject } from '../lib/liveData';
import { AssuranceMapPanel } from '../components/v180/AssuranceMapPanel';
import { TraceabilityGapPanel } from '../components/v180/TraceabilityGapPanel';
import { ExecutiveGrcScorecard } from '../components/v190/ExecutiveGrcScorecard';
import { AutomationAlertPanel } from '../components/v190/AutomationAlertPanel';

export function ExecutiveCommandCenter() {
  const { t } = useI18n();
  const summary = useAsyncData(getCommandSummary, []);
  const stream = useAsyncData(getCommandStream, []);
  const data = isEmptyLiveObject(summary.data) ? null : summary.data;

  return (
    <section className="page-section command-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{t('command.eyebrow')}</p>
          <h3>{t('command.title')}</h3>
          <p className="section-subtitle">{t('command.subtitle')}</p>
        </div>
        <div className="command-hero-actions">
          {data?.backupHealth ? (
            <span className={`backup-pill ${data.backupHealth}`}><DatabaseBackup size={16} /> {t(`command.backup.${data.backupHealth}`)}</span>
          ) : null}
        </div>
      </div>

      <ExecutiveGrcScorecard context="command-center" />
      <AutomationAlertPanel context="command-center" />


      <DataState
        loading={summary.loading}
        error={summary.error}
        empty={!data}
        emptyTitle="Executive command summary is not available"
        emptyMessage="No live command-center summary is configured or visible for this account."
      >
        {data && (
          <div className="stats-grid command-stats">
            <div className="stat-card danger"><AlertTriangle size={20} /><div className="stat-value">{data.criticalNow}</div><div className="stat-label">{t('command.criticalNow')}</div></div>
            <div className="stat-card warning"><Landmark size={20} /><div className="stat-value">{data.pendingExecutiveDecisions}</div><div className="stat-label">{t('command.pendingDecisions')}</div></div>
            <div className="stat-card warning"><ShieldAlert size={20} /><div className="stat-value">{data.departmentPressure}</div><div className="stat-label">{t('command.pressureDepartments')}</div></div>
            <div className="stat-card"><FileSearch size={20} /><div className="stat-value">{data.searchIndexedRecords}</div><div className="stat-label">{t('command.indexedRecords')}</div></div>
            <div className="stat-card warning"><FileSearch size={20} /><div className="stat-value">{data.policyReviewDue}</div><div className="stat-label">{t('command.policyDue')}</div></div>
            <div className="stat-card success"><Landmark size={20} /><div className="stat-value">{data.releaseReadinessScore === null ? t('common.notConfigured') : `${data.releaseReadinessScore}%`}</div><div className="stat-label">{t('command.releaseScore')}</div></div>
          </div>
        )}
      </DataState>

      <AssuranceMapPanel />
      <TraceabilityGapPanel />

      <div className="two-column align-start command-layout">
        <div className="panel command-stream-panel">
          <div className="panel-header">
            <h4>{t('command.criticalStream')}</h4>
            <p>{t('command.criticalStreamHint')}</p>
          </div>
          <DataState
            loading={stream.loading}
            error={stream.error}
            empty={!stream.data?.length}
            emptyTitle="No critical command items"
            emptyMessage="No live item in your current scope requires executive or governance attention."
          >
            <div className="command-stream">
              {(stream.data ?? []).map(item => (
                <article className={`command-item ${item.riskLevel}`} key={item.id}>
                  <div className="command-item-main">
                    <div className="command-item-kicker">
                      <span>{item.itemType}</span>
                      <span className={`risk-pill ${item.riskLevel}`}>{item.riskLevel}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.reason}</p>
                    <div className="command-meta">
                      <span>{item.department}</span>
                      <span>{item.owner}</span>
                      <span>{item.dueDate ?? 'No due date'}</span>
                    </div>
                  </div>
                  <button className="ghost-button compact-button"><ArrowRight size={14} /> {t('common.actions')}</button>
                </article>
              ))}
            </div>
          </DataState>
        </div>

        <aside className="panel command-rules-panel">
          <div className="panel-header">
            <h4>{t('command.dailyRules')}</h4>
            <p>{t('command.dailyRulesHint')}</p>
          </div>
          <div className="rule-tile danger"><strong>{t('command.rule1')}</strong><span>{t('command.rule1Text')}</span></div>
          <div className="rule-tile warning"><strong>{t('command.rule2')}</strong><span>{t('command.rule2Text')}</span></div>
          <div className="rule-tile"><strong>{t('command.rule3')}</strong><span>{t('command.rule3Text')}</span></div>
          <div className="rule-tile success"><strong>{t('command.rule4')}</strong><span>{t('command.rule4Text')}</span></div>
        </aside>
      </div>
    </section>
  );
}
