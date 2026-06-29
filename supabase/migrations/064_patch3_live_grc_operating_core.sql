-- Patch 3: Live GRC Operating Core
-- Purpose: turn risk/control/compliance/CAPA from proof dashboards into controlled live workflows.
-- This migration creates operating workflow tables, organization-scoped RLS, and read models.

create extension if not exists pgcrypto;

create table if not exists public.live_grc_risk_appetite_statements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  appetite_code text not null,
  title text not null,
  category text not null default 'enterprise',
  appetite_statement text not null,
  threshold_low numeric(12,2),
  threshold_high numeric(12,2),
  unit text,
  owner_id uuid,
  owner_name text,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'submitted', 'approved', 'retired')),
  approved_by uuid,
  approved_at timestamptz,
  next_review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, appetite_code)
);

create table if not exists public.live_grc_risk_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  risk_code text not null,
  title text not null,
  description text,
  risk_category text not null default 'operational',
  source_type text,
  source_reference text,
  department_id uuid,
  owner_id uuid,
  owner_name text,
  inherent_likelihood integer not null default 3 check (inherent_likelihood between 1 and 5),
  inherent_impact integer not null default 3 check (inherent_impact between 1 and 5),
  residual_likelihood integer not null default 3 check (residual_likelihood between 1 and 5),
  residual_impact integer not null default 3 check (residual_impact between 1 and 5),
  treatment_strategy text not null default 'mitigate'
    check (treatment_strategy in ('accept', 'avoid', 'transfer', 'mitigate', 'monitor')),
  risk_status text not null default 'open'
    check (risk_status in ('draft', 'open', 'under_treatment', 'accepted', 'closed', 'retired')),
  appetite_statement_id uuid references public.live_grc_risk_appetite_statements(id) on delete set null,
  next_review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, risk_code)
);

create table if not exists public.live_grc_kri_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  risk_id uuid references public.live_grc_risk_register(id) on delete cascade,
  kri_code text not null,
  title text not null,
  metric_unit text,
  warning_threshold numeric(14,2),
  breach_threshold numeric(14,2),
  direction text not null default 'higher_is_worse'
    check (direction in ('higher_is_worse', 'lower_is_worse', 'outside_range_is_worse')),
  frequency text not null default 'monthly',
  owner_id uuid,
  owner_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, kri_code)
);

create table if not exists public.live_grc_kri_readings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  kri_id uuid not null references public.live_grc_kri_definitions(id) on delete cascade,
  reading_date date not null default current_date,
  reading_value numeric(14,2) not null,
  reading_status text not null default 'normal'
    check (reading_status in ('normal', 'warning', 'breach', 'not_available')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.live_grc_control_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  control_code text not null,
  title text not null,
  description text,
  control_type text not null default 'preventive'
    check (control_type in ('preventive', 'detective', 'corrective', 'directive')),
  control_frequency text not null default 'monthly',
  control_owner_id uuid,
  control_owner_name text,
  design_effectiveness text not null default 'not_assessed'
    check (design_effectiveness in ('effective', 'partially_effective', 'ineffective', 'not_assessed')),
  operating_effectiveness text not null default 'not_tested'
    check (operating_effectiveness in ('effective', 'partially_effective', 'ineffective', 'not_tested')),
  control_status text not null default 'active'
    check (control_status in ('draft', 'active', 'needs_remediation', 'retired')),
  next_test_due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, control_code)
);

create table if not exists public.live_grc_risk_control_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  risk_id uuid not null references public.live_grc_risk_register(id) on delete cascade,
  control_id uuid not null references public.live_grc_control_register(id) on delete cascade,
  coverage_type text not null default 'mitigating'
    check (coverage_type in ('mitigating', 'monitoring', 'detecting', 'compensating')),
  coverage_strength text not null default 'partial'
    check (coverage_strength in ('strong', 'partial', 'weak', 'unknown')),
  created_at timestamptz not null default now(),
  unique (organization_id, risk_id, control_id)
);

