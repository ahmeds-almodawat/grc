-- Patch 10: Real Data Activation and UAT Readiness
-- Purpose: govern licensed content loading, import validation, mapping approval, UAT execution, training acceptance, and department go/no-go readiness.
-- Important: this patch creates real-data activation controls only. It does not load copyrighted standards text and does not seed demo data.

create extension if not exists pgcrypto;

create table if not exists public.real_data_activation_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_code text not null,
  source_domain text not null check (source_domain in ('accreditation', 'quality', 'risk', 'audit', 'compliance', 'users', 'departments', 'evidence', 'policies', 'controls')),
  source_name text not null,
  batch_status text not null default 'draft' check (batch_status in ('draft', 'uploaded', 'validating', 'validation_failed', 'ready_for_review', 'approved', 'loaded', 'rejected', 'cancelled')),
  content_license_status text not null default 'not_applicable' check (content_license_status in ('not_applicable', 'pending_owner_confirmation', 'licensed_confirmed', 'rejected_unlicensed')),
  uploaded_by uuid,
  uploaded_by_name text,
  reviewed_by uuid,
  reviewed_by_name text,
  approved_by uuid,
  approved_by_name text,
  record_count integer not null default 0,
  error_count integer not null default 0,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  loaded_at timestamptz,
  unique (organization_id, batch_code)
);

create table if not exists public.real_data_activation_import_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null references public.real_data_activation_import_batches(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_url text,
  checksum_sha256 text,
  row_count integer not null default 0,
  parse_status text not null default 'pending' check (parse_status in ('pending', 'parsed', 'failed', 'superseded')),
  parse_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.real_data_activation_validation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rule_code text not null,
  source_domain text not null,
  rule_name text not null,
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low')),
  rule_expression text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, rule_code)
);

create table if not exists public.real_data_activation_validation_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null references public.real_data_activation_import_batches(id) on delete cascade,
  rule_id uuid references public.real_data_activation_validation_rules(id) on delete set null,
  result_status text not null check (result_status in ('passed', 'warning', 'failed', 'waived')),
  affected_count integer not null default 0,
  result_message text,
  waiver_reason text,
  validated_at timestamptz not null default now()
);

create table if not exists public.real_data_activation_mapping_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  mapping_code text not null,
  mapping_name text not null,
  source_domain text not null,
  target_domain text not null,
  mapping_status text not null default 'draft' check (mapping_status in ('draft', 'in_review', 'approved', 'rejected', 'retired')),
  owner_name text,
  approved_by_name text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (organization_id, mapping_code)
);

create table if not exists public.real_data_activation_mapping_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  mapping_set_id uuid not null references public.real_data_activation_mapping_sets(id) on delete cascade,
  source_key text not null,
  source_label text,
  target_key text not null,
  target_label text,
  mapping_confidence text not null default 'manual' check (mapping_confidence in ('manual', 'high', 'medium', 'low', 'needs_review')),
  mapping_status text not null default 'active' check (mapping_status in ('active', 'needs_review', 'retired')),
  created_at timestamptz not null default now()
);

create table if not exists public.real_data_activation_load_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null references public.real_data_activation_import_batches(id) on delete cascade,
  approval_role text not null check (approval_role in ('data_owner', 'quality_owner', 'compliance_owner', 'it_owner', 'executive_owner')),
  approver_id uuid,
  approver_name text,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected', 'changes_requested')),
  approval_comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.uat_readiness_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_code text not null,
  cycle_name text not null,
  cycle_scope text not null,
  cycle_status text not null default 'planned' check (cycle_status in ('planned', 'active', 'paused', 'completed', 'failed', 'cancelled')),
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  owner_name text,
  created_at timestamptz not null default now(),
  unique (organization_id, cycle_code)
);

