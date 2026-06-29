-- Patch 11: Real Standards & Master Data Pack
-- Purpose: owner-loaded licensed standards metadata and hospital master data needed to activate accreditation, quality, risk, compliance, audit, and evidence workflows.
-- Important: this migration creates structures and governance controls only. It does not load copyrighted CBAHI/JCI/ISO clause text or fake runtime data.

create extension if not exists pgcrypto;

create table if not exists public.real_standard_libraries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  framework_code text not null,
  framework_name text not null,
  framework_family text not null default 'accreditation'
    check (framework_family in ('accreditation', 'quality', 'risk', 'compliance', 'audit', 'cybersecurity', 'internal_control')),
  authority_name text,
  license_owner_name text,
  license_reference text,
  license_verified boolean not null default false,
  content_load_status text not null default 'not_loaded'
    check (content_load_status in ('not_loaded', 'metadata_only', 'owner_loaded', 'reviewed', 'approved', 'retired')),
  copyright_note text not null default 'No copyrighted standard text is loaded by this migration. Content must be provided by the licensed owner.',
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, framework_code)
);

create table if not exists public.real_standard_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  library_id uuid not null references public.real_standard_libraries(id) on delete cascade,
  version_code text not null,
  version_label text not null,
  effective_date date,
  retirement_date date,
  owner_loaded_content boolean not null default false,
  legal_review_status text not null default 'not_reviewed'
    check (legal_review_status in ('not_reviewed', 'license_confirmed', 'license_rejected', 'not_required')),
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'under_review', 'approved', 'retired')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, library_id, version_code)
);

create table if not exists public.real_standard_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  version_id uuid not null references public.real_standard_versions(id) on delete cascade,
  chapter_code text,
  requirement_code text not null,
  requirement_title text,
  requirement_reference text,
  requirement_level text not null default 'requirement'
    check (requirement_level in ('chapter', 'standard', 'requirement', 'measurable_element', 'note')),
  owner_loaded_summary text,
  requirement_source_status text not null default 'metadata_only'
    check (requirement_source_status in ('metadata_only', 'licensed_owner_loaded', 'mapped_only', 'retired')),
  applicability_status text not null default 'pending'
    check (applicability_status in ('pending', 'applicable', 'not_applicable', 'partially_applicable')),
  responsible_department_code text,
  responsible_department_name text,
  evidence_taxonomy_code text,
  control_code text,
  risk_domain text,
  priority text not null default 'normal'
    check (priority in ('critical', 'high', 'normal', 'low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, version_id, requirement_code)
);

create table if not exists public.real_measurable_elements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requirement_id uuid not null references public.real_standard_requirements(id) on delete cascade,
  element_code text not null,
  element_title text,
  scoring_method text not null default 'met_not_met'
    check (scoring_method in ('met_not_met', 'percentage', 'maturity', 'evidence_based', 'custom')),
  target_score numeric(10,2),
  current_score numeric(10,2),
  score_status text not null default 'not_scored'
    check (score_status in ('not_scored', 'met', 'partially_met', 'not_met', 'not_applicable')),
  required_evidence_count integer not null default 0,
  accepted_evidence_count integer not null default 0,
  last_scored_at timestamptz,
  scorer_name text,
  created_at timestamptz not null default now(),
  unique (organization_id, requirement_id, element_code)
);

create table if not exists public.real_department_master (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  department_code text not null,
  department_name text not null,
  department_name_ar text,
  department_type text not null default 'clinical'
    check (department_type in ('clinical', 'administrative', 'support', 'governance', 'outsourced')),
  parent_department_code text,
  manager_name text,
  manager_user_id uuid,
  accreditation_scope text not null default 'in_scope'
    check (accreditation_scope in ('in_scope', 'out_of_scope', 'partial_scope')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, department_code)
);