create table if not exists public.live_grc_control_test_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  control_id uuid not null references public.live_grc_control_register(id) on delete cascade,
  plan_code text not null,
  test_objective text not null,
  test_frequency text not null default 'quarterly',
  sample_method text,
  minimum_sample_size integer not null default 1,
  test_owner_id uuid,
  test_owner_name text,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'approved', 'retired')),
  next_due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plan_code)
);

create table if not exists public.live_grc_control_test_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  test_plan_id uuid not null references public.live_grc_control_test_plans(id) on delete cascade,
  test_period text not null,
  samples_tested integer not null default 0,
  exceptions_found integer not null default 0,
  result_status text not null default 'not_started'
    check (result_status in ('not_started', 'in_progress', 'passed', 'passed_with_exceptions', 'failed')),
  conclusion text,
  tested_by uuid,
  tested_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_grc_control_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  test_result_id uuid not null references public.live_grc_control_test_results(id) on delete cascade,
  exception_title text not null,
  exception_description text not null,
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low')),
  exception_status text not null default 'open'
    check (exception_status in ('open', 'management_response', 'capa_opened', 'closed', 'accepted')),
  owner_id uuid,
  owner_name text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_grc_compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  obligation_code text not null,
  source_authority text not null,
  title text not null,
  description text,
  obligation_type text not null default 'regulatory'
    check (obligation_type in ('regulatory', 'contractual', 'policy', 'standard', 'license')),
  owner_id uuid,
  owner_name text,
  frequency text,
  obligation_status text not null default 'active'
    check (obligation_status in ('draft', 'active', 'under_review', 'retired')),
  next_due_date date,
  linked_requirement_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, obligation_code)
);

create table if not exists public.live_grc_regulatory_change_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  change_code text not null,
  source_authority text not null,
  title text not null,
  summary text,
  published_date date,
  effective_date date,
  change_status text not null default 'triage'
    check (change_status in ('triage', 'impact_assessment', 'action_required', 'closed', 'not_applicable')),
  owner_id uuid,
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, change_code)
);

create table if not exists public.live_grc_regulatory_impact_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  change_event_id uuid not null references public.live_grc_regulatory_change_events(id) on delete cascade,
  affected_process text,
  affected_policy_id uuid,
  affected_control_id uuid references public.live_grc_control_register(id) on delete set null,
  impact_level text not null default 'medium' check (impact_level in ('critical', 'high', 'medium', 'low', 'none')),
  required_action text,
  assessment_status text not null default 'draft'
    check (assessment_status in ('draft', 'submitted', 'approved', 'closed')),
  assessed_by uuid,
  assessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_grc_policy_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  policy_code text not null,
  title text not null,
  policy_owner_id uuid,
  policy_owner_name text,
  policy_status text not null default 'draft'
    check (policy_status in ('draft', 'under_review', 'approved', 'published', 'retired')),
  effective_date date,
  next_review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, policy_code)
);

create table if not exists public.live_grc_policy_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  policy_id uuid not null references public.live_grc_policy_register(id) on delete cascade,
  version_label text not null,
  change_summary text,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'submitted', 'approved', 'retired')),
  approved_by uuid,
  approved_at timestamptz,
  document_url text,
  created_at timestamptz not null default now(),
  unique (policy_id, version_label)
);

create table if not exists public.live_grc_policy_attestations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  policy_version_id uuid not null references public.live_grc_policy_versions(id) on delete cascade,
  attestation_subject_id uuid,
  attestation_subject_name text,
  attestation_status text not null default 'pending'
    check (attestation_status in ('pending', 'acknowledged', 'declined', 'overdue')),
  acknowledged_at timestamptz,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.live_grc_evidence_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_code text not null,
  source_type text not null,
  source_id uuid,
  evidence_title text not null,
  evidence_description text,
  requester_id uuid,
  owner_id uuid,
  owner_name text,
  due_date date,
  request_status text not null default 'requested'
    check (request_status in ('requested', 'submitted', 'accepted', 'rejected', 'cancelled', 'expired')),
  submitted_url text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, request_code)
);

