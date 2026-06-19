-- =========================================================
-- GRC Control Center - Migration 017
-- Notifications, reminders, manager inbox and activity timeline
-- =========================================================

-- This migration strengthens operational follow-up without requiring email integration yet.
-- It uses existing projects, milestones, tasks, approvals, evidence, escalations,
-- OVR reports, notifications and audit logs to build manager-ready queues.

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  in_app_enabled boolean not null default true,
  daily_digest_enabled boolean not null default true,
  weekly_digest_enabled boolean not null default true,
  due_soon_days integer not null default 3 check (due_soon_days between 0 and 30),
  quiet_hours_start time,
  quiet_hours_end time,
  language text not null default 'en' check (language in ('en', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create table if not exists public.followup_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  note text not null,
  followup_date date,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  constraint followup_notes_item_type_check
    check (item_type in ('project','milestone','task','risk','compliance','audit_finding','ovr','approval','evidence','escalation','decision'))
);

create index if not exists idx_followup_notes_org on public.followup_notes(organization_id);
create index if not exists idx_followup_notes_item on public.followup_notes(item_type, item_id);
create index if not exists idx_followup_notes_assigned_to on public.followup_notes(assigned_to);
create index if not exists idx_followup_notes_followup_date on public.followup_notes(followup_date);
create index if not exists idx_notification_preferences_user on public.notification_preferences(user_id);

-- ---------------------------------------------------------
-- Operational summary cards
-- ---------------------------------------------------------

create or replace view public.v_operational_followup_summary as
select
  o.id as organization_id,
  coalesce((select count(*) from public.notifications n where n.organization_id = o.id and n.is_read = false), 0) as unread_notifications,
  coalesce((select count(*) from public.approvals a where a.organization_id = o.id and a.status = 'pending'), 0) as pending_approvals,
  coalesce((select count(*) from public.evidence_files e where e.organization_id = o.id and e.status in ('submitted','needs_revision')), 0) as pending_evidence_reviews,
  coalesce((select count(*) from public.escalation_events ee where ee.organization_id = o.id and ee.status in ('open','acknowledged')), 0) as active_escalations,
  coalesce((select count(*) from public.projects p where p.organization_id = o.id and p.target_end_date < current_date and p.status not in ('closed','cancelled')), 0) as overdue_projects,
  coalesce((select count(*) from public.milestones m where m.organization_id = o.id and m.due_date < current_date and m.status not in ('closed','approved','cancelled')), 0) as overdue_milestones,
  coalesce((select count(*) from public.tasks t where t.organization_id = o.id and t.due_date < current_date and t.status not in ('closed','approved','cancelled')), 0) as overdue_tasks,
  coalesce((select count(*) from public.ovr_reports r where r.organization_id = o.id and r.status in ('submitted','under_supervisor_review','under_quality_review','returned_for_clarification','quality_closure_review')), 0) as open_ovr_workflow,
  now() as generated_at
from public.organizations o;

-- ---------------------------------------------------------
-- Reminder queue: due soon, overdue, quality review and approvals
-- ---------------------------------------------------------

create or replace view public.v_due_reminder_queue as
select
  p.organization_id,
  'project'::text as item_type,
  p.id as item_id,
  p.title,
  p.owner_id as owner_id,
  p.department_id,
  p.target_end_date as due_date,
  case
    when p.target_end_date < current_date then 'overdue'
    when p.target_end_date <= current_date + interval '3 days' then 'due_soon'
    else 'scheduled'
  end as reminder_type,
  p.priority::text as priority,
  p.risk_level::text as risk_level,
  p.status::text as status,
  case
    when p.target_end_date < current_date then current_date - p.target_end_date
    else 0
  end as days_overdue,
  '/projects'::text as action_path
from public.projects p
where p.target_end_date is not null
  and p.status not in ('closed','cancelled')
  and p.target_end_date <= current_date + interval '3 days'

union all

select
  m.organization_id,
  'milestone'::text,
  m.id,
  m.title,
  m.owner_id,
  p.department_id,
  m.due_date,
  case
    when m.due_date < current_date then 'overdue'
    when m.due_date <= current_date + interval '3 days' then 'due_soon'
    else 'scheduled'
  end,
  p.priority::text,
  p.risk_level::text,
  m.status::text,
  case
    when m.due_date < current_date then current_date - m.due_date
    else 0
  end,
  '/projects'::text
from public.milestones m
join public.projects p on p.id = m.project_id
where m.due_date is not null
  and m.status not in ('closed','approved','cancelled')
  and m.due_date <= current_date + interval '3 days'

union all

select
  t.organization_id,
  'task'::text,
  t.id,
  t.title,
  coalesce(t.assigned_to, t.owner_id),
  p.department_id,
  t.due_date,
  case
    when t.due_date < current_date then 'overdue'
    when t.due_date <= current_date + interval '3 days' then 'due_soon'
    else 'scheduled'
  end,
  p.priority::text,
  p.risk_level::text,
  t.status::text,
  case
    when t.due_date < current_date then current_date - t.due_date
    else 0
  end,
  '/my-work'::text
from public.tasks t
join public.projects p on p.id = t.project_id
where t.due_date is not null
  and t.status not in ('closed','approved','cancelled')
  and t.due_date <= current_date + interval '3 days'

union all

select
  o.organization_id,
  'ovr'::text,
  o.id,
  coalesce(o.ovr_number, 'OVR') || ' - ' || left(o.brief_description, 80),
  coalesce(o.quality_reviewer_id, o.supervisor_id, o.owner_id),
  o.department_id,
  coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date),
  case
    when coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date) < current_date then 'overdue'
    else 'ovr_followup'
  end,
  'high'::text,
  case when o.severity_level in ('level_4','sentinel') then 'critical' else 'medium' end,
  o.status::text,
  case
    when coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date) < current_date
      then current_date - coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date)
    else 0
  end,
  '/ovr'::text
