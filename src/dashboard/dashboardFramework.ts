import type { PageKey } from '../components/Layout';
import type {
  ApprovalRow,
  AuditFindingRow,
  ComplianceRow,
  CriticalAttentionItem,
  PrivacySafeMetricBand,
  ProjectRow,
  RiskRow,
} from '../types/domain';
import type { LiveGrcCapaQueueRow } from '../lib/liveGrcOperatingApi';
import { pageUrlForLocation } from '../routes/pageLocation';

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

export interface DashboardPeriodWindow {
  start: Date;
  end: Date;
}

function startOfDay(value: Date) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(value: Date) {
  const result = new Date(value);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function dashboardPeriodWindow(period: DashboardPeriod, now = new Date()): DashboardPeriodWindow {
  const start = startOfDay(now);
  const end = endOfDay(now);
  if (period === '7d') start.setDate(start.getDate() - 6);
  else if (period === '30d') start.setDate(start.getDate() - 29);
  else if (period === 'mtd') start.setDate(1);
  else if (period === 'qtd') start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  else if (period === 'ytd') start.setMonth(0, 1);
  else if (period === '12m') {
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
  }
  return { start, end };
}

function governedDate(value: string | null | undefined, endOfDate = false): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T${endOfDate ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateInDashboardPeriod(value: string | null | undefined, period: DashboardPeriod, now = new Date()): boolean {
  const date = governedDate(value, true);
  if (!date) return false;
  const window = dashboardPeriodWindow(period, now);
  return date >= window.start && date <= window.end;
}

export function projectInPeriod(project: ProjectRow, period: DashboardPeriod, now = new Date()): boolean {
  const explicitStart = governedDate(project.start_date);
  const explicitEnd = governedDate(project.target_end_date, true);
  if (!explicitStart && !explicitEnd) return false;
  const projectStart = explicitStart ?? explicitEnd as Date;
  const projectEnd = explicitEnd ?? endOfDay(explicitStart as Date);
  const window = dashboardPeriodWindow(period, now);
  return projectStart <= window.end && projectEnd >= window.start;
}

const TERMINAL_STATUSES = new Set(['closed', 'completed', 'approved', 'cancelled', 'validated']);
const ATTENTION_STATUSES = new Set(['at_risk', 'delayed', 'non_compliant', 'expired', 'due_soon', 'overdue', 'escalated', 'rejected']);

function recordMatchesStatus(status: string | null | undefined, selected: string, severity?: string | null): boolean {
  if (selected === 'all') return true;
  const normalized = String(status ?? '').toLowerCase();
  if (selected === 'operating') return !TERMINAL_STATUSES.has(normalized);
  if (selected === 'attention') {
    return !TERMINAL_STATUSES.has(normalized)
      && (ATTENTION_STATUSES.has(normalized) || ['critical', 'high'].includes(String(severity ?? '').toLowerCase()));
  }
  return normalized === selected;
}

function matchesDepartment(value: string | null | undefined, selected: string) {
  return selected === 'all' || value === selected;
}

function matchesSeverity(value: string | null | undefined, selected: string) {
  return selected === 'all' || String(value ?? '').toLowerCase() === selected;
}

export function filterDashboardProjects(rows: ProjectRow[], filters: DashboardFilterState, now = new Date()) {
  return rows.filter(project => projectInPeriod(project, filters.period, now)
    && matchesDepartment(project.department_id, filters.department)
    && projectMatchesStatus(project, filters.status)
    && matchesSeverity(project.risk_level, filters.severity));
}

export function filterDashboardRisks(rows: RiskRow[], filters: DashboardFilterState) {
  return rows.filter(risk => matchesDepartment(risk.department_id, filters.department)
    && recordMatchesStatus(risk.lifecycle_status ?? risk.status, filters.status, risk.risk_level)
    && matchesSeverity(risk.risk_level, filters.severity));
}

export function filterDashboardAuditFindings(rows: AuditFindingRow[], filters: DashboardFilterState, now = new Date()) {
  return rows.filter(finding => dateInDashboardPeriod(finding.revised_due_date ?? finding.due_date, filters.period, now)
    && matchesDepartment(finding.responsible_department_id, filters.department)
    && recordMatchesStatus(finding.finding_status ?? finding.status, filters.status, finding.severity_level ?? finding.risk_level)
    && matchesSeverity(finding.severity_level ?? finding.risk_level, filters.severity));
}

export function auditDashboardMetricState(
  rows: AuditFindingRow[],
  loading: boolean,
  error: string | null,
): { state: DashboardSourceState; value: number | null } {
  if (loading) return { state: 'loading', value: null };
  if (error) return { state: 'unavailable', value: null };
  return { state: rows.length ? 'loaded' : 'empty', value: rows.length };
}

export function filterDashboardCompliance(rows: ComplianceRow[], filters: DashboardFilterState, now = new Date()) {
  return rows.filter(item => dateInDashboardPeriod(item.expiry_date ?? item.due_date, filters.period, now)
    && matchesDepartment(item.department_id, filters.department)
    && recordMatchesStatus(item.status, filters.status, item.risk_level)
    && matchesSeverity(item.risk_level, filters.severity));
}

export function filterDashboardCapa(rows: LiveGrcCapaQueueRow[], filters: DashboardFilterState, now = new Date()) {
  return rows.filter(item => dateInDashboardPeriod(item.due_date, filters.period, now)
    && recordMatchesStatus(item.capa_status === 'ready_for_retest' ? item.capa_status : item.queue_signal, filters.status));
}

export function filterDashboardApprovals(rows: ApprovalRow[], filters: DashboardFilterState, now = new Date()) {
  return rows.filter(item => dateInDashboardPeriod(item.requested_at, filters.period, now));
}

export function filterDashboardAttention(
  rows: CriticalAttentionItem[],
  filters: DashboardFilterState,
  selectedDepartmentLabel: string | null,
  now = new Date(),
) {
  return rows.filter(item => dateInDashboardPeriod(item.dueDate, filters.period, now)
    && (filters.department === 'all' || (selectedDepartmentLabel !== null && item.department === selectedDepartmentLabel))
    && recordMatchesStatus(item.status, filters.status, item.riskLevel)
    && matchesSeverity(item.riskLevel, filters.severity));
}

export const DASHBOARD_DESTINATION_FILTERS: Partial<Record<PageKey, ReadonlySet<string>>> = {
  ovr: new Set(),
  risks: new Set(),
  audit: new Set(),
  compliance: new Set(),
  projects: new Set(),
  approvals: new Set(),
};

export function dashboardDestinationSearch(page: PageKey, routeFilters: Record<string, string> = {}): string {
  const query = new URLSearchParams();
  const supported = DASHBOARD_DESTINATION_FILTERS[page] ?? new Set<string>();
  for (const [key, value] of Object.entries(routeFilters)) {
    if (supported.has(key) && SAFE_DIMENSION.test(value)) query.set(key, value);
  }
  return query.toString();
}

export function dashboardDestinationUrl(
  page: PageKey,
  pathname: string,
  routeFilters: Record<string, string> = {},
): string {
  const search = dashboardDestinationSearch(page, routeFilters);
  return pageUrlForLocation(page, { pathname, search: search ? `?${search}` : '' });
}

export const EXECUTIVE_WIDGETS: DashboardWidgetDefinition[] = [
  { id: 'open-ovr', titleKey: 'dashboard.v11.openOvr', source: 'ovr_executive_analytics_v1', metricDefinition: 'Privacy-safe open OVR daily snapshot', allowedDimensions: [], roleRequirement: 'executive/global', privacy: 'aggregate-only', destination: 'ovr', routeFilters: ['ovr_status'], statePolicy: 'independent-loading-empty-error', refresh: 'daily-snapshot' },
  { id: 'critical-risks', titleKey: 'dashboard.v11.criticalRisks', source: 'risks', metricDefinition: 'RLS-visible critical risks after supported department/status/severity filters', allowedDimensions: ['department', 'status', 'severity'], roleRequirement: 'executive page access', privacy: 'role-scoped', destination: 'risks', routeFilters: [], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'overdue-capas', titleKey: 'dashboard.v11.overdueCapas', source: 'v_live_grc_capa_queue', metricDefinition: 'RLS-visible governed CAPA rows with overdue queue signal', allowedDimensions: ['period', 'status'], roleRequirement: 'executive page access', privacy: 'role-scoped', destination: null, routeFilters: [], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'audit-findings', titleKey: 'dashboard.v11.auditFindings', source: 'audit_findings', metricDefinition: 'RLS-visible open findings after supported period/department/status/severity filters', allowedDimensions: ['period', 'department', 'status', 'severity'], roleRequirement: 'executive page access', privacy: 'role-scoped', destination: 'audit', routeFilters: [], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'compliance-30', titleKey: 'dashboard.v11.compliance30', source: 'compliance_items', metricDefinition: 'RLS-visible incomplete obligations due in the selected period', allowedDimensions: ['period', 'department', 'status', 'severity'], roleRequirement: 'executive page access', privacy: 'role-scoped', destination: 'compliance', routeFilters: [], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'accreditation', titleKey: 'dashboard.v11.accreditationReadiness', source: 'not-configured', metricDefinition: 'No trusted aggregate source is currently available', allowedDimensions: [], roleRequirement: 'executive page access', privacy: 'standard', destination: 'accreditationHub', routeFilters: [], statePolicy: 'independent-loading-empty-error', refresh: 'manual' },
];

export const PROJECT_WIDGETS: DashboardWidgetDefinition[] = [
  { id: 'active-projects', titleKey: 'projects.v11.active', source: 'projects', metricDefinition: 'RLS-visible non-closed projects in the filtered project population', allowedDimensions: ['period', 'department', 'status', 'severity'], roleRequirement: 'project page access', privacy: 'role-scoped', destination: 'projects', routeFilters: [], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'at-risk-projects', titleKey: 'projects.v11.atRisk', source: 'projects', metricDefinition: 'RLS-visible at-risk or delayed projects in the filtered project population', allowedDimensions: ['period', 'department', 'status', 'severity'], roleRequirement: 'project page access', privacy: 'role-scoped', destination: 'projects', routeFilters: [], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'milestones-30', titleKey: 'projects.v11.milestones30', source: 'milestones', metricDefinition: 'RLS-visible incomplete milestones due in the next 30 days for the filtered project population', allowedDimensions: ['period', 'department', 'status', 'severity'], roleRequirement: 'project page access', privacy: 'role-scoped', destination: 'projects', routeFilters: [], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
  { id: 'overdue-actions', titleKey: 'projects.v11.overdueActions', source: 'tasks', metricDefinition: 'RLS-visible incomplete overdue tasks for the filtered project population', allowedDimensions: ['period', 'department', 'status', 'severity'], roleRequirement: 'project page access', privacy: 'role-scoped', destination: 'projects', routeFilters: [], statePolicy: 'independent-loading-empty-error', refresh: 'on-load' },
];
