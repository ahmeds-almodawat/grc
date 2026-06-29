-- Patch 7: Professional Audit, Risk, and Compliance Workbenches
-- Purpose: convert structural GRC tables into day-to-day professional operating workbenches.
-- Scope: audit planning/programs/sampling/workpapers/review notes, risk assessment/treatment, control testing, compliance obligations, policy attestations, issues, management responses, and CAPA retesting.
-- Important: this patch creates workflow-ready operating records only. It does not seed fake runtime data.

create extension if not exists pgcrypto;

create table if not exists public.professional_audit_engagement_workbench (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  engagement_code text not null,
  engagement_title text not null,
  audit_year integer,
  audit_domain text not null default 'general',
  risk_rating text not null default 'medium' check (risk_rating in ('critical','high','medium','low')),
  engagement_stage text not null default 'planning' check (engagement_stage in ('planning','fieldwork','review','management_response','follow_up','closed','cancelled')),
  lead_auditor_id uuid,
  lead_auditor_name text,
  auditee_owner_id uuid,
  auditee_owner_name text,
  planned_start_date date,
  target_report_date date,
  workflow_instance_id uuid,
  approval_status text not null default 'draft' check (approval_status in ('draft','submitted','approved','rejected','returned')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, engagement_code)
);

create table if not exists public.professional_audit_workpaper_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  engagement_id uuid not null references public.professional_audit_engagement_workbench(id) on delete cascade,
  program_code text not null,
  program_title text not null,
  audit_objective text,
  audit_criteria text,
  procedure_count integer not null default 0,
  completed_procedure_count integer not null default 0,
  reviewer_id uuid,
  reviewer_name text,
  review_status text not null default 'not_started' check (review_status in ('not_started','in_progress','submitted','reviewed','returned','approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, engagement_id, program_code)
);

create table if not exists public.professional_audit_sampling_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  engagement_id uuid not null references public.professional_audit_engagement_workbench(id) on delete cascade,
  sample_code text not null,
  population_description text not null,
  population_size integer,
  sample_size integer,
  sampling_method text not null default 'judgmental' check (sampling_method in ('judgmental','random','statistical','full_population','targeted')),
  exception_count integer not null default 0,
  conclusion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, engagement_id, sample_code)
);

create table if not exists public.professional_audit_review_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  engagement_id uuid not null references public.professional_audit_engagement_workbench(id) on delete cascade,
  workpaper_program_id uuid references public.professional_audit_workpaper_programs(id) on delete set null,
  note_code text not null,
  note_title text not null,
  note_body text not null,
  note_status text not null default 'open' check (note_status in ('open','responded','cleared','accepted_risk','closed')),
  reviewer_id uuid,
  reviewer_name text,
  assignee_id uuid,
  assignee_name text,
  due_date date,
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, engagement_id, note_code)
);

create table if not exists public.professional_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  risk_code text not null,
  risk_title text not null,
  risk_category text not null default 'operational',
  inherent_likelihood integer check (inherent_likelihood between 1 and 5),
  inherent_impact integer check (inherent_impact between 1 and 5),
  residual_likelihood integer check (residual_likelihood between 1 and 5),
  residual_impact integer check (residual_impact between 1 and 5),
  appetite_status text not null default 'within_appetite' check (appetite_status in ('within_appetite','near_limit','breached','not_assessed')),
  risk_owner_id uuid,
  risk_owner_name text,
  next_review_date date,
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, risk_code)
);

create table if not exists public.professional_risk_treatment_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  risk_assessment_id uuid not null references public.professional_risk_assessments(id) on delete cascade,
  treatment_code text not null,
  treatment_strategy text not null default 'mitigate' check (treatment_strategy in ('avoid','mitigate','transfer','accept','exploit')),
  treatment_description text not null,
  owner_id uuid,
  owner_name text,
  due_date date,
  treatment_status text not null default 'planned' check (treatment_status in ('planned','in_progress','blocked','implemented','overdue','accepted_risk','cancelled')),
  effectiveness_status text not null default 'not_tested' check (effectiveness_status in ('not_tested','effective','partially_effective','ineffective')),
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, risk_assessment_id, treatment_code)
);