create table if not exists public.uat_readiness_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid references public.uat_readiness_cycles(id) on delete cascade,
  scenario_code text not null,
  scenario_title text not null,
  module_key text not null,
  persona_key text not null,
  criticality text not null default 'medium' check (criticality in ('critical', 'high', 'medium', 'low')),
  expected_result text,
  scenario_status text not null default 'ready' check (scenario_status in ('draft', 'ready', 'blocked', 'retired')),
  created_at timestamptz not null default now(),
  unique (organization_id, scenario_code)
);

create table if not exists public.uat_readiness_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  scenario_id uuid not null references public.uat_readiness_scenarios(id) on delete cascade,
  run_status text not null default 'not_started' check (run_status in ('not_started', 'running', 'passed', 'failed', 'blocked', 'retest_required')),
  tester_id uuid,
  tester_name text,
  evidence_url text,
  actual_result text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.uat_readiness_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  run_id uuid references public.uat_readiness_runs(id) on delete cascade,
  finding_code text not null,
  finding_title text not null,
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low')),
  finding_status text not null default 'open' check (finding_status in ('open', 'assigned', 'fixed', 'retest_passed', 'accepted_risk', 'cancelled')),
  owner_name text,
  due_date date,
  resolution_notes text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (organization_id, finding_code)
);

create table if not exists public.uat_readiness_training_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  training_code text not null,
  training_title text not null,
  module_key text not null,
  trainee_name text not null,
  trainee_role text,
  completion_status text not null default 'assigned' check (completion_status in ('assigned', 'completed', 'failed', 'waived')),
  completion_date date,
  evidence_url text,
  created_at timestamptz not null default now(),
  unique (organization_id, training_code, trainee_name)
);

create table if not exists public.uat_readiness_department_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  department_name text not null,
  module_key text not null,
  signoff_role text not null check (signoff_role in ('department_owner', 'quality_owner', 'it_owner', 'training_owner', 'executive_owner')),
  signoff_status text not null default 'pending' check (signoff_status in ('pending', 'approved', 'rejected', 'changes_requested')),
  signer_name text,
  signoff_comment text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.uat_readiness_go_no_go_checklists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  checklist_code text not null,
  checklist_area text not null,
  requirement_name text not null,
  requirement_status text not null default 'pending' check (requirement_status in ('pending', 'ready', 'blocked', 'waived')),
  evidence_url text,
  owner_name text,
  reviewer_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, checklist_code)
);

create index if not exists idx_rda_batches_org_status on public.real_data_activation_import_batches(organization_id, batch_status, source_domain, created_at desc);
create index if not exists idx_rda_validation_results_batch on public.real_data_activation_validation_results(batch_id, result_status);
create index if not exists idx_rda_mapping_sets_org_status on public.real_data_activation_mapping_sets(organization_id, mapping_status, source_domain, target_domain);
create index if not exists idx_uat_cycles_org_status on public.uat_readiness_cycles(organization_id, cycle_status, planned_end_date);
create index if not exists idx_uat_runs_org_status on public.uat_readiness_runs(organization_id, run_status, created_at desc);
create index if not exists idx_uat_findings_org_status on public.uat_readiness_findings(organization_id, finding_status, severity, due_date);
create index if not exists idx_uat_training_org_status on public.uat_readiness_training_records(organization_id, completion_status, module_key);
create index if not exists idx_uat_signoffs_org_status on public.uat_readiness_department_signoffs(organization_id, signoff_status, module_key);

alter table public.real_data_activation_import_batches enable row level security;
alter table public.real_data_activation_import_files enable row level security;
alter table public.real_data_activation_validation_rules enable row level security;
alter table public.real_data_activation_validation_results enable row level security;
alter table public.real_data_activation_mapping_sets enable row level security;
alter table public.real_data_activation_mapping_items enable row level security;
alter table public.real_data_activation_load_approvals enable row level security;
alter table public.uat_readiness_cycles enable row level security;
alter table public.uat_readiness_scenarios enable row level security;
alter table public.uat_readiness_runs enable row level security;
alter table public.uat_readiness_findings enable row level security;
alter table public.uat_readiness_training_records enable row level security;
alter table public.uat_readiness_department_signoffs enable row level security;
alter table public.uat_readiness_go_no_go_checklists enable row level security;

