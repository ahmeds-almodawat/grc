-- Patch 16: Real Data Activation Pack
-- Purpose: prepare the platform for controlled loading of real hospital master data, licensed standards metadata,
-- roles, committees, evidence taxonomy, controls, KPIs, tracer templates, audit universe, obligations, and document owners.
-- This patch does not seed fake data and does not include copyrighted CBAHI/JCI/ISO standard text.

create extension if not exists pgcrypto;

create table if not exists public.real_data_activation_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  program_code text not null,
  program_name text not null,
  activation_scope text not null default 'master_data'
    check (activation_scope in ('standards', 'master_data', 'security', 'workflow', 'uat', 'full_activation')),
  activation_stage text not null default 'planning'
    check (activation_stage in ('planning', 'source_collection', 'validation', 'mapping', 'approval', 'loaded', 'reconciled', 'signed_off', 'rejected', 'paused')),
  source_owner_name text,
  data_steward_name text,
  target_go_live_date date,
  confidentiality_level text not null default 'internal'
    check (confidentiality_level in ('public', 'internal', 'confidential', 'restricted')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, program_code)
);

create table if not exists public.real_data_source_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  program_id uuid references public.real_data_activation_programs(id) on delete cascade,
  file_label text not null,
  source_domain text not null
    check (source_domain in ('standards_metadata', 'departments', 'committees', 'role_matrix', 'evidence_taxonomy', 'controls', 'kpis', 'tracers', 'audit_universe', 'obligations', 'documents', 'users', 'other')),
  file_name text,
  file_hash text,
  file_uri text,
  received_from text,
  received_at timestamptz,
  license_status text not null default 'not_applicable'
    check (license_status in ('licensed', 'provided_by_hospital', 'public_metadata_only', 'not_applicable', 'blocked')),
  pii_status text not null default 'unknown'
    check (pii_status in ('none', 'limited', 'contains_pii', 'contains_phi', 'unknown')),
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'validating', 'valid', 'warning', 'failed', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_data_dataset_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  program_id uuid references public.real_data_activation_programs(id) on delete cascade,
  dataset_code text not null,
  dataset_name text not null,
  dataset_domain text not null,
  target_module text not null,
  target_table_name text,
  minimum_required boolean not null default true,
  expected_record_count integer,
  loaded_record_count integer not null default 0,
  rejected_record_count integer not null default 0,
  dataset_status text not null default 'not_started'
    check (dataset_status in ('not_started', 'source_received', 'mapped', 'validated', 'approved', 'loaded', 'reconciled', 'signed_off', 'failed')),
  owner_name text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, dataset_code)
);

create table if not exists public.real_data_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  program_id uuid references public.real_data_activation_programs(id) on delete cascade,
  dataset_id uuid references public.real_data_dataset_catalog(id) on delete cascade,
  source_file_id uuid references public.real_data_source_files(id) on delete set null,
  job_code text not null,
  job_name text not null,
  import_mode text not null default 'validate_only'
    check (import_mode in ('validate_only', 'dry_run', 'load_to_staging', 'load_to_live', 'rollback')),
  job_status text not null default 'queued'
    check (job_status in ('queued', 'running', 'completed', 'completed_with_warnings', 'failed', 'cancelled', 'rolled_back')),
  started_at timestamptz,
  completed_at timestamptz,
  requested_by_name text,
  approved_by_name text,
  rows_read integer not null default 0,
  rows_valid integer not null default 0,
  rows_warning integer not null default 0,
  rows_rejected integer not null default 0,
  job_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, job_code)
);

create table if not exists public.real_data_mapping_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  program_id uuid references public.real_data_activation_programs(id) on delete cascade,
  dataset_id uuid references public.real_data_dataset_catalog(id) on delete cascade,
  mapping_code text not null,
  mapping_name text not null,
  source_system text,
  target_module text not null,
  mapping_status text not null default 'draft'
    check (mapping_status in ('draft', 'under_review', 'approved', 'rejected', 'retired')),
  reviewer_name text,
  approved_by_name text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, mapping_code)
);

create table if not exists public.real_data_mapping_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  mapping_set_id uuid not null references public.real_data_mapping_sets(id) on delete cascade,
  source_field text not null,
  target_field text not null,
  transform_rule text,
  is_required boolean not null default false,
  validation_rule text,
  mapping_status text not null default 'active'
    check (mapping_status in ('active', 'needs_review', 'deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, mapping_set_id, source_field, target_field)
);

create table if not exists public.real_data_validation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  dataset_id uuid references public.real_data_dataset_catalog(id) on delete cascade,
  rule_code text not null,
  rule_name text not null,
  rule_type text not null default 'completeness'
    check (rule_type in ('completeness', 'uniqueness', 'format', 'reference', 'license', 'privacy', 'workflow', 'business_rule')),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  rule_expression text,
  is_blocking boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rule_code)
);

