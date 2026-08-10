import { useMemo, useState } from 'react';
import type { PageKey } from '../components/Layout';
import { ActionPlanForm } from '../components/ActionPlanForm';
import {
  DashboardFilters,
  DashboardMetricCard,
  DashboardSection,
  DashboardWidgetState,
  PortfolioGantt,
} from '../components/dashboard/GovernedDashboard';
import { Modal } from '../components/Modal';
import { ModuleHeader } from '../components/ModuleHeader';
import { ProjectDetail } from '../components/ProjectDetail';
import {
  DEFAULT_DASHBOARD_FILTERS,
  projectHealth,
  projectInPeriod,
  projectMatchesStatus,
  readDashboardFilters,
  writeDashboardFilters,
} from '../dashboard/dashboardFramework';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import {
  getDepartments,
  getOrganizations,
  getPortfolioMilestones,
  getPortfolioTasks,
  getProfiles,
  getProjects,
  getRisks,
} from '../lib/grcApi';
import type { MilestoneRow, ProjectRow } from '../types/domain';

interface ProjectsProps {
  setPage: (page: PageKey) => void;
}

const CLOSED_WORK = new Set(['closed', 'approved', 'cancelled']);

export function Projects({ setPage }: ProjectsProps) {
  const { t } = useI18n();
  const [filters, setFilters] = useState(readDashboardFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const portfolio = useAsyncData(async () => {
    const [projects, milestones, tasks, risks] = await Promise.all([
      getProjects(), getPortfolioMilestones(), getPortfolioTasks(), getRisks(),
    ]);
    return { projects, milestones, tasks, risks };
  }, []);
  const references = useAsyncData(async () => {
    const [departments, profiles, organizations] = await Promise.all([
      getDepartments(), getProfiles(), getOrganizations(),
    ]);
    return { departments, profiles, organizations };
  }, []);

  const changeFilters = (next: typeof filters) => {
    setFilters(next);
    writeDashboardFilters(next);
  };
  const filteredProjects = useMemo(() => (portfolio.data?.projects ?? []).filter(project =>
    projectInPeriod(project, filters.period)
    && (filters.department === 'all' || project.department_id === filters.department)
    && projectMatchesStatus(project, filters.status)
    && (filters.severity === 'all' || project.risk_level === filters.severity)
  ), [portfolio.data, filters]);
  const projectIds = useMemo(() => new Set(filteredProjects.map(project => project.id)), [filteredProjects]);
  const milestones = useMemo(() => (portfolio.data?.milestones ?? []).filter(item => projectIds.has(item.project_id)), [portfolio.data, projectIds]);
  const tasks = useMemo(() => (portfolio.data?.tasks ?? []).filter(item => projectIds.has(item.project_id)), [portfolio.data, projectIds]);
  const currentProject = selectedProject && projectIds.has(selectedProject.id) ? selectedProject : filteredProjects[0] ?? null;
  const currentHealth = currentProject ? projectHealth(currentProject) : null;
  const currentMilestones = currentProject ? milestones.filter(item => item.project_id === currentProject.id) : [];
  const currentTasks = currentProject ? tasks.filter(item => item.project_id === currentProject.id) : [];
  const linkedRisks = currentProject ? (portfolio.data?.risks ?? []).filter(risk => risk.source_project_id === currentProject.id) : [];
  const now = Date.now();
  const thirtyDays = now + 30 * 86_400_000;
  const upcomingMilestones = milestones.filter(item => item.due_date && !CLOSED_WORK.has(item.status) && new Date(`${item.due_date}T23:59:59`).getTime() >= now && new Date(`${item.due_date}T23:59:59`).getTime() <= thirtyDays);
  const overdueTasks = tasks.filter(item => item.due_date && !CLOSED_WORK.has(item.status) && new Date(`${item.due_date}T23:59:59`).getTime() < now);
  const atRiskProjects = filteredProjects.filter(project => ['at_risk', 'delayed'].includes(projectHealth(project)));
  const activeProjects = filteredProjects.filter(project => !['closed', 'cancelled'].includes(project.status));
  const healthCounts = (['on_track', 'watch', 'at_risk', 'delayed', 'completed'] as const).map(health => ({
    health,
    count: filteredProjects.filter(project => projectHealth(project) === health).length,
  }));
  const maximumHealth = Math.max(1, ...healthCounts.map(item => item.count));
  const departments = (references.data?.departments ?? []).map(department => ({ id: department.id, label: department.name_en || department.name_ar || t('dashboard.v11.unnamedDepartment', 'Department') }));
  const organizationId = references.data?.organizations[0]?.id || '';

  const openProject = (project: ProjectRow) => {
    setSelectedProject(project);
    setDetailOpen(true);
  };
  const selectMilestone = (milestone: MilestoneRow) => {
    const project = filteredProjects.find(item => item.id === milestone.project_id);
    if (project) setSelectedProject(project);
  };

  return (
    <section className="page-section grc-dashboard grc-dashboard--projects">
      <header className="grc-dashboard-intro grc-dashboard-intro--projects">
        <ModuleHeader
          eyebrow={t('projects.v11.eyebrow', 'Portfolio command center')}
          title={t('projects.v11.title', 'Projects, programs and controlled delivery')}
          subtitle={t('projects.v11.subtitle', 'Role-scoped delivery intelligence from governed project, milestone, task and risk records.')}
          action={<button type="button" className="primary-button" onClick={() => setFormOpen(true)}>{t('projects.v11.newActionPlan', 'New action plan')}</button>}
        />
      </header>
      <DashboardFilters filters={filters} departments={departments} onChange={changeFilters} onReset={() => changeFilters(DEFAULT_DASHBOARD_FILTERS)} t={t} />

      <div className="grc-metric-strip grc-metric-strip--four">
        <DashboardMetricCard icon="projects" label={t('projects.v11.active', 'Active projects')} value={portfolio.loading || portfolio.error ? null : activeProjects.length} state={portfolio.loading ? 'loading' : portfolio.error ? 'unavailable' : activeProjects.length ? 'loaded' : 'empty'} detail={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')} onClick={() => changeFilters({ ...filters, status: 'operating' })} />
        <DashboardMetricCard icon="risk" label={t('projects.v11.atRisk', 'Projects at risk')} value={portfolio.loading || portfolio.error ? null : atRiskProjects.length} state={portfolio.loading ? 'loading' : portfolio.error ? 'unavailable' : atRiskProjects.length ? 'loaded' : 'empty'} tone="danger" detail={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')} onClick={() => changeFilters({ ...filters, status: 'attention' })} />
        <DashboardMetricCard icon="milestones" label={t('projects.v11.milestones30', 'Milestones due — 30 days')} value={portfolio.loading || portfolio.error ? null : upcomingMilestones.length} state={portfolio.loading ? 'loading' : portfolio.error ? 'unavailable' : upcomingMilestones.length ? 'loaded' : 'empty'} tone="warning" detail={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')} onClick={() => { const item = upcomingMilestones[0]; if (item) selectMilestone(item); }} />
        <DashboardMetricCard icon="actions" label={t('projects.v11.overdueActions', 'Overdue actions')} value={portfolio.loading || portfolio.error ? null : overdueTasks.length} state={portfolio.loading ? 'loading' : portfolio.error ? 'unavailable' : overdueTasks.length ? 'loaded' : 'empty'} tone="danger" detail={t('dashboard.v11.roleScopedRows', 'Role-scoped source rows')} onClick={() => { const item = overdueTasks[0]; const project = item ? filteredProjects.find(row => row.id === item.project_id) : null; if (project) openProject(project); }} />
      </div>

      <DashboardSection className="grc-dashboard-gantt-feature" title={t('projects.v11.portfolioGantt', 'Portfolio Gantt')} hint={t('projects.v11.ganttHint', 'Select a project bar or milestone; all rows remain governed by source RLS.')} wide>
        {portfolio.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loadingPortfolio', 'Loading portfolio schedule…')} /> : portfolio.error ? <DashboardWidgetState state="unavailable" message={portfolio.error} onRetry={() => void portfolio.refresh()} /> : <PortfolioGantt projects={filteredProjects} milestones={milestones} selectedProjectId={currentProject?.id} onProject={openProject} onMilestone={selectMilestone} t={t} />}
      </DashboardSection>

      <div className="grc-dashboard-grid">
        <div className="span-6"><DashboardSection title={t('projects.v11.selectedIntelligence', 'Selected project intelligence')}>
          {!currentProject ? <DashboardWidgetState state={portfolio.loading ? 'loading' : portfolio.error ? 'unavailable' : 'empty'} message={portfolio.error || t('projects.v11.noProject', 'No project is visible for the active filters.')} /> : <div className="grc-project-intelligence" key={currentProject.id}>
            <button type="button" className="grc-project-intelligence__title" onClick={() => openProject(currentProject)}><strong>{currentProject.title}</strong><span>{t('projects.v11.openControlFile', 'Open control file')}</span></button>
            <dl>
              <div className="is-progress"><dt>{t('dashboard.progress', 'Progress')}</dt><dd>{currentProject.progress_percent ?? 0}%</dd><span className="grc-project-intelligence__progress" aria-hidden="true"><span style={{ width: `${currentProject.progress_percent ?? 0}%` }} /></span></div>
              <div><dt>{t('projects.v11.phase', 'Phase')}</dt><dd>{t('common.notConfigured', 'Not configured')}</dd></div>
              <div><dt>{t('common.dueDate', 'Target date')}</dt><dd>{currentProject.target_end_date ? new Date(currentProject.target_end_date).toLocaleDateString() : '—'}</dd></div>
              <div><dt>{t('common.owner', 'Owner')}</dt><dd>{currentProject.owner?.full_name_en || t('common.notConfigured', 'Not configured')}</dd></div>
              <div className={`is-health is-${currentHealth}`}><dt>{t('projects.v11.health', 'Health')}</dt><dd>{t(`projects.v11.health.${currentHealth}`, currentHealth?.replaceAll('_', ' ') || '')}</dd></div>
              <div><dt>{t('projects.v11.linkedRisks', 'Linked risks')}</dt><dd><button type="button" onClick={() => setPage('risks')}>{linkedRisks.length}</button></dd></div>
              <div><dt>{t('projects.v11.milestones', 'Milestones')}</dt><dd>{currentMilestones.length}</dd></div>
              <div><dt>{t('projects.v11.actions', 'Actions / CAPAs')}</dt><dd>{currentTasks.length}</dd></div>
            </dl>
          </div>}
        </DashboardSection></div>
        <div className="span-6"><DashboardSection title={t('projects.v11.portfolioHealth', 'Portfolio health')}>
          {portfolio.loading ? <DashboardWidgetState state="loading" message={t('dashboard.v11.loading', 'Loading…')} /> : portfolio.error ? <DashboardWidgetState state="unavailable" message={portfolio.error} /> : <div className="grc-pipeline">{healthCounts.map(item => <button type="button" className="grc-pipeline__row" data-tone={item.health} key={item.health} onClick={() => { const matching = filteredProjects.find(project => projectHealth(project) === item.health); if (matching) setSelectedProject(matching); }}><span className="grc-pipeline__label"><i aria-hidden="true" />{t(`projects.v11.health.${item.health}`, item.health.replaceAll('_', ' '))}</span><span className="grc-pipeline__track"><span style={{ width: `${(item.count / maximumHealth) * 100}%` }} /></span><strong>{item.count}</strong></button>)}</div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('projects.v11.upcomingMilestones', 'Upcoming milestones')}>
          {!upcomingMilestones.length ? <DashboardWidgetState state={portfolio.loading ? 'loading' : portfolio.error ? 'unavailable' : 'empty'} message={portfolio.error || t('projects.v11.noUpcoming', 'No milestones are due in the next 30 days.')} /> : <div className="grc-dashboard-list">{upcomingMilestones.slice(0, 6).map(item => <button type="button" key={item.id} onClick={() => selectMilestone(item)}><span><strong>{item.title}</strong><small>{filteredProjects.find(project => project.id === item.project_id)?.title}</small></span><em>{item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}</em></button>)}</div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('projects.v11.scheduleExceptions', 'Schedule exceptions')}>
          {!overdueTasks.length ? <DashboardWidgetState state={portfolio.loading ? 'loading' : portfolio.error ? 'unavailable' : 'empty'} message={portfolio.error || t('projects.v11.noExceptions', 'No overdue actions are visible.')} /> : <div className="grc-dashboard-list">{overdueTasks.slice(0, 6).map(item => <button type="button" key={item.id} onClick={() => { const project = filteredProjects.find(row => row.id === item.project_id); if (project) openProject(project); }}><span><strong>{item.title}</strong><small>{item.assignee?.full_name_en || t('common.notConfigured', 'Not configured')}</small></span><em>{item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}</em></button>)}</div>}
        </DashboardSection></div>
        <div className="span-4"><DashboardSection title={t('projects.v11.dependencies', 'Governance dependencies')}>
          {!currentProject ? <DashboardWidgetState state="empty" message={t('projects.v11.selectProject', 'Select a project to view its governed dependencies.')} /> : <div className="grc-dashboard-list"><button type="button" onClick={() => setPage('risks')}><strong>{t('projects.v11.linkedRisks', 'Linked risks')}</strong><em>{linkedRisks.length}</em></button><button type="button" onClick={() => openProject(currentProject)}><strong>{t('projects.v11.openMilestones', 'Open milestones')}</strong><em>{currentMilestones.filter(item => !CLOSED_WORK.has(item.status)).length}</em></button><button type="button" onClick={() => openProject(currentProject)}><strong>{t('projects.v11.openActions', 'Open actions')}</strong><em>{currentTasks.filter(item => !CLOSED_WORK.has(item.status)).length}</em></button></div>}
        </DashboardSection></div>
        <div className="span-12"><DashboardSection title={t('projects.v11.recentActivity', 'Recent project activity')}><DashboardWidgetState state="unavailable" message={t('projects.v11.activityUnavailable', 'No trustworthy cross-project activity feed is configured; open a project control file for its governed detail.')} /></DashboardSection></div>
      </div>

      <Modal open={formOpen} title={t('projects.v11.createActionPlan', 'Create controlled action plan')} onClose={() => setFormOpen(false)}>
        <ActionPlanForm organizationId={organizationId} departments={references.data?.departments || []} profiles={references.data?.profiles || []} onCancel={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); void portfolio.refresh(); }} />
      </Modal>
      <Modal open={detailOpen} title={t('projects.v11.controlFile', 'Project control file')} onClose={() => setDetailOpen(false)}>
        {selectedProject ? <ProjectDetail project={selectedProject} profiles={references.data?.profiles || []} /> : null}
      </Modal>
    </section>
  );
}