create table if not exists public.live_grc_evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  evidence_request_id uuid not null references public.live_grc_evidence_requests(id) on delete cascade,
  review_decision text not null default 'pending'
    check (review_decision in ('pending', 'accepted', 'rejected', 'needs_revision')),
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.live_grc_capa_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  capa_code text not null,
  source_type text not null,
  source_id uuid,
  title text not null,
  root_cause text,
  corrective_action text not null,
  preventive_action text,
  owner_id uuid,
  owner_name text,
  due_date date,
  capa_status text not null default 'open'
    check (capa_status in ('open', 'in_progress', 'evidence_submitted', 'ready_for_retest', 'closed', 'accepted_risk', 'cancelled')),
  closure_evidence_request_id uuid references public.live_grc_evidence_requests(id) on delete set null,
  closure_approved_by uuid,
  closure_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, capa_code)
);

create table if not exists public.live_grc_capa_retests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  capa_id uuid not null references public.live_grc_capa_register(id) on delete cascade,
  retest_status text not null default 'planned'
    check (retest_status in ('planned', 'passed', 'failed', 'deferred')),
  retest_notes text,
  retested_by uuid,
  retested_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.live_grc_vendor_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  vendor_code text not null,
  vendor_name text not null,
  vendor_type text not null default 'supplier',
  criticality text not null default 'medium' check (criticality in ('critical', 'high', 'medium', 'low')),
  owner_id uuid,
  owner_name text,
  vendor_status text not null default 'active'
    check (vendor_status in ('prospect', 'active', 'under_review', 'suspended', 'retired')),
  next_review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vendor_code)
);

create table if not exists public.live_grc_vendor_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  vendor_id uuid not null references public.live_grc_vendor_register(id) on delete cascade,
  assessment_date date not null default current_date,
  inherent_risk text not null default 'medium' check (inherent_risk in ('critical', 'high', 'medium', 'low')),
  residual_risk text not null default 'medium' check (residual_risk in ('critical', 'high', 'medium', 'low')),
  assessment_status text not null default 'draft'
    check (assessment_status in ('draft', 'submitted', 'approved', 'expired')),
  assessed_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.live_grc_closure_packets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  packet_code text not null,
  requirement_reference text,
  risk_id uuid references public.live_grc_risk_register(id) on delete set null,
  control_id uuid references public.live_grc_control_register(id) on delete set null,
  test_result_id uuid references public.live_grc_control_test_results(id) on delete set null,
  evidence_request_id uuid references public.live_grc_evidence_requests(id) on delete set null,
  evidence_review_id uuid references public.live_grc_evidence_reviews(id) on delete set null,
  capa_id uuid references public.live_grc_capa_register(id) on delete set null,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'submitted', 'approved', 'rejected')),
  closure_status text not null default 'open'
    check (closure_status in ('open', 'ready_for_approval', 'closed', 'reopened')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, packet_code),
  check (
    closure_status <> 'closed'
    or (
      requirement_reference is not null
      and risk_id is not null
      and control_id is not null
      and test_result_id is not null
      and evidence_request_id is not null
      and evidence_review_id is not null
      and approval_status = 'approved'
    )
  )
);

create index if not exists idx_live_grc_risks_org_status on public.live_grc_risk_register(organization_id, risk_status, residual_impact, residual_likelihood);
create index if not exists idx_live_grc_controls_org_status on public.live_grc_control_register(organization_id, control_status, operating_effectiveness);
create index if not exists idx_live_grc_links_org_risk on public.live_grc_risk_control_links(organization_id, risk_id, control_id);
create index if not exists idx_live_grc_tests_org_status on public.live_grc_control_test_results(organization_id, result_status);
create index if not exists idx_live_grc_obligations_org_due on public.live_grc_compliance_obligations(organization_id, obligation_status, next_due_date);
create index if not exists idx_live_grc_capa_org_status on public.live_grc_capa_register(organization_id, capa_status, due_date);
create index if not exists idx_live_grc_evidence_org_status on public.live_grc_evidence_requests(organization_id, request_status, due_date);
create index if not exists idx_live_grc_vendor_org_status on public.live_grc_vendor_register(organization_id, vendor_status, criticality);

