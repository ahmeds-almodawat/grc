-- ============================================================================
-- Migration 207: Governed SOP Runtime Contract Remediation
-- 
-- Corrects save_governed_sop_draft persistence contract to match the actual
-- established Production schema:
-- 1. document_version_role_scope: role_name, job_title
-- 2. sop_role_responsibilities: role_name, job_title, responsibility_en, responsibility_ar, accountable_for_en, accountable_for_ar, sequence_number
-- 3. sop_monitoring_kpis: kpi_name_en, kpi_name_ar, target_value, measurement_frequency, owner_id, description_en, description_ar, sequence_number
-- 4. sop_version_risk_links: risk_id, relationship_type ('mitigates', 'risk_if_not_followed', 'operational_context'), context_note_en, context_note_ar, sequence_number
-- 5. sop_version_accreditation_links: clause_id, link_strength ('primary', 'supporting', 'reference', 'gap'), context_note_en, context_note_ar, sequence_number
-- 6. governed_document_version_links: target_version_id, relationship_type, context_note_en, context_note_ar, sequence_number
-- 7. sop_procedure_steps: preserves complete migration 206 contract & nested RACI
-- 8. ACL: SECURITY DEFINER, service_role-only execution (public, anon, authenticated revoked)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Replace save_governed_sop_draft with corrected production-aligned schema
-- ----------------------------------------------------------------------------
drop function if exists public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);

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
  p_content_mode text default null,
  p_transcription_status text default null,
  p_procedure_sections jsonb default null,
  p_procedure_steps jsonb default null,
  p_department_scopes uuid[] default null,
  p_role_scopes jsonb default null,
  p_definitions jsonb default null,
  p_role_responsibilities jsonb default null,
  p_monitoring_kpis jsonb default null,
  p_risk_links jsonb default null,
  p_accreditation_links jsonb default null,
  p_version_links jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_id uuid;
  v_org_id uuid;
  v_doc_owner_id uuid;
  v_prepared_by uuid;
  v_sec jsonb;
  v_step jsonb;
  v_raci jsonb;
  v_def jsonb;
  v_resp jsonb;
  v_kpi jsonb;
  v_risk jsonb;
  v_acc jsonb;
  v_link jsonb;
  v_dept_id uuid;
  v_role jsonb;
  v_item_id uuid;
  v_step_id uuid;
  v_sec_id uuid;
  v_primary_r_role text;

  v_existing_sec_ids uuid[];
  v_existing_step_ids uuid[];
  v_existing_def_ids uuid[];
  v_existing_resp_ids uuid[];
  v_existing_kpi_ids uuid[];
  v_existing_risk_ids uuid[];
  v_existing_acc_ids uuid[];
  v_existing_link_ids uuid[];

  v_payload_sec_ids uuid[] := '{}'::uuid[];
  v_payload_step_ids uuid[] := '{}'::uuid[];
  v_payload_def_ids uuid[] := '{}'::uuid[];
  v_payload_resp_ids uuid[] := '{}'::uuid[];
  v_payload_kpi_ids uuid[] := '{}'::uuid[];
  v_payload_risk_ids uuid[] := '{}'::uuid[];
  v_payload_acc_ids uuid[] := '{}'::uuid[];
  v_payload_link_ids uuid[] := '{}'::uuid[];

  v_section_key_map jsonb := '{}'::jsonb;
  v_step_key_map jsonb := '{}'::jsonb;
