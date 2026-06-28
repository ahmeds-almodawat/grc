-- =========================================================
-- GRC Control Center - v11.0
-- Enterprise GRC Program Suite
--
-- Purpose:
-- - Extend v10.0 CAPA/risk-control foundation into an enterprise GRC program layer.
-- - Add policy/document control, attestations, training, KRI/KPI, vendor risk,
--   regulatory change, risk acceptance, BIA/BCP, board-pack snapshots, and audit follow-up.
-- - Keep the patch additive and controlled. No production approval bypass.
--
-- Prerequisite:
-- - v10.0 migration 052_v100_unified_capa_risk_control_foundation.sql should already be applied.
--
-- Safety:
-- - No service-role browser exposure.
-- - No delete grants for authenticated users on new v11.0 tables.
-- - RLS remains enabled and organization/scope aware.
-- - No patient identifiers required or introduced.
-- =========================================================

-- -------------------------
-- Enum guards
-- -------------------------
do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v110_policy_status') then
    create type public.v110_policy_status as enum ('draft','in_review','approved','published','superseded','retired');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v110_attestation_status') then
    create type public.v110_attestation_status as enum ('not_started','acknowledged','declined','overdue','waived');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v110_training_status') then
    create type public.v110_training_status as enum ('not_started','in_progress','completed','overdue','waived');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v110_vendor_risk_rating') then
    create type public.v110_vendor_risk_rating as enum ('critical','high','medium','low','not_assessed');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v110_bcp_status') then
    create type public.v110_bcp_status as enum ('draft','active','under_review','tested','failed_test','retired');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v110_kri_trend') then
    create type public.v110_kri_trend as enum ('improving','stable','worsening','unknown');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v110_exception_status') then
    create type public.v110_exception_status as enum ('requested','under_review','approved','rejected','expired','closed');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v110_reg_change_status') then
    create type public.v110_reg_change_status as enum ('identified','impact_assessment','action_planning','implemented','closed','not_applicable');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v110_report_status') then
    create type public.v110_report_status as enum ('draft','review','approved','issued','archived');
  end if;
end $$;

-- -------------------------
-- Policy and document control
-- -------------------------
create table if not exists public.v110_policy_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  policy_code text,
  title text not null,
  title_ar text,
  category text not null default 'governance',
  purpose text,
  scope text,
  owner_id uuid references public.profiles(id) on delete set null,
  approver_id uuid references public.profiles(id) on delete set null,
  status public.v110_policy_status not null default 'draft',
  effective_date date,
  next_review_date date,
  retired_at timestamptz,
  linked_risk_id uuid references public.risks(id) on delete set null,
  linked_control_id uuid references public.risk_controls(id) on delete set null,
  linked_compliance_obligation_id uuid references public.compliance_obligations(id) on delete set null,
  requires_attestation boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, policy_code)
);

create table if not exists public.v110_policy_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  policy_id uuid not null references public.v110_policy_documents(id) on delete cascade,
  version_no text not null,
  change_summary text,
  document_url text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  status public.v110_policy_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (policy_id, version_no)
);

create table if not exists public.v110_policy_attestations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  policy_id uuid not null references public.v110_policy_documents(id) on delete cascade,
  version_id uuid references public.v110_policy_versions(id) on delete set null,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  assigned_department_id uuid references public.departments(id) on delete set null,
  due_date date not null,
  status public.v110_attestation_status not null default 'not_started',
  acknowledged_at timestamptz,
  acknowledgement_note text,
  waiver_reason text,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_id, assigned_to, due_date)
);

-- -------------------------
-- Training and compliance attestation
-- -------------------------
create table if not exists public.v110_training_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_code text,
  title text not null,
  title_ar text,
  category text not null default 'compliance',
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  linked_policy_id uuid references public.v110_policy_documents(id) on delete set null,
  linked_compliance_obligation_id uuid references public.compliance_obligations(id) on delete set null,
  recurrence_months integer check (recurrence_months is null or recurrence_months between 1 and 60),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, course_code)
);

create table if not exists public.v110_training_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid not null references public.v110_training_courses(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  assigned_department_id uuid references public.departments(id) on delete set null,
  due_date date not null,
  status public.v110_training_status not null default 'not_started',
  completed_at timestamptz,
  score numeric(6,2) check (score is null or score between 0 and 100),
  evidence_id uuid references public.evidence_files(id) on delete set null,
  waiver_reason text,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, assigned_to, due_date)
);

