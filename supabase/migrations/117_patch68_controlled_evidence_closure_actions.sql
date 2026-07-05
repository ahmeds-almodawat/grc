-- Patch 68: Controlled Evidence Closure Actions
-- Adds append-only evidence-level action history through the authenticated privileged bridge.

create table if not exists public.production_evidence_closure_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,
  evidence_id text not null,
  action_type text not null check (
    action_type in (
      'add_note',
      'ready_for_review',
      'request_more_evidence',
      'accept_with_limitation',
      'close_as_verified',
      'reopen_with_reason'
    )
  ),
  action_reason text null,
  action_note text null,
  previous_state text null,
  next_state text not null,
  actor_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint production_evidence_closure_actions_reason_required check (
    action_type not in ('request_more_evidence', 'accept_with_limitation', 'reopen_with_reason')
    or nullif(btrim(coalesce(action_reason, '')), '') is not null
  )
);

create index if not exists idx_patch68_evidence_actions_org on public.production_evidence_closure_actions(organization_id);
create index if not exists idx_patch68_evidence_actions_evidence on public.production_evidence_closure_actions(evidence_id, created_at desc);
create index if not exists idx_patch68_evidence_actions_type on public.production_evidence_closure_actions(action_type, created_at desc);
create index if not exists idx_patch68_evidence_actions_actor on public.production_evidence_closure_actions(actor_id, created_at desc);

alter table public.production_evidence_closure_actions enable row level security;

drop policy if exists patch68_evidence_closure_actions_read on public.production_evidence_closure_actions;
create policy patch68_evidence_closure_actions_read on public.production_evidence_closure_actions
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer'])
    and (
      organization_id is null
      or organization_id = public.current_user_org_id()
    )
  );

drop policy if exists patch68_evidence_closure_actions_no_direct_insert on public.production_evidence_closure_actions;
create policy patch68_evidence_closure_actions_no_direct_insert on public.production_evidence_closure_actions
  for insert to authenticated
  with check (false);

drop policy if exists patch68_evidence_closure_actions_no_direct_update on public.production_evidence_closure_actions;
create policy patch68_evidence_closure_actions_no_direct_update on public.production_evidence_closure_actions
  for update to authenticated
  using (false)
  with check (false);

drop policy if exists patch68_evidence_closure_actions_no_direct_delete on public.production_evidence_closure_actions;
create policy patch68_evidence_closure_actions_no_direct_delete on public.production_evidence_closure_actions
  for delete to authenticated
  using (false);

create or replace function public.patch68_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 68 controlled evidence actions require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.patch68_actor_authorized(p_actor_id uuid)
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
      and ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
  ) into v_authorized;

  if not coalesce(v_authorized, false) then
    raise exception 'Controlled evidence closure actions require an authorized governance, audit, compliance, or executive role.';
  end if;

  return v_org_id;
end;
$$;

create or replace function public.record_production_evidence_closure_action(
  p_actor_id uuid,
  p_evidence_id text,
  p_action_type text,
  p_action_reason text default null,
  p_action_note text default null,
  p_previous_state text default null,
  p_has_blocker boolean default false,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_action_id uuid;
  v_next_state text;
  v_reason text := nullif(btrim(coalesce(p_action_reason, '')), '');
  v_note text := nullif(btrim(coalesce(p_action_note, '')), '');
begin
  perform public.patch68_service_role_required();
  v_org_id := public.patch68_actor_authorized(p_actor_id);

  if nullif(btrim(coalesce(p_evidence_id, '')), '') is null then
    raise exception 'Evidence identifier is required.';
  end if;

  if p_action_type not in (
    'add_note',
    'ready_for_review',
    'request_more_evidence',
    'accept_with_limitation',
    'close_as_verified',
    'reopen_with_reason'
  ) then
    raise exception 'Unsupported controlled evidence action: %', p_action_type;
  end if;

  if p_action_type in ('request_more_evidence', 'accept_with_limitation', 'reopen_with_reason') and v_reason is null then
    raise exception 'Reason is required for this controlled evidence action.';
  end if;

  if p_action_type = 'close_as_verified' and coalesce(p_has_blocker, false) then
    raise exception 'Evidence cannot be closed as verified while blockers remain.';
  end if;

  v_next_state := case p_action_type
    when 'add_note' then coalesce(nullif(p_previous_state, ''), 'open')
    when 'ready_for_review' then 'under_review'
    when 'request_more_evidence' then 'evidence_required'
    when 'accept_with_limitation' then 'accepted_with_limitation'
    when 'close_as_verified' then 'closed'
    when 'reopen_with_reason' then 'open'
    else 'open'
  end;

  insert into public.production_evidence_closure_actions (
    organization_id,
    evidence_id,
    action_type,
    action_reason,
    action_note,
    previous_state,
    next_state,
    actor_id,
    metadata
  ) values (
    v_org_id,
    btrim(p_evidence_id),
    p_action_type,
    v_reason,
    v_note,
    nullif(btrim(coalesce(p_previous_state, '')), ''),
    v_next_state,
    p_actor_id,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'evidence_level_closure_only', true,
        'does_not_approve_production_launch', true,
        'executive_review_required_for_limitations', p_action_type = 'accept_with_limitation'
      )
  )
  returning id into v_action_id;

  return jsonb_build_object(
    'id', v_action_id,
    'evidence_id', btrim(p_evidence_id),
    'action_type', p_action_type,
    'previous_state', p_previous_state,
    'next_state', v_next_state,
    'created_at', now(),
    'message', 'Controlled evidence action recorded.'
  );
end;
$$;

create or replace function public.get_production_evidence_closure_action_history(
  p_actor_id uuid,
  p_evidence_id text
) returns table (
  id uuid,
  evidence_id text,
  action_type text,
  action_reason text,
  action_note text,
  previous_state text,
  next_state text,
  actor_id uuid,
  created_at timestamptz,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  perform public.patch68_service_role_required();
  v_org_id := public.patch68_actor_authorized(p_actor_id);

  return query
  select
    a.id,
    a.evidence_id,
    a.action_type,
    a.action_reason,
    a.action_note,
    a.previous_state,
    a.next_state,
    a.actor_id,
    a.created_at,
    a.metadata
  from public.production_evidence_closure_actions a
  where a.evidence_id = btrim(coalesce(p_evidence_id, ''))
    and (a.organization_id is null or a.organization_id = v_org_id)
  order by a.created_at desc
  limit 25;
end;
$$;

revoke all on function public.patch68_service_role_required() from public, anon, authenticated;
revoke all on function public.patch68_actor_authorized(uuid) from public, anon, authenticated;
revoke all on function public.record_production_evidence_closure_action(uuid, text, text, text, text, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.get_production_evidence_closure_action_history(uuid, text) from public, anon, authenticated;

grant execute on function public.patch68_service_role_required() to service_role;
grant execute on function public.patch68_actor_authorized(uuid) to service_role;
grant execute on function public.record_production_evidence_closure_action(uuid, text, text, text, text, text, boolean, jsonb) to service_role;
grant execute on function public.get_production_evidence_closure_action_history(uuid, text) to service_role;

comment on table public.production_evidence_closure_actions is 'Patch 68 append-only controlled evidence-level closure action history. It does not approve production launch.';
comment on function public.record_production_evidence_closure_action(uuid, text, text, text, text, text, boolean, jsonb) is 'Records a controlled evidence-level action through the authenticated privileged bridge without approving production launch.';
