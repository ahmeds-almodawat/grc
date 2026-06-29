-- Patch 17: Real UAT Execution & Accreditation Evidence Pack
-- Purpose: move from UAT framework to controlled real execution evidence, persona proof, retests, signoffs, and accreditation pack readiness.
-- Important: this patch creates governance structures only. It does not seed fake UAT runs, screenshots, SQL outputs, signoffs, or copyrighted standards text.

create extension if not exists pgcrypto;

create table if not exists public.real_uat_execution_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_code text not null,
  cycle_name text not null,
  cycle_scope text not null default 'accreditation_readiness'
    check (cycle_scope in ('accreditation_readiness', 'production_launch', 'module_acceptance', 'security_persona', 'data_cutover', 'external_auditor')),
  cycle_status text not null default 'draft'
    check (cycle_status in ('draft', 'planned', 'in_progress', 'evidence_review', 'retest', 'accepted', 'rejected', 'closed')),
  environment_name text not null default 'staging',
  start_date date,
  target_finish_date date,
  uat_manager_id uuid,
  uat_manager_name text,
  evidence_pack_url text,
  readiness_score numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cycle_code)
);

create table if not exists public.real_uat_execution_personas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  persona_code text not null,
  persona_name text not null,
  persona_group text not null
    check (persona_group in ('executive', 'quality', 'risk', 'compliance', 'audit', 'it', 'department_manager', 'employee', 'external_auditor', 'board')),
  role_name text,
  access_boundary text,
  expected_modules text[] not null default '{}',
  is_external boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, persona_code)
);

create table if not exists public.real_uat_execution_scripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid references public.real_uat_execution_cycles(id) on delete cascade,
  persona_id uuid references public.real_uat_execution_personas(id) on delete set null,
  script_code text not null,
  script_title text not null,
  module_key text not null,
  scenario_type text not null default 'happy_path'
    check (scenario_type in ('happy_path', 'negative_permission', 'evidence_submission', 'approval', 'retest', 'reporting', 'data_validation', 'external_read_only')),
  expected_outcome text,
  business_owner_name text,
  test_priority text not null default 'normal'
    check (test_priority in ('critical', 'high', 'normal', 'low')),
  script_status text not null default 'draft'
    check (script_status in ('draft', 'ready', 'in_execution', 'passed', 'failed', 'blocked', 'waived', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, script_code)
);

create table if not exists public.real_uat_execution_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  script_id uuid not null references public.real_uat_execution_scripts(id) on delete cascade,
  step_number integer not null default 1,
  step_title text not null,
  step_instruction text,
  expected_result text,
  requires_screenshot boolean not null default true,
  requires_sql_proof boolean not null default false,
  requires_signoff boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, script_id, step_number)
);

create table if not exists public.real_uat_execution_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null references public.real_uat_execution_cycles(id) on delete cascade,
  script_id uuid not null references public.real_uat_execution_scripts(id) on delete cascade,
  persona_id uuid references public.real_uat_execution_personas(id) on delete set null,
  run_code text not null,
  run_status text not null default 'not_started'
    check (run_status in ('not_started', 'in_progress', 'passed', 'failed', 'blocked', 'retest_required', 'accepted_with_exception', 'cancelled')),
  executed_by_id uuid,
  executed_by_name text,
  execution_started_at timestamptz,
  execution_finished_at timestamptz,
  evidence_reviewer_id uuid,
  evidence_reviewer_name text,
  evidence_review_status text not null default 'pending'
    check (evidence_review_status in ('pending', 'in_review', 'accepted', 'rejected', 'needs_more_evidence')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, run_code)
);

create table if not exists public.real_uat_execution_step_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  run_id uuid not null references public.real_uat_execution_runs(id) on delete cascade,
  step_id uuid references public.real_uat_execution_steps(id) on delete set null,
  result_status text not null default 'pending'
    check (result_status in ('pending', 'passed', 'failed', 'blocked', 'not_applicable', 'needs_retest')),
  actual_result text,
  screenshot_count integer not null default 0,
  sql_proof_count integer not null default 0,
  evidence_gap text,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_uat_execution_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  run_id uuid not null references public.real_uat_execution_runs(id) on delete cascade,
  step_result_id uuid references public.real_uat_execution_step_results(id) on delete set null,
  artifact_type text not null default 'screenshot'
    check (artifact_type in ('screenshot', 'screen_recording', 'sql_output', 'export_file', 'signed_pdf', 'email_approval', 'meeting_minutes', 'other')),
  artifact_title text not null,
  artifact_url text,
  artifact_hash text,
  captured_by_name text,
  captured_at timestamptz not null default now(),
  evidence_status text not null default 'submitted'
    check (evidence_status in ('submitted', 'accepted', 'rejected', 'needs_replacement', 'expired')),
  reviewer_name text,
  review_notes text,
  reviewed_at timestamptz
);