-- -------------------------
-- Vendor / third-party risk
-- -------------------------
create table if not exists public.v110_vendor_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_code text,
  vendor_name text not null,
  service_category text,
  critical_service boolean not null default false,
  data_access_level text not null default 'none' check (data_access_level in ('none','limited','confidential','patient_or_sensitive','system_admin')),
  business_owner_id uuid references public.profiles(id) on delete set null,
  contract_owner_id uuid references public.profiles(id) on delete set null,
  contract_start_date date,
  contract_end_date date,
  risk_rating public.v110_vendor_risk_rating not null default 'not_assessed',
  last_assessment_date date,
  next_assessment_due date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vendor_code)
);

create table if not exists public.v110_vendor_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null references public.v110_vendor_profiles(id) on delete cascade,
  assessment_date date not null default current_date,
  assessor_id uuid references public.profiles(id) on delete set null,
  inherent_rating public.v110_vendor_risk_rating not null default 'not_assessed',
  residual_rating public.v110_vendor_risk_rating not null default 'not_assessed',
  due_diligence_summary text,
  data_security_review text,
  business_continuity_review text,
  compliance_review text,
  open_issues integer not null default 0 check (open_issues >= 0),
  linked_risk_id uuid references public.risks(id) on delete set null,
  linked_issue_id uuid references public.grc_issue_register(id) on delete set null,
  linked_capa_case_id uuid references public.capa_cases(id) on delete set null,
  next_review_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- -------------------------
-- KRI / KPI monitoring
-- -------------------------
create table if not exists public.v110_kri_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  kri_code text,
  title text not null,
  description text,
  metric_unit text,
  frequency text not null default 'monthly' check (frequency in ('daily','weekly','monthly','quarterly','semiannual','annual')),
  threshold_green numeric,
  threshold_amber numeric,
  threshold_red numeric,
  direction text not null default 'lower_is_better' check (direction in ('lower_is_better','higher_is_better','target_range')),
  owner_id uuid references public.profiles(id) on delete set null,
  linked_risk_id uuid references public.risks(id) on delete set null,
  linked_control_id uuid references public.risk_controls(id) on delete set null,
  linked_obligation_id uuid references public.compliance_obligations(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, kri_code)
);

create table if not exists public.v110_kri_measurements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kri_id uuid not null references public.v110_kri_definitions(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  measured_value numeric not null,
  rating text not null default 'unrated' check (rating in ('green','amber','red','unrated')),
  trend public.v110_kri_trend not null default 'unknown',
  commentary text,
  linked_issue_id uuid references public.grc_issue_register(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kri_id, period_start, period_end)
);

-- -------------------------
-- Regulatory change and exception/risk acceptance
-- -------------------------
create table if not exists public.v110_regulatory_change_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_name text not null,
  reference_no text,
  title text not null,
  description text,
  received_date date not null default current_date,
  effective_date date,
  impact_rating public.risk_level not null default 'medium',
  status public.v110_reg_change_status not null default 'identified',
  owner_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  linked_obligation_id uuid references public.compliance_obligations(id) on delete set null,
  linked_policy_id uuid references public.v110_policy_documents(id) on delete set null,
  linked_control_id uuid references public.risk_controls(id) on delete set null,
  linked_issue_id uuid references public.grc_issue_register(id) on delete set null,
  action_due_date date,
  action_summary text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v110_exception_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  exception_type text not null default 'risk_acceptance' check (exception_type in ('risk_acceptance','control_exception','policy_exception','compliance_waiver','temporary_deviation')),
  status public.v110_exception_status not null default 'requested',
  requester_id uuid references public.profiles(id) on delete set null,
  approver_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  linked_risk_id uuid references public.risks(id) on delete set null,
  linked_control_id uuid references public.risk_controls(id) on delete set null,
  linked_policy_id uuid references public.v110_policy_documents(id) on delete set null,
  linked_obligation_id uuid references public.compliance_obligations(id) on delete set null,
  justification text,
  compensating_controls text,
  start_date date,
  expiry_date date,
  approved_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date is null or start_date is null or expiry_date >= start_date)
);

