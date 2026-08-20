\set ON_ERROR_STOP on

begin;
set local client_min_messages = notice;
set local request.jwt.claim.role = 'service_role';
set local patch83u.controlled_role_restore = 'on';

-- GRC v1.4-E2B3 Migration209 isolated lifecycle runtime proof.
-- All fixtures are transaction-scoped and rolled back at the end.

do $$
declare
  v_cap jsonb;
  v_count integer;
begin
  v_cap := public.get_e2b3_training_reconciliation_capabilities();
  if v_cap <> jsonb_build_object(
    'contract_version', 'e2b3-training-population-v1',
    'schema_version', 209,
    'reconciliation_available', true
  ) then
    raise exception 'CAPABILITY_CONTRACT_FAILURE: %', v_cap;
  end if;

  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_e2b3_training_reconciliation_capabilities',
      'reconcile_sop_training_population'
    )
    and p.prosecdef = true
    and array['search_path=public, pg_temp'] <@ p.proconfig;
  if v_count <> 2 then
    raise exception 'SECURITY_DEFINER_SEARCH_PATH_FAILURE: %', v_count;
  end if;

  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_e2b3_training_reconciliation_capabilities',
      'reconcile_sop_training_population'
    )
    and (
      has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute')
      or not has_function_privilege('service_role', p.oid, 'execute')
    );
  if v_count <> 0 then
    raise exception 'SERVICE_ROLE_ACL_FAILURE: %', v_count;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'reconcile_sop_training_population'
      and (
        pg_get_functiondef(p.oid) like '%quality_director%'
        or pg_get_functiondef(p.oid) like '%training_coordinator%'
      )
  ) then
    raise exception 'STALE_AUTHORITY_FAILURE';
  end if;

  raise notice 'STRUCTURAL CASES PASSED: capability, ACL, search_path, stale authority absence';
end;
$$;

do $$
declare
  v_org_a uuid := 'e3b30000-0000-4000-8000-000000000001';
  v_org_b uuid := 'e3b30000-0000-4000-8000-000000000002';
  v_dept_a uuid := 'e3b30000-0000-4000-8000-000000000011';
  v_dept_b uuid := 'e3b30000-0000-4000-8000-000000000012';
  v_dept_c uuid := 'e3b30000-0000-4000-8000-000000000013';

  v_gov uuid := 'e3b30000-0000-4000-8000-000000000101';
  v_owner uuid := 'e3b30000-0000-4000-8000-000000000102';
  v_exec uuid := 'e3b30000-0000-4000-8000-000000000103';
  v_aud uuid := 'e3b30000-0000-4000-8000-000000000104';
  v_mgr uuid := 'e3b30000-0000-4000-8000-000000000105';
  v_inactive_actor uuid := 'e3b30000-0000-4000-8000-000000000106';
  v_cross_actor uuid := 'e3b30000-0000-4000-8000-000000000107';
  v_new uuid := 'e3b30000-0000-4000-8000-000000000111';
  v_out_assigned uuid := 'e3b30000-0000-4000-8000-000000000112';
  v_out_progress uuid := 'e3b30000-0000-4000-8000-000000000113';
  v_out_overdue uuid := 'e3b30000-0000-4000-8000-000000000114';
  v_completed uuid := 'e3b30000-0000-4000-8000-000000000115';
  v_waived uuid := 'e3b30000-0000-4000-8000-000000000116';
  v_manual uuid := 'e3b30000-0000-4000-8000-000000000117';
  v_reentry uuid := 'e3b30000-0000-4000-8000-000000000118';
  v_inactive_target uuid := 'e3b30000-0000-4000-8000-000000000119';
  v_archived_target uuid := 'e3b30000-0000-4000-8000-000000000120';
  v_inactive_role uuid := 'e3b30000-0000-4000-8000-000000000121';
  v_cross_target uuid := 'e3b30000-0000-4000-8000-000000000122';
  v_comp_user uuid := 'e3b30000-0000-4000-8000-000000000123';
  v_ack_user uuid := 'e3b30000-0000-4000-8000-000000000124';

  v_doc uuid := 'e3b30000-0000-4000-8000-000000000201';
  v_ver uuid := 'e3b30000-0000-4000-8000-000000000211';
  v_prog uuid := 'e3b30000-0000-4000-8000-000000000221';
  v_doc_comp uuid := 'e3b30000-0000-4000-8000-000000000202';
  v_ver_comp uuid := 'e3b30000-0000-4000-8000-000000000212';
  v_prog_comp uuid := 'e3b30000-0000-4000-8000-000000000222';
  v_doc_ack uuid := 'e3b30000-0000-4000-8000-000000000203';
  v_ver_ack uuid := 'e3b30000-0000-4000-8000-000000000213';
  v_prog_ack uuid := 'e3b30000-0000-4000-8000-000000000223';
  v_historical_ack uuid := 'e3b30000-0000-4000-8000-000000000301';
  v_result jsonb;
  v_assignment_id uuid;
  v_ack_requirement_id uuid;
  v_original_due date;
  v_count integer;
  v_threw boolean;
