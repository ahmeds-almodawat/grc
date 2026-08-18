-- ----------------------------------------------------------------------------
-- Migration: 205_governed_sop_training_and_competency_lifecycle.sql
-- Description: GRC v1.4-E2B1 Governed SOP Training, Acknowledgment, and Competency Lifecycle Foundation
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 1. Version-Scoped Rollout Decision Fields on governed_sop_details
-- ============================================================================
alter table public.governed_sop_details
  add column if not exists retraining_required boolean not null default false,
  add column if not exists reacknowledgment_required boolean not null default true,
  add column if not exists competency_reassessment_required boolean not null default false,
  add column if not exists rollout_decision_rationale text,
  add column if not exists rollout_decided_by uuid references public.profiles(id) on delete set null,
  add column if not exists rollout_decided_at timestamptz;

-- Expand event types on document_review_events for rollout and obligations lifecycle
alter table public.document_review_events drop constraint if exists document_review_events_event_type_check;
alter table public.document_review_events add constraint document_review_events_event_type_check check (
  event_type in (
    'created','submitted_for_review','review_started','review_accepted','review_rejected',
    'submitted_for_approval','approved','rejected','activated','revision_started',
    'superseded','retired','expired','reopened','cancelled','linked','acknowledged',
    'rollout_decided','obligations_published'
  )
);

-- ============================================================================
-- 2. Version-Scoped Narrow Training Target Scopes Table
-- ============================================================================
create table if not exists public.sop_version_training_target_scopes (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references public.document_versions(id) on delete cascade,
  scope_type text not null check (scope_type in ('department', 'role')),
  department_id uuid references public.departments(id) on delete cascade,
  role_name text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  constraint chk_sop_training_scope_shape check (
    (scope_type = 'department' and department_id is not null and role_name is null) or
    (scope_type = 'role' and role_name is not null and department_id is null)
  )
);

create unique index if not exists idx_sop_version_training_target_dept_uniq 
  on public.sop_version_training_target_scopes(sop_version_id, department_id) 
  where scope_type = 'department' and department_id is not null;

create unique index if not exists idx_sop_version_training_target_role_uniq 
  on public.sop_version_training_target_scopes(sop_version_id, role_name) 
  where scope_type = 'role' and role_name is not null;

create index if not exists idx_sop_version_training_target_version 
  on public.sop_version_training_target_scopes(sop_version_id);

-- Enable Row Level Security
alter table public.sop_version_training_target_scopes enable row level security;

drop policy if exists sop_version_training_target_scopes_select on public.sop_version_training_target_scopes;
create policy sop_version_training_target_scopes_select on public.sop_version_training_target_scopes
for select to authenticated
using (exists (
  select 1 from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = sop_version_training_target_scopes.sop_version_id
    and d.organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
));

-- ============================================================================
-- 3. Training Assignments Extension (Exact Version Binding & Obligation Cycle)
-- ============================================================================
alter table public.training_assignments
  add column if not exists document_version_id uuid references public.document_versions(id) on delete restrict,
  add column if not exists obligation_cycle integer default 1 check (obligation_cycle is null or obligation_cycle >= 1),
  add column if not exists cycle_type text default 'initial' check (cycle_type is null or cycle_type in ('initial', 'retraining', 'renewal'));

-- Hard Idempotency Unique Index for Governed SOP Obligations across all lifecycle statuses
create unique index if not exists idx_training_assignments_version_cycle_uniq
  on public.training_assignments(program_id, document_version_id, assigned_to_user_id, obligation_cycle)
  where document_version_id is not null and assigned_to_user_id is not null;

-- Partial unique index on persistent SOP training programs
create unique index if not exists idx_training_programs_sop_persistent_uniq
  on public.training_programs(linked_sop_id)
  where linked_sop_id is not null and training_type = 'sop_acknowledgment';

-- ============================================================================
-- 4. Competency Assessments Segregation of Duties Check Constraint
-- ============================================================================
alter table public.competency_assessments
  drop constraint if exists chk_competency_no_self_assessment;

alter table public.competency_assessments
  add constraint chk_competency_no_self_assessment 
  check (assessor_user_id is null or user_id <> assessor_user_id);

-- ============================================================================
-- 5. Document Acknowledgment Requirements Idempotency Indexes
-- ============================================================================
create unique index if not exists idx_doc_ack_req_ver_all_uniq
  on public.document_acknowledgment_requirements(document_id, version_id, requirement_scope)
  where requirement_scope = 'all_employees' and version_id is not null;

create unique index if not exists idx_doc_ack_req_ver_dept_uniq
  on public.document_acknowledgment_requirements(document_id, version_id, department_id)
  where requirement_scope = 'department' and version_id is not null and department_id is not null;

create unique index if not exists idx_doc_ack_req_ver_role_uniq
  on public.document_acknowledgment_requirements(document_id, version_id, role_name)
  where requirement_scope = 'role' and version_id is not null and role_name is not null;

