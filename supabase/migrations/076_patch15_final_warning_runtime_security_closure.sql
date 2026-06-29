-- Patch 15: Final Warning & Runtime Security Closure
-- Purpose: close final technical/runtime warnings before real data activation and production go/no-go.
-- Scope: Supabase client warning register, v65/v700 warning closure, RPC classification reviews,
-- runtime security exceptions, hardening proof runs, and launch-blocking closure views.
-- Important: no demo data and no copyrighted standards content are loaded by this migration.

create extension if not exists pgcrypto;

create table if not exists public.patch15_runtime_warning_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  warning_code text not null,
  warning_source text not null check (warning_source in ('supabase_client', 'e2e', 'runtime_security', 'v65_audit', 'rpc_inventory', 'manual_review', 'other')),
  warning_title text not null,
  warning_detail text,
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  warning_status text not null default 'open' check (warning_status in ('open', 'in_review', 'mitigated', 'accepted_exception', 'closed')),
  owner_id uuid,
  owner_name text,
  target_closure_date date,
  closure_notes text,
  closed_by uuid,
  closed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, warning_code)
);

create table if not exists public.patch15_v65_warning_closures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  report_name text not null default 'v700:v65-audit',
  finding_file text not null,
  finding_issue text not null,
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  canonical_file text,
  closure_method text not null check (closure_method in ('v672_capture', 'manual_sync', 'accepted_exception', 'not_applicable')),
  closure_status text not null default 'open' check (closure_status in ('open', 'ready_for_retest', 'closed', 'accepted_exception')),
  proof_command text,
  proof_artifact_path text,
  reviewer_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patch15_rpc_classification_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rpc_name text not null,
  source_file text,
  source_line integer,
  transport text not null default 'unknown' check (transport in ('direct_browser_rpc', 'authenticated_edge_bridge', 'service_role_bridge', 'unknown')),
  current_classification text not null default 'unknown_requires_review',
  approved_classification text,
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed_safe', 'needs_bridge', 'service_role_only', 'retired', 'accepted_exception')),
  risk_rating text not null default 'medium' check (risk_rating in ('critical', 'high', 'medium', 'low', 'info')),
  mitigation_plan text,
  reviewer_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rpc_name, coalesce(source_file, ''), coalesce(source_line, -1))
);

create table if not exists public.patch15_runtime_security_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  exception_code text not null,
  exception_type text not null check (exception_type in ('managed_schema_observation', 'rpc_classification', 'supabase_warning', 'e2e_warning', 'temporary_operational_exception')),
  exception_title text not null,
  risk_rating text not null default 'medium' check (risk_rating in ('critical', 'high', 'medium', 'low', 'info')),
  business_justification text not null,
  compensating_control text,
  expiry_date date,
  exception_status text not null default 'requested' check (exception_status in ('requested', 'approved', 'rejected', 'expired', 'closed')),
  approved_by uuid,
  approved_by_name text,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, exception_code)
);

create table if not exists public.patch15_supabase_client_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  check_code text not null,
  check_title text not null,
  check_status text not null default 'pending' check (check_status in ('pending', 'passed', 'failed', 'warning', 'not_applicable')),
  observed_warning text,
  remediation_summary text,
  proof_artifact_path text,
  executed_by uuid,
  executed_by_name text,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, check_code)
);

create table if not exists public.patch15_final_hardening_proof_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  proof_run_code text not null,
  proof_scope text not null check (proof_scope in ('typecheck', 'build', 'unit', 'e2e', 'npm_audit', 'rls', 'proof_all', 'runtime_security', 'v65_audit', 'staging_persona_sql', 'manual')),
  proof_status text not null default 'pending' check (proof_status in ('pending', 'passed', 'failed', 'warning', 'review_required')),
  command_text text,
  output_artifact_path text,
  critical_count integer not null default 0,
  high_count integer not null default 0,
  medium_count integer not null default 0,
  warning_count integer not null default 0,
  executed_by uuid,
  executed_by_name text,
  executed_at timestamptz,
  reviewer_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, proof_run_code)
);

