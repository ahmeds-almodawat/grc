import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  FileCheck2,
  Filter,
  Flag,
  FolderKanban,
  Gauge,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import type { PageKey } from '../components/Layout';
import { ActionPlanForm } from '../components/ActionPlanForm';
import { DataState } from '../components/DataState';
import { Modal } from '../components/Modal';
import { ProjectDetail } from '../components/ProjectDetail';
import { PortfolioGantt } from '../components/dashboard/GovernedDashboard';
import { useAuth } from '../auth/AuthProvider';
import { projectHealth } from '../dashboard/dashboardFramework';
import { useAsyncData } from '../hooks/useAsyncData';
import { useI18n } from '../i18n/I18nContext';
import {
  getApprovals,
  getDepartments,
  getEvidencePackIndex,
  getOrganizations,
  getPortfolioMilestones,
  getPortfolioTasks,
  getProjectCapaLinks,
  getProjects,
  getRisks,
  type ProjectCapaLinkRow,
} from '../lib/grcApi';
import { formatDate, humanize } from '../lib/format';
import type { MilestoneRow, ProjectRow } from '../types/domain';

type WorkspaceView = 'overview' | 'register' | 'programs' | 'timeline' | 'resources' | 'reports' | 'risks' | 'benefits' | 'analytics' | 'approval' | 'detail';
type DetailTab = 'overview' | 'timeline' | 'milestones' | 'tasks' | 'governance' | 'risks' | 'evidence' | 'activity';

interface ProjectPortfolioCenterProps {
  setPage: (page: PageKey) => void;
}

interface ProgramGroup {
  key: string;
  projects: ProjectRow[];
  progress: number;
  atRisk: number;
}

const CLOSED_STATUSES = new Set(['closed', 'cancelled']);
const COMPLETE_WORK = new Set(['closed', 'approved', 'cancelled']);

function localizedName(language: 'en' | 'ar', value?: { full_name_en: string | null; full_name_ar: string | null } | null) {
  if (!value) return null;
  return language === 'ar' ? value.full_name_ar || value.full_name_en : value.full_name_en || value.full_name_ar;
}

function statusLabel(project: ProjectRow, language: 'en' | 'ar') {
  const health = projectHealth(project);
  const labels = {
    en: { draft: 'Not started', on_track: 'On track', watch: 'Watch', at_risk: 'At risk', delayed: 'Delayed', completed: 'Completed', cancelled: 'Cancelled' },
    ar: { draft: 'لم يبدأ', on_track: 'على المسار', watch: 'تحت المراقبة', at_risk: 'معرض للخطر', delayed: 'متأخر', completed: 'مكتمل', cancelled: 'ملغي' },
  };
  if (project.status === 'draft') return labels[language].draft;
  if (project.status === 'cancelled') return labels[language].cancelled;
  return labels[language][health];
}

function healthTone(project: ProjectRow) {
  if (project.status === 'draft') return 'neutral';
  if (project.status === 'cancelled') return 'neutral';
  const health = projectHealth(project);
  if (health === 'completed' || health === 'on_track') return 'good';
  if (health === 'watch') return 'warning';
  return 'danger';
}

function sourceRoute(sourceType: string): PageKey | null {
  if (sourceType === 'risk') return 'risks';
  if (sourceType === 'audit_finding') return 'audit';
  if (sourceType === 'compliance_requirement') return 'compliance';
  if (sourceType === 'incident_ovr') return 'ovr';
  if (sourceType === 'policy_gap') return 'documents';
  if (sourceType === 'capa') return 'capa';
  if (sourceType === 'evidence') return 'evidence';
  return null;
}

function sourceDisplay(sourceType: string, referenceId: string | null | undefined, language: 'en' | 'ar') {
  const labels: Record<string, [string, string]> = {
    risk: ['Risk treatment', 'معالجة مخاطر'],
    audit_finding: ['Audit finding', 'ملاحظة تدقيق'],
    compliance_requirement: ['Compliance remediation', 'معالجة امتثال'],
    incident_ovr: ['OVR corrective action', 'إجراء تصحيحي لواقعة'],
    policy_gap: ['Policy / SOP review', 'مراجعة سياسة أو إجراء'],
    strategic_goal: ['Strategic initiative', 'مبادرة استراتيجية'],
    capa: ['CAPA', 'إجراء تصحيحي ووقائي'],
    manual: ['Management initiative', 'مبادرة إدارية'],
  };
  const label = labels[sourceType]?.[language === 'ar' ? 1 : 0] || humanize(sourceType);
  return referenceId ? `${label} · ${referenceId.slice(0, 12)}` : label;
}

function Metric({ icon, label, value, note, tone = 'neutral' }: { icon: ReactNode; label: string; value: string | number; note: string; tone?: string }) {
  return <article className={`ui6-metric ui6-tone--${tone}`}><span className="ui6-metric__icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return <div className="ui6-empty"><FolderKanban size={24} /><strong>{title}</strong><p>{body}</p></div>;
}

function StatusChip({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`ui6-chip ui6-tone--${tone}`}>{children}</span>;
}

