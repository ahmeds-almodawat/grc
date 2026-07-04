-- Patch 50: Real Pilot Master Data Onboarding & Setup Checklist
-- Adds setup gap visibility for real controlled-pilot departments, participants, roles, training, and signoffs.

create table if not exists public.real_pilot_onboarding_reviews (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete cascade,
  review_label text not null,
  review_status text not null default 'draft'
    check (review_status in ('draft', 'in_progress', 'ready_for_review', 'approved', 'approved_with_limitations', 'blocked')),
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  limitation_summary text null,
  blocker_summary text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_pilot_setup_checklist_items (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete cascade,
  department_pilot_id uuid null references public.controlled_pilot_departments(id) on delete cascade,
  checklist_area text not null
    check (checklist_area in ('department_scope', 'owner_assignment', 'participant_mapping', 'role_assignment', 'training_readiness', 'signoff_assignment', 'inactive_user_review', 'launch_blocker_review')),
  item_label text not null,
  item_status text not null default 'pending'
    check (item_status in ('pending', 'ready', 'blocked', 'not_applicable', 'evidence_required')),
  owner_user_id uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  evidence_reference text null,
  issue_summary text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_pilot_master_data_exceptions (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete cascade,
  department_pilot_id uuid null references public.controlled_pilot_departments(id) on delete cascade,
  participant_id uuid null references public.controlled_pilot_participants(id) on delete cascade,
  exception_type text not null
    check (exception_type in ('missing_department_owner', 'missing_participant_role', 'participant_not_confirmed', 'training_not_confirmed', 'signoff_owner_missing', 'signoff_overdue', 'inactive_or_unknown_user', 'department_blocked', 'duplicate_scope_review')),
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  exception_status text not null default 'open'
    check (exception_status in ('open', 'in_review', 'resolved', 'accepted_with_limitation')),
  exception_summary text not null,
  assigned_to uuid null references auth.users(id) on delete set null,
  evidence_reference text null,
  resolution_summary text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_pilot_onboarding_events (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete cascade,
  review_id uuid null references public.real_pilot_onboarding_reviews(id) on delete cascade,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  evidence_reference text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch50_reviews_run on public.real_pilot_onboarding_reviews(activation_run_id, review_status);
create index if not exists idx_patch50_checklist_run on public.real_pilot_setup_checklist_items(activation_run_id, item_status);
create index if not exists idx_patch50_checklist_department on public.real_pilot_setup_checklist_items(department_pilot_id, checklist_area);
create index if not exists idx_patch50_exceptions_run on public.real_pilot_master_data_exceptions(activation_run_id, exception_status, severity);
create index if not exists idx_patch50_exceptions_department on public.real_pilot_master_data_exceptions(department_pilot_id, exception_type);
create index if not exists idx_patch50_events_run on public.real_pilot_onboarding_events(activation_run_id, created_at desc);

alter table public.real_pilot_onboarding_reviews enable row level security;
alter table public.real_pilot_setup_checklist_items enable row level security;
alter table public.real_pilot_master_data_exceptions enable row level security;
alter table public.real_pilot_onboarding_events enable row level security;

drop policy if exists patch50_reviews_read on public.real_pilot_onboarding_reviews;
create policy patch50_reviews_read on public.real_pilot_onboarding_reviews
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch50_reviews_write on public.real_pilot_onboarding_reviews;
create policy patch50_reviews_write on public.real_pilot_onboarding_reviews
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch50_checklist_read on public.real_pilot_setup_checklist_items;
create policy patch50_checklist_read on public.real_pilot_setup_checklist_items
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch50_checklist_write on public.real_pilot_setup_checklist_items;
create policy patch50_checklist_write on public.real_pilot_setup_checklist_items
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch50_exceptions_read on public.real_pilot_master_data_exceptions;
create policy patch50_exceptions_read on public.real_pilot_master_data_exceptions
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch50_exceptions_write on public.real_pilot_master_data_exceptions;
create policy patch50_exceptions_write on public.real_pilot_master_data_exceptions
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch50_events_read on public.real_pilot_onboarding_events;
create policy patch50_events_read on public.real_pilot_onboarding_events
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch50_events_write on public.real_pilot_onboarding_events;
create policy patch50_events_write on public.real_pilot_onboarding_events
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

create or replace view public.v_patch50_real_pilot_onboarding_review_register
with (security_invoker = true)
as
select
  r.*,
  case
    when r.review_status = 'approved' then 'ready'
    when r.review_status = 'approved_with_limitations' then 'ready_with_limitations'
    when r.review_status = 'blocked' then 'blocked'
    when r.review_status in ('draft', 'in_progress', 'ready_for_review') then 'in_progress'
    else 'evidence_required'
  end as setup_status
from public.real_pilot_onboarding_reviews r;

create or replace view public.v_patch50_department_setup_checklist_register
with (security_invoker = true)
as
select
  c.*,
  d.department_name,
  d.owner_user_id as department_owner_user_id,
  (c.item_status = 'pending' and c.due_at is not null and c.due_at < now()) as is_overdue,
  case
    when c.item_status = 'blocked' then coalesce(nullif(c.issue_summary, ''), 'setup item blocked')
    when c.item_status = 'evidence_required' then coalesce(nullif(c.issue_summary, ''), 'setup evidence required')
    when c.owner_user_id is null and c.item_status not in ('ready', 'not_applicable') then 'setup item owner required'
    when c.item_status = 'pending' then 'setup item pending'
    else null
  end as checklist_gap_reason
from public.real_pilot_setup_checklist_items c
left join public.controlled_pilot_departments d on d.id = c.department_pilot_id;

create or replace view public.v_patch50_missing_department_owner_register
with (security_invoker = true)
as
select
  d.activation_run_id,
  d.id as department_pilot_id,
  d.department_name,
  'missing_department_owner'::text as gap_type,
  'high'::text as severity,
  coalesce(nullif(d.missing_owner_reason, ''), 'Department owner must be assigned before pilot launch.') as gap_summary
from public.controlled_pilot_departments d
where d.owner_user_id is null
  and d.pilot_status <> 'not_in_scope';

create or replace view public.v_patch50_pilot_participant_setup_gap_register
with (security_invoker = true)
as
select
  p.activation_run_id,
  p.department_pilot_id,
  p.id as participant_id,
  coalesce(d.department_name, 'Unassigned department') as department_name,
  p.display_name,
  p.participant_role,
  p.participation_status,
  p.training_required,
  p.training_confirmed,
  case
    when p.participation_status in ('declined', 'inactive') then 'inactive_or_unknown_user'
    when p.participation_status = 'needs_training' then 'training_not_confirmed'
    when p.participation_status = 'pending' then 'participant_not_confirmed'
    else 'participant_not_confirmed'
  end as gap_type,
  case
    when p.participation_status in ('declined', 'inactive') then 'high'
    else 'medium'
  end as severity,
  case
    when p.participation_status in ('declined', 'inactive') then 'Pilot participant is unavailable or inactive.'
    when p.participation_status = 'needs_training' then 'Pilot participant requires training confirmation.'
    else 'Pilot participant confirmation is pending.'
  end as gap_summary
from public.controlled_pilot_participants p
left join public.controlled_pilot_departments d on d.id = p.department_pilot_id
where p.participation_status in ('pending', 'declined', 'inactive', 'needs_training');

create or replace view public.v_patch50_pilot_role_assignment_gap_register
with (security_invoker = true)
as
select
  p.activation_run_id,
  p.department_pilot_id,
  p.id as participant_id,
  coalesce(d.department_name, 'Unassigned department') as department_name,
  p.display_name,
  p.participant_role,
  'missing_participant_role'::text as gap_type,
  'medium'::text as severity,
  'Pilot participant role assignment requires review.'::text as gap_summary
from public.controlled_pilot_participants p
left join public.controlled_pilot_departments d on d.id = p.department_pilot_id
where nullif(p.participant_role, '') is null;

create or replace view public.v_patch50_pilot_training_gap_register
with (security_invoker = true)
as
select
  p.activation_run_id,
  p.department_pilot_id,
  p.id as participant_id,
  coalesce(d.department_name, 'Unassigned department') as department_name,
  p.display_name,
  p.participant_role,
  'training_not_confirmed'::text as gap_type,
  'medium'::text as severity,
  'Required pilot training is not confirmed.'::text as gap_summary
from public.controlled_pilot_participants p
left join public.controlled_pilot_departments d on d.id = p.department_pilot_id
where p.training_required = true
  and p.training_confirmed = false;

create or replace view public.v_patch50_pilot_signoff_assignment_gap_register
with (security_invoker = true)
as
select
  s.activation_run_id,
  s.department_pilot_id,
  s.id as signoff_id,
  s.department_name,
  s.signoff_role,
  s.signoff_status,
  s.signer_user_id,
  s.due_at,
  case
    when s.signer_user_id is null and s.signoff_status <> 'not_required' then 'signoff_owner_missing'
    when s.signoff_status = 'overdue' or (s.signoff_status = 'pending' and s.due_at is not null and s.due_at < now()) then 'signoff_overdue'
    else 'signoff_pending'
  end as gap_type,
  case
    when s.signoff_status = 'overdue' or (s.signoff_status = 'pending' and s.due_at is not null and s.due_at < now()) then 'high'
    else 'medium'
  end as severity,
  case
    when s.signer_user_id is null and s.signoff_status <> 'not_required' then 'Department signoff owner is missing.'
    when s.signoff_status = 'overdue' or (s.signoff_status = 'pending' and s.due_at is not null and s.due_at < now()) then 'Department signoff is overdue.'
    else 'Department signoff is pending.'
  end as gap_summary
from public.controlled_pilot_department_signoffs s
where s.signoff_status in ('pending', 'overdue')
   or (s.signer_user_id is null and s.signoff_status <> 'not_required');

create or replace view public.v_patch50_inactive_or_unconfirmed_participant_register
with (security_invoker = true)
as
select *
from public.v_patch50_pilot_participant_setup_gap_register
where participation_status in ('pending', 'declined', 'inactive', 'needs_training');

create or replace view public.v_patch50_real_pilot_master_data_exception_register
with (security_invoker = true)
as
select
  e.*,
  d.department_name,
  p.display_name as participant_name,
  (e.exception_status in ('open', 'in_review') and e.severity in ('critical', 'high')) as is_launch_blocker
from public.real_pilot_master_data_exceptions e
left join public.controlled_pilot_departments d on d.id = e.department_pilot_id
left join public.controlled_pilot_participants p on p.id = e.participant_id;

create or replace view public.v_patch50_real_pilot_launch_blocker_register
with (security_invoker = true)
as
select activation_run_id, department_pilot_id, null::uuid as participant_id, department_name, gap_type as blocker_type, severity, gap_summary as blocker_summary, null::text as evidence_reference
from public.v_patch50_missing_department_owner_register
union all
select activation_run_id, id as department_pilot_id, null::uuid as participant_id, department_name, 'department_blocked'::text as blocker_type, 'high'::text as severity, coalesce(nullif(readiness_blocker_reason, ''), 'Department is blocked for pilot launch.') as blocker_summary, null::text as evidence_reference
from public.v_patch49_department_pilot_readiness_register
where pilot_status = 'blocked'
union all
select activation_run_id, department_pilot_id, participant_id, department_name, gap_type as blocker_type, severity, gap_summary as blocker_summary, null::text as evidence_reference
from public.v_patch50_pilot_participant_setup_gap_register
union all
select activation_run_id, department_pilot_id, participant_id, department_name, gap_type as blocker_type, severity, gap_summary as blocker_summary, null::text as evidence_reference
from public.v_patch50_pilot_role_assignment_gap_register
union all
select activation_run_id, department_pilot_id, participant_id, department_name, gap_type as blocker_type, severity, gap_summary as blocker_summary, null::text as evidence_reference
from public.v_patch50_pilot_training_gap_register
union all
select activation_run_id, department_pilot_id, null::uuid as participant_id, department_name, gap_type as blocker_type, severity, gap_summary as blocker_summary, null::text as evidence_reference
from public.v_patch50_pilot_signoff_assignment_gap_register
union all
select activation_run_id, department_pilot_id, participant_id, coalesce(department_name, 'Unassigned department') as department_name, exception_type as blocker_type, severity, exception_summary as blocker_summary, evidence_reference
from public.v_patch50_real_pilot_master_data_exception_register
where exception_status in ('open', 'in_review')
  and severity in ('critical', 'high');

create or replace view public.v_patch50_real_pilot_setup_summary
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
    count(*) filter (where pilot_status <> 'not_in_scope')::integer as departments_in_scope,
    count(*) filter (where owner_user_id is null and pilot_status <> 'not_in_scope')::integer as departments_missing_owners,
    count(*) filter (where pilot_status = 'blocked')::integer as departments_blocked,
    coalesce(sum(required_participant_count) filter (where pilot_status <> 'not_in_scope'), 0)::integer as required_participants,
    coalesce(sum(confirmed_participant_count) filter (where pilot_status <> 'not_in_scope'), 0)::integer as department_confirmed_participants
  from public.controlled_pilot_departments
  where activation_run_id = (select id from latest)
),
participants as (
  select
    count(*)::integer as participant_count,
    count(*) filter (where participation_status = 'confirmed')::integer as confirmed_participants,
    count(*) filter (where participation_status in ('pending', 'declined', 'inactive', 'needs_training'))::integer as participant_gap_count,
    count(*) filter (where training_required and not training_confirmed)::integer as training_gap_count
  from public.controlled_pilot_participants
  where activation_run_id = (select id from latest)
),
signoffs as (
  select
    count(*) filter (where signoff_status = 'pending')::integer as pending_signoffs,
    count(*) filter (where signoff_status = 'overdue' or (signoff_status = 'pending' and due_at is not null and due_at < now()))::integer as overdue_signoffs,
    count(*) filter (where signer_user_id is null and signoff_status <> 'not_required')::integer as missing_signoff_owners
  from public.controlled_pilot_department_signoffs
  where activation_run_id = (select id from latest)
),
exceptions as (
  select
    count(*) filter (where exception_status in ('open', 'in_review'))::integer as open_exception_count,
    count(*) filter (where exception_status in ('open', 'in_review') and severity = 'critical')::integer as critical_exception_count,
    count(*) filter (where exception_status in ('open', 'in_review') and severity = 'high')::integer as high_exception_count,
    count(*) filter (where exception_status = 'accepted_with_limitation')::integer as limitation_exception_count
  from public.real_pilot_master_data_exceptions
  where activation_run_id = (select id from latest)
),
blockers as (
  select count(*)::integer as launch_blocker_count
  from public.v_patch50_real_pilot_launch_blocker_register
  where activation_run_id = (select id from latest)
)
select
  (select id from latest) as activation_run_id,
  coalesce((select run_label from latest), 'No controlled pilot activation run recorded') as run_label,
  coalesce((select activation_status from latest), 'planning') as activation_status,
  coalesce((select departments_in_scope from dept), 0) as departments_in_scope,
  coalesce((select departments_missing_owners from dept), 0) as departments_missing_owners,
  coalesce((select departments_blocked from dept), 0) as departments_blocked,
  coalesce((select required_participants from dept), 0) as required_participants,
  greatest(coalesce((select confirmed_participants from participants), 0), coalesce((select department_confirmed_participants from dept), 0)) as confirmed_participants,
  coalesce((select participant_count from participants), 0) as participant_count,
  coalesce((select participant_gap_count from participants), 0) as participant_gap_count,
  coalesce((select training_gap_count from participants), 0) as training_gap_count,
  coalesce((select pending_signoffs from signoffs), 0) as pending_signoffs,
  coalesce((select overdue_signoffs from signoffs), 0) as overdue_signoffs,
  coalesce((select missing_signoff_owners from signoffs), 0) as missing_signoff_owners,
  coalesce((select open_exception_count from exceptions), 0) as open_exception_count,
  coalesce((select critical_exception_count from exceptions), 0) as critical_exception_count,
  coalesce((select high_exception_count from exceptions), 0) as high_exception_count,
  coalesce((select limitation_exception_count from exceptions), 0) as limitation_exception_count,
  coalesce((select launch_blocker_count from blockers), 0) as launch_blocker_count,
  case
    when not exists (select 1 from latest) then 0
    when greatest(coalesce((select required_participants from dept), 0), coalesce((select participant_count from participants), 0)) = 0 then 0
    else round((greatest(coalesce((select confirmed_participants from participants), 0), coalesce((select department_confirmed_participants from dept), 0))::numeric / greatest(coalesce((select required_participants from dept), 0), coalesce((select participant_count from participants), 0), 1)::numeric) * 100, 1)
  end as participant_coverage_percentage,
  case
    when not exists (select 1 from latest) then 'evidence_required'
    when coalesce((select launch_blocker_count from blockers), 0) > 0
      or coalesce((select critical_exception_count from exceptions), 0) > 0
      or coalesce((select high_exception_count from exceptions), 0) > 0
      or coalesce((select departments_blocked from dept), 0) > 0
      or coalesce((select overdue_signoffs from signoffs), 0) > 0 then 'blocked'
    when coalesce((select departments_missing_owners from dept), 0) > 0
      or coalesce((select participant_gap_count from participants), 0) > 0
      or coalesce((select training_gap_count from participants), 0) > 0
      or coalesce((select pending_signoffs from signoffs), 0) > 0
      or coalesce((select missing_signoff_owners from signoffs), 0) > 0 then 'in_progress'
    when coalesce((select limitation_exception_count from exceptions), 0) > 0
      or (select activation_status from latest) = 'approved_with_limitations' then 'ready_with_limitations'
    when (select activation_status from latest) in ('approved', 'completed') then 'ready'
    else 'evidence_required'
  end as setup_readiness_status
;

create or replace view public.v_patch50_production_readiness_real_pilot_setup_overlay
with (security_invoker = true)
as
select
  *,
  case
    when setup_readiness_status = 'ready' then 'Real pilot setup is complete for the approved scope.'
    when setup_readiness_status = 'ready_with_limitations' then 'Real pilot setup can proceed only with documented limitations and monitoring.'
    when setup_readiness_status = 'blocked' then 'Resolve owners, blocked departments, overdue signoffs, training gaps, or high-risk exceptions before launch.'
    when setup_readiness_status = 'in_progress' then 'Complete missing owners, participant mapping, role assignment, training confirmation, and signoff coverage.'
    else 'Create a controlled pilot run and complete real department, user, role, training, and signoff setup.'
  end as next_action_required
from public.v_patch50_real_pilot_setup_summary;

alter view if exists public.v_patch50_real_pilot_onboarding_review_register set (security_invoker = true);
alter view if exists public.v_patch50_department_setup_checklist_register set (security_invoker = true);
alter view if exists public.v_patch50_missing_department_owner_register set (security_invoker = true);
alter view if exists public.v_patch50_pilot_participant_setup_gap_register set (security_invoker = true);
alter view if exists public.v_patch50_pilot_role_assignment_gap_register set (security_invoker = true);
alter view if exists public.v_patch50_pilot_training_gap_register set (security_invoker = true);
alter view if exists public.v_patch50_pilot_signoff_assignment_gap_register set (security_invoker = true);
alter view if exists public.v_patch50_inactive_or_unconfirmed_participant_register set (security_invoker = true);
alter view if exists public.v_patch50_real_pilot_master_data_exception_register set (security_invoker = true);
alter view if exists public.v_patch50_real_pilot_launch_blocker_register set (security_invoker = true);
alter view if exists public.v_patch50_real_pilot_setup_summary set (security_invoker = true);
alter view if exists public.v_patch50_production_readiness_real_pilot_setup_overlay set (security_invoker = true);

grant select on public.v_patch50_real_pilot_onboarding_review_register to authenticated;
grant select on public.v_patch50_department_setup_checklist_register to authenticated;
grant select on public.v_patch50_missing_department_owner_register to authenticated;
grant select on public.v_patch50_pilot_participant_setup_gap_register to authenticated;
grant select on public.v_patch50_pilot_role_assignment_gap_register to authenticated;
grant select on public.v_patch50_pilot_training_gap_register to authenticated;
grant select on public.v_patch50_pilot_signoff_assignment_gap_register to authenticated;
grant select on public.v_patch50_inactive_or_unconfirmed_participant_register to authenticated;
grant select on public.v_patch50_real_pilot_master_data_exception_register to authenticated;
grant select on public.v_patch50_real_pilot_launch_blocker_register to authenticated;
grant select on public.v_patch50_real_pilot_setup_summary to authenticated;
grant select on public.v_patch50_production_readiness_real_pilot_setup_overlay to authenticated;

create or replace function public.patch50_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 50 real pilot setup mutations require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.record_real_pilot_onboarding_event(
  p_activation_run_id uuid,
  p_review_id uuid,
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
  perform public.patch50_service_role_required();
  insert into public.real_pilot_onboarding_events(activation_run_id, review_id, event_type, event_summary, actor_user_id, evidence_reference)
  values (p_activation_run_id, p_review_id, p_event_type, p_event_summary, p_actor_user_id, p_evidence_reference)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_real_pilot_onboarding_review(
  p_activation_run_id uuid,
  p_review_label text,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch50_service_role_required();
  insert into public.real_pilot_onboarding_reviews(activation_run_id, review_label, created_by)
  values (p_activation_run_id, p_review_label, p_created_by)
  returning id into v_id;
  perform public.record_real_pilot_onboarding_event(p_activation_run_id, v_id, 'onboarding_review_created', 'Real pilot onboarding review created.', p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_real_pilot_onboarding_review_status(
  p_review_id uuid,
  p_review_status text,
  p_reviewed_by uuid default null,
  p_limitation_summary text default null,
  p_blocker_summary text default null,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  perform public.patch50_service_role_required();
  if p_review_status not in ('draft', 'in_progress', 'ready_for_review', 'approved', 'approved_with_limitations', 'blocked') then
    raise exception 'Invalid real pilot onboarding review status: %', p_review_status;
  end if;
  if p_review_status in ('approved', 'approved_with_limitations') and nullif(coalesce(p_reviewed_by::text, ''), '') is null then
    raise exception 'Reviewer is required before approving real pilot onboarding.';
  end if;
  if p_review_status = 'approved_with_limitations' and nullif(coalesce(p_limitation_summary, ''), '') is null then
    raise exception 'Limitation summary is required for real pilot onboarding approval with limitations.';
  end if;
  if p_review_status = 'blocked' and nullif(coalesce(p_blocker_summary, ''), '') is null then
    raise exception 'Blocker summary is required for blocked real pilot onboarding.';
  end if;
  update public.real_pilot_onboarding_reviews
  set review_status = p_review_status,
      reviewed_by = coalesce(p_reviewed_by, reviewed_by),
      reviewed_at = case when p_review_status in ('approved', 'approved_with_limitations', 'blocked') then now() else reviewed_at end,
      limitation_summary = coalesce(p_limitation_summary, limitation_summary),
      blocker_summary = coalesce(p_blocker_summary, blocker_summary),
      updated_at = now()
  where id = p_review_id
  returning activation_run_id into v_run_id;
  if not found then raise exception 'Real pilot onboarding review not found: %', p_review_id; end if;
  perform public.record_real_pilot_onboarding_event(v_run_id, p_review_id, 'onboarding_review_status_updated', 'Real pilot onboarding review updated to ' || p_review_status, p_actor_user_id, null);
  return p_review_id;
end;
$$;

create or replace function public.create_real_pilot_setup_checklist_item(
  p_activation_run_id uuid,
  p_department_pilot_id uuid,
  p_checklist_area text,
  p_item_label text,
  p_owner_user_id uuid default null,
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
  perform public.patch50_service_role_required();
  insert into public.real_pilot_setup_checklist_items(activation_run_id, department_pilot_id, checklist_area, item_label, owner_user_id, due_at, created_by)
  values (p_activation_run_id, p_department_pilot_id, p_checklist_area, p_item_label, p_owner_user_id, p_due_at, p_created_by)
  returning id into v_id;
  perform public.record_real_pilot_onboarding_event(p_activation_run_id, null, 'setup_checklist_item_created', 'Real pilot setup checklist item created: ' || p_item_label, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_real_pilot_setup_checklist_item_status(
  p_checklist_item_id uuid,
  p_item_status text,
  p_evidence_reference text default null,
  p_issue_summary text default null,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_item_label text;
begin
  perform public.patch50_service_role_required();
  if p_item_status not in ('pending', 'ready', 'blocked', 'not_applicable', 'evidence_required') then
    raise exception 'Invalid real pilot setup checklist item status: %', p_item_status;
  end if;
  if p_item_status = 'ready' and nullif(coalesce(p_evidence_reference, ''), '') is null then
    raise exception 'Evidence reference is required before marking a real pilot setup checklist item ready.';
  end if;
  if p_item_status in ('blocked', 'evidence_required') and nullif(coalesce(p_issue_summary, ''), '') is null then
    raise exception 'Issue summary is required for blocked or evidence-required setup checklist items.';
  end if;
  update public.real_pilot_setup_checklist_items
  set item_status = p_item_status,
      evidence_reference = coalesce(p_evidence_reference, evidence_reference),
      issue_summary = coalesce(p_issue_summary, issue_summary),
      updated_at = now()
  where id = p_checklist_item_id
  returning activation_run_id, item_label into v_run_id, v_item_label;
  if not found then raise exception 'Real pilot setup checklist item not found: %', p_checklist_item_id; end if;
  perform public.record_real_pilot_onboarding_event(v_run_id, null, 'setup_checklist_item_status_updated', 'Real pilot setup checklist item updated to ' || p_item_status || ': ' || v_item_label, p_actor_user_id, p_evidence_reference);
  return p_checklist_item_id;
end;
$$;

create or replace function public.create_real_pilot_master_data_exception(
  p_activation_run_id uuid,
  p_department_pilot_id uuid,
  p_participant_id uuid,
  p_exception_type text,
  p_severity text,
  p_exception_summary text,
  p_assigned_to uuid default null,
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch50_service_role_required();
  insert into public.real_pilot_master_data_exceptions(activation_run_id, department_pilot_id, participant_id, exception_type, severity, exception_summary, assigned_to, created_by)
  values (p_activation_run_id, p_department_pilot_id, p_participant_id, p_exception_type, coalesce(nullif(p_severity, ''), 'medium'), p_exception_summary, p_assigned_to, p_created_by)
  returning id into v_id;
  perform public.record_real_pilot_onboarding_event(p_activation_run_id, null, 'master_data_exception_created', 'Real pilot master data exception created: ' || p_exception_type, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_real_pilot_master_data_exception_status(
  p_exception_id uuid,
  p_exception_status text,
  p_evidence_reference text default null,
  p_resolution_summary text default null,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_exception_type text;
begin
  perform public.patch50_service_role_required();
  if p_exception_status not in ('open', 'in_review', 'resolved', 'accepted_with_limitation') then
    raise exception 'Invalid real pilot master data exception status: %', p_exception_status;
  end if;
  if p_exception_status in ('resolved', 'accepted_with_limitation') and nullif(coalesce(p_resolution_summary, ''), '') is null then
    raise exception 'Resolution summary is required before closing or accepting a real pilot master data exception.';
  end if;
  if p_exception_status = 'accepted_with_limitation' and nullif(coalesce(p_evidence_reference, ''), '') is null then
    raise exception 'Evidence reference is required for master data exception acceptance with limitation.';
  end if;
  update public.real_pilot_master_data_exceptions
  set exception_status = p_exception_status,
      evidence_reference = coalesce(p_evidence_reference, evidence_reference),
      resolution_summary = coalesce(p_resolution_summary, resolution_summary),
      updated_at = now()
  where id = p_exception_id
  returning activation_run_id, exception_type into v_run_id, v_exception_type;
  if not found then raise exception 'Real pilot master data exception not found: %', p_exception_id; end if;
  perform public.record_real_pilot_onboarding_event(v_run_id, null, 'master_data_exception_status_updated', 'Real pilot master data exception updated to ' || p_exception_status || ': ' || v_exception_type, p_actor_user_id, p_evidence_reference);
  return p_exception_id;
end;
$$;

create or replace function public.get_real_pilot_setup_summary()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce((select to_jsonb(v) from public.v_patch50_real_pilot_setup_summary v limit 1), '{}'::jsonb);
$$;

create or replace function public.get_production_readiness_real_pilot_setup_overlay()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce((select to_jsonb(v) from public.v_patch50_production_readiness_real_pilot_setup_overlay v limit 1), '{}'::jsonb);
$$;

revoke all on function public.patch50_service_role_required() from public, anon, authenticated;
revoke all on function public.record_real_pilot_onboarding_event(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_real_pilot_onboarding_review(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.update_real_pilot_onboarding_review_status(uuid, text, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_real_pilot_setup_checklist_item(uuid, uuid, text, text, uuid, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.update_real_pilot_setup_checklist_item_status(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_real_pilot_master_data_exception(uuid, uuid, uuid, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_real_pilot_master_data_exception_status(uuid, text, text, text, uuid) from public, anon, authenticated;

grant execute on function public.patch50_service_role_required() to service_role;
grant execute on function public.record_real_pilot_onboarding_event(uuid, uuid, text, text, uuid, text) to service_role;
grant execute on function public.create_real_pilot_onboarding_review(uuid, text, uuid) to service_role;
grant execute on function public.update_real_pilot_onboarding_review_status(uuid, text, uuid, text, text, uuid) to service_role;
grant execute on function public.create_real_pilot_setup_checklist_item(uuid, uuid, text, text, uuid, timestamptz, uuid) to service_role;
grant execute on function public.update_real_pilot_setup_checklist_item_status(uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_real_pilot_master_data_exception(uuid, uuid, uuid, text, text, text, uuid, uuid) to service_role;
grant execute on function public.update_real_pilot_master_data_exception_status(uuid, text, text, text, uuid) to service_role;
grant execute on function public.get_real_pilot_setup_summary() to authenticated;
grant execute on function public.get_production_readiness_real_pilot_setup_overlay() to authenticated;

comment on table public.real_pilot_onboarding_reviews is 'Patch 50 real pilot onboarding review register for master data readiness.';
comment on table public.real_pilot_setup_checklist_items is 'Patch 50 setup checklist items for real pilot departments, roles, users, training, and signoffs.';
comment on table public.real_pilot_master_data_exceptions is 'Patch 50 controlled register for real pilot master data launch exceptions.';
comment on table public.real_pilot_onboarding_events is 'Patch 50 real pilot onboarding event history.';
