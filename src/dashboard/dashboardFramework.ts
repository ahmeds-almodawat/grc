import type { PageKey } from '../components/Layout';
import type { PrivacySafeMetricBand, ProjectRow } from '../types/domain';

export type DashboardPeriod = 'today' | '7d' | '30d' | 'mtd' | 'qtd' | 'ytd' | '12m';
export type DashboardSourceState = 'loading' | 'loaded' | 'empty' | 'suppressed' | 'restricted' | 'unavailable';
export type DashboardPrivacy = 'standard' | 'role-scoped' | 'aggregate-only';

export interface DashboardFilterState {
  period: DashboardPeriod;
  department: string;
  status: string;
  severity: string;
}

export interface DashboardWidgetDefinition {
  id: string;
  titleKey: string;
  source: string;
  metricDefinition: string;
  allowedDimensions: ReadonlyArray<keyof DashboardFilterState>;
  roleRequirement: string;
  privacy: DashboardPrivacy;
  destination: PageKey | null;
  routeFilters: ReadonlyArray<string>;
  statePolicy: 'independent-loading-empty-error';
  refresh: 'daily-snapshot' | 'on-load' | 'manual';
}

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterState = {
  period: '30d',
  department: 'all',
  status: 'all',
  severity: 'all',
};

const PERIODS = new Set<DashboardPeriod>(['today', '7d', '30d', 'mtd', 'qtd', 'ytd', '12m']);
const STATUSES = new Set([
  'draft', 'pending_approval', 'active', 'at_risk', 'delayed',
  'completed_pending_evidence', 'completed_pending_approval', 'closed',
  'cancelled', 'operating', 'attention',
]);
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const SAFE_DIMENSION = /^[A-Za-z0-9._-]{1,80}$/;

export function readDashboardFilters(search = typeof window === 'undefined' ? '' : window.location.search): DashboardFilterState {
  const query = new URLSearchParams(search);
  const period = query.get('period') as DashboardPeriod | null;
  const department = query.get('department');
  const status = query.get('status');
  const severity = query.get('severity');
  return {
    period: period && PERIODS.has(period) ? period : DEFAULT_DASHBOARD_FILTERS.period,
    department: department && SAFE_DIMENSION.test(department) ? department : 'all',
    status: status && STATUSES.has(status) ? status : 'all',
    severity: severity && SEVERITIES.has(severity) ? severity : 'all',
  };
}

export function writeDashboardFilters(filters: DashboardFilterState) {
  if (typeof window === 'undefined') return;
  const query = new URLSearchParams(window.location.search);
  query.set('period', filters.period);
  for (const key of ['department', 'status', 'severity'] as const) {
    if (filters[key] === 'all') query.delete(key);
    else query.set(key, filters[key]);
  }
  window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
}

export function metricBandLabel(metric: PrivacySafeMetricBand | null | undefined, unavailable: string): string {
  return metric?.label || unavailable;
}

export function projectHealth(project: ProjectRow): 'on_track' | 'watch' | 'at_risk' | 'delayed' | 'completed' {
  if (project.status === 'closed') return 'completed';
  if (project.status === 'delayed') return 'delayed';
  if (project.status === 'at_risk' || project.risk_level === 'critical') return 'at_risk';
  if (project.risk_level === 'high' || (project.progress_percent ?? 0) < 25) return 'watch';
  return 'on_track';
}

export function projectMatchesStatus(project: ProjectRow, status: string): boolean {
  if (status === 'all') return true;
  if (status === 'operating') return !['closed', 'cancelled'].includes(project.status);
  if (status === 'attention') return ['at_risk', 'delayed'].includes(projectHealth(project));
  return project.status === status;
}