export function ProjectPortfolioCenter({ setPage }: ProjectPortfolioCenterProps) {
  const auth = useAuth();
  const { language, t } = useI18n();
  const text = (en: string, ar: string) => language === 'ar' ? ar : en;
  const [view, setView] = useState<WorkspaceView>('overview');
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);

  const data = useAsyncData(async () => {
    const [projects, milestones, tasks, risks, evidence, capaLinks, approvals, departments, organizations] = await Promise.all([
      getProjects(),
      getPortfolioMilestones(),
      getPortfolioTasks(),
      getRisks(),
      getEvidencePackIndex(),
      getProjectCapaLinks().catch(() => [] as ProjectCapaLinkRow[]),
      getApprovals(),
      getDepartments(),
      getOrganizations(),
    ]);
    return { projects, milestones, tasks, risks, evidence, capaLinks, approvals, departments, organizations };
  }, []);

  const canCreateProject = auth.roles.some(role => ['super_admin', 'executive', 'governance_admin', 'division_head', 'department_manager'].includes(role.role));
  const projects = data.data?.projects ?? [];
  const milestones = data.data?.milestones ?? [];
  const tasks = data.data?.tasks ?? [];
  const risks = data.data?.risks ?? [];
  const evidenceRows = data.data?.evidence ?? [];
  const capaLinks = data.data?.capaLinks ?? [];
  const approvals = (data.data?.approvals ?? []).filter(row => row.item_type === 'project');

  const filteredProjects = useMemo(() => projects.filter(project => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [project.title, project.description, project.category, localizedName(language, project.owner), localizedName(language, project.sponsor)].some(value => value?.toLowerCase().includes(query));
    const health = projectHealth(project);
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter || health === statusFilter;
    return matchesSearch
      && matchesStatus
      && (sourceFilter === 'all' || project.source_type === sourceFilter)
      && (departmentFilter === 'all' || project.department_id === departmentFilter);
  }), [departmentFilter, language, projects, search, sourceFilter, statusFilter]);

  const selectedProject = projects.find(project => project.id === selectedProjectId) ?? filteredProjects[0] ?? projects[0] ?? null;
  const selectedMilestones = selectedProject ? milestones.filter(row => row.project_id === selectedProject.id) : [];
  const selectedTasks = selectedProject ? tasks.filter(row => row.project_id === selectedProject.id) : [];
  const selectedRisks = selectedProject ? risks.filter(row => row.source_project_id === selectedProject.id) : [];
  const selectedCapaLinks = selectedProject ? capaLinks.filter(row => row.linked_item_id === selectedProject.id) : [];
  const selectedApprovals = selectedProject ? approvals.filter(row => row.item_id === selectedProject.id) : [];
  const selectedEntityKeys = useMemo(() => {
    if (!selectedProject) return new Set<string>();
    return new Set([
      `project:${selectedProject.id}`,
      ...selectedMilestones.map(row => `milestone:${row.id}`),
      ...selectedTasks.map(row => `task:${row.id}`),
    ]);
  }, [selectedMilestones, selectedProject, selectedTasks]);
  const selectedEvidence = evidenceRows.filter(row => selectedEntityKeys.has(`${row.linked_item_type}:${row.linked_item_id}`));

  const programGroups = useMemo<ProgramGroup[]>(() => {
    const grouped = new Map<string, ProjectRow[]>();
    for (const project of filteredProjects) {
      const key = project.category || 'general';
      grouped.set(key, [...(grouped.get(key) ?? []), project]);
    }
    return [...grouped.entries()].map(([key, rows]) => ({
      key,
      projects: rows,
      progress: rows.length ? Math.round(rows.reduce((sum, row) => sum + (row.progress_percent ?? 0), 0) / rows.length) : 0,
      atRisk: rows.filter(row => ['at_risk', 'delayed'].includes(projectHealth(row))).length,
    })).sort((left, right) => right.projects.length - left.projects.length);
  }, [filteredProjects]);

  const ownerGroups = useMemo(() => {
    const grouped = new Map<string, ProjectRow[]>();
    for (const project of filteredProjects) {
      const key = localizedName(language, project.owner) || text('Unassigned', 'غير مسند');
      grouped.set(key, [...(grouped.get(key) ?? []), project]);
    }
    return [...grouped.entries()].map(([owner, rows]) => ({ owner, rows, load: rows.filter(row => !CLOSED_STATUSES.has(row.status)).length }));
  }, [filteredProjects, language]);

  const active = filteredProjects.filter(row => !CLOSED_STATUSES.has(row.status));
  const onTrack = filteredProjects.filter(row => projectHealth(row) === 'on_track');
  const atRisk = filteredProjects.filter(row => ['at_risk', 'watch'].includes(projectHealth(row)));
  const delayed = filteredProjects.filter(row => projectHealth(row) === 'delayed');
  const overdueTasks = tasks.filter(row => row.due_date && !COMPLETE_WORK.has(row.status) && new Date(`${row.due_date}T23:59:59`).getTime() < Date.now());
  const projectEvidenceCount = evidenceRows.filter(row => ['project', 'milestone', 'task'].includes(row.linked_item_type)).length;
  const averageProgress = active.length ? Math.round(active.reduce((sum, row) => sum + (row.progress_percent ?? 0), 0) / active.length) : 0;

  const tabs: Array<{ id: Exclude<WorkspaceView, 'detail'>; label: string; icon: ReactNode }> = [
    { id: 'overview', label: text('Overview', 'نظرة عامة'), icon: <LayoutDashboard size={16} /> },
    { id: 'register', label: text('Project Register', 'سجل المشاريع'), icon: <ListChecks size={16} /> },
    { id: 'programs', label: text('Programs & Portfolios', 'البرامج والمحافظ'), icon: <FolderKanban size={16} /> },
    { id: 'timeline', label: text('Timeline / Gantt', 'الجدول الزمني'), icon: <CalendarDays size={16} /> },
    { id: 'resources', label: text('Resources', 'الموارد'), icon: <Users size={16} /> },
    { id: 'reports', label: text('Status Reports', 'تقارير الحالة'), icon: <FileCheck2 size={16} /> },
    { id: 'risks', label: text('Risks & Issues', 'المخاطر والمشكلات'), icon: <AlertTriangle size={16} /> },
    { id: 'benefits', label: text('Benefits', 'المنافع'), icon: <Target size={16} /> },
    { id: 'analytics', label: text('Analytics', 'التحليلات'), icon: <BarChart3 size={16} /> },
    { id: 'approval', label: text('Review & Approval', 'المراجعة والاعتماد'), icon: <ClipboardCheck size={16} /> },
  ];

  function openProject(project: ProjectRow, tab: DetailTab = 'overview') {
    setSelectedProjectId(project.id);
    setDetailTab(tab);
    setView('detail');
  }

  function openMilestone(milestone: MilestoneRow) {
    const project = projects.find(row => row.id === milestone.project_id);
    if (project) openProject(project, 'milestones');
  }

  function navigateToSource(sourceType: string) {
    const page = sourceRoute(sourceType);
    if (!page) return;
    const query = new URLSearchParams(window.location.search);
    query.set('page', page);
    window.history.pushState(null, '', `${window.location.pathname}?${query.toString()}`);
    setPage(page);
  }

  const filters = <div className="ui6-filterbar" aria-label={text('Project filters', 'مرشحات المشاريع')}>
    <label className="ui6-search"><Search size={16} /><span className="sr-only">{text('Search projects', 'البحث في المشاريع')}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={text('Search projects, owner, sponsor...', 'ابحث عن مشروع أو مالك أو راع...')} /></label>
    <label><span className="sr-only">{text('Status', 'الحالة')}</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">{text('All statuses', 'كل الحالات')}</option><option value="draft">{text('Not started', 'لم يبدأ')}</option><option value="on_track">{text('On track', 'على المسار')}</option><option value="watch">{text('Watch', 'تحت المراقبة')}</option><option value="at_risk">{text('At risk', 'معرض للخطر')}</option><option value="delayed">{text('Delayed', 'متأخر')}</option><option value="completed">{text('Completed', 'مكتمل')}</option><option value="cancelled">{text('Cancelled', 'ملغي')}</option></select></label>
    <label><span className="sr-only">{text('Source', 'المصدر')}</span><select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}><option value="all">{text('All sources', 'كل المصادر')}</option>{[...new Set(projects.map(row => row.source_type))].map(source => <option value={source} key={source}>{sourceDisplay(source, null, language)}</option>)}</select></label>
    <label><span className="sr-only">{text('Department', 'الإدارة')}</span><select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}><option value="all">{text('All departments', 'كل الإدارات')}</option>{(data.data?.departments ?? []).map(department => <option value={department.id} key={department.id}>{language === 'ar' ? department.name_ar || department.name_en : department.name_en || department.name_ar}</option>)}</select></label>
    <button type="button" className="ui6-icon-button" title={text('Clear filters', 'مسح المرشحات')} onClick={() => { setSearch(''); setStatusFilter('all'); setSourceFilter('all'); setDepartmentFilter('all'); }}><Filter size={17} /></button>
  </div>;

  const projectRows = <div className="ui6-project-table" role="table" aria-label={text('Project register', 'سجل المشاريع')}>
    <div className="ui6-project-row ui6-project-row--head" role="row"><span>{text('Project', 'المشروع')}</span><span>{text('Program group', 'مجموعة البرنامج')}</span><span>{text('Owner', 'المالك')}</span><span>{text('Health', 'الحالة')}</span><span>{text('Progress', 'التقدم')}</span><span>{text('End date', 'تاريخ الانتهاء')}</span></div>
    {filteredProjects.map(project => <button type="button" className="ui6-project-row" role="row" key={project.id} onClick={() => openProject(project)}>
      <span><strong>{project.title}</strong><small>{sourceDisplay(project.source_type, project.source_reference_id, language)}</small></span>
      <span>{humanize(project.category)}</span>
      <span>{localizedName(language, project.owner) || text('Unassigned', 'غير مسند')}</span>
      <span><StatusChip tone={healthTone(project)}>{statusLabel(project, language)}</StatusChip>{project.status === 'delayed' && project.delay_reason ? <small className="ui6-delay-copy">{project.delay_reason}</small> : null}</span>
      <span className="ui6-progress-cell"><span><i style={{ width: `${project.progress_percent ?? 0}%` }} /></span><strong>{project.progress_percent ?? 0}%</strong></span>
      <span>{formatDate(project.target_end_date)}</span>
    </button>)}
  </div>;

  function detailContent() {
    if (!selectedProject) return <EmptyPanel title={text('No project selected', 'لم يتم اختيار مشروع')} body={text('Choose a visible project from the register.', 'اختر مشروعاً ظاهراً من السجل.')} />;
    const directSourceRoute = sourceRoute(selectedProject.source_type);
    const sourceRows = [
      ...(selectedProject.source_type !== 'manual' || selectedProject.source_reference_id ? [{ type: selectedProject.source_type, id: selectedProject.source_reference_id, label: sourceDisplay(selectedProject.source_type, selectedProject.source_reference_id, language) }] : []),
      ...selectedCapaLinks.map(link => ({ type: 'capa', id: link.capa_id, label: `${link.capa_code || 'CAPA'} · ${link.capa_title}` })),
    ];
    return <div className="ui6-detail" data-testid="ui6-project-detail">
      <button type="button" className="ui6-back" onClick={() => setView('register')}><ArrowLeft size={16} />{text('Project register', 'سجل المشاريع')}</button>
      <header className="ui6-record-header"><div><span>{sourceDisplay(selectedProject.source_type, selectedProject.source_reference_id, language)}</span><h1>{selectedProject.title}</h1><p>{selectedProject.description || text('No project description recorded.', 'لم يسجل وصف للمشروع.')}</p><div className="ui6-record-tags"><StatusChip tone={healthTone(selectedProject)}>{statusLabel(selectedProject, language)}</StatusChip><StatusChip>{humanize(selectedProject.category)}</StatusChip><StatusChip>{humanize(selectedProject.priority)}</StatusChip></div></div><div className="ui6-record-actions"><button type="button" className="ui6-secondary-button" onClick={() => setControlOpen(true)}><ShieldCheck size={16} />{text('Open governed controls', 'فتح الضوابط المحكومة')}</button></div></header>
      <nav className="ui6-subtabs" aria-label={text('Project detail sections', 'أقسام تفاصيل المشروع')}>{(['overview','timeline','milestones','tasks','governance','risks','evidence','activity'] as DetailTab[]).map(tab => <button type="button" className={detailTab === tab ? 'active' : ''} aria-pressed={detailTab === tab} onClick={() => setDetailTab(tab)} key={tab}>{text(humanize(tab), ({ overview: 'نظرة عامة', timeline: 'الجدول الزمني', milestones: 'المراحل', tasks: 'المهام', governance: 'المصدر والحوكمة', risks: 'المخاطر', evidence: 'الأدلة', activity: 'النشاط' } as Record<DetailTab, string>)[tab])}</button>)}</nav>
      {detailTab === 'overview' ? <div className="ui6-detail-grid"><main className="ui6-stack"><section className="ui6-surface"><div className="ui6-section-heading"><div><span>{text('Project Details', 'تفاصيل المشروع')}</span><h2>{text('Accountability and scope', 'المساءلة والنطاق')}</h2></div><FolderKanban size={20} /></div><dl className="ui6-data-grid"><div><dt>{text('Owner', 'المالك')}</dt><dd>{localizedName(language, selectedProject.owner) || text('Unassigned', 'غير مسند')}</dd></div><div><dt>{text('Sponsor', 'الراعي')}</dt><dd>{localizedName(language, selectedProject.sponsor) || text('Not configured', 'غير مهيأ')}</dd></div><div><dt>{text('Department', 'الإدارة')}</dt><dd>{language === 'ar' ? selectedProject.departments?.name_ar || selectedProject.departments?.name_en : selectedProject.departments?.name_en || selectedProject.departments?.name_ar || text('Company-wide', 'على مستوى المنشأة')}</dd></div><div><dt>{text('Start date', 'تاريخ البدء')}</dt><dd>{formatDate(selectedProject.start_date)}</dd></div><div><dt>{text('Target end', 'تاريخ الانتهاء المستهدف')}</dt><dd>{formatDate(selectedProject.target_end_date)}</dd></div><div><dt>{text('Recorded progress', 'التقدم المسجل')}</dt><dd>{selectedProject.progress_percent ?? 0}%</dd></div></dl>{selectedProject.status === 'delayed' ? <div className="ui6-delay"><AlertTriangle size={18} /><div><strong>{text('Delay reason', 'سبب التأخير')}</strong><p>{selectedProject.delay_reason || text('Delay reason required by the governed workflow.', 'سبب التأخير مطلوب حسب سير العمل المحكوم.')}</p></div></div> : null}</section></main><aside className="ui6-stack"><section className="ui6-surface"><div className="ui6-section-heading"><div><span>{text('Delivery status', 'حالة التنفيذ')}</span><h2>{statusLabel(selectedProject, language)}</h2></div><Gauge size={20} /></div><div className="ui6-progress-ring" style={{ '--ui6-progress': `${(selectedProject.progress_percent ?? 0) * 3.6}deg` } as CSSProperties}><strong>{selectedProject.progress_percent ?? 0}%</strong></div><div className="ui6-stat-list"><div><span>{text('Milestones', 'المراحل')}</span><strong>{selectedMilestones.length}</strong></div><div><span>{text('Tasks', 'المهام')}</span><strong>{selectedTasks.length}</strong></div><div><span>{text('Linked evidence', 'الأدلة المرتبطة')}</span><strong>{selectedEvidence.length}</strong></div></div></section></aside></div> : null}
      {detailTab === 'timeline' ? <section className="ui6-surface"><div className="ui6-section-heading"><div><span>{text('Strategic timeline', 'الجدول الاستراتيجي')}</span><h2>{text('Project schedule and milestones', 'جدول المشروع ومراحله')}</h2></div><CalendarDays size={20} /></div><PortfolioGantt projects={[selectedProject]} milestones={selectedMilestones} selectedProjectId={selectedProject.id} onProject={() => setDetailTab('overview')} onMilestone={() => setDetailTab('milestones')} t={t} /></section> : null}
      {detailTab === 'milestones' ? <section className="ui6-surface" data-testid="ui6-project-milestones"><div className="ui6-section-heading"><div><span>{text('Milestones', 'المراحل')}</span><h2>{text('Governed delivery gates', 'بوابات التنفيذ المحكومة')}</h2></div><Flag size={20} /></div><div className="ui6-record-list">{selectedMilestones.map(row => <article key={row.id}><span><strong>{row.title}</strong><small>{localizedName(language, row.owner) || text('Unassigned', 'غير مسند')} · {formatDate(row.due_date)}</small>{row.status === 'delayed' ? <em>{row.delay_reason || text('Delay reason required', 'سبب التأخير مطلوب')}</em> : null}</span><span><StatusChip tone={row.status === 'delayed' || row.status === 'at_risk' ? 'danger' : row.status === 'closed' || row.status === 'approved' ? 'good' : 'neutral'}>{humanize(row.status)}</StatusChip><strong>{row.progress_percent ?? 0}%</strong></span></article>)}</div></section> : null}
      {detailTab === 'tasks' ? <section className="ui6-surface" data-testid="ui6-project-tasks"><div className="ui6-section-heading"><div><span>{text('Tasks', 'المهام')}</span><h2>{text('Controlled execution work', 'أعمال التنفيذ المحكومة')}</h2></div><ListChecks size={20} /></div><div className="ui6-record-list">{selectedTasks.map(row => <article key={row.id}><span><strong>{row.title}</strong><small>{localizedName(language, row.assignee || row.owner) || text('Unassigned', 'غير مسند')} · {formatDate(row.due_date)}</small>{row.status === 'delayed' ? <em>{row.delay_reason || text('Delay reason required', 'سبب التأخير مطلوب')}</em> : null}</span><span><StatusChip tone={row.status === 'delayed' || row.status === 'at_risk' ? 'danger' : row.status === 'closed' || row.status === 'approved' ? 'good' : 'neutral'}>{humanize(row.status)}</StatusChip><strong>{row.progress_percent ?? 0}%</strong></span></article>)}</div></section> : null}
      {detailTab === 'governance' ? <section className="ui6-surface" data-testid="ui6-project-source"><div className="ui6-section-heading"><div><span>{text('Governance / Source', 'الحوكمة والمصدر')}</span><h2>{text('Structured source lineage', 'تسلسل المصدر المنظم')}</h2></div><GitBranch size={20} /></div>{sourceRows.length ? <div className="ui6-lineage-list">{sourceRows.map((row, index) => <div key={`${row.type}:${row.id || index}`}><span className="ui6-lineage-icon"><GitBranch size={16} /></span><div><strong>{row.label}</strong><p>{row.type === 'capa' ? text('This project executes a linked CAPA response without copying the originating record.', 'ينفذ هذا المشروع استجابة مرتبطة بإجراء تصحيحي دون نسخ السجل الأصلي.') : text('Canonical project source relationship retained from the originating governed object.', 'تم الاحتفاظ بعلاقة مصدر المشروع القانونية من الكائن المحكوم الأصلي.')}</p></div>{sourceRoute(row.type) ? <button type="button" className="ui6-link-button" onClick={() => navigateToSource(row.type)}>{text('Open source', 'فتح المصدر')}</button> : null}</div>)}</div> : <EmptyPanel title={text('Management initiative', 'مبادرة إدارية')} body={text('No external governed source is recorded for this project.', 'لا يوجد مصدر محكوم خارجي مسجل لهذا المشروع.')} />}{directSourceRoute ? <p className="ui6-context-note">{text('Source access remains permission-filtered by the destination module.', 'يظل الوصول إلى المصدر مرشحاً حسب صلاحيات الوحدة الوجهة.')}</p> : null}</section> : null}
      {detailTab === 'risks' ? <section className="ui6-surface"><div className="ui6-section-heading"><div><span>{text('Risks & Issues', 'المخاطر والمشكلات')}</span><h2>{text('Linked project risks', 'مخاطر المشروع المرتبطة')}</h2></div><AlertTriangle size={20} /></div>{selectedRisks.length ? <div className="ui6-record-list">{selectedRisks.map(row => <button type="button" onClick={() => navigateToSource('risk')} key={row.id}><span><strong>{row.risk_code || 'RISK'} · {row.title}</strong><small>{humanize(row.category)} · {localizedName(language, row.owner)}</small></span><StatusChip tone={row.risk_level === 'critical' || row.risk_level === 'high' ? 'danger' : 'warning'}>{humanize(row.risk_level)}</StatusChip></button>)}</div> : <EmptyPanel title={text('No linked project risks', 'لا توجد مخاطر مرتبطة')} body={text('Only canonical risks carrying this project as their source are counted here.', 'تحتسب هنا فقط المخاطر القانونية التي تحمل هذا المشروع كمصدر.')} />}</section> : null}
      {detailTab === 'evidence' ? <section className="ui6-surface" data-testid="ui6-project-evidence"><div className="ui6-section-heading"><div><span>{text('Evidence', 'الأدلة')}</span><h2>{text('Project, milestone and task evidence', 'أدلة المشروع والمراحل والمهام')}</h2></div><FileCheck2 size={20} /></div>{selectedEvidence.length ? <div className="ui6-evidence-links">{selectedEvidence.map(row => <article key={`${row.evidence_file_id}:${row.linked_item_type}:${row.linked_item_id}`}><div><strong>{row.evidence_code} · {row.evidence_title || row.file_name}</strong><p>{humanize(row.linked_item_type)} · {row.linked_item_title || row.linked_item_id}</p></div><div><StatusChip tone={row.review_status === 'accepted' ? 'good' : row.review_status === 'rejected' ? 'danger' : 'warning'}>{humanize(row.review_status)}</StatusChip><button type="button" className="ui6-link-button" onClick={() => navigateToSource('evidence')}>{text('Evidence Center', 'مركز الأدلة')}</button></div></article>)}</div> : <EmptyPanel title={text('No visible evidence', 'لا توجد أدلة ظاهرة')} body={text('Evidence access is independently authorized and does not inherit from the project relationship.', 'يتم تفويض الوصول إلى الأدلة بشكل مستقل ولا يورث من علاقة المشروع.')} />}</section> : null}
      {detailTab === 'activity' ? <section className="ui6-surface"><div className="ui6-section-heading"><div><span>{text('Activity', 'النشاط')}</span><h2>{text('Lifecycle snapshot', 'لقطة دورة الحياة')}</h2></div><Activity size={20} /></div><div className="ui6-timeline-list"><div><CircleDot size={15} /><span><strong>{text('Project record created', 'تم إنشاء سجل المشروع')}</strong><small>{formatDate(selectedProject.created_at || selectedProject.start_date)}</small></span></div><div><CircleDot size={15} /><span><strong>{text('Current recorded status', 'الحالة المسجلة الحالية')}</strong><small>{statusLabel(selectedProject, language)} · {selectedProject.progress_percent ?? 0}%</small></span></div>{selectedMilestones.slice(0, 4).map(row => <div key={row.id}><CircleDot size={15} /><span><strong>{row.title}</strong><small>{humanize(row.status)} · {formatDate(row.updated_at || row.due_date)}</small></span></div>)}</div><p className="ui6-context-note">{text('Open governed controls for the authoritative assignment, approval, and evidence history.', 'افتح الضوابط المحكومة لسجل الإسناد والاعتماد والأدلة المعتمد.')}</p></section> : null}
    </div>;
  }

  return <section className="ui6-workspace ui6-projects" data-testid="ui6-projects-workspace">
    {view !== 'detail' ? <>
      <header className="ui6-module-header"><div><span>{text('Projects & Programs', 'المشاريع والبرامج')}</span><h1>{text('Strategic delivery portfolio', 'محفظة التنفيذ الاستراتيجي')}</h1><p>{text('Governed projects, milestones, tasks, source lineage and evidence in one role-scoped workspace.', 'مشاريع ومراحل ومهام ومصادر وأدلة محكومة في مساحة عمل واحدة حسب الصلاحيات.')}</p></div>{canCreateProject ? <button type="button" className="ui6-primary-button" onClick={() => setFormOpen(true)}><Plus size={17} />{text('New project', 'مشروع جديد')}</button> : null}</header>
      <nav className="ui6-workspace-nav" aria-label={text('Projects workspace views', 'عروض مساحة عمل المشاريع')}>{tabs.map(tab => <button type="button" className={view === tab.id ? 'active' : ''} aria-pressed={view === tab.id} onClick={() => setView(tab.id)} key={tab.id}>{tab.icon}<span>{tab.label}</span></button>)}</nav>
      {filters}
    </> : null}
    <DataState loading={data.loading} error={data.error} empty={!data.loading && !data.error && !projects.length} emptyTitle={text('No visible projects', 'لا توجد مشاريع ظاهرة')} emptyMessage={text('No governed project rows are visible in the current role and organization scope.', 'لا توجد سجلات مشاريع محكومة ظاهرة ضمن نطاق الدور والمنشأة الحالي.')}>
      {view === 'overview' ? <div data-testid="ui6-project-overview"><div className="ui6-metric-grid"><Metric icon={<FolderKanban size={20} />} label={text('Active projects', 'المشاريع النشطة')} value={active.length} note={text('Role-scoped portfolio', 'محفظة حسب الصلاحيات')} tone="primary" /><Metric icon={<CheckCircle2 size={20} />} label={text('On track', 'على المسار')} value={onTrack.length} note={text('Healthy delivery', 'تنفيذ سليم')} tone="good" /><Metric icon={<AlertTriangle size={20} />} label={text('At risk', 'معرض للخطر')} value={atRisk.length} note={text('Watch and intervention', 'مراقبة وتدخل')} tone="warning" /><Metric icon={<CalendarDays size={20} />} label={text('Delayed', 'متأخر')} value={delayed.length} note={text('Reason required', 'السبب مطلوب')} tone="danger" /></div><div className="ui6-dashboard-grid"><section className="ui6-surface ui6-span-7"><div className="ui6-section-heading"><div><span>{text('Portfolio status', 'حالة المحفظة')}</span><h2>{text('Recorded progress by project', 'التقدم المسجل حسب المشروع')}</h2></div><BarChart3 size={20} /></div><div className="ui6-bar-list">{filteredProjects.slice(0, 7).map(project => <button type="button" onClick={() => openProject(project)} key={project.id}><span><strong>{project.title}</strong><small>{statusLabel(project, language)}</small></span><span className={`ui6-bar ui6-tone--${healthTone(project)}`}><i style={{ width: `${project.progress_percent ?? 0}%` }} /></span><em>{project.progress_percent ?? 0}%</em></button>)}</div></section><section className="ui6-surface ui6-span-5"><div className="ui6-section-heading"><div><span>{text('Program health', 'صحة البرامج')}</span><h2>{text('Portfolio grouping', 'تجميع المحفظة')}</h2></div><Target size={20} /></div><div className="ui6-stat-list">{programGroups.slice(0, 6).map(group => <button type="button" onClick={() => { setSearch(group.key); setView('programs'); }} key={group.key}><span>{humanize(group.key)}</span><strong>{group.projects.length} · {group.progress}%</strong></button>)}</div><p className="ui6-context-note">{text('Program is presented as the nearest supported project-category grouping; no duplicate Program entity is created.', 'يعرض البرنامج كأقرب تجميع مدعوم لفئة المشروع؛ لم يتم إنشاء كيان برنامج مكرر.')}</p></section><section className="ui6-surface ui6-span-12"><div className="ui6-section-heading"><div><span>{text('Strategic Gantt', 'مخطط جانت الاستراتيجي')}</span><h2>{text('Governed portfolio schedule', 'جدول المحفظة المحكوم')}</h2></div><CalendarDays size={20} /></div><PortfolioGantt projects={filteredProjects} milestones={milestones} selectedProjectId={selectedProject?.id} onProject={openProject} onMilestone={openMilestone} t={t} /></section></div></div> : null}
      {view === 'register' ? <section className="ui6-surface" data-testid="ui6-project-register"><div className="ui6-section-heading"><div><span>{text('Project Register', 'سجل المشاريع')}</span><h2>{text('Role-scoped delivery records', 'سجلات التنفيذ حسب الصلاحيات')}</h2></div><ListChecks size={20} /></div>{filteredProjects.length ? projectRows : <EmptyPanel title={text('No matching projects', 'لا توجد مشاريع مطابقة')} body={text('Adjust the active search or filters.', 'عدّل البحث أو المرشحات النشطة.')} />}</section> : null}
      {view === 'programs' ? <div className="ui6-program-grid" data-testid="ui6-programs">{programGroups.map(group => <section className="ui6-surface" key={group.key}><div className="ui6-program-head"><div><span>{text('Supported portfolio group', 'مجموعة محفظة مدعومة')}</span><h2>{humanize(group.key)}</h2></div><StatusChip tone={group.atRisk ? 'warning' : 'good'}>{group.atRisk ? `${group.atRisk} ${text('need attention', 'تحتاج اهتماماً')}` : text('Healthy', 'سليم')}</StatusChip></div><div className="ui6-program-metrics"><div><span>{text('Projects', 'المشاريع')}</span><strong>{group.projects.length}</strong></div><div><span>{text('Recorded progress', 'التقدم المسجل')}</span><strong>{group.progress}%</strong></div></div><div className="ui6-record-list">{group.projects.map(project => <button type="button" onClick={() => openProject(project)} key={project.id}><span><strong>{project.title}</strong><small>{localizedName(language, project.owner) || text('Unassigned', 'غير مسند')}</small></span><StatusChip tone={healthTone(project)}>{statusLabel(project, language)}</StatusChip></button>)}</div></section>)}</div> : null}
      {view === 'timeline' ? <section className="ui6-surface" data-testid="ui6-project-gantt"><div className="ui6-section-heading"><div><span>{text('Timeline / Gantt Overview', 'نظرة عامة على الجدول الزمني')}</span><h2>{text('Strategic project schedule', 'جدول المشاريع الاستراتيجي')}</h2></div><CalendarDays size={20} /></div><PortfolioGantt projects={filteredProjects} milestones={milestones} selectedProjectId={selectedProject?.id} onProject={openProject} onMilestone={openMilestone} t={t} /><p className="ui6-context-note">{text('Bars use canonical project start/end dates and stored progress. Diamonds are governed milestones.', 'تستخدم الأشرطة تواريخ البدء والانتهاء القانونية والتقدم المسجل. تمثل المعينات مراحل محكومة.')}</p></section> : null}
      {view === 'resources' ? <div className="ui6-dashboard-grid" data-testid="ui6-project-resources"><section className="ui6-surface ui6-span-7"><div className="ui6-section-heading"><div><span>{text('Resource Overview', 'نظرة عامة على الموارد')}</span><h2>{text('Accountable project owners', 'مالكو المشاريع المسؤولون')}</h2></div><Users size={20} /></div><div className="ui6-resource-list">{ownerGroups.map(group => <div key={group.owner}><span><strong>{group.owner}</strong><small>{group.rows.map(row => row.title).join(' · ')}</small></span><span className="ui6-resource-track"><i style={{ width: `${Math.min(100, group.load * 22)}%` }} /></span><em>{group.load}</em></div>)}</div></section><section className="ui6-surface ui6-span-5"><div className="ui6-section-heading"><div><span>{text('Accountability', 'المساءلة')}</span><h2>{text('Sponsor coverage', 'تغطية الرعاة')}</h2></div><ShieldCheck size={20} /></div><div className="ui6-stat-list"><div><span>{text('Projects with sponsor', 'مشاريع لها راع')}</span><strong>{filteredProjects.filter(row => row.sponsor_id).length}</strong></div><div><span>{text('Unassigned owners', 'مالكون غير مسندين')}</span><strong>{filteredProjects.filter(row => !row.owner_id).length}</strong></div><div><span>{text('Open overdue tasks', 'مهام مفتوحة متأخرة')}</span><strong>{overdueTasks.length}</strong></div></div></section></div> : null}
      {view === 'reports' ? <section className="ui6-surface" data-testid="ui6-project-reports"><div className="ui6-section-heading"><div><span>{text('Status Reports', 'تقارير الحالة')}</span><h2>{text('Current governed delivery snapshot', 'لقطة التنفيذ المحكومة الحالية')}</h2></div><FileCheck2 size={20} /></div><div className="ui6-report-summary"><Metric icon={<Gauge size={19} />} label={text('Average active progress', 'متوسط تقدم المشاريع النشطة')} value={`${averageProgress}%`} note={text('Stored project values', 'قيم المشاريع المسجلة')} tone="primary" /><Metric icon={<Flag size={19} />} label={text('Open milestones', 'المراحل المفتوحة')} value={milestones.filter(row => !COMPLETE_WORK.has(row.status)).length} note={text('Across visible scope', 'ضمن النطاق الظاهر')} tone="neutral" /><Metric icon={<ListChecks size={19} />} label={text('Overdue tasks', 'المهام المتأخرة')} value={overdueTasks.length} note={text('Requires accountable action', 'تتطلب إجراء مسؤولاً')} tone="danger" /></div>{projectRows}</section> : null}
      {view === 'risks' ? <section className="ui6-surface" data-testid="ui6-project-risks"><div className="ui6-section-heading"><div><span>{text('Risks & Issues', 'المخاطر والمشكلات')}</span><h2>{text('Canonical project-linked risks', 'المخاطر القانونية المرتبطة بالمشاريع')}</h2></div><AlertTriangle size={20} /></div>{risks.filter(row => row.source_project_id && filteredProjects.some(project => project.id === row.source_project_id)).length ? <div className="ui6-record-list">{risks.filter(row => row.source_project_id && filteredProjects.some(project => project.id === row.source_project_id)).map(row => <button type="button" onClick={() => navigateToSource('risk')} key={row.id}><span><strong>{row.risk_code || 'RISK'} · {row.title}</strong><small>{projects.find(project => project.id === row.source_project_id)?.title}</small></span><StatusChip tone={row.risk_level === 'critical' || row.risk_level === 'high' ? 'danger' : 'warning'}>{humanize(row.risk_level)}</StatusChip></button>)}</div> : <EmptyPanel title={text('No linked project risks', 'لا توجد مخاطر مشاريع مرتبطة')} body={text('This view does not infer issues from project health; it shows only canonical risk records.', 'لا يستنتج هذا العرض مشكلات من صحة المشروع؛ بل يعرض سجلات المخاطر القانونية فقط.')} />}</section> : null}
      {view === 'benefits' ? <section className="ui6-surface" data-testid="ui6-project-benefits"><div className="ui6-section-heading"><div><span>{text('Benefits Realization', 'تحقيق المنافع')}</span><h2>{text('Outcome tracking boundary', 'حدود تتبع النتائج')}</h2></div><Target size={20} /></div><div className="ui6-boundary"><ShieldCheck size={24} /><div><strong>{text('No canonical benefits register is configured', 'لم يتم تهيئة سجل قانوني للمنافع')}</strong><p>{text('UI-6 does not fabricate financial value, benefit targets, or realization percentages. Completed governed projects remain visible below as delivery outcomes only.', 'لا يختلق UI-6 قيمة مالية أو أهداف منافع أو نسب تحقيق. تظهر المشاريع المحكومة المكتملة أدناه كنتائج تنفيذ فقط.')}</p></div></div><div className="ui6-record-list">{filteredProjects.filter(row => projectHealth(row) === 'completed').map(row => <button type="button" onClick={() => openProject(row)} key={row.id}><span><strong>{row.title}</strong><small>{humanize(row.category)}</small></span><StatusChip tone="good">{text('Delivery completed', 'اكتمل التنفيذ')}</StatusChip></button>)}</div></section> : null}
      {view === 'analytics' ? <div className="ui6-dashboard-grid" data-testid="ui6-project-analytics"><section className="ui6-surface ui6-span-7"><div className="ui6-section-heading"><div><span>{text('Analytics & Insights', 'التحليلات والرؤى')}</span><h2>{text('Project distribution by category', 'توزيع المشاريع حسب الفئة')}</h2></div><BarChart3 size={20} /></div><div className="ui6-bar-list">{programGroups.map(group => <div key={group.key}><span><strong>{humanize(group.key)}</strong><small>{group.projects.length} {text('projects', 'مشاريع')}</small></span><span className="ui6-bar"><i style={{ width: `${filteredProjects.length ? (group.projects.length / filteredProjects.length) * 100 : 0}%` }} /></span><em>{group.progress}%</em></div>)}</div></section><section className="ui6-surface ui6-span-5"><div className="ui6-section-heading"><div><span>{text('Evidence coverage', 'تغطية الأدلة')}</span><h2>{text('Visible linked evidence', 'الأدلة المرتبطة الظاهرة')}</h2></div><FileCheck2 size={20} /></div><div className="ui6-stat-list"><div><span>{text('Project evidence links', 'روابط أدلة المشاريع')}</span><strong>{projectEvidenceCount}</strong></div><div><span>{text('Projects with evidence', 'مشاريع لها أدلة')}</span><strong>{new Set(evidenceRows.filter(row => row.linked_item_type === 'project').map(row => row.linked_item_id)).size}</strong></div><div><span>{text('Pending approval', 'بانتظار الاعتماد')}</span><strong>{approvals.filter(row => row.status === 'pending').length}</strong></div></div><p className="ui6-context-note">{text('No completeness percentage is shown because no universal required-evidence denominator exists.', 'لا تعرض نسبة اكتمال لعدم وجود مقام موحد للأدلة المطلوبة.')}</p></section></div> : null}
      {view === 'approval' ? <section className="ui6-surface" data-testid="ui6-project-approval"><div className="ui6-section-heading"><div><span>{text('Submit for Review / Approval', 'إرسال للمراجعة والاعتماد')}</span><h2>{text('Existing project approval records', 'سجلات اعتماد المشاريع القائمة')}</h2></div><ClipboardCheck size={20} /></div>{approvals.length ? <div className="ui6-record-list">{approvals.map(row => <button type="button" onClick={() => { const project = projects.find(projectRow => projectRow.id === row.item_id); if (project) openProject(project); }} key={row.id}><span><strong>{row.item_title}</strong><small>{row.requested_by_name || text('Unknown requester', 'مقدم طلب غير معروف')} · {formatDate(row.requested_at)}</small></span><StatusChip tone={row.status === 'approved' ? 'good' : row.status === 'rejected' ? 'danger' : 'warning'}>{humanize(row.status)}</StatusChip></button>)}</div> : <EmptyPanel title={text('No project approvals visible', 'لا توجد اعتمادات مشاريع ظاهرة')} body={text('Approval records remain in the existing governed approvals workflow; UI-6 does not create a competing workflow.', 'تبقى سجلات الاعتماد ضمن سير الاعتمادات المحكوم القائم؛ لا ينشئ UI-6 سيراً منافساً.')} />}</section> : null}
      {view === 'detail' ? detailContent() : null}
    </DataState>
    <Modal size="large" open={formOpen} isDirty={formDirty} isSubmitting={formSubmitting} title={text('Create controlled project', 'إنشاء مشروع محكوم')} onClose={() => { setFormOpen(false); setFormDirty(false); }}><ActionPlanForm organizationId={data.data?.organizations[0]?.id || ''} departments={data.data?.departments || []} onDirtyChange={setFormDirty} onSubmittingChange={setFormSubmitting} onCancel={() => { setFormOpen(false); setFormDirty(false); }} onCreated={() => { setFormOpen(false); setFormDirty(false); void data.refresh(); }} /></Modal>
    <Modal size="workspace" open={controlOpen} title={text('Project governed controls', 'ضوابط المشروع المحكومة')} onClose={() => setControlOpen(false)}>{selectedProject ? <ProjectDetail project={selectedProject} onProjectUpdated={() => void data.refresh()} /> : null}</Modal>
  </section>;
}