create table if not exists public.professional_control_test_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  control_code text not null,
  control_title text not null,
  related_risk_code text,
  test_cycle text not null,
  test_method text not null default 'inspection' check (test_method in ('inspection','observation','reperformance','inquiry','analytics','walkthrough')),
  tester_id uuid,
  tester_name text,
  planned_test_date date,
  test_status text not null default 'planned' check (test_status in ('planned','in_progress','passed','failed','needs_retest','cancelled')),
  exception_count integer not null default 0,
  evidence_status text not null default 'not_requested' check (evidence_status in ('not_requested','requested','submitted','accepted','rejected')),
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, control_code, test_cycle)
);

create table if not exists public.professional_compliance_obligation_workbench (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  obligation_code text not null,
  obligation_title text not null,
  regulator_name text,
  obligation_area text not null default 'general',
  obligation_status text not null default 'active' check (obligation_status in ('active','under_review','implemented','breached','retired')),
  owner_id uuid,
  owner_name text,
  evidence_due_date date,
  last_review_date date,
  next_review_date date,
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, obligation_code)
);

create table if not exists public.professional_policy_attestation_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campaign_code text not null,
  policy_code text not null,
  campaign_title text not null,
  target_population text,
  required_count integer not null default 0,
  completed_count integer not null default 0,
  exception_count integer not null default 0,
  campaign_status text not null default 'draft' check (campaign_status in ('draft','active','overdue','completed','cancelled')),
  launch_date date,
  due_date date,
  owner_id uuid,
  owner_name text,
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, campaign_code)
);

create table if not exists public.professional_issue_management (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  issue_code text not null,
  issue_title text not null,
  issue_source text not null default 'manual' check (issue_source in ('audit','risk','compliance','quality','accreditation','incident','manual')),
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  issue_status text not null default 'open' check (issue_status in ('open','assigned','in_progress','management_response','remediation','validation','closed','accepted_risk','cancelled')),
  owner_id uuid,
  owner_name text,
  due_date date,
  closure_approval_status text not null default 'not_submitted' check (closure_approval_status in ('not_submitted','submitted','approved','rejected')),
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, issue_code)
);

create table if not exists public.professional_management_response_tracking (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  issue_id uuid not null references public.professional_issue_management(id) on delete cascade,
  response_code text not null,
  response_owner_id uuid,
  response_owner_name text,
  response_text text,
  action_commitment text,
  target_completion_date date,
  response_status text not null default 'requested' check (response_status in ('requested','submitted','returned','accepted','rejected','overdue')),
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, issue_id, response_code)
);

create table if not exists public.professional_capa_retest_closure (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  issue_id uuid references public.professional_issue_management(id) on delete cascade,
  capa_code text not null,
  capa_title text not null,
  capa_owner_id uuid,
  capa_owner_name text,
  due_date date,
  implementation_status text not null default 'planned' check (implementation_status in ('planned','in_progress','implemented','blocked','cancelled','overdue')),
  retest_status text not null default 'not_started' check (retest_status in ('not_started','scheduled','passed','failed','waived')),
  closure_status text not null default 'open' check (closure_status in ('open','submitted','approved','rejected','closed')),
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, capa_code)
);

create index if not exists idx_p7_audit_engagement_status on public.professional_audit_engagement_workbench(organization_id, engagement_stage, risk_rating, target_report_date);
create index if not exists idx_p7_audit_program_engagement on public.professional_audit_workpaper_programs(engagement_id, review_status);
create index if not exists idx_p7_review_notes_status on public.professional_audit_review_notes(organization_id, note_status, due_date);
create index if not exists idx_p7_risk_status on public.professional_risk_assessments(organization_id, appetite_status, next_review_date);
create index if not exists idx_p7_treatment_status on public.professional_risk_treatment_plans(organization_id, treatment_status, due_date);
create index if not exists idx_p7_control_tests_status on public.professional_control_test_cycles(organization_id, test_status, planned_test_date);
create index if not exists idx_p7_compliance_status on public.professional_compliance_obligation_workbench(organization_id, obligation_status, next_review_date);
create index if not exists idx_p7_policy_campaign_status on public.professional_policy_attestation_campaigns(organization_id, campaign_status, due_date);
create index if not exists idx_p7_issues_status on public.professional_issue_management(organization_id, issue_status, severity, due_date);
create index if not exists idx_p7_capa_status on public.professional_capa_retest_closure(organization_id, implementation_status, retest_status, closure_status);