create table if not exists public.real_committee_master (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  committee_code text not null,
  committee_name text not null,
  committee_type text not null default 'quality'
    check (committee_type in ('board', 'executive', 'quality', 'patient_safety', 'risk', 'audit', 'compliance', 'it', 'clinical')),
  chair_name text,
  secretary_name text,
  meeting_frequency text,
  charter_document_code text,
  evidence_pack_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, committee_code)
);

create table if not exists public.real_role_matrix (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  role_code text not null,
  role_name text not null,
  module_key text not null,
  responsibility_scope text not null default 'department'
    check (responsibility_scope in ('organization', 'facility', 'department', 'committee', 'self', 'external')),
  can_create boolean not null default false,
  can_review boolean not null default false,
  can_approve boolean not null default false,
  can_close boolean not null default false,
  can_view_external_pack boolean not null default false,
  segregation_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, role_code, module_key)
);

create table if not exists public.real_evidence_taxonomy (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  taxonomy_code text not null,
  taxonomy_name text not null,
  evidence_type text not null default 'document'
    check (evidence_type in ('document', 'policy', 'record', 'screenshot', 'minutes', 'report', 'photo', 'system_export', 'attestation', 'training', 'other')),
  confidentiality_level text not null default 'internal'
    check (confidentiality_level in ('public', 'internal', 'confidential', 'restricted', 'patient_sensitive')),
  retention_years integer,
  owner_department_code text,
  acceptance_criteria text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, taxonomy_code)
);

create table if not exists public.real_survey_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_code text not null,
  cycle_name text not null,
  framework_code text,
  planned_start_date date,
  planned_end_date date,
  survey_type text not null default 'internal_mock'
    check (survey_type in ('internal_mock', 'external_mock', 'official', 'focused_review', 'tracer')),
  cycle_status text not null default 'planned'
    check (cycle_status in ('planned', 'active', 'evidence_collection', 'surveying', 'reporting', 'closed', 'cancelled')),
  owner_name text,
  created_at timestamptz not null default now(),
  unique (organization_id, cycle_code)
);

create table if not exists public.real_indicator_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  indicator_code text not null,
  indicator_name text not null,
  indicator_domain text not null default 'quality'
    check (indicator_domain in ('quality', 'patient_safety', 'infection_control', 'clinical', 'operational', 'risk', 'compliance')),
  numerator_definition text,
  denominator_definition text,
  target_value numeric(12,2),
  target_direction text not null default 'higher_is_better'
    check (target_direction in ('higher_is_better', 'lower_is_better', 'target_range')),
  owner_department_code text,
  reporting_frequency text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, indicator_code)
);

create table if not exists public.real_tracer_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tracer_code text not null,
  tracer_name text not null,
  tracer_type text not null default 'patient_care'
    check (tracer_type in ('patient_care', 'medication', 'infection_control', 'facility_safety', 'document', 'staff_file', 'custom')),
  department_code text,
  linked_requirement_code text,
  observation_checklist jsonb not null default '[]'::jsonb,
  evidence_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, tracer_code)
);

create table if not exists public.real_document_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_code text not null,
  document_title text not null,
  document_type text not null default 'policy'
    check (document_type in ('policy', 'procedure', 'form', 'work_instruction', 'charter', 'manual', 'plan', 'report')),
  owner_department_code text,
  owner_name text,
  current_version text,
  next_review_date date,
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'under_review', 'approved', 'expired', 'retired')),
  evidence_taxonomy_code text,
  created_at timestamptz not null default now(),
  unique (organization_id, document_code)
);

create table if not exists public.real_policy_owners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_code text not null,
  owner_user_id uuid,
  owner_name text not null,
  owner_role text not null default 'responsible'
    check (owner_role in ('responsible', 'accountable', 'reviewer', 'approver', 'custodian')),
  department_code text,
  assigned_at timestamptz not null default now(),
  unique (organization_id, document_code, owner_name, owner_role)
);