-- -------------------------
-- Business impact and continuity / resilience
-- -------------------------
create table if not exists public.v110_business_processes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  process_code text,
  process_name text not null,
  process_owner_id uuid references public.profiles(id) on delete set null,
  criticality public.risk_level not null default 'medium',
  max_tolerable_downtime_hours integer check (max_tolerable_downtime_hours is null or max_tolerable_downtime_hours >= 0),
  rto_hours integer check (rto_hours is null or rto_hours >= 0),
  rpo_hours integer check (rpo_hours is null or rpo_hours >= 0),
  dependencies text,
  impact_summary text,
  linked_risk_id uuid references public.risks(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, process_code)
);

create table if not exists public.v110_business_continuity_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid references public.v110_business_processes(id) on delete cascade,
  plan_code text,
  title text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  status public.v110_bcp_status not null default 'draft',
  activation_criteria text,
  recovery_strategy text,
  communication_plan text,
  last_review_date date,
  next_review_date date,
  last_test_date date,
  linked_policy_id uuid references public.v110_policy_documents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plan_code)
);

create table if not exists public.v110_continuity_exercises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.v110_business_continuity_plans(id) on delete cascade,
  exercise_date date not null default current_date,
  exercise_type text not null default 'tabletop' check (exercise_type in ('tabletop','walkthrough','technical','full_interruption','after_action_review')),
  facilitator_id uuid references public.profiles(id) on delete set null,
  result_status text not null default 'planned' check (result_status in ('planned','passed','passed_with_observation','failed','cancelled')),
  observations text,
  improvement_actions text,
  linked_capa_case_id uuid references public.capa_cases(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- -------------------------
-- Audit follow-up, board pack, maturity assessment
-- -------------------------
create table if not exists public.v110_audit_followup_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audit_engagement_id uuid references public.audit_engagements(id) on delete cascade,
  finding_id uuid references public.audit_findings(id) on delete set null,
  issue_id uuid references public.grc_issue_register(id) on delete set null,
  capa_case_id uuid references public.capa_cases(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_date date not null default current_date,
  status public.v100_issue_status not null default 'under_review',
  management_update text,
  evidence_summary text,
  validation_result text,
  next_followup_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.v110_board_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_period_start date not null,
  report_period_end date not null,
  title text not null,
  status public.v110_report_status not null default 'draft',
  prepared_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  executive_summary text,
  risk_summary jsonb not null default '{}'::jsonb,
  control_summary jsonb not null default '{}'::jsonb,
  audit_summary jsonb not null default '{}'::jsonb,
  compliance_summary jsonb not null default '{}'::jsonb,
  quality_summary jsonb not null default '{}'::jsonb,
  generated_from_view text not null default 'v110_enterprise_grc_maturity_dashboard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (report_period_end >= report_period_start)
);

create table if not exists public.v110_program_maturity_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_date date not null default current_date,
  assessor_id uuid references public.profiles(id) on delete set null,
  domain text not null check (domain in ('risk','controls','audit','compliance','quality','policy','vendor','bcp','training','reporting')),
  maturity_score integer not null check (maturity_score between 1 and 5),
  strengths text,
  gaps text,
  target_score integer check (target_score is null or target_score between 1 and 5),
  target_date date,
  linked_issue_id uuid references public.grc_issue_register(id) on delete set null,
  linked_capa_case_id uuid references public.capa_cases(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- -------------------------
-- Indexes
-- -------------------------
create index if not exists idx_v110_policy_documents_org_status on public.v110_policy_documents(organization_id, status, next_review_date);
create index if not exists idx_v110_policy_attestations_due on public.v110_policy_attestations(organization_id, status, due_date);
create index if not exists idx_v110_training_assignments_due on public.v110_training_assignments(organization_id, status, due_date);
create index if not exists idx_v110_vendor_profiles_rating on public.v110_vendor_profiles(organization_id, risk_rating, next_assessment_due);
create index if not exists idx_v110_vendor_assessments_vendor on public.v110_vendor_risk_assessments(vendor_id, assessment_date desc);
create index if not exists idx_v110_kri_measurements_period on public.v110_kri_measurements(kri_id, period_start, period_end);
create index if not exists idx_v110_regulatory_change_status on public.v110_regulatory_change_events(organization_id, status, action_due_date);
create index if not exists idx_v110_exception_expiry on public.v110_exception_acceptances(organization_id, status, expiry_date);
create index if not exists idx_v110_business_processes_criticality on public.v110_business_processes(organization_id, criticality, is_active);
create index if not exists idx_v110_bcp_review on public.v110_business_continuity_plans(organization_id, status, next_review_date);
create index if not exists idx_v110_audit_followup_next on public.v110_audit_followup_reviews(organization_id, status, next_followup_date);
create index if not exists idx_v110_board_report_period on public.v110_board_report_snapshots(organization_id, report_period_start, report_period_end);

-- -------------------------
-- Updated-at triggers
-- -------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'v110_policy_documents','v110_policy_attestations','v110_training_courses','v110_training_assignments',
    'v110_vendor_profiles','v110_kri_definitions','v110_regulatory_change_events','v110_exception_acceptances',
    'v110_business_processes','v110_business_continuity_plans','v110_board_report_snapshots'
  ] loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', tbl, tbl);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', tbl, tbl);
  end loop;
