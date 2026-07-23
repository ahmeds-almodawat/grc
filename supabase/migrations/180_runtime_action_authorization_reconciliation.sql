-- Production Gate 5 / migration 180
-- Reconcile Patch 45 runtime-action authorization and close unknown actions.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $migration$
begin
  if to_regclass('public.runtime_action_reviews') is null
     or to_regclass('public.runtime_action_review_events') is null
     or to_regclass('public.runtime_action_review_signoffs') is null
     or to_regclass('public.profiles') is null
     or to_regprocedure('public.has_any_role(public.app_role[])') is null
     or to_regprocedure('public.patch83u_credential_access_allowed()') is null then
    raise exception using errcode = 'P0001',
      message = 'PATCH180_REQUIRED_AUTHORIZATION_OBJECT_MISSING';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'runtime_action_reviews'
      and policyname = 'patch83u_credential_gate' and permissive = 'RESTRICTIVE'
      and cmd = 'ALL' and roles = array['authenticated']::name[]
      and qual = 'patch83u_credential_access_allowed()'
      and with_check = 'patch83u_credential_access_allowed()'
  ) or not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'runtime_action_review_events'
      and policyname = 'patch83u_credential_gate' and permissive = 'RESTRICTIVE'
      and cmd = 'ALL' and roles = array['authenticated']::name[]
      and qual = 'patch83u_credential_access_allowed()'
      and with_check = 'patch83u_credential_access_allowed()'
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH180_CREDENTIAL_GATE_MISMATCH';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('runtime_action_reviews','runtime_action_review_events')
      and policyname not in (
        'patch45_runtime_action_reviews_read','patch45_runtime_action_reviews_write',
        'patch45_runtime_action_events_read','patch45_runtime_action_events_write',
        'patch83u_credential_gate'
      )
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH180_UNEXPECTED_RUNTIME_POLICY';
  end if;
end;
$migration$;

alter table public.runtime_action_reviews enable row level security;
alter table public.runtime_action_reviews force row level security;
alter table public.runtime_action_review_events enable row level security;
alter table public.runtime_action_review_events force row level security;

drop policy if exists patch45_runtime_action_reviews_read on public.runtime_action_reviews;
create policy patch45_runtime_action_reviews_read on public.runtime_action_reviews
  for select to authenticated
  using (public.has_any_role(array[
    'super_admin'::public.app_role, 'executive'::public.app_role,
    'governance_admin'::public.app_role, 'auditor'::public.app_role,
    'compliance_officer'::public.app_role
  ]));

drop policy if exists patch45_runtime_action_reviews_write on public.runtime_action_reviews;

drop policy if exists patch45_runtime_action_events_read on public.runtime_action_review_events;
create policy patch45_runtime_action_events_read on public.runtime_action_review_events
  for select to authenticated
  using (public.has_any_role(array[
    'super_admin'::public.app_role, 'executive'::public.app_role,
    'governance_admin'::public.app_role, 'auditor'::public.app_role,
    'compliance_officer'::public.app_role
  ]));

drop policy if exists patch45_runtime_action_events_write on public.runtime_action_review_events;

revoke all on table public.runtime_action_reviews from public, anon, authenticated;
revoke all on table public.runtime_action_review_events from public, anon, authenticated;
grant select on table public.runtime_action_reviews to authenticated;
grant select on table public.runtime_action_review_events to authenticated;
grant select, insert, update, delete on table public.runtime_action_reviews to service_role;
grant select, insert, update, delete on table public.runtime_action_review_events to service_role;

create or replace view public.v_patch45_access_review_evidence_register
with (security_invoker = true, security_barrier = true)
as
select
  e.id, e.action_review_id, e.action_name, r.module_name, r.classification,
  r.risk_level, r.review_status, e.event_type, e.event_summary,
  e.actor_user_id,
  coalesce(actor.full_name_en, actor.full_name_ar, actor.email) as actor_name,
  e.created_at
from public.runtime_action_review_events e
left join public.runtime_action_reviews r on r.id = e.action_review_id
left join public.profiles actor on actor.id = e.actor_user_id;

revoke all on public.v_patch45_access_review_evidence_register from public, anon, authenticated;
revoke all on public.v_patch45_access_review_evidence_register from service_role;
grant select on public.v_patch45_access_review_evidence_register to authenticated, service_role;

create or replace function public.patch45_service_role_required()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501',
      message = 'PATCH180_SERVICE_ROLE_REQUIRED';
  end if;
end;
$function$;

create or replace function public.patch83v_runtime_action_authorized(
  p_action_name text,
  p_action_transport text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
  select
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    and exists (
      select 1
      from public.runtime_action_reviews r
      where r.action_name = nullif(btrim(p_action_name), '')
        and r.action_transport = nullif(btrim(p_action_transport), '')
        and r.classification <> 'unknown_requires_review'
        and r.review_status in ('approved', 'approved_with_limitation')
    )
    and exists (
      select 1
      from public.runtime_action_review_signoffs s
      where s.id = (
        select latest.id
        from public.runtime_action_review_signoffs latest
        where latest.action_name = nullif(btrim(p_action_name), '')
          and latest.signoff_status <> 'superseded'
        order by latest.created_at desc, latest.id desc
        limit 1
      )
        and s.signoff_status in ('approved', 'approved_with_limitation')
        and nullif(btrim(s.evidence_reference), '') is not null
        and (
          s.signoff_status = 'approved'
          or nullif(btrim(s.limitation_summary), '') is not null
        )
    )
    and exists (
      select 1 from public.patch83u_runtime_control rc
      where rc.singleton
        and rc.enforcement_state = 'enforced'
        and rc.state_version >= 5
        and rc.compatible_edge_contract_version = rc.expected_edge_contract_version
        and rc.compatible_frontend_contract_version = rc.expected_frontend_contract_version
    );
$function$;

alter function public.record_runtime_action_review_event(uuid, text, text, text, uuid)
  security definer;
alter function public.record_runtime_action_review_event(uuid, text, text, text, uuid)
  set search_path = pg_catalog, public, pg_temp;
alter function public.create_runtime_action_review(text, text, text, text, text, text, text, text, uuid)
  security definer;
alter function public.create_runtime_action_review(text, text, text, text, text, text, text, text, uuid)
  set search_path = pg_catalog, public, pg_temp;
alter function public.update_runtime_action_review_status(uuid, text, text, uuid)
  security definer;
alter function public.update_runtime_action_review_status(uuid, text, text, uuid)
  set search_path = pg_catalog, public, pg_temp;

revoke all on function public.patch45_service_role_required() from public, anon, authenticated;
revoke all on function public.patch83v_runtime_action_authorized(text, text) from public, anon, authenticated;
revoke all on function public.record_runtime_action_review_event(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_runtime_action_review(text, text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.update_runtime_action_review_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.patch45_service_role_required() to service_role;
grant execute on function public.patch83v_runtime_action_authorized(text, text) to service_role;
grant execute on function public.record_runtime_action_review_event(uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_runtime_action_review(text, text, text, text, text, text, text, text, uuid) to service_role;
grant execute on function public.update_runtime_action_review_status(uuid, text, text, uuid) to service_role;

comment on function public.patch83v_runtime_action_authorized(text, text) is
  'Patch 180 service-role-only fail-closed authorization check. Unknown, pending, unsigned, rejected, expired, superseded, contract-incompatible, and absent actions return false.';
comment on view public.v_patch45_access_review_evidence_register is
  'Patch 180 canonical security-invoker/barrier runtime action audit view.';

commit;
