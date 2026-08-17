-- ============================================================================
-- Migration 202: Governed Policy & SOP Lifecycle, Review, Approval & Exception Foundation
-- Establishes review triggers, Policy/SOP exceptions, concurrency-safe numbering,
-- and service-role-only lifecycle mutation RPCs for draft creation, atomic saving,
-- revision cloning, review submission, approval locking, activation, supersession,
-- and retirement.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Governed Document Review Triggers
-- ----------------------------------------------------------------------------
create table if not exists public.governed_document_review_triggers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  version_id uuid references public.document_versions(id) on delete set null,
  trigger_type text not null check (trigger_type in ('scheduled','regulatory_change','audit_finding','ovr','capa','management_decision','accreditation_finding')),
  source_entity_type text,
  source_entity_id uuid,
  triggered_by uuid references public.profiles(id) on delete set null,
  triggered_at timestamptz not null default now(),
  review_owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  outcome text check (outcome is null or outcome in ('no_change','minor_revision','major_revision','retire')),
  outcome_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_open_review_trigger on public.governed_document_review_triggers (
  document_id,
  trigger_type,
  coalesce(source_entity_type, ''),
  coalesce(source_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
) where status in ('open', 'in_progress');

create index if not exists idx_review_triggers_org on public.governed_document_review_triggers(organization_id);
create index if not exists idx_review_triggers_doc on public.governed_document_review_triggers(document_id);
create index if not exists idx_review_triggers_status on public.governed_document_review_triggers(status);

-- ----------------------------------------------------------------------------
-- 2. Governed Policy & SOP Exceptions
-- ----------------------------------------------------------------------------
create table if not exists public.policy_sop_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id) on delete cascade,
  exception_code text unique,
  exception_reason text not null,
  scope_description text not null,
  effective_start_date date not null,
  effective_end_date date not null,
  risk_assessment_summary text,
  compensating_controls text,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'requested' check (status in ('requested','approved','rejected','expired','revoked')),
  decision_by uuid references public.profiles(id) on delete set null,
  decision_at timestamptz,
  decision_note text,
  approval_request_id uuid references public.approval_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_end_date >= effective_start_date)
);

create index if not exists idx_exceptions_org on public.policy_sop_exceptions(organization_id);
create index if not exists idx_exceptions_doc_ver on public.policy_sop_exceptions(document_id, document_version_id);
create index if not exists idx_exceptions_status on public.policy_sop_exceptions(status);

-- ----------------------------------------------------------------------------
-- 3. Document Sequence Counter for Safe Concurrency Numbering
-- ----------------------------------------------------------------------------
create table if not exists public.governed_document_numbering_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  year_number integer not null,
  last_sequence integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, document_type, year_number)
);

