-- =========================================================
-- v9.9 Final Pilot Testing Console + One-Click Scenario Seeder
-- Synthetic local/controlled-pilot data only.
-- =========================================================

begin;

create table if not exists public.v99_scenario_lab_records (
  id uuid primary key default gen_random_uuid(),
  test_dataset_tag text not null
    check (test_dataset_tag = 'V99_SCENARIO_LAB'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scenario_code text not null,
  record_table text not null
    check (record_table in (
      'ovr_reports',
      'risks',
      'risk_controls',
      'projects',
      'evidence_files',
      'notifications',
      'user_roles'
    )),
  record_id uuid not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (record_table, record_id)
);

create index if not exists idx_v99_scenario_lab_records_org
  on public.v99_scenario_lab_records(organization_id, scenario_code, created_at desc);

alter table public.v99_scenario_lab_records enable row level security;
revoke all on table public.v99_scenario_lab_records from public, anon, authenticated;
grant all on table public.v99_scenario_lab_records to service_role;

create or replace function public.v99_assert_scenario_lab_actor(
  p_actor_id uuid,
  p_confirmation text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'V99_SERVICE_ROLE_REQUIRED';
  end if;

  if p_confirmation is distinct from 'V99_SCENARIO_LAB' then
    raise exception 'V99_EXACT_CONFIRMATION_REQUIRED';
  end if;

  select p.organization_id
    into v_organization_id
  from public.profiles p
  where p.id = p_actor_id
    and p.is_active = true;

  if v_organization_id is null then
    raise exception 'V99_ACTIVE_ACTOR_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role in ('super_admin', 'governance_admin')
      and (
        ur.organization_id is null
        or ur.organization_id is not distinct from v_organization_id
      )
  ) then
    raise exception 'V99_SCENARIO_ADMIN_REQUIRED';
  end if;

  return v_organization_id;
end;
$$;

revoke all on function public.v99_assert_scenario_lab_actor(uuid, text)
from public, anon, authenticated;
grant execute on function public.v99_assert_scenario_lab_actor(uuid, text)
to service_role;

create or replace function public.v99_create_ovr_scenario(
  p_actor_id uuid,
  p_organization_id uuid,
  p_scenario text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_started_at timestamptz := now();
  v_source_department_id uuid;
  v_referred_department_id uuid;
  v_temporary_role_id uuid;
  v_ovr_id uuid;
  v_ovr_number text;
  v_severity public.ovr_severity_level := 'level_2';
  v_title text;
  v_evidence_id uuid;
begin
  if public.v99_assert_scenario_lab_actor(p_actor_id, p_confirmation)
     is distinct from p_organization_id then
    raise exception 'V99_ACTOR_ORGANIZATION_MISMATCH';
  end if;

  select d.id
    into v_source_department_id
  from public.departments d
  where d.organization_id = p_organization_id
    and d.is_active = true
  order by
    case when upper(trim(d.code)) = 'QUALITY' then 0 else 1 end,
    d.created_at,
    d.id
  limit 1;

  if v_source_department_id is null then
    raise exception 'V99_ACTIVE_DEPARTMENT_REQUIRED';
  end if;

  if p_scenario = 'ovr_high_severity' then
    v_severity := 'sentinel';
  end if;

  case p_scenario
    when 'ovr_same_department' then
      v_title := 'Synthetic same-department operational observation';
    when 'ovr_cross_department' then
      v_title := 'Synthetic cross-department handoff observation';
    when 'ovr_high_severity' then
      v_title := 'Synthetic high-severity escalation drill';
    when 'ovr_returned_clarification' then
      v_title := 'Synthetic report returned for clarification';
    when 'ovr_disputed_reopened' then
      v_title := 'Synthetic disputed and reopened workflow';
    else
      raise exception 'V99_UNSUPPORTED_OVR_SCENARIO: %', p_scenario;
  end case;

  insert into public.ovr_reports (
    organization_id,
    logging_number,
    occurrence_date,
    occurrence_time,
    occurrence_location,
    involved_person_type,
    person_involved_name,
    mrn_or_id_no,
    department_id,
    physical_condition,
    mental_condition,
    pre_occurrence_condition_flags,
    brief_description,
    occurrence_category,
    occurrence_details,
    severity_level,
    corrective_action_required,
    evidence_required,
    status,
    reported_by,
    owner_id,
    created_by,
    updated_by
  )
  values (
    p_organization_id,
    'V99-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    current_date,
    localtime(0),
    'Synthetic controlled-pilot test location',
    'employee',
    'Synthetic Pilot User - not a patient',
    null,
    v_source_department_id,
    'Synthetic/de-identified test condition only',
    'Synthetic/de-identified test condition only',
    array['alert'],
    '[V99_SCENARIO_LAB] ' || v_title ||
      '. No patient identifiers or confidential OVR narrative.',
    'other',
    jsonb_build_object(
      'test_dataset_tag', 'V99_SCENARIO_LAB',
      'scenario_code', p_scenario,
      'synthetic_only', true,
      'contains_patient_identifiers', false,
      'contains_confidential_ovr_details', false
    ),
    v_severity,
    false,
    true,
    'submitted',
    p_actor_id,
    p_actor_id,
    p_actor_id,
    p_actor_id
  )
  returning id, ovr_number into v_ovr_id, v_ovr_number;

  insert into public.v99_scenario_lab_records (
    test_dataset_tag,
    organization_id,
    scenario_code,
    record_table,
    record_id,
    created_by,
    metadata
  )
  values (
    'V99_SCENARIO_LAB',
    p_organization_id,
    p_scenario,
    'ovr_reports',
    v_ovr_id,
    p_actor_id,
    jsonb_build_object('ovr_number', v_ovr_number)
  )
  on conflict (record_table, record_id) do nothing;

  if p_scenario = 'ovr_returned_clarification' then
    update public.ovr_reports
    set status = 'returned_for_clarification',
        returned_reason = '[V99_SCENARIO_LAB] Synthetic clarification is required.',
        returned_for_clarification_reason =
          '[V99_SCENARIO_LAB] Synthetic clarification is required.',
        updated_by = p_actor_id,
        updated_at = now()
    where id = v_ovr_id;

  elsif p_scenario = 'ovr_same_department' then
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'manager_review',
      jsonb_build_object(
        'supervisor_investigation',
        '[V99_SCENARIO_LAB] Synthetic same-department manager review.'
      )
    );

  elsif p_scenario = 'ovr_high_severity' then
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'manager_review',
      jsonb_build_object(
        'supervisor_investigation',
        '[V99_SCENARIO_LAB] Synthetic high-severity manager review.'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'quality_validation',
      jsonb_build_object(
        'quality_manager_comments',
        '[V99_SCENARIO_LAB] Synthetic Quality validation.',
        'confirmed_severity_level',
        'sentinel'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'escalated',
      jsonb_build_object(
        'note',
        '[V99_SCENARIO_LAB] Synthetic high-severity escalation drill.'
      )
    );

  elsif p_scenario = 'ovr_cross_department' then
    select role_assignment.department_id, role_assignment.id
      into v_referred_department_id, v_temporary_role_id
    from public.user_roles role_assignment
    join public.v99_scenario_lab_records registry
      on registry.record_table = 'user_roles'
     and registry.record_id = role_assignment.id
     and registry.test_dataset_tag = 'V99_SCENARIO_LAB'
    where role_assignment.user_id = p_actor_id
      and role_assignment.organization_id = p_organization_id
      and role_assignment.role = 'department_manager'
      and role_assignment.scope = 'department'
      and role_assignment.is_active = true
      and role_assignment.department_id <> v_source_department_id
    order by role_assignment.assigned_at, role_assignment.id
    limit 1;

    if v_temporary_role_id is null then
      select d.id
        into v_referred_department_id
      from public.departments d
      where d.organization_id = p_organization_id
        and d.is_active = true
        and d.id <> v_source_department_id
        and not exists (
          select 1
          from public.user_roles existing_role
          where existing_role.user_id = p_actor_id
            and existing_role.role = 'department_manager'
            and existing_role.scope = 'department'
            and existing_role.organization_id = p_organization_id
            and existing_role.department_id = d.id
        )
      order by
        case when upper(trim(d.code)) = 'IT' then 0 else 1 end,
        d.created_at,
        d.id
      limit 1;

      if v_referred_department_id is null then
        raise exception 'V99_CROSS_DEPARTMENT_TARGET_REQUIRED';
      end if;

      insert into public.user_roles (
        user_id,
        role,
        scope,
        organization_id,
        department_id,
        is_active,
        assigned_by
      )
      values (
        p_actor_id,
        'department_manager',
        'department',
        p_organization_id,
        v_referred_department_id,
        true,
        p_actor_id
      )
      returning id into v_temporary_role_id;

      insert into public.v99_scenario_lab_records (
        test_dataset_tag,
        organization_id,
        scenario_code,
        record_table,
        record_id,
        created_by,
        metadata
      )
      values (
        'V99_SCENARIO_LAB',
        p_organization_id,
        p_scenario,
        'user_roles',
        v_temporary_role_id,
        p_actor_id,
        jsonb_build_object(
          'purpose',
          'temporary synthetic referred-department persona for lifecycle exercise'
        )
      )
      on conflict (record_table, record_id) do nothing;
    end if;

    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'manager_review',
      jsonb_build_object(
        'supervisor_investigation',
        '[V99_SCENARIO_LAB] Synthetic manager review before Quality referral.'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'quality_validation',
      jsonb_build_object(
        'quality_manager_comments',
        '[V99_SCENARIO_LAB] Synthetic Quality validation before cross-department notification.',
        'confirmed_severity_level',
        'level_2'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'referred_party_response',
      jsonb_build_object(
        'referred_department_id',
        v_referred_department_id
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'quality_final_review',
      jsonb_build_object(
        'referred_response',
        '[V99_SCENARIO_LAB] Synthetic referred-party response.',
        'corrective_action',
        '[V99_SCENARIO_LAB] Synthetic handoff checklist correction.'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'quality_final_review',
      jsonb_build_object(
        'quality_manager_comments',
        '[V99_SCENARIO_LAB] Synthetic final Quality review.',
        'final_verdict',
        'Synthetic test workflow validated; no real incident conclusion.',
        'confirmed_severity_level',
        'level_2'
      )
    );

    insert into public.evidence_files (
      organization_id,
      ovr_report_id,
      file_name,
      file_path,
      file_type,
      file_size,
      description,
      status,
      uploaded_by,
      reviewed_by,
      reviewed_at
    )
    values (
      p_organization_id,
      v_ovr_id,
      'V99_SCENARIO_LAB-cross-department-proof.txt',
      'V99_SCENARIO_LAB/metadata-only/cross-department-proof.txt',
      'text/plain',
      0,
      '[V99_SCENARIO_LAB] Synthetic metadata-only closure proof.',
      'accepted',
      p_actor_id,
      p_actor_id,
      now()
    )
    returning id into v_evidence_id;

    insert into public.v99_scenario_lab_records (
      test_dataset_tag,
      organization_id,
      scenario_code,
      record_table,
      record_id,
      created_by,
      metadata
    )
    values (
      'V99_SCENARIO_LAB',
      p_organization_id,
      p_scenario,
      'evidence_files',
      v_evidence_id,
      p_actor_id,
      jsonb_build_object('metadata_only', true, 'ovr_report_id', v_ovr_id)
    )
    on conflict (record_table, record_id) do nothing;

    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'closed',
      jsonb_build_object(
        'note',
        '[V99_SCENARIO_LAB] Synthetic reporter acceptance and closure.'
      )
    );

  elsif p_scenario = 'ovr_disputed_reopened' then
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'manager_review',
      jsonb_build_object(
        'supervisor_investigation',
        '[V99_SCENARIO_LAB] Synthetic initial manager review.'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'quality_validation',
      jsonb_build_object(
        'quality_manager_comments',
        '[V99_SCENARIO_LAB] Synthetic initial Quality validation.'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'quality_final_review',
      jsonb_build_object(
        'quality_manager_comments',
        '[V99_SCENARIO_LAB] Synthetic initial final review.',
        'final_verdict',
        'Synthetic initial verdict for dispute testing.'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'disputed',
      jsonb_build_object(
        'note',
        '[V99_SCENARIO_LAB] Synthetic reporter dispute.'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'reopened',
      jsonb_build_object(
        'note',
        '[V99_SCENARIO_LAB] Synthetic Quality reopening.'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'manager_review',
      jsonb_build_object(
        'supervisor_investigation',
        '[V99_SCENARIO_LAB] Synthetic manager re-review after reopening.'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'quality_validation',
      jsonb_build_object(
        'quality_manager_comments',
        '[V99_SCENARIO_LAB] Synthetic Quality re-validation.'
      )
    );
    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'quality_final_review',
      jsonb_build_object(
        'quality_manager_comments',
        '[V99_SCENARIO_LAB] Synthetic final review after dispute.',
        'final_verdict',
        'Synthetic revised verdict after controlled dispute review.'
      )
    );

    insert into public.evidence_files (
      organization_id,
      ovr_report_id,
      file_name,
      file_path,
      file_type,
      file_size,
      description,
      status,
      uploaded_by,
      reviewed_by,
      reviewed_at
    )
    values (
      p_organization_id,
      v_ovr_id,
      'V99_SCENARIO_LAB-dispute-reopen-proof.txt',
      'V99_SCENARIO_LAB/metadata-only/dispute-reopen-proof.txt',
      'text/plain',
      0,
      '[V99_SCENARIO_LAB] Synthetic metadata-only evidence after reopening.',
      'accepted',
      p_actor_id,
      p_actor_id,
      now()
    )
    returning id into v_evidence_id;

    insert into public.v99_scenario_lab_records (
      test_dataset_tag,
      organization_id,
      scenario_code,
      record_table,
      record_id,
      created_by,
      metadata
    )
    values (
      'V99_SCENARIO_LAB',
      p_organization_id,
      p_scenario,
      'evidence_files',
      v_evidence_id,
      p_actor_id,
      jsonb_build_object('metadata_only', true, 'ovr_report_id', v_ovr_id)
    )
    on conflict (record_table, record_id) do nothing;

    perform public.v98_update_ovr_workflow(
      p_actor_id,
      v_ovr_id,
      'closed',
      jsonb_build_object(
        'note',
        '[V99_SCENARIO_LAB] Synthetic acceptance after dispute resolution.'
      )
    );
  end if;

  insert into public.v99_scenario_lab_records (
    test_dataset_tag,
    organization_id,
    scenario_code,
    record_table,
    record_id,
    created_by,
    metadata
  )
  select
    'V99_SCENARIO_LAB',
    p_organization_id,
    p_scenario,
    'notifications',
    n.id,
    p_actor_id,
    jsonb_build_object('ovr_number', v_ovr_number)
  from public.notifications n
  where n.organization_id = p_organization_id
    and n.created_at >= v_started_at
    and n.body like '%' || v_ovr_number || '%'
  on conflict (record_table, record_id) do nothing;

  return (
    select jsonb_build_object(
      'scenario', p_scenario,
      'record_type', 'ovr_report',
      'id', o.id,
      'ovr_number', o.ovr_number,
      'status', o.status,
      'quality_validated_at', o.quality_validated_at,
      'cross_department_notified_at', o.cross_department_notified_at,
      'reporter_response', o.reporter_response,
      'test_dataset_tag', o.occurrence_details->>'test_dataset_tag'
    )
    from public.ovr_reports o
    where o.id = v_ovr_id
  );
end;
$$;

revoke all on function public.v99_create_ovr_scenario(uuid, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.v99_create_ovr_scenario(uuid, uuid, text, text)
to service_role;

create or replace function public.v99_create_scenario(
  p_actor_id uuid,
  p_scenario text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_department_id uuid;
  v_record_id uuid;
  v_parent_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_item jsonb;
  v_scenario text;
begin
  perform pg_advisory_xact_lock(hashtext('V99_SCENARIO_LAB'));
  v_organization_id :=
    public.v99_assert_scenario_lab_actor(p_actor_id, p_confirmation);

  p_scenario := lower(trim(p_scenario));

  if p_scenario in (
    'ovr_same_department',
    'ovr_cross_department',
    'ovr_high_severity',
    'ovr_returned_clarification',
    'ovr_disputed_reopened'
  ) then
    return public.v99_create_ovr_scenario(
      p_actor_id,
      v_organization_id,
      p_scenario,
      p_confirmation
    );
  end if;

  select d.id
    into v_department_id
  from public.departments d
  where d.organization_id = v_organization_id
    and d.is_active = true
  order by
    case when upper(trim(d.code)) in ('GOVCOMP', 'QUALITY') then 0 else 1 end,
    d.created_at,
    d.id
  limit 1;

  if p_scenario = 'risk' then
    insert into public.risks (
      organization_id,
      risk_code,
      title,
      description,
      category,
      department_id,
      owner_id,
      likelihood,
      impact,
      residual_likelihood,
      residual_impact,
      risk_level,
      response_type,
      status,
      next_review_date,
      notes,
      created_by,
      updated_by
    )
    values (
      v_organization_id,
      'V99-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      '[V99_SCENARIO_LAB] Synthetic pilot risk',
      '[V99_SCENARIO_LAB] Synthetic non-confidential risk used only for controlled pilot testing.',
      'operational',
      v_department_id,
      p_actor_id,
      4,
      4,
      2,
      2,
      'high',
      'reduce',
      'open',
      current_date + 30,
      'test_dataset_tag=V99_SCENARIO_LAB',
      p_actor_id,
      p_actor_id
    )
    returning id into v_record_id;

    insert into public.v99_scenario_lab_records (
      test_dataset_tag, organization_id, scenario_code, record_table,
      record_id, created_by, metadata
    )
    values (
      'V99_SCENARIO_LAB', v_organization_id, p_scenario, 'risks',
      v_record_id, p_actor_id, jsonb_build_object('synthetic_only', true)
    );

    return jsonb_build_object(
      'scenario', p_scenario,
      'record_type', 'risk',
      'id', v_record_id,
      'status', 'open',
      'test_dataset_tag', 'V99_SCENARIO_LAB'
    );

  elsif p_scenario = 'control' then
    v_item := public.v99_create_scenario(p_actor_id, 'risk', p_confirmation);
    v_parent_id := (v_item->>'id')::uuid;

    insert into public.risk_controls (
      organization_id,
      risk_id,
      title,
      description,
      control_type,
      frequency,
      effectiveness,
      owner_id,
      evidence_required,
      next_test_date,
      is_active,
      created_by,
      updated_by
    )
    values (
      v_organization_id,
      v_parent_id,
      '[V99_SCENARIO_LAB] Synthetic preventive control',
      '[V99_SCENARIO_LAB] Synthetic control for pilot visibility and workflow checks.',
      'preventive',
      'monthly',
      'effective',
      p_actor_id,
      true,
      current_date + 30,
      true,
      p_actor_id,
      p_actor_id
    )
    returning id into v_record_id;

    insert into public.v99_scenario_lab_records (
      test_dataset_tag, organization_id, scenario_code, record_table,
      record_id, created_by, metadata
    )
    values (
      'V99_SCENARIO_LAB', v_organization_id, p_scenario, 'risk_controls',
      v_record_id, p_actor_id, jsonb_build_object('risk_id', v_parent_id)
    );

    return jsonb_build_object(
      'scenario', p_scenario,
      'record_type', 'risk_control',
      'id', v_record_id,
      'risk_id', v_parent_id,
      'status', 'active',
      'test_dataset_tag', 'V99_SCENARIO_LAB'
    );

  elsif p_scenario = 'project' then
    insert into public.projects (
      organization_id,
      title,
      description,
      category,
      source_type,
      department_id,
      owner_id,
      sponsor_id,
      start_date,
      target_end_date,
      priority,
      risk_level,
      status,
      progress_percent,
      evidence_required,
      closure_approval_required,
      created_by,
      updated_by
    )
    values (
      v_organization_id,
      '[V99_SCENARIO_LAB] Synthetic corrective action',
      '[V99_SCENARIO_LAB] Synthetic project/corrective action for controlled pilot testing.',
      'Controlled Pilot Test',
      'manual',
      v_department_id,
      p_actor_id,
      p_actor_id,
      current_date,
      current_date + 30,
      'high',
      'medium',
      'draft',
      0,
      true,
      true,
      p_actor_id,
      p_actor_id
    )
    returning id into v_record_id;

    insert into public.v99_scenario_lab_records (
      test_dataset_tag, organization_id, scenario_code, record_table,
      record_id, created_by, metadata
    )
    values (
      'V99_SCENARIO_LAB', v_organization_id, p_scenario, 'projects',
      v_record_id, p_actor_id, jsonb_build_object('synthetic_only', true)
    );

    return jsonb_build_object(
      'scenario', p_scenario,
      'record_type', 'project',
      'id', v_record_id,
      'status', 'draft',
      'test_dataset_tag', 'V99_SCENARIO_LAB'
    );

  elsif p_scenario = 'evidence' then
    v_item := public.v99_create_scenario(p_actor_id, 'project', p_confirmation);
    v_parent_id := (v_item->>'id')::uuid;

    insert into public.evidence_files (
      organization_id,
      project_id,
      file_name,
      file_path,
      file_type,
      file_size,
      description,
      status,
      uploaded_by
    )
    values (
      v_organization_id,
      v_parent_id,
      'V99_SCENARIO_LAB-synthetic-evidence.txt',
      'V99_SCENARIO_LAB/metadata-only/synthetic-evidence.txt',
      'text/plain',
      0,
      '[V99_SCENARIO_LAB] Synthetic evidence metadata. No confidential content.',
      'submitted',
      p_actor_id
    )
    returning id into v_record_id;

    insert into public.v99_scenario_lab_records (
      test_dataset_tag, organization_id, scenario_code, record_table,
      record_id, created_by, metadata
    )
    values (
      'V99_SCENARIO_LAB', v_organization_id, p_scenario, 'evidence_files',
      v_record_id, p_actor_id,
      jsonb_build_object('project_id', v_parent_id, 'metadata_only', true)
    );

    return jsonb_build_object(
      'scenario', p_scenario,
      'record_type', 'evidence_file',
      'id', v_record_id,
      'project_id', v_parent_id,
      'status', 'submitted',
      'metadata_only', true,
      'test_dataset_tag', 'V99_SCENARIO_LAB'
    );

  elsif p_scenario = 'full' then
    foreach v_scenario in array array[
      'ovr_same_department',
      'ovr_cross_department',
      'ovr_high_severity',
      'ovr_returned_clarification',
      'ovr_disputed_reopened',
      'risk',
      'control',
      'evidence',
      'project'
    ]
    loop
      v_item := public.v99_create_scenario(
        p_actor_id,
        v_scenario,
        p_confirmation
      );
      v_results := v_results || jsonb_build_array(v_item);
    end loop;

    return jsonb_build_object(
      'scenario', 'full',
      'records', v_results,
      'record_count', jsonb_array_length(v_results),
      'test_dataset_tag', 'V99_SCENARIO_LAB'
    );
  end if;

  raise exception 'V99_UNSUPPORTED_SCENARIO: %', p_scenario;
end;
$$;

revoke all on function public.v99_create_scenario(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.v99_create_scenario(uuid, text, text)
to service_role;

create or replace function public.v99_cleanup_scenarios(
  p_actor_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_deleted_notifications integer := 0;
  v_deleted_evidence integer := 0;
  v_deleted_controls integer := 0;
  v_deleted_ovrs integer := 0;
  v_deleted_risks integer := 0;
  v_deleted_projects integer := 0;
  v_deleted_roles integer := 0;
  v_deleted_audit_logs integer := 0;
  v_deleted_registry integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('V99_SCENARIO_LAB'));
  v_organization_id :=
    public.v99_assert_scenario_lab_actor(p_actor_id, p_confirmation);

  delete from public.notifications n
  using public.ovr_reports o, public.v99_scenario_lab_records r
  where r.test_dataset_tag = 'V99_SCENARIO_LAB'
    and r.organization_id = v_organization_id
    and r.record_table = 'ovr_reports'
    and o.id = r.record_id
    and n.organization_id = v_organization_id
    and o.ovr_number is not null
    and n.body like '%' || o.ovr_number || '%';
  get diagnostics v_deleted_notifications = row_count;

  delete from public.notifications n
  using public.v99_scenario_lab_records r
  where r.test_dataset_tag = 'V99_SCENARIO_LAB'
    and r.organization_id = v_organization_id
    and r.record_table = 'notifications'
    and n.id = r.record_id;
  get diagnostics v_deleted_registry = row_count;
  v_deleted_notifications := v_deleted_notifications + v_deleted_registry;
  v_deleted_registry := 0;

  delete from public.evidence_files e
  using public.v99_scenario_lab_records r
  where r.test_dataset_tag = 'V99_SCENARIO_LAB'
    and r.organization_id = v_organization_id
    and r.record_table = 'evidence_files'
    and e.id = r.record_id;
  get diagnostics v_deleted_evidence = row_count;

  delete from public.risk_controls c
  using public.v99_scenario_lab_records r
  where r.test_dataset_tag = 'V99_SCENARIO_LAB'
    and r.organization_id = v_organization_id
    and r.record_table = 'risk_controls'
    and c.id = r.record_id;
  get diagnostics v_deleted_controls = row_count;

  delete from public.ovr_reports o
  using public.v99_scenario_lab_records r
  where r.test_dataset_tag = 'V99_SCENARIO_LAB'
    and r.organization_id = v_organization_id
    and r.record_table = 'ovr_reports'
    and o.id = r.record_id;
  get diagnostics v_deleted_ovrs = row_count;

  delete from public.risks risk
  using public.v99_scenario_lab_records r
  where r.test_dataset_tag = 'V99_SCENARIO_LAB'
    and r.organization_id = v_organization_id
    and r.record_table = 'risks'
    and risk.id = r.record_id;
  get diagnostics v_deleted_risks = row_count;

  delete from public.projects project
  using public.v99_scenario_lab_records r
  where r.test_dataset_tag = 'V99_SCENARIO_LAB'
    and r.organization_id = v_organization_id
    and r.record_table = 'projects'
    and project.id = r.record_id;
  get diagnostics v_deleted_projects = row_count;

  delete from public.user_roles role_assignment
  using public.v99_scenario_lab_records r
  where r.test_dataset_tag = 'V99_SCENARIO_LAB'
    and r.organization_id = v_organization_id
    and r.record_table = 'user_roles'
    and role_assignment.id = r.record_id;
  get diagnostics v_deleted_roles = row_count;

  delete from public.audit_logs audit
  using public.v99_scenario_lab_records r
  where r.test_dataset_tag = 'V99_SCENARIO_LAB'
    and r.organization_id = v_organization_id
    and audit.record_id = r.record_id;
  get diagnostics v_deleted_audit_logs = row_count;

  delete from public.v99_scenario_lab_records r
  where r.test_dataset_tag = 'V99_SCENARIO_LAB'
    and r.organization_id = v_organization_id;
  get diagnostics v_deleted_registry = row_count;

  return jsonb_build_object(
    'status', 'cleaned',
    'test_dataset_tag', 'V99_SCENARIO_LAB',
    'deleted', jsonb_build_object(
      'notifications', v_deleted_notifications,
      'evidence_files', v_deleted_evidence,
      'risk_controls', v_deleted_controls,
      'ovr_reports', v_deleted_ovrs,
      'risks', v_deleted_risks,
      'projects', v_deleted_projects,
      'temporary_user_roles', v_deleted_roles,
      'audit_logs', v_deleted_audit_logs,
      'registry_rows', v_deleted_registry
    )
  );
end;
$$;

revoke all on function public.v99_cleanup_scenarios(uuid, text)
from public, anon, authenticated;
grant execute on function public.v99_cleanup_scenarios(uuid, text)
to service_role;

create or replace function public.v99_scenario_status(
  p_actor_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
begin
  v_organization_id :=
    public.v99_assert_scenario_lab_actor(p_actor_id, p_confirmation);

  return jsonb_build_object(
    'test_dataset_tag',
    'V99_SCENARIO_LAB',
    'total_records',
    (
      select count(*)
      from public.v99_scenario_lab_records r
      where r.organization_id = v_organization_id
        and r.test_dataset_tag = 'V99_SCENARIO_LAB'
    ),
    'by_table',
    (
      select coalesce(
        jsonb_object_agg(grouped.record_table, grouped.record_count),
        '{}'::jsonb
      )
      from (
        select r.record_table, count(*) as record_count
        from public.v99_scenario_lab_records r
        where r.organization_id = v_organization_id
          and r.test_dataset_tag = 'V99_SCENARIO_LAB'
        group by r.record_table
        order by r.record_table
      ) grouped
    ),
    'by_scenario',
    (
      select coalesce(
        jsonb_object_agg(grouped.scenario_code, grouped.record_count),
        '{}'::jsonb
      )
      from (
        select r.scenario_code, count(*) as record_count
        from public.v99_scenario_lab_records r
        where r.organization_id = v_organization_id
          and r.test_dataset_tag = 'V99_SCENARIO_LAB'
        group by r.scenario_code
        order by r.scenario_code
      ) grouped
    )
  );
end;
$$;

revoke all on function public.v99_scenario_status(uuid, text)
from public, anon, authenticated;
grant execute on function public.v99_scenario_status(uuid, text)
to service_role;

commit;
