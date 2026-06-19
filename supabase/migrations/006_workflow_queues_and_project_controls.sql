-- =========================================================
-- GRC Control Center - Migration 006
-- Workflow queues, project detail helpers and overdue controls
-- =========================================================

-- Expanded employee workspace view. Normal employees use this for assigned work only.
create or replace view v_my_open_work_expanded as
select
  t.id,
  t.organization_id,
  'task'::text as item_type,
  t.title,
  t.due_date,
  t.status::text as status,
  t.progress_percent,
  t.owner_id,
  t.assigned_to,
  t.project_id,
  t.milestone_id,
  p.title as project_title,
  d.name_en as department_name
from tasks t
join projects p on p.id = t.project_id
left join departments d on d.id = p.department_id
where t.status not in ('closed', 'cancelled', 'approved')
  and (t.assigned_to = auth.uid() or t.owner_id = auth.uid())
union all
select
  m.id,
  m.organization_id,
  'milestone'::text as item_type,
  m.title,
  m.due_date,
  m.status::text as status,
  m.progress_percent,
  m.owner_id,
  null::uuid as assigned_to,
  m.project_id,
  null::uuid as milestone_id,
  p.title as project_title,
  d.name_en as department_name
from milestones m
join projects p on p.id = m.project_id
left join departments d on d.id = p.department_id
where m.status not in ('closed', 'cancelled', 'approved')
  and m.owner_id = auth.uid();

-- Approval queue with resolved item titles for the UI.
create or replace view v_pending_approvals_expanded as
select
  a.id,
  a.organization_id,
  case
    when a.project_id is not null then 'project'
    when a.milestone_id is not null then 'milestone'
    when a.task_id is not null then 'task'
    when a.evidence_id is not null then 'evidence'
    when a.risk_id is not null then 'risk'
    when a.compliance_item_id is not null then 'compliance'
    when a.audit_finding_id is not null then 'audit_finding'
    when a.policy_id is not null then 'policy'
    when a.committee_decision_id is not null then 'governance_decision'
    else 'unknown'
  end as item_type,
  coalesce(
    p.title,
    m.title,
    t.title,
    e.file_name,
    r.title,
    c.title,
    af.title,
    pol.title,
    cd.title,
    'Untitled item'
  ) as item_title,
  rb.full_name_en as requested_by_name,
  ap.full_name_en as approver_name,
  a.status,
  a.request_note,
  a.decision_note,
  a.requested_at,
  a.decided_at
from approvals a
left join projects p on p.id = a.project_id
left join milestones m on m.id = a.milestone_id
left join tasks t on t.id = a.task_id
left join evidence_files e on e.id = a.evidence_id
left join risks r on r.id = a.risk_id
left join compliance_items c on c.id = a.compliance_item_id
left join audit_findings af on af.id = a.audit_finding_id
left join policies pol on pol.id = a.policy_id
left join committee_decisions cd on cd.id = a.committee_decision_id
left join profiles rb on rb.id = a.requested_by
left join profiles ap on ap.id = a.approver_id
where a.status = 'pending'
  and (a.approver_id = auth.uid() or public.can_manage_grc());

-- Evidence queue with resolved related item title.
create or replace view v_evidence_review_queue as
select
  e.id,
  e.organization_id,
  case
    when e.project_id is not null then 'project'
    when e.milestone_id is not null then 'milestone'
    when e.task_id is not null then 'task'
    when e.risk_id is not null then 'risk'
    when e.risk_control_id is not null then 'risk_control'
    when e.compliance_item_id is not null then 'compliance'
    when e.audit_finding_id is not null then 'audit_finding'
    when e.policy_id is not null then 'policy'
    when e.committee_decision_id is not null then 'governance_decision'
    else 'unknown'
  end as item_type,
  coalesce(
    p.title,
    m.title,
    t.title,
    r.title,
    rc.title,
    c.title,
    af.title,
    pol.title,
    cd.title,
    'Untitled item'
  ) as item_title,
  e.file_name,
  e.file_path,
  e.description,
  e.status,
  ub.full_name_en as uploaded_by_name,
  rv.full_name_en as reviewed_by_name,
  e.created_at
