-- Patch 9: Runtime Workflow Actions, Notifications, and Escalations
-- Purpose: turn the workflow kernel into a day-to-day operating layer for actions, decisions, SLA handling, notifications, integrations, and exception control.
-- Important: creates runtime infrastructure only; it does not seed fake/demo workflow data.

create extension if not exists pgcrypto;

create table if not exists public.runtime_workflow_action_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  action_code text not null,
  action_name text not null,
  module_key text not null,
  allowed_source_types text[] not null default array[]::text[],
  requires_comment boolean not null default false,
  requires_attachment boolean not null default false,
  requires_dual_approval boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, action_code)
);

create table if not exists public.runtime_workflow_transition_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  action_catalog_id uuid references public.runtime_workflow_action_catalog(id) on delete cascade,
  module_key text not null,
  from_status text not null,
  action_type text not null,
  to_status text not null,
  required_role text,
  require_current_assignment boolean not null default true,
  require_evidence_review boolean not null default false,
  rule_status text not null default 'active' check (rule_status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.runtime_workflow_action_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workflow_instance_id uuid references public.workflow_kernel_instances(id) on delete cascade,
  source_module text not null,
  source_type text not null,
  source_id uuid,
  requested_action text not null,
  request_status text not null default 'submitted' check (request_status in ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'cancelled', 'executed', 'failed')),
  priority text not null default 'normal' check (priority in ('critical', 'high', 'normal', 'low')),
  requester_id uuid,
  requester_name text,
  assigned_reviewer_id uuid,
  assigned_reviewer_name text,
  due_at timestamptz,
  executed_at timestamptz,
  request_payload jsonb not null default '{}'::jsonb,
  execution_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.runtime_workflow_action_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  action_request_id uuid not null references public.runtime_workflow_action_requests(id) on delete cascade,
  decision_status text not null check (decision_status in ('approved', 'rejected', 'changes_requested', 'acknowledged')),
  decision_comment text,
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz not null default now(),
  evidence_attachment_id uuid,
  decision_payload jsonb not null default '{}'::jsonb
);

create table if not exists public.runtime_workflow_bulk_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  operation_code text not null,
  operation_type text not null check (operation_type in ('bulk_assign', 'bulk_submit', 'bulk_close', 'bulk_escalate', 'bulk_notify', 'bulk_import')),
  operation_status text not null default 'queued' check (operation_status in ('queued', 'running', 'completed', 'partial_failure', 'failed', 'cancelled')),
  requested_by uuid,
  requested_by_name text,
  total_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  operation_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, operation_code)
);

create table if not exists public.runtime_workflow_notification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rule_code text not null,
  module_key text not null,
  trigger_event text not null check (trigger_event in ('assignment_created', 'due_soon', 'overdue', 'escalated', 'changes_requested', 'approved', 'rejected', 'closed')),
  recipient_strategy text not null default 'assignment_owner' check (recipient_strategy in ('requester', 'assignment_owner', 'workflow_owner', 'manager', 'role', 'custom')),
  recipient_role text,
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'sms', 'teams', 'system')),
  lead_time_hours integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rule_code)
);

create table if not exists public.runtime_workflow_escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rule_code text not null,
  module_key text not null,
  priority text not null default 'normal' check (priority in ('critical', 'high', 'normal', 'low')),
  trigger_after_hours integer not null,
  escalation_level integer not null default 1,
  escalate_to_role text,
  escalate_to_user_id uuid,
  escalate_to_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rule_code)
);

create table if not exists public.runtime_workflow_sla_calendars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  calendar_code text not null,
  calendar_name text not null,
  timezone_name text not null default 'Asia/Riyadh',
  working_days integer[] not null default array[0,1,2,3,4]::integer[],
  work_start_time time not null default time '08:00',
  work_end_time time not null default time '17:00',
  holiday_policy jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, calendar_code)
);

