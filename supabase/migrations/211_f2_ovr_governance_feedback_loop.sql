-- GRC v1.4-F2: OVR governance feedback, exact-version review, and CAPA traceability.

alter table public.governed_document_review_triggers
  add column if not exists source_document_link_id uuid,
  add column if not exists corrective_action_project_id uuid,
  add column if not exists resulting_version_id uuid,
  add column if not exists trigger_rationale text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.governed_document_review_triggers'::regclass
      and conname = 'governed_review_trigger_source_link_fkey'
  ) then
    alter table public.governed_document_review_triggers
      add constraint governed_review_trigger_source_link_fkey
      foreign key (source_document_link_id) references public.document_links(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.governed_document_review_triggers'::regclass
      and conname = 'governed_review_trigger_capa_project_fkey'
  ) then
    alter table public.governed_document_review_triggers
      add constraint governed_review_trigger_capa_project_fkey
      foreign key (corrective_action_project_id) references public.projects(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.governed_document_review_triggers'::regclass
      and conname = 'governed_review_trigger_resulting_version_fkey'
  ) then
    alter table public.governed_document_review_triggers
      add constraint governed_review_trigger_resulting_version_fkey
      foreign key (resulting_version_id) references public.document_versions(id) on delete set null;
  end if;
end;
$$;

create index if not exists idx_f2_review_trigger_source_link
  on public.governed_document_review_triggers(source_document_link_id)
  where source_document_link_id is not null;
create index if not exists idx_f2_review_trigger_capa_project
  on public.governed_document_review_triggers(corrective_action_project_id)
  where corrective_action_project_id is not null;

-- Existing OVR references must be valid before the canonical FK is installed.
do $$
begin
  if exists (
    select 1
    from public.ovr_capa_evidence_links l
    left join public.ovr_reports o on o.id = l.ovr_id
    where l.ovr_id is not null and o.id is null
  ) then
    raise exception 'F2_EXISTING_OVR_CAPA_LINK_DRIFT_DETECTED';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ovr_capa_evidence_links'::regclass
      and conname = 'ovr_capa_evidence_links_ovr_fkey'
  ) then
    alter table public.ovr_capa_evidence_links
      add constraint ovr_capa_evidence_links_ovr_fkey
      foreign key (ovr_id) references public.ovr_reports(id) on delete restrict;
  end if;
end;
$$;

alter table public.ovr_capa_evidence_links
  drop constraint if exists ovr_capa_evidence_links_f2_canonical_shape_check;
alter table public.ovr_capa_evidence_links
  add constraint ovr_capa_evidence_links_f2_canonical_shape_check check (
    linked_entity_type <> 'capa'
    or link_role <> 'corrective_action'
    or ovr_id is not null
  );

create unique index if not exists ovr_capa_evidence_links_f2_canonical_uniq
  on public.ovr_capa_evidence_links(ovr_id, linked_entity_id)
  where linked_entity_type = 'capa' and link_role = 'corrective_action';

create or replace function public.validate_f2_ovr_corrective_action_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ovr_organization_id uuid;
  v_project_organization_id uuid;
  v_project_source_type text;
  v_project_source_reference_id uuid;
begin
  if new.linked_entity_type <> 'capa' or new.link_role <> 'corrective_action' then
    return new;
  end if;
  if new.ovr_id is null then
    raise exception 'F2_CAPA_OVR_REQUIRED';
  end if;

  select organization_id into v_ovr_organization_id
  from public.ovr_reports where id = new.ovr_id;
  if not found then raise exception 'F2_OVR_NOT_FOUND'; end if;

  select organization_id, source_type::text, source_reference_id
    into v_project_organization_id, v_project_source_type, v_project_source_reference_id
  from public.projects where id = new.linked_entity_id;
  if not found then raise exception 'F2_CORRECTIVE_PROJECT_NOT_FOUND'; end if;
  if v_project_organization_id is distinct from v_ovr_organization_id then
    raise exception 'F2_CAPA_CROSS_ORGANIZATION_DENIED';
  end if;
  if v_project_source_type <> 'incident_ovr' then
    raise exception 'F2_CAPA_INCIDENT_OVR_PROJECT_REQUIRED';
  end if;
  if v_project_source_reference_id is distinct from new.ovr_id then
    raise exception 'F2_CAPA_PROJECT_OVR_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_f2_ovr_corrective_action_link
  on public.ovr_capa_evidence_links;
create trigger trg_validate_f2_ovr_corrective_action_link
before insert or update of ovr_id, linked_entity_type, linked_entity_id, link_role
on public.ovr_capa_evidence_links
for each row execute function public.validate_f2_ovr_corrective_action_link();

