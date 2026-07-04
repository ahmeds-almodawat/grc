-- Patch 49: Controlled Pilot Activation & Department Signoff Pack
-- Adds operational controlled-pilot activation tracking without seeding or auto-approving departments.

create table if not exists public.controlled_pilot_activation_runs (
  id uuid primary key default gen_random_uuid(),
  run_label text not null,
  pilot_scope text not null default 'controlled_internal_pilot',
  activation_status text not null default 'planning'
    check (activation_status in ('planning', 'ready_for_review', 'approved', 'approved_with_limitations', 'blocked', 'paused', 'completed')),
  target_start_date date null,
  target_end_date date null,
  executive_sponsor_user_id uuid null references auth.users(id) on delete set null,
  readiness_summary text null,
  limitation_summary text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.controlled_pilot_departments (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete cascade,
  department_id uuid null,
  department_name text not null,
  owner_user_id uuid null references auth.users(id) on delete set null,
  pilot_status text not null default 'pending'
    check (pilot_status in ('pending', 'ready', 'ready_with_limitations', 'blocked', 'not_in_scope')),
  required_participant_count integer not null default 0,
  confirmed_participant_count integer not null default 0,
  missing_owner_reason text null,
  limitation_summary text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.controlled_pilot_department_signoffs (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete cascade,
  department_pilot_id uuid null references public.controlled_pilot_departments(id) on delete cascade,
  department_name text not null,
  signoff_role text not null
    check (signoff_role in ('department_manager', 'quality', 'internal_audit', 'it_admin', 'executive_sponsor')),
  signoff_status text not null default 'pending'
    check (signoff_status in ('pending', 'approved', 'approved_with_limitation', 'rejected', 'overdue', 'not_required')),
  signer_user_id uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  signed_off_at timestamptz null,
  evidence_reference text null,
  limitation_summary text null,
  rejection_reason text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.controlled_pilot_participants (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete cascade,
  department_pilot_id uuid null references public.controlled_pilot_departments(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  display_name text not null,
  participant_role text not null
    check (participant_role in ('executive', 'department_owner', 'quality_reviewer', 'internal_audit', 'frontline_user', 'administrator')),
  participation_status text not null default 'pending'
    check (participation_status in ('pending', 'confirmed', 'declined', 'inactive', 'needs_training')),
  training_required boolean not null default true,
  training_confirmed boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.controlled_pilot_activation_events (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete cascade,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  evidence_reference text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch49_activation_runs_status on public.controlled_pilot_activation_runs(activation_status, created_at desc);
create index if not exists idx_patch49_departments_run on public.controlled_pilot_departments(activation_run_id, pilot_status);
create index if not exists idx_patch49_departments_owner on public.controlled_pilot_departments(owner_user_id);
create index if not exists idx_patch49_signoffs_run on public.controlled_pilot_department_signoffs(activation_run_id, signoff_status);
create index if not exists idx_patch49_signoffs_due on public.controlled_pilot_department_signoffs(due_at);
create index if not exists idx_patch49_participants_run on public.controlled_pilot_participants(activation_run_id, participation_status);
create index if not exists idx_patch49_events_run on public.controlled_pilot_activation_events(activation_run_id, created_at desc);

alter table public.controlled_pilot_activation_runs enable row level security;
alter table public.controlled_pilot_departments enable row level security;
alter table public.controlled_pilot_department_signoffs enable row level security;
alter table public.controlled_pilot_participants enable row level security;
alter table public.controlled_pilot_activation_events enable row level security;

drop policy if exists patch49_activation_runs_read on public.controlled_pilot_activation_runs;
create policy patch49_activation_runs_read on public.controlled_pilot_activation_runs
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch49_activation_runs_write on public.controlled_pilot_activation_runs;
create policy patch49_activation_runs_write on public.controlled_pilot_activation_runs
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch49_departments_read on public.controlled_pilot_departments;
create policy patch49_departments_read on public.controlled_pilot_departments
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch49_departments_write on public.controlled_pilot_departments;
create policy patch49_departments_write on public.controlled_pilot_departments
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch49_signoffs_read on public.controlled_pilot_department_signoffs;
create policy patch49_signoffs_read on public.controlled_pilot_department_signoffs
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch49_signoffs_write on public.controlled_pilot_department_signoffs;
create policy patch49_signoffs_write on public.controlled_pilot_department_signoffs
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch49_participants_read on public.controlled_pilot_participants;
create policy patch49_participants_read on public.controlled_pilot_participants
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch49_participants_write on public.controlled_pilot_participants;
create policy patch49_participants_write on public.controlled_pilot_participants
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch49_events_read on public.controlled_pilot_activation_events;
create policy patch49_events_read on public.controlled_pilot_activation_events
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch49_events_write on public.controlled_pilot_activation_events;
create policy patch49_events_write on public.controlled_pilot_activation_events
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

create or replace view public.v_patch49_controlled_pilot_activation_register
with (security_invoker = true)
as
select
  r.*,
  case
    when r.activation_status in ('approved', 'completed') then 'ready'
    when r.activation_status = 'approved_with_limitations' then 'ready_with_limitations'
    when r.activation_status = 'blocked' then 'blocked'
    when r.activation_status in ('planning', 'ready_for_review', 'paused') then 'planning'
    else 'evidence_required'
  end as pilot_readiness_status
from public.controlled_pilot_activation_runs r;

create or replace view public.v_patch49_department_pilot_readiness_register
with (security_invoker = true)
as
select
  d.*,
  (d.owner_user_id is null) as missing_owner,
  greatest(d.required_participant_count - d.confirmed_participant_count, 0) as participant_gap,
  case
    when d.pilot_status = 'blocked' then 'department pilot area blocked'
    when d.owner_user_id is null then coalesce(nullif(d.missing_owner_reason, ''), 'department owner required')
    when d.required_participant_count > d.confirmed_participant_count then 'participant coverage incomplete'
    when d.pilot_status = 'pending' then 'department readiness signoff pending'
    else null
  end as readiness_blocker_reason
from public.controlled_pilot_departments d;

create or replace view public.v_patch49_department_signoff_register
with (security_invoker = true)
as
select
  s.*,
  (s.signoff_status = 'pending' and s.due_at is not null and s.due_at < now()) as is_overdue,
  case
    when s.signoff_status = 'rejected' then coalesce(nullif(s.rejection_reason, ''), 'department signoff rejected')
    when s.signoff_status = 'pending' and s.due_at is not null and s.due_at < now() then 'department signoff overdue'
    when s.signoff_status = 'pending' then 'department signoff pending'
    when s.signoff_status = 'approved_with_limitation' and nullif(s.limitation_summary, '') is null then 'limitation summary required'
    when s.signoff_status in ('approved', 'approved_with_limitation') and nullif(s.evidence_reference, '') is null then 'signoff evidence required'
    else null
  end as signoff_blocker_reason
from public.controlled_pilot_department_signoffs s;

create or replace view public.v_patch49_missing_department_owner_register
with (security_invoker = true)
as
select *
from public.v_patch49_department_pilot_readiness_register
where missing_owner
  and pilot_status <> 'not_in_scope';

create or replace view public.v_patch49_overdue_department_signoff_register
with (security_invoker = true)
as
select *
from public.v_patch49_department_signoff_register
where signoff_status = 'overdue'
  or is_overdue;

create or replace view public.v_patch49_pilot_participant_coverage
with (security_invoker = true)
as
select
  p.activation_run_id,
  p.department_pilot_id,
  coalesce(d.department_name, 'Unassigned department') as department_name,
  count(*)::integer as participant_count,
  count(*) filter (where p.participation_status = 'confirmed')::integer as confirmed_participant_count,
  count(*) filter (where p.participation_status in ('pending', 'needs_training'))::integer as pending_participant_count,
  count(*) filter (where p.training_required and not p.training_confirmed)::integer as training_required_count,
  count(*) filter (where p.participation_status in ('declined', 'inactive'))::integer as unavailable_participant_count
from public.controlled_pilot_participants p
left join public.controlled_pilot_departments d on d.id = p.department_pilot_id
group by p.activation_run_id, p.department_pilot_id, coalesce(d.department_name, 'Unassigned department');

create or replace view public.v_patch49_controlled_pilot_blockers
with (security_invoker = true)
as
select activation_run_id, department_name, 'missing_owner' as blocker_type, readiness_blocker_reason as blocker_reason, null::text as evidence_reference
from public.v_patch49_department_pilot_readiness_register
where missing_owner and pilot_status <> 'not_in_scope'
union all
select activation_run_id, department_name, 'department_blocked' as blocker_type, readiness_blocker_reason as blocker_reason, null::text as evidence_reference
from public.v_patch49_department_pilot_readiness_register
where pilot_status = 'blocked'
union all
select activation_run_id, department_name, 'signoff_required' as blocker_type, signoff_blocker_reason as blocker_reason, evidence_reference
from public.v_patch49_department_signoff_register
where signoff_blocker_reason is not null
union all
select activation_run_id, department_name, 'participant_training' as blocker_type, 'participant training confirmation required' as blocker_reason, null::text as evidence_reference
from public.v_patch49_pilot_participant_coverage
where training_required_count > 0;

create or replace view public.v_patch49_controlled_pilot_go_no_go_summary
with (security_invoker = true)
as
with latest as (
  select *
  from public.controlled_pilot_activation_runs
  order by updated_at desc, created_at desc
  limit 1
),
dept as (
  select
    count(*)::integer as departments_in_scope,
    count(*) filter (where pilot_status in ('ready', 'ready_with_limitations'))::integer as departments_ready,
    count(*) filter (where pilot_status = 'blocked')::integer as departments_blocked,
    count(*) filter (where owner_user_id is null and pilot_status <> 'not_in_scope')::integer as missing_department_owners
  from public.controlled_pilot_departments
  where activation_run_id = (select id from latest)
    and pilot_status <> 'not_in_scope'
),
signoffs as (
  select
    count(*) filter (where signoff_status = 'pending')::integer as pending_signoffs,
    count(*) filter (where signoff_status = 'overdue' or (signoff_status = 'pending' and due_at is not null and due_at < now()))::integer as overdue_signoffs,
    count(*) filter (where signoff_status = 'rejected')::integer as rejected_signoffs,
    count(*) filter (where signoff_status = 'approved_with_limitation')::integer as approved_with_limitation_signoffs
  from public.controlled_pilot_department_signoffs
  where activation_run_id = (select id from latest)
),
participants as (
  select
    count(*)::integer as participant_count,
    count(*) filter (where participation_status = 'confirmed')::integer as confirmed_participants,
    count(*) filter (where training_required and not training_confirmed)::integer as training_required_participants
  from public.controlled_pilot_participants
  where activation_run_id = (select id from latest)
),
blockers as (
  select count(*)::integer as blocker_count
  from public.v_patch49_controlled_pilot_blockers
  where activation_run_id = (select id from latest)
)
select
  (select id from latest) as activation_run_id,
  coalesce((select run_label from latest), 'No controlled pilot activation run recorded') as run_label,
  coalesce((select activation_status from latest), 'planning') as activation_status,
  coalesce((select pilot_scope from latest), 'controlled_internal_pilot') as pilot_scope,
  coalesce((select departments_in_scope from dept), 0) as departments_in_scope,
  coalesce((select departments_ready from dept), 0) as departments_ready,
  coalesce((select departments_blocked from dept), 0) as departments_blocked,
  coalesce((select missing_department_owners from dept), 0) as missing_department_owners,
  coalesce((select pending_signoffs from signoffs), 0) as pending_signoffs,
  coalesce((select overdue_signoffs from signoffs), 0) as overdue_signoffs,
  coalesce((select rejected_signoffs from signoffs), 0) as rejected_signoffs,
  coalesce((select approved_with_limitation_signoffs from signoffs), 0) as approved_with_limitation_signoffs,
  coalesce((select participant_count from participants), 0) as participant_count,
  coalesce((select confirmed_participants from participants), 0) as confirmed_participants,
  coalesce((select training_required_participants from participants), 0) as training_required_participants,
  coalesce((select blocker_count from blockers), 0) as blocker_count,
  case
    when not exists (select 1 from latest) then 'evidence_required'
    when coalesce((select blocker_count from blockers), 0) > 0
      or coalesce((select departments_blocked from dept), 0) > 0
      or coalesce((select rejected_signoffs from signoffs), 0) > 0
      or coalesce((select overdue_signoffs from signoffs), 0) > 0 then 'blocked'
    when coalesce((select pending_signoffs from signoffs), 0) > 0
      or coalesce((select missing_department_owners from dept), 0) > 0
      or (select activation_status from latest) in ('planning', 'ready_for_review', 'paused') then 'planning'
    when coalesce((select approved_with_limitation_signoffs from signoffs), 0) > 0
      or (select activation_status from latest) = 'approved_with_limitations' then 'ready_with_limitations'
    when (select activation_status from latest) in ('approved', 'completed') then 'ready'
    else 'evidence_required'
  end as pilot_readiness_status
;

create or replace view public.v_patch49_production_readiness_pilot_activation_overlay
with (security_invoker = true)
as
select
  *,
  case
    when pilot_readiness_status = 'ready' then 'Controlled pilot can proceed within approved scope.'
    when pilot_readiness_status = 'ready_with_limitations' then 'Controlled pilot can proceed only with documented limitations and monitoring.'
    when pilot_readiness_status = 'blocked' then 'Resolve blocked departments, rejected signoffs, or overdue approvals before pilot launch.'
    when pilot_readiness_status = 'planning' then 'Complete department owners, participant coverage, and readiness signoffs.'
    else 'Create a controlled pilot activation run and collect department readiness evidence.'
  end as next_action_required
from public.v_patch49_controlled_pilot_go_no_go_summary;

alter view if exists public.v_patch49_controlled_pilot_activation_register set (security_invoker = true);
alter view if exists public.v_patch49_department_pilot_readiness_register set (security_invoker = true);
alter view if exists public.v_patch49_department_signoff_register set (security_invoker = true);
alter view if exists public.v_patch49_missing_department_owner_register set (security_invoker = true);
alter view if exists public.v_patch49_overdue_department_signoff_register set (security_invoker = true);
alter view if exists public.v_patch49_pilot_participant_coverage set (security_invoker = true);
alter view if exists public.v_patch49_controlled_pilot_blockers set (security_invoker = true);
alter view if exists public.v_patch49_controlled_pilot_go_no_go_summary set (security_invoker = true);
alter view if exists public.v_patch49_production_readiness_pilot_activation_overlay set (security_invoker = true);

grant select on public.v_patch49_controlled_pilot_activation_register to authenticated;
grant select on public.v_patch49_department_pilot_readiness_register to authenticated;
grant select on public.v_patch49_department_signoff_register to authenticated;
grant select on public.v_patch49_missing_department_owner_register to authenticated;
grant select on public.v_patch49_overdue_department_signoff_register to authenticated;
grant select on public.v_patch49_pilot_participant_coverage to authenticated;
grant select on public.v_patch49_controlled_pilot_blockers to authenticated;
grant select on public.v_patch49_controlled_pilot_go_no_go_summary to authenticated;
grant select on public.v_patch49_production_readiness_pilot_activation_overlay to authenticated;

create or replace function public.patch49_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 49 controlled pilot mutations require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.record_controlled_pilot_activation_event(
  p_activation_run_id uuid,
  p_event_type text,
  p_event_summary text,
  p_actor_user_id uuid default null,
  p_evidence_reference text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch49_service_role_required();
  insert into public.controlled_pilot_activation_events(activation_run_id, event_type, event_summary, actor_user_id, evidence_reference)
  values (p_activation_run_id, p_event_type, p_event_summary, p_actor_user_id, p_evidence_reference)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_controlled_pilot_activation_run(
  p_run_label text,
  p_pilot_scope text default 'controlled_internal_pilot',
  p_target_start_date date default null,
  p_target_end_date date default null,
  p_executive_sponsor_user_id uuid default null,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch49_service_role_required();
  insert into public.controlled_pilot_activation_runs(run_label, pilot_scope, target_start_date, target_end_date, executive_sponsor_user_id, created_by)
  values (p_run_label, coalesce(nullif(p_pilot_scope, ''), 'controlled_internal_pilot'), p_target_start_date, p_target_end_date, p_executive_sponsor_user_id, p_created_by)
  returning id into v_id;
  perform public.record_controlled_pilot_activation_event(v_id, 'activation_run_created', 'Controlled pilot activation run created in planning status.', p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_controlled_pilot_activation_status(
  p_activation_run_id uuid,
  p_activation_status text,
  p_readiness_summary text default null,
  p_limitation_summary text default null,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.patch49_service_role_required();
  if p_activation_status not in ('planning', 'ready_for_review', 'approved', 'approved_with_limitations', 'blocked', 'paused', 'completed') then
    raise exception 'Invalid controlled pilot activation status: %', p_activation_status;
  end if;
  if p_activation_status in ('approved', 'approved_with_limitations', 'completed')
     and nullif(coalesce(p_readiness_summary, ''), '') is null then
    raise exception 'Readiness summary is required for approved controlled pilot activation status.';
  end if;
  update public.controlled_pilot_activation_runs
  set activation_status = p_activation_status,
      readiness_summary = coalesce(p_readiness_summary, readiness_summary),
      limitation_summary = coalesce(p_limitation_summary, limitation_summary),
      updated_at = now()
  where id = p_activation_run_id;
  if not found then raise exception 'Controlled pilot activation run not found: %', p_activation_run_id; end if;
  perform public.record_controlled_pilot_activation_event(p_activation_run_id, 'activation_status_updated', 'Controlled pilot activation status updated to ' || p_activation_status, p_actor_user_id, null);
  return p_activation_run_id;
end;
$$;

create or replace function public.create_controlled_pilot_department(
  p_activation_run_id uuid,
  p_department_name text,
  p_department_id uuid default null,
  p_owner_user_id uuid default null,
  p_required_participant_count integer default 0,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch49_service_role_required();
  insert into public.controlled_pilot_departments(activation_run_id, department_id, department_name, owner_user_id, required_participant_count, missing_owner_reason, created_by)
  values (p_activation_run_id, p_department_id, p_department_name, p_owner_user_id, greatest(coalesce(p_required_participant_count, 0), 0),
    case when p_owner_user_id is null then 'Department owner is required before pilot readiness can be approved.' else null end, p_created_by)
  returning id into v_id;
  perform public.record_controlled_pilot_activation_event(p_activation_run_id, 'department_added', 'Department added to controlled pilot scope: ' || p_department_name, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_controlled_pilot_department_status(
  p_department_pilot_id uuid,
  p_pilot_status text,
  p_owner_user_id uuid default null,
  p_confirmed_participant_count integer default null,
  p_limitation_summary text default null,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_department_name text;
begin
  perform public.patch49_service_role_required();
  if p_pilot_status not in ('pending', 'ready', 'ready_with_limitations', 'blocked', 'not_in_scope') then
    raise exception 'Invalid controlled pilot department status: %', p_pilot_status;
  end if;
  if p_pilot_status in ('ready', 'ready_with_limitations') and p_owner_user_id is null then
    raise exception 'Department owner is required before marking department pilot readiness as ready.';
  end if;
  update public.controlled_pilot_departments
  set pilot_status = p_pilot_status,
      owner_user_id = coalesce(p_owner_user_id, owner_user_id),
      confirmed_participant_count = coalesce(p_confirmed_participant_count, confirmed_participant_count),
      limitation_summary = coalesce(p_limitation_summary, limitation_summary),
      missing_owner_reason = case when coalesce(p_owner_user_id, owner_user_id) is null then coalesce(missing_owner_reason, 'Department owner is required before pilot readiness can be approved.') else null end
  where id = p_department_pilot_id
  returning activation_run_id, department_name into v_run_id, v_department_name;
  if not found then raise exception 'Controlled pilot department not found: %', p_department_pilot_id; end if;
  perform public.record_controlled_pilot_activation_event(v_run_id, 'department_status_updated', 'Department pilot readiness updated to ' || p_pilot_status || ': ' || v_department_name, p_actor_user_id, null);
  return p_department_pilot_id;
end;
$$;

create or replace function public.create_controlled_pilot_department_signoff(
  p_activation_run_id uuid,
  p_department_pilot_id uuid,
  p_department_name text,
  p_signoff_role text,
  p_due_at timestamptz default null,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch49_service_role_required();
  insert into public.controlled_pilot_department_signoffs(activation_run_id, department_pilot_id, department_name, signoff_role, due_at, created_by)
  values (p_activation_run_id, p_department_pilot_id, p_department_name, p_signoff_role, p_due_at, p_created_by)
  returning id into v_id;
  perform public.record_controlled_pilot_activation_event(p_activation_run_id, 'department_signoff_created', 'Department readiness signoff requested for ' || p_department_name || ' / ' || p_signoff_role, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_controlled_pilot_department_signoff_status(
  p_signoff_id uuid,
  p_signoff_status text,
  p_signer_user_id uuid default null,
  p_evidence_reference text default null,
  p_limitation_summary text default null,
  p_rejection_reason text default null,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_department_name text;
begin
  perform public.patch49_service_role_required();
  if p_signoff_status not in ('pending', 'approved', 'approved_with_limitation', 'rejected', 'overdue', 'not_required') then
    raise exception 'Invalid controlled pilot signoff status: %', p_signoff_status;
  end if;
  if p_signoff_status in ('approved', 'approved_with_limitation') and nullif(coalesce(p_evidence_reference, ''), '') is null then
    raise exception 'Evidence reference is required before approving a controlled pilot department signoff.';
  end if;
  if p_signoff_status = 'approved_with_limitation' and nullif(coalesce(p_limitation_summary, ''), '') is null then
    raise exception 'Limitation summary is required for department signoff approval with limitation.';
  end if;
  if p_signoff_status = 'rejected' and nullif(coalesce(p_rejection_reason, ''), '') is null then
    raise exception 'Rejection reason is required for rejected department pilot signoff.';
  end if;
  update public.controlled_pilot_department_signoffs
  set signoff_status = p_signoff_status,
      signer_user_id = coalesce(p_signer_user_id, signer_user_id),
      evidence_reference = coalesce(p_evidence_reference, evidence_reference),
      limitation_summary = coalesce(p_limitation_summary, limitation_summary),
      rejection_reason = coalesce(p_rejection_reason, rejection_reason),
      signed_off_at = case when p_signoff_status in ('approved', 'approved_with_limitation', 'rejected', 'not_required') then now() else signed_off_at end
  where id = p_signoff_id
  returning activation_run_id, department_name into v_run_id, v_department_name;
  if not found then raise exception 'Controlled pilot department signoff not found: %', p_signoff_id; end if;
  perform public.record_controlled_pilot_activation_event(v_run_id, 'department_signoff_updated', 'Department readiness signoff updated to ' || p_signoff_status || ': ' || v_department_name, p_actor_user_id, p_evidence_reference);
  return p_signoff_id;
end;
$$;

create or replace function public.create_controlled_pilot_participant(
  p_activation_run_id uuid,
  p_department_pilot_id uuid,
  p_display_name text,
  p_participant_role text,
  p_user_id uuid default null,
  p_training_required boolean default true,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch49_service_role_required();
  insert into public.controlled_pilot_participants(activation_run_id, department_pilot_id, user_id, display_name, participant_role, training_required, created_by)
  values (p_activation_run_id, p_department_pilot_id, p_user_id, p_display_name, p_participant_role, coalesce(p_training_required, true), p_created_by)
  returning id into v_id;
  perform public.record_controlled_pilot_activation_event(p_activation_run_id, 'participant_added', 'Pilot participant added: ' || p_display_name, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_controlled_pilot_participant_status(
  p_participant_id uuid,
  p_participation_status text,
  p_training_confirmed boolean default false,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_display_name text;
begin
  perform public.patch49_service_role_required();
  if p_participation_status not in ('pending', 'confirmed', 'declined', 'inactive', 'needs_training') then
    raise exception 'Invalid controlled pilot participant status: %', p_participation_status;
  end if;
  update public.controlled_pilot_participants
  set participation_status = p_participation_status,
      training_confirmed = coalesce(p_training_confirmed, training_confirmed)
  where id = p_participant_id
  returning activation_run_id, display_name into v_run_id, v_display_name;
  if not found then raise exception 'Controlled pilot participant not found: %', p_participant_id; end if;
  perform public.record_controlled_pilot_activation_event(v_run_id, 'participant_status_updated', 'Pilot participant status updated to ' || p_participation_status || ': ' || v_display_name, p_actor_user_id, null);
  return p_participant_id;
end;
$$;

create or replace function public.get_controlled_pilot_go_no_go_summary()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce((select to_jsonb(v) from public.v_patch49_controlled_pilot_go_no_go_summary v limit 1), '{}'::jsonb);
$$;

create or replace function public.get_production_readiness_pilot_activation_overlay()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce((select to_jsonb(v) from public.v_patch49_production_readiness_pilot_activation_overlay v limit 1), '{}'::jsonb);
$$;

revoke all on function public.patch49_service_role_required() from public, anon, authenticated;
revoke all on function public.record_controlled_pilot_activation_event(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_controlled_pilot_activation_run(text, text, date, date, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_controlled_pilot_activation_status(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_controlled_pilot_department(uuid, text, uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.update_controlled_pilot_department_status(uuid, text, uuid, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.create_controlled_pilot_department_signoff(uuid, uuid, text, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.update_controlled_pilot_department_signoff_status(uuid, text, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_controlled_pilot_participant(uuid, uuid, text, text, uuid, boolean, uuid) from public, anon, authenticated;
revoke all on function public.update_controlled_pilot_participant_status(uuid, text, boolean, uuid) from public, anon, authenticated;

grant execute on function public.patch49_service_role_required() to service_role;
grant execute on function public.record_controlled_pilot_activation_event(uuid, text, text, uuid, text) to service_role;
grant execute on function public.create_controlled_pilot_activation_run(text, text, date, date, uuid, uuid) to service_role;
grant execute on function public.update_controlled_pilot_activation_status(uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_controlled_pilot_department(uuid, text, uuid, uuid, integer, uuid) to service_role;
grant execute on function public.update_controlled_pilot_department_status(uuid, text, uuid, integer, text, uuid) to service_role;
grant execute on function public.create_controlled_pilot_department_signoff(uuid, uuid, text, text, timestamptz, uuid) to service_role;
grant execute on function public.update_controlled_pilot_department_signoff_status(uuid, text, uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_controlled_pilot_participant(uuid, uuid, text, text, uuid, boolean, uuid) to service_role;
grant execute on function public.update_controlled_pilot_participant_status(uuid, text, boolean, uuid) to service_role;
grant execute on function public.get_controlled_pilot_go_no_go_summary() to authenticated;
grant execute on function public.get_production_readiness_pilot_activation_overlay() to authenticated;

comment on table public.controlled_pilot_activation_runs is 'Patch 49 controlled pilot activation run register for executive go/no-go readiness.';
comment on table public.controlled_pilot_departments is 'Patch 49 department-level controlled pilot readiness and owner coverage.';
comment on table public.controlled_pilot_department_signoffs is 'Patch 49 department signoff pack for controlled pilot readiness.';
comment on table public.controlled_pilot_participants is 'Patch 49 participant coverage register for controlled pilot departments.';
comment on table public.controlled_pilot_activation_events is 'Patch 49 controlled pilot activation event history.';
