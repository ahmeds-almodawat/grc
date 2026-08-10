import { useMemo, useState } from 'react';
import type { PageKey } from '../components/Layout';
import { ControlledPilotBanner } from '../components/ControlledPilotBanner';
import { EmptySupabaseNotice } from '../components/EmptySupabaseNotice';
import { ModuleHeader } from '../components/ModuleHeader';
import {
  DashboardFilters,
  DashboardMetricCard,
  DashboardSection,
  DashboardWidgetState,
  PortfolioGantt,
  PrivacySafeTrend,
} from '../components/dashboard/GovernedDashboard';
import {
  DEFAULT_DASHBOARD_FILTERS,
  metricBandLabel,
  projectInPeriod,
  projectMatchesStatus,
  readDashboardFilters,
  writeDashboardFilters,
} from '../dashboard/dashboardFramework';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import {
  getApprovals,
  getAuditFindings,
  getComplianceItems,
  getCriticalAttentionItems,
  getExecutiveSummary,
  getManagementControlSummary,
  getOvrExecutiveDashboardAnalytics,
  getPortfolioMilestones,
  getProjects,
  getRisks,
} from '../lib/grcApi';
import { isEmptyLiveObject } from '../lib/liveData';
import type { MilestoneRow, ProjectRow } from '../types/domain';

interface DashboardProps {
  setPage: (page: PageKey) => void;
}

function isOpen(value: string) {
  return !['closed', 'completed', 'approved', 'cancelled', 'validated'].includes(value);
}