export function projectInPeriod(project: ProjectRow, period: DashboardPeriod, now = new Date()): boolean {
  const date = project.target_end_date ? new Date(`${project.target_end_date}T23:59:59`) : null;
  if (!date || Number.isNaN(date.getTime())) return true;
  const start = new Date(now);
  if (period === 'today') start.setHours(0, 0, 0, 0);
  else if (period === '7d') start.setDate(start.getDate() - 7);
  else if (period === '30d') start.setDate(start.getDate() - 30);
  else if (period === 'mtd') start.setDate(1);
  else if (period === 'qtd') start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  else if (period === 'ytd') start.setMonth(0, 1);
  else start.setFullYear(start.getFullYear() - 1);
  start.setHours(0, 0, 0, 0);
  return date >= start;
}

export const EXECUTIVE_WIDGETS: DashboardWidgetDefinition[] = [
  { id: 'open-ovr', titleKey: 'dashboard.v11.openOvr', source: 'ovr_executive_analytics_v1', metricDefinition: 'Privacy-safe open OVR daily snapshot', allowedDimensions: [], roleRequirement: 'executive/global', privacy: 'aggregate-only', destination: 'ovr', routeFilters: ['ovr_status'], statePolicy: 'independent-loading-empty-error', refresh: 'daily-snapshot' },
  { id: 'critical-risks', titleKey: 'dashboard.v11.criticalRisks', source: 'v_executive_grc_summary', metricDefinition: 'Visible critical open risks', allowedDimensions: ['department', 'status', 'severity'], roleRequirement: 'executive page access', privacy: 'role-scoped', destination: 'risks', routeFilters: ['risk_level'], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'overdue-capas', titleKey: 'dashboard.v11.overdueCapas', source: 'v_executive_grc_summary', metricDefinition: 'Visible overdue controlled projects/actions', allowedDimensions: ['department', 'status'], roleRequirement: 'executive page access', privacy: 'role-scoped', destination: 'projects', routeFilters: ['overdue'], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'audit-findings', titleKey: 'dashboard.v11.auditFindings', source: 'v_executive_grc_summary', metricDefinition: 'Visible overdue audit findings', allowedDimensions: ['department', 'status', 'severity'], roleRequirement: 'executive page access', privacy: 'role-scoped', destination: 'audit', routeFilters: ['finding_status'], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'compliance-30', titleKey: 'dashboard.v11.compliance30', source: 'v_executive_grc_summary', metricDefinition: 'Visible incomplete obligations due within 30 days', allowedDimensions: ['department', 'status'], roleRequirement: 'executive page access', privacy: 'role-scoped', destination: 'compliance', routeFilters: ['due'], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'accreditation', titleKey: 'dashboard.v11.accreditationReadiness', source: 'not-configured', metricDefinition: 'No trusted aggregate source is currently available', allowedDimensions: [], roleRequirement: 'executive page access', privacy: 'standard', destination: 'accreditationHub', routeFilters: [], statePolicy: 'independent-loading-empty-error', refresh: 'manual' },
];

export const PROJECT_WIDGETS: DashboardWidgetDefinition[] = [
  { id: 'active-projects', titleKey: 'projects.v11.active', source: 'projects', metricDefinition: 'RLS-visible non-closed projects', allowedDimensions: ['department', 'status'], roleRequirement: 'project page access', privacy: 'role-scoped', destination: 'projects', routeFilters: ['status'], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'at-risk-projects', titleKey: 'projects.v11.atRisk', source: 'projects', metricDefinition: 'RLS-visible at-risk or delayed projects', allowedDimensions: ['department', 'status', 'severity'], roleRequirement: 'project page access', privacy: 'role-scoped', destination: 'projects', routeFilters: ['status', 'severity'], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'milestones-30', titleKey: 'projects.v11.milestones30', source: 'milestones', metricDefinition: 'RLS-visible incomplete milestones due in 30 days', allowedDimensions: ['department', 'status'], roleRequirement: 'project page access', privacy: 'role-scoped', destination: 'projects', routeFilters: ['period'], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'overdue-actions', titleKey: 'projects.v11.overdueActions', source: 'tasks', metricDefinition: 'RLS-visible incomplete overdue tasks', allowedDimensions: ['department', 'status'], roleRequirement: 'project page access', privacy: 'role-scoped', destination: 'projects', routeFilters: ['overdue'], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
];
