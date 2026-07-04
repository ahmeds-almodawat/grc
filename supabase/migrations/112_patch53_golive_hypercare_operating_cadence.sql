-- Patch 53: Production Go-Live Hypercare & Operating Cadence Pack
-- Tracks post-go-live stability, issue triage, operating cadence, adoption feedback, and executive visibility.

create table if not exists public.production_hypercare_periods (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete set null,
  closure_review_id uuid null references public.pilot_closure_reviews(id) on delete set null,
  golive_decision_id uuid null references public.production_golive_decisions(id) on delete set null,
  hypercare_label text not null,
  hypercare_status text not null default 'planned' check (hypercare_status in ('planned', 'active', 'stable', 'at_risk', 'blocked', 'completed', 'extended', 'cancelled')),
  start_date date null,
  target_end_date date null,
  actual_end_date date null,
  executive_owner_user_id uuid null references auth.users(id) on delete set null,
  operational_owner_user_id uuid null references auth.users(id) on delete set null,
  quality_owner_user_id uuid null references auth.users(id) on delete set null,
  it_owner_user_id uuid null references auth.users(id) on delete set null,
  stability_summary text null,
  blocker_summary text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_hypercare_issues (
  id uuid primary key default gen_random_uuid(),
  hypercare_period_id uuid null references public.production_hypercare_periods(id) on delete cascade,
  source_workflow_run_id uuid null references public.live_pilot_workflow_runs(id) on delete set null,
  source_execution_issue_id uuid null references public.live_pilot_execution_issues(id) on delete set null,
  issue_title text not null,
  issue_type text not null check (issue_type in ('system_issue', 'workflow_issue', 'access_issue', 'data_issue', 'training_issue', 'adoption_issue', 'evidence_issue', 'reporting_issue', 'department_feedback', 'other')),
  issue_status text not null default 'open' check (issue_status in ('open', 'in_progress', 'resolved', 'overdue', 'accepted_risk', 'cancelled')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  department_pilot_id uuid null references public.controlled_pilot_departments(id) on delete set null,
  owner_user_id uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  resolved_at timestamptz null,
  resolution_summary text null,
  evidence_reference text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_operating_cadence_events (
  id uuid primary key default gen_random_uuid(),
  hypercare_period_id uuid null references public.production_hypercare_periods(id) on delete cascade,
  cadence_type text not null check (cadence_type in ('daily_huddle', 'weekly_review', 'executive_review', 'department_checkin', 'issue_triage', 'stabilization_review', 'closure_review')),
  event_status text not null default 'scheduled' check (event_status in ('scheduled', 'completed', 'missed', 'cancelled')),
  scheduled_at timestamptz null,
  completed_at timestamptz null,
  owner_user_id uuid null references auth.users(id) on delete set null,
  summary text null,
  decisions_summary text null,
  action_summary text null,
  evidence_reference text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_adoption_feedback (
  id uuid primary key default gen_random_uuid(),
  hypercare_period_id uuid null references public.production_hypercare_periods(id) on delete cascade,
  department_pilot_id uuid null references public.controlled_pilot_departments(id) on delete set null,
  feedback_status text not null default 'pending' check (feedback_status in ('pending', 'submitted', 'reviewed', 'action_required', 'closed')),
  adoption_status text not null default 'not_assessed' check (adoption_status in ('not_assessed', 'adopted', 'partially_adopted', 'low_adoption', 'blocked')),
  submitted_by uuid null references auth.users(id) on delete set null,
  submitted_at timestamptz null,
  feedback_summary text null,
  support_needed boolean not null default false,
  training_needed boolean not null default false,
  issue_reference text null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_hypercare_events (
  id uuid primary key default gen_random_uuid(),
  hypercare_period_id uuid null references public.production_hypercare_periods(id) on delete cascade,
  issue_id uuid null references public.production_hypercare_issues(id) on delete cascade,
  cadence_event_id uuid null references public.production_operating_cadence_events(id) on delete cascade,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  evidence_reference text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch53_periods_status on public.production_hypercare_periods(hypercare_status, target_end_date);
create index if not exists idx_patch53_issues_status on public.production_hypercare_issues(hypercare_period_id, issue_status, severity);
create index if not exists idx_patch53_issues_due on public.production_hypercare_issues(due_at, issue_status);
create index if not exists idx_patch53_cadence_status on public.production_operating_cadence_events(hypercare_period_id, event_status, scheduled_at);
create index if not exists idx_patch53_feedback_status on public.production_adoption_feedback(hypercare_period_id, feedback_status, adoption_status);
create index if not exists idx_patch53_events_period on public.production_hypercare_events(hypercare_period_id, created_at desc);

alter table public.production_hypercare_periods enable row level security;
alter table public.production_hypercare_issues enable row level security;
alter table public.production_operating_cadence_events enable row level security;
alter table public.production_adoption_feedback enable row level security;
alter table public.production_hypercare_events enable row level security;

drop policy if exists patch53_periods_read on public.production_hypercare_periods;
create policy patch53_periods_read on public.production_hypercare_periods for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch53_periods_write on public.production_hypercare_periods;
create policy patch53_periods_write on public.production_hypercare_periods for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch53_issues_read on public.production_hypercare_issues;
create policy patch53_issues_read on public.production_hypercare_issues for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch53_issues_write on public.production_hypercare_issues;
create policy patch53_issues_write on public.production_hypercare_issues for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch53_cadence_read on public.production_operating_cadence_events;
create policy patch53_cadence_read on public.production_operating_cadence_events for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch53_cadence_write on public.production_operating_cadence_events;
create policy patch53_cadence_write on public.production_operating_cadence_events for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch53_feedback_read on public.production_adoption_feedback;
create policy patch53_feedback_read on public.production_adoption_feedback for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch53_feedback_write on public.production_adoption_feedback;
create policy patch53_feedback_write on public.production_adoption_feedback for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch53_events_read on public.production_hypercare_events;
create policy patch53_events_read on public.production_hypercare_events for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch53_events_write on public.production_hypercare_events;
create policy patch53_events_write on public.production_hypercare_events for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

create or replace view public.v_patch53_hypercare_period_register with (security_invoker = true) as
select p.*,
  greatest(coalesce(p.target_end_date - current_date, 0), 0)::integer as days_remaining,
  (p.hypercare_status = 'active') as is_active_hypercare,
  (p.hypercare_status in ('at_risk', 'blocked', 'extended')) as is_at_risk_or_blocked
from public.production_hypercare_periods p;

create or replace view public.v_patch53_hypercare_issue_register with (security_invoker = true) as
select i.*, p.hypercare_label,
  (i.issue_status in ('open', 'in_progress', 'overdue') and i.due_at is not null and i.due_at < now()) as is_overdue,
  (i.issue_status in ('open', 'in_progress', 'overdue') and i.severity in ('high', 'critical')) as is_high_critical_open
from public.production_hypercare_issues i
left join public.production_hypercare_periods p on p.id = i.hypercare_period_id;

create or replace view public.v_patch53_open_high_critical_hypercare_issue_register with (security_invoker = true) as
select * from public.v_patch53_hypercare_issue_register where is_high_critical_open;

create or replace view public.v_patch53_overdue_hypercare_issue_register with (security_invoker = true) as
select * from public.v_patch53_hypercare_issue_register where issue_status = 'overdue' or is_overdue;

create or replace view public.v_patch53_operating_cadence_event_register with (security_invoker = true) as
select e.*, p.hypercare_label,
  (e.event_status = 'missed' or (e.event_status = 'scheduled' and e.scheduled_at is not null and e.scheduled_at < now())) as is_missed_or_overdue
from public.production_operating_cadence_events e
left join public.production_hypercare_periods p on p.id = e.hypercare_period_id;

create or replace view public.v_patch53_missed_operating_cadence_register with (security_invoker = true) as
select * from public.v_patch53_operating_cadence_event_register where is_missed_or_overdue;

create or replace view public.v_patch53_department_adoption_feedback_register with (security_invoker = true) as
select f.*, p.hypercare_label, d.department_name,
  (f.feedback_status = 'pending') as is_missing_feedback,
  (f.adoption_status in ('low_adoption', 'blocked')) as is_low_adoption
from public.production_adoption_feedback f
left join public.production_hypercare_periods p on p.id = f.hypercare_period_id
left join public.controlled_pilot_departments d on d.id = f.department_pilot_id;

create or replace view public.v_patch53_missing_department_feedback_register with (security_invoker = true) as
select * from public.v_patch53_department_adoption_feedback_register where is_missing_feedback
union all
select p.id as id, p.id as hypercare_period_id, d.id as department_pilot_id, 'pending'::text as feedback_status, 'not_assessed'::text as adoption_status,
  null::uuid as submitted_by, null::timestamptz as submitted_at, null::text as feedback_summary, false as support_needed, false as training_needed, null::text as issue_reference,
  null::uuid as reviewed_by, null::timestamptz as reviewed_at, null::uuid as created_by, p.created_at, p.updated_at,
  p.hypercare_label, d.department_name, true as is_missing_feedback, false as is_low_adoption
from public.production_hypercare_periods p
join public.controlled_pilot_departments d on d.activation_run_id = p.activation_run_id and d.pilot_status <> 'not_in_scope'
where p.hypercare_status in ('planned', 'active', 'at_risk', 'blocked', 'extended')
  and not exists (
    select 1 from public.production_adoption_feedback f
    where f.hypercare_period_id = p.id and f.department_pilot_id = d.id
  );

create or replace view public.v_patch53_low_adoption_register with (security_invoker = true) as
select * from public.v_patch53_department_adoption_feedback_register
where is_low_adoption or support_needed or training_needed;

create or replace view public.v_patch53_hypercare_blocker_register with (security_invoker = true) as
select id as hypercare_period_id, hypercare_label, 'hypercare_period'::text as blocker_area, hypercare_status::text as blocker_type, coalesce(blocker_summary, 'Hypercare period is at risk, blocked, extended, or still active.') as blocker_summary, null::text as evidence_reference
from public.v_patch53_hypercare_period_register
where hypercare_status in ('active', 'at_risk', 'blocked', 'extended')
union all
select hypercare_period_id, hypercare_label, 'hypercare_issue'::text as blocker_area, issue_status::text as blocker_type, issue_title as blocker_summary, evidence_reference
from public.v_patch53_hypercare_issue_register
where issue_status in ('open', 'in_progress', 'overdue') or is_high_critical_open
union all
select hypercare_period_id, hypercare_label, 'operating_cadence'::text as blocker_area, event_status::text as blocker_type, coalesce(summary, cadence_type || ' is missed or overdue.') as blocker_summary, evidence_reference
from public.v_patch53_missed_operating_cadence_register
union all
select hypercare_period_id, hypercare_label, 'department_feedback'::text as blocker_area, feedback_status::text as blocker_type, coalesce(department_name, 'Department') || ' feedback is pending or missing.' as blocker_summary, issue_reference as evidence_reference
from public.v_patch53_missing_department_feedback_register
union all
select hypercare_period_id, hypercare_label, 'adoption_feedback'::text as blocker_area, adoption_status::text as blocker_type, coalesce(department_name, 'Department') || ' requires adoption, support, or training follow-up.' as blocker_summary, issue_reference as evidence_reference
from public.v_patch53_low_adoption_register
union all
select null::uuid as hypercare_period_id, workflow_label as hypercare_label, 'live_pilot_issue'::text as blocker_area, issue_type::text as blocker_type, issue_summary as blocker_summary, evidence_reference
from public.v_patch51_live_pilot_execution_issue_register
where issue_status in ('open', 'in_review') and severity in ('high', 'critical')
union all
select null::uuid as hypercare_period_id, closure_label as hypercare_label, 'pilot_remediation'::text as blocker_area, remediation_status::text as blocker_type, remediation_title as blocker_summary, evidence_reference
from public.v_patch52_open_high_critical_remediation_register;

create or replace view public.v_patch53_hypercare_stability_summary with (security_invoker = true) as
with periods as (
  select
    count(*)::integer as hypercare_period_total,
    count(*) filter (where hypercare_status = 'active')::integer as active_hypercare_periods,
    count(*) filter (where hypercare_status in ('at_risk', 'blocked', 'extended'))::integer as at_risk_or_blocked_periods,
    min(greatest(coalesce(target_end_date - current_date, 0), 0)) filter (where hypercare_status in ('planned', 'active', 'at_risk', 'blocked', 'extended'))::integer as days_remaining
  from public.production_hypercare_periods
),
issues as (
  select
    count(*) filter (where issue_status in ('open', 'in_progress', 'overdue'))::integer as open_hypercare_issues,
    count(*) filter (where issue_status = 'overdue' or (issue_status in ('open', 'in_progress') and due_at is not null and due_at < now()))::integer as overdue_hypercare_issues,
    count(*) filter (where issue_status in ('open', 'in_progress', 'overdue') and severity in ('high', 'critical'))::integer as high_critical_hypercare_issues
  from public.production_hypercare_issues
),
cadence as (
  select count(*) filter (where event_status = 'missed' or (event_status = 'scheduled' and scheduled_at is not null and scheduled_at < now()))::integer as missed_cadence_events
  from public.production_operating_cadence_events
),
feedback as (
  select
    count(*) filter (where feedback_status = 'pending')::integer as departments_missing_feedback,
    count(*) filter (where adoption_status in ('low_adoption', 'blocked'))::integer as low_adoption_departments,
    count(*) filter (where support_needed)::integer as support_needed_feedback_count,
    count(*) filter (where training_needed)::integer as training_needed_feedback_count
  from public.production_adoption_feedback
),
missing_feedback as (
  select count(*)::integer as computed_missing_feedback_count
  from public.v_patch53_missing_department_feedback_register
),
live_issues as (
  select count(*) filter (where issue_status in ('open', 'in_review') and severity in ('high', 'critical'))::integer as inherited_unresolved_live_pilot_issues
  from public.live_pilot_execution_issues
),
remediation as (
  select count(*)::integer as inherited_high_critical_remediation_count
  from public.v_patch52_open_high_critical_remediation_register
),
blockers as (
  select count(*)::integer as hypercare_blocker_count
  from public.v_patch53_hypercare_blocker_register
)
select
  coalesce((select hypercare_period_total from periods), 0) as hypercare_period_total,
  coalesce((select active_hypercare_periods from periods), 0) as active_hypercare_periods,
  coalesce((select at_risk_or_blocked_periods from periods), 0) as at_risk_or_blocked_periods,
  coalesce((select days_remaining from periods), 0) as days_remaining,
  coalesce((select open_hypercare_issues from issues), 0) as open_hypercare_issues,
  coalesce((select overdue_hypercare_issues from issues), 0) as overdue_hypercare_issues,
  coalesce((select high_critical_hypercare_issues from issues), 0) as high_critical_hypercare_issues,
  coalesce((select missed_cadence_events from cadence), 0) as missed_cadence_events,
  greatest(coalesce((select departments_missing_feedback from feedback), 0), coalesce((select computed_missing_feedback_count from missing_feedback), 0)) as departments_missing_feedback,
  coalesce((select low_adoption_departments from feedback), 0) as low_adoption_departments,
  coalesce((select support_needed_feedback_count from feedback), 0) as support_needed_feedback_count,
  coalesce((select training_needed_feedback_count from feedback), 0) as training_needed_feedback_count,
  coalesce((select inherited_unresolved_live_pilot_issues from live_issues), 0) as inherited_unresolved_live_pilot_issues,
  coalesce((select inherited_high_critical_remediation_count from remediation), 0) as inherited_high_critical_remediation_count,
  coalesce((select hypercare_blocker_count from blockers), 0) as hypercare_blocker_count,
  case
    when coalesce((select hypercare_period_total from periods), 0) = 0 then 'evidence_required'
    when coalesce((select at_risk_or_blocked_periods from periods), 0) > 0
      or coalesce((select high_critical_hypercare_issues from issues), 0) > 0
      or coalesce((select overdue_hypercare_issues from issues), 0) > 0
      or coalesce((select missed_cadence_events from cadence), 0) > 0
      or coalesce((select inherited_unresolved_live_pilot_issues from live_issues), 0) > 0
      or coalesce((select inherited_high_critical_remediation_count from remediation), 0) > 0 then 'blocked'
    when coalesce((select open_hypercare_issues from issues), 0) > 0
      or greatest(coalesce((select departments_missing_feedback from feedback), 0), coalesce((select computed_missing_feedback_count from missing_feedback), 0)) > 0
      or coalesce((select low_adoption_departments from feedback), 0) > 0
      or coalesce((select support_needed_feedback_count from feedback), 0) > 0
      or coalesce((select training_needed_feedback_count from feedback), 0) > 0 then 'at_risk'
    when coalesce((select active_hypercare_periods from periods), 0) > 0 then 'in_progress'
    when exists (select 1 from public.production_hypercare_periods where hypercare_status = 'stable') then 'stable_with_limitations'
    when exists (select 1 from public.production_hypercare_periods where hypercare_status = 'completed') then 'stable'
    else 'evidence_required'
  end as production_stability_status;

create or replace view public.v_patch53_production_readiness_hypercare_overlay with (security_invoker = true) as
select *,
  case
    when production_stability_status = 'stable' then 'Production hypercare is complete with no open stability blockers recorded.'
    when production_stability_status = 'stable_with_limitations' then 'Production is stable with documented monitoring and follow-up limitations.'
    when production_stability_status = 'blocked' then 'Resolve high-risk issues, SLA breaches, missed cadence, or inherited blockers before hypercare closure.'
    when production_stability_status = 'at_risk' then 'Triage open issues, adoption gaps, feedback gaps, and support needs in the operating cadence.'
    when production_stability_status = 'in_progress' then 'Continue the active hypercare cadence until stability evidence is complete.'
    else 'Create a production hypercare period and begin operating cadence evidence capture.'
  end as next_action_required
from public.v_patch53_hypercare_stability_summary;

alter view if exists public.v_patch53_hypercare_period_register set (security_invoker = true);
alter view if exists public.v_patch53_hypercare_issue_register set (security_invoker = true);
alter view if exists public.v_patch53_open_high_critical_hypercare_issue_register set (security_invoker = true);
alter view if exists public.v_patch53_overdue_hypercare_issue_register set (security_invoker = true);
alter view if exists public.v_patch53_operating_cadence_event_register set (security_invoker = true);
alter view if exists public.v_patch53_missed_operating_cadence_register set (security_invoker = true);
alter view if exists public.v_patch53_department_adoption_feedback_register set (security_invoker = true);
alter view if exists public.v_patch53_missing_department_feedback_register set (security_invoker = true);
alter view if exists public.v_patch53_low_adoption_register set (security_invoker = true);
alter view if exists public.v_patch53_hypercare_blocker_register set (security_invoker = true);
alter view if exists public.v_patch53_hypercare_stability_summary set (security_invoker = true);
alter view if exists public.v_patch53_production_readiness_hypercare_overlay set (security_invoker = true);

grant select on public.v_patch53_hypercare_period_register to authenticated;
grant select on public.v_patch53_hypercare_issue_register to authenticated;
grant select on public.v_patch53_open_high_critical_hypercare_issue_register to authenticated;
grant select on public.v_patch53_overdue_hypercare_issue_register to authenticated;
grant select on public.v_patch53_operating_cadence_event_register to authenticated;
grant select on public.v_patch53_missed_operating_cadence_register to authenticated;
grant select on public.v_patch53_department_adoption_feedback_register to authenticated;
grant select on public.v_patch53_missing_department_feedback_register to authenticated;
grant select on public.v_patch53_low_adoption_register to authenticated;
grant select on public.v_patch53_hypercare_blocker_register to authenticated;
grant select on public.v_patch53_hypercare_stability_summary to authenticated;
grant select on public.v_patch53_production_readiness_hypercare_overlay to authenticated;

create or replace function public.patch53_service_role_required()
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 53 hypercare mutations require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.record_production_hypercare_event(p_hypercare_period_id uuid, p_issue_id uuid, p_cadence_event_id uuid, p_event_type text, p_event_summary text, p_actor_user_id uuid default null, p_evidence_reference text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch53_service_role_required();
  insert into public.production_hypercare_events(hypercare_period_id, issue_id, cadence_event_id, event_type, event_summary, actor_user_id, evidence_reference)
  values (p_hypercare_period_id, p_issue_id, p_cadence_event_id, p_event_type, p_event_summary, p_actor_user_id, p_evidence_reference)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_production_hypercare_period(p_activation_run_id uuid, p_closure_review_id uuid, p_golive_decision_id uuid, p_hypercare_label text, p_start_date date default null, p_target_end_date date default null, p_executive_owner_user_id uuid default null, p_operational_owner_user_id uuid default null, p_quality_owner_user_id uuid default null, p_it_owner_user_id uuid default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch53_service_role_required();
  insert into public.production_hypercare_periods(activation_run_id, closure_review_id, golive_decision_id, hypercare_label, start_date, target_end_date, executive_owner_user_id, operational_owner_user_id, quality_owner_user_id, it_owner_user_id, created_by)
  values (p_activation_run_id, p_closure_review_id, p_golive_decision_id, p_hypercare_label, p_start_date, p_target_end_date, p_executive_owner_user_id, p_operational_owner_user_id, p_quality_owner_user_id, p_it_owner_user_id, p_created_by)
  returning id into v_id;
  perform public.record_production_hypercare_event(v_id, null, null, 'hypercare_period_created', 'Production hypercare period created.', p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_production_hypercare_period_status(p_hypercare_period_id uuid, p_hypercare_status text, p_stability_summary text default null, p_blocker_summary text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform public.patch53_service_role_required();
  if p_hypercare_status in ('stable', 'completed') and nullif(coalesce(p_stability_summary, ''), '') is null then raise exception 'Stability summary is required before marking hypercare stable or complete.'; end if;
  if p_hypercare_status in ('at_risk', 'blocked', 'extended') and nullif(coalesce(p_blocker_summary, ''), '') is null then raise exception 'Blocker summary is required for at-risk, blocked, or extended hypercare.'; end if;
  update public.production_hypercare_periods
  set hypercare_status = p_hypercare_status, stability_summary = coalesce(p_stability_summary, stability_summary), blocker_summary = coalesce(p_blocker_summary, blocker_summary), actual_end_date = case when p_hypercare_status in ('stable', 'completed', 'cancelled') then current_date else actual_end_date end, updated_at = now()
  where id = p_hypercare_period_id;
  if not found then raise exception 'Production hypercare period not found: %', p_hypercare_period_id; end if;
  perform public.record_production_hypercare_event(p_hypercare_period_id, null, null, 'hypercare_period_status_updated', 'Production hypercare status updated to ' || p_hypercare_status, p_actor_user_id, null);
  return p_hypercare_period_id;
end;
$$;

create or replace function public.create_production_hypercare_issue(p_hypercare_period_id uuid, p_issue_title text, p_issue_type text, p_severity text default 'medium', p_department_pilot_id uuid default null, p_owner_user_id uuid default null, p_due_at timestamptz default null, p_source_workflow_run_id uuid default null, p_source_execution_issue_id uuid default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch53_service_role_required();
  insert into public.production_hypercare_issues(hypercare_period_id, issue_title, issue_type, severity, department_pilot_id, owner_user_id, due_at, source_workflow_run_id, source_execution_issue_id, created_by)
  values (p_hypercare_period_id, p_issue_title, p_issue_type, coalesce(nullif(p_severity, ''), 'medium'), p_department_pilot_id, p_owner_user_id, p_due_at, p_source_workflow_run_id, p_source_execution_issue_id, p_created_by)
  returning id into v_id;
  perform public.record_production_hypercare_event(p_hypercare_period_id, v_id, null, 'hypercare_issue_created', 'Production hypercare issue created: ' || p_issue_title, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_production_hypercare_issue_status(p_issue_id uuid, p_issue_status text, p_resolution_summary text default null, p_evidence_reference text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_period_id uuid; v_title text;
begin
  perform public.patch53_service_role_required();
  if p_issue_status in ('resolved', 'accepted_risk') and (nullif(coalesce(p_resolution_summary, ''), '') is null or nullif(coalesce(p_evidence_reference, ''), '') is null) then raise exception 'Resolution summary and evidence reference are required before closing or accepting a hypercare issue.'; end if;
  update public.production_hypercare_issues
  set issue_status = p_issue_status, resolution_summary = coalesce(p_resolution_summary, resolution_summary), evidence_reference = coalesce(p_evidence_reference, evidence_reference), resolved_at = case when p_issue_status in ('resolved', 'accepted_risk', 'cancelled') then now() else resolved_at end, updated_at = now()
  where id = p_issue_id
  returning hypercare_period_id, issue_title into v_period_id, v_title;
  if not found then raise exception 'Production hypercare issue not found: %', p_issue_id; end if;
  perform public.record_production_hypercare_event(v_period_id, p_issue_id, null, 'hypercare_issue_status_updated', 'Production hypercare issue updated to ' || p_issue_status || ': ' || v_title, p_actor_user_id, p_evidence_reference);
  return p_issue_id;
end;
$$;

create or replace function public.create_production_operating_cadence_event(p_hypercare_period_id uuid, p_cadence_type text, p_scheduled_at timestamptz default null, p_owner_user_id uuid default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch53_service_role_required();
  insert into public.production_operating_cadence_events(hypercare_period_id, cadence_type, scheduled_at, owner_user_id, created_by)
  values (p_hypercare_period_id, p_cadence_type, p_scheduled_at, p_owner_user_id, p_created_by)
  returning id into v_id;
  perform public.record_production_hypercare_event(p_hypercare_period_id, null, v_id, 'cadence_event_created', 'Production operating cadence event created: ' || p_cadence_type, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_production_operating_cadence_event_status(p_cadence_event_id uuid, p_event_status text, p_summary text default null, p_decisions_summary text default null, p_action_summary text default null, p_evidence_reference text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_period_id uuid; v_type text;
begin
  perform public.patch53_service_role_required();
  if p_event_status = 'completed' and nullif(coalesce(p_summary, ''), '') is null then raise exception 'Summary is required before completing an operating cadence event.'; end if;
  if p_event_status = 'missed' and nullif(coalesce(p_action_summary, ''), '') is null then raise exception 'Action summary is required for missed operating cadence events.'; end if;
  update public.production_operating_cadence_events
  set event_status = p_event_status, summary = coalesce(p_summary, summary), decisions_summary = coalesce(p_decisions_summary, decisions_summary), action_summary = coalesce(p_action_summary, action_summary), evidence_reference = coalesce(p_evidence_reference, evidence_reference), completed_at = case when p_event_status = 'completed' then now() else completed_at end, updated_at = now()
  where id = p_cadence_event_id
  returning hypercare_period_id, cadence_type into v_period_id, v_type;
  if not found then raise exception 'Production cadence event not found: %', p_cadence_event_id; end if;
  perform public.record_production_hypercare_event(v_period_id, null, p_cadence_event_id, 'cadence_event_status_updated', 'Production cadence event updated to ' || p_event_status || ': ' || v_type, p_actor_user_id, p_evidence_reference);
  return p_cadence_event_id;
end;
$$;

create or replace function public.create_production_adoption_feedback(p_hypercare_period_id uuid, p_department_pilot_id uuid, p_submitted_by uuid default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch53_service_role_required();
  insert into public.production_adoption_feedback(hypercare_period_id, department_pilot_id, submitted_by, created_by)
  values (p_hypercare_period_id, p_department_pilot_id, p_submitted_by, p_created_by)
  returning id into v_id;
  perform public.record_production_hypercare_event(p_hypercare_period_id, null, null, 'adoption_feedback_created', 'Production adoption feedback record created.', p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_production_adoption_feedback_status(p_feedback_id uuid, p_feedback_status text, p_adoption_status text, p_feedback_summary text default null, p_support_needed boolean default false, p_training_needed boolean default false, p_issue_reference text default null, p_reviewed_by uuid default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_period_id uuid;
begin
  perform public.patch53_service_role_required();
  if p_feedback_status in ('submitted', 'reviewed', 'action_required', 'closed') and nullif(coalesce(p_feedback_summary, ''), '') is null then raise exception 'Feedback summary is required before updating adoption feedback.'; end if;
  if p_adoption_status in ('low_adoption', 'blocked') and nullif(coalesce(p_issue_reference, ''), '') is null then raise exception 'Issue reference is required for low adoption or blocked departments.'; end if;
  update public.production_adoption_feedback
  set feedback_status = p_feedback_status, adoption_status = p_adoption_status, feedback_summary = coalesce(p_feedback_summary, feedback_summary), support_needed = coalesce(p_support_needed, support_needed), training_needed = coalesce(p_training_needed, training_needed), issue_reference = coalesce(p_issue_reference, issue_reference), submitted_at = case when p_feedback_status = 'submitted' then now() else submitted_at end, reviewed_by = coalesce(p_reviewed_by, reviewed_by), reviewed_at = case when p_feedback_status in ('reviewed', 'action_required', 'closed') then now() else reviewed_at end, updated_at = now()
  where id = p_feedback_id
  returning hypercare_period_id into v_period_id;
  if not found then raise exception 'Production adoption feedback not found: %', p_feedback_id; end if;
  perform public.record_production_hypercare_event(v_period_id, null, null, 'adoption_feedback_status_updated', 'Production adoption feedback updated to ' || p_feedback_status || ' / ' || p_adoption_status, p_actor_user_id, p_issue_reference);
  return p_feedback_id;
end;
$$;

create or replace function public.get_production_hypercare_stability_summary() returns jsonb language sql security invoker set search_path = public as $$
  select coalesce((select to_jsonb(v) from public.v_patch53_hypercare_stability_summary v limit 1), '{}'::jsonb);
$$;

create or replace function public.get_production_readiness_hypercare_overlay() returns jsonb language sql security invoker set search_path = public as $$
  select coalesce((select to_jsonb(v) from public.v_patch53_production_readiness_hypercare_overlay v limit 1), '{}'::jsonb);
$$;

revoke all on function public.patch53_service_role_required() from public, anon, authenticated;
revoke all on function public.record_production_hypercare_event(uuid, uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_production_hypercare_period(uuid, uuid, uuid, text, date, date, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_production_hypercare_period_status(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_production_hypercare_issue(uuid, text, text, text, uuid, uuid, timestamptz, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_production_hypercare_issue_status(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_production_operating_cadence_event(uuid, text, timestamptz, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_production_operating_cadence_event_status(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_production_adoption_feedback(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_production_adoption_feedback_status(uuid, text, text, text, boolean, boolean, text, uuid, uuid) from public, anon, authenticated;

grant execute on function public.patch53_service_role_required() to service_role;
grant execute on function public.record_production_hypercare_event(uuid, uuid, uuid, text, text, uuid, text) to service_role;
grant execute on function public.create_production_hypercare_period(uuid, uuid, uuid, text, date, date, uuid, uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.update_production_hypercare_period_status(uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_production_hypercare_issue(uuid, text, text, text, uuid, uuid, timestamptz, uuid, uuid, uuid) to service_role;
grant execute on function public.update_production_hypercare_issue_status(uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_production_operating_cadence_event(uuid, text, timestamptz, uuid, uuid) to service_role;
grant execute on function public.update_production_operating_cadence_event_status(uuid, text, text, text, text, text, uuid) to service_role;
grant execute on function public.create_production_adoption_feedback(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.update_production_adoption_feedback_status(uuid, text, text, text, boolean, boolean, text, uuid, uuid) to service_role;
grant execute on function public.get_production_hypercare_stability_summary() to authenticated;
grant execute on function public.get_production_readiness_hypercare_overlay() to authenticated;

comment on table public.production_hypercare_periods is 'Patch 53 production hypercare period register.';
comment on table public.production_hypercare_issues is 'Patch 53 production hypercare issue triage register.';
comment on table public.production_operating_cadence_events is 'Patch 53 production operating cadence register.';
comment on table public.production_adoption_feedback is 'Patch 53 department adoption and feedback register.';
comment on table public.production_hypercare_events is 'Patch 53 production hypercare event history.';
