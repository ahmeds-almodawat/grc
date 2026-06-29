-- Patch 5: Workflow Kernel
-- Purpose: shared workflow engine for GRC, accreditation, quality, audit, compliance, evidence, and CAPA modules.
-- Scope: workflow templates, steps, instances, assignments, comments, attachments, activity log, SLA, escalation, RACI, notifications, and approval history.
-- Important: this patch creates operating workflow infrastructure only. It does not seed fake runtime data.

create extension if not exists pgcrypto;

create table if not exists public.workflow_kernel_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workflow_code text not null,
  module_key text not null,
  workflow_name text not null,
  workflow_description text,
  default_priority text not null default 'normal'
    check (default_priority in ('critical', 'high', 'normal', 'low')),
  default_sla_hours integer,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, workflow_code)
);

create table if not exists public.workflow_kernel_template_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid not null references public.workflow_kernel_templates(id) on delete cascade,
  step_code text not null,
  step_name text not null,
  step_type text not null default 'review'
    check (step_type in ('submit', 'review', 'approve', 'acknowledge', 'evidence', 'retest', 'closure')),
  sort_order integer not null default 0,
  required_role text,
  default_assignee_id uuid,
  default_assignee_name text,
  sla_hours integer,
  requires_comment boolean not null default false,
  requires_attachment boolean not null default false,
  can_delegate boolean not null default true,
  is_terminal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_id, step_code)
);