-- F2 OVR reviews and canonical CAPA rows are never browser-mutable. These
-- restrictive policies leave unrelated legacy rows governed by their old rules.
drop policy if exists review_triggers_f2_ovr_insert_guard on public.governed_document_review_triggers;
create policy review_triggers_f2_ovr_insert_guard on public.governed_document_review_triggers
as restrictive for insert to authenticated
with check (trigger_type <> 'ovr');
drop policy if exists review_triggers_f2_ovr_update_guard on public.governed_document_review_triggers;
create policy review_triggers_f2_ovr_update_guard on public.governed_document_review_triggers
as restrictive for update to authenticated
using (trigger_type <> 'ovr') with check (trigger_type <> 'ovr');
drop policy if exists review_triggers_f2_ovr_delete_guard on public.governed_document_review_triggers;
create policy review_triggers_f2_ovr_delete_guard on public.governed_document_review_triggers
as restrictive for delete to authenticated
using (trigger_type <> 'ovr');
drop policy if exists review_triggers_f2_ovr_select_guard on public.governed_document_review_triggers;
create policy review_triggers_f2_ovr_select_guard on public.governed_document_review_triggers
as restrictive for select to authenticated
using (
  trigger_type <> 'ovr'
  or exists (
    select 1 from public.ovr_reports o
    where o.id = governed_document_review_triggers.source_entity_id
  )
);

drop policy if exists ovr_capa_links_f2_insert_guard on public.ovr_capa_evidence_links;
create policy ovr_capa_links_f2_insert_guard on public.ovr_capa_evidence_links
as restrictive for insert to authenticated
with check (linked_entity_type <> 'capa');
drop policy if exists ovr_capa_links_f2_update_guard on public.ovr_capa_evidence_links;
create policy ovr_capa_links_f2_update_guard on public.ovr_capa_evidence_links
as restrictive for update to authenticated
using (linked_entity_type <> 'capa') with check (linked_entity_type <> 'capa');
drop policy if exists ovr_capa_links_f2_delete_guard on public.ovr_capa_evidence_links;
create policy ovr_capa_links_f2_delete_guard on public.ovr_capa_evidence_links
as restrictive for delete to authenticated
using (linked_entity_type <> 'capa');
drop policy if exists ovr_capa_links_f2_select_guard on public.ovr_capa_evidence_links;
create policy ovr_capa_links_f2_select_guard on public.ovr_capa_evidence_links
as restrictive for select to authenticated
using (
  linked_entity_type <> 'capa'
  or exists (
    select 1 from public.ovr_reports o
    where o.id = ovr_capa_evidence_links.ovr_id
  )
);

alter table public.document_review_events
  drop constraint if exists document_review_events_event_type_check;
alter table public.document_review_events
  add constraint document_review_events_event_type_check check (
    event_type in (
      'created','submitted_for_review','review_started','review_accepted','review_rejected',
      'submitted_for_approval','approved','rejected','activated','revision_started',
      'superseded','retired','expired','reopened','cancelled','linked','acknowledged',
      'rollout_decided','obligations_published',
      'ovr_governed_version_linked','ovr_governed_version_link_removed',
      'ovr_feedback_review_opened','ovr_feedback_review_completed'
    )
  );

-- Remediate the inherited revision authority before F2 calls the canonical
-- lifecycle operation. The clone behavior remains the established Migration206
-- implementation; only exact-org global compliance authority is added.
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
  v_doc_owner_id uuid;
  v_prepared_by uuid;
  v_source_ver_num integer;
  v_new_ver_num integer;
  v_new_ver_label text;
  v_new_ver_id uuid;
