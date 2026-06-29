-- Patch 13: UAT & Accreditation Evidence Pack
-- Purpose: turn framework-level UAT into real role scenario scripts, evidence capture, retest history, signoffs, and accreditation evidence readiness.
-- Scope: scenario scripts, scenario steps, screenshot/SQL proof, failed scenario tracking, retests, readiness scores, accreditation evidence pack matrix.
-- Important: no demo data and no copyrighted accreditation standard text is loaded by this migration.

create extension if not exists pgcrypto;

create table if not exists public.patch13_role_scenario_scripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  scenario_code text not null,
  scenario_title text not null,
  role_key text not null,
  persona_name text,
  module_key text not null,
  accreditation_domain text,
  scenario_status text not null default 'draft'
    check (scenario_status in ('draft', 'ready_for_execution', 'in_progress', 'passed', 'failed', 'blocked', 'retired')),
  risk_level text not null default 'normal'
    check (risk_level in ('critical', 'high', 'normal', 'low')),
  expected_result text,
  owner_id uuid,
  owner_name text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, scenario_code)
);

create table if not exists public.patch13_scenario_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  scenario_id uuid not null references public.patch13_role_scenario_scripts(id) on delete cascade,
  step_number integer not null,
  step_title text not null,
  step_instruction text not null,
  expected_result text,
  evidence_required boolean not null default true,
  sql_proof_required boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, scenario_id, step_number)
);

create table if not exists public.patch13_evidence_captures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  scenario_id uuid references public.patch13_role_scenario_scripts(id) on delete cascade,
  step_id uuid references public.patch13_scenario_steps(id) on delete set null,
  evidence_type text not null default 'screenshot'
    check (evidence_type in ('screenshot', 'screen_recording', 'sql_output', 'export_file', 'approval_record', 'signed_document', 'observation_note')),
  evidence_title text not null,
  evidence_url text,
  evidence_hash text,
  captured_by uuid,
  captured_by_name text,
  captured_at timestamptz not null default now(),
  review_status text not null default 'submitted'
    check (review_status in ('submitted', 'accepted', 'rejected', 'needs_retake', 'expired')),
  reviewer_id uuid,
  reviewer_name text,
  reviewed_at timestamptz,
  review_notes text
);

create table if not exists public.patch13_sql_proof_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  scenario_id uuid references public.patch13_role_scenario_scripts(id) on delete cascade,
  proof_code text not null,
  proof_title text not null,
  sql_file_path text,
  execution_environment text not null default 'local'
    check (execution_environment in ('local', 'staging', 'production_read_only')),
  execution_status text not null default 'not_run'
    check (execution_status in ('not_run', 'passed', 'failed', 'blocked', 'review_required')),
  output_artifact_url text,
  blocking_count integer not null default 0,
  executed_by uuid,
  executed_by_name text,
  executed_at timestamptz,
  reviewer_id uuid,
  reviewer_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.patch13_signoff_status (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  signoff_code text not null,
  signoff_scope text not null
    check (signoff_scope in ('quality', 'risk', 'compliance', 'audit', 'it', 'executive', 'department', 'external_auditor', 'board')),
  signoff_title text not null,
  required_role text,
  signer_id uuid,
  signer_name text,
  signoff_status text not null default 'pending'
    check (signoff_status in ('pending', 'signed', 'rejected', 'deferred', 'not_required')),
  signed_at timestamptz,
  rejection_reason text,
  evidence_capture_id uuid references public.patch13_evidence_captures(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, signoff_code)
);

create table if not exists public.patch13_failed_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  scenario_id uuid not null references public.patch13_role_scenario_scripts(id) on delete cascade,
  failure_code text not null,
  failure_title text not null,
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  failure_status text not null default 'open'
    check (failure_status in ('open', 'assigned', 'fixed_pending_retest', 'retested_passed', 'accepted_risk', 'closed')),
  root_cause text,
  owner_id uuid,
  owner_name text,
  due_date date,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (organization_id, failure_code)
);

create table if not exists public.patch13_retest_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  failed_scenario_id uuid not null references public.patch13_failed_scenarios(id) on delete cascade,
  retest_round integer not null default 1,
  retest_status text not null default 'not_started'
    check (retest_status in ('not_started', 'passed', 'failed', 'blocked', 'review_required')),
  retest_notes text,
  evidence_capture_id uuid references public.patch13_evidence_captures(id) on delete set null,
  retested_by uuid,
  retested_by_name text,
  retested_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, failed_scenario_id, retest_round)
);