create unique index if not exists idx_doc_ack_req_ver_user_uniq
  on public.document_acknowledgment_requirements(document_id, version_id, user_id)
  where requirement_scope = 'specific_users' and version_id is not null and user_id is not null;

-- ============================================================================
-- 6. Triggers: Target Scope Validation & Immutability Protection
-- ============================================================================
create or replace function public.fn_validate_sop_training_target_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_type text;
  v_locked_at timestamptz;
  v_approved_at timestamptz;
  v_has_app_scope boolean;
begin
  -- 1. Verify SOP Document Type and Lock State
  select d.document_type, v.locked_at, v.approved_at
  into v_doc_type, v_locked_at, v_approved_at
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = NEW.sop_version_id;

  if v_doc_type is null or v_doc_type <> 'sop' then
    raise exception 'SOP_TRAINING_TARGET_INVALID_DOC_TYPE: Target scopes apply only to SOP documents';
  end if;

  if TG_OP = 'INSERT' or TG_OP = 'UPDATE' then
    if v_locked_at is not null or v_approved_at is not null then
      raise exception 'CANNOT_MODIFY_LOCKED_SOP_VERSION: Cannot alter training targets for approved/locked versions';
    end if;
  end if;

  -- 2. Verify that department override is a subset of SOP applicability
  if NEW.scope_type = 'department' and NEW.department_id is not null then
    select exists (
      select 1 from public.document_version_department_scope
      where version_id = NEW.sop_version_id and department_id = NEW.department_id
    ) into v_has_app_scope;

    -- If SOP has explicit applicability scopes, override MUST be a subset
    if exists (select 1 from public.document_version_department_scope where version_id = NEW.sop_version_id)
       and not v_has_app_scope then
      raise exception 'SOP_TRAINING_TARGET_DEPARTMENT_NOT_IN_APPLICABILITY: Training target department must be included in SOP applicability scope';
    end if;
  end if;

  -- 3. Verify that role override is a subset of SOP applicability
  if NEW.scope_type = 'role' and NEW.role_name is not null then
    select exists (
      select 1 from public.document_version_role_scope
      where version_id = NEW.sop_version_id and role_name = NEW.role_name
    ) into v_has_app_scope;

    -- If SOP has explicit role applicability scopes, override MUST be a subset
    if exists (select 1 from public.document_version_role_scope where version_id = NEW.sop_version_id)
       and not v_has_app_scope then
      raise exception 'SOP_TRAINING_TARGET_ROLE_NOT_IN_APPLICABILITY: Training target role must be included in SOP applicability scope';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_validate_sop_training_target_scope on public.sop_version_training_target_scopes;
create trigger trg_validate_sop_training_target_scope
before insert or update on public.sop_version_training_target_scopes
for each row execute function public.fn_validate_sop_training_target_scope();

revoke all on function public.fn_validate_sop_training_target_scope() from public, anon, authenticated;
grant execute on function public.fn_validate_sop_training_target_scope() to service_role;

-- Immutability on DELETE for locked SOP training target scopes
create or replace function public.fn_immutability_sop_training_target_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_locked boolean;
  v_doc_status text;
begin
  select v.is_locked, d.document_status
  into v_is_locked, v_doc_status
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = OLD.sop_version_id;

  if v_is_locked or v_doc_status in ('approved', 'active', 'retired', 'superseded') then
    raise exception 'CANNOT_DELETE_LOCKED_SOP_TARGET_SCOPE: Cannot delete training target scopes of an approved or locked version';
  end if;

  return OLD;
end;
$$;

drop trigger if exists trg_immutability_sop_training_target_scope on public.sop_version_training_target_scopes;
create trigger trg_immutability_sop_training_target_scope
before delete on public.sop_version_training_target_scopes
for each row execute function public.fn_immutability_sop_training_target_scope();

revoke all on function public.fn_immutability_sop_training_target_scope() from public, anon, authenticated;
grant execute on function public.fn_immutability_sop_training_target_scope() to service_role;

-- Validate SOP Training Assignment Invariants
create or replace function public.fn_validate_sop_training_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_type text;
  v_doc_id uuid;
  v_prog_sop_id uuid;
  v_doc_org_id uuid;
  v_user_org_id uuid;
begin
  if NEW.document_version_id is not null then
    select d.id, d.document_type, d.organization_id
    into v_doc_id, v_doc_type, v_doc_org_id
    from public.document_versions v
    join public.controlled_documents d on d.id = v.document_id
    where v.id = NEW.document_version_id;

    if v_doc_type is null or v_doc_type <> 'sop' then
      raise exception 'INVALID_ASSIGNMENT_DOC_TYPE: Version-bound assignments apply only to SOP documents';
    end if;

    select linked_sop_id into v_prog_sop_id
    from public.training_programs
    where id = NEW.program_id;

    if v_prog_sop_id is not null and v_prog_sop_id <> v_doc_id then
      raise exception 'PROGRAM_SOP_VERSION_MISMATCH: Training program is bound to a different SOP';
    end if;

    if NEW.assigned_to_user_id is not null then
      select organization_id into v_user_org_id
      from public.profiles
      where id = NEW.assigned_to_user_id;

      if v_user_org_id is null or v_user_org_id <> v_doc_org_id then
        raise exception 'CROSS_ORGANIZATION_ASSIGNMENT_DENIED: User does not belong to SOP organization';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_validate_sop_training_assignment on public.training_assignments;
