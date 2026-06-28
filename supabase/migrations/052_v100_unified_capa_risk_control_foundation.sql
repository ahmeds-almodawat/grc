-- =========================================================
-- GRC Control Center - v10.0
-- Unified CAPA + Risk-Control Foundation
--
-- Purpose:
-- - Strengthen the platform from OVR/Quality workflow into a real GRC foundation.
-- - Add unified CAPA, control library, control testing, compliance obligations,
--   issue register, and audit program foundation.
-- - Extend existing risks, risk_controls, compliance_items, audit_findings
--   without weakening existing RLS or approval gates.
--
-- Safety:
-- - No service-role browser exposure.
-- - No approval/signoff bypass.
-- - No patient identifiers required or introduced.
-- - No delete grants for authenticated users on new v10.0 tables.
-- =========================================================

-- -------------------------
-- Enum guards
-- -------------------------
do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v100_capa_case_status') then
    create type public.v100_capa_case_status as enum (
      'draft','open','containment_in_progress','root_cause_review','action_plan_pending',
      'actions_in_progress','verification_pending','effectiveness_review','closed','cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v100_capa_action_type') then
    create type public.v100_capa_action_type as enum ('containment','corrective','preventive','verification','effectiveness_review');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v100_control_test_type') then
    create type public.v100_control_test_type as enum ('design_effectiveness','operating_effectiveness','walkthrough','substantive','retest');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v100_test_status') then
    create type public.v100_test_status as enum ('planned','in_progress','passed','passed_with_observation','failed','remediation_required','cancelled');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v100_issue_status') then
    create type public.v100_issue_status as enum ('open','triaged','action_required','in_progress','waiting_evidence','under_review','closed','deferred','cancelled');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v100_assurance_rating') then
    create type public.v100_assurance_rating as enum ('effective','partially_effective','ineffective','not_tested','not_applicable');
  end if;
end $$;

-- -------------------------
-- Extend existing risk/control/audit/compliance foundation
-- -------------------------
alter table if exists public.risks
  add column if not exists risk_statement text,
  add column if not exists causes text,
  add column if not exists consequences text,
  add column if not exists risk_appetite text,
  add column if not exists appetite_breached boolean not null default false,
  add column if not exists target_residual_score integer check (target_residual_score is null or target_residual_score between 1 and 25),
  add column if not exists treatment_plan text,
  add column if not exists treatment_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists treatment_due_date date,
  add column if not exists inherent_level public.risk_level not null default 'medium',
  add column if not exists residual_level public.risk_level not null default 'medium',
  add column if not exists kri_summary text,
  add column if not exists control_gap_summary text,
  add column if not exists assurance_summary text,
  add column if not exists v100_maturity_flag boolean not null default false;

alter table if exists public.risk_controls
  add column if not exists control_code text,
  add column if not exists objective text,
  add column if not exists control_nature text not null default 'manual' check (control_nature in ('manual','automated','hybrid')),
  add column if not exists key_control boolean not null default false,
  add column if not exists design_effectiveness public.v100_assurance_rating not null default 'not_tested',
  add column if not exists operating_effectiveness public.v100_assurance_rating not null default 'not_tested',
  add column if not exists last_design_test_id uuid,
  add column if not exists last_operating_test_id uuid,
  add column if not exists control_owner_department_id uuid references public.departments(id) on delete set null,
  add column if not exists standard_reference text,
  add column if not exists v100_maturity_flag boolean not null default false;

create unique index if not exists uq_risk_controls_v100_control_code
  on public.risk_controls (organization_id, lower(trim(control_code)))
  where control_code is not null;

alter table if exists public.compliance_items
  add column if not exists obligation_reference text,
  add column if not exists standard_clause text,
  add column if not exists control_mapping_summary text,
  add column if not exists last_assurance_status public.v100_assurance_rating not null default 'not_tested',
  add column if not exists v100_maturity_flag boolean not null default false;

