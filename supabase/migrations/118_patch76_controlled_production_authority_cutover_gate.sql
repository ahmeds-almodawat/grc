-- Patch 76: Controlled Production Authority and Cutover Gate
-- Adds a governed decision record for controlled pilot cutover authority.
-- This decision record does not automatically launch the system.

create table if not exists public.controlled_production_cutover_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null default public.current_user_org_id(),
  decision_state text not null check (
    decision_state in (
      'executive_review_required',
      'blocked',
      'deferred',
      'approved_for_controlled_pilot_cutover',
      'approved_with_limitations'
    )
  ),
  decision_scope text not null default 'controlled_pilot_cutover',
  decision_title text not null,
  decision_summary text null,
  critical_blockers_count integer not null default 0 check (critical_blockers_count >= 0),
  limitations_count integer not null default 0 check (limitations_count >= 0),
  limitations_reviewed boolean not null default false,
  cutover_checklist_complete boolean not null default false,
  evidence_gate_snapshot jsonb not null default '{}'::jsonb,
  decision_rationale text not null,
  decided_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch76_decision_title_required check (nullif(btrim(decision_title), '') is not null),
  constraint patch76_decision_rationale_required check (nullif(btrim(decision_rationale), '') is not null),
  constraint patch76_approved_pilot_cutover_guard check (
    decision_state <> 'approved_for_controlled_pilot_cutover'
    or (
      critical_blockers_count = 0
      and cutover_checklist_complete = true
      and nullif(btrim(decision_rationale), '') is not null
    )
  ),
  constraint patch76_approved_with_limitations_guard check (
    decision_state <> 'approved_with_limitations'
    or (
      critical_blockers_count = 0
      and limitations_count > 0
      and limitations_reviewed = true
      and cutover_checklist_complete = true
      and nullif(btrim(decision_rationale), '') is not null
    )
  )
);

create table if not exists public.controlled_production_cutover_decision_events (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid null references public.controlled_production_cutover_decisions(id) on delete cascade,
  organization_id uuid null default public.current_user_org_id(),
  event_type text not null,
  event_summary text not null,
  event_payload jsonb not null default '{}'::jsonb,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint patch76_event_type_required check (nullif(btrim(event_type), '') is not null),
  constraint patch76_event_summary_required check (nullif(btrim(event_summary), '') is not null)
);

create index if not exists idx_patch76_cutover_decisions_org on public.controlled_production_cutover_decisions(organization_id, decided_at desc);
create index if not exists idx_patch76_cutover_decisions_state on public.controlled_production_cutover_decisions(decision_state, decided_at desc);
create index if not exists idx_patch76_cutover_decision_events_decision on public.controlled_production_cutover_decision_events(decision_id, created_at desc);
create index if not exists idx_patch76_cutover_decision_events_org on public.controlled_production_cutover_decision_events(organization_id, created_at desc);

alter table public.controlled_production_cutover_decisions enable row level security;
alter table public.controlled_production_cutover_decision_events enable row level security;

drop policy if exists patch76_cutover_decisions_read on public.controlled_production_cutover_decisions;
create policy patch76_cutover_decisions_read on public.controlled_production_cutover_decisions
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']::public.app_role[])
    and (
      organization_id is null
      or organization_id = public.current_user_org_id()
    )
  );

drop policy if exists patch76_cutover_decisions_no_direct_insert on public.controlled_production_cutover_decisions;
create policy patch76_cutover_decisions_no_direct_insert on public.controlled_production_cutover_decisions
  for insert to authenticated
  with check (false);

drop policy if exists patch76_cutover_decisions_no_direct_update on public.controlled_production_cutover_decisions;
create policy patch76_cutover_decisions_no_direct_update on public.controlled_production_cutover_decisions
  for update to authenticated
  using (false)
  with check (false);

drop policy if exists patch76_cutover_decisions_no_direct_delete on public.controlled_production_cutover_decisions;
create policy patch76_cutover_decisions_no_direct_delete on public.controlled_production_cutover_decisions
  for delete to authenticated
  using (false);

drop policy if exists patch76_cutover_events_read on public.controlled_production_cutover_decision_events;
create policy patch76_cutover_events_read on public.controlled_production_cutover_decision_events
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']::public.app_role[])
    and (
      organization_id is null
      or organization_id = public.current_user_org_id()
    )
  );

drop policy if exists patch76_cutover_events_no_direct_insert on public.controlled_production_cutover_decision_events;
create policy patch76_cutover_events_no_direct_insert on public.controlled_production_cutover_decision_events
  for insert to authenticated
  with check (false);