create trigger trg_validate_sop_training_assignment
before insert or update on public.training_assignments
for each row execute function public.fn_validate_sop_training_assignment();

revoke all on function public.fn_validate_sop_training_assignment() from public, anon, authenticated;
grant execute on function public.fn_validate_sop_training_assignment() to service_role;

-- ============================================================================
-- 7. Governed Rollout Decision RPC
-- ============================================================================
create or replace function public.decide_sop_rollout_requirements(
  p_actor_id uuid,
  p_version_id uuid,
  p_retraining_required boolean,
  p_reacknowledgment_required boolean,
  p_competency_reassessment_required boolean,
  p_rationale text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_doc_type text;
  v_doc_status text;
  v_org_id uuid;
  v_actor_org_id uuid;
  v_actor_has_role boolean;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED: Privileged server bridge is required';
  end if;

  if p_rationale is null or length(trim(p_rationale)) < 5 then
    raise exception 'ROLLOUT_DECISION_RATIONALE_REQUIRED: Non-empty decision rationale is mandatory';
  end if;

  -- 1. Fetch version and document context
  select d.id, d.document_type, d.document_status, d.organization_id
  into v_doc_id, v_doc_type, v_doc_status, v_org_id
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id;

  if v_doc_id is null then
    raise exception 'VERSION_NOT_FOUND: Specified document version does not exist';
  end if;

  if v_doc_type <> 'sop' then
    raise exception 'INVALID_DOC_TYPE: Rollout requirements apply only to SOP documents';
  end if;

  -- 2. Verify Actor Organization & Authority
  select organization_id into v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  if v_actor_org_id is null or v_actor_org_id <> v_org_id then
    raise exception 'CROSS_ORGANIZATION_DENIED: Actor does not belong to document organization';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_actor_id
      and role::text in ('super_admin', 'governance_admin', 'compliance_officer', 'quality_director')
  ) into v_actor_has_role;

  if not v_actor_has_role then
    raise exception 'INSUFFICIENT_AUTHORITY: Only Quality or Governance authorities may record rollout decisions';
  end if;

  -- 3. Update rollout decision atomically
  update public.governed_sop_details
  set retraining_required = coalesce(p_retraining_required, false),
      reacknowledgment_required = coalesce(p_reacknowledgment_required, true),
      competency_reassessment_required = coalesce(p_competency_reassessment_required, false),
      rollout_decision_rationale = trim(p_rationale),
      rollout_decided_by = p_actor_id,
      rollout_decided_at = now()
  where version_id = p_version_id;

  -- 4. Emit Audit Event
  perform public.patch26_write_document_event(
    v_doc_id, p_version_id, 'rollout_decided', null, null, p_actor_id,
    'Rollout decision recorded: retraining=' || coalesce(p_retraining_required, false)::text ||
    ', reack=' || coalesce(p_reacknowledgment_required, true)::text ||
    ', competency=' || coalesce(p_competency_reassessment_required, false)::text ||
    '. Rationale: ' || trim(p_rationale),
    null
  );

  return jsonb_build_object(
    'success', true,
    'version_id', p_version_id,
    'retraining_required', coalesce(p_retraining_required, false),
    'reacknowledgment_required', coalesce(p_reacknowledgment_required, true),
    'competency_reassessment_required', coalesce(p_competency_reassessment_required, false),
    'decided_at', now()
  );
end;
$$;

revoke all on function public.decide_sop_rollout_requirements(uuid, uuid, boolean, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.decide_sop_rollout_requirements(uuid, uuid, boolean, boolean, boolean, text) to service_role;

-- ============================================================================
-- 8. Update start_governed_document_revision to Reset Rollout Decisions on Clone
-- ============================================================================
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

  -- Clone SOP structured content with fresh rollout state reset
  if v_doc_type = 'sop' then
    insert into public.governed_sop_details (
      version_id, title_en, title_ar, process_name_en, process_name_ar,
      process_owner_id, purpose_en, purpose_ar, scope_en, scope_ar,
      primary_policy_version_id, governance_link_state, training_required,
      acknowledgment_required, competency_assessment_required, acknowledgment_sla_days,
      training_renewal_months, content_mode, transcription_status,
      retraining_required, reacknowledgment_required, competency_reassessment_required,
      rollout_decision_rationale, rollout_decided_by, rollout_decided_at
    )
    select
      v_new_ver_id, title_en, title_ar, process_name_en, process_name_ar,
      process_owner_id, purpose_en, purpose_ar, scope_en, scope_ar,
      primary_policy_version_id, governance_link_state, training_required,
      acknowledgment_required, competency_assessment_required, acknowledgment_sla_days,
      training_renewal_months, content_mode, transcription_status,
      false, true, false,
      null, null, null
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

    -- Migration 205: Deep-clone target scopes
    insert into public.sop_version_training_target_scopes (
      sop_version_id, scope_type, department_id, role_name, created_by
    )
    select
      v_new_ver_id, scope_type, department_id, role_name, p_actor_id
    from public.sop_version_training_target_scopes
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
    'source_version_id', p_source_version_id,
    'new_version_id', v_new_ver_id,
    'version_id', v_new_ver_id,
    'version_number', v_new_ver_num,
    'version_label', v_new_ver_label,
    'revision_type', p_revision_type
  );