create table if not exists public.runtime_workflow_integration_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_code text not null,
  event_type text not null,
  source_module text not null,
  source_id uuid,
  target_system text not null default 'internal',
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed', 'cancelled', 'retrying')),
  retry_count integer not null default 0,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (organization_id, event_code)
);

create table if not exists public.runtime_workflow_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  exception_code text not null,
  source_module text not null,
  source_id uuid,
  exception_type text not null check (exception_type in ('sla_breach', 'invalid_transition', 'missing_assignee', 'missing_evidence', 'notification_failed', 'integration_failed', 'permission_review')),
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low')),
  exception_status text not null default 'open' check (exception_status in ('open', 'acknowledged', 'resolved', 'waived', 'cancelled')),
  owner_id uuid,
  owner_name text,
  due_date date,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (organization_id, exception_code)
);

create table if not exists public.runtime_workflow_command_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  command_name text not null,
  command_status text not null default 'received' check (command_status in ('received', 'validated', 'executed', 'rejected', 'failed')),
  actor_id uuid,
  actor_name text,
  correlation_id text,
  source_ip text,
  command_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_rt_action_requests_org_status on public.runtime_workflow_action_requests(organization_id, request_status, priority, due_at);
create index if not exists idx_rt_action_decisions_request on public.runtime_workflow_action_decisions(action_request_id, decided_at desc);
create index if not exists idx_rt_bulk_org_status on public.runtime_workflow_bulk_operations(organization_id, operation_status, created_at desc);
create index if not exists idx_rt_outbox_org_status on public.runtime_workflow_integration_outbox(organization_id, delivery_status, created_at desc);
create index if not exists idx_rt_exceptions_org_status on public.runtime_workflow_exceptions(organization_id, exception_status, severity, due_date);
create index if not exists idx_rt_command_log_org_command on public.runtime_workflow_command_log(organization_id, command_name, created_at desc);

alter table public.runtime_workflow_action_catalog enable row level security;
alter table public.runtime_workflow_transition_rules enable row level security;
alter table public.runtime_workflow_action_requests enable row level security;
alter table public.runtime_workflow_action_decisions enable row level security;
alter table public.runtime_workflow_bulk_operations enable row level security;
alter table public.runtime_workflow_notification_rules enable row level security;
alter table public.runtime_workflow_escalation_rules enable row level security;
alter table public.runtime_workflow_sla_calendars enable row level security;
alter table public.runtime_workflow_integration_outbox enable row level security;
alter table public.runtime_workflow_exceptions enable row level security;
alter table public.runtime_workflow_command_log enable row level security;