from public.ovr_reports o
where o.status not in ('closed','cancelled','rejected')
  and coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date) is not null
  and coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date) <= current_date + interval '3 days'

union all

select
  a.organization_id,
  'approval'::text,
  a.id,
  coalesce(a.request_note, 'Pending approval'),
  a.approver_id,
  null::uuid,
  a.requested_at::date,
  'pending_approval'::text,
  'medium'::text,
  'medium'::text,
  a.status::text,
  greatest((current_date - a.requested_at::date), 0),
  '/approvals'::text
from public.approvals a
where a.status = 'pending';

-- ---------------------------------------------------------
-- Notification digest based on unread notifications and reminder queue
-- ---------------------------------------------------------

create or replace view public.v_notification_digest as
select
  p.organization_id,
  p.id as user_id,
  p.full_name_en,
  p.full_name_ar,
  p.email,
  coalesce((select count(*) from public.notifications n where n.user_id = p.id and n.is_read = false), 0) as unread_notifications,
  coalesce((select count(*) from public.v_due_reminder_queue rq where rq.owner_id = p.id and rq.reminder_type = 'overdue'), 0) as overdue_assigned_items,
  coalesce((select count(*) from public.v_due_reminder_queue rq where rq.owner_id = p.id and rq.reminder_type in ('due_soon','ovr_followup')), 0) as due_soon_assigned_items,
  coalesce((select count(*) from public.approvals a where a.approver_id = p.id and a.status = 'pending'), 0) as pending_approvals,
  coalesce((select max(n.created_at) from public.notifications n where n.user_id = p.id), p.created_at) as last_notification_at
from public.profiles p
where p.is_active = true;

-- ---------------------------------------------------------
-- Unified activity timeline from audit logs, follow-up notes and notifications
-- ---------------------------------------------------------

create or replace view public.v_activity_timeline as
select
  al.organization_id,
  'audit_log'::text as event_source,
  al.table_name as item_type,
  al.record_id as item_id,
  al.action as event_title,
  coalesce(pr.full_name_en, 'System') as actor_name_en,
  coalesce(pr.full_name_ar, 'النظام') as actor_name_ar,
  al.created_at,
  al.new_data as payload
from public.audit_logs al
left join public.profiles pr on pr.id = al.actor_id

union all

