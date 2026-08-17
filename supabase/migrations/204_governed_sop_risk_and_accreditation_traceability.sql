-- ============================================================================
-- Migration 204: Governed SOP Risk, Control & Accreditation Traceability
-- Establishes:
-- 1. Version-scoped SOP ↔ Risk links (sop_version_risk_links) with typed semantics:
--    ('mitigates', 'risk_if_not_followed', 'operational_context')
-- 2. Version-scoped SOP ↔ Accreditation links (sop_version_accreditation_links)
--    with link strength: ('primary', 'supporting', 'reference', 'gap')
-- 3. Unified traceability view (v_sop_traceability_matrix) with explicit provenance:
--    ('direct_sop', 'derived_step_control', 'inherited_policy')
-- 4. Atomic draft save extension (save_governed_sop_draft with stable child UUIDs)
-- 5. Revision deep-cloning integration in start_governed_document_revision
-- 6. Version immutability, SOP type integrity, RLS, and tenant isolation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SOP Version ↔ Risk Traceability Links
-- ----------------------------------------------------------------------------
create table if not exists public.sop_version_risk_links (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references public.document_versions(id) on delete cascade,
  risk_id uuid not null references public.risks(id) on delete cascade,
  relationship_type text not null check (
    relationship_type in ('mitigates', 'risk_if_not_followed', 'operational_context')
  ),
  context_note_en text,
  context_note_ar text,
  sequence_number integer not null check (sequence_number >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sop_version_id, risk_id, relationship_type),
  unique (sop_version_id, sequence_number) deferrable initially deferred
);

create index if not exists idx_sop_risk_links_version on public.sop_version_risk_links(sop_version_id, sequence_number);
create index if not exists idx_sop_risk_links_risk on public.sop_version_risk_links(risk_id);

comment on table public.sop_version_risk_links is
  'Migration 204: version-scoped direct risk mappings for Governed SOPs with typed relationship semantics.';

-- ----------------------------------------------------------------------------
-- 2. SOP Version ↔ Accreditation Clause Traceability Links
-- ----------------------------------------------------------------------------
create table if not exists public.sop_version_accreditation_links (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references public.document_versions(id) on delete cascade,
  clause_id uuid not null references public.accreditation_clauses(id) on delete cascade,
  link_strength text not null default 'primary' check (
    link_strength in ('primary', 'supporting', 'reference', 'gap')
  ),
  context_note_en text,
  context_note_ar text,
  sequence_number integer not null check (sequence_number >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sop_version_id, clause_id),
  unique (sop_version_id, sequence_number) deferrable initially deferred
);

create index if not exists idx_sop_accreditation_links_version on public.sop_version_accreditation_links(sop_version_id, sequence_number);
create index if not exists idx_sop_accreditation_links_clause on public.sop_version_accreditation_links(clause_id);

comment on table public.sop_version_accreditation_links is
  'Migration 204: version-scoped direct accreditation clause mappings for Governed SOPs.';

-- ----------------------------------------------------------------------------
-- 3. Row Level Security on Traceability Link Tables
-- ----------------------------------------------------------------------------
alter table public.sop_version_risk_links enable row level security;
alter table public.sop_version_accreditation_links enable row level security;

