-- Patch 55: Hospital Operations Readiness Pack
-- Department-level launch readiness for hospital-wide production use.

create table if not exists public.hospital_department_launch_packs (
  id uuid primary key default gen_random_uuid(),
  controlled_pilot_department_id uuid null references public.controlled_pilot_departments(id) on delete set null,
  department_id uuid null,
  launch_label text not null,
  launch_status text not null default 'draft' check (launch_status in ('draft', 'in_progress', 'ready_for_review', 'ready', 'ready_with_limitations', 'blocked', 'deferred', 'cancelled')),
  department_owner_user_id uuid null references auth.users(id) on delete set null,
  operational_owner_user_id uuid null references auth.users(id) on delete set null,
  quality_owner_user_id uuid null references auth.users(id) on delete set null,
  support_owner_user_id uuid null references auth.users(id) on delete set null,
  target_launch_date date null,
  actual_launch_date date null,
  readiness_summary text null,
  blocker_summary text null,
  evidence_reference text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospital_department_launch_checklist_items (
  id uuid primary key default gen_random_uuid(),
  launch_pack_id uuid null references public.hospital_department_launch_packs(id) on delete cascade,
  checklist_key text not null check (checklist_key in ('owner_confirmed', 'users_confirmed', 'roles_confirmed', 'training_confirmed', 'policy_attestation_confirmed', 'sop_owner_confirmed', 'support_path_confirmed', 'department_signoff_confirmed', 'evidence_location_confirmed', 'critical_blockers_cleared')),
  checklist_status text not null default 'pending' check (checklist_status in ('pending', 'complete', 'evidence_required', 'blocked', 'not_applicable')),
  owner_user_id uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  completed_at timestamptz null,
  evidence_reference text null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospital_support_readiness_records (
  id uuid primary key default gen_random_uuid(),
  launch_pack_id uuid null references public.hospital_department_launch_packs(id) on delete cascade,
  controlled_pilot_department_id uuid null references public.controlled_pilot_departments(id) on delete set null,
  support_status text not null default 'pending' check (support_status in ('pending', 'ready', 'ready_with_limitations', 'blocked', 'not_required')),
  support_owner_user_id uuid null references auth.users(id) on delete set null,
  escalation_owner_user_id uuid null references auth.users(id) on delete set null,
  sla_tier text null check (sla_tier is null or sla_tier in ('critical', 'high', 'standard', 'low')),
  response_target_minutes integer null,
  escalation_path text null,
  open_support_issue_count integer not null default 0,
  overdue_support_issue_count integer not null default 0,
  critical_support_issue_count integer not null default 0,
  readiness_notes text null,
  evidence_reference text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospital_policy_attestation_readiness (
  id uuid primary key default gen_random_uuid(),
  launch_pack_id uuid null references public.hospital_department_launch_packs(id) on delete cascade,
  controlled_pilot_department_id uuid null references public.controlled_pilot_departments(id) on delete set null,
  policy_title text not null,
  policy_category text null check (policy_category is null or policy_category in ('policy', 'sop', 'procedure', 'accreditation_requirement', 'safety_requirement')),
  attestation_status text not null default 'pending' check (attestation_status in ('pending', 'partially_attested', 'attested', 'overdue', 'waived', 'blocked')),
  required_for_role text null,
  required_attestation_count integer not null default 0,
  completed_attestation_count integer not null default 0,
  due_at timestamptz null,
  evidence_reference text null,
  owner_user_id uuid null references auth.users(id) on delete set null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospital_adoption_readiness_reviews (
  id uuid primary key default gen_random_uuid(),
  launch_pack_id uuid null references public.hospital_department_launch_packs(id) on delete cascade,
  controlled_pilot_department_id uuid null references public.controlled_pilot_departments(id) on delete set null,
  adoption_status text not null default 'not_assessed' check (adoption_status in ('not_assessed', 'on_track', 'partial_adoption', 'low_adoption', 'blocked')),
  active_user_count integer not null default 0,
  inactive_user_count integer not null default 0,
  training_incomplete_count integer not null default 0,
  failed_workflow_attempt_count integer not null default 0,
  feedback_required_count integer not null default 0,
  support_needed boolean not null default false,
  training_needed boolean not null default false,
  adoption_summary text null,
  owner_user_id uuid null references auth.users(id) on delete set null,
  evidence_reference text null,
  reviewed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospital_operations_readiness_events (
  id uuid primary key default gen_random_uuid(),
  launch_pack_id uuid null references public.hospital_department_launch_packs(id) on delete cascade,
  checklist_item_id uuid null references public.hospital_department_launch_checklist_items(id) on delete cascade,
  support_record_id uuid null references public.hospital_support_readiness_records(id) on delete cascade,
  policy_attestation_id uuid null references public.hospital_policy_attestation_readiness(id) on delete cascade,
  adoption_review_id uuid null references public.hospital_adoption_readiness_reviews(id) on delete cascade,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  evidence_reference text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch55_launch_pack_status on public.hospital_department_launch_packs(launch_status, controlled_pilot_department_id);
create index if not exists idx_patch55_checklist_pack on public.hospital_department_launch_checklist_items(launch_pack_id, checklist_status, checklist_key);
create index if not exists idx_patch55_support_pack on public.hospital_support_readiness_records(launch_pack_id, support_status);
create index if not exists idx_patch55_policy_pack on public.hospital_policy_attestation_readiness(launch_pack_id, attestation_status);
create index if not exists idx_patch55_adoption_pack on public.hospital_adoption_readiness_reviews(launch_pack_id, adoption_status);
create index if not exists idx_patch55_events_pack on public.hospital_operations_readiness_events(launch_pack_id, created_at desc);

alter table public.hospital_department_launch_packs enable row level security;
alter table public.hospital_department_launch_checklist_items enable row level security;
alter table public.hospital_support_readiness_records enable row level security;
alter table public.hospital_policy_attestation_readiness enable row level security;
alter table public.hospital_adoption_readiness_reviews enable row level security;
alter table public.hospital_operations_readiness_events enable row level security;

drop policy if exists patch55_launch_packs_read on public.hospital_department_launch_packs;
create policy patch55_launch_packs_read on public.hospital_department_launch_packs for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch55_launch_packs_write on public.hospital_department_launch_packs;
create policy patch55_launch_packs_write on public.hospital_department_launch_packs for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch55_checklist_read on public.hospital_department_launch_checklist_items;
create policy patch55_checklist_read on public.hospital_department_launch_checklist_items for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch55_checklist_write on public.hospital_department_launch_checklist_items;
create policy patch55_checklist_write on public.hospital_department_launch_checklist_items for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch55_support_read on public.hospital_support_readiness_records;
create policy patch55_support_read on public.hospital_support_readiness_records for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch55_support_write on public.hospital_support_readiness_records;
create policy patch55_support_write on public.hospital_support_readiness_records for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch55_policy_read on public.hospital_policy_attestation_readiness;
create policy patch55_policy_read on public.hospital_policy_attestation_readiness for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch55_policy_write on public.hospital_policy_attestation_readiness;
create policy patch55_policy_write on public.hospital_policy_attestation_readiness for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch55_adoption_read on public.hospital_adoption_readiness_reviews;
create policy patch55_adoption_read on public.hospital_adoption_readiness_reviews for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch55_adoption_write on public.hospital_adoption_readiness_reviews;
create policy patch55_adoption_write on public.hospital_adoption_readiness_reviews for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch55_events_read on public.hospital_operations_readiness_events;
create policy patch55_events_read on public.hospital_operations_readiness_events for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch55_events_write on public.hospital_operations_readiness_events;
create policy patch55_events_write on public.hospital_operations_readiness_events for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

create or replace view public.v_patch55_department_launch_pack_register with (security_invoker = true) as
select p.*,
  d.department_name,
  (p.department_owner_user_id is null) as missing_department_owner,
  (p.support_owner_user_id is null) as missing_support_owner,
  (p.launch_status in ('ready', 'ready_with_limitations') and p.department_owner_user_id is not null and p.support_owner_user_id is not null) as appears_ready_by_status
from public.hospital_department_launch_packs p
left join public.controlled_pilot_departments d on d.id = p.controlled_pilot_department_id;

create or replace view public.v_patch55_department_launch_checklist_register with (security_invoker = true) as
select c.*, p.launch_label, p.controlled_pilot_department_id, coalesce(d.department_name, p.launch_label) as department_name,
  (c.checklist_status in ('pending', 'evidence_required', 'blocked')) as is_incomplete_required
from public.hospital_department_launch_checklist_items c
left join public.hospital_department_launch_packs p on p.id = c.launch_pack_id
left join public.controlled_pilot_departments d on d.id = p.controlled_pilot_department_id;

create or replace view public.v_patch55_incomplete_launch_checklist_register with (security_invoker = true) as
select * from public.v_patch55_department_launch_checklist_register
where checklist_status in ('pending', 'evidence_required', 'blocked');

create or replace view public.v_patch55_department_support_readiness_register with (security_invoker = true) as
select s.*, p.launch_label, p.controlled_pilot_department_id as pack_department_pilot_id, coalesce(d.department_name, p.launch_label) as department_name,
  (s.support_status in ('pending', 'blocked') or s.support_owner_user_id is null or s.critical_support_issue_count > 0) as has_support_blocker
from public.hospital_support_readiness_records s
left join public.hospital_department_launch_packs p on p.id = s.launch_pack_id
left join public.controlled_pilot_departments d on d.id = coalesce(s.controlled_pilot_department_id, p.controlled_pilot_department_id);

create or replace view public.v_patch55_support_readiness_blocker_register with (security_invoker = true) as
select * from public.v_patch55_department_support_readiness_register
where has_support_blocker;

create or replace view public.v_patch55_policy_attestation_readiness_register with (security_invoker = true) as
select a.*, p.launch_label, p.controlled_pilot_department_id as pack_department_pilot_id, coalesce(d.department_name, p.launch_label) as department_name,
  (a.attestation_status in ('pending', 'partially_attested', 'overdue', 'blocked')
    or a.required_attestation_count > a.completed_attestation_count) as has_attestation_gap
from public.hospital_policy_attestation_readiness a
left join public.hospital_department_launch_packs p on p.id = a.launch_pack_id
left join public.controlled_pilot_departments d on d.id = coalesce(a.controlled_pilot_department_id, p.controlled_pilot_department_id);

create or replace view public.v_patch55_missing_policy_attestation_register with (security_invoker = true) as
select * from public.v_patch55_policy_attestation_readiness_register
where has_attestation_gap;

create or replace view public.v_patch55_department_adoption_readiness_register with (security_invoker = true) as
select r.*, p.launch_label, p.controlled_pilot_department_id as pack_department_pilot_id, coalesce(d.department_name, p.launch_label) as department_name,
  (r.adoption_status in ('low_adoption', 'blocked')
    or r.inactive_user_count > 0
    or r.training_incomplete_count > 0
    or r.failed_workflow_attempt_count > 0
    or r.feedback_required_count > 0
    or r.support_needed
    or r.training_needed) as has_adoption_blocker
from public.hospital_adoption_readiness_reviews r
left join public.hospital_department_launch_packs p on p.id = r.launch_pack_id
left join public.controlled_pilot_departments d on d.id = coalesce(r.controlled_pilot_department_id, p.controlled_pilot_department_id);

create or replace view public.v_patch55_low_adoption_department_register with (security_invoker = true) as
select * from public.v_patch55_department_adoption_readiness_register
where has_adoption_blocker;

create or replace view public.v_patch55_department_launch_blocker_register with (security_invoker = true) as
select p.id as launch_pack_id, p.controlled_pilot_department_id, coalesce(p.department_name, p.launch_label) as department_name,
  'launch_status'::text as blocker_type,
  case when p.launch_status = 'blocked' then coalesce(p.blocker_summary, 'Department launch is blocked.')
       when p.department_owner_user_id is null then 'Department launch owner is required.'
       when p.support_owner_user_id is null then 'Support owner and escalation path are required.'
       else 'Department launch evidence is required.' end as blocker_reason,
  p.evidence_reference
from public.v_patch55_department_launch_pack_register p
where p.launch_status in ('draft', 'in_progress', 'ready_for_review', 'blocked') or p.department_owner_user_id is null or p.support_owner_user_id is null
union all
select launch_pack_id, controlled_pilot_department_id, department_name, checklist_key, 'Launch checklist item is incomplete: ' || checklist_key, evidence_reference
from public.v_patch55_incomplete_launch_checklist_register
union all
select launch_pack_id, coalesce(controlled_pilot_department_id, pack_department_pilot_id), department_name, 'support_readiness',
  case when support_owner_user_id is null then 'Support owner is required.'
       when support_status in ('pending', 'blocked') then 'Support readiness is pending or blocked.'
       when critical_support_issue_count > 0 then 'Critical support issues remain open.'
       else 'Support readiness evidence is required.' end,
  evidence_reference
from public.v_patch55_support_readiness_blocker_register
union all
select launch_pack_id, coalesce(controlled_pilot_department_id, pack_department_pilot_id), department_name, 'policy_attestation',
  'Policy or SOP attestation is incomplete for ' || policy_title,
  evidence_reference
from public.v_patch55_missing_policy_attestation_register
union all
select launch_pack_id, coalesce(controlled_pilot_department_id, pack_department_pilot_id), department_name, 'adoption_readiness',
  case when adoption_status in ('low_adoption', 'blocked') then 'Department adoption is low or blocked.'
       when inactive_user_count > 0 then 'Inactive users remain in department launch scope.'
       when training_incomplete_count > 0 then 'Training remains incomplete.'
       when failed_workflow_attempt_count > 0 then 'Failed workflow attempts require follow-up.'
       else 'Department adoption follow-up is required.' end,
  evidence_reference
from public.v_patch55_low_adoption_department_register
union all
select null::uuid, null::uuid, coalesce(blocker_area, 'Pilot closure') as department_name, 'pilot_closure', blocker_summary, evidence_reference
from public.v_patch52_pilot_closure_blocker_register
where blocker_type in ('high', 'critical', 'blocked', 'overdue')
union all
select null::uuid, null::uuid, coalesce(blocker_area, 'Hypercare') as department_name, 'hypercare', blocker_summary, evidence_reference
from public.v_patch53_hypercare_blocker_register;

create or replace view public.v_patch55_hospital_operations_readiness_summary with (security_invoker = true) as
with packs as (
  select
    count(*)::integer as total_department_launch_packs,
    count(*) filter (where launch_status = 'ready' and department_owner_user_id is not null and support_owner_user_id is not null)::integer as ready_departments,
    count(*) filter (where launch_status = 'ready_with_limitations')::integer as ready_with_limitations_departments,
    count(*) filter (where launch_status = 'blocked')::integer as blocked_departments,
    count(*) filter (where launch_status in ('draft', 'in_progress', 'ready_for_review') or department_owner_user_id is null or support_owner_user_id is null)::integer as evidence_required_departments,
    count(*) filter (where department_owner_user_id is null)::integer as missing_owner_count
  from public.hospital_department_launch_packs
),
checklist as (
  select count(*)::integer as incomplete_launch_checklist_items from public.v_patch55_incomplete_launch_checklist_register
),
support as (
  select
    count(*)::integer as support_readiness_blockers,
    coalesce(sum(critical_support_issue_count), 0)::integer as critical_support_issues
  from public.v_patch55_support_readiness_blocker_register
),
policy as (
  select count(*)::integer as policy_attestation_gaps from public.v_patch55_missing_policy_attestation_register
),
adoption as (
  select
    count(*)::integer as low_adoption_departments,
    coalesce(sum(inactive_user_count), 0)::integer as inactive_users,
    coalesce(sum(training_incomplete_count), 0)::integer as training_incomplete_count,
    coalesce(sum(failed_workflow_attempt_count), 0)::integer as failed_workflow_attempt_count
  from public.v_patch55_low_adoption_department_register
),
blockers as (
  select count(*)::integer as department_launch_blocker_count from public.v_patch55_department_launch_blocker_register
)
select
  coalesce((select total_department_launch_packs from packs), 0) as total_department_launch_packs,
  coalesce((select ready_departments from packs), 0) as ready_departments,
  coalesce((select ready_with_limitations_departments from packs), 0) as ready_with_limitations_departments,
  coalesce((select blocked_departments from packs), 0) as blocked_departments,
  coalesce((select evidence_required_departments from packs), 0) as evidence_required_departments,
  coalesce((select incomplete_launch_checklist_items from checklist), 0) as incomplete_launch_checklist_items,
  coalesce((select missing_owner_count from packs), 0) as missing_owner_count,
  coalesce((select support_readiness_blockers from support), 0) as support_readiness_blockers,
  coalesce((select policy_attestation_gaps from policy), 0) as policy_attestation_gaps,
  coalesce((select low_adoption_departments from adoption), 0) as low_adoption_departments,
  coalesce((select inactive_users from adoption), 0) as inactive_users,
  coalesce((select training_incomplete_count from adoption), 0) as training_incomplete_count,
  coalesce((select failed_workflow_attempt_count from adoption), 0) as failed_workflow_attempt_count,
  coalesce((select critical_support_issues from support), 0) as critical_support_issues,
  coalesce((select department_launch_blocker_count from blockers), 0) as department_launch_blocker_count,
  case
    when coalesce((select total_department_launch_packs from packs), 0) = 0 then 'evidence_required'
    when coalesce((select department_launch_blocker_count from blockers), 0) > 0
      or coalesce((select blocked_departments from packs), 0) > 0
      or coalesce((select critical_support_issues from support), 0) > 0
      or coalesce((select low_adoption_departments from adoption), 0) > 0 then 'blocked'
    when coalesce((select evidence_required_departments from packs), 0) > 0
      or coalesce((select incomplete_launch_checklist_items from checklist), 0) > 0
      or coalesce((select support_readiness_blockers from support), 0) > 0
      or coalesce((select policy_attestation_gaps from policy), 0) > 0
      or coalesce((select training_incomplete_count from adoption), 0) > 0 then 'evidence_required'
    when coalesce((select ready_with_limitations_departments from packs), 0) > 0 then 'ready_with_limitations'
    when coalesce((select ready_departments from packs), 0) = coalesce((select total_department_launch_packs from packs), 0) then 'ready'
    else 'in_progress'
  end as hospital_operations_readiness_status;

create or replace view public.v_patch55_production_readiness_hospital_operations_overlay with (security_invoker = true) as
select *,
  case
    when hospital_operations_readiness_status = 'ready' then 'All department launch packs are ready with required owners, support paths, checklist evidence, training, attestations, and signoffs recorded.'
    when hospital_operations_readiness_status = 'ready_with_limitations' then 'Hospital operations are ready with documented limitations that require executive review.'
    when hospital_operations_readiness_status = 'blocked' then 'Resolve blocked departments, critical support issues, low adoption, or inherited launch blockers before hospital-wide rollout.'
    when hospital_operations_readiness_status = 'evidence_required' then 'Record department owners, checklist evidence, training, policy/SOP attestations, signoffs, and support readiness before hospital-wide rollout.'
    else 'Continue department launch preparation and close remaining readiness actions.'
  end as next_action_required
from public.v_patch55_hospital_operations_readiness_summary;

alter view if exists public.v_patch55_department_launch_pack_register set (security_invoker = true);
alter view if exists public.v_patch55_department_launch_checklist_register set (security_invoker = true);
alter view if exists public.v_patch55_incomplete_launch_checklist_register set (security_invoker = true);
alter view if exists public.v_patch55_department_support_readiness_register set (security_invoker = true);
alter view if exists public.v_patch55_support_readiness_blocker_register set (security_invoker = true);
alter view if exists public.v_patch55_policy_attestation_readiness_register set (security_invoker = true);
alter view if exists public.v_patch55_missing_policy_attestation_register set (security_invoker = true);
alter view if exists public.v_patch55_department_adoption_readiness_register set (security_invoker = true);
alter view if exists public.v_patch55_low_adoption_department_register set (security_invoker = true);
alter view if exists public.v_patch55_department_launch_blocker_register set (security_invoker = true);
alter view if exists public.v_patch55_hospital_operations_readiness_summary set (security_invoker = true);
alter view if exists public.v_patch55_production_readiness_hospital_operations_overlay set (security_invoker = true);

grant select on public.v_patch55_department_launch_pack_register to authenticated;
grant select on public.v_patch55_department_launch_checklist_register to authenticated;
grant select on public.v_patch55_incomplete_launch_checklist_register to authenticated;
grant select on public.v_patch55_department_support_readiness_register to authenticated;
grant select on public.v_patch55_support_readiness_blocker_register to authenticated;
grant select on public.v_patch55_policy_attestation_readiness_register to authenticated;
grant select on public.v_patch55_missing_policy_attestation_register to authenticated;
grant select on public.v_patch55_department_adoption_readiness_register to authenticated;
grant select on public.v_patch55_low_adoption_department_register to authenticated;
grant select on public.v_patch55_department_launch_blocker_register to authenticated;
grant select on public.v_patch55_hospital_operations_readiness_summary to authenticated;
grant select on public.v_patch55_production_readiness_hospital_operations_overlay to authenticated;

create or replace function public.patch55_service_role_required()
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 55 hospital operations mutations require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.record_hospital_operations_readiness_event(p_launch_pack_id uuid, p_checklist_item_id uuid, p_support_record_id uuid, p_policy_attestation_id uuid, p_adoption_review_id uuid, p_event_type text, p_event_summary text, p_actor_user_id uuid default null, p_evidence_reference text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch55_service_role_required();
  insert into public.hospital_operations_readiness_events(launch_pack_id, checklist_item_id, support_record_id, policy_attestation_id, adoption_review_id, event_type, event_summary, actor_user_id, evidence_reference)
  values (p_launch_pack_id, p_checklist_item_id, p_support_record_id, p_policy_attestation_id, p_adoption_review_id, p_event_type, p_event_summary, p_actor_user_id, p_evidence_reference)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_hospital_department_launch_pack(p_controlled_pilot_department_id uuid, p_launch_label text, p_department_id uuid default null, p_department_owner_user_id uuid default null, p_operational_owner_user_id uuid default null, p_quality_owner_user_id uuid default null, p_support_owner_user_id uuid default null, p_target_launch_date date default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch55_service_role_required();
  insert into public.hospital_department_launch_packs(controlled_pilot_department_id, department_id, launch_label, department_owner_user_id, operational_owner_user_id, quality_owner_user_id, support_owner_user_id, target_launch_date, created_by)
  values (p_controlled_pilot_department_id, p_department_id, p_launch_label, p_department_owner_user_id, p_operational_owner_user_id, p_quality_owner_user_id, p_support_owner_user_id, p_target_launch_date, p_created_by)
  returning id into v_id;
  perform public.record_hospital_operations_readiness_event(v_id, null, null, null, null, 'launch_pack_created', 'Hospital department launch pack created: ' || p_launch_label, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_hospital_department_launch_pack_status(p_launch_pack_id uuid, p_launch_status text, p_readiness_summary text default null, p_blocker_summary text default null, p_evidence_reference text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_support uuid;
begin
  perform public.patch55_service_role_required();
  select department_owner_user_id, support_owner_user_id into v_owner, v_support from public.hospital_department_launch_packs where id = p_launch_pack_id;
  if not found then raise exception 'Hospital department launch pack not found: %', p_launch_pack_id; end if;
  if p_launch_status in ('ready', 'ready_with_limitations') and (v_owner is null or v_support is null or nullif(coalesce(p_evidence_reference, ''), '') is null) then
    raise exception 'Department owner, support owner, and evidence reference are required before marking launch pack ready.';
  end if;
  if p_launch_status = 'blocked' and nullif(coalesce(p_blocker_summary, ''), '') is null then raise exception 'Blocker summary is required for blocked department launch packs.'; end if;
  update public.hospital_department_launch_packs
  set launch_status = p_launch_status, readiness_summary = coalesce(p_readiness_summary, readiness_summary), blocker_summary = coalesce(p_blocker_summary, blocker_summary), evidence_reference = coalesce(p_evidence_reference, evidence_reference), actual_launch_date = case when p_launch_status in ('ready', 'ready_with_limitations') then current_date else actual_launch_date end, updated_at = now()
  where id = p_launch_pack_id;
  perform public.record_hospital_operations_readiness_event(p_launch_pack_id, null, null, null, null, 'launch_pack_status_updated', 'Hospital department launch pack status updated to ' || p_launch_status, p_actor_user_id, p_evidence_reference);
  return p_launch_pack_id;
end;
$$;

create or replace function public.create_hospital_department_launch_checklist_item(p_launch_pack_id uuid, p_checklist_key text, p_owner_user_id uuid default null, p_due_at timestamptz default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch55_service_role_required();
  insert into public.hospital_department_launch_checklist_items(launch_pack_id, checklist_key, owner_user_id, due_at, created_by)
  values (p_launch_pack_id, p_checklist_key, p_owner_user_id, p_due_at, p_created_by)
  returning id into v_id;
  perform public.record_hospital_operations_readiness_event(p_launch_pack_id, v_id, null, null, null, 'launch_checklist_item_created', 'Department launch checklist item created: ' || p_checklist_key, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_hospital_department_launch_checklist_item_status(p_checklist_item_id uuid, p_checklist_status text, p_evidence_reference text default null, p_notes text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pack uuid;
begin
  perform public.patch55_service_role_required();
  if p_checklist_status = 'complete' and nullif(coalesce(p_evidence_reference, ''), '') is null then raise exception 'Evidence reference is required before completing launch checklist items.'; end if;
  update public.hospital_department_launch_checklist_items
  set checklist_status = p_checklist_status, evidence_reference = coalesce(p_evidence_reference, evidence_reference), notes = coalesce(p_notes, notes), completed_at = case when p_checklist_status in ('complete', 'not_applicable') then now() else completed_at end, updated_at = now()
  where id = p_checklist_item_id
  returning launch_pack_id into v_pack;
  if not found then raise exception 'Hospital launch checklist item not found: %', p_checklist_item_id; end if;
  perform public.record_hospital_operations_readiness_event(v_pack, p_checklist_item_id, null, null, null, 'launch_checklist_item_updated', 'Department launch checklist item updated to ' || p_checklist_status, p_actor_user_id, p_evidence_reference);
  return p_checklist_item_id;
end;
$$;

create or replace function public.create_hospital_support_readiness_record(p_launch_pack_id uuid, p_controlled_pilot_department_id uuid default null, p_support_owner_user_id uuid default null, p_escalation_owner_user_id uuid default null, p_sla_tier text default null, p_response_target_minutes integer default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch55_service_role_required();
  insert into public.hospital_support_readiness_records(launch_pack_id, controlled_pilot_department_id, support_owner_user_id, escalation_owner_user_id, sla_tier, response_target_minutes, created_by)
  values (p_launch_pack_id, p_controlled_pilot_department_id, p_support_owner_user_id, p_escalation_owner_user_id, p_sla_tier, p_response_target_minutes, p_created_by)
  returning id into v_id;
  perform public.record_hospital_operations_readiness_event(p_launch_pack_id, null, v_id, null, null, 'support_readiness_created', 'Hospital support readiness record created.', p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_hospital_support_readiness_status(p_support_record_id uuid, p_support_status text, p_escalation_path text default null, p_open_support_issue_count integer default null, p_overdue_support_issue_count integer default null, p_critical_support_issue_count integer default null, p_readiness_notes text default null, p_evidence_reference text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pack uuid;
begin
  perform public.patch55_service_role_required();
  if p_support_status in ('ready', 'ready_with_limitations') and (nullif(coalesce(p_escalation_path, ''), '') is null or nullif(coalesce(p_evidence_reference, ''), '') is null) then raise exception 'Escalation path and evidence reference are required before marking support readiness ready.'; end if;
  update public.hospital_support_readiness_records
  set support_status = p_support_status, escalation_path = coalesce(p_escalation_path, escalation_path), open_support_issue_count = coalesce(p_open_support_issue_count, open_support_issue_count), overdue_support_issue_count = coalesce(p_overdue_support_issue_count, overdue_support_issue_count), critical_support_issue_count = coalesce(p_critical_support_issue_count, critical_support_issue_count), readiness_notes = coalesce(p_readiness_notes, readiness_notes), evidence_reference = coalesce(p_evidence_reference, evidence_reference), updated_at = now()
  where id = p_support_record_id
  returning launch_pack_id into v_pack;
  if not found then raise exception 'Hospital support readiness record not found: %', p_support_record_id; end if;
  perform public.record_hospital_operations_readiness_event(v_pack, null, p_support_record_id, null, null, 'support_readiness_updated', 'Hospital support readiness updated to ' || p_support_status, p_actor_user_id, p_evidence_reference);
  return p_support_record_id;
end;
$$;

create or replace function public.create_hospital_policy_attestation_readiness(p_launch_pack_id uuid, p_policy_title text, p_policy_category text default null, p_required_for_role text default null, p_required_attestation_count integer default 0, p_due_at timestamptz default null, p_owner_user_id uuid default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch55_service_role_required();
  insert into public.hospital_policy_attestation_readiness(launch_pack_id, policy_title, policy_category, required_for_role, required_attestation_count, due_at, owner_user_id, created_by)
  values (p_launch_pack_id, p_policy_title, p_policy_category, p_required_for_role, greatest(coalesce(p_required_attestation_count, 0), 0), p_due_at, p_owner_user_id, p_created_by)
  returning id into v_id;
  perform public.record_hospital_operations_readiness_event(p_launch_pack_id, null, null, v_id, null, 'policy_attestation_created', 'Policy/SOP attestation readiness created: ' || p_policy_title, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_hospital_policy_attestation_status(p_policy_attestation_id uuid, p_attestation_status text, p_completed_attestation_count integer default null, p_evidence_reference text default null, p_notes text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pack uuid;
begin
  perform public.patch55_service_role_required();
  if p_attestation_status in ('attested', 'waived') and nullif(coalesce(p_evidence_reference, ''), '') is null then raise exception 'Evidence reference is required before closing policy/SOP attestation readiness.'; end if;
  update public.hospital_policy_attestation_readiness
  set attestation_status = p_attestation_status, completed_attestation_count = coalesce(p_completed_attestation_count, completed_attestation_count), evidence_reference = coalesce(p_evidence_reference, evidence_reference), notes = coalesce(p_notes, notes), updated_at = now()
  where id = p_policy_attestation_id
  returning launch_pack_id into v_pack;
  if not found then raise exception 'Hospital policy attestation readiness not found: %', p_policy_attestation_id; end if;
  perform public.record_hospital_operations_readiness_event(v_pack, null, null, p_policy_attestation_id, null, 'policy_attestation_updated', 'Policy/SOP attestation readiness updated to ' || p_attestation_status, p_actor_user_id, p_evidence_reference);
  return p_policy_attestation_id;
end;
$$;

create or replace function public.create_hospital_adoption_readiness_review(p_launch_pack_id uuid, p_controlled_pilot_department_id uuid default null, p_owner_user_id uuid default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch55_service_role_required();
  insert into public.hospital_adoption_readiness_reviews(launch_pack_id, controlled_pilot_department_id, owner_user_id, created_by)
  values (p_launch_pack_id, p_controlled_pilot_department_id, p_owner_user_id, p_created_by)
  returning id into v_id;
  perform public.record_hospital_operations_readiness_event(p_launch_pack_id, null, null, null, v_id, 'adoption_readiness_created', 'Hospital adoption readiness review created.', p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_hospital_adoption_readiness_status(p_adoption_review_id uuid, p_adoption_status text, p_active_user_count integer default null, p_inactive_user_count integer default null, p_training_incomplete_count integer default null, p_failed_workflow_attempt_count integer default null, p_feedback_required_count integer default null, p_support_needed boolean default null, p_training_needed boolean default null, p_adoption_summary text default null, p_evidence_reference text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pack uuid;
begin
  perform public.patch55_service_role_required();
  if p_adoption_status in ('on_track', 'partial_adoption') and nullif(coalesce(p_evidence_reference, ''), '') is null then raise exception 'Evidence reference is required before marking adoption readiness on track.'; end if;
  update public.hospital_adoption_readiness_reviews
  set adoption_status = p_adoption_status, active_user_count = coalesce(p_active_user_count, active_user_count), inactive_user_count = coalesce(p_inactive_user_count, inactive_user_count), training_incomplete_count = coalesce(p_training_incomplete_count, training_incomplete_count), failed_workflow_attempt_count = coalesce(p_failed_workflow_attempt_count, failed_workflow_attempt_count), feedback_required_count = coalesce(p_feedback_required_count, feedback_required_count), support_needed = coalesce(p_support_needed, support_needed), training_needed = coalesce(p_training_needed, training_needed), adoption_summary = coalesce(p_adoption_summary, adoption_summary), evidence_reference = coalesce(p_evidence_reference, evidence_reference), reviewed_at = now(), updated_at = now()
  where id = p_adoption_review_id
  returning launch_pack_id into v_pack;
  if not found then raise exception 'Hospital adoption readiness review not found: %', p_adoption_review_id; end if;
  perform public.record_hospital_operations_readiness_event(v_pack, null, null, null, p_adoption_review_id, 'adoption_readiness_updated', 'Hospital adoption readiness updated to ' || p_adoption_status, p_actor_user_id, p_evidence_reference);
  return p_adoption_review_id;
end;
$$;

create or replace function public.get_hospital_operations_readiness_summary() returns jsonb language sql security invoker set search_path = public as $$
  select coalesce((select to_jsonb(v) from public.v_patch55_hospital_operations_readiness_summary v limit 1), '{}'::jsonb);
$$;

create or replace function public.get_production_readiness_hospital_operations_overlay() returns jsonb language sql security invoker set search_path = public as $$
  select coalesce((select to_jsonb(v) from public.v_patch55_production_readiness_hospital_operations_overlay v limit 1), '{}'::jsonb);
$$;

revoke all on function public.patch55_service_role_required() from public, anon, authenticated;
revoke all on function public.record_hospital_operations_readiness_event(uuid, uuid, uuid, uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_hospital_department_launch_pack(uuid, text, uuid, uuid, uuid, uuid, uuid, date, uuid) from public, anon, authenticated;
revoke all on function public.update_hospital_department_launch_pack_status(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_hospital_department_launch_checklist_item(uuid, text, uuid, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.update_hospital_department_launch_checklist_item_status(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_hospital_support_readiness_record(uuid, uuid, uuid, uuid, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.update_hospital_support_readiness_status(uuid, text, text, integer, integer, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_hospital_policy_attestation_readiness(uuid, text, text, text, integer, timestamptz, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_hospital_policy_attestation_status(uuid, text, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_hospital_adoption_readiness_review(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_hospital_adoption_readiness_status(uuid, text, integer, integer, integer, integer, integer, boolean, boolean, text, text, uuid) from public, anon, authenticated;

grant execute on function public.patch55_service_role_required() to service_role;
grant execute on function public.record_hospital_operations_readiness_event(uuid, uuid, uuid, uuid, uuid, text, text, uuid, text) to service_role;
grant execute on function public.create_hospital_department_launch_pack(uuid, text, uuid, uuid, uuid, uuid, uuid, date, uuid) to service_role;
grant execute on function public.update_hospital_department_launch_pack_status(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.create_hospital_department_launch_checklist_item(uuid, text, uuid, timestamptz, uuid) to service_role;
grant execute on function public.update_hospital_department_launch_checklist_item_status(uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_hospital_support_readiness_record(uuid, uuid, uuid, uuid, text, integer, uuid) to service_role;
grant execute on function public.update_hospital_support_readiness_status(uuid, text, text, integer, integer, integer, text, text, uuid) to service_role;
grant execute on function public.create_hospital_policy_attestation_readiness(uuid, text, text, text, integer, timestamptz, uuid, uuid) to service_role;
grant execute on function public.update_hospital_policy_attestation_status(uuid, text, integer, text, text, uuid) to service_role;
grant execute on function public.create_hospital_adoption_readiness_review(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.update_hospital_adoption_readiness_status(uuid, text, integer, integer, integer, integer, integer, boolean, boolean, text, text, uuid) to service_role;
grant execute on function public.get_hospital_operations_readiness_summary() to authenticated;
grant execute on function public.get_production_readiness_hospital_operations_overlay() to authenticated;

comment on table public.hospital_department_launch_packs is 'Patch 55 department launch readiness pack register.';
comment on table public.hospital_department_launch_checklist_items is 'Patch 55 department launch checklist register.';
comment on table public.hospital_support_readiness_records is 'Patch 55 department support readiness register.';
comment on table public.hospital_policy_attestation_readiness is 'Patch 55 policy and SOP attestation readiness register.';
comment on table public.hospital_adoption_readiness_reviews is 'Patch 55 adoption readiness review register.';
comment on table public.hospital_operations_readiness_events is 'Patch 55 hospital operations readiness event history.';