create index if not exists idx_patch15_warnings_org_status on public.patch15_runtime_warning_register(organization_id, warning_status, severity);
create index if not exists idx_patch15_v65_org_status on public.patch15_v65_warning_closures(organization_id, closure_status, severity);
create index if not exists idx_patch15_rpc_org_status on public.patch15_rpc_classification_reviews(organization_id, review_status, risk_rating);
create index if not exists idx_patch15_exceptions_org_status on public.patch15_runtime_security_exceptions(organization_id, exception_status, expiry_date);
create index if not exists idx_patch15_client_checks_org_status on public.patch15_supabase_client_checks(organization_id, check_status);
create index if not exists idx_patch15_proof_runs_org_status on public.patch15_final_hardening_proof_runs(organization_id, proof_status, proof_scope);

alter table public.patch15_runtime_warning_register enable row level security;
alter table public.patch15_v65_warning_closures enable row level security;
alter table public.patch15_rpc_classification_reviews enable row level security;
alter table public.patch15_runtime_security_exceptions enable row level security;
alter table public.patch15_supabase_client_checks enable row level security;
alter table public.patch15_final_hardening_proof_runs enable row level security;

drop policy if exists patch15_runtime_warning_register_org_read on public.patch15_runtime_warning_register;
create policy patch15_runtime_warning_register_org_read on public.patch15_runtime_warning_register for select to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_runtime_warning_register_org_insert on public.patch15_runtime_warning_register;
create policy patch15_runtime_warning_register_org_insert on public.patch15_runtime_warning_register for insert to authenticated
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_runtime_warning_register_org_update on public.patch15_runtime_warning_register;
create policy patch15_runtime_warning_register_org_update on public.patch15_runtime_warning_register for update to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch15_v65_warning_closures_org_read on public.patch15_v65_warning_closures;
create policy patch15_v65_warning_closures_org_read on public.patch15_v65_warning_closures for select to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_v65_warning_closures_org_insert on public.patch15_v65_warning_closures;
create policy patch15_v65_warning_closures_org_insert on public.patch15_v65_warning_closures for insert to authenticated
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_v65_warning_closures_org_update on public.patch15_v65_warning_closures;
create policy patch15_v65_warning_closures_org_update on public.patch15_v65_warning_closures for update to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch15_rpc_classification_reviews_org_read on public.patch15_rpc_classification_reviews;
create policy patch15_rpc_classification_reviews_org_read on public.patch15_rpc_classification_reviews for select to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_rpc_classification_reviews_org_insert on public.patch15_rpc_classification_reviews;
create policy patch15_rpc_classification_reviews_org_insert on public.patch15_rpc_classification_reviews for insert to authenticated
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_rpc_classification_reviews_org_update on public.patch15_rpc_classification_reviews;
create policy patch15_rpc_classification_reviews_org_update on public.patch15_rpc_classification_reviews for update to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch15_runtime_security_exceptions_org_read on public.patch15_runtime_security_exceptions;
create policy patch15_runtime_security_exceptions_org_read on public.patch15_runtime_security_exceptions for select to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_runtime_security_exceptions_org_insert on public.patch15_runtime_security_exceptions;
create policy patch15_runtime_security_exceptions_org_insert on public.patch15_runtime_security_exceptions for insert to authenticated
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_runtime_security_exceptions_org_update on public.patch15_runtime_security_exceptions;
create policy patch15_runtime_security_exceptions_org_update on public.patch15_runtime_security_exceptions for update to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch15_supabase_client_checks_org_read on public.patch15_supabase_client_checks;
create policy patch15_supabase_client_checks_org_read on public.patch15_supabase_client_checks for select to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_supabase_client_checks_org_insert on public.patch15_supabase_client_checks;
create policy patch15_supabase_client_checks_org_insert on public.patch15_supabase_client_checks for insert to authenticated
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_supabase_client_checks_org_update on public.patch15_supabase_client_checks;
create policy patch15_supabase_client_checks_org_update on public.patch15_supabase_client_checks for update to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch15_final_hardening_proof_runs_org_read on public.patch15_final_hardening_proof_runs;
create policy patch15_final_hardening_proof_runs_org_read on public.patch15_final_hardening_proof_runs for select to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_final_hardening_proof_runs_org_insert on public.patch15_final_hardening_proof_runs;
create policy patch15_final_hardening_proof_runs_org_insert on public.patch15_final_hardening_proof_runs for insert to authenticated
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch15_final_hardening_proof_runs_org_update on public.patch15_final_hardening_proof_runs;
create policy patch15_final_hardening_proof_runs_org_update on public.patch15_final_hardening_proof_runs for update to authenticated
  using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'))
  with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_patch15_final_security_closure_summary
