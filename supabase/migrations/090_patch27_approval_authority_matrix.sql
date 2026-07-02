-- =========================================================
-- Patch 27: Approval Authority Matrix
-- Central approval authority foundation for GRC workflows.
-- =========================================================

create table if not exists public.approval_authority_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_code text unique,
  rule_name text not null,
  rule_description text,
  workflow_type text not null check (workflow_type in ('ovr','risk','evidence','audit_finding','compliance_obligation','document_control','capa','project','access_control','financial','general')),
  action_type text not null check (action_type in ('approve','reject','close','reopen','accept_risk','approve_closure','approve_waiver','approve_extension','approve_document','approve_escalation','owner_override','approve_evidence','approve_renewal','approve_capa','approve_access','approve_financial')),
  linked_item_type text,
  department_id uuid references public.departments(id) on delete set null,
  role_name text,
  approver_user_id uuid references public.profiles(id) on delete set null,
  approver_role text,
  min_amount numeric,
  max_amount numeric,
  risk_level text,
  severity_level text,
  criticality_level text,
  document_type text,
  escalation_level text,
  required_approval_count integer default 1 check (required_approval_count >= 1),
  requires_dual_approval boolean default false,
  requires_executive_approval boolean default false,
  allow_self_approval boolean default false,
  conflict_of_interest_block boolean default true,
  active_flag boolean default true,
  effective_date date,
  expiry_date date,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (min_amount is null or max_amount is null or min_amount <= max_amount)
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_code text unique,
  workflow_type text not null check (workflow_type in ('ovr','risk','evidence','audit_finding','compliance_obligation','document_control','capa','project','access_control','financial','general')),
  linked_item_type text not null,
  linked_item_id uuid,
  action_type text not null check (action_type in ('approve','reject','close','reopen','accept_risk','approve_closure','approve_waiver','approve_extension','approve_document','approve_escalation','owner_override','approve_evidence','approve_renewal','approve_capa','approve_access','approve_financial')),
  department_id uuid references public.departments(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz default now(),
  request_reason text,
  request_status text not null default 'pending' check (request_status in ('pending','partially_approved','approved','rejected','returned','expired','escalated','cancelled')),
  required_approval_count integer default 1 check (required_approval_count >= 1),
  received_approval_count integer default 0 check (received_approval_count >= 0),
  authority_rule_id uuid references public.approval_authority_rules(id) on delete set null,
  amount numeric,
  risk_level text,
  severity_level text,
  criticality_level text,
  document_type text,
  escalation_level text,
  due_date date,
  escalation_required boolean default false,
  escalation_level_current text,
  escalated_at timestamptz,
  escalated_to uuid references public.profiles(id) on delete set null,
  final_decision text check (final_decision is null or final_decision in ('approved','rejected','returned','cancelled','expired')),
  final_decision_by uuid references public.profiles(id) on delete set null,
  final_decision_at timestamptz,
  final_decision_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  approver_id uuid references public.profiles(id) on delete set null,
  approver_role text,
  authority_rule_id uuid references public.approval_authority_rules(id) on delete set null,
  decision text not null check (decision in ('approved','rejected','returned','abstained')),
  decision_note text,
  decided_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.approval_authority_events (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid references public.approval_requests(id) on delete cascade,
  authority_rule_id uuid references public.approval_authority_rules(id) on delete set null,
  event_type text not null check (event_type in ('rule_created','rule_updated','rule_disabled','request_created','approver_matched','no_rule_matched','approval_recorded','rejection_recorded','returned_for_correction','escalated','expired','cancelled','final_approved','final_rejected')),
  from_status text,
  to_status text,
  actor_id uuid references public.profiles(id) on delete set null,
  event_note text,
  created_at timestamptz default now()
);

create table if not exists public.approval_delegations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  delegator_id uuid not null references public.profiles(id) on delete cascade,
  delegate_id uuid not null references public.profiles(id) on delete cascade,
  workflow_type text check (workflow_type is null or workflow_type in ('ovr','risk','evidence','audit_finding','compliance_obligation','document_control','capa','project','access_control','financial','general')),
  action_type text check (action_type is null or action_type in ('approve','reject','close','reopen','accept_risk','approve_closure','approve_waiver','approve_extension','approve_document','approve_escalation','owner_override','approve_evidence','approve_renewal','approve_capa','approve_access','approve_financial')),
  department_id uuid references public.departments(id) on delete set null,
  effective_from timestamptz not null,
  effective_to timestamptz not null,
  delegation_reason text,
  active_flag boolean default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  check (effective_from < effective_to)
);

