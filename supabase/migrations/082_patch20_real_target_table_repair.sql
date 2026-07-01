-- Patch 20 target-table repair
-- Purpose: make the real-data apply path safe when Patch 11 master-data target tables
-- were not present in the target database. This migration is additive, idempotent,
-- does not load data, does not create auth users, and does not weaken RLS.

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

create index if not exists idx_patch20_repair_real_dept_org_scope on public.real_department_master(organization_id, accreditation_scope, is_active);
create index if not exists idx_patch20_repair_real_role_org_module on public.real_role_matrix(organization_id, module_key, is_active);
create index if not exists idx_patch20_repair_real_doc_review on public.real_document_register(organization_id, approval_status, next_review_date);
create index if not exists idx_patch20_repair_real_control_org_domain on public.real_control_library(organization_id, control_domain, is_key_control);

alter table public.real_standard_libraries enable row level security;
alter table public.real_department_master enable row level security;
alter table public.real_committee_master enable row level security;
alter table public.real_role_matrix enable row level security;
alter table public.real_evidence_taxonomy enable row level security;
alter table public.real_control_library enable row level security;
alter table public.real_indicator_catalog enable row level security;
alter table public.real_tracer_templates enable row level security;
alter table public.real_document_register enable row level security;

drop policy if exists real_standard_libraries_org_read on public.real_standard_libraries;
create policy real_standard_libraries_org_read on public.real_standard_libraries for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_standard_libraries_org_insert on public.real_standard_libraries;
create policy real_standard_libraries_org_insert on public.real_standard_libraries for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_standard_libraries_org_update on public.real_standard_libraries;
create policy real_standard_libraries_org_update on public.real_standard_libraries for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

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

drop policy if exists real_control_library_org_read on public.real_control_library;
create policy real_control_library_org_read on public.real_control_library for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_control_library_org_insert on public.real_control_library;
create policy real_control_library_org_insert on public.real_control_library for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists real_control_library_org_update on public.real_control_library;
create policy real_control_library_org_update on public.real_control_library for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

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

comment on table public.real_standard_libraries is 'Patch 20 repair of Patch 11 real standards library target table. No copyrighted standards text is loaded.';
comment on table public.real_department_master is 'Patch 20 repair of Patch 11 real hospital department target table.';
comment on table public.real_role_matrix is 'Patch 20 repair of Patch 11 real role matrix target table.';
comment on table public.real_control_library is 'Patch 20 repair of Patch 11 real control library target table.';

notify pgrst, 'reload schema';