export function Dashboard({ setPage }: DashboardProps) {
  const { t } = useI18n();
  const [filters, setFilters] = useState(readDashboardFilters);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const summary = useAsyncData(getExecutiveSummary, []);
  const analytics = useAsyncData(getOvrExecutiveDashboardAnalytics, []);
  const management = useAsyncData(getManagementControlSummary, []);
  const attention = useAsyncData(getCriticalAttentionItems, []);
  const portfolio = useAsyncData(async () => {
    const [projects, milestones] = await Promise.all([getProjects(), getPortfolioMilestones()]);
    return { projects, milestones };
  }, []);
  const assurance = useAsyncData(async () => {
    const [risks, compliance, audit, approvals] = await Promise.all([
      getRisks(), getComplianceItems(), getAuditFindings(), getApprovals(),
    ]);
    return { risks, compliance, audit, approvals };
  }, []);

  const summaryData = isEmptyLiveObject(summary.data) ? null : summary.data;
  const managementData = isEmptyLiveObject(management.data) ? null : management.data;
  const departments = useMemo(() => {
    const values = new Map<string, string>();
    for (const project of portfolio.data?.projects ?? []) {
      if (project.department_id) values.set(project.department_id, project.departments?.name_en || t('dashboard.v11.unnamedDepartment', 'Department'));
    }
    return Array.from(values, ([id, label]) => ({ id, label }));
  }, [portfolio.data, t]);
  const filteredProjects = useMemo(() => (portfolio.data?.projects ?? []).filter(project =>
    projectInPeriod(project, filters.period)
    && (filters.department === 'all' || project.department_id === filters.department)
    && projectMatchesStatus(project, filters.status)
    && (filters.severity === 'all' || project.risk_level === filters.severity)
  ), [portfolio.data, filters]);
  const filteredMilestones = useMemo(() => (portfolio.data?.milestones ?? []).filter(milestone =>
    filteredProjects.some(project => project.id === milestone.project_id)
  ), [portfolio.data, filteredProjects]);

  const navigate = (page: PageKey, routeFilters: Record<string, string> = {}) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(routeFilters)) next.set(key, value);
    window.history.replaceState(null, '', `${window.location.pathname}?${next.toString()}`);
    setPage(page);
  };
  const changeFilters = (next: typeof filters) => {
    setFilters(next);
    writeDashboardFilters(next);
  };
  const resetFilters = () => changeFilters(DEFAULT_DASHBOARD_FILTERS);

  const ovrHeadline = analytics.data?.headline;
  const riskCells = Array.from({ length: 25 }, (_, index) => {
    const likelihood = 5 - Math.floor(index / 5);
    const impact = (index % 5) + 1;
    const rows = (assurance.data?.risks ?? []).filter(risk => risk.likelihood === likelihood && risk.impact === impact);
    return { likelihood, impact, count: rows.length };
  });
  const complianceDomains = Object.values((assurance.data?.compliance ?? []).reduce<Record<string, { domain: string; total: number; completed: number; statuses: Set<string> }>>((result, item) => {
    const key = item.regulatory_body || t('dashboard.v11.unassignedDomain', 'Unassigned domain');
    const current = result[key] ?? { domain: key, total: 0, completed: 0, statuses: new Set<string>() };
    current.total += 1;
    if (!isOpen(item.status)) current.completed += 1;
    if (item.status) current.statuses.add(item.status);
    result[key] = current;
    return result;
  }, {})).map(item => ({
    ...item,
    completion: item.total ? Math.round((item.completed / item.total) * 100) : 0,
    statusLabel: Array.from(item.statuses).map(status => status.replaceAll('_', ' ')).join(' · '),
  })).sort((a, b) => b.total - a.total).slice(0, 6);
  const pipeline = ['active', 'at_risk', 'delayed', 'completed_pending_evidence', 'completed_pending_approval', 'closed'].map(status => ({
    status,
    count: filteredProjects.filter(project => project.status === status).length,
  }));
  const maximumPipeline = Math.max(1, ...pipeline.map(item => item.count));
  const openAudit = (assurance.data?.audit ?? []).filter(item => isOpen(item.finding_status || item.status));

  return (
    <section className="page-section grc-dashboard grc-dashboard--home">
      <EmptySupabaseNotice />
      <header className="grc-dashboard-intro">
        <ModuleHeader eyebrow={t('dashboard.v11.eyebrow', 'Executive command center')} title={t('dashboard.v11.title', 'Governance performance and strategic delivery')} subtitle={t('dashboard.v11.subtitle', 'Privacy-safe OVR analytics and role-scoped operational intelligence.')} />
        <ControlledPilotBanner compact />
      </header>
      <DashboardFilters filters={filters} departments={departments} onChange={changeFilters} onReset={resetFilters} t={t} />

      <div className="grc-metric-strip" aria-label={t('dashboard.v11.kpis', 'Executive KPIs')}>
        <DashboardMetricCard icon="ovr" label={t('dashboard.v11.openOvr', 'Open OVR')} value={metricBandLabel(ovrHeadline?.metrics.open_ovr, '—')} state={analytics.loading ? 'loading' : analytics.error ? 'unavailable' : ovrHeadline ? 'loaded' : 'restricted'} privacyLabel={t('dashboard.v11.privacySafe', 'Privacy-safe daily band')} onClick={() => navigate('ovr', { ovr_status: 'open' })} />
        <DashboardMetricCard icon="risk" label={t('dashboard.v11.criticalRisks', 'Critical risks')} value={summaryData?.criticalOpenRisks ?? null} state={summary.loading ? 'loading' : summaryData ? 'loaded' : 'unavailable'} tone="danger" detail={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')} onClick={() => navigate('risks', { risk_level: 'critical' })} />
        <DashboardMetricCard icon="capa" label={t('dashboard.v11.overdueCapas', 'Overdue CAPAs')} value={summaryData?.overdueProjects ?? null} state={summary.loading ? 'loading' : summaryData ? 'loaded' : 'unavailable'} tone="warning" detail={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')} onClick={() => navigate('projects', { overdue: 'true' })} />
        <DashboardMetricCard icon="audit" label={t('dashboard.v11.auditFindings', 'Open audit findings')} value={assurance.loading ? null : assurance.error ? null : openAudit.length} state={assurance.loading ? 'loading' : assurance.error ? 'unavailable' : openAudit.length ? 'loaded' : 'empty'} detail={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')} onClick={() => navigate('audit', { finding_status: 'open' })} />
        <DashboardMetricCard icon="compliance" label={t('dashboard.v11.compliance30', 'Compliance deadlines — 30 days')} value={summaryData?.complianceExpiring30Days ?? null} state={summary.loading ? 'loading' : summaryData ? 'loaded' : 'unavailable'} tone="warning" detail={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')} onClick={() => navigate('compliance', { due: '30d' })} />
        <DashboardMetricCard icon="accreditation" label={t('dashboard.v11.accreditationReadiness', 'Accreditation readiness')} value={null} state="unavailable" detail={t('dashboard.v11.notConfigured', 'Trusted aggregate source not configured')} onClick={() => navigate('accreditationHub')} />
      </div>

      <div className="grc-dashboard-command-grid">
        <DashboardSection className="grc-dashboard-trend-panel" title={t('dashboard.v11.performanceTrend', 'GRC performance trend')} hint={t('dashboard.v11.trendHint', 'Fixed 12-month privacy-safe daily snapshot; no raw OVR drill-down entitlement is implied.')}>
          {analytics.error ? <DashboardWidgetState state="restricted" message={t('dashboard.v11.aggregateRestricted', 'Executive aggregate is restricted or unavailable for this account.')} onRetry={() => void analytics.refresh()} /> : analytics.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading governed analytics…')} /> : <PrivacySafeTrend data={analytics.data?.trend ?? null} t={t} />}
        </DashboardSection>
        <aside className="grc-dashboard-command-rail" aria-label={t('dashboard.v11.managementAlerts', 'Management alerts')}>
          <DashboardSection className="grc-dashboard-rail-panel" title={t('dashboard.v11.approvalsAttention', 'Approvals requiring attention')}>
            {assurance.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : assurance.error ? <DashboardWidgetState state="unavailable" message={assurance.error} onRetry={() => void assurance.refresh()} /> : !(assurance.data?.approvals.length) ? <DashboardWidgetState state="empty" message={t('dashboard.v11.noApprovals', 'No approvals are visible in your scope.')} /> : <div className="grc-dashboard-list">{assurance.data.approvals.slice(0, 3).map(item => <button type="button" key={item.id} onClick={() => navigate('approvals')}><span><strong>{item.item_title}</strong><small>{item.requested_by_name || t('common.notConfigured', 'Not configured')}</small></span><em>{new Date(item.requested_at).toLocaleDateString()}</em></button>)}</div>}
          </DashboardSection>
          <DashboardSection className="grc-dashboard-rail-panel" title={t('dashboard.v11.managementAlerts', 'Management alerts')}>
            {management.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : !managementData ? <DashboardWidgetState state="unavailable" message={t('dashboard.v11.sourceUnavailable', 'Source unavailable')} onRetry={() => void management.refresh()} /> : <div className="grc-dashboard-list">{[
              [t('dashboard.openEscalations'), managementData.open_escalations, 'escalations' as PageKey],
              [t('dashboard.criticalEscalations'), managementData.critical_escalations, 'escalations' as PageKey],
              [t('dashboard.missingDelayReasons'), managementData.missing_delay_reasons, 'projects' as PageKey],
            ].map(([label, value, destination]) => <button type="button" onClick={() => navigate(destination as PageKey)} key={String(label)}><strong>{label}</strong><em>{value}</em></button>)}</div>}
          </DashboardSection>
          <DashboardSection className="grc-dashboard-rail-panel grc-dashboard-rail-panel--attention" title={t('dashboard.v11.criticalAttention', 'Critical attention list')}>
            {attention.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : attention.error ? <DashboardWidgetState state="unavailable" message={attention.error} onRetry={() => void attention.refresh()} /> : !attention.data?.length ? <DashboardWidgetState state="empty" message={t('dashboard.v11.noAttention', 'No critical items are visible in your scope.')} /> : <div className="grc-dashboard-list">{attention.data.slice(0, 4).map(item => <button type="button" key={`${item.itemType}-${item.id}`} onClick={() => navigate(item.itemType.includes('risk') ? 'risks' : item.itemType.includes('audit') ? 'audit' : 'projects')}><span><strong>{item.title}</strong><small>{item.department} · {item.owner}</small></span><em>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</em></button>)}</div>}
          </DashboardSection>
        </aside>
      </div>

      <DashboardSection className="grc-dashboard-gantt-feature" title={t('dashboard.v11.strategicPortfolio', 'Strategic projects & programs')} hint={selectedProject ? `${selectedProject.title} · ${selectedProject.progress_percent ?? 0}%` : t('dashboard.v11.ganttHint', 'Select a project or milestone to open its governed project context.')} wide>
        {portfolio.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loadingPortfolio', 'Loading portfolio schedule…')} /> : portfolio.error ? <DashboardWidgetState state="unavailable" message={portfolio.error} onRetry={() => void portfolio.refresh()} /> : <PortfolioGantt projects={filteredProjects} milestones={filteredMilestones} selectedProjectId={selectedProject?.id} onProject={project => { setSelectedProject(project); navigate('projects', { project_context: 'selected' }); }} onMilestone={(milestone: MilestoneRow) => { const project = filteredProjects.find(item => item.id === milestone.project_id); if (project) setSelectedProject(project); navigate('projects', { milestone_context: 'selected' }); }} t={t} />}
      </DashboardSection>

      <div className="grc-dashboard-grid">
        <div className="span-4"><DashboardSection title={t('dashboard.v11.riskHeatmap', 'Risk heatmap')} hint={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')}>
          {assurance.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : assurance.error ? <DashboardWidgetState state="unavailable" message={assurance.error} /> : <div className="grc-heatmap-shell"><span className="grc-heatmap__axis grc-heatmap__axis--y">{t('dashboard.v11.likelihood', 'Likelihood')}</span><div className="grc-heatmap" aria-label={t('dashboard.v11.riskHeatmap', 'Risk heatmap')}>{riskCells.map(cell => { const score = cell.likelihood * cell.impact; const band = score >= 20 ? 'critical' : score >= 12 ? 'high' : score >= 6 ? 'medium' : 'low'; return <button type="button" className={`is-${band}`} data-count={cell.count} key={`${cell.likelihood}-${cell.impact}`} aria-label={`${t('dashboard.v11.likelihood', 'Likelihood')} ${cell.likelihood}, ${t('dashboard.v11.impact', 'impact')} ${cell.impact}: ${cell.count}`} onClick={() => navigate('risks', { likelihood: String(cell.likelihood), impact: String(cell.impact) })}>{cell.count}</button>; })}</div><span className="grc-heatmap__axis grc-heatmap__axis--x">{t('dashboard.v11.impact', 'Impact')}</span></div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('dashboard.v11.capaPipeline', 'CAPA pipeline')}>
          {portfolio.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : portfolio.error ? <DashboardWidgetState state="unavailable" message={portfolio.error} /> : <div className="grc-pipeline">{pipeline.map(item => <button type="button" className="grc-pipeline__row" data-tone={item.status} key={item.status} onClick={() => navigate('projects', { status: item.status })}><span className="grc-pipeline__label"><i aria-hidden="true" />{t(`dashboard.v11.status.${item.status}`, item.status.replaceAll('_', ' '))}</span><span className="grc-pipeline__track"><span style={{ width: `${(item.count / maximumPipeline) * 100}%` }} /></span><strong>{item.count}</strong></button>)}</div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('dashboard.v11.complianceDomains', 'Compliance status by domain')}>
          {assurance.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : assurance.error ? <DashboardWidgetState state="unavailable" message={assurance.error} /> : !complianceDomains.length ? <DashboardWidgetState state="empty" message={t('dashboard.v11.noCompliance', 'No compliance obligations are visible.')} /> : <div className="grc-compliance-domains">{complianceDomains.map(item => { const domain = item.domain; return <button type="button" key={domain} onClick={() => navigate('compliance', { domain })}><span><strong>{domain}</strong><small>{item.statusLabel || t('common.notConfigured', 'Not configured')}</small></span><em>{item.total}</em><span className="grc-compliance-domain__progress" aria-label={`${item.completion}%`}><span style={{ width: `${item.completion}%` }} /></span></button>; })}</div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('dashboard.v11.auditCoverage', 'Audit coverage / findings')}>
          {assurance.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : assurance.error ? <DashboardWidgetState state="unavailable" message={assurance.error} /> : <div className="grc-dashboard-list"><button type="button" onClick={() => navigate('audit', { finding_status: 'open' })}><strong>{t('dashboard.v11.openFindings', 'Open findings')}</strong><em>{openAudit.length}</em></button><button type="button" onClick={() => navigate('audit', { severity: 'critical' })}><strong>{t('dashboard.v11.criticalFindings', 'Critical findings')}</strong><em>{openAudit.filter(item => item.risk_level === 'critical').length}</em></button></div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('dashboard.v11.incidentSeverity', 'Incident severity / safe OVR summary')}>
          {analytics.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : !ovrHeadline ? <DashboardWidgetState state="restricted" message={t('dashboard.v11.aggregateRestricted', 'Executive aggregate is restricted or unavailable for this account.')} /> : <div className="grc-dashboard-list"><div className="grc-dashboard-list__row"><strong>{t('dashboard.v11.majorSentinel', 'Major / sentinel')}</strong><em>{ovrHeadline.metrics.major_sentinel.label}</em></div><div className="grc-dashboard-list__row"><strong>{t('dashboard.v11.potentialRepeat', 'Potential repeat')}</strong><em>{ovrHeadline.metrics.potential_repeat.label}</em></div><div className="grc-dashboard-list__row"><strong>{t('dashboard.v11.correctiveRequired', 'Corrective action required')}</strong><em>{ovrHeadline.metrics.corrective_action_required.label}</em></div></div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('dashboard.v11.recentActivity', 'Recent governed activity')}>
          <DashboardWidgetState state="unavailable" message={t('dashboard.v11.activityUnavailable', 'No trusted cross-module activity feed is configured. Open the governed source modules for current records.')} />
        </DashboardSection></div>
      </div>
    </section>
  );
}