end;
$$;

revoke all on function public.start_governed_document_revision(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.start_governed_document_revision(uuid, uuid, text, text) to service_role;

-- ============================================================================
-- 9. Governed Operational RPC: publish_sop_training_obligations
-- ============================================================================
create or replace function public.publish_sop_training_obligations(
  p_actor_id uuid,
  p_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version record;
  v_doc record;
  v_sop_detail record;
  v_prog_id uuid;
  v_due_date date;
  v_cycle integer := 1;
  v_cycle_type text := 'initial';
  v_assigned_count integer := 0;
  v_ack_req_count integer := 0;
  v_user record;
  v_has_target_dept boolean;
  v_has_target_role boolean;
  v_actor_org_id uuid;
  v_actor_has_role boolean;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  -- 1. Fetch version and document context
  select * into v_version
  from public.document_versions
  where id = p_version_id;

  if not found then
    raise exception 'VERSION_NOT_FOUND';
  end if;

  select * into v_doc
  from public.controlled_documents
  where id = v_version.document_id;

  if not found or v_doc.document_type <> 'sop' then
    raise exception 'INVALID_DOC_TYPE: Only SOP documents support training obligations publication';
  end if;

  -- 2. Verify Actor Organization & Authority
  select organization_id into v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  if v_actor_org_id is null or v_actor_org_id <> v_doc.organization_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_actor_id
      and role::text in ('super_admin', 'governance_admin', 'compliance_officer', 'quality_director', 'training_coordinator')
  ) or (v_doc.document_owner_id = p_actor_id) into v_actor_has_role;

  if not v_actor_has_role then
    raise exception 'INSUFFICIENT_AUTHORITY: Only Quality authorities or Document Owner may publish training obligations';
  end if;

  select * into v_sop_detail
  from public.governed_sop_details
  where version_id = p_version_id;

  -- Revision Rollout Governance Verification:
  -- For revisions, explicit rollout decision is strictly mandatory before obligations can be published.
  if v_version.version_number > 1 or v_version.supersedes_version_id is not null then
    if v_sop_detail.rollout_decided_at is null
       or v_sop_detail.rollout_decided_by is null
       or v_sop_detail.rollout_decision_rationale is null
       or length(trim(v_sop_detail.rollout_decision_rationale)) < 5
    then
      raise exception 'ROLLOUT_DECISION_REQUIRED: Governed rollout requirements must be decided prior to publishing revision obligations';
    end if;

    if coalesce(v_sop_detail.retraining_required, false) then
      v_cycle_type := 'retraining';
    end if;
  end if;

  -- 3. Calculate Due Date (effective date or now + SLA days)
  v_due_date := coalesce(v_doc.effective_date, current_date) + coalesce(v_sop_detail.acknowledgment_sla_days, 30);

  -- 4. Get or Create Persistent Authoritative Training Program
  select id into v_prog_id
  from public.training_programs
  where linked_sop_id = v_doc.id and training_type = 'sop_acknowledgment'
  order by created_at asc
  limit 1;

  if v_prog_id is null then
    insert into public.training_programs (
      title, title_ar, description, training_type,
      linked_document_id, linked_sop_id, owner_user_id, department_id, active, created_by
    ) values (
      v_doc.document_title || ' — Standard Training',
      v_doc.document_title || ' — التدريب الإجرائي المعتمد',
      'Governed training and acknowledgment program for SOP: ' || v_doc.document_title,
      'sop_acknowledgment',
      v_doc.id, v_doc.id, coalesce(v_sop_detail.process_owner_id, p_actor_id),
      v_doc.department_id, true, p_actor_id
    ) returning id into v_prog_id;
  end if;

  -- 5. Determine Target Scopes Override Status
  select exists (
    select 1 from public.sop_version_training_target_scopes
    where sop_version_id = p_version_id and scope_type = 'department'
  ) into v_has_target_dept;

  select exists (
    select 1 from public.sop_version_training_target_scopes
    where sop_version_id = p_version_id and scope_type = 'role'
  ) into v_has_target_role;

  -- 6. Resolve Target Population and Create Version-Bound Assignments Idempotently
  -- Only create training assignments if initial version has training_required OR revision has retraining_required
  if (
    (v_version.version_number = 1 and v_version.supersedes_version_id is null and coalesce(v_sop_detail.training_required, false) = true)
    or
    ((v_version.version_number > 1 or v_version.supersedes_version_id is not null) and coalesce(v_sop_detail.retraining_required, false) = true)
  ) then
    for v_user in (
      select distinct p.id as user_id, p.department_id
      from public.profiles p
      left join public.user_roles ur on ur.user_id = p.id
      where p.organization_id = v_doc.organization_id
        and coalesce(p.is_active, true) = true
        -- Department filtering
        and (
          case
            when v_has_target_dept then
              p.department_id in (
                select department_id from public.sop_version_training_target_scopes
                where sop_version_id = p_version_id and scope_type = 'department'
              )
            when exists (select 1 from public.document_version_department_scope where version_id = p_version_id) then
              p.department_id in (
                select department_id from public.document_version_department_scope
                where version_id = p_version_id
              )
            else true
          end
        )
        -- Role filtering
        and (
          case
            when v_has_target_role then
              ur.role::text in (
                select role_name from public.sop_version_training_target_scopes
                where sop_version_id = p_version_id and scope_type = 'role'
              )
            when exists (select 1 from public.document_version_role_scope where version_id = p_version_id) then
              ur.role::text in (
                select role_name from public.document_version_role_scope
                where version_id = p_version_id
              )
            else true
          end
        )
    ) loop
      -- Insert training assignment if not already exists in cycle
      if not exists (
        select 1 from public.training_assignments
        where program_id = v_prog_id
          and document_version_id = p_version_id
          and assigned_to_user_id = v_user.user_id
          and obligation_cycle = v_cycle
      ) then
        insert into public.training_assignments (
          program_id, document_version_id, assigned_to_user_id,
          assigned_to_department_id, due_date, status,
          obligation_cycle, cycle_type, assigned_by
        ) values (
          v_prog_id, p_version_id, v_user.user_id,
          v_user.department_id, v_due_date, 'assigned',
          v_cycle, v_cycle_type, p_actor_id
        );
        v_assigned_count := v_assigned_count + 1;
      end if;
    end loop;
  end if;

  -- 7. Initialize Patch 26 Acknowledgment Requirements if Acknowledgment Required
  if (
    (v_version.version_number = 1 and v_version.supersedes_version_id is null and coalesce(v_sop_detail.acknowledgment_required, true) = true)
    or
    ((v_version.version_number > 1 or v_version.supersedes_version_id is not null) and coalesce(v_sop_detail.reacknowledgment_required, true) = true)
  ) then
    if not exists (
      select 1 from public.document_acknowledgment_requirements
      where document_id = v_doc.id and version_id = p_version_id and requirement_scope = 'all_employees'
    ) then
      insert into public.document_acknowledgment_requirements (
        document_id, version_id, requirement_scope, due_date, required_flag, created_by
      ) values (
        v_doc.id, p_version_id, 'all_employees', v_due_date, true, p_actor_id
      );
      v_ack_req_count := v_ack_req_count + 1;
    end if;
  end if;

  -- 8. Audit event
  perform public.log_training_event(
    'training_programs', v_prog_id, 'obligations_published',
    'Published training obligations for SOP ' || v_doc.document_code || ' ' || v_version.version_label ||
    ': ' || v_assigned_count || ' assignments created.',
    p_actor_id
  );

  return jsonb_build_object(
    'success', true,
    'version_id', p_version_id,
    'program_id', v_prog_id,
    'cycle', v_cycle,
    'cycle_type', v_cycle_type,
    'assignments_created', v_assigned_count,
    'acknowledgment_requirements_created', v_ack_req_count
  );
end;
$$;

revoke all on function public.publish_sop_training_obligations(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_sop_training_obligations(uuid, uuid) to service_role;

-- ============================================================================
-- 10. Governed Operational RPC: reconcile_sop_training_population
-- ============================================================================
create or replace function public.reconcile_sop_training_population(
  p_actor_id uuid,
  p_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version record;
  v_doc record;
  v_sop_detail record;
  v_prog_id uuid;
  v_due_date date;
  v_cycle integer := 1;
  v_cycle_type text := 'initial';
  v_added_count integer := 0;
  v_cancelled_count integer := 0;
  v_user record;
  v_has_target_dept boolean;
  v_has_target_role boolean;
  v_actor_org_id uuid;
  v_actor_has_role boolean;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  -- 1. Fetch version and document context
  select * into v_version
  from public.document_versions
  where id = p_version_id;

  if not found then
    raise exception 'VERSION_NOT_FOUND';
  end if;

  select * into v_doc
  from public.controlled_documents
  where id = v_version.document_id;

  if not found or v_doc.document_type <> 'sop' then
    raise exception 'INVALID_DOC_TYPE';
  end if;

  -- 2. Verify Actor Organization & Authority
  select organization_id into v_actor_org_id
  from public.profiles
  where id = p_actor_id;

  if v_actor_org_id is null or v_actor_org_id <> v_doc.organization_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_actor_id
      and role::text in ('super_admin', 'governance_admin', 'compliance_officer', 'quality_director', 'training_coordinator')
  ) or (v_doc.document_owner_id = p_actor_id) into v_actor_has_role;

  if not v_actor_has_role then
    raise exception 'INSUFFICIENT_AUTHORITY';
  end if;

  select id into v_prog_id
  from public.training_programs
  where linked_sop_id = v_doc.id and training_type = 'sop_acknowledgment'
  order by created_at asc
  limit 1;

  if v_prog_id is null then
    raise exception 'TRAINING_PROGRAM_NOT_PUBLISHED: Publish obligations first before running reconciliation';
  end if;

  select * into v_sop_detail
  from public.governed_sop_details
  where version_id = p_version_id;

  v_due_date := coalesce(v_doc.effective_date, current_date) + coalesce(v_sop_detail.acknowledgment_sla_days, 30);

  if v_version.version_number > 1 or v_version.supersedes_version_id is not null then
    if coalesce(v_sop_detail.retraining_required, false) then
      v_cycle_type := 'retraining';
    end if;
  end if;

  select exists (
    select 1 from public.sop_version_training_target_scopes
    where sop_version_id = p_version_id and scope_type = 'department'
  ) into v_has_target_dept;

  select exists (
    select 1 from public.sop_version_training_target_scopes
    where sop_version_id = p_version_id and scope_type = 'role'
  ) into v_has_target_role;

  -- 3. Add newly eligible active users (Current cycle only, idempotent no-op for existing)
  -- Only add training assignments if initial training or revision retraining is required
  if (
    (v_version.version_number = 1 and v_version.supersedes_version_id is null and coalesce(v_sop_detail.training_required, false) = true)
    or
    ((v_version.version_number > 1 or v_version.supersedes_version_id is not null) and coalesce(v_sop_detail.retraining_required, false) = true)
  ) then
    for v_user in (
      select distinct p.id as user_id, p.department_id
      from public.profiles p
      left join public.user_roles ur on ur.user_id = p.id
      where p.organization_id = v_doc.organization_id
        and coalesce(p.is_active, true) = true
        and (
          case
            when v_has_target_dept then
              p.department_id in (
                select department_id from public.sop_version_training_target_scopes
                where sop_version_id = p_version_id and scope_type = 'department'
              )
            when exists (select 1 from public.document_version_department_scope where version_id = p_version_id) then
              p.department_id in (
                select department_id from public.document_version_department_scope
                where version_id = p_version_id
              )
            else true
          end
        )
        and (
          case
            when v_has_target_role then
              ur.role::text in (
                select role_name from public.sop_version_training_target_scopes
                where sop_version_id = p_version_id and scope_type = 'role'
              )
            when exists (select 1 from public.document_version_role_scope where version_id = p_version_id) then
              ur.role::text in (
                select role_name from public.document_version_role_scope
                where version_id = p_version_id
              )
            else true
          end
        )
    ) loop
      if not exists (
        select 1 from public.training_assignments
        where program_id = v_prog_id
          and document_version_id = p_version_id
          and assigned_to_user_id = v_user.user_id
          and obligation_cycle = v_cycle
      ) then
        insert into public.training_assignments (
          program_id, document_version_id, assigned_to_user_id,
          assigned_to_department_id, due_date, status,
          obligation_cycle, cycle_type, assigned_by
        ) values (
          v_prog_id, p_version_id, v_user.user_id,
          v_user.department_id, v_due_date, 'assigned',
          v_cycle, v_cycle_type, p_actor_id
        );
        v_added_count := v_added_count + 1;
      end if;
    end loop;
  end if;

  -- 4. Cancel open uncompleted obligations for users who left target population (deactivated OR transferred out of target scope)
  update public.training_assignments
  set status = 'cancelled'
  where program_id = v_prog_id
    and document_version_id = p_version_id
    and obligation_cycle = v_cycle
    and status in ('assigned', 'in_progress')
    and assigned_to_user_id not in (
      select distinct p.id
      from public.profiles p
      left join public.user_roles ur on ur.user_id = p.id
      where p.organization_id = v_doc.organization_id
        and coalesce(p.is_active, true) = true
        and (
          case
            when v_has_target_dept then
              p.department_id in (
                select department_id from public.sop_version_training_target_scopes
                where sop_version_id = p_version_id and scope_type = 'department'
              )
            when exists (select 1 from public.document_version_department_scope where version_id = p_version_id) then
              p.department_id in (
                select department_id from public.document_version_department_scope
                where version_id = p_version_id
              )
            else true
          end
        )
        and (
          case
            when v_has_target_role then
              ur.role::text in (
                select role_name from public.sop_version_training_target_scopes
                where sop_version_id = p_version_id and scope_type = 'role'
              )
            when exists (select 1 from public.document_version_role_scope where version_id = p_version_id) then
              ur.role::text in (
                select role_name from public.document_version_role_scope
                where version_id = p_version_id
              )
            else true
          end
        )
    );

  get diagnostics v_cancelled_count = row_count;

  return jsonb_build_object(
    'success', true,
    'version_id', p_version_id,
    'program_id', v_prog_id,
    'cycle', v_cycle,
    'newly_assigned_count', v_added_count,
    'cancelled_out_of_scope_count', v_cancelled_count,
    'inactive_cancelled_count', v_cancelled_count
  );
end;
$$;

revoke all on function public.reconcile_sop_training_population(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reconcile_sop_training_population(uuid, uuid) to service_role;

-- ============================================================================
-- 10B. Governed Operational RPC: complete_training_assignment
-- ============================================================================
create or replace function public.complete_training_assignment(
  p_assignment_id uuid,
  p_evidence_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assign record;
  v_prog record;
  v_actor_org_id uuid;
  v_target_org_id uuid;
  v_has_auth boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_assign
  from public.training_assignments
  where id = p_assignment_id;

  if not found or v_assign.status not in ('assigned', 'in_progress', 'overdue') then
    raise exception 'PATCH29_ASSIGNMENT_NOT_COMPLETABLE';
  end if;

  select * into v_prog
  from public.training_programs
  where id = v_assign.program_id;

  -- Verify Organization Boundary
  select organization_id into v_actor_org_id from public.profiles where id = p_actor_id;
  select organization_id into v_target_org_id from public.profiles where id = v_assign.assigned_to_user_id;

  if v_actor_org_id is null or v_target_org_id is null or v_actor_org_id <> v_target_org_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  -- SOP acknowledgment self-completion vs formal training completion
  if v_prog.training_type = 'sop_acknowledgment' and v_assign.assigned_to_user_id = p_actor_id then
    v_has_auth := true;
  else
    select exists (
      select 1 from public.user_roles
      where user_id = p_actor_id
        and role::text in ('super_admin', 'governance_admin', 'compliance_officer', 'quality_director', 'training_coordinator', 'department_manager', 'division_head')
    ) or (v_prog.owner_user_id = p_actor_id) into v_has_auth;
  end if;

  if not v_has_auth then
    raise exception 'UNAUTHORIZED_TRAINING_COMPLETER: Only training coordinators, managers, or Quality authorities may certify formal training completion';
  end if;

  update public.training_assignments
  set status = 'completed', completed_at = now(), completion_evidence_id = p_evidence_id
  where id = p_assignment_id;

  perform public.log_training_event(
    'training_assignments', p_assignment_id, 'completed',
    'Training completed successfully with evidence ' || coalesce(p_evidence_id::text, 'none') || '.',
    p_actor_id
  );
end;
$$;

revoke all on function public.complete_training_assignment(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_training_assignment(uuid, uuid, uuid) to service_role;

-- ============================================================================
-- 11. Hardened Competency Assessment RPC with SOD Enforcement
-- ============================================================================
create or replace function public.record_competency_assessment(
  p_assignment_id uuid,
  p_user_id uuid,
  p_competency_area text,
  p_result text,
  p_score numeric,
  p_evidence_id uuid,
  p_notes text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assessment_id uuid;
  v_assign_user_id uuid;
  v_actor_org_id uuid;
  v_target_org_id uuid;
  v_actor_has_role boolean;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then 
    raise exception 'PATCH29_TRAINING_SERVICE_ROLE_REQUIRED'; 
  end if;

  -- 1. Segregation of Duties: Assessor cannot assess themselves
  if p_actor_id = p_user_id then
    raise exception 'SOD_VIOLATION_SELF_ASSESSMENT: Employees cannot assess their own competency';
  end if;

  -- 2. Validate Assignment Subject
  if p_assignment_id is not null then
    select assigned_to_user_id into v_assign_user_id
    from public.training_assignments
    where id = p_assignment_id;

    if v_assign_user_id is not null and v_assign_user_id <> p_user_id then
      raise exception 'SUBJECT_MISMATCH: Target user does not match assignment owner';
    end if;
  end if;

  -- 3. Verify Organization and Assessor Authority
  select organization_id into v_actor_org_id from public.profiles where id = p_actor_id;
  select organization_id into v_target_org_id from public.profiles where id = p_user_id;

  if v_actor_org_id is null or v_target_org_id is null or v_actor_org_id <> v_target_org_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_actor_id
      and role::text in ('super_admin', 'governance_admin', 'compliance_officer', 'department_manager', 'division_head', 'executive', 'quality_director', 'training_coordinator')
  ) into v_actor_has_role;

  if not v_actor_has_role then
    raise exception 'UNAUTHORIZED_ASSESSOR: Assessor must hold supervisor, manager, or quality authority';
  end if;

  insert into public.competency_assessments (
    assignment_id, user_id, assessor_user_id, competency_area, result, score, evidence_id, notes
  ) values (
    p_assignment_id, p_user_id, p_actor_id, p_competency_area, p_result, p_score, p_evidence_id, p_notes
  ) returning id into v_assessment_id;

  perform public.log_training_event(
    'competency_assessments', v_assessment_id, 'assessed', 
    'Competency assessed for user ' || p_user_id || ' in area ' || p_competency_area || '. Result: ' || p_result, 
    p_actor_id
  );

  return v_assessment_id;
end;
$$;

revoke all on function public.record_competency_assessment(uuid, uuid, text, text, numeric, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_competency_assessment(uuid, uuid, text, text, numeric, uuid, text, uuid) to service_role;

-- ============================================================================
-- 12. Read-Only Operational Compliance Matrix View
-- ============================================================================
create or replace view public.v_sop_training_compliance_matrix
with (security_invoker = true)
as
with version_targets as (
  select
    v.id as sop_version_id,
    d.id as document_id,
    d.organization_id,
    d.document_code,
    d.document_title,
    v.version_number,
    v.version_label,
    d.document_status,
    coalesce(s.training_required, false) as training_required,
    coalesce(s.acknowledgment_required, true) as acknowledgment_required,
    coalesce(s.competency_assessment_required, false) as competency_assessment_required,
    s.training_renewal_months
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  left join public.governed_sop_details s on s.version_id = v.id
  where d.document_type = 'sop'
),
assignment_aggregates as (
  select
    ta.document_version_id as sop_version_id,
    count(distinct ta.assigned_to_user_id) filter (where ta.status <> 'cancelled') as assigned_count,
    count(distinct ta.assigned_to_user_id) filter (where ta.status = 'in_progress') as in_progress_count,
    count(distinct ta.assigned_to_user_id) filter (where ta.status = 'completed') as completed_count,
    count(distinct ta.assigned_to_user_id) filter (where ta.status = 'overdue') as overdue_count,
    count(distinct ta.assigned_to_user_id) filter (where ta.status = 'waived') as waived_count,
    count(distinct ta.assigned_to_user_id) filter (where ta.status = 'cancelled') as cancelled_count,
    count(distinct ta.assigned_to_user_id) filter (
      where ta.status = 'completed'
        and vt.training_renewal_months is not null
        and ta.completed_at <= now() - (vt.training_renewal_months || ' months')::interval
    ) as renewal_due_count
  from public.training_assignments ta
  join version_targets vt on vt.sop_version_id = ta.document_version_id
  group by ta.document_version_id, vt.training_renewal_months
),
ack_aggregates as (
  select
    da.version_id as sop_version_id,
    count(distinct da.user_id) as acknowledged_count
  from public.document_acknowledgments da
  group by da.version_id
),
competency_aggregates as (
  select
    ta.document_version_id as sop_version_id,
    count(distinct ca.user_id) filter (where ca.result = 'passed') as competency_passed_count,
    count(distinct ca.user_id) filter (where ca.result in ('failed', 'needs_retraining')) as competency_failed_count,
    count(distinct ca.user_id) filter (where ca.result = 'pending') as competency_pending_count
  from public.competency_assessments ca
  join public.training_assignments ta on ta.id = ca.assignment_id
  where ta.document_version_id is not null
  group by ta.document_version_id
)
select
  vt.sop_version_id,
  vt.document_id,
  vt.organization_id,
  vt.document_code,
  vt.document_title,
  vt.version_number,
  vt.version_label,
  vt.document_status,
  vt.training_required,
  vt.acknowledgment_required,
  vt.competency_assessment_required,
  coalesce(aa.assigned_count, 0) as target_population_count,
  coalesce(aa.assigned_count, 0) as assigned_count,
  coalesce(aa.in_progress_count, 0) as in_progress_count,
  coalesce(aa.completed_count, 0) as completed_count,
  coalesce(aa.overdue_count, 0) as overdue_count,
  coalesce(aa.waived_count, 0) as waived_count,
  coalesce(aa.cancelled_count, 0) as cancelled_count,
  coalesce(aka.acknowledged_count, 0) as acknowledged_count,
  greatest(0, coalesce(aa.assigned_count, 0) - coalesce(aka.acknowledged_count, 0)) as acknowledgment_gap_count,
  coalesce(ca.competency_passed_count, 0) as competency_passed_count,
  coalesce(ca.competency_failed_count, 0) as competency_failed_count,
  coalesce(ca.competency_pending_count, 0) as competency_pending_count,
  coalesce(aa.renewal_due_count, 0) as renewal_due_count
from version_targets vt
left join assignment_aggregates aa on aa.sop_version_id = vt.sop_version_id
left join ack_aggregates aka on aka.sop_version_id = vt.sop_version_id
left join competency_aggregates ca on ca.sop_version_id = vt.sop_version_id;

grant select on public.v_sop_training_compliance_matrix to authenticated;
