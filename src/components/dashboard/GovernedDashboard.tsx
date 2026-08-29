import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileWarning,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  Siren,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardFilterState, DashboardPeriod, DashboardSourceState } from '../../dashboard/dashboardFramework';
import { metricBandLabel, projectHealth, trendMetricPlotBand } from '../../dashboard/dashboardFramework';
import type { MilestoneRow, OvrExecutiveTrendAnalytics, ProjectRow } from '../../types/domain';
import { useI18n } from '../../i18n/I18nContext';
import '../../styles/dashboard-v11.css';

type Translate = (key: string, fallback?: string) => string;
type MetricIconName = 'ovr' | 'risk' | 'capa' | 'audit' | 'compliance' | 'accreditation' | 'projects' | 'milestones' | 'actions';

const METRIC_ICONS: Record<MetricIconName, LucideIcon> = {
  ovr: Siren,
  risk: ShieldAlert,
  capa: ClipboardCheck,
  audit: FileWarning,
  compliance: CalendarClock,
  accreditation: BadgeCheck,
  projects: BriefcaseBusiness,
  milestones: Target,
  actions: ListChecks,
};

export function DashboardFilters({ filters, departments, onChange, onReset, t }: {
  filters: DashboardFilterState;
  departments: Array<{ id: string; label: string }>;
  onChange: (filters: DashboardFilterState) => void;
  onReset: () => void;
  t: Translate;
}) {
  const update = <K extends keyof DashboardFilterState>(key: K, value: DashboardFilterState[K]) => onChange({ ...filters, [key]: value });
  return (
    <div className="grc-dashboard-filters" aria-label={t('dashboard.v11.filters', 'Dashboard filters')}>
      <label><span>{t('dashboard.v11.period', 'Period')}</span><select value={filters.period} onChange={event => update('period', event.target.value as DashboardPeriod)}>
        {(['today','7d','30d','mtd','qtd','ytd','12m'] as const).map(period => <option value={period} key={period}>{t(`dashboard.v11.period.${period}`, period.toUpperCase())}</option>)}
      </select></label>
      <label><span>{t('common.department', 'Department')}</span><select value={filters.department} onChange={event => update('department', event.target.value)}>
        <option value="all">{t('dashboard.v11.allDepartments', 'All departments')}</option>
        {departments.map(department => <option value={department.id} key={department.id}>{department.label}</option>)}
      </select></label>
      <label><span>{t('common.status', 'Status')}</span><select value={filters.status} onChange={event => update('status', event.target.value)}>
        <option value="all">{t('dashboard.v11.allStatuses', 'All statuses')}</option>
        {['operating','attention','active','at_risk','delayed','completed_pending_evidence','completed_pending_approval','closed'].map(status => <option value={status} key={status}>{t(`dashboard.v11.status.${status}`, status.replaceAll('_',' '))}</option>)}
      </select></label>
      <label><span>{t('dashboard.v11.severity', 'Severity / priority')}</span><select value={filters.severity} onChange={event => update('severity', event.target.value)}>
        <option value="all">{t('dashboard.v11.allSeverities', 'All severities')}</option>
        {['critical','high','medium','low'].map(level => <option value={level} key={level}>{t(`risk.${level}`, level)}</option>)}
      </select></label>
      <button type="button" className="ghost-button compact-button" onClick={onReset}>{t('dashboard.v11.reset', 'Reset')}</button>
    </div>
  );
}

export function DashboardSection({ title, hint, children, wide = false, className = '' }: { title: string; hint?: string; children: ReactNode; wide?: boolean; className?: string }) {
  return <section className={`grc-dashboard-section${wide ? ' grc-dashboard-section--wide' : ''}${className ? ` ${className}` : ''}`}><header><div><h3>{title}</h3>{hint ? <p>{hint}</p> : null}</div></header>{children}</section>;
}