alter table public.live_grc_risk_appetite_statements enable row level security;
alter table public.live_grc_risk_register enable row level security;
alter table public.live_grc_kri_definitions enable row level security;
alter table public.live_grc_kri_readings enable row level security;
alter table public.live_grc_control_register enable row level security;
alter table public.live_grc_risk_control_links enable row level security;
alter table public.live_grc_control_test_plans enable row level security;
alter table public.live_grc_control_test_results enable row level security;
alter table public.live_grc_control_exceptions enable row level security;
alter table public.live_grc_compliance_obligations enable row level security;
alter table public.live_grc_regulatory_change_events enable row level security;
alter table public.live_grc_regulatory_impact_assessments enable row level security;
alter table public.live_grc_policy_register enable row level security;
alter table public.live_grc_policy_versions enable row level security;
alter table public.live_grc_policy_attestations enable row level security;
alter table public.live_grc_evidence_requests enable row level security;
alter table public.live_grc_evidence_reviews enable row level security;
alter table public.live_grc_capa_register enable row level security;
alter table public.live_grc_capa_retests enable row level security;
alter table public.live_grc_vendor_register enable row level security;
alter table public.live_grc_vendor_risk_assessments enable row level security;
alter table public.live_grc_closure_packets enable row level security;

do $do$
declare
  table_name text;
  org_expr text := $sql$coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')$sql$;