alter table if exists public.audit_findings
  add column if not exists finding_type text not null default 'audit_finding',
  add column if not exists control_id uuid references public.risk_controls(id) on delete set null,
  add column if not exists risk_id uuid references public.risks(id) on delete set null,
  add column if not exists compliance_item_id uuid references public.compliance_items(id) on delete set null,
  add column if not exists capa_case_id uuid,
  add column if not exists target_closure_date date,
  add column if not exists overdue_reason text,
  add column if not exists v100_maturity_flag boolean not null default false;

-- -------------------------
-- Control library and reusable mappings
-- -------------------------
create table if not exists public.control_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  control_code text,
  title text not null,
  description text,
  objective text,
  control_type public.control_type not null default 'preventive',
  frequency public.control_frequency not null default 'monthly',
  control_nature text not null default 'manual' check (control_nature in ('manual','automated','hybrid')),
  key_control boolean not null default false,
  owner_id uuid references public.profiles(id) on delete set null,
  owner_department_id uuid references public.departments(id) on delete set null,
  standard_reference text,
  policy_id uuid references public.policies(id) on delete set null,
  evidence_required boolean not null default true,
  design_effectiveness public.v100_assurance_rating not null default 'not_tested',
  operating_effectiveness public.v100_assurance_rating not null default 'not_tested',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, control_code)
);

create table if not exists public.risk_control_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  risk_id uuid not null references public.risks(id) on delete cascade,
  control_id uuid references public.risk_controls(id) on delete cascade,
  library_control_id uuid references public.control_library_items(id) on delete cascade,
  mapping_type text not null default 'mitigates' check (mapping_type in ('mitigates','detects','prevents','corrects','monitors','informs')),
  reliance_level text not null default 'medium' check (reliance_level in ('high','medium','low')),
  coverage_notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (control_id is not null or library_control_id is not null)
);

create index if not exists idx_risk_control_mappings_risk on public.risk_control_mappings(risk_id);
create index if not exists idx_risk_control_mappings_control on public.risk_control_mappings(control_id);
create index if not exists idx_risk_control_mappings_library on public.risk_control_mappings(library_control_id);

-- -------------------------
-- Control testing / assurance
-- -------------------------
create table if not exists public.control_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  control_id uuid references public.risk_controls(id) on delete set null,
  library_control_id uuid references public.control_library_items(id) on delete set null,
  risk_id uuid references public.risks(id) on delete set null,
  test_code text,
  test_type public.v100_control_test_type not null default 'operating_effectiveness',
  title text not null,
  objective text,
  testing_period_start date,
  testing_period_end date,
  tester_id uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  population_size integer check (population_size is null or population_size >= 0),
  sample_size integer check (sample_size is null or sample_size >= 0),
  sample_method text,
  pass_count integer not null default 0 check (pass_count >= 0),
  fail_count integer not null default 0 check (fail_count >= 0),
  exceptions_summary text,
  evidence_summary text,
  result_notes text,
  effectiveness public.v100_assurance_rating not null default 'not_tested',
  status public.v100_test_status not null default 'planned',
  remediation_required boolean not null default false,
  linked_capa_case_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, test_code),
  check (control_id is not null or library_control_id is not null)
);