drop policy if exists patch76_cutover_events_no_direct_update on public.controlled_production_cutover_decision_events;
create policy patch76_cutover_events_no_direct_update on public.controlled_production_cutover_decision_events
  for update to authenticated
  using (false)
  with check (false);

drop policy if exists patch76_cutover_events_no_direct_delete on public.controlled_production_cutover_decision_events;
create policy patch76_cutover_events_no_direct_delete on public.controlled_production_cutover_decision_events
  for delete to authenticated
  using (false);

create or replace function public.patch76_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 76 controlled cutover decisions require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.patch76_actor_authorized(p_actor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_authorized boolean;
begin
  select p.organization_id
    into v_org_id
  from public.profiles p
  where p.id = p_actor_id
    and coalesce(p.is_active, true) = true;

  if v_org_id is null then
    raise exception 'An active actor profile and organization are required.';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and coalesce(ur.is_active, true) = true
      and (ur.organization_id is null or ur.organization_id = v_org_id)
      and ur.role in ('super_admin', 'executive', 'governance_admin')
  ) into v_authorized;

  if not coalesce(v_authorized, false) then
    raise exception 'Controlled production authority requires an executive, governance admin, or super admin role.';
  end if;

  return v_org_id;
end;
$$;

create or replace function public.patch76_validate_cutover_decision(
  p_decision_state text,
  p_critical_blockers_count integer,
  p_limitations_count integer,
  p_limitations_reviewed boolean,
  p_cutover_checklist_complete boolean,
  p_decision_rationale text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_decision_state not in (
    'executive_review_required',
    'blocked',
    'deferred',
    'approved_for_controlled_pilot_cutover',
    'approved_with_limitations'
  ) then
    raise exception 'Unsupported controlled cutover decision state: %', p_decision_state;
  end if;

  if nullif(btrim(coalesce(p_decision_rationale, '')), '') is null then
    raise exception 'Decision rationale is required.';
  end if;

  if p_decision_state = 'approved_for_controlled_pilot_cutover' then
    if coalesce(p_critical_blockers_count, 0) > 0 then
      raise exception 'Critical blockers prevent approval.';
    end if;
    if coalesce(p_cutover_checklist_complete, false) is not true then
      raise exception 'Cutover checklist incomplete.';
    end if;
  end if;

  if p_decision_state = 'approved_with_limitations' then
    if coalesce(p_critical_blockers_count, 0) > 0 then
      raise exception 'Critical blockers prevent approval.';
    end if;
    if coalesce(p_limitations_count, 0) <= 0 then
      raise exception 'Limitation review required.';
    end if;
    if coalesce(p_limitations_reviewed, false) is not true then
      raise exception 'Limitation review required.';
    end if;
    if coalesce(p_cutover_checklist_complete, false) is not true then
      raise exception 'Cutover checklist incomplete.';
    end if;
  end if;
end;
$$;

create or replace function public.create_controlled_production_cutover_decision(
  p_actor_id uuid,
  p_decision_state text,
  p_decision_title text,
  p_decision_summary text default null,
  p_critical_blockers_count integer default 0,
  p_limitations_count integer default 0,
  p_limitations_reviewed boolean default false,
  p_cutover_checklist_complete boolean default false,
  p_evidence_gate_snapshot jsonb default '{}'::jsonb,
  p_decision_rationale text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_decision_id uuid;
begin
  perform public.patch76_service_role_required();
  v_org_id := public.patch76_actor_authorized(p_actor_id);
  perform public.patch76_validate_cutover_decision(
    p_decision_state,
    coalesce(p_critical_blockers_count, 0),
    coalesce(p_limitations_count, 0),
    coalesce(p_limitations_reviewed, false),
    coalesce(p_cutover_checklist_complete, false),
    p_decision_rationale
  );

  if nullif(btrim(coalesce(p_decision_title, '')), '') is null then
    raise exception 'Controlled cutover decision title is required.';
  end if;

  insert into public.controlled_production_cutover_decisions (
    organization_id,
    decision_state,
    decision_title,
    decision_summary,
    critical_blockers_count,
    limitations_count,
    limitations_reviewed,
    cutover_checklist_complete,
    evidence_gate_snapshot,
    decision_rationale,
    decided_by
  ) values (
    v_org_id,
    p_decision_state,
    btrim(p_decision_title),
    nullif(btrim(coalesce(p_decision_summary, '')), ''),
    coalesce(p_critical_blockers_count, 0),
    coalesce(p_limitations_count, 0),
    coalesce(p_limitations_reviewed, false),
    coalesce(p_cutover_checklist_complete, false),
    coalesce(p_evidence_gate_snapshot, '{}'::jsonb)
      || jsonb_build_object(
        'decision_record_only', true,
        'does_not_automatically_launch_system', true,
        'live_transition_requires_separate_operational_execution', true
      ),
    btrim(p_decision_rationale),
    p_actor_id
  )
  returning id into v_decision_id;

  insert into public.controlled_production_cutover_decision_events (
    decision_id,
    organization_id,
    event_type,
    event_summary,
    event_payload,
    actor_id
  ) values (
    v_decision_id,
    v_org_id,
    'decision_recorded',
    'Controlled cutover decision recorded.',
    jsonb_build_object(
      'decision_state', p_decision_state,
      'critical_blockers_count', coalesce(p_critical_blockers_count, 0),
      'limitations_count', coalesce(p_limitations_count, 0),
      'limitations_reviewed', coalesce(p_limitations_reviewed, false),
      'cutover_checklist_complete', coalesce(p_cutover_checklist_complete, false),
      'does_not_automatically_launch_system', true
    ),
    p_actor_id
  );

  return jsonb_build_object(
    'id', v_decision_id,
    'decision_state', p_decision_state,
    'message', 'Controlled cutover decision recorded. This decision record does not automatically launch the system.'
  );
end;
$$;

create or replace function public.record_controlled_production_cutover_decision_event(
  p_actor_id uuid,
  p_decision_id uuid,
  p_event_type text,
  p_event_summary text,
  p_event_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_decision_org_id uuid;
  v_event_id uuid;
begin
  perform public.patch76_service_role_required();
  v_org_id := public.patch76_actor_authorized(p_actor_id);

  select organization_id
    into v_decision_org_id
  from public.controlled_production_cutover_decisions
  where id = p_decision_id;

  if v_decision_org_id is null or v_decision_org_id <> v_org_id then
    raise exception 'Controlled cutover decision is not available for this organization.';
  end if;

  if nullif(btrim(coalesce(p_event_type, '')), '') is null then
    raise exception 'Event type is required.';
  end if;

  if nullif(btrim(coalesce(p_event_summary, '')), '') is null then
    raise exception 'Event summary is required.';
  end if;

  insert into public.controlled_production_cutover_decision_events (
    decision_id,
    organization_id,
    event_type,
    event_summary,
    event_payload,
    actor_id
  ) values (
    p_decision_id,
    v_org_id,
    btrim(p_event_type),
    btrim(p_event_summary),
    coalesce(p_event_payload, '{}'::jsonb),
    p_actor_id
  )
  returning id into v_event_id;

  return jsonb_build_object('id', v_event_id, 'message', 'Controlled cutover decision event recorded.');
end;
$$;

create or replace function public.get_controlled_production_cutover_decisions()
returns setof public.controlled_production_cutover_decisions
language sql
security invoker
set search_path = public
as $$
  select *
  from public.controlled_production_cutover_decisions
  order by decided_at desc
  limit 50;
$$;

create or replace function public.get_controlled_production_cutover_decision_events(p_decision_id uuid default null)
returns setof public.controlled_production_cutover_decision_events
language sql
security invoker
set search_path = public
as $$
  select *
  from public.controlled_production_cutover_decision_events
  where p_decision_id is null or decision_id = p_decision_id
  order by created_at desc
  limit 100;
$$;

revoke all on function public.patch76_service_role_required() from public, anon, authenticated;
revoke all on function public.patch76_actor_authorized(uuid) from public, anon, authenticated;
revoke all on function public.patch76_validate_cutover_decision(text, integer, integer, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.create_controlled_production_cutover_decision(uuid, text, text, text, integer, integer, boolean, boolean, jsonb, text) from public, anon, authenticated;
revoke all on function public.record_controlled_production_cutover_decision_event(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.patch76_service_role_required() to service_role;
grant execute on function public.patch76_actor_authorized(uuid) to service_role;
grant execute on function public.patch76_validate_cutover_decision(text, integer, integer, boolean, boolean, text) to service_role;
grant execute on function public.create_controlled_production_cutover_decision(uuid, text, text, text, integer, integer, boolean, boolean, jsonb, text) to service_role;
grant execute on function public.record_controlled_production_cutover_decision_event(uuid, uuid, text, text, jsonb) to service_role;

comment on table public.controlled_production_cutover_decisions is 'Patch 76 governed controlled production authority and cutover decision records. Decision records do not automatically launch the system.';
comment on table public.controlled_production_cutover_decision_events is 'Patch 76 append-only audit events for controlled cutover decision records.';
comment on function public.create_controlled_production_cutover_decision(uuid, text, text, text, integer, integer, boolean, boolean, jsonb, text) is 'Records a controlled cutover decision through the authenticated privileged bridge with server-side approval guardrails.';