begin
  insert into public.organizations (id, name_en, is_active)
  values
    (v_org_a, 'E2B3 Org A', true),
    (v_org_b, 'E2B3 Org B', true)
  on conflict (id) do update set is_active = true;

  insert into public.departments (id, organization_id, code, name_en, is_active)
  values
    (v_dept_a, v_org_a, 'E2B3-A', 'E2B3 Target A', true),
    (v_dept_b, v_org_a, 'E2B3-B', 'E2B3 Applicability B', true),
    (v_dept_c, v_org_b, 'E2B3-C', 'E2B3 Other Org', true)
  on conflict (id) do update set is_active = true;

  insert into auth.users (id, email, aud, role, email_confirmed_at, raw_app_meta_data)
  select id, email, 'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb
  from (values
    (v_gov, 'e2b3.gov@test.invalid'),
    (v_owner, 'e2b3.owner@test.invalid'),
    (v_exec, 'e2b3.exec@test.invalid'),
    (v_aud, 'e2b3.aud@test.invalid'),
    (v_mgr, 'e2b3.mgr@test.invalid'),
    (v_inactive_actor, 'e2b3.inactive.actor@test.invalid'),
    (v_cross_actor, 'e2b3.cross.actor@test.invalid'),
    (v_new, 'e2b3.new@test.invalid'),
    (v_out_assigned, 'e2b3.out.assigned@test.invalid'),
    (v_out_progress, 'e2b3.out.progress@test.invalid'),
    (v_out_overdue, 'e2b3.out.overdue@test.invalid'),
    (v_completed, 'e2b3.completed@test.invalid'),
    (v_waived, 'e2b3.waived@test.invalid'),
    (v_manual, 'e2b3.manual@test.invalid'),
    (v_reentry, 'e2b3.reentry@test.invalid'),
    (v_inactive_target, 'e2b3.inactive.target@test.invalid'),
    (v_archived_target, 'e2b3.archived.target@test.invalid'),
    (v_inactive_role, 'e2b3.inactive.role@test.invalid'),
    (v_cross_target, 'e2b3.cross.target@test.invalid'),
    (v_comp_user, 'e2b3.comp@test.invalid'),
    (v_ack_user, 'e2b3.ack@test.invalid')
  ) as fixture(id, email)
  on conflict (id) do nothing;

  insert into public.profiles (
    id, organization_id, department_id, full_name_en, email,
    employee_no, is_active, user_status
  )
  select id, organization_id, department_id, full_name, email,
    employee_no, is_active, user_status
  from (values
    (v_gov, v_org_a, v_dept_a, 'E2B3 Gov', 'e2b3.gov@test.invalid', 'E2B3-101', true, 'active'),
    (v_owner, v_org_a, v_dept_a, 'E2B3 Owner', 'e2b3.owner@test.invalid', 'E2B3-102', true, 'active'),
    (v_exec, v_org_a, v_dept_a, 'E2B3 Exec', 'e2b3.exec@test.invalid', 'E2B3-103', true, 'active'),
    (v_aud, v_org_a, v_dept_a, 'E2B3 Auditor', 'e2b3.aud@test.invalid', 'E2B3-104', true, 'active'),
    (v_mgr, v_org_a, v_dept_a, 'E2B3 Manager', 'e2b3.mgr@test.invalid', 'E2B3-105', true, 'active'),
    (v_inactive_actor, v_org_a, v_dept_a, 'E2B3 Inactive Actor', 'e2b3.inactive.actor@test.invalid', 'E2B3-106', true, 'active'),
    (v_cross_actor, v_org_b, v_dept_c, 'E2B3 Cross Actor', 'e2b3.cross.actor@test.invalid', 'E2B3-107', true, 'active'),
    (v_new, v_org_a, v_dept_a, 'E2B3 New', 'e2b3.new@test.invalid', 'E2B3-111', true, 'active'),
    (v_out_assigned, v_org_a, v_dept_b, 'E2B3 Out Assigned', 'e2b3.out.assigned@test.invalid', 'E2B3-112', true, 'active'),
    (v_out_progress, v_org_a, v_dept_b, 'E2B3 Out Progress', 'e2b3.out.progress@test.invalid', 'E2B3-113', true, 'active'),
    (v_out_overdue, v_org_a, v_dept_b, 'E2B3 Out Overdue', 'e2b3.out.overdue@test.invalid', 'E2B3-114', true, 'active'),
    (v_completed, v_org_a, v_dept_b, 'E2B3 Completed', 'e2b3.completed@test.invalid', 'E2B3-115', true, 'active'),
    (v_waived, v_org_a, v_dept_b, 'E2B3 Waived', 'e2b3.waived@test.invalid', 'E2B3-116', true, 'active'),
    (v_manual, v_org_a, v_dept_b, 'E2B3 Manual', 'e2b3.manual@test.invalid', 'E2B3-117', true, 'active'),
    (v_reentry, v_org_a, v_dept_b, 'E2B3 Reentry', 'e2b3.reentry@test.invalid', 'E2B3-118', true, 'active'),
    (v_inactive_target, v_org_a, v_dept_a, 'E2B3 Inactive Target', 'e2b3.inactive.target@test.invalid', 'E2B3-119', true, 'active'),
    (v_archived_target, v_org_a, v_dept_a, 'E2B3 Non-Active Lifecycle Target', 'e2b3.archived.target@test.invalid', 'E2B3-120', true, 'invited'),
    (v_inactive_role, v_org_a, v_dept_a, 'E2B3 Inactive Role', 'e2b3.inactive.role@test.invalid', 'E2B3-121', true, 'active'),
    (v_cross_target, v_org_b, v_dept_c, 'E2B3 Cross Target', 'e2b3.cross.target@test.invalid', 'E2B3-122', true, 'active'),
    (v_comp_user, v_org_a, v_dept_a, 'E2B3 Comp User', 'e2b3.comp@test.invalid', 'E2B3-123', true, 'active'),
    (v_ack_user, v_org_a, v_dept_a, 'E2B3 Ack User', 'e2b3.ack@test.invalid', 'E2B3-124', true, 'active')
  ) as fixture(id, organization_id, department_id, full_name, email, employee_no, is_active, user_status)
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    department_id = excluded.department_id,
    is_active = excluded.is_active,
    user_status = excluded.user_status;

  perform set_config('request.jwt.claim.sub', v_gov::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role', 'sub', v_gov)::text,
    true
  );

  update public.profiles
  set is_active = false,
      user_status = 'inactive',
      deactivated_at = now(),
      deactivated_by = v_gov,
      deactivation_reason = 'E2B3 isolated lifecycle proof'
  where id in (v_inactive_actor, v_inactive_target);

  insert into public.user_credential_states (
    user_id, organization_id, auth_email, identity_mode, credential_state,
    requested_lifecycle, credential_version, session_valid_after
  )
  select p.id, p.organization_id, p.email, 'legacy_verified', 'active', 'active', 1, to_timestamp(0)
  from public.profiles p
  where p.id in (
    v_gov, v_owner, v_exec, v_aud, v_mgr, v_inactive_actor, v_cross_actor,
    v_new, v_out_assigned, v_out_progress, v_out_overdue, v_completed,
    v_waived, v_manual, v_reentry, v_inactive_target, v_archived_target,
    v_inactive_role, v_cross_target, v_comp_user, v_ack_user
  )
  on conflict (user_id) do update set
    organization_id = excluded.organization_id,
    auth_email = excluded.auth_email,
    identity_mode = excluded.identity_mode,
    credential_state = excluded.credential_state,
    requested_lifecycle = excluded.requested_lifecycle,
    credential_version = excluded.credential_version,
    session_valid_after = excluded.session_valid_after;

  delete from public.user_roles where user_id in (
    v_gov, v_owner, v_exec, v_aud, v_mgr, v_inactive_actor, v_cross_actor,
    v_new, v_out_assigned, v_out_progress, v_out_overdue, v_completed,
    v_waived, v_manual, v_reentry, v_inactive_target, v_archived_target,
    v_inactive_role, v_cross_target, v_comp_user, v_ack_user
  );

  insert into public.user_roles (user_id, role, scope, organization_id, department_id, is_active)
  values
    (v_gov, 'governance_admin', 'global', v_org_a, null, true),
    (v_owner, 'viewer', 'assigned_only', v_org_a, null, true),
    (v_exec, 'executive', 'global', v_org_a, null, true),
    (v_aud, 'auditor', 'global', v_org_a, null, true),
    (v_mgr, 'department_manager', 'department', v_org_a, v_dept_a, true),
    (v_inactive_actor, 'governance_admin', 'global', v_org_a, null, false),
    (v_cross_actor, 'governance_admin', 'global', v_org_b, null, true),
    (v_new, 'employee', 'assigned_only', v_org_a, null, true),
    (v_out_assigned, 'employee', 'assigned_only', v_org_a, null, true),
    (v_out_progress, 'employee', 'assigned_only', v_org_a, null, true),
    (v_out_overdue, 'employee', 'assigned_only', v_org_a, null, true),
    (v_completed, 'employee', 'assigned_only', v_org_a, null, true),
    (v_waived, 'employee', 'assigned_only', v_org_a, null, true),
    (v_manual, 'employee', 'assigned_only', v_org_a, null, true),
    (v_reentry, 'employee', 'assigned_only', v_org_a, null, true),
    (v_inactive_target, 'employee', 'assigned_only', v_org_a, null, false),
    (v_archived_target, 'employee', 'assigned_only', v_org_a, null, true),
    (v_inactive_role, 'employee', 'assigned_only', v_org_a, null, false),
    (v_cross_target, 'employee', 'assigned_only', v_org_b, null, true),
    (v_comp_user, 'task_owner', 'assigned_only', v_org_a, null, true),
    (v_ack_user, 'project_owner', 'assigned_only', v_org_a, null, true);

  insert into public.controlled_documents (
    id, organization_id, document_code, document_title, document_type,
    document_status, department_id, document_owner_id
  ) values
    (v_doc, v_org_a, 'E2B3-SOP-01', 'E2B3 Lifecycle SOP', 'sop', 'approved', v_dept_a, v_owner),
    (v_doc_comp, v_org_a, 'E2B3-SOP-02', 'E2B3 Competency SOP', 'sop', 'approved', v_dept_a, v_owner),
    (v_doc_ack, v_org_a, 'E2B3-SOP-03', 'E2B3 Acknowledgment SOP', 'sop', 'approved', v_dept_a, v_owner)
  on conflict (id) do nothing;

  insert into public.document_versions (id, document_id, version_number, version_label, is_current_version)
  values
    (v_ver, v_doc, 1, 'v1.0', true),
    (v_ver_comp, v_doc_comp, 1, 'v1.0', true),
    (v_ver_ack, v_doc_ack, 1, 'v1.0', true)
  on conflict (id) do nothing;

  insert into public.governed_sop_details (
    version_id, title_en, process_name_en, governance_link_state,
    training_required, acknowledgment_required, competency_assessment_required,
    acknowledgment_sla_days
  ) values
    (v_ver, 'E2B3 Lifecycle SOP', 'Lifecycle', 'not_applicable', true, true, false, 14),
    (v_ver_comp, 'E2B3 Competency SOP', 'Competency', 'not_applicable', false, false, true, 14),
    (v_ver_ack, 'E2B3 Ack SOP', 'Acknowledgment', 'not_applicable', false, true, false, 14)
  on conflict (version_id) do update set
    training_required = excluded.training_required,
    acknowledgment_required = excluded.acknowledgment_required,
    competency_assessment_required = excluded.competency_assessment_required,
    acknowledgment_sla_days = excluded.acknowledgment_sla_days;

  -- Broad applicability plus narrow target overrides proves independent precedence.
  insert into public.document_version_department_scope (version_id, department_id)
  values (v_ver, v_dept_a), (v_ver, v_dept_b)
  on conflict do nothing;
  insert into public.document_version_role_scope (version_id, role_name)
  values (v_ver, 'employee'), (v_ver, 'auditor')
  on conflict do nothing;
  insert into public.sop_version_training_target_scopes (
    sop_version_id, scope_type, department_id, role_name, created_by
  ) values
    (v_ver, 'department', v_dept_a, null, v_gov),
    (v_ver, 'role', null, 'employee', v_gov),
    (v_ver_comp, 'role', null, 'task_owner', v_gov),
    (v_ver_ack, 'role', null, 'project_owner', v_gov)
  on conflict do nothing;

  insert into public.training_programs (
    id, title, training_type, linked_document_id, linked_sop_id,
    owner_user_id, department_id, active, created_by
  ) values
    (v_prog, 'E2B3 Lifecycle Program', 'sop_acknowledgment', v_doc, v_doc, v_owner, v_dept_a, true, v_gov),
    (v_prog_comp, 'E2B3 Competency Program', 'sop_acknowledgment', v_doc_comp, v_doc_comp, v_owner, v_dept_a, true, v_gov),
    (v_prog_ack, 'E2B3 Ack Program', 'sop_acknowledgment', v_doc_ack, v_doc_ack, v_owner, v_dept_a, true, v_gov)
  on conflict (id) do nothing;

  insert into public.training_assignments (
    program_id, document_version_id, assigned_to_user_id,
    assigned_to_department_id, due_date, status, obligation_cycle,
    cycle_type, assigned_by
  ) values
    (v_prog, v_ver, v_out_assigned, v_dept_b, current_date + 2, 'assigned', 1, 'initial', v_gov),
    (v_prog, v_ver, v_out_progress, v_dept_b, current_date + 2, 'in_progress', 1, 'initial', v_gov),
    (v_prog, v_ver, v_out_overdue, v_dept_b, current_date - 2, 'overdue', 1, 'initial', v_gov),
    (v_prog, v_ver, v_completed, v_dept_b, current_date - 5, 'completed', 1, 'initial', v_gov),
    (v_prog, v_ver, v_waived, v_dept_b, current_date - 5, 'waived', 1, 'initial', v_gov),
    (v_prog, v_ver, v_manual, v_dept_b, current_date + 2, 'cancelled', 1, 'initial', v_gov),
    (v_prog, v_ver, v_reentry, v_dept_b, current_date + 2, 'assigned', 1, 'initial', v_gov);

  select id into v_assignment_id
  from public.training_assignments
  where program_id = v_prog and assigned_to_user_id = v_manual;
  perform public.log_training_event(
    'training_assignments', v_assignment_id, 'cancelled',
    'Manual cancellation fixture', v_gov
  );

  insert into public.document_acknowledgment_requirements (
    document_id, version_id, requirement_scope, user_id, department_id,
    due_date, required_flag, created_by
  ) values (
    v_doc, v_ver, 'specific_users', v_reentry, v_dept_b,
    current_date + 2, true, v_gov
  ) returning id into v_ack_requirement_id;

  insert into public.document_acknowledgments (
    id, document_id, version_id, user_id, acknowledgment_method
  ) values (
    v_historical_ack, v_doc, v_ver, v_reentry, 'runtime_proof'
  );

  -- Service-role runtime guard.
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  v_threw := false;
  begin
    perform public.reconcile_sop_training_population(v_gov, v_ver);
  exception when others then
    v_threw := sqlerrm like '%SERVICE_ROLE_REQUIRED%';
  end;
  if not v_threw then raise exception 'CASE_01_SERVICE_ROLE_REQUIRED_FAILURE'; end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- Denied actor paths must fail before business mutation.
  foreach v_assignment_id in array array[v_exec, v_aud, v_mgr, v_inactive_actor, v_cross_actor] loop
    v_threw := false;
    begin
      perform public.reconcile_sop_training_population(v_assignment_id, v_ver);
    exception when others then
      v_threw := sqlerrm like '%INSUFFICIENT_AUTHORITY%'
        or sqlerrm like '%ACTOR_INACTIVE%'
        or sqlerrm like '%CROSS_ORGANIZATION_DENIED%';
    end;
    if not v_threw then
      raise exception 'AUTHORIZATION_DENIAL_FAILURE: %', v_assignment_id;
    end if;
  end loop;

  -- Initial lifecycle run: one target, three open exits plus reentry exit.
  v_result := public.reconcile_sop_training_population(v_gov, v_ver);
  if v_result->>'target_population_count' <> '1'
     or v_result->>'newly_assigned_count' <> '1'
     or v_result->>'reactivated_assignment_count' <> '0'
     or v_result->>'cancelled_out_of_scope_count' <> '4'
     or v_result->>'acknowledgment_requirements_created' <> '1'
     or v_result->>'acknowledgment_requirements_reactivated' <> '0'
     or v_result->>'acknowledgment_requirements_deactivated' <> '1' then
    raise exception 'INITIAL_COUNT_FAILURE: %', v_result;
  end if;

  select due_date into v_original_due
  from public.training_assignments
  where program_id = v_prog and assigned_to_user_id = v_new;
  if v_original_due <> current_date + 14 then
    raise exception 'FAIR_DUE_DATE_FAILURE: %', v_original_due;
  end if;

  if (select status from public.training_assignments where program_id = v_prog and assigned_to_user_id = v_out_assigned) <> 'cancelled'
     or (select status from public.training_assignments where program_id = v_prog and assigned_to_user_id = v_out_progress) <> 'cancelled'
     or (select status from public.training_assignments where program_id = v_prog and assigned_to_user_id = v_out_overdue) <> 'cancelled' then
    raise exception 'OPEN_CANCELLATION_FAILURE';
  end if;
  if (select status from public.training_assignments where program_id = v_prog and assigned_to_user_id = v_completed) <> 'completed'
     or (select status from public.training_assignments where program_id = v_prog and assigned_to_user_id = v_waived) <> 'waived'
     or (select status from public.training_assignments where program_id = v_prog and assigned_to_user_id = v_manual) <> 'cancelled' then
    raise exception 'HISTORICAL_STATE_PRESERVATION_FAILURE';
  end if;
  if (select required_flag from public.document_acknowledgment_requirements where id = v_ack_requirement_id) <> false then
    raise exception 'ACK_DEACTIVATION_FAILURE';
  end if;
  if not exists (select 1 from public.document_acknowledgments where id = v_historical_ack) then
    raise exception 'HISTORICAL_ACKNOWLEDGMENT_FAILURE';
  end if;
  if exists (
    select 1 from public.training_assignments
    where program_id = v_prog
      and assigned_to_user_id in (v_inactive_target, v_archived_target, v_inactive_role, v_cross_target)
  ) then
    raise exception 'TARGET_EXCLUSION_OR_CROSS_ORG_WRITE_FAILURE';
  end if;

  -- Re-entry restores only the system-cancelled record and the same ack row.
  update public.profiles set department_id = v_dept_a where id = v_reentry;
  v_result := public.reconcile_sop_training_population(v_gov, v_ver);
  if v_result->>'target_population_count' <> '2'
     or v_result->>'newly_assigned_count' <> '0'
     or v_result->>'reactivated_assignment_count' <> '1'
     or v_result->>'cancelled_out_of_scope_count' <> '0'
     or v_result->>'acknowledgment_requirements_reactivated' <> '1' then
    raise exception 'REENTRY_COUNT_FAILURE: %', v_result;
  end if;
  if (select status from public.training_assignments where program_id = v_prog and assigned_to_user_id = v_reentry) <> 'assigned'
     or (select due_date from public.training_assignments where program_id = v_prog and assigned_to_user_id = v_reentry) <> current_date + 14
     or (select required_flag from public.document_acknowledgment_requirements where id = v_ack_requirement_id) <> true
     or (select due_date from public.document_acknowledgment_requirements where id = v_ack_requirement_id) <> current_date + 14 then
    raise exception 'REENTRY_STATE_FAILURE';
  end if;

  -- Manual cancellation stays cancelled even after the employee re-enters.
  update public.profiles set department_id = v_dept_a where id = v_manual;
  v_result := public.reconcile_sop_training_population(v_gov, v_ver);
  if (select status from public.training_assignments where program_id = v_prog and assigned_to_user_id = v_manual) <> 'cancelled'
     or v_result->>'reactivated_assignment_count' <> '0' then
    raise exception 'MANUAL_CANCELLATION_REACTIVATION_FAILURE: %', v_result;
  end if;

  -- Exact idempotent second pass across every mutation counter.
  v_result := public.reconcile_sop_training_population(v_owner, v_ver);
  if v_result->>'newly_assigned_count' <> '0'
     or v_result->>'reactivated_assignment_count' <> '0'
     or v_result->>'cancelled_out_of_scope_count' <> '0'
     or v_result->>'acknowledgment_requirements_created' <> '0'
     or v_result->>'acknowledgment_requirements_reactivated' <> '0'
     or v_result->>'acknowledgment_requirements_deactivated' <> '0' then
    raise exception 'IDEMPOTENCY_FAILURE: %', v_result;
  end if;

  -- Competency-only creates one assignment and no acknowledgment requirement.
  v_result := public.reconcile_sop_training_population(v_gov, v_ver_comp);
  if v_result->>'target_population_count' <> '1'
     or v_result->>'newly_assigned_count' <> '1'
     or v_result->>'acknowledgment_requirements_created' <> '0' then
    raise exception 'COMPETENCY_ONLY_FAILURE: %', v_result;
  end if;

  -- Acknowledgment-only creates one requirement and no training assignment.
  v_result := public.reconcile_sop_training_population(v_gov, v_ver_ack);
  if v_result->>'target_population_count' <> '1'
     or v_result->>'newly_assigned_count' <> '0'
     or v_result->>'acknowledgment_requirements_created' <> '1' then
    raise exception 'ACKNOWLEDGMENT_ONLY_FAILURE: %', v_result;
  end if;

  select count(*) into v_count
  from public.training_events
  where event_type in (
    'population_reconciliation_assigned',
    'population_reconciliation_cancelled_assigned',
    'population_reconciliation_cancelled_in_progress',
    'population_reconciliation_cancelled_overdue',
    'population_reconciliation_reactivated',
    'population_acknowledgment_requirements_reconciled',
    'population_reconciliation_completed'
  );
  if v_count < 10 then
    raise exception 'AUDIT_EVENT_FAILURE: %', v_count;
  end if;

  raise notice 'ALL 31 E2B3 MIGRATION209 LIFECYCLE CASES DETERMINISTICALLY VERIFIED (PASSED).';
end;
$$;

rollback;