alter table public.professional_audit_engagement_workbench enable row level security;
alter table public.professional_audit_workpaper_programs enable row level security;
alter table public.professional_audit_sampling_plans enable row level security;
alter table public.professional_audit_review_notes enable row level security;
alter table public.professional_risk_assessments enable row level security;
alter table public.professional_risk_treatment_plans enable row level security;
alter table public.professional_control_test_cycles enable row level security;
alter table public.professional_compliance_obligation_workbench enable row level security;
alter table public.professional_policy_attestation_campaigns enable row level security;
alter table public.professional_issue_management enable row level security;
alter table public.professional_management_response_tracking enable row level security;
alter table public.professional_capa_retest_closure enable row level security;


drop policy if exists professional_audit_engagement_workbench_org_read on public.professional_audit_engagement_workbench;
create policy professional_audit_engagement_workbench_org_read on public.professional_audit_engagement_workbench
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_engagement_workbench_org_insert on public.professional_audit_engagement_workbench;
create policy professional_audit_engagement_workbench_org_insert on public.professional_audit_engagement_workbench
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_engagement_workbench_org_update on public.professional_audit_engagement_workbench;
create policy professional_audit_engagement_workbench_org_update on public.professional_audit_engagement_workbench
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_workpaper_programs_org_read on public.professional_audit_workpaper_programs;
create policy professional_audit_workpaper_programs_org_read on public.professional_audit_workpaper_programs
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_workpaper_programs_org_insert on public.professional_audit_workpaper_programs;
create policy professional_audit_workpaper_programs_org_insert on public.professional_audit_workpaper_programs
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_workpaper_programs_org_update on public.professional_audit_workpaper_programs;
create policy professional_audit_workpaper_programs_org_update on public.professional_audit_workpaper_programs
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_sampling_plans_org_read on public.professional_audit_sampling_plans;
create policy professional_audit_sampling_plans_org_read on public.professional_audit_sampling_plans
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_sampling_plans_org_insert on public.professional_audit_sampling_plans;
create policy professional_audit_sampling_plans_org_insert on public.professional_audit_sampling_plans
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_sampling_plans_org_update on public.professional_audit_sampling_plans;
create policy professional_audit_sampling_plans_org_update on public.professional_audit_sampling_plans
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_review_notes_org_read on public.professional_audit_review_notes;
create policy professional_audit_review_notes_org_read on public.professional_audit_review_notes
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_review_notes_org_insert on public.professional_audit_review_notes;
create policy professional_audit_review_notes_org_insert on public.professional_audit_review_notes
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_audit_review_notes_org_update on public.professional_audit_review_notes;
create policy professional_audit_review_notes_org_update on public.professional_audit_review_notes
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_risk_assessments_org_read on public.professional_risk_assessments;
create policy professional_risk_assessments_org_read on public.professional_risk_assessments
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_risk_assessments_org_insert on public.professional_risk_assessments;
create policy professional_risk_assessments_org_insert on public.professional_risk_assessments
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_risk_assessments_org_update on public.professional_risk_assessments;
create policy professional_risk_assessments_org_update on public.professional_risk_assessments
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_risk_treatment_plans_org_read on public.professional_risk_treatment_plans;
create policy professional_risk_treatment_plans_org_read on public.professional_risk_treatment_plans
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_risk_treatment_plans_org_insert on public.professional_risk_treatment_plans;
create policy professional_risk_treatment_plans_org_insert on public.professional_risk_treatment_plans
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_risk_treatment_plans_org_update on public.professional_risk_treatment_plans;
create policy professional_risk_treatment_plans_org_update on public.professional_risk_treatment_plans
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_control_test_cycles_org_read on public.professional_control_test_cycles;
create policy professional_control_test_cycles_org_read on public.professional_control_test_cycles
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_control_test_cycles_org_insert on public.professional_control_test_cycles;
create policy professional_control_test_cycles_org_insert on public.professional_control_test_cycles
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_control_test_cycles_org_update on public.professional_control_test_cycles;
create policy professional_control_test_cycles_org_update on public.professional_control_test_cycles
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_compliance_obligation_workbench_org_read on public.professional_compliance_obligation_workbench;
create policy professional_compliance_obligation_workbench_org_read on public.professional_compliance_obligation_workbench
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_compliance_obligation_workbench_org_insert on public.professional_compliance_obligation_workbench;
create policy professional_compliance_obligation_workbench_org_insert on public.professional_compliance_obligation_workbench
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_compliance_obligation_workbench_org_update on public.professional_compliance_obligation_workbench;
create policy professional_compliance_obligation_workbench_org_update on public.professional_compliance_obligation_workbench
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_policy_attestation_campaigns_org_read on public.professional_policy_attestation_campaigns;
create policy professional_policy_attestation_campaigns_org_read on public.professional_policy_attestation_campaigns
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_policy_attestation_campaigns_org_insert on public.professional_policy_attestation_campaigns;
create policy professional_policy_attestation_campaigns_org_insert on public.professional_policy_attestation_campaigns
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_policy_attestation_campaigns_org_update on public.professional_policy_attestation_campaigns;
create policy professional_policy_attestation_campaigns_org_update on public.professional_policy_attestation_campaigns
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_issue_management_org_read on public.professional_issue_management;
create policy professional_issue_management_org_read on public.professional_issue_management
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_issue_management_org_insert on public.professional_issue_management;
create policy professional_issue_management_org_insert on public.professional_issue_management
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_issue_management_org_update on public.professional_issue_management;
create policy professional_issue_management_org_update on public.professional_issue_management
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_management_response_tracking_org_read on public.professional_management_response_tracking;
create policy professional_management_response_tracking_org_read on public.professional_management_response_tracking
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_management_response_tracking_org_insert on public.professional_management_response_tracking;
create policy professional_management_response_tracking_org_insert on public.professional_management_response_tracking
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_management_response_tracking_org_update on public.professional_management_response_tracking;
create policy professional_management_response_tracking_org_update on public.professional_management_response_tracking
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_capa_retest_closure_org_read on public.professional_capa_retest_closure;
create policy professional_capa_retest_closure_org_read on public.professional_capa_retest_closure
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_capa_retest_closure_org_insert on public.professional_capa_retest_closure;
create policy professional_capa_retest_closure_org_insert on public.professional_capa_retest_closure
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists professional_capa_retest_closure_org_update on public.professional_capa_retest_closure;
create policy professional_capa_retest_closure_org_update on public.professional_capa_retest_closure
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_professional_workbench_summary
with (security_invoker = true) as
select
  org.organization_id,
  coalesce(a.audit_engagement_count, 0)::integer as audit_engagement_count,
  coalesce(a.open_review_note_count, 0)::integer as open_review_note_count,
  coalesce(r.risk_assessment_count, 0)::integer as risk_assessment_count,
  coalesce(r.appetite_breach_count, 0)::integer as appetite_breach_count,
  coalesce(c.control_test_count, 0)::integer as control_test_count,
  coalesce(c.failed_control_test_count, 0)::integer as failed_control_test_count,
  coalesce(o.obligation_count, 0)::integer as obligation_count,
  coalesce(o.breached_obligation_count, 0)::integer as breached_obligation_count,
  coalesce(i.open_issue_count, 0)::integer as open_issue_count,
  coalesce(i.overdue_issue_count, 0)::integer as overdue_issue_count,
  coalesce(cap.open_capa_count, 0)::integer as open_capa_count