create table if not exists public.real_control_library (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  control_code text not null,
  control_name text not null,
  control_domain text not null default 'quality'
    check (control_domain in ('quality', 'risk', 'compliance', 'audit', 'it', 'patient_safety', 'finance', 'operations')),
  control_type text not null default 'detective'
    check (control_type in ('preventive', 'detective', 'corrective', 'directive')),
  control_frequency text,
  control_owner_name text,
  owner_department_code text,
  evidence_taxonomy_code text,
  linked_requirement_code text,
  test_method text,
  is_key_control boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, control_code)
);

create index if not exists idx_real_req_org_status on public.real_standard_requirements(organization_id, applicability_status, priority);
create index if not exists idx_real_me_org_score on public.real_measurable_elements(organization_id, score_status);
create index if not exists idx_real_dept_org_scope on public.real_department_master(organization_id, accreditation_scope, is_active);
create index if not exists idx_real_doc_review on public.real_document_register(organization_id, approval_status, next_review_date);
create index if not exists idx_real_control_org_domain on public.real_control_library(organization_id, control_domain, is_key_control);

alter table public.real_standard_libraries enable row level security;
alter table public.real_standard_versions enable row level security;
alter table public.real_standard_requirements enable row level security;
alter table public.real_measurable_elements enable row level security;
alter table public.real_department_master enable row level security;
alter table public.real_committee_master enable row level security;
alter table public.real_role_matrix enable row level security;
alter table public.real_evidence_taxonomy enable row level security;
alter table public.real_survey_cycles enable row level security;
alter table public.real_indicator_catalog enable row level security;
alter table public.real_tracer_templates enable row level security;
alter table public.real_document_register enable row level security;
alter table public.real_policy_owners enable row level security;
alter table public.real_control_library enable row level security;

