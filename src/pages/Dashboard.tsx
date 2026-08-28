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
  auditDashboardMetricState,
  dashboardCollectionState,
  dashboardDestinationUrl,
  filterDashboardApprovals,
  filterDashboardAttention,
  filterDashboardAuditFindings,
  filterDashboardCapa,
  filterDashboardCompliance,
  filterDashboardProjects,
  filterDashboardRisks,
  metricBandLabel,
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
  getManagementControlSummary,
  getOvrExecutiveDashboardAnalytics,
  getPortfolioMilestones,
  getProjects,
  getDashboardRecentGovernedActivity,
  getRisks,
} from '../lib/grcApi';
import { getLiveGrcCapaQueue } from '../lib/liveGrcOperatingApi';
import { isLive } from '../lib/liveResult';
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
  const analytics = useAsyncData(getOvrExecutiveDashboardAnalytics, []);
  const management = useAsyncData(getManagementControlSummary, []);
  const attention = useAsyncData(() => getCriticalAttentionItems({ throwOnError: true }), []);
  const capa = useAsyncData(getLiveGrcCapaQueue, []);
  const auditFindings = useAsyncData(getAuditFindings, []);
  const portfolio = useAsyncData(async () => {
    const [projects, milestones] = await Promise.all([getProjects({ throwOnError: true }), getPortfolioMilestones()]);
    return { projects, milestones };
  }, []);
  const risks = useAsyncData(() => getRisks({ throwOnError: true }), []);
  const compliance = useAsyncData(() => getComplianceItems({ throwOnError: true }), []);
  const approvals = useAsyncData(() => getApprovals({ throwOnError: true }), []);
  const recentActivity = useAsyncData(getDashboardRecentGovernedActivity, []);

  const managementData = isEmptyLiveObject(management.data) ? null : management.data;
  const departments = useMemo(() => {
    const values = new Map<string, string>();
    for (const project of portfolio.data?.projects ?? []) {
      if (project.department_id) values.set(project.department_id, project.departments?.name_en || t('dashboard.v11.unnamedDepartment', 'Department'));
    }
    for (const risk of risks.data ?? []) {
      if (risk.department_id) values.set(risk.department_id, risk.departments?.name_en || t('dashboard.v11.unnamedDepartment', 'Department'));
    }
    for (const item of compliance.data ?? []) {
      if (item.department_id) values.set(item.department_id, item.departments?.name_en || t('dashboard.v11.unnamedDepartment', 'Department'));
    }
    for (const finding of auditFindings.data ?? []) {
      const departmentId = finding.responsible_department_id;
      if (departmentId) values.set(departmentId, finding.departments?.name_en || t('dashboard.v11.unnamedDepartment', 'Department'));
    }
    return Array.from(values, ([id, label]) => ({ id, label }));
  }, [auditFindings.data, compliance.data, portfolio.data, risks.data, t]);
  const filteredProjects = useMemo(() => filterDashboardProjects(portfolio.data?.projects ?? [], filters), [portfolio.data, filters]);
  const filteredMilestones = useMemo(() => (portfolio.data?.milestones ?? []).filter(milestone =>
    filteredProjects.some(project => project.id === milestone.project_id)
  ), [portfolio.data, filteredProjects]);
  const filteredRisks = useMemo(() => filterDashboardRisks(risks.data ?? [], filters), [risks.data, filters]);
  const filteredAudit = useMemo(() => filterDashboardAuditFindings(auditFindings.data ?? [], filters), [auditFindings.data, filters]);
  const filteredCompliance = useMemo(() => filterDashboardCompliance(compliance.data ?? [], filters), [compliance.data, filters]);
  const filteredApprovals = useMemo(() => filterDashboardApprovals(approvals.data ?? [], filters), [approvals.data, filters]);
  const capaRows = capa.data && isLive(capa.data) ? capa.data.data : [];
  const filteredCapas = useMemo(() => filterDashboardCapa(capaRows, filters), [capaRows, filters]);
  const selectedDepartmentLabel = filters.department === 'all'
    ? null
    : departments.find(department => department.id === filters.department)?.label ?? null;
  const filteredAttention = useMemo(
    () => filterDashboardAttention(attention.data ?? [], filters, selectedDepartmentLabel),
    [attention.data, filters, selectedDepartmentLabel],
  );

  const navigate = (page: PageKey, routeFilters: Record<string, string> = {}) => {
    window.history.pushState(null, '', dashboardDestinationUrl(page, window.location.pathname, routeFilters));
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
    const rows = filteredRisks.filter(risk => risk.likelihood === likelihood && risk.impact === impact);
    return { likelihood, impact, count: rows.length };
  });
  const complianceDomains = Object.values(filteredCompliance.reduce<Record<string, { domain: string; total: number; completed: number; statuses: Set<string> }>>((result, item) => {
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
  const pipeline = ['overdue', 'due_soon', 'ready_for_retest', 'normal'].map(status => ({
    status,
    count: filteredCapas.filter(item => item.queue_signal === status).length,
  }));
  const maximumPipeline = Math.max(1, ...pipeline.map(item => item.count));
  const openAudit = filteredAudit.filter(item => isOpen(item.finding_status || item.status));
  const auditMetric = auditDashboardMetricState(openAudit, auditFindings.loading, auditFindings.error);
  const criticalRisks = filteredRisks.filter(item => item.risk_level === 'critical' && isOpen(item.lifecycle_status || item.status));
  const complianceDeadlines = filteredCompliance.filter(item => isOpen(item.status));
  const riskState = dashboardCollectionState(filteredRisks, risks.loading, risks.error);
  const complianceState = dashboardCollectionState(filteredCompliance, compliance.loading, compliance.error);
  const approvalState = dashboardCollectionState(filteredApprovals, approvals.loading, approvals.error);
  const activityState = dashboardCollectionState(recentActivity.data ?? [], recentActivity.loading, recentActivity.error);
  const aggregateRestricted = analytics.errorCode === 'OVR_EXECUTIVE_ANALYTICS_ACCESS_RESTRICTED';
  const aggregateState = analytics.loading ? 'loading' : aggregateRestricted ? 'restricted' : analytics.error || !ovrHeadline ? 'unavailable' : 'loaded';
  const aggregateErrorMessage = aggregateRestricted
    ? t('dashboard.v11.aggregateRestricted', 'Dashboard aggregate access is restricted for this account.')
    : t('dashboard.v11.aggregateUnavailable', 'The privacy-safe dashboard aggregate is temporarily unavailable.');
  const capaState = capa.loading ? 'loading' : capa.error || capa.data?.status === 'configuration_error' || capa.data?.status === 'query_error'
    ? 'unavailable'
    : capa.data?.status === 'unauthorized' ? 'restricted' : filteredCapas.length ? 'loaded' : 'empty';

  return (
    <section className="page-section grc-dashboard grc-dashboard--home">
      <EmptySupabaseNotice />
      <header className="grc-dashboard-intro">
        <ModuleHeader eyebrow={t('dashboard.v11.eyebrow', 'Executive overview')} title={t('dashboard.v11.title', 'Governance performance and strategic delivery')} subtitle={t('dashboard.v11.subtitle', 'Privacy-safe OVR analytics and role-scoped operational intelligence.')} />
        <ControlledPilotBanner compact />
      </header>
      <DashboardFilters filters={filters} departments={departments} onChange={changeFilters} onReset={resetFilters} t={t} />

      <div className="grc-metric-strip" aria-label={t('dashboard.v11.kpis', 'Executive KPIs')}>
        <DashboardMetricCard icon="ovr" label={t('dashboard.v11.openOvr', 'Open OVR')} value={metricBandLabel(ovrHeadline?.metrics.open_ovr, '—', ovrHeadline?.privacy.minimum_cell_size)} state={aggregateState} detail={t('dashboard.v11.ovrFilterScope', 'Organization-wide privacy-safe snapshot; dashboard filters do not apply. Raw OVR access remains RLS-governed.')} privacyLabel={t('dashboard.v11.privacySafe', 'Organization-wide privacy-safe snapshot')} onClick={() => navigate('ovr')} />
        <DashboardMetricCard icon="risk" label={t('dashboard.v11.criticalRisks', 'Critical risks')} value={riskState === 'unavailable' || riskState === 'loading' ? null : criticalRisks.length} state={riskState} tone="danger" detail={t('dashboard.v11.riskFilterScope', 'Department, status and severity filters apply; period does not.')} onClick={() => navigate('risks')} />
        <DashboardMetricCard icon="capa" label={t('dashboard.v11.overdueCapas', 'Overdue governed CAPAs')} value={capaState === 'loading' || capaState === 'unavailable' || capaState === 'restricted' ? null : filteredCapas.filter(item => item.queue_signal === 'overdue').length} state={capaState} tone="warning" detail={t('dashboard.v11.capaFilterScope', 'Governed CAPA queue; period and status filters apply.')} />
        <DashboardMetricCard icon="audit" label={t('dashboard.v11.auditFindings', 'Open audit findings')} value={auditMetric.value} state={auditMetric.state} detail={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')} onClick={() => navigate('audit', { finding_status: 'open' })} />
        <DashboardMetricCard icon="compliance" label={t('dashboard.v11.compliance30', 'Compliance deadlines — selected period')} value={complianceState === 'unavailable' || complianceState === 'loading' ? null : complianceDeadlines.length} state={complianceState} tone="warning" detail={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')} onClick={() => navigate('compliance')} />
        <DashboardMetricCard icon="accreditation" label={t('dashboard.v11.accreditationReadiness', 'Accreditation readiness')} value={null} state="unavailable" detail={t('dashboard.v11.notConfigured', 'Trusted aggregate source not configured')} onClick={() => navigate('accreditationHub')} />
      </div>

      <div className="grc-dashboard-command-grid">
        <DashboardSection className="grc-dashboard-trend-panel" title={t('dashboard.v11.performanceTrend', 'GRC performance trend')} hint={t('dashboard.v11.trendHint', 'Organization-wide fixed 12-month privacy-safe snapshot; dashboard filters do not apply and no raw OVR entitlement is implied.')}>
          {analytics.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading governed analytics…')} /> : analytics.error || !analytics.data?.trend ? <DashboardWidgetState state={aggregateState} message={aggregateErrorMessage} onRetry={() => void analytics.refresh()} /> : <PrivacySafeTrend data={analytics.data.trend} t={t} />}
        </DashboardSection>
        <aside className="grc-dashboard-command-rail" aria-label={t('dashboard.v11.managementAlerts', 'Management alerts')}>
          <DashboardSection className="grc-dashboard-rail-panel" title={t('dashboard.v11.approvalsAttention', 'Approvals requiring attention')} hint={t('dashboard.v11.approvalFilterScope', 'Period filter applies; department, status and severity do not.')}>
            {approvalState === 'loading' ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : approvalState === 'unavailable' ? <DashboardWidgetState state="unavailable" message={approvals.error || t('dashboard.v11.sourceUnavailable', 'Source unavailable')} onRetry={() => void approvals.refresh()} /> : approvalState === 'empty' ? <DashboardWidgetState state="empty" message={t('dashboard.v11.noApprovals', 'No approvals are visible in your scope.')} /> : <div className="grc-dashboard-list">{filteredApprovals.slice(0, 3).map(item => <button type="button" key={item.id} onClick={() => navigate('approvals')}><span><strong>{item.item_title}</strong><small>{item.requested_by_name || t('common.notConfigured', 'Not configured')}</small></span><em>{new Date(item.requested_at).toLocaleDateString()}</em></button>)}</div>}
          </DashboardSection>
          <DashboardSection className="grc-dashboard-rail-panel" title={t('dashboard.v11.managementAlerts', 'Management alerts')} hint={t('dashboard.v11.filtersNotApplicable', 'Organization summary; dashboard filters do not apply.')}>
            {management.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : !managementData ? <DashboardWidgetState state="unavailable" message={t('dashboard.v11.sourceUnavailable', 'Source unavailable')} onRetry={() => void management.refresh()} /> : <div className="grc-dashboard-list">{[
              [t('dashboard.openEscalations'), managementData.open_escalations, 'escalations' as PageKey],
              [t('dashboard.criticalEscalations'), managementData.critical_escalations, 'escalations' as PageKey],
              [t('dashboard.missingDelayReasons'), managementData.missing_delay_reasons, 'projects' as PageKey],
            ].map(([label, value, destination]) => <button type="button" onClick={() => navigate(destination as PageKey)} key={String(label)}><strong>{label}</strong><em>{value}</em></button>)}</div>}
          </DashboardSection>
          <DashboardSection className="grc-dashboard-rail-panel grc-dashboard-rail-panel--attention" title={t('dashboard.v11.criticalAttention', 'Critical attention list')} hint={t('dashboard.v11.allFiltersApply', 'Period, department, status and severity filters apply.')}>
            {attention.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : attention.error ? <DashboardWidgetState state="unavailable" message={attention.error} onRetry={() => void attention.refresh()} /> : !filteredAttention.length ? <DashboardWidgetState state="empty" message={t('dashboard.v11.noAttention', 'No critical items are visible in your scope.')} /> : <div className="grc-dashboard-list">{filteredAttention.slice(0, 4).map(item => <button type="button" key={`${item.itemType}-${item.id}`} onClick={() => navigate(item.itemType.includes('risk') ? 'risks' : item.itemType.includes('audit') ? 'audit' : 'projects')}><span><strong>{item.title}</strong><small>{item.department} · {item.owner}</small></span><em>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</em></button>)}</div>}
          </DashboardSection>
        </aside>
      </div>

      <DashboardSection className="grc-dashboard-gantt-feature" title={t('dashboard.v11.strategicPortfolio', 'Strategic projects & programs')} hint={selectedProject ? `${selectedProject.title} · ${selectedProject.progress_percent ?? 0}%` : t('dashboard.v11.ganttHint', 'Select a project or milestone to open its governed project context.')} wide>
        {portfolio.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loadingPortfolio', 'Loading portfolio schedule…')} /> : portfolio.error ? <DashboardWidgetState state="unavailable" message={portfolio.error} onRetry={() => void portfolio.refresh()} /> : <PortfolioGantt projects={filteredProjects} milestones={filteredMilestones} selectedProjectId={selectedProject?.id} onProject={project => { setSelectedProject(project); navigate('projects', { project_context: 'selected' }); }} onMilestone={(milestone: MilestoneRow) => { const project = filteredProjects.find(item => item.id === milestone.project_id); if (project) setSelectedProject(project); navigate('projects', { milestone_context: 'selected' }); }} t={t} />}
      </DashboardSection>

      <div className="grc-dashboard-grid">
        <div className="span-4"><DashboardSection title={t('dashboard.v11.riskHeatmap', 'Risk heatmap')} hint={t('dashboard.v11.riskFilterScope', 'Department, status and severity filters apply; period does not.')}>
          {riskState === 'loading' ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : riskState === 'unavailable' ? <DashboardWidgetState state="unavailable" message={risks.error || t('dashboard.v11.sourceUnavailable', 'Source unavailable')} onRetry={() => void risks.refresh()} /> : <div className="grc-heatmap-shell"><span className="grc-heatmap__axis grc-heatmap__axis--y">{t('dashboard.v11.likelihood', 'Likelihood')}</span><div className="grc-heatmap" aria-label={t('dashboard.v11.riskHeatmap', 'Risk heatmap')}>{riskCells.map(cell => { const score = cell.likelihood * cell.impact; const band = score >= 20 ? 'critical' : score >= 12 ? 'high' : score >= 6 ? 'medium' : 'low'; return <button type="button" className={`is-${band}`} data-count={cell.count} key={`${cell.likelihood}-${cell.impact}`} aria-label={`${t('dashboard.v11.likelihood', 'Likelihood')} ${cell.likelihood}, ${t('dashboard.v11.impact', 'impact')} ${cell.impact}: ${cell.count}`} onClick={() => navigate('risks', { likelihood: String(cell.likelihood), impact: String(cell.impact) })}>{cell.count}</button>; })}</div><span className="grc-heatmap__axis grc-heatmap__axis--x">{t('dashboard.v11.impact', 'Impact')}</span></div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('dashboard.v11.capaPipeline', 'Governed CAPA queue')} hint={t('dashboard.v11.capaFilterScope', 'Governed CAPA queue; period and status filters apply.')}>
          {capaState === 'loading' ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : capaState === 'unavailable' || capaState === 'restricted' ? <DashboardWidgetState state={capaState} message={capa.data?.message || t('dashboard.v11.sourceUnavailable', 'Source unavailable')} /> : <div className="grc-pipeline">{pipeline.map(item => <div className="grc-pipeline__row" data-tone={item.status} key={item.status}><span className="grc-pipeline__label"><i aria-hidden="true" />{t(`dashboard.v11.status.${item.status}`, item.status.replaceAll('_', ' '))}</span><span className="grc-pipeline__track"><span style={{ width: `${(item.count / maximumPipeline) * 100}%` }} /></span><strong>{item.count}</strong></div>)}</div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('dashboard.v11.complianceDomains', 'Compliance status by domain')} hint={t('dashboard.v11.allFiltersApply', 'Period, department, status and severity filters apply.')}>
          {complianceState === 'loading' ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : complianceState === 'unavailable' ? <DashboardWidgetState state="unavailable" message={compliance.error || t('dashboard.v11.sourceUnavailable', 'Source unavailable')} onRetry={() => void compliance.refresh()} /> : complianceState === 'empty' ? <DashboardWidgetState state="empty" message={t('dashboard.v11.noCompliance', 'No compliance obligations are visible.')} /> : <div className="grc-compliance-domains">{complianceDomains.map(item => { const domain = item.domain; return <button type="button" key={domain} onClick={() => navigate('compliance', { domain })}><span><strong>{domain}</strong><small>{item.statusLabel || t('common.notConfigured', 'Not configured')}</small></span><em>{item.total}</em><span className="grc-compliance-domain__progress" aria-label={`${item.completion}%`}><span style={{ width: `${item.completion}%` }} /></span></button>; })}</div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('dashboard.v11.auditCoverage', 'Audit coverage / findings')} hint={t('dashboard.v11.allFiltersApply', 'Period, department, status and severity filters apply.')}>
          {auditFindings.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : auditFindings.error ? <DashboardWidgetState state="unavailable" message={auditFindings.error} onRetry={() => void auditFindings.refresh()} /> : <div className="grc-dashboard-list"><button type="button" onClick={() => navigate('audit', { finding_status: 'open' })}><strong>{t('dashboard.v11.openFindings', 'Open findings')}</strong><em>{openAudit.length}</em></button><button type="button" onClick={() => navigate('audit', { severity: 'critical' })}><strong>{t('dashboard.v11.criticalFindings', 'Critical findings')}</strong><em>{openAudit.filter(item => (item.severity_level ?? item.risk_level) === 'critical').length}</em></button></div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('dashboard.v11.incidentSeverity', 'Incident severity / safe OVR summary')} hint={t('dashboard.v11.ovrFilterScope', 'Organization-wide privacy-safe snapshot; dashboard filters do not apply. Raw OVR access remains RLS-governed.')}>
          {analytics.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : !ovrHeadline ? <DashboardWidgetState state={aggregateState} message={aggregateErrorMessage} onRetry={() => void analytics.refresh()} /> : <div className="grc-dashboard-list"><div className="grc-dashboard-list__row"><strong>{t('dashboard.v11.majorSentinel', 'Major / sentinel')}</strong><em>{metricBandLabel(ovrHeadline.metrics.major_sentinel, '—', ovrHeadline.privacy.minimum_cell_size)}</em></div><div className="grc-dashboard-list__row"><strong>{t('dashboard.v11.potentialRepeat', 'Potential repeat')}</strong><em>{metricBandLabel(ovrHeadline.metrics.potential_repeat, '—', ovrHeadline.privacy.minimum_cell_size)}</em></div><div className="grc-dashboard-list__row"><strong>{t('dashboard.v11.correctiveRequired', 'Corrective action required')}</strong><em>{metricBandLabel(ovrHeadline.metrics.corrective_action_required, '—', ovrHeadline.privacy.minimum_cell_size)}</em></div></div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('dashboard.v11.recentActivity', 'Recent governed activity')}>
          {activityState === 'loading' ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : activityState === 'unavailable' ? <DashboardWidgetState state="unavailable" message={recentActivity.error || t('dashboard.v11.activitySourceUnavailable', 'Recent governed activity is temporarily unavailable.')} onRetry={() => void recentActivity.refresh()} /> : activityState === 'empty' ? <DashboardWidgetState state="empty" message={t('dashboard.v11.noRecentActivity', 'No recent governed activity is visible in your scope.')} /> : <div className="grc-dashboard-list">{(recentActivity.data ?? []).slice(0, 5).map(item => <button type="button" key={`${item.activity_type}-${item.activity_id}`} onClick={() => navigate(item.activity_type === 'document_review' ? 'documents' : 'governance')}><span><strong>{item.title}</strong><small>{item.reference_code || item.activity_type.replaceAll('_', ' ')} · {item.status.replaceAll('_', ' ')}</small></span><em>{new Date(item.occurred_at).toLocaleDateString()}</em></button>)}</div>}
        </DashboardSection></div>
      </div>
    </section>
  );
}
