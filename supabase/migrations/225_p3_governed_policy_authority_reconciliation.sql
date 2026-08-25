-- P3 hosted UAT correction: align governed Policy lifecycle functions with the
-- canonical profile activity column and the SOP ownership/role authority model.

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
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_id
      and p.organization_id = p_organization_id
      and p.is_active = true
      and p.user_status::text = 'active'
  ) then
    raise exception 'PATCH202_ACTOR_NOT_AUTHORIZED';
  end if;

  if p_department_id is not null then
    select code
    into v_dept_code
    from public.departments
    where id = p_department_id
      and organization_id = p_organization_id;
  end if;

  v_doc_code := public.generate_governed_document_code(
    p_organization_id,
    'policy',
    v_dept_code
  );

  insert into public.controlled_documents (
    organization_id,
    document_code,
    document_title,
    document_type,
    department_id,
    document_owner_id,
    criticality_level,
    confidentiality_level,
    document_status,
    created_by,
    updated_by
  ) values (
    p_organization_id,
    v_doc_code,
    p_title_en,
    'policy',
    p_department_id,
    p_actor_id,
    p_criticality_level,
    p_confidentiality_level,
    'draft',
    p_actor_id,
    p_actor_id
  ) returning id into v_doc_id;

  insert into public.document_versions (
    document_id,
    version_number,
    version_label,
    prepared_by,
    is_current_version
  ) values (
    v_doc_id,
    1,
    '1.0',
    p_actor_id,
    true
  ) returning id into v_ver_id;

  update public.controlled_documents
  set current_version_id = v_ver_id
  where id = v_doc_id;

  insert into public.governed_policy_details (
    version_id,
    title_en,
    title_ar,
    purpose_en,
    purpose_ar,
    policy_statement_en,
    policy_statement_ar,
    scope_en,
    scope_ar,
    principles_en,
    principles_ar,
    exceptions_summary_en,
    exceptions_summary_ar,
    non_compliance_escalation_en,
    non_compliance_escalation_ar,
    content_mode
  ) values (
    v_ver_id,
    p_title_en,
    p_title_ar,
    p_purpose_en,
    p_purpose_ar,
    p_policy_statement_en,
    p_policy_statement_ar,
    p_scope_en,
    p_scope_ar,
    p_principles_en,
    p_principles_ar,
    p_exceptions_summary_en,
    p_exceptions_summary_ar,
    p_non_compliance_escalation_en,
    p_non_compliance_escalation_ar,
    p_content_mode
  );

  if jsonb_array_length(p_requirements) > 0 then
    for v_req in select * from jsonb_array_elements(p_requirements) loop
      insert into public.policy_requirements (
        policy_version_id,
        sequence_number,
        requirement_statement_en,
        requirement_statement_ar,
        responsible_role,
        is_mandatory,
        expected_evidence_en,
        expected_evidence_ar,
        mapped_control_id,
        linked_accreditation_clause_id,
        monitoring_frequency,
        monitoring_owner_id
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

  if array_length(p_department_scopes, 1) > 0 then
    foreach v_dept_id in array p_department_scopes loop
      insert into public.document_version_department_scope (version_id, department_id)
      values (v_ver_id, v_dept_id)
      on conflict do nothing;
    end loop;
  end if;

  if jsonb_array_length(p_role_scopes) > 0 then
    for v_role in select * from jsonb_array_elements(p_role_scopes) loop
      if nullif(trim(coalesce(v_role ->> 'role_name', '')), '') is not null
        or nullif(trim(coalesce(v_role ->> 'job_title', '')), '') is not null
      then
        insert into public.document_version_role_scope (version_id, role_name, job_title)
        values (v_ver_id, trim(v_role ->> 'role_name'), trim(v_role ->> 'job_title'))
        on conflict do nothing;
      end if;
    end loop;
  end if;

  insert into public.document_review_events (
    document_id,
    version_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    event_note
  ) values (
    v_doc_id,
    v_ver_id,
    'created',
    null,
    'draft',
    p_actor_id,
    'Initial Policy draft created'
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
  v_doc_owner_id uuid;
  v_prepared_by uuid;
  v_req jsonb;
  v_req_id uuid;
  v_seen_req_ids uuid[] := '{}'::uuid[];
  v_role jsonb;
  v_dept_id uuid;
  v_seq integer := 1;
begin
  select d.id, d.organization_id, d.document_owner_id, v.prepared_by
  into v_doc_id, v_org_id, v_doc_owner_id, v_prepared_by
  from public.document_versions v
  join public.controlled_documents d on d.id = v.document_id
  where v.id = p_version_id
    and d.document_type = 'policy';

  if v_doc_id is null then
    raise exception 'PATCH202_VERSION_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_id
      and p.organization_id = v_org_id
      and p.is_active = true
      and p.user_status::text = 'active'
  ) then
    raise exception 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN';
  end if;

  if not (
    coalesce(v_prepared_by, '00000000-0000-0000-0000-000000000000'::uuid) = p_actor_id
    or coalesce(v_doc_owner_id, '00000000-0000-0000-0000-000000000000'::uuid) = p_actor_id
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p_actor_id
        and ur.is_active = true
        and ur.role in ('super_admin', 'governance_admin')
        and (ur.organization_id is null or ur.organization_id = v_org_id)
    )
  ) then
    raise exception 'PATCH202_ACTOR_NOT_AUTHORIZED';
  end if;

  if exists (
    select 1
    from public.document_versions v
    join public.controlled_documents d on d.id = v.document_id
    where v.id = p_version_id
      and (
        v.locked_at is not null
        or v.approved_at is not null
        or d.document_status <> 'draft'
      )
  ) then
    raise exception 'PATCH201_VERSION_IMMUTABLE_LOCKED';
  end if;

  update public.controlled_documents
  set document_title = p_title_en,
      updated_by = p_actor_id,
      updated_at = now()
  where id = v_doc_id;

  update public.governed_policy_details
  set title_en = p_title_en,
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

  if jsonb_array_length(p_requirements) > 0 then
    for v_req in select * from jsonb_array_elements(p_requirements) loop
      v_req_id := (v_req ->> 'id')::uuid;
      if v_req_id is not null then
        if exists (
          select 1
          from public.policy_requirements
          where id = v_req_id
            and policy_version_id <> p_version_id
        ) then
          raise exception 'PATCH202_CROSS_VERSION_CHILD_ID_DENIED';
        end if;

        if exists (
          select 1
          from public.policy_requirements
          where id = v_req_id
            and policy_version_id = p_version_id
        ) then
          update public.policy_requirements
          set sequence_number = v_seq,
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
            policy_version_id,
            sequence_number,
            requirement_statement_en,
            requirement_statement_ar,
            responsible_role,
            is_mandatory,
            expected_evidence_en,
            expected_evidence_ar,
            mapped_control_id,
            linked_accreditation_clause_id,
            monitoring_frequency,
            monitoring_owner_id
          ) values (
            p_version_id,
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
          ) returning id into v_req_id;
          v_seen_req_ids := array_append(v_seen_req_ids, v_req_id);
        end if;
      else
        insert into public.policy_requirements (
          policy_version_id,
          sequence_number,
          requirement_statement_en,
          requirement_statement_ar,
          responsible_role,
          is_mandatory,
          expected_evidence_en,
          expected_evidence_ar,
          mapped_control_id,
          linked_accreditation_clause_id,
          monitoring_frequency,
          monitoring_owner_id
        ) values (
          p_version_id,
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
        ) returning id into v_req_id;
        v_seen_req_ids := array_append(v_seen_req_ids, v_req_id);
      end if;
      v_seq := v_seq + 1;
    end loop;

    delete from public.policy_requirements
    where policy_version_id = p_version_id
      and not (id = any(v_seen_req_ids));
  else
    delete from public.policy_requirements
    where policy_version_id = p_version_id;
  end if;

  delete from public.document_version_department_scope
  where version_id = p_version_id;

  if array_length(p_department_scopes, 1) > 0 then
    foreach v_dept_id in array p_department_scopes loop
      insert into public.document_version_department_scope (version_id, department_id)
      values (p_version_id, v_dept_id)
      on conflict do nothing;
    end loop;
  end if;

  delete from public.document_version_role_scope
  where version_id = p_version_id;

  if jsonb_array_length(p_role_scopes) > 0 then
    for v_role in select * from jsonb_array_elements(p_role_scopes) loop
      if nullif(trim(coalesce(v_role ->> 'role_name', '')), '') is not null
        or nullif(trim(coalesce(v_role ->> 'job_title', '')), '') is not null
      then
        insert into public.document_version_role_scope (version_id, role_name, job_title)
        values (p_version_id, trim(v_role ->> 'role_name'), trim(v_role ->> 'job_title'))
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return jsonb_build_object('success', true, 'version_id', p_version_id);
end;
$$;

revoke all on function public.create_governed_policy_draft(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, uuid, text, text, text, jsonb, uuid[], jsonb
) from public, anon, authenticated;
grant execute on function public.create_governed_policy_draft(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, uuid, text, text, text, jsonb, uuid[], jsonb
) to service_role;

revoke all on function public.save_governed_policy_draft(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, jsonb, uuid[], jsonb
) from public, anon, authenticated;
grant execute on function public.save_governed_policy_draft(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, jsonb, uuid[], jsonb
) to service_role;

comment on function public.create_governed_policy_draft(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, uuid, text, text, text, jsonb, uuid[], jsonb
) is 'Creates a governed Policy draft for an active same-organization actor.';

comment on function public.save_governed_policy_draft(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, jsonb, uuid[], jsonb
) is 'Saves an editable governed Policy draft for its owner, preparer, or an active same-organization governance administrator.';