export function DashboardMetricCard({ label, value, detail, tone = 'neutral', state = 'loaded', onClick, privacyLabel, icon = 'projects' }: {
  label: string;
  value: string | number | null;
  detail?: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
  state?: DashboardSourceState;
  onClick?: () => void;
  privacyLabel?: string;
  icon?: MetricIconName;
}) {
  const Icon = METRIC_ICONS[icon];
  const body = <>
    <span className="grc-metric-card__top"><span className="grc-metric-card__icon" aria-hidden="true"><Icon size={18} /></span><span className={`grc-metric-card__state is-${state}`} aria-hidden="true" /></span>
    <span className="grc-metric-card__label">{label}</span>
    {state === 'loading' ? <span className="grc-dashboard-skeleton grc-dashboard-skeleton--number" /> : <strong className="grc-metric-card__value">{value ?? '—'}</strong>}
    <span className="grc-metric-card__footer">{detail ? <small>{detail}</small> : <span aria-hidden="true" />}{privacyLabel ? <span className="grc-metric-card__privacy"><LockKeyhole size={12} />{privacyLabel}</span> : null}</span>
  </>;
  return onClick
    ? <button type="button" className={`grc-metric-card grc-metric-card--${tone} is-${state}`} onClick={onClick} aria-busy={state === 'loading'}>{body}<ArrowUpRight className="grc-metric-card__arrow" size={16} /></button>
    : <div className={`grc-metric-card grc-metric-card--${tone} is-${state}`} aria-busy={state === 'loading'}>{body}</div>;
}

