-- Patch 51: Live Pilot Workflow Execution & Evidence Capture
-- Tracks live workflow walkthroughs, evidence, issues, and readiness without seeding successful runs.

create table if not exists public.live_pilot_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  activation_run_id uuid null references public.controlled_pilot_activation_runs(id) on delete cascade,
  workflow_key text not null check (workflow_key in ('ovr_rca_capa', 'audit_finding_closure', 'accreditation_evidence_gate', 'training_completion', 'access_review_signoff', 'backup_restore_dryrun', 'department_go_no_go')),
  workflow_label text not null,
  run_status text not null default 'not_started' check (run_status in ('not_started', 'scheduled', 'in_progress', 'passed', 'passed_with_limitations', 'failed', 'blocked', 'cancelled')),
  department_pilot_id uuid null references public.controlled_pilot_departments(id) on delete set null,
  owner_user_id uuid null references auth.users(id) on delete set null,
  scheduled_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  evidence_summary text null,
  limitation_summary text null,
  blocker_summary text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_pilot_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.live_pilot_workflow_runs(id) on delete cascade,
  step_order integer not null default 1,
  step_key text not null,
  step_label text not null,
  step_status text not null default 'pending' check (step_status in ('pending', 'in_progress', 'passed', 'passed_with_limitation', 'failed', 'blocked', 'not_applicable')),
  responsible_role text null,
  responsible_user_id uuid null references auth.users(id) on delete set null,
  evidence_required boolean not null default true,
  evidence_reference text null,
  issue_summary text null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.live_pilot_evidence_captures (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.live_pilot_workflow_runs(id) on delete cascade,
  workflow_step_id uuid null references public.live_pilot_workflow_steps(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('screenshot', 'report', 'system_record', 'approval_log', 'policy_document', 'training_record', 'restore_report', 'signoff', 'other')),
  evidence_title text not null,
  evidence_reference text null,
  captured_by uuid null references auth.users(id) on delete set null,
  captured_at timestamptz not null default now(),
  evidence_status text not null default 'captured' check (evidence_status in ('captured', 'accepted', 'rejected', 'needs_review')),
  review_notes text null,
  created_at timestamptz not null default now()
);