-- Explicit org policies for static audit visibility.
drop policy if exists real_data_activation_import_batches_org_read on public.real_data_activation_import_batches;
create policy real_data_activation_import_batches_org_read on public.real_data_activation_import_batches for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_import_batches_org_insert on public.real_data_activation_import_batches;
create policy real_data_activation_import_batches_org_insert on public.real_data_activation_import_batches for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_import_batches_org_update on public.real_data_activation_import_batches;
create policy real_data_activation_import_batches_org_update on public.real_data_activation_import_batches for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_data_activation_import_files_org_read on public.real_data_activation_import_files;
create policy real_data_activation_import_files_org_read on public.real_data_activation_import_files for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_import_files_org_insert on public.real_data_activation_import_files;
create policy real_data_activation_import_files_org_insert on public.real_data_activation_import_files for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_import_files_org_update on public.real_data_activation_import_files;
create policy real_data_activation_import_files_org_update on public.real_data_activation_import_files for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_data_activation_validation_rules_org_read on public.real_data_activation_validation_rules;
create policy real_data_activation_validation_rules_org_read on public.real_data_activation_validation_rules for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_validation_rules_org_insert on public.real_data_activation_validation_rules;
create policy real_data_activation_validation_rules_org_insert on public.real_data_activation_validation_rules for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_validation_rules_org_update on public.real_data_activation_validation_rules;
create policy real_data_activation_validation_rules_org_update on public.real_data_activation_validation_rules for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_data_activation_validation_results_org_read on public.real_data_activation_validation_results;
create policy real_data_activation_validation_results_org_read on public.real_data_activation_validation_results for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_validation_results_org_insert on public.real_data_activation_validation_results;
create policy real_data_activation_validation_results_org_insert on public.real_data_activation_validation_results for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_validation_results_org_update on public.real_data_activation_validation_results;
create policy real_data_activation_validation_results_org_update on public.real_data_activation_validation_results for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_data_activation_mapping_sets_org_read on public.real_data_activation_mapping_sets;
create policy real_data_activation_mapping_sets_org_read on public.real_data_activation_mapping_sets for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_mapping_sets_org_insert on public.real_data_activation_mapping_sets;
create policy real_data_activation_mapping_sets_org_insert on public.real_data_activation_mapping_sets for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_mapping_sets_org_update on public.real_data_activation_mapping_sets;
create policy real_data_activation_mapping_sets_org_update on public.real_data_activation_mapping_sets for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_data_activation_mapping_items_org_read on public.real_data_activation_mapping_items;
create policy real_data_activation_mapping_items_org_read on public.real_data_activation_mapping_items for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_mapping_items_org_insert on public.real_data_activation_mapping_items;
create policy real_data_activation_mapping_items_org_insert on public.real_data_activation_mapping_items for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_mapping_items_org_update on public.real_data_activation_mapping_items;
create policy real_data_activation_mapping_items_org_update on public.real_data_activation_mapping_items for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_data_activation_load_approvals_org_read on public.real_data_activation_load_approvals;
create policy real_data_activation_load_approvals_org_read on public.real_data_activation_load_approvals for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_load_approvals_org_insert on public.real_data_activation_load_approvals;
create policy real_data_activation_load_approvals_org_insert on public.real_data_activation_load_approvals for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_data_activation_load_approvals_org_update on public.real_data_activation_load_approvals;
create policy real_data_activation_load_approvals_org_update on public.real_data_activation_load_approvals for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists uat_readiness_cycles_org_read on public.uat_readiness_cycles;
create policy uat_readiness_cycles_org_read on public.uat_readiness_cycles for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_cycles_org_insert on public.uat_readiness_cycles;
create policy uat_readiness_cycles_org_insert on public.uat_readiness_cycles for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_cycles_org_update on public.uat_readiness_cycles;
create policy uat_readiness_cycles_org_update on public.uat_readiness_cycles for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists uat_readiness_scenarios_org_read on public.uat_readiness_scenarios;
create policy uat_readiness_scenarios_org_read on public.uat_readiness_scenarios for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_scenarios_org_insert on public.uat_readiness_scenarios;
create policy uat_readiness_scenarios_org_insert on public.uat_readiness_scenarios for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_scenarios_org_update on public.uat_readiness_scenarios;
create policy uat_readiness_scenarios_org_update on public.uat_readiness_scenarios for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists uat_readiness_runs_org_read on public.uat_readiness_runs;
create policy uat_readiness_runs_org_read on public.uat_readiness_runs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_runs_org_insert on public.uat_readiness_runs;
create policy uat_readiness_runs_org_insert on public.uat_readiness_runs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_runs_org_update on public.uat_readiness_runs;
create policy uat_readiness_runs_org_update on public.uat_readiness_runs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists uat_readiness_findings_org_read on public.uat_readiness_findings;
create policy uat_readiness_findings_org_read on public.uat_readiness_findings for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_findings_org_insert on public.uat_readiness_findings;
create policy uat_readiness_findings_org_insert on public.uat_readiness_findings for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_findings_org_update on public.uat_readiness_findings;
create policy uat_readiness_findings_org_update on public.uat_readiness_findings for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists uat_readiness_training_records_org_read on public.uat_readiness_training_records;
create policy uat_readiness_training_records_org_read on public.uat_readiness_training_records for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_training_records_org_insert on public.uat_readiness_training_records;
create policy uat_readiness_training_records_org_insert on public.uat_readiness_training_records for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_training_records_org_update on public.uat_readiness_training_records;
create policy uat_readiness_training_records_org_update on public.uat_readiness_training_records for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists uat_readiness_department_signoffs_org_read on public.uat_readiness_department_signoffs;
create policy uat_readiness_department_signoffs_org_read on public.uat_readiness_department_signoffs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_department_signoffs_org_insert on public.uat_readiness_department_signoffs;
create policy uat_readiness_department_signoffs_org_insert on public.uat_readiness_department_signoffs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_department_signoffs_org_update on public.uat_readiness_department_signoffs;
create policy uat_readiness_department_signoffs_org_update on public.uat_readiness_department_signoffs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists uat_readiness_go_no_go_checklists_org_read on public.uat_readiness_go_no_go_checklists;
create policy uat_readiness_go_no_go_checklists_org_read on public.uat_readiness_go_no_go_checklists for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_go_no_go_checklists_org_insert on public.uat_readiness_go_no_go_checklists;
create policy uat_readiness_go_no_go_checklists_org_insert on public.uat_readiness_go_no_go_checklists for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists uat_readiness_go_no_go_checklists_org_update on public.uat_readiness_go_no_go_checklists;
create policy uat_readiness_go_no_go_checklists_org_update on public.uat_readiness_go_no_go_checklists for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_real_data_activation_summary
with (security_invoker = true) as
select
  coalesce(b.organization_id, m.organization_id) as organization_id,
  count(distinct b.id)::integer as import_batch_count,
  count(distinct b.id) filter (where b.batch_status in ('uploaded', 'validating', 'ready_for_review'))::integer as active_import_count,
  count(distinct b.id) filter (where b.batch_status = 'validation_failed' or b.error_count > 0)::integer as failed_validation_count,
  count(distinct b.id) filter (where b.content_license_status = 'pending_owner_confirmation')::integer as pending_license_confirmation_count,
  count(distinct m.id)::integer as mapping_set_count,
  count(distinct m.id) filter (where m.mapping_status in ('draft', 'in_review'))::integer as pending_mapping_count