-- Explicit org-scoped policies are intentionally repeated so static RLS audits can detect each table.
drop policy if exists real_standard_libraries_org_read on public.real_standard_libraries;
create policy real_standard_libraries_org_read on public.real_standard_libraries for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_standard_libraries_org_insert on public.real_standard_libraries;
create policy real_standard_libraries_org_insert on public.real_standard_libraries for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_standard_libraries_org_update on public.real_standard_libraries;
create policy real_standard_libraries_org_update on public.real_standard_libraries for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_standard_versions_org_read on public.real_standard_versions;
create policy real_standard_versions_org_read on public.real_standard_versions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_standard_versions_org_insert on public.real_standard_versions;
create policy real_standard_versions_org_insert on public.real_standard_versions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_standard_versions_org_update on public.real_standard_versions;
create policy real_standard_versions_org_update on public.real_standard_versions for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_standard_requirements_org_read on public.real_standard_requirements;
create policy real_standard_requirements_org_read on public.real_standard_requirements for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_standard_requirements_org_insert on public.real_standard_requirements;
create policy real_standard_requirements_org_insert on public.real_standard_requirements for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_standard_requirements_org_update on public.real_standard_requirements;
create policy real_standard_requirements_org_update on public.real_standard_requirements for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_measurable_elements_org_read on public.real_measurable_elements;
create policy real_measurable_elements_org_read on public.real_measurable_elements for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_measurable_elements_org_insert on public.real_measurable_elements;
create policy real_measurable_elements_org_insert on public.real_measurable_elements for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_measurable_elements_org_update on public.real_measurable_elements;
create policy real_measurable_elements_org_update on public.real_measurable_elements for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_department_master_org_read on public.real_department_master;
create policy real_department_master_org_read on public.real_department_master for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_department_master_org_insert on public.real_department_master;
create policy real_department_master_org_insert on public.real_department_master for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_department_master_org_update on public.real_department_master;
create policy real_department_master_org_update on public.real_department_master for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_committee_master_org_read on public.real_committee_master;
create policy real_committee_master_org_read on public.real_committee_master for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_committee_master_org_insert on public.real_committee_master;
create policy real_committee_master_org_insert on public.real_committee_master for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_committee_master_org_update on public.real_committee_master;
create policy real_committee_master_org_update on public.real_committee_master for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_role_matrix_org_read on public.real_role_matrix;
create policy real_role_matrix_org_read on public.real_role_matrix for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_role_matrix_org_insert on public.real_role_matrix;
create policy real_role_matrix_org_insert on public.real_role_matrix for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_role_matrix_org_update on public.real_role_matrix;
create policy real_role_matrix_org_update on public.real_role_matrix for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_evidence_taxonomy_org_read on public.real_evidence_taxonomy;
create policy real_evidence_taxonomy_org_read on public.real_evidence_taxonomy for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_evidence_taxonomy_org_insert on public.real_evidence_taxonomy;
create policy real_evidence_taxonomy_org_insert on public.real_evidence_taxonomy for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_evidence_taxonomy_org_update on public.real_evidence_taxonomy;
create policy real_evidence_taxonomy_org_update on public.real_evidence_taxonomy for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_survey_cycles_org_read on public.real_survey_cycles;
create policy real_survey_cycles_org_read on public.real_survey_cycles for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_survey_cycles_org_insert on public.real_survey_cycles;
create policy real_survey_cycles_org_insert on public.real_survey_cycles for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_survey_cycles_org_update on public.real_survey_cycles;
create policy real_survey_cycles_org_update on public.real_survey_cycles for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_indicator_catalog_org_read on public.real_indicator_catalog;
create policy real_indicator_catalog_org_read on public.real_indicator_catalog for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_indicator_catalog_org_insert on public.real_indicator_catalog;
create policy real_indicator_catalog_org_insert on public.real_indicator_catalog for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_indicator_catalog_org_update on public.real_indicator_catalog;
create policy real_indicator_catalog_org_update on public.real_indicator_catalog for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_tracer_templates_org_read on public.real_tracer_templates;
create policy real_tracer_templates_org_read on public.real_tracer_templates for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_tracer_templates_org_insert on public.real_tracer_templates;
create policy real_tracer_templates_org_insert on public.real_tracer_templates for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_tracer_templates_org_update on public.real_tracer_templates;
create policy real_tracer_templates_org_update on public.real_tracer_templates for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_document_register_org_read on public.real_document_register;
create policy real_document_register_org_read on public.real_document_register for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_document_register_org_insert on public.real_document_register;
create policy real_document_register_org_insert on public.real_document_register for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_document_register_org_update on public.real_document_register;
create policy real_document_register_org_update on public.real_document_register for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_policy_owners_org_read on public.real_policy_owners;
create policy real_policy_owners_org_read on public.real_policy_owners for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_policy_owners_org_insert on public.real_policy_owners;
create policy real_policy_owners_org_insert on public.real_policy_owners for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_policy_owners_org_update on public.real_policy_owners;
create policy real_policy_owners_org_update on public.real_policy_owners for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists real_control_library_org_read on public.real_control_library;
create policy real_control_library_org_read on public.real_control_library for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_control_library_org_insert on public.real_control_library;
create policy real_control_library_org_insert on public.real_control_library for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_control_library_org_update on public.real_control_library;
create policy real_control_library_org_update on public.real_control_library for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_real_standards_master_summary
with (security_invoker = true) as
select
  coalesce(l.organization_id, d.organization_id, c.organization_id, e.organization_id, ctl.organization_id) as organization_id,
  count(distinct l.id)::integer as standards_library_count,
  count(distinct l.id) filter (where l.license_verified)::integer as license_verified_count,
  count(distinct r.id)::integer as requirement_count,
  count(distinct m.id)::integer as measurable_element_count,
  count(distinct d.id)::integer as department_count,
  count(distinct c.id)::integer as committee_count,
  count(distinct e.id)::integer as evidence_taxonomy_count,
  count(distinct doc.id)::integer as document_count,
  count(distinct ctl.id)::integer as control_count,
  count(distinct r.id) filter (where r.applicability_status = 'pending')::integer as pending_applicability_count
