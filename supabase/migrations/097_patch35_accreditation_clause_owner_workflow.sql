-- =========================================================
-- Patch 35: Accreditation Clause Owner Workflow
-- Operational owner/reviewer workflow for accreditation clauses.
-- =========================================================

create table if not exists public.accreditation_clause_owner_assignments (
  id uuid primary key default gen_random_uuid(),
  clause_id uuid not null references public.accreditation_clauses(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  owner_department_id uuid references public.departments(id) on delete set null,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  reviewer_department_id uuid references public.departments(id) on delete set null,
  assignment_status text not null default 'active' check (assignment_status in ('active','inactive','transferred','suspended')),
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_date date,
  notes text,
  active boolean not null default true
);

create table if not exists public.accreditation_review_cycles (
  id uuid primary key default gen_random_uuid(),
  cycle_name text not null,
  cycle_type text not null default 'accreditation_readiness' check (cycle_type in (
    'accreditation_readiness','internal_review','mock_survey','external_survey','department_review'
  )),
  starts_on date,
  ends_on date,
  status text not null default 'draft' check (status in ('draft','active','completed','cancelled','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);

create table if not exists public.accreditation_clause_review_tasks (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.accreditation_review_cycles(id) on delete set null,
  clause_id uuid not null references public.accreditation_clauses(id) on delete cascade,
  owner_assignment_id uuid references public.accreditation_clause_owner_assignments(id) on delete set null,
  task_type text not null default 'owner_review' check (task_type in (
    'owner_review','evidence_collection','sop_update','capa_closure','training_completion',
    'reviewer_signoff','executive_exception_review'
  )),
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  assigned_to_department_id uuid references public.departments(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in (
    'open','in_progress','submitted','under_review','approved','rejected','overdue',
    'reopened','escalated','waived','cancelled'
  )),
  due_date date,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  outcome_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accreditation_clause_signoffs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.accreditation_review_cycles(id) on delete set null,
  clause_id uuid not null references public.accreditation_clauses(id) on delete cascade,
  task_id uuid references public.accreditation_clause_review_tasks(id) on delete set null,
  signoff_type text not null default 'owner' check (signoff_type in ('owner','reviewer','quality','executive')),
  signoff_status text not null default 'pending' check (signoff_status in ('pending','signed_off','rejected','reopened','waived')),
  signed_by uuid references public.profiles(id) on delete set null,
  signed_at timestamptz,
  signoff_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.accreditation_workflow_escalations (
  id uuid primary key default gen_random_uuid(),
  clause_id uuid references public.accreditation_clauses(id) on delete set null,
  task_id uuid references public.accreditation_clause_review_tasks(id) on delete set null,
  cycle_id uuid references public.accreditation_review_cycles(id) on delete set null,
  escalation_level text not null default 'department' check (escalation_level in ('department','quality','executive','critical')),
  escalation_reason text not null,
  escalation_status text not null default 'open' check (escalation_status in ('open','acknowledged','resolved','cancelled')),
  escalated_to_user_id uuid references public.profiles(id) on delete set null,
  escalated_to_department_id uuid references public.departments(id) on delete set null,
  escalated_by uuid references public.profiles(id) on delete set null,
  escalated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_notes text
);

create table if not exists public.accreditation_workflow_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  clause_id uuid references public.accreditation_clauses(id) on delete set null,
  event_type text not null check (event_type in (
    'owner_assigned','owner_transferred','review_cycle_created','review_cycle_started',
    'review_cycle_completed','task_created','task_submitted','task_approved',
    'task_rejected','task_reopened','clause_signed_off','clause_signoff_rejected',
    'task_escalated','escalation_acknowledged','escalation_resolved',
    'dashboard_viewed','owner_workload_viewed'
  )),
  event_summary text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch35_owner_assignments_clause on public.accreditation_clause_owner_assignments(clause_id, active);
create index if not exists idx_patch35_owner_assignments_owner on public.accreditation_clause_owner_assignments(owner_user_id, assignment_status);
create index if not exists idx_patch35_owner_assignments_department on public.accreditation_clause_owner_assignments(owner_department_id, assignment_status);
create index if not exists idx_patch35_review_cycles_status on public.accreditation_review_cycles(status, starts_on, ends_on);
create index if not exists idx_patch35_review_tasks_clause on public.accreditation_clause_review_tasks(clause_id, status);
create index if not exists idx_patch35_review_tasks_cycle on public.accreditation_clause_review_tasks(cycle_id, status);
create index if not exists idx_patch35_review_tasks_assignee on public.accreditation_clause_review_tasks(assigned_to_user_id, status);
create index if not exists idx_patch35_review_tasks_department on public.accreditation_clause_review_tasks(assigned_to_department_id, status);
create index if not exists idx_patch35_review_tasks_due on public.accreditation_clause_review_tasks(due_date, status);
create index if not exists idx_patch35_signoffs_clause on public.accreditation_clause_signoffs(clause_id, signoff_status);
create index if not exists idx_patch35_signoffs_cycle on public.accreditation_clause_signoffs(cycle_id, signoff_type, signoff_status);
create index if not exists idx_patch35_escalations_status on public.accreditation_workflow_escalations(escalation_status, escalation_level);
create index if not exists idx_patch35_escalations_task on public.accreditation_workflow_escalations(task_id, escalation_status);
create index if not exists idx_patch35_events_entity on public.accreditation_workflow_events(entity_type, entity_id, created_at desc);
create index if not exists idx_patch35_events_clause on public.accreditation_workflow_events(clause_id, created_at desc);

alter table public.accreditation_clause_owner_assignments enable row level security;
alter table public.accreditation_review_cycles enable row level security;
alter table public.accreditation_clause_review_tasks enable row level security;
alter table public.accreditation_clause_signoffs enable row level security;
alter table public.accreditation_workflow_escalations enable row level security;
alter table public.accreditation_workflow_events enable row level security;

drop policy if exists accreditation_clause_owner_assignments_read on public.accreditation_clause_owner_assignments;
create policy accreditation_clause_owner_assignments_read on public.accreditation_clause_owner_assignments
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
  or owner_user_id = auth.uid()
  or reviewer_user_id = auth.uid()
);

drop policy if exists accreditation_clause_owner_assignments_write on public.accreditation_clause_owner_assignments;
create policy accreditation_clause_owner_assignments_write on public.accreditation_clause_owner_assignments
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists accreditation_review_cycles_read on public.accreditation_review_cycles;
create policy accreditation_review_cycles_read on public.accreditation_review_cycles
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));

drop policy if exists accreditation_review_cycles_write on public.accreditation_review_cycles;
create policy accreditation_review_cycles_write on public.accreditation_review_cycles
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists accreditation_clause_review_tasks_read on public.accreditation_clause_review_tasks;
create policy accreditation_clause_review_tasks_read on public.accreditation_clause_review_tasks
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
  or assigned_to_user_id = auth.uid()
  or reviewed_by = auth.uid()
);

drop policy if exists accreditation_clause_review_tasks_write_governance on public.accreditation_clause_review_tasks;
create policy accreditation_clause_review_tasks_write_governance on public.accreditation_clause_review_tasks
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]));