create index if not exists idx_control_tests_control on public.control_tests(control_id);
create index if not exists idx_control_tests_risk on public.control_tests(risk_id);
create index if not exists idx_control_tests_status on public.control_tests(status);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_risk_controls_last_design_test_v100') then
    alter table public.risk_controls
      add constraint fk_risk_controls_last_design_test_v100 foreign key (last_design_test_id) references public.control_tests(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_risk_controls_last_operating_test_v100') then
    alter table public.risk_controls
      add constraint fk_risk_controls_last_operating_test_v100 foreign key (last_operating_test_id) references public.control_tests(id) on delete set null;
  end if;
end $$;

-- -------------------------
-- Unified CAPA / corrective action management
-- -------------------------
create table if not exists public.capa_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capa_code text,
  title text not null,
  description text,
  source_module text not null default 'manual' check (source_module in ('manual','ovr','risk','control_test','audit_finding','compliance','policy','uat_issue','other')),
  source_reference_id uuid,
  ovr_report_id uuid references public.ovr_reports(id) on delete set null,
  risk_id uuid references public.risks(id) on delete set null,
  control_id uuid references public.risk_controls(id) on delete set null,
  control_test_id uuid references public.control_tests(id) on delete set null,
  audit_finding_id uuid references public.audit_findings(id) on delete set null,
  compliance_item_id uuid references public.compliance_items(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  severity public.risk_level not null default 'medium',
  priority public.priority_level not null default 'medium',
  status public.v100_capa_case_status not null default 'open',
  due_date date,
  containment_summary text,
  root_cause text,
  corrective_action_summary text,
  preventive_action_summary text,
  verification_method text,
  effectiveness_due_date date,
  effectiveness_result public.v100_assurance_rating not null default 'not_tested',
  closure_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, capa_code)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_control_tests_linked_capa_case_v100') then
    alter table public.control_tests
      add constraint fk_control_tests_linked_capa_case_v100 foreign key (linked_capa_case_id) references public.capa_cases(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_audit_findings_capa_case_v100') then
    alter table public.audit_findings
      add constraint fk_audit_findings_capa_case_v100 foreign key (capa_case_id) references public.capa_cases(id) on delete set null;
  end if;
end $$;

create table if not exists public.capa_action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capa_case_id uuid not null references public.capa_cases(id) on delete cascade,
  action_type public.v100_capa_action_type not null default 'corrective',
  title text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status public.work_status not null default 'not_started',
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  evidence_required boolean not null default true,
  evidence_summary text,
  delay_reason text,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_capa_cases_source on public.capa_cases(source_module, source_reference_id);
create index if not exists idx_capa_cases_owner on public.capa_cases(owner_id);
create index if not exists idx_capa_cases_status_due on public.capa_cases(status, due_date);
create index if not exists idx_capa_actions_case on public.capa_action_items(capa_case_id);
create index if not exists idx_capa_actions_owner_due on public.capa_action_items(owner_id, due_date);

-- -------------------------
-- Shared issue/finding register
-- -------------------------
create table if not exists public.grc_issue_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issue_code text,
  issue_type text not null default 'general' check (issue_type in ('ovr_gap','risk_issue','control_gap','audit_finding','compliance_gap','policy_gap','uat_bug','general')),
  title text not null,
  description text,
  source_module text not null default 'manual',
  source_reference_id uuid,
  severity public.risk_level not null default 'medium',
  priority public.priority_level not null default 'medium',
  status public.v100_issue_status not null default 'open',
  owner_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  risk_id uuid references public.risks(id) on delete set null,
  control_id uuid references public.risk_controls(id) on delete set null,
  control_test_id uuid references public.control_tests(id) on delete set null,
  compliance_item_id uuid references public.compliance_items(id) on delete set null,
  audit_finding_id uuid references public.audit_findings(id) on delete set null,
  capa_case_id uuid references public.capa_cases(id) on delete set null,
  due_date date,
  resolution_summary text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, issue_code)
);

create index if not exists idx_grc_issue_register_status_due on public.grc_issue_register(status, due_date);
create index if not exists idx_grc_issue_register_owner on public.grc_issue_register(owner_id);

-- -------------------------
-- Compliance obligations register and mappings
-- -------------------------
create table if not exists public.compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obligation_code text,
  regulatory_body text,
  framework text,
  clause_reference text,
  title text not null,
  requirement_text text not null,
  applicability text not null default 'applicable' check (applicability in ('applicable','partially_applicable','not_applicable','under_review')),
  owner_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  risk_level public.risk_level not null default 'medium',
  status public.compliance_status not null default 'not_started',
  review_frequency public.control_frequency not null default 'annual',
  last_reviewed_at timestamptz,
  next_review_date date,
  evidence_required boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, obligation_code)
);