create table if not exists public.approval_authority_overrides (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  override_by uuid references public.profiles(id) on delete set null,
  override_reason text not null check (length(trim(override_reason)) > 0),
  override_decision text not null check (override_decision in ('approved','rejected','returned','cancelled')),
  override_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_patch27_rules_org on public.approval_authority_rules(organization_id);
create index if not exists idx_patch27_rules_workflow_action on public.approval_authority_rules(workflow_type, action_type);
create index if not exists idx_patch27_rules_active on public.approval_authority_rules(active_flag, effective_date, expiry_date);
create index if not exists idx_patch27_rules_department on public.approval_authority_rules(department_id);
create index if not exists idx_patch27_requests_org on public.approval_requests(organization_id);
create index if not exists idx_patch27_requests_status on public.approval_requests(request_status);
create index if not exists idx_patch27_requests_workflow on public.approval_requests(workflow_type, action_type);
create index if not exists idx_patch27_requests_linked on public.approval_requests(linked_item_type, linked_item_id);
create index if not exists idx_patch27_requests_rule on public.approval_requests(authority_rule_id);
create index if not exists idx_patch27_decisions_request on public.approval_decisions(approval_request_id);
create index if not exists idx_patch27_events_request on public.approval_authority_events(approval_request_id, created_at desc);
create index if not exists idx_patch27_events_rule on public.approval_authority_events(authority_rule_id);
create index if not exists idx_patch27_delegations_org on public.approval_delegations(organization_id);
create index if not exists idx_patch27_delegations_delegate on public.approval_delegations(delegate_id, active_flag);
create index if not exists idx_patch27_overrides_request on public.approval_authority_overrides(approval_request_id);

alter table public.approval_authority_rules enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_decisions enable row level security;
alter table public.approval_authority_events enable row level security;
alter table public.approval_delegations enable row level security;
alter table public.approval_authority_overrides enable row level security;

drop policy if exists approval_authority_rules_org_read_patch27 on public.approval_authority_rules;
create policy approval_authority_rules_org_read_patch27 on public.approval_authority_rules
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists approval_authority_rules_org_write_patch27 on public.approval_authority_rules;
create policy approval_authority_rules_org_write_patch27 on public.approval_authority_rules
for all to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists approval_requests_org_read_patch27 on public.approval_requests;
create policy approval_requests_org_read_patch27 on public.approval_requests
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists approval_requests_org_write_patch27 on public.approval_requests;
create policy approval_requests_org_write_patch27 on public.approval_requests
for all to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists approval_decisions_org_read_patch27 on public.approval_decisions;
create policy approval_decisions_org_read_patch27 on public.approval_decisions
for select to authenticated
using (exists (
  select 1 from public.approval_requests ar
  where ar.id = approval_decisions.approval_request_id
    and ar.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists approval_decisions_org_write_patch27 on public.approval_decisions;
create policy approval_decisions_org_write_patch27 on public.approval_decisions
for all to authenticated
using (exists (
  select 1 from public.approval_requests ar
  where ar.id = approval_decisions.approval_request_id
    and ar.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
))
with check (exists (
  select 1 from public.approval_requests ar
  where ar.id = approval_decisions.approval_request_id
    and ar.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists approval_events_org_read_patch27 on public.approval_authority_events;
create policy approval_events_org_read_patch27 on public.approval_authority_events
for select to authenticated
using (
  exists (
    select 1 from public.approval_requests ar
    where ar.id = approval_authority_events.approval_request_id
      and ar.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
  or exists (
    select 1 from public.approval_authority_rules aar
    where aar.id = approval_authority_events.authority_rule_id
      and aar.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

drop policy if exists approval_events_org_insert_patch27 on public.approval_authority_events;
create policy approval_events_org_insert_patch27 on public.approval_authority_events
for insert to authenticated
with check (
  approval_request_id is null
  or exists (
    select 1 from public.approval_requests ar
    where ar.id = approval_authority_events.approval_request_id
      and ar.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

drop policy if exists approval_delegations_org_read_patch27 on public.approval_delegations;
create policy approval_delegations_org_read_patch27 on public.approval_delegations
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists approval_delegations_org_write_patch27 on public.approval_delegations;
create policy approval_delegations_org_write_patch27 on public.approval_delegations
for all to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists approval_overrides_org_read_patch27 on public.approval_authority_overrides;
create policy approval_overrides_org_read_patch27 on public.approval_authority_overrides
for select to authenticated
using (exists (
  select 1 from public.approval_requests ar
  where ar.id = approval_authority_overrides.approval_request_id
    and ar.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists approval_overrides_org_write_patch27 on public.approval_authority_overrides;
create policy approval_overrides_org_write_patch27 on public.approval_authority_overrides
for all to authenticated
using (exists (
  select 1 from public.approval_requests ar
  where ar.id = approval_authority_overrides.approval_request_id
    and ar.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
))
with check (exists (
  select 1 from public.approval_requests ar
  where ar.id = approval_authority_overrides.approval_request_id
    and ar.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

create or replace view public.v_patch27_active_authority_rules as
select *
from public.approval_authority_rules
where active_flag = true
  and (effective_date is null or effective_date <= current_date)
  and (expiry_date is null or expiry_date >= current_date);

create or replace view public.v_patch27_pending_approval_requests as
select
  ar.*,
  aar.rule_code,
  aar.rule_name,
  aar.approver_role,
  aar.approver_user_id
from public.approval_requests ar
left join public.approval_authority_rules aar on aar.id = ar.authority_rule_id
where ar.request_status in ('pending','partially_approved','escalated');

create or replace view public.v_patch27_overdue_approval_requests as
select *
from public.v_patch27_pending_approval_requests
where due_date is not null
  and due_date < current_date;

create or replace view public.v_patch27_approval_decision_history as
select
  d.id as decision_id,
  r.organization_id,
  d.approval_request_id,
  r.request_code,
  r.workflow_type,
  r.action_type,
  r.linked_item_type,
  r.linked_item_id,
  d.approver_id,
  p.full_name_en as approver_name,
  d.approver_role,
  d.decision,
  d.decision_note,
  d.decided_at
from public.approval_decisions d
join public.approval_requests r on r.id = d.approval_request_id
left join public.profiles p on p.id = d.approver_id;

create or replace view public.v_patch27_authority_rule_coverage as
select
  organization_id,
  workflow_type,
  action_type,
  count(*) filter (where active_flag = true and (effective_date is null or effective_date <= current_date) and (expiry_date is null or expiry_date >= current_date)) as active_rule_count,
  count(*) as total_rule_count,
  bool_or(requires_dual_approval) as has_dual_approval_rule,
  bool_or(requires_executive_approval) as has_executive_approval_rule
from public.approval_authority_rules
group by organization_id, workflow_type, action_type;

create or replace view public.v_patch27_executive_approval_queue as
select ar.*
from public.v_patch27_pending_approval_requests ar
left join public.approval_authority_rules aar on aar.id = ar.authority_rule_id
where ar.escalation_required = true
   or ar.escalation_level_current = 'executive'
   or aar.requires_executive_approval = true;

create or replace view public.v_patch27_approval_bottlenecks as
select
  organization_id,
  workflow_type,
  action_type,
  request_status,
  count(*) as request_count,
  min(requested_at) as oldest_requested_at,
  count(*) filter (where due_date is not null and due_date < current_date) as overdue_count
from public.approval_requests
where request_status in ('pending','partially_approved','escalated')
group by organization_id, workflow_type, action_type, request_status;

create or replace view public.v_patch27_unmatched_approval_requests as
select *
from public.approval_requests
where authority_rule_id is null
  and request_status in ('pending','partially_approved','escalated');

create or replace view public.v_patch27_active_approval_delegations as
select
  d.*,
  delegator.full_name_en as delegator_name,
  delegate.full_name_en as delegate_name
from public.approval_delegations d
left join public.profiles delegator on delegator.id = d.delegator_id
left join public.profiles delegate on delegate.id = d.delegate_id
where d.active_flag = true
  and d.effective_from <= now()
  and d.effective_to >= now();

create or replace view public.v_patch27_approval_override_register as
select
  o.id as override_id,
  r.organization_id,
  o.approval_request_id,
  r.request_code,
  r.workflow_type,
  r.action_type,
  r.linked_item_type,
  r.linked_item_id,
  o.override_by,
  p.full_name_en as override_by_name,
  o.override_reason,
  o.override_decision,
  o.override_at,
  o.created_at
from public.approval_authority_overrides o
join public.approval_requests r on r.id = o.approval_request_id
left join public.profiles p on p.id = o.override_by;

alter view public.v_patch27_active_authority_rules set (security_invoker = true);
alter view public.v_patch27_pending_approval_requests set (security_invoker = true);
alter view public.v_patch27_overdue_approval_requests set (security_invoker = true);
alter view public.v_patch27_approval_decision_history set (security_invoker = true);
alter view public.v_patch27_authority_rule_coverage set (security_invoker = true);
alter view public.v_patch27_executive_approval_queue set (security_invoker = true);
alter view public.v_patch27_approval_bottlenecks set (security_invoker = true);
alter view public.v_patch27_unmatched_approval_requests set (security_invoker = true);
alter view public.v_patch27_active_approval_delegations set (security_invoker = true);
alter view public.v_patch27_approval_override_register set (security_invoker = true);

grant select on public.v_patch27_active_authority_rules to authenticated;
grant select on public.v_patch27_pending_approval_requests to authenticated;
grant select on public.v_patch27_overdue_approval_requests to authenticated;
grant select on public.v_patch27_approval_decision_history to authenticated;
grant select on public.v_patch27_authority_rule_coverage to authenticated;
grant select on public.v_patch27_executive_approval_queue to authenticated;
grant select on public.v_patch27_approval_bottlenecks to authenticated;
grant select on public.v_patch27_unmatched_approval_requests to authenticated;
grant select on public.v_patch27_active_approval_delegations to authenticated;
grant select on public.v_patch27_approval_override_register to authenticated;

create or replace function public.patch27_write_authority_event(
  p_approval_request_id uuid,
  p_authority_rule_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_actor_id uuid,
  p_event_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_EVENT_SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.approval_authority_events (
    approval_request_id,
    authority_rule_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    event_note
  )
  values (
    p_approval_request_id,
    p_authority_rule_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_actor_id,
    p_event_note
  );
end;
$$;

create or replace function public.resolve_approval_authority_rule(
  p_organization_id uuid,
  p_workflow_type text,
  p_action_type text,
  p_linked_item_type text default null,
  p_department_id uuid default null,
  p_role_name text default null,
  p_amount numeric default null,
  p_risk_level text default null,
  p_severity_level text default null,
  p_criticality_level text default null,
  p_document_type text default null,
  p_escalation_level text default null
)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select r.id
  from public.approval_authority_rules r
  where r.organization_id = p_organization_id
    and r.active_flag = true
    and r.workflow_type = p_workflow_type
    and r.action_type = p_action_type
    and (r.linked_item_type is null or r.linked_item_type = p_linked_item_type)
    and (r.effective_date is null or r.effective_date <= current_date)
    and (r.expiry_date is null or r.expiry_date >= current_date)
    and (r.department_id is null or r.department_id is not distinct from p_department_id)
    and (r.role_name is null or r.role_name = p_role_name)
    and (r.min_amount is null or p_amount is null or p_amount >= r.min_amount)
    and (r.max_amount is null or p_amount is null or p_amount <= r.max_amount)
    and (r.risk_level is null or r.risk_level = p_risk_level)
    and (r.severity_level is null or r.severity_level = p_severity_level)
    and (r.criticality_level is null or r.criticality_level = p_criticality_level)
    and (r.document_type is null or r.document_type = p_document_type)
    and (r.escalation_level is null or r.escalation_level = p_escalation_level)
  order by
    (case when r.approver_user_id is not null then 1 else 0 end
     + case when r.approver_role is not null then 1 else 0 end
     + case when r.linked_item_type is not null then 1 else 0 end
     + case when r.department_id is not null then 1 else 0 end
     + case when r.role_name is not null then 1 else 0 end
     + case when r.risk_level is not null then 1 else 0 end
     + case when r.severity_level is not null then 1 else 0 end
     + case when r.criticality_level is not null then 1 else 0 end
     + case when r.document_type is not null then 1 else 0 end
     + case when r.escalation_level is not null then 1 else 0 end) desc,
    r.created_at desc
  limit 1;
$$;

create or replace function public.create_approval_authority_rule(
  p_organization_id uuid,
  p_rule_code text,
  p_rule_name text,
  p_workflow_type text,
  p_action_type text,
  p_payload jsonb default '{}'::jsonb,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.approval_authority_rules (
    organization_id,
    rule_code,
    rule_name,
    rule_description,
    workflow_type,
    action_type,
    linked_item_type,
    department_id,
    role_name,
    approver_user_id,
    approver_role,
    min_amount,
    max_amount,
    risk_level,
    severity_level,
    criticality_level,
    document_type,
    escalation_level,
    required_approval_count,
    requires_dual_approval,
    requires_executive_approval,
    allow_self_approval,
    conflict_of_interest_block,
    effective_date,
    expiry_date,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    p_rule_code,
    p_rule_name,
    p_payload->>'rule_description',
    p_workflow_type,
    p_action_type,
    nullif(p_payload->>'linked_item_type', ''),
    nullif(p_payload->>'department_id', '')::uuid,
    nullif(p_payload->>'role_name', ''),
    nullif(p_payload->>'approver_user_id', '')::uuid,
    nullif(p_payload->>'approver_role', ''),
    nullif(p_payload->>'min_amount', '')::numeric,
    nullif(p_payload->>'max_amount', '')::numeric,
    nullif(p_payload->>'risk_level', ''),
    nullif(p_payload->>'severity_level', ''),
    nullif(p_payload->>'criticality_level', ''),
    nullif(p_payload->>'document_type', ''),
    nullif(p_payload->>'escalation_level', ''),
    coalesce(nullif(p_payload->>'required_approval_count', '')::integer, case when coalesce((p_payload->>'requires_dual_approval')::boolean, false) then 2 else 1 end),
    coalesce((p_payload->>'requires_dual_approval')::boolean, false),
    coalesce((p_payload->>'requires_executive_approval')::boolean, false),
    coalesce((p_payload->>'allow_self_approval')::boolean, false),
    coalesce((p_payload->>'conflict_of_interest_block')::boolean, true),
    nullif(p_payload->>'effective_date', '')::date,
    nullif(p_payload->>'expiry_date', '')::date,
    p_actor_id,
    p_actor_id
  )
  returning id into v_rule_id;

  perform public.patch27_write_authority_event(null, v_rule_id, 'rule_created', null, 'active', p_actor_id, p_rule_name);
  return v_rule_id;
end;
$$;

create or replace function public.update_approval_authority_rule(
  p_authority_rule_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule public.approval_authority_rules%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_rule
  from public.approval_authority_rules
  where id = p_authority_rule_id
  for update;

  if not found then
    raise exception 'PATCH27_AUTHORITY_RULE_NOT_FOUND';
  end if;

  update public.approval_authority_rules
  set rule_name = coalesce(nullif(p_payload->>'rule_name', ''), rule_name),
      rule_description = coalesce(p_payload->>'rule_description', rule_description),
      linked_item_type = coalesce(nullif(p_payload->>'linked_item_type', ''), linked_item_type),
      department_id = coalesce(nullif(p_payload->>'department_id', '')::uuid, department_id),
      role_name = coalesce(nullif(p_payload->>'role_name', ''), role_name),
      approver_user_id = coalesce(nullif(p_payload->>'approver_user_id', '')::uuid, approver_user_id),
      approver_role = coalesce(nullif(p_payload->>'approver_role', ''), approver_role),
      min_amount = coalesce(nullif(p_payload->>'min_amount', '')::numeric, min_amount),
      max_amount = coalesce(nullif(p_payload->>'max_amount', '')::numeric, max_amount),
      risk_level = coalesce(nullif(p_payload->>'risk_level', ''), risk_level),
      severity_level = coalesce(nullif(p_payload->>'severity_level', ''), severity_level),
      criticality_level = coalesce(nullif(p_payload->>'criticality_level', ''), criticality_level),
      document_type = coalesce(nullif(p_payload->>'document_type', ''), document_type),
      escalation_level = coalesce(nullif(p_payload->>'escalation_level', ''), escalation_level),
      required_approval_count = coalesce(nullif(p_payload->>'required_approval_count', '')::integer, required_approval_count),
      requires_dual_approval = coalesce((p_payload->>'requires_dual_approval')::boolean, requires_dual_approval),
      requires_executive_approval = coalesce((p_payload->>'requires_executive_approval')::boolean, requires_executive_approval),
      allow_self_approval = coalesce((p_payload->>'allow_self_approval')::boolean, allow_self_approval),
      conflict_of_interest_block = coalesce((p_payload->>'conflict_of_interest_block')::boolean, conflict_of_interest_block),
      effective_date = coalesce(nullif(p_payload->>'effective_date', '')::date, effective_date),
      expiry_date = coalesce(nullif(p_payload->>'expiry_date', '')::date, expiry_date),
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_authority_rule_id;

  perform public.patch27_write_authority_event(null, p_authority_rule_id, 'rule_updated', null, null, p_actor_id, 'Authority rule updated.');
  return jsonb_build_object('status', 'ok', 'authority_rule_id', p_authority_rule_id);
end;
$$;

create or replace function public.disable_approval_authority_rule(
  p_authority_rule_id uuid,
  p_actor_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;

  update public.approval_authority_rules
  set active_flag = false,
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_authority_rule_id;

  if not found then
    raise exception 'PATCH27_AUTHORITY_RULE_NOT_FOUND';
  end if;

  perform public.patch27_write_authority_event(null, p_authority_rule_id, 'rule_disabled', 'active', 'disabled', p_actor_id, p_reason);
  return jsonb_build_object('status', 'ok', 'authority_rule_id', p_authority_rule_id, 'active_flag', false);
end;
$$;

create or replace function public.request_workflow_approval(
  p_organization_id uuid,
  p_workflow_type text,
  p_linked_item_type text,
  p_linked_item_id uuid,
  p_action_type text,
  p_requested_by uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule_id uuid;
  v_request_id uuid;
  v_required_count integer := 1;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;

  v_rule_id := public.resolve_approval_authority_rule(
    p_organization_id,
    p_workflow_type,
    p_action_type,
    p_linked_item_type,
    nullif(p_payload->>'department_id', '')::uuid,
    nullif(p_payload->>'role_name', ''),
    nullif(p_payload->>'amount', '')::numeric,
    nullif(p_payload->>'risk_level', ''),
    nullif(p_payload->>'severity_level', ''),
    nullif(p_payload->>'criticality_level', ''),
    nullif(p_payload->>'document_type', ''),
    nullif(p_payload->>'escalation_level', '')
  );

  select coalesce(required_approval_count, case when requires_dual_approval then 2 else 1 end)
  into v_required_count
  from public.approval_authority_rules
  where id = v_rule_id;

  insert into public.approval_requests (
    organization_id,
    request_code,
    workflow_type,
    linked_item_type,
    linked_item_id,
    action_type,
    department_id,
    requested_by,
    request_reason,
    required_approval_count,
    authority_rule_id,
    amount,
    risk_level,
    severity_level,
    criticality_level,
    document_type,
    escalation_level,
    due_date,
    escalation_required,
    escalation_level_current,
    escalated_to
  )
  values (
    p_organization_id,
    coalesce(nullif(p_payload->>'request_code', ''), 'APR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
    p_workflow_type,
    p_linked_item_type,
    p_linked_item_id,
    p_action_type,
    nullif(p_payload->>'department_id', '')::uuid,
    p_requested_by,
    nullif(p_payload->>'request_reason', ''),
    coalesce(v_required_count, 1),
    v_rule_id,
    nullif(p_payload->>'amount', '')::numeric,
    nullif(p_payload->>'risk_level', ''),
    nullif(p_payload->>'severity_level', ''),
    nullif(p_payload->>'criticality_level', ''),
    nullif(p_payload->>'document_type', ''),
    nullif(p_payload->>'escalation_level', ''),
    nullif(p_payload->>'due_date', '')::date,
    coalesce((p_payload->>'escalation_required')::boolean, false),
    nullif(p_payload->>'escalation_level', ''),
    nullif(p_payload->>'escalated_to', '')::uuid
  )
  returning id into v_request_id;

  perform public.patch27_write_authority_event(v_request_id, v_rule_id, 'request_created', null, 'pending', p_requested_by, nullif(p_payload->>'request_reason', ''));
  if v_rule_id is not null then
    perform public.patch27_write_authority_event(v_request_id, v_rule_id, 'approver_matched', 'pending', 'pending', p_requested_by, 'Authority rule matched.');
  else
    perform public.patch27_write_authority_event(v_request_id, null, 'no_rule_matched', 'pending', 'pending', p_requested_by, 'No active authority rule matched this request.');
  end if;

  return v_request_id;
end;
$$;

create or replace function public.record_approval_decision(
  p_approval_request_id uuid,
  p_approver_id uuid,
  p_decision text,
  p_decision_note text default null,
  p_approver_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.approval_requests%rowtype;
  v_approved_count integer;
  v_new_status text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;
  if p_decision not in ('approved','rejected','returned','abstained') then
    raise exception 'PATCH27_INVALID_DECISION';
  end if;

  select * into v_request
  from public.approval_requests
  where id = p_approval_request_id
  for update;

  if not found then
    raise exception 'PATCH27_APPROVAL_REQUEST_NOT_FOUND';
  end if;

  if v_request.requested_by = p_approver_id
     and exists (
       select 1
       from public.approval_authority_rules r
       where r.id = v_request.authority_rule_id
         and coalesce(r.allow_self_approval, false) = false
     ) then
    raise exception 'PATCH27_SELF_APPROVAL_BLOCKED';
  end if;

  insert into public.approval_decisions (
    approval_request_id,
    approver_id,
    approver_role,
    authority_rule_id,
    decision,
    decision_note
  )
  values (
    p_approval_request_id,
    p_approver_id,
    p_approver_role,
    v_request.authority_rule_id,
    p_decision,
    p_decision_note
  );

  if p_decision = 'rejected' then
    v_new_status := 'rejected';
  elsif p_decision = 'returned' then
    v_new_status := 'returned';
  else
    select count(*)::integer into v_approved_count
    from public.approval_decisions
    where approval_request_id = p_approval_request_id
      and decision = 'approved';

    if v_approved_count >= v_request.required_approval_count then
      v_new_status := 'approved';
    elsif v_approved_count > 0 then
      v_new_status := 'partially_approved';
    else
      v_new_status := v_request.request_status;
    end if;
  end if;

  update public.approval_requests
  set request_status = v_new_status,
      received_approval_count = coalesce(v_approved_count, received_approval_count),
      final_decision = case when v_new_status in ('approved','rejected','returned') then v_new_status else final_decision end,
      final_decision_by = case when v_new_status in ('approved','rejected','returned') then p_approver_id else final_decision_by end,
      final_decision_at = case when v_new_status in ('approved','rejected','returned') then now() else final_decision_at end,
      final_decision_note = case when v_new_status in ('approved','rejected','returned') then p_decision_note else final_decision_note end,
      updated_at = now()
  where id = p_approval_request_id;

  perform public.patch27_write_authority_event(
    p_approval_request_id,
    v_request.authority_rule_id,
    case when p_decision = 'approved' then 'approval_recorded'
         when p_decision = 'rejected' then 'rejection_recorded'
         else 'returned_for_correction' end,
    v_request.request_status,
    v_new_status,
    p_approver_id,
    p_decision_note
  );

  if v_new_status = 'approved' then
    perform public.patch27_write_authority_event(p_approval_request_id, v_request.authority_rule_id, 'final_approved', v_request.request_status, 'approved', p_approver_id, p_decision_note);
  elsif v_new_status = 'rejected' then
    perform public.patch27_write_authority_event(p_approval_request_id, v_request.authority_rule_id, 'final_rejected', v_request.request_status, 'rejected', p_approver_id, p_decision_note);
  end if;

  return jsonb_build_object('status', 'ok', 'approval_request_id', p_approval_request_id, 'request_status', v_new_status);
end;
$$;

create or replace function public.reject_approval_request(
  p_approval_request_id uuid,
  p_actor_id uuid,
  p_note text
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.record_approval_decision(p_approval_request_id, p_actor_id, 'rejected', p_note, null);
$$;

create or replace function public.return_approval_request_for_correction(
  p_approval_request_id uuid,
  p_actor_id uuid,
  p_note text
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.record_approval_decision(p_approval_request_id, p_actor_id, 'returned', p_note, null);
$$;

create or replace function public.escalate_approval_request(
  p_approval_request_id uuid,
  p_actor_id uuid,
  p_escalation_level text,
  p_escalated_to uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_rule_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;

  select request_status, authority_rule_id into v_old_status, v_rule_id
  from public.approval_requests
  where id = p_approval_request_id
  for update;

  if not found then
    raise exception 'PATCH27_APPROVAL_REQUEST_NOT_FOUND';
  end if;

  update public.approval_requests
  set request_status = 'escalated',
      escalation_required = true,
      escalation_level_current = p_escalation_level,
      escalated_at = now(),
      escalated_to = p_escalated_to,
      updated_at = now()
  where id = p_approval_request_id;

  perform public.patch27_write_authority_event(p_approval_request_id, v_rule_id, 'escalated', v_old_status, 'escalated', p_actor_id, p_note);
  return jsonb_build_object('status', 'ok', 'approval_request_id', p_approval_request_id, 'request_status', 'escalated');
end;
$$;

create or replace function public.cancel_approval_request(
  p_approval_request_id uuid,
  p_actor_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_rule_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;

  select request_status, authority_rule_id into v_old_status, v_rule_id
  from public.approval_requests
  where id = p_approval_request_id
  for update;

  if not found then
    raise exception 'PATCH27_APPROVAL_REQUEST_NOT_FOUND';
  end if;

  update public.approval_requests
  set request_status = 'cancelled',
      final_decision = 'cancelled',
      final_decision_by = p_actor_id,
      final_decision_at = now(),
      final_decision_note = p_note,
      updated_at = now()
  where id = p_approval_request_id;

  perform public.patch27_write_authority_event(p_approval_request_id, v_rule_id, 'cancelled', v_old_status, 'cancelled', p_actor_id, p_note);
  return jsonb_build_object('status', 'ok', 'approval_request_id', p_approval_request_id, 'request_status', 'cancelled');
end;
$$;

create or replace function public.check_user_approval_authority(
  p_user_id uuid,
  p_organization_id uuid,
  p_workflow_type text,
  p_action_type text,
  p_department_id uuid default null,
  p_role_name text default null
)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.approval_authority_rules r
    where r.organization_id = p_organization_id
      and r.active_flag = true
      and r.workflow_type = p_workflow_type
      and r.action_type = p_action_type
      and (r.effective_date is null or r.effective_date <= current_date)
      and (r.expiry_date is null or r.expiry_date >= current_date)
      and (r.department_id is null or r.department_id is not distinct from p_department_id)
      and (
        r.approver_user_id = p_user_id
        or (r.approver_role is not null and exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p_user_id
            and ur.is_active = true
            and ur.role::text = r.approver_role
            and (ur.organization_id is null or ur.organization_id is not distinct from p_organization_id)
        ))
        or (r.approver_role is null and r.role_name is not null and r.role_name = p_role_name)
        or exists (
          select 1
          from public.approval_delegations d
          where d.organization_id = p_organization_id
            and d.delegate_id = p_user_id
            and d.active_flag = true
            and d.effective_from <= now()
            and d.effective_to >= now()
            and (d.workflow_type is null or d.workflow_type = p_workflow_type)
            and (d.action_type is null or d.action_type = p_action_type)
            and (d.department_id is null or d.department_id is not distinct from p_department_id)
            and (
              d.delegator_id = r.approver_user_id
              or exists (
                select 1
                from public.user_roles ur2
                where ur2.user_id = d.delegator_id
                  and ur2.is_active = true
                  and ur2.role::text = r.approver_role
                  and (ur2.organization_id is null or ur2.organization_id is not distinct from p_organization_id)
              )
            )
        )
      )
  );
$$;

create or replace function public.create_approval_delegation(
  p_organization_id uuid,
  p_delegator_id uuid,
  p_delegate_id uuid,
  p_effective_from timestamptz,
  p_effective_to timestamptz,
  p_actor_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delegation_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;
  if p_effective_from >= p_effective_to then
    raise exception 'PATCH27_INVALID_DELEGATION_DATES';
  end if;

  insert into public.approval_delegations (
    organization_id,
    delegator_id,
    delegate_id,
    workflow_type,
    action_type,
    department_id,
    effective_from,
    effective_to,
    delegation_reason,
    created_by
  )
  values (
    p_organization_id,
    p_delegator_id,
    p_delegate_id,
    nullif(p_payload->>'workflow_type', ''),
    nullif(p_payload->>'action_type', ''),
    nullif(p_payload->>'department_id', '')::uuid,
    p_effective_from,
    p_effective_to,
    nullif(p_payload->>'delegation_reason', ''),
    p_actor_id
  )
  returning id into v_delegation_id;

  return v_delegation_id;
end;
$$;

create or replace function public.revoke_approval_delegation(
  p_delegation_id uuid,
  p_actor_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;

  update public.approval_delegations
  set active_flag = false
  where id = p_delegation_id;

  if not found then
    raise exception 'PATCH27_DELEGATION_NOT_FOUND';
  end if;

  return jsonb_build_object('status', 'ok', 'delegation_id', p_delegation_id, 'active_flag', false, 'reason', p_reason, 'actor_id', p_actor_id);
end;
$$;

create or replace function public.override_approval_request_with_reason(
  p_approval_request_id uuid,
  p_override_by uuid,
  p_override_decision text,
  p_override_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_status text;
  v_rule_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH27_AUTHORITY_SERVICE_ROLE_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_override_reason, '')), '') is null then
    raise exception 'PATCH27_OVERRIDE_REASON_REQUIRED';
  end if;
  if p_override_decision not in ('approved','rejected','returned','cancelled') then
    raise exception 'PATCH27_INVALID_OVERRIDE_DECISION';
  end if;

  select request_status, authority_rule_id into v_old_status, v_rule_id
  from public.approval_requests
  where id = p_approval_request_id
  for update;

  if not found then
    raise exception 'PATCH27_APPROVAL_REQUEST_NOT_FOUND';
  end if;

  insert into public.approval_authority_overrides (
    approval_request_id,
    override_by,
    override_reason,
    override_decision
  )
  values (
    p_approval_request_id,
    p_override_by,
    p_override_reason,
    p_override_decision
  );

  update public.approval_requests
  set request_status = case when p_override_decision = 'approved' then 'approved'
                            when p_override_decision = 'rejected' then 'rejected'
                            when p_override_decision = 'returned' then 'returned'
                            else 'cancelled' end,
      final_decision = p_override_decision,
      final_decision_by = p_override_by,
      final_decision_at = now(),
      final_decision_note = p_override_reason,
      updated_at = now()
  where id = p_approval_request_id;

  perform public.patch27_write_authority_event(
    p_approval_request_id,
    v_rule_id,
    case when p_override_decision = 'approved' then 'final_approved' else 'final_rejected' end,
    v_old_status,
    p_override_decision,
    p_override_by,
    p_override_reason
  );

  return jsonb_build_object('status', 'ok', 'approval_request_id', p_approval_request_id, 'override_decision', p_override_decision);
end;
$$;

revoke all on function public.patch27_write_authority_event(uuid, uuid, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.patch27_write_authority_event(uuid, uuid, text, text, text, uuid, text) to service_role;

revoke all on function public.create_approval_authority_rule(uuid, text, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_approval_authority_rule(uuid, text, text, text, text, jsonb, uuid) to service_role;

revoke all on function public.update_approval_authority_rule(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.update_approval_authority_rule(uuid, jsonb, uuid) to service_role;

revoke all on function public.disable_approval_authority_rule(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.disable_approval_authority_rule(uuid, uuid, text) to service_role;

revoke all on function public.request_workflow_approval(uuid, text, text, uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.request_workflow_approval(uuid, text, text, uuid, text, uuid, jsonb) to service_role;

revoke all on function public.record_approval_decision(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_approval_decision(uuid, uuid, text, text, text) to service_role;

revoke all on function public.reject_approval_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_approval_request(uuid, uuid, text) to service_role;

revoke all on function public.return_approval_request_for_correction(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.return_approval_request_for_correction(uuid, uuid, text) to service_role;

revoke all on function public.escalate_approval_request(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.escalate_approval_request(uuid, uuid, text, uuid, text) to service_role;

revoke all on function public.cancel_approval_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_approval_request(uuid, uuid, text) to service_role;

revoke all on function public.create_approval_delegation(uuid, uuid, uuid, timestamptz, timestamptz, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_approval_delegation(uuid, uuid, uuid, timestamptz, timestamptz, uuid, jsonb) to service_role;

revoke all on function public.revoke_approval_delegation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.revoke_approval_delegation(uuid, uuid, text) to service_role;

revoke all on function public.override_approval_request_with_reason(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.override_approval_request_with_reason(uuid, uuid, text, text) to service_role;

revoke all on function public.resolve_approval_authority_rule(uuid, text, text, text, uuid, text, numeric, text, text, text, text, text) from public, anon;
grant execute on function public.resolve_approval_authority_rule(uuid, text, text, text, uuid, text, numeric, text, text, text, text, text) to authenticated, service_role;

revoke all on function public.check_user_approval_authority(uuid, uuid, text, text, uuid, text) from public, anon;
grant execute on function public.check_user_approval_authority(uuid, uuid, text, text, uuid, text) to authenticated, service_role;

comment on table public.approval_authority_rules is 'Patch 27 central approval authority matrix rules.';
comment on table public.approval_requests is 'Patch 27 generic approval request tracker for GRC workflows.';
comment on table public.approval_decisions is 'Patch 27 per-approver approval decision history.';
comment on table public.approval_authority_events is 'Patch 27 approval authority audit event log.';
comment on table public.approval_delegations is 'Patch 27 temporary approval delegation register.';
comment on table public.approval_authority_overrides is 'Patch 27 exceptional approval override register with mandatory reason.';