-- Authenticated SELECT policies matching tenant organization
drop policy if exists sop_risk_links_select on public.sop_version_risk_links;
create policy sop_risk_links_select on public.sop_version_risk_links
for select to authenticated
using (
  exists (
    select 1
    from public.document_versions v
    join public.controlled_documents d on d.id = v.document_id
    where v.id = sop_version_risk_links.sop_version_id
      and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

drop policy if exists sop_accreditation_links_select on public.sop_version_accreditation_links;
create policy sop_accreditation_links_select on public.sop_version_accreditation_links
for select to authenticated
using (
  exists (
    select 1
    from public.document_versions v
    join public.controlled_documents d on d.id = v.document_id
    where v.id = sop_version_accreditation_links.sop_version_id
      and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  )
);

-- ----------------------------------------------------------------------------
-- 4. Version Immutability Triggers & Function Extension
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
  elsif TG_TABLE_NAME in (
    'sop_procedure_steps', 'sop_definitions', 'sop_role_responsibilities',
    'sop_monitoring_kpis', 'sop_version_risk_links', 'sop_version_accreditation_links'
  ) then
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

drop trigger if exists trg_immutability_sop_version_risk_links on public.sop_version_risk_links;
create trigger trg_immutability_sop_version_risk_links
before insert or update or delete on public.sop_version_risk_links
for each row execute function public.enforce_policy_sop_version_immutability();

drop trigger if exists trg_immutability_sop_version_accreditation_links on public.sop_version_accreditation_links;
create trigger trg_immutability_sop_version_accreditation_links
before insert or update or delete on public.sop_version_accreditation_links
for each row execute function public.enforce_policy_sop_version_immutability();

-- ----------------------------------------------------------------------------
-- 5. SOP Version Type & Cross-Organization Validation Trigger Function Extension
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

  -- Cross-organization checks for sop_version_risk_links
  if TG_TABLE_NAME = 'sop_version_risk_links' then
    if NEW.risk_id is not null then
      select organization_id into v_ref_org_id
      from public.risks
      where id = NEW.risk_id;

      if v_ref_org_id is distinct from v_doc_org_id then
        raise exception 'PATCH201_CROSS_ORGANIZATION_REFERENCE_DENIED';
      end if;
    end if;
  end if;

  -- Validation for sop_version_accreditation_links
  if TG_TABLE_NAME = 'sop_version_accreditation_links' then
    if NEW.clause_id is not null then
      if not exists (
        select 1 from public.accreditation_clauses where id = NEW.clause_id
      ) then
        raise exception 'PATCH204_ACCREDITATION_CLAUSE_NOT_FOUND';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_validate_sop_risk_links_type on public.sop_version_risk_links;
create trigger trg_validate_sop_risk_links_type
before insert or update on public.sop_version_risk_links
for each row execute function public.validate_sop_version_type();

drop trigger if exists trg_validate_sop_accreditation_links_type on public.sop_version_accreditation_links;
create trigger trg_validate_sop_accreditation_links_type
before insert or update on public.sop_version_accreditation_links
for each row execute function public.validate_sop_version_type();

-- ----------------------------------------------------------------------------
-- 6. Read-Only Unified Traceability Matrix View
-- ----------------------------------------------------------------------------
create or replace view public.v_sop_traceability_matrix
with (security_invoker = true)
as
-- 1. Direct Risk Links
select
  v.id as sop_version_id,
  d.id as document_id,
  d.organization_id,
  d.document_code,
  d.document_title,
  v.version_number,
  v.version_label,
  'risk'::text as item_type,
  'direct_sop'::text as provenance,
  rl.relationship_type as link_semantic,
  rl.id as link_id,
  rl.sequence_number,
  r.id as target_id,
  r.risk_code as target_code,
  r.title as target_title,
  r.description as target_description,
  r.status::text as target_status,
  r.risk_level::text as target_criticality,
  null::text as framework_or_standard,
  rl.context_note_en,
  rl.context_note_ar,
  null::integer[] as step_sequences
from public.sop_version_risk_links rl
join public.document_versions v on v.id = rl.sop_version_id
join public.controlled_documents d on d.id = v.document_id
join public.risks r on r.id = rl.risk_id

union all

-- 2. Derived Step Controls
select
  v.id as sop_version_id,
  d.id as document_id,
  d.organization_id,
  d.document_code,
  d.document_title,
  v.version_number,
  v.version_label,
  'control'::text as item_type,
  'derived_step_control'::text as provenance,
  ctrl.control_type::text as link_semantic,
  null::uuid as link_id,
  min(st.sequence_number) as sequence_number,
  ctrl.id as target_id,
  ctrl.control_code as target_code,
  ctrl.title as target_title,
  ctrl.description as target_description,
  case when ctrl.is_active then 'active' else 'inactive' end as target_status,
  case when ctrl.key_control then 'key_control' else 'standard' end as target_criticality,
  ctrl.standard_reference as framework_or_standard,
  null::text as context_note_en,
  null::text as context_note_ar,
  array_agg(st.sequence_number order by st.sequence_number) as step_sequences
from public.sop_procedure_steps st
join public.document_versions v on v.id = st.sop_version_id
join public.controlled_documents d on d.id = v.document_id
join public.control_library_items ctrl on ctrl.id = st.required_control_id
where st.required_control_id is not null
group by v.id, d.id, d.organization_id, d.document_code, d.document_title, v.version_number, v.version_label, ctrl.id, ctrl.control_code, ctrl.title, ctrl.description, ctrl.control_type, ctrl.is_active, ctrl.key_control, ctrl.standard_reference

union all

-- 3. Direct SOP Accreditation Links
select
  v.id as sop_version_id,
  d.id as document_id,
  d.organization_id,
  d.document_code,
  d.document_title,
  v.version_number,
  v.version_label,
  'accreditation_clause'::text as item_type,
  'direct_sop'::text as provenance,
  al.link_strength as link_semantic,
  al.id as link_id,
  al.sequence_number,
  c.id as target_id,
  c.clause_code as target_code,
  c.clause_title as target_title,
  c.clause_description as target_description,
  case when c.active then 'active' else 'inactive' end as target_status,
  c.criticality as target_criticality,
  s.standard_code || ' (' || s.framework || ')' as framework_or_standard,
  al.context_note_en,
  al.context_note_ar,
  null::integer[] as step_sequences
from public.sop_version_accreditation_links al
join public.document_versions v on v.id = al.sop_version_id
join public.controlled_documents d on d.id = v.document_id
join public.accreditation_clauses c on c.id = al.clause_id
join public.accreditation_standards s on s.id = c.standard_id

union all

-- 4. Inherited Policy Accreditation Clauses
select
  v.id as sop_version_id,
  d.id as document_id,
  d.organization_id,
  d.document_code,
  d.document_title,
  v.version_number,
  v.version_label,
  'accreditation_clause'::text as item_type,
  'inherited_policy'::text as provenance,
  'mandatory_policy_requirement'::text as link_semantic,
  null::uuid as link_id,
  min(pr.sequence_number) as sequence_number,
  c.id as target_id,
  c.clause_code as target_code,
  c.clause_title as target_title,
  c.clause_description as target_description,
  case when c.active then 'active' else 'inactive' end as target_status,
  c.criticality as target_criticality,
  s.standard_code || ' (' || s.framework || ')' as framework_or_standard,
  pr.requirement_statement_en as context_note_en,
  pr.requirement_statement_ar as context_note_ar,
  null::integer[] as step_sequences
from public.governed_sop_details sd
join public.document_versions v on v.id = sd.version_id
join public.controlled_documents d on d.id = v.document_id
join public.policy_requirements pr on pr.policy_version_id = sd.primary_policy_version_id
join public.accreditation_clauses c on c.id = pr.linked_accreditation_clause_id
join public.accreditation_standards s on s.id = c.standard_id
where sd.primary_policy_version_id is not null and pr.linked_accreditation_clause_id is not null
group by v.id, d.id, d.organization_id, d.document_code, d.document_title, v.version_number, v.version_label, c.id, c.clause_code, c.clause_title, c.clause_description, c.active, c.criticality, s.standard_code, s.framework, pr.requirement_statement_en, pr.requirement_statement_ar;

comment on view public.v_sop_traceability_matrix is
  'Migration 204: Unified read-only Governed SOP traceability matrix distinguishing Direct SOP, Derived Step Control, and Inherited Policy provenance.';

-- ----------------------------------------------------------------------------
-- 7. Governed SOP Draft Save RPC Extension (26 Arguments)
-- ----------------------------------------------------------------------------
-- Drop obsolete Migration-203 24-parameter signature to avoid stale overload bypass
drop function if exists public.save_governed_sop_draft(
  uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb
);

create or replace function public.save_governed_sop_draft(
  p_actor_id uuid,
  p_version_id uuid,
  p_title_en text default null,
  p_title_ar text default null,
  p_process_name_en text default null,
  p_process_name_ar text default null,
  p_purpose_en text default null,
  p_purpose_ar text default null,
  p_process_owner_id uuid default null,
  p_primary_policy_version_id uuid default null,
  p_governance_link_state text default null,
  p_scope_en text default null,
  p_scope_ar text default null,
  p_training_required boolean default null,
  p_acknowledgment_required boolean default null,
  p_competency_assessment_required boolean default null,
  p_acknowledgment_sla_days integer default null,
  p_training_renewal_months integer default null,
  p_procedure_steps jsonb default null,
  p_department_scopes uuid[] default null,
  p_role_scopes jsonb default null,
  p_definitions jsonb default null,
  p_role_responsibilities jsonb default null,
  p_monitoring_kpis jsonb default null,
  p_risk_links jsonb default null,
  p_accreditation_links jsonb default null
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
  v_def jsonb;
  v_resp jsonb;
  v_kpi jsonb;
  v_risk jsonb;
  v_acc jsonb;
  v_dept_id uuid;
  v_role jsonb;
  v_existing_step_ids uuid[];
  v_existing_def_ids uuid[];
  v_existing_resp_ids uuid[];
  v_existing_kpi_ids uuid[];
  v_existing_risk_ids uuid[];
  v_existing_acc_ids uuid[];
  v_payload_step_ids uuid[] := '{}'::uuid[];
  v_payload_def_ids uuid[] := '{}'::uuid[];
  v_payload_resp_ids uuid[] := '{}'::uuid[];
  v_payload_kpi_ids uuid[] := '{}'::uuid[];
  v_payload_risk_ids uuid[] := '{}'::uuid[];
  v_payload_acc_ids uuid[] := '{}'::uuid[];
  v_item_id uuid;
begin
  -- Validate target version
  select d.id, d.organization_id into v_doc_id, v_org_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id and d.document_type = 'sop';

  if v_doc_id is null then
    raise exception 'PATCH202_SOP_VERSION_NOT_FOUND';
  end if;

  -- Ensure version is draft / editable
  if exists (
    select 1 from public.document_versions
    where id = p_version_id and (locked_at is not null or approved_at is not null)
  ) then
    raise exception 'PATCH201_VERSION_IMMUTABLE_LOCKED';
  end if;

  -- 1. Update document root title
  if p_title_en is not null then
    update public.controlled_documents set
      document_title = p_title_en,
      updated_at = now()
    where id = v_doc_id;
  end if;

  -- 2. Upsert governed_sop_details
  insert into public.governed_sop_details (
    version_id, title_en, title_ar, process_name_en, process_name_ar,
    purpose_en, purpose_ar, scope_en, scope_ar, process_owner_id,
    primary_policy_version_id, governance_link_state, training_required,
    acknowledgment_required, competency_assessment_required,
    acknowledgment_sla_days, training_renewal_months,
    content_mode, transcription_status, updated_at
  ) values (
    p_version_id,
    coalesce(p_title_en, 'Untitled SOP'),
    p_title_ar,
    coalesce(p_process_name_en, 'General Process'),
    p_process_name_ar,
    p_purpose_en,
    p_purpose_ar,
    p_scope_en,
    p_scope_ar,
    p_process_owner_id,
    p_primary_policy_version_id,
    coalesce(p_governance_link_state, case when p_primary_policy_version_id is not null then 'linked' else 'not_applicable' end),
    coalesce(p_training_required, false),
    coalesce(p_acknowledgment_required, false),
    coalesce(p_competency_assessment_required, false),
    coalesce(p_acknowledgment_sla_days, 30),
    coalesce(p_training_renewal_months, 12),
    'structured',
    'not_required',
    now()
  )
  on conflict (version_id) do update set
    title_en = coalesce(p_title_en, governed_sop_details.title_en),
    title_ar = coalesce(p_title_ar, governed_sop_details.title_ar),
    process_name_en = coalesce(p_process_name_en, governed_sop_details.process_name_en),
    process_name_ar = coalesce(p_process_name_ar, governed_sop_details.process_name_ar),
    purpose_en = coalesce(p_purpose_en, governed_sop_details.purpose_en),
    purpose_ar = coalesce(p_purpose_ar, governed_sop_details.purpose_ar),
    scope_en = coalesce(p_scope_en, governed_sop_details.scope_en),
    scope_ar = coalesce(p_scope_ar, governed_sop_details.scope_ar),
    process_owner_id = coalesce(p_process_owner_id, governed_sop_details.process_owner_id),
    primary_policy_version_id = coalesce(p_primary_policy_version_id, governed_sop_details.primary_policy_version_id),
    governance_link_state = coalesce(
      p_governance_link_state,
      case
        when p_primary_policy_version_id is not null then 'linked'
        when governed_sop_details.primary_policy_version_id is not null then governed_sop_details.governance_link_state
        else 'not_applicable'
      end
    ),
    training_required = coalesce(p_training_required, governed_sop_details.training_required),
    acknowledgment_required = coalesce(p_acknowledgment_required, governed_sop_details.acknowledgment_required),
    competency_assessment_required = coalesce(p_competency_assessment_required, governed_sop_details.competency_assessment_required),
    acknowledgment_sla_days = coalesce(p_acknowledgment_sla_days, governed_sop_details.acknowledgment_sla_days),
    training_renewal_months = coalesce(p_training_renewal_months, governed_sop_details.training_renewal_months),
    updated_at = now();

  -- 4. Reconcile Procedure Steps
  if p_procedure_steps is not null then
    select array_agg(id) into v_existing_step_ids
    from public.sop_procedure_steps
    where sop_version_id = p_version_id;

    for v_step in select * from jsonb_array_elements(p_procedure_steps)
    loop
      v_item_id := nullif(v_step->>'id', '')::uuid;
      if v_item_id is not null then
        if not (v_item_id = any(coalesce(v_existing_step_ids, '{}'::uuid[]))) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        v_payload_step_ids := array_append(v_payload_step_ids, v_item_id);

        update public.sop_procedure_steps set
          sequence_number = (v_step->>'sequence_number')::integer,
          responsible_role = coalesce(v_step->>'responsible_role', responsible_role, 'Performer'),
          action_instruction_en = coalesce(v_step->>'action_instruction_en', action_instruction_en, 'Step ' || coalesce(v_step->>'sequence_number', '1')),
          action_instruction_ar = v_step->>'action_instruction_ar',
          required_control_id = nullif(v_step->>'required_control_id', '')::uuid,
          expected_evidence_record_en = v_step->>'expected_evidence_record_en',
          expected_evidence_record_ar = v_step->>'expected_evidence_record_ar',
          timing_sla_en = v_step->>'timing_sla_en',
          timing_sla_ar = v_step->>'timing_sla_ar',
          is_decision_point = coalesce((v_step->>'is_decision_point')::boolean, false),
          decision_criteria_en = v_step->>'decision_criteria_en',
          decision_criteria_ar = v_step->>'decision_criteria_ar',
          criticality = coalesce(v_step->>'criticality', 'medium'),
          escalation_trigger_en = v_step->>'escalation_trigger_en',
          escalation_trigger_ar = v_step->>'escalation_trigger_ar',
          escalation_destination_role = v_step->>'escalation_destination_role',
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_procedure_steps (
          sop_version_id, sequence_number, responsible_role,
          action_instruction_en, action_instruction_ar, required_control_id,
          expected_evidence_record_en, expected_evidence_record_ar,
          timing_sla_en, timing_sla_ar, is_decision_point,
          decision_criteria_en, decision_criteria_ar, criticality,
          escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
        ) values (
          p_version_id, (v_step->>'sequence_number')::integer,
          coalesce(v_step->>'responsible_role', 'Performer'),
          coalesce(v_step->>'action_instruction_en', 'Step ' || coalesce(v_step->>'sequence_number', '1')),
          v_step->>'action_instruction_ar',
          nullif(v_step->>'required_control_id', '')::uuid,
          v_step->>'expected_evidence_record_en', v_step->>'expected_evidence_record_ar',
          v_step->>'timing_sla_en', v_step->>'timing_sla_ar',
          coalesce((v_step->>'is_decision_point')::boolean, false),
          v_step->>'decision_criteria_en', v_step->>'decision_criteria_ar',
          coalesce(v_step->>'criticality', 'medium'),
          v_step->>'escalation_trigger_en', v_step->>'escalation_trigger_ar',
          v_step->>'escalation_destination_role'
        ) returning id into v_item_id;
        v_payload_step_ids := array_append(v_payload_step_ids, v_item_id);
      end if;
    end loop;

    delete from public.sop_procedure_steps
    where sop_version_id = p_version_id
      and not (id = any(v_payload_step_ids));
  end if;

  -- 5. Reconcile Definitions
  if p_definitions is not null then
    select array_agg(id) into v_existing_def_ids
    from public.sop_definitions
    where sop_version_id = p_version_id;

    for v_def in select * from jsonb_array_elements(p_definitions)
    loop
      v_item_id := nullif(v_def->>'id', '')::uuid;
      if v_item_id is not null then
        if not (v_item_id = any(coalesce(v_existing_def_ids, '{}'::uuid[]))) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        v_payload_def_ids := array_append(v_payload_def_ids, v_item_id);

        update public.sop_definitions set
          sequence_number = (v_def->>'sequence_number')::integer,
          term_en = v_def->>'term_en',
          term_ar = v_def->>'term_ar',
          abbreviation = v_def->>'abbreviation',
          definition_en = v_def->>'definition_en',
          definition_ar = v_def->>'definition_ar',
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_definitions (
          sop_version_id, sequence_number, term_en, term_ar, abbreviation, definition_en, definition_ar
        ) values (
          p_version_id, (v_def->>'sequence_number')::integer,
          v_def->>'term_en', v_def->>'term_ar', v_def->>'abbreviation',
          v_def->>'definition_en', v_def->>'definition_ar'
        ) returning id into v_item_id;
        v_payload_def_ids := array_append(v_payload_def_ids, v_item_id);
      end if;
    end loop;

    delete from public.sop_definitions
    where sop_version_id = p_version_id
      and not (id = any(v_payload_def_ids));
  end if;

  -- 6. Reconcile Roles & Responsibilities
  if p_role_responsibilities is not null then
    select array_agg(id) into v_existing_resp_ids
    from public.sop_role_responsibilities
    where sop_version_id = p_version_id;

    for v_resp in select * from jsonb_array_elements(p_role_responsibilities)
    loop
      v_item_id := nullif(v_resp->>'id', '')::uuid;
      if v_item_id is not null then
        if not (v_item_id = any(coalesce(v_existing_resp_ids, '{}'::uuid[]))) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        v_payload_resp_ids := array_append(v_payload_resp_ids, v_item_id);

        update public.sop_role_responsibilities set
          sequence_number = (v_resp->>'sequence_number')::integer,
          role_name = v_resp->>'role_name',
          job_title = v_resp->>'job_title',
          responsibility_en = v_resp->>'responsibility_en',
          responsibility_ar = v_resp->>'responsibility_ar',
          accountable_for_en = v_resp->>'accountable_for_en',
          accountable_for_ar = v_resp->>'accountable_for_ar',
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_role_responsibilities (
          sop_version_id, sequence_number, role_name, job_title,
          responsibility_en, responsibility_ar, accountable_for_en, accountable_for_ar
        ) values (
          p_version_id, (v_resp->>'sequence_number')::integer,
          v_resp->>'role_name', v_resp->>'job_title',
          v_resp->>'responsibility_en', v_resp->>'responsibility_ar',
          v_resp->>'accountable_for_en', v_resp->>'accountable_for_ar'
        ) returning id into v_item_id;
        v_payload_resp_ids := array_append(v_payload_resp_ids, v_item_id);
      end if;
    end loop;

    delete from public.sop_role_responsibilities
    where sop_version_id = p_version_id
      and not (id = any(v_payload_resp_ids));
  end if;

  -- 7. Reconcile Monitoring KPIs
  if p_monitoring_kpis is not null then
    select array_agg(id) into v_existing_kpi_ids
    from public.sop_monitoring_kpis
    where sop_version_id = p_version_id;

    for v_kpi in select * from jsonb_array_elements(p_monitoring_kpis)
    loop
      v_item_id := nullif(v_kpi->>'id', '')::uuid;
      if v_item_id is not null then
        if not (v_item_id = any(coalesce(v_existing_kpi_ids, '{}'::uuid[]))) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        v_payload_kpi_ids := array_append(v_payload_kpi_ids, v_item_id);

        update public.sop_monitoring_kpis set
          sequence_number = (v_kpi->>'sequence_number')::integer,
          kpi_name_en = v_kpi->>'kpi_name_en',
          kpi_name_ar = v_kpi->>'kpi_name_ar',
          target_value = v_kpi->>'target_value',
          measurement_frequency = v_kpi->>'measurement_frequency',
          owner_id = nullif(v_kpi->>'owner_id', '')::uuid,
          description_en = v_kpi->>'description_en',
          description_ar = v_kpi->>'description_ar',
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_monitoring_kpis (
          sop_version_id, sequence_number, kpi_name_en, kpi_name_ar,
          target_value, measurement_frequency, owner_id, description_en, description_ar
        ) values (
          p_version_id, (v_kpi->>'sequence_number')::integer,
          v_kpi->>'kpi_name_en', v_kpi->>'kpi_name_ar',
          v_kpi->>'target_value', v_kpi->>'measurement_frequency',
          nullif(v_kpi->>'owner_id', '')::uuid,
          v_kpi->>'description_en', v_kpi->>'description_ar'
        ) returning id into v_item_id;
        v_payload_kpi_ids := array_append(v_payload_kpi_ids, v_item_id);
      end if;
    end loop;

    delete from public.sop_monitoring_kpis
    where sop_version_id = p_version_id
      and not (id = any(v_payload_kpi_ids));
  end if;

  -- 8. Reconcile Risk Links
  if p_risk_links is not null then
    select array_agg(id) into v_existing_risk_ids
    from public.sop_version_risk_links
    where sop_version_id = p_version_id;

    for v_risk in select * from jsonb_array_elements(p_risk_links)
    loop
      v_item_id := nullif(v_risk->>'id', '')::uuid;
      if v_item_id is not null then
        if not (v_item_id = any(coalesce(v_existing_risk_ids, '{}'::uuid[]))) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        v_payload_risk_ids := array_append(v_payload_risk_ids, v_item_id);

        update public.sop_version_risk_links set
          sequence_number = coalesce((v_risk->>'sequence_number')::integer, sequence_number, 1),
          risk_id = (v_risk->>'risk_id')::uuid,
          relationship_type = v_risk->>'relationship_type',
          context_note_en = v_risk->>'context_note_en',
          context_note_ar = v_risk->>'context_note_ar',
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_version_risk_links (
          sop_version_id, sequence_number, risk_id, relationship_type,
          context_note_en, context_note_ar
        ) values (
          p_version_id, coalesce((v_risk->>'sequence_number')::integer, array_length(v_payload_risk_ids, 1) + 1, 1),
          (v_risk->>'risk_id')::uuid, v_risk->>'relationship_type',
          v_risk->>'context_note_en', v_risk->>'context_note_ar'
        ) returning id into v_item_id;
        v_payload_risk_ids := array_append(v_payload_risk_ids, v_item_id);
      end if;
    end loop;

    delete from public.sop_version_risk_links
    where sop_version_id = p_version_id
      and not (id = any(v_payload_risk_ids));
  end if;

  -- 9. Reconcile Accreditation Links
  if p_accreditation_links is not null then
    select array_agg(id) into v_existing_acc_ids
    from public.sop_version_accreditation_links
    where sop_version_id = p_version_id;

    for v_acc in select * from jsonb_array_elements(p_accreditation_links)
    loop
      v_item_id := nullif(v_acc->>'id', '')::uuid;
      if v_item_id is not null then
        if not (v_item_id = any(coalesce(v_existing_acc_ids, '{}'::uuid[]))) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        v_payload_acc_ids := array_append(v_payload_acc_ids, v_item_id);

        update public.sop_version_accreditation_links set
          sequence_number = coalesce((v_acc->>'sequence_number')::integer, sequence_number, 1),
          clause_id = (v_acc->>'clause_id')::uuid,
          link_strength = coalesce(v_acc->>'link_strength', 'primary'),
          context_note_en = v_acc->>'context_note_en',
          context_note_ar = v_acc->>'context_note_ar',
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_version_accreditation_links (
          sop_version_id, sequence_number, clause_id, link_strength,
          context_note_en, context_note_ar
        ) values (
          p_version_id, coalesce((v_acc->>'sequence_number')::integer, array_length(v_payload_acc_ids, 1) + 1, 1),
          (v_acc->>'clause_id')::uuid, coalesce(v_acc->>'link_strength', 'primary'),
          v_acc->>'context_note_en', v_acc->>'context_note_ar'
        ) returning id into v_item_id;
        v_payload_acc_ids := array_append(v_payload_acc_ids, v_item_id);
      end if;
    end loop;

    delete from public.sop_version_accreditation_links
    where sop_version_id = p_version_id
      and not (id = any(v_payload_acc_ids));
  end if;

  -- 10. Reconcile Department Scope
  if p_department_scopes is not null then
    delete from public.document_version_department_scope
    where version_id = p_version_id;

    if array_length(p_department_scopes, 1) > 0 then
      foreach v_dept_id in array p_department_scopes loop
        insert into public.document_version_department_scope (version_id, department_id)
        values (p_version_id, v_dept_id);
      end loop;
    end if;
  end if;

  -- 11. Reconcile Role Scope
  if p_role_scopes is not null then
    delete from public.document_version_role_scope
    where version_id = p_version_id;

    if jsonb_array_length(p_role_scopes) > 0 then
      for v_role in select * from jsonb_array_elements(p_role_scopes) loop
        insert into public.document_version_role_scope (version_id, role_name, job_title)
        values (p_version_id, v_role->>'role_name', v_role->>'job_title');
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'version_id', p_version_id,
    'document_id', v_doc_id,
    'step_count', array_length(v_payload_step_ids, 1),
    'definition_count', array_length(v_payload_def_ids, 1),
    'role_responsibility_count', array_length(v_payload_resp_ids, 1),
    'monitoring_kpi_count', array_length(v_payload_kpi_ids, 1),
    'risk_link_count', array_length(v_payload_risk_ids, 1),
    'accreditation_link_count', array_length(v_payload_acc_ids, 1)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Revision Deep Cloning RPC Extension
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
  v_source_ver_num integer;
  v_new_ver_num integer;
  v_new_ver_label text;
  v_new_ver_id uuid;
begin
  -- Validate source version
  select d.id, d.document_type, v.version_number
  into v_doc_id, v_doc_type, v_source_ver_num
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

    -- Migration 204: Deep-clone risk and accreditation links
    insert into public.sop_version_risk_links (
      sop_version_id, risk_id, relationship_type, context_note_en, context_note_ar, sequence_number
    )
    select
      v_new_ver_id, risk_id, relationship_type, context_note_en, context_note_ar, sequence_number
    from public.sop_version_risk_links
    where sop_version_id = p_source_version_id;

    insert into public.sop_version_accreditation_links (
      sop_version_id, clause_id, link_strength, context_note_en, context_note_ar, sequence_number
    )
    select
      v_new_ver_id, clause_id, link_strength, context_note_en, context_note_ar, sequence_number
    from public.sop_version_accreditation_links
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
    'Started ' || p_revision_type || ' revision ' || v_new_ver_label || ' from version ' || v_source_ver_num::text
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', v_new_ver_id,
    'version_number', v_new_ver_num,
    'version_label', v_new_ver_label,
    'revision_type', p_revision_type
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Security Definer ACL Hardening
-- ----------------------------------------------------------------------------
revoke all on function public.enforce_policy_sop_version_immutability() from public, anon, authenticated;
grant execute on function public.enforce_policy_sop_version_immutability() to service_role;

revoke all on function public.validate_sop_version_type() from public, anon, authenticated;
grant execute on function public.validate_sop_version_type() to service_role;

revoke all on function public.save_governed_sop_draft(
  uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.save_governed_sop_draft(
  uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

revoke all on function public.start_governed_document_revision(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.start_governed_document_revision(uuid, uuid, text, text) to service_role;