drop policy if exists accreditation_clause_review_tasks_update_owner on public.accreditation_clause_review_tasks;
create policy accreditation_clause_review_tasks_update_owner on public.accreditation_clause_review_tasks
for update using (assigned_to_user_id = auth.uid() and status in ('open','in_progress','reopened','rejected'))
with check (assigned_to_user_id = auth.uid() and status in ('in_progress','submitted'));

drop policy if exists accreditation_clause_signoffs_read on public.accreditation_clause_signoffs;
create policy accreditation_clause_signoffs_read on public.accreditation_clause_signoffs
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[]));

drop policy if exists accreditation_clause_signoffs_write on public.accreditation_clause_signoffs;
create policy accreditation_clause_signoffs_write on public.accreditation_clause_signoffs
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]));

drop policy if exists accreditation_workflow_escalations_read on public.accreditation_workflow_escalations;
create policy accreditation_workflow_escalations_read on public.accreditation_workflow_escalations
for select using (
  public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer','department_manager']::public.app_role[])
  or escalated_to_user_id = auth.uid()
  or escalated_by = auth.uid()
);

drop policy if exists accreditation_workflow_escalations_write on public.accreditation_workflow_escalations;
create policy accreditation_workflow_escalations_write on public.accreditation_workflow_escalations
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]));

drop policy if exists accreditation_workflow_events_read on public.accreditation_workflow_events;
create policy accreditation_workflow_events_read on public.accreditation_workflow_events
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists accreditation_workflow_events_insert on public.accreditation_workflow_events;
create policy accreditation_workflow_events_insert on public.accreditation_workflow_events
for insert with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]));

drop trigger if exists trg_patch35_accreditation_review_tasks_updated_at on public.accreditation_clause_review_tasks;
create trigger trg_patch35_accreditation_review_tasks_updated_at
before update on public.accreditation_clause_review_tasks
for each row execute function public.set_updated_at();

create or replace view public.v_patch35_clause_owner_register as
select
  a.id as owner_assignment_id,
  a.clause_id,
  s.framework,
  s.standard_code,
  c.clause_code,
  c.clause_title,
  c.criticality,
  a.owner_user_id,
  owner.full_name as owner_name,
  a.owner_department_id,
  owner_dept.name as owner_department_name,
  a.reviewer_user_id,
  reviewer.full_name as reviewer_name,
  a.reviewer_department_id,
  reviewer_dept.name as reviewer_department_name,
  a.assignment_status,
  a.due_date,
  a.active,
  a.assigned_at,
  a.notes