begin
  set constraints uq_sop_sections_version_seq, uq_sop_steps_version_seq deferred;

  select d.id, d.organization_id, d.document_owner_id, v.prepared_by
  into v_doc_id, v_org_id, v_doc_owner_id, v_prepared_by
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id and d.document_type = 'sop';

  if v_doc_id is null then raise exception 'PATCH202_SOP_VERSION_NOT_FOUND'; end if;

  -- Validate Actor Tenancy
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and organization_id = v_org_id and coalesce(is_active, true) = true
  ) then
    raise exception 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN';
  end if;

  -- Validate Business Authority: prepared_by, document_owner_id, or active same-org governance_admin / super_admin
  if not (
    coalesce(v_prepared_by, '00000000-0000-0000-0000-000000000000'::uuid) = p_actor_id
    or coalesce(v_doc_owner_id, '00000000-0000-0000-0000-000000000000'::uuid) = p_actor_id
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_actor_id
        and ur.is_active = true
        and ur.role in ('super_admin', 'governance_admin')
        and (ur.organization_id is null or ur.organization_id = v_org_id)
    )
  ) then
    raise exception 'PATCH202_ACTOR_NOT_AUTHORIZED';
  end if;

  if exists (select 1 from public.document_versions where id = p_version_id and (locked_at is not null or approved_at is not null)) then
    raise exception 'PATCH201_VERSION_IMMUTABLE_LOCKED';
  end if;

  if p_title_en is not null then
    update public.controlled_documents set document_title = p_title_en, updated_at = now() where id = v_doc_id;
  end if;

  insert into public.governed_sop_details (
    version_id, title_en, title_ar, process_name_en, process_name_ar,
    purpose_en, purpose_ar, scope_en, scope_ar, process_owner_id,
    primary_policy_version_id, governance_link_state, training_required,
    acknowledgment_required, competency_assessment_required,
    acknowledgment_sla_days, training_renewal_months,
    content_mode, transcription_status, updated_at
  ) values (
    p_version_id, coalesce(p_title_en, 'Untitled SOP'), p_title_ar,
    coalesce(p_process_name_en, 'General Process'), p_process_name_ar,
    coalesce(p_purpose_en, 'Operational standard procedure'), p_purpose_ar,
    p_scope_en, p_scope_ar, p_process_owner_id, p_primary_policy_version_id,
    coalesce(p_governance_link_state, case when p_primary_policy_version_id is not null then 'linked' else 'not_applicable' end),
    coalesce(p_training_required, false), coalesce(p_acknowledgment_required, true),
    coalesce(p_competency_assessment_required, false), coalesce(p_acknowledgment_sla_days, 30),
    coalesce(p_training_renewal_months, 12),
    coalesce(p_content_mode, 'structured'),
    case when coalesce(p_content_mode, 'structured') = 'structured'
         then coalesce(p_transcription_status, 'complete')
         else coalesce(p_transcription_status, 'not_required') end,
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
    governance_link_state = coalesce(p_governance_link_state, case when coalesce(p_primary_policy_version_id, governed_sop_details.primary_policy_version_id) is not null then 'linked' else governed_sop_details.governance_link_state end),
    training_required = coalesce(p_training_required, governed_sop_details.training_required),
    acknowledgment_required = coalesce(p_acknowledgment_required, governed_sop_details.acknowledgment_required),
    competency_assessment_required = coalesce(p_competency_assessment_required, governed_sop_details.competency_assessment_required),
    acknowledgment_sla_days = coalesce(p_acknowledgment_sla_days, governed_sop_details.acknowledgment_sla_days),
    training_renewal_months = coalesce(p_training_renewal_months, governed_sop_details.training_renewal_months),
    content_mode = coalesce(p_content_mode, governed_sop_details.content_mode),
    transcription_status = coalesce(p_transcription_status, governed_sop_details.transcription_status),
    updated_at = now();

  -- 1. Reconcile Sections & Map Keys
  create temp table if not exists tmp_sec_key_map (client_key text primary key, sec_id uuid not null) on commit drop;
  truncate table tmp_sec_key_map;

  if p_procedure_sections is not null then
    select array_agg(id) into v_existing_sec_ids from public.sop_procedure_sections where sop_version_id = p_version_id;

    for v_sec in select * from jsonb_array_elements(p_procedure_sections)
    loop
      v_item_id := nullif(v_sec->>'id', '')::uuid;
      if v_item_id is not null then
        if not (v_item_id = any(coalesce(v_existing_sec_ids, '{}'::uuid[]))) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        v_payload_sec_ids := array_append(v_payload_sec_ids, v_item_id);
        update public.sop_procedure_sections set
          sequence_number = (v_sec->>'sequence_number')::integer,
          title_en = coalesce(v_sec->>'title_en', title_en),
          title_ar = v_sec->>'title_ar',
          description_en = v_sec->>'description_en',
          description_ar = v_sec->>'description_ar',
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        v_item_id := gen_random_uuid();
        insert into public.sop_procedure_sections (
          id, sop_version_id, sequence_number, title_en, title_ar, description_en, description_ar
        ) values (
          v_item_id, p_version_id, (v_sec->>'sequence_number')::integer,
          coalesce(v_sec->>'title_en', 'Section ' || coalesce(v_sec->>'sequence_number', '1')),
          v_sec->>'title_ar', v_sec->>'description_en', v_sec->>'description_ar'
        );
        v_payload_sec_ids := array_append(v_payload_sec_ids, v_item_id);
      end if;

      if nullif(v_sec->>'client_key', '') is not null then
        insert into tmp_sec_key_map (client_key, sec_id) values (v_sec->>'client_key', v_item_id);
        v_section_key_map := jsonb_set(v_section_key_map, array[v_sec->>'client_key'], to_jsonb(v_item_id::text));
      end if;
    end loop;
  end if;

  -- 2. Reconcile Steps & Nested RACI
  if p_procedure_steps is not null then
    select array_agg(id) into v_existing_step_ids from public.sop_procedure_steps where sop_version_id = p_version_id;

    for v_step in select * from jsonb_array_elements(p_procedure_steps)
    loop
      v_sec_id := nullif(v_step->>'section_id', '')::uuid;
      if v_sec_id is null and nullif(v_step->>'section_client_key', '') is not null then
        select sec_id into v_sec_id from tmp_sec_key_map where client_key = v_step->>'section_client_key';
        if v_sec_id is null then
          raise exception 'PATCH206_UNRESOLVED_SECTION_CLIENT_KEY';
        end if;
      end if;

      v_step_id := nullif(v_step->>'id', '')::uuid;
      if v_step_id is not null then
        if not (v_step_id = any(coalesce(v_existing_step_ids, '{}'::uuid[]))) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;
        v_payload_step_ids := array_append(v_payload_step_ids, v_step_id);

        if v_step ? 'raci_assignments' then
          -- A. raci_assignments explicitly present with >=1 R -> primary R
          -- B. raci_assignments explicitly present with no R -> NULL
          select nullif(trim(r->>'role_name'), '') into v_primary_r_role
          from jsonb_array_elements(v_step->'raci_assignments') r
          where r->>'raci_type' = 'R'
          limit 1;

          update public.sop_procedure_steps set
            section_id = v_sec_id,
            sequence_number = (v_step->>'sequence_number')::integer,
            responsible_role = v_primary_r_role,
            action_instruction_en = coalesce(v_step->>'action_instruction_en', action_instruction_en),
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
          where id = v_step_id and sop_version_id = p_version_id;
        else
          -- C. raci_assignments omitted:
          -- If explicit responsible_role supplied -> use supplied legacy value
          -- If responsible_role omitted -> PRESERVE existing DB value
          update public.sop_procedure_steps set
            section_id = v_sec_id,
            sequence_number = (v_step->>'sequence_number')::integer,
            responsible_role = case when v_step ? 'responsible_role' then nullif(trim(v_step->>'responsible_role'), '') else responsible_role end,
            action_instruction_en = coalesce(v_step->>'action_instruction_en', action_instruction_en),
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
          where id = v_step_id and sop_version_id = p_version_id;
        end if;
      else
        -- NEW step
        v_step_id := gen_random_uuid();
        if v_step ? 'raci_assignments' then
          select nullif(trim(r->>'role_name'), '') into v_primary_r_role
          from jsonb_array_elements(v_step->'raci_assignments') r
          where r->>'raci_type' = 'R'
          limit 1;
        else
          v_primary_r_role := nullif(trim(v_step->>'responsible_role'), '');
        end if;

        insert into public.sop_procedure_steps (
          id, sop_version_id, section_id, sequence_number, responsible_role,
          action_instruction_en, action_instruction_ar, required_control_id,
          expected_evidence_record_en, expected_evidence_record_ar,
          timing_sla_en, timing_sla_ar, is_decision_point,
          decision_criteria_en, decision_criteria_ar, criticality,
          escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
        ) values (
          v_step_id, p_version_id, v_sec_id, (v_step->>'sequence_number')::integer,
          v_primary_r_role,
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
        );
        v_payload_step_ids := array_append(v_payload_step_ids, v_step_id);
      end if;

      if nullif(v_step->>'client_key', '') is not null then
        v_step_key_map := jsonb_set(v_step_key_map, array[v_step->>'client_key'], to_jsonb(v_step_id::text));
      end if;

      -- Reconcile RACI rows for this step
      if v_step ? 'raci_assignments' then
        delete from public.sop_procedure_step_raci_assignments where step_id = v_step_id and sop_version_id = p_version_id;

        for v_raci in select * from jsonb_array_elements(v_step->'raci_assignments')
        loop
          if nullif(trim(v_raci->>'role_name'), '') is not null then
            insert into public.sop_procedure_step_raci_assignments (
              sop_version_id, step_id, raci_type, role_name, role_label_ar, job_title, sequence_number
            ) values (
              p_version_id, v_step_id, v_raci->>'raci_type',
              trim(v_raci->>'role_name'),
              nullif(trim(v_raci->>'role_label_ar'), ''),
              nullif(trim(v_raci->>'job_title'), ''),
              coalesce((v_raci->>'sequence_number')::integer, 1)
            );
          end if;
        end loop;
      end if;
    end loop;

    delete from public.sop_procedure_steps where sop_version_id = p_version_id and not (id = any(v_payload_step_ids));
  end if;

  if p_procedure_sections is not null then
    delete from public.sop_procedure_sections where sop_version_id = p_version_id and not (id = any(v_payload_sec_ids));
  end if;

  -- 3. Reconcile Version Links
  if p_version_links is not null then
    select array_agg(id) into v_existing_link_ids from public.governed_document_version_links where source_version_id = p_version_id;
    for v_link in select * from jsonb_array_elements(p_version_links) loop
      v_item_id := nullif(v_link->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_link_ids, '{}'::uuid[]))) then
        v_payload_link_ids := array_append(v_payload_link_ids, v_item_id);
        update public.governed_document_version_links set
          target_version_id = (v_link->>'target_version_id')::uuid,
          relationship_type = v_link->>'relationship_type',
          context_note_en = v_link->>'context_note_en',
          context_note_ar = v_link->>'context_note_ar',
          sequence_number = coalesce((v_link->>'sequence_number')::integer, sequence_number),
          updated_at = now()
        where id = v_item_id and source_version_id = p_version_id;
      else
        insert into public.governed_document_version_links (
          source_version_id, target_version_id, relationship_type, context_note_en, context_note_ar, sequence_number
        ) values (
          p_version_id, (v_link->>'target_version_id')::uuid, v_link->>'relationship_type',
          v_link->>'context_note_en', v_link->>'context_note_ar', coalesce((v_link->>'sequence_number')::integer, 1)
        ) returning id into v_item_id;
        v_payload_link_ids := array_append(v_payload_link_ids, v_item_id);
      end if;
    end loop;
    delete from public.governed_document_version_links where source_version_id = p_version_id and not (id = any(v_payload_link_ids));
  end if;

  -- 4. Department Scopes
  if p_department_scopes is not null then
    delete from public.document_version_department_scope where version_id = p_version_id;
    foreach v_dept_id in array p_department_scopes loop
      insert into public.document_version_department_scope (version_id, department_id) values (p_version_id, v_dept_id);
    end loop;
  end if;

  -- 5. Role Scopes (persisting role_name, job_title; enforcing at least one is populated)
  if p_role_scopes is not null then
    delete from public.document_version_role_scope where version_id = p_version_id;
    for v_role in select * from jsonb_array_elements(p_role_scopes) loop
      if nullif(trim(coalesce(v_role->>'role_name', '')), '') is not null or nullif(trim(coalesce(v_role->>'job_title', '')), '') is not null then
        insert into public.document_version_role_scope (version_id, role_name, job_title)
        values (
          p_version_id,
          nullif(trim(v_role->>'role_name'), ''),
          nullif(trim(v_role->>'job_title'), '')
        );
      end if;
    end loop;
  end if;

  -- 6. Definitions (term_en, term_ar, definition_en, definition_ar, abbreviation, sequence_number)
  if p_definitions is not null then
    select array_agg(id) into v_existing_def_ids from public.sop_definitions where sop_version_id = p_version_id;
    for v_def in select * from jsonb_array_elements(p_definitions) loop
      v_item_id := nullif(v_def->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_def_ids, '{}'::uuid[]))) then
        v_payload_def_ids := array_append(v_payload_def_ids, v_item_id);
        update public.sop_definitions set
          term_en = coalesce(v_def->>'term_en', term_en),
          term_ar = v_def->>'term_ar',
          definition_en = coalesce(v_def->>'definition_en', definition_en),
          definition_ar = v_def->>'definition_ar',
          abbreviation = coalesce(v_def->>'abbreviation', v_def->>'acronym'),
          sequence_number = coalesce((v_def->>'sequence_number')::integer, sequence_number),
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_definitions (
          sop_version_id, term_en, term_ar, definition_en, definition_ar, abbreviation, sequence_number
        ) values (
          p_version_id, coalesce(v_def->>'term_en', 'Term'), v_def->>'term_ar',
          coalesce(v_def->>'definition_en', 'Definition'), v_def->>'definition_ar',
          coalesce(v_def->>'abbreviation', v_def->>'acronym'), coalesce((v_def->>'sequence_number')::integer, 1)
        ) returning id into v_item_id;
        v_payload_def_ids := array_append(v_payload_def_ids, v_item_id);
      end if;
    end loop;
    delete from public.sop_definitions where sop_version_id = p_version_id and not (id = any(v_payload_def_ids));
  end if;

  -- 7. Role Responsibilities (role_name, job_title, responsibility_en, responsibility_ar, accountable_for_en, accountable_for_ar, sequence_number)
  if p_role_responsibilities is not null then
    select array_agg(id) into v_existing_resp_ids from public.sop_role_responsibilities where sop_version_id = p_version_id;
    for v_resp in select * from jsonb_array_elements(p_role_responsibilities) loop
      v_item_id := nullif(v_resp->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_resp_ids, '{}'::uuid[]))) then
        v_payload_resp_ids := array_append(v_payload_resp_ids, v_item_id);
        update public.sop_role_responsibilities set
          sequence_number = coalesce((v_resp->>'sequence_number')::integer, sequence_number),
          role_name = nullif(trim(v_resp->>'role_name'), ''),
          job_title = nullif(trim(v_resp->>'job_title'), ''),
          responsibility_en = coalesce(v_resp->>'responsibility_en', responsibility_en),
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
          p_version_id,
          coalesce((v_resp->>'sequence_number')::integer, 1),
          nullif(trim(v_resp->>'role_name'), ''),
          nullif(trim(v_resp->>'job_title'), ''),
          coalesce(v_resp->>'responsibility_en', 'Responsibility'),
          v_resp->>'responsibility_ar',
          v_resp->>'accountable_for_en',
          v_resp->>'accountable_for_ar'
        ) returning id into v_item_id;
        v_payload_resp_ids := array_append(v_payload_resp_ids, v_item_id);
      end if;
    end loop;
    delete from public.sop_role_responsibilities where sop_version_id = p_version_id and not (id = any(v_payload_resp_ids));
  end if;

  -- 8. Monitoring KPIs (kpi_name_en, kpi_name_ar, target_value, measurement_frequency, owner_id, description_en, description_ar, sequence_number)
  if p_monitoring_kpis is not null then
    select array_agg(id) into v_existing_kpi_ids from public.sop_monitoring_kpis where sop_version_id = p_version_id;
    for v_kpi in select * from jsonb_array_elements(p_monitoring_kpis) loop
      v_item_id := nullif(v_kpi->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_kpi_ids, '{}'::uuid[]))) then
        v_payload_kpi_ids := array_append(v_payload_kpi_ids, v_item_id);
        update public.sop_monitoring_kpis set
          sequence_number = coalesce((v_kpi->>'sequence_number')::integer, sequence_number),
          kpi_name_en = coalesce(v_kpi->>'kpi_name_en', kpi_name_en),
          kpi_name_ar = v_kpi->>'kpi_name_ar',
          target_value = coalesce(v_kpi->>'target_value', coalesce(v_kpi->>'target_metric_en', target_value)),
          measurement_frequency = coalesce(v_kpi->>'measurement_frequency', measurement_frequency),
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
          p_version_id,
          coalesce((v_kpi->>'sequence_number')::integer, 1),
          coalesce(v_kpi->>'kpi_name_en', 'KPI'),
          v_kpi->>'kpi_name_ar',
          coalesce(v_kpi->>'target_value', coalesce(v_kpi->>'target_metric_en', 'Target')),
          coalesce(v_kpi->>'measurement_frequency', 'monthly'),
          nullif(v_kpi->>'owner_id', '')::uuid,
          v_kpi->>'description_en',
          v_kpi->>'description_ar'
        ) returning id into v_item_id;
        v_payload_kpi_ids := array_append(v_payload_kpi_ids, v_item_id);
      end if;
    end loop;
    delete from public.sop_monitoring_kpis where sop_version_id = p_version_id and not (id = any(v_payload_kpi_ids));
  end if;

  -- 9. Risk Links (risk_id, relationship_type ['mitigates', 'risk_if_not_followed', 'operational_context'], context_note_en, context_note_ar, sequence_number)
  if p_risk_links is not null then
    select array_agg(id) into v_existing_risk_ids from public.sop_version_risk_links where sop_version_id = p_version_id;
    for v_risk in select * from jsonb_array_elements(p_risk_links) loop
      v_item_id := nullif(v_risk->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_risk_ids, '{}'::uuid[]))) then
        v_payload_risk_ids := array_append(v_payload_risk_ids, v_item_id);
        update public.sop_version_risk_links set
          risk_id = (v_risk->>'risk_id')::uuid,
          relationship_type = coalesce(v_risk->>'relationship_type', coalesce(v_risk->>'mitigation_type', relationship_type)),
          context_note_en = coalesce(v_risk->>'context_note_en', v_risk->>'notes'),
          context_note_ar = v_risk->>'context_note_ar',
          sequence_number = coalesce((v_risk->>'sequence_number')::integer, sequence_number),
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_version_risk_links (
          sop_version_id, risk_id, relationship_type, context_note_en, context_note_ar, sequence_number
        ) values (
          p_version_id,
          (v_risk->>'risk_id')::uuid,
          coalesce(v_risk->>'relationship_type', coalesce(v_risk->>'mitigation_type', 'mitigates')),
          coalesce(v_risk->>'context_note_en', v_risk->>'notes'),
          v_risk->>'context_note_ar',
          coalesce((v_risk->>'sequence_number')::integer, 1)
        ) returning id into v_item_id;
        v_payload_risk_ids := array_append(v_payload_risk_ids, v_item_id);
      end if;
    end loop;
    delete from public.sop_version_risk_links where sop_version_id = p_version_id and not (id = any(v_payload_risk_ids));
  end if;

  -- 10. Accreditation Links (clause_id, link_strength ['primary', 'supporting', 'reference', 'gap'], context_note_en, context_note_ar, sequence_number)
  if p_accreditation_links is not null then
    select array_agg(id) into v_existing_acc_ids from public.sop_version_accreditation_links where sop_version_id = p_version_id;
    for v_acc in select * from jsonb_array_elements(p_accreditation_links) loop
      v_item_id := nullif(v_acc->>'id', '')::uuid;
      if v_item_id is not null and (v_item_id = any(coalesce(v_existing_acc_ids, '{}'::uuid[]))) then
        v_payload_acc_ids := array_append(v_payload_acc_ids, v_item_id);
        update public.sop_version_accreditation_links set
          clause_id = coalesce(nullif(v_acc->>'clause_id', '')::uuid, nullif(v_acc->>'requirement_id', '')::uuid),
          link_strength = coalesce(v_acc->>'link_strength', coalesce(v_acc->>'compliance_type', link_strength)),
          context_note_en = coalesce(v_acc->>'context_note_en', v_acc->>'notes'),
          context_note_ar = v_acc->>'context_note_ar',
          sequence_number = coalesce((v_acc->>'sequence_number')::integer, sequence_number),
          updated_at = now()
        where id = v_item_id and sop_version_id = p_version_id;
      else
        insert into public.sop_version_accreditation_links (
          sop_version_id, clause_id, link_strength, context_note_en, context_note_ar, sequence_number
        ) values (
          p_version_id,
          coalesce(nullif(v_acc->>'clause_id', '')::uuid, nullif(v_acc->>'requirement_id', '')::uuid),
          coalesce(v_acc->>'link_strength', 'primary'),
          coalesce(v_acc->>'context_note_en', v_acc->>'notes'),
          v_acc->>'context_note_ar',
          coalesce((v_acc->>'sequence_number')::integer, 1)
        ) returning id into v_item_id;
        v_payload_acc_ids := array_append(v_payload_acc_ids, v_item_id);
      end if;
    end loop;
    delete from public.sop_version_accreditation_links where sop_version_id = p_version_id and not (id = any(v_payload_acc_ids));
  end if;

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', p_version_id,
    'section_key_map', v_section_key_map,
    'step_key_map', v_step_key_map
  );
end;
$$;

-- Explicit ACL: revoke from browser roles, grant only to service_role
revoke all on function public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