from public.real_standard_libraries l
full join public.real_department_master d on d.organization_id = l.organization_id
full join public.real_committee_master c on c.organization_id = coalesce(l.organization_id, d.organization_id)
full join public.real_evidence_taxonomy e on e.organization_id = coalesce(l.organization_id, d.organization_id, c.organization_id)
full join public.real_control_library ctl on ctl.organization_id = coalesce(l.organization_id, d.organization_id, c.organization_id, e.organization_id)
left join public.real_standard_versions v on v.library_id = l.id
left join public.real_standard_requirements r on r.version_id = v.id
left join public.real_measurable_elements m on m.requirement_id = r.id
left join public.real_document_register doc on doc.organization_id = coalesce(l.organization_id, d.organization_id, c.organization_id, e.organization_id, ctl.organization_id)
group by coalesce(l.organization_id, d.organization_id, c.organization_id, e.organization_id, ctl.organization_id);

create or replace view public.v_real_standards_readiness_queue
with (security_invoker = true) as
select
  r.organization_id,
  l.framework_code,
  v.version_label,
  r.chapter_code,
  r.requirement_code,
  r.requirement_title,
  r.applicability_status,
  r.responsible_department_name,
  r.priority,
  count(m.id)::integer as measurable_element_count,
  count(m.id) filter (where m.score_status in ('not_scored', 'not_met', 'partially_met'))::integer as open_element_count,
  case
    when r.applicability_status = 'pending' then 'pending_applicability'
    when count(m.id) filter (where m.score_status = 'not_met') > 0 then 'not_met'
    when count(m.id) filter (where m.score_status = 'partially_met') > 0 then 'partially_met'
    when count(m.id) = 0 then 'mapping_needed'
    else 'ready'
  end as readiness_signal
from public.real_standard_requirements r
join public.real_standard_versions v on v.id = r.version_id
join public.real_standard_libraries l on l.id = v.library_id
left join public.real_measurable_elements m on m.requirement_id = r.id
group by r.organization_id, l.framework_code, v.version_label, r.chapter_code, r.requirement_code, r.requirement_title, r.applicability_status, r.responsible_department_name, r.priority;

create or replace view public.v_real_master_data_coverage
with (security_invoker = true) as
select organization_id, 'department'::text as master_data_type, department_code as item_code, department_name as item_name, accreditation_scope as item_status from public.real_department_master
union all
select organization_id, 'committee', committee_code, committee_name, case when is_active then 'active' else 'inactive' end from public.real_committee_master
union all
select organization_id, 'evidence_taxonomy', taxonomy_code, taxonomy_name, confidentiality_level from public.real_evidence_taxonomy
union all
select organization_id, 'document', document_code, document_title, approval_status from public.real_document_register
union all
select organization_id, 'control', control_code, control_name, case when is_key_control then 'key_control' else 'standard_control' end from public.real_control_library;

create or replace view public.v_real_control_evidence_map
with (security_invoker = true) as
select
  ctl.organization_id,
  ctl.control_code,
  ctl.control_name,
  ctl.control_domain,
  ctl.control_owner_name,
  ctl.owner_department_code,
  ctl.evidence_taxonomy_code,
  ev.taxonomy_name as evidence_taxonomy_name,
  ctl.linked_requirement_code,
  ctl.is_key_control,
  case
    when ctl.evidence_taxonomy_code is null then 'missing_evidence_taxonomy'
    when ctl.linked_requirement_code is null then 'missing_requirement_link'
    when ctl.control_owner_name is null then 'missing_owner'
    else 'mapped'
  end as mapping_signal
from public.real_control_library ctl
left join public.real_evidence_taxonomy ev on ev.organization_id = ctl.organization_id and ev.taxonomy_code = ctl.evidence_taxonomy_code;

comment on table public.real_standard_libraries is 'Patch 11 owner-loaded standards library registry. Does not include copyrighted standards text by default.';
comment on table public.real_department_master is 'Patch 11 real hospital department master for accreditation and workflow ownership.';
comment on table public.real_control_library is 'Patch 11 real control library linked to evidence taxonomy and requirements.';
comment on view public.v_real_standards_readiness_queue is 'Patch 11 requirement readiness queue using licensed owner-loaded metadata and measurable element status.';