from public.accreditation_clause_owner_assignments a
join public.accreditation_clauses c on c.id = a.clause_id
left join public.accreditation_standards s on s.id = c.standard_id
left join public.profiles owner on owner.id = a.owner_user_id
left join public.departments owner_dept on owner_dept.id = a.owner_department_id
left join public.profiles reviewer on reviewer.id = a.reviewer_user_id
left join public.departments reviewer_dept on reviewer_dept.id = a.reviewer_department_id
where a.active = true;

create or replace view public.v_patch35_active_review_cycles as
select *
from public.accreditation_review_cycles
where status in ('draft','active');

create or replace view public.v_patch35_clause_owner_task_queue as
select
  t.*,
  s.framework,
  s.standard_code,
  c.clause_code,
  c.clause_title,
  c.criticality,
  u.full_name as assigned_to_name,
  d.name as assigned_department_name,
  rc.cycle_name,
  case when t.due_date is not null and t.due_date < current_date and t.status not in ('approved','waived','cancelled') then true else false end as is_overdue
from public.accreditation_clause_review_tasks t
join public.accreditation_clauses c on c.id = t.clause_id
left join public.accreditation_standards s on s.id = c.standard_id
left join public.profiles u on u.id = t.assigned_to_user_id
left join public.departments d on d.id = t.assigned_to_department_id
left join public.accreditation_review_cycles rc on rc.id = t.cycle_id
where t.status not in ('approved','waived','cancelled');

create or replace view public.v_patch35_overdue_clause_tasks as
select *
from public.v_patch35_clause_owner_task_queue
where is_overdue = true;

create or replace view public.v_patch35_clause_reviewer_signoff_queue as
select *
from public.v_patch35_clause_owner_task_queue
where task_type = 'reviewer_signoff'
  and status in ('open','in_progress','submitted','under_review','reopened');

create or replace view public.v_patch35_department_accreditation_workload as
select
  assigned_to_department_id as department_id,
  assigned_department_name as department_name,
  count(*) as open_task_count,
  count(*) filter (where is_overdue) as overdue_task_count,
  count(*) filter (where priority in ('high','critical')) as high_priority_task_count,
  count(*) filter (where status in ('submitted','under_review')) as pending_review_count,
  min(due_date) as nearest_due_date
from public.v_patch35_clause_owner_task_queue
group by assigned_to_department_id, assigned_department_name;

create or replace view public.v_patch35_clause_blocker_summary as
select
  c.id as clause_id,
  s.framework,
  s.standard_code,
  c.clause_code,
  c.clause_title,
  count(distinct t.id) filter (where t.status in ('open','in_progress','rejected','reopened','escalated','overdue')) as workflow_blocker_count,
  count(distinct eb.bridge_link_id) filter (where eb.evidence_status in ('missing','pending_collection','pending_review','rejected','stale','expired') or eb.freshness_status in ('stale','expired','unknown')) as evidence_blocker_count,
  count(distinct eb.bridge_link_id) filter (where eb.linked_entity_type in ('sop','document','capa','training_program','training_assignment','risk','audit_finding')) as dependency_link_count,
  count(distinct e.id) filter (where e.escalation_status in ('open','acknowledged')) as open_escalation_count
from public.accreditation_clauses c
left join public.accreditation_standards s on s.id = c.standard_id
left join public.accreditation_clause_review_tasks t on t.clause_id = c.id
left join public.v_patch33_clause_control_evidence_bridge eb on eb.clause_id = c.id
left join public.accreditation_workflow_escalations e on e.clause_id = c.id
where c.active = true
group by c.id, s.framework, s.standard_code, c.clause_code, c.clause_title;

create or replace view public.v_patch35_clause_signoff_register as
select
  so.*,
  s.framework,
  s.standard_code,
  c.clause_code,
  c.clause_title,
  signer.full_name as signed_by_name,
  rc.cycle_name
from public.accreditation_clause_signoffs so
join public.accreditation_clauses c on c.id = so.clause_id
left join public.accreditation_standards s on s.id = c.standard_id
left join public.profiles signer on signer.id = so.signed_by
left join public.accreditation_review_cycles rc on rc.id = so.cycle_id;

create or replace view public.v_patch35_escalation_register as
select
  e.*,
  s.framework,
  s.standard_code,
  c.clause_code,
  c.clause_title,
  u.full_name as escalated_to_name,
  d.name as escalated_to_department_name
from public.accreditation_workflow_escalations e
left join public.accreditation_clauses c on c.id = e.clause_id
left join public.accreditation_standards s on s.id = c.standard_id
left join public.profiles u on u.id = e.escalated_to_user_id
left join public.departments d on d.id = e.escalated_to_department_id;