create table if not exists public.real_data_validation_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  import_job_id uuid references public.real_data_import_jobs(id) on delete cascade,
  dataset_id uuid references public.real_data_dataset_catalog(id) on delete cascade,
  rule_id uuid references public.real_data_validation_rules(id) on delete set null,
  result_status text not null default 'open'
    check (result_status in ('open', 'accepted_risk', 'resolved', 'false_positive', 'rejected')),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  affected_record_key text,
  finding_title text not null,
  finding_detail text,
  remediation_owner_name text,
  remediation_due_date date,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_data_load_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  program_id uuid references public.real_data_activation_programs(id) on delete cascade,
  dataset_id uuid references public.real_data_dataset_catalog(id) on delete cascade,
  import_job_id uuid references public.real_data_import_jobs(id) on delete set null,
  approval_stage text not null default 'data_owner_review'
    check (approval_stage in ('data_owner_review', 'quality_review', 'it_security_review', 'management_review', 'load_authorized', 'rejected')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'changes_requested', 'waived')),
  approver_role text,
  approver_name text,
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_data_reconciliation_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  program_id uuid references public.real_data_activation_programs(id) on delete cascade,
  dataset_id uuid references public.real_data_dataset_catalog(id) on delete cascade,
  check_code text not null,
  check_name text not null,
  source_count integer,
  target_count integer,
  difference_count integer,
  reconciliation_status text not null default 'pending'
    check (reconciliation_status in ('pending', 'matched', 'mismatch', 'accepted_difference', 'failed')),
  reviewer_name text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, check_code)
);

create table if not exists public.real_data_cutover_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  program_id uuid references public.real_data_activation_programs(id) on delete cascade,
  cutover_code text not null,
  cutover_name text not null,
  cutover_type text not null default 'rehearsal'
    check (cutover_type in ('rehearsal', 'dress_rehearsal', 'production')),
  cutover_status text not null default 'planned'
    check (cutover_status in ('planned', 'running', 'completed', 'completed_with_issues', 'failed', 'cancelled')),
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  rollback_required boolean not null default false,
  rollback_status text not null default 'not_required'
    check (rollback_status in ('not_required', 'planned', 'executed', 'failed')),
  run_lead_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cutover_code)
);

create table if not exists public.real_data_readiness_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  program_id uuid references public.real_data_activation_programs(id) on delete cascade,
  signoff_area text not null
    check (signoff_area in ('quality', 'it', 'information_security', 'management', 'audit', 'department_owner', 'data_owner', 'board')),
  signoff_status text not null default 'pending'
    check (signoff_status in ('pending', 'approved', 'rejected', 'conditional_approval', 'not_required')),
  signer_name text,
  signer_role text,
  signed_at timestamptz,
  conditions text,
  evidence_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rd_programs_org_stage on public.real_data_activation_programs(organization_id, activation_stage, activation_scope);
create index if not exists idx_rd_files_org_domain_status on public.real_data_source_files(organization_id, source_domain, validation_status);
create index if not exists idx_rd_datasets_org_status on public.real_data_dataset_catalog(organization_id, dataset_status, due_date);
create index if not exists idx_rd_jobs_org_status on public.real_data_import_jobs(organization_id, job_status, created_at desc);
create index if not exists idx_rd_validation_org_status on public.real_data_validation_results(organization_id, result_status, severity, remediation_due_date);
create index if not exists idx_rd_approvals_org_status on public.real_data_load_approvals(organization_id, approval_status, approval_stage);
create index if not exists idx_rd_cutover_org_status on public.real_data_cutover_runs(organization_id, cutover_status, cutover_type);
create index if not exists idx_rd_signoffs_org_status on public.real_data_readiness_signoffs(organization_id, signoff_status, signoff_area);

alter table public.real_data_activation_programs enable row level security;
alter table public.real_data_source_files enable row level security;
alter table public.real_data_dataset_catalog enable row level security;
alter table public.real_data_import_jobs enable row level security;
alter table public.real_data_mapping_sets enable row level security;
alter table public.real_data_mapping_items enable row level security;
alter table public.real_data_validation_rules enable row level security;
alter table public.real_data_validation_results enable row level security;
alter table public.real_data_load_approvals enable row level security;
alter table public.real_data_reconciliation_checks enable row level security;
alter table public.real_data_cutover_runs enable row level security;
alter table public.real_data_readiness_signoffs enable row level security;