end $$;

-- -------------------------
-- RLS and grants
-- -------------------------
alter table public.v110_policy_documents enable row level security;
alter table public.v110_policy_versions enable row level security;
alter table public.v110_policy_attestations enable row level security;
alter table public.v110_training_courses enable row level security;
alter table public.v110_training_assignments enable row level security;
alter table public.v110_vendor_profiles enable row level security;
alter table public.v110_vendor_risk_assessments enable row level security;
alter table public.v110_kri_definitions enable row level security;
alter table public.v110_kri_measurements enable row level security;
alter table public.v110_regulatory_change_events enable row level security;
alter table public.v110_exception_acceptances enable row level security;
alter table public.v110_business_processes enable row level security;
alter table public.v110_business_continuity_plans enable row level security;
alter table public.v110_continuity_exercises enable row level security;
alter table public.v110_audit_followup_reviews enable row level security;
alter table public.v110_board_report_snapshots enable row level security;
alter table public.v110_program_maturity_assessments enable row level security;

grant select, insert, update on public.v110_policy_documents to authenticated;
grant select, insert, update on public.v110_policy_versions to authenticated;
grant select, insert, update on public.v110_policy_attestations to authenticated;
grant select, insert, update on public.v110_training_courses to authenticated;
grant select, insert, update on public.v110_training_assignments to authenticated;
grant select, insert, update on public.v110_vendor_profiles to authenticated;
grant select, insert, update on public.v110_vendor_risk_assessments to authenticated;
grant select, insert, update on public.v110_kri_definitions to authenticated;
grant select, insert, update on public.v110_kri_measurements to authenticated;
grant select, insert, update on public.v110_regulatory_change_events to authenticated;
grant select, insert, update on public.v110_exception_acceptances to authenticated;
grant select, insert, update on public.v110_business_processes to authenticated;
grant select, insert, update on public.v110_business_continuity_plans to authenticated;
grant select, insert, update on public.v110_continuity_exercises to authenticated;
grant select, insert, update on public.v110_audit_followup_reviews to authenticated;
grant select, insert, update on public.v110_board_report_snapshots to authenticated;
grant select, insert, update on public.v110_program_maturity_assessments to authenticated;

-- Policy/document control
drop policy if exists v110_policy_documents_read on public.v110_policy_documents;
create policy v110_policy_documents_read on public.v110_policy_documents
for select using (public.can_access_scope(organization_id, null, department_id, null) or owner_id = auth.uid());

drop policy if exists v110_policy_documents_write on public.v110_policy_documents;
create policy v110_policy_documents_write on public.v110_policy_documents
for all using (owner_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]))
with check (owner_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists v110_policy_versions_read on public.v110_policy_versions;
create policy v110_policy_versions_read on public.v110_policy_versions
for select using (public.can_access_org(organization_id));

drop policy if exists v110_policy_versions_write on public.v110_policy_versions;
create policy v110_policy_versions_write on public.v110_policy_versions
for all using (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists v110_policy_attestations_read on public.v110_policy_attestations;
create policy v110_policy_attestations_read on public.v110_policy_attestations
for select using (assigned_to = auth.uid() or public.can_access_scope(organization_id, null, assigned_department_id, null));

drop policy if exists v110_policy_attestations_write on public.v110_policy_attestations;
create policy v110_policy_attestations_write on public.v110_policy_attestations
for all using (assigned_to = auth.uid() or public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]))
with check (assigned_to = auth.uid() or public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]));

