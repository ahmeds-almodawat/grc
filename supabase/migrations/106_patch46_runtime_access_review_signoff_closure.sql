-- Patch 46: Runtime Access Review Signoff Closure
-- Adds operational signoff closure over the Patch 45 runtime action registry.

create table if not exists public.runtime_action_review_signoffs (
  id uuid primary key default gen_random_uuid(),
  action_name text not null,
  reviewer_role text not null,
  reviewer_user_id uuid null references auth.users(id) on delete set null,
  signoff_status text not null default 'pending'
    check (signoff_status in ('pending', 'approved', 'approved_with_limitation', 'rejected', 'expired', 'superseded')),
  risk_acceptance_required boolean not null default false,
  limitation_summary text null,
  evidence_reference text null,
  due_at timestamptz null,
  signed_off_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.runtime_action_review_signoff_events (
  id uuid primary key default gen_random_uuid(),
  signoff_id uuid null references public.runtime_action_review_signoffs(id) on delete set null,
  action_name text not null,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch46_signoffs_action on public.runtime_action_review_signoffs(action_name, created_at desc);
create index if not exists idx_patch46_signoffs_status on public.runtime_action_review_signoffs(signoff_status);
create index if not exists idx_patch46_signoffs_due on public.runtime_action_review_signoffs(due_at);
create index if not exists idx_patch46_signoffs_reviewer on public.runtime_action_review_signoffs(reviewer_role, reviewer_user_id);
create index if not exists idx_patch46_signoff_events_action on public.runtime_action_review_signoff_events(action_name, created_at desc);
create index if not exists idx_patch46_signoff_events_signoff on public.runtime_action_review_signoff_events(signoff_id, created_at desc);

alter table public.runtime_action_review_signoffs enable row level security;
alter table public.runtime_action_review_signoff_events enable row level security;

drop policy if exists patch46_runtime_action_review_signoffs_read on public.runtime_action_review_signoffs;
create policy patch46_runtime_action_review_signoffs_read on public.runtime_action_review_signoffs
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch46_runtime_action_review_signoffs_write on public.runtime_action_review_signoffs;
create policy patch46_runtime_action_review_signoffs_write on public.runtime_action_review_signoffs
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch46_runtime_action_review_signoff_events_read on public.runtime_action_review_signoff_events;
create policy patch46_runtime_action_review_signoff_events_read on public.runtime_action_review_signoff_events
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch46_runtime_action_review_signoff_events_write on public.runtime_action_review_signoff_events;
create policy patch46_runtime_action_review_signoff_events_write on public.runtime_action_review_signoff_events
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

create or replace view public.v_patch46_runtime_access_review_register
with (security_invoker = true)
as
with latest_signoff as (
  select distinct on (s.action_name)
    s.*
  from public.runtime_action_review_signoffs s
  where s.signoff_status <> 'superseded'
  order by s.action_name, s.created_at desc
)
select
  r.action_name,
  r.action_transport,
  r.module_name,
  r.risk_level,
  r.classification,
  r.review_status as classification_review_status,
  r.required_access_level,
  r.owner_role,
  (r.action_transport = 'direct_browser_rpc') as direct_browser_exception,
  s.id as signoff_id,
  coalesce(s.reviewer_role, r.owner_role, 'Runtime Security Reviewer') as reviewer_role,
  s.reviewer_user_id,
  coalesce(s.signoff_status, 'pending') as signoff_status,
  coalesce(
    s.risk_acceptance_required,
    r.risk_level in ('critical', 'high') or r.action_transport = 'direct_browser_rpc'
  ) as risk_acceptance_required,
  s.limitation_summary,
  s.evidence_reference,
  s.due_at,
  s.signed_off_at,
  s.created_at,
  (coalesce(s.signoff_status, 'pending') = 'pending' and s.due_at is not null and s.due_at < now()) as is_overdue,
  case
    when s.id is null then 'missing access-review signoff'
    when s.signoff_status = 'rejected' then 'runtime action signoff rejected'
    when s.signoff_status = 'pending' and s.due_at is not null and s.due_at < now() then 'runtime action signoff overdue'
    when s.signoff_status = 'pending' and r.risk_level in ('critical', 'high') then 'high-risk runtime action pending signoff'
    when s.signoff_status = 'approved_with_limitation' and nullif(s.limitation_summary, '') is null then 'approved with limitation requires limitation summary'
    when s.signoff_status in ('approved', 'approved_with_limitation') and nullif(s.evidence_reference, '') is null then 'closure evidence required'
    else null
  end as blocker_reason
from public.runtime_action_reviews r
left join latest_signoff s on s.action_name = r.action_name;

create or replace view public.v_patch46_pending_runtime_access_reviews
with (security_invoker = true)
as
select *
from public.v_patch46_runtime_access_review_register
where signoff_status = 'pending';

create or replace view public.v_patch46_overdue_runtime_access_reviews
with (security_invoker = true)
as
select *
from public.v_patch46_runtime_access_review_register
where signoff_status = 'pending'
  and is_overdue;

create or replace view public.v_patch46_runtime_access_review_blockers
with (security_invoker = true)
as
select *
from public.v_patch46_runtime_access_review_register
where blocker_reason is not null
  or signoff_status in ('rejected', 'expired');

create or replace view public.v_patch46_runtime_access_review_summary
with (security_invoker = true)
as
with register as (
  select * from public.v_patch46_runtime_access_review_register
),
summary as (
  select
    count(*)::integer as total_runtime_actions,
    count(*) filter (where signoff_status = 'approved')::integer as approved_signoffs,
    count(*) filter (where signoff_status = 'pending')::integer as pending_signoffs,
    count(*) filter (where signoff_status = 'pending' and is_overdue)::integer as overdue_signoffs,
    count(*) filter (where signoff_status = 'rejected')::integer as rejected_signoffs,
    count(*) filter (where signoff_status = 'approved_with_limitation')::integer as approved_with_limitation_signoffs,
    count(*) filter (where direct_browser_exception)::integer as direct_browser_rpc_exception_count,
    count(*) filter (where direct_browser_exception and signoff_status = 'pending')::integer as direct_browser_rpc_exception_pending_count,
    count(*) filter (where risk_acceptance_required)::integer as risk_acceptance_required_count,
    count(*) filter (where signoff_status = 'pending' and risk_level in ('critical', 'high'))::integer as pending_high_risk_signoffs,
    count(*) filter (where blocker_reason is not null or signoff_status in ('rejected', 'expired'))::integer as blocker_count
  from register
)
select
  *,
  case
    when total_runtime_actions = 0 then 'pending_review'
    when rejected_signoffs > 0 or overdue_signoffs > 0 then 'blocked'
    when pending_high_risk_signoffs > 0 or pending_signoffs > 0 then 'pending_review'
    when approved_with_limitation_signoffs > 0 or risk_acceptance_required_count > 0 then 'ready_with_limitations'
    else 'ready'
  end as access_review_readiness_status
from summary;

create or replace view public.v_patch46_runtime_action_risk_acceptance_register
with (security_invoker = true)
as
select *
from public.v_patch46_runtime_access_review_register
where risk_acceptance_required
  or signoff_status = 'approved_with_limitation'
  or direct_browser_exception;

create or replace view public.v_patch46_production_readiness_access_review_overlay
with (security_invoker = true)
as
select
  *,
  case
    when access_review_readiness_status = 'ready' then 'Runtime access review signoffs are closed.'
    when access_review_readiness_status = 'ready_with_limitations' then 'Review approved-with-limitation actions and risk acceptance evidence before production.'
    when access_review_readiness_status = 'blocked' then 'Resolve rejected or overdue runtime access signoffs before production.'
    else 'Complete pending runtime access review signoffs, starting with critical and high-risk actions.'
  end as next_action_required
from public.v_patch46_runtime_access_review_summary;

alter view if exists public.v_patch46_runtime_access_review_register set (security_invoker = true);
alter view if exists public.v_patch46_pending_runtime_access_reviews set (security_invoker = true);
alter view if exists public.v_patch46_overdue_runtime_access_reviews set (security_invoker = true);
alter view if exists public.v_patch46_runtime_access_review_blockers set (security_invoker = true);
alter view if exists public.v_patch46_runtime_access_review_summary set (security_invoker = true);
alter view if exists public.v_patch46_runtime_action_risk_acceptance_register set (security_invoker = true);
alter view if exists public.v_patch46_production_readiness_access_review_overlay set (security_invoker = true);

grant select on public.v_patch46_runtime_access_review_register to authenticated;
grant select on public.v_patch46_pending_runtime_access_reviews to authenticated;
grant select on public.v_patch46_overdue_runtime_access_reviews to authenticated;
grant select on public.v_patch46_runtime_access_review_blockers to authenticated;
grant select on public.v_patch46_runtime_access_review_summary to authenticated;
grant select on public.v_patch46_runtime_action_risk_acceptance_register to authenticated;
grant select on public.v_patch46_production_readiness_access_review_overlay to authenticated;

create or replace function public.patch46_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 46 runtime access review mutations require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.record_runtime_action_review_signoff_event(
  p_signoff_id uuid,
  p_action_name text,
  p_event_type text,
  p_event_summary text,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch46_service_role_required();

  insert into public.runtime_action_review_signoff_events(signoff_id, action_name, event_type, event_summary, actor_user_id)
  values (p_signoff_id, p_action_name, p_event_type, p_event_summary, p_actor_user_id)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_runtime_action_review_signoff(
  p_action_name text,
  p_reviewer_role text,
  p_reviewer_user_id uuid default null,
  p_due_at timestamptz default null,
  p_risk_acceptance_required boolean default false,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch46_service_role_required();

  if nullif(p_action_name, '') is null or nullif(p_reviewer_role, '') is null then
    raise exception 'Action name and reviewer role are required for runtime access review signoff.';
  end if;

  insert into public.runtime_action_review_signoffs(
    action_name,
    reviewer_role,
    reviewer_user_id,
    due_at,
    risk_acceptance_required,
    created_by
  )
  values (
    p_action_name,
    p_reviewer_role,
    p_reviewer_user_id,
    p_due_at,
    coalesce(p_risk_acceptance_required, false),
    p_created_by
  )
  returning id into v_id;

  perform public.record_runtime_action_review_signoff_event(
    v_id,
    p_action_name,
    'signoff_created',
    'Runtime action access-review signoff created and left pending.',
    p_created_by
  );

  return v_id;
end;
$$;

create or replace function public.update_runtime_action_review_signoff_status(
  p_signoff_id uuid,
  p_signoff_status text,
  p_limitation_summary text default null,
  p_evidence_reference text default null,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_name text;
begin
  perform public.patch46_service_role_required();

  if p_signoff_status not in ('pending', 'approved', 'approved_with_limitation', 'rejected', 'expired', 'superseded') then
    raise exception 'Invalid runtime access review signoff status: %', p_signoff_status;
  end if;

  if p_signoff_status in ('approved', 'approved_with_limitation', 'rejected')
     and nullif(coalesce(p_evidence_reference, ''), '') is null then
    raise exception 'Closure evidence required for approved, approved-with-limitation, or rejected runtime access review signoff.';
  end if;

  if p_signoff_status = 'approved_with_limitation'
     and nullif(coalesce(p_limitation_summary, ''), '') is null then
    raise exception 'Limitation summary required for approved-with-limitation runtime access review signoff.';
  end if;

  update public.runtime_action_review_signoffs
  set
    signoff_status = p_signoff_status,
    limitation_summary = coalesce(p_limitation_summary, limitation_summary),
    evidence_reference = coalesce(p_evidence_reference, evidence_reference),
    risk_acceptance_required = case
      when p_signoff_status = 'approved_with_limitation' then true
      else risk_acceptance_required
    end,
    signed_off_at = case
      when p_signoff_status in ('approved', 'approved_with_limitation', 'rejected', 'expired', 'superseded') then now()
      else signed_off_at
    end
  where id = p_signoff_id
  returning action_name into v_action_name;

  if v_action_name is null then
    raise exception 'Runtime access review signoff not found: %', p_signoff_id;
  end if;

  perform public.record_runtime_action_review_signoff_event(
    p_signoff_id,
    v_action_name,
    'signoff_status_updated',
    'Runtime access review signoff status updated to ' || p_signoff_status,
    p_actor_user_id
  );

  return p_signoff_id;
end;
$$;

create or replace function public.get_runtime_access_review_summary()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce((select to_jsonb(v) from public.v_patch46_runtime_access_review_summary v limit 1), '{}'::jsonb);
$$;

create or replace function public.get_production_readiness_access_review_overlay()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce((select to_jsonb(v) from public.v_patch46_production_readiness_access_review_overlay v limit 1), '{}'::jsonb);
$$;

revoke all on function public.patch46_service_role_required() from public, anon, authenticated;
revoke all on function public.record_runtime_action_review_signoff_event(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_runtime_action_review_signoff(text, text, uuid, timestamptz, boolean, uuid) from public, anon, authenticated;
revoke all on function public.update_runtime_action_review_signoff_status(uuid, text, text, text, uuid) from public, anon, authenticated;

grant execute on function public.patch46_service_role_required() to service_role;
grant execute on function public.record_runtime_action_review_signoff_event(uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_runtime_action_review_signoff(text, text, uuid, timestamptz, boolean, uuid) to service_role;
grant execute on function public.update_runtime_action_review_signoff_status(uuid, text, text, text, uuid) to service_role;
grant execute on function public.get_runtime_access_review_summary() to authenticated;
grant execute on function public.get_production_readiness_access_review_overlay() to authenticated;

comment on table public.runtime_action_review_signoffs is 'Patch 46 runtime action access-review signoff workflow with pending, approved, approved-with-limitation, rejected, expired, and superseded states.';
comment on table public.runtime_action_review_signoff_events is 'Patch 46 event ledger for runtime action access-review signoff closure evidence.';