from (
  select organization_id from public.professional_audit_engagement_workbench
  union select organization_id from public.professional_risk_assessments
  union select organization_id from public.professional_control_test_cycles
  union select organization_id from public.professional_compliance_obligation_workbench
  union select organization_id from public.professional_issue_management
  union select organization_id from public.professional_capa_retest_closure
) org
left join (
  select e.organization_id,
    count(distinct e.id) as audit_engagement_count,
    count(distinct rn.id) filter (where rn.note_status in ('open','responded')) as open_review_note_count
  from public.professional_audit_engagement_workbench e
  left join public.professional_audit_review_notes rn on rn.engagement_id = e.id
  group by e.organization_id
) a on a.organization_id = org.organization_id
left join (
  select organization_id,
    count(*) as risk_assessment_count,
    count(*) filter (where appetite_status = 'breached') as appetite_breach_count
  from public.professional_risk_assessments
  group by organization_id
) r on r.organization_id = org.organization_id
left join (
  select organization_id,
    count(*) as control_test_count,
    count(*) filter (where test_status = 'failed') as failed_control_test_count
  from public.professional_control_test_cycles
  group by organization_id
) c on c.organization_id = org.organization_id
left join (
  select organization_id,
    count(*) as obligation_count,
    count(*) filter (where obligation_status = 'breached') as breached_obligation_count
  from public.professional_compliance_obligation_workbench
  group by organization_id
) o on o.organization_id = org.organization_id
left join (
  select organization_id,
    count(*) filter (where issue_status not in ('closed','cancelled')) as open_issue_count,
    count(*) filter (where due_date < current_date and issue_status not in ('closed','cancelled')) as overdue_issue_count
  from public.professional_issue_management
  group by organization_id
) i on i.organization_id = org.organization_id
left join (
  select organization_id,
    count(*) filter (where closure_status not in ('closed','approved')) as open_capa_count
  from public.professional_capa_retest_closure
  group by organization_id
) cap on cap.organization_id = org.organization_id;

