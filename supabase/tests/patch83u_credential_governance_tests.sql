-- Patch 83U focused credential-governance database proof.
-- Run only after unapplied migrations 173 through 177 have been installed in an
-- explicitly authorized disposable verification database. The proof is
-- rollback-only, calls no Auth API, and contains no password or token material.

begin;

do $patch83u_catalog_proof$
declare
  v_definition text;
  v_table text;
  v_signature text;
  v_runtime_state text;
  v_rls boolean;
  v_force_rls boolean;
begin
  perform pg_catalog.set_config('request.jwt.claim.role', '', true);
  perform pg_catalog.set_config('request.jwt.claims', '{}'::jsonb::text, true);
  begin
    perform public.patch83u_require_service_role();
    raise exception 'TEST_FAILED_NULL_ROLE_SERVICE_GUARD_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_SERVICE_ROLE_REQUIRED%' then raise; end if;
  end;

  if public.patch83u_role_scope_allowed(
      'employee'::public.app_role, null::public.access_scope
    ) is distinct from false
    or public.patch83u_role_assignment_valid(
      gen_random_uuid(), null::public.access_scope,
      null, null, null, null
    ) is distinct from false
  then
    raise exception 'TEST_FAILED_NULL_ROLE_SCOPE_VALIDATOR_ALLOWED';
  end if;

  foreach v_signature in array array[
    'public.patch83u_get_capabilities(uuid,text,text)',
    'public.patch83u_transition_runtime(uuid,text,text,text,text,text,uuid,text,text)',
    'public.patch83u_prepare_required_password_change(uuid,text,integer,text)',
    'public.patch83u_begin_required_password_change(uuid,text,integer,text)',
    'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)',
    'public.patch83u_finalize_required_password_change(uuid,uuid,text,integer,text,boolean)',
    'public.patch83u_abort_required_password_change(uuid,uuid,text,boolean,boolean,text,text)',
    'public.patch83u_begin_admin_reset(uuid,uuid,text,text,text,text)',
    'public.patch83u_finalize_admin_reset(uuid,uuid,uuid,text,integer,text,boolean)',
    'public.patch83u_abort_admin_reset(uuid,uuid,uuid,text,boolean,boolean,text,text)',
    'public.patch83u_apply_user_lifecycle(uuid,uuid,text,text)',
    'public.patch83u_reconcile_credential_state(uuid,uuid,text,text)'
  ] loop
    if to_regprocedure(v_signature) is null then
      raise exception 'TEST_FAILED_REQUIRED_SIGNATURE_MISSING: %', v_signature;
    end if;
    if has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'TEST_FAILED_BROWSER_EXECUTE_PRESENT: %', v_signature;
    end if;
    if not has_function_privilege('service_role', v_signature, 'EXECUTE') then
      raise exception 'TEST_FAILED_SERVICE_EXECUTE_MISSING: %', v_signature;
    end if;
  end loop;

  if (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'patch83u_prepare_required_password_change',
        'patch83u_begin_required_password_change',
        'patch83u_finalize_required_password_change',
        'patch83u_abort_required_password_change'
      )
  ) <> 4 then
    raise exception 'TEST_FAILED_PASSWORD_CHANGE_OVERLOAD_AMBIGUITY';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'patch83u_finalize_password_change_after_revocation'
  ) <> 1 then
    raise exception 'TEST_FAILED_EXPLICIT_PASSWORD_FINALIZER_NAME_NOT_UNIQUE';
  end if;

  if pg_catalog.to_regprocedure(
    'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)'
  ) is null then
    raise exception 'TEST_FAILED_EXPLICIT_PASSWORD_FINALIZER_SIGNATURE_MISSING';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname =
        'patch83u_finalize_required_password_change_after_session_revoca'
  ) then
    raise exception 'TEST_FAILED_TRUNCATED_PASSWORD_FINALIZER_REMAINS_CALLABLE';
  end if;

  if (
    select not p.prosecdef
      or not (
        coalesce(p.proconfig, '{}'::text[])
        @> array['search_path=pg_catalog, public, pg_temp']::text[]
      )
      or exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
        ) acl
        where acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
      or pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or not pg_catalog.has_function_privilege(
        'service_role',
        p.oid,
        'EXECUTE'
      )
      or exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
        ) acl
        where acl.privilege_type = 'EXECUTE'
          and acl.grantee not in (
            p.proowner,
            (
              select r.oid
              from pg_catalog.pg_roles r
              where r.rolname = 'service_role'
            )
          )
      )
    from pg_catalog.pg_proc p
    where p.oid =
      'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)'::regprocedure
  ) then
    raise exception 'TEST_FAILED_EXPLICIT_PASSWORD_FINALIZER_SECURITY_CONTRACT';
  end if;

  foreach v_table in array array[
    'public.user_credential_states',
    'public.user_credential_events',
    'public.user_credential_suspended_roles',
    'public.patch83u_runtime_control',
    'public.patch83u_runtime_events',
    'public.patch83u_credential_operations'
  ] loop
    select c.relrowsecurity, c.relforcerowsecurity
    into v_rls, v_force_rls
    from pg_catalog.pg_class c
    where c.oid = v_table::regclass;
    if not coalesce(v_rls, false) or not coalesce(v_force_rls, false) then
      raise exception 'TEST_FAILED_PROTECTED_TABLE_RLS: %', v_table;
    end if;
    if has_table_privilege('service_role', v_table, 'INSERT')
      or has_table_privilege('service_role', v_table, 'UPDATE')
      or has_table_privilege('service_role', v_table, 'DELETE')
      or has_table_privilege('authenticated', v_table, 'SELECT')
      or has_table_privilege('authenticated', v_table, 'INSERT')
      or has_table_privilege('authenticated', v_table, 'UPDATE')
      or has_table_privilege('authenticated', v_table, 'DELETE')
    then
      raise exception 'TEST_FAILED_PROTECTED_TABLE_DIRECT_GRANT: %', v_table;
    end if;
  end loop;

  if not has_table_privilege(
    'service_role', 'public.user_credential_states', 'SELECT'
  ) then
    raise exception 'TEST_FAILED_SERVER_STATE_READ_GRANT_MISSING';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'patch83u_profile_credential_insert_gate'
      and upper(permissive) = 'RESTRICTIVE'
      and upper(cmd) = 'INSERT'
      and pg_catalog.btrim(with_check, '() ') = 'false'
  ) then
    raise exception 'TEST_FAILED_AUTHENTICATED_PROFILE_INSERT_NOT_DENIED';
  end if;

  select pg_get_functiondef(
    'public.patch83u_guard_profile_security_boundary()'::regprocedure
  ) into v_definition;
  if position('PATCH83U_PROFILE_INSERT_SERVICE_ROLE_REQUIRED' in v_definition) = 0
    or position('service_role' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_PROFILE_INSERT_SERVICE_ROLE_GUARD';
  end if;

  select enforcement_state into v_runtime_state
  from public.patch83u_runtime_control
  where singleton = true;
  if v_runtime_state is distinct from 'disabled' then
    raise exception 'TEST_FAILED_RUNTIME_NOT_DISABLED_BY_DEFAULT';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.patch83u_runtime_events'::regclass
      and t.tgname = 'trg_patch83u_runtime_events_append_only'
      and t.tgenabled <> 'D'
  ) then
    raise exception 'TEST_FAILED_RUNTIME_AUDIT_NOT_APPEND_ONLY';
  end if;

  select pg_get_functiondef(
    'public.patch83u_transition_runtime(uuid,text,text,text,text,text,uuid,text,text)'::regprocedure
  ) into v_definition;
  if position('PATCH83U_PREPARE_CREDENTIAL_GOVERNANCE' in v_definition) = 0
    or position('PATCH83U_ENFORCE_CREDENTIAL_GOVERNANCE' in v_definition) = 0
    or position('PATCH83U_DISABLE_CREDENTIAL_GOVERNANCE' in v_definition) = 0
    or position('PATCH83U_EMERGENCY_SUSPEND_CREDENTIAL_GOVERNANCE' in v_definition) = 0
    or position('patch83u_runtime_activation_blockers' in v_definition) = 0
    or position('patch83u_bootstrap_super_admin_eligible' in v_definition) = 0
    or position('patch83u_runtime_events' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_RUNTIME_TRANSITION_CONTRACT';
  end if;

  select pg_get_functiondef(
    'public.patch83u_runtime_activation_blockers(uuid)'::regprocedure
  ) into v_definition;
  if position('invalid_active_role_assignments' in v_definition) = 0
    or position('patch83u_role_scope_allowed' in v_definition) = 0
    or position('patch83u_role_assignment_valid' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_RUNTIME_ROLE_ACTIVATION_BLOCKER_CONTRACT';
  end if;

  select pg_get_functiondef(
    'public.patch83u_get_capabilities(uuid,text,text)'::regprocedure
  ) into v_definition;
  if position('patch83u-edge-auth-first-v1' in v_definition) = 0
    or position('installed_schema_version' in v_definition) = 0
    or position('runtime_enforcement_state' in v_definition) = 0
    or position('credential_state_action_available' in v_definition) = 0
    or position('password_change_action_available' in v_definition) = 0
    or position('provisioning_action_available' in v_definition) = 0
    or position('reset_action_available' in v_definition) = 0
    or position('compatibility_status' in v_definition) = 0
    or position('else ''compatible''' in v_definition) = 0
    or position('is not distinct from v_runtime.expected_edge_contract_version' in v_definition) = 0
    or position('is distinct from v_runtime.expected_edge_contract_version' in v_definition) = 0
    or position('is not distinct from v_runtime.expected_frontend_contract_version' in v_definition) = 0
    or position('is distinct from v_runtime.expected_frontend_contract_version' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_CAPABILITY_CONTRACT';
  end if;

  select pg_get_functiondef(
    'public.patch83u_prepare_required_password_change(uuid,text,integer,text)'::regprocedure
  ) into v_definition;
  if position('insert into' in lower(v_definition)) > 0
    or position('update public.' in lower(v_definition)) > 0
    or position('delete from' in lower(v_definition)) > 0
    or position('for update' in lower(v_definition)) > 0
    or position('safe_result' in v_definition) = 0
    or position('PASSWORD_CHANGE_REQUEST_ALREADY_ABORTED' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_PASSWORD_PREPARE_NOT_READ_ONLY';
  end if;

  select pg_get_functiondef(
    'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)'::regprocedure
  ) into v_definition;
  if position('insert into auth.' in lower(v_definition)) > 0
    or position('update auth.' in lower(v_definition)) > 0
    or position('delete from auth.' in lower(v_definition)) > 0
    or position('patch83u_require_service_role()' in v_definition) = 0
    or position('patch83u_require_enforced_runtime()' in v_definition) = 0
    or position('from public.patch83u_runtime_control rc' in v_definition) = 0
    or position('for share' in lower(v_definition)) = 0
    or position('from auth.users u' in lower(v_definition)) = 0
    or position('lock table auth.identities in share mode nowait' in lower(v_definition)) = 0
    or position('lock table auth.sessions in share mode' in lower(v_definition)) = 0
    or position('lock table auth.sessions in share mode' in lower(v_definition))
      >= position('lock table auth.identities in share mode nowait' in lower(v_definition))
    or position('lock table auth.identities in share mode nowait' in lower(v_definition))
      >= position('from auth.users u' in lower(v_definition))
    or position('for share nowait' in lower(v_definition)) = 0
    or position('from auth.sessions s' in v_definition) = 0
    or position('v_auth_session_count <> 0' in v_definition) = 0
    or position('patch83u_finalize_required_password_change(' in v_definition) = 0
    or position('p_verified_auth_email' in v_definition) = 0
    or position('true' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_ATOMIC_PASSWORD_FINALIZATION_CONTRACT';
  end if;

  select pg_get_functiondef(
    'public.patch83u_finalize_required_password_change(uuid,uuid,text,integer,text,boolean)'::regprocedure
  ) into v_definition;
  if position('operation_previous_state = ''initial_change_required''' in v_definition) = 0
    or position('v_matching_role_count <> 1' in v_definition) = 0
    or position('existing_role_rows_preserved' in v_definition) = 0
    or position('session_revocation_review_required' in v_definition) = 0
    or position('idempotent_replay' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_PASSWORD_FINALIZE_CONTRACT';
  end if;

  if has_function_privilege(
      'service_role',
      'public.patch83u_reconcile_credential_state_standard_impl(uuid,uuid,text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)',
      'EXECUTE'
    )
  then
    raise exception 'TEST_FAILED_RECOVERY_INTERNAL_FUNCTION_EXPOSED';
  end if;

  select pg_get_functiondef(
    'public.patch83u_reconcile_credential_state(uuid,uuid,text,text)'::regprocedure
  ) into v_definition;
  if position('patch83u_require_service_role()' in v_definition) = 0
    or position('emergency_suspended' in v_definition) = 0
    or position('for update' in lower(v_definition)) = 0
    or position('patch83u_reconcile_last_super_admin_recovery' in v_definition) = 0
    or position('patch83u_reconcile_credential_state_standard_impl' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_RECOVERY_ROUTER_CONTRACT';
  end if;

  select pg_get_functiondef(
    'public.patch83u_reconcile_credential_state_standard_impl(uuid,uuid,text,text)'::regprocedure
  ) into v_definition;
  if position('patch83u_require_super_admin(p_actor_id)' in v_definition) = 0
    or position('patch83u_reconcile_last_super_admin_recovery' in v_definition) > 0
  then
    raise exception 'TEST_FAILED_ORDINARY_RECONCILIATION_GUARD_CHANGED';
  end if;

  select pg_get_functiondef(
    'public.patch83u_require_super_admin(uuid)'::regprocedure
  ) into v_definition;
  if position('patch83u_runtime_credential_state_allowed' in v_definition) = 0
    or position('patch83u_reconcile_last_super_admin_recovery' in v_definition) > 0
  then
    raise exception 'TEST_FAILED_ORDINARY_SUPER_ADMIN_GUARD_CHANGED';
  end if;

  select pg_get_functiondef(
    'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)'::regprocedure
  ) into v_definition;
  if position('patch83u_require_service_role()' in v_definition) = 0
    or position('v_runtime.enforcement_state <> ''emergency_suspended''' in v_definition) = 0
    or position('p_actor_id is distinct from p_target_user_id' in v_definition) = 0
    or position('p_actor_id is distinct from v_runtime.designated_super_admin_id' in v_definition) = 0
    or position('v_state.identity_mode is distinct from ''legacy_verified''' in v_definition) = 0
    or position('v_target_super_admin_count <> 1' in v_definition) = 0
    or position('v_target_valid_super_admin_count <> 1' in v_definition) = 0
    or position('v_org_super_admin_count <> 1' in v_definition) = 0
    or position('v_org_valid_super_admin_count <> 1' in v_definition) = 0
    or position('u.email' in v_definition) = 0
    or position('v_auth_email is distinct from v_state.auth_email' in v_definition) = 0
    or position('patch83u_expected_auth_email' in v_definition) > 0
    or position('v_auth_version is distinct from v_state.credential_version' in v_definition) = 0
    or position('lock table auth.identities in share mode nowait' in lower(v_definition)) = 0
    or position('lock table auth.sessions in share mode' in lower(v_definition)) = 0
    or position('lock table auth.sessions in share mode' in lower(v_definition))
      >= position('lock table auth.identities in share mode nowait' in lower(v_definition))
    or position('lock table auth.identities in share mode nowait' in lower(v_definition))
      >= position('from auth.users u' in lower(v_definition))
    or position('for share nowait' in lower(v_definition)) = 0
    or position('v_auth_session_count <> 0' in v_definition) = 0
    or position('p_employee_id_confirmation is distinct from v_profile.employee_no' in v_definition) = 0
    or position('v_state.credential_version < 1' in v_definition) = 0
    or position('v_state.pending_operation_id is not null' in v_definition) = 0
    or position('v_state.pending_session_id is not null' in v_definition) = 0
    or position('v_state.pending_credential_version is not null' in v_definition) = 0
    or position('v_state.role_suspension_id is not null' in v_definition) = 0
    or position('v_state.operation_source is distinct from ''password_change''' in v_definition) = 0
    or position('v_state.operation_previous_session_valid_after > v_state.session_valid_after' in v_definition) = 0
    or position('v_operation.session_revocation_confirmed is distinct from false' in v_definition) = 0
    or position('v_operation.safe_result -> ''session_revocation_review_required''' in v_definition) = 0
    or position('v_operation.safe_result -> ''reconciliation_required''' in v_definition) = 0
    or position('PATCH83U_LAST_SUPER_ADMIN_RECOVERED' in v_definition) = 0
    or position('last_designated_super_admin_emergency_self_recovery' in v_definition) = 0
    or position('from public.patch83u_credential_operations op' in v_definition) = 0
    or position('from public.patch83u_runtime_events re' in v_definition) = 0
    or position('idempotent_replay' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_LAST_SUPER_ADMIN_RECOVERY_CONTRACT';
  end if;

  select pg_get_functiondef(
    'public.patch83u_abort_required_password_change(uuid,uuid,text,boolean,boolean,text,text)'::regprocedure
  ) into v_definition;
  if position('v_state.operation_previous_state' in v_definition) = 0
    or position('then ''session_revocation_review_required''' in v_definition) = 0
    or position('then ''recovery_required''' in v_definition) = 0
    or position('role_rows_preserved' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_PASSWORD_ABORT_MATRIX';
  end if;

  select pg_get_functiondef(
    'public.patch83u_abort_admin_reset(uuid,uuid,uuid,text,boolean,boolean,text,text)'::regprocedure
  ) into v_definition;
  if position('v_revocation_proven' in v_definition) = 0
    or position('not exists (' in v_definition) = 0
    or position('from auth.sessions s where s.user_id = p_target_user_id' in v_definition) = 0
    or position('v_effective_credential_version' in v_definition) = 0
    or position('credential_version = v_effective_credential_version' in v_definition) = 0
    or position('safe_result = v_result' in v_definition) = 0
    or position('role_rows_preserved' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_ADMIN_RESET_ABORT_MATRIX';
  end if;

  select pg_get_functiondef('public.patch83u_credential_access_allowed()'::regprocedure)
  into v_definition;
  if position('emergency_suspended' in v_definition) = 0
    or position('cs.invalidated_session_id' in v_definition) = 0
    or position('s.created_at >= cs.session_valid_after' in v_definition) = 0
    or position('patch83u_request_frontend_contract_compatible' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_RUNTIME_RLS_GATE_CONTRACT';
  end if;

  select pg_get_functiondef(
    'public.patch83t_apply_user_excel_import(uuid,jsonb)'::regprocedure
  ) into v_definition;
  if position('to_regprocedure(''public.patch83u_runtime_super_admin_eligible(uuid,uuid)'')' in v_definition) = 0
    or position('patch83t_lock_runtime' in v_definition) = 0
    or position('patch83t_lock_target_credential' in v_definition) = 0
    or position('patch83t_target_super' in v_definition) = 0
    or position('patch83t_target_candidate' in v_definition) = 0
    or position('patch83t_super_count' in v_definition) = 0
    or position('existing_password_rotation_pending' in v_definition) = 0
    or position('patch83u_runtime_super_admin_eligible' in v_definition) = 0
    or position('patch83u.controlled_role_restore' in v_definition) = 0
    or position('v_role_should_activate := v_status = ''active''' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_PATCH83T_RUNTIME_INTEGRATION_CONTRACT';
  end if;
  if position('v_role_should_activate := v_status = ''active'' and v_credential_state' in v_definition) > 0
    or position('PATCH83T_TARGET_CREDENTIAL_RECONCILIATION_REQUIRED' in v_definition) > 0
  then
    raise exception 'TEST_FAILED_PATCH83T_EXISTING_ROLE_CREDENTIAL_COUPLING';
  end if;
  if position('public.assign_user_role(' in v_definition) > 0
    or position('public.deactivate_user_role(' in v_definition) > 0
    or position('set_config(''request.jwt.claim.role''' in v_definition) > 0
    or position('insert into public.role_change_audit' in v_definition) = 0
    or position('v_actor_org, v_target_user, v_user_role_id, ''deactivated''' in v_definition) = 0
    or position('PATCH83T_ROLE_DEACTIVATION_PROOF_FAILED' in v_definition) = 0
    or position('PATCH83T_ROLE_ASSIGNMENT_PROOF_FAILED' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_PATCH83T_SERVICE_ROLE_ROLE_MUTATION_CONTRACT';
  end if;

  select pg_get_functiondef(
    'public.patch83u_apply_user_lifecycle(uuid,uuid,text,text)'::regprocedure
  ) into v_definition;
  if position('patch83u_require_service_role()' in v_definition) = 0
    or position('patch83u_require_service_role()' in v_definition)
      > position('p_action not in' in v_definition)
    or position('p_action is null or p_action not in' in v_definition) = 0
    or position('patch83u_require_role_admin(p_actor_id)' in v_definition) = 0
    or position('patch83u-super-admin-eligibility:' in v_definition) = 0
    or position('PATCH83U_LIFECYCLE_ADMIN_ORGANIZATION_CHANGED' in v_definition) = 0
    or position('PATCH83U_LIFECYCLE_OPEN_PROVISIONING_DENIED' in v_definition) = 0
    or position('q.profile_id = p_target_user_id' in v_definition) = 0
    or position('q.organization_id = v_org_id' in v_definition) = 0
    or position('q.provisioning_status not in (''completed'', ''cancelled'')' in v_definition) = 0
    or position('PATCH83U_PROFILE_LIFECYCLE_INCONSISTENT' in v_definition) = 0
    or position('PATCH83U_PRIVILEGED_LIFECYCLE_REQUIRES_SUPER_ADMIN' in v_definition) = 0
    or position('PATCH83U_SELF_LIFECYCLE_DEACTIVATION_DENIED' in v_definition) = 0
    or position('set_config(''request.jwt.claim.sub''' in v_definition) = 0
    or position('set_config(''request.jwt.claim.role''' in v_definition) > 0
    or position('insert into public.role_change_audit' in v_definition) = 0
    or position('insert into public.user_management_audit_history' in v_definition) = 0
    or position('PATCH83U_LIFECYCLE_CREDENTIAL_EVENT_PROOF_FAILED' in v_definition) = 0
    or position('PATCH83U_LIFECYCLE_ACTIVE_ROLE_PROOF_FAILED' in v_definition) = 0
    or position('PATCH83U_LIFECYCLE_ACTIVE_ROLE_DRIFT' in v_definition) = 0
    or position('''deactivated_role_count''' in v_definition) = 0
    or position('''remaining_active_role_count''' in v_definition) = 0
    or position('''credential_event_records''' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_USER_LIFECYCLE_CONTRACT';
  end if;
  if position('update public.user_account_provisioning' in lower(v_definition)) > 0
    or position('insert into public.user_account_provisioning' in lower(v_definition)) > 0
    or position('delete from public.user_account_provisioning' in lower(v_definition)) > 0
    or position('patch83u.controlled_lifecycle_transition' in v_definition) > 0
  then
    raise exception 'TEST_FAILED_USER_LIFECYCLE_PROTECTED_BOUNDARY';
  end if;

  select pg_get_functiondef(
    'public.patch83u_guard_role_activation()'::regprocedure
  ) into v_definition;
  if position('from public.profiles p' in v_definition) = 0
    or position('for share' in lower(v_definition)) = 0
    or position('PATCH83U_ACTIVE_ROLE_PROFILE_LIFECYCLE_INVALID' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_ROLE_ACTIVATION_LIFECYCLE_LOCK';
  end if;

  select pg_get_functiondef(
    'public.patch83u_sync_profile_credential_lifecycle()'::regprocedure
  ) into v_definition;
  if position('patch83u.controlled_lifecycle_transition' in v_definition) = 0
    or position('auth.role() is distinct from ''service_role''' in v_definition) = 0
    or position('PATCH83U_CONTROLLED_LIFECYCLE_TRANSITION_INVALID' in v_definition) = 0
    or position('requested_lifecycle = ''active''' in v_definition) = 0
    or position('PATCH83U_CONTROLLED_LIFECYCLE_STATE_PROOF_FAILED' in v_definition) = 0
    or position('return new;' in v_definition) = 0
  then
    raise exception 'TEST_FAILED_CONTROLLED_LIFECYCLE_CONTRACT';
  end if;
end;
$patch83u_catalog_proof$;

do $patch83u_execution_proof$
declare
  v_org uuid := '83c00000-0000-4000-8000-000000000001';
  v_department uuid := '83c00000-0000-4000-8000-000000000002';
  v_other_org uuid := '83c00000-0000-4000-8000-000000000003';
  v_other_department uuid := '83c00000-0000-4000-8000-000000000004';
  v_admin uuid := '83c00000-0000-4000-8000-000000000011';
  v_target uuid := '83c00000-0000-4000-8000-000000000012';
  v_admin_identity uuid := '83c00000-0000-4000-8000-000000000021';
  v_target_identity uuid := '83c00000-0000-4000-8000-000000000022';
  v_admin_role uuid := '83c00000-0000-4000-8000-000000000031';
  v_target_role uuid := '83c00000-0000-4000-8000-000000000032';
  v_session_one uuid := '83c00000-0000-4000-8000-000000000041';
  v_session_two uuid := '83c00000-0000-4000-8000-000000000042';
  v_session_three uuid := '83c00000-0000-4000-8000-000000000043';
  v_emergency_session uuid := '83c00000-0000-4000-8000-000000000044';
  v_session_four uuid := '83c00000-0000-4000-8000-000000000045';
  v_session_five uuid := '83c00000-0000-4000-8000-000000000046';
  v_missing_actor uuid := '83c00000-0000-4000-8000-000000000099';
  v_result jsonb;
  v_import_row jsonb;
  v_import_payload jsonb;
  v_operation uuid;
  v_role_before jsonb;
  v_profile_before jsonb;
  v_state_before jsonb;
  v_import_batch_id uuid;
  v_import_row_id uuid;
  v_open_provisioning_id uuid;
  v_credential_version_before integer;
  v_credential_events_before integer;
  v_audit_rows_before integer;
  v_role_audit_rows_before integer;
  v_session_valid_after_before timestamptz;
  v_baseline_invalid_roles bigint;
  v_baseline_invalid_lifecycle bigint;
begin
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  insert into public.organizations (id, name_en)
  values (v_org, 'Patch 83U execution proof');

  insert into public.departments (id, organization_id, name_en, code, is_active)
  values (v_department, v_org, 'Patch 83U Import Department', 'P83U', true);

  insert into auth.users (
    id, aud, role, email, email_confirmed_at, raw_app_meta_data,
    created_at, updated_at
  ) values
  (
    v_admin, 'authenticated', 'authenticated', 'patch83u.admin@example.test',
    now(), jsonb_build_object(
      'provider', 'email', 'providers', jsonb_build_array('email'),
      'credential_version', 0
    ), now(), now()
  ),
  (
    v_target, 'authenticated', 'authenticated', 'patch83u.target@example.test',
    now(), jsonb_build_object(
      'provider', 'email', 'providers', jsonb_build_array('email'),
      'credential_version', 0
    ), now(), now()
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values
  (
    v_admin_identity, v_admin, 'patch83u.admin@example.test',
    jsonb_build_object('sub', v_admin, 'email', 'patch83u.admin@example.test'),
    'email', now(), now(), now()
  ),
  (
    v_target_identity, v_target, 'patch83u.target@example.test',
    jsonb_build_object('sub', v_target, 'email', 'patch83u.target@example.test'),
    'email', now(), now(), now()
  );

  insert into public.profiles (
    id, organization_id, employee_no, full_name_en, email,
    job_title, is_active, user_status, user_type
  ) values
  (
    v_admin, v_org, 'ADMIN-83U', 'Patch 83U Admin',
    'patch83u.admin@example.test', 'Administrator', true, 'active', 'employee'
  ),
  (
    v_target, v_org, '00083', 'Patch 83U Existing User',
    'patch83u.target@example.test', 'Analyst', true, 'active', 'employee'
  );

  insert into public.user_credential_states (
    user_id, organization_id, auth_email, identity_mode, credential_state,
    requested_lifecycle, credential_version, session_valid_after
  ) values
  (
    v_admin, v_org, 'patch83u.admin@example.test', 'legacy_verified',
    'active', 'active', 0, to_timestamp(0)
  ),
  (
    v_target, v_org, 'patch83u.target@example.test', 'legacy_verified',
    'existing_password_rotation_pending', 'active', 0, to_timestamp(0)
  )
  on conflict (user_id) do update
  set organization_id = excluded.organization_id,
      auth_email = excluded.auth_email,
      identity_mode = excluded.identity_mode,
      credential_state = excluded.credential_state,
      requested_lifecycle = excluded.requested_lifecycle,
      credential_version = excluded.credential_version,
      session_valid_after = excluded.session_valid_after,
      invalidated_session_id = null,
      role_suspension_id = null,
      pending_operation_id = null,
      operation_source = null,
      reconciliation_auth_changed = false,
      pending_session_id = null,
      pending_credential_version = null,
      operation_previous_state = null,
      operation_previous_lifecycle = null,
      operation_previous_session_valid_after = null;

  insert into public.user_roles (
    id, user_id, role, scope, organization_id, is_active
  ) values
    (v_admin_role, v_admin, 'super_admin', 'global', v_org, true),
    (v_target_role, v_target, 'employee', 'assigned_only', v_org, true);

  begin
    perform public.patch83u_assign_user_role(
      v_admin, v_target, 'employee', null,
      null, null, null, 'Null scope must be rejected'
    );
    raise exception 'TEST_FAILED_NULL_ROLE_SCOPE_ASSIGNMENT_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_ROLE_SCOPE_NOT_ALLOWED%' then raise; end if;
  end;
  if (select count(*) from public.user_roles where user_id = v_target) <> 1 then
    raise exception 'TEST_FAILED_NULL_ROLE_SCOPE_ASSIGNMENT_WROTE_ROLE';
  end if;

  select state_version into v_credential_version_before
  from public.patch83u_runtime_control where singleton = true;
  select count(*)::integer into v_credential_events_before
  from public.patch83u_runtime_events;
  begin
    perform public.patch83u_transition_runtime(
      v_admin, null, 'null-runtime-state', 'Null target state must be rejected',
      null, null, v_admin,
      'patch83u-edge-auth-first-v1', 'patch83u-frontend-auth-first-v1'
    );
    raise exception 'TEST_FAILED_NULL_RUNTIME_TARGET_STATE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_RUNTIME_TARGET_STATE_INVALID%' then raise; end if;
  end;
  if (select state_version from public.patch83u_runtime_control where singleton = true)
      <> v_credential_version_before
    or (select count(*)::integer from public.patch83u_runtime_events)
      <> v_credential_events_before
  then
    raise exception 'TEST_FAILED_NULL_RUNTIME_TARGET_STATE_ZERO_WRITE_PROOF';
  end if;

  v_result := public.patch83u_runtime_activation_blockers(v_admin);
  v_baseline_invalid_roles := (v_result ->> 'invalid_active_role_assignments')::bigint;
  v_baseline_invalid_lifecycle := (v_result ->> 'invalid_profile_lifecycle_rows')::bigint;

  -- Simulate active drift that predates migration 174 by bypassing only the
  -- new-row trigger inside this rollback-only proof. The runtime transition
  -- must still reject a role/scope pair that is structurally shaped as global.
  execute 'alter table public.user_roles disable trigger trg_patch83u_guard_role_activation';
  update public.user_roles set scope = 'global' where id = v_target_role;
  execute 'alter table public.user_roles enable trigger trg_patch83u_guard_role_activation';
  v_result := public.patch83u_runtime_activation_blockers(v_admin);
  if (v_result ->> 'invalid_active_role_assignments')::bigint
      <> v_baseline_invalid_roles + 1
  then
    raise exception 'TEST_FAILED_RUNTIME_INVALID_ROLE_SCOPE_NOT_COUNTED';
  end if;
  begin
    perform public.patch83u_transition_runtime(
      v_admin, 'prepared', 'invalid-role-scope-preflight',
      'Rollback-only invalid role/scope blocker proof',
      'PATCH83U_PREPARE_CREDENTIAL_GOVERNANCE', repeat('a', 64), v_admin,
      'patch83u-edge-auth-first-v1', 'patch83u-frontend-auth-first-v1'
    );
    raise exception 'TEST_FAILED_RUNTIME_INVALID_ROLE_SCOPE_TRANSITION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_RUNTIME_ACTIVATION_BLOCKED%' then raise; end if;
  end;
  update public.user_roles
  set role = 'employee', scope = 'assigned_only', organization_id = v_org,
      division_id = null, department_id = null, unit_id = null
  where id = v_target_role;

  -- Wrong-organization and inactive hierarchy references must be counted even
  -- when the role/scope pair itself is canonical.
  insert into public.organizations (id, name_en)
  values (v_other_org, 'Patch 83U other organization proof');
  insert into public.departments (id, organization_id, name_en, code, is_active)
  values (v_other_department, v_other_org, 'Wrong organization', 'P83X', true);
  execute 'alter table public.user_roles disable trigger trg_patch83u_guard_role_activation';
  execute 'alter table public.user_roles disable trigger trg_patch83r_role_department_assignment';
  update public.user_roles
  set role = 'department_manager', scope = 'department',
      organization_id = v_org, department_id = v_other_department
  where id = v_target_role;
  execute 'alter table public.user_roles enable trigger trg_patch83r_role_department_assignment';
  execute 'alter table public.user_roles enable trigger trg_patch83u_guard_role_activation';
  v_result := public.patch83u_runtime_activation_blockers(v_admin);
  if (v_result ->> 'invalid_active_role_assignments')::bigint
      <> v_baseline_invalid_roles + 1
  then
    raise exception 'TEST_FAILED_RUNTIME_CROSS_ORG_ROLE_REFERENCE_NOT_COUNTED';
  end if;
  update public.user_roles
  set role = 'employee', scope = 'assigned_only', organization_id = v_org,
      division_id = null, department_id = null, unit_id = null
  where id = v_target_role;

  update public.departments set is_active = false where id = v_department;
  execute 'alter table public.user_roles disable trigger trg_patch83u_guard_role_activation';
  execute 'alter table public.user_roles disable trigger trg_patch83r_role_department_assignment';
  update public.user_roles
  set role = 'department_manager', scope = 'department',
      organization_id = v_org, department_id = v_department
  where id = v_target_role;
  execute 'alter table public.user_roles enable trigger trg_patch83r_role_department_assignment';
  execute 'alter table public.user_roles enable trigger trg_patch83u_guard_role_activation';
  v_result := public.patch83u_runtime_activation_blockers(v_admin);
  if (v_result ->> 'invalid_active_role_assignments')::bigint
      <> v_baseline_invalid_roles + 1
  then
    raise exception 'TEST_FAILED_RUNTIME_INACTIVE_ROLE_REFERENCE_NOT_COUNTED';
  end if;
  update public.departments set is_active = true where id = v_department;
  update public.user_roles
  set role = 'employee', scope = 'assigned_only', organization_id = v_org,
      division_id = null, department_id = null, unit_id = null
  where id = v_target_role;

  -- Existing lifecycle drift is reported and blocks activation; migration 174
  -- does not invent a historical actor or silently rewrite that evidence.
  execute 'alter table public.profiles disable trigger trg_patch19_sync_profile_status';
  execute 'alter table public.profiles disable trigger trg_patch83u_guard_profile_security_boundary';
  update public.profiles
  set deactivated_at = clock_timestamp(),
      deactivated_by = v_admin,
      deactivation_reason = 'Simulated stale active-profile metadata'
  where id = v_target;
  execute 'alter table public.profiles enable trigger trg_patch19_sync_profile_status';
  execute 'alter table public.profiles enable trigger trg_patch83u_guard_profile_security_boundary';
  v_result := public.patch83u_runtime_activation_blockers(v_admin);
  if (v_result ->> 'invalid_profile_lifecycle_rows')::bigint
      <> v_baseline_invalid_lifecycle + 1
  then
    raise exception 'TEST_FAILED_RUNTIME_INVALID_PROFILE_LIFECYCLE_NOT_COUNTED';
  end if;
  update public.profiles
  set deactivated_at = null,
      deactivated_by = null,
      deactivation_reason = null
  where id = v_target;

  -- A verified legacy profile backfilled by migration 174 is rotation-pending.
  -- Patch 83T must retain its canonical active role under disabled, prepared,
  -- and enforced runtime states; enforced access is made ineffective by the
  -- credential/RLS boundary, never by rewriting this existing role row.
  v_import_row := jsonb_build_object(
    'row_number', 2,
    'validation_status', 'valid',
    'employee_id', '00083',
    'contact_email', '',
    'phone', '',
    'department_code', 'P83U',
    'account_action', 'update',
    'expected_matched_user_id', v_target::text,
    'expected_planned_action', 'update_existing_profile',
    'expected_active_role_ids', jsonb_build_array(v_target_role::text),
    'full_name_en', 'Patch 83U Existing User',
    'full_name_ar', 'مستخدم باتش 83 يو',
    'job_title', 'Analyst',
    'role', 'employee',
    'role_scope', 'assigned_only',
    'status', 'active',
    'user_type', 'employee'
  );
  v_import_payload := jsonb_build_object(
    'execution_confirmation', 'EXECUTE USER IMPORT',
    'source_format', 'xlsx',
    'file_name', 'patch83u-runtime-integration-proof.xlsx',
    'rows', jsonb_build_array(v_import_row)
  );

  update public.user_credential_states
  set credential_state = 'existing_password_rotation_pending'
  where user_id = v_admin;
  if public.patch83u_runtime_super_admin_eligible(v_admin, v_org) is distinct from true then
    raise exception 'TEST_FAILED_PATCH83T_DISABLED_BOOTSTRAP_SUPER_ADMIN';
  end if;
  v_result := public.patch83t_apply_user_excel_import(v_admin, v_import_payload);
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  if (select credential_state from public.user_credential_states where user_id = v_target)
      <> 'existing_password_rotation_pending'
    or (select is_active from public.user_roles where id = v_target_role) is distinct from true
  then
    raise exception 'TEST_FAILED_PATCH83T_DISABLED_ROTATION_PENDING_ROLE';
  end if;

  update public.patch83u_runtime_control
  set enforcement_state = 'prepared',
      prepared_at = clock_timestamp(),
      prepared_by = v_admin,
      preflight_hash = repeat('a', 64),
      designated_super_admin_id = v_admin,
      state_version = state_version + 1
  where singleton = true;
  v_result := public.patch83u_get_capabilities(
    v_admin, null, 'patch83u-frontend-auth-first-v1'
  );
  if v_result ->> 'compatibility_status' <> 'edge_contract_mismatch'
    or (v_result ->> 'password_change_action_available')::boolean is distinct from false
    or (select compatibility_attested_at from public.patch83u_runtime_control where singleton = true)
      is not null
  then
    raise exception 'TEST_FAILED_NULL_CAPABILITY_CONTRACT_FAIL_CLOSED';
  end if;
  if public.patch83u_runtime_super_admin_eligible(v_admin, v_org) is distinct from true then
    raise exception 'TEST_FAILED_PATCH83T_PREPARED_BOOTSTRAP_SUPER_ADMIN';
  end if;
  v_result := public.patch83t_apply_user_excel_import(v_admin, v_import_payload);
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  if (select credential_state from public.user_credential_states where user_id = v_target)
      <> 'existing_password_rotation_pending'
    or (select is_active from public.user_roles where id = v_target_role) is distinct from true
  then
    raise exception 'TEST_FAILED_PATCH83T_PREPARED_ROTATION_PENDING_ROLE';
  end if;

  update public.patch83u_runtime_control
  set enforcement_state = 'emergency_suspended',
      deactivated_at = clock_timestamp(),
      deactivated_by = v_admin,
      last_transition_reason = 'Disposable Patch 83T emergency proof',
      state_version = state_version + 1
  where singleton = true;
  if public.patch83u_runtime_super_admin_eligible(v_admin, v_org) is distinct from true then
    raise exception 'TEST_FAILED_PATCH83T_EMERGENCY_BREAK_GLASS_SUPER_ADMIN';
  end if;
  v_result := public.patch83t_apply_user_excel_import(v_admin, v_import_payload);
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  if (select credential_state from public.user_credential_states where user_id = v_target)
      <> 'existing_password_rotation_pending'
    or (select is_active from public.user_roles where id = v_target_role) is distinct from true
  then
    raise exception 'TEST_FAILED_PATCH83T_EMERGENCY_ROTATION_PENDING_ROLE';
  end if;

  update public.user_credential_states
  set credential_state = 'active'
  where user_id = v_admin;

  update public.patch83u_runtime_control
  set enforcement_state = 'enforced',
      activated_at = clock_timestamp(),
      activated_by = v_admin,
      activation_reason = 'Disposable rollback-only execution proof',
      preflight_hash = repeat('a', 64),
      designated_super_admin_id = v_admin,
      compatible_edge_contract_version = 'patch83u-edge-auth-first-v1',
      compatible_frontend_contract_version = 'patch83u-frontend-auth-first-v1',
      compatibility_attested_at = clock_timestamp(),
      compatibility_attested_by = v_admin,
      state_version = state_version + 1
  where singleton = true;

  if public.patch83u_runtime_credential_state_allowed(null, null)
      is distinct from false
  then
    raise exception 'TEST_FAILED_NULL_RUNTIME_CREDENTIAL_STATE_ALLOWED';
  end if;

  v_result := public.patch83t_apply_user_excel_import(v_admin, v_import_payload);
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  if (select credential_state from public.user_credential_states where user_id = v_target)
      <> 'existing_password_rotation_pending'
    or (select is_active from public.user_roles where id = v_target_role) is distinct from true
    or (select count(*) from public.user_roles where user_id = v_target and is_active) <> 1
  then
    raise exception 'TEST_FAILED_PATCH83T_ENFORCED_ROTATION_PENDING_ROLE';
  end if;
  update public.user_credential_states
  set credential_state = 'existing_password_rotation_pending'
  where user_id = v_admin;
  if public.patch83u_runtime_super_admin_eligible(v_admin, v_org) then
    raise exception 'TEST_FAILED_PATCH83T_ENFORCED_NONCANONICAL_SUPER_ADMIN';
  end if;
  update public.user_credential_states
  set credential_state = 'active'
  where user_id = v_admin;

  select to_jsonb(p) into v_profile_before
  from public.profiles p where p.id = v_target;
  select to_jsonb(cs) into v_state_before
  from public.user_credential_states cs where cs.user_id = v_target;
  select to_jsonb(ur) into v_role_before
  from public.user_roles ur where ur.id = v_target_role;
  begin
    perform public.patch83u_apply_user_lifecycle(
      v_admin, v_target, null, 'Null action must be rejected'
    );
    raise exception 'TEST_FAILED_NULL_LIFECYCLE_ACTION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LIFECYCLE_ACTION_NOT_ALLOWED%' then
      raise;
    end if;
  end;
  if (select to_jsonb(p) from public.profiles p where p.id = v_target)
      is distinct from v_profile_before
    or (select to_jsonb(cs) from public.user_credential_states cs where cs.user_id = v_target)
      is distinct from v_state_before
    or (select to_jsonb(ur) from public.user_roles ur where ur.id = v_target_role)
      is distinct from v_role_before
  then
    raise exception 'TEST_FAILED_NULL_LIFECYCLE_ACTION_ZERO_WRITE_PROOF';
  end if;

  -- The controlled activation used by first-password finalization must not
  -- rewrite the already-proven terminal credential state into a second forced
  -- password change. This subtransaction is deliberately rolled back after
  -- proving the exact profile/state/event boundary.
  begin
    update public.profiles
    set user_status = 'invited', is_active = true
    where id = v_target;
    update public.user_credential_states
    set credential_state = 'active',
        requested_lifecycle = 'invited',
        session_valid_after = clock_timestamp() - interval '1 day'
    where user_id = v_target;

    select cs.credential_version, cs.session_valid_after
    into v_credential_version_before, v_session_valid_after_before
    from public.user_credential_states cs
    where cs.user_id = v_target;
    select count(*)::integer into v_credential_events_before
    from public.user_credential_events e
    where e.user_id = v_target
      and e.event_code = 'PATCH83U_PROFILE_REACTIVATED';

    perform pg_catalog.set_config(
      'patch83u.controlled_lifecycle_transition', 'on', true
    );
    update public.profiles
    set user_status = 'active', is_active = true
    where id = v_target;
    perform pg_catalog.set_config(
      'patch83u.controlled_lifecycle_transition', 'off', true
    );

    if not exists (
      select 1 from public.profiles p
      where p.id = v_target
        and p.user_status = 'active'
        and p.is_active = true
    ) or not exists (
      select 1 from public.user_credential_states cs
      where cs.user_id = v_target
        and cs.organization_id = v_org
        and cs.credential_state = 'active'
        and cs.requested_lifecycle = 'active'
        and cs.credential_version = v_credential_version_before
        and cs.session_valid_after = v_session_valid_after_before
    ) or (
      select count(*)::integer
      from public.user_credential_events e
      where e.user_id = v_target
        and e.event_code = 'PATCH83U_PROFILE_REACTIVATED'
    ) <> v_credential_events_before then
      raise exception 'TEST_FAILED_CONTROLLED_LIFECYCLE_STATE_PRESERVATION';
    end if;

    raise exception 'PATCH83U_TEST_CONTROLLED_LIFECYCLE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PATCH83U_TEST_CONTROLLED_LIFECYCLE_ROLLBACK' then
      raise;
    end if;
  end;

  -- A blocked profile with a historical active role is an inconsistent state
  -- that requires explicit reconciliation. Reactivation must fail before any
  -- profile, credential, role, event, or audit write can make that assignment
  -- effective again.
  begin
    update public.profiles
    set user_status = 'inactive',
        is_active = false,
        deactivated_at = clock_timestamp(),
        deactivated_by = v_admin,
        deactivation_reason = 'Rollback-only active-role drift fixture'
    where id = v_target;

    if not exists (
      select 1 from public.user_roles ur
      where ur.id = v_target_role
        and ur.user_id = v_target
        and ur.is_active = true
    ) then
      raise exception 'TEST_FAILED_LIFECYCLE_ACTIVE_ROLE_DRIFT_FIXTURE';
    end if;

    select to_jsonb(p) into v_profile_before
    from public.profiles p where p.id = v_target;
    select to_jsonb(cs) into v_state_before
    from public.user_credential_states cs where cs.user_id = v_target;
    select to_jsonb(ur) into v_role_before
    from public.user_roles ur where ur.id = v_target_role;
    select count(*)::integer into v_credential_events_before
    from public.user_credential_events e where e.user_id = v_target;
    select count(*)::integer into v_audit_rows_before
    from public.user_management_audit_history a where a.target_user_id = v_target;
    select count(*)::integer into v_role_audit_rows_before
    from public.role_change_audit a where a.target_user_id = v_target;

    begin
      perform public.patch83u_apply_user_lifecycle(
        v_admin, v_target, 'patch19_reactivate_user',
        'Active-role drift must be reconciled explicitly'
      );
      raise exception 'TEST_FAILED_LIFECYCLE_ACTIVE_ROLE_DRIFT_ALLOWED';
    exception when others then
      if sqlerrm <> 'PATCH83U_LIFECYCLE_ACTIVE_ROLE_DRIFT' then
        raise;
      end if;
    end;

    if (select to_jsonb(p) from public.profiles p where p.id = v_target)
        is distinct from v_profile_before
      or (select to_jsonb(cs) from public.user_credential_states cs where cs.user_id = v_target)
        is distinct from v_state_before
      or (select to_jsonb(ur) from public.user_roles ur where ur.id = v_target_role)
        is distinct from v_role_before
      or (select count(*)::integer from public.user_credential_events e where e.user_id = v_target)
        <> v_credential_events_before
      or (select count(*)::integer from public.user_management_audit_history a where a.target_user_id = v_target)
        <> v_audit_rows_before
      or (select count(*)::integer from public.role_change_audit a where a.target_user_id = v_target)
        <> v_role_audit_rows_before
    then
      raise exception 'TEST_FAILED_LIFECYCLE_ACTIVE_ROLE_DRIFT_ZERO_WRITE_PROOF';
    end if;

    raise exception 'PATCH83U_TEST_ACTIVE_ROLE_DRIFT_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PATCH83U_TEST_ACTIVE_ROLE_DRIFT_ROLLBACK' then
      raise;
    end if;
  end;

  -- Canonical administrative lifecycle execution must prove the profile,
  -- credential, role, credential-event, role-audit, and management-audit
  -- writes. Reactivation deliberately restores no role.
  begin
    v_result := public.patch83u_apply_user_lifecycle(
      v_admin, v_target, 'patch19_deactivate_user',
      'Rollback-only lifecycle deactivation proof'
    );
    if auth.role() is distinct from 'service_role'
      or (v_result ->> 'updated')::boolean is distinct from true
      or (v_result ->> 'user_id')::uuid is distinct from v_target
      or (v_result ->> 'organization_id')::uuid is distinct from v_org
      or v_result ->> 'action' <> 'patch19_deactivate_user'
      or v_result ->> 'audit_action' <> 'deactivated'
      or v_result ->> 'user_status' <> 'inactive'
      or (v_result ->> 'is_active')::boolean is distinct from false
      or v_result ->> 'credential_state' <> 'disabled'
      or v_result ->> 'requested_lifecycle' <> 'inactive'
      or (v_result ->> 'deactivated_role_count')::integer <> 1
      or (v_result ->> 'role_audit_record_count')::integer <> 1
      or (v_result ->> 'remaining_active_role_count')::integer <> 0
      or (v_result ->> 'reactivated_role_count')::integer <> 0
      or (v_result ->> 'audit_record_count')::integer <> 1
      or (v_result ->> 'credential_event_records')::integer <> 1
      or nullif(v_result ->> 'audit_id', '') is null
    then
      raise exception 'TEST_FAILED_LIFECYCLE_DEACTIVATION_RESULT';
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = v_target
        and p.user_status = 'inactive'
        and p.is_active = false
        and p.deactivated_at is not null
        and p.deactivated_by = v_admin
        and p.deactivation_reason = 'Rollback-only lifecycle deactivation proof'
    ) or exists (
      select 1 from public.user_roles ur
      where ur.user_id = v_target and ur.is_active
    ) or not exists (
      select 1 from public.role_change_audit a
      where a.target_user_id = v_target
        and a.changed_by = v_admin
        and a.action = 'deactivated'
        and a.reason = 'Rollback-only lifecycle deactivation proof'
    ) or not exists (
      select 1 from public.user_management_audit_history a
      where a.target_user_id = v_target
        and a.actor_id = v_admin
        and a.action = 'deactivated'
        and a.reason = 'Rollback-only lifecycle deactivation proof'
    ) then
      raise exception 'TEST_FAILED_LIFECYCLE_DEACTIVATION_DATABASE_PROOF';
    end if;

    v_result := public.patch83u_apply_user_lifecycle(
      v_admin, v_target, 'patch19_reactivate_user',
      'Rollback-only lifecycle reactivation proof'
    );
    if v_result ->> 'action' <> 'patch19_reactivate_user'
      or v_result ->> 'audit_action' <> 'reactivated'
      or v_result ->> 'user_status' <> 'active'
      or (v_result ->> 'is_active')::boolean is distinct from true
      or v_result ->> 'credential_state' <> 'reactivation_change_required'
      or v_result ->> 'requested_lifecycle' <> 'active'
      or (v_result ->> 'deactivated_role_count')::integer <> 0
      or (v_result ->> 'role_audit_record_count')::integer <> 0
      or (v_result ->> 'remaining_active_role_count')::integer <> 0
      or (v_result ->> 'reactivated_role_count')::integer <> 0
      or (v_result ->> 'audit_record_count')::integer <> 1
      or (v_result ->> 'credential_event_records')::integer <> 1
    then
      raise exception 'TEST_FAILED_LIFECYCLE_REACTIVATION_RESULT';
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = v_target
        and p.user_status = 'active'
        and p.is_active = true
        and p.deactivated_at is null
        and p.deactivated_by is null
        and p.deactivation_reason is null
    ) or exists (
      select 1 from public.user_roles ur
      where ur.user_id = v_target and ur.is_active
    ) or not exists (
      select 1 from public.user_management_audit_history a
      where a.target_user_id = v_target
        and a.actor_id = v_admin
        and a.action = 'reactivated'
        and a.reason = 'Rollback-only lifecycle reactivation proof'
    ) then
      raise exception 'TEST_FAILED_LIFECYCLE_REACTIVATION_DATABASE_PROOF';
    end if;

    raise exception 'PATCH83U_TEST_USER_LIFECYCLE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PATCH83U_TEST_USER_LIFECYCLE_ROLLBACK' then
      raise;
    end if;
  end;

  -- An open provisioning row owns the lifecycle. The administrative RPC must
  -- reject it without mutating the protected row or any profile, credential,
  -- role, credential-event, or audit record.
  begin
    select r.batch_id, r.id
    into v_import_batch_id, v_import_row_id
    from public.user_management_import_rows r
    where r.matched_user_id = v_target
      and r.action_status = 'updated_existing_user'
    order by r.created_at desc, r.id
    limit 1;
    if v_import_batch_id is null or v_import_row_id is null then
      raise exception 'TEST_FAILED_LIFECYCLE_PROVISIONING_FIXTURE_MISSING';
    end if;

    insert into public.user_account_provisioning (
      organization_id, import_batch_id, import_row_id, auth_user_id,
      employee_id, auth_email, full_name_en, department_id, department_code,
      job_title, requested_role, requested_scope, requested_user_type,
      requested_lifecycle, account_action, provisioning_status, profile_id,
      created_by
    ) values (
      v_org, v_import_batch_id, v_import_row_id, v_target,
      '00083', '00083@almodawat.sa', 'Patch 83U Existing User',
      v_department, 'P83U', 'Analyst', 'employee', 'assigned_only', 'employee',
      'active', 'create_or_update', 'initial_change_required', v_target,
      v_admin
    ) returning id into v_open_provisioning_id;

    select to_jsonb(p) into v_profile_before
    from public.profiles p where p.id = v_target;
    select to_jsonb(cs) into v_state_before
    from public.user_credential_states cs where cs.user_id = v_target;
    select to_jsonb(ur) into v_role_before
    from public.user_roles ur where ur.id = v_target_role;
    select count(*)::integer into v_credential_events_before
    from public.user_credential_events e where e.user_id = v_target;
    select count(*)::integer into v_audit_rows_before
    from public.user_management_audit_history a where a.target_user_id = v_target;
    select count(*)::integer into v_role_audit_rows_before
    from public.role_change_audit a where a.target_user_id = v_target;

    begin
      perform public.patch83u_apply_user_lifecycle(
        v_admin, v_target, 'patch19_deactivate_user',
        'Open provisioning must deny this lifecycle request'
      );
      raise exception 'TEST_FAILED_LIFECYCLE_OPEN_PROVISIONING_ALLOWED';
    exception when others then
      if sqlerrm not like '%PATCH83U_LIFECYCLE_OPEN_PROVISIONING_DENIED%' then
        raise;
      end if;
    end;

    if (select to_jsonb(p) from public.profiles p where p.id = v_target)
        is distinct from v_profile_before
      or (select to_jsonb(cs) from public.user_credential_states cs where cs.user_id = v_target)
        is distinct from v_state_before
      or (select to_jsonb(ur) from public.user_roles ur where ur.id = v_target_role)
        is distinct from v_role_before
      or (select count(*)::integer from public.user_credential_events e where e.user_id = v_target)
        <> v_credential_events_before
      or (select count(*)::integer from public.user_management_audit_history a where a.target_user_id = v_target)
        <> v_audit_rows_before
      or (select count(*)::integer from public.role_change_audit a where a.target_user_id = v_target)
        <> v_role_audit_rows_before
      or not exists (
        select 1 from public.user_account_provisioning q
        where q.id = v_open_provisioning_id
          and q.profile_id = v_target
          and q.provisioning_status = 'initial_change_required'
      )
    then
      raise exception 'TEST_FAILED_LIFECYCLE_OPEN_PROVISIONING_ZERO_WRITE_PROOF';
    end if;

    raise exception 'PATCH83U_TEST_OPEN_PROVISIONING_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PATCH83U_TEST_OPEN_PROVISIONING_ROLLBACK' then
      raise;
    end if;
  end;

  -- Runtime-aware last-SA protection uses bootstrap eligibility in disabled
  -- mode. Keep the actor structurally authorized as Super Admin while a
  -- temporary Auth/database version mismatch makes it bootstrap-ineligible.
  -- The verified legacy, rotation-pending target is then the organization's
  -- last eligible Super Admin and Patch 83T must reject its removal before any
  -- import write survives.
  update public.patch83u_runtime_control
  set enforcement_state = 'disabled',
      deactivated_at = clock_timestamp(),
      deactivated_by = v_admin,
      last_transition_reason = 'Disposable Patch 83T last-SA proof',
      state_version = state_version + 1
  where singleton = true;
  update public.user_roles
  set role = 'super_admin', scope = 'global', department_id = null
  where id = v_target_role;
  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb),
    '{credential_version}',
    '999'::jsonb,
    true
  )
  where id = v_admin;

  begin
    perform public.patch83t_apply_user_excel_import(v_admin, v_import_payload);
    raise exception 'TEST_FAILED_PATCH83T_LAST_SUPER_ADMIN_REMOVAL_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_LAST_SUPER_ADMIN_DEACTIVATION_DENIED%' then
      raise;
    end if;
  end;
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  if not exists (
    select 1 from public.user_roles
    where id = v_target_role and role = 'super_admin' and is_active
  ) then
    raise exception 'TEST_FAILED_PATCH83T_LAST_SUPER_ADMIN_ROLE_CHANGED';
  end if;

  update auth.users u
  set raw_app_meta_data = jsonb_set(
    coalesce(u.raw_app_meta_data, '{}'::jsonb),
    '{credential_version}',
    to_jsonb(cs.credential_version),
    true
  )
  from public.user_credential_states cs
  where u.id = v_admin
    and cs.user_id = v_admin;
  update public.user_roles
  set role = 'employee', scope = 'assigned_only', department_id = null
  where id = v_target_role;
  update public.patch83u_runtime_control
  set enforcement_state = 'enforced',
      state_version = state_version + 1
  where singleton = true;
  update public.user_credential_states
  set credential_state = 'existing_password_change_required'
  where user_id = v_target;

  select to_jsonb(ur) into v_role_before
  from public.user_roles ur where ur.id = v_target_role;
  select to_jsonb(p) into v_profile_before
  from public.profiles p where p.id = v_target;

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (v_session_one, v_target, clock_timestamp(), clock_timestamp());

  v_result := public.patch83u_prepare_required_password_change(
    v_target, v_session_one::text, 0, 'existing-change-1'
  );
  if v_result->>'request_id' <> 'existing-change-1'
    or v_result->>'identity_mode' <> 'legacy_verified'
    or v_result->>'employee_id' <> '00083'
    or (v_result->>'completed')::boolean
  then
    raise exception 'TEST_FAILED_PASSWORD_PREPARE_PAYLOAD';
  end if;

  v_result := public.patch83u_begin_required_password_change(
    v_target, v_session_one::text, 0, 'existing-change-1'
  );
  v_operation := (v_result->>'operation_id')::uuid;
  if v_result->>'request_id' <> 'existing-change-1'
    or (v_result->>'next_credential_version')::integer <> 1
    or (v_result->>'idempotent_replay')::boolean
  then
    raise exception 'TEST_FAILED_PASSWORD_BEGIN_PAYLOAD';
  end if;

  if (select credential_state from public.user_credential_states where user_id = v_target)
      <> 'password_change_in_progress'
    or (select to_jsonb(ur) from public.user_roles ur where ur.id = v_target_role)
      is distinct from v_role_before
  then
    raise exception 'TEST_FAILED_EXISTING_ROLE_NOT_PRESERVED_DURING_CHANGE';
  end if;

  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), '{credential_version}', '1'::jsonb, true
  )
  where id = v_target;
  delete from auth.sessions where user_id = v_target;

  v_result := public.patch83u_finalize_required_password_change(
    v_target, v_operation, 'existing-change-1', 1,
    'patch83u.target@example.test', true
  );
  if v_result->>'credential_state' <> 'active'
    or (v_result->>'credential_version')::integer <> 1
    or (v_result->>'reconciliation_required')::boolean
    or (v_result->>'session_revocation_review_required')::boolean
    or (v_result->>'idempotent_replay')::boolean
  then
    raise exception 'TEST_FAILED_PASSWORD_FINALIZE_PAYLOAD';
  end if;
  if (select to_jsonb(ur) from public.user_roles ur where ur.id = v_target_role)
      is distinct from v_role_before
    or (select count(*) from public.user_roles where user_id = v_target) <> 1
    or (select to_jsonb(p) from public.profiles p where p.id = v_target)
      is distinct from v_profile_before
  then
    raise exception 'TEST_FAILED_EXISTING_ROLE_OR_PROFILE_MUTATED';
  end if;

  v_result := public.patch83u_finalize_required_password_change(
    v_target, v_operation, 'existing-change-1', 1,
    'patch83u.target@example.test', true
  );
  if (v_result->>'idempotent_replay')::boolean is distinct from true
    or v_result->>'credential_state' <> 'active'
  then
    raise exception 'TEST_FAILED_PASSWORD_FINALIZE_REPLAY';
  end if;

  update public.user_credential_states
  set credential_state = 'existing_password_change_required',
      session_valid_after = to_timestamp(0),
      invalidated_session_id = null,
      operation_source = null,
      reconciliation_auth_changed = false
  where user_id = v_target;
  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (v_session_two, v_target, clock_timestamp(), clock_timestamp());
  perform public.patch83u_prepare_required_password_change(
    v_target, v_session_two::text, 1, 'existing-change-abort'
  );
  v_result := public.patch83u_begin_required_password_change(
    v_target, v_session_two::text, 1, 'existing-change-abort'
  );
  v_operation := (v_result->>'operation_id')::uuid;
  v_result := public.patch83u_abort_required_password_change(
    v_target, v_operation, 'existing-change-abort', false, false,
    'PATCH83U_PROOF_AUTH_UNCHANGED', 'No Auth change was attempted.'
  );
  if v_result->>'credential_state' <> 'existing_password_change_required'
    or (v_result->>'credential_version')::integer <> 1
    or (v_result->>'reconciliation_required')::boolean
    or (v_result->>'session_revocation_review_required')::boolean
  then
    raise exception 'TEST_FAILED_PASSWORD_ABORT_UNCHANGED';
  end if;
  begin
    perform public.patch83u_prepare_required_password_change(
      v_target, v_session_two::text, 1, 'existing-change-abort'
    );
    raise exception 'TEST_FAILED_ABORTED_REQUEST_ID_REUSED';
  exception when others then
    if sqlerrm not like '%PATCH83U_PASSWORD_CHANGE_REQUEST_ALREADY_ABORTED%'
    then raise; end if;
  end;

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (v_session_three, v_target, clock_timestamp(), clock_timestamp());
  perform public.patch83u_prepare_required_password_change(
    v_target, v_session_three::text, 1, 'existing-change-review'
  );
  v_result := public.patch83u_begin_required_password_change(
    v_target, v_session_three::text, 1, 'existing-change-review'
  );
  v_operation := (v_result->>'operation_id')::uuid;
  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), '{credential_version}', '2'::jsonb, true
  ) where id = v_target;
  v_result := public.patch83u_abort_required_password_change(
    v_target, v_operation, 'existing-change-review', true, false,
    'PATCH83U_PROOF_REVOCATION_UNCONFIRMED',
    'Auth changed but session revocation is not proven.'
  );
  if v_result->>'credential_state' <> 'session_revocation_review_required'
    or (v_result->>'credential_version')::integer <> 2
    or (v_result->>'session_revocation_review_required')::boolean is distinct from true
  then
    raise exception 'TEST_FAILED_PASSWORD_ABORT_REVIEW';
  end if;

  -- A caller assertion is not enough for the recovery branch: zero live Auth
  -- sessions must also be true, and the returned safe-result version must be
  -- the exact version persisted to user_credential_states.
  delete from auth.sessions where user_id = v_target;
  update public.user_credential_states
  set credential_state = 'existing_password_change_required',
      session_valid_after = to_timestamp(0),
      invalidated_session_id = null,
      operation_source = null,
      reconciliation_auth_changed = false,
      operation_previous_state = null,
      operation_previous_lifecycle = null,
      operation_previous_session_valid_after = null
  where user_id = v_target;
  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (v_session_four, v_target, clock_timestamp(), clock_timestamp());
  perform public.patch83u_prepare_required_password_change(
    v_target, v_session_four::text, 2, 'existing-change-recovery'
  );
  v_result := public.patch83u_begin_required_password_change(
    v_target, v_session_four::text, 2, 'existing-change-recovery'
  );
  v_operation := (v_result->>'operation_id')::uuid;
  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), '{credential_version}', '3'::jsonb, true
  ) where id = v_target;
  delete from auth.sessions where user_id = v_target;
  v_result := public.patch83u_abort_required_password_change(
    v_target, v_operation, 'existing-change-recovery', true, true,
    'PATCH83U_PROOF_AUTH_CHANGED',
    'Auth changed and zero live Auth sessions are proven.'
  );
  if v_result->>'credential_state' <> 'recovery_required'
    or (v_result->>'credential_version')::integer <> 3
    or (v_result->>'reconciliation_required')::boolean is distinct from true
    or (v_result->>'session_revocation_review_required')::boolean
    or (select credential_version from public.user_credential_states where user_id = v_target) <> 3
  then
    raise exception 'TEST_FAILED_PASSWORD_ABORT_RECOVERY';
  end if;

  delete from auth.sessions where user_id = v_target;
  v_result := public.patch83u_begin_admin_reset(
    v_admin, v_target, 'admin-reset-1', '00083',
    'Disposable reset execution proof', 'PATCH83U_RESET_USER_PASSWORD'
  );
  v_operation := (v_result->>'operation_id')::uuid;
  if v_result->>'request_id' <> 'admin-reset-1'
    or (v_result->>'next_credential_version')::integer <> 4
    or (v_result->>'completed')::boolean
  then
    raise exception 'TEST_FAILED_ADMIN_RESET_BEGIN_PAYLOAD';
  end if;
  if (select to_jsonb(ur) from public.user_roles ur where ur.id = v_target_role)
      is distinct from v_role_before
    or (select to_jsonb(p) from public.profiles p where p.id = v_target)
      is distinct from v_profile_before
  then
    raise exception 'TEST_FAILED_ADMIN_RESET_MUTATED_ROLE_OR_PROFILE';
  end if;

  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), '{credential_version}', '4'::jsonb, true
  ) where id = v_target;
  v_result := public.patch83u_finalize_admin_reset(
    v_admin, v_target, v_operation, 'admin-reset-1', 4,
    'patch83u.target@example.test', true
  );
  if v_result->>'credential_state' <> 'admin_reset_change_required'
    or (v_result->>'credential_version')::integer <> 4
    or (v_result->>'session_revocation_review_required')::boolean
    or (v_result->>'idempotent_replay')::boolean
  then
    raise exception 'TEST_FAILED_ADMIN_RESET_FINALIZE_PAYLOAD';
  end if;
  if (select to_jsonb(ur) from public.user_roles ur where ur.id = v_target_role)
      is distinct from v_role_before
    or (select to_jsonb(p) from public.profiles p where p.id = v_target)
      is distinct from v_profile_before
  then
    raise exception 'TEST_FAILED_ADMIN_RESET_FINALIZE_MUTATED_ROLE_OR_PROFILE';
  end if;

  v_result := public.patch83u_begin_admin_reset(
    v_admin, v_target, 'admin-reset-1', '00083',
    'Disposable reset execution proof', 'PATCH83U_RESET_USER_PASSWORD'
  );
  if (v_result->>'completed')::boolean is distinct from true
    or v_result->>'result_status' <> 'admin_reset_change_required'
    or (v_result->>'credential_version')::integer <> 4
    or (v_result->>'idempotent_replay')::boolean is distinct from true
  then
    raise exception 'TEST_FAILED_ADMIN_RESET_TERMINAL_REPLAY';
  end if;

  v_result := public.patch83u_begin_admin_reset(
    v_admin, v_target, 'admin-reset-abort-unchanged', '00083',
    'Disposable unchanged-Auth abort proof', 'PATCH83U_RESET_USER_PASSWORD'
  );
  v_operation := (v_result->>'operation_id')::uuid;
  v_result := public.patch83u_abort_admin_reset(
    v_admin, v_target, v_operation, 'admin-reset-abort-unchanged',
    false, false, 'PATCH83U_PROOF_AUTH_UNCHANGED',
    'No Auth change was attempted.'
  );
  if v_result->>'credential_state' <> 'admin_reset_change_required'
    or (v_result->>'credential_version')::integer <> 4
    or (v_result->>'reconciliation_required')::boolean
    or (v_result->>'session_revocation_review_required')::boolean
  then
    raise exception 'TEST_FAILED_ADMIN_RESET_ABORT_UNCHANGED';
  end if;

  v_result := public.patch83u_begin_admin_reset(
    v_admin, v_target, 'admin-reset-abort-review', '00083',
    'Disposable unproven-revocation abort proof', 'PATCH83U_RESET_USER_PASSWORD'
  );
  v_operation := (v_result->>'operation_id')::uuid;
  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), '{credential_version}', '5'::jsonb, true
  ) where id = v_target;
  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (v_session_five, v_target, clock_timestamp(), clock_timestamp());
  v_result := public.patch83u_abort_admin_reset(
    v_admin, v_target, v_operation, 'admin-reset-abort-review',
    true, true, 'PATCH83U_PROOF_REVOCATION_UNPROVEN',
    'The caller asserted revocation while an Auth session still existed.'
  );
  if v_result->>'credential_state' <> 'session_revocation_review_required'
    or (v_result->>'credential_version')::integer <> 5
    or (v_result->>'reconciliation_required')::boolean is distinct from true
    or (v_result->>'session_revocation_review_required')::boolean is distinct from true
    or (select session_revocation_confirmed
        from public.patch83u_credential_operations where operation_id = v_operation)
  then
    raise exception 'TEST_FAILED_ADMIN_RESET_ABORT_REVIEW';
  end if;

  delete from auth.sessions where user_id = v_target;
  v_result := public.patch83u_begin_admin_reset(
    v_admin, v_target, 'admin-reset-abort-recovery', '00083',
    'Disposable proven-revocation abort proof', 'PATCH83U_RESET_USER_PASSWORD'
  );
  v_operation := (v_result->>'operation_id')::uuid;
  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), '{credential_version}', '6'::jsonb, true
  ) where id = v_target;
  v_result := public.patch83u_abort_admin_reset(
    v_admin, v_target, v_operation, 'admin-reset-abort-recovery',
    true, true, 'PATCH83U_PROOF_AUTH_CHANGED',
    'Auth changed and zero live Auth sessions are proven.'
  );
  if v_result->>'credential_state' <> 'recovery_required'
    or (v_result->>'credential_version')::integer <> 6
    or (v_result->>'reconciliation_required')::boolean is distinct from true
    or (v_result->>'session_revocation_review_required')::boolean
    or (select credential_version from public.user_credential_states where user_id = v_target) <> 6
    or (select session_revocation_confirmed
        from public.patch83u_credential_operations where operation_id = v_operation)
       is distinct from true
  then
    raise exception 'TEST_FAILED_ADMIN_RESET_ABORT_RECOVERY';
  end if;
  if (select to_jsonb(ur) from public.user_roles ur where ur.id = v_target_role)
      is distinct from v_role_before
    or (select to_jsonb(p) from public.profiles p where p.id = v_target)
      is distinct from v_profile_before
  then
    raise exception 'TEST_FAILED_ADMIN_ABORT_MUTATED_ROLE_OR_PROFILE';
  end if;

  update public.patch83u_runtime_control
  set enforcement_state = 'emergency_suspended',
      deactivated_at = clock_timestamp(),
      deactivated_by = v_admin,
      last_transition_reason = 'Disposable emergency access proof',
      state_version = state_version + 1
  where singleton = true;
  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (
    v_emergency_session, v_target,
    clock_timestamp() + interval '1 second',
    clock_timestamp() + interval '1 second'
  );
  perform pg_catalog.set_config('request.jwt.claim.sub', v_target::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_target,
      'role', 'authenticated',
      'email', 'patch83u.target@example.test',
      'session_id', v_emergency_session,
      'app_metadata', jsonb_build_object('credential_version', 6)
    )::text,
    true
  );
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  v_result := public.patch83u_get_credential_state(
    v_target, 6, 'patch83u.target@example.test', v_emergency_session::text
  );
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  if (v_result->>'access_allowed')::boolean is distinct from true
    or public.patch83u_credential_access_allowed() is distinct from true
  then
    raise exception 'TEST_FAILED_EMERGENCY_VALID_LEGACY_ACCESS';
  end if;
  delete from auth.sessions where id = v_emergency_session;
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  v_result := public.patch83u_get_credential_state(
    v_target, 6, 'patch83u.target@example.test', v_emergency_session::text
  );
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  if (v_result->>'access_allowed')::boolean
    or public.patch83u_credential_access_allowed()
  then
    raise exception 'TEST_FAILED_EMERGENCY_REVOKED_SESSION_ACCESS';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  v_result := public.patch83u_get_credential_state(
    v_missing_actor, 0, 'missing@example.test',
    '83c00000-0000-4000-8000-000000000098'
  );
  if (v_result->>'managed')::boolean
    or (v_result->>'access_allowed')::boolean
    or (v_result->>'reconciliation_required')::boolean is distinct from true
  then
    raise exception 'TEST_FAILED_MISSING_MANAGED_STATE_NOT_CLOSED';
  end if;

  begin
    perform public.patch83u_transition_runtime(
      v_admin, 'disabled', 'wrong-confirmation-proof',
      'Disposable exact-confirmation proof', 'WRONG_CONFIRMATION',
      repeat('a', 64), v_admin,
      'patch83u-edge-auth-first-v1', 'patch83u-frontend-auth-first-v1'
    );
    raise exception 'TEST_FAILED_RUNTIME_WRONG_CONFIRMATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_RUNTIME_CONFIRMATION_REQUIRED%' then raise; end if;
  end;