from evidence_files e
left join projects p on p.id = e.project_id
left join milestones m on m.id = e.milestone_id
left join tasks t on t.id = e.task_id
left join risks r on r.id = e.risk_id
left join risk_controls rc on rc.id = e.risk_control_id
left join compliance_items c on c.id = e.compliance_item_id
left join audit_findings af on af.id = e.audit_finding_id
left join policies pol on pol.id = e.policy_id
left join committee_decisions cd on cd.id = e.committee_decision_id
left join profiles ub on ub.id = e.uploaded_by
left join profiles rv on rv.id = e.reviewed_by
where e.status in ('submitted', 'needs_revision')
  and (public.can_manage_grc() or e.uploaded_by = auth.uid() or e.reviewed_by = auth.uid());

-- Department execution summary for future department dashboard.
create or replace view v_department_execution_summary as
select
  d.organization_id,
  d.id as department_id,
  d.name_en as department_name,
  count(distinct p.id) filter (where p.status not in ('closed','cancelled')) as active_projects,
  count(distinct p.id) filter (where p.status not in ('closed','cancelled') and p.target_end_date < current_date) as overdue_projects,
  count(distinct m.id) filter (where m.status not in ('closed','approved','cancelled') and m.due_date < current_date) as overdue_milestones,
  count(distinct t.id) filter (where t.status not in ('closed','approved','cancelled') and t.due_date < current_date) as overdue_tasks,
  count(distinct r.id) filter (where r.status not in ('closed','cancelled') and r.risk_level = 'critical') as critical_risks,
  count(distinct af.id) filter (where af.status not in ('closed','cancelled') and af.due_date < current_date) as overdue_audit_findings,
  count(distinct c.id) filter (where c.status not in ('closed','cancelled') and c.expiry_date <= current_date + interval '30 days') as compliance_expiring_30_days
from departments d
left join projects p on p.department_id = d.id
left join milestones m on m.project_id = p.id
left join tasks t on t.project_id = p.id
left join risks r on r.department_id = d.id
left join audit_findings af on af.department_id = d.id
left join compliance_items c on c.department_id = d.id
group by d.organization_id, d.id, d.name_en;

-- Controlled overdue marking. This can be scheduled later using pg_cron or called manually.
create or replace function public.mark_overdue_work_items()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update projects
  set status = 'delayed', updated_at = now()
  where target_end_date < current_date
    and status not in ('closed','cancelled','delayed')
    and coalesce(trim(delay_reason), '') <> '';

  update milestones
  set status = 'delayed', updated_at = now()
  where due_date < current_date
    and status not in ('closed','approved','cancelled','delayed')
    and coalesce(trim(delay_reason), '') <> '';

  update tasks
  set status = 'delayed', updated_at = now()
  where due_date < current_date
    and status not in ('closed','approved','cancelled','delayed')
    and coalesce(trim(delay_reason), '') <> '';
end;
$$;

-- Helper to calculate project progress from its milestones/tasks.
create or replace function public.refresh_project_progress(target_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_avg numeric;
  task_avg numeric;
  final_progress numeric;
begin
  select avg(progress_percent) into milestone_avg
  from milestones
  where project_id = target_project_id;

  select avg(progress_percent) into task_avg
  from tasks
  where project_id = target_project_id;

  final_progress := coalesce((coalesce(milestone_avg, task_avg, 0) + coalesce(task_avg, milestone_avg, 0)) / 2, 0);

  update projects
  set progress_percent = least(greatest(final_progress, 0), 100), updated_at = now()
  where id = target_project_id;
end;
$$;

create or replace function public.refresh_project_progress_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_project_progress(coalesce(new.project_id, old.project_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_project_progress_milestones on milestones;
create trigger trg_refresh_project_progress_milestones
after insert or update or delete on milestones
for each row execute function public.refresh_project_progress_trigger();

drop trigger if exists trg_refresh_project_progress_tasks on tasks;
create trigger trg_refresh_project_progress_tasks
after insert or update or delete on tasks
for each row execute function public.refresh_project_progress_trigger();