-- Explicit policies are intentionally repeated so the v64 static RLS audit can inspect them.
drop policy if exists runtime_workflow_action_catalog_org_read on public.runtime_workflow_action_catalog;
create policy runtime_workflow_action_catalog_org_read on public.runtime_workflow_action_catalog for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_action_catalog_org_insert on public.runtime_workflow_action_catalog;
create policy runtime_workflow_action_catalog_org_insert on public.runtime_workflow_action_catalog for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_action_catalog_org_update on public.runtime_workflow_action_catalog;
create policy runtime_workflow_action_catalog_org_update on public.runtime_workflow_action_catalog for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists runtime_workflow_transition_rules_org_read on public.runtime_workflow_transition_rules;
create policy runtime_workflow_transition_rules_org_read on public.runtime_workflow_transition_rules for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_transition_rules_org_insert on public.runtime_workflow_transition_rules;
create policy runtime_workflow_transition_rules_org_insert on public.runtime_workflow_transition_rules for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_transition_rules_org_update on public.runtime_workflow_transition_rules;
create policy runtime_workflow_transition_rules_org_update on public.runtime_workflow_transition_rules for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists runtime_workflow_action_requests_org_read on public.runtime_workflow_action_requests;
create policy runtime_workflow_action_requests_org_read on public.runtime_workflow_action_requests for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_action_requests_org_insert on public.runtime_workflow_action_requests;
create policy runtime_workflow_action_requests_org_insert on public.runtime_workflow_action_requests for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_action_requests_org_update on public.runtime_workflow_action_requests;
create policy runtime_workflow_action_requests_org_update on public.runtime_workflow_action_requests for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists runtime_workflow_action_decisions_org_read on public.runtime_workflow_action_decisions;
create policy runtime_workflow_action_decisions_org_read on public.runtime_workflow_action_decisions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_action_decisions_org_insert on public.runtime_workflow_action_decisions;
create policy runtime_workflow_action_decisions_org_insert on public.runtime_workflow_action_decisions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_action_decisions_org_update on public.runtime_workflow_action_decisions;
create policy runtime_workflow_action_decisions_org_update on public.runtime_workflow_action_decisions for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists runtime_workflow_bulk_operations_org_read on public.runtime_workflow_bulk_operations;
create policy runtime_workflow_bulk_operations_org_read on public.runtime_workflow_bulk_operations for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_bulk_operations_org_insert on public.runtime_workflow_bulk_operations;
create policy runtime_workflow_bulk_operations_org_insert on public.runtime_workflow_bulk_operations for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_bulk_operations_org_update on public.runtime_workflow_bulk_operations;
create policy runtime_workflow_bulk_operations_org_update on public.runtime_workflow_bulk_operations for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists runtime_workflow_notification_rules_org_read on public.runtime_workflow_notification_rules;
create policy runtime_workflow_notification_rules_org_read on public.runtime_workflow_notification_rules for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_notification_rules_org_insert on public.runtime_workflow_notification_rules;
create policy runtime_workflow_notification_rules_org_insert on public.runtime_workflow_notification_rules for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_notification_rules_org_update on public.runtime_workflow_notification_rules;
create policy runtime_workflow_notification_rules_org_update on public.runtime_workflow_notification_rules for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists runtime_workflow_escalation_rules_org_read on public.runtime_workflow_escalation_rules;
create policy runtime_workflow_escalation_rules_org_read on public.runtime_workflow_escalation_rules for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_escalation_rules_org_insert on public.runtime_workflow_escalation_rules;
create policy runtime_workflow_escalation_rules_org_insert on public.runtime_workflow_escalation_rules for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_escalation_rules_org_update on public.runtime_workflow_escalation_rules;
create policy runtime_workflow_escalation_rules_org_update on public.runtime_workflow_escalation_rules for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists runtime_workflow_sla_calendars_org_read on public.runtime_workflow_sla_calendars;
create policy runtime_workflow_sla_calendars_org_read on public.runtime_workflow_sla_calendars for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_sla_calendars_org_insert on public.runtime_workflow_sla_calendars;
create policy runtime_workflow_sla_calendars_org_insert on public.runtime_workflow_sla_calendars for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_sla_calendars_org_update on public.runtime_workflow_sla_calendars;
create policy runtime_workflow_sla_calendars_org_update on public.runtime_workflow_sla_calendars for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists runtime_workflow_integration_outbox_org_read on public.runtime_workflow_integration_outbox;
create policy runtime_workflow_integration_outbox_org_read on public.runtime_workflow_integration_outbox for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_integration_outbox_org_insert on public.runtime_workflow_integration_outbox;
create policy runtime_workflow_integration_outbox_org_insert on public.runtime_workflow_integration_outbox for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_integration_outbox_org_update on public.runtime_workflow_integration_outbox;
create policy runtime_workflow_integration_outbox_org_update on public.runtime_workflow_integration_outbox for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists runtime_workflow_exceptions_org_read on public.runtime_workflow_exceptions;
create policy runtime_workflow_exceptions_org_read on public.runtime_workflow_exceptions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_exceptions_org_insert on public.runtime_workflow_exceptions;
create policy runtime_workflow_exceptions_org_insert on public.runtime_workflow_exceptions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_exceptions_org_update on public.runtime_workflow_exceptions;
create policy runtime_workflow_exceptions_org_update on public.runtime_workflow_exceptions for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists runtime_workflow_command_log_org_read on public.runtime_workflow_command_log;
create policy runtime_workflow_command_log_org_read on public.runtime_workflow_command_log for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists runtime_workflow_command_log_org_insert on public.runtime_workflow_command_log;
create policy runtime_workflow_command_log_org_insert on public.runtime_workflow_command_log for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_runtime_workflow_action_summary
with (security_invoker = true) as
select
  coalesce(r.organization_id, e.organization_id, o.organization_id) as organization_id,
  count(distinct r.id)::integer as action_request_count,
  count(distinct r.id) filter (where r.request_status in ('submitted', 'in_review'))::integer as active_request_count,
  count(distinct r.id) filter (where r.priority in ('critical', 'high') and r.request_status not in ('executed', 'cancelled', 'rejected'))::integer as high_priority_request_count,
  count(distinct e.id) filter (where e.exception_status = 'open')::integer as open_exception_count,
  count(distinct o.id) filter (where o.delivery_status in ('pending', 'retrying', 'failed'))::integer as pending_outbox_count,
  count(distinct b.id) filter (where b.operation_status in ('queued', 'running', 'partial_failure'))::integer as active_bulk_operation_count