from public.real_data_activation_import_batches b
full join public.real_data_activation_mapping_sets m on m.organization_id = b.organization_id
group by coalesce(b.organization_id, m.organization_id);

create or replace view public.v_real_data_import_quality_queue
with (security_invoker = true) as
select
  b.organization_id,
  b.batch_code,
  b.source_domain,
  b.source_name,
  b.batch_status,
  b.content_license_status,
  b.uploaded_by_name,
  b.record_count,
  b.error_count,
  count(v.id) filter (where v.result_status = 'failed')::integer as failed_rule_count,
  count(v.id) filter (where v.result_status = 'warning')::integer as warning_rule_count,
  case
    when b.content_license_status = 'rejected_unlicensed' then 'blocked_unlicensed'
    when b.error_count > 0 or count(v.id) filter (where v.result_status = 'failed') > 0 then 'validation_failed'
    when b.content_license_status = 'pending_owner_confirmation' then 'license_review'
    when b.batch_status in ('ready_for_review', 'approved') then 'ready'
    else 'normal'
  end as queue_signal
from public.real_data_activation_import_batches b
left join public.real_data_activation_validation_results v on v.batch_id = b.id
group by b.organization_id, b.batch_code, b.source_domain, b.source_name, b.batch_status, b.content_license_status, b.uploaded_by_name, b.record_count, b.error_count;