create table if not exists public.patch13_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  score_scope text not null
    check (score_scope in ('overall', 'module', 'role', 'department', 'accreditation_domain')),
  scope_key text not null,
  readiness_score numeric(5,2) not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  passed_scenarios integer not null default 0,
  failed_scenarios integer not null default 0,
  pending_signoffs integer not null default 0,
  evidence_gaps integer not null default 0,
  score_status text not null default 'draft'
    check (score_status in ('draft', 'review_required', 'approved', 'not_ready')),
  generated_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  unique (organization_id, score_scope, scope_key, generated_at)
);

create table if not exists public.patch13_accreditation_evidence_pack_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pack_code text not null,
  framework_code text not null,
  requirement_reference text,
  measurable_element_reference text,
  department_name text,
  evidence_title text not null,
  evidence_type text not null default 'document'
    check (evidence_type in ('policy', 'procedure', 'record', 'indicator', 'tracer', 'committee_minutes', 'training', 'audit', 'risk_assessment', 'system_screenshot', 'other')),
  evidence_status text not null default 'needed'
    check (evidence_status in ('needed', 'submitted', 'accepted', 'rejected', 'expired', 'not_applicable')),
  owner_id uuid,
  owner_name text,
  due_date date,
  evidence_capture_id uuid references public.patch13_evidence_captures(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, pack_code)
);