-- Training
drop policy if exists v110_training_courses_read on public.v110_training_courses;
create policy v110_training_courses_read on public.v110_training_courses
for select using (public.can_access_org(organization_id));

drop policy if exists v110_training_courses_write on public.v110_training_courses;
create policy v110_training_courses_write on public.v110_training_courses
for all using (owner_id = auth.uid() or public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]))
with check (owner_id = auth.uid() or public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists v110_training_assignments_read on public.v110_training_assignments;
create policy v110_training_assignments_read on public.v110_training_assignments
for select using (assigned_to = auth.uid() or public.can_access_scope(organization_id, null, assigned_department_id, null));

drop policy if exists v110_training_assignments_write on public.v110_training_assignments;
create policy v110_training_assignments_write on public.v110_training_assignments
for all using (assigned_to = auth.uid() or public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]))
with check (assigned_to = auth.uid() or public.has_any_role(array['super_admin','governance_admin','compliance_officer','department_manager']::public.app_role[]));

-- Vendor risk
drop policy if exists v110_vendor_profiles_read on public.v110_vendor_profiles;
create policy v110_vendor_profiles_read on public.v110_vendor_profiles
for select using (business_owner_id = auth.uid() or contract_owner_id = auth.uid() or public.can_access_org(organization_id));

drop policy if exists v110_vendor_profiles_write on public.v110_vendor_profiles;
create policy v110_vendor_profiles_write on public.v110_vendor_profiles
for all using (business_owner_id = auth.uid() or contract_owner_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]))
with check (business_owner_id = auth.uid() or contract_owner_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists v110_vendor_risk_assessments_read on public.v110_vendor_risk_assessments;
create policy v110_vendor_risk_assessments_read on public.v110_vendor_risk_assessments
for select using (assessor_id = auth.uid() or public.can_access_org(organization_id));

drop policy if exists v110_vendor_risk_assessments_write on public.v110_vendor_risk_assessments;
create policy v110_vendor_risk_assessments_write on public.v110_vendor_risk_assessments
for all using (assessor_id = auth.uid() or public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]))
with check (assessor_id = auth.uid() or public.has_any_role(array['super_admin','governance_admin','compliance_officer','auditor']::public.app_role[]));

-- KRI/KPI
drop policy if exists v110_kri_definitions_read on public.v110_kri_definitions;
create policy v110_kri_definitions_read on public.v110_kri_definitions
for select using (owner_id = auth.uid() or public.can_access_scope(organization_id, null, department_id, null));

drop policy if exists v110_kri_definitions_write on public.v110_kri_definitions;
create policy v110_kri_definitions_write on public.v110_kri_definitions
for all using (owner_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]))
with check (owner_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists v110_kri_measurements_read on public.v110_kri_measurements;
create policy v110_kri_measurements_read on public.v110_kri_measurements
for select using (public.can_access_org(organization_id));

drop policy if exists v110_kri_measurements_write on public.v110_kri_measurements;
create policy v110_kri_measurements_write on public.v110_kri_measurements
for all using (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer','department_manager']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer','department_manager']::public.app_role[]));

-- Regulatory change and exceptions
drop policy if exists v110_regulatory_change_events_read on public.v110_regulatory_change_events;
create policy v110_regulatory_change_events_read on public.v110_regulatory_change_events
for select using (owner_id = auth.uid() or public.can_access_scope(organization_id, null, department_id, null));

drop policy if exists v110_regulatory_change_events_write on public.v110_regulatory_change_events;
create policy v110_regulatory_change_events_write on public.v110_regulatory_change_events
for all using (owner_id = auth.uid() or public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]))
with check (owner_id = auth.uid() or public.has_any_role(array['super_admin','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists v110_exception_acceptances_read on public.v110_exception_acceptances;
create policy v110_exception_acceptances_read on public.v110_exception_acceptances
for select using (requester_id = auth.uid() or approver_id = auth.uid() or public.can_access_scope(organization_id, null, department_id, null));

drop policy if exists v110_exception_acceptances_write on public.v110_exception_acceptances;
create policy v110_exception_acceptances_write on public.v110_exception_acceptances
for all using (requester_id = auth.uid() or approver_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]))
with check (requester_id = auth.uid() or approver_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]));

