import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canAccessPageForUser } from '../../src/auth/authAccess';
import type { AuthRole, AuthRoleAssignment } from '../../src/auth/authTypes';
import {
  DEFAULT_DASHBOARD_FILTERS,
  EXECUTIVE_WIDGETS,
  PROJECT_WIDGETS,
  dashboardCollectionState,
  metricBandLabel,
  projectHealth,
  projectInPeriod,
  projectMatchesStatus,
  readDashboardFilters,
} from '../../src/dashboard/dashboardFramework';
import type { ProjectRow } from '../../src/types/domain';

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const dashboard = source('src/pages/Dashboard.tsx');
const projects = source('src/pages/Projects.tsx');
const components = source('src/components/dashboard/GovernedDashboard.tsx');
const framework = source('src/dashboard/dashboardFramework.ts');
const styles = source('src/styles/dashboard-v11.css');
const api = source('src/lib/grcApi.ts');
const edge = source('supabase/functions/privileged-action/index.ts');
const migration = source('supabase/migrations/194_ovr_executive_analytics_foundation.sql');
const hotfixMigration = source('supabase/migrations/232_hf1_super_admin_dashboard_aggregate_entitlement.sql');
const i18n = source('src/i18n/I18nContext.tsx');

function role(role: AuthRole, scope: AuthRoleAssignment['scope'] = 'global'): AuthRoleAssignment[] {
  return [{ role, scope }];
}

const project = (overrides: Partial<ProjectRow> = {}): ProjectRow => ({
  id: 'project-1',
  title: 'Governed project',
  description: null,
  category: 'quality',
  source_type: 'manual',
  owner_id: null,
  sponsor_id: null,
  start_date: '2026-01-01',
  target_end_date: '2026-06-30',
  priority: 'medium',
  risk_level: 'medium',
  status: 'active',
  progress_percent: 60,
  evidence_required: true,
  closure_approval_required: true,
  delay_reason: null,
  ...overrides,
});

