import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_FILTERS,
  EXECUTIVE_WIDGETS,
  auditDashboardMetricState,
  dashboardDestinationSearch,
  dashboardDestinationUrl,
  dashboardPeriodWindow,
  filterDashboardAuditFindings,
  filterDashboardCapa,
  filterDashboardCompliance,
  filterDashboardProjects,
  filterDashboardRisks,
  projectInPeriod,
  readDashboardFilters,
  type DashboardFilterState,
} from '../../src/dashboard/dashboardFramework';
import type { AuditFindingRow, ComplianceRow, ProjectRow, RiskRow } from '../../src/types/domain';
import type { LiveGrcCapaQueueRow } from '../../src/lib/liveGrcOperatingApi';

const now = new Date('2026-08-11T12:00:00');
const filters = (overrides: Partial<DashboardFilterState> = {}): DashboardFilterState => ({
  ...DEFAULT_DASHBOARD_FILTERS,
  ...overrides,
});

const project = (id: string, overrides: Partial<ProjectRow> = {}): ProjectRow => ({
  id,
  title: id,
  description: null,
  category: 'governance',
  source_type: 'manual',
  owner_id: null,
  sponsor_id: null,
  start_date: '2026-08-01',
  target_end_date: '2026-08-20',
  priority: 'medium',
  risk_level: 'medium',
  status: 'active',
  progress_percent: 50,
  evidence_required: true,
  closure_approval_required: true,
  delay_reason: null,
  ...overrides,
});

const risk = (id: string, overrides: Partial<RiskRow> = {}) => ({
  id,
  risk_code: id,
  title: id,
  description: null,
  category: 'operational',
  owner_id: null,
  likelihood: 3,
  impact: 3,
  inherent_score: 9,
  residual_score: 9,
  risk_level: 'medium',
  response_type: 'reduce',
  status: 'open',
  next_review_date: null,
  ...overrides,
} as RiskRow);

const audit = (id: string, overrides: Partial<AuditFindingRow> = {}) => ({
  id,
  finding_code: id,
  audit_title: 'Audit',
  title: id,
  description: id,
  risk_level: 'medium',
  due_date: '2026-08-10',
  status: 'open',
  progress_percent: 0,
  project_id: null,
  milestone_id: null,
  ...overrides,
} as AuditFindingRow);

const compliance = (id: string, overrides: Partial<ComplianceRow> = {}) => ({
  id,
  compliance_code: id,
  title: id,
  regulatory_body: 'Authority',
  owner_id: null,
  due_date: '2026-08-10',
  expiry_date: null,
  risk_level: 'medium',
  status: 'in_progress',
  ...overrides,
} as ComplianceRow);

const capa = (id: string, overrides: Partial<LiveGrcCapaQueueRow> = {}): LiveGrcCapaQueueRow => ({
  organization_id: 'org-1',
  capa_id: id,
  capa_code: id,
  source_type: 'audit_finding',
  title: id,
  owner_name: null,
  due_date: '2026-08-10',
  capa_status: 'in_progress',
  queue_signal: 'overdue',
  ...overrides,
});