create or replace view public.v_patch35_accreditation_operations_dashboard as
select
  (select count(*) from public.accreditation_clause_owner_assignments where active = true and assignment_status = 'active') as active_owner_assignment_count,
  (select count(*) from public.accreditation_review_cycles where status = 'active') as active_review_cycle_count,
  (select count(*) from public.accreditation_clause_review_tasks where status not in ('approved','waived','cancelled')) as open_task_count,
  (select count(*) from public.v_patch35_overdue_clause_tasks) as overdue_task_count,
  (select count(*) from public.v_patch35_clause_reviewer_signoff_queue) as reviewer_signoff_queue_count,
  (select count(*) from public.v_patch35_clause_blocker_summary where workflow_blocker_count > 0 or evidence_blocker_count > 0 or open_escalation_count > 0) as blocked_clause_count,
  (select count(*) from public.accreditation_clause_signoffs where signoff_status = 'signed_off') as signed_off_clause_count,
  (select count(*) from public.accreditation_workflow_escalations where escalation_status in ('open','acknowledged')) as open_escalation_count;

create or replace view public.v_patch35_executive_accreditation_workflow_summary as
select
  d.*,
  case
    when d.overdue_task_count > 0 or d.open_escalation_count > 0 then 'attention_required'
    when d.blocked_clause_count > 0 then 'watch'
    else 'on_track'
  end as executive_signal
from public.v_patch35_accreditation_operations_dashboard d;

create or replace view public.v_patch35_ready_for_survey_review_queue as
select
  b.*,
  coalesce(sr.signed_off_count, 0) as signed_off_count
from public.v_patch35_clause_blocker_summary b
left join (
  select clause_id, count(*) as signed_off_count
  from public.accreditation_clause_signoffs
  where signoff_status = 'signed_off'
  group by clause_id
) sr on sr.clause_id = b.clause_id
where b.workflow_blocker_count = 0
  and b.evidence_blocker_count = 0
  and b.open_escalation_count = 0;

alter view public.v_patch35_clause_owner_register set (security_invoker = true);
alter view public.v_patch35_active_review_cycles set (security_invoker = true);
alter view public.v_patch35_clause_owner_task_queue set (security_invoker = true);
alter view public.v_patch35_overdue_clause_tasks set (security_invoker = true);
alter view public.v_patch35_clause_reviewer_signoff_queue set (security_invoker = true);
alter view public.v_patch35_department_accreditation_workload set (security_invoker = true);
alter view public.v_patch35_clause_blocker_summary set (security_invoker = true);
alter view public.v_patch35_clause_signoff_register set (security_invoker = true);
alter view public.v_patch35_escalation_register set (security_invoker = true);
alter view public.v_patch35_accreditation_operations_dashboard set (security_invoker = true);
alter view public.v_patch35_executive_accreditation_workflow_summary set (security_invoker = true);
alter view public.v_patch35_ready_for_survey_review_queue set (security_invoker = true);

grant select on public.v_patch35_clause_owner_register to authenticated;
grant select on public.v_patch35_active_review_cycles to authenticated;
grant select on public.v_patch35_clause_owner_task_queue to authenticated;
grant select on public.v_patch35_overdue_clause_tasks to authenticated;
grant select on public.v_patch35_clause_reviewer_signoff_queue to authenticated;
grant select on public.v_patch35_department_accreditation_workload to authenticated;
grant select on public.v_patch35_clause_blocker_summary to authenticated;
grant select on public.v_patch35_clause_signoff_register to authenticated;
grant select on public.v_patch35_escalation_register to authenticated;
grant select on public.v_patch35_accreditation_operations_dashboard to authenticated;
grant select on public.v_patch35_executive_accreditation_workflow_summary to authenticated;
grant select on public.v_patch35_ready_for_survey_review_queue to authenticated;

create or replace function public.patch35_service_role_required()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH35_SERVICE_ROLE_REQUIRED';
  end if;
end;
$$;

create or replace function public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_user_id
      and ur.is_active = true
      and ur.role in ('super_admin','governance_admin','compliance_officer','auditor','executive')
  );
$$;

