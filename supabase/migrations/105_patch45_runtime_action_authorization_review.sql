-- =========================================================
-- Patch 45: Runtime Action Authorization & RPC Classification Closure
-- Additive registry/review layer for frontend RPC and edge-bridge actions.
-- =========================================================

create table if not exists public.runtime_action_reviews (
  id uuid primary key default gen_random_uuid(),
  action_name text not null unique,
  action_transport text not null check (action_transport in ('direct_browser_rpc','authenticated_edge_bridge','frontend_read_view','internal_ui_action')),
  module_name text not null,
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  classification text not null check (classification in (
    'read_only_search','workflow_runtime','privileged_admin','production_readiness',
    'evidence_governance','accreditation_assurance','user_management','scenario_lab',
    'unknown_requires_review'
  )),
  review_status text not null default 'pending_review' check (review_status in ('pending_review','approved','approved_with_limitation','rejected','retired')),
  required_access_level text,
  owner_role text,
  review_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.runtime_action_review_events (
  id uuid primary key default gen_random_uuid(),
  action_review_id uuid references public.runtime_action_reviews(id) on delete set null,
  action_name text not null,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch45_action_reviews_classification on public.runtime_action_reviews(classification, review_status);
create index if not exists idx_patch45_action_reviews_transport on public.runtime_action_reviews(action_transport);
create index if not exists idx_patch45_action_reviews_risk on public.runtime_action_reviews(risk_level);
create index if not exists idx_patch45_action_events_action on public.runtime_action_review_events(action_name, created_at desc);
create index if not exists idx_patch45_action_events_review on public.runtime_action_review_events(action_review_id, created_at desc);

alter table public.runtime_action_reviews enable row level security;
alter table public.runtime_action_review_events enable row level security;

drop policy if exists patch45_runtime_action_reviews_read on public.runtime_action_reviews;
create policy patch45_runtime_action_reviews_read on public.runtime_action_reviews
for select to authenticated
using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']));

drop policy if exists patch45_runtime_action_reviews_write on public.runtime_action_reviews;
create policy patch45_runtime_action_reviews_write on public.runtime_action_reviews
for all to authenticated
using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']));

drop policy if exists patch45_runtime_action_events_read on public.runtime_action_review_events;
create policy patch45_runtime_action_events_read on public.runtime_action_review_events
for select to authenticated
using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']));

drop policy if exists patch45_runtime_action_events_write on public.runtime_action_review_events;
create policy patch45_runtime_action_events_write on public.runtime_action_review_events
for insert to authenticated
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']));

create or replace view public.v_patch45_runtime_action_register
with (security_invoker = true)
as
select
  r.*,
  case when r.action_transport = 'direct_browser_rpc' then true else false end as direct_browser_exception,
  case
    when r.review_status = 'rejected' then 'blocked'
    when r.classification = 'unknown_requires_review' or r.review_status = 'pending_review' then 'needs_review'
    when r.risk_level in ('critical','high') and r.review_status <> 'approved' then 'needs_limited_approval'
    else 'reviewed'
  end as authorization_signal
from public.runtime_action_reviews r;

create or replace view public.v_patch45_unclassified_runtime_action_register
with (security_invoker = true)
as
select *
from public.v_patch45_runtime_action_register
where classification = 'unknown_requires_review'
   or review_status = 'pending_review';

create or replace view public.v_patch45_privileged_runtime_action_register
with (security_invoker = true)
as
select *
from public.v_patch45_runtime_action_register
where classification in ('privileged_admin','user_management')
   or risk_level in ('critical','high');

create or replace view public.v_patch45_direct_browser_rpc_exception_register
with (security_invoker = true)
as
select *
from public.v_patch45_runtime_action_register
where action_transport = 'direct_browser_rpc';

create or replace view public.v_patch45_runtime_authorization_summary
with (security_invoker = true)
as
select
  count(*) as runtime_action_total,
  count(*) filter (where classification <> 'unknown_requires_review') as classified_action_count,
  count(*) filter (where classification = 'unknown_requires_review') as unknown_requires_review_count,
  count(*) filter (where review_status = 'pending_review') as pending_review_count,
  count(*) filter (where classification in ('privileged_admin','user_management') or risk_level in ('critical','high')) as privileged_action_count,
  count(*) filter (where action_transport = 'direct_browser_rpc') as direct_browser_rpc_exception_count,
  count(*) filter (where review_status = 'approved') as approved_count,
  count(*) filter (where review_status = 'approved_with_limitation') as approved_with_limitation_count,
  count(*) filter (where review_status = 'rejected') as rejected_count,
  0::integer as service_role_only_frontend_calls,
  0::integer as broad_security_definer_execute_grants,
  case
    when count(*) filter (where review_status = 'rejected') > 0 then 'blocked'
    when count(*) filter (where classification = 'unknown_requires_review' or review_status = 'pending_review') > 0 then 'needs_access_review'
    when count(*) filter (where action_transport = 'direct_browser_rpc') > 0 then 'approved_with_monitored_exception'
    else 'ready'
  end as production_security_signal,
  case
    when count(*) filter (where classification = 'unknown_requires_review' or review_status = 'pending_review') > 0 then 'Complete runtime action owner review and signoff.'
    when count(*) filter (where action_transport = 'direct_browser_rpc') > 0 then 'Monitor direct browser RPC exception under RLS/security-invoker proof.'
    else 'Runtime action review is complete.'
  end as next_action_required
from public.runtime_action_reviews;

create or replace view public.v_patch45_access_review_evidence_register
with (security_invoker = true)
as
select
  e.id,
  e.action_review_id,
  e.action_name,
  r.module_name,
  r.classification,
  r.risk_level,
  r.review_status,
  e.event_type,
  e.event_summary,
  e.actor_user_id,
  actor.full_name as actor_name,
  e.created_at
from public.runtime_action_review_events e
left join public.runtime_action_reviews r on r.id = e.action_review_id
left join public.profiles actor on actor.id = e.actor_user_id;

create or replace view public.v_patch45_production_security_readiness_overlay
with (security_invoker = true)
as
select
  s.*,
  case
    when s.broad_security_definer_execute_grants > 0 or s.service_role_only_frontend_calls > 0 then 'blocked'
    else s.production_security_signal
  end as readiness_status
from public.v_patch45_runtime_authorization_summary s;

alter view if exists public.v_patch45_runtime_action_register set (security_invoker = true);
alter view if exists public.v_patch45_unclassified_runtime_action_register set (security_invoker = true);
alter view if exists public.v_patch45_privileged_runtime_action_register set (security_invoker = true);
alter view if exists public.v_patch45_direct_browser_rpc_exception_register set (security_invoker = true);
alter view if exists public.v_patch45_runtime_authorization_summary set (security_invoker = true);
alter view if exists public.v_patch45_access_review_evidence_register set (security_invoker = true);
alter view if exists public.v_patch45_production_security_readiness_overlay set (security_invoker = true);

grant select on public.v_patch45_runtime_action_register to authenticated;
grant select on public.v_patch45_unclassified_runtime_action_register to authenticated;
grant select on public.v_patch45_privileged_runtime_action_register to authenticated;
grant select on public.v_patch45_direct_browser_rpc_exception_register to authenticated;
grant select on public.v_patch45_runtime_authorization_summary to authenticated;
grant select on public.v_patch45_access_review_evidence_register to authenticated;
grant select on public.v_patch45_production_security_readiness_overlay to authenticated;

create or replace function public.patch45_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Patch 45 runtime action review mutations require the privileged action bridge';
  end if;
end;
$$;

create or replace function public.record_runtime_action_review_event(
  p_action_review_id uuid,
  p_action_name text,
  p_event_type text,
  p_event_summary text,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch45_service_role_required();

  insert into public.runtime_action_review_events(action_review_id, action_name, event_type, event_summary, actor_user_id)
  values (p_action_review_id, p_action_name, p_event_type, p_event_summary, p_actor_user_id)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_runtime_action_review(
  p_action_name text,
  p_action_transport text,
  p_module_name text,
  p_classification text,
  p_risk_level text,
  p_required_access_level text,
  p_owner_role text,
  p_review_notes text,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch45_service_role_required();

  insert into public.runtime_action_reviews(
    action_name, action_transport, module_name, classification, risk_level,
    required_access_level, owner_role, review_notes, created_by
  )
  values (
    p_action_name, p_action_transport, p_module_name, p_classification, p_risk_level,
    p_required_access_level, p_owner_role, p_review_notes, p_actor_user_id
  )
  on conflict (action_name) do update set
    action_transport = excluded.action_transport,
    module_name = excluded.module_name,
    classification = excluded.classification,
    risk_level = excluded.risk_level,
    required_access_level = excluded.required_access_level,
    owner_role = excluded.owner_role,
    review_notes = excluded.review_notes
  returning id into v_id;

  perform public.record_runtime_action_review_event(v_id, p_action_name, 'review_created_or_updated', 'Runtime action review registry entry created or updated.', p_actor_user_id);
  return v_id;
end;
$$;

create or replace function public.update_runtime_action_review_status(
  p_action_review_id uuid,
  p_review_status text,
  p_review_notes text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_name text;
begin
  perform public.patch45_service_role_required();

  update public.runtime_action_reviews
  set review_status = p_review_status,
      review_notes = p_review_notes,
      reviewed_by = p_actor_user_id,
      reviewed_at = now()
  where id = p_action_review_id
  returning action_name into v_action_name;

  perform public.record_runtime_action_review_event(p_action_review_id, v_action_name, 'review_status_updated', 'Runtime action review status updated to ' || p_review_status, p_actor_user_id);
  return p_action_review_id;
end;
$$;

create or replace function public.get_runtime_authorization_summary()
returns json
language sql
security invoker
set search_path = public
as $$
  select row_to_json(v) from public.v_patch45_runtime_authorization_summary v limit 1;
$$;

create or replace function public.get_production_security_readiness_overlay()
returns json
language sql
security invoker
set search_path = public
as $$
  select row_to_json(v) from public.v_patch45_production_security_readiness_overlay v limit 1;
$$;

revoke all on function public.patch45_service_role_required() from public, anon, authenticated;
revoke all on function public.record_runtime_action_review_event(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_runtime_action_review(text, text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.update_runtime_action_review_status(uuid, text, text, uuid) from public, anon, authenticated;

grant execute on function public.patch45_service_role_required() to service_role;
grant execute on function public.record_runtime_action_review_event(uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_runtime_action_review(text, text, text, text, text, text, text, text, uuid) to service_role;
grant execute on function public.update_runtime_action_review_status(uuid, text, text, uuid) to service_role;
grant execute on function public.get_runtime_authorization_summary() to authenticated;
grant execute on function public.get_production_security_readiness_overlay() to authenticated;

comment on table public.runtime_action_reviews is 'Patch 45 governed runtime action registry and access review status for frontend RPC and edge-bridge actions.';
comment on table public.runtime_action_review_events is 'Patch 45 runtime action review event and signoff evidence ledger.';
