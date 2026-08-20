-- ============================================================================
-- GRC v1.4-E2B3: MIGRATION 209
-- SOP TRAINING POPULATION LIFECYCLE RECONCILIATION
--
-- This migration exposes a service-role capability probe and replaces the
-- version-bound reconciliation RPC. It does not create or alter business rows
-- when the migration itself is applied.
-- ============================================================================

-- ============================================================================
-- 1. DB209 CAPABILITY CONTRACT (SERVICE ROLE ONLY)
-- ============================================================================
create or replace function public.get_e2b3_training_reconciliation_capabilities()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  return jsonb_build_object(
    'contract_version', 'e2b3-training-population-v1',
    'schema_version', 209,
    'reconciliation_available', true
  );
end;
$$;

revoke all on function public.get_e2b3_training_reconciliation_capabilities() from public, anon, authenticated;
grant execute on function public.get_e2b3_training_reconciliation_capabilities() to service_role;

-- ============================================================================
-- 2. VERSION-BOUND SOP TRAINING POPULATION LIFECYCLE RECONCILIATION
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
  v_actor record;
  v_user record;
  v_assignment record;
  v_ack_requirement record;
  v_prog_id uuid;
  v_assignment_id uuid;
  v_due_date date;
  v_cycle integer := 1;
  v_cycle_type text := 'initial';
  v_is_initial boolean;
  v_training_req boolean;
  v_comp_req boolean;
  v_ack_req boolean;
  v_needs_assignment boolean;
  v_has_target_dept boolean;
  v_has_app_dept boolean;
  v_has_target_role boolean;
  v_has_app_role boolean;
  v_actor_has_authority boolean := false;
  v_target_user_ids uuid[] := array[]::uuid[];
  v_target_population_count integer := 0;
  v_newly_assigned_count integer := 0;
  v_reactivated_assignment_count integer := 0;
  v_cancelled_out_of_scope_count integer := 0;
  v_ack_created_count integer := 0;
  v_ack_reactivated_count integer := 0;
  v_ack_deactivated_count integer := 0;
  v_latest_relevant_event text;
  v_previous_status text;
  v_reactivated_status text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_user) <> 'service_role'
     and current_user <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  if p_actor_id is null then
    raise exception 'ACTOR_REQUIRED';
  end if;

  if p_version_id is null then
    raise exception 'VERSION_NOT_FOUND';
  end if;

  -- Serialize reconciliation for one governed SOP version so returned counts
  -- remain deterministic under concurrent operator requests.
  perform pg_advisory_xact_lock(
    hashtextextended('e2b3-training-population:' || p_version_id::text, 0)
  );

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
    raise exception 'INVALID_DOC_TYPE: Only SOP documents support population reconciliation';
  end if;

  select id, organization_id, is_active, user_status
  into v_actor
  from public.profiles
  where id = p_actor_id;

  if not found or v_actor.is_active is distinct from true or v_actor.user_status <> 'active' then
    raise exception 'ACTOR_INACTIVE: Actor profile must be active';
  end if;

  if v_actor.organization_id is null or v_actor.organization_id <> v_doc.organization_id then
    raise exception 'CROSS_ORGANIZATION_DENIED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role::text in ('super_admin', 'governance_admin', 'compliance_officer')
      and ur.scope::text = 'global'
      and ur.organization_id = v_doc.organization_id
  ) into v_actor_has_authority;

  v_actor_has_authority := v_actor_has_authority
    or v_doc.document_owner_id = p_actor_id;

  if not v_actor_has_authority then
    raise exception 'INSUFFICIENT_AUTHORITY: Reconciliation requires canonical global governance authority or active same-organization document ownership';
  end if;

  select * into v_sop_detail
  from public.governed_sop_details
  where version_id = p_version_id;

  if not found then
    raise exception 'GOVERNED_SOP_VERSION_CONTEXT_INVALID';
  end if;

  select id into v_prog_id
  from public.training_programs
  where linked_sop_id = v_doc.id
    and training_type = 'sop_acknowledgment'
  order by created_at asc, id asc
  limit 1;

  if v_prog_id is null then
    raise exception 'TRAINING_PROGRAM_NOT_PUBLISHED: Publish obligations before running reconciliation';
  end if;

  v_is_initial := (
    v_version.supersedes_version_id is null
    and coalesce(v_version.version_number, 1) = 1
  );

  if v_is_initial then
    v_training_req := coalesce(v_sop_detail.training_required, false);
    v_comp_req := coalesce(v_sop_detail.competency_assessment_required, false);
    v_ack_req := coalesce(v_sop_detail.acknowledgment_required, true);
    v_cycle_type := 'initial';
  else
    v_training_req := coalesce(v_sop_detail.retraining_required, false);
    v_comp_req := coalesce(v_sop_detail.competency_reassessment_required, false);
    v_ack_req := coalesce(v_sop_detail.reacknowledgment_required, true);
    v_cycle_type := 'retraining';
  end if;

  v_needs_assignment := v_training_req or v_comp_req;
  v_due_date := current_date + coalesce(v_sop_detail.acknowledgment_sla_days, 30);

  select exists (
    select 1 from public.sop_version_training_target_scopes
    where sop_version_id = p_version_id and scope_type = 'department'
  ) into v_has_target_dept;

  select exists (
    select 1 from public.document_version_department_scope
    where version_id = p_version_id
  ) into v_has_app_dept;

  select exists (
    select 1 from public.sop_version_training_target_scopes
    where sop_version_id = p_version_id and scope_type = 'role'
  ) into v_has_target_role;

  select exists (
    select 1 from public.document_version_role_scope
    where version_id = p_version_id
  ) into v_has_app_role;

  -- Canonical publication population: target overrides take precedence over
  -- applicability scopes independently for department and role dimensions.
  select coalesce(array_agg(p.id order by p.id), array[]::uuid[])
  into v_target_user_ids
  from public.profiles p
  where p.organization_id = v_doc.organization_id
    and p.is_active = true
    and p.user_status = 'active'
    and (
      case
        when v_has_target_dept then
          p.department_id in (
            select s.department_id
            from public.sop_version_training_target_scopes s
            where s.sop_version_id = p_version_id
              and s.scope_type = 'department'
              and s.department_id is not null
          )
        when v_has_app_dept then
          p.department_id in (
            select ds.department_id
            from public.document_version_department_scope ds
            where ds.version_id = p_version_id
              and ds.department_id is not null
          )
        else true
      end
    )
    and (
      case
        when v_has_target_role then
          exists (
            select 1
            from public.user_roles ur
            where ur.user_id = p.id
              and ur.is_active = true
              and ur.organization_id = v_doc.organization_id
              and ur.role::text in (
                select s.role_name
                from public.sop_version_training_target_scopes s
                where s.sop_version_id = p_version_id
                  and s.scope_type = 'role'
                  and s.role_name is not null
              )
          )
        when v_has_app_role then
          exists (
            select 1
            from public.user_roles ur
            where ur.user_id = p.id
              and ur.is_active = true
              and ur.organization_id = v_doc.organization_id
              and ur.role::text in (
                select rs.role_name
                from public.document_version_role_scope rs
                where rs.version_id = p_version_id
                  and rs.role_name is not null
              )
          )
        else true
      end
    );

  v_target_population_count := cardinality(v_target_user_ids);

  -- Create missing assignments or restore only assignments whose latest
  -- relevant cancellation event proves an earlier system population exit.
  if v_needs_assignment then
    for v_user in (
      select p.id, p.department_id
      from public.profiles p
      where p.id = any(v_target_user_ids)
      order by p.id
    ) loop
      select ta.* into v_assignment
      from public.training_assignments ta
      where ta.program_id = v_prog_id
        and ta.document_version_id = p_version_id
        and ta.assigned_to_user_id = v_user.id
        and ta.obligation_cycle = v_cycle
      for update;

      if not found then
        insert into public.training_assignments (
          program_id,
          document_version_id,
          assigned_to_user_id,
          assigned_to_department_id,
          due_date,
          status,
          obligation_cycle,
          cycle_type,
          assigned_by
        ) values (
          v_prog_id,
          p_version_id,
          v_user.id,
          v_user.department_id,
          v_due_date,
          'assigned',
          v_cycle,
          v_cycle_type,
          p_actor_id
        ) returning id into v_assignment_id;

        v_newly_assigned_count := v_newly_assigned_count + 1;

        perform public.log_training_event(
          'training_assignments',
          v_assignment_id,
          'population_reconciliation_assigned',
          'Population reconciliation created a version-bound assignment for user ' || v_user.id::text || '.',
          p_actor_id
        );
      elsif v_assignment.status = 'cancelled' then
        select te.event_type into v_latest_relevant_event
        from public.training_events te
        where te.entity_type = 'training_assignments'
          and te.entity_id = v_assignment.id
          and te.event_type in (
            'population_reconciliation_cancelled_assigned',
            'population_reconciliation_cancelled_in_progress',
            'population_reconciliation_cancelled_overdue',
            'population_reconciliation_reactivated',
            'cancelled',
            'reopened'
          )
        order by te.created_at desc, te.id desc
        limit 1;

        if v_latest_relevant_event in (
          'population_reconciliation_cancelled_assigned',
          'population_reconciliation_cancelled_in_progress',
          'population_reconciliation_cancelled_overdue'
        ) then
          v_previous_status := replace(
            v_latest_relevant_event,
            'population_reconciliation_cancelled_',
            ''
          );

          v_reactivated_status := case
            when v_previous_status = 'overdue' then 'overdue'
            when v_due_date < current_date then 'overdue'
            when v_previous_status = 'in_progress' then 'in_progress'
            else 'assigned'
          end;

          update public.training_assignments
          set status = v_reactivated_status,
              due_date = v_due_date,
              assigned_to_department_id = v_user.department_id,
              assigned_by = p_actor_id,
              completed_at = null,
              completion_evidence_id = null
          where id = v_assignment.id;

          v_reactivated_assignment_count := v_reactivated_assignment_count + 1;

          perform public.log_training_event(
            'training_assignments',
            v_assignment.id,
            'population_reconciliation_reactivated',
            'Population reconciliation restored assignment from ' || v_previous_status ||
              ' to ' || v_reactivated_status || ' with a new eligibility due date.',
            p_actor_id
          );
        end if;
      end if;
    end loop;
  end if;

  -- Cancel only open obligations that no longer belong to the intended
  -- population. Completed, waived, and manually/system-cancelled history is
  -- never rewritten or deleted.
  for v_assignment in (
    select ta.*
    from public.training_assignments ta
    where ta.program_id = v_prog_id
      and ta.document_version_id = p_version_id
      and ta.obligation_cycle = v_cycle
      and ta.status in ('assigned', 'in_progress', 'overdue')
      and (
        not v_needs_assignment
        or not (ta.assigned_to_user_id = any(v_target_user_ids))
      )
    order by ta.id
    for update
  ) loop
    v_previous_status := v_assignment.status;

    update public.training_assignments
    set status = 'cancelled'
    where id = v_assignment.id;

    v_cancelled_out_of_scope_count := v_cancelled_out_of_scope_count + 1;

    perform public.log_training_event(
      'training_assignments',
      v_assignment.id,
      'population_reconciliation_cancelled_' || v_previous_status,
      'Population reconciliation cancelled an out-of-scope ' || v_previous_status || ' assignment.',
      p_actor_id
    );
  end loop;

  -- Materialize acknowledgment requirements per exact version and employee.
  -- Existing active requirements retain their due date; a re-entry starts a
  -- new fair eligibility window on the same requirement row.
  if v_ack_req then
    for v_user in (
      select p.id, p.department_id
      from public.profiles p
      where p.id = any(v_target_user_ids)
      order by p.id
    ) loop
      select req.* into v_ack_requirement
      from public.document_acknowledgment_requirements req
      where req.document_id = v_doc.id
        and req.version_id = p_version_id
        and req.requirement_scope = 'specific_users'
        and req.user_id = v_user.id
      for update;

      if not found then
        insert into public.document_acknowledgment_requirements (
          document_id,
          version_id,
          requirement_scope,
          user_id,
          department_id,
          due_date,
          required_flag,
          created_by
        ) values (
          v_doc.id,
          p_version_id,
          'specific_users',
          v_user.id,
          v_user.department_id,
          v_due_date,
          true,
          p_actor_id
        );

        v_ack_created_count := v_ack_created_count + 1;
      elsif v_ack_requirement.required_flag is distinct from true then
        update public.document_acknowledgment_requirements
        set required_flag = true,
            due_date = v_due_date,
            department_id = v_user.department_id
        where id = v_ack_requirement.id;

        v_ack_reactivated_count := v_ack_reactivated_count + 1;
      end if;
    end loop;
  end if;

  for v_ack_requirement in (
    select req.*
    from public.document_acknowledgment_requirements req
    where req.document_id = v_doc.id
      and req.version_id = p_version_id
      and req.requirement_scope = 'specific_users'
      and req.user_id is not null
      and req.required_flag = true
      and (
        not v_ack_req
        or not (req.user_id = any(v_target_user_ids))
      )
    order by req.id
    for update
  ) loop
    update public.document_acknowledgment_requirements
    set required_flag = false
    where id = v_ack_requirement.id;

    v_ack_deactivated_count := v_ack_deactivated_count + 1;
  end loop;

  perform public.log_training_event(
    'training_programs',
    v_prog_id,
    'population_acknowledgment_requirements_reconciled',
    'Acknowledgment requirements reconciled: created=' || v_ack_created_count ||
      ', reactivated=' || v_ack_reactivated_count ||
      ', deactivated=' || v_ack_deactivated_count || '.',
    p_actor_id
  );

  perform public.log_training_event(
    'training_programs',
    v_prog_id,
    'population_reconciliation_completed',
    'Population reconciliation completed for version ' || p_version_id::text ||
      ': target=' || v_target_population_count ||
      ', assigned=' || v_newly_assigned_count ||
      ', reactivated=' || v_reactivated_assignment_count ||
      ', cancelled=' || v_cancelled_out_of_scope_count ||
      ', ack_created=' || v_ack_created_count ||
      ', ack_reactivated=' || v_ack_reactivated_count ||
      ', ack_deactivated=' || v_ack_deactivated_count || '.',
    p_actor_id
  );

  return jsonb_build_object(
    'success', true,
    'version_id', p_version_id,
    'program_id', v_prog_id,
    'cycle', v_cycle,
    'cycle_type', v_cycle_type,
    'target_population_count', v_target_population_count,
    'newly_assigned_count', v_newly_assigned_count,
    'reactivated_assignment_count', v_reactivated_assignment_count,
    'cancelled_out_of_scope_count', v_cancelled_out_of_scope_count,
    'inactive_cancelled_count', v_cancelled_out_of_scope_count,
    'acknowledgment_requirements_created', v_ack_created_count,
    'acknowledgment_requirements_reactivated', v_ack_reactivated_count,
    'acknowledgment_requirements_deactivated', v_ack_deactivated_count
  );
end;
$$;

revoke all on function public.reconcile_sop_training_population(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reconcile_sop_training_population(uuid, uuid) to service_role;