select
  fn.organization_id,
  'followup_note'::text,
  fn.item_type,
  fn.item_id,
  left(fn.note, 120),
  coalesce(pr.full_name_en, 'System'),
  coalesce(pr.full_name_ar, 'النظام'),
  fn.created_at,
  jsonb_build_object('followup_date', fn.followup_date, 'resolved_at', fn.resolved_at)
from public.followup_notes fn
left join public.profiles pr on pr.id = fn.created_by

union all

select
  n.organization_id,
  'notification'::text,
  'notification'::text,
  n.id,
  n.title,
  coalesce(pr.full_name_en, 'System'),
  coalesce(pr.full_name_ar, 'النظام'),
  n.created_at,
  jsonb_build_object('body', n.body, 'link_path', n.link_path, 'is_read', n.is_read)
from public.notifications n
left join public.profiles pr on pr.id = n.user_id;

-- ---------------------------------------------------------
-- Manager inbox: one queue for department owners and executives
-- ---------------------------------------------------------

create or replace view public.v_manager_inbox as
select
  rq.organization_id,
  rq.department_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  rq.item_type,
  rq.item_id,
  rq.title,
  rq.owner_id,
  p.full_name_en as owner_name_en,
  p.full_name_ar as owner_name_ar,
  rq.due_date,
  rq.reminder_type,
  rq.priority,
  rq.risk_level,
  rq.status,
  rq.days_overdue,
  rq.action_path
from public.v_due_reminder_queue rq
left join public.departments d on d.id = rq.department_id
left join public.profiles p on p.id = rq.owner_id;

-- ---------------------------------------------------------
-- Helper function: create in-app reminders from queue.
-- Intended for manual button now; can later be scheduled server-side.
-- ---------------------------------------------------------

create or replace function public.generate_due_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select *
    from public.v_due_reminder_queue
    where owner_id is not null
  loop
    insert into public.notifications (organization_id, user_id, title, body, link_path)
    select
      r.organization_id,
      r.owner_id,
      case
        when r.reminder_type = 'overdue' then 'Overdue ' || r.item_type || ': ' || r.title
        when r.reminder_type = 'pending_approval' then 'Pending approval: ' || r.title
        else 'Due soon ' || r.item_type || ': ' || r.title
      end,
      'Status: ' || r.status || '. Due date: ' || coalesce(r.due_date::text, 'not set') || '. Risk: ' || coalesce(r.risk_level, 'medium') || '.',
      r.action_path
    where not exists (
      select 1
      from public.notifications n
      where n.organization_id = r.organization_id
        and n.user_id = r.owner_id
        and n.title = case
          when r.reminder_type = 'overdue' then 'Overdue ' || r.item_type || ': ' || r.title
          when r.reminder_type = 'pending_approval' then 'Pending approval: ' || r.title
          else 'Due soon ' || r.item_type || ': ' || r.title
        end
        and n.created_at::date = current_date
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------

alter table public.notification_preferences enable row level security;
alter table public.followup_notes enable row level security;

drop policy if exists notification_preferences_select_own_or_admin on public.notification_preferences;
create policy notification_preferences_select_own_or_admin
on public.notification_preferences
for select
using (user_id = auth.uid() or public.can_manage_grc() or public.has_role('super_admin'));

drop policy if exists notification_preferences_manage_own_or_admin on public.notification_preferences;
create policy notification_preferences_manage_own_or_admin
on public.notification_preferences
for all
using (user_id = auth.uid() or public.can_manage_grc() or public.has_role('super_admin'))
with check (user_id = auth.uid() or public.can_manage_grc() or public.has_role('super_admin'));

drop policy if exists followup_notes_select_scope on public.followup_notes;
create policy followup_notes_select_scope
on public.followup_notes
for select
using (
  public.can_manage_grc()
  or public.has_role('super_admin')
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists followup_notes_insert_authenticated on public.followup_notes;
create policy followup_notes_insert_authenticated
on public.followup_notes
for insert
with check (auth.uid() is not null);

drop policy if exists followup_notes_update_scope on public.followup_notes;
create policy followup_notes_update_scope
on public.followup_notes
for update
using (
  public.can_manage_grc()
  or public.has_role('super_admin')
  or assigned_to = auth.uid()
  or created_by = auth.uid()
)
with check (
  public.can_manage_grc()
  or public.has_role('super_admin')
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);