create table if not exists public.real_uat_execution_sql_proofs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid references public.real_uat_execution_cycles(id) on delete cascade,
  run_id uuid references public.real_uat_execution_runs(id) on delete cascade,
  proof_code text not null,
  proof_title text not null,
  proof_scope text not null default 'persona_sql'
    check (proof_scope in ('persona_sql', 'rls_boundary', 'staging_state', 'evidence_count', 'workflow_state', 'restore_check', 'data_reconciliation')),
  command_or_query_summary text,
  output_hash text,
  output_url text,
  proof_status text not null default 'pending'
    check (proof_status in ('pending', 'passed', 'failed', 'blocked', 'waived')),
  executed_by_name text,
  executed_at timestamptz,
  reviewed_by_name text,
  reviewed_at timestamptz,
  unique (organization_id, proof_code)
);

create table if not exists public.real_uat_execution_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid references public.real_uat_execution_cycles(id) on delete cascade,
  run_id uuid references public.real_uat_execution_runs(id) on delete set null,
  finding_code text not null,
  finding_title text not null,
  finding_description text,
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  finding_status text not null default 'open'
    check (finding_status in ('open', 'assigned', 'fixed', 'ready_for_retest', 'retest_failed', 'accepted', 'waived', 'closed')),
  owner_id uuid,
  owner_name text,
  due_date date,
  root_cause text,
  corrective_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, finding_code)
);

create table if not exists public.real_uat_execution_retests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  finding_id uuid not null references public.real_uat_execution_findings(id) on delete cascade,
  run_id uuid references public.real_uat_execution_runs(id) on delete set null,
  retest_code text not null,
  retest_status text not null default 'planned'
    check (retest_status in ('planned', 'in_progress', 'passed', 'failed', 'blocked', 'cancelled')),
  retested_by_name text,
  retested_at timestamptz,
  evidence_url text,
  retest_notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, retest_code)
);

create table if not exists public.real_uat_execution_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null references public.real_uat_execution_cycles(id) on delete cascade,
  signoff_area text not null
    check (signoff_area in ('executive', 'quality', 'risk', 'compliance', 'audit', 'it', 'department_manager', 'employee_rep', 'external_auditor', 'board')),
  signer_id uuid,
  signer_name text,
  signer_title text,
  signoff_status text not null default 'pending'
    check (signoff_status in ('pending', 'conditional', 'signed', 'rejected', 'withdrawn')),
  condition_notes text,
  signed_at timestamptz,
  evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cycle_id, signoff_area)
);

create table if not exists public.real_uat_accreditation_evidence_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid references public.real_uat_execution_cycles(id) on delete cascade,
  pack_code text not null,
  pack_title text not null,
  accreditation_scope text not null default 'hospital'
    check (accreditation_scope in ('hospital', 'quality', 'patient_safety', 'governance', 'risk', 'compliance', 'audit', 'it_security')),
  pack_status text not null default 'draft'
    check (pack_status in ('draft', 'collecting', 'review_ready', 'accepted', 'rejected', 'archived')),
  required_artifact_count integer not null default 0,
  accepted_artifact_count integer not null default 0,
  open_gap_count integer not null default 0,
  owner_name text,
  target_review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, pack_code)
);

create index if not exists idx_real_uat_cycles_org_status on public.real_uat_execution_cycles(organization_id, cycle_status, target_finish_date);
create index if not exists idx_real_uat_scripts_org_module on public.real_uat_execution_scripts(organization_id, module_key, script_status);
create index if not exists idx_real_uat_runs_org_status on public.real_uat_execution_runs(organization_id, run_status, evidence_review_status);
create index if not exists idx_real_uat_step_results_run on public.real_uat_execution_step_results(run_id, result_status);
create index if not exists idx_real_uat_evidence_org_status on public.real_uat_execution_evidence(organization_id, evidence_status, artifact_type);
create index if not exists idx_real_uat_sql_proofs_org_status on public.real_uat_execution_sql_proofs(organization_id, proof_status, proof_scope);
create index if not exists idx_real_uat_findings_org_status on public.real_uat_execution_findings(organization_id, finding_status, severity, due_date);
create index if not exists idx_real_uat_retests_org_status on public.real_uat_execution_retests(organization_id, retest_status);
create index if not exists idx_real_uat_signoffs_org_status on public.real_uat_execution_signoffs(organization_id, signoff_status, signoff_area);
create index if not exists idx_real_uat_packs_org_status on public.real_uat_accreditation_evidence_packages(organization_id, pack_status, accreditation_scope);

