-- =========================================================
-- GRC Control Center - Migration 007
-- Escalation center, delay governance queue, closure controls
-- =========================================================

-- This migration adds the management-control layer:
-- 1) Escalation events for overdue / due-soon / critical items.
-- 2) Delay reason queue for overdue work without a formal reason.
-- 3) Accepted-evidence rule before controlled closure.
-- 4) Executive views for escalation and missing delay reasons.

create table if not exists public.escalation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  item_type text not null check (
    item_type in (
      'project',
      'milestone',
      'task',
      'risk',
      'compliance_item',
      'audit_finding',
      'committee_decision'
    )
  ),
  item_id uuid not null,
  title text not null,

  department_id uuid references public.departments(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  risk_level public.risk_level not null default 'medium',

  escalation_level text not null check (escalation_level in ('reminder','manager','division','executive')),
  reason text not null,

  status text not null default 'open' check (status in ('open','acknowledged','resolved','cancelled')),

  triggered_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_escalation_events_org on public.escalation_events(organization_id);
create index if not exists idx_escalation_events_status on public.escalation_events(status);
create index if not exists idx_escalation_events_level on public.escalation_events(escalation_level);
create index if not exists idx_escalation_events_due on public.escalation_events(due_date);
create index if not exists idx_escalation_events_owner on public.escalation_events(owner_id);
create index if not exists idx_escalation_events_department on public.escalation_events(department_id);
create index if not exists idx_escalation_events_item on public.escalation_events(item_type, item_id);

-- Prevent duplicate active escalation cards for the same item/level.
create unique index if not exists uq_escalation_events_active_item_level
on public.escalation_events(organization_id, item_type, item_id, escalation_level)
where status in ('open','acknowledged');

drop trigger if exists trg_escalation_events_updated_at on public.escalation_events;
create trigger trg_escalation_events_updated_at
before update on public.escalation_events
for each row execute function public.set_updated_at();

alter table public.escalation_events enable row level security;

create policy escalation_events_read on public.escalation_events
for select using (
  public.can_access_org(organization_id)
  and (
    public.can_manage_grc()
    or owner_id = auth.uid()
    or public.has_any_role(array['division_head','department_manager','project_owner']::public.app_role[])
  )
);

create policy escalation_events_insert_manage on public.escalation_events
for insert with check (public.can_manage_grc());

create policy escalation_events_update_manage_or_owner on public.escalation_events
for update using (public.can_manage_grc() or owner_id = auth.uid())
with check (public.can_manage_grc() or owner_id = auth.uid());

-- Add audit logging for escalation changes.
drop trigger if exists trg_audit_escalation_events on public.escalation_events;
create trigger trg_audit_escalation_events
after insert or update or delete on public.escalation_events
for each row execute function public.audit_log_row_change();

-- ---------------------------------------------------------
-- Accepted evidence helper
-- ---------------------------------------------------------

create or replace function public.has_accepted_evidence(target_item_type text, target_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.evidence_files e
    where e.status = 'accepted'
      and (
        (target_item_type = 'project' and e.project_id = target_item_id)
        or (target_item_type = 'milestone' and e.milestone_id = target_item_id)
        or (target_item_type = 'task' and e.task_id = target_item_id)
        or (target_item_type = 'risk' and e.risk_id = target_item_id)
        or (target_item_type = 'compliance_item' and e.compliance_item_id = target_item_id)
        or (target_item_type = 'audit_finding' and e.audit_finding_id = target_item_id)
        or (target_item_type = 'policy' and e.policy_id = target_item_id)
        or (target_item_type = 'committee_decision' and e.committee_decision_id = target_item_id)
      )
  );
$$;

create or replace function public.require_accepted_evidence_before_project_closure()
returns trigger
language plpgsql
as $$
begin
  if new.evidence_required = true
     and new.status = 'closed'
     and not public.has_accepted_evidence('project', new.id) then
    raise exception 'Accepted evidence is required before closing this project';
  end if;
  return new;
end;
$$;

create or replace function public.require_accepted_evidence_before_work_closure()
returns trigger
language plpgsql
as $$
begin
  if new.evidence_required = true
     and new.status in ('approved','closed')
     and not public.has_accepted_evidence(
       case tg_table_name when 'milestones' then 'milestone' when 'tasks' then 'task' else tg_table_name end,
       new.id
     ) then
    raise exception 'Accepted evidence is required before approving or closing this work item';
  end if;
  return new;
end;
$$;

create or replace function public.require_accepted_evidence_before_grc_closure()
returns trigger
language plpgsql
as $$
declare
  item_type text;
begin
  item_type := case tg_table_name
    when 'compliance_items' then 'compliance_item'
    when 'audit_findings' then 'audit_finding'
    when 'committee_decisions' then 'committee_decision'
    else tg_table_name
  end;

  if coalesce((to_jsonb(new)->>'evidence_required')::boolean, false) = true
     and (to_jsonb(new)->>'status') in ('closed','compliant')
     and not public.has_accepted_evidence(item_type, new.id) then
    raise exception 'Accepted evidence is required before closing this controlled item';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_require_evidence_before_closure on public.projects;
create trigger trg_projects_require_evidence_before_closure
before update on public.projects
for each row execute function public.require_accepted_evidence_before_project_closure();

drop trigger if exists trg_milestones_require_evidence_before_closure on public.milestones;
create trigger trg_milestones_require_evidence_before_closure
before update on public.milestones
for each row execute function public.require_accepted_evidence_before_work_closure();

drop trigger if exists trg_tasks_require_evidence_before_closure on public.tasks;
create trigger trg_tasks_require_evidence_before_closure
before update on public.tasks
for each row execute function public.require_accepted_evidence_before_work_closure();

drop trigger if exists trg_compliance_require_evidence_before_closure on public.compliance_items;
create trigger trg_compliance_require_evidence_before_closure
before update on public.compliance_items
for each row execute function public.require_accepted_evidence_before_grc_closure();

drop trigger if exists trg_audit_require_evidence_before_closure on public.audit_findings;
create trigger trg_audit_require_evidence_before_closure
before update on public.audit_findings
for each row execute function public.require_accepted_evidence_before_grc_closure();

drop trigger if exists trg_decisions_require_evidence_before_closure on public.committee_decisions;
create trigger trg_decisions_require_evidence_before_closure
before update on public.committee_decisions
for each row execute function public.require_accepted_evidence_before_grc_closure();

-- ---------------------------------------------------------
-- Escalation creation helper
-- ---------------------------------------------------------

create or replace function public.create_escalation_if_missing(
  p_organization_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_title text,
  p_department_id uuid,
  p_owner_id uuid,
  p_due_date date,
  p_risk_level public.risk_level,
  p_escalation_level text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.escalation_events ee
    where ee.organization_id = p_organization_id
      and ee.item_type = p_item_type
      and ee.item_id = p_item_id
      and ee.escalation_level = p_escalation_level
      and ee.status in ('open','acknowledged')
  ) then
    insert into public.escalation_events (
      organization_id,
      item_type,
      item_id,
      title,
      department_id,
      owner_id,
      due_date,
      risk_level,
      escalation_level,
      reason
    ) values (
      p_organization_id,
      p_item_type,
      p_item_id,
      p_title,
      p_department_id,
      p_owner_id,
      p_due_date,
      coalesce(p_risk_level, 'medium'::public.risk_level),
      p_escalation_level,
      p_reason
    );
  end if;
end;
$$;

-- This can be called manually from the app or scheduled later using pg_cron.
create or replace function public.refresh_escalation_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  level_text text;
begin
  -- Projects due soon.
  for rec in
    select p.* from public.projects p
    where p.status not in ('closed','cancelled')
      and p.target_end_date between current_date and current_date + 3
  loop
    perform public.create_escalation_if_missing(
      rec.organization_id, 'project', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.target_end_date, rec.risk_level, 'reminder',
      'Project due within 3 days.'
    );
  end loop;

  -- Overdue projects.
  for rec in
    select p.* from public.projects p
    where p.status not in ('closed','cancelled')
      and p.target_end_date < current_date
  loop
    level_text := case
      when rec.risk_level = 'critical' or rec.target_end_date < current_date - 7 then 'executive'
      else 'manager'
    end;
    perform public.create_escalation_if_missing(
      rec.organization_id, 'project', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.target_end_date, rec.risk_level, level_text,
      'Project is overdue and requires management action.'
    );
  end loop;

  -- Milestones due soon or overdue.
  for rec in
    select m.*, p.department_id, p.risk_level, p.title as project_title
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.status not in ('closed','approved','cancelled')
      and m.due_date is not null
      and m.due_date <= current_date + 3
  loop
    level_text := case
      when rec.due_date >= current_date then 'reminder'
      when rec.risk_level = 'critical' or rec.due_date < current_date - 7 then 'executive'
      else 'manager'
    end;
    perform public.create_escalation_if_missing(
      rec.organization_id, 'milestone', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.due_date, rec.risk_level, level_text,
      case when rec.due_date >= current_date then 'Milestone due within 3 days.' else 'Milestone is overdue.' end
    );
  end loop;

  -- Tasks due soon or overdue.
  for rec in
    select t.*, p.department_id, p.risk_level
    from public.tasks t
    join public.projects p on p.id = t.project_id
    where t.status not in ('closed','approved','cancelled')
      and t.due_date is not null
      and t.due_date <= current_date + 3
  loop
    level_text := case
      when rec.due_date >= current_date then 'reminder'
      when rec.risk_level = 'critical' or rec.due_date < current_date - 7 then 'executive'
      else 'manager'
    end;
    perform public.create_escalation_if_missing(
      rec.organization_id, 'task', rec.id, rec.title, rec.department_id, coalesce(rec.assigned_to, rec.owner_id),
      rec.due_date, rec.risk_level, level_text,
      case when rec.due_date >= current_date then 'Task due within 3 days.' else 'Task is overdue.' end
    );
  end loop;

  -- Compliance expiring soon or expired.
  for rec in
    select c.* from public.compliance_items c
    where c.status not in ('closed','cancelled','compliant')
      and c.expiry_date is not null
      and c.expiry_date <= current_date + c.reminder_days_before
  loop
    level_text := case
      when rec.expiry_date < current_date then 'executive'
      when rec.risk_level = 'critical' then 'executive'
      else 'manager'
    end;
    perform public.create_escalation_if_missing(
      rec.organization_id, 'compliance_item', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.expiry_date, rec.risk_level, level_text,
      case when rec.expiry_date < current_date then 'Compliance item is expired.' else 'Compliance item is approaching expiry.' end
    );
  end loop;

  -- Audit findings overdue.
  for rec in
    select af.* from public.audit_findings af
    where af.status not in ('closed','cancelled')
      and af.due_date < current_date
  loop
    perform public.create_escalation_if_missing(
      rec.organization_id, 'audit_finding', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.due_date, rec.risk_level,
      case when rec.risk_level = 'critical' or rec.due_date < current_date - 7 then 'executive' else 'manager' end,
      'Audit finding corrective action is overdue.'
    );
  end loop;

  -- Governance decisions overdue.
  for rec in
    select cd.* from public.committee_decisions cd
    where cd.status not in ('closed','cancelled')
      and cd.due_date < current_date
  loop
    perform public.create_escalation_if_missing(
      rec.organization_id, 'committee_decision', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.due_date, rec.risk_level,
      case when rec.risk_level = 'critical' or rec.due_date < current_date - 7 then 'executive' else 'manager' end,
      'Governance decision action is overdue.'
    );
  end loop;

  -- Risk reviews overdue.
  for rec in
    select r.* from public.risks r
    where r.status not in ('closed','cancelled')
      and r.next_review_date is not null
      and r.next_review_date < current_date
  loop
    perform public.create_escalation_if_missing(
      rec.organization_id, 'risk', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.next_review_date, rec.risk_level,
      case when rec.risk_level = 'critical' then 'executive' else 'manager' end,
      'Risk review date is overdue.'
    );
  end loop;
end;
$$;

create or replace function public.acknowledge_escalation_event(p_event_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.escalation_events
  set status = 'acknowledged',
      acknowledged_by = auth.uid(),
      acknowledged_at = now(),
      resolution_note = coalesce(p_note, resolution_note)
  where id = p_event_id
    and status = 'open'
    and (public.can_manage_grc() or owner_id = auth.uid());
end;
$$;

create or replace function public.resolve_escalation_event(p_event_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.escalation_events
  set status = 'resolved',
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = p_note
  where id = p_event_id
    and status in ('open','acknowledged')
    and (public.can_manage_grc() or owner_id = auth.uid());
end;
$$;

-- ---------------------------------------------------------
-- Views used by the app
-- ---------------------------------------------------------

create or replace view public.v_escalation_center as
select
  ee.id,
  ee.organization_id,
  ee.item_type,
  ee.item_id,
  ee.title,
  ee.escalation_level,
  ee.reason,
  ee.status,
  ee.due_date,
  ee.risk_level,
  ee.triggered_at,
  ee.acknowledged_at,
  ee.resolved_at,
  ee.resolution_note,
  d.name_en as department_name,
  owner.full_name_en as owner_name,
  ack.full_name_en as acknowledged_by_name,
  res.full_name_en as resolved_by_name
from public.escalation_events ee
left join public.departments d on d.id = ee.department_id
left join public.profiles owner on owner.id = ee.owner_id
left join public.profiles ack on ack.id = ee.acknowledged_by
left join public.profiles res on res.id = ee.resolved_by
where ee.status in ('open','acknowledged')
  and (public.can_manage_grc() or ee.owner_id = auth.uid());

create or replace view public.v_delay_reason_queue as
select
  p.organization_id,
  'project'::text as item_type,
  p.id as item_id,
  p.title,
  d.name_en as department_name,
  owner.full_name_en as owner_name,
  p.target_end_date as due_date,
  p.risk_level,
  p.status::text as status,
  'Overdue project missing mandatory delay reason.'::text as missing_reason
from public.projects p
left join public.departments d on d.id = p.department_id
left join public.profiles owner on owner.id = p.owner_id
where p.target_end_date < current_date
  and p.status not in ('closed','cancelled')
  and coalesce(trim(p.delay_reason), '') = ''
union all
select
  m.organization_id,
  'milestone'::text as item_type,
  m.id as item_id,
  m.title,
  d.name_en as department_name,
  owner.full_name_en as owner_name,
  m.due_date,
  p.risk_level,
  m.status::text as status,
  'Overdue milestone missing mandatory delay reason.'::text as missing_reason
from public.milestones m
join public.projects p on p.id = m.project_id
left join public.departments d on d.id = p.department_id
left join public.profiles owner on owner.id = m.owner_id
where m.due_date < current_date
  and m.status not in ('closed','approved','cancelled')
  and coalesce(trim(m.delay_reason), '') = ''
union all
select
  t.organization_id,
  'task'::text as item_type,
  t.id as item_id,
  t.title,
  d.name_en as department_name,
  owner.full_name_en as owner_name,
  t.due_date,
  p.risk_level,
  t.status::text as status,
  'Overdue task missing mandatory delay reason.'::text as missing_reason
from public.tasks t
join public.projects p on p.id = t.project_id
left join public.departments d on d.id = p.department_id
left join public.profiles owner on owner.id = coalesce(t.assigned_to, t.owner_id)
where t.due_date < current_date
  and t.status not in ('closed','approved','cancelled')
  and coalesce(trim(t.delay_reason), '') = '';

create or replace view public.v_management_control_summary as
select
  o.id as organization_id,
  count(*) filter (where ee.status = 'open') as open_escalations,
  count(*) filter (where ee.status = 'acknowledged') as acknowledged_escalations,
  count(*) filter (where ee.escalation_level = 'executive' and ee.status in ('open','acknowledged')) as executive_escalations,
  count(*) filter (where ee.risk_level = 'critical' and ee.status in ('open','acknowledged')) as critical_escalations,
  (
    select count(*) from public.v_delay_reason_queue dq where dq.organization_id = o.id
  ) as missing_delay_reasons
from public.organizations o
left join public.escalation_events ee on ee.organization_id = o.id
group by o.id;