create or replace view public.v_uat_readiness_dashboard
with (security_invoker = true) as
select
  c.organization_id,
  c.cycle_code,
  c.cycle_name,
  c.cycle_status,
  c.planned_end_date,
  count(distinct s.id)::integer as scenario_count,
  count(distinct r.id) filter (where r.run_status = 'passed')::integer as passed_run_count,
  count(distinct r.id) filter (where r.run_status in ('failed', 'blocked', 'retest_required'))::integer as failed_or_blocked_run_count,
  count(distinct f.id) filter (where f.finding_status in ('open', 'assigned'))::integer as open_finding_count,
  case
    when c.planned_end_date is not null and c.planned_end_date < current_date and c.cycle_status not in ('completed', 'cancelled') then 'overdue_cycle'
    when count(distinct f.id) filter (where f.severity in ('critical', 'high') and f.finding_status in ('open', 'assigned')) > 0 then 'high_findings'
    when c.cycle_status = 'completed' then 'complete'
    else 'normal'
  end as readiness_signal
from public.uat_readiness_cycles c
left join public.uat_readiness_scenarios s on s.cycle_id = c.id
left join public.uat_readiness_runs r on r.scenario_id = s.id
left join public.uat_readiness_findings f on f.run_id = r.id
group by c.organization_id, c.cycle_code, c.cycle_name, c.cycle_status, c.planned_end_date;

create or replace view public.v_uat_findings_queue
with (security_invoker = true) as
select
  organization_id,
  finding_code,
  finding_title,
  severity,
  finding_status,
  owner_name,
  due_date,
  case
    when due_date is not null and due_date < current_date and finding_status in ('open', 'assigned') then 'overdue'
    when severity in ('critical', 'high') and finding_status in ('open', 'assigned') then 'high_attention'
    when finding_status = 'retest_passed' then 'ready_to_close'
    else 'normal'
  end as queue_signal
from public.uat_readiness_findings
where finding_status not in ('cancelled');

comment on table public.real_data_activation_import_batches is 'Patch 10 real-data import batch governance including licensed-content confirmation, validation, approval, and load status.';
comment on table public.uat_readiness_cycles is 'Patch 10 UAT cycle control for real hospital scenarios and controlled pilot readiness.';
comment on view public.v_real_data_import_quality_queue is 'Patch 10 real-data import quality queue; security_invoker keeps RLS active.';
comment on view public.v_uat_readiness_dashboard is 'Patch 10 UAT readiness dashboard; security_invoker keeps RLS active.';