alter table public.real_uat_execution_cycles enable row level security;
alter table public.real_uat_execution_personas enable row level security;
alter table public.real_uat_execution_scripts enable row level security;
alter table public.real_uat_execution_steps enable row level security;
alter table public.real_uat_execution_runs enable row level security;
alter table public.real_uat_execution_step_results enable row level security;
alter table public.real_uat_execution_evidence enable row level security;
alter table public.real_uat_execution_sql_proofs enable row level security;
alter table public.real_uat_execution_findings enable row level security;
alter table public.real_uat_execution_retests enable row level security;
alter table public.real_uat_execution_signoffs enable row level security;
alter table public.real_uat_accreditation_evidence_packages enable row level security;

drop policy if exists real_uat_execution_cycles_org_read on public.real_uat_execution_cycles;
create policy real_uat_execution_cycles_org_read on public.real_uat_execution_cycles for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_cycles_org_insert on public.real_uat_execution_cycles;
create policy real_uat_execution_cycles_org_insert on public.real_uat_execution_cycles for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_cycles_org_update on public.real_uat_execution_cycles;
create policy real_uat_execution_cycles_org_update on public.real_uat_execution_cycles for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_execution_personas_org_read on public.real_uat_execution_personas;
create policy real_uat_execution_personas_org_read on public.real_uat_execution_personas for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_personas_org_insert on public.real_uat_execution_personas;
create policy real_uat_execution_personas_org_insert on public.real_uat_execution_personas for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_personas_org_update on public.real_uat_execution_personas;
create policy real_uat_execution_personas_org_update on public.real_uat_execution_personas for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_execution_scripts_org_read on public.real_uat_execution_scripts;
create policy real_uat_execution_scripts_org_read on public.real_uat_execution_scripts for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_scripts_org_insert on public.real_uat_execution_scripts;
create policy real_uat_execution_scripts_org_insert on public.real_uat_execution_scripts for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_scripts_org_update on public.real_uat_execution_scripts;
create policy real_uat_execution_scripts_org_update on public.real_uat_execution_scripts for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_execution_steps_org_read on public.real_uat_execution_steps;
create policy real_uat_execution_steps_org_read on public.real_uat_execution_steps for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_steps_org_insert on public.real_uat_execution_steps;
create policy real_uat_execution_steps_org_insert on public.real_uat_execution_steps for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_steps_org_update on public.real_uat_execution_steps;
create policy real_uat_execution_steps_org_update on public.real_uat_execution_steps for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_execution_runs_org_read on public.real_uat_execution_runs;
create policy real_uat_execution_runs_org_read on public.real_uat_execution_runs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_runs_org_insert on public.real_uat_execution_runs;
create policy real_uat_execution_runs_org_insert on public.real_uat_execution_runs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_runs_org_update on public.real_uat_execution_runs;
create policy real_uat_execution_runs_org_update on public.real_uat_execution_runs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_execution_step_results_org_read on public.real_uat_execution_step_results;
create policy real_uat_execution_step_results_org_read on public.real_uat_execution_step_results for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_step_results_org_insert on public.real_uat_execution_step_results;
create policy real_uat_execution_step_results_org_insert on public.real_uat_execution_step_results for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_step_results_org_update on public.real_uat_execution_step_results;
create policy real_uat_execution_step_results_org_update on public.real_uat_execution_step_results for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_execution_evidence_org_read on public.real_uat_execution_evidence;
create policy real_uat_execution_evidence_org_read on public.real_uat_execution_evidence for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_evidence_org_insert on public.real_uat_execution_evidence;
create policy real_uat_execution_evidence_org_insert on public.real_uat_execution_evidence for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_evidence_org_update on public.real_uat_execution_evidence;
create policy real_uat_execution_evidence_org_update on public.real_uat_execution_evidence for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_execution_sql_proofs_org_read on public.real_uat_execution_sql_proofs;
create policy real_uat_execution_sql_proofs_org_read on public.real_uat_execution_sql_proofs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_sql_proofs_org_insert on public.real_uat_execution_sql_proofs;
create policy real_uat_execution_sql_proofs_org_insert on public.real_uat_execution_sql_proofs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_sql_proofs_org_update on public.real_uat_execution_sql_proofs;
create policy real_uat_execution_sql_proofs_org_update on public.real_uat_execution_sql_proofs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_execution_findings_org_read on public.real_uat_execution_findings;
create policy real_uat_execution_findings_org_read on public.real_uat_execution_findings for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_findings_org_insert on public.real_uat_execution_findings;
create policy real_uat_execution_findings_org_insert on public.real_uat_execution_findings for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_findings_org_update on public.real_uat_execution_findings;
create policy real_uat_execution_findings_org_update on public.real_uat_execution_findings for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_execution_retests_org_read on public.real_uat_execution_retests;
create policy real_uat_execution_retests_org_read on public.real_uat_execution_retests for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_retests_org_insert on public.real_uat_execution_retests;
create policy real_uat_execution_retests_org_insert on public.real_uat_execution_retests for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_retests_org_update on public.real_uat_execution_retests;
create policy real_uat_execution_retests_org_update on public.real_uat_execution_retests for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_execution_signoffs_org_read on public.real_uat_execution_signoffs;
create policy real_uat_execution_signoffs_org_read on public.real_uat_execution_signoffs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_signoffs_org_insert on public.real_uat_execution_signoffs;
create policy real_uat_execution_signoffs_org_insert on public.real_uat_execution_signoffs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_execution_signoffs_org_update on public.real_uat_execution_signoffs;
create policy real_uat_execution_signoffs_org_update on public.real_uat_execution_signoffs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_uat_accreditation_evidence_packages_org_read on public.real_uat_accreditation_evidence_packages;
create policy real_uat_accreditation_evidence_packages_org_read on public.real_uat_accreditation_evidence_packages for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_accreditation_evidence_packages_org_insert on public.real_uat_accreditation_evidence_packages;
create policy real_uat_accreditation_evidence_packages_org_insert on public.real_uat_accreditation_evidence_packages for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_uat_accreditation_evidence_packages_org_update on public.real_uat_accreditation_evidence_packages;
create policy real_uat_accreditation_evidence_packages_org_update on public.real_uat_accreditation_evidence_packages for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));