create table if not exists public.compliance_obligation_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obligation_id uuid not null references public.compliance_obligations(id) on delete cascade,
  compliance_item_id uuid references public.compliance_items(id) on delete cascade,
  risk_id uuid references public.risks(id) on delete set null,
  control_id uuid references public.risk_controls(id) on delete set null,
  library_control_id uuid references public.control_library_items(id) on delete set null,
  policy_id uuid references public.policies(id) on delete set null,
  capa_case_id uuid references public.capa_cases(id) on delete set null,
  evidence_file_id uuid references public.evidence_files(id) on delete set null,
  mapping_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    compliance_item_id is not null or risk_id is not null or control_id is not null or
    library_control_id is not null or policy_id is not null or capa_case_id is not null or evidence_file_id is not null
  )
);

create index if not exists idx_compliance_obligations_owner_review on public.compliance_obligations(owner_id, next_review_date);
create index if not exists idx_compliance_mappings_obligation on public.compliance_obligation_mappings(obligation_id);

-- -------------------------
-- Audit program foundation
-- -------------------------
create table if not exists public.audit_universe_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  universe_code text,
  title text not null,
  description text,
  department_id uuid references public.departments(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  inherent_risk public.risk_level not null default 'medium',
  last_audit_date date,
  next_audit_due_date date,
  audit_frequency public.control_frequency not null default 'annual',
  included_in_plan boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, universe_code)
);

create table if not exists public.audit_engagements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  engagement_code text,
  universe_item_id uuid references public.audit_universe_items(id) on delete set null,
  title text not null,
  objective text,
  scope text,
  lead_auditor_id uuid references public.profiles(id) on delete set null,
  auditee_owner_id uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  planned_start_date date,
  planned_end_date date,
  fieldwork_start_date date,
  fieldwork_end_date date,
  status text not null default 'planned' check (status in ('planned','planning','fieldwork','reporting','management_response','follow_up','closed','cancelled')),
  risk_level public.risk_level not null default 'medium',
  report_reference text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, engagement_code)
);

create table if not exists public.audit_workpapers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  engagement_id uuid not null references public.audit_engagements(id) on delete cascade,
  workpaper_code text,
  title text not null,
  procedure_text text,
  result_summary text,
  conclusion text,
  prepared_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','prepared','reviewed','rework_required','closed')),
  evidence_file_id uuid references public.evidence_files(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, workpaper_code)
);

create index if not exists idx_audit_universe_due on public.audit_universe_items(next_audit_due_date);
create index if not exists idx_audit_engagements_status on public.audit_engagements(status, planned_start_date);
create index if not exists idx_audit_workpapers_engagement on public.audit_workpapers(engagement_id);

-- -------------------------
-- Updated-at triggers
-- -------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'control_library_items','risk_control_mappings','control_tests','capa_cases','capa_action_items',
    'grc_issue_register','compliance_obligations','audit_universe_items','audit_engagements','audit_workpapers'
  ] loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', tbl, tbl);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', tbl, tbl);
  end loop;
end $$;

-- -------------------------
-- RLS and grants
-- -------------------------
alter table public.control_library_items enable row level security;
alter table public.risk_control_mappings enable row level security;
alter table public.control_tests enable row level security;
alter table public.capa_cases enable row level security;
alter table public.capa_action_items enable row level security;
alter table public.grc_issue_register enable row level security;
alter table public.compliance_obligations enable row level security;
alter table public.compliance_obligation_mappings enable row level security;
alter table public.audit_universe_items enable row level security;
alter table public.audit_engagements enable row level security;
alter table public.audit_workpapers enable row level security;

grant select, insert, update on public.control_library_items to authenticated;
grant select, insert, update on public.risk_control_mappings to authenticated;
grant select, insert, update on public.control_tests to authenticated;
grant select, insert, update on public.capa_cases to authenticated;
grant select, insert, update on public.capa_action_items to authenticated;
grant select, insert, update on public.grc_issue_register to authenticated;
grant select, insert, update on public.compliance_obligations to authenticated;
grant select, insert, update on public.compliance_obligation_mappings to authenticated;
grant select, insert, update on public.audit_universe_items to authenticated;
grant select, insert, update on public.audit_engagements to authenticated;
grant select, insert, update on public.audit_workpapers to authenticated;

-- Read policies are organization/scope aware. Write policies remain role-gated.
drop policy if exists control_library_items_read_v100 on public.control_library_items;
create policy control_library_items_read_v100 on public.control_library_items
for select using (public.can_access_org(organization_id));