create or replace function public.generate_governed_document_code(
  p_organization_id uuid,
  p_document_type text,
  p_department_code text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year integer := extract(year from current_date)::integer;
  v_seq integer;
  v_prefix text;
  v_code text;
begin
  if p_document_type = 'policy' then
    v_prefix := 'POL';
  elsif p_document_type = 'sop' then
    v_prefix := 'SOP';
  else
    v_prefix := upper(p_document_type);
  end if;

  insert into public.governed_document_numbering_sequences (organization_id, document_type, year_number, last_sequence, updated_at)
  values (p_organization_id, p_document_type, v_year, 1, now())
  on conflict (organization_id, document_type, year_number)
  do update set last_sequence = governed_document_numbering_sequences.last_sequence + 1, updated_at = now()
  returning last_sequence into v_seq;

  if p_department_code is not null and trim(p_department_code) <> '' then
    v_code := v_prefix || '-' || upper(trim(p_department_code)) || '-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
  else
    v_code := v_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
  end if;

  return v_code;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Point-in-Time Version Resolution
-- ----------------------------------------------------------------------------
create or replace function public.get_effective_document_version(
  p_document_id uuid,
  p_target_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version_id uuid;
begin
  select v.id into v_version_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.document_id = p_document_id
    and v.approved_at is not null
    and (v.effective_date is null or v.effective_date <= p_target_date)
    and (v.expiry_date is null or v.expiry_date >= p_target_date)
    and (v.superseded_by_version_id is null or exists (
      select 1 from public.document_versions sup
      where sup.id = v.superseded_by_version_id
        and sup.effective_date > p_target_date
    ))
  order by v.version_number desc
  limit 1;

  return v_version_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Governed Policy Draft Creation RPC
-- ----------------------------------------------------------------------------
create or replace function public.create_governed_policy_draft(
  p_actor_id uuid,
  p_organization_id uuid,
  p_title_en text,
  p_title_ar text,
  p_purpose_en text,
  p_purpose_ar text,
  p_policy_statement_en text,
  p_policy_statement_ar text,
  p_scope_en text default null,
  p_scope_ar text default null,
  p_principles_en text default null,
  p_principles_ar text default null,
  p_exceptions_summary_en text default null,
  p_exceptions_summary_ar text default null,
  p_non_compliance_escalation_en text default null,
  p_non_compliance_escalation_ar text default null,
  p_department_id uuid default null,
  p_criticality_level text default 'medium',
  p_confidentiality_level text default 'internal',
  p_content_mode text default 'structured',
  p_requirements jsonb default '[]'::jsonb,
  p_department_scopes uuid[] default '{}'::uuid[],
  p_role_scopes jsonb default '[]'::jsonb
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
  v_req jsonb;
  v_role jsonb;
  v_dept_id uuid;
  v_seq integer := 1;
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

  v_doc_code := public.generate_governed_document_code(p_organization_id, 'policy', v_dept_code);

  -- Create controlled_documents root
  insert into public.controlled_documents (
    organization_id, document_code, document_title, document_type,
    department_id, document_owner_id, criticality_level, confidentiality_level,
    document_status, created_by, updated_by
  ) values (
    p_organization_id, v_doc_code, p_title_en, 'policy',
    p_department_id, p_actor_id, p_criticality_level, p_confidentiality_level,
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

  -- Create governed_policy_details
  insert into public.governed_policy_details (
    version_id, title_en, title_ar, purpose_en, purpose_ar,
    policy_statement_en, policy_statement_ar, scope_en, scope_ar,
    principles_en, principles_ar, exceptions_summary_en, exceptions_summary_ar,
    non_compliance_escalation_en, non_compliance_escalation_ar, content_mode
  ) values (
    v_ver_id, p_title_en, p_title_ar, p_purpose_en, p_purpose_ar,
    p_policy_statement_en, p_policy_statement_ar, p_scope_en, p_scope_ar,
    p_principles_en, p_principles_ar, p_exceptions_summary_en, p_exceptions_summary_ar,
    p_non_compliance_escalation_en, p_non_compliance_escalation_ar, p_content_mode
  );

  -- Insert repeatable requirements if provided
  if jsonb_array_length(p_requirements) > 0 then
    for v_req in select * from jsonb_array_elements(p_requirements) loop
      insert into public.policy_requirements (
        policy_version_id, sequence_number, requirement_statement_en, requirement_statement_ar,
        responsible_role, is_mandatory, expected_evidence_en, expected_evidence_ar,
        mapped_control_id, linked_accreditation_clause_id, monitoring_frequency, monitoring_owner_id
      ) values (
        v_ver_id,
        v_seq,
        coalesce(v_req ->> 'requirement_statement_en', 'Requirement ' || v_seq::text),
        v_req ->> 'requirement_statement_ar',
        v_req ->> 'responsible_role',
        coalesce((v_req ->> 'is_mandatory')::boolean, true),
        v_req ->> 'expected_evidence_en',
        v_req ->> 'expected_evidence_ar',
        (v_req ->> 'mapped_control_id')::uuid,
        (v_req ->> 'linked_accreditation_clause_id')::uuid,
        v_req ->> 'monitoring_frequency',
        (v_req ->> 'monitoring_owner_id')::uuid
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

  -- Append audit review event
  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, v_ver_id, 'created', null, 'draft', p_actor_id, 'Initial Policy draft created'
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', v_ver_id,
    'document_code', v_doc_code,
    'document_status', 'draft',
    'version_number', 1
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Governed SOP Draft Creation RPC
-- ----------------------------------------------------------------------------
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
  p_role_scopes jsonb default '[]'::jsonb
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
  v_seq integer := 1;
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

  -- Append audit review event
  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, v_ver_id, 'created', null, 'draft', p_actor_id, 'Initial SOP draft created'
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', v_ver_id,
    'document_code', v_doc_code,
    'document_status', 'draft',
    'version_number', 1
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Governed Draft Save RPCs (Stable Child UUIDs & Resequencing)
-- ----------------------------------------------------------------------------
create or replace function public.save_governed_policy_draft(
  p_actor_id uuid,
  p_version_id uuid,
  p_title_en text,
  p_title_ar text,
  p_purpose_en text,
  p_purpose_ar text,
  p_policy_statement_en text,
  p_policy_statement_ar text,
  p_scope_en text,
  p_scope_ar text,
  p_principles_en text,
  p_principles_ar text,
  p_exceptions_summary_en text,
  p_exceptions_summary_ar text,
  p_non_compliance_escalation_en text,
  p_non_compliance_escalation_ar text,
  p_requirements jsonb default '[]'::jsonb,
  p_department_scopes uuid[] default '{}'::uuid[],
  p_role_scopes jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_org_id uuid;
  v_req jsonb;
  v_req_id uuid;
  v_seen_req_ids uuid[] := '{}'::uuid[];
  v_role jsonb;
  v_dept_id uuid;
  v_seq integer := 1;
begin
  select d.id, d.organization_id into v_doc_id, v_org_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;

  if v_doc_id is null then
    raise exception 'PATCH202_VERSION_NOT_FOUND';
  end if;

  -- Update governed_policy_details (D1A trigger validates immutability)
  update public.governed_policy_details set
    title_en = p_title_en,
    title_ar = p_title_ar,
    purpose_en = p_purpose_en,
    purpose_ar = p_purpose_ar,
    policy_statement_en = p_policy_statement_en,
    policy_statement_ar = p_policy_statement_ar,
    scope_en = p_scope_en,
    scope_ar = p_scope_ar,
    principles_en = p_principles_en,
    principles_ar = p_principles_ar,
    exceptions_summary_en = p_exceptions_summary_en,
    exceptions_summary_ar = p_exceptions_summary_ar,
    non_compliance_escalation_en = p_non_compliance_escalation_en,
    non_compliance_escalation_ar = p_non_compliance_escalation_ar,
    updated_at = now()
  where version_id = p_version_id;

  -- Reconcile requirements preserving stable UUIDs
  if jsonb_array_length(p_requirements) > 0 then
    for v_req in select * from jsonb_array_elements(p_requirements) loop
      v_req_id := (v_req ->> 'id')::uuid;
      if v_req_id is not null and exists (select 1 from public.policy_requirements where id = v_req_id and policy_version_id = p_version_id) then
        update public.policy_requirements set
          sequence_number = v_seq,
          requirement_statement_en = coalesce(v_req ->> 'requirement_statement_en', requirement_statement_en),
          requirement_statement_ar = v_req ->> 'requirement_statement_ar',
          responsible_role = v_req ->> 'responsible_role',
          is_mandatory = coalesce((v_req ->> 'is_mandatory')::boolean, is_mandatory),
          expected_evidence_en = v_req ->> 'expected_evidence_en',
          expected_evidence_ar = v_req ->> 'expected_evidence_ar',
          mapped_control_id = (v_req ->> 'mapped_control_id')::uuid,
          linked_accreditation_clause_id = (v_req ->> 'linked_accreditation_clause_id')::uuid,
          monitoring_frequency = v_req ->> 'monitoring_frequency',
          monitoring_owner_id = (v_req ->> 'monitoring_owner_id')::uuid,
          updated_at = now()
        where id = v_req_id;
        v_seen_req_ids := array_append(v_seen_req_ids, v_req_id);
      else
        insert into public.policy_requirements (
          policy_version_id, sequence_number, requirement_statement_en, requirement_statement_ar,
          responsible_role, is_mandatory, expected_evidence_en, expected_evidence_ar,
          mapped_control_id, linked_accreditation_clause_id, monitoring_frequency, monitoring_owner_id
        ) values (
          p_version_id, v_seq,
          coalesce(v_req ->> 'requirement_statement_en', 'Requirement ' || v_seq::text),
          v_req ->> 'requirement_statement_ar',
          v_req ->> 'responsible_role',
          coalesce((v_req ->> 'is_mandatory')::boolean, true),
          v_req ->> 'expected_evidence_en',
          v_req ->> 'expected_evidence_ar',
          (v_req ->> 'mapped_control_id')::uuid,
          (v_req ->> 'linked_accreditation_clause_id')::uuid,
          v_req ->> 'monitoring_frequency',
          (v_req ->> 'monitoring_owner_id')::uuid
        ) returning id into v_req_id;
        v_seen_req_ids := array_append(v_seen_req_ids, v_req_id);
      end if;
      v_seq := v_seq + 1;
    end loop;
    -- Delete removed requirements
    delete from public.policy_requirements where policy_version_id = p_version_id and not (id = any(v_seen_req_ids));
  else
    delete from public.policy_requirements where policy_version_id = p_version_id;
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
  p_role_scopes jsonb default '[]'::jsonb
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
  v_role jsonb;
  v_dept_id uuid;
  v_seq integer := 1;
begin
  select d.id, d.organization_id into v_doc_id, v_org_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;

  if v_doc_id is null then
    raise exception 'PATCH202_VERSION_NOT_FOUND';
  end if;

  -- Update governed_sop_details (D1A trigger validates immutability)
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

  -- Reconcile steps preserving stable UUIDs
  if jsonb_array_length(p_procedure_steps) > 0 then
    for v_step in select * from jsonb_array_elements(p_procedure_steps) loop
      v_step_id := (v_step ->> 'id')::uuid;
      if v_step_id is not null and exists (select 1 from public.sop_procedure_steps where id = v_step_id and sop_version_id = p_version_id) then
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
      v_seq := v_seq + 1;
    end loop;
    -- Delete removed steps
    delete from public.sop_procedure_steps where sop_version_id = p_version_id and not (id = any(v_seen_step_ids));
  else
    delete from public.sop_procedure_steps where sop_version_id = p_version_id;
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
-- 8. Governed Revision Creation RPC (Clone & Preserve Historical Integrity)
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
-- 9. Governed Submission for Review RPC (Patch 27 Approval Integration)
-- ----------------------------------------------------------------------------
create or replace function public.submit_governed_document_for_review(
  p_actor_id uuid,
  p_version_id uuid,
  p_submission_note text default null
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
  v_dept_id uuid;
  v_req_count integer;
  v_step_count integer;
  v_appr_req_id uuid;
begin
  select d.id, d.document_type, d.organization_id, d.department_id
  into v_doc_id, v_doc_type, v_org_id, v_dept_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id and v.locked_at is null and v.approved_at is null;

  if v_doc_id is null then
    raise exception 'PATCH202_VERSION_NOT_EDITABLE_FOR_SUBMISSION';
  end if;

  -- Prevent duplicate open submission
  if exists (
    select 1 from public.approval_requests
    where linked_item_type = 'document_version'
      and linked_item_id = p_version_id
      and request_status in ('pending', 'partially_approved')
  ) then
    raise exception 'PATCH202_DUPLICATE_OPEN_SUBMISSION';
  end if;

  -- Validation completeness checks
  if v_doc_type = 'policy' then
    if not exists (select 1 from public.governed_policy_details where version_id = p_version_id and length(trim(policy_statement_en)) > 0) then
      raise exception 'PATCH202_POLICY_STATEMENT_REQUIRED';
    end if;
  elsif v_doc_type = 'sop' then
    select count(*) into v_step_count from public.sop_procedure_steps where sop_version_id = p_version_id;
    if v_step_count = 0 then
      raise exception 'PATCH202_SOP_STEPS_REQUIRED';
    end if;
  end if;

  -- Create Patch 27 approval request
  insert into public.approval_requests (
    organization_id, workflow_type, linked_item_type, linked_item_id,
    action_type, department_id, requested_by, request_reason, request_status
  ) values (
    v_org_id, 'document_control', 'document_version', p_version_id,
    'approve_document', v_dept_id, p_actor_id, p_submission_note, 'pending'
  ) returning id into v_appr_req_id;

  -- Update document status
  update public.controlled_documents set document_status = 'under_review', workflow_stage = 'pending_approval' where id = v_doc_id;

  -- Append audit event
  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, p_version_id, 'submitted_for_approval', 'draft', 'under_review', p_actor_id, p_submission_note
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', p_version_id,
    'approval_request_id', v_appr_req_id,
    'status', 'under_review'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 10. Governed Approval Finalization & Version Locking RPC
-- ----------------------------------------------------------------------------
create or replace function public.finalize_governed_document_approval(
  p_actor_id uuid,
  p_version_id uuid,
  p_approval_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_org_id uuid;
  v_is_locked boolean;
begin
  select d.id, d.organization_id, (v.locked_at is not null or v.approved_at is not null)
  into v_doc_id, v_org_id, v_is_locked
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;

  if v_doc_id is null then
    raise exception 'PATCH202_VERSION_NOT_FOUND';
  end if;

  if v_is_locked then
    return jsonb_build_object('success', true, 'already_approved', true, 'version_id', p_version_id);
  end if;

  -- Lock version
  update public.document_versions set
    approved_by = p_actor_id,
    approved_at = now(),
    locked_by = p_actor_id,
    locked_at = now()
  where id = p_version_id;

  -- Update document status to approved
  update public.controlled_documents set
    document_status = 'approved',
    workflow_stage = 'approved'
  where id = v_doc_id;

  -- Append audit event
  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, p_version_id, 'approved', 'under_review', 'approved', p_actor_id, p_approval_note
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', p_version_id,
    'status', 'approved'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 11. Governed Activation & Supersession RPC
-- ----------------------------------------------------------------------------
create or replace function public.activate_governed_document_version(
  p_actor_id uuid,
  p_version_id uuid,
  p_effective_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_prior_ver_id uuid;
begin
  select d.id into v_doc_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id and v.approved_at is not null;

  if v_doc_id is null then
    raise exception 'PATCH202_VERSION_NOT_APPROVED_FOR_ACTIVATION';
  end if;

  -- Concurrency lock document
  perform 1 from public.controlled_documents where id = v_doc_id for update;

  -- Identify prior active version
  select id into v_prior_ver_id
  from public.document_versions
  where document_id = v_doc_id and is_current_version = true and id <> p_version_id;

  -- Supersede prior version if present
  if v_prior_ver_id is not null then
    update public.document_versions set
      is_current_version = false,
      superseded_by_version_id = p_version_id,
      expiry_date = coalesce(expiry_date, p_effective_date)
    where id = v_prior_ver_id;

    insert into public.document_review_events (
      document_id, version_id, event_type, from_status, to_status, actor_id, event_note
    ) values (
      v_doc_id, v_prior_ver_id, 'superseded', 'active', 'superseded', p_actor_id,
      'Superseded by version activation'
    );
  end if;

  -- Activate new version
  update public.document_versions set
    is_current_version = true,
    effective_date = p_effective_date,
    supersedes_version_id = coalesce(supersedes_version_id, v_prior_ver_id)
  where id = p_version_id;

  -- Update root pointer
  update public.controlled_documents set
    current_version_id = p_version_id,
    effective_date = p_effective_date,
    document_status = 'active',
    workflow_stage = 'active',
    active_flag = true
  where id = v_doc_id;

  -- Append activation audit event
  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, p_version_id, 'activated', 'approved', 'active', p_actor_id, 'Document version activated'
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', p_version_id,
    'prior_version_id', v_prior_ver_id,
    'status', 'active',
    'effective_date', p_effective_date
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 12. Governed Retirement RPC
-- ----------------------------------------------------------------------------
create or replace function public.retire_governed_document(
  p_actor_id uuid,
  p_document_id uuid,
  p_retirement_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cur_ver_id uuid;
begin
  select current_version_id into v_cur_ver_id
  from public.controlled_documents
  where id = p_document_id and document_status <> 'retired';

  if not found then
    raise exception 'PATCH202_DOCUMENT_NOT_FOUND_OR_ALREADY_RETIRED';
  end if;

  update public.controlled_documents set
    document_status = 'retired',
    workflow_stage = 'retired',
    active_flag = false
  where id = p_document_id;

  if v_cur_ver_id is not null then
    update public.document_versions set is_current_version = false where id = v_cur_ver_id;
  end if;

  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    p_document_id, v_cur_ver_id, 'retired', 'active', 'retired', p_actor_id, p_retirement_reason
  );

  return jsonb_build_object('document_id', p_document_id, 'status', 'retired');
end;
$$;

-- ----------------------------------------------------------------------------
-- 13. Governed Review Trigger RPCs
-- ----------------------------------------------------------------------------
create or replace function public.trigger_governed_document_review(
  p_actor_id uuid,
  p_document_id uuid,
  p_trigger_type text,
  p_source_entity_type text default null,
  p_source_entity_id uuid default null,
  p_due_date date default (current_date + interval '30 days')::date,
  p_trigger_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_cur_ver_id uuid;
  v_trigger_id uuid;
begin
  select organization_id, current_version_id
  into v_org_id, v_cur_ver_id
  from public.controlled_documents
  where id = p_document_id;

  if v_org_id is null then
    raise exception 'PATCH202_DOCUMENT_NOT_FOUND';
  end if;

  insert into public.governed_document_review_triggers (
    organization_id, document_id, version_id, trigger_type,
    source_entity_type, source_entity_id, triggered_by, due_date, status, outcome_note
  ) values (
    v_org_id, p_document_id, v_cur_ver_id, p_trigger_type,
    p_source_entity_type, p_source_entity_id, p_actor_id, p_due_date, 'open', p_trigger_note
  ) returning id into v_trigger_id;

  return jsonb_build_object(
    'trigger_id', v_trigger_id,
    'document_id', p_document_id,
    'status', 'open'
  );
end;
$$;

create or replace function public.complete_governed_document_review(
  p_actor_id uuid,
  p_trigger_id uuid,
  p_outcome text,
  p_outcome_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_ver_id uuid;
begin
  select document_id, version_id into v_doc_id, v_ver_id
  from public.governed_document_review_triggers
  where id = p_trigger_id and status in ('open', 'in_progress');

  if v_doc_id is null then
    raise exception 'PATCH202_TRIGGER_NOT_OPEN';
  end if;

  update public.governed_document_review_triggers set
    status = 'completed',
    outcome = p_outcome,
    outcome_note = p_outcome_note,
    completed_at = now(),
    review_owner_id = p_actor_id
  where id = p_trigger_id;

  insert into public.document_review_events (
    document_id, version_id, event_type, actor_id, event_note
  ) values (
    v_doc_id, v_ver_id, 'review_accepted', p_actor_id,
    'Review completed with outcome: ' || p_outcome || '. ' || coalesce(p_outcome_note, '')
  );

  return jsonb_build_object(
    'trigger_id', p_trigger_id,
    'document_id', v_doc_id,
    'outcome', p_outcome,
    'status', 'completed'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 14. Governed Policy & SOP Exception RPCs
-- ----------------------------------------------------------------------------
create or replace function public.request_policy_sop_exception(
  p_actor_id uuid,
  p_version_id uuid,
  p_reason text,
  p_scope_description text,
  p_start_date date,
  p_end_date date,
  p_risk_summary text default null,
  p_compensating_controls text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_org_id uuid;
  v_exc_id uuid;
  v_code text;
  v_appr_req_id uuid;
begin
  select d.id, d.organization_id into v_doc_id, v_org_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;

  if v_doc_id is null then
    raise exception 'PATCH202_VERSION_NOT_FOUND';
  end if;

  if p_end_date < p_start_date then
    raise exception 'PATCH202_INVALID_EXCEPTION_DATES';
  end if;

  v_code := 'EXC-' || extract(year from current_date)::text || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into public.policy_sop_exceptions (
    organization_id, document_id, document_version_id, exception_code,
    exception_reason, scope_description, effective_start_date, effective_end_date,
    risk_assessment_summary, compensating_controls, requested_by, status
  ) values (
    v_org_id, v_doc_id, p_version_id, v_code,
    p_reason, p_scope_description, p_start_date, p_end_date,
    p_risk_summary, p_compensating_controls, p_actor_id, 'requested'
  ) returning id into v_exc_id;

  -- Create Patch 27 approval request
  insert into public.approval_requests (
    organization_id, workflow_type, linked_item_type, linked_item_id,
    action_type, requested_by, request_reason, request_status
  ) values (
    v_org_id, 'document_control', 'policy_sop_exception', v_exc_id,
    'approve_waiver', p_actor_id, p_reason, 'pending'
  ) returning id into v_appr_req_id;

  update public.policy_sop_exceptions set approval_request_id = v_appr_req_id where id = v_exc_id;

  return jsonb_build_object(
    'exception_id', v_exc_id,
    'exception_code', v_code,
    'approval_request_id', v_appr_req_id,
    'status', 'requested'
  );
end;
$$;

create or replace function public.decide_policy_sop_exception(
  p_actor_id uuid,
  p_exception_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req_by uuid;
begin
  select requested_by into v_req_by
  from public.policy_sop_exceptions
  where id = p_exception_id and status = 'requested';

  if not found then
    raise exception 'PATCH202_EXCEPTION_NOT_PENDING';
  end if;

  -- SoD enforcement: Requester cannot approve their own exception
  if p_decision = 'approved' and v_req_by = p_actor_id then
    raise exception 'PATCH202_SELF_APPROVAL_FORBIDDEN';
  end if;

  update public.policy_sop_exceptions set
    status = p_decision,
    decision_by = p_actor_id,
    decision_at = now(),
    decision_note = p_decision_note
  where id = p_exception_id;

  return jsonb_build_object(
    'exception_id', p_exception_id,
    'status', p_decision
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 15. Row Level Security on New Tables
-- ----------------------------------------------------------------------------
alter table public.governed_document_review_triggers enable row level security;
alter table public.policy_sop_exceptions enable row level security;
alter table public.governed_document_numbering_sequences enable row level security;

-- Authenticated SELECT policies
drop policy if exists review_triggers_select on public.governed_document_review_triggers;
create policy review_triggers_select on public.governed_document_review_triggers
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists exceptions_select on public.policy_sop_exceptions;
create policy exceptions_select on public.policy_sop_exceptions
for select to authenticated
using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

-- ----------------------------------------------------------------------------
-- 16. Security Definer ACL Hardening
-- ----------------------------------------------------------------------------
revoke all on function public.generate_governed_document_code(uuid, text, text) from public, anon, authenticated;
grant execute on function public.generate_governed_document_code(uuid, text, text) to service_role;

revoke all on function public.get_effective_document_version(uuid, date) from public, anon, authenticated;
grant execute on function public.get_effective_document_version(uuid, date) to service_role;

revoke all on function public.create_governed_policy_draft(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, text, text, text, jsonb, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.create_governed_policy_draft(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, text, text, text, jsonb, uuid[], jsonb) to service_role;

revoke all on function public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, uuid[], jsonb) to service_role;

revoke all on function public.save_governed_policy_draft(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.save_governed_policy_draft(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, uuid[], jsonb) to service_role;

revoke all on function public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb) to service_role;

revoke all on function public.start_governed_document_revision(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.start_governed_document_revision(uuid, uuid, text, text) to service_role;

revoke all on function public.submit_governed_document_for_review(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_governed_document_for_review(uuid, uuid, text) to service_role;

revoke all on function public.finalize_governed_document_approval(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_governed_document_approval(uuid, uuid, text) to service_role;

revoke all on function public.activate_governed_document_version(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.activate_governed_document_version(uuid, uuid, date) to service_role;

revoke all on function public.retire_governed_document(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.retire_governed_document(uuid, uuid, text) to service_role;

revoke all on function public.trigger_governed_document_review(uuid, uuid, text, text, uuid, date, text) from public, anon, authenticated;
grant execute on function public.trigger_governed_document_review(uuid, uuid, text, text, uuid, date, text) to service_role;

revoke all on function public.complete_governed_document_review(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_governed_document_review(uuid, uuid, text, text) to service_role;

revoke all on function public.request_policy_sop_exception(uuid, uuid, text, text, date, date, text, text) from public, anon, authenticated;
grant execute on function public.request_policy_sop_exception(uuid, uuid, text, text, date, date, text, text) to service_role;

revoke all on function public.decide_policy_sop_exception(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.decide_policy_sop_exception(uuid, uuid, text, text) to service_role;