with (security_invoker = true) as
select
  coalesce(w.organization_id, v.organization_id, r.organization_id, e.organization_id, c.organization_id, p.organization_id) as organization_id,
  count(distinct w.id) filter (where w.warning_status not in ('closed', 'accepted_exception'))::integer as open_warning_count,
  count(distinct w.id) filter (where w.severity in ('critical', 'high') and w.warning_status not in ('closed', 'accepted_exception'))::integer as high_warning_count,
  count(distinct v.id) filter (where v.closure_status not in ('closed', 'accepted_exception'))::integer as open_v65_warning_count,
  count(distinct r.id) filter (where r.review_status in ('pending', 'needs_bridge'))::integer as rpc_review_queue_count,
  count(distinct e.id) filter (where e.exception_status in ('requested', 'approved') and (e.expiry_date is null or e.expiry_date >= current_date))::integer as active_exception_count,
  count(distinct c.id) filter (where c.check_status in ('failed', 'warning', 'pending'))::integer as open_client_check_count,
  count(distinct p.id) filter (where p.proof_status in ('failed', 'warning', 'review_required', 'pending'))::integer as proof_attention_count
from public.patch15_runtime_warning_register w
full join public.patch15_v65_warning_closures v on v.organization_id = w.organization_id
full join public.patch15_rpc_classification_reviews r on r.organization_id = coalesce(w.organization_id, v.organization_id)
full join public.patch15_runtime_security_exceptions e on e.organization_id = coalesce(w.organization_id, v.organization_id, r.organization_id)
full join public.patch15_supabase_client_checks c on c.organization_id = coalesce(w.organization_id, v.organization_id, r.organization_id, e.organization_id)
full join public.patch15_final_hardening_proof_runs p on p.organization_id = coalesce(w.organization_id, v.organization_id, r.organization_id, e.organization_id, c.organization_id)
group by coalesce(w.organization_id, v.organization_id, r.organization_id, e.organization_id, c.organization_id, p.organization_id);

create or replace view public.v_patch15_warning_closure_queue
with (security_invoker = true) as
select
  organization_id,
  warning_code as item_code,
  warning_title as item_title,
  warning_source as item_source,
  severity,
  warning_status as item_status,
  owner_name,
  target_closure_date as due_date,
  case
    when severity in ('critical', 'high') and warning_status not in ('closed', 'accepted_exception') then 'high_priority'
    when target_closure_date is not null and target_closure_date < current_date and warning_status not in ('closed', 'accepted_exception') then 'overdue'
    when warning_status in ('open', 'in_review') then 'open'
    else 'normal'
  end as queue_signal
from public.patch15_runtime_warning_register
union all
select
  organization_id,
  finding_issue as item_code,
  finding_file as item_title,
  'v65_audit' as item_source,
  severity,
  closure_status as item_status,
  reviewer_name as owner_name,
  null::date as due_date,
  case
    when severity in ('critical', 'high') and closure_status not in ('closed', 'accepted_exception') then 'high_priority'
    when closure_status in ('open', 'ready_for_retest') then 'open'
    else 'normal'
  end as queue_signal
from public.patch15_v65_warning_closures;

create or replace view public.v_patch15_rpc_review_queue
with (security_invoker = true) as
select
  organization_id,
  rpc_name,
  source_file,
  source_line,
  transport,
  current_classification,
  approved_classification,
  review_status,
  risk_rating,
  mitigation_plan,
  reviewer_name,
  reviewed_at,
  case
    when risk_rating in ('critical', 'high') and review_status in ('pending', 'needs_bridge') then 'high_priority'
    when review_status = 'needs_bridge' then 'needs_bridge'
    when review_status = 'pending' then 'pending_review'
    else 'normal'
  end as queue_signal
from public.patch15_rpc_classification_reviews;

comment on table public.patch15_runtime_warning_register is 'Patch 15 register for final runtime warnings such as Supabase multi-client, E2E warnings, runtime-security observations, and proof cleanup items.';
comment on table public.patch15_rpc_classification_reviews is 'Patch 15 RPC classification review register used to reduce unknown runtime-security classifications before production.';
comment on table public.patch15_final_hardening_proof_runs is 'Patch 15 proof run archive for final hardening commands before real data activation and go-live.';
comment on view public.v_patch15_final_security_closure_summary is 'Patch 15 final warning and runtime-security closure summary; security_invoker keeps RLS active.';