create table if not exists public.workflow_kernel_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid references public.workflow_kernel_templates(id) on delete set null,
  current_step_id uuid references public.workflow_kernel_template_steps(id) on delete set null,
  module_key text not null,
  source_type text not null,
  source_id uuid,
  source_code text,
  workflow_title text not null,
  workflow_status text not null default 'draft'
    check (workflow_status in ('draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'rejected', 'closed', 'cancelled', 'overdue')),
  priority text not null default 'normal'
    check (priority in ('critical', 'high', 'normal', 'low')),
  requester_id uuid,
  requester_name text,
  owner_id uuid,
  owner_name text,
  due_date date,
  submitted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_kernel_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id uuid not null references public.workflow_kernel_instances(id) on delete cascade,
  step_id uuid references public.workflow_kernel_template_steps(id) on delete set null,
  assignee_id uuid,
  assignee_name text,
  assignment_role text not null default 'reviewer'
    check (assignment_role in ('owner', 'reviewer', 'approver', 'observer', 'delegate')),
  assignment_status text not null default 'pending'
    check (assignment_status in ('pending', 'in_progress', 'completed', 'delegated', 'cancelled', 'overdue')),
  due_date date,
  completed_at timestamptz,
  delegated_from_assignment_id uuid references public.workflow_kernel_assignments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_kernel_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id uuid not null references public.workflow_kernel_instances(id) on delete cascade,
  step_id uuid references public.workflow_kernel_template_steps(id) on delete set null,
  assignment_id uuid references public.workflow_kernel_assignments(id) on delete set null,
  actor_id uuid,
  actor_name text,
  action_type text not null
    check (action_type in ('create', 'submit', 'review', 'approve', 'reject', 'request_changes', 'comment', 'attach', 'delegate', 'escalate', 'cancel', 'close', 'reopen', 'system_sla')),
  from_status text,
  to_status text,
  action_comment text,
  action_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_kernel_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id uuid not null references public.workflow_kernel_instances(id) on delete cascade,
  step_id uuid references public.workflow_kernel_template_steps(id) on delete set null,
  author_id uuid,
  author_name text,
  comment_body text not null,
  comment_visibility text not null default 'internal'
    check (comment_visibility in ('internal', 'reviewers', 'auditors', 'external_read_only')),
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_kernel_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id uuid not null references public.workflow_kernel_instances(id) on delete cascade,
  step_id uuid references public.workflow_kernel_template_steps(id) on delete set null,
  attached_by uuid,
  attachment_title text not null,
  attachment_url text,
  evidence_id uuid,
  attachment_status text not null default 'submitted'
    check (attachment_status in ('submitted', 'accepted', 'rejected', 'expired', 'withdrawn')),
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_kernel_sla_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id uuid not null references public.workflow_kernel_instances(id) on delete cascade,
  assignment_id uuid references public.workflow_kernel_assignments(id) on delete set null,
  event_type text not null
    check (event_type in ('due_soon', 'overdue', 'escalated', 'resolved', 'paused', 'resumed')),
  event_status text not null default 'open'
    check (event_status in ('open', 'acknowledged', 'resolved', 'cancelled')),
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz,
  notes text
);

create table if not exists public.workflow_kernel_escalations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id uuid not null references public.workflow_kernel_instances(id) on delete cascade,
  assignment_id uuid references public.workflow_kernel_assignments(id) on delete set null,
  escalation_level integer not null default 1,
  escalation_reason text not null,
  escalated_to_id uuid,
  escalated_to_name text,
  escalation_status text not null default 'open'
    check (escalation_status in ('open', 'acknowledged', 'resolved', 'cancelled')),
  escalated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.workflow_kernel_raci (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid references public.workflow_kernel_templates(id) on delete cascade,
  module_key text not null,
  source_type text,
  actor_id uuid,
  actor_name text,
  role_type text not null
    check (role_type in ('responsible', 'accountable', 'consulted', 'informed')),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_kernel_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  instance_id uuid references public.workflow_kernel_instances(id) on delete cascade,
  assignment_id uuid references public.workflow_kernel_assignments(id) on delete set null,
  recipient_id uuid,
  recipient_name text,
  channel text not null default 'in_app'
    check (channel in ('in_app', 'email', 'sms', 'teams', 'system')),
  notification_type text not null default 'assignment'
    check (notification_type in ('assignment', 'sla_due_soon', 'overdue', 'escalation', 'approval_needed', 'changes_requested', 'closed')),
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed', 'cancelled', 'read')),
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_wfk_templates_org_module on public.workflow_kernel_templates(organization_id, module_key, is_active);
create index if not exists idx_wfk_steps_template_sort on public.workflow_kernel_template_steps(template_id, sort_order);
create index if not exists idx_wfk_instances_org_status on public.workflow_kernel_instances(organization_id, workflow_status, priority, due_date);
create index if not exists idx_wfk_instances_source on public.workflow_kernel_instances(organization_id, module_key, source_type, source_id);
create index if not exists idx_wfk_assignments_org_status on public.workflow_kernel_assignments(organization_id, assignment_status, due_date);
create index if not exists idx_wfk_actions_instance on public.workflow_kernel_actions(instance_id, created_at desc);
create index if not exists idx_wfk_comments_instance on public.workflow_kernel_comments(instance_id, created_at desc);
create index if not exists idx_wfk_attachments_instance on public.workflow_kernel_attachments(instance_id, attachment_status);
create index if not exists idx_wfk_sla_org_status on public.workflow_kernel_sla_events(organization_id, event_type, event_status, triggered_at desc);
create index if not exists idx_wfk_escalations_org_status on public.workflow_kernel_escalations(organization_id, escalation_status, escalation_level);
create index if not exists idx_wfk_notifications_org_status on public.workflow_kernel_notifications(organization_id, notification_status, notification_type);

alter table public.workflow_kernel_templates enable row level security;
alter table public.workflow_kernel_template_steps enable row level security;
alter table public.workflow_kernel_instances enable row level security;
alter table public.workflow_kernel_assignments enable row level security;
alter table public.workflow_kernel_actions enable row level security;
alter table public.workflow_kernel_comments enable row level security;
alter table public.workflow_kernel_attachments enable row level security;
alter table public.workflow_kernel_sla_events enable row level security;
alter table public.workflow_kernel_escalations enable row level security;
alter table public.workflow_kernel_raci enable row level security;
alter table public.workflow_kernel_notifications enable row level security;

do $do$
declare
  table_name text;
  org_expr text := $sql$coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')$sql$;
begin
  foreach table_name in array array[
    'workflow_kernel_templates',
    'workflow_kernel_template_steps',
    'workflow_kernel_instances',
    'workflow_kernel_assignments',
    'workflow_kernel_actions',
    'workflow_kernel_comments',
    'workflow_kernel_attachments',
    'workflow_kernel_sla_events',
    'workflow_kernel_escalations',
    'workflow_kernel_raci',
    'workflow_kernel_notifications'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_org_read', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (organization_id::text = %s)', table_name || '_org_read', table_name, org_expr);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_insert', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (organization_id::text = %s)', table_name || '_org_insert', table_name, org_expr);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_update', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (organization_id::text = %s) with check (organization_id::text = %s)', table_name || '_org_update', table_name, org_expr, org_expr);
  end loop;
end $do$;