create or replace view public.v_professional_audit_queue
with (security_invoker = true) as
select
  e.organization_id,
  e.engagement_code,
  e.engagement_title,
  e.audit_domain,
  e.risk_rating,
  e.engagement_stage,
  e.lead_auditor_name,
  e.auditee_owner_name,
  e.target_report_date,
  count(distinct p.id)::integer as program_count,
  count(distinct rn.id) filter (where rn.note_status in ('open','responded'))::integer as open_review_note_count,
  case
    when e.target_report_date is not null and e.target_report_date < current_date and e.engagement_stage not in ('closed','cancelled') then 'overdue'
    when e.risk_rating in ('critical','high') then 'high_risk'
    when count(distinct rn.id) filter (where rn.note_status in ('open','responded')) > 0 then 'review_notes_open'
    else 'normal'
  end as queue_signal
from public.professional_audit_engagement_workbench e
left join public.professional_audit_workpaper_programs p on p.engagement_id = e.id
left join public.professional_audit_review_notes rn on rn.engagement_id = e.id
group by e.organization_id, e.engagement_code, e.engagement_title, e.audit_domain, e.risk_rating, e.engagement_stage, e.lead_auditor_name, e.auditee_owner_name, e.target_report_date;

create or replace view public.v_professional_risk_compliance_queue
with (security_invoker = true) as
select organization_id, 'risk'::text as queue_type, risk_code as item_code, risk_title as item_title, appetite_status as item_status, risk_owner_name as owner_name, next_review_date as due_date,
  case when appetite_status = 'breached' then 'danger' when next_review_date < current_date then 'overdue' else 'normal' end as queue_signal
from public.professional_risk_assessments
union all
select organization_id, 'control_test', control_code, control_title, test_status, tester_name, planned_test_date,
  case when test_status = 'failed' then 'danger' when planned_test_date < current_date and test_status in ('planned','in_progress') then 'overdue' else 'normal' end
from public.professional_control_test_cycles
union all
select organization_id, 'obligation', obligation_code, obligation_title, obligation_status, owner_name, next_review_date,
  case when obligation_status = 'breached' then 'danger' when next_review_date < current_date and obligation_status in ('active','under_review') then 'overdue' else 'normal' end
from public.professional_compliance_obligation_workbench;

create or replace view public.v_professional_issue_capa_queue
with (security_invoker = true) as
select
  i.organization_id,
  i.issue_code,
  i.issue_title,
  i.issue_source,
  i.severity,
  i.issue_status,
  i.owner_name,
  i.due_date,
  count(c.id)::integer as capa_count,
  count(c.id) filter (where c.retest_status = 'failed')::integer as failed_retest_count,
  case
    when i.severity = 'critical' and i.issue_status not in ('closed','cancelled') then 'critical_open'
    when i.due_date is not null and i.due_date < current_date and i.issue_status not in ('closed','cancelled') then 'overdue'
    when count(c.id) filter (where c.retest_status = 'failed') > 0 then 'failed_retest'
    else 'normal'
  end as queue_signal
from public.professional_issue_management i
left join public.professional_capa_retest_closure c on c.issue_id = i.id
group by i.organization_id, i.issue_code, i.issue_title, i.issue_source, i.severity, i.issue_status, i.owner_name, i.due_date;

comment on table public.professional_audit_engagement_workbench is 'Patch 7 professional audit engagement operating workbench.';
comment on table public.professional_risk_assessments is 'Patch 7 professional risk assessment and appetite tracking workbench.';
comment on table public.professional_compliance_obligation_workbench is 'Patch 7 professional compliance obligation operating workbench.';
comment on table public.professional_issue_management is 'Patch 7 cross-module issue management and closure approval workbench.';
comment on view public.v_professional_workbench_summary is 'Patch 7 consolidated professional GRC workbench summary; security_invoker keeps RLS active.';