begin
  select d.id, d.document_type, d.organization_id, d.document_owner_id, v.version_number, v.prepared_by
  into v_doc_id, v_doc_type, v_org_id, v_doc_owner_id, v_source_ver_num, v_prepared_by
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_source_version_id;

  if v_doc_id is null then
    raise exception 'PATCH202_SOURCE_VERSION_NOT_FOUND';
  end if;

  -- Validate Actor Tenancy
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and organization_id = v_org_id and coalesce(is_active, true) = true
  ) then
    raise exception 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN';
  end if;

  -- Preserve the existing owner/preparer authority and add exact-org global compliance authority for F2.
  if not (
    coalesce(v_prepared_by, '00000000-0000-0000-0000-000000000000'::uuid) = p_actor_id
    or coalesce(v_doc_owner_id, '00000000-0000-0000-0000-000000000000'::uuid) = p_actor_id
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_actor_id
        and ur.is_active = true
        and (
          (ur.role in ('super_admin', 'governance_admin')
            and (ur.organization_id is null or ur.organization_id = v_org_id))
          or (ur.role = 'compliance_officer'
            and ur.scope = 'global'
            and ur.organization_id = v_org_id)
        )
    )
  ) then
    raise exception 'PATCH202_ACTOR_NOT_AUTHORIZED';
  end if;

  if p_revision_type not in ('minor', 'major') then
    raise exception 'PATCH202_INVALID_REVISION_TYPE';
  end if;

  if exists (
    select 1 from public.document_versions
    where document_id = v_doc_id and locked_at is null and approved_at is null
  ) then
    raise exception 'PATCH202_ACTIVE_DRAFT_ALREADY_EXISTS';
  end if;

  select coalesce(max(version_number), v_source_ver_num) + 1 into v_new_ver_num
  from public.document_versions where document_id = v_doc_id;

  v_new_ver_label := case when p_revision_type = 'major'
    then floor(v_new_ver_num)::text || '.0'
    else (v_source_ver_num / 10)::text || '.' || (v_new_ver_num % 10)::text end;

  insert into public.document_versions (
    document_id, version_number, version_label, change_summary, revision_reason, prepared_by, is_current_version
  ) values (
    v_doc_id, v_new_ver_num, v_new_ver_label, p_revision_reason, p_revision_reason, p_actor_id, false
  ) returning id into v_new_ver_id;

  if v_doc_type = 'policy' then
    insert into public.governed_policy_details (
      version_id, title_en, title_ar, policy_statement_en, policy_statement_ar,
      purpose_en, purpose_ar, scope_en, scope_ar, policy_owner_id,
      compliance_target, exceptions_policy_en, exceptions_policy_ar,
      non_compliance_escalation_en, non_compliance_escalation_ar, content_mode, transcription_status
    )
    select
      v_new_ver_id, title_en, title_ar, policy_statement_en, policy_statement_ar,
      purpose_en, purpose_ar, scope_en, scope_ar, policy_owner_id,
      compliance_target, exceptions_policy_en, exceptions_policy_ar,
      non_compliance_escalation_en, non_compliance_escalation_ar, content_mode, transcription_status
    from public.governed_policy_details
    where version_id = p_source_version_id;

    insert into public.policy_requirements (
      policy_version_id, sequence_number, requirement_statement_en, requirement_statement_ar,
      guidance_en, guidance_ar, is_mandatory, criticality
    )
    select
      v_new_ver_id, sequence_number, requirement_statement_en, requirement_statement_ar,
      guidance_en, guidance_ar, is_mandatory, criticality
    from public.policy_requirements
    where policy_version_id = p_source_version_id;

  elsif v_doc_type = 'sop' then
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

    -- 1. Section UUID Map
    create temp table if not exists tmp_sec_clone_map (old_id uuid primary key, new_id uuid not null) on commit drop;
    truncate table tmp_sec_clone_map;

    insert into tmp_sec_clone_map (old_id, new_id)
    select id, gen_random_uuid()
    from public.sop_procedure_sections
    where sop_version_id = p_source_version_id;

    insert into public.sop_procedure_sections (
      id, sop_version_id, sequence_number, title_en, title_ar, description_en, description_ar
    )
    select
      m.new_id, v_new_ver_id, s.sequence_number, s.title_en, s.title_ar, s.description_en, s.description_ar
    from public.sop_procedure_sections s
    join tmp_sec_clone_map m on m.old_id = s.id
    where s.sop_version_id = p_source_version_id;

    -- 2. Step UUID Map
    create temp table if not exists tmp_step_clone_map (old_id uuid primary key, new_id uuid not null) on commit drop;
    truncate table tmp_step_clone_map;

    insert into tmp_step_clone_map (old_id, new_id)
    select id, gen_random_uuid()
    from public.sop_procedure_steps
    where sop_version_id = p_source_version_id;

    insert into public.sop_procedure_steps (
      id, sop_version_id, section_id, sequence_number, responsible_role,
      action_instruction_en, action_instruction_ar, required_control_id,
      expected_evidence_record_en, expected_evidence_record_ar,
      timing_sla_en, timing_sla_ar, is_decision_point,
      decision_criteria_en, decision_criteria_ar, criticality,
      escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
    )
    select
      sm.new_id, v_new_ver_id, sec_map.new_id, st.sequence_number, st.responsible_role,
      st.action_instruction_en, st.action_instruction_ar, st.required_control_id,
      st.expected_evidence_record_en, st.expected_evidence_record_ar,
      st.timing_sla_en, st.timing_sla_ar, st.is_decision_point,
      st.decision_criteria_en, st.decision_criteria_ar, st.criticality,
      st.escalation_trigger_en, st.escalation_trigger_ar, st.escalation_destination_role
    from public.sop_procedure_steps st
    join tmp_step_clone_map sm on sm.old_id = st.id
    left join tmp_sec_clone_map sec_map on sec_map.old_id = st.section_id
    where st.sop_version_id = p_source_version_id;

    -- 3. Clone RACI Rows with Cloned Step IDs
    insert into public.sop_procedure_step_raci_assignments (
      sop_version_id, step_id, raci_type, role_name, role_label_ar, job_title, sequence_number
    )
    select
      v_new_ver_id, sm.new_id, r.raci_type, r.role_name, r.role_label_ar, r.job_title, r.sequence_number
    from public.sop_procedure_step_raci_assignments r
    join tmp_step_clone_map sm on sm.old_id = r.step_id
    where r.sop_version_id = p_source_version_id;

    -- 4. Clone Definitions
    insert into public.sop_definitions (
      sop_version_id, term_en, term_ar, definition_en, definition_ar, abbreviation, sequence_number
    )
    select
      v_new_ver_id, term_en, term_ar, definition_en, definition_ar, abbreviation, sequence_number
    from public.sop_definitions
    where sop_version_id = p_source_version_id;

    -- 5. Clone Role Responsibilities
    insert into public.sop_role_responsibilities (
      sop_version_id, sequence_number, role_name, job_title, responsibility_en, responsibility_ar, accountable_for_en, accountable_for_ar
    )
    select
      v_new_ver_id, sequence_number, role_name, job_title, responsibility_en, responsibility_ar, accountable_for_en, accountable_for_ar
    from public.sop_role_responsibilities
    where sop_version_id = p_source_version_id;

    -- 6. Clone Monitoring KPIs
    insert into public.sop_monitoring_kpis (
      sop_version_id, sequence_number, kpi_name_en, kpi_name_ar, target_value, measurement_frequency, owner_id, description_en, description_ar
    )
    select
      v_new_ver_id, sequence_number, kpi_name_en, kpi_name_ar, target_value, measurement_frequency, owner_id, description_en, description_ar
    from public.sop_monitoring_kpis
    where sop_version_id = p_source_version_id;

    -- 7. Clone Risk Links
    insert into public.sop_version_risk_links (
      sop_version_id, risk_id, relationship_type, context_note_en, context_note_ar, sequence_number
    )
    select
      v_new_ver_id, risk_id, relationship_type, context_note_en, context_note_ar, sequence_number
    from public.sop_version_risk_links
    where sop_version_id = p_source_version_id;

    -- 8. Clone Accreditation Links
    insert into public.sop_version_accreditation_links (
      sop_version_id, clause_id, link_strength, context_note_en, context_note_ar, sequence_number
    )
    select
      v_new_ver_id, clause_id, link_strength, context_note_en, context_note_ar, sequence_number
    from public.sop_version_accreditation_links
    where sop_version_id = p_source_version_id;

    -- 9. Clone Training Target Scopes
    insert into public.sop_version_training_target_scopes (
      sop_version_id, scope_type, department_id, role_name, created_by
    )
    select
      v_new_ver_id, scope_type, department_id, role_name, p_actor_id
    from public.sop_version_training_target_scopes
    where sop_version_id = p_source_version_id;

    -- 10. Clone Version Links
    insert into public.governed_document_version_links (
      source_version_id, target_version_id, relationship_type, context_note_en, context_note_ar, sequence_number
    )
    select
      v_new_ver_id, target_version_id, relationship_type, context_note_en, context_note_ar, sequence_number
    from public.governed_document_version_links
    where source_version_id = p_source_version_id;
  end if;

  -- Clone Common Department Scopes
  insert into public.document_version_department_scope (version_id, department_id)
  select v_new_ver_id, department_id
  from public.document_version_department_scope
  where version_id = p_source_version_id;

  -- Clone Common Role Scopes
  insert into public.document_version_role_scope (version_id, role_name, job_title)
  select v_new_ver_id, role_name, job_title
  from public.document_version_role_scope
  where version_id = p_source_version_id;

  -- Record Revision Lifecycle Event
  insert into public.document_review_events (
    document_id, version_id, event_type, from_status, to_status, actor_id, event_note
  ) values (
    v_doc_id, v_new_ver_id, 'revision_started', 'approved', 'draft', p_actor_id, p_revision_reason
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'source_version_id', p_source_version_id,
    'new_version_id', v_new_ver_id,
    'version_number', v_new_ver_num,
    'version_label', v_new_ver_label,
    'status', 'draft'
  );
