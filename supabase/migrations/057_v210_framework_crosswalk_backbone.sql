-- v21.0 Framework Crosswalk + Live GRC Backbone
-- Add-only schema contract for professional framework coverage.
-- This migration intentionally enables RLS without broad authenticated policies.
-- Live UI writes should be routed through reviewed organization-scoped policies or authenticated Edge bridges.

create extension if not exists pgcrypto;

create table if not exists public.v210_frameworks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null default 'governance_risk_compliance',
  version_label text,
  owner_role text,
  certification_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v210_framework_requirements (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.v210_frameworks(id) on delete cascade,
  requirement_code text not null,
  title text not null,
  requirement_text text,
  domain text,
  mandatory_level text not null default 'required',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (framework_id, requirement_code)
);

create table if not exists public.v210_framework_mappings (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.v210_framework_requirements(id) on delete cascade,
  mapped_item_type text not null,
  mapped_item_id uuid,
  mapped_item_code text,
  coverage_status text not null default 'planned'
    check (coverage_status in ('covered', 'partial', 'gap', 'planned', 'not_applicable')),
  control_effectiveness text not null default 'not_tested'
    check (control_effectiveness in ('effective', 'partially_effective', 'ineffective', 'not_tested', 'not_applicable')),
  evidence_status text not null default 'missing'
    check (evidence_status in ('accepted', 'submitted', 'needs_revision', 'missing', 'not_required')),
  owner_name text,
  last_review_date date,
  next_review_date date,
  not_applicable_rationale text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_id, mapped_item_type, mapped_item_code)
);

create table if not exists public.v210_grc_relationships (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid,
  source_code text,
  relationship_type text not null,
  target_type text not null,
  target_id uuid,
  target_code text,
  assurance_rating text not null default 'unrated'
    check (assurance_rating in ('strong', 'moderate', 'limited', 'gap', 'unrated')),
  evidence_required boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (source_type, coalesce(source_code, ''), relationship_type, target_type, coalesce(target_code, ''))
);

create table if not exists public.v210_scope_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  asset_name text not null,
  asset_type text not null default 'process',
  classification text not null default 'internal'
    check (classification in ('public', 'internal', 'confidential', 'restricted')),
  owner_name text,
  criticality text not null default 'medium'
    check (criticality in ('critical', 'high', 'medium', 'low')),
  in_scope boolean not null default true,
  linked_risk_code text,
  linked_control_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_v210_framework_requirements_framework
  on public.v210_framework_requirements(framework_id);

create index if not exists idx_v210_framework_mappings_requirement
  on public.v210_framework_mappings(requirement_id);

create index if not exists idx_v210_framework_mappings_status
  on public.v210_framework_mappings(coverage_status, evidence_status);

create index if not exists idx_v210_grc_relationships_source
  on public.v210_grc_relationships(source_type, source_code);

create index if not exists idx_v210_grc_relationships_target
  on public.v210_grc_relationships(target_type, target_code);

create index if not exists idx_v210_scope_assets_scope
  on public.v210_scope_assets(in_scope, criticality, classification);

alter table public.v210_frameworks enable row level security;
alter table public.v210_framework_requirements enable row level security;
alter table public.v210_framework_mappings enable row level security;
alter table public.v210_grc_relationships enable row level security;
alter table public.v210_scope_assets enable row level security;

comment on table public.v210_frameworks is 'v21 framework and accreditation reference list. RLS enabled; add reviewed org-scoped policies before live UI writes.';
comment on table public.v210_framework_requirements is 'v21 individual framework clauses or requirements used for accreditation crosswalk.';
comment on table public.v210_framework_mappings is 'v21 coverage mapping from requirements to controls, risks, obligations, audits, evidence or CAPA.';
comment on table public.v210_grc_relationships is 'v21 generic traceability graph connecting risk, control, test, evidence, issue, CAPA, audit, compliance and reporting.';
comment on table public.v210_scope_assets is 'v21 in-scope assets, processes, systems or departments for professional GRC and accreditation review.';

insert into public.v210_frameworks (code, name, category, version_label, owner_role, certification_note)
values
  ('ISO_31000', 'ISO 31000 Risk Management', 'risk_management', '2018', 'Risk / Governance', 'Guidance standard; not certifiable, but useful for professional risk process alignment.'),
  ('COSO_ERM', 'COSO Enterprise Risk Management', 'enterprise_risk', '2017', 'Executive / Board', 'Enterprise risk, strategy, performance and reporting reference.'),
  ('ISO_37301', 'ISO 37301 Compliance Management System', 'compliance_management', '2021', 'Compliance', 'Certifiable compliance management system standard.'),
  ('IIA_GIAS', 'IIA Global Internal Audit Standards', 'internal_audit', '2024', 'Internal Audit', 'Internal audit governance, management and engagement reference.'),
  ('ISO_27001', 'ISO 27001 Information Security Management', 'information_security', '2022', 'IT / Security', 'Optional security framework extension.'),
  ('NIST_CSF', 'NIST Cybersecurity Framework', 'cybersecurity', '2.0', 'IT / Security', 'Optional cybersecurity outcomes framework extension.'),
  ('SOC_2', 'SOC 2 Trust Services Criteria', 'assurance', 'TSC', 'Governance / IT', 'Optional trust services evidence mapping extension.'),
  ('CBAHI', 'CBAHI Healthcare Accreditation Crosswalk', 'healthcare_quality', 'current', 'Quality', 'Optional Saudi healthcare accreditation crosswalk.')
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    version_label = excluded.version_label,
    owner_role = excluded.owner_role,
    certification_note = excluded.certification_note,
    updated_at = now();
