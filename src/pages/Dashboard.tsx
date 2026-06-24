import { DataState } from '../components/DataState';
import { ControlledPilotBanner } from '../components/ControlledPilotBanner';
import { EmptySupabaseNotice } from '../components/EmptySupabaseNotice';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { useI18n } from '../i18n/I18nContext';
import { formatDate, humanize } from '../lib/format';
import { getCriticalAttentionItems, getExecutiveSummary, getManagementControlSummary, getOvrRiskIndicatorSummary } from '../lib/grcApi';
import { useAsyncData } from '../hooks/useAsyncData';
import { isEmptyLiveObject } from '../lib/liveData';
import type { CriticalAttentionItem } from '../types/domain';

export function Dashboard() {
  const { t } = useI18n();
  const summary = useAsyncData(getExecutiveSummary, []);
  const attention = useAsyncData(getCriticalAttentionItems, []);
  const management = useAsyncData(getManagementControlSummary, []);
  const ovrRisk = useAsyncData(getOvrRiskIndicatorSummary, []);
  const summaryData = isEmptyLiveObject(summary.data) ? null : summary.data;
  const managementData = isEmptyLiveObject(management.data) ? null : management.data;
  const ovrRiskData = isEmptyLiveObject(ovrRisk.data) ? null : ovrRisk.data;

  return (
    <section className="page-section">
      <ControlledPilotBanner />
      <EmptySupabaseNotice />
      <ModuleHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      />

      <DataState
        loading={summary.loading}
        error={summary.error}
        empty={!summaryData}
        emptyTitle="Executive indicators are not configured"
        emptyMessage="Apply the required Supabase views and sign in with an authorized role to load live management counts."
      >
        {summaryData ? (
          <div className="stats-grid">
            <StatCard label={t('dashboard.activeProjects')} value={summaryData.activeProjects} />
            <StatCard label={t('dashboard.overdueProjects')} value={summaryData.overdueProjects} tone="danger" />
            <StatCard label={t('dashboard.overdueMilestones')} value={summaryData.overdueMilestones} tone="warning" />
            <StatCard label={t('dashboard.overdueTasks')} value={summaryData.overdueTasks} tone="warning" />
            <StatCard label={t('dashboard.criticalOpenRisks')} value={summaryData.criticalOpenRisks} tone="danger" />
            <StatCard label={t('dashboard.compliance30')} value={summaryData.complianceExpiring30Days} tone="warning" />
            <StatCard label={t('dashboard.overdueAudit')} value={summaryData.overdueAuditFindings} tone="danger" />
            <StatCard label={t('dashboard.pendingApprovals')} value={summaryData.pendingApprovals} />
            <StatCard label={t('dashboard.pendingEvidence')} value={summaryData.pendingEvidenceReviews} />
          </div>
        ) : null}
      </DataState>

      <DataState
        loading={management.loading}
        error={management.error}
        empty={!managementData}
        emptyTitle="Management controls are not available"
        emptyMessage="No live escalation or delay-control summary is available for this role and environment."
      >
        {managementData ? (
          <div className="panel">
            <div className="panel-header">
              <h4>{t('dashboard.managementTitle')}</h4>
              <p>{t('dashboard.managementHint')}</p>
            </div>
            <div className="card-grid">
              <div className="mini-card"><span>{t('dashboard.openEscalations')}</span><strong>{managementData.open_escalations}</strong></div>
              <div className="mini-card"><span>{t('dashboard.executiveEscalations')}</span><strong>{managementData.executive_escalations}</strong></div>
              <div className="mini-card"><span>{t('dashboard.criticalEscalations')}</span><strong>{managementData.critical_escalations}</strong></div>
              <div className="mini-card"><span>{t('dashboard.missingDelayReasons')}</span><strong>{managementData.missing_delay_reasons}</strong></div>
            </div>
          </div>
        ) : null}
      </DataState>

      <DataState
        loading={ovrRisk.loading}
        error={ovrRisk.error}
        empty={!ovrRiskData}
        emptyTitle="OVR risk indicators are not available"
        emptyMessage="Risk signals will appear after authorized OVR records are available and the indicator views are applied."
      >
        {ovrRiskData ? (
          <div className="panel">
            <div className="panel-header">
              <h4>{t('dashboard.ovrRiskTitle')}</h4>
              <p>{t('dashboard.ovrRiskHint')}</p>
            </div>
            <div className="card-grid">
              <div className="mini-card"><span>{t('dashboard.weightedScore30')}</span><strong>{ovrRiskData.weighted_score_30d}</strong></div>
              <div className="mini-card"><span>{t('dashboard.majorSentinel90')}</span><strong>{ovrRiskData.major_or_sentinel_ovrs_90d}</strong></div>
              <div className="mini-card"><span>{t('dashboard.repeatedAlerts')}</span><strong>{ovrRiskData.repeated_category_alerts_30d}</strong></div>
              <div className="mini-card"><span>{t('dashboard.signal')}</span><strong className={`risk-pill ${ovrRiskData.overall_signal_level}`}>{t(`risk.${ovrRiskData.overall_signal_level}`)}</strong></div>
            </div>
          </div>
        ) : null}
      </DataState>

      <div className="panel">
        <div className="panel-header">
          <h4>{t('dashboard.attentionTitle')}</h4>
          <p>{t('dashboard.attentionHint')}</p>
        </div>
        <DataState
          loading={attention.loading}
          error={attention.error}
          empty={!attention.data?.length}
          emptyTitle="No critical attention items"
          emptyMessage="No live items in your current scope require executive attention."
        >
          <EntityTable<CriticalAttentionItem>
            rows={attention.data || []}
            getRowKey={row => `${row.itemType}-${row.id}`}
            columns={[
              { key: 'type', header: t('dashboard.type'), render: row => humanize(row.itemType) },
              { key: 'item', header: t('dashboard.item'), render: row => row.title },
              { key: 'department', header: t('common.department'), render: row => row.department },
              { key: 'owner', header: t('common.owner'), render: row => row.owner },
              { key: 'due', header: t('common.dueDate'), render: row => formatDate(row.dueDate) },
              { key: 'status', header: t('common.status'), render: row => <StatusBadge status={humanize(row.status)} /> },
              { key: 'risk', header: t('common.risk'), render: row => <span className={`risk-pill ${row.riskLevel}`}>{t(`risk.${row.riskLevel}`)}</span> },
              { key: 'progress', header: t('dashboard.progress'), render: row => row.progress === null ? '—' : `${row.progress}%` }
            ]}
          />
        </DataState>
      </div>
    </section>
  );
}