export function DashboardWidgetState({ state, message, onRetry }: { state: DashboardSourceState; message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  if (state === 'loaded') return null;
  if (state === 'loading') return <div className="grc-widget-state grc-widget-state--loading" role="status" aria-label={message}>
    <span className="grc-dashboard-skeleton grc-dashboard-skeleton--line" />
    <span className="grc-dashboard-skeleton grc-dashboard-skeleton--line is-short" />
    <span className="sr-only">{message}</span>
  </div>;
  const Icon = state === 'restricted' || state === 'suppressed' ? LockKeyhole : AlertTriangle;
  return <div className={`grc-widget-state grc-widget-state--${state}`} role={state === 'unavailable' ? 'alert' : 'status'}><Icon size={18} /><span>{message}</span>{onRetry ? <button type="button" className="ghost-button compact-button" onClick={onRetry}><RefreshCw size={14} />{t('dashboard.v11.retry', 'Retry')}</button> : null}</div>;
}

function PrivacySuppressionNotice({ minimumCellSize, t }: { minimumCellSize: number; t: Translate }) {
  const detail = t('dashboard.v11.privacySuppressionDetail', 'Exact values remain hidden to protect confidentiality.');
  return <div className="grc-safe-trend__privacy-note" role="status" title={detail} aria-label={`${t('dashboard.v11.privacyProtected', 'Privacy protected')}: <${minimumCellSize}. ${detail}`}>
    <span className="grc-safe-trend__privacy-icon" aria-hidden="true"><LockKeyhole size={14} /></span>
    <span className="grc-safe-trend__privacy-copy">
      <span><strong>{`<${minimumCellSize}`}</strong><b>{t('dashboard.v11.privacyProtected', 'Privacy protected')}</b></span>
    </span>
  </div>;
}

export function PrivacySafeTrend({ data, t }: { data: OvrExecutiveTrendAnalytics | null; t: Translate }) {
  const { language } = useI18n();
  const [visibleSeries, setVisibleSeries] = useState({ newReports: true, closedReports: true });
  const [activeBand, setActiveBand] = useState<{ x: number; y: number; label: string; series: string } | null>(null);
  const maximum = useMemo(() => Math.max(1, ...(data?.buckets.flatMap(bucket => [bucket.new_reports, bucket.closed_reports].flatMap(metric => {
    const band = trendMetricPlotBand(metric);
    return band ? [band.upper] : [];
  })) ?? [])), [data]);
  if (!data) return <DashboardWidgetState state="unavailable" message={t('dashboard.v11.sourceUnavailable', 'Source unavailable')} />;
  const minimumCellSize = Number.isInteger(data.privacy.minimum_cell_size) && data.privacy.minimum_cell_size >= 5
    ? data.privacy.minimum_cell_size
    : 5;
  const width = 720;
  const height = 270;
  const plot = { left: 34, right: 16, top: 18, bottom: 42 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const xAt = (index: number) => plot.left + (data.buckets.length <= 1 ? plotWidth / 2 : (index / (data.buckets.length - 1)) * plotWidth);
  const yAt = (value: number) => plot.top + plotHeight - (value / maximum) * plotHeight;
  const pointsFor = (series: 'new_reports' | 'closed_reports') => data.buckets.map((bucket, index) => {
    const metric = bucket[series];
    const band = trendMetricPlotBand(metric);
    return {
      x: xAt(index),
      upperY: band === null ? null : yAt(band.upper),
      lowerY: band === null ? null : yAt(band.lower),
      label: metricBandLabel(metric, '—', minimumCellSize),
      bucket: bucket.bucket_key,
    };
  });
  type TrendPoint = ReturnType<typeof pointsFor>[number];
  const segmentsFor = (points: TrendPoint[]) => points.reduce<TrendPoint[][]>((segments, point) => {
    if (point.upperY === null || point.lowerY === null) return [...segments, []];
    const current = segments[segments.length - 1];
    if (!current) return [[point]];
    current.push(point);
    return segments;
  }, [[]]).filter(segment => segment.length > 0);
  const steppedBoundary = (points: TrendPoint[], edge: 'upperY' | 'lowerY') => points.reduce((path, point, index) => {
    const y = point[edge] as number;
    if (index === 0) return `M ${point.x} ${y}`;
    const previous = points[index - 1];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} H ${midpoint} V ${y} H ${point.x}`;
  }, '');
  const steppedBand = (points: TrendPoint[]) => {
    const upper = steppedBoundary(points, 'upperY');
    const lower = steppedBoundary([...points].reverse(), 'lowerY');
    const last = points[points.length - 1];
    return `${upper} L ${last?.x ?? 0} ${last?.lowerY ?? 0} ${lower.replace(/^M [^ ]+ [^ ]+/, '')} Z`;
  };
  const newPoints = pointsFor('new_reports');
  const closedPoints = pointsFor('closed_reports');
  const hasSuppression = data.buckets.some(bucket => bucket.new_reports.state === 'suppressed' || bucket.closed_reports.state === 'suppressed');
  const hasPlottableData = [...newPoints, ...closedPoints].some(point => point.upperY !== null && point.lowerY !== null);
  const monthLabel = new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short' });
  const toggleSeries = (series: keyof typeof visibleSeries) => setVisibleSeries(current => ({ ...current, [series]: !current[series] }));
  const renderSeries = (points: TrendPoint[], className: 'is-new' | 'is-closed', seriesLabel: string) => <>
    {segmentsFor(points).map((segment, index) => <g className={`grc-safe-trend__series ${className}`} key={`${className}-segment-${index}`}>
      <path className="grc-safe-trend__band" d={steppedBand(segment)} />
      <path className="grc-safe-trend__boundary" d={steppedBoundary(segment, 'upperY')} />
      <path className="grc-safe-trend__boundary is-lower" d={steppedBoundary(segment, 'lowerY')} />
    </g>)}
    {points.map(point => point.upperY === null || point.lowerY === null ? null : <g
      className={`grc-safe-trend__range ${className}`}
      tabIndex={0}
      role="button"
      aria-label={`${seriesLabel}, ${point.bucket}: ${point.label}`}
      onMouseEnter={() => setActiveBand({ x: point.x, y: point.upperY as number, label: point.label, series: seriesLabel })}
      onMouseLeave={() => setActiveBand(null)}
      onFocus={() => setActiveBand({ x: point.x, y: point.upperY as number, label: point.label, series: seriesLabel })}
      onBlur={() => setActiveBand(null)}
      key={`${className}-${point.bucket}`}
    >
      <line x1={point.x} x2={point.x} y1={point.upperY} y2={point.lowerY} />
      <circle cx={point.x} cy={point.upperY} r="3.5" />
      <circle cx={point.x} cy={point.lowerY} r="3.5" />
    </g>)}
  </>;

  if (hasSuppression && !hasPlottableData) return <div className="grc-safe-trend grc-safe-trend--privacy-only" aria-label={t('dashboard.v11.performanceTrend', 'GRC performance trend')}>
    <PrivacySuppressionNotice minimumCellSize={minimumCellSize} t={t} />
  </div>;

  return <div className="grc-safe-trend" aria-label={t('dashboard.v11.performanceTrend', 'GRC performance trend')}>
    {hasSuppression ? <PrivacySuppressionNotice minimumCellSize={minimumCellSize} t={t} /> : null}
    <div className="grc-safe-trend__chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('dashboard.v11.trendHint', '12-month organization summary; dashboard filters do not apply.')}>
        {[0, 0.25, 0.5, 0.75, 1].map(level => <line className="grc-safe-trend__grid" x1={plot.left} x2={width - plot.right} y1={plot.top + plotHeight * level} y2={plot.top + plotHeight * level} key={level} />)}
        {data.buckets.map((bucket, index) => <text className="grc-safe-trend__month" x={xAt(index)} y={height - 12} textAnchor="middle" key={bucket.bucket_key}>{monthLabel.format(new Date(`${bucket.bucket_key}-01T12:00:00`))}</text>)}
        {visibleSeries.newReports ? renderSeries(newPoints, 'is-new', t('dashboard.v11.newReports', 'New reports')) : null}
        {visibleSeries.closedReports ? renderSeries(closedPoints, 'is-closed', t('dashboard.v11.closedReports', 'Closed reports')) : null}
        {activeBand ? <g className="grc-safe-trend__tooltip" transform={`translate(${Math.min(activeBand.x, width - 188)} ${Math.max(4, activeBand.y - 50)})`}><rect width="174" height="38" rx="8" /><text x="10" y="16">{activeBand.series}</text><text x="10" y="31">{activeBand.label} {t('dashboard.v11.reports', 'reports')}</text></g> : null}
      </svg>
    </div>
    <div className="grc-safe-trend__legend">
      <button type="button" className={visibleSeries.newReports ? 'is-active' : ''} aria-pressed={visibleSeries.newReports} onClick={() => toggleSeries('newReports')}><i className="is-new" />{t('dashboard.v11.newReports', 'New reports')}</button>
      <button type="button" className={visibleSeries.closedReports ? 'is-active' : ''} aria-pressed={visibleSeries.closedReports} onClick={() => toggleSeries('closedReports')}><i className="is-closed" />{t('dashboard.v11.closedReports', 'Closed reports')}</button>
      <span><LockKeyhole size={13} />{t('dashboard.v11.bandedValues', 'Protected daily bands')}</span>
    </div>
  </div>;
}

type GanttView = 'month' | 'quarter' | 'half' | 'year';

function datePercent(value: string | null, start: number, span: number) {
  if (!value) return null;
  const timestamp = new Date(`${value}T12:00:00`).getTime();
  return Math.max(0, Math.min(100, ((timestamp - start) / span) * 100));
}

export function PortfolioGantt({ projects, milestones, onProject, onMilestone, t, selectedProjectId = null }: {
  projects: ProjectRow[];
  milestones: MilestoneRow[];
  onProject: (project: ProjectRow) => void;
  onMilestone: (milestone: MilestoneRow) => void;
  t: Translate;
  selectedProjectId?: string | null;
}) {
  const { language } = useI18n();
  const [view, setView] = useState<GanttView>('quarter');
  const now = new Date();
  const months = view === 'month' ? 1 : view === 'quarter' ? 3 : view === 'half' ? 6 : 12;
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + months, 1).getTime();
  const span = end - start;
  const today = Math.max(0, Math.min(100, ((now.getTime() - start) / span) * 100));
  const visible = projects.filter(project => project.start_date || project.target_end_date).slice(0, 12);
  const timelineLabels = Array.from({ length: months }, (_, index) => new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short' }).format(new Date(now.getFullYear(), now.getMonth() + index, 1)));
  return <div className="grc-gantt">
    <div className="grc-gantt__controls" role="group" aria-label={t('dashboard.v11.ganttRange', 'Gantt range')}>
      {(['month','quarter','half','year'] as const).map(option => <button type="button" className={view === option ? 'is-active' : ''} aria-pressed={view === option} onClick={() => setView(option)} key={option}>{t(`dashboard.v11.gantt.${option}`, option)}</button>)}
      <button type="button" onClick={() => setView('month')}><CalendarDays size={14} />{t('dashboard.v11.today', 'Today')}</button>
    </div>
    {visible.length === 0 ? <DashboardWidgetState state="empty" message={t('projects.v11.noSchedule', 'No governed project dates are available.')} /> : <div className="grc-gantt__table">
      <div className="grc-gantt__heading"><span>{t('projects.v11.project', 'Project / program')}</span><span className="grc-gantt__timeline-heading"><span>{t('projects.v11.timeline', 'Timeline')}</span><span className="grc-gantt__months" style={{ gridTemplateColumns: `repeat(${months}, minmax(54px, 1fr))` }}>{timelineLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</span></span></div>
      {visible.map((project, index) => {
        const left = datePercent(project.start_date, start, span) ?? 0;
        const right = datePercent(project.target_end_date, start, span) ?? Math.min(100, left + 8);
        const width = Math.max(2, right - left);
        const projectMilestones = milestones.filter(milestone => milestone.project_id === project.id);
        const health = projectHealth(project);
        const department = language === 'ar' ? project.departments?.name_ar || project.departments?.name_en : project.departments?.name_en || project.departments?.name_ar;
        return <div className={`grc-gantt__row${selectedProjectId === project.id ? ' is-selected' : ''}`} style={{ '--gantt-index': index } as CSSProperties} key={project.id}>
          <button type="button" className="grc-gantt__project" aria-pressed={selectedProjectId === project.id} onClick={() => onProject(project)}><strong>{project.title}</strong><span className="grc-gantt__meta"><span>{department || t('dashboard.v11.companyWide', 'Company-wide')} · {project.progress_percent ?? 0}%</span><em className={`is-${health}`}>{t(`projects.v11.health.${health}`, health.replaceAll('_', ' '))}</em></span></button>
          <div className="grc-gantt__track">
            <span className="grc-gantt__today" style={{ insetInlineStart: `${today}%` }} aria-label={t('dashboard.v11.today', 'Today')} />
            <button type="button" className={`grc-gantt__bar is-${health}${selectedProjectId === project.id ? ' is-selected' : ''}`} style={{ insetInlineStart: `${left}%`, width: `${width}%` }} onClick={() => onProject(project)} title={`${project.title}: ${project.progress_percent ?? 0}%`}><span style={{ width: `${project.progress_percent ?? 0}%` }} /></button>
            {projectMilestones.map(milestone => { const position = datePercent(milestone.due_date, start, span); return position === null ? null : <button type="button" className={`grc-gantt__milestone is-${milestone.status}`} style={{ insetInlineStart: `${position}%` }} onClick={() => onMilestone(milestone)} title={milestone.title} aria-label={`${milestone.title}: ${milestone.due_date}`} key={milestone.id} />; })}
          </div>
        </div>;
      })}
    </div>}
  </div>;
}