drop policy if exists control_library_items_write_v100 on public.control_library_items;
create policy control_library_items_write_v100 on public.control_library_items
for all using (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists risk_control_mappings_read_v100 on public.risk_control_mappings;
create policy risk_control_mappings_read_v100 on public.risk_control_mappings
for select using (public.can_access_org(organization_id));

drop policy if exists risk_control_mappings_write_v100 on public.risk_control_mappings;
create policy risk_control_mappings_write_v100 on public.risk_control_mappings
for all using (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists control_tests_read_v100 on public.control_tests;
create policy control_tests_read_v100 on public.control_tests
for select using (
  public.can_access_org(organization_id)
  or tester_id = auth.uid()
  or reviewer_id = auth.uid()
);

drop policy if exists control_tests_write_v100 on public.control_tests;
create policy control_tests_write_v100 on public.control_tests
for all using (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer','auditor']::public.app_role[]));

drop policy if exists capa_cases_read_v100 on public.capa_cases;
create policy capa_cases_read_v100 on public.capa_cases
for select using (
  owner_id = auth.uid()
  or created_by = auth.uid()
  or public.can_access_scope(organization_id, null, department_id, null)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);

drop policy if exists capa_cases_write_v100 on public.capa_cases;
create policy capa_cases_write_v100 on public.capa_cases
for all using (
  owner_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','compliance_officer']::public.app_role[])
)
with check (
  owner_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','compliance_officer']::public.app_role[])
);

drop policy if exists capa_action_items_read_v100 on public.capa_action_items;
create policy capa_action_items_read_v100 on public.capa_action_items
for select using (
  owner_id = auth.uid()
  or created_by = auth.uid()
  or public.can_access_org(organization_id)
);

drop policy if exists capa_action_items_write_v100 on public.capa_action_items;
create policy capa_action_items_write_v100 on public.capa_action_items
for all using (
  owner_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','compliance_officer']::public.app_role[])
)
with check (
  owner_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','compliance_officer']::public.app_role[])
);

drop policy if exists grc_issue_register_read_v100 on public.grc_issue_register;
create policy grc_issue_register_read_v100 on public.grc_issue_register
for select using (
  owner_id = auth.uid()
  or created_by = auth.uid()
  or public.can_access_scope(organization_id, null, department_id, null)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);

drop policy if exists grc_issue_register_write_v100 on public.grc_issue_register;
create policy grc_issue_register_write_v100 on public.grc_issue_register
for all using (
  owner_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','compliance_officer','auditor']::public.app_role[])
)
with check (
  owner_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','compliance_officer','auditor']::public.app_role[])
);

drop policy if exists compliance_obligations_read_v100 on public.compliance_obligations;
create policy compliance_obligations_read_v100 on public.compliance_obligations
for select using (
  owner_id = auth.uid()
  or public.can_access_scope(organization_id, null, department_id, null)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);

drop policy if exists compliance_obligations_write_v100 on public.compliance_obligations;
create policy compliance_obligations_write_v100 on public.compliance_obligations
for all using (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists compliance_obligation_mappings_read_v100 on public.compliance_obligation_mappings;
create policy compliance_obligation_mappings_read_v100 on public.compliance_obligation_mappings
for select using (public.can_access_org(organization_id));

drop policy if exists compliance_obligation_mappings_write_v100 on public.compliance_obligation_mappings;
create policy compliance_obligation_mappings_write_v100 on public.compliance_obligation_mappings
for all using (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]));

drop policy if exists audit_universe_items_read_v100 on public.audit_universe_items;
create policy audit_universe_items_read_v100 on public.audit_universe_items
for select using (public.can_access_org(organization_id));

drop policy if exists audit_universe_items_write_v100 on public.audit_universe_items;
create policy audit_universe_items_write_v100 on public.audit_universe_items
for all using (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]));

drop policy if exists audit_engagements_read_v100 on public.audit_engagements;
create policy audit_engagements_read_v100 on public.audit_engagements
for select using (
  lead_auditor_id = auth.uid()
  or auditee_owner_id = auth.uid()
  or public.can_access_scope(organization_id, null, department_id, null)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[])
);

