-- ============================================================================
-- Migration 203: Governed SOP Structured Content Expansion
-- Extends Governed SOP persistence with:
-- 1. Definitions & Abbreviations (sop_definitions)
-- 2. Structured Roles & Responsibilities Matrix (sop_role_responsibilities)
-- 3. SOP Monitoring & Performance Indicators (sop_monitoring_kpis)
-- Integrates version immutability, SOP type integrity, RLS, cross-version child
-- containment, draft creation, atomic saving, and revision cloning.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SOP Definitions & Abbreviations (1:N with document_versions where type = 'sop')
-- ----------------------------------------------------------------------------
create table if not exists public.sop_definitions (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references public.document_versions(id) on delete cascade,
  sequence_number integer not null check (sequence_number >= 1),
  term_en text,
  term_ar text,
  abbreviation text,
  definition_en text not null,
  definition_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sop_version_id, sequence_number),
  check (
    nullif(trim(coalesce(term_en, '')), '') is not null or
    nullif(trim(coalesce(term_ar, '')), '') is not null or
    nullif(trim(coalesce(abbreviation, '')), '') is not null
  )
);

create index if not exists idx_sop_definitions_version on public.sop_definitions(sop_version_id, sequence_number);

-- ----------------------------------------------------------------------------
-- 2. SOP Roles & Responsibilities Matrix (1:N with document_versions where type = 'sop')
-- ----------------------------------------------------------------------------
create table if not exists public.sop_role_responsibilities (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references public.document_versions(id) on delete cascade,
  sequence_number integer not null check (sequence_number >= 1),
  role_name text,
  job_title text,
  responsibility_en text not null,
  responsibility_ar text,
  accountable_for_en text,
  accountable_for_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sop_version_id, sequence_number),
  check (
    nullif(trim(coalesce(role_name, '')), '') is not null or
    nullif(trim(coalesce(job_title, '')), '') is not null
  )
);

create index if not exists idx_sop_role_responsibilities_version on public.sop_role_responsibilities(sop_version_id, sequence_number);

-- ----------------------------------------------------------------------------
-- 3. SOP Monitoring & Performance Indicators (1:N with document_versions where type = 'sop')
-- ----------------------------------------------------------------------------
create table if not exists public.sop_monitoring_kpis (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references public.document_versions(id) on delete cascade,
  sequence_number integer not null check (sequence_number >= 1),
  kpi_name_en text not null,
  kpi_name_ar text,
  target_value text not null,
  measurement_frequency text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  description_en text,
  description_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sop_version_id, sequence_number)
);

create index if not exists idx_sop_monitoring_kpis_version on public.sop_monitoring_kpis(sop_version_id, sequence_number);
create index if not exists idx_sop_monitoring_kpis_owner on public.sop_monitoring_kpis(owner_id);

-- ----------------------------------------------------------------------------
-- 4. SOP Version Type & Cross-Organization Validation Trigger Function Update
-- ----------------------------------------------------------------------------
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

  -- Cross-organization checks for sop_monitoring_kpis
  if TG_TABLE_NAME = 'sop_monitoring_kpis' then
    if NEW.owner_id is not null then
      select organization_id into v_ref_org_id
      from public.profiles
      where id = NEW.owner_id;

      if v_ref_org_id is distinct from v_doc_org_id then
        raise exception 'PATCH201_CROSS_ORGANIZATION_REFERENCE_DENIED';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_validate_sop_definitions_type on public.sop_definitions;
create trigger trg_validate_sop_definitions_type
before insert or update on public.sop_definitions
for each row execute function public.validate_sop_version_type();

drop trigger if exists trg_validate_sop_responsibilities_type on public.sop_role_responsibilities;
create trigger trg_validate_sop_responsibilities_type
before insert or update on public.sop_role_responsibilities
for each row execute function public.validate_sop_version_type();

drop trigger if exists trg_validate_sop_kpis_type on public.sop_monitoring_kpis;
create trigger trg_validate_sop_kpis_type
before insert or update on public.sop_monitoring_kpis
for each row execute function public.validate_sop_version_type();

-- ----------------------------------------------------------------------------
-- 5. Immutability Trigger Function Update & Attachment
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
  elsif TG_TABLE_NAME in ('sop_procedure_steps', 'sop_definitions', 'sop_role_responsibilities', 'sop_monitoring_kpis') then
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

drop trigger if exists trg_immutability_sop_definitions on public.sop_definitions;
create trigger trg_immutability_sop_definitions
before insert or update or delete on public.sop_definitions
for each row execute function public.enforce_policy_sop_version_immutability();

drop trigger if exists trg_immutability_sop_role_responsibilities on public.sop_role_responsibilities;
create trigger trg_immutability_sop_role_responsibilities
before insert or update or delete on public.sop_role_responsibilities
for each row execute function public.enforce_policy_sop_version_immutability();

drop trigger if exists trg_immutability_sop_monitoring_kpis on public.sop_monitoring_kpis;
create trigger trg_immutability_sop_monitoring_kpis
before insert or update or delete on public.sop_monitoring_kpis
for each row execute function public.enforce_policy_sop_version_immutability();

