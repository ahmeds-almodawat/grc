-- Migration 198: Enforce unconditional evidence reviewer separation of duties.
-- Fixes evidence self-review defect by eliminating privileged-role bypass in patch23_evidence_governance_bridge.
-- Replaces public.patch23_evidence_governance_bridge with strict uploader != reviewer enforcement.

create or replace function public.patch23_evidence_governance_bridge(
  p_actor_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_action text := lower(coalesce(p_action, ''));
  v_evidence public.evidence_files%rowtype;
  v_requirement public.evidence_requirements%rowtype;
  v_evidence_id uuid := nullif(p_payload->>'evidence_file_id', '')::uuid;
  v_requirement_id uuid := nullif(p_payload->>'requirement_id', '')::uuid;
  v_can_manage boolean := false;
  v_can_review boolean := false;
  v_is_owner boolean := false;
  v_old_status text;
  v_new_status text;
  v_note text := nullif(trim(coalesce(p_payload->>'note', p_payload->>'reason', p_payload->>'review_note', p_payload->>'audit_note', '')), '');
  v_result jsonb := '{}'::jsonb;
  v_linked_item_type text := nullif(p_payload->>'linked_item_type', '');
  v_linked_item_id uuid := nullif(p_payload->>'linked_item_id', '')::uuid;
  v_accepted_count integer;
  v_waiver_active boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'PATCH23_EVIDENCE_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_actor
  from public.profiles
  where id = p_actor_id and is_active = true;

  if not found or v_actor.organization_id is null then
    raise exception 'PATCH23_EVIDENCE_ACTIVE_ACTOR_REQUIRED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role::text in ('super_admin','governance_admin','executive','auditor','compliance_officer','department_manager')
      and (ur.organization_id is null or ur.organization_id is not distinct from v_actor.organization_id)
  ) into v_can_manage;

  v_can_review := v_can_manage;

  if v_action not in (
    'create_evidence_requirement',
    'link_evidence_to_item',
    'submit_evidence_for_review',
    'accept_evidence',
    'reject_evidence',
    'request_evidence_revision',
    'supersede_evidence',
    'lock_evidence',
    'request_evidence_gate_waiver',
    'approve_evidence_gate_waiver',
    'reject_evidence_gate_waiver',
    'check_evidence_gate_status',
    'generate_evidence_pack_index'
  ) then
    raise exception 'PATCH23_EVIDENCE_UNSUPPORTED_ACTION';
  end if;

  if v_action = 'create_evidence_requirement' then
    if not v_can_manage then
      raise exception 'PATCH23_EVIDENCE_REQUIREMENT_ADMIN_REQUIRED';
    end if;
    if v_linked_item_type is null or v_linked_item_id is null then
      raise exception 'PATCH23_EVIDENCE_LINKED_ITEM_REQUIRED';
    end if;

    insert into public.evidence_requirements (
      organization_id,
      requirement_code,
      linked_item_type,
      linked_item_id,
      requirement_title,
      requirement_description,
      evidence_type_required,
      minimum_accepted_files,
      sensitivity_required,
      due_date,
      required_for_gate,
      owner_id,
      reviewer_role,
      reviewer_id,
      created_by
    )
    values (
      v_actor.organization_id,
      coalesce(nullif(p_payload->>'requirement_code', ''), 'ER-' || replace(left(gen_random_uuid()::text, 8), '-', '')),
      v_linked_item_type,
      v_linked_item_id,
      coalesce(nullif(p_payload->>'requirement_title', ''), 'Evidence requirement'),
      nullif(p_payload->>'requirement_description', ''),
      nullif(p_payload->>'evidence_type_required', ''),
      coalesce(nullif(p_payload->>'minimum_accepted_files', '')::integer, 1),
      nullif(p_payload->>'sensitivity_required', ''),
      nullif(p_payload->>'due_date', '')::date,
      coalesce(nullif(p_payload->>'required_for_gate', ''), 'closure'),
      coalesce(nullif(p_payload->>'owner_id', '')::uuid, p_actor_id),
      nullif(p_payload->>'reviewer_role', ''),
      nullif(p_payload->>'reviewer_id', '')::uuid,
      p_actor_id
    )
    on conflict (organization_id, requirement_code) do update set
      requirement_title = excluded.requirement_title,
      requirement_description = excluded.requirement_description,
      evidence_type_required = excluded.evidence_type_required,
      minimum_accepted_files = excluded.minimum_accepted_files,
      sensitivity_required = excluded.sensitivity_required,
      due_date = excluded.due_date,
      required_for_gate = excluded.required_for_gate,
      owner_id = excluded.owner_id,
      reviewer_role = excluded.reviewer_role,
      reviewer_id = excluded.reviewer_id,
      updated_at = now(),
      is_active = true
    returning * into v_requirement;

    v_result := jsonb_build_object('requirement_id', v_requirement.id, 'gate_status', v_requirement.gate_status);

  else
    if v_evidence_id is not null then
      select * into v_evidence
      from public.evidence_files
      where id = v_evidence_id
      for update;
      if not found then
        raise exception 'PATCH23_EVIDENCE_NOT_FOUND';
      end if;
      if v_evidence.organization_id is distinct from v_actor.organization_id then
        raise exception 'PATCH23_EVIDENCE_CROSS_ORGANIZATION_DENIED';
      end if;
      v_is_owner := p_actor_id in (v_evidence.uploaded_by, v_evidence.evidence_owner_id, v_evidence.reviewer_id, v_evidence.reviewed_by);
      if v_evidence.locked_at is not null and not v_can_manage and v_action not in ('check_evidence_gate_status','generate_evidence_pack_index') then
        raise exception 'PATCH23_EVIDENCE_LOCKED';
      end if;
    end if;

    if v_requirement_id is not null then
      select * into v_requirement
      from public.evidence_requirements
      where id = v_requirement_id
      for update;
      if not found then
        raise exception 'PATCH23_EVIDENCE_REQUIREMENT_NOT_FOUND';
      end if;
      if v_requirement.organization_id is distinct from v_actor.organization_id then
        raise exception 'PATCH23_EVIDENCE_CROSS_ORGANIZATION_DENIED';
      end if;
    end if;

    if v_action in ('link_evidence_to_item','submit_evidence_for_review','supersede_evidence') and not (v_can_manage or v_is_owner) then
      raise exception 'PATCH23_EVIDENCE_NOT_AUTHORIZED';
    end if;

    if v_action in ('accept_evidence','reject_evidence','request_evidence_revision','lock_evidence') and not v_can_review then
      raise exception 'PATCH23_EVIDENCE_REVIEWER_REQUIRED';
    end if;

    if v_action in ('accept_evidence','reject_evidence','request_evidence_revision') then
      if v_evidence.uploaded_by = p_actor_id then
        raise exception 'PATCH23_EVIDENCE_REVIEWER_SEPARATION_REQUIRED';
      end if;
    end if;

    if v_action = 'link_evidence_to_item' then
      if v_evidence_id is null or v_linked_item_type is null or v_linked_item_id is null then
        raise exception 'PATCH23_EVIDENCE_LINK_PAYLOAD_REQUIRED';
      end if;
      insert into public.evidence_links (
        organization_id,
        evidence_file_id,
        linked_item_type,
        linked_item_id,
        linked_item_title,
        link_reason,
        is_primary,
        required_for_closure,
        required_for_acceptance,
        required_for_approval,
        required_for_treatment,
        linked_by
      )
      values (
        v_actor.organization_id,
        v_evidence_id,
        v_linked_item_type,
        v_linked_item_id,
        nullif(p_payload->>'linked_item_title', ''),
        v_note,
        coalesce((p_payload->>'is_primary')::boolean, false),
        coalesce((p_payload->>'required_for_closure')::boolean, false),
        coalesce((p_payload->>'required_for_acceptance')::boolean, false),
        coalesce((p_payload->>'required_for_approval')::boolean, false),
        coalesce((p_payload->>'required_for_treatment')::boolean, false),
        p_actor_id
      )
      on conflict (organization_id, evidence_file_id, linked_item_type, linked_item_id) do update set
        linked_item_title = excluded.linked_item_title,
        link_reason = excluded.link_reason,
        is_primary = excluded.is_primary,
        required_for_closure = excluded.required_for_closure,
        required_for_acceptance = excluded.required_for_acceptance,
        required_for_approval = excluded.required_for_approval,
        required_for_treatment = excluded.required_for_treatment,
        linked_by = excluded.linked_by,
        linked_at = now(),
        is_active = true;

      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'linked', v_evidence.review_status, v_evidence.review_status, p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'linked_item_type', v_linked_item_type, 'linked_item_id', v_linked_item_id);

    elsif v_action = 'submit_evidence_for_review' then
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        review_status = 'pending_review',
        status = 'submitted',
        review_required = true,
        review_due_date = coalesce(nullif(p_payload->>'review_due_date', '')::date, review_due_date, current_date + 7),
        reviewer_id = coalesce(nullif(p_payload->>'reviewer_id', '')::uuid, reviewer_id),
        updated_by = p_actor_id
      where id = v_evidence_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'submitted_for_review', v_old_status, 'pending_review', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'pending_review');

    elsif v_action = 'accept_evidence' then
      if v_evidence.sensitivity_level in ('confidential','highly_sensitive','restricted') and nullif(trim(coalesce(v_evidence.classification_reason, '')), '') is null then
        raise exception 'PATCH23_EVIDENCE_CLASSIFICATION_REASON_REQUIRED';
      end if;
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        review_status = 'accepted',
        status = 'accepted',
        reviewer_id = coalesce(reviewer_id, p_actor_id),
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        review_note = v_note,
        rejection_reason = null,
        revision_required = false,
        revision_due_date = null,
        updated_by = p_actor_id
      where id = v_evidence_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'accepted', v_old_status, 'accepted', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'accepted');

    elsif v_action = 'reject_evidence' then
      if v_note is null then
        raise exception 'PATCH23_EVIDENCE_REJECTION_REASON_REQUIRED';
      end if;
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        review_status = 'rejected',
        status = 'rejected',
        reviewer_id = coalesce(reviewer_id, p_actor_id),
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        review_note = v_note,
        rejection_reason = v_note,
        revision_required = true,
        revision_due_date = coalesce(nullif(p_payload->>'revision_due_date', '')::date, current_date + 7),
        updated_by = p_actor_id
      where id = v_evidence_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'rejected', v_old_status, 'rejected', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'rejected');

    elsif v_action = 'request_evidence_revision' then
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        review_status = 'needs_revision',
        status = 'needs_revision',
        revision_required = true,
        revision_due_date = coalesce(nullif(p_payload->>'revision_due_date', '')::date, current_date + 7),
        review_note = coalesce(v_note, review_note),
        rejection_reason = coalesce(v_note, rejection_reason),
        updated_by = p_actor_id
      where id = v_evidence_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'needs_revision', v_old_status, 'needs_revision', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'needs_revision');

    elsif v_action = 'supersede_evidence' then
      if nullif(p_payload->>'superseded_by_evidence_id', '') is null then
        raise exception 'PATCH23_EVIDENCE_SUPERSEDED_BY_REQUIRED';
      end if;
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        review_status = 'superseded',
        is_current_version = false,
        superseded_by_evidence_id = (p_payload->>'superseded_by_evidence_id')::uuid,
        updated_by = p_actor_id
      where id = v_evidence_id;
      update public.evidence_files
      set
        version_number = greatest(version_number, v_evidence.version_number + 1),
        is_current_version = true,
        updated_by = p_actor_id
      where id = (p_payload->>'superseded_by_evidence_id')::uuid
        and organization_id = v_actor.organization_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'superseded', v_old_status, 'superseded', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'superseded');

    elsif v_action = 'lock_evidence' then
      v_old_status := v_evidence.review_status;
      update public.evidence_files
      set
        locked_at = now(),
        locked_by = p_actor_id,
        review_status = 'locked',
        updated_by = p_actor_id
      where id = v_evidence_id;
      perform public.patch23_write_evidence_event(v_actor.organization_id, v_evidence_id, 'locked', v_old_status, 'locked', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('evidence_file_id', v_evidence_id, 'review_status', 'locked');

    elsif v_action = 'request_evidence_gate_waiver' then
      if v_requirement_id is null or v_note is null then
        raise exception 'PATCH23_EVIDENCE_WAIVER_REASON_REQUIRED';
      end if;
      if not (v_can_manage or v_requirement.owner_id = p_actor_id) then
        raise exception 'PATCH23_EVIDENCE_NOT_AUTHORIZED';
      end if;
      insert into public.evidence_gate_waivers (
        organization_id,
        requirement_id,
        linked_item_type,
        linked_item_id,
        waiver_reason,
        requested_by,
        expiry_date,
        audit_note
      )
      values (
        v_actor.organization_id,
        v_requirement_id,
        v_requirement.linked_item_type,
        v_requirement.linked_item_id,
        v_note,
        p_actor_id,
        nullif(p_payload->>'expiry_date', '')::date,
        nullif(p_payload->>'audit_note', '')
      );
      insert into public.evidence_review_events (organization_id, evidence_file_id, event_type, actor_id, note, metadata)
      values (v_actor.organization_id, null, 'waiver_requested', p_actor_id, v_note, p_payload);
      v_result := jsonb_build_object('requirement_id', v_requirement_id, 'waiver_status', 'requested');

    elsif v_action in ('approve_evidence_gate_waiver','reject_evidence_gate_waiver') then
      if not v_can_manage then
        raise exception 'PATCH23_EVIDENCE_WAIVER_APPROVER_REQUIRED';
      end if;
      if nullif(p_payload->>'waiver_id', '') is null then
        raise exception 'PATCH23_EVIDENCE_WAIVER_ID_REQUIRED';
      end if;
      update public.evidence_gate_waivers
      set
        status = case when v_action = 'approve_evidence_gate_waiver' then 'approved' else 'rejected' end,
        approved_by = case when v_action = 'approve_evidence_gate_waiver' then p_actor_id else approved_by end,
        approved_at = case when v_action = 'approve_evidence_gate_waiver' then now() else approved_at end,
        audit_note = coalesce(v_note, audit_note)
      where id = (p_payload->>'waiver_id')::uuid
        and organization_id = v_actor.organization_id
      returning requirement_id into v_requirement_id;
      if v_requirement_id is null then
        raise exception 'PATCH23_EVIDENCE_WAIVER_NOT_FOUND';
      end if;
      insert into public.evidence_review_events (organization_id, evidence_file_id, event_type, actor_id, note, metadata)
      values (
        v_actor.organization_id,
        null,
        case when v_action = 'approve_evidence_gate_waiver' then 'waiver_approved' else 'waiver_rejected' end,
        p_actor_id,
        v_note,
        p_payload
      );
      v_result := jsonb_build_object('requirement_id', v_requirement_id, 'waiver_status', case when v_action = 'approve_evidence_gate_waiver' then 'approved' else 'rejected' end);

    elsif v_action in ('check_evidence_gate_status','generate_evidence_pack_index') then
      if not v_can_manage and v_linked_item_type is null then
        raise exception 'PATCH23_EVIDENCE_NOT_AUTHORIZED';
      end if;
      if v_requirement_id is not null then
        select accepted_evidence_count, waiver_active
        into v_accepted_count, v_waiver_active
        from public.v_patch23_evidence_closure_gate_status
        where requirement_id = v_requirement_id
        limit 1;
      else
        select coalesce(sum(accepted_evidence_count), 0)::integer, bool_or(waiver_active)
        into v_accepted_count, v_waiver_active
        from public.v_patch23_evidence_closure_gate_status
        where linked_item_type = v_linked_item_type
          and linked_item_id = v_linked_item_id
          and organization_id = v_actor.organization_id;
      end if;
      v_result := jsonb_build_object(
        'accepted_evidence_count', coalesce(v_accepted_count, 0),
        'waiver_active', coalesce(v_waiver_active, false),
        'can_close', coalesce(v_accepted_count, 0) > 0 or coalesce(v_waiver_active, false)
      );
    end if;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'action', v_action,
    'result', v_result
  );
end;
$$;

revoke all on function public.patch23_evidence_governance_bridge(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.patch23_evidence_governance_bridge(uuid, text, jsonb) to service_role;