create table if not exists public.live_pilot_execution_issues (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid null references public.live_pilot_workflow_runs(id) on delete cascade,
  workflow_step_id uuid null references public.live_pilot_workflow_steps(id) on delete cascade,
  issue_type text not null check (issue_type in ('missing_evidence', 'workflow_failed', 'user_access_issue', 'owner_missing', 'training_gap', 'data_gap', 'policy_gap', 'technical_issue', 'process_gap')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  issue_status text not null default 'open' check (issue_status in ('open', 'in_review', 'resolved', 'accepted_with_limitation')),
  issue_summary text not null,
  assigned_to uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,
  resolution_summary text null,
  evidence_reference text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_pilot_workflow_events (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid null references public.live_pilot_workflow_runs(id) on delete cascade,
  workflow_step_id uuid null references public.live_pilot_workflow_steps(id) on delete cascade,
  event_type text not null,
  event_summary text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  evidence_reference text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch51_runs_status on public.live_pilot_workflow_runs(activation_run_id, run_status, workflow_key);
create index if not exists idx_patch51_steps_run on public.live_pilot_workflow_steps(workflow_run_id, step_status);
create index if not exists idx_patch51_evidence_run on public.live_pilot_evidence_captures(workflow_run_id, evidence_status);
create index if not exists idx_patch51_issues_run on public.live_pilot_execution_issues(workflow_run_id, issue_status, severity);
create index if not exists idx_patch51_events_run on public.live_pilot_workflow_events(workflow_run_id, created_at desc);

alter table public.live_pilot_workflow_runs enable row level security;
alter table public.live_pilot_workflow_steps enable row level security;
alter table public.live_pilot_evidence_captures enable row level security;
alter table public.live_pilot_execution_issues enable row level security;
alter table public.live_pilot_workflow_events enable row level security;

drop policy if exists patch51_runs_read on public.live_pilot_workflow_runs;
create policy patch51_runs_read on public.live_pilot_workflow_runs for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch51_runs_write on public.live_pilot_workflow_runs;
create policy patch51_runs_write on public.live_pilot_workflow_runs for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch51_steps_read on public.live_pilot_workflow_steps;
create policy patch51_steps_read on public.live_pilot_workflow_steps for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch51_steps_write on public.live_pilot_workflow_steps;
create policy patch51_steps_write on public.live_pilot_workflow_steps for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch51_evidence_read on public.live_pilot_evidence_captures;
create policy patch51_evidence_read on public.live_pilot_evidence_captures for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch51_evidence_write on public.live_pilot_evidence_captures;
create policy patch51_evidence_write on public.live_pilot_evidence_captures for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch51_issues_read on public.live_pilot_execution_issues;
create policy patch51_issues_read on public.live_pilot_execution_issues for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch51_issues_write on public.live_pilot_execution_issues;
create policy patch51_issues_write on public.live_pilot_execution_issues for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch51_events_read on public.live_pilot_workflow_events;
create policy patch51_events_read on public.live_pilot_workflow_events for select to authenticated using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));
drop policy if exists patch51_events_write on public.live_pilot_workflow_events;
create policy patch51_events_write on public.live_pilot_workflow_events for all to authenticated using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer'])) with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

create or replace view public.v_patch51_live_pilot_workflow_run_register with (security_invoker = true) as
select r.*, d.department_name,
  (r.run_status in ('not_started', 'scheduled', 'in_progress')) as is_pending_walkthrough,
  (r.run_status in ('failed', 'blocked')) as is_failed_or_blocked
from public.live_pilot_workflow_runs r
left join public.controlled_pilot_departments d on d.id = r.department_pilot_id;

create or replace view public.v_patch51_live_pilot_workflow_step_register with (security_invoker = true) as
select s.*, r.workflow_key, r.workflow_label,
  (s.evidence_required and nullif(s.evidence_reference, '') is null and s.step_status not in ('not_applicable')) as missing_required_evidence,
  (s.step_status in ('failed', 'blocked')) as is_failed_or_blocked
from public.live_pilot_workflow_steps s
join public.live_pilot_workflow_runs r on r.id = s.workflow_run_id;

create or replace view public.v_patch51_live_pilot_evidence_capture_register with (security_invoker = true) as
select e.*, r.workflow_key, r.workflow_label,
  (e.evidence_status in ('rejected', 'needs_review')) as evidence_needs_attention
from public.live_pilot_evidence_captures e
join public.live_pilot_workflow_runs r on r.id = e.workflow_run_id;

create or replace view public.v_patch51_live_pilot_execution_issue_register with (security_invoker = true) as
select i.*, r.workflow_key, r.workflow_label,
  (i.issue_status in ('open', 'in_review') and i.severity in ('critical', 'high')) as is_launch_blocker
from public.live_pilot_execution_issues i
left join public.live_pilot_workflow_runs r on r.id = i.workflow_run_id;

create or replace view public.v_patch51_pending_workflow_walkthrough_register with (security_invoker = true) as
select *
from public.v_patch51_live_pilot_workflow_run_register
where run_status in ('not_started', 'scheduled', 'in_progress');

create or replace view public.v_patch51_failed_workflow_walkthrough_register with (security_invoker = true) as
select *
from public.v_patch51_live_pilot_workflow_run_register
where run_status in ('failed', 'blocked');

create or replace view public.v_patch51_missing_workflow_evidence_register with (security_invoker = true) as
select workflow_run_id, id as workflow_step_id, workflow_key, workflow_label, step_key, step_label,
  'missing_evidence'::text as blocker_type,
  'Required walkthrough evidence has not been captured.'::text as blocker_summary
from public.v_patch51_live_pilot_workflow_step_register
where missing_required_evidence
union all
select workflow_run_id, workflow_step_id, workflow_key, workflow_label, evidence_type, evidence_title,
  evidence_status::text as blocker_type,
  'Captured evidence requires review or was rejected.'::text as blocker_summary
from public.v_patch51_live_pilot_evidence_capture_register
where evidence_needs_attention;

create or replace view public.v_patch51_workflow_execution_blocker_register with (security_invoker = true) as
select id as workflow_run_id, null::uuid as workflow_step_id, workflow_key, workflow_label, 'workflow_walkthrough'::text as blocker_area, run_status::text as blocker_type, coalesce(blocker_summary, 'Workflow walkthrough is failed, blocked, or incomplete.') as blocker_summary, null::text as evidence_reference
from public.v_patch51_live_pilot_workflow_run_register
where run_status in ('not_started', 'scheduled', 'in_progress', 'failed', 'blocked')
union all
select workflow_run_id, id as workflow_step_id, workflow_key, workflow_label, 'workflow_step'::text as blocker_area, step_status::text as blocker_type, coalesce(issue_summary, 'Workflow step is failed, blocked, or missing evidence.') as blocker_summary, evidence_reference
from public.v_patch51_live_pilot_workflow_step_register
where step_status in ('failed', 'blocked') or missing_required_evidence
union all
select workflow_run_id, workflow_step_id, workflow_key, workflow_label, 'evidence'::text as blocker_area, evidence_status::text as blocker_type, 'Captured evidence requires review or was rejected.'::text as blocker_summary, evidence_reference
from public.v_patch51_live_pilot_evidence_capture_register
where evidence_needs_attention
union all
select workflow_run_id, workflow_step_id, workflow_key, workflow_label, 'execution_issue'::text as blocker_area, issue_type::text as blocker_type, issue_summary as blocker_summary, evidence_reference
from public.v_patch51_live_pilot_execution_issue_register
where issue_status in ('open', 'in_review') and severity in ('critical', 'high');

create or replace view public.v_patch51_live_pilot_workflow_summary with (security_invoker = true) as
with runs as (
  select
    count(*)::integer as critical_workflows_total,
    count(*) filter (where run_status in ('passed', 'passed_with_limitations', 'failed', 'blocked', 'cancelled'))::integer as workflows_completed,
    count(*) filter (where run_status = 'passed')::integer as workflows_passed,
    count(*) filter (where run_status = 'passed_with_limitations')::integer as workflows_passed_with_limitations,
    count(*) filter (where run_status = 'failed')::integer as workflows_failed,
    count(*) filter (where run_status = 'blocked')::integer as workflows_blocked,
    count(*) filter (where run_status in ('not_started', 'scheduled', 'in_progress'))::integer as workflows_pending
  from public.live_pilot_workflow_runs
),
evidence as (
  select
    count(*)::integer as missing_evidence_count
  from public.v_patch51_missing_workflow_evidence_register
),
issues as (
  select
    count(*) filter (where issue_status in ('open', 'in_review') and severity in ('critical', 'high'))::integer as open_high_critical_issues
  from public.live_pilot_execution_issues
),
attention as (
  select
    count(*) filter (where evidence_status in ('rejected', 'needs_review'))::integer as evidence_needing_review
  from public.live_pilot_evidence_captures
),
blockers as (
  select count(*)::integer as workflow_blocker_count
  from public.v_patch51_workflow_execution_blocker_register
)
select
  coalesce((select critical_workflows_total from runs), 0) as critical_workflows_total,
  coalesce((select workflows_completed from runs), 0) as workflows_completed,
  coalesce((select workflows_passed from runs), 0) as workflows_passed,
  coalesce((select workflows_passed_with_limitations from runs), 0) as workflows_passed_with_limitations,
  coalesce((select workflows_failed from runs), 0) as workflows_failed,
  coalesce((select workflows_blocked from runs), 0) as workflows_blocked,
  coalesce((select workflows_pending from runs), 0) as workflows_pending,
  coalesce((select missing_evidence_count from evidence), 0) as missing_evidence_count,
  coalesce((select open_high_critical_issues from issues), 0) as open_high_critical_issues,
  coalesce((select evidence_needing_review from attention), 0) as evidence_needing_review,
  coalesce((select workflow_blocker_count from blockers), 0) as workflow_blocker_count,
  case
    when coalesce((select critical_workflows_total from runs), 0) = 0 then 'evidence_required'
    when coalesce((select workflow_blocker_count from blockers), 0) > 0 or coalesce((select open_high_critical_issues from issues), 0) > 0 then 'blocked'
    when coalesce((select workflows_pending from runs), 0) > 0 or coalesce((select missing_evidence_count from evidence), 0) > 0 or coalesce((select evidence_needing_review from attention), 0) > 0 then 'in_progress'
    when coalesce((select workflows_passed_with_limitations from runs), 0) > 0 then 'ready_with_limitations'
    when coalesce((select workflows_passed from runs), 0) = coalesce((select critical_workflows_total from runs), 0) then 'ready'
    else 'evidence_required'
  end as live_execution_readiness_status;

create or replace view public.v_patch51_production_readiness_live_pilot_execution_overlay with (security_invoker = true) as
select *,
  case
    when live_execution_readiness_status = 'ready' then 'All recorded live pilot workflow walkthroughs passed with accepted evidence.'
    when live_execution_readiness_status = 'ready_with_limitations' then 'Live pilot workflows can proceed with documented limitations and monitoring.'
    when live_execution_readiness_status = 'blocked' then 'Resolve failed walkthroughs, blocked steps, missing evidence, or high-risk execution issues before approval.'
    when live_execution_readiness_status = 'in_progress' then 'Complete pending workflow walkthroughs and evidence review.'
    else 'Record live workflow walkthroughs and capture evidence before pilot approval.'
  end as next_action_required
from public.v_patch51_live_pilot_workflow_summary;

alter view if exists public.v_patch51_live_pilot_workflow_run_register set (security_invoker = true);
alter view if exists public.v_patch51_live_pilot_workflow_step_register set (security_invoker = true);
alter view if exists public.v_patch51_live_pilot_evidence_capture_register set (security_invoker = true);
alter view if exists public.v_patch51_live_pilot_execution_issue_register set (security_invoker = true);
alter view if exists public.v_patch51_pending_workflow_walkthrough_register set (security_invoker = true);
alter view if exists public.v_patch51_failed_workflow_walkthrough_register set (security_invoker = true);
alter view if exists public.v_patch51_missing_workflow_evidence_register set (security_invoker = true);
alter view if exists public.v_patch51_workflow_execution_blocker_register set (security_invoker = true);
alter view if exists public.v_patch51_live_pilot_workflow_summary set (security_invoker = true);
alter view if exists public.v_patch51_production_readiness_live_pilot_execution_overlay set (security_invoker = true);

grant select on public.v_patch51_live_pilot_workflow_run_register to authenticated;
grant select on public.v_patch51_live_pilot_workflow_step_register to authenticated;
grant select on public.v_patch51_live_pilot_evidence_capture_register to authenticated;
grant select on public.v_patch51_live_pilot_execution_issue_register to authenticated;
grant select on public.v_patch51_pending_workflow_walkthrough_register to authenticated;
grant select on public.v_patch51_failed_workflow_walkthrough_register to authenticated;
grant select on public.v_patch51_missing_workflow_evidence_register to authenticated;
grant select on public.v_patch51_workflow_execution_blocker_register to authenticated;
grant select on public.v_patch51_live_pilot_workflow_summary to authenticated;
grant select on public.v_patch51_production_readiness_live_pilot_execution_overlay to authenticated;

create or replace function public.patch51_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 51 live pilot mutations require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.record_live_pilot_workflow_event(p_workflow_run_id uuid, p_workflow_step_id uuid, p_event_type text, p_event_summary text, p_actor_user_id uuid default null, p_evidence_reference text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch51_service_role_required();
  insert into public.live_pilot_workflow_events(workflow_run_id, workflow_step_id, event_type, event_summary, actor_user_id, evidence_reference)
  values (p_workflow_run_id, p_workflow_step_id, p_event_type, p_event_summary, p_actor_user_id, p_evidence_reference)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_live_pilot_workflow_run(p_activation_run_id uuid, p_workflow_key text, p_workflow_label text, p_department_pilot_id uuid default null, p_owner_user_id uuid default null, p_scheduled_at timestamptz default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch51_service_role_required();
  insert into public.live_pilot_workflow_runs(activation_run_id, workflow_key, workflow_label, department_pilot_id, owner_user_id, scheduled_at, created_by)
  values (p_activation_run_id, p_workflow_key, p_workflow_label, p_department_pilot_id, p_owner_user_id, p_scheduled_at, p_created_by)
  returning id into v_id;
  perform public.record_live_pilot_workflow_event(v_id, null, 'workflow_run_created', 'Live pilot workflow walkthrough created.', p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_live_pilot_workflow_run_status(p_workflow_run_id uuid, p_run_status text, p_evidence_summary text default null, p_limitation_summary text default null, p_blocker_summary text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform public.patch51_service_role_required();
  if p_run_status in ('passed', 'passed_with_limitations') and nullif(coalesce(p_evidence_summary, ''), '') is null then raise exception 'Evidence summary is required before marking a workflow walkthrough passed.'; end if;
  if p_run_status = 'passed_with_limitations' and nullif(coalesce(p_limitation_summary, ''), '') is null then raise exception 'Limitation summary is required for passed with limitations.'; end if;
  if p_run_status in ('failed', 'blocked') and nullif(coalesce(p_blocker_summary, ''), '') is null then raise exception 'Blocker summary is required for failed or blocked workflow walkthroughs.'; end if;
  update public.live_pilot_workflow_runs
  set run_status = p_run_status, evidence_summary = coalesce(p_evidence_summary, evidence_summary), limitation_summary = coalesce(p_limitation_summary, limitation_summary), blocker_summary = coalesce(p_blocker_summary, blocker_summary), started_at = case when p_run_status = 'in_progress' then now() else started_at end, completed_at = case when p_run_status in ('passed', 'passed_with_limitations', 'failed', 'blocked', 'cancelled') then now() else completed_at end, updated_at = now()
  where id = p_workflow_run_id;
  if not found then raise exception 'Live pilot workflow run not found: %', p_workflow_run_id; end if;
  perform public.record_live_pilot_workflow_event(p_workflow_run_id, null, 'workflow_run_status_updated', 'Live pilot workflow status updated to ' || p_run_status, p_actor_user_id, p_evidence_summary);
  return p_workflow_run_id;
end;
$$;

create or replace function public.create_live_pilot_workflow_step(p_workflow_run_id uuid, p_step_order integer, p_step_key text, p_step_label text, p_responsible_role text default null, p_responsible_user_id uuid default null, p_evidence_required boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch51_service_role_required();
  insert into public.live_pilot_workflow_steps(workflow_run_id, step_order, step_key, step_label, responsible_role, responsible_user_id, evidence_required)
  values (p_workflow_run_id, coalesce(p_step_order, 1), p_step_key, p_step_label, p_responsible_role, p_responsible_user_id, coalesce(p_evidence_required, true))
  returning id into v_id;
  perform public.record_live_pilot_workflow_event(p_workflow_run_id, v_id, 'workflow_step_created', 'Live pilot workflow step created: ' || p_step_label, p_responsible_user_id, null);
  return v_id;
end;
$$;

create or replace function public.update_live_pilot_workflow_step_status(p_workflow_step_id uuid, p_step_status text, p_evidence_reference text default null, p_issue_summary text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_run_id uuid; v_step_label text; v_evidence_required boolean;
begin
  perform public.patch51_service_role_required();
  select workflow_run_id, step_label, evidence_required into v_run_id, v_step_label, v_evidence_required from public.live_pilot_workflow_steps where id = p_workflow_step_id;
  if not found then raise exception 'Live pilot workflow step not found: %', p_workflow_step_id; end if;
  if p_step_status in ('passed', 'passed_with_limitation') and v_evidence_required and nullif(coalesce(p_evidence_reference, ''), '') is null then raise exception 'Evidence reference is required before marking a workflow step passed.'; end if;
  if p_step_status in ('failed', 'blocked') and nullif(coalesce(p_issue_summary, ''), '') is null then raise exception 'Issue summary is required for failed or blocked workflow steps.'; end if;
  update public.live_pilot_workflow_steps
  set step_status = p_step_status, evidence_reference = coalesce(p_evidence_reference, evidence_reference), issue_summary = coalesce(p_issue_summary, issue_summary), completed_at = case when p_step_status in ('passed', 'passed_with_limitation', 'failed', 'blocked', 'not_applicable') then now() else completed_at end
  where id = p_workflow_step_id;
  perform public.record_live_pilot_workflow_event(v_run_id, p_workflow_step_id, 'workflow_step_status_updated', 'Live pilot workflow step updated to ' || p_step_status || ': ' || v_step_label, p_actor_user_id, p_evidence_reference);
  return p_workflow_step_id;
end;
$$;

create or replace function public.create_live_pilot_evidence_capture(p_workflow_run_id uuid, p_workflow_step_id uuid, p_evidence_type text, p_evidence_title text, p_evidence_reference text default null, p_captured_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch51_service_role_required();
  insert into public.live_pilot_evidence_captures(workflow_run_id, workflow_step_id, evidence_type, evidence_title, evidence_reference, captured_by)
  values (p_workflow_run_id, p_workflow_step_id, p_evidence_type, p_evidence_title, p_evidence_reference, p_captured_by)
  returning id into v_id;
  perform public.record_live_pilot_workflow_event(p_workflow_run_id, p_workflow_step_id, 'evidence_captured', 'Live pilot evidence captured: ' || p_evidence_title, p_captured_by, p_evidence_reference);
  return v_id;
end;
$$;

create or replace function public.update_live_pilot_evidence_capture_status(p_evidence_capture_id uuid, p_evidence_status text, p_review_notes text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_run_id uuid; v_step_id uuid; v_title text;
begin
  perform public.patch51_service_role_required();
  if p_evidence_status in ('rejected', 'needs_review') and nullif(coalesce(p_review_notes, ''), '') is null then raise exception 'Review notes are required for rejected or review-needed evidence.'; end if;
  update public.live_pilot_evidence_captures
  set evidence_status = p_evidence_status, review_notes = coalesce(p_review_notes, review_notes)
  where id = p_evidence_capture_id
  returning workflow_run_id, workflow_step_id, evidence_title into v_run_id, v_step_id, v_title;
  if not found then raise exception 'Live pilot evidence capture not found: %', p_evidence_capture_id; end if;
  perform public.record_live_pilot_workflow_event(v_run_id, v_step_id, 'evidence_status_updated', 'Live pilot evidence status updated to ' || p_evidence_status || ': ' || v_title, p_actor_user_id, null);
  return p_evidence_capture_id;
end;
$$;

create or replace function public.create_live_pilot_execution_issue(p_workflow_run_id uuid, p_workflow_step_id uuid, p_issue_type text, p_severity text, p_issue_summary text, p_assigned_to uuid default null, p_due_at timestamptz default null, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.patch51_service_role_required();
  insert into public.live_pilot_execution_issues(workflow_run_id, workflow_step_id, issue_type, severity, issue_summary, assigned_to, due_at, created_by)
  values (p_workflow_run_id, p_workflow_step_id, p_issue_type, coalesce(nullif(p_severity, ''), 'medium'), p_issue_summary, p_assigned_to, p_due_at, p_created_by)
  returning id into v_id;
  perform public.record_live_pilot_workflow_event(p_workflow_run_id, p_workflow_step_id, 'execution_issue_created', 'Live pilot execution issue created: ' || p_issue_type, p_created_by, null);
  return v_id;
end;
$$;

create or replace function public.update_live_pilot_execution_issue_status(p_issue_id uuid, p_issue_status text, p_resolution_summary text default null, p_evidence_reference text default null, p_actor_user_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_run_id uuid; v_step_id uuid; v_issue_type text;
begin
  perform public.patch51_service_role_required();
  if p_issue_status in ('resolved', 'accepted_with_limitation') and nullif(coalesce(p_resolution_summary, ''), '') is null then raise exception 'Resolution summary is required before closing a live pilot execution issue.'; end if;
  update public.live_pilot_execution_issues
  set issue_status = p_issue_status, resolution_summary = coalesce(p_resolution_summary, resolution_summary), evidence_reference = coalesce(p_evidence_reference, evidence_reference), updated_at = now()
  where id = p_issue_id
  returning workflow_run_id, workflow_step_id, issue_type into v_run_id, v_step_id, v_issue_type;
  if not found then raise exception 'Live pilot execution issue not found: %', p_issue_id; end if;
  perform public.record_live_pilot_workflow_event(v_run_id, v_step_id, 'execution_issue_status_updated', 'Live pilot execution issue updated to ' || p_issue_status || ': ' || v_issue_type, p_actor_user_id, p_evidence_reference);
  return p_issue_id;
end;
$$;

create or replace function public.get_live_pilot_workflow_summary() returns jsonb language sql security invoker set search_path = public as $$
  select coalesce((select to_jsonb(v) from public.v_patch51_live_pilot_workflow_summary v limit 1), '{}'::jsonb);
$$;

create or replace function public.get_production_readiness_live_pilot_execution_overlay() returns jsonb language sql security invoker set search_path = public as $$
  select coalesce((select to_jsonb(v) from public.v_patch51_production_readiness_live_pilot_execution_overlay v limit 1), '{}'::jsonb);
$$;

revoke all on function public.patch51_service_role_required() from public, anon, authenticated;
revoke all on function public.record_live_pilot_workflow_event(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_live_pilot_workflow_run(uuid, text, text, uuid, uuid, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.update_live_pilot_workflow_run_status(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_live_pilot_workflow_step(uuid, integer, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.update_live_pilot_workflow_step_status(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_live_pilot_evidence_capture(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.update_live_pilot_evidence_capture_status(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_live_pilot_execution_issue(uuid, uuid, text, text, text, uuid, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.update_live_pilot_execution_issue_status(uuid, text, text, text, uuid) from public, anon, authenticated;

grant execute on function public.patch51_service_role_required() to service_role;
grant execute on function public.record_live_pilot_workflow_event(uuid, uuid, text, text, uuid, text) to service_role;
grant execute on function public.create_live_pilot_workflow_run(uuid, text, text, uuid, uuid, timestamptz, uuid) to service_role;
grant execute on function public.update_live_pilot_workflow_run_status(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.create_live_pilot_workflow_step(uuid, integer, text, text, text, uuid, boolean) to service_role;
grant execute on function public.update_live_pilot_workflow_step_status(uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_live_pilot_evidence_capture(uuid, uuid, text, text, text, uuid) to service_role;
grant execute on function public.update_live_pilot_evidence_capture_status(uuid, text, text, uuid) to service_role;
grant execute on function public.create_live_pilot_execution_issue(uuid, uuid, text, text, text, uuid, timestamptz, uuid) to service_role;
grant execute on function public.update_live_pilot_execution_issue_status(uuid, text, text, text, uuid) to service_role;
grant execute on function public.get_live_pilot_workflow_summary() to authenticated;
grant execute on function public.get_production_readiness_live_pilot_execution_overlay() to authenticated;

comment on table public.live_pilot_workflow_runs is 'Patch 51 live pilot workflow walkthrough register.';
comment on table public.live_pilot_workflow_steps is 'Patch 51 live pilot workflow step evidence and status register.';
comment on table public.live_pilot_evidence_captures is 'Patch 51 captured evidence register for live pilot walkthroughs.';
comment on table public.live_pilot_execution_issues is 'Patch 51 live pilot execution issues and blockers.';
comment on table public.live_pilot_workflow_events is 'Patch 51 live pilot workflow event history.';