describe('GRC v1.1 dashboard R3 data-truth behavior', () => {
  it('changes every department-capable governed row set', () => {
    expect(filterDashboardProjects([project('a', { department_id: 'd1' }), project('b', { department_id: 'd2' })], filters({ department: 'd1' }), now).map(row => row.id)).toEqual(['a']);
    expect(filterDashboardRisks([risk('a', { department_id: 'd1' }), risk('b', { department_id: 'd2' })], filters({ department: 'd1' })).map(row => row.id)).toEqual(['a']);
    expect(filterDashboardAuditFindings([
      audit('a', { department_id: 'legacy', responsible_department_id: 'd1' }),
      audit('b', { department_id: 'd1', responsible_department_id: 'd2' }),
    ], filters({ department: 'd1' }), now).map(row => row.id)).toEqual(['a']);
    expect(filterDashboardCompliance([compliance('a', { department_id: 'd1' }), compliance('b', { department_id: 'd2' })], filters({ department: 'd1' }), now).map(row => row.id)).toEqual(['a']);
  });

  it('changes every severity-capable governed row set', () => {
    expect(filterDashboardProjects([project('critical', { risk_level: 'critical' }), project('low', { risk_level: 'low' })], filters({ severity: 'critical' }), now).map(row => row.id)).toEqual(['critical']);
    expect(filterDashboardRisks([risk('critical', { risk_level: 'critical' }), risk('low', { risk_level: 'low' })], filters({ severity: 'critical' })).map(row => row.id)).toEqual(['critical']);
    expect(filterDashboardAuditFindings([audit('critical', { risk_level: 'critical' }), audit('low', { risk_level: 'low' })], filters({ severity: 'critical' }), now).map(row => row.id)).toEqual(['critical']);
    expect(filterDashboardCompliance([compliance('critical', { risk_level: 'critical' }), compliance('low', { risk_level: 'low' })], filters({ severity: 'critical' }), now).map(row => row.id)).toEqual(['critical']);
  });

  it('changes every status-capable governed row set without fabricating status values', () => {
    expect(filterDashboardProjects([project('active'), project('closed', { status: 'closed' })], filters({ status: 'closed' }), now).map(row => row.id)).toEqual(['closed']);
    expect(filterDashboardRisks([risk('open'), risk('closed', { status: 'closed' })], filters({ status: 'closed' })).map(row => row.id)).toEqual(['closed']);
    expect(filterDashboardAuditFindings([audit('open'), audit('closed', { status: 'closed' })], filters({ status: 'closed' }), now).map(row => row.id)).toEqual(['closed']);
    expect(filterDashboardCompliance([compliance('open'), compliance('closed', { status: 'closed' })], filters({ status: 'closed' }), now).map(row => row.id)).toEqual(['closed']);
  });

  it('uses inclusive schedule-overlap semantics for project periods', () => {
    const window = dashboardPeriodWindow('today', now);
    expect(window.start.getHours()).toBe(0);
    expect(window.end.getHours()).toBe(23);
    expect(projectInPeriod(project('starts-today', { start_date: '2026-08-11', target_end_date: '2026-08-20' }), 'today', now)).toBe(true);
    expect(projectInPeriod(project('ends-today', { start_date: '2026-08-01', target_end_date: '2026-08-11' }), 'today', now)).toBe(true);
  });

  it('excludes future non-overlapping projects from Today and 30d', () => {
    const future = project('future', { start_date: '2026-09-01', target_end_date: '2026-09-30' });
    expect(projectInPeriod(future, 'today', now)).toBe(false);
    expect(projectInPeriod(future, '30d', now)).toBe(false);
  });

  it('excludes undated projects from a date-filtered metric', () => {
    expect(projectInPeriod(project('undated', { start_date: null, target_end_date: null }), '30d', now)).toBe(false);
  });

  it('uses a single trustworthy date as a point schedule fallback', () => {
    expect(projectInPeriod(project('end-only', { start_date: null, target_end_date: '2026-08-11' }), 'today', now)).toBe(true);
    expect(projectInPeriod(project('start-only', { start_date: '2026-08-11', target_end_date: null }), 'today', now)).toBe(true);
  });

  it('keeps OVR aggregates fixed under every dashboard dimension', () => {
    const ovr = EXECUTIVE_WIDGETS.find(widget => widget.id === 'open-ovr');
    expect(ovr?.allowedDimensions).toEqual([]);
    expect(ovr?.privacy).toBe('aggregate-only');
    expect(ovr?.metricDefinition).toContain('daily snapshot');
  });

  it('maps CAPA widgets to the governed CAPA queue rather than projects', () => {
    const definition = EXECUTIVE_WIDGETS.find(widget => widget.id === 'overdue-capas');
    expect(definition?.source).toBe('v_live_grc_capa_queue');
    expect(definition?.allowedDimensions).toEqual(['period', 'status']);
    expect(definition?.destination).toBeNull();
    expect(filterDashboardCapa([capa('overdue'), capa('future', { due_date: '2026-12-01', queue_signal: 'normal' })], filters(), now).map(row => row.capa_id)).toEqual(['overdue']);
  });

  it('passes no unsupported dashboard parameters to governed destinations', () => {
    expect(dashboardDestinationSearch('risks', { likelihood: '5', impact: '5', department: 'd1' })).toBe('');
    expect(dashboardDestinationSearch('audit', { finding_status: 'open', severity: 'critical' })).toBe('');
    expect(dashboardDestinationSearch('compliance', { due: '30d', domain: 'CBAHI' })).toBe('');
    expect(dashboardDestinationSearch('ovr', { ovr_status: 'open' })).toBe('');
    expect(dashboardDestinationSearch('approvals', { status: 'pending' })).toBe('');
    expect(dashboardDestinationUrl('risks', '/control', { likelihood: '5', department: 'd1' })).toBe('/control?page=risks');
  });

  it('returns malformed or absent dashboard state to exact defaults', () => {
    expect(readDashboardFilters('')).toEqual(DEFAULT_DASHBOARD_FILTERS);
    expect(readDashboardFilters('?period=never&department=%2Fbad&status=unknown&severity=urgent')).toEqual(DEFAULT_DASHBOARD_FILTERS);
  });

  it('does not let a dashboard filter alter source authorization', () => {
    expect(EXECUTIVE_WIDGETS.every(widget => widget.roleRequirement.length > 0)).toBe(true);
    expect(EXECUTIVE_WIDGETS.every(widget => widget.statePolicy === 'independent-loading-empty-error')).toBe(true);
  });

  it('distinguishes a successful empty Audit source from a failed source', () => {
    expect(auditDashboardMetricState([], false, null)).toEqual({ state: 'empty', value: 0 });
    expect(auditDashboardMetricState([], false, 'Audit findings source is unavailable.')).toEqual({ state: 'unavailable', value: null });
  });
});