-- ----------------------------------------------------------------------------
-- 6. Row Level Security (SELECT-only for authenticated in parent organization)
-- ----------------------------------------------------------------------------
alter table public.sop_definitions enable row level security;
alter table public.sop_role_responsibilities enable row level security;
alter table public.sop_monitoring_kpis enable row level security;

drop policy if exists sop_definitions_select on public.sop_definitions;
create policy sop_definitions_select on public.sop_definitions
for select to authenticated
using (exists (
  select 1 from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = sop_definitions.sop_version_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists sop_role_responsibilities_select on public.sop_role_responsibilities;
create policy sop_role_responsibilities_select on public.sop_role_responsibilities
for select to authenticated
using (exists (
  select 1 from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = sop_role_responsibilities.sop_version_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

drop policy if exists sop_monitoring_kpis_select on public.sop_monitoring_kpis;
create policy sop_monitoring_kpis_select on public.sop_monitoring_kpis
for select to authenticated
using (exists (
  select 1 from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = sop_monitoring_kpis.sop_version_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

-- ----------------------------------------------------------------------------
-- 7. Governed SOP Draft Creation RPC Extension
-- ----------------------------------------------------------------------------
-- Drop obsolete Migration-202 25-parameter signature to prevent stale overload bypass
drop function if exists public.create_governed_sop_draft(
  uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, uuid[], jsonb
);

create or replace function public.create_governed_sop_draft(
  p_actor_id uuid,
  p_organization_id uuid,
  p_title_en text,
  p_title_ar text,
  p_process_name_en text,
  p_process_name_ar text,
  p_purpose_en text,
  p_purpose_ar text,
  p_process_owner_id uuid,
  p_primary_policy_version_id uuid default null,
  p_governance_link_state text default 'linked',
  p_scope_en text default null,
  p_scope_ar text default null,
  p_department_id uuid default null,
  p_criticality_level text default 'medium',
  p_confidentiality_level text default 'internal',
  p_training_required boolean default false,
  p_acknowledgment_required boolean default false,
  p_competency_assessment_required boolean default false,
  p_acknowledgment_sla_days integer default 30,
  p_training_renewal_months integer default 12,
  p_content_mode text default 'structured',
  p_procedure_steps jsonb default '[]'::jsonb,
  p_department_scopes uuid[] default '{}'::uuid[],
  p_role_scopes jsonb default '[]'::jsonb,
  p_definitions jsonb default '[]'::jsonb,
  p_role_responsibilities jsonb default '[]'::jsonb,
  p_monitoring_kpis jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_ver_id uuid;
  v_dept_code text;
  v_doc_code text;
  v_step jsonb;
  v_role jsonb;
  v_dept_id uuid;
  v_def jsonb;
  v_resp jsonb;
  v_kpi jsonb;
  v_seq integer;
begin
  -- Validate actor
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and organization_id = p_organization_id and active_flag = true
  ) then
    raise exception 'PATCH202_ACTOR_NOT_AUTHORIZED';
  end if;

  if p_department_id is not null then
    select code into v_dept_code from public.departments where id = p_department_id and organization_id = p_organization_id;
  end if;

  v_doc_code := public.generate_governed_document_code(p_organization_id, 'sop', v_dept_code);

  -- Create controlled_documents root
  insert into public.controlled_documents (
    organization_id, document_code, document_title, document_type,
    department_id, document_owner_id, criticality_level, confidentiality_level,
    document_status, created_by, updated_by
  ) values (
    p_organization_id, v_doc_code, p_title_en, 'sop',
    p_department_id, p_process_owner_id, p_criticality_level, p_confidentiality_level,
    'draft', p_actor_id, p_actor_id
  ) returning id into v_doc_id;

  -- Create version 1.0
  insert into public.document_versions (
    document_id, version_number, version_label, prepared_by, is_current_version
  ) values (
    v_doc_id, 1, '1.0', p_actor_id, true
  ) returning id into v_ver_id;

  -- Update root current_version_id
  update public.controlled_documents set current_version_id = v_ver_id where id = v_doc_id;

  -- Create governed_sop_details
  insert into public.governed_sop_details (
    version_id, title_en, title_ar, process_name_en, process_name_ar,
    process_owner_id, purpose_en, purpose_ar, scope_en, scope_ar,
    primary_policy_version_id, governance_link_state, training_required,
    acknowledgment_required, competency_assessment_required, acknowledgment_sla_days,
    training_renewal_months, content_mode
  ) values (
    v_ver_id, p_title_en, p_title_ar, p_process_name_en, p_process_name_ar,
    p_process_owner_id, p_purpose_en, p_purpose_ar, p_scope_en, p_scope_ar,
    p_primary_policy_version_id, p_governance_link_state, p_training_required,
    p_acknowledgment_required, p_competency_assessment_required, p_acknowledgment_sla_days,
    p_training_renewal_months, p_content_mode
  );

  -- Insert procedure steps if provided
  if jsonb_array_length(p_procedure_steps) > 0 then
    v_seq := 1;
    for v_step in select * from jsonb_array_elements(p_procedure_steps) loop
      insert into public.sop_procedure_steps (
        sop_version_id, sequence_number, responsible_role, action_instruction_en, action_instruction_ar,
        required_control_id, expected_evidence_record_en, expected_evidence_record_ar,
        timing_sla_en, timing_sla_ar, is_decision_point, decision_criteria_en, decision_criteria_ar,
        criticality, escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
      ) values (
        v_ver_id,
        v_seq,
        coalesce(v_step ->> 'responsible_role', 'Performer'),
        coalesce(v_step ->> 'action_instruction_en', 'Step ' || v_seq::text),
        v_step ->> 'action_instruction_ar',
        (v_step ->> 'required_control_id')::uuid,
        v_step ->> 'expected_evidence_record_en',
        v_step ->> 'expected_evidence_record_ar',
        v_step ->> 'timing_sla_en',
        v_step ->> 'timing_sla_ar',
        coalesce((v_step ->> 'is_decision_point')::boolean, false),
        v_step ->> 'decision_criteria_en',
        v_step ->> 'decision_criteria_ar',
        coalesce(v_step ->> 'criticality', 'medium'),
        v_step ->> 'escalation_trigger_en',
        v_step ->> 'escalation_trigger_ar',
        v_step ->> 'escalation_destination_role'
      );
      v_seq := v_seq + 1;
    end loop;
  end if;

  -- Insert definitions if provided
  if jsonb_array_length(p_definitions) > 0 then
    v_seq := 1;
    for v_def in select * from jsonb_array_elements(p_definitions) loop
      insert into public.sop_definitions (
        sop_version_id, sequence_number, term_en, term_ar, abbreviation, definition_en, definition_ar
      ) values (
        v_ver_id,
        v_seq,
        v_def ->> 'term_en',
        v_def ->> 'term_ar',
        v_def ->> 'abbreviation',
        coalesce(v_def ->> 'definition_en', 'Definition ' || v_seq::text),
        v_def ->> 'definition_ar'
      );
      v_seq := v_seq + 1;
    end loop;
  end if;

  -- Insert role responsibilities if provided
  if jsonb_array_length(p_role_responsibilities) > 0 then
    v_seq := 1;
    for v_resp in select * from jsonb_array_elements(p_role_responsibilities) loop
      insert into public.sop_role_responsibilities (
        sop_version_id, sequence_number, role_name, job_title, responsibility_en, responsibility_ar,
        accountable_for_en, accountable_for_ar
      ) values (
        v_ver_id,
        v_seq,
        coalesce(v_resp ->> 'role_name', 'Role ' || v_seq::text),
        v_resp ->> 'job_title',
        coalesce(v_resp ->> 'responsibility_en', 'Responsibility ' || v_seq::text),
        v_resp ->> 'responsibility_ar',
        v_resp ->> 'accountable_for_en',
        v_resp ->> 'accountable_for_ar'
      );
      v_seq := v_seq + 1;
    end loop;
  end if;

  -- Insert monitoring KPIs if provided
  if jsonb_array_length(p_monitoring_kpis) > 0 then
    v_seq := 1;
    for v_kpi in select * from jsonb_array_elements(p_monitoring_kpis) loop
      insert into public.sop_monitoring_kpis (
        sop_version_id, sequence_number, kpi_name_en, kpi_name_ar, target_value, measurement_frequency,
        owner_id, description_en, description_ar
      ) values (
        v_ver_id,
        v_seq,
        coalesce(v_kpi ->> 'kpi_name_en', 'KPI ' || v_seq::text),
        v_kpi ->> 'kpi_name_ar',
        coalesce(v_kpi ->> 'target_value', 'Target ' || v_seq::text),
        coalesce(v_kpi ->> 'measurement_frequency', 'Monthly'),
        (v_kpi ->> 'owner_id')::uuid,
        v_kpi ->> 'description_en',
        v_kpi ->> 'description_ar'
      );
      v_seq := v_seq + 1;
    end loop;
  end if;

  -- Insert department scopes
  if array_length(p_department_scopes, 1) > 0 then
    foreach v_dept_id in array p_department_scopes loop
      insert into public.document_version_department_scope (version_id, department_id)
      values (v_ver_id, v_dept_id)
      on conflict do nothing;
    end loop;
  end if;

  -- Insert role scopes
  if jsonb_array_length(p_role_scopes) > 0 then
    for v_role in select * from jsonb_array_elements(p_role_scopes) loop
      if nullif(trim(coalesce(v_role ->> 'role_name', '')), '') is not null or nullif(trim(coalesce(v_role ->> 'job_title', '')), '') is not null then
        insert into public.document_version_role_scope (version_id, role_name, job_title)
        values (v_ver_id, trim(v_role ->> 'role_name'), trim(v_role ->> 'job_title'))
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- Log initial creation event
  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, v_ver_id, 'draft_created', null, 'draft', p_actor_id, 'Initial SOP draft created'
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', v_ver_id,
    'document_code', v_doc_code,
    'document_status', 'draft',
    'version_label', '1.0'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Governed SOP Draft Save RPC Extension
-- ----------------------------------------------------------------------------
-- Drop obsolete Migration-202 21-parameter signature to prevent stale overload bypass
drop function if exists public.save_governed_sop_draft(
  uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb
);

create or replace function public.save_governed_sop_draft(
  p_actor_id uuid,
  p_version_id uuid,
  p_title_en text,
  p_title_ar text,
  p_process_name_en text,
  p_process_name_ar text,
  p_purpose_en text,
  p_purpose_ar text,
  p_process_owner_id uuid,
  p_primary_policy_version_id uuid,
  p_governance_link_state text,
  p_scope_en text,
  p_scope_ar text,
  p_training_required boolean default false,
  p_acknowledgment_required boolean default false,
  p_competency_assessment_required boolean default false,
  p_acknowledgment_sla_days integer default 30,
  p_training_renewal_months integer default 12,
  p_procedure_steps jsonb default '[]'::jsonb,
  p_department_scopes uuid[] default '{}'::uuid[],
  p_role_scopes jsonb default '[]'::jsonb,
  p_definitions jsonb default '[]'::jsonb,
  p_role_responsibilities jsonb default '[]'::jsonb,
  p_monitoring_kpis jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_org_id uuid;
  v_step jsonb;
  v_step_id uuid;
  v_seen_step_ids uuid[] := '{}'::uuid[];
  v_def jsonb;
  v_def_id uuid;
  v_seen_def_ids uuid[] := '{}'::uuid[];
  v_resp jsonb;
  v_resp_id uuid;
  v_seen_resp_ids uuid[] := '{}'::uuid[];
  v_kpi jsonb;
  v_kpi_id uuid;
  v_seen_kpi_ids uuid[] := '{}'::uuid[];
  v_role jsonb;
  v_dept_id uuid;
  v_seq integer;
begin
  select d.id, d.organization_id into v_doc_id, v_org_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;

  if v_doc_id is null then
    raise exception 'PATCH202_VERSION_NOT_FOUND';
  end if;

  -- Update governed_sop_details (Immutability trigger validates)
  update public.governed_sop_details set
    title_en = p_title_en,
    title_ar = p_title_ar,
    process_name_en = p_process_name_en,
    process_name_ar = p_process_name_ar,
    process_owner_id = p_process_owner_id,
    purpose_en = p_purpose_en,
    purpose_ar = p_purpose_ar,
    scope_en = p_scope_en,
    scope_ar = p_scope_ar,
    primary_policy_version_id = p_primary_policy_version_id,
    governance_link_state = p_governance_link_state,
    training_required = p_training_required,
    acknowledgment_required = p_acknowledgment_required,
    competency_assessment_required = p_competency_assessment_required,
    acknowledgment_sla_days = p_acknowledgment_sla_days,
    training_renewal_months = p_training_renewal_months,
    updated_at = now()
  where version_id = p_version_id;

  -- Reconcile steps preserving stable UUIDs and validating child containment
  if jsonb_array_length(p_procedure_steps) > 0 then
    v_seq := 1;
    for v_step in select * from jsonb_array_elements(p_procedure_steps) loop
      v_step_id := (v_step ->> 'id')::uuid;
      if v_step_id is not null then
        if exists (select 1 from public.sop_procedure_steps where id = v_step_id and sop_version_id <> p_version_id) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        if exists (select 1 from public.sop_procedure_steps where id = v_step_id and sop_version_id = p_version_id) then
          update public.sop_procedure_steps set
            sequence_number = v_seq,
            responsible_role = coalesce(v_step ->> 'responsible_role', responsible_role),
            action_instruction_en = coalesce(v_step ->> 'action_instruction_en', action_instruction_en),
            action_instruction_ar = v_step ->> 'action_instruction_ar',
            required_control_id = (v_step ->> 'required_control_id')::uuid,
            expected_evidence_record_en = v_step ->> 'expected_evidence_record_en',
            expected_evidence_record_ar = v_step ->> 'expected_evidence_record_ar',
            timing_sla_en = v_step ->> 'timing_sla_en',
            timing_sla_ar = v_step ->> 'timing_sla_ar',
            is_decision_point = coalesce((v_step ->> 'is_decision_point')::boolean, is_decision_point),
            decision_criteria_en = v_step ->> 'decision_criteria_en',
            decision_criteria_ar = v_step ->> 'decision_criteria_ar',
            criticality = coalesce(v_step ->> 'criticality', criticality),
            escalation_trigger_en = v_step ->> 'escalation_trigger_en',
            escalation_trigger_ar = v_step ->> 'escalation_trigger_ar',
            escalation_destination_role = v_step ->> 'escalation_destination_role',
            updated_at = now()
          where id = v_step_id;
          v_seen_step_ids := array_append(v_seen_step_ids, v_step_id);
        else
          insert into public.sop_procedure_steps (
            sop_version_id, sequence_number, responsible_role, action_instruction_en, action_instruction_ar,
            required_control_id, expected_evidence_record_en, expected_evidence_record_ar,
            timing_sla_en, timing_sla_ar, is_decision_point, decision_criteria_en, decision_criteria_ar,
            criticality, escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
          ) values (
            p_version_id, v_seq,
            coalesce(v_step ->> 'responsible_role', 'Performer'),
            coalesce(v_step ->> 'action_instruction_en', 'Step ' || v_seq::text),
            v_step ->> 'action_instruction_ar',
            (v_step ->> 'required_control_id')::uuid,
            v_step ->> 'expected_evidence_record_en',
            v_step ->> 'expected_evidence_record_ar',
            v_step ->> 'timing_sla_en',
            v_step ->> 'timing_sla_ar',
            coalesce((v_step ->> 'is_decision_point')::boolean, false),
            v_step ->> 'decision_criteria_en',
            v_step ->> 'decision_criteria_ar',
            coalesce(v_step ->> 'criticality', 'medium'),
            v_step ->> 'escalation_trigger_en',
            v_step ->> 'escalation_trigger_ar',
            v_step ->> 'escalation_destination_role'
          ) returning id into v_step_id;
          v_seen_step_ids := array_append(v_seen_step_ids, v_step_id);
        end if;
      else
        insert into public.sop_procedure_steps (
          sop_version_id, sequence_number, responsible_role, action_instruction_en, action_instruction_ar,
          required_control_id, expected_evidence_record_en, expected_evidence_record_ar,
          timing_sla_en, timing_sla_ar, is_decision_point, decision_criteria_en, decision_criteria_ar,
          criticality, escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
        ) values (
          p_version_id, v_seq,
          coalesce(v_step ->> 'responsible_role', 'Performer'),
          coalesce(v_step ->> 'action_instruction_en', 'Step ' || v_seq::text),
          v_step ->> 'action_instruction_ar',
          (v_step ->> 'required_control_id')::uuid,
          v_step ->> 'expected_evidence_record_en',
          v_step ->> 'expected_evidence_record_ar',
          v_step ->> 'timing_sla_en',
          v_step ->> 'timing_sla_ar',
          coalesce((v_step ->> 'is_decision_point')::boolean, false),
          v_step ->> 'decision_criteria_en',
          v_step ->> 'decision_criteria_ar',
          coalesce(v_step ->> 'criticality', 'medium'),
          v_step ->> 'escalation_trigger_en',
          v_step ->> 'escalation_trigger_ar',
          v_step ->> 'escalation_destination_role'
        ) returning id into v_step_id;
        v_seen_step_ids := array_append(v_seen_step_ids, v_step_id);
      end if;
      v_seq := v_seq + 1;
    end loop;
    delete from public.sop_procedure_steps where sop_version_id = p_version_id and not (id = any(v_seen_step_ids));
  else
    delete from public.sop_procedure_steps where sop_version_id = p_version_id;
  end if;

  -- Reconcile definitions
  if jsonb_array_length(p_definitions) > 0 then
    v_seq := 1;
    for v_def in select * from jsonb_array_elements(p_definitions) loop
      v_def_id := (v_def ->> 'id')::uuid;
      if v_def_id is not null then
        if exists (select 1 from public.sop_definitions where id = v_def_id and sop_version_id <> p_version_id) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        if exists (select 1 from public.sop_definitions where id = v_def_id and sop_version_id = p_version_id) then
          update public.sop_definitions set
            sequence_number = v_seq,
            term_en = v_def ->> 'term_en',
            term_ar = v_def ->> 'term_ar',
            abbreviation = v_def ->> 'abbreviation',
            definition_en = coalesce(v_def ->> 'definition_en', definition_en),
            definition_ar = v_def ->> 'definition_ar',
            updated_at = now()
          where id = v_def_id;
          v_seen_def_ids := array_append(v_seen_def_ids, v_def_id);
        else
          insert into public.sop_definitions (
            sop_version_id, sequence_number, term_en, term_ar, abbreviation, definition_en, definition_ar
          ) values (
            p_version_id, v_seq,
            v_def ->> 'term_en',
            v_def ->> 'term_ar',
            v_def ->> 'abbreviation',
            coalesce(v_def ->> 'definition_en', 'Definition ' || v_seq::text),
            v_def ->> 'definition_ar'
          ) returning id into v_def_id;
          v_seen_def_ids := array_append(v_seen_def_ids, v_def_id);
        end if;
      else
        insert into public.sop_definitions (
          sop_version_id, sequence_number, term_en, term_ar, abbreviation, definition_en, definition_ar
        ) values (
          p_version_id, v_seq,
          v_def ->> 'term_en',
          v_def ->> 'term_ar',
          v_def ->> 'abbreviation',
          coalesce(v_def ->> 'definition_en', 'Definition ' || v_seq::text),
          v_def ->> 'definition_ar'
        ) returning id into v_def_id;
        v_seen_def_ids := array_append(v_seen_def_ids, v_def_id);
      end if;
      v_seq := v_seq + 1;
    end loop;
    delete from public.sop_definitions where sop_version_id = p_version_id and not (id = any(v_seen_def_ids));
  else
    delete from public.sop_definitions where sop_version_id = p_version_id;
  end if;

  -- Reconcile role responsibilities
  if jsonb_array_length(p_role_responsibilities) > 0 then
    v_seq := 1;
    for v_resp in select * from jsonb_array_elements(p_role_responsibilities) loop
      v_resp_id := (v_resp ->> 'id')::uuid;
      if v_resp_id is not null then
        if exists (select 1 from public.sop_role_responsibilities where id = v_resp_id and sop_version_id <> p_version_id) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        if exists (select 1 from public.sop_role_responsibilities where id = v_resp_id and sop_version_id = p_version_id) then
          update public.sop_role_responsibilities set
            sequence_number = v_seq,
            role_name = v_resp ->> 'role_name',
            job_title = v_resp ->> 'job_title',
            responsibility_en = coalesce(v_resp ->> 'responsibility_en', responsibility_en),
            responsibility_ar = v_resp ->> 'responsibility_ar',
            accountable_for_en = v_resp ->> 'accountable_for_en',
            accountable_for_ar = v_resp ->> 'accountable_for_ar',
            updated_at = now()
          where id = v_resp_id;
          v_seen_resp_ids := array_append(v_seen_resp_ids, v_resp_id);
        else
          insert into public.sop_role_responsibilities (
            sop_version_id, sequence_number, role_name, job_title, responsibility_en, responsibility_ar,
            accountable_for_en, accountable_for_ar
          ) values (
            p_version_id, v_seq,
            coalesce(v_resp ->> 'role_name', 'Role ' || v_seq::text),
            v_resp ->> 'job_title',
            coalesce(v_resp ->> 'responsibility_en', 'Responsibility ' || v_seq::text),
            v_resp ->> 'responsibility_ar',
            v_resp ->> 'accountable_for_en',
            v_resp ->> 'accountable_for_ar'
          ) returning id into v_resp_id;
          v_seen_resp_ids := array_append(v_seen_resp_ids, v_resp_id);
        end if;
      else
        insert into public.sop_role_responsibilities (
          sop_version_id, sequence_number, role_name, job_title, responsibility_en, responsibility_ar,
          accountable_for_en, accountable_for_ar
        ) values (
          p_version_id, v_seq,
          coalesce(v_resp ->> 'role_name', 'Role ' || v_seq::text),
          v_resp ->> 'job_title',
          coalesce(v_resp ->> 'responsibility_en', 'Responsibility ' || v_seq::text),
          v_resp ->> 'responsibility_ar',
          v_resp ->> 'accountable_for_en',
          v_resp ->> 'accountable_for_ar'
        ) returning id into v_resp_id;
        v_seen_resp_ids := array_append(v_seen_resp_ids, v_resp_id);
      end if;
      v_seq := v_seq + 1;
    end loop;
    delete from public.sop_role_responsibilities where sop_version_id = p_version_id and not (id = any(v_seen_resp_ids));
  else
    delete from public.sop_role_responsibilities where sop_version_id = p_version_id;
  end if;

  -- Reconcile monitoring KPIs
  if jsonb_array_length(p_monitoring_kpis) > 0 then
    v_seq := 1;
    for v_kpi in select * from jsonb_array_elements(p_monitoring_kpis) loop
      v_kpi_id := (v_kpi ->> 'id')::uuid;
      if v_kpi_id is not null then
        if exists (select 1 from public.sop_monitoring_kpis where id = v_kpi_id and sop_version_id <> p_version_id) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        if exists (select 1 from public.sop_monitoring_kpis where id = v_kpi_id and sop_version_id = p_version_id) then
          update public.sop_monitoring_kpis set
            sequence_number = v_seq,
            kpi_name_en = coalesce(v_kpi ->> 'kpi_name_en', kpi_name_en),
            kpi_name_ar = v_kpi ->> 'kpi_name_ar',
            target_value = coalesce(v_kpi ->> 'target_value', target_value),
            measurement_frequency = coalesce(v_kpi ->> 'measurement_frequency', measurement_frequency),
            owner_id = (v_kpi ->> 'owner_id')::uuid,
            description_en = v_kpi ->> 'description_en',
            description_ar = v_kpi ->> 'description_ar',
            updated_at = now()
          where id = v_kpi_id;
          v_seen_kpi_ids := array_append(v_seen_kpi_ids, v_kpi_id);
        else
          insert into public.sop_monitoring_kpis (
            sop_version_id, sequence_number, kpi_name_en, kpi_name_ar, target_value, measurement_frequency,
            owner_id, description_en, description_ar
          ) values (
            p_version_id, v_seq,
            coalesce(v_kpi ->> 'kpi_name_en', 'KPI ' || v_seq::text),
            v_kpi ->> 'kpi_name_ar',
            coalesce(v_kpi ->> 'target_value', 'Target ' || v_seq::text),
            coalesce(v_kpi ->> 'measurement_frequency', 'Monthly'),
            (v_kpi ->> 'owner_id')::uuid,
            v_kpi ->> 'description_en',
            v_kpi ->> 'description_ar'
          ) returning id into v_kpi_id;
          v_seen_kpi_ids := array_append(v_seen_kpi_ids, v_kpi_id);
        end if;
      else
        insert into public.sop_monitoring_kpis (
          sop_version_id, sequence_number, kpi_name_en, kpi_name_ar, target_value, measurement_frequency,
          owner_id, description_en, description_ar
        ) values (
          p_version_id, v_seq,
          coalesce(v_kpi ->> 'kpi_name_en', 'KPI ' || v_seq::text),
          v_kpi ->> 'kpi_name_ar',
          coalesce(v_kpi ->> 'target_value', 'Target ' || v_seq::text),
          coalesce(v_kpi ->> 'measurement_frequency', 'Monthly'),
          (v_kpi ->> 'owner_id')::uuid,
          v_kpi ->> 'description_en',
          v_kpi ->> 'description_ar'
        ) returning id into v_kpi_id;
        v_seen_kpi_ids := array_append(v_seen_kpi_ids, v_kpi_id);
      end if;
      v_seq := v_seq + 1;
    end loop;
    delete from public.sop_monitoring_kpis where sop_version_id = p_version_id and not (id = any(v_seen_kpi_ids));
  else
    delete from public.sop_monitoring_kpis where sop_version_id = p_version_id;
  end if;

  -- Reconcile department scopes
  delete from public.document_version_department_scope where version_id = p_version_id;
  if array_length(p_department_scopes, 1) > 0 then
    foreach v_dept_id in array p_department_scopes loop
      insert into public.document_version_department_scope (version_id, department_id)
      values (p_version_id, v_dept_id)
      on conflict do nothing;
    end loop;
  end if;

  -- Reconcile role scopes
  delete from public.document_version_role_scope where version_id = p_version_id;
  if jsonb_array_length(p_role_scopes) > 0 then
    for v_role in select * from jsonb_array_elements(p_role_scopes) loop
      if nullif(trim(coalesce(v_role ->> 'role_name', '')), '') is not null or nullif(trim(coalesce(v_role ->> 'job_title', '')), '') is not null then
        insert into public.document_version_role_scope (version_id, role_name, job_title)
        values (p_version_id, trim(v_role ->> 'role_name'), trim(v_role ->> 'job_title'))
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return jsonb_build_object('success', true, 'version_id', p_version_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Governed Revision Creation RPC Extension (Cloning Extended Content)
-- ----------------------------------------------------------------------------
create or replace function public.start_governed_document_revision(
  p_actor_id uuid,
  p_source_version_id uuid,
  p_revision_type text default 'minor',
  p_revision_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_doc_type text;
  v_org_id uuid;
  v_source_ver_num integer;
  v_new_ver_num integer;
  v_new_ver_label text;
  v_new_ver_id uuid;
begin
  select d.id, d.document_type, d.organization_id, v.version_number
  into v_doc_id, v_doc_type, v_org_id, v_source_ver_num
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_source_version_id;

  if v_doc_id is null then
    raise exception 'PATCH202_SOURCE_VERSION_NOT_FOUND';
  end if;

  -- Concurrency lock root document row
  perform 1 from public.controlled_documents where id = v_doc_id for update;

  -- Determine next version number
  select max(version_number) + 1 into v_new_ver_num
  from public.document_versions
  where document_id = v_doc_id;

  if p_revision_type = 'major' then
    v_new_ver_label := (v_source_ver_num + 1)::text || '.0';
  else
    v_new_ver_label := v_source_ver_num::text || '.' || (v_new_ver_num - v_source_ver_num)::text;
  end if;

  -- Create new draft version
  insert into public.document_versions (
    document_id, version_number, version_label, prepared_by, revision_reason,
    supersedes_version_id, is_current_version
  ) values (
    v_doc_id, v_new_ver_num, v_new_ver_label, p_actor_id, p_revision_reason,
    p_source_version_id, false
  ) returning id into v_new_ver_id;

  -- Clone Policy structured content
  if v_doc_type = 'policy' then
    insert into public.governed_policy_details (
      version_id, title_en, title_ar, purpose_en, purpose_ar,
      policy_statement_en, policy_statement_ar, scope_en, scope_ar,
      principles_en, principles_ar, exceptions_summary_en, exceptions_summary_ar,
      non_compliance_escalation_en, non_compliance_escalation_ar, content_mode, transcription_status
    )
    select
      v_new_ver_id, title_en, title_ar, purpose_en, purpose_ar,
      policy_statement_en, policy_statement_ar, scope_en, scope_ar,
      principles_en, principles_ar, exceptions_summary_en, exceptions_summary_ar,
      non_compliance_escalation_en, non_compliance_escalation_ar, content_mode, transcription_status
    from public.governed_policy_details
    where version_id = p_source_version_id;

    insert into public.policy_requirements (
      policy_version_id, sequence_number, requirement_statement_en, requirement_statement_ar,
      responsible_role, is_mandatory, expected_evidence_en, expected_evidence_ar,
      mapped_control_id, linked_accreditation_clause_id, monitoring_frequency, monitoring_owner_id
    )
    select
      v_new_ver_id, sequence_number, requirement_statement_en, requirement_statement_ar,
      responsible_role, is_mandatory, expected_evidence_en, expected_evidence_ar,
      mapped_control_id, linked_accreditation_clause_id, monitoring_frequency, monitoring_owner_id
    from public.policy_requirements
    where policy_version_id = p_source_version_id;
  end if;

  -- Clone SOP structured content
  if v_doc_type = 'sop' then
    insert into public.governed_sop_details (
      version_id, title_en, title_ar, process_name_en, process_name_ar,
      process_owner_id, purpose_en, purpose_ar, scope_en, scope_ar,
      primary_policy_version_id, governance_link_state, training_required,
      acknowledgment_required, competency_assessment_required, acknowledgment_sla_days,
      training_renewal_months, content_mode, transcription_status
    )
    select
      v_new_ver_id, title_en, title_ar, process_name_en, process_name_ar,
      process_owner_id, purpose_en, purpose_ar, scope_en, scope_ar,
      primary_policy_version_id, governance_link_state, training_required,
      acknowledgment_required, competency_assessment_required, acknowledgment_sla_days,
      training_renewal_months, content_mode, transcription_status
    from public.governed_sop_details
    where version_id = p_source_version_id;

    insert into public.sop_procedure_steps (
      sop_version_id, sequence_number, responsible_role, action_instruction_en, action_instruction_ar,
      required_control_id, expected_evidence_record_en, expected_evidence_record_ar,
      timing_sla_en, timing_sla_ar, is_decision_point, decision_criteria_en, decision_criteria_ar,
      criticality, escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
    )
    select
      v_new_ver_id, sequence_number, responsible_role, action_instruction_en, action_instruction_ar,
      required_control_id, expected_evidence_record_en, expected_evidence_record_ar,
      timing_sla_en, timing_sla_ar, is_decision_point, decision_criteria_en, decision_criteria_ar,
      criticality, escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
    from public.sop_procedure_steps
    where sop_version_id = p_source_version_id;

    insert into public.sop_definitions (
      sop_version_id, sequence_number, term_en, term_ar, abbreviation, definition_en, definition_ar
    )
    select
      v_new_ver_id, sequence_number, term_en, term_ar, abbreviation, definition_en, definition_ar
    from public.sop_definitions
    where sop_version_id = p_source_version_id;

    insert into public.sop_role_responsibilities (
      sop_version_id, sequence_number, role_name, job_title, responsibility_en, responsibility_ar,
      accountable_for_en, accountable_for_ar
    )
    select
      v_new_ver_id, sequence_number, role_name, job_title, responsibility_en, responsibility_ar,
      accountable_for_en, accountable_for_ar
    from public.sop_role_responsibilities
    where sop_version_id = p_source_version_id;

    insert into public.sop_monitoring_kpis (
      sop_version_id, sequence_number, kpi_name_en, kpi_name_ar, target_value, measurement_frequency,
      owner_id, description_en, description_ar
    )
    select
      v_new_ver_id, sequence_number, kpi_name_en, kpi_name_ar, target_value, measurement_frequency,
      owner_id, description_en, description_ar
    from public.sop_monitoring_kpis
    where sop_version_id = p_source_version_id;
  end if;

  -- Clone applicability scopes
  insert into public.document_version_department_scope (version_id, department_id)
  select v_new_ver_id, department_id
  from public.document_version_department_scope
  where version_id = p_source_version_id;

  insert into public.document_version_role_scope (version_id, role_name, job_title)
  select v_new_ver_id, role_name, job_title
  from public.document_version_role_scope
  where version_id = p_source_version_id;

  -- Log revision event
  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, v_new_ver_id, 'revision_started', null, 'draft', p_actor_id,
    'Revision draft started from version ' || v_source_ver_num::text || ' (' || p_revision_type || ')'
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', v_new_ver_id,
    'version_number', v_new_ver_num,
    'version_label', v_new_ver_label,
    'document_status', 'draft'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 10. Explicit Security Permissions (Service-Role Only, Public/Anon/Auth Revoked)
-- ----------------------------------------------------------------------------
revoke all on function public.validate_sop_version_type() from public, anon, authenticated;
grant execute on function public.validate_sop_version_type() to service_role;

revoke all on function public.enforce_policy_sop_version_immutability() from public, anon, authenticated;
grant execute on function public.enforce_policy_sop_version_immutability() to service_role;

revoke all on function public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb) to service_role;

revoke all on function public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb) to service_role;

revoke all on function public.start_governed_document_revision(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.start_governed_document_revision(uuid, uuid, text, text) to service_role;