end;
$patch83u_execution_proof$;

do $patch83u_last_super_admin_recovery_proof$
declare
  v_org uuid := '83c00000-0000-4000-8000-000000000001';
  v_admin uuid := '83c00000-0000-4000-8000-000000000011';
  v_target uuid := '83c00000-0000-4000-8000-000000000012';
  v_admin_role uuid := '83c00000-0000-4000-8000-000000000031';
  v_target_role uuid := '83c00000-0000-4000-8000-000000000032';
  v_password_proof_operation uuid := '83c00000-0000-4000-8000-000000000071';
  v_password_proof_session uuid := '83c00000-0000-4000-8000-000000000072';
  v_non_designated_role uuid := '83c00000-0000-4000-8000-000000000073';
  v_duplicate_admin_role uuid := '83c00000-0000-4000-8000-000000000074';
  v_remaining_session uuid := '83c00000-0000-4000-8000-000000000075';
  v_recovery_operation uuid := '83c00000-0000-4000-8000-000000000076';
  v_replay_collision_operation uuid := '83c00000-0000-4000-8000-000000000077';
  v_ambiguous_role_suspension uuid := '83c00000-0000-4000-8000-000000000078';
  v_result jsonb;
  v_profile_before jsonb;
  v_role_before jsonb;
  v_provisioning_before jsonb;
  v_runtime_state_version integer;
  v_recovery_event_count integer;
