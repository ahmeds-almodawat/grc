-- Patch 52: Pilot Closure, Remediation & Production Go-Live Decision Pack
-- Adds formal pilot closure review, remediation, accepted limitations, and executive go-live decision tracking.

create table if not exists public.pilot_closure_reviews (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete set null,
  closure_label text not null,
  closure_status text not null default 'in_review' check (closure_status in ('in_review', 'ready_for_decision', 'approved_for_golive', 'approved_with_limitations', 'blocked', 'deferred', 'cancelled')),
  executive_sponsor_user_id uuid null references auth.users(id) on delete set null,
  quality_owner_user_id uuid null references auth.users(id) on delete set null,
  audit_owner_user_id uuid null references auth.users(id) on delete set null,
  it_owner_user_id uuid null references auth.users(id) on delete set null,
  target_golive_date date null,
  decision_summary text null,
  limitation_summary text null,
  blocker_summary text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_remediation_actions (
  id uuid primary key default gen_random_uuid(),
  closure_review_id uuid null references public.pilot_closure_reviews(id) on delete cascade,
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete set null,
  source_issue_id uuid null references public.live_pilot_execution_issues(id) on delete set null,
  source_workflow_run_id uuid null references public.live_pilot_workflow_runs(id) on delete set null,
  remediation_title text not null,
  remediation_status text not null default 'open' check (remediation_status in ('open', 'in_progress', 'completed', 'overdue', 'accepted_risk', 'cancelled')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  owner_user_id uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  completed_at timestamptz null,
  evidence_reference text null,
  remediation_summary text null,
  risk_acceptance_reason text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_accepted_limitations (
  id uuid primary key default gen_random_uuid(),
  closure_review_id uuid null references public.pilot_closure_reviews(id) on delete cascade,
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete set null,
  limitation_title text not null,
  limitation_status text not null default 'pending_review' check (limitation_status in ('pending_review', 'accepted', 'rejected', 'expired', 'superseded')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  accepted_by uuid null references auth.users(id) on delete set null,
  accepted_at timestamptz null,
  expires_at timestamptz null,
  mitigation_plan text null,
  evidence_reference text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_golive_decisions (
  id uuid primary key default gen_random_uuid(),
  closure_review_id uuid null references public.pilot_closure_reviews(id) on delete cascade,
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete set null,
  decision_status text not null default 'pending' check (decision_status in ('pending', 'approved', 'approved_with_limitations', 'rejected', 'deferred', 'revoked')),
  decision_level text not null default 'executive' check (decision_level in ('quality', 'audit', 'it_admin', 'executive', 'board')),
  decision_by uuid null references auth.users(id) on delete set null,
  decision_at timestamptz null,
  decision_summary text null,
  conditions_summary text null,
  evidence_reference text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_closure_events (
  id uuid primary key default gen_random_uuid(),
  closure_review_id uuid null references public.pilot_closure_reviews(id) on delete cascade,
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete set null,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  evidence_reference text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch52_closure_reviews_status on public.pilot_closure_reviews(activation_run_id, closure_status);
create index if not exists idx_patch52_remediation_status on public.pilot_remediation_actions(closure_review_id, remediation_status, severity);
create index if not exists idx_patch52_remediation_due on public.pilot_remediation_actions(due_at, remediation_status);
create index if not exists idx_patch52_limitations_status on public.pilot_accepted_limitations(closure_review_id, limitation_status, severity);
create index if not exists idx_patch52_limitations_expiry on public.pilot_accepted_limitations(expires_at, limitation_status);
create index if not exists idx_patch52_golive_status on public.production_golive_decisions(closure_review_id, decision_status, decision_level);
create index if not exists idx_patch52_events_closure on public.pilot_closure_events(closure_review_id, created_at desc);

alter table public.pilot_closure_reviews enable row level security;
alter table public.pilot_remediation_actions enable row level security;
alter table public.pilot_accepted_limitations enable row level security;
alter table public.production_golive_decisions enable row level security;
alter table public.pilot_closure_events enable row level security;

drop policy if exists patch52_closure_reviews_read on public.pilot_closure_reviews;
create policy patch52_closure_reviews_read on public.pilot_closure_reviews for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch52_closure_reviews_write on public.pilot_closure_reviews;
create policy patch52_closure_reviews_write on public.pilot_closure_reviews for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch52_remediation_read on public.pilot_remediation_actions;
create policy patch52_remediation_read on public.pilot_remediation_actions for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch52_remediation_write on public.pilot_remediation_actions;
create policy patch52_remediation_write on public.pilot_remediation_actions for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch52_limitations_read on public.pilot_accepted_limitations;
create policy patch52_limitations_read on public.pilot_accepted_limitations for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch52_limitations_write on public.pilot_accepted_limitations;
create policy patch52_limitations_write on public.pilot_accepted_limitations for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch52_golive_read on public.production_golive_decisions;
create policy patch52_golive_read on public.production_golive_decisions for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch52_golive_write on public.production_golive_decisions;
create policy patch52_golive_write on public.production_golive_decisions for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch52_events_read on public.pilot_closure_events;
create policy patch52_events_read on public.pilot_closure_events for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch52_events_write on public.pilot_closure_events;
create policy patch52_events_write on public.pilot_closure_events for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

create or replace view public.v_patch52_pilot_closure_review_register with (security_invoker = true) as
select c.*,
  (c.closure_status in ('in_review', 'ready_for_decision')) as needs_decision,
  (c.closure_status in ('blocked', 'deferred')) as is_blocked_or_deferred
from public.pilot_closure_reviews c;

create or replace view public.v_patch52_pilot_remediation_action_register with (security_invoker = true) as
select r.*,
  c.closure_label,
  (r.remediation_status in ('open', 'in_progress', 'overdue') and r.due_at is not null and r.due_at < now()) as is_overdue,
  (r.remediation_status in ('open', 'in_progress', 'overdue') and r.severity in ('high', 'critical')) as is_high_critical_open
from public.pilot_remediation_actions r
left join public.pilot_closure_reviews c on c.id = r.closure_review_id;

create or replace view public.v_patch52_overdue_remediation_action_register with (security_invoker = true) as
select *
from public.v_patch52_pilot_remediation_action_register
where remediation_status = 'overdue' or is_overdue;

create or replace view public.v_patch52_open_high_critical_remediation_register with (security_invoker = true) as
select *
from public.v_patch52_pilot_remediation_action_register
where is_high_critical_open;

create or replace view public.v_patch52_accepted_limitation_register with (security_invoker = true) as
select l.*, c.closure_label,
  (l.severity in ('high', 'critical') and l.limitation_status = 'accepted') as is_high_critical_accepted,
  (l.limitation_status = 'pending_review') as is_pending_review,
  (l.limitation_status = 'accepted' and l.expires_at is not null and l.expires_at <= now() + interval '30 days') as is_expiring
from public.pilot_accepted_limitations l
left join public.pilot_closure_reviews c on c.id = l.closure_review_id;

create or replace view public.v_patch52_expiring_limitation_register with (security_invoker = true) as
select *
from public.v_patch52_accepted_limitation_register
where is_expiring or limitation_status = 'expired';

create or replace view public.v_patch52_production_golive_decision_register with (security_invoker = true) as
select d.*, c.closure_label,
  (d.decision_status in ('pending', 'deferred')) as needs_decision,
  (d.decision_status in ('rejected', 'deferred', 'revoked')) as is_blocking_decision
from public.production_golive_decisions d
left join public.pilot_closure_reviews c on c.id = d.closure_review_id;

create or replace view public.v_patch52_missing_golive_decision_register with (security_invoker = true) as
select c.id as closure_review_id, c.activation_run_id, c.closure_label,
  'missing_golive_decision'::text as blocker_type,
  'A production go-live decision is still required for this pilot closure review.'::text as blocker_summary
from public.pilot_closure_reviews c
where c.closure_status in ('in_review', 'ready_for_decision', 'approved_for_golive', 'approved_with_limitations')
  and not exists (
    select 1
    from public.production_golive_decisions d
    where d.closure_review_id = c.id
      and d.decision_status in ('approved', 'approved_with_limitations', 'rejected', 'deferred')
  );

create or replace view public.v_patch52_pilot_closure_blocker_register with (security_invoker = true) as
select closure_review_id, activation_run_id, closure_label, 'closure_review'::text as blocker_area, closure_status::text as blocker_type, coalesce(blocker_summary, 'Pilot closure review is blocked, deferred, or still in review.') as blocker_summary, null::text as evidence_reference
from public.v_patch52_pilot_closure_review_register
where closure_status in ('in_review', 'blocked', 'deferred')
union all
select closure_review_id, activation_run_id, closure_label, 'remediation'::text as blocker_area, remediation_status::text as blocker_type, remediation_title as blocker_summary, evidence_reference
from public.v_patch52_pilot_remediation_action_register
where remediation_status in ('open', 'in_progress', 'overdue') or is_high_critical_open
union all
select closure_review_id, activation_run_id, closure_label, 'accepted_limitation'::text as blocker_area, limitation_status::text as blocker_type, limitation_title as blocker_summary, evidence_reference
from public.v_patch52_accepted_limitation_register
where limitation_status in ('pending_review', 'expired') or is_high_critical_accepted
union all
select closure_review_id, activation_run_id, closure_label, 'go_live_decision'::text as blocker_area, decision_status::text as blocker_type, coalesce(decision_summary, 'Production go-live decision is pending, rejected, deferred, or revoked.') as blocker_summary, evidence_reference
from public.v_patch52_production_golive_decision_register
where decision_status in ('pending', 'rejected', 'deferred', 'revoked')
union all
select closure_review_id, activation_run_id, closure_label, 'go_live_decision'::text as blocker_area, blocker_type, blocker_summary, null::text as evidence_reference
from public.v_patch52_missing_golive_decision_register
union all
select null::uuid as closure_review_id, null::uuid as activation_run_id, workflow_label as closure_label, 'live_workflow'::text as blocker_area, run_status::text as blocker_type, coalesce(blocker_summary, 'A live pilot workflow failed or is blocked.') as blocker_summary, evidence_summary as evidence_reference
from public.v_patch51_failed_workflow_walkthrough_register
union all
select null::uuid as closure_review_id, null::uuid as activation_run_id, workflow_label as closure_label, 'workflow_evidence'::text as blocker_area, blocker_type, blocker_summary, null::text as evidence_reference
from public.v_patch51_missing_workflow_evidence_register
union all
select null::uuid as closure_review_id, null::uuid as activation_run_id, workflow_label as closure_label, 'live_issue'::text as blocker_area, issue_type::text as blocker_type, issue_summary as blocker_summary, evidence_reference
from public.v_patch51_live_pilot_execution_issue_register
where issue_status in ('open', 'in_review') and severity in ('high', 'critical');

create or replace view public.v_patch52_pilot_closure_summary with (security_invoker = true) as
with closures as (
  select
    count(*)::integer as closure_review_total,
    count(*) filter (where closure_status = 'in_review')::integer as closure_reviews_in_review,
    count(*) filter (where closure_status = 'ready_for_decision')::integer as closure_reviews_ready_for_decision,
    count(*) filter (where closure_status in ('blocked', 'deferred'))::integer as blocked_or_deferred_closures,
    count(*) filter (where closure_status = 'approved_with_limitations')::integer as closure_reviews_approved_with_limitations
  from public.pilot_closure_reviews
),
remediation as (
  select
    count(*) filter (where remediation_status in ('open', 'in_progress', 'overdue'))::integer as open_remediation_actions,
    count(*) filter (where remediation_status = 'overdue' or (remediation_status in ('open', 'in_progress') and due_at is not null and due_at < now()))::integer as overdue_remediation_actions,
    count(*) filter (where remediation_status in ('open', 'in_progress', 'overdue') and severity in ('high', 'critical'))::integer as high_critical_remediation_actions
  from public.pilot_remediation_actions
),
limitations as (
  select
    count(*) filter (where limitation_status = 'accepted')::integer as accepted_limitations,
    count(*) filter (where limitation_status = 'accepted' and severity in ('high', 'critical'))::integer as high_critical_accepted_limitations,
    count(*) filter (where limitation_status = 'pending_review')::integer as pending_limitation_reviews,
    count(*) filter (where limitation_status = 'expired' or (limitation_status = 'accepted' and expires_at is not null and expires_at <= now() + interval '30 days'))::integer as expiring_limitations
  from public.pilot_accepted_limitations
),
decisions as (
  select
    count(*) filter (where decision_status = 'pending')::integer as pending_golive_decisions,
    count(*) filter (where decision_status in ('rejected', 'deferred', 'revoked'))::integer as rejected_or_deferred_decisions,
    count(*) filter (where decision_status = 'approved')::integer as approved_golive_decisions,
    count(*) filter (where decision_status = 'approved_with_limitations')::integer as approved_with_limitations_decisions
  from public.production_golive_decisions
),
missing_decisions as (
  select count(*)::integer as missing_golive_decisions
  from public.v_patch52_missing_golive_decision_register
),
live_workflows as (
  select
    count(*) filter (where run_status in ('failed', 'blocked'))::integer as failed_or_blocked_workflows
  from public.live_pilot_workflow_runs
),
live_evidence as (
  select count(*)::integer as missing_workflow_evidence_count
  from public.v_patch51_missing_workflow_evidence_register
),
live_issues as (
  select count(*) filter (where issue_status in ('open', 'in_review') and severity in ('high', 'critical'))::integer as open_high_critical_live_issues
  from public.live_pilot_execution_issues
)
select
  coalesce((select closure_review_total from closures), 0) as closure_review_total,
  coalesce((select closure_reviews_in_review from closures), 0) as closure_reviews_in_review,
  coalesce((select closure_reviews_ready_for_decision from closures), 0) as closure_reviews_ready_for_decision,
  coalesce((select blocked_or_deferred_closures from closures), 0) as blocked_or_deferred_closures,
  coalesce((select closure_reviews_approved_with_limitations from closures), 0) as closure_reviews_approved_with_limitations,
  coalesce((select open_remediation_actions from remediation), 0) as open_remediation_actions,
  coalesce((select overdue_remediation_actions from remediation), 0) as overdue_remediation_actions,
  coalesce((select high_critical_remediation_actions from remediation), 0) as high_critical_remediation_actions,
  coalesce((select accepted_limitations from limitations), 0) as accepted_limitations,
  coalesce((select high_critical_accepted_limitations from limitations), 0) as high_critical_accepted_limitations,
  coalesce((select pending_limitation_reviews from limitations), 0) as pending_limitation_reviews,
  coalesce((select expiring_limitations from limitations), 0) as expiring_limitations,
  coalesce((select pending_golive_decisions from decisions), 0) as pending_golive_decisions,
  coalesce((select rejected_or_deferred_decisions from decisions), 0) as rejected_or_deferred_decisions,
  coalesce((select approved_golive_decisions from decisions), 0) as approved_golive_decisions,
  coalesce((select approved_with_limitations_decisions from decisions), 0) as approved_with_limitations_decisions,
  coalesce((select missing_golive_decisions from missing_decisions), 0) as missing_golive_decisions,
  coalesce((select failed_or_blocked_workflows from live_workflows), 0) as failed_or_blocked_workflows,
  coalesce((select missing_workflow_evidence_count from live_evidence), 0) as missing_workflow_evidence_count,
  coalesce((select open_high_critical_live_issues from live_issues), 0) as open_high_critical_live_issues,
  case
    when coalesce((select closure_review_total from closures), 0) = 0 then 'evidence_required'
    when coalesce((select blocked_or_deferred_closures from closures), 0) > 0
      or coalesce((select overdue_remediation_actions from remediation), 0) > 0
      or coalesce((select high_critical_remediation_actions from remediation), 0) > 0
      or coalesce((select rejected_or_deferred_decisions from decisions), 0) > 0
      or coalesce((select failed_or_blocked_workflows from live_workflows), 0) > 0
      or coalesce((select missing_workflow_evidence_count from live_evidence), 0) > 0
      or coalesce((select open_high_critical_live_issues from live_issues), 0) > 0 then 'blocked'
    when coalesce((select pending_golive_decisions from decisions), 0) > 0
      or coalesce((select missing_golive_decisions from missing_decisions), 0) > 0
      or coalesce((select closure_reviews_in_review from closures), 0) > 0
      or coalesce((select closure_reviews_ready_for_decision from closures), 0) > 0
      or coalesce((select open_remediation_actions from remediation), 0) > 0
      or coalesce((select pending_limitation_reviews from limitations), 0) > 0 then 'in_review'
    when coalesce((select approved_with_limitations_decisions from decisions), 0) > 0
      or coalesce((select closure_reviews_approved_with_limitations from closures), 0) > 0
      or coalesce((select accepted_limitations from limitations), 0) > 0 then 'ready_with_limitations'
    when coalesce((select approved_golive_decisions from decisions), 0) > 0 then 'ready'
    else 'evidence_required'
  end as production_golive_readiness_status;

create or replace view public.v_patch52_production_readiness_golive_decision_overlay with (security_invoker = true) as
select *,
  case
    when production_golive_readiness_status = 'ready' then 'Production go-live is approved with no open closure blockers recorded.'
    when production_golive_readiness_status = 'ready_with_limitations' then 'Production go-live may proceed only with documented accepted limitations and monitoring.'
    when production_golive_readiness_status = 'blocked' then 'Resolve open high-risk remediation, failed workflows, missing evidence, or blocked decisions before go-live.'
    when production_golive_readiness_status = 'in_review' then 'Complete closure review, remediation tracking, limitation review, and go-live decisions.'
    else 'Create a pilot closure review and record executive go-live decision evidence.'
  end as next_action_required
from public.v_patch52_pilot_closure_summary;

alter view if exists public.v_patch52_pilot_closure_review_register set (security_invoker = true);
alter view if exists public.v_patch52_pilot_remediation_action_register set (security_invoker = true);
alter view if exists public.v_patch52_overdue_remediation_action_register set (security_invoker = true);
alter view if exists public.v_patch52_open_high_critical_remediation_register set (security_invoker = true);
alter view if exists public.v_patch52_accepted_limitation_register set (security_invoker = true);
alter view if exists public.v_patch52_expiring_limitation_register set (security_invoker = true);
alter view if exists public.v_patch52_production_golive_decision_register set (security_invoker = true);
alter view if exists public.v_patch52_missing_golive_decision_register set (security_invoker = true);
alter view if exists public.v_patch52_pilot_closure_blocker_register set (security_invoker = true);
alter view if exists public.v_patch52_pilot_closure_summary set (security_invoker = true);
alter view if exists public.v_patch52_production_readiness_golive_decision_overlay set (security_invoker = true);

grant select on public.v_patch52_pilot_closure_review_register to authenticated;
grant select on public.v_patch52_pilot_remediation_action_register to authenticated;
grant select on public.v_patch52_overdue_remediation_action_register to authenticated;
grant select on public.v_patch52_open_high_critical_remediation_register to authenticated;
grant select on public.v_patch52_accepted_limitation_register to authenticated;
grant select on public.v_patch52_expiring_limitation_register to authenticated;
grant select on public.v_patch52_production_golive_decision_register to authenticated;
grant select on public.v_patch52_missing_golive_decision_register to authenticated;
grant select on public.v_patch52_pilot_closure_blocker_register to authenticated;
grant select on public.v_patch52_pilot_closure_summary to authenticated;
grant select on public.v_patch52_production_readiness_golive_decision_overlay to authenticated;

create or replace function public.patch52_service_role_required()
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 52 pilot closure mutations require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.record_pilot_closure_event(p_closure_review_id uuid, p_activation_run_id uuid, p_event_type text, p_event_summary text, p_actor_user_id uuid default null, p_evidence_reference text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch52_service_role_required();
  insert into public.pilot_closure_events(closure_review_id, activation_run_id, event_type, event_summary, actor_user_id, evidence_reference)
  values (p_closure_review_id, p_activation_run_id, p_event_type, p_event_summary, p_actor_user_id, p_evidence_reference)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_pilot_closure_review(p_activation_run_id uuid, p_closure_label text, p_target_golive_date date default null, p_executive_sponsor_user_id uuid default null, p_quality_owner_user_id uuid default null, p_audit_owner_user_id uuid default null, p_it_owner_user_id uuid default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch52_service_role_required();
  insert into public.pilot_closure_reviews(activation_run_id, closure_label, target_golive_date, executive_sponsor_user_id, quality_owner_user_id, audit_owner_user_id, it_owner_user_id, created_by)
  values (p_activation_run_id, p_closure_label, p_target_golive_date, p_executive_sponsor_user_id, p_quality_owner_user_id, p_audit_owner_user_id, p_it_owner_user_id, p_created_by)
  returning id into v_id;
  perform public.record_pilot_closure_event(v_id, p_activation_run_id, 'closure_review_created', 'Pilot closure review created.', p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_pilot_closure_review_status(p_closure_review_id uuid, p_closure_status text, p_decision_summary text default null, p_limitation_summary text default null, p_blocker_summary text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_activation_run_id uuid;
begin
  perform public.patch52_service_role_required();
  if p_closure_status in ('approved_for_golive', 'approved_with_limitations', 'blocked', 'deferred') and nullif(coalesce(p_decision_summary, ''), '') is null then raise exception 'Decision summary is required for closure decision status.'; end if;
  if p_closure_status = 'approved_with_limitations' and nullif(coalesce(p_limitation_summary, ''), '') is null then raise exception 'Limitation summary is required for approval with limitations.'; end if;
  if p_closure_status = 'blocked' and nullif(coalesce(p_blocker_summary, ''), '') is null then raise exception 'Blocker summary is required when closure is blocked.'; end if;
  update public.pilot_closure_reviews
  set closure_status = p_closure_status, decision_summary = coalesce(p_decision_summary, decision_summary), limitation_summary = coalesce(p_limitation_summary, limitation_summary), blocker_summary = coalesce(p_blocker_summary, blocker_summary), updated_at = now()
  where id = p_closure_review_id
  returning activation_run_id into v_activation_run_id;
  if not found then raise exception 'Pilot closure review not found: %', p_closure_review_id; end if;
  perform public.record_pilot_closure_event(p_closure_review_id, v_activation_run_id, 'closure_review_status_updated', 'Pilot closure status updated to ' || p_closure_status, p_actor_user_id, null);
  return p_closure_review_id;
end;
$$;

create or replace function public.create_pilot_remediation_action(p_closure_review_id uuid, p_activation_run_id uuid, p_remediation_title text, p_severity text default 'medium', p_owner_user_id uuid default null, p_due_at timestamptz default null, p_source_issue_id uuid default null, p_source_workflow_run_id uuid default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch52_service_role_required();
  insert into public.pilot_remediation_actions(closure_review_id, activation_run_id, remediation_title, severity, owner_user_id, due_at, source_issue_id, source_workflow_run_id, created_by)
  values (p_closure_review_id, p_activation_run_id, p_remediation_title, coalesce(nullif(p_severity, ''), 'medium'), p_owner_user_id, p_due_at, p_source_issue_id, p_source_workflow_run_id, p_created_by)
  returning id into v_id;
  perform public.record_pilot_closure_event(p_closure_review_id, p_activation_run_id, 'remediation_action_created', 'Pilot remediation action created: ' || p_remediation_title, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_pilot_remediation_action_status(p_remediation_action_id uuid, p_remediation_status text, p_remediation_summary text default null, p_risk_acceptance_reason text default null, p_evidence_reference text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_closure_review_id uuid; v_activation_run_id uuid; v_title text;
begin
  perform public.patch52_service_role_required();
  if p_remediation_status = 'completed' and (nullif(coalesce(p_remediation_summary, ''), '') is null or nullif(coalesce(p_evidence_reference, ''), '') is null) then raise exception 'Remediation summary and evidence reference are required before completion.'; end if;
  if p_remediation_status = 'accepted_risk' and nullif(coalesce(p_risk_acceptance_reason, ''), '') is null then raise exception 'Risk acceptance reason is required for accepted risk remediation.'; end if;
  update public.pilot_remediation_actions
  set remediation_status = p_remediation_status, remediation_summary = coalesce(p_remediation_summary, remediation_summary), risk_acceptance_reason = coalesce(p_risk_acceptance_reason, risk_acceptance_reason), evidence_reference = coalesce(p_evidence_reference, evidence_reference), completed_at = case when p_remediation_status in ('completed', 'accepted_risk', 'cancelled') then now() else completed_at end, updated_at = now()
  where id = p_remediation_action_id
  returning closure_review_id, activation_run_id, remediation_title into v_closure_review_id, v_activation_run_id, v_title;
  if not found then raise exception 'Pilot remediation action not found: %', p_remediation_action_id; end if;
  perform public.record_pilot_closure_event(v_closure_review_id, v_activation_run_id, 'remediation_action_status_updated', 'Pilot remediation status updated to ' || p_remediation_status || ': ' || v_title, p_actor_user_id, p_evidence_reference);
  return p_remediation_action_id;
end;
$$;

create or replace function public.create_pilot_accepted_limitation(p_closure_review_id uuid, p_activation_run_id uuid, p_limitation_title text, p_severity text default 'medium', p_expires_at timestamptz default null, p_mitigation_plan text default null, p_evidence_reference text default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch52_service_role_required();
  insert into public.pilot_accepted_limitations(closure_review_id, activation_run_id, limitation_title, severity, expires_at, mitigation_plan, evidence_reference, created_by)
  values (p_closure_review_id, p_activation_run_id, p_limitation_title, coalesce(nullif(p_severity, ''), 'medium'), p_expires_at, p_mitigation_plan, p_evidence_reference, p_created_by)
  returning id into v_id;
  perform public.record_pilot_closure_event(p_closure_review_id, p_activation_run_id, 'limitation_submitted_for_review', 'Pilot limitation submitted for review: ' || p_limitation_title, p_created_by, p_evidence_reference);
  return v_id;
end;
$$;

create or replace function public.update_pilot_accepted_limitation_status(p_limitation_id uuid, p_limitation_status text, p_accepted_by uuid default null, p_mitigation_plan text default null, p_evidence_reference text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_closure_review_id uuid; v_activation_run_id uuid; v_title text;
begin
  perform public.patch52_service_role_required();
  if p_limitation_status = 'accepted' and (p_accepted_by is null or nullif(coalesce(p_mitigation_plan, ''), '') is null or nullif(coalesce(p_evidence_reference, ''), '') is null) then raise exception 'Accepted limitations require approver, mitigation plan, and evidence reference.'; end if;
  update public.pilot_accepted_limitations
  set limitation_status = p_limitation_status, accepted_by = coalesce(p_accepted_by, accepted_by), accepted_at = case when p_limitation_status = 'accepted' then now() else accepted_at end, mitigation_plan = coalesce(p_mitigation_plan, mitigation_plan), evidence_reference = coalesce(p_evidence_reference, evidence_reference), updated_at = now()
  where id = p_limitation_id
  returning closure_review_id, activation_run_id, limitation_title into v_closure_review_id, v_activation_run_id, v_title;
  if not found then raise exception 'Pilot limitation not found: %', p_limitation_id; end if;
  perform public.record_pilot_closure_event(v_closure_review_id, v_activation_run_id, 'limitation_status_updated', 'Pilot limitation status updated to ' || p_limitation_status || ': ' || v_title, p_actor_user_id, p_evidence_reference);
  return p_limitation_id;
end;
$$;

create or replace function public.create_production_golive_decision(p_closure_review_id uuid, p_activation_run_id uuid, p_decision_level text default 'executive', p_decision_by uuid default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch52_service_role_required();
  insert into public.production_golive_decisions(closure_review_id, activation_run_id, decision_level, decision_by, created_by)
  values (p_closure_review_id, p_activation_run_id, coalesce(nullif(p_decision_level, ''), 'executive'), p_decision_by, p_created_by)
  returning id into v_id;
  perform public.record_pilot_closure_event(p_closure_review_id, p_activation_run_id, 'golive_decision_created', 'Production go-live decision record created.', p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_production_golive_decision_status(p_decision_id uuid, p_decision_status text, p_decision_summary text default null, p_conditions_summary text default null, p_evidence_reference text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_closure_review_id uuid; v_activation_run_id uuid;
begin
  perform public.patch52_service_role_required();
  if p_decision_status in ('approved', 'approved_with_limitations', 'rejected', 'deferred', 'revoked') and nullif(coalesce(p_decision_summary, ''), '') is null then raise exception 'Decision summary is required for go-live decision status.'; end if;
  if p_decision_status = 'approved_with_limitations' and nullif(coalesce(p_conditions_summary, ''), '') is null then raise exception 'Conditions summary is required for go-live approval with limitations.'; end if;
  update public.production_golive_decisions
  set decision_status = p_decision_status, decision_summary = coalesce(p_decision_summary, decision_summary), conditions_summary = coalesce(p_conditions_summary, conditions_summary), evidence_reference = coalesce(p_evidence_reference, evidence_reference), decision_at = case when p_decision_status in ('approved', 'approved_with_limitations', 'rejected', 'deferred', 'revoked') then now() else decision_at end, decision_by = coalesce(p_actor_user_id, decision_by), updated_at = now()
  where id = p_decision_id
  returning closure_review_id, activation_run_id into v_closure_review_id, v_activation_run_id;
  if not found then raise exception 'Production go-live decision not found: %', p_decision_id; end if;
  perform public.record_pilot_closure_event(v_closure_review_id, v_activation_run_id, 'golive_decision_status_updated', 'Production go-live decision updated to ' || p_decision_status, p_actor_user_id, p_evidence_reference);
  return p_decision_id;
end;
$$;

create or replace function public.get_pilot_closure_summary() returns jsonb language sql security invoker set search_path = public as $$
  select coalesce((select to_jsonb(v) from public.v_patch52_pilot_closure_summary v limit 1), '{}'::jsonb);
$$;

create or replace function public.get_production_readiness_golive_decision_overlay() returns jsonb language sql security invoker set search_path = public as $$
  select coalesce((select to_jsonb(v) from public.v_patch52_production_readiness_golive_decision_overlay v limit 1), '{}'::jsonb);
$$;

revoke all on function public.patch52_service_role_required() from public, anon, authenticated;
revoke all on function public.record_pilot_closure_event(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_pilot_closure_review(uuid, text, date, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_pilot_closure_review_status(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_pilot_remediation_action(uuid, uuid, text, text, uuid, timestamptz, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_pilot_remediation_action_status(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_pilot_accepted_limitation(uuid, uuid, text, text, timestamptz, text, text, uuid) from public, anon, authenticated;
revoke all on function public.update_pilot_accepted_limitation_status(uuid, text, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_production_golive_decision(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_production_golive_decision_status(uuid, text, text, text, text, uuid) from public, anon, authenticated;

grant execute on function public.patch52_service_role_required() to service_role;
grant execute on function public.record_pilot_closure_event(uuid, uuid, text, text, uuid, text) to service_role;
grant execute on function public.create_pilot_closure_review(uuid, text, date, uuid, uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.update_pilot_closure_review_status(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.create_pilot_remediation_action(uuid, uuid, text, text, uuid, timestamptz, uuid, uuid, uuid) to service_role;
grant execute on function public.update_pilot_remediation_action_status(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.create_pilot_accepted_limitation(uuid, uuid, text, text, timestamptz, text, text, uuid) to service_role;
grant execute on function public.update_pilot_accepted_limitation_status(uuid, text, uuid, text, text, uuid) to service_role;
grant execute on function public.create_production_golive_decision(uuid, uuid, text, uuid, uuid) to service_role;
grant execute on function public.update_production_golive_decision_status(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.get_pilot_closure_summary() to authenticated;
grant execute on function public.get_production_readiness_golive_decision_overlay() to authenticated;

comment on table public.pilot_closure_reviews is 'Patch 52 pilot closure review register.';
comment on table public.pilot_remediation_actions is 'Patch 52 pilot remediation action register.';
comment on table public.pilot_accepted_limitations is 'Patch 52 accepted limitation register.';
comment on table public.production_golive_decisions is 'Patch 52 production go-live decision register.';
comment on table public.pilot_closure_events is 'Patch 52 pilot closure event history.';