end;
$$;

revoke all on function public.start_governed_document_revision(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.start_governed_document_revision(uuid, uuid, text, text)
  to service_role;

create or replace function public.f2_require_exact_governance_authority(
  p_actor_id uuid,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
begin
  select * into v_actor from public.profiles where id = p_actor_id;
  if not found or not coalesce(v_actor.is_active, false)
     or v_actor.user_status::text <> 'active' then
    raise exception 'F2_ACTIVE_ACTOR_REQUIRED';
  end if;
  if v_actor.organization_id is null
     or v_actor.organization_id is distinct from p_organization_id then
    raise exception 'F2_ACTOR_ORGANIZATION_DENIED';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role::text in ('super_admin', 'governance_admin', 'compliance_officer')
      and ur.scope::text = 'global'
      and ur.organization_id = p_organization_id
  ) then
    raise exception 'F2_EXACT_GLOBAL_GOVERNANCE_ROLE_REQUIRED';
  end if;
end;
$$;

create or replace function public.initiate_ovr_governance_feedback_review(
  p_actor_id uuid,
  p_ovr_id uuid,
  p_document_link_id uuid,
  p_due_date date,
  p_rationale text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rationale text := btrim(coalesce(p_rationale, ''));
  v_ovr_organization_id uuid;
  v_document_id uuid;
  v_version_id uuid;
  v_document_organization_id uuid;
  v_document_type text;
  v_approved_at timestamptz;
  v_locked_at timestamptz;
  v_trigger public.governed_document_review_triggers%rowtype;
  v_created boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'F2_SERVICE_ROLE_REQUIRED';
  end if;
  if char_length(v_rationale) < 3 or char_length(v_rationale) > 2000 then
    raise exception 'F2_REVIEW_RATIONALE_LENGTH_REQUIRED';
  end if;
  if p_due_date is null or p_due_date < current_date
     or p_due_date > current_date + 365 then
    raise exception 'F2_REVIEW_DUE_DATE_INVALID';
  end if;

  select organization_id into v_ovr_organization_id
  from public.ovr_reports where id = p_ovr_id for share;
  if not found then raise exception 'F2_OVR_NOT_FOUND'; end if;
  perform public.f2_require_exact_governance_authority(p_actor_id, v_ovr_organization_id);

  select l.document_id, l.version_id, d.organization_id, d.document_type,
         v.approved_at, v.locked_at
    into v_document_id, v_version_id, v_document_organization_id, v_document_type,
         v_approved_at, v_locked_at
  from public.document_links l
  join public.document_versions v on v.id = l.version_id and v.document_id = l.document_id
  join public.controlled_documents d on d.id = l.document_id
  where l.id = p_document_link_id
    and l.linked_item_type = 'ovr'
    and l.link_type = 'governed_version'
    and l.linked_item_id = p_ovr_id;
  if not found then raise exception 'F2_CANONICAL_F1_LINK_NOT_FOUND'; end if;
  if v_document_organization_id is distinct from v_ovr_organization_id then
    raise exception 'F2_CROSS_ORGANIZATION_REVIEW_DENIED';
  end if;
  if v_document_type not in ('policy', 'sop') then
    raise exception 'F2_POLICY_OR_SOP_REQUIRED';
  end if;
  if v_approved_at is null then raise exception 'F2_APPROVED_SOURCE_VERSION_REQUIRED'; end if;
  if v_locked_at is null then raise exception 'F2_IMMUTABLE_SOURCE_VERSION_REQUIRED'; end if;

  select * into v_trigger
  from public.governed_document_review_triggers r
  where r.document_id = v_document_id
    and r.trigger_type = 'ovr'
    and r.source_entity_type = 'ovr'
    and r.source_entity_id = p_ovr_id
    and r.status in ('open', 'in_progress')
  for update;
  if found then
    if v_trigger.version_id is distinct from v_version_id then
      raise exception 'F2_OPEN_REVIEW_VERSION_CONFLICT';
    end if;
    if v_trigger.source_document_link_id is not null
       and v_trigger.source_document_link_id is distinct from p_document_link_id then
      raise exception 'F2_OPEN_REVIEW_SOURCE_LINK_CONFLICT';
    end if;
    if v_trigger.source_document_link_id is null then
      update public.governed_document_review_triggers
         set source_document_link_id = p_document_link_id
       where id = v_trigger.id
       returning * into v_trigger;
    end if;
    return jsonb_build_object(
      'trigger_id', v_trigger.id,
      'document_id', v_trigger.document_id,
      'source_version_id', v_trigger.version_id,
      'created', false,
      'status', v_trigger.status
    );
  end if;

  insert into public.governed_document_review_triggers (
    organization_id, document_id, version_id, trigger_type,
    source_entity_type, source_entity_id, source_document_link_id,
    triggered_by, due_date, status, trigger_rationale
  ) values (
    v_ovr_organization_id, v_document_id, v_version_id, 'ovr',
    'ovr', p_ovr_id, p_document_link_id,
    p_actor_id, p_due_date, 'open', v_rationale
  )
  on conflict (
    document_id, trigger_type, coalesce(source_entity_type, ''),
    coalesce(source_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where status in ('open', 'in_progress')
  do nothing
  returning * into v_trigger;

  if v_trigger.id is null then
    select * into v_trigger
    from public.governed_document_review_triggers r
    where r.document_id = v_document_id
      and r.trigger_type = 'ovr'
      and r.source_entity_type = 'ovr'
      and r.source_entity_id = p_ovr_id
      and r.status in ('open', 'in_progress');
    if not found then raise exception 'F2_OPEN_REVIEW_RACE_CONFLICT'; end if;
    if v_trigger.version_id is distinct from v_version_id then
      raise exception 'F2_OPEN_REVIEW_VERSION_CONFLICT';
    end if;
    if v_trigger.source_document_link_id is null then
      update public.governed_document_review_triggers
         set source_document_link_id = p_document_link_id
       where id = v_trigger.id
       returning * into v_trigger;
    elsif v_trigger.source_document_link_id is distinct from p_document_link_id then
      raise exception 'F2_OPEN_REVIEW_SOURCE_LINK_CONFLICT';
    end if;
  else
    v_created := true;
    perform public.patch26_write_document_event(
      v_document_id,
      v_version_id,
      'ovr_feedback_review_opened',
      null,
      'open',
      p_actor_id,
      jsonb_build_object(
        'ovr_id', p_ovr_id,
        'review_trigger_id', v_trigger.id,
        'document_link_id', p_document_link_id,
        'document_id', v_document_id,
        'source_version_id', v_version_id,
        'due_date', p_due_date,
        'rationale', v_rationale,
        'actor_id', p_actor_id
      )::text,
      null
    );
  end if;

  return jsonb_build_object(
    'trigger_id', v_trigger.id,
    'document_id', v_document_id,
    'source_version_id', v_version_id,
    'created', v_created,
    'status', v_trigger.status
  );
end;
$$;

create or replace function public.complete_ovr_governance_feedback_review(
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
  v_note text := btrim(coalesce(p_outcome_note, ''));
  v_trigger public.governed_document_review_triggers%rowtype;
  v_current_version_id uuid;
  v_revision_base_id uuid;
  v_base_document_id uuid;
  v_base_approved_at timestamptz;
  v_base_locked_at timestamptz;
  v_base_is_current boolean;
  v_document_status text;
  v_revision jsonb;
  v_resulting_version_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'F2_SERVICE_ROLE_REQUIRED';
  end if;
  if p_outcome not in ('no_change', 'minor_revision', 'major_revision', 'retire') then
    raise exception 'F2_REVIEW_OUTCOME_INVALID';
  end if;
  if char_length(v_note) < 3 or char_length(v_note) > 2000 then
    raise exception 'F2_OUTCOME_NOTE_LENGTH_REQUIRED';
  end if;

  select * into v_trigger
  from public.governed_document_review_triggers r
  where r.id = p_trigger_id
    and r.trigger_type = 'ovr'
    and r.source_entity_type = 'ovr'
    and r.source_entity_id is not null
    and r.version_id is not null
    and r.status in ('open', 'in_progress')
  for update;
  if not found then raise exception 'F2_REVIEW_TRIGGER_NOT_OPEN'; end if;
  if not exists (
    select 1 from public.ovr_reports o
    where o.id = v_trigger.source_entity_id
      and o.organization_id = v_trigger.organization_id
  ) then raise exception 'F2_REVIEW_OVR_CONTEXT_INVALID'; end if;
  perform public.f2_require_exact_governance_authority(p_actor_id, v_trigger.organization_id);

  select current_version_id, document_status::text
    into v_current_version_id, v_document_status
  from public.controlled_documents
  where id = v_trigger.document_id and organization_id = v_trigger.organization_id
  for update;
  if not found then raise exception 'F2_DOCUMENT_NOT_FOUND'; end if;
  if v_document_status = 'retired' then raise exception 'F2_DOCUMENT_RETIRED'; end if;

  if p_outcome in ('minor_revision', 'major_revision') then
    v_revision_base_id := coalesce(v_current_version_id, v_trigger.version_id);
    select document_id, approved_at, locked_at, coalesce(is_current_version, false)
      into v_base_document_id, v_base_approved_at, v_base_locked_at, v_base_is_current
    from public.document_versions
    where id = v_revision_base_id;
    if not found or v_base_document_id is distinct from v_trigger.document_id then
      raise exception 'F2_REVISION_BASE_INVALID';
    end if;
    if v_base_approved_at is null then raise exception 'F2_APPROVED_REVISION_BASE_REQUIRED'; end if;
    if v_base_locked_at is null then raise exception 'F2_IMMUTABLE_REVISION_BASE_REQUIRED'; end if;
    if not v_base_is_current then
      raise exception 'F2_CURRENT_REVISION_BASE_REQUIRED';
    end if;

    v_revision := public.start_governed_document_revision(
      p_actor_id,
      v_revision_base_id,
      case when p_outcome = 'major_revision' then 'major' else 'minor' end,
      v_note
    );
    v_resulting_version_id := nullif(v_revision->>'new_version_id', '')::uuid;
    if v_resulting_version_id is null then raise exception 'F2_RESULTING_VERSION_REQUIRED'; end if;
    update public.document_versions
       set supersedes_version_id = coalesce(supersedes_version_id, v_revision_base_id)
     where id = v_resulting_version_id and document_id = v_trigger.document_id;
    if not found then raise exception 'F2_RESULTING_VERSION_INVALID'; end if;
  elsif p_outcome = 'retire' then
    perform public.retire_governed_document(p_actor_id, v_trigger.document_id, v_note);
  end if;

  update public.governed_document_review_triggers
     set status = 'completed', outcome = p_outcome, outcome_note = v_note,
         completed_at = now(), review_owner_id = p_actor_id,
         resulting_version_id = v_resulting_version_id
   where id = p_trigger_id;

  perform public.patch26_write_document_event(
    v_trigger.document_id,
    v_trigger.version_id,
    'ovr_feedback_review_completed',
    v_trigger.status,
    'completed',
    p_actor_id,
    jsonb_build_object(
      'ovr_id', v_trigger.source_entity_id,
      'review_trigger_id', v_trigger.id,
      'document_link_id', v_trigger.source_document_link_id,
      'document_id', v_trigger.document_id,
      'source_version_id', v_trigger.version_id,
      'revision_base_version_id', v_revision_base_id,
      'resulting_version_id', v_resulting_version_id,
      'outcome', p_outcome,
      'outcome_note', v_note,
      'actor_id', p_actor_id
    )::text,
    null
  );

  return jsonb_build_object(
    'trigger_id', p_trigger_id,
    'document_id', v_trigger.document_id,
    'source_version_id', v_trigger.version_id,
    'revision_base_version_id', v_revision_base_id,
    'resulting_version_id', v_resulting_version_id,
    'outcome', p_outcome,
    'status', 'completed'
  );
end;
$$;

create or replace function public.sync_ovr_corrective_action_capa_link(
  p_actor_id uuid,
  p_ovr_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ovr public.ovr_reports%rowtype;
  v_project_id uuid;
  v_project public.projects%rowtype;
  v_link public.ovr_capa_evidence_links%rowtype;
  v_created boolean := false;
  v_reactivated boolean := false;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'F2_SERVICE_ROLE_REQUIRED';
  end if;
  select * into v_ovr from public.ovr_reports where id = p_ovr_id for update;
  if not found then raise exception 'F2_OVR_NOT_FOUND'; end if;
  perform public.f2_require_exact_governance_authority(p_actor_id, v_ovr.organization_id);

  if v_ovr.linked_project_id is not null
     and v_ovr.linked_corrective_action_project_id is not null
     and v_ovr.linked_project_id is distinct from v_ovr.linked_corrective_action_project_id then
    raise exception 'F2_CONFLICTING_CORRECTIVE_PROJECT_POINTERS';
  end if;
  v_project_id := coalesce(v_ovr.linked_corrective_action_project_id, v_ovr.linked_project_id);
  if v_project_id is null then raise exception 'F2_CORRECTIVE_PROJECT_NOT_FOUND'; end if;

  select * into v_project from public.projects where id = v_project_id for share;
  if not found then raise exception 'F2_CORRECTIVE_PROJECT_NOT_FOUND'; end if;
  if v_project.organization_id is distinct from v_ovr.organization_id then
    raise exception 'F2_CAPA_CROSS_ORGANIZATION_DENIED';
  end if;
  if v_project.source_type::text <> 'incident_ovr' then
    raise exception 'F2_CAPA_INCIDENT_OVR_PROJECT_REQUIRED';
  end if;
  if v_project.source_reference_id is distinct from p_ovr_id then
    raise exception 'F2_CAPA_PROJECT_OVR_MISMATCH';
  end if;

  if exists (
    select 1 from public.governed_document_review_triggers r
    where r.trigger_type = 'ovr' and r.source_entity_type = 'ovr'
      and r.source_entity_id = p_ovr_id
      and r.source_document_link_id is not null
      and r.corrective_action_project_id is not null
      and r.corrective_action_project_id is distinct from v_project_id
  ) then
    raise exception 'F2_REVIEW_CORRECTIVE_PROJECT_CONFLICT';
  end if;

  select * into v_link
  from public.ovr_capa_evidence_links l
  where l.ovr_id = p_ovr_id
    and l.linked_entity_type = 'capa'
    and l.link_role = 'corrective_action'
    and l.linked_entity_id = v_project_id
  for update;

  if found then
    if v_link.link_status <> 'active' then
      update public.ovr_capa_evidence_links set link_status = 'active'
      where id = v_link.id returning * into v_link;
      v_reactivated := true;
      perform public.record_clinical_governance_event(
        'ovr_capa_evidence_link',
        v_link.id,
        'ovr_corrective_action_capa_link_reactivated',
        jsonb_build_object(
          'ovr_id', p_ovr_id, 'project_id', v_project_id, 'link_id', v_link.id,
          'actor_id', p_actor_id, 'organization_id', v_ovr.organization_id
        )::text,
        p_actor_id
      );
    end if;
  else
    insert into public.ovr_capa_evidence_links (
      ovr_id, linked_entity_type, linked_entity_id, link_role, link_status, created_by
    ) values (
      p_ovr_id, 'capa', v_project_id, 'corrective_action', 'active', p_actor_id
    ) returning * into v_link;
    v_created := true;
    perform public.record_clinical_governance_event(
      'ovr_capa_evidence_link',
      v_link.id,
      'ovr_corrective_action_capa_link_created',
      jsonb_build_object(
        'ovr_id', p_ovr_id, 'project_id', v_project_id, 'link_id', v_link.id,
        'actor_id', p_actor_id, 'organization_id', v_ovr.organization_id
      )::text,
      p_actor_id
    );
  end if;

  update public.governed_document_review_triggers
     set corrective_action_project_id = v_project_id
   where trigger_type = 'ovr' and source_entity_type = 'ovr'
     and source_entity_id = p_ovr_id and source_document_link_id is not null
     and (corrective_action_project_id is null or corrective_action_project_id = v_project_id);

  return jsonb_build_object(
    'capa_link_id', v_link.id,
    'ovr_id', p_ovr_id,
    'corrective_action_project_id', v_project_id,
    'link_status', v_link.link_status,
    'created', v_created,
    'reactivated', v_reactivated
  );
end;
$$;

create or replace view public.v_f2_ovr_governance_feedback
with (security_invoker = true)
as
select
  r.id as trigger_id,
  r.source_entity_id as ovr_id,
  r.organization_id,
  r.source_document_link_id as document_link_id,
  r.document_id,
  d.document_type,
  d.document_code,
  d.document_title,
  r.version_id as source_version_id,
  sv.version_number as source_version_number,
  sv.version_label as source_version_label,
  coalesce(sv.is_current_version, false) as source_version_is_current,
  d.current_version_id,
  cv.version_number as current_version_number,
  cv.version_label as current_version_label,
  r.status as review_status,
  r.review_owner_id,
  r.due_date,
  r.outcome,
  r.outcome_note,
  r.resulting_version_id,
  r.corrective_action_project_id,
  p.title as project_title,
  p.status::text as project_status,
  p.progress_percent as project_progress_percent,
  cl.id as capa_link_id,
  cl.link_status as capa_link_status,
  r.triggered_by,
  r.triggered_at,
  r.completed_at
from public.governed_document_review_triggers r
join public.ovr_reports o
  on o.id = r.source_entity_id and o.organization_id = r.organization_id
join public.controlled_documents d on d.id = r.document_id
join public.document_versions sv
  on sv.id = r.version_id and sv.document_id = r.document_id
left join public.document_versions cv
  on cv.id = d.current_version_id and cv.document_id = d.id
left join public.projects p on p.id = r.corrective_action_project_id
left join public.ovr_capa_evidence_links cl
  on cl.ovr_id = r.source_entity_id
 and cl.linked_entity_type = 'capa'
 and cl.link_role = 'corrective_action'
 and cl.linked_entity_id = r.corrective_action_project_id
where r.trigger_type = 'ovr' and r.source_entity_type = 'ovr';

create or replace function public.get_f2_ovr_governance_feedback_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'contract_version', 'f2-ovr-governance-feedback-v1',
    'schema_version', 211,
    'initiate_review_available', true,
    'complete_review_available', true,
    'sync_capa_available', true
  );
$$;

revoke all on function public.validate_f2_ovr_corrective_action_link()
  from public, anon, authenticated, service_role;
revoke all on function public.f2_require_exact_governance_authority(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.initiate_ovr_governance_feedback_review(uuid, uuid, uuid, date, text)
  from public, anon, authenticated;
revoke all on function public.complete_ovr_governance_feedback_review(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.sync_ovr_corrective_action_capa_link(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_f2_ovr_governance_feedback_capabilities()
  from public, anon, authenticated;
grant execute on function public.initiate_ovr_governance_feedback_review(uuid, uuid, uuid, date, text)
  to service_role;
grant execute on function public.complete_ovr_governance_feedback_review(uuid, uuid, text, text)
  to service_role;
grant execute on function public.sync_ovr_corrective_action_capa_link(uuid, uuid)
  to service_role;
grant execute on function public.get_f2_ovr_governance_feedback_capabilities()
  to service_role;

revoke all on public.v_f2_ovr_governance_feedback from public, anon;
grant select on public.governed_document_review_triggers to authenticated, service_role;
grant select on public.ovr_capa_evidence_links to authenticated, service_role;
grant select on public.projects to authenticated, service_role;
grant select on public.v_f2_ovr_governance_feedback to authenticated, service_role;

comment on view public.v_f2_ovr_governance_feedback is
  'F2 security-invoker OVR feedback trace from exact incident version through review, revision, and CAPA.';
comment on function public.complete_ovr_governance_feedback_review(uuid, uuid, text, text) is
  'F2 completion preserves the incident source version and branches revisions from the current approved locked version.';