describe('GRC v1.1 governed dashboard contract', () => {
  it.each([
    ['super_admin', true],
    ['executive', true],
    ['governance_admin', true],
    ['department_manager', false],
    ['employee', false],
    ['viewer', false],
  ] as const)('enforces Executive route authorization for %s', (candidate, allowed) => {
    expect(canAccessPageForUser('dashboard', role(candidate), null)).toBe(allowed);
  });

  it('uses one governed OVR dashboard bridge call', () => {
    expect(dashboard.match(/getOvrExecutiveDashboardAnalytics/g)).toHaveLength(2);
    expect(api).toContain("'ovr_executive_dashboard_analytics'");
    expect(dashboard).not.toMatch(/from\(['\"]ovr_reports['\"]\)/);
  });

  it('routes the bridge through the service client and two fixed shapes', () => {
    expect(edge).toContain("if (action === 'ovr_executive_dashboard_analytics')");
    expect(edge).toMatch(/serviceClient\.rpc\(\s*'refresh_ovr_executive_analytics_snapshot_v1'/);
    expect(edge).toContain("p_query_shape: 'headline_current_period'");
    expect(edge).toContain("p_query_shape: 'monthly_trend_12'");
    expect(edge).not.toContain("browserClient.rpc('ovr_executive_analytics_v1'");
  });

  it('keeps aggregate filters fixed and server-derived', () => {
    const handler = edge.slice(edge.indexOf("if (action === 'ovr_executive_dashboard_analytics')"), edge.indexOf("if (patch22RiskActions.has(action))"));
    expect(handler).toContain('p_department_filter_id: null');
    expect(handler).toContain('p_category_filter: null');
    expect(handler).not.toContain('organization_id');
  });

  it('declares every Executive KPI destination', () => {
    expect(EXECUTIVE_WIDGETS.map(item => item.destination)).toEqual(['ovr', 'risks', null, 'audit', 'compliance', 'accreditationHub']);
  });

  it('marks OVR analytics aggregate-only', () => {
    expect(EXECUTIVE_WIDGETS.find(item => item.id === 'open-ovr')?.privacy).toBe('aggregate-only');
    expect(EXECUTIVE_WIDGETS.find(item => item.id === 'open-ovr')?.allowedDimensions).toEqual([]);
    expect(EXECUTIVE_WIDGETS.find(item => item.id === 'open-ovr')?.roleRequirement).toBe('dashboard-aggregate/global');
  });

  it('authorizes only active global Executive and Super Admin aggregate roles', () => {
    expect(hotfixMigration).toContain("ur.role in ('executive', 'super_admin')");
    expect(hotfixMigration).toContain("ur.scope = 'global'");
    expect(hotfixMigration).toContain('ur.is_active');
    expect(hotfixMigration).toContain('public.patch83u_role_assignment_valid(');
    expect(hotfixMigration).toContain('if v_entitlement_count < 1 then');
    for (const excluded of ['governance_admin', 'division_head', 'department_manager', 'employee', 'viewer']) {
      expect(hotfixMigration).not.toContain(`'${excluded}'`);
    }
  });

  it('keeps the aggregate resolver private and raw OVR policies unchanged', () => {
    expect(hotfixMigration).toContain('revoke all on function ovr_v11_private.executive_actor_organization(uuid)');
    expect(hotfixMigration).toContain('from public, anon, authenticated, service_role');
    expect(hotfixMigration).not.toMatch(/create policy|alter policy|drop policy|grant select on public\.ovr_reports/i);
    expect(hotfixMigration).toContain('grants no raw OVR access');
  });

  it('does not return raw identifiers in the aggregate payload type or page', () => {
    const analyticsType = source('src/types/domain.ts').split('export interface OvrExecutiveHeadlineAnalytics')[1].split('export interface CriticalAttentionItem')[0];
    expect(analyticsType).not.toMatch(/report_id|patient|narrative|evidence_path|incident_timestamp/);
    expect(dashboard).not.toContain('snapshot.snapshot_id');
  });

  it('renders unavailable instead of a false configured accreditation value', () => {
    expect(dashboard).toMatch(/accreditationReadiness[\s\S]*value=\{null\}[\s\S]*state="unavailable"/);
  });

  it('renders loading, empty, restricted, suppressed, and unavailable states', () => {
    for (const state of ['loading', 'empty', 'restricted', 'suppressed', 'unavailable']) expect(components).toContain(state);
    expect(components).toContain('grc-dashboard-skeleton');
  });

  it('keeps failed widget retry local to its source', () => {
    expect(dashboard).toContain('onRetry={() => void analytics.refresh()}');
    expect(dashboard).toContain('onRetry={() => void portfolio.refresh()}');
    expect(dashboard).toContain('onRetry={() => void risks.refresh()}');
    expect(dashboard).toContain('onRetry={() => void compliance.refresh()}');
    expect(dashboard).toContain('onRetry={() => void approvals.refresh()}');
    expect(dashboard).toContain('onRetry={() => void recentActivity.refresh()}');
    expect(dashboard).toContain('onRetry={() => void auditFindings.refresh()}');
  });

  it('distinguishes a true zero from a failed governed read', () => {
    expect(dashboardCollectionState([], false, null)).toBe('empty');
    expect(dashboardCollectionState([], false, 'permission denied')).toBe('unavailable');
    expect(dashboardCollectionState([{ id: 'visible' }], false, null)).toBe('loaded');
    expect(dashboardCollectionState([], true, null)).toBe('loading');
    expect(dashboard).toContain("getRisks({ throwOnError: true })");
    expect(dashboard).toContain("getComplianceItems({ throwOnError: true })");
    expect(dashboard).toContain("getApprovals({ throwOnError: true })");
  });

  it('uses the canonical responsible-department relationship for Audit findings', () => {
    expect(api).toContain("AUDIT_FINDINGS_DEPARTMENT_RELATIONSHIP = 'audit_findings_responsible_department_id_fkey'");
    expect(api).toContain('departments!${AUDIT_FINDINGS_DEPARTMENT_RELATIONSHIP}(name_en,name_ar)');
    expect(api).not.toContain(".select('*, departments(name_en,name_ar), owner:profiles!audit_findings_owner_id_fkey");
  });

  it('keeps Audit KPI and coverage on one filtered population and preserves source failure', () => {
    expect(dashboard.match(/const filteredAudit =/g)).toHaveLength(1);
    expect(dashboard.match(/const openAudit = filteredAudit/g)).toHaveLength(1);
    expect(dashboard).toContain('auditDashboardMetricState(openAudit, auditFindings.loading, auditFindings.error)');
    expect(dashboard).toContain('auditFindings.error ? <DashboardWidgetState state="unavailable"');
  });

  it('parses allowlisted filter values and rejects an invalid period', () => {
    expect(readDashboardFilters('?period=qtd&department=dep-1&status=active&severity=high')).toEqual({ period: 'qtd', department: 'dep-1', status: 'active', severity: 'high' });
    expect(readDashboardFilters('?period=arbitrary')).toEqual(DEFAULT_DASHBOARD_FILTERS);
    expect(readDashboardFilters('?status=sql&severity=unknown&department=%3Cscript%3E')).toEqual(DEFAULT_DASHBOARD_FILTERS);
  });

  it('implements URL-backed reset without leaking dashboard route state', () => {
    expect(framework).toContain('window.history.replaceState');
    expect(dashboard).toContain('writeDashboardFilters(next)');
    expect(dashboard).toContain('dashboardDestinationUrl(page, window.location.pathname, routeFilters)');
    expect(dashboard).toContain('window.history.pushState');
    expect(projects).toContain('writeDashboardFilters(next)');
  });

  it('maps all four Project KPIs to governed sources', () => {
    expect(PROJECT_WIDGETS.map(item => item.source)).toEqual(['projects', 'projects', 'milestones', 'tasks']);
    expect(PROJECT_WIDGETS.every(item => item.privacy === 'role-scoped')).toBe(true);
  });

  it.each([
    [{ status: 'closed' }, 'completed'],
    [{ status: 'delayed' }, 'delayed'],
    [{ status: 'at_risk' }, 'at_risk'],
    [{ risk_level: 'critical' }, 'at_risk'],
    [{ risk_level: 'high' }, 'watch'],
    [{ progress_percent: 80 }, 'on_track'],
  ] as const)('derives project health without fabricated fields', (overrides, expected) => {
    expect(projectHealth(project(overrides as Partial<ProjectRow>))).toBe(expected);
  });

  it('does not invent project phase, forecast, or baseline values', () => {
    expect(projects).toContain("t('common.notConfigured', 'Not configured')");
    expect(projects).not.toMatch(/mock|sample|forecast_date|planned_end/);
    expect(components).not.toMatch(/forecast_date|planned_end/);
  });

  it('supports project and milestone Gantt interactions', () => {
    expect(components).toContain('onProject(project)');
    expect(components).toContain('onMilestone(milestone)');
    expect(projects).toContain('onProject={openProject}');
    expect(projects).toContain('onMilestone={selectMilestone}');
  });

  it('provides Month, Quarter, Half-Year, Year, and Today controls', () => {
    for (const range of ["'month'", "'quarter'", "'half'", "'year'"]) expect(components).toContain(range);
    expect(components).toContain('CalendarDays');
  });

  it('keeps governed module destinations interactive without a false CAPA destination', () => {
    expect(dashboard).toContain("navigate('risks'");
    expect(dashboard).not.toContain("navigate('projects', { status:");
    expect(dashboard).toContain("navigate('compliance'");
    expect(dashboard).toContain("navigate('approvals')");
  });

  it('uses the trusted recent-activity view and keeps true empty distinct from unavailable', () => {
    expect(dashboard).toContain("getRecentGovernedActivity({ throwOnError: true })");
    expect(api).toContain(".from('v_recent_governed_activity')");
    expect(dashboard).toContain('No recent governed activity is visible in your scope.');
    expect(dashboard).toContain('Recent governed activity is temporarily unavailable.');
    expect(dashboard).not.toContain('No trusted cross-module activity feed is configured');
    expect(projects).toContain('No trustworthy cross-project activity feed is configured');
  });

  it('distinguishes aggregate authorization denial from aggregate unavailability', () => {
    expect(dashboard).toContain("analytics.errorCode === 'OVR_EXECUTIVE_ANALYTICS_ACCESS_RESTRICTED'");
    expect(dashboard).toContain('Dashboard aggregate access is restricted for this account.');
    expect(dashboard).toContain('The privacy-safe dashboard aggregate is temporarily unavailable.');
  });

  it('keeps period filtering deterministic', () => {
    expect(projectInPeriod(project({ start_date: '2026-05-01', target_end_date: '2026-06-01' }), '30d', new Date('2026-05-15T12:00:00Z'))).toBe(true);
    expect(projectInPeriod(project({ target_end_date: '2025-01-01' }), 'ytd', new Date('2026-05-15T12:00:00Z'))).toBe(false);
  });

  it('maps the new analytics action to generic client errors while retaining server diagnostics', () => {
    const handler = edge.slice(edge.indexOf("if (action === 'ovr_executive_dashboard_analytics')"), edge.indexOf('if (patch22RiskActions.has(action))'));
    expect(handler).toContain('OVR_EXECUTIVE_ANALYTICS_UNAVAILABLE');
    expect(handler).toContain("console.error('OVR executive analytics");
    expect(handler).not.toMatch(/error:\s*(?:snapshotError|analyticsError)\.message/);
  });

  it('keeps active and attention Project KPI drill filters aligned with their definitions', () => {
    expect(projectMatchesStatus(project({ status: 'delayed' }), 'operating')).toBe(true);
    expect(projectMatchesStatus(project({ status: 'delayed' }), 'attention')).toBe(true);
    expect(projectMatchesStatus(project({ status: 'closed' }), 'operating')).toBe(false);
  });

  it('uses non-exact privacy labels unchanged', () => {
    expect(metricBandLabel({ state: 'suppressed', label: 'Suppressed', suppressed: true }, '—')).toBe('Suppressed');
    expect(metricBandLabel(null, '—')).toBe('—');
  });

  it('supports light and dark through one theme-aware component system', () => {
    expect(styles).toContain('.dark .grc-dashboard');
    expect(styles).toContain('@media (prefers-color-scheme:dark)');
    expect(styles.match(/^\.grc-dashboard \{/gm)).toHaveLength(1);
  });

  it('supports tablet and mobile layouts', () => {
    expect(styles).toContain('@media (max-width:1100px)');
    expect(styles).toContain('@media (max-width:760px)');
    expect(styles).toContain('@media (max-width:480px)');
  });

  it('respects reduced motion', () => {
    expect(styles).toContain('@media (prefers-reduced-motion:reduce)');
    expect(styles).toContain('animation:none!important');
    expect(styles).toContain('transition:none!important');
  });

  it('keeps Gantt chronology logical in RTL', () => {
    expect(styles).toContain('.grc-gantt__track');
    expect(styles).toContain('direction:ltr');
    expect(components).toContain('insetInlineStart');
  });

  it('has Arabic translations for every dashboard namespace key used in runtime pages', () => {
    const keys = Array.from(`${dashboard}\n${projects}\n${components}`.matchAll(/t\('((?:dashboard|projects)\.v11\.[^']+)'/g), match => match[1]);
    for (const key of new Set(keys)) expect(i18n, key).toContain(`'${key}': { en:`);
  });

  it('uses native buttons, labels, focus-visible styles, and aria state', () => {
    expect(components).not.toMatch(/<div[^>]+onClick=/);
    expect(components).toContain('aria-pressed={view === option}');
    expect(components).toContain('<label>');
    expect(styles).toContain(':focus-visible');
  });

  it('keeps Executive raw OVR policy removed while preserving operational branches', () => {
    const policy = migration.slice(migration.indexOf('drop policy if exists ovr_reports_read_related'), migration.indexOf('-- These legacy browser views'));
    expect(policy).toContain('drop policy if exists ovr_reports_read_related on public.ovr_reports');
    expect(policy).not.toContain("ur.role = 'executive'");
    expect(policy).toContain("'governance_admin'");
    expect(policy).toContain("'auditor'");
  });

  it('keeps aggregate browser execution denied and service execution explicit', () => {
    expect(migration).toContain('revoke all on function public.ovr_executive_analytics_v1');
    expect(migration).toContain('grant execute on function public.ovr_executive_analytics_v1');
    expect(migration).toContain('to service_role');
  });
});
