import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canAccessPageForUser } from '../../src/auth/authAccess';
import type { AuthRoleAssignment } from '../../src/auth/authTypes';
import { normalizeRosterPageRequest } from '../../supabase/functions/_shared/accV13RosterPaging';

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const modal = source('src/components/Modal.tsx');
const theme = source('src/theme/ThemeContext.tsx');
const styles = source('src/styles.css');
const projects = source('src/pages/Projects.tsx');
const detail = source('src/components/ProjectDetail.tsx');
const controls = source('src/components/WorkItemControls.tsx');
const api = source('src/lib/grcApi.ts');
const edge = source('supabase/functions/privileged-action/index.ts');
const migration = source('supabase/migrations/195_acc_uat_stabilization_controls.sql');
const users = source('src/pages/UserManagementCenter.tsx');
const app = source('src/App.tsx');
const ovr = source('src/pages/OVR.tsx');
const printableOvr = source('src/components/OvrPrintableReport.tsx');
const evidence = source('src/pages/Evidence.tsx');

function role(roleName: AuthRoleAssignment['role']): AuthRoleAssignment[] {
  return [{ role: roleName, scope: 'assigned_only' }];
}

describe('ACC v1.3 UAT stabilization contracts', () => {
  it('defines explicit responsive modal sizes and a scroll-owned body', () => {
    expect(modal).toContain("size?: 'small' | 'medium' | 'large' | 'xl' | 'workspace'");
    expect(styles).toContain('.modal-card--workspace');
    expect(styles).toContain('.modal-body { min-height: 0; overflow: auto;');
    expect(styles).toContain('height: 100dvh');
  });

  it('uses the workspace modal for the OVR and project control files', () => {
    expect(source('src/pages/OVR.tsx')).toContain('<Modal size="workspace"');
    expect(projects).toContain('<Modal size="workspace"');
  });

  it('implements persistent light/dark/system theme semantics with Light default', () => {
    expect(theme).toContain("return 'light'");
    expect(theme).toContain("window.localStorage.setItem(STORAGE_KEY, next)");
    expect(theme).toContain("media.addEventListener('change', update)");
    expect(theme).toContain('root.style.colorScheme = resolvedTheme');
    expect(source('src/main.tsx')).toContain('initializeTheme();');
  });

  it('keeps an assigned employee out of executive pages while admitting the RLS-scoped project shell', () => {
    expect(canAccessPageForUser('projects', role('employee'))).toBe(true);
    expect(canAccessPageForUser('dashboard', role('employee'))).toBe(false);
    expect(canAccessPageForUser('admin', role('employee'))).toBe(false);
  });

  it('does not expose project creation to assigned-only employees', () => {
    expect(projects).toContain('const canCreateProject = auth.roles.some');
    expect(projects).toContain("['super_admin', 'executive', 'governance_admin', 'division_head', 'department_manager']");
    expect(projects).not.toContain("'project_owner'].includes(role.role)");
  });

  it('grants child-control access by exact parent assignment instead of a broad project_owner role', () => {
    expect(migration).toContain('auth.uid() in (p.owner_id, p.sponsor_id, p.created_by)');
    const helper = migration.slice(migration.indexOf('acc_v13_actor_can_control_project'), migration.indexOf('revoke all on function public.acc_v13_actor_can_control_project'));
    expect(helper).not.toContain("'project_owner'");
    expect(detail).toContain('actorId === project.owner_id || actorId === project.sponsor_id || actorId === project.created_by');
  });

  it('limits parent-linked child-table access to SELECT and INSERT without adding direct UPDATE or DELETE', () => {
    expect(migration).toContain('create policy milestones_acc_v13_parent_project_read');
    expect(migration).toContain('create policy milestones_acc_v13_parent_project_insert');
    expect(migration).toContain('create policy tasks_acc_v13_parent_project_read');
    expect(migration).toContain('create policy tasks_acc_v13_parent_project_insert');
    const childPolicies = migration.slice(
      migration.indexOf('drop policy if exists milestones_acc_v13_parent_project_control'),
      migration.indexOf('create or replace view public.v_my_open_work_expanded'),
    );
    expect(childPolicies).not.toContain('for all');
    expect(childPolicies).not.toContain('for update');
    expect(childPolicies).not.toContain('for delete');
  });

  it('places directly assigned and corrective projects into My Work without disclosing OVR data', () => {
    expect(migration).toContain("'project'::text as item_type");
    expect(migration).toContain('auth.uid() in (p.owner_id, p.sponsor_id, p.created_by)');
    const myWork = migration.slice(migration.indexOf('create or replace view public.v_my_open_work_expanded'), migration.indexOf('create or replace function public.acc_v13_update_work_item_status'));
    expect(myWork).not.toContain('ovr_reports');
    expect(myWork).not.toContain('source_reference_id');
  });

  it('routes all three status updates through one protected bridge and proves progress bounds', () => {
    expect(api).toContain("updateGovernedWorkItemStatus('project'");
    expect(api).toContain("updateGovernedWorkItemStatus('milestone'");
    expect(api).toContain("updateGovernedWorkItemStatus('task'");
    expect(api).toContain("invokePrivilegedAction('acc_v13_update_work_item_status'");
    expect(migration).toContain("p_progress_percent < 0 or p_progress_percent > 100");
    expect(migration).toContain("p_status = 'delayed' and v_delay_reason is null");
    expect(migration).toContain("'in_progress'");
  });

  it('preserves rollup triggers by updating canonical milestone/task tables only', () => {
    expect(migration).toContain('update public.milestones');
    expect(migration).toContain('update public.tasks');
    expect(migration).not.toContain('disable trigger');
    expect(migration).not.toContain('alter table public.projects disable');
  });

  it('blocks self-approval in the client and on insert/update in the database', () => {
    const message = 'You cannot approve your own request. Select another authorized approver.';
    expect(controls).toContain(message);
    expect(migration).toContain(message);
    expect(migration).toContain('before insert or update of organization_id, project_id, milestone_id, task_id, requested_by, approver_id');
    expect(edge).toContain("action === 'acc_v13_list_eligible_approvers'");
  });

  it('binds approver discovery and creation to the exact project or child context', () => {
    expect(controls).toContain('getEligibleApprovers({ itemType, itemId })');
    expect(api).toContain("invokePrivilegedAction<ProfileOption[]>('acc_v13_list_eligible_approvers'");
    expect(api).toContain("invokePrivilegedAction<{ id: string; status: string }>('acc_v13_request_approval'");
    expect(api).not.toContain("client.from('approvals').insert");
    expect(edge).toContain("action === 'acc_v13_request_approval'");
    expect(edge).toContain("serviceClient.rpc('acc_v13_list_eligible_approvers'");
    expect(edge).toContain("serviceClient.rpc('acc_v13_request_approval'");
  });

  it('includes only relationship and scope-qualified approvers and excludes unrelated governance roles', () => {
    const eligibility = migration.slice(
      migration.indexOf('create or replace function public.acc_v13_is_eligible_approver'),
      migration.indexOf('create or replace function public.acc_v13_list_eligible_approvers'),
    );
    expect(eligibility).toContain("v_item_type = 'project' and p_approver_id = v_project.sponsor_id");
    expect(eligibility).toContain("v_item_type in ('milestone','task') and p_approver_id in (v_project.owner_id, v_project.sponsor_id)");
    expect(eligibility).toContain("ur.role::text in ('super_admin','governance_admin','executive') and ur.scope::text = 'global'");
    expect(eligibility).toContain("ur.role::text = 'division_head'");
    expect(eligibility).toContain('ur.division_id = v_project.division_id');
    expect(eligibility).toContain("ur.role::text = 'department_manager'");
    expect(eligibility).toContain('ur.department_id = v_project.department_id');
    expect(eligibility).not.toContain('auditor');
    expect(eligibility).not.toContain('compliance_officer');
    expect(eligibility).not.toContain('project_owner');
    expect(eligibility).not.toContain('milestone_owner');
  });

  it('authorizes private evidence per record before issuing a short-lived URL', () => {
    expect(edge).toMatch(/rpc\('acc_v13_authorize_evidence_access'/);
    expect(edge).toContain(".from('grc-evidence')");
    expect(edge).toMatch(/createSignedUrl\([\s\S]*?60,/);
    expect(edge).not.toContain("getPublicUrl(String(accessProof.file_path)");
    expect(source('src/components/GovernedEvidenceAccess.tsx')).toContain('expires after 60 seconds');
    expect(migration).toContain('drop policy if exists evidence_storage_read on storage.objects');
    expect(migration).not.toContain('create policy evidence_storage_read');
  });

  it('requires separate OVR entitlement even for otherwise related evidence', () => {
    expect(migration).toContain('if v_evidence.ovr_report_id is not null then');
    expect(migration).toContain('and p_actor_id in (r.reported_by, r.owner_id, r.supervisor_id, r.quality_reviewer_id)');
    expect(migration).toContain('if not v_allowed or not v_ovr_allowed then');
  });

  it('provides audited view/download intent without exposing storage paths to the UI', () => {
    expect(migration).toContain("'acc_v13_evidence_' || v_intent");
    expect(edge).not.toMatch(/result:\s*\{[\s\S]*?file_path:/);
    expect(api).toContain("intent: 'view' | 'download'");
  });

  it('prints only the already-authorized selected OVR and its governed evidence metadata', () => {
    expect(ovr).toContain('<OvrPrintableReport report={selectedReport}');
    expect(ovr).toContain("getEvidenceForItem('ovr_report', selectedReport.id)");
    expect(ovr).toContain('onClick={() => window.print()}');
    expect(ovr).toContain('disabled={printableEvidence.loading || Boolean(printableEvidence.error)}');
    expect(printableOvr).toContain('Occurrence Variance Report');
    expect(printableOvr).toContain('supervisor_investigation');
    expect(printableOvr).toContain('quality_manager_comments');
    expect(printableOvr).toContain('referred_response');
    expect(printableOvr).toContain('corrective_action');
    expect(printableOvr).toContain('final_verdict');
    expect(printableOvr).not.toContain('person_involved_name');
    expect(printableOvr).not.toContain('mrn_or_id_no');
    expect(styles).toContain('@page');
    expect(styles).toContain('size: A4');
  });

  it('renders governed evidence packs from the existing metadata view without a generating write action', () => {
    expect(evidence).toContain('groupEvidencePackRows(packIndex.data || [])');
    expect(evidence).toContain('No linked evidence is available for this pack.');
    expect(evidence).toContain('evidenceId={row.evidence_file_id}');
    expect(evidence).toContain("t('evidence.pack.printIndex', 'Print Index')");
    expect(evidence).toContain('This index contains governed metadata only.');
    expect(evidence).toContain('row.evidence_type');
    expect(evidence).toContain('row.sensitivity_level');
    expect(evidence).toContain('row.reviewer_name');
    expect(evidence).toContain('row.reviewed_at');
    expect(evidence).toContain('row.is_primary');
    expect(evidence).toContain('row.required_for_closure');
    expect(evidence).toContain('row.required_for_acceptance');
    expect(evidence).toContain('row.required_for_approval');
    expect(evidence).toContain('row.required_for_treatment');
    expect(evidence).not.toContain('handleGeneratePackIndex');
    expect(evidence).not.toContain('generateEvidencePackIndex');
    expect(api).not.toContain('export async function generateEvidencePackIndex');
  });

  it('pages the roster at 50 and retains current content while refreshing', () => {
    expect(users).toContain('const pageSize = 50');
    expect(source('supabase/functions/_shared/accV13RosterPaging.ts')).toContain('Math.min(requestedPageSize, 50)');
    expect(edge).toContain("const roleFilter = safeString(filters.role).trim()");
    expect(edge).toContain(".in('user_id', userIds)");
    expect(source('src/lib/userManagementApi.ts')).toContain("filters.missingRole");
    expect(source('src/lib/userManagementApi.ts')).toContain('user_id: filters.userId || null');
    expect(users).toContain('refreshAffectedRows(affectedUserIds)');
    expect(users).toContain('getUserManagementUser(userId)');
    expect(users).toContain('loading && isLive(users)');
    expect(users).toContain('roster-skeleton-row');
    expect(users).toContain('Page {page} · up to {pageSize} users');
  });

  it('keeps a 25,000-user roster bounded to deterministic 50-row server pages', () => {
    const totalUsers = 25_137;
    const pageCount = Math.ceil(totalUsers / 50);
    const lastPage = normalizeRosterPageRequest({ page: pageCount, page_size: 50 });
    expect(pageCount).toBe(503);
    expect(lastPage).toEqual({ paged: true, page: 503, pageSize: 50, offset: 25_100 });
    expect(Math.min(lastPage.pageSize, totalUsers - lastPage.offset)).toBe(37);
    expect(normalizeRosterPageRequest({ page: 1, page_size: 500 }).pageSize).toBe(50);
  });

  it('normalizes every 50-row page of a 25,000-user roster within the local interaction budget', () => {
    const startedAt = performance.now();
    const pages = Array.from({ length: 500 }, (_, index) =>
      normalizeRosterPageRequest({ page: index + 1, page_size: 50 }),
    );
    const elapsedMs = performance.now() - startedAt;

    expect(pages).toHaveLength(500);
    expect(pages.at(-1)).toEqual({ paged: true, page: 500, pageSize: 50, offset: 24_950 });
    expect(elapsedMs).toBeLessThan(250);
  });

  it('lazy-loads the heavy governed routes without weakening the auth loader', () => {
    expect(app).toContain('const UserManagementCenter = lazy(');
    expect(app).toContain('const EvidenceVault = lazy(');
    expect(app).toContain('const SecurityAuditCenter = lazy(');
    expect(app).toContain('const MigrationVerifierCenter = lazy(');
    expect(app).toContain('const ScaleBackupRestoreCenter = lazy(');
    expect(app).toContain('const ControlledUatWorkbench = lazy(');
    expect(app).toContain('const AccreditationCenter = lazy(');
    expect(app).toContain('<Suspense fallback=');
    expect(app).toContain('authenticated_loading_authorization');
  });

  it('declares migration 195 as service-role only with controlled search paths', () => {
    expect(migration.match(/security invoker/g)?.length).toBe(9);
    expect(migration).not.toContain('security definer');
    expect(migration.match(/set search_path = public, pg_temp/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain('grant execute on function public.acc_v13_update_work_item_status');
    expect(migration).toContain('grant execute on function public.acc_v13_authorize_evidence_access');
    expect(migration).toContain('grant execute on function public.acc_v13_list_eligible_approvers');
    expect(migration).toContain('grant execute on function public.acc_v13_request_approval');
    expect(migration).toContain('revoke all on function public.acc_v13_is_eligible_approver');
    expect(migration).not.toMatch(/coalesce\([^\n]*user_status[^\n]*['"]active['"]\)/);
    expect(migration).not.toContain('grant execute on function public.acc_v13_update_work_item_status(uuid, text, uuid, text, numeric, text) to authenticated');
    expect(migration).not.toContain('grant execute on function public.acc_v13_request_approval(uuid, uuid, text, uuid, uuid, text) to authenticated');
  });
});