begin
  foreach table_name in array array[
    'live_grc_risk_appetite_statements',
    'live_grc_risk_register',
    'live_grc_kri_definitions',
    'live_grc_kri_readings',
    'live_grc_control_register',
    'live_grc_risk_control_links',
    'live_grc_control_test_plans',
    'live_grc_control_test_results',
    'live_grc_control_exceptions',
    'live_grc_compliance_obligations',
    'live_grc_regulatory_change_events',
    'live_grc_regulatory_impact_assessments',
    'live_grc_policy_register',
    'live_grc_policy_versions',
    'live_grc_policy_attestations',
    'live_grc_evidence_requests',
    'live_grc_evidence_reviews',
    'live_grc_capa_register',
    'live_grc_capa_retests',
    'live_grc_vendor_register',
    'live_grc_vendor_risk_assessments',
    'live_grc_closure_packets'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_org_read', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (organization_id::text = %s)', table_name || '_org_read', table_name, org_expr);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_insert', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (organization_id::text = %s)', table_name || '_org_insert', table_name, org_expr);
    execute format('drop policy if exists %I on public.%I', table_name || '_org_update', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (organization_id::text = %s) with check (organization_id::text = %s)', table_name || '_org_update', table_name, org_expr, org_expr);
end loop;
end $do$;

-- Explicit org-scoped read policies for static proof on sensitive Patch 3 tables.
-- The loop above creates full org-scoped read/insert/update policies; these make
-- the sensitive table controls visible to the repository static RLS audit.
drop policy if exists live_grc_compliance_obligations_static_read on public.live_grc_compliance_obligations;
create policy live_grc_compliance_obligations_static_read on public.live_grc_compliance_obligations
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_control_exceptions_static_read on public.live_grc_control_exceptions;
create policy live_grc_control_exceptions_static_read on public.live_grc_control_exceptions
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_control_register_static_read on public.live_grc_control_register;
create policy live_grc_control_register_static_read on public.live_grc_control_register
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_control_test_plans_static_read on public.live_grc_control_test_plans;
create policy live_grc_control_test_plans_static_read on public.live_grc_control_test_plans
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_control_test_results_static_read on public.live_grc_control_test_results;
create policy live_grc_control_test_results_static_read on public.live_grc_control_test_results
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_evidence_requests_static_read on public.live_grc_evidence_requests;
create policy live_grc_evidence_requests_static_read on public.live_grc_evidence_requests
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_evidence_reviews_static_read on public.live_grc_evidence_reviews;
create policy live_grc_evidence_reviews_static_read on public.live_grc_evidence_reviews
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_policy_attestations_static_read on public.live_grc_policy_attestations;
create policy live_grc_policy_attestations_static_read on public.live_grc_policy_attestations
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_policy_register_static_read on public.live_grc_policy_register;
create policy live_grc_policy_register_static_read on public.live_grc_policy_register
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_policy_versions_static_read on public.live_grc_policy_versions;
create policy live_grc_policy_versions_static_read on public.live_grc_policy_versions
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_risk_appetite_statements_static_read on public.live_grc_risk_appetite_statements;
create policy live_grc_risk_appetite_statements_static_read on public.live_grc_risk_appetite_statements
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_risk_control_links_static_read on public.live_grc_risk_control_links;
create policy live_grc_risk_control_links_static_read on public.live_grc_risk_control_links
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_risk_register_static_read on public.live_grc_risk_register;
create policy live_grc_risk_register_static_read on public.live_grc_risk_register
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists live_grc_vendor_risk_assessments_static_read on public.live_grc_vendor_risk_assessments;
create policy live_grc_vendor_risk_assessments_static_read on public.live_grc_vendor_risk_assessments
for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_live_grc_operating_summary
with (security_invoker = true) as
select
  coalesce((select count(*) from public.live_grc_risk_register), 0)::integer as risk_count,
  coalesce((select count(*) from public.live_grc_risk_register where risk_status in ('open', 'under_treatment')), 0)::integer as active_risk_count,
  coalesce((select count(*) from public.live_grc_control_register), 0)::integer as control_count,
  coalesce((select count(*) from public.live_grc_control_register where operating_effectiveness in ('ineffective', 'partially_effective')), 0)::integer as weak_control_count,
  coalesce((select count(*) from public.live_grc_compliance_obligations where obligation_status = 'active'), 0)::integer as active_obligation_count,
  coalesce((select count(*) from public.live_grc_capa_register where capa_status not in ('closed', 'cancelled')), 0)::integer as open_capa_count,
  coalesce((select count(*) from public.live_grc_evidence_requests where request_status in ('requested', 'rejected', 'expired')), 0)::integer as evidence_attention_count,
  coalesce((select count(*) from public.live_grc_closure_packets where closure_status = 'closed'), 0)::integer as closed_packet_count;

create or replace view public.v_live_grc_risk_control_map
with (security_invoker = true) as
select
  r.organization_id,
  r.id as risk_id,
  r.risk_code,
  r.title as risk_title,
  (r.residual_likelihood * r.residual_impact) as residual_score,
  r.risk_status,
  c.id as control_id,
  c.control_code,
  c.title as control_title,
  c.design_effectiveness,
  c.operating_effectiveness,
  l.coverage_type,
  l.coverage_strength,
  c.next_test_due_date
from public.live_grc_risk_register r
left join public.live_grc_risk_control_links l on l.risk_id = r.id
left join public.live_grc_control_register c on c.id = l.control_id;

create or replace view public.v_live_grc_capa_queue
with (security_invoker = true) as
select
  organization_id,
  id as capa_id,
  capa_code,
  source_type,
  title,
  owner_name,
  due_date,
  capa_status,
  case
    when due_date is not null and due_date < current_date and capa_status not in ('closed', 'cancelled') then 'overdue'
    when due_date is not null and due_date <= current_date + interval '14 days' and capa_status not in ('closed', 'cancelled') then 'due_soon'
    when capa_status = 'ready_for_retest' then 'ready_for_retest'
    else 'normal'
  end as queue_signal
from public.live_grc_capa_register
where capa_status not in ('closed', 'cancelled');

create or replace view public.v_live_grc_obligation_dashboard
with (security_invoker = true) as
select
  organization_id,
  source_authority,
  obligation_type,
  obligation_status,
  count(*)::integer as obligation_count,
  min(next_due_date) as nearest_due_date
from public.live_grc_compliance_obligations
group by organization_id, source_authority, obligation_type, obligation_status;

comment on table public.live_grc_closure_packets is 'Patch 3 closure enforcement packet. Closed packets require requirement, risk, control, test, evidence review, and approval.';
comment on view public.v_live_grc_operating_summary is 'Patch 3 live GRC operating summary filtered through security_invoker and RLS.';