create or replace view public.v_workflow_kernel_summary
with (security_invoker = true) as
select
  i.organization_id,
  count(distinct i.id)::integer as workflow_count,
  count(distinct i.id) filter (where i.workflow_status in ('submitted', 'in_review', 'changes_requested', 'overdue'))::integer as active_workflow_count,
  count(distinct i.id) filter (where i.workflow_status = 'overdue' or (i.due_date is not null and i.due_date < current_date and i.workflow_status not in ('closed', 'cancelled', 'approved', 'rejected')))::integer as overdue_workflow_count,
  count(distinct a.id) filter (where a.assignment_status in ('pending', 'in_progress', 'overdue'))::integer as open_assignment_count,
  count(distinct e.id) filter (where e.escalation_status = 'open')::integer as open_escalation_count,
  count(distinct att.id) filter (where att.attachment_status in ('submitted', 'rejected', 'expired'))::integer as evidence_attention_count,
  count(distinct i.module_key)::integer as module_count
from public.workflow_kernel_instances i
left join public.workflow_kernel_assignments a on a.instance_id = i.id
left join public.workflow_kernel_escalations e on e.instance_id = i.id
left join public.workflow_kernel_attachments att on att.instance_id = i.id
group by i.organization_id;

create or replace view public.v_workflow_kernel_queue
with (security_invoker = true) as
select
  i.organization_id,
  i.id as workflow_id,
  i.module_key,
  i.source_type,
  i.source_code,
  i.workflow_title,
  i.workflow_status,
  i.priority,
  i.owner_name,
  i.due_date as workflow_due_date,
  a.id as assignment_id,
  a.assignee_name,
  a.assignment_role,
  a.assignment_status,
  a.due_date as assignment_due_date,
  case
    when coalesce(a.due_date, i.due_date) is not null and coalesce(a.due_date, i.due_date) < current_date and i.workflow_status not in ('closed', 'cancelled') then 'overdue'
    when coalesce(a.due_date, i.due_date) is not null and coalesce(a.due_date, i.due_date) <= current_date + interval '7 days' and i.workflow_status not in ('closed', 'cancelled') then 'due_soon'
    when i.priority in ('critical', 'high') then 'high_priority'
    else 'normal'
  end as queue_signal
from public.workflow_kernel_instances i
left join public.workflow_kernel_assignments a on a.instance_id = i.id and a.assignment_status not in ('completed', 'cancelled')
where i.workflow_status not in ('closed', 'cancelled', 'rejected');

create or replace view public.v_workflow_kernel_sla_dashboard
with (security_invoker = true) as
select
  i.organization_id,
  i.module_key,
  i.workflow_status,
  count(*)::integer as workflow_count,
  count(*) filter (where i.due_date is not null and i.due_date < current_date and i.workflow_status not in ('closed', 'cancelled', 'approved', 'rejected'))::integer as overdue_count,
  count(*) filter (where i.due_date is not null and i.due_date between current_date and current_date + interval '7 days')::integer as due_soon_count,
  min(i.due_date) as nearest_due_date
from public.workflow_kernel_instances i
group by i.organization_id, i.module_key, i.workflow_status;

create or replace view public.v_workflow_kernel_module_coverage
with (security_invoker = true) as
select
  t.organization_id,
  t.module_key,
  count(distinct t.id)::integer as template_count,
  count(distinct s.id)::integer as step_count,
  count(distinct i.id)::integer as instance_count,
  count(distinct i.id) filter (where i.workflow_status in ('submitted', 'in_review', 'changes_requested', 'overdue'))::integer as active_instance_count
from public.workflow_kernel_templates t
left join public.workflow_kernel_template_steps s on s.template_id = t.id
left join public.workflow_kernel_instances i on i.template_id = t.id
group by t.organization_id, t.module_key;

create or replace view public.v_workflow_kernel_activity_log
with (security_invoker = true) as
select
  a.organization_id,
  a.instance_id,
  i.module_key,
  i.source_type,
  i.source_code,
  i.workflow_title,
  a.actor_name,
  a.action_type,
  a.from_status,
  a.to_status,
  a.action_comment,
  a.created_at
from public.workflow_kernel_actions a
join public.workflow_kernel_instances i on i.id = a.instance_id;

comment on table public.workflow_kernel_templates is 'Patch 5 shared workflow template registry across GRC, accreditation, quality, audit, compliance, evidence, and CAPA modules.';
comment on table public.workflow_kernel_instances is 'Patch 5 live workflow instances with owner, status, priority, due date, and source module linkage.';
comment on table public.workflow_kernel_actions is 'Patch 5 immutable-style workflow activity and approval history log.';
comment on table public.workflow_kernel_sla_events is 'Patch 5 SLA and escalation signal log for due soon, overdue, escalated, and resolved events.';
comment on view public.v_workflow_kernel_summary is 'Patch 5 workflow kernel summary; security_invoker keeps RLS active.';
