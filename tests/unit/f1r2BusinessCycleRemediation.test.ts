import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const migration = read('supabase/migrations/196_f1r2_business_cycle_remediation.sql');
const edge = read('supabase/functions/privileged-action/index.ts');
const api = read('src/lib/grcApi.ts');
const controls = read('src/components/WorkItemControls.tsx');
const actionPlan = read('src/components/ActionPlanForm.tsx');
const grcForms = read('src/components/GrcForms.tsx');
const myWork = read('src/pages/MyWork.tsx');
const ovr = read('src/pages/OVR.tsx');
const project = read('src/components/ProjectDetail.tsx');
const layout = read('src/components/Layout.tsx');
const i18n = read('src/i18n/I18nContext.tsx');
const evidencePage = read('src/pages/Evidence.tsx');
const browserProof = read('tests/e2e/employee-arabic-localization.spec.ts');

describe('F1-R2 migration 196 governed contracts', () => {
  it('creates one generic assignment ledger with every required fact and state', () => {
    expect(migration).toContain('create table if not exists public.work_item_assignments');
    for (const fact of ['organization_id', 'item_type', 'item_id', 'assignee_id', 'assigned_by', 'assigned_at', 'status', 'responded_by', 'responded_at', 'decline_reason', 'superseded_at', 'created_at', 'updated_at']) {
      expect(migration).toContain(fact);
    }
    for (const state of ['pending', 'accepted', 'declined', 'superseded', 'cancelled', 'legacy_unverified']) {
      expect(migration).toContain(`'${state}'`);
    }
    expect(migration).toContain('uq_work_item_assignments_current');
  });

  it('never fabricates legacy acceptance and permits only the assignee to respond', () => {
    expect(migration).toMatch(/select p\.organization_id,'project'.+?'legacy_unverified'/s);
    expect(migration).toMatch(/select m\.organization_id,'milestone'.+?'legacy_unverified'/s);
    expect(migration).toMatch(/select t\.organization_id,'task'.+?'legacy_unverified'/s);
    expect(migration).toContain('F1R2_ONLY_ASSIGNEE_MAY_RESPOND');
    expect(migration).toContain('F1R2_DECLINE_REASON_REQUIRED');
    expect(migration).toContain("status='superseded'");
  });

  it('uses service-role-only protected functions and denies direct work writes', () => {
    expect(migration).toContain('F1R2_SERVICE_ROLE_REQUIRED');
    expect(migration).toContain('revoke insert, update, delete on public.work_item_assignments from public, anon, authenticated');
    expect(migration).toContain('drop policy if exists projects_write_managers');
    expect(migration).toContain('drop policy if exists milestones_write_owner_or_manager');
    expect(migration).toContain('drop policy if exists tasks_write_assigned_or_manager');
    expect(migration).toContain('grant execute on function public.f1r2_assign_work_item');
  });

  it('provides exact parent context without source OVR inheritance', () => {
    expect(migration).toContain('projects_f1r2_assignment_read');
    expect(migration).toContain('milestones_f1r2_assignment_read');
    expect(migration).toContain('tasks_f1r2_assignment_read');
    const assignmentPolicies = migration.slice(migration.indexOf('projects_f1r2_assignment_read'), migration.indexOf('-- All work-item writes'));
    expect(assignmentPolicies).not.toContain('ovr_reports');
  });

  it('persists OVR facts through a protected Riyadh-aware insert', () => {
    expect(migration).toContain('public.f1r2_create_ovr_report');
    expect(migration).toContain("at time zone 'Asia/Riyadh'");
    for (const field of ['occurrence_date', 'occurrence_time', 'notification_at', 'corrective_action_required']) {
      expect(migration).toContain(field);
      expect(api).toContain(field);
    }
    expect(api).not.toContain('notification_at: form.notification_at ? new Date');
  });

  it('requires explicit corrective owner, sponsor, and valid dates', () => {
    expect(migration).toContain('F1R2_EXPLICIT_OWNER_REQUIRED');
    expect(migration).toContain('F1R2_EXPLICIT_SPONSOR_REQUIRED');
    expect(migration).toContain('F1R2_CORRECTIVE_DATES_INVALID');
    expect(migration).toContain("'f1r2_corrective_project_created'");
    expect(ovr).toContain('correctiveProjectForm.owner_id');
    expect(ovr).toContain('correctiveProjectForm.sponsor_id');
  });

  it('persists schedule fields and rejects inverted date ranges', () => {
    expect(migration).toContain('F1R2_INVALID_DATE_ORDER');
    expect(migration).toMatch(/insert into public\.milestones[\s\S]+?v_start,v_due/);
    expect(migration).toMatch(/insert into public\.tasks[\s\S]+?v_start,v_due/);
    expect(read('src/components/GrcForms.tsx')).toContain('due date cannot precede');
  });

  it('rolls tasks to milestones and milestones only to projects', () => {
    const projectRollup = migration.slice(migration.indexOf('create or replace function public.refresh_project_progress'), migration.indexOf('create or replace function public.f1r2_rollup_task_trigger'));
    expect(projectRollup).toContain('from public.milestones');
    expect(projectRollup).not.toContain('from public.tasks');
    expect(migration).toContain('from public.tasks where milestone_id=target_milestone_id');
    expect(migration).toContain("status<>'cancelled'");
    expect(migration).toContain("when status='closed' then 100");
  });

  it('records project closure timestamps at the database boundary', () => {
    expect(migration).toContain('create or replace function public.f1r2_enforce_project_closure');
    expect(migration).toContain('new.closed_at:=statement_timestamp()');
    expect(migration).toContain('new.closed_by:=coalesce(new.updated_by,auth.uid())');
    expect(migration).toContain('new.closed_at:=null; new.closed_by:=null');
  });

  it('canonicalizes evidence and records ambiguous legacy relationships', () => {
    expect(migration).toContain('create trigger trg_f1r2_sync_evidence_link');
    expect(migration).toContain('insert into public.evidence_links');
    expect(migration).toContain('public.f1r2_evidence_link_reconciliation');
    expect(migration).toContain('ambiguous_parent_count_');
    expect(migration).toContain('on conflict(organization_id,evidence_file_id,linked_item_type,linked_item_id)');
  });

  it('provides canonical project, milestone, task, and OVR evidence packs', () => {
    expect(migration).toContain('public.f1r2_get_evidence_pack');
    for (const type of ['project', 'milestone', 'task', 'ovr']) expect(migration).toContain(`v_type='${type}'`);
    expect(migration).toContain('select distinct e.id');
    expect(api).toContain("'f1r2_get_evidence_pack'");
  });

  it('keeps approval selection item-scoped and decisions protected', () => {
    expect(controls).toContain('setEligibleApprovers(rows.filter(person => person.id !== auth.session?.user.id))');
    expect(controls).not.toContain('visibleIds');
    expect(api).toContain("invokePrivilegedAction('f1r2_decide_approval'");
    expect(migration).toContain('F1R2_SELF_APPROVAL_DENIED');
    expect(migration).toContain('drop policy if exists approvals_write_related');
  });

  it('allows exact approver evidence access while retaining signed-url governance', () => {
    expect(migration).toContain('public.f1r2_actor_has_work_evidence_entitlement');
    expect(migration).toContain("a.status::text in('pending','approved','rejected')");
    expect(migration).toContain("public.f1r2_work_item_contains('project',a.project_id,p_item_type,p_item_id)");
    expect(edge).toContain("createSignedUrl(");
    expect(edge).toContain('60,');
    expect(read('src/pages/Approvals.tsx')).toContain('<GovernedEvidenceAccess');
  });

  it('closes corrective OVR only after work, evidence, and approval prerequisites', () => {
    const closure = migration.slice(migration.indexOf('create or replace function public.can_close_ovr'), migration.indexOf('-- Correct the non-OVR evidence'));
    expect(closure).toContain("p.status='closed'");
    expect(closure).toContain("public.f1r2_can_close_work_item('project',p.id)");
    expect(closure).toContain('public.f1r2_item_evidence_satisfied');
    expect(closure).toContain("o.status in('corrective_action_in_progress','reopened','quality_final_review')");
    expect(closure).toContain('F1R2_OVR_CLOSURE_PREREQUISITES_NOT_MET');
    expect(closure).toContain("status='quality_final_review'");
    expect(closure).toContain("'f1r2_ovr_final_verdict'");
    expect(closure).toContain("'reporter_decision_required',true");
  });

  it('keeps authenticated assignment RLS row-local and free of protected helpers', () => {
    const policy = migration.slice(migration.lastIndexOf('create policy work_item_assignments_exact_read'), migration.indexOf('create or replace function public.f1r2_actor_scope_allows_context'));
    expect(policy).toContain('assignee_id=auth.uid()');
    expect(policy).toContain('assigned_by=auth.uid()');
    expect(policy).not.toContain('f1r2_actor_can_manage_item');
  });

  it('constrains project creation and corrective routing by exact organizational scope', () => {
    expect(migration).toContain('public.f1r2_actor_scope_allows_context');
    expect(migration).toContain("array['super_admin','executive','governance_admin','division_head','department_manager']");
    expect(migration).not.toContain("'department_manager','project_owner')) then raise exception 'F1R2_PROJECT_CREATE_DENIED'");
    expect(migration).toContain('v_ovr.division_id,v_ovr.department_id,v_ovr.unit_id');
  });

  it('validates every assignee and sponsor against item context and purpose', () => {
    expect(migration).toContain('public.f1r2_assignment_candidate_is_eligible');
    for (const purpose of ['project_owner', 'milestone_owner', 'task_owner', 'sponsor']) expect(migration).toContain(`when '${purpose}'`);
    expect(migration).toContain('F1R2_ASSIGNEE_NOT_ELIGIBLE');
    expect(migration).toContain('F1R2_SPONSOR_NOT_ELIGIBLE');
  });

  it('keeps newly assigned projects draft until explicit owner acceptance', () => {
    expect(migration).toMatch(/'incident_ovr'.+?'draft',0/s);
    expect(migration).toMatch(/insert into public\.projects[\s\S]+?v_department_id,v_unit_id,null,v_sponsor_id/);
    expect(migration).toContain("if v_type='project' then update public.projects set owner_id=null");
    expect(migration).toContain("set owner_id=case when v_decision='accepted' then p_actor_id end");
    expect(migration).toContain("if v_decision='accepted' and v_assignment.item_type='project'");
    expect(migration).toContain("where id=v_assignment.item_id and status='draft'");
  });

  it('authorizes project ownership only from accepted or legacy assignment state', () => {
    expect(migration).toContain("v_project_assignment.status in ('accepted','legacy_unverified')");
    expect(migration).toContain("v_assignment.status not in ('accepted','legacy_unverified')");
    expect(migration).toContain('F1R2_ASSIGNMENT_ACCEPTANCE_REQUIRED');
    expect(migration).toContain("jsonb_build_object('status',v_old_status)");
  });

  it('preserves separate accountable task owner and accepted execution assignee facts', () => {
    const createWork = migration.slice(migration.indexOf('create or replace function public.f1r2_create_work_item'), migration.indexOf('create or replace function public.f1r2_create_ovr_report'));
    expect(createWork).toContain("v_assignee:=case when v_type='task'");
    expect(createWork).toContain('v_owner_id,null,v_start,v_due');
    expect(createWork).toContain("'task_owner'");
    expect(migration).toContain("update public.tasks set assigned_to=case when v_decision='accepted' then p_actor_id end");
    expect(migration).toContain('F1R2_ASSIGNEE_IMPERSONATION_DENIED');
  });

  it('enforces OVR department and task parent organization integrity before insert', () => {
    expect(migration).toContain('F1R2_OVR_DEPARTMENT_INVALID');
    expect(migration).toMatch(/departments d[\s\S]+?d\.organization_id=v_actor\.organization_id[\s\S]+?d\.is_active=true/);
    expect(migration).toContain('F1R2_TASK_MILESTONE_PROJECT_MISMATCH');
    expect(migration).toContain('project_id=v_project.id and organization_id=v_actor.organization_id');
  });

  it('enforces parent-first reopening and audits every governed reopen', () => {
    expect(migration).toContain('F1R2_CLOSED_PROJECT_CHILD_MUTATION_DENIED');
    expect(migration).toContain('F1R2_CLOSED_MILESTONE_TASK_MUTATION_DENIED');
    expect(migration).toContain("'f1r2_project_reopened'");
    expect(migration).toContain("'f1r2_'||v_type||'_reopened'");
  });

  it('serializes assignment-sensitive mutations on the same hierarchy locks', () => {
    expect(migration).toContain('create or replace function public.f1r2_lock_work_item');
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('f1r2-work-item:project:'");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('f1r2-work-item:milestone:'");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('f1r2-work-item:task:'");
    for (const functionName of ['f1r2_assign_work_item', 'f1r2_respond_work_item_assignment', 'acc_v13_update_work_item_status', 'acc_v13_request_approval']) {
      const start = migration.indexOf(`create or replace function public.${functionName}`);
      const end = migration.indexOf('create or replace function public.', start + 1);
      expect(migration.slice(start, end < 0 ? undefined : end)).toContain('perform public.f1r2_lock_work_item');
    }
  });

  it('masks parent and sibling participant details from child-only assignees', () => {
    expect(migration).toContain("else 'Restricted participant' end");
    expect(migration).toContain('v_full_visibility or a.assignee_id=p_actor_id');
    expect(migration).toContain('case when v_full_visibility or a.assignee_id=p_actor_id then a.decline_reason end');
  });

  it('requires an actually existing latest approved decision when approval is required', () => {
    expect(migration).toContain('public.f1r2_latest_approval_satisfied');
    expect(migration).toContain('order by a.requested_at desc,a.decided_at desc nulls first,a.id desc');
    expect(migration).toContain("coalesce((select status='approved' from ranked),false)");
  });

  it('evaluates accepted evidence and active requirements on every exact work item', () => {
    expect(migration).toContain('public.f1r2_item_evidence_satisfied');
    expect(migration).toContain("er.gate_status<>'satisfied'");
    expect(migration).toContain("coalesce(e.review_status,e.status::text)='accepted'");
    expect(migration).toContain("not exists(select 1 from public.milestones m where m.project_id=v_project.id and not public.f1r2_item_evidence_satisfied");
  });

  it('retires old canonical evidence parents and fails closed on ambiguous relinks', () => {
    expect(migration).toContain('update public.evidence_links');
    expect(migration).toContain('and is_primary=true and is_active=true');
    expect(migration).toContain('uq_f1r2_one_active_primary_evidence_link');
    expect(migration).toContain('canonical_parent_not_unique_or_wrong_organization');
    expect(migration).toContain("'f1r2_evidence_relinked'");
    expect(migration).toContain("'f1r2_evidence_link_reconciliation_required'");
    expect(migration).not.toContain("'f1r2_evidence_relinked','evidence_files',new.id,\n      jsonb_build_object('file_path'");
  });

  it('uses one evidence-requirement projection for live sync, backfill, and dynamic packs', () => {
    expect(migration).toContain('create or replace function public.f1r2_evidence_requirement_flags');
    for (const type of ['project', 'milestone', 'task', 'ovr']) expect(migration).toContain(`v_type='${type}'`);
    expect(migration).toContain("v_type in('risk','compliance','audit_finding')");
    expect(migration.match(/public\.f1r2_evidence_requirement_flags/g)?.length).toBeGreaterThanOrEqual(4);
    const pack = migration.slice(migration.indexOf('create or replace function public.f1r2_get_evidence_pack'));
    expect(pack).toContain('cross join lateral public.f1r2_evidence_requirement_flags');
  });

  it('rechecks corrective gates on every initial, revised, and reporter-final verdict', () => {
    expect(migration).toContain('create trigger trg_f1r2_guard_corrective_ovr_final_verdict');
    expect(migration).toContain("new.status='quality_final_review'");
    expect(migration).toContain('not public.can_close_ovr(new.id)');
    expect(migration).toContain("v_ovr.status not in('corrective_action_in_progress','reopened')");
    expect(migration).toContain('F1R2_OVR_CLOSURE_PREREQUISITES_NOT_MET');
  });

  it('keeps participant role labels limited to the resolved organization and scope', () => {
    const search = migration.slice(migration.indexOf('create or replace function public.f1r2_search_eligible_participants'), migration.indexOf('-- Exact assignment relationship'));
    expect(search).toContain('(ur.organization_id is null or ur.organization_id=v_organization_id)');
    expect(search).toContain("ur.scope::text='department' and ur.department_id=v_department_id");
    expect(search).toContain('string_agg(distinct ur.role::text');
  });

  it('requires dual OVR and project entitlement before including corrective hierarchy', () => {
    expect(migration).toContain('public.f1r2_actor_has_ovr_evidence_entitlement');
    expect(migration).toContain('v_ovr.linked_project_id is not null');
    expect(migration).toContain('public.f1r2_actor_has_work_evidence_entitlement');
    expect(migration).toContain("v_type='ovr' and l.linked_item_type='ovr'");
  });

  it('defines approval evidence reach as project descendants, milestone tasks, or exact task', () => {
    expect(migration).toContain("public.f1r2_work_item_contains('project',a.project_id,p_item_type,p_item_id)");
    expect(migration).toContain("public.f1r2_work_item_contains('milestone',a.milestone_id,p_item_type,p_item_id)");
    expect(migration).toContain("public.f1r2_work_item_contains('task',a.task_id,p_item_type,p_item_id)");
  });

  it('preserves post-decision read-only approval evidence access for audit reconstruction', () => {
    expect(migration).toContain('immutable approved/rejected decision for audit reconstruction');
    expect(migration).toContain("a.status::text in('pending','approved','rejected')");
    expect(migration).not.toContain("a.status::text in('pending','approved','rejected','cancelled')");
  });

  it('preserves Quality verdict then original-reporter accept or dispute semantics', () => {
    expect(migration).toContain("set status='quality_final_review'");
    expect(migration).toContain('closed_by=null,closed_at=null');
    expect(ovr).toContain("runWorkflowAction('closed')");
    expect(ovr).toContain("runWorkflowAction('disputed')");
    expect(ovr).toContain('isReporterFor(selectedReport)');
  });

  it('refreshes old and new rollup parents once and preserves closed progress at 100', () => {
    expect(migration).toContain('old.milestone_id');
    expect(migration).toContain('new.milestone_id is distinct from old.milestone_id');
    expect(migration).toContain('new.project_id is distinct from old.project_id');
    expect(migration).toContain("case when status='closed' then 100 else round(v_progress,2) end");
    const milestoneRollup = migration.slice(migration.indexOf('create or replace function public.refresh_milestone_progress'), migration.indexOf('create or replace function public.refresh_project_progress'));
    expect(milestoneRollup).not.toContain('refresh_project_progress');
  });
});

describe('F1-R2 frontend and Edge contracts', () => {
  it('routes every governed action through privileged-action', () => {
    for (const action of [
      'f1r2_create_work_item', 'f1r2_create_ovr_report', 'f1r2_create_corrective_project',
      'f1r2_assign_work_item', 'f1r2_respond_work_item_assignment', 'f1r2_cancel_work_item_assignment', 'f1r2_list_my_work',
      'f1r2_list_item_participants', 'f1r2_list_project_assignments', 'f1r2_search_eligible_participants', 'f1r2_decide_approval',
      'f1r2_get_evidence_pack', 'f1r2_finalize_corrective_ovr',
    ]) {
      expect(edge).toContain(`'${action}'`);
      expect(api).toContain(`'${action}'`);
    }
    expect(edge).toContain('serviceClient.rpc(rpcName, rpcArgs)');
  });

  it('shows accept/decline only before accepted work controls', () => {
    expect(myWork).toContain("row.assignment_status === 'pending' || row.assignment_status === 'legacy_unverified'");
    expect(myWork).toContain('<AssignmentResponseForm');
    expect(controls).toContain("decision === 'declined' && !reason.trim()");
    expect(controls).toContain('respondToWorkItemAssignment');
  });

  it('fails closed for pending or declined project owners in the project control file', () => {
    expect(project).toContain('actorIsAcceptedProjectOwner');
    expect(project).toContain("['accepted', 'legacy_unverified'].includes(projectAssignment.assignment_status)");
    expect(project).toContain('projectAssignment?.assignee_id === actorId');
    expect(project).toContain('actorId === project.owner_id');
    expect(project).not.toMatch(/canControlProject\s*=.*actorId === project\.owner_id(?![\s\S]*actorIsAcceptedProjectOwner)/);
  });

  it('shows scoped manager controls only when their role context matches the project', () => {
    expect(project).toContain('role.organizationId === project.organization_id');
    expect(project).toContain("role.scope === 'division'");
    expect(project).toContain('role.divisionId === project.division_id');
    expect(project).toContain("role.scope === 'department'");
    expect(project).toContain('role.departmentId === project.department_id');
  });

  it('refreshes authoritative OVR and project detail state after mutation', () => {
    expect(ovr).toContain('const authoritative = (await getOvrReports()).find');
    const workflowMutation = ovr.match(/const runWorkflowAction[\s\S]+?const createLinkedProject/)?.[0] || '';
    expect(workflowMutation).not.toContain('setSelectedReport(null)');
    expect(project).toContain('onProjectUpdated?.()');
    expect(read('src/pages/Projects.tsx')).toContain('setSelectedProject(refreshed.find');
  });

  it('renders related owner names from the protected participant projection', () => {
    expect(actionPlan).toContain('searchEligibleWorkParticipants');
    expect(controls).toContain('searchEligibleWorkParticipants');
    expect(read('src/pages/Projects.tsx')).not.toContain('getProfiles()');
    expect(project).toContain('personName(project.owner, projectAssignment)');
    expect(project).toContain("personName(row.assignee || row.owner, currentAssignment('task', row.id))");
    expect(project).toContain('<AssignmentManagementForm');
  });

  it('localizes governed statuses and assignment states', () => {
    expect(i18n).toContain("'status.corrective_action_in_progress'");
    expect(i18n).toContain("'assignment.legacy_unverified'");
    expect(project).toContain('t(`status.${project.status}`');
    expect(project).toContain('t(`status.${row.status}`');
  });

  it('contains exactly one Evidence Vault navigation entry and no duplicate PageKey child', () => {
    const evidenceVaultLabels = layout.match(/label: "Evidence Vault"/g) || [];
    expect(evidenceVaultLabels).toHaveLength(1);
    const childBlocks = [...layout.matchAll(/children:\s*\[([\s\S]*?)\n\s*\],/g)].map(match => match[1]);
    for (const block of childBlocks) {
      const keys = [...block.matchAll(/key:\s*["']([^"']+)["']/g)].map(match => match[1]);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('keeps Print OVR and Print Index on the governed canonical evidence surfaces', () => {
    expect(ovr).toContain('<OvrPrintableReport');
    expect(ovr).toContain('onClick={() => window.print()}');
    expect(evidencePage).toContain("getEvidencePackIndex");
    expect(evidencePage).toContain("t('evidence.pack.printIndex', 'Print Index')");
    expect(evidencePage).toContain('window.requestAnimationFrame(() => window.print())');
  });

  it('proves the F1-R2 accepted-assignment surface at 390x844 in Arabic RTL and all theme preferences', () => {
    expect(browserProof).toContain("await page.setViewportSize({ width: 390, height: 844 })");
    expect(browserProof).toContain("await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')");
    expect(browserProof).toContain("await expect(page.getByText('تم قبول الإسناد', { exact: true })).toBeVisible()");
    for (const theme of ['dark', 'light', 'system']) expect(browserProof).toContain(`selectOption('${theme}')`);
  });

  it('does not reintroduce retired admin user creation or browser service-role access', () => {
    expect(edge).not.toContain("'admin-create-user'");
    expect(api).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(migration).toContain('from public,anon,authenticated');
  });

  it('sends contextual participant-search facts through the Edge bridge', () => {
    for (const field of ['p_item_type', 'p_item_id', 'p_assignment_purpose', 'p_query', 'p_limit']) expect(edge).toContain(field);
    expect(edge).toContain("['project_create', 'ovr', 'project', 'milestone', 'task']");
    expect(edge).toContain("['project_owner', 'milestone_owner', 'task_owner', 'sponsor']");
  });

  it('makes owner and sponsor selection searchable and contextual instead of globally preloaded', () => {
    expect(actionPlan).toContain("searchEligibleWorkParticipants('project_create'");
    expect(actionPlan).toContain("'project_owner'");
    expect(actionPlan).toContain("'sponsor'");
    expect(ovr).toContain("searchEligibleWorkParticipants('ovr'");
    expect(controls).toContain('Search eligible assignees');
    expect(grcForms).toContain("useContextualWorkParticipants('project', projectId, 'milestone_owner')");
    expect(grcForms).toContain("useContextualWorkParticipants(participantContext.itemType, participantContext.itemId, 'task_owner')");
    expect(actionPlan).toContain('if (!departmentId && !canSearchCompanyWide)');
    expect(actionPlan).toContain('setOwners([])');
    expect(actionPlan).toContain('departmentId || null');
  });

  it('refreshes authoritative OVR state after Quality verdict without auto-closing', () => {
    expect(ovr).toContain('await finalizeCorrectiveOvr');
    expect(ovr).toContain('const authoritative = (await getOvrReports()).find');
    expect(ovr).toContain("selectedReport.status === 'quality_final_review' && isReporterFor(selectedReport)");
    expect(ovr).toContain("['corrective_action_in_progress', 'reopened'].includes(selectedReport.status) && selectedReport.linked_project_id");
    expect(ovr).toContain('onClick={finalizeCorrectiveClosure}');
    expect(ovr).toContain("!selectedReport.linked_project_id");
  });

  it('does not create a corrective project from evidence upload or verdict finalization', () => {
    const finalizer = ovr.slice(ovr.indexOf('const finalizeCorrectiveClosure'), ovr.indexOf('const isManagerFor'));
    expect(finalizer).not.toContain('createOvrCorrectiveActionProject');
    expect(controls).not.toContain('createOvrCorrectiveActionProject');
  });
});
