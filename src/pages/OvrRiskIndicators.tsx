import { AlertTriangle, Activity, Repeat2, ShieldAlert } from 'lucide-react';
import { DataState } from '../components/DataState';
import { EmptySupabaseNotice } from '../components/EmptySupabaseNotice';
import { EntityTable } from '../components/EntityTable';
import { ModuleHeader } from '../components/ModuleHeader';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { getOvrRepeatedCategoryAlerts, getOvrRiskIndicatorsByDepartment, getOvrRiskIndicatorSummary } from '../lib/grcApi';
import { humanize } from '../lib/format';
import { useI18n } from '../i18n/I18nContext';
import type { OvrRepeatedCategoryAlert, OvrRiskDepartmentIndicator } from '../types/domain';

function signalTone(level: string): 'normal' | 'warning' | 'danger' | 'success' {
  if (level === 'critical' || level === 'high') return 'danger';
  if (level === 'medium') return 'warning';
  if (level === 'low') return 'success';
  return 'normal';
}

export function OvrRiskIndicators() {
  const { t } = useI18n();
  const summary = useAsyncData(getOvrRiskIndicatorSummary, []);
  const departments = useAsyncData(getOvrRiskIndicatorsByDepartment, []);
  const repeated = useAsyncData(getOvrRepeatedCategoryAlerts, []);
  const summaryRow = summary.data;

  return (
    <section className="page-section">
      <EmptySupabaseNotice />
      <ModuleHeader
        eyebrow={t('ovrRisk.eyebrow')}
        title={t('ovrRisk.title')}
        subtitle={t('ovrRisk.subtitle')}
      />

      <DataState loading={summary.loading} error={summary.error} empty={!summaryRow}>
        {summaryRow ? (
          <div className="stats-grid">
            <StatCard label={t('ovrRisk.total30')} value={summaryRow.total_ovrs_30d} />
            <StatCard label={t('ovrRisk.weighted30')} value={summaryRow.weighted_score_30d} tone={signalTone(summaryRow.overall_signal_level)} />
            <StatCard label={t('ovrRisk.major90')} value={summaryRow.major_or_sentinel_ovrs_90d} tone="danger" />
            <StatCard label={t('ovrRisk.repeated30')} value={summaryRow.repeated_category_alerts_30d} tone="warning" />
            <StatCard label={t('ovrRisk.overdueActions')} value={summaryRow.overdue_corrective_actions} tone="danger" />
            <StatCard label={t('ovrRisk.openOvr')} value={summaryRow.open_ovrs} tone="warning" />
          </div>
        ) : null}
      </DataState>

      <div className="panel ovr-risk-explainer">
        <div className="panel-header">
          <h4><Activity size={18} /> {t('ovrRisk.logicTitle')}</h4>
          <p>{t('ovrRisk.logicText')}</p>
        </div>
        <div className="module-grid">
          <div className="module-card danger"><strong><ShieldAlert size={18} /> {t('ovrRisk.signalSeverity')}</strong><span>{t('ovrRisk.signalSeverityText')}</span></div>
          <div className="module-card warning"><strong><Repeat2 size={18} /> {t('ovrRisk.signalRecurrence')}</strong><span>{t('ovrRisk.signalRecurrenceText')}</span></div>
          <div className="module-card warning"><strong><AlertTriangle size={18} /> {t('ovrRisk.signalDelay')}</strong><span>{t('ovrRisk.signalDelayText')}</span></div>
          <div className="module-card"><strong>{t('ovrRisk.signalDepartment')}</strong><span>{t('ovrRisk.signalDepartmentText')}</span></div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>{t('ovrRisk.departmentTable')}</h4>
          <p>{t('ovrRisk.departmentHint')}</p>
        </div>
        <DataState loading={departments.loading} error={departments.error} empty={!departments.data?.length}>
          <EntityTable<OvrRiskDepartmentIndicator>
            rows={departments.data || []}
            getRowKey={row => row.department_id || 'company-wide'}
            columns={[
              { key: 'department', header: t('common.department'), render: row => <strong>{row.department_name}</strong> },
              { key: 'count30', header: t('ovrRisk.ovrs30'), render: row => row.ovr_count_30d },
              { key: 'score30', header: t('ovrRisk.score30'), render: row => row.weighted_score_30d },
              { key: 'major90', header: t('ovrRisk.major90Short'), render: row => row.major_or_sentinel_ovrs_90d || '0' },
              { key: 'repeated', header: t('ovrRisk.repeatedCategories'), render: row => row.repeated_categories || '—' },
              { key: 'overdue', header: t('ovrRisk.overdueActionsShort'), render: row => row.overdue_corrective_actions ? <span className="danger-text">{row.overdue_corrective_actions}</span> : '0' },
              { key: 'closure', header: t('ovrRisk.avgClosure'), render: row => row.avg_closure_days === null ? '—' : `${row.avg_closure_days}d` },
              { key: 'signal', header: t('ovrRisk.signal'), render: row => <span className={`risk-pill ${row.risk_signal_level}`}>{humanize(row.risk_signal_level)}</span> }
            ]}
          />
        </DataState>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>{t('ovrRisk.repeatAlerts')}</h4>
          <p>{t('ovrRisk.repeatHint')}</p>
        </div>
        <DataState loading={repeated.loading} error={repeated.error} empty={!repeated.data?.length}>
          <EntityTable<OvrRepeatedCategoryAlert>
            rows={repeated.data || []}
            getRowKey={row => `${row.department_id || 'company'}-${row.occurrence_category}`}
            columns={[
              { key: 'department', header: t('common.department'), render: row => row.department_name },
              { key: 'category', header: t('ovrRisk.category'), render: row => humanize(row.occurrence_category) },
              { key: 'count', header: t('ovrRisk.count30'), render: row => row.category_count_30d },
              { key: 'maxSeverity', header: t('ovrRisk.maxSeverity'), render: row => <StatusBadge status={humanize(row.max_severity_level)} /> },
              { key: 'signal', header: t('ovrRisk.signal'), render: row => <span className={`risk-pill ${row.alert_level}`}>{humanize(row.alert_level)}</span> }
            ]}
          />
        </DataState>
      </div>
    </section>
  );
}