drop policy if exists audit_engagements_write_v100 on public.audit_engagements;
create policy audit_engagements_write_v100 on public.audit_engagements
for all using (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]));

drop policy if exists audit_workpapers_read_v100 on public.audit_workpapers;
create policy audit_workpapers_read_v100 on public.audit_workpapers
for select using (
  prepared_by = auth.uid()
  or reviewed_by = auth.uid()
  or public.can_access_org(organization_id)
);

drop policy if exists audit_workpapers_write_v100 on public.audit_workpapers;
create policy audit_workpapers_write_v100 on public.audit_workpapers
for all using (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]));

-- -------------------------
-- Security-invoker summary views
-- -------------------------
create or replace view public.v100_risk_control_capa_dashboard
with (security_invoker = true)
as
select
  o.id as organization_id,
  o.name_en as organization_name,
  count(distinct r.id) filter (where r.status not in ('closed','cancelled')) as open_risks,
  count(distinct r.id) filter (where r.appetite_breached = true and r.status not in ('closed','cancelled')) as appetite_breaches,
  count(distinct rc.id) filter (where rc.is_active = true) as active_controls,
  count(distinct rc.id) filter (where rc.design_effectiveness = 'ineffective' or rc.operating_effectiveness = 'ineffective') as ineffective_controls,
  count(distinct ct.id) filter (where ct.status in ('failed','remediation_required')) as failed_control_tests,
  count(distinct cc.id) filter (where cc.status not in ('closed','cancelled')) as open_capa_cases,
  count(distinct cai.id) filter (where cai.status not in ('closed','cancelled') and cai.due_date < current_date) as overdue_capa_actions,
  count(distinct co.id) filter (where co.status in ('non_compliant','expired','due_soon','pending_evidence')) as compliance_attention_items,
  count(distinct ae.id) filter (where ae.status not in ('closed','cancelled')) as active_audit_engagements
from public.organizations o
left join public.risks r on r.organization_id = o.id
left join public.risk_controls rc on rc.organization_id = o.id
left join public.control_tests ct on ct.organization_id = o.id
left join public.capa_cases cc on cc.organization_id = o.id
left join public.capa_action_items cai on cai.organization_id = o.id
left join public.compliance_obligations co on co.organization_id = o.id
left join public.audit_engagements ae on ae.organization_id = o.id
group by o.id, o.name_en;

create or replace view public.v100_overdue_capa_actions
with (security_invoker = true)
as
select
  cai.*,
  cc.capa_code,
  cc.title as capa_title,
  cc.severity as capa_severity,
  cc.source_module
from public.capa_action_items cai
join public.capa_cases cc on cc.id = cai.capa_case_id
where cai.status not in ('closed','cancelled')
  and cai.due_date is not null
  and cai.due_date < current_date;

create or replace view public.v100_control_test_effectiveness_summary
with (security_invoker = true)
as
select
  organization_id,
  effectiveness,
  status,
  test_type,
  count(*) as test_count,
  min(testing_period_start) as first_period_start,
  max(testing_period_end) as last_period_end
from public.control_tests
group by organization_id, effectiveness, status, test_type;

grant select on public.v100_risk_control_capa_dashboard to authenticated;
grant select on public.v100_overdue_capa_actions to authenticated;
grant select on public.v100_control_test_effectiveness_summary to authenticated;

-- -------------------------
-- Release evidence marker
-- -------------------------
comment on table public.capa_cases is 'v10.0 unified CAPA cases linked to OVR, risk, control testing, audit findings, and compliance gaps.';
comment on table public.control_tests is 'v10.0 control testing and assurance evidence for design and operating effectiveness.';
comment on table public.control_library_items is 'v10.0 reusable controls library for enterprise risk/control mapping.';
comment on table public.compliance_obligations is 'v10.0 compliance obligations register mapped to controls, risks, evidence, and CAPA.';
comment on table public.audit_engagements is 'v10.0 audit program foundation for planning, fieldwork, reporting, and follow-up.';