create or replace view public.v_real_uat_execution_summary
with (security_invoker = true) as
select
  c.organization_id,
  count(distinct c.id)::integer as cycle_count,
  count(distinct c.id) filter (where c.cycle_status in ('planned', 'in_progress', 'evidence_review', 'retest'))::integer as active_cycle_count,
  count(distinct s.id)::integer as script_count,
  count(distinct r.id)::integer as run_count,
  count(distinct r.id) filter (where r.run_status = 'passed')::integer as passed_run_count,
  count(distinct r.id) filter (where r.run_status in ('failed', 'blocked', 'retest_required'))::integer as failed_or_blocked_run_count,
  count(distinct f.id) filter (where f.finding_status not in ('accepted', 'waived', 'closed'))::integer as open_finding_count,
  count(distinct f.id) filter (where f.severity in ('critical', 'high') and f.finding_status not in ('accepted', 'waived', 'closed'))::integer as high_open_finding_count,
  count(distinct p.id) filter (where p.proof_status = 'passed')::integer as passed_sql_proof_count,
  count(distinct so.id) filter (where so.signoff_status = 'signed')::integer as signed_area_count,
  count(distinct ep.id) filter (where ep.pack_status in ('review_ready', 'accepted'))::integer as ready_evidence_pack_count
from public.real_uat_execution_cycles c
left join public.real_uat_execution_scripts s on s.cycle_id = c.id
left join public.real_uat_execution_runs r on r.cycle_id = c.id
left join public.real_uat_execution_findings f on f.cycle_id = c.id
left join public.real_uat_execution_sql_proofs p on p.cycle_id = c.id
left join public.real_uat_execution_signoffs so on so.cycle_id = c.id
left join public.real_uat_accreditation_evidence_packages ep on ep.cycle_id = c.id
group by c.organization_id;