begin
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  perform pg_catalog.set_config('request.jwt.claim.sub', v_admin::text, true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'service_role')::text,
    true
  );

  -- The atomic finalizer rejects a remaining Auth session and activates only
  -- after proving zero sessions under the same lock. The subtransaction
  -- restores the fixture.
  begin
    update public.patch83u_runtime_control
    set enforcement_state = 'enforced'
    where singleton = true;

    update auth.users
    set raw_app_meta_data = jsonb_set(
      coalesce(raw_app_meta_data, '{}'::jsonb),
      '{credential_version}',
      '1'::jsonb,
      true
    )
    where id = v_admin;

    insert into public.patch83u_credential_operations (
      operation_id,
      operation_type,
      organization_id,
      actor_id,
      target_user_id,
      request_id,
      operation_status,
      current_credential_version,
      next_credential_version
    ) values (
      v_password_proof_operation,
      'password_change',
      v_org,
      v_admin,
      v_admin,
      'required-password-session-proof',
      'in_progress',
      0,
      1
    );

    update public.user_credential_states
    set credential_state = 'password_change_in_progress',
        credential_version = 0,
        pending_operation_id = v_password_proof_operation,
        pending_credential_version = 1,
        pending_session_id = null,
        operation_source = 'password_change',
        reconciliation_auth_changed = false,
        operation_previous_state = 'existing_password_change_required',
        operation_previous_lifecycle = 'active',
        operation_previous_session_valid_after = to_timestamp(0)
    where user_id = v_admin;

    insert into auth.sessions (id, user_id, created_at, updated_at)
    values (
      v_password_proof_session,
      v_admin,
      clock_timestamp(),
      clock_timestamp()
    );

    begin
      perform
        public.patch83u_finalize_password_change_after_revocation(
          v_admin,
          v_password_proof_operation,
          'required-password-session-proof',
          1,
          'patch83u.admin@example.test'
        );
      raise exception 'TEST_FAILED_ATOMIC_FINALIZE_WITH_SESSION_ALLOWED';
    exception when others then
      if sqlerrm not like '%PATCH83U_AUTH_SESSIONS_STILL_ACTIVE%' then
        raise;
      end if;
    end;

    delete from auth.sessions where id = v_password_proof_session;
    v_result :=
      public.patch83u_finalize_password_change_after_revocation(
        v_admin,
        v_password_proof_operation,
        'required-password-session-proof',
        1,
        'patch83u.admin@example.test'
      );
    if v_result ->> 'credential_state' <> 'active'
      or (v_result ->> 'credential_version')::integer <> 1
      or (v_result ->> 'idempotent_replay')::boolean
      or exists (
        select 1 from auth.sessions s where s.user_id = v_admin
      )
    then
      raise exception 'TEST_FAILED_ATOMIC_PASSWORD_FINALIZATION';
    end if;

    v_result :=
      public.patch83u_finalize_password_change_after_revocation(
        v_admin,
        v_password_proof_operation,
        'required-password-session-proof',
        1,
        'patch83u.admin@example.test'
      );
    if (v_result ->> 'idempotent_replay')::boolean is distinct from true
      or v_result ->> 'credential_state' <> 'active'
    then
      raise exception 'TEST_FAILED_ATOMIC_PASSWORD_FINALIZATION_REPLAY';
    end if;

    raise exception 'PATCH83U_TEST_PASSWORD_SESSION_PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PATCH83U_TEST_PASSWORD_SESSION_PROOF_ROLLBACK' then
      raise;
    end if;
  end;

  -- Hosted-defect fixture: Auth version advanced, the password-change ledger
  -- is terminal for unproven revocation, no Auth sessions remain, and the only
  -- designated Super Admin is credential-locked.
  delete from auth.sessions where user_id = v_admin;
  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb),
    '{credential_version}',
    '1'::jsonb,
    true
  )
  where id = v_admin;

  update public.user_credential_states
  set credential_state = 'session_revocation_review_required',
      requested_lifecycle = 'active',
      credential_version = 1,
      provisioning_id = null,
      pending_operation_id = null,
      pending_session_id = null,
      pending_credential_version = null,
      operation_source = 'password_change',
      reconciliation_auth_changed = true,
      operation_previous_state = 'existing_password_change_required',
      operation_previous_lifecycle = 'active',
      operation_previous_session_valid_after = to_timestamp(0)
  where user_id = v_admin;

  insert into public.patch83u_credential_operations (
    operation_id,
    operation_type,
    organization_id,
    actor_id,
    target_user_id,
    request_id,
    operation_status,
    current_credential_version,
    next_credential_version,
    resulting_credential_state,
    auth_changed,
    session_revocation_confirmed,
    safe_result,
    completed_at
  ) values (
    v_recovery_operation,
    'password_change',
    v_org,
    v_admin,
    v_admin,
    'hosted-password-change-review',
    'session_revocation_review_required',
    0,
    1,
    'session_revocation_review_required',
    true,
    false,
    jsonb_build_object(
      'user_id', v_admin,
      'request_id', 'hosted-password-change-review',
      'credential_state', 'session_revocation_review_required',
      'credential_version', 1,
      'must_reauthenticate', true,
      'session_revocation_review_required', true,
      'idempotent_replay', false
    ),
    clock_timestamp()
  );

  select to_jsonb(p) into v_profile_before
  from public.profiles p
  where p.id = v_admin;
  select to_jsonb(ur) into v_role_before
  from public.user_roles ur
  where ur.id = v_admin_role;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]'::jsonb)
  into v_provisioning_before
  from public.user_account_provisioning q;
  select state_version into v_runtime_state_version
  from public.patch83u_runtime_control
  where singleton = true;

  -- The ordinary implementation remains enforced outside emergency suspension
  -- and therefore rejects the locked administrator.
  begin
    update public.patch83u_runtime_control
    set enforcement_state = 'enforced'
    where singleton = true;
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-enforced-rejected',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_ENFORCED_LAST_SUPER_RECOVERY_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_ACTIVE_SUPER_ADMIN_REQUIRED%' then
      raise;
    end if;
  end;

  begin
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_target,
      'last-super-actor-target-mismatch',
      '00083'
    );
    raise exception 'TEST_FAILED_RECOVERY_ACTOR_TARGET_MISMATCH_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_ACTOR_INVALID%' then
      raise;
    end if;
  end;

  -- Even a structurally valid global Super Admin cannot use the exception when
  -- it is not the runtime-designated user.
  begin
    insert into public.user_roles (
      id, user_id, role, scope, organization_id, is_active, assigned_by
    ) values (
      v_non_designated_role,
      v_target,
      'super_admin',
      'global',
      v_org,
      true,
      v_admin
    );
    perform public.patch83u_reconcile_credential_state(
      v_target,
      v_target,
      'last-super-non-designated',
      '00083'
    );
    raise exception 'TEST_FAILED_NON_DESIGNATED_SUPER_RECOVERY_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_ACTOR_INVALID%' then
      raise;
    end if;
  end;

  -- The designated user must retain one active canonical Super Admin row.
  begin
    execute
      'alter table public.user_roles disable trigger trg_patch83u_guard_role_activation';
    execute
      'alter table public.user_roles disable trigger trg_patch83u_guard_last_super_admin_role_removal';
    update public.user_roles
    set is_active = false
    where id = v_admin_role;
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-missing-active-role',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_MISSING_ACTIVE_SUPER_ADMIN_RECOVERY_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_ROLE_INVALID%' then
      raise;
    end if;
  end;

  begin
    execute
      'alter table public.user_roles disable trigger trg_patch83u_guard_role_activation';
    execute
      'alter table public.user_roles disable trigger trg_patch83u_guard_last_super_admin_role_removal';
    update public.user_roles
    set scope = 'assigned_only',
        organization_id = v_org,
        division_id = null,
        department_id = null,
        unit_id = null
    where id = v_admin_role;
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-non-global-role',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_NON_GLOBAL_SUPER_ADMIN_RECOVERY_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_ROLE_INVALID%' then
      raise;
    end if;
  end;

  -- A second active but structurally invalid Super Admin assignment on another
  -- active profile is still ambiguity and must fail closed.
  begin
    execute
      'alter table public.user_roles disable trigger trg_patch83u_guard_role_activation';
    insert into public.user_roles (
      id, user_id, role, scope, organization_id, is_active, assigned_by
    ) values (
      v_non_designated_role,
      v_target,
      'super_admin',
      'assigned_only',
      v_org,
      true,
      v_admin
    );
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-invalid-other-profile-role',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_INVALID_SECOND_SUPER_ADMIN_RECOVERY_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_ROLE_INVALID%' then
      raise;
    end if;
  end;

  -- Duplicate active Super Admin rows are ambiguous and fail the exact-one
  -- assignment proof.
  begin
    insert into public.user_roles (
      id, user_id, role, scope, organization_id, is_active, assigned_by
    ) values (
      v_duplicate_admin_role,
      v_admin,
      'super_admin',
      'global',
      v_org,
      true,
      v_admin
    );
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-invalid-role',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_AMBIGUOUS_GLOBAL_ROLE_RECOVERY_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_ROLE_INVALID%' then
      raise;
    end if;
  end;

  begin
    update auth.users
    set raw_app_meta_data = jsonb_set(
      coalesce(raw_app_meta_data, '{}'::jsonb),
      '{credential_version}',
      '2'::jsonb,
      true
    )
    where id = v_admin;
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-version-mismatch',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_RECOVERY_VERSION_MISMATCH_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_AUTH_INVALID%' then
      raise;
    end if;
  end;

  begin
    insert into auth.sessions (id, user_id, created_at, updated_at)
    values (
      v_remaining_session,
      v_admin,
      clock_timestamp(),
      clock_timestamp()
    );
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-session-remaining',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_RECOVERY_WITH_SESSION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_AUTH_SESSIONS_STILL_ACTIVE%' then
      raise;
    end if;
  end;

  begin
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-wrong-confirmation',
      'admin-83u'
    );
    raise exception 'TEST_FAILED_RECOVERY_WRONG_EMPLOYEE_CONFIRMATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_EMPLOYEE_ID_CONFIRMATION_REQUIRED%' then
      raise;
    end if;
  end;

  begin
    update auth.users
    set raw_app_meta_data = jsonb_set(
      coalesce(raw_app_meta_data, '{}'::jsonb),
      '{credential_version}',
      '0'::jsonb,
      true
    )
    where id = v_admin;
    update public.user_credential_states
    set credential_version = 0
    where user_id = v_admin;
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-zero-version',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_RECOVERY_ZERO_VERSION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_STATE_INVALID%' then
      raise;
    end if;
  end;

  begin
    update public.user_credential_states
    set operation_previous_session_valid_after =
          session_valid_after + interval '1 second'
    where user_id = v_admin;
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-invalid-session-cutoff',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_RECOVERY_INVALID_SESSION_CUTOFF_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_STATE_INVALID%' then
      raise;
    end if;
  end;

  begin
    update public.user_credential_states
    set role_suspension_id = v_ambiguous_role_suspension
    where user_id = v_admin;
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-ambiguous-role-suspension',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_RECOVERY_ROLE_SUSPENSION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_STATE_INVALID%' then
      raise;
    end if;
  end;

  begin
    update public.user_credential_states
    set operation_source = 'admin_reset'
    where user_id = v_admin;
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-operation-source-mismatch',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_RECOVERY_OPERATION_SOURCE_MISMATCH_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_STATE_INVALID%' then
      raise;
    end if;
  end;

  begin
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'hosted-password-change-review',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_RECOVERY_OPERATION_REQUEST_ID_REUSE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_RECOVERY_REQUEST_ID_REUSED%' then
      raise;
    end if;
  end;

  begin
    update public.patch83u_credential_operations
    set session_revocation_confirmed = true,
        safe_result = safe_result || jsonb_build_object(
          'session_revocation_review_required', false,
          'reconciliation_required', true,
          'recovery_required', true
        )
    where operation_id = v_recovery_operation;
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-contradictory-session-review-ledger',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_CONTRADICTORY_SESSION_REVIEW_LEDGER_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_RECOVERY_OPERATION_INVALID%' then
      raise;
    end if;
  end;

  v_result := public.patch83u_reconcile_credential_state(
    v_admin,
    v_admin,
    'last-super-recovery-success',
    'ADMIN-83U'
  );

  if v_result ->> 'credential_state' <> 'active'
    or v_result ->> 'outcome'
      <> 'last_super_admin_recovered_from_emergency_proof'
    or v_result ->> 'recovery_authorization'
      <> 'last_designated_super_admin_emergency_self_recovery'
    or (v_result ->> 'auth_session_count')::integer <> 0
    or (v_result ->> 'idempotent_replay')::boolean
    or (v_result ->> 'recovery_required')::boolean
    or (v_result ->> 'reconciliation_required')::boolean
  then
    raise exception 'TEST_FAILED_LAST_SUPER_ADMIN_RECOVERY_RESULT';
  end if;

  if not exists (
      select 1
      from public.user_credential_states cs
      where cs.user_id = v_admin
        and cs.credential_state = 'active'
        and cs.credential_version = 1
        and cs.operation_source is null
        and cs.reconciliation_auth_changed = false
        and cs.sessions_revoked_at is not null
    )
    or exists (
      select 1 from auth.sessions s where s.user_id = v_admin
    )
    or not exists (
      select 1
      from public.patch83u_credential_operations op
      where op.operation_id = v_recovery_operation
        and op.operation_status = 'completed'
        and op.resulting_credential_state = 'active'
        and op.auth_changed = true
        and op.session_revocation_confirmed = true
    )
  then
    raise exception 'TEST_FAILED_LAST_SUPER_ADMIN_RECOVERY_DATABASE_PROOF';
  end if;

  select count(*)::integer into v_recovery_event_count
  from public.user_credential_events e
  where e.user_id = v_admin
    and e.actor_id = v_admin
    and e.request_id = 'last-super-recovery-success'
    and e.event_code = 'PATCH83U_LAST_SUPER_ADMIN_RECOVERED'
    and e.details ->> 'recovery_authorization'
      = 'last_designated_super_admin_emergency_self_recovery'
    and (e.details ->> 'auth_session_count')::integer = 0;
  if v_recovery_event_count <> 1 then
    raise exception 'TEST_FAILED_LAST_SUPER_ADMIN_RECOVERY_AUDIT';
  end if;

  v_result := public.patch83u_reconcile_credential_state(
    v_admin,
    v_admin,
    'last-super-recovery-success',
    'ADMIN-83U'
  );
  if (v_result ->> 'idempotent_replay')::boolean is distinct from true
    or v_result ->> 'credential_state' <> 'active'
    or (
      select count(*)
      from public.user_credential_events e
      where e.request_id = 'last-super-recovery-success'
        and e.event_code = 'PATCH83U_LAST_SUPER_ADMIN_RECOVERED'
    ) <> 1
  then
    raise exception 'TEST_FAILED_LAST_SUPER_ADMIN_RECOVERY_IDEMPOTENCY';
  end if;

  -- An exact audit-event replay is no longer accepted if another protected
  -- ledger later reuses the same request ID.
  begin
    insert into public.patch83u_credential_operations (
      operation_id,
      operation_type,
      organization_id,
      actor_id,
      target_user_id,
      request_id,
      operation_status,
      current_credential_version,
      next_credential_version
    ) values (
      v_replay_collision_operation,
      'admin_reset',
      v_org,
      v_admin,
      v_target,
      'last-super-recovery-success',
      'prepared',
      0,
      1
    );
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-recovery-success',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_OPERATION_COLLISION_REPLAY_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_RECOVERY_REQUEST_ID_REUSED%' then
      raise;
    end if;
  end;

  begin
    insert into public.patch83u_runtime_events (
      actor_id,
      designated_super_admin_id,
      event_type,
      previous_state,
      resulting_state,
      request_id,
      confirmation_code,
      reason,
      schema_version,
      edge_contract_version,
      frontend_contract_version,
      preflight_hash,
      details
    )
    select
      v_admin,
      v_admin,
      'emergency_suspended',
      'emergency_suspended',
      'emergency_suspended',
      'last-super-recovery-success',
      'PATCH83U_EMERGENCY_SUSPEND',
      'Regression-only request-ID collision proof',
      rc.schema_version,
      rc.expected_edge_contract_version,
      rc.expected_frontend_contract_version,
      rc.preflight_hash,
      '{}'::jsonb
    from public.patch83u_runtime_control rc
    where rc.singleton = true;
    perform public.patch83u_reconcile_credential_state(
      v_admin,
      v_admin,
      'last-super-recovery-success',
      'ADMIN-83U'
    );
    raise exception 'TEST_FAILED_RUNTIME_COLLISION_REPLAY_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_RECOVERY_REQUEST_ID_REUSED%' then
      raise;
    end if;
  end;

  if (select to_jsonb(p) from public.profiles p where p.id = v_admin)
      is distinct from v_profile_before
    or (select to_jsonb(ur) from public.user_roles ur where ur.id = v_admin_role)
      is distinct from v_role_before
    or (
      select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]'::jsonb)
      from public.user_account_provisioning q
    ) is distinct from v_provisioning_before
    or (
      select enforcement_state
      from public.patch83u_runtime_control
      where singleton = true
    ) <> 'emergency_suspended'
    or (
      select state_version
      from public.patch83u_runtime_control
      where singleton = true
    ) <> v_runtime_state_version
  then
    raise exception 'TEST_FAILED_RECOVERY_MUTATED_PROTECTED_CONTEXT';
  end if;

  -- The ordinary guard itself is unchanged: it accepts the now-active verified
  -- administrator under enforced runtime and rejects a locked credential.
  begin
    update public.patch83u_runtime_control
    set enforcement_state = 'enforced'
    where singleton = true;
    if public.patch83u_require_super_admin(v_admin) is distinct from v_org then
      raise exception 'TEST_FAILED_ORDINARY_SUPER_ADMIN_GUARD_ACTIVE';
    end if;
    raise exception 'PATCH83U_TEST_ORDINARY_GUARD_ACTIVE_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PATCH83U_TEST_ORDINARY_GUARD_ACTIVE_ROLLBACK' then
      raise;
    end if;
  end;

  begin
    update public.patch83u_runtime_control
    set enforcement_state = 'enforced'
    where singleton = true;
    update public.user_credential_states
    set credential_state = 'session_revocation_review_required'
    where user_id = v_admin;
    perform public.patch83u_require_super_admin(v_admin);
    raise exception 'TEST_FAILED_ORDINARY_SUPER_ADMIN_GUARD_LOCKED_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_ACTIVE_SUPER_ADMIN_REQUIRED%' then
      raise;
    end if;
  end;
end;
$patch83u_last_super_admin_recovery_proof$;

rollback;