from public.runtime_workflow_action_requests r
full join public.runtime_workflow_exceptions e on e.organization_id = r.organization_id
full join public.runtime_workflow_integration_outbox o on o.organization_id = coalesce(r.organization_id, e.organization_id)
left join public.runtime_workflow_bulk_operations b on b.organization_id = coalesce(r.organization_id, e.organization_id, o.organization_id)
group by coalesce(r.organization_id, e.organization_id, o.organization_id);

create or replace view public.v_runtime_workflow_action_queue
with (security_invoker = true) as
select
  organization_id,
  id as action_request_id,
  source_module,
  source_type,
  requested_action,
  request_status,
  priority,
  requester_name,
  assigned_reviewer_name,
  due_at,
  case
    when due_at is not null and due_at < now() and request_status not in ('executed', 'cancelled', 'rejected') then 'overdue'
    when priority in ('critical', 'high') then 'high_priority'
    when request_status = 'failed' then 'failed'
    else 'normal'
  end as queue_signal
from public.runtime_workflow_action_requests
where request_status not in ('executed', 'cancelled');

create or replace view public.v_runtime_workflow_notification_outbox
with (security_invoker = true) as
select
  organization_id,
  id as outbox_id,
  event_code,
  event_type,
  source_module,
  target_system,
  delivery_status,
  retry_count,
  last_error,
  created_at,
  sent_at,
  case
    when delivery_status = 'failed' then 'failed'
    when delivery_status = 'retrying' then 'retrying'
    when delivery_status = 'pending' and created_at < now() - interval '2 hours' then 'stale_pending'
    else 'normal'
  end as queue_signal
from public.runtime_workflow_integration_outbox;

create or replace view public.v_runtime_workflow_exception_dashboard
with (security_invoker = true) as
select
  organization_id,
  exception_code,
  source_module,
  exception_type,
  severity,
  exception_status,
  owner_name,
  due_date,
  case
    when due_date is not null and due_date < current_date and exception_status = 'open' then 'overdue'
    when severity in ('critical', 'high') and exception_status = 'open' then 'high_attention'
    when exception_status = 'resolved' then 'resolved'
    else 'normal'
  end as queue_signal
from public.runtime_workflow_exceptions;

comment on table public.runtime_workflow_action_requests is 'Patch 9 runtime action request queue for workflow transitions, approvals, evidence decisions, and operational commands.';
comment on table public.runtime_workflow_notification_rules is 'Patch 9 notification rules for assignment, SLA, escalation, decision, and closure events.';
comment on table public.runtime_workflow_integration_outbox is 'Patch 9 integration outbox for reliable internal/external delivery without direct browser-side privileged actions.';
comment on view public.v_runtime_workflow_action_queue is 'Patch 9 action queue; security_invoker keeps RLS active.';