create or replace function public.record_accreditation_workflow_event(
  p_entity_type text,
  p_entity_id uuid,
  p_clause_id uuid,
  p_event_type text,
  p_event_summary text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
begin
  perform public.patch35_service_role_required();

  insert into public.accreditation_workflow_events (
    entity_type, entity_id, clause_id, event_type, event_summary, actor_user_id
  ) values (
    p_entity_type, p_entity_id, p_clause_id, p_event_type, p_event_summary, p_actor_user_id
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.assign_accreditation_clause_owner(
  p_clause_id uuid,
  p_owner_user_id uuid,
  p_owner_department_id uuid,
  p_reviewer_user_id uuid,
  p_reviewer_department_id uuid,
  p_due_date date,
  p_actor_user_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then
    raise exception 'PATCH35_ACCREDITATION_WORKFLOW_AUTHORITY_REQUIRED';
  end if;

  update public.accreditation_clause_owner_assignments
  set active = false, assignment_status = 'transferred'
  where clause_id = p_clause_id and active = true;

  insert into public.accreditation_clause_owner_assignments (
    clause_id, owner_user_id, owner_department_id, reviewer_user_id, reviewer_department_id,
    assigned_by, due_date, notes
  ) values (
    p_clause_id, p_owner_user_id, p_owner_department_id, p_reviewer_user_id, p_reviewer_department_id,
    p_actor_user_id, p_due_date, p_notes
  )
  returning id into v_assignment_id;

  perform public.record_accreditation_workflow_event('owner_assignment', v_assignment_id, p_clause_id, 'owner_assigned', 'Accreditation clause owner assigned.', p_actor_user_id);
  return v_assignment_id;
end;
$$;

create or replace function public.transfer_accreditation_clause_owner(
  p_assignment_id uuid,
  p_new_owner_user_id uuid,
  p_new_owner_department_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clause_id uuid;
  v_reviewer_user_id uuid;
  v_reviewer_department_id uuid;
  v_due_date date;
  v_new_assignment_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then
    raise exception 'PATCH35_ACCREDITATION_WORKFLOW_AUTHORITY_REQUIRED';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'PATCH35_TRANSFER_REASON_REQUIRED';
  end if;

  select clause_id, reviewer_user_id, reviewer_department_id, due_date
  into v_clause_id, v_reviewer_user_id, v_reviewer_department_id, v_due_date
  from public.accreditation_clause_owner_assignments
  where id = p_assignment_id;

  update public.accreditation_clause_owner_assignments
  set active = false, assignment_status = 'transferred'
  where id = p_assignment_id;

  insert into public.accreditation_clause_owner_assignments (
    clause_id, owner_user_id, owner_department_id, reviewer_user_id, reviewer_department_id,
    assigned_by, due_date, notes
  ) values (
    v_clause_id, p_new_owner_user_id, p_new_owner_department_id, v_reviewer_user_id, v_reviewer_department_id,
    p_actor_user_id, v_due_date, p_reason
  )
  returning id into v_new_assignment_id;

  perform public.record_accreditation_workflow_event('owner_assignment', v_new_assignment_id, v_clause_id, 'owner_transferred', p_reason, p_actor_user_id);
  return v_new_assignment_id;
end;
$$;

create or replace function public.create_accreditation_review_cycle(
  p_cycle_name text,
  p_cycle_type text,
  p_starts_on date,
  p_ends_on date,
  p_actor_user_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cycle_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then
    raise exception 'PATCH35_ACCREDITATION_WORKFLOW_AUTHORITY_REQUIRED';
  end if;

  insert into public.accreditation_review_cycles (cycle_name, cycle_type, starts_on, ends_on, created_by, notes)
  values (p_cycle_name, coalesce(nullif(p_cycle_type, ''), 'accreditation_readiness'), p_starts_on, p_ends_on, p_actor_user_id, p_notes)
  returning id into v_cycle_id;

  perform public.record_accreditation_workflow_event('review_cycle', v_cycle_id, null, 'review_cycle_created', 'Accreditation review cycle created.', p_actor_user_id);
  return v_cycle_id;
end;
$$;

create or replace function public.start_accreditation_review_cycle(p_cycle_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then
    raise exception 'PATCH35_ACCREDITATION_WORKFLOW_AUTHORITY_REQUIRED';
  end if;
  update public.accreditation_review_cycles set status = 'active' where id = p_cycle_id;
  perform public.record_accreditation_workflow_event('review_cycle', p_cycle_id, null, 'review_cycle_started', 'Accreditation review cycle started.', p_actor_user_id);
  return jsonb_build_object('status','started','cycle_id',p_cycle_id);
end;
$$;

create or replace function public.complete_accreditation_review_cycle(p_cycle_id uuid, p_actor_user_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then
    raise exception 'PATCH35_ACCREDITATION_WORKFLOW_AUTHORITY_REQUIRED';
  end if;
  update public.accreditation_review_cycles set status = 'completed', completed_at = now(), notes = coalesce(p_notes, notes) where id = p_cycle_id;
  perform public.record_accreditation_workflow_event('review_cycle', p_cycle_id, null, 'review_cycle_completed', coalesce(p_notes, 'Accreditation review cycle completed.'), p_actor_user_id);
  return jsonb_build_object('status','completed','cycle_id',p_cycle_id);
end;
$$;

create or replace function public.create_accreditation_clause_review_task(
  p_cycle_id uuid,
  p_clause_id uuid,
  p_owner_assignment_id uuid,
  p_task_type text,
  p_assigned_to_user_id uuid,
  p_assigned_to_department_id uuid,
  p_priority text,
  p_due_date date,
  p_actor_user_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then
    raise exception 'PATCH35_ACCREDITATION_WORKFLOW_AUTHORITY_REQUIRED';
  end if;

  insert into public.accreditation_clause_review_tasks (
    cycle_id, clause_id, owner_assignment_id, task_type, assigned_to_user_id,
    assigned_to_department_id, priority, due_date, created_by, outcome_notes
  ) values (
    p_cycle_id, p_clause_id, p_owner_assignment_id, coalesce(nullif(p_task_type, ''), 'owner_review'), p_assigned_to_user_id,
    p_assigned_to_department_id, coalesce(nullif(p_priority, ''), 'medium'), p_due_date, p_actor_user_id, p_notes
  )
  returning id into v_task_id;

  perform public.record_accreditation_workflow_event('review_task', v_task_id, p_clause_id, 'task_created', 'Accreditation clause review task created.', p_actor_user_id);
  return v_task_id;
end;
$$;

create or replace function public.submit_accreditation_clause_task(p_task_id uuid, p_actor_user_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clause_id uuid;
  v_assigned_to_user_id uuid;
begin
  perform public.patch35_service_role_required();
  select clause_id, assigned_to_user_id into v_clause_id, v_assigned_to_user_id
  from public.accreditation_clause_review_tasks where id = p_task_id;

  if v_assigned_to_user_id is distinct from p_actor_user_id and not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then
    raise exception 'PATCH35_TASK_ASSIGNEE_OR_AUTHORITY_REQUIRED';
  end if;

  update public.accreditation_clause_review_tasks
  set status = 'submitted', submitted_at = now(), outcome_notes = coalesce(p_notes, outcome_notes)
  where id = p_task_id;

  perform public.record_accreditation_workflow_event('review_task', p_task_id, v_clause_id, 'task_submitted', coalesce(p_notes, 'Accreditation clause task submitted.'), p_actor_user_id);
  return jsonb_build_object('status','submitted','task_id',p_task_id);
end;
$$;

create or replace function public.approve_accreditation_clause_task(p_task_id uuid, p_actor_user_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_clause_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then raise exception 'PATCH35_REVIEW_AUTHORITY_REQUIRED'; end if;
  select clause_id into v_clause_id from public.accreditation_clause_review_tasks where id = p_task_id;
  update public.accreditation_clause_review_tasks set status = 'approved', reviewed_at = now(), reviewed_by = p_actor_user_id, outcome_notes = coalesce(p_notes, outcome_notes) where id = p_task_id;
  perform public.record_accreditation_workflow_event('review_task', p_task_id, v_clause_id, 'task_approved', coalesce(p_notes, 'Accreditation clause task approved.'), p_actor_user_id);
  return jsonb_build_object('status','approved','task_id',p_task_id);
end;
$$;

create or replace function public.reject_accreditation_clause_task(p_task_id uuid, p_actor_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_clause_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then raise exception 'PATCH35_REVIEW_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'PATCH35_REJECTION_REASON_REQUIRED'; end if;
  select clause_id into v_clause_id from public.accreditation_clause_review_tasks where id = p_task_id;
  update public.accreditation_clause_review_tasks set status = 'rejected', reviewed_at = now(), reviewed_by = p_actor_user_id, outcome_notes = p_reason where id = p_task_id;
  perform public.record_accreditation_workflow_event('review_task', p_task_id, v_clause_id, 'task_rejected', p_reason, p_actor_user_id);
  return jsonb_build_object('status','rejected','task_id',p_task_id);
end;
$$;

create or replace function public.reopen_accreditation_clause_task(p_task_id uuid, p_actor_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_clause_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then raise exception 'PATCH35_REOPEN_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'PATCH35_REOPEN_REASON_REQUIRED'; end if;
  select clause_id into v_clause_id from public.accreditation_clause_review_tasks where id = p_task_id;
  update public.accreditation_clause_review_tasks set status = 'reopened', outcome_notes = p_reason where id = p_task_id;
  perform public.record_accreditation_workflow_event('review_task', p_task_id, v_clause_id, 'task_reopened', p_reason, p_actor_user_id);
  return jsonb_build_object('status','reopened','task_id',p_task_id);
end;
$$;

create or replace function public.signoff_accreditation_clause(
  p_cycle_id uuid,
  p_clause_id uuid,
  p_task_id uuid,
  p_signoff_type text,
  p_actor_user_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_signoff_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then raise exception 'PATCH35_SIGNOFF_AUTHORITY_REQUIRED'; end if;
  insert into public.accreditation_clause_signoffs (cycle_id, clause_id, task_id, signoff_type, signoff_status, signed_by, signed_at, signoff_notes)
  values (p_cycle_id, p_clause_id, p_task_id, coalesce(nullif(p_signoff_type, ''), 'owner'), 'signed_off', p_actor_user_id, now(), p_notes)
  returning id into v_signoff_id;
  perform public.record_accreditation_workflow_event('clause_signoff', v_signoff_id, p_clause_id, 'clause_signed_off', coalesce(p_notes, 'Accreditation clause signed off.'), p_actor_user_id);
  return v_signoff_id;
end;
$$;

create or replace function public.reject_accreditation_clause_signoff(p_signoff_id uuid, p_actor_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_clause_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then raise exception 'PATCH35_SIGNOFF_REJECTION_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'PATCH35_SIGNOFF_REJECTION_REASON_REQUIRED'; end if;
  select clause_id into v_clause_id from public.accreditation_clause_signoffs where id = p_signoff_id;
  update public.accreditation_clause_signoffs set signoff_status = 'rejected', signoff_notes = p_reason where id = p_signoff_id;
  perform public.record_accreditation_workflow_event('clause_signoff', p_signoff_id, v_clause_id, 'clause_signoff_rejected', p_reason, p_actor_user_id);
  return jsonb_build_object('status','rejected','signoff_id',p_signoff_id);
end;
$$;

create or replace function public.escalate_accreditation_clause_task(
  p_task_id uuid,
  p_escalation_level text,
  p_reason text,
  p_escalated_to_user_id uuid,
  p_escalated_to_department_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_escalation_id uuid;
  v_clause_id uuid;
  v_cycle_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then raise exception 'PATCH35_ESCALATION_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'PATCH35_ESCALATION_REASON_REQUIRED'; end if;
  select clause_id, cycle_id into v_clause_id, v_cycle_id from public.accreditation_clause_review_tasks where id = p_task_id;
  insert into public.accreditation_workflow_escalations (clause_id, task_id, cycle_id, escalation_level, escalation_reason, escalated_to_user_id, escalated_to_department_id, escalated_by)
  values (v_clause_id, p_task_id, v_cycle_id, coalesce(nullif(p_escalation_level, ''), 'department'), p_reason, p_escalated_to_user_id, p_escalated_to_department_id, p_actor_user_id)
  returning id into v_escalation_id;
  update public.accreditation_clause_review_tasks set status = 'escalated' where id = p_task_id;
  perform public.record_accreditation_workflow_event('workflow_escalation', v_escalation_id, v_clause_id, 'task_escalated', p_reason, p_actor_user_id);
  return v_escalation_id;
end;
$$;

create or replace function public.acknowledge_accreditation_escalation(p_escalation_id uuid, p_actor_user_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_clause_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then raise exception 'PATCH35_ESCALATION_ACK_AUTHORITY_REQUIRED'; end if;
  select clause_id into v_clause_id from public.accreditation_workflow_escalations where id = p_escalation_id;
  update public.accreditation_workflow_escalations set escalation_status = 'acknowledged', resolution_notes = coalesce(p_notes, resolution_notes) where id = p_escalation_id;
  perform public.record_accreditation_workflow_event('workflow_escalation', p_escalation_id, v_clause_id, 'escalation_acknowledged', coalesce(p_notes, 'Accreditation workflow escalation acknowledged.'), p_actor_user_id);
  return jsonb_build_object('status','acknowledged','escalation_id',p_escalation_id);
end;
$$;

create or replace function public.resolve_accreditation_escalation(p_escalation_id uuid, p_actor_user_id uuid, p_resolution_notes text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_clause_id uuid;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then raise exception 'PATCH35_ESCALATION_RESOLVE_AUTHORITY_REQUIRED'; end if;
  if nullif(trim(p_resolution_notes), '') is null then raise exception 'PATCH35_ESCALATION_RESOLUTION_REQUIRED'; end if;
  select clause_id into v_clause_id from public.accreditation_workflow_escalations where id = p_escalation_id;
  update public.accreditation_workflow_escalations set escalation_status = 'resolved', resolved_at = now(), resolution_notes = p_resolution_notes where id = p_escalation_id;
  perform public.record_accreditation_workflow_event('workflow_escalation', p_escalation_id, v_clause_id, 'escalation_resolved', p_resolution_notes, p_actor_user_id);
  return jsonb_build_object('status','resolved','escalation_id',p_escalation_id);
end;
$$;

create or replace function public.get_accreditation_operations_dashboard(p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then raise exception 'PATCH35_DASHBOARD_AUTHORITY_REQUIRED'; end if;
  select to_jsonb(d) into v_result from public.v_patch35_accreditation_operations_dashboard d limit 1;
  perform public.record_accreditation_workflow_event('dashboard', null, null, 'dashboard_viewed', 'Accreditation operations dashboard viewed.', p_actor_user_id);
  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.get_clause_owner_workload(p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  perform public.patch35_service_role_required();
  if not public.patch35_actor_has_accreditation_workflow_authority(p_actor_user_id) then raise exception 'PATCH35_WORKLOAD_AUTHORITY_REQUIRED'; end if;
  select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) into v_result
  from public.v_patch35_department_accreditation_workload w;
  perform public.record_accreditation_workflow_event('owner_workload', null, null, 'owner_workload_viewed', 'Accreditation owner workload viewed.', p_actor_user_id);
  return v_result;
end;
$$;

revoke all on function public.patch35_service_role_required() from public, anon, authenticated;
grant execute on function public.patch35_service_role_required() to service_role;
revoke all on function public.patch35_actor_has_accreditation_workflow_authority(uuid) from public, anon, authenticated;
grant execute on function public.patch35_actor_has_accreditation_workflow_authority(uuid) to service_role;
revoke all on function public.record_accreditation_workflow_event(text, uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_accreditation_workflow_event(text, uuid, uuid, text, text, uuid) to service_role;
revoke all on function public.assign_accreditation_clause_owner(uuid, uuid, uuid, uuid, uuid, date, uuid, text) from public, anon, authenticated;
grant execute on function public.assign_accreditation_clause_owner(uuid, uuid, uuid, uuid, uuid, date, uuid, text) to service_role;
revoke all on function public.transfer_accreditation_clause_owner(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.transfer_accreditation_clause_owner(uuid, uuid, uuid, uuid, text) to service_role;
revoke all on function public.create_accreditation_review_cycle(text, text, date, date, uuid, text) from public, anon, authenticated;
grant execute on function public.create_accreditation_review_cycle(text, text, date, date, uuid, text) to service_role;
revoke all on function public.start_accreditation_review_cycle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_accreditation_review_cycle(uuid, uuid) to service_role;
revoke all on function public.complete_accreditation_review_cycle(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.complete_accreditation_review_cycle(uuid, uuid, text) to service_role;
revoke all on function public.create_accreditation_clause_review_task(uuid, uuid, uuid, text, uuid, uuid, text, date, uuid, text) from public, anon, authenticated;
grant execute on function public.create_accreditation_clause_review_task(uuid, uuid, uuid, text, uuid, uuid, text, date, uuid, text) to service_role;
revoke all on function public.submit_accreditation_clause_task(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_accreditation_clause_task(uuid, uuid, text) to service_role;
revoke all on function public.approve_accreditation_clause_task(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_accreditation_clause_task(uuid, uuid, text) to service_role;
revoke all on function public.reject_accreditation_clause_task(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_accreditation_clause_task(uuid, uuid, text) to service_role;
revoke all on function public.reopen_accreditation_clause_task(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reopen_accreditation_clause_task(uuid, uuid, text) to service_role;
revoke all on function public.signoff_accreditation_clause(uuid, uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.signoff_accreditation_clause(uuid, uuid, uuid, text, uuid, text) to service_role;
revoke all on function public.reject_accreditation_clause_signoff(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_accreditation_clause_signoff(uuid, uuid, text) to service_role;
revoke all on function public.escalate_accreditation_clause_task(uuid, text, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.escalate_accreditation_clause_task(uuid, text, text, uuid, uuid, uuid) to service_role;
revoke all on function public.acknowledge_accreditation_escalation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.acknowledge_accreditation_escalation(uuid, uuid, text) to service_role;
revoke all on function public.resolve_accreditation_escalation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_accreditation_escalation(uuid, uuid, text) to service_role;
revoke all on function public.get_accreditation_operations_dashboard(uuid) from public, anon, authenticated;
grant execute on function public.get_accreditation_operations_dashboard(uuid) to service_role;
revoke all on function public.get_clause_owner_workload(uuid) from public, anon, authenticated;
grant execute on function public.get_clause_owner_workload(uuid) to service_role;

comment on table public.accreditation_clause_owner_assignments is 'Patch 35 accountable owner/reviewer assignments for accreditation clauses.';
comment on table public.accreditation_review_cycles is 'Patch 35 review cycles/campaigns for accreditation readiness.';
comment on table public.accreditation_clause_review_tasks is 'Patch 35 operational task queue for clause owners and reviewers.';
comment on table public.accreditation_clause_signoffs is 'Patch 35 formal owner/reviewer/quality/executive clause readiness signoff.';
comment on table public.accreditation_workflow_escalations is 'Patch 35 escalations for overdue or blocked accreditation clause workflow.';
comment on table public.accreditation_workflow_events is 'Patch 35 audit event trail for accreditation workflow operations.';