create or replace view public.v_real_uat_run_queue
with (security_invoker = true) as
select
  c.organization_id,
  c.cycle_code,
  c.cycle_name,
  c.cycle_status,
  c.environment_name,
  s.script_code,
  s.script_title,
  s.module_key,
  s.test_priority,
  p.persona_group,
  p.persona_name,
  r.run_code,
  r.run_status,
  r.evidence_review_status,
  r.executed_by_name,
  r.execution_finished_at,
  case
    when r.run_status in ('failed', 'blocked') then 'danger'
    when r.run_status = 'retest_required' then 'warning'
    when r.evidence_review_status in ('rejected', 'needs_more_evidence') then 'warning'
    when r.run_status = 'passed' and r.evidence_review_status = 'accepted' then 'ready'
    when c.target_finish_date is not null and c.target_finish_date < current_date and r.run_status not in ('passed', 'cancelled') then 'overdue'
    else 'normal'
  end as queue_signal
from public.real_uat_execution_cycles c
join public.real_uat_execution_scripts s on s.cycle_id = c.id
left join public.real_uat_execution_personas p on p.id = s.persona_id
left join public.real_uat_execution_runs r on r.script_id = s.id and r.cycle_id = c.id;

create or replace view public.v_real_uat_finding_retest_queue
with (security_invoker = true) as
select
  f.organization_id,
  c.cycle_code,
  c.cycle_name,
  f.finding_code,
  f.finding_title,
  f.severity,
  f.finding_status,
  f.owner_name,
  f.due_date,
  count(rt.id)::integer as retest_count,
  count(rt.id) filter (where rt.retest_status = 'passed')::integer as passed_retest_count,
  count(rt.id) filter (where rt.retest_status = 'failed')::integer as failed_retest_count,
  case
    when f.severity in ('critical', 'high') and f.finding_status not in ('accepted', 'waived', 'closed') then 'danger'
    when f.due_date is not null and f.due_date < current_date and f.finding_status not in ('accepted', 'waived', 'closed') then 'overdue'
    when f.finding_status in ('fixed', 'ready_for_retest') then 'retest_ready'
    when f.finding_status in ('accepted', 'closed') then 'ready'
    else 'normal'
  end as queue_signal
from public.real_uat_execution_findings f
left join public.real_uat_execution_cycles c on c.id = f.cycle_id
left join public.real_uat_execution_retests rt on rt.finding_id = f.id
group by f.organization_id, c.cycle_code, c.cycle_name, f.finding_code, f.finding_title, f.severity, f.finding_status, f.owner_name, f.due_date;

create or replace view public.v_real_uat_signoff_readiness
with (security_invoker = true) as
select
  so.organization_id,
  c.cycle_code,
  c.cycle_name,
  so.signoff_area,
  so.signer_name,
  so.signer_title,
  so.signoff_status,
  so.signed_at,
  case
    when so.signoff_status = 'signed' then 'ready'
    when so.signoff_status = 'conditional' then 'warning'
    when so.signoff_status = 'rejected' then 'danger'
    else 'pending'
  end as queue_signal
from public.real_uat_execution_signoffs so
join public.real_uat_execution_cycles c on c.id = so.cycle_id;

create or replace view public.v_real_uat_evidence_pack_readiness
with (security_invoker = true) as
select
  ep.organization_id,
  c.cycle_code,
  c.cycle_name,
  ep.pack_code,
  ep.pack_title,
  ep.accreditation_scope,
  ep.pack_status,
  ep.required_artifact_count,
  ep.accepted_artifact_count,
  ep.open_gap_count,
  ep.owner_name,
  ep.target_review_date,
  case
    when ep.open_gap_count > 0 then 'warning'
    when ep.required_artifact_count > 0 and ep.accepted_artifact_count >= ep.required_artifact_count and ep.pack_status in ('review_ready', 'accepted') then 'ready'
    when ep.target_review_date is not null and ep.target_review_date < current_date and ep.pack_status not in ('accepted', 'archived') then 'overdue'
    else 'normal'
  end as queue_signal
from public.real_uat_accreditation_evidence_packages ep
left join public.real_uat_execution_cycles c on c.id = ep.cycle_id;

comment on table public.real_uat_execution_cycles is 'Patch 17 real UAT execution cycles. No fake UAT evidence or signoffs are seeded.';
comment on table public.real_uat_execution_evidence is 'Patch 17 UAT evidence artifacts such as screenshots, SQL output, signed PDFs, exports, and meeting evidence.';
comment on table public.real_uat_execution_sql_proofs is 'Patch 17 SQL proof archive for persona, RLS, staging, workflow, restore, and data reconciliation evidence.';
comment on view public.v_real_uat_execution_summary is 'Patch 17 summary for real UAT execution, findings, SQL proofs, signoffs, and evidence pack readiness.';
