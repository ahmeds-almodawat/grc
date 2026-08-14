import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const migration = read('supabase/migrations/196_f1r2_business_cycle_remediation.sql');
const edge = read('supabase/functions/privileged-action/index.ts');
const api = read('src/lib/grcApi.ts');
const controls = read('src/components/WorkItemControls.tsx');
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
    expect(migration).toMatch(/exists\(select 1 from public\.approvals ap where ap\.approver_id=p_actor_id/);
    expect(edge).toContain("createSignedUrl(");
    expect(edge).toContain('60,');
    expect(read('src/pages/Approvals.tsx')).toContain('<GovernedEvidenceAccess');
  });

  it('closes corrective OVR only after work, evidence, and approval prerequisites', () => {
    const closure = migration.slice(migration.indexOf('create or replace function public.can_close_ovr'), migration.indexOf('-- Correct the non-OVR evidence'));
    expect(closure).toContain("p.status='closed'");
    expect(closure).toContain('public.evidence_requirements');
    expect(closure).toContain("a.status<>'approved'");
    expect(closure).toContain("o.status='corrective_action_in_progress'");
    expect(closure).toContain('F1R2_OVR_CLOSURE_PREREQUISITES_NOT_MET');
    expect(closure).toContain("status='closed'");
    expect(closure).toContain("'f1r2_ovr_final_verdict'");
    expect(closure).toContain("'f1r2_ovr_closed'");
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

  it('refreshes authoritative OVR and project detail state after mutation', () => {
    expect(ovr).toContain('const authoritative = (await getOvrReports()).find');
    const workflowMutation = ovr.match(/const runWorkflowAction[\s\S]+?const createLinkedProject/)?.[0] || '';
    expect(workflowMutation).not.toContain('setSelectedReport(null)');
    expect(project).toContain('onProjectUpdated?.()');
    expect(read('src/pages/Projects.tsx')).toContain('setSelectedProject(refreshed.find');
  });

  it('renders related owner names from the protected participant projection', () => {
    expect(read('src/pages/Projects.tsx')).toContain('searchEligibleWorkParticipants');
    expect(read('src/pages/Projects.tsx')).not.toContain('getProfiles()');
    expect(project).toContain("personName(project.owner_id, project.owner, currentAssignment('project', project.id))");
    expect(project).toContain('personName(row.assigned_to || row.owner_id');
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
});