-- real_data_activation_programs
create policy real_data_activation_programs_org_read on public.real_data_activation_programs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_activation_programs_org_insert on public.real_data_activation_programs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_activation_programs_org_update on public.real_data_activation_programs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_source_files
create policy real_data_source_files_org_read on public.real_data_source_files for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_source_files_org_insert on public.real_data_source_files for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_source_files_org_update on public.real_data_source_files for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_dataset_catalog
create policy real_data_dataset_catalog_org_read on public.real_data_dataset_catalog for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_dataset_catalog_org_insert on public.real_data_dataset_catalog for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_dataset_catalog_org_update on public.real_data_dataset_catalog for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_import_jobs
create policy real_data_import_jobs_org_read on public.real_data_import_jobs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_import_jobs_org_insert on public.real_data_import_jobs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_import_jobs_org_update on public.real_data_import_jobs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_mapping_sets
create policy real_data_mapping_sets_org_read on public.real_data_mapping_sets for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_mapping_sets_org_insert on public.real_data_mapping_sets for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_mapping_sets_org_update on public.real_data_mapping_sets for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_mapping_items
create policy real_data_mapping_items_org_read on public.real_data_mapping_items for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_mapping_items_org_insert on public.real_data_mapping_items for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_mapping_items_org_update on public.real_data_mapping_items for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_validation_rules
create policy real_data_validation_rules_org_read on public.real_data_validation_rules for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_validation_rules_org_insert on public.real_data_validation_rules for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_validation_rules_org_update on public.real_data_validation_rules for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_validation_results
create policy real_data_validation_results_org_read on public.real_data_validation_results for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_validation_results_org_insert on public.real_data_validation_results for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_validation_results_org_update on public.real_data_validation_results for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_load_approvals
create policy real_data_load_approvals_org_read on public.real_data_load_approvals for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_load_approvals_org_insert on public.real_data_load_approvals for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_load_approvals_org_update on public.real_data_load_approvals for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_reconciliation_checks
create policy real_data_reconciliation_checks_org_read on public.real_data_reconciliation_checks for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_reconciliation_checks_org_insert on public.real_data_reconciliation_checks for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_reconciliation_checks_org_update on public.real_data_reconciliation_checks for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_cutover_runs
create policy real_data_cutover_runs_org_read on public.real_data_cutover_runs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_cutover_runs_org_insert on public.real_data_cutover_runs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_cutover_runs_org_update on public.real_data_cutover_runs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
-- real_data_readiness_signoffs
create policy real_data_readiness_signoffs_org_read on public.real_data_readiness_signoffs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_readiness_signoffs_org_insert on public.real_data_readiness_signoffs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
create policy real_data_readiness_signoffs_org_update on public.real_data_readiness_signoffs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_real_data_activation_summary
with (security_invoker = true) as
select
  p.organization_id,
  count(distinct p.id)::integer as program_count,
  count(distinct p.id) filter (where p.activation_stage in ('validation', 'mapping', 'approval'))::integer as active_program_count,
  count(distinct d.id)::integer as dataset_count,
  count(distinct d.id) filter (where d.dataset_status in ('approved', 'loaded', 'reconciled', 'signed_off'))::integer as ready_dataset_count,
  count(distinct f.id)::integer as source_file_count,
  count(distinct f.id) filter (where f.license_status = 'blocked' or f.validation_status in ('failed', 'rejected'))::integer as blocked_source_count,
  count(distinct vr.id) filter (where vr.result_status = 'open' and vr.severity in ('critical', 'high'))::integer as high_open_validation_count,
  count(distinct a.id) filter (where a.approval_status = 'pending')::integer as pending_approval_count,
  count(distinct s.id) filter (where s.signoff_status in ('pending', 'conditional_approval'))::integer as pending_signoff_count
from public.real_data_activation_programs p
left join public.real_data_dataset_catalog d on d.program_id = p.id
left join public.real_data_source_files f on f.program_id = p.id
left join public.real_data_validation_results vr on vr.organization_id = p.organization_id and vr.dataset_id = d.id
left join public.real_data_load_approvals a on a.program_id = p.id
left join public.real_data_readiness_signoffs s on s.program_id = p.id
group by p.organization_id;