-- BCP / resilience
drop policy if exists v110_business_processes_read on public.v110_business_processes;
create policy v110_business_processes_read on public.v110_business_processes
for select using (process_owner_id = auth.uid() or public.can_access_scope(organization_id, null, department_id, null));

drop policy if exists v110_business_processes_write on public.v110_business_processes;
create policy v110_business_processes_write on public.v110_business_processes
for all using (process_owner_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','compliance_officer']::public.app_role[]))
with check (process_owner_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','compliance_officer']::public.app_role[]));

drop policy if exists v110_business_continuity_plans_read on public.v110_business_continuity_plans;
create policy v110_business_continuity_plans_read on public.v110_business_continuity_plans
for select using (owner_id = auth.uid() or public.can_access_org(organization_id));

drop policy if exists v110_business_continuity_plans_write on public.v110_business_continuity_plans;
create policy v110_business_continuity_plans_write on public.v110_business_continuity_plans
for all using (owner_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','compliance_officer']::public.app_role[]))
with check (owner_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','compliance_officer']::public.app_role[]));

drop policy if exists v110_continuity_exercises_read on public.v110_continuity_exercises;
create policy v110_continuity_exercises_read on public.v110_continuity_exercises
for select using (facilitator_id = auth.uid() or public.can_access_org(organization_id));

drop policy if exists v110_continuity_exercises_write on public.v110_continuity_exercises;
create policy v110_continuity_exercises_write on public.v110_continuity_exercises
for all using (facilitator_id = auth.uid() or public.has_any_role(array['super_admin','governance_admin','department_manager','compliance_officer']::public.app_role[]))
with check (facilitator_id = auth.uid() or public.has_any_role(array['super_admin','governance_admin','department_manager','compliance_officer']::public.app_role[]));

-- Audit follow-up, board reports, maturity
drop policy if exists v110_audit_followup_reviews_read on public.v110_audit_followup_reviews;
create policy v110_audit_followup_reviews_read on public.v110_audit_followup_reviews
for select using (reviewer_id = auth.uid() or public.can_access_org(organization_id));

drop policy if exists v110_audit_followup_reviews_write on public.v110_audit_followup_reviews;
create policy v110_audit_followup_reviews_write on public.v110_audit_followup_reviews
for all using (reviewer_id = auth.uid() or public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]))
with check (reviewer_id = auth.uid() or public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists v110_board_report_snapshots_read on public.v110_board_report_snapshots;
create policy v110_board_report_snapshots_read on public.v110_board_report_snapshots
for select using (public.can_access_org(organization_id));

drop policy if exists v110_board_report_snapshots_write on public.v110_board_report_snapshots;
create policy v110_board_report_snapshots_write on public.v110_board_report_snapshots
for all using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists v110_program_maturity_assessments_read on public.v110_program_maturity_assessments;
create policy v110_program_maturity_assessments_read on public.v110_program_maturity_assessments
for select using (assessor_id = auth.uid() or public.can_access_org(organization_id));

drop policy if exists v110_program_maturity_assessments_write on public.v110_program_maturity_assessments;
create policy v110_program_maturity_assessments_write on public.v110_program_maturity_assessments
for all using (assessor_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]))
with check (assessor_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]));

-- -------------------------
-- Security-invoker executive views
-- -------------------------
create or replace view public.v110_enterprise_grc_maturity_dashboard
with (security_invoker = true)
as
select
  o.id as organization_id,
  o.name_en as organization_name,
  count(distinct pd.id) filter (where pd.status in ('draft','in_review','approved','published')) as policy_documents,
  count(distinct pa.id) filter (where pa.status in ('not_started','overdue')) as pending_policy_attestations,
  count(distinct ta.id) filter (where ta.status in ('not_started','in_progress','overdue')) as pending_training_assignments,
  count(distinct vp.id) filter (where vp.risk_rating in ('critical','high')) as high_risk_vendors,
  count(distinct krim.id) filter (where krim.rating = 'red') as red_kri_measurements,
  count(distinct rce.id) filter (where rce.status not in ('closed','not_applicable')) as open_regulatory_changes,
  count(distinct ea.id) filter (where ea.status in ('requested','under_review','approved') and (ea.expiry_date is null or ea.expiry_date >= current_date)) as active_exceptions,
  count(distinct bp.id) filter (where bp.criticality in ('critical','high') and bp.is_active = true) as critical_business_processes,
  count(distinct bcp.id) filter (where bcp.status in ('draft','under_review','failed_test')) as bcp_attention_items,
  count(distinct afu.id) filter (where afu.status not in ('closed','cancelled')) as open_audit_followups,
  count(distinct pma.id) filter (where pma.maturity_score <= 2) as low_maturity_domains