create table if not exists public.patch13_accreditation_survey_evidence_matrix (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  survey_cycle_code text not null,
  department_name text,
  framework_code text not null,
  requirement_reference text,
  readiness_status text not null default 'not_started'
    check (readiness_status in ('not_started', 'in_progress', 'ready', 'gap_open', 'not_applicable', 'approved')),
  evidence_pack_item_id uuid references public.patch13_accreditation_evidence_pack_items(id) on delete set null,
  last_reviewed_by uuid,
  last_reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_p13_scenarios_org_status on public.patch13_role_scenario_scripts(organization_id, scenario_status, role_key, module_key);
create index if not exists idx_p13_steps_scenario on public.patch13_scenario_steps(scenario_id, step_number);
create index if not exists idx_p13_evidence_org_status on public.patch13_evidence_captures(organization_id, review_status, evidence_type);
create index if not exists idx_p13_sql_org_status on public.patch13_sql_proof_runs(organization_id, execution_status, execution_environment);
create index if not exists idx_p13_signoff_org_status on public.patch13_signoff_status(organization_id, signoff_status, signoff_scope, due_date);
create index if not exists idx_p13_failed_org_status on public.patch13_failed_scenarios(organization_id, failure_status, severity, due_date);
create index if not exists idx_p13_retest_failed on public.patch13_retest_history(failed_scenario_id, retest_round);
create index if not exists idx_p13_scores_org_scope on public.patch13_readiness_scores(organization_id, score_scope, scope_key, generated_at desc);
create index if not exists idx_p13_pack_org_status on public.patch13_accreditation_evidence_pack_items(organization_id, evidence_status, framework_code, department_name);
create index if not exists idx_p13_matrix_org_status on public.patch13_accreditation_survey_evidence_matrix(organization_id, readiness_status, framework_code, department_name);

alter table public.patch13_role_scenario_scripts enable row level security;
alter table public.patch13_scenario_steps enable row level security;
alter table public.patch13_evidence_captures enable row level security;
alter table public.patch13_sql_proof_runs enable row level security;
alter table public.patch13_signoff_status enable row level security;
alter table public.patch13_failed_scenarios enable row level security;
alter table public.patch13_retest_history enable row level security;
alter table public.patch13_readiness_scores enable row level security;
alter table public.patch13_accreditation_evidence_pack_items enable row level security;
alter table public.patch13_accreditation_survey_evidence_matrix enable row level security;

-- Explicit org-scoped RLS policies for static audit visibility.
drop policy if exists patch13_role_scenario_scripts_org_read on public.patch13_role_scenario_scripts;
create policy patch13_role_scenario_scripts_org_read on public.patch13_role_scenario_scripts for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_role_scenario_scripts_org_insert on public.patch13_role_scenario_scripts;
create policy patch13_role_scenario_scripts_org_insert on public.patch13_role_scenario_scripts for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_role_scenario_scripts_org_update on public.patch13_role_scenario_scripts;
create policy patch13_role_scenario_scripts_org_update on public.patch13_role_scenario_scripts for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch13_scenario_steps_org_read on public.patch13_scenario_steps;
create policy patch13_scenario_steps_org_read on public.patch13_scenario_steps for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_scenario_steps_org_insert on public.patch13_scenario_steps;
create policy patch13_scenario_steps_org_insert on public.patch13_scenario_steps for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_scenario_steps_org_update on public.patch13_scenario_steps;
create policy patch13_scenario_steps_org_update on public.patch13_scenario_steps for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch13_evidence_captures_org_read on public.patch13_evidence_captures;
create policy patch13_evidence_captures_org_read on public.patch13_evidence_captures for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_evidence_captures_org_insert on public.patch13_evidence_captures;
create policy patch13_evidence_captures_org_insert on public.patch13_evidence_captures for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_evidence_captures_org_update on public.patch13_evidence_captures;
create policy patch13_evidence_captures_org_update on public.patch13_evidence_captures for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch13_sql_proof_runs_org_read on public.patch13_sql_proof_runs;
create policy patch13_sql_proof_runs_org_read on public.patch13_sql_proof_runs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_sql_proof_runs_org_insert on public.patch13_sql_proof_runs;
create policy patch13_sql_proof_runs_org_insert on public.patch13_sql_proof_runs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_sql_proof_runs_org_update on public.patch13_sql_proof_runs;
create policy patch13_sql_proof_runs_org_update on public.patch13_sql_proof_runs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch13_signoff_status_org_read on public.patch13_signoff_status;
create policy patch13_signoff_status_org_read on public.patch13_signoff_status for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_signoff_status_org_insert on public.patch13_signoff_status;
create policy patch13_signoff_status_org_insert on public.patch13_signoff_status for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_signoff_status_org_update on public.patch13_signoff_status;
create policy patch13_signoff_status_org_update on public.patch13_signoff_status for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch13_failed_scenarios_org_read on public.patch13_failed_scenarios;
create policy patch13_failed_scenarios_org_read on public.patch13_failed_scenarios for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_failed_scenarios_org_insert on public.patch13_failed_scenarios;
create policy patch13_failed_scenarios_org_insert on public.patch13_failed_scenarios for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_failed_scenarios_org_update on public.patch13_failed_scenarios;
create policy patch13_failed_scenarios_org_update on public.patch13_failed_scenarios for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch13_retest_history_org_read on public.patch13_retest_history;
create policy patch13_retest_history_org_read on public.patch13_retest_history for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_retest_history_org_insert on public.patch13_retest_history;
create policy patch13_retest_history_org_insert on public.patch13_retest_history for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_retest_history_org_update on public.patch13_retest_history;
create policy patch13_retest_history_org_update on public.patch13_retest_history for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch13_readiness_scores_org_read on public.patch13_readiness_scores;
create policy patch13_readiness_scores_org_read on public.patch13_readiness_scores for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_readiness_scores_org_insert on public.patch13_readiness_scores;
create policy patch13_readiness_scores_org_insert on public.patch13_readiness_scores for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_readiness_scores_org_update on public.patch13_readiness_scores;
create policy patch13_readiness_scores_org_update on public.patch13_readiness_scores for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch13_accreditation_evidence_pack_items_org_read on public.patch13_accreditation_evidence_pack_items;
create policy patch13_accreditation_evidence_pack_items_org_read on public.patch13_accreditation_evidence_pack_items for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_accreditation_evidence_pack_items_org_insert on public.patch13_accreditation_evidence_pack_items;
create policy patch13_accreditation_evidence_pack_items_org_insert on public.patch13_accreditation_evidence_pack_items for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_accreditation_evidence_pack_items_org_update on public.patch13_accreditation_evidence_pack_items;
create policy patch13_accreditation_evidence_pack_items_org_update on public.patch13_accreditation_evidence_pack_items for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch13_accreditation_survey_evidence_matrix_org_read on public.patch13_accreditation_survey_evidence_matrix;
create policy patch13_accreditation_survey_evidence_matrix_org_read on public.patch13_accreditation_survey_evidence_matrix for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_accreditation_survey_evidence_matrix_org_insert on public.patch13_accreditation_survey_evidence_matrix;
create policy patch13_accreditation_survey_evidence_matrix_org_insert on public.patch13_accreditation_survey_evidence_matrix for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch13_accreditation_survey_evidence_matrix_org_update on public.patch13_accreditation_survey_evidence_matrix;
create policy patch13_accreditation_survey_evidence_matrix_org_update on public.patch13_accreditation_survey_evidence_matrix for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_patch13_uat_evidence_summary
with (security_invoker = true) as
select
  s.organization_id,
  count(distinct s.id)::integer as scenario_count,
  count(distinct s.id) filter (where s.scenario_status = 'passed')::integer as passed_scenario_count,
  count(distinct s.id) filter (where s.scenario_status in ('failed', 'blocked'))::integer as failed_or_blocked_scenario_count,
  count(distinct e.id)::integer as evidence_capture_count,
  count(distinct e.id) filter (where e.review_status = 'accepted')::integer as accepted_evidence_count,
  count(distinct f.id) filter (where f.failure_status not in ('closed', 'retested_passed', 'accepted_risk'))::integer as open_failure_count,
  count(distinct sig.id) filter (where sig.signoff_status = 'pending')::integer as pending_signoff_count,
  avg(r.readiness_score)::numeric(5,2) as average_readiness_score
from public.patch13_role_scenario_scripts s
left join public.patch13_evidence_captures e on e.scenario_id = s.id
left join public.patch13_failed_scenarios f on f.scenario_id = s.id
left join public.patch13_signoff_status sig on sig.organization_id = s.organization_id
left join public.patch13_readiness_scores r on r.organization_id = s.organization_id
group by s.organization_id;

create or replace view public.v_patch13_role_scenario_queue
with (security_invoker = true) as
select
  s.organization_id,
  s.scenario_code,
  s.scenario_title,
  s.role_key,
  s.module_key,
  s.accreditation_domain,
  s.scenario_status,
  s.risk_level,
  s.owner_name,
  count(distinct st.id)::integer as step_count,
  count(distinct e.id)::integer as evidence_count,
  count(distinct f.id) filter (where f.failure_status not in ('closed', 'retested_passed', 'accepted_risk'))::integer as open_failure_count,
  case
    when s.scenario_status in ('failed', 'blocked') then 'danger'
    when count(distinct f.id) filter (where f.failure_status not in ('closed', 'retested_passed', 'accepted_risk')) > 0 then 'warning'
    when s.scenario_status = 'passed' then 'ready'
    else 'normal'
  end as queue_signal
from public.patch13_role_scenario_scripts s
left join public.patch13_scenario_steps st on st.scenario_id = s.id
left join public.patch13_evidence_captures e on e.scenario_id = s.id
left join public.patch13_failed_scenarios f on f.scenario_id = s.id
group by s.organization_id, s.scenario_code, s.scenario_title, s.role_key, s.module_key, s.accreditation_domain, s.scenario_status, s.risk_level, s.owner_name;

create or replace view public.v_patch13_evidence_pack_readiness
with (security_invoker = true) as
select
  p.organization_id,
  p.framework_code,
  p.department_name,
  count(*)::integer as evidence_item_count,
  count(*) filter (where p.evidence_status = 'accepted')::integer as accepted_count,
  count(*) filter (where p.evidence_status in ('needed', 'rejected', 'expired'))::integer as gap_count,
  min(p.due_date) filter (where p.evidence_status in ('needed', 'rejected', 'expired')) as nearest_gap_due_date,
  case
    when count(*) filter (where p.evidence_status in ('needed', 'rejected', 'expired')) > 0 then 'gap_open'
    when count(*) filter (where p.evidence_status = 'accepted') = count(*) then 'ready'
    else 'in_progress'
  end as readiness_signal
from public.patch13_accreditation_evidence_pack_items p
group by p.organization_id, p.framework_code, p.department_name;

create or replace view public.v_patch13_failed_retest_queue
with (security_invoker = true) as
select
  f.organization_id,
  f.failure_code,
  f.failure_title,
  f.severity,
  f.failure_status,
  f.owner_name,
  f.due_date,
  s.scenario_code,
  s.scenario_title,
  max(r.retest_round) as latest_retest_round,
  max(r.retested_at) as latest_retest_at,
  case
    when f.severity in ('critical', 'high') and f.failure_status not in ('closed', 'retested_passed', 'accepted_risk') then 'danger'
    when f.due_date is not null and f.due_date < current_date and f.failure_status not in ('closed', 'retested_passed', 'accepted_risk') then 'overdue'
    when f.failure_status = 'fixed_pending_retest' then 'retest_ready'
    else 'normal'
  end as queue_signal
from public.patch13_failed_scenarios f
join public.patch13_role_scenario_scripts s on s.id = f.scenario_id
left join public.patch13_retest_history r on r.failed_scenario_id = f.id
group by f.organization_id, f.failure_code, f.failure_title, f.severity, f.failure_status, f.owner_name, f.due_date, s.scenario_code, s.scenario_title;

comment on table public.patch13_role_scenario_scripts is 'Patch 13 role-based UAT and accreditation scenario scripts for real users and real hospital workflows.';
comment on table public.patch13_evidence_captures is 'Patch 13 screenshot, SQL, export, approval, and signed-document evidence capture records.';
comment on table public.patch13_accreditation_evidence_pack_items is 'Patch 13 accreditation evidence pack items mapped to licensed standards metadata without embedding copyrighted text.';
