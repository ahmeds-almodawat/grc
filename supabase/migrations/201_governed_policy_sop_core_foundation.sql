-- ============================================================================
-- Migration 201: Governed Policy & SOP Backend Core Foundation
-- Establishes structured Policy details, Policy requirements, SOP details,
-- SOP procedure steps, version-scoped applicability, primary policy linkage,
-- locked-version immutability guards (INSERT/UPDATE/DELETE), cross-organization
-- integrity guards, and read-only catalog views.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Governed Policy Details (1:1 with document_versions where type = 'policy')
-- ----------------------------------------------------------------------------
create table if not exists public.governed_policy_details (
  version_id uuid primary key references public.document_versions(id) on delete cascade,
  title_en text not null,
  title_ar text,
  purpose_en text,
  purpose_ar text,
  policy_statement_en text not null,
  policy_statement_ar text,
  scope_en text,
  scope_ar text,
  principles_en text,
  principles_ar text,
  exceptions_summary_en text,
  exceptions_summary_ar text,
  non_compliance_escalation_en text,
  non_compliance_escalation_ar text,
  content_mode text not null default 'structured' check (content_mode in ('structured', 'legacy_controlled_document')),
  transcription_status text not null default 'not_required' check (transcription_status in ('not_required', 'pending', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (content_mode <> 'structured' or transcription_status in ('not_required', 'complete'))
);

-- ----------------------------------------------------------------------------
-- 2. Structured Policy Requirements (Repeatable requirements per Policy version)
-- ----------------------------------------------------------------------------
create table if not exists public.policy_requirements (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.document_versions(id) on delete cascade,
  sequence_number integer not null check (sequence_number >= 1),
  requirement_statement_en text not null,
  requirement_statement_ar text,
  responsible_role text,
  is_mandatory boolean not null default true,
  expected_evidence_en text,
  expected_evidence_ar text,
  mapped_control_id uuid references public.control_library_items(id) on delete set null,
  linked_accreditation_clause_id uuid references public.accreditation_clauses(id) on delete set null,
  monitoring_frequency text check (monitoring_frequency is null or monitoring_frequency in ('continuous','daily','weekly','monthly','quarterly','semi_annually','annually','ad_hoc')),
  monitoring_owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_version_id, sequence_number)
);

-- ----------------------------------------------------------------------------
-- 3. Governed SOP Details (1:1 with document_versions where type = 'sop')
-- ----------------------------------------------------------------------------
create table if not exists public.governed_sop_details (
  version_id uuid primary key references public.document_versions(id) on delete cascade,
  title_en text not null,
  title_ar text,
  process_name_en text not null,
  process_name_ar text,
  process_owner_id uuid references public.profiles(id) on delete set null,
  purpose_en text,
  purpose_ar text,
  scope_en text,
  scope_ar text,
  primary_policy_version_id uuid references public.document_versions(id) on delete set null,
  governance_link_state text not null default 'linked' check (governance_link_state in ('linked', 'legacy_pending', 'not_applicable')),
  training_required boolean not null default false,
  acknowledgment_required boolean not null default false,
  competency_assessment_required boolean not null default false,
  acknowledgment_sla_days integer check (acknowledgment_sla_days is null or acknowledgment_sla_days >= 1),
  training_renewal_months integer check (training_renewal_months is null or training_renewal_months >= 1),
  content_mode text not null default 'structured' check (content_mode in ('structured', 'legacy_controlled_document')),
  transcription_status text not null default 'not_required' check (transcription_status in ('not_required', 'pending', 'complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (governance_link_state = 'linked' and primary_policy_version_id is not null) or
    (governance_link_state = 'legacy_pending') or
    (governance_link_state = 'not_applicable' and primary_policy_version_id is null)
  ),
  check (content_mode <> 'structured' or transcription_status in ('not_required', 'complete'))
);

-- ----------------------------------------------------------------------------
-- 4. SOP Procedure Steps (Ordered steps per SOP version)
-- ----------------------------------------------------------------------------
create table if not exists public.sop_procedure_steps (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references public.document_versions(id) on delete cascade,
  sequence_number integer not null check (sequence_number >= 1),
  responsible_role text not null,
  action_instruction_en text not null,
  action_instruction_ar text,
  required_control_id uuid references public.control_library_items(id) on delete set null,
  expected_evidence_record_en text,
  expected_evidence_record_ar text,
  timing_sla_en text,
  timing_sla_ar text,
  is_decision_point boolean not null default false,
  decision_criteria_en text,
  decision_criteria_ar text,
  criticality text not null default 'medium' check (criticality in ('low','medium','high','critical')),
  escalation_trigger_en text,
  escalation_trigger_ar text,
  escalation_destination_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sop_version_id, sequence_number)
);

-- ----------------------------------------------------------------------------
-- 5. Version-Scoped Applicability (Department & Role/Job-Title Scope)
-- ----------------------------------------------------------------------------
create table if not exists public.document_version_department_scope (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.document_versions(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (version_id, department_id)
);

create table if not exists public.document_version_role_scope (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.document_versions(id) on delete cascade,
  role_name text,
  job_title text,
  created_at timestamptz not null default now(),
  check (
    nullif(trim(coalesce(role_name, '')), '') is not null or
    nullif(trim(coalesce(job_title, '')), '') is not null
  )
);

create unique index if not exists uq_doc_ver_role_scope_unique
on public.document_version_role_scope (
  version_id,
  coalesce(trim(role_name), ''),
  coalesce(trim(job_title), '')
);

-- ----------------------------------------------------------------------------
-- 6. Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_policy_reqs_version on public.policy_requirements(policy_version_id, sequence_number);
create index if not exists idx_policy_reqs_control on public.policy_requirements(mapped_control_id);
create index if not exists idx_policy_reqs_clause on public.policy_requirements(linked_accreditation_clause_id);

create index if not exists idx_sop_details_primary_policy on public.governed_sop_details(primary_policy_version_id);
create index if not exists idx_sop_details_process_owner on public.governed_sop_details(process_owner_id);

create index if not exists idx_sop_steps_version on public.sop_procedure_steps(sop_version_id, sequence_number);
create index if not exists idx_sop_steps_control on public.sop_procedure_steps(required_control_id);

create index if not exists idx_doc_ver_dept_scope_ver on public.document_version_department_scope(version_id);
create index if not exists idx_doc_ver_dept_scope_dept on public.document_version_department_scope(department_id);

create index if not exists idx_doc_ver_role_scope_ver on public.document_version_role_scope(version_id);
create index if not exists idx_doc_ver_role_scope_role on public.document_version_role_scope(role_name);

-- ----------------------------------------------------------------------------
-- 7. Document Type, Primary Policy & Cross-Organization Validation Triggers
-- ----------------------------------------------------------------------------
create or replace function public.validate_policy_version_type()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_type text;
  v_doc_org_id uuid;
  v_version_id uuid;
  v_ref_org_id uuid;
begin
  if TG_TABLE_NAME = 'governed_policy_details' then
    v_version_id := NEW.version_id;
  else
    v_version_id := NEW.policy_version_id;
  end if;

  select d.document_type, d.organization_id into v_doc_type, v_doc_org_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = v_version_id;

  if v_doc_type is null then
    raise exception 'PATCH201_VERSION_NOT_FOUND';
  end if;

  if v_doc_type <> 'policy' then
    raise exception 'PATCH201_POLICY_DETAILS_INVALID_DOCUMENT_TYPE';
  end if;

  -- Cross-organization integrity checks for policy_requirements
  if TG_TABLE_NAME = 'policy_requirements' then
    if NEW.monitoring_owner_id is not null then
      select organization_id into v_ref_org_id
      from public.profiles
      where id = NEW.monitoring_owner_id;

      if v_ref_org_id is distinct from v_doc_org_id then
        raise exception 'PATCH201_CROSS_ORGANIZATION_REFERENCE_DENIED';
      end if;
    end if;

    if NEW.mapped_control_id is not null then
      select organization_id into v_ref_org_id
      from public.control_library_items
      where id = NEW.mapped_control_id;

      if v_ref_org_id is distinct from v_doc_org_id then
        raise exception 'PATCH201_CROSS_ORGANIZATION_REFERENCE_DENIED';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

create or replace function public.validate_sop_version_type()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_type text;
  v_doc_org_id uuid;
  v_primary_doc_type text;
  v_primary_doc_org_id uuid;
  v_version_id uuid;
  v_ref_org_id uuid;
begin
  if TG_TABLE_NAME = 'governed_sop_details' then
    v_version_id := NEW.version_id;
  else
    v_version_id := NEW.sop_version_id;
  end if;

  select d.document_type, d.organization_id into v_doc_type, v_doc_org_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = v_version_id;

  if v_doc_type is null then
    raise exception 'PATCH201_VERSION_NOT_FOUND';
  end if;

  if v_doc_type <> 'sop' then
    raise exception 'PATCH201_SOP_DETAILS_INVALID_DOCUMENT_TYPE';
  end if;

  -- Cross-organization and type checks for governed_sop_details
  if TG_TABLE_NAME = 'governed_sop_details' then
    if NEW.process_owner_id is not null then
      select organization_id into v_ref_org_id
      from public.profiles
      where id = NEW.process_owner_id;

      if v_ref_org_id is distinct from v_doc_org_id then
        raise exception 'PATCH201_CROSS_ORGANIZATION_REFERENCE_DENIED';
      end if;
    end if;

    if NEW.primary_policy_version_id is not null then
      select d.document_type, d.organization_id into v_primary_doc_type, v_primary_doc_org_id
      from public.document_versions v
      join public.controlled_documents d on d.id = v.document_id
      where v.id = NEW.primary_policy_version_id;

      if v_primary_doc_type is null or v_primary_doc_type <> 'policy' then
        raise exception 'PATCH201_PRIMARY_POLICY_VERSION_INVALID_TYPE';
      end if;

      if v_primary_doc_org_id is distinct from v_doc_org_id then
        raise exception 'PATCH201_CROSS_ORGANIZATION_REFERENCE_DENIED';
      end if;
    end if;
  end if;

  -- Cross-organization checks for sop_procedure_steps
  if TG_TABLE_NAME = 'sop_procedure_steps' then
    if NEW.required_control_id is not null then
      select organization_id into v_ref_org_id
      from public.control_library_items
      where id = NEW.required_control_id;

      if v_ref_org_id is distinct from v_doc_org_id then
        raise exception 'PATCH201_CROSS_ORGANIZATION_REFERENCE_DENIED';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

create or replace function public.validate_department_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_org_id uuid;
  v_dept_org_id uuid;
begin
  select d.organization_id into v_doc_org_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = NEW.version_id;

  if v_doc_org_id is null then
    raise exception 'PATCH201_VERSION_NOT_FOUND';
  end if;

  select organization_id into v_dept_org_id
  from public.departments
  where id = NEW.department_id;

  if v_dept_org_id is distinct from v_doc_org_id then
    raise exception 'PATCH201_CROSS_ORGANIZATION_REFERENCE_DENIED';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_validate_policy_details_type on public.governed_policy_details;
create trigger trg_validate_policy_details_type
before insert or update on public.governed_policy_details
for each row execute function public.validate_policy_version_type();

drop trigger if exists trg_validate_policy_requirements_type on public.policy_requirements;
create trigger trg_validate_policy_requirements_type
before insert or update on public.policy_requirements
for each row execute function public.validate_policy_version_type();

drop trigger if exists trg_validate_sop_details_type on public.governed_sop_details;
create trigger trg_validate_sop_details_type
before insert or update on public.governed_sop_details
for each row execute function public.validate_sop_version_type();

drop trigger if exists trg_validate_sop_steps_type on public.sop_procedure_steps;
create trigger trg_validate_sop_steps_type
before insert or update on public.sop_procedure_steps
for each row execute function public.validate_sop_version_type();

drop trigger if exists trg_validate_doc_ver_dept_scope on public.document_version_department_scope;
create trigger trg_validate_doc_ver_dept_scope
before insert or update on public.document_version_department_scope
for each row execute function public.validate_department_scope();

-- ----------------------------------------------------------------------------
-- 8. Version Immutability Guards (Covers INSERT, UPDATE, and DELETE)
-- ----------------------------------------------------------------------------
create or replace function public.enforce_policy_sop_version_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version_id uuid;
  v_locked_at timestamptz;
  v_approved_at timestamptz;
begin
  if TG_TABLE_NAME in ('governed_policy_details', 'governed_sop_details', 'document_version_department_scope', 'document_version_role_scope') then
    v_version_id := coalesce(NEW.version_id, OLD.version_id);
  elsif TG_TABLE_NAME = 'policy_requirements' then
    v_version_id := coalesce(NEW.policy_version_id, OLD.policy_version_id);
  elsif TG_TABLE_NAME = 'sop_procedure_steps' then
    v_version_id := coalesce(NEW.sop_version_id, OLD.sop_version_id);
  end if;

  select v.locked_at, v.approved_at
  into v_locked_at, v_approved_at
  from public.document_versions v
  where v.id = v_version_id;

  -- A version is immutable when locked or approved
  if v_locked_at is not null or v_approved_at is not null then
    raise exception 'PATCH201_VERSION_IMMUTABLE_LOCKED';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_immutability_governed_policy_details on public.governed_policy_details;
create trigger trg_immutability_governed_policy_details
before insert or update or delete on public.governed_policy_details
for each row execute function public.enforce_policy_sop_version_immutability();

drop trigger if exists trg_immutability_policy_requirements on public.policy_requirements;
create trigger trg_immutability_policy_requirements
before insert or update or delete on public.policy_requirements
for each row execute function public.enforce_policy_sop_version_immutability();

drop trigger if exists trg_immutability_governed_sop_details on public.governed_sop_details;
create trigger trg_immutability_governed_sop_details
before insert or update or delete on public.governed_sop_details
for each row execute function public.enforce_policy_sop_version_immutability();

drop trigger if exists trg_immutability_sop_procedure_steps on public.sop_procedure_steps;
create trigger trg_immutability_sop_procedure_steps
before insert or update or delete on public.sop_procedure_steps
for each row execute function public.enforce_policy_sop_version_immutability();

drop trigger if exists trg_immutability_doc_ver_dept_scope on public.document_version_department_scope;
create trigger trg_immutability_doc_ver_dept_scope
before insert or update or delete on public.document_version_department_scope
for each row execute function public.enforce_policy_sop_version_immutability();

drop trigger if exists trg_immutability_doc_ver_role_scope on public.document_version_role_scope;
create trigger trg_immutability_doc_ver_role_scope
before insert or update or delete on public.document_version_role_scope
for each row execute function public.enforce_policy_sop_version_immutability();

-- ----------------------------------------------------------------------------
-- 9. Row Level Security (SELECT-only for authenticated; no direct browser write)
-- ----------------------------------------------------------------------------
alter table public.governed_policy_details enable row level security;
alter table public.policy_requirements enable row level security;
alter table public.governed_sop_details enable row level security;
alter table public.sop_procedure_steps enable row level security;
alter table public.document_version_department_scope enable row level security;
alter table public.document_version_role_scope enable row level security;

-- Authenticated SELECT policies (scoped to organization of parent controlled document)
drop policy if exists governed_policy_details_select on public.governed_policy_details;
create policy governed_policy_details_select on public.governed_policy_details
for select to authenticated
using (exists (
  select 1 from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = governed_policy_details.version_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists policy_requirements_select on public.policy_requirements;
create policy policy_requirements_select on public.policy_requirements
for select to authenticated
using (exists (
  select 1 from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = policy_requirements.policy_version_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists governed_sop_details_select on public.governed_sop_details;
create policy governed_sop_details_select on public.governed_sop_details
for select to authenticated
using (exists (
  select 1 from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = governed_sop_details.version_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists sop_procedure_steps_select on public.sop_procedure_steps;
create policy sop_procedure_steps_select on public.sop_procedure_steps
for select to authenticated
using (exists (
  select 1 from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = sop_procedure_steps.sop_version_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists doc_ver_dept_scope_select on public.document_version_department_scope;
create policy doc_ver_dept_scope_select on public.document_version_department_scope
for select to authenticated
using (exists (
  select 1 from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = document_version_department_scope.version_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists doc_ver_role_scope_select on public.document_version_role_scope;
create policy doc_ver_role_scope_select on public.document_version_role_scope
for select to authenticated
using (exists (
  select 1 from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = document_version_role_scope.version_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

-- ----------------------------------------------------------------------------
-- 10. Read-Only Catalog Views (Security Invoker)
-- ----------------------------------------------------------------------------
create or replace view public.v_governed_policy_catalog as
select
  d.id as document_id,
  d.organization_id,
  d.document_code,
  d.document_title,
  d.document_description,
  d.document_status,
  d.workflow_stage,
  d.department_id,
  dept.name_en as department_name,
  d.document_owner_id,
  owner.full_name_en as document_owner_name,
  d.effective_date,
  d.next_review_date,
  d.expiry_date,
  d.criticality_level,
  d.confidentiality_level,
  v.id as version_id,
  v.version_number,
  v.version_label,
  v.is_current_version,
  v.approved_at,
  v.locked_at,
  p.title_en as version_title_en,
  p.title_ar as version_title_ar,
  p.purpose_en,
  p.purpose_ar,
  p.policy_statement_en,
  p.policy_statement_ar,
  p.scope_en,
  p.scope_ar,
  p.principles_en,
  p.principles_ar,
  p.exceptions_summary_en,
  p.exceptions_summary_ar,
  p.non_compliance_escalation_en,
  p.non_compliance_escalation_ar,
  p.content_mode,
  p.transcription_status,
  (
    select count(*)::integer
    from public.policy_requirements pr
    where pr.policy_version_id = v.id
  ) as requirement_count,
  d.created_at,
  d.updated_at
from public.controlled_documents d
left join public.document_versions v on v.id = d.current_version_id
left join public.governed_policy_details p on p.version_id = v.id
left join public.departments dept on dept.id = d.department_id
left join public.profiles owner on owner.id = d.document_owner_id
where d.document_type = 'policy';

create or replace view public.v_governed_sop_catalog as
select
  d.id as document_id,
  d.organization_id,
  d.document_code,
  d.document_title,
  d.document_description,
  d.document_status,
  d.workflow_stage,
  d.department_id,
  dept.name_en as department_name,
  d.document_owner_id,
  owner.full_name_en as document_owner_name,
  d.effective_date,
  d.next_review_date,
  d.expiry_date,
  d.criticality_level,
  d.confidentiality_level,
  v.id as version_id,
  v.version_number,
  v.version_label,
  v.is_current_version,
  v.approved_at,
  v.locked_at,
  s.title_en as version_title_en,
  s.title_ar as version_title_ar,
  s.process_name_en,
  s.process_name_ar,
  s.process_owner_id,
  proc_owner.full_name_en as process_owner_name,
  s.purpose_en,
  s.purpose_ar,
  s.scope_en,
  s.scope_ar,
  s.primary_policy_version_id,
  pol_doc.document_code as primary_policy_document_code,
  pol_doc.document_title as primary_policy_document_title,
  pol_ver.version_number as primary_policy_version_number,
  s.governance_link_state,
  s.training_required,
  s.acknowledgment_required,
  s.competency_assessment_required,
  s.acknowledgment_sla_days,
  s.training_renewal_months,
  s.content_mode,
  s.transcription_status,
  (
    select count(*)::integer
    from public.sop_procedure_steps st
    where st.sop_version_id = v.id
  ) as step_count,
  d.created_at,
  d.updated_at
from public.controlled_documents d
left join public.document_versions v on v.id = d.current_version_id
left join public.governed_sop_details s on s.version_id = v.id
left join public.departments dept on dept.id = d.department_id
left join public.profiles owner on owner.id = d.document_owner_id
left join public.profiles proc_owner on proc_owner.id = s.process_owner_id
left join public.document_versions pol_ver on pol_ver.id = s.primary_policy_version_id
left join public.controlled_documents pol_doc on pol_doc.id = pol_ver.document_id
where d.document_type = 'sop';

create or replace view public.v_sop_procedure_step_matrix as
select
  st.id as step_id,
  st.sop_version_id,
  v.version_number as sop_version_number,
  d.id as document_id,
  d.organization_id,
  d.document_code,
  d.document_title,
  st.sequence_number,
  st.responsible_role,
  st.action_instruction_en,
  st.action_instruction_ar,
  st.required_control_id,
  ctrl.control_code as required_control_code,
  ctrl.title as required_control_title,
  st.expected_evidence_record_en,
  st.expected_evidence_record_ar,
  st.timing_sla_en,
  st.timing_sla_ar,
  st.is_decision_point,
  st.decision_criteria_en,
  st.decision_criteria_ar,
  st.criticality,
  st.escalation_trigger_en,
  st.escalation_trigger_ar,
  st.escalation_destination_role,
  st.created_at,
  st.updated_at
from public.sop_procedure_steps st
join public.document_versions v on v.id = st.sop_version_id
join public.controlled_documents d on d.id = v.document_id
left join public.control_library_items ctrl on ctrl.id = st.required_control_id;

alter view public.v_governed_policy_catalog set (security_invoker = true);
alter view public.v_governed_sop_catalog set (security_invoker = true);
alter view public.v_sop_procedure_step_matrix set (security_invoker = true);

grant select on public.v_governed_policy_catalog to authenticated;
grant select on public.v_governed_sop_catalog to authenticated;
grant select on public.v_sop_procedure_step_matrix to authenticated;

comment on table public.governed_policy_details is 'Structured Policy version content extension for controlled documents.';
comment on table public.policy_requirements is 'Structured, repeatable Policy requirements bound to a Policy document version.';
comment on table public.governed_sop_details is 'Structured SOP version content extension for controlled documents, including governing Policy linkage and training configuration.';
comment on table public.sop_procedure_steps is 'Structured, sequential SOP procedure steps bound to an SOP document version.';
comment on table public.document_version_department_scope is 'Version-scoped departmental applicability for controlled documents.';
comment on table public.document_version_role_scope is 'Version-scoped role and job-title applicability for controlled documents.';

revoke all on function public.validate_policy_version_type() from public, anon, authenticated;
grant execute on function public.validate_policy_version_type() to service_role;

revoke all on function public.validate_sop_version_type() from public, anon, authenticated;
grant execute on function public.validate_sop_version_type() to service_role;

revoke all on function public.validate_department_scope() from public, anon, authenticated;
grant execute on function public.validate_department_scope() to service_role;

revoke all on function public.enforce_policy_sop_version_immutability() from public, anon, authenticated;
grant execute on function public.enforce_policy_sop_version_immutability() to service_role;