from public.organizations o
left join public.v110_policy_documents pd on pd.organization_id = o.id
left join public.v110_policy_attestations pa on pa.organization_id = o.id
left join public.v110_training_assignments ta on ta.organization_id = o.id
left join public.v110_vendor_profiles vp on vp.organization_id = o.id and vp.is_active = true
left join public.v110_kri_measurements krim on krim.organization_id = o.id
left join public.v110_regulatory_change_events rce on rce.organization_id = o.id
left join public.v110_exception_acceptances ea on ea.organization_id = o.id
left join public.v110_business_processes bp on bp.organization_id = o.id
left join public.v110_business_continuity_plans bcp on bcp.organization_id = o.id
left join public.v110_audit_followup_reviews afu on afu.organization_id = o.id
left join public.v110_program_maturity_assessments pma on pma.organization_id = o.id
group by o.id, o.name_en;

create or replace view public.v110_due_diligence_calendar
with (security_invoker = true)
as
select organization_id, 'policy_review' as item_type, id as source_id, title, owner_id as owner_profile_id, next_review_date as due_date, status::text as status
from public.v110_policy_documents where next_review_date is not null
union all
select organization_id, 'policy_attestation', id, 'Policy attestation: ' || policy_id::text, assigned_to, due_date, status::text
from public.v110_policy_attestations
union all
select organization_id, 'training_assignment', id, 'Training assignment: ' || course_id::text, assigned_to, due_date, status::text
from public.v110_training_assignments
union all
select organization_id, 'vendor_assessment', id, vendor_name, business_owner_id, next_assessment_due, risk_rating::text
from public.v110_vendor_profiles where next_assessment_due is not null
union all
select organization_id, 'bcp_review', id, title, owner_id, next_review_date, status::text
from public.v110_business_continuity_plans where next_review_date is not null
union all
select organization_id, 'regulatory_change_action', id, title, owner_id, action_due_date, status::text
from public.v110_regulatory_change_events where action_due_date is not null;

create or replace view public.v110_board_pack_readiness_view
with (security_invoker = true)
as
select
  d.organization_id,
  d.organization_name,
  case
    when d.pending_policy_attestations = 0
      and d.pending_training_assignments = 0
      and d.red_kri_measurements = 0
      and d.open_regulatory_changes = 0
      and d.bcp_attention_items = 0
    then 'ready'
    when d.red_kri_measurements > 0 or d.bcp_attention_items > 0 or d.high_risk_vendors > 0 then 'attention_required'
    else 'draft_ready'
  end as readiness_status,
  jsonb_build_object(
    'policy_documents', d.policy_documents,
    'pending_policy_attestations', d.pending_policy_attestations,
    'pending_training_assignments', d.pending_training_assignments,
    'high_risk_vendors', d.high_risk_vendors,
    'red_kri_measurements', d.red_kri_measurements,
    'open_regulatory_changes', d.open_regulatory_changes,
    'active_exceptions', d.active_exceptions,
    'critical_business_processes', d.critical_business_processes,
    'bcp_attention_items', d.bcp_attention_items,
    'open_audit_followups', d.open_audit_followups,
    'low_maturity_domains', d.low_maturity_domains
  ) as readiness_metrics
from public.v110_enterprise_grc_maturity_dashboard d;

grant select on public.v110_enterprise_grc_maturity_dashboard to authenticated;
grant select on public.v110_due_diligence_calendar to authenticated;
grant select on public.v110_board_pack_readiness_view to authenticated;

-- -------------------------
-- Evidence marker
-- -------------------------
comment on table public.v110_policy_documents is 'v11.0 Enterprise GRC Program Suite: policy/document control foundation.';
comment on table public.v110_vendor_profiles is 'v11.0 Enterprise GRC Program Suite: third-party/vendor risk foundation.';
comment on view public.v110_enterprise_grc_maturity_dashboard is 'v11.0 security-invoker dashboard summary for controlled pilot UAT and board pack preparation.';