create or replace view public.v_real_data_activation_queue
with (security_invoker = true) as
select
  d.organization_id,
  p.program_code,
  p.program_name,
  p.activation_scope,
  p.activation_stage,
  d.dataset_code,
  d.dataset_name,
  d.dataset_domain,
  d.target_module,
  d.dataset_status,
  d.expected_record_count,
  d.loaded_record_count,
  d.rejected_record_count,
  d.owner_name,
  d.due_date,
  case
    when d.dataset_status = 'failed' or coalesce(d.rejected_record_count, 0) > 0 then 'danger'
    when d.due_date is not null and d.due_date < current_date and d.dataset_status not in ('loaded', 'reconciled', 'signed_off') then 'overdue'
    when d.minimum_required and d.dataset_status in ('not_started', 'source_received') then 'required'
    when d.dataset_status in ('approved', 'loaded', 'reconciled', 'signed_off') then 'ready'
    else 'normal'
  end as queue_signal
from public.real_data_dataset_catalog d
join public.real_data_activation_programs p on p.id = d.program_id;

create or replace view public.v_real_data_validation_queue
with (security_invoker = true) as
select
  vr.organization_id,
  p.program_code,
  d.dataset_code,
  d.dataset_name,
  vr.severity,
  vr.result_status,
  vr.finding_title,
  vr.remediation_owner_name,
  vr.remediation_due_date,
  case
    when vr.severity in ('critical', 'high') and vr.result_status = 'open' then 'danger'
    when vr.remediation_due_date is not null and vr.remediation_due_date < current_date and vr.result_status = 'open' then 'overdue'
    when vr.result_status = 'resolved' then 'ready'
    else 'normal'
  end as queue_signal
from public.real_data_validation_results vr
left join public.real_data_dataset_catalog d on d.id = vr.dataset_id
left join public.real_data_activation_programs p on p.id = d.program_id;

create or replace view public.v_real_data_approval_queue
with (security_invoker = true) as
select
  a.organization_id,
  p.program_code,
  d.dataset_code,
  d.dataset_name,
  a.approval_stage,
  a.approval_status,
  a.approver_role,
  a.approver_name,
  a.decided_at,
  case
    when a.approval_status = 'rejected' then 'danger'
    when a.approval_status = 'changes_requested' then 'warning'
    when a.approval_status = 'approved' then 'ready'
    else 'pending'
  end as queue_signal
from public.real_data_load_approvals a
left join public.real_data_dataset_catalog d on d.id = a.dataset_id
left join public.real_data_activation_programs p on p.id = a.program_id;

create or replace view public.v_real_data_cutover_readiness
with (security_invoker = true) as
select
  p.organization_id,
  p.program_code,
  p.program_name,
  p.activation_stage,
  count(distinct d.id)::integer as dataset_count,
  count(distinct d.id) filter (where d.dataset_status in ('approved', 'loaded', 'reconciled', 'signed_off'))::integer as ready_dataset_count,
  count(distinct vr.id) filter (where vr.result_status = 'open' and vr.severity in ('critical', 'high'))::integer as blocking_validation_count,
  count(distinct a.id) filter (where a.approval_status = 'pending')::integer as pending_approval_count,
  count(distinct s.id) filter (where s.signoff_status = 'approved')::integer as approved_signoff_count,
  count(distinct s.id)::integer as signoff_count,
  case
    when count(distinct vr.id) filter (where vr.result_status = 'open' and vr.severity in ('critical', 'high')) > 0 then 'blocked'
    when count(distinct a.id) filter (where a.approval_status = 'pending') > 0 then 'approval_pending'
    when count(distinct d.id) > 0 and count(distinct d.id) = count(distinct d.id) filter (where d.dataset_status in ('approved', 'loaded', 'reconciled', 'signed_off')) then 'ready'
    else 'in_progress'
  end as readiness_signal
from public.real_data_activation_programs p
left join public.real_data_dataset_catalog d on d.program_id = p.id
left join public.real_data_validation_results vr on vr.dataset_id = d.id
left join public.real_data_load_approvals a on a.program_id = p.id
left join public.real_data_readiness_signoffs s on s.program_id = p.id
group by p.organization_id, p.program_code, p.program_name, p.activation_stage;

comment on table public.real_data_activation_programs is 'Patch 16 real-data activation program register for controlled hospital data loading.';
comment on table public.real_data_source_files is 'Patch 16 source-file register with license, privacy, hash, and validation status.';
comment on table public.real_data_dataset_catalog is 'Patch 16 dataset catalog for standards metadata, departments, committees, roles, evidence taxonomy, controls, KPIs, tracers, audit universe, obligations, and document owners.';
comment on view public.v_real_data_activation_summary is 'Patch 16 real-data activation summary; security_invoker keeps RLS active.';
