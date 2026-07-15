-- Patch 83U focused credential-governance database proof.
-- This file is deliberately rollback-only. Run only after migrations 173 and
-- 174 in a disposable verification database; it does not call an Auth API and
-- must never be used to provision or reset a production account.

begin;

do $$
declare
  v_org uuid := '83b00000-0000-4000-8000-000000000001';
  v_other_org uuid := '83b00000-0000-4000-8000-000000000002';
  v_admin uuid := '83b00000-0000-4000-8000-000000000011';
  v_operator uuid := '83b00000-0000-4000-8000-000000000012';
  v_other_admin uuid := '83b00000-0000-4000-8000-000000000013';
  v_target uuid := '83b00000-0000-4000-8000-000000000014';
  v_reconcile_target uuid := '83b00000-0000-4000-8000-000000000015';
  v_department uuid := '83b00000-0000-4000-8000-000000000021';
  v_other_department uuid := '83b00000-0000-4000-8000-000000000022';
  v_batch uuid := '83b00000-0000-4000-8000-000000000041';
  v_reconcile_batch uuid := '83b00000-0000-4000-8000-000000000042';
  v_import_row uuid := '83b00000-0000-4000-8000-000000000051';
  v_reconcile_row uuid := '83b00000-0000-4000-8000-000000000052';
  v_provisioning uuid := '83b00000-0000-4000-8000-000000000061';
  v_reconcile_provisioning uuid := '83b00000-0000-4000-8000-000000000062';
  v_session uuid := '83b00000-0000-4000-8000-000000000071';
  v_new_session uuid := '83b00000-0000-4000-8000-000000000072';
  v_reset_session uuid := '83b00000-0000-4000-8000-000000000073';
  v_reconcile_session uuid := '83b00000-0000-4000-8000-000000000074';
  v_stale_session uuid := '83b00000-0000-4000-8000-000000000075';
  v_reconcile_admin_session uuid := '83b00000-0000-4000-8000-000000000076';
  v_legacy_session uuid := '83b00000-0000-4000-8000-000000000077';
  v_legacy_identity_session uuid := '83b00000-0000-4000-8000-000000000078';
  v_claim jsonb;
  v_result jsonb;
  v_attempt uuid;
  v_operation uuid;
  v_suspension uuid;
  v_events_before integer;
  v_password_reset_at timestamptz;
begin
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  insert into public.organizations (id, name_en)
  values
    (v_org, 'Patch 83U SQL Proof Organization'),
    (v_other_org, 'Patch 83U Cross-Organization Proof');

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, created_at, updated_at
  ) values
    (
      v_admin, 'authenticated', 'authenticated', 'patch83u.admin@example.test', '', now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'credential_version', 0),
      now(), now()
    ),
    (
      v_operator, 'authenticated', 'authenticated', 'patch83u.operator@example.test', '', now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      now(), now()
    ),
    (
      v_other_admin, 'authenticated', 'authenticated', 'patch83u.other.admin@example.test', '', now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'credential_version', 0),
      now(), now()
    );

  insert into public.profiles (
    id, organization_id, employee_no, full_name_en, full_name_ar, email,
    job_title, is_active, user_status, user_type
  ) values
    (
      v_admin, v_org, 'ADMIN-83U', 'Patch 83U Super Admin', 'مدير الاختبار',
      'patch83u.admin@example.test', 'Administrator', true, 'active', 'employee'
    ),
    (
      v_operator, v_org, 'OPER-83U', 'Patch 83U Operator', 'مشغل الاختبار',
      'patch83u.operator@example.test', 'Operator', true, 'active', 'employee'
    ),
    (
      v_other_admin, v_other_org, 'OTHER-83U', 'Other Organization Admin', 'مدير مؤسسة أخرى',
      'patch83u.other.admin@example.test', 'Administrator', true, 'active', 'employee'
    );

  -- Profiles created after Patch 83U deliberately fail closed. These confirmed
  -- Auth identities model the migration's legacy backfill so the actor fixtures
  -- can exercise privileged flows without weakening that default.
  update public.user_credential_states cs
  set auth_email = lower(btrim(u.email)),
      identity_mode = 'legacy_verified',
      credential_state = 'active',
      requested_lifecycle = 'active',
      credential_version = 0,
      session_valid_after = to_timestamp(0)
  from auth.users u
  where u.id = cs.user_id
    and cs.user_id in (v_admin, v_operator, v_other_admin)
    and u.email_confirmed_at is not null;

  if (select count(*) from public.user_credential_states
      where user_id in (v_admin, v_operator, v_other_admin)
        and identity_mode = 'legacy_verified'
        and credential_state = 'active') <> 3
  then raise exception 'TEST_FAILED_CONFIRMED_LEGACY_IDENTITY_FIXTURE'; end if;

  insert into public.user_roles (
    id, user_id, role, scope, organization_id, is_active
  ) values
    ('83b00000-0000-4000-8000-000000000031', v_admin, 'super_admin', 'global', v_org, true),
    ('83b00000-0000-4000-8000-000000000032', v_operator, 'employee', 'assigned_only', v_org, true),
    ('83b00000-0000-4000-8000-000000000033', v_other_admin, 'super_admin', 'global', v_other_org, true);

  insert into public.departments (
    id, organization_id, name_en, name_ar, code, is_active
  ) values
    (v_department, v_org, 'Information Technology', 'تقنية المعلومات', 'IT', true),
    (v_other_department, v_other_org, 'Other Department', 'إدارة أخرى', 'OTHER', true);

  if public.patch83u_auth_credential_version('{}'::jsonb) is distinct from 0
    or public.patch83u_auth_credential_version(
      jsonb_build_object('credential_version', 0)
    ) is distinct from 0
    or public.patch83u_auth_credential_version(
      jsonb_build_object('credential_version', 1)
    ) is distinct from 1
    or public.patch83u_auth_credential_version(
      jsonb_build_object('credential_version', 'invalid')
    ) is not null
    or public.patch83u_auth_credential_version(
      jsonb_build_object('credential_version', '999999999999999999999999')
    ) is not null
    or public.patch83u_auth_credential_version('null'::jsonb) is not null
  then raise exception 'TEST_FAILED_CANONICAL_AUTH_VERSION_PARSER'; end if;

  -- Ordinary legacy Auth identities may have no credential_version metadata.
  -- Missing metadata maps only to version 0, so reset begin and stale-operation
  -- reconciliation must work without weakening any nonzero version proof.
  begin
    v_result := public.patch83u_begin_admin_reset(
      v_admin, v_operator, 'proof.legacy.reset.begin', 'OPER-83U',
      'Legacy version-zero reset compatibility proof',
      'PATCH83U_RESET_USER_PASSWORD'
    );
    v_operation := nullif(v_result->>'operation_id', '')::uuid;
    if v_operation is null
      or (v_result->>'current_credential_version')::integer <> 0
      or (v_result->>'next_credential_version')::integer <> 1
    then raise exception 'TEST_FAILED_LEGACY_RESET_BEGIN_WITH_MISSING_VERSION'; end if;

    v_result := public.patch83u_reconcile_credential_state(
      v_admin, v_operator, 'proof.legacy.reset.reconcile', 'OPER-83U'
    );
    if v_result->>'credential_state' <> 'active'
      or v_result->>'outcome' <> 'stale_admin_reset_aborted'
      or (v_result->>'reconciliation_required')::boolean is distinct from false
    then raise exception 'TEST_FAILED_LEGACY_MISSING_VERSION_RECONCILIATION'; end if;
    if not exists (
      select 1 from public.user_credential_states
      where user_id = v_operator and credential_state = 'active'
        and credential_version = 0 and password_reset_at is null
    )
      or not exists (
        select 1 from public.user_roles
        where user_id = v_operator and role = 'employee' and is_active = true
      )
    then raise exception 'TEST_FAILED_LEGACY_RESET_RECONCILIATION_STATE'; end if;

    raise exception 'PATCH83U_TEST_LEGACY_RESET_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83U_TEST_LEGACY_RESET_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;

  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_operator and credential_state = 'active'
      and credential_version = 0 and password_reset_at is null
  )
    or not exists (
      select 1 from public.profiles
      where id = v_operator and user_status = 'active' and is_active = true
    )
    or not exists (
      select 1 from public.user_roles
      where user_id = v_operator and role = 'employee' and is_active = true
    )
  then raise exception 'TEST_FAILED_LEGACY_RESET_PROOF_ROLLBACK'; end if;

  begin
    insert into auth.sessions (id, user_id, created_at, updated_at)
    values (v_legacy_session, v_operator, clock_timestamp(), clock_timestamp());
    perform pg_catalog.set_config('request.jwt.claim.sub', v_operator::text, true);
    perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
    perform pg_catalog.set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', v_operator,
        'role', 'authenticated',
        'email', 'patch83u.operator@example.test',
        'session_id', v_legacy_session,
        'app_metadata', jsonb_build_object('provider', 'email')
      )::text,
      true
    );
    if public.patch83u_credential_access_allowed() is distinct from true then
      raise exception 'TEST_FAILED_LEGACY_ABSENT_VERSION_RLS_GATE';
    end if;

    perform pg_catalog.set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', v_operator,
        'role', 'authenticated',
        'email', 'patch83u.operator@example.test',
        'session_id', v_legacy_session,
        'app_metadata', jsonb_build_object('credential_version', null)
      )::text,
      true
    );
    if public.patch83u_credential_access_allowed() is distinct from false then
      raise exception 'TEST_FAILED_EXPLICIT_NULL_VERSION_RLS_ALLOWED';
    end if;

    perform pg_catalog.set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', v_operator,
        'role', 'authenticated',
        'email', 'patch83u.operator@example.test',
        'session_id', v_legacy_session,
        'app_metadata', jsonb_build_object('credential_version', 'invalid')
      )::text,
      true
    );
    if public.patch83u_credential_access_allowed() is distinct from false then
      raise exception 'TEST_FAILED_MALFORMED_VERSION_RLS_ALLOWED';
    end if;

    raise exception 'PATCH83U_TEST_LEGACY_RLS_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83U_TEST_LEGACY_RLS_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;

  -- Legacy verified identities may retain a non-managed Employee ID. The begin
  -- contract tells the Edge handler to use the verified legacy Auth email and
  -- never attempts to derive or rewrite that identity.
  begin
    update public.profiles
    set employee_no = 'موظف / 83U', user_status = 'invited', is_active = true
    where id = v_operator;
    insert into auth.sessions (id, user_id, created_at, updated_at)
    values (v_legacy_identity_session, v_operator, clock_timestamp(), clock_timestamp());

    v_result := public.patch83u_begin_required_password_change(
      v_operator, v_legacy_identity_session::text, 0
    );
    if v_result->>'identity_mode' <> 'legacy_verified'
      or v_result->>'employee_id' <> 'موظف / 83U'
      or v_result->>'auth_email' <> 'patch83u.operator@example.test'
    then raise exception 'TEST_FAILED_LEGACY_IDENTITY_REQUIRED_CHANGE_CONTRACT'; end if;

    raise exception 'PATCH83U_TEST_LEGACY_IDENTITY_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83U_TEST_LEGACY_IDENTITY_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;

  -- Unverified identities and verified legacy rows without an Employee ID never
  -- enter a forced-change state that the server cannot complete.
  begin
    update public.user_credential_states
    set identity_mode = 'unverified', credential_state = 'reconciliation_required'
    where user_id = v_operator;
    update public.profiles
    set user_status = 'invited', is_active = true
    where id = v_operator;
    if not exists (
      select 1 from public.user_credential_states
      where user_id = v_operator
        and identity_mode = 'unverified'
        and credential_state = 'reconciliation_required'
    ) or exists (
      select 1 from public.user_roles where user_id = v_operator and is_active
    ) then raise exception 'TEST_FAILED_UNVERIFIED_INVITED_STATE_NOT_LOCKED'; end if;

    begin
      perform public.patch83u_begin_admin_reset(
        v_admin, v_operator, 'proof.unverified.reset', 'OPER-83U',
        'Unverified identities cannot enter forced password change',
        'PATCH83U_RESET_USER_PASSWORD'
      );
      raise exception 'TEST_FAILED_UNVERIFIED_ADMIN_RESET_ALLOWED';
    exception when others then
      if sqlerrm not like '%PATCH83U_RESET_IDENTITY_NOT_VERIFIED%' then raise; end if;
    end;

    update public.user_credential_states
    set identity_mode = 'legacy_verified'
    where user_id = v_operator;
    update public.profiles
    set employee_no = null, user_status = 'inactive', is_active = false
    where id = v_operator;
    update public.profiles
    set user_status = 'active', is_active = true
    where id = v_operator;
    if not exists (
      select 1 from public.user_credential_states
      where user_id = v_operator
        and identity_mode = 'legacy_verified'
        and credential_state = 'reconciliation_required'
    ) or exists (
      select 1 from public.user_roles where user_id = v_operator and is_active
    ) then raise exception 'TEST_FAILED_BLANK_EMPLOYEE_ID_REACTIVATION_NOT_LOCKED'; end if;

    raise exception 'PATCH83U_TEST_UNVERIFIED_LIFECYCLE_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83U_TEST_UNVERIFIED_LIFECYCLE_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;

  -- Profile tenant/lifecycle boundaries are fail closed even if a legacy broad
  -- profile policy would otherwise permit a direct authenticated write.
  perform pg_catalog.set_config('request.jwt.claim.sub', v_operator::text, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    update public.profiles set organization_id = v_other_org where id = v_operator;
    raise exception 'TEST_FAILED_DIRECT_PROFILE_ORGANIZATION_CHANGE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_PROFILE_ORGANIZATION_IMMUTABLE%' then raise; end if;
  end;
  begin
    update public.profiles set user_status = 'inactive', is_active = false where id = v_operator;
    raise exception 'TEST_FAILED_DIRECT_SELF_LIFECYCLE_CHANGE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_DIRECT_SELF_LIFECYCLE_CHANGE_DENIED%' then raise; end if;
  end;
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  begin
    update public.profiles set employee_no = 'admin-83u' where id = v_operator;
    raise exception 'TEST_FAILED_DIRECT_CASE_INSENSITIVE_EMPLOYEE_ID_COLLISION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_EMPLOYEE_ID_CASE_INSENSITIVE_CONFLICT%' then raise; end if;
  end;
  -- A self-service legacy Employee ID edit cannot claim the synthetic alias of
  -- another Auth identity, even when no profile currently uses that ID.
  begin
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, created_at, updated_at
    ) values (
      '83b00000-0000-4000-8000-000000000081',
      'authenticated', 'authenticated', 'reserved-auth-83u@almodawat.sa', '', now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      now(), now()
    );
    perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
    update public.profiles
    set employee_no = 'RESERVED-AUTH-83U'
    where id = v_operator;
    raise exception 'TEST_FAILED_DIRECT_AUTH_ALIAS_EMPLOYEE_ID_COLLISION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_EMPLOYEE_ID_CASE_INSENSITIVE_CONFLICT%' then raise; end if;
  end;
  begin
    perform public.patch83t_update_user_profile(
      v_admin, v_operator,
      jsonb_build_object('employee_id', 'admin-83u', 'reason', 'Case collision proof')
    );
    raise exception 'TEST_FAILED_PROFILE_RPC_CASE_INSENSITIVE_COLLISION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_PROFILE_EMPLOYEE_ID_CONFLICT%' then raise; end if;
  end;

  begin
    update public.user_credential_states
    set identity_mode = 'unverified'
    where user_id = v_operator;
    insert into auth.sessions (id, user_id, created_at, updated_at)
    values (v_legacy_identity_session, v_operator, clock_timestamp(), clock_timestamp());
    perform pg_catalog.set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', v_operator,
        'role', 'service_role',
        'email', 'patch83u.operator@example.test',
        'session_id', v_legacy_identity_session,
        'app_metadata', jsonb_build_object('credential_version', 0)
      )::text,
      true
    );
    if public.patch83u_credential_access_allowed() is distinct from false then
      raise exception 'TEST_FAILED_UNVERIFIED_ACTIVE_CREDENTIAL_ACCESS_ALLOWED';
    end if;
    v_result := public.patch83u_get_credential_state(
      v_operator, 0, 'patch83u.operator@example.test', v_legacy_identity_session::text
    );
    if (v_result->>'access_allowed')::boolean is distinct from false then
      raise exception 'TEST_FAILED_UNVERIFIED_GET_STATE_ACCESS_ALLOWED';
    end if;

    update public.user_credential_states
    set organization_id = v_other_org
    where user_id = v_operator;
    if public.patch83u_credential_access_allowed() is distinct from false then
      raise exception 'TEST_FAILED_CREDENTIAL_PROFILE_ORGANIZATION_MISMATCH_ALLOWED';
    end if;
    v_result := public.patch83u_get_credential_state(
      v_operator, 0, 'patch83u.operator@example.test', v_legacy_identity_session::text
    );
    if (v_result->>'managed')::boolean is distinct from false
      or (v_result->>'access_allowed')::boolean is distinct from false
    then raise exception 'TEST_FAILED_GET_STATE_ORGANIZATION_MISMATCH_ALLOWED'; end if;

    raise exception 'PATCH83U_TEST_FAIL_CLOSED_ACCESS_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83U_TEST_FAIL_CLOSED_ACCESS_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  insert into public.user_management_import_batches (
    id, organization_id, file_name, source_format, row_count, valid_count,
    invalid_count, status, created_by, applied_by, applied_at
  ) values (
    v_batch, v_org, 'patch83u-sql-proof.xlsx', 'xlsx', 1, 1, 0,
    'applied', v_admin, v_admin, now()
  );

  insert into public.user_management_import_rows (
    id, organization_id, batch_id, row_number, raw_data, normalized_email,
    validation_status, validation_errors, validation_warnings,
    action_status, matched_user_id
  ) values (
    v_import_row, v_org, v_batch, 2,
    jsonb_build_object(
      'employee_id', '0000098',
      'contact_email', 'pending.user@example.test',
      'account_action', 'create',
      'department_code', 'IT',
      'role', 'employee',
      'role_scope', 'assigned_only',
      'status', 'active',
      'user_type', 'employee'
    ),
    '0000098@almodawat.sa', 'valid', array[]::text[], array[]::text[],
    'pending_account_creation', null
  );

  insert into public.user_account_provisioning (
    id, organization_id, import_batch_id, import_row_id, auth_user_id,
    employee_id, auth_email, contact_email, full_name_en, full_name_ar, phone,
    department_id, department_code, job_title, requested_role,
    requested_scope, requested_user_type, requested_lifecycle, account_action,
    provisioning_status, created_by
  ) values (
    v_provisioning, v_org, v_batch, v_import_row, null,
    '0000098', '0000098@almodawat.sa', 'pending.user@example.test',
    'Pending User', 'مستخدم قيد الإنشاء', '+966509876543',
    v_department, 'IT', 'Analyst', 'employee', 'assigned_only',
    'employee', 'active', 'create', 'queued', v_admin
  );

  -- Both forms of an open provisioning reservation are protected from direct
  -- legacy self-service profile edits: case-insensitive Employee ID and Auth
  -- alias. The second fixture deliberately separates the two values so the
  -- Auth-alias branch is proven independently.
  begin
    perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
    update public.profiles set employee_no = '0000098' where id = v_operator;
    raise exception 'TEST_FAILED_DIRECT_PROVISIONING_EMPLOYEE_ID_COLLISION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_EMPLOYEE_ID_CASE_INSENSITIVE_CONFLICT%' then raise; end if;
  end;
  begin
    insert into public.user_management_import_rows (
      id, organization_id, batch_id, row_number, raw_data, normalized_email,
      validation_status, validation_errors, validation_warnings,
      action_status, matched_user_id
    ) values (
      '83b00000-0000-4000-8000-000000000053', v_org, v_batch, 3,
      jsonb_build_object('employee_id', 'DIFFERENT-QUEUE-83U'),
      'reserved-queue-alias@almodawat.sa', 'valid',
      array[]::text[], array[]::text[], 'pending_account_creation', null
    );
    insert into public.user_account_provisioning (
      id, organization_id, import_batch_id, import_row_id, auth_user_id,
      employee_id, auth_email, contact_email, full_name_en, full_name_ar, phone,
      department_id, department_code, job_title, requested_role,
      requested_scope, requested_user_type, requested_lifecycle, account_action,
      provisioning_status, created_by
    ) values (
      '83b00000-0000-4000-8000-000000000063', v_org, v_batch,
      '83b00000-0000-4000-8000-000000000053', null,
      'DIFFERENT-QUEUE-83U', 'reserved-queue-alias@almodawat.sa', null,
      'Reserved Alias Proof', null, null, v_department, 'IT', 'Analyst',
      'employee', 'assigned_only', 'employee', 'active', 'create', 'queued', v_admin
    );
    perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
    update public.profiles
    set employee_no = 'RESERVED-QUEUE-ALIAS'
    where id = v_operator;
    raise exception 'TEST_FAILED_DIRECT_PROVISIONING_AUTH_ALIAS_COLLISION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_EMPLOYEE_ID_CASE_INSENSITIVE_CONFLICT%' then raise; end if;
  end;

  if public.patch83u_expected_auth_email(' 0000098 ') <> '0000098@almodawat.sa' then
    raise exception 'TEST_FAILED_EMPLOYEE_ID_AUTH_ALIAS';
  end if;
  if public.patch83u_expected_auth_email('11111') <> '11111@almodawat.sa' then
    raise exception 'TEST_FAILED_FIVE_DIGIT_EMPLOYEE_ID_AUTH_ALIAS';
  end if;
  if not public.patch83u_role_scope_allowed('employee', 'assigned_only')
    or public.patch83u_role_scope_allowed('employee', 'global')
    or public.patch83u_role_scope_allowed('division_head', 'global')
  then raise exception 'TEST_FAILED_STRICT_ROLE_SCOPE_MATRIX'; end if;
  if not public.patch83u_role_assignment_valid(v_org, 'global', null, null, null, null)
    or not public.patch83u_role_assignment_valid(v_org, 'global', v_org, null, null, null)
    or public.patch83u_role_assignment_valid(v_org, 'global', v_other_org, null, null, null)
    or public.patch83u_role_assignment_valid(v_org, 'global', null, null, v_department, null)
    or not public.patch83u_role_assignment_valid(v_org, 'assigned_only', v_org, null, null, null)
    or public.patch83u_role_assignment_valid(v_org, 'assigned_only', v_other_org, null, null, null)
  then raise exception 'TEST_FAILED_ROLE_ORGANIZATION_VALIDATOR'; end if;

  -- A historical malformed global Super Admin role is neither authorization nor
  -- an eligible backup for the last usable administrator. The universal active
  -- role trigger is disabled only long enough to model the pre-migration row.
  begin
    execute 'alter table public.user_roles disable trigger trg_patch83u_guard_role_activation';
    insert into public.user_roles (
      user_id, role, scope, organization_id, department_id, is_active
    ) values (
      v_operator, 'super_admin', 'global', v_org, v_department, true
    );
    execute 'alter table public.user_roles enable trigger trg_patch83u_guard_role_activation';

    begin
      perform public.patch83u_require_super_admin(v_operator);
      raise exception 'TEST_FAILED_MALFORMED_GLOBAL_SUPER_AUTHORIZED';
    exception when others then
      if sqlerrm not like '%PATCH83U_ACTIVE_SUPER_ADMIN_REQUIRED%' then raise; end if;
    end;

    begin
      update public.user_credential_states
      set credential_state = 'disabled'
      where user_id = v_admin;
      raise exception 'TEST_FAILED_MALFORMED_GLOBAL_SUPER_COUNTED_AS_BACKUP';
    exception when others then
      if sqlerrm not like '%PATCH83U_LAST_SUPER_ADMIN_CREDENTIAL_LOCK_DENIED%' then raise; end if;
    end;

    raise exception 'PATCH83U_TEST_MALFORMED_GLOBAL_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83U_TEST_MALFORMED_GLOBAL_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;

  -- Dedicated generic role routines derive tenant scope, return exact database
  -- proof, and audit both assignment and deactivation without browser RPC access.
  begin
    v_result := public.patch83u_assign_user_role(
      v_admin, v_operator, 'viewer', 'global', null, null, null,
      'Controlled generic role proof'
    );
    if nullif(v_result->>'user_role_id', '')::uuid is null
      or v_result->>'target_user_id' <> v_operator::text
      or v_result->>'organization_id' <> v_org::text
      or v_result->>'role' <> 'viewer'
      or v_result->>'scope' <> 'global'
      or v_result->>'division_id' is not null
      or v_result->>'department_id' is not null
      or v_result->>'unit_id' is not null
      or v_result->>'action' <> 'assigned'
      or (v_result->>'is_active')::boolean is distinct from true
    then raise exception 'TEST_FAILED_ROLE_ASSIGNMENT_DATABASE_PROOF'; end if;

    v_result := public.patch83u_deactivate_user_role(
      v_admin, (v_result->>'user_role_id')::uuid, 'Controlled deactivation proof'
    );
    if v_result->>'target_user_id' <> v_operator::text
      or v_result->>'organization_id' <> v_org::text
      or v_result->>'role' <> 'viewer'
      or v_result->>'scope' <> 'global'
      or v_result->>'action' <> 'deactivated'
      or (v_result->>'is_active')::boolean is distinct from false
    then raise exception 'TEST_FAILED_ROLE_DEACTIVATION_DATABASE_PROOF'; end if;

    begin
      perform public.patch83u_assign_user_role(
        v_operator, v_admin, 'viewer', 'global', null, null, null, null
      );
      raise exception 'TEST_FAILED_NON_ADMIN_ROLE_ASSIGNMENT_ALLOWED';
    exception when others then
      if sqlerrm not like '%PATCH83U_ACTIVE_ROLE_ADMIN_REQUIRED%' then raise; end if;
    end;
    begin
      perform public.patch83u_assign_user_role(
        v_admin, v_other_admin, 'viewer', 'global', null, null, null, null
      );
      raise exception 'TEST_FAILED_CROSS_ORG_ROLE_ASSIGNMENT_ALLOWED';
    exception when others then
      if sqlerrm not like '%PATCH83U_ROLE_TARGET_NOT_FOUND%' then raise; end if;
    end;

    raise exception 'PATCH83U_TEST_ROLE_ROUTINES_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83U_TEST_ROLE_ROUTINES_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;

  -- Direct authenticated user_roles writes remain subject to restrictive RLS
  -- even though historical permissive policies are preserved. A scoped
  -- Governance Admin cannot mutate roles; a canonical global Governance Admin
  -- may mutate only non-privileged same-tenant roles; and privileged roles
  -- require a canonical global Super Admin. Self and cross-tenant mutations are
  -- always denied by the side-effect-free policy decision.
  begin
    perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
    insert into public.user_roles (
      id, user_id, role, scope, organization_id, department_id, is_active
    ) values (
      '83b00000-0000-4000-8000-000000000034',
      v_operator, 'governance_admin', 'department', v_org, v_department, true
    );

    perform pg_catalog.set_config('request.jwt.claim.sub', v_operator::text, true);
    perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
    if public.patch83u_user_role_mutation_allowed(
      v_admin, 'employee', 'assigned_only', v_org, null, null, null
    ) then
      raise exception 'TEST_FAILED_SCOPED_GOVERNANCE_DIRECT_ROLE_MUTATION_ALLOWED';
    end if;

    perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
    update public.user_roles
    set scope = 'global', department_id = null
    where id = '83b00000-0000-4000-8000-000000000034';
    perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

    if public.patch83u_user_role_mutation_allowed(
      v_admin, 'employee', 'assigned_only', v_org, null, null, null
    ) is distinct from true then
      raise exception 'TEST_FAILED_CANONICAL_GOVERNANCE_NONPRIVILEGED_ROLE_MUTATION_DENIED';
    end if;
    if public.patch83u_user_role_mutation_allowed(
      v_admin, 'super_admin', 'global', v_org, null, null, null
    ) then
      raise exception 'TEST_FAILED_GOVERNANCE_PRIVILEGED_DIRECT_ROLE_MUTATION_ALLOWED';
    end if;
    if public.patch83u_user_role_mutation_allowed(
      v_other_admin, 'employee', 'assigned_only', v_other_org, null, null, null
    ) then
      raise exception 'TEST_FAILED_CROSS_ORG_DIRECT_ROLE_MUTATION_ALLOWED';
    end if;
    if public.patch83u_user_role_mutation_allowed(
      v_operator, 'employee', 'assigned_only', v_org, null, null, null
    ) then
      raise exception 'TEST_FAILED_DIRECT_SELF_ROLE_MUTATION_ALLOWED';
    end if;

    perform pg_catalog.set_config('request.jwt.claim.sub', v_admin::text, true);
    if public.patch83u_user_role_mutation_allowed(
      v_operator, 'super_admin', 'global', v_org, null, null, null
    ) is distinct from true then
      raise exception 'TEST_FAILED_CANONICAL_SUPER_PRIVILEGED_ROLE_MUTATION_DENIED';
    end if;

    raise exception 'PATCH83U_TEST_DIRECT_ROLE_POLICY_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83U_TEST_DIRECT_ROLE_POLICY_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;

  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'user_roles'
        and policyname in (
          'patch83u_user_roles_insert_gate',
          'patch83u_user_roles_update_gate',
          'patch83u_user_roles_delete_gate'
        ) and permissive = 'RESTRICTIVE') <> 3
    or not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'user_roles'
        and policyname = 'patch83u_user_roles_insert_gate'
        and cmd = 'INSERT'
        and with_check like '%patch83u_user_role_mutation_allowed%'
    )
    or not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'user_roles'
        and policyname = 'patch83u_user_roles_update_gate'
        and cmd = 'UPDATE'
        and qual like '%patch83u_user_role_mutation_allowed%'
        and with_check like '%patch83u_user_role_mutation_allowed%'
    )
    or not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'user_roles'
        and policyname = 'patch83u_user_roles_delete_gate'
        and cmd = 'DELETE'
        and qual like '%patch83u_user_role_mutation_allowed%'
    )
  then raise exception 'TEST_FAILED_USER_ROLES_RESTRICTIVE_MUTATION_GATES'; end if;

  -- Storage sits outside public, so its four credential gates need independent
  -- restrictive policies with the correct USING/WITH CHECK shapes.
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname in (
          'patch83u_storage_credential_read_gate',
          'patch83u_storage_credential_insert_gate',
          'patch83u_storage_credential_update_gate',
          'patch83u_storage_credential_delete_gate'
        ) and permissive = 'RESTRICTIVE') <> 4
    or not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'patch83u_storage_credential_read_gate'
        and cmd = 'SELECT' and qual like '%patch83u_credential_access_allowed%'
    )
    or not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'patch83u_storage_credential_insert_gate'
        and cmd = 'INSERT' and with_check like '%patch83u_credential_access_allowed%'
    )
    or not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'patch83u_storage_credential_update_gate'
        and cmd = 'UPDATE'
        and qual like '%patch83u_credential_access_allowed%'
        and with_check like '%patch83u_credential_access_allowed%'
    )
    or not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'patch83u_storage_credential_delete_gate'
        and cmd = 'DELETE' and qual like '%patch83u_credential_access_allowed%'
    )
  then raise exception 'TEST_FAILED_STORAGE_RESTRICTIVE_CREDENTIAL_GATES'; end if;

  select count(*) into v_events_before
  from public.user_credential_events
  where provisioning_id = v_provisioning;

  -- Every state-changing RPC is service-role-only. Rejection must leave the
  -- queue, target identity, and evidence tables untouched.
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.patch83u_claim_provisioning(
      v_admin, v_provisioning, 'proof.non-service', '0000098'
    );
    raise exception 'TEST_FAILED_NON_SERVICE_CLAIM_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_SERVICE_ROLE_REQUIRED%' then raise; end if;
  end;
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  if not exists (
    select 1 from public.user_account_provisioning
    where id = v_provisioning and provisioning_status = 'queued'
      and auth_user_id is null and attempt_count = 0
  )
    or exists (select 1 from public.profiles where id = v_target)
    or exists (select 1 from auth.users where id = v_target)
    or (select count(*) from public.user_credential_events where provisioning_id = v_provisioning) <> v_events_before
  then raise exception 'TEST_FAILED_NON_SERVICE_REJECTION_WROTE_DATA'; end if;

  -- An active user without the exact same-organization Super Admin assignment
  -- cannot claim; neither can a Super Admin from another organization.
  begin
    perform public.patch83u_claim_provisioning(
      v_operator, v_provisioning, 'proof.non-admin', '0000098'
    );
    raise exception 'TEST_FAILED_NON_ADMIN_CLAIM_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_ACTIVE_SUPER_ADMIN_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.patch83u_claim_provisioning(
      v_other_admin, v_provisioning, 'proof.cross-org', '0000098'
    );
    raise exception 'TEST_FAILED_CROSS_ORG_CLAIM_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_PROVISIONING_NOT_FOUND%' then raise; end if;
  end;

  if not exists (
    select 1 from public.user_account_provisioning
    where id = v_provisioning and provisioning_status = 'queued'
      and auth_user_id is null and attempt_count = 0
  )
    or exists (select 1 from public.profiles where id = v_target)
    or exists (select 1 from auth.users where id = v_target)
    or (select count(*) from public.user_credential_events where provisioning_id = v_provisioning) <> v_events_before
  then raise exception 'TEST_FAILED_ADMIN_SCOPE_REJECTION_WROTE_DATA'; end if;

  begin
    perform public.patch83u_claim_provisioning(
      v_admin, v_provisioning, 'proof.wrong-employee-id', 'WRONG-ID'
    );
    raise exception 'TEST_FAILED_WRONG_EMPLOYEE_ID_CLAIM_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_EMPLOYEE_ID_CONFIRMATION_REQUIRED%' then raise; end if;
  end;
  if not exists (
    select 1 from public.user_account_provisioning
    where id = v_provisioning and provisioning_status = 'queued'
      and auth_user_id is null and attempt_count = 0
  )
    or (select count(*) from public.user_credential_events where provisioning_id = v_provisioning) <> v_events_before
  then raise exception 'TEST_FAILED_CLAIM_CONFIRMATION_REJECTION_WROTE_DATA'; end if;

  -- Claim returns the complete server-owned snapshot only to the trusted Edge
  -- handler. At this point no Auth identity or profile has been created.
  v_claim := public.patch83u_claim_provisioning(
    v_admin, v_provisioning, 'proof.provision.0000098', '0000098'
  );
  v_attempt := nullif(v_claim->>'attempt_id', '')::uuid;
  if v_attempt is null
    or v_claim->>'employee_id' <> '0000098'
    or v_claim->>'auth_email' <> '0000098@almodawat.sa'
    or v_claim->>'contact_email' <> 'pending.user@example.test'
    or v_claim->>'account_action' <> 'create'
    or (v_claim->>'auth_create_required')::boolean is distinct from true
    or nullif(v_claim->>'auth_user_id', '') is not null
  then raise exception 'TEST_FAILED_PROVISIONING_CLAIM_SNAPSHOT'; end if;
  if not exists (
    select 1 from public.user_account_provisioning
    where id = v_provisioning and provisioning_status = 'provisioning'
      and attempt_id = v_attempt and auth_user_id is null
      and claimed_by = v_admin and attempt_count = 1
  ) then raise exception 'TEST_FAILED_PROVISIONING_CLAIM_DATABASE_STATE'; end if;

  -- Hosted Auth policy rejection is retryable without inventing a different
  -- password and retains only the exact safe policy message. The subtransaction
  -- is rolled back so the same claim can continue into finalization below.
  begin
    v_result := public.patch83u_fail_provisioning(
      v_admin, v_provisioning, v_attempt,
      'PATCH83U_INITIAL_PASSWORD_POLICY_BLOCKED',
      'raw provider policy detail must not be retained', false
    );
    if v_result->>'provisioning_status' <> 'policy_blocked'
      or (v_result->>'retryable')::boolean is distinct from true
      or not exists (
        select 1 from public.user_account_provisioning
        where id = v_provisioning
          and provisioning_status = 'policy_blocked'
          and last_error_code = 'PATCH83U_INITIAL_PASSWORD_POLICY_BLOCKED'
          and last_error_message = 'The current Supabase Auth password policy does not accept this Employee ID as the initial password.'
      )
    then
      raise exception 'TEST_FAILED_INITIAL_PASSWORD_POLICY_MAPPING';
    end if;
    raise exception 'PATCH83U_TEST_POLICY_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83U_TEST_POLICY_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;

  if exists (select 1 from public.profiles where id = v_target)
    or exists (select 1 from auth.users where id = v_target)
  then raise exception 'TEST_FAILED_CLAIM_CREATED_IDENTITY'; end if;

  -- Finalization cannot trust an Edge payload alone: it requires an exact
  -- auth.users identity and server-written metadata to exist in the database.
  begin
    perform public.patch83u_finalize_provisioning(
      v_admin, v_provisioning, v_attempt, v_target, '0000098@almodawat.sa'
    );
    raise exception 'TEST_FAILED_FINALIZE_WITHOUT_AUTH_PROOF_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_AUTH_DATABASE_PROOF_FAILED%' then raise; end if;
  end;
  if exists (select 1 from public.profiles where id = v_target)
    or not exists (
      select 1 from public.user_account_provisioning
      where id = v_provisioning and provisioning_status = 'provisioning'
        and attempt_id = v_attempt and auth_user_id is null
    )
  then raise exception 'TEST_FAILED_AUTH_PROOF_REJECTION_WROTE_DATA'; end if;

  -- This fixture represents the result returned by the server-side Auth Admin
  -- API. No password or token is passed to a database function or persisted in
  -- any Patch 83U public table.
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, created_at, updated_at
  ) values (
    v_target, 'authenticated', 'authenticated', '0000098@almodawat.sa', '', now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'credential_version', 1,
      'patch83u_provisioning_id', v_provisioning::text
    ),
    now(), now()
  );

  begin
    perform public.patch83u_finalize_provisioning(
      v_admin, v_provisioning, v_attempt, v_target, 'wrong@almodawat.sa'
    );
    raise exception 'TEST_FAILED_WRONG_AUTH_EMAIL_FINALIZE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_AUTH_IDENTITY_CONFLICT%' then raise; end if;
  end;
  if exists (select 1 from public.profiles where id = v_target) then
    raise exception 'TEST_FAILED_WRONG_AUTH_EMAIL_REJECTION_WROTE_PROFILE';
  end if;

  v_result := public.patch83u_finalize_provisioning(
    v_admin, v_provisioning, v_attempt, v_target, '0000098@almodawat.sa'
  );
  if v_result->>'profile_id' <> v_target::text
    or v_result->>'provisioning_status' <> 'initial_change_required'
    or v_result->>'credential_state' <> 'initial_change_required'
    or (v_result->>'credential_version')::integer <> 1
    or (v_result->>'must_change_password')::boolean is distinct from true
  then raise exception 'TEST_FAILED_PROVISIONING_FINALIZE_RESULT'; end if;

  if not exists (
    select 1 from public.user_account_provisioning
    where id = v_provisioning and organization_id = v_org
      and auth_user_id = v_target and profile_id = v_target
      and provisioning_status = 'initial_change_required'
      and attempt_id is null and lease_expires_at is null
  ) then raise exception 'TEST_FAILED_PROVISIONING_BINDING'; end if;
  if not exists (
    select 1 from public.profiles
    where id = v_target and organization_id = v_org and employee_no = '0000098'
      and email = '0000098@almodawat.sa'
      and contact_email = 'pending.user@example.test' and full_name_en = 'Pending User'
      and full_name_ar = 'مستخدم قيد الإنشاء' and phone = '+966509876543'
      and department_id = v_department and job_title = 'Analyst'
      and user_status = 'invited' and is_active = true
  ) then raise exception 'TEST_FAILED_PROVISIONED_PROFILE'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and organization_id = v_org
      and provisioning_id = v_provisioning
      and auth_email = '0000098@almodawat.sa'
      and identity_mode = 'employee_id_managed'
      and credential_state = 'initial_change_required'
      and requested_lifecycle = 'active' and credential_version = 1
  ) then raise exception 'TEST_FAILED_INITIAL_CREDENTIAL_STATE'; end if;
  if not exists (
    select 1 from public.user_roles
    where user_id = v_target and organization_id = v_org
      and role = 'employee' and scope = 'assigned_only' and is_active = false
  ) then raise exception 'TEST_FAILED_PROVISIONED_ROLE_NOT_HELD'; end if;
  begin
    update public.user_roles
    set is_active = true
    where user_id = v_target and role = 'employee' and scope = 'assigned_only';
    raise exception 'TEST_FAILED_LOCKED_CREDENTIAL_ROLE_ACTIVATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_ACTIVE_ROLE_CREDENTIAL_LOCKED%' then raise; end if;
  end;
  if exists (select 1 from public.user_roles where user_id = v_target and is_active) then
    raise exception 'TEST_FAILED_LOCKED_CREDENTIAL_ROLE_ACTIVATION_WROTE_STATE';
  end if;
  if (select count(*) from public.user_credential_events
      where provisioning_id = v_provisioning
        and event_type in ('provisioning_claimed', 'auth_account_verified', 'profile_created_invited')) <> 3
  then raise exception 'TEST_FAILED_PROVISIONING_EVIDENCE'; end if;

  begin
    update public.profiles set employee_no = '0000098-CHANGED' where id = v_target;
    raise exception 'TEST_FAILED_MANAGED_EMPLOYEE_ID_CHANGE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_MANAGED_EMPLOYEE_ID_IMMUTABLE%' then raise; end if;
  end;
  begin
    update public.user_credential_states
    set auth_email = 'different@almodawat.sa'
    where user_id = v_target;
    raise exception 'TEST_FAILED_MANAGED_AUTH_ALIAS_CHANGE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_MANAGED_AUTH_IDENTITY_MISMATCH%' then raise; end if;
  end;
  if not exists (
    select 1
    from public.profiles p
    join public.user_credential_states cs on cs.user_id = p.id
    where p.id = v_target and p.employee_no = '0000098'
      and cs.identity_mode = 'employee_id_managed'
      and cs.auth_email = '0000098@almodawat.sa'
  ) then raise exception 'TEST_FAILED_MANAGED_IDENTITY_GUARD_WROTE_STATE'; end if;

  -- The protected Patch 83U tables may contain state and evidence only.
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name in (
        'user_account_provisioning', 'user_credential_states',
        'user_credential_events', 'user_credential_suspended_roles'
      )
      and c.column_name in (
        'password', 'passwd', 'temporary_password', 'password_hash',
        'encrypted_password', 'secret', 'bearer_token', 'access_token',
        'refresh_token', 'credential_hash'
      )
  ) then raise exception 'TEST_FAILED_CREDENTIAL_MATERIAL_COLUMN_EXISTS'; end if;

  -- A real Auth session may authenticate with the initial Employee-ID password,
  -- but the managed state must still block application access until rotation.
  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (v_session, v_target, clock_timestamp(), clock_timestamp());

  v_result := public.patch83u_get_credential_state(
    v_target, 1, '0000098@almodawat.sa', v_session::text
  );
  if (v_result->>'access_allowed')::boolean is distinct from false
    or (v_result->>'change_required')::boolean is distinct from true
    or v_result->>'credential_state' <> 'initial_change_required'
  then raise exception 'TEST_FAILED_INITIAL_PASSWORD_ACCESS_GATE'; end if;

  begin
    perform public.patch83u_begin_required_password_change(v_target, v_session::text, 0);
    raise exception 'TEST_FAILED_STALE_VERSION_CHANGE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_CREDENTIAL_VERSION_STALE%' then raise; end if;
  end;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'initial_change_required'
      and credential_version = 1 and pending_operation_id is null
  ) then raise exception 'TEST_FAILED_STALE_VERSION_REJECTION_WROTE_STATE'; end if;

  v_result := public.patch83u_begin_required_password_change(
    v_target, v_session::text, 1
  );
  v_operation := nullif(v_result->>'operation_id', '')::uuid;
  if v_operation is null
    or v_result->>'employee_id' <> '0000098'
    or v_result->>'auth_email' <> '0000098@almodawat.sa'
    or v_result->>'identity_mode' <> 'employee_id_managed'
    or (v_result->>'current_credential_version')::integer <> 1
    or (v_result->>'next_credential_version')::integer <> 2
  then raise exception 'TEST_FAILED_PASSWORD_CHANGE_BEGIN_RESULT'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'password_change_in_progress'
      and pending_operation_id = v_operation and pending_session_id = v_session
      and pending_credential_version = 2 and credential_version = 1
      and operation_source = 'password_change'
      and reconciliation_auth_changed = false
  ) then raise exception 'TEST_FAILED_PASSWORD_CHANGE_BEGIN_STATE'; end if;

  -- A database transition cannot claim that the password changed until the
  -- server-side Auth update has also advanced the protected metadata version.
  begin
    perform public.patch83u_finalize_required_password_change(
      v_target, v_operation, 2, '0000098@almodawat.sa'
    );
    raise exception 'TEST_FAILED_PASSWORD_CHANGE_WITHOUT_AUTH_PROOF_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_PASSWORD_CHANGE_DATABASE_PROOF_FAILED%' then raise; end if;
  end;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'password_change_in_progress'
      and pending_operation_id = v_operation and credential_version = 1
  )
    or exists (select 1 from public.user_roles where user_id = v_target and is_active = true)
  then raise exception 'TEST_FAILED_PASSWORD_CHANGE_PROOF_REJECTION_WROTE_STATE'; end if;

  -- This metadata-only fixture represents the successful server-side Auth
  -- password update. The password value itself is never passed to PostgreSQL.
  update auth.users
  set raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{credential_version}',
        '2'::jsonb,
        true
      ),
      updated_at = clock_timestamp()
  where id = v_target;

  begin
    perform public.patch83u_finalize_required_password_change(
      v_target, v_operation, 2, '0000098@almodawat.sa'
    );
    raise exception 'TEST_FAILED_PASSWORD_CHANGE_WITH_LIVE_SESSIONS_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_AUTH_SESSIONS_STILL_ACTIVE%' then raise; end if;
  end;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'password_change_in_progress'
      and pending_operation_id = v_operation and credential_version = 1
  ) then raise exception 'TEST_FAILED_LIVE_SESSION_REJECTION_WROTE_STATE'; end if;

  delete from auth.sessions where user_id = v_target;
  v_result := public.patch83u_confirm_session_revocation(
    v_target, v_target, 'proof.initial-change.sessions-revoked'
  );
  if (v_result->>'sessions_revoked')::boolean is distinct from true then
    raise exception 'TEST_FAILED_INITIAL_CHANGE_SESSION_REVOCATION_PROOF';
  end if;

  v_result := public.patch83u_finalize_required_password_change(
    v_target, v_operation, 2, '0000098@almodawat.sa'
  );
  if v_result->>'credential_state' <> 'active'
    or (v_result->>'credential_version')::integer <> 2
    or (v_result->>'must_reauthenticate')::boolean is distinct from true
    or (v_result->>'reconciliation_required')::boolean is distinct from false
  then raise exception 'TEST_FAILED_PASSWORD_CHANGE_FINALIZE_RESULT'; end if;

  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'active'
      and credential_version = 2 and invalidated_session_id = v_session
      and pending_operation_id is null and pending_session_id is null
      and role_suspension_id is null and operation_source is null
      and reconciliation_auth_changed = false
      and password_changed_at is not null and sessions_revoked_at is not null
  ) then raise exception 'TEST_FAILED_ACTIVE_CREDENTIAL_STATE'; end if;
  if not exists (
    select 1 from public.profiles
    where id = v_target and user_status = 'active' and is_active = true
  ) then raise exception 'TEST_FAILED_PROFILE_NOT_ACTIVATED'; end if;
  if not exists (
    select 1 from public.user_roles
    where user_id = v_target and organization_id = v_org
      and role = 'employee' and scope = 'assigned_only' and is_active = true
  ) then raise exception 'TEST_FAILED_HELD_ROLE_NOT_ACTIVATED'; end if;
  if not exists (
    select 1 from public.user_account_provisioning
    where id = v_provisioning and provisioning_status = 'completed'
      and completed_at is not null
  ) then raise exception 'TEST_FAILED_PROVISIONING_NOT_COMPLETED'; end if;

  -- The controlled profile RPC keeps contact data separate from the immutable
  -- managed login identity and independently enforces administrator authority.
  begin
    perform public.patch83t_update_user_profile(
      v_operator, v_target,
      jsonb_build_object('phone', '+966501222222', 'reason', 'Unauthorized proof')
    );
    raise exception 'TEST_FAILED_NON_ADMIN_PROFILE_UPDATE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_ACTIVE_USER_ADMIN_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.patch83t_update_user_profile(
      v_admin, v_target,
      jsonb_build_object(
        'employee_id', '0000098-CHANGED',
        'reason', 'Managed identity mutation proof'
      )
    );
    raise exception 'TEST_FAILED_MANAGED_PROFILE_RPC_EMPLOYEE_ID_CHANGE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_MANAGED_EMPLOYEE_ID_IMMUTABLE%' then raise; end if;
  end;

  v_result := public.patch83t_update_user_profile(
    v_admin, v_target,
    jsonb_build_object(
      'contact_email', 'updated.profile@example.test',
      'phone', '0501234567',
      'reason', 'Controlled profile contact proof'
    )
  );
  if not exists (
    select 1 from public.profiles
    where id = v_target and employee_no = '0000098'
      and email = '0000098@almodawat.sa'
      and contact_email = 'updated.profile@example.test'
      and phone = '+966501234567'
  )
    or not exists (
      select 1 from public.user_management_audit_history
      where target_user_id = v_target and actor_id = v_admin
        and action = 'profile_updated'
        and old_data->>'auth_email' = '0000098@almodawat.sa'
        and new_data->>'contact_email' = 'updated.profile@example.test'
        and new_data->>'phone' = '+966501234567'
    )
  then raise exception 'TEST_FAILED_CONTROLLED_PROFILE_CONTACT_UPDATE'; end if;

  -- Restore the immutable provisioning snapshot before later reconciliation;
  -- both writes remain controlled and audited.
  perform public.patch83t_update_user_profile(
    v_admin, v_target,
    jsonb_build_object(
      'contact_email', 'pending.user@example.test',
      'phone', '+966509876543',
      'reason', 'Restore provisioning snapshot for reconciliation proof'
    )
  );

  -- Canonical profile lifecycle transitions are atomic with credential locking
  -- and role suspension. A valid reactivation clears stale deactivation metadata
  -- but remains credential-locked until a new password change succeeds.
  begin
    update public.profiles
    set user_status = 'inactive',
        is_active = true,
        deactivated_by = v_admin,
        deactivation_reason = 'Controlled lifecycle invariant proof',
        last_reviewed_at = clock_timestamp()
    where id = v_target;

    if not exists (
      select 1 from public.profiles
      where id = v_target and user_status = 'inactive' and is_active = false
        and deactivated_at is not null and deactivated_by = v_admin
        and deactivation_reason = 'Controlled lifecycle invariant proof'
        and last_reviewed_at is not null
    )
      or not exists (
        select 1 from public.user_credential_states
        where user_id = v_target and credential_state = 'disabled'
          and role_suspension_id is not null
      )
      or exists (select 1 from public.user_roles where user_id = v_target and is_active)
    then raise exception 'TEST_FAILED_INACTIVE_LIFECYCLE_NOT_ATOMIC'; end if;

    update public.profiles
    set user_status = 'active', is_active = true, last_reviewed_at = clock_timestamp()
    where id = v_target;

    if not exists (
      select 1 from public.profiles
      where id = v_target and user_status = 'active' and is_active = true
        and deactivated_at is null and deactivated_by is null
        and deactivation_reason is null and last_reviewed_at is not null
    )
      or not exists (
        select 1 from public.user_credential_states
        where user_id = v_target and credential_state = 'reactivation_change_required'
          and role_suspension_id is not null
      )
      or exists (select 1 from public.user_roles where user_id = v_target and is_active)
    then raise exception 'TEST_FAILED_REACTIVATION_LIFECYCLE_NOT_LOCKED'; end if;

    raise exception 'PATCH83U_TEST_LIFECYCLE_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83U_TEST_LIFECYCLE_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;

  if not exists (
    select 1 from public.profiles
    where id = v_target and user_status = 'active' and is_active = true
      and deactivated_at is null and deactivated_by is null and deactivation_reason is null
  )
    or not exists (
      select 1 from public.user_credential_states
      where user_id = v_target and credential_state = 'active'
        and role_suspension_id is null
    )
    or not exists (select 1 from public.user_roles where user_id = v_target and is_active)
  then raise exception 'TEST_FAILED_LIFECYCLE_SUBTRANSACTION_ROLLBACK'; end if;

  -- The session used to change the password is explicitly invalidated even if
  -- its Auth row still exists; only a new session with the advanced version may
  -- pass the credential gate.
  v_result := public.patch83u_get_credential_state(
    v_target, 2, '0000098@almodawat.sa', v_session::text
  );
  if (v_result->>'access_allowed')::boolean is distinct from false then
    raise exception 'TEST_FAILED_PASSWORD_CHANGE_SESSION_NOT_INVALIDATED';
  end if;

  insert into auth.sessions (id, user_id, created_at, updated_at)
  select v_stale_session, v_target,
    cs.session_valid_after - interval '1 microsecond',
    cs.session_valid_after - interval '1 microsecond'
  from public.user_credential_states cs
  where cs.user_id = v_target;
  v_result := public.patch83u_get_credential_state(
    v_target, 2, '0000098@almodawat.sa', v_stale_session::text
  );
  if (v_result->>'access_allowed')::boolean is distinct from false then
    raise exception 'TEST_FAILED_PRE_CUTOFF_SESSION_ALLOWED';
  end if;

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (
    v_new_session,
    v_target,
    date_trunc('second', clock_timestamp()) + interval '1 second',
    date_trunc('second', clock_timestamp()) + interval '1 second'
  );
  v_result := public.patch83u_get_credential_state(
    v_target, 2, '0000098@almodawat.sa', v_new_session::text
  );
  if (v_result->>'access_allowed')::boolean is distinct from true then
    raise exception 'TEST_FAILED_FRESH_SESSION_NOT_ALLOWED';
  end if;
  v_result := public.patch83u_get_credential_state(
    v_target, 1, '0000098@almodawat.sa', v_new_session::text
  );
  if (v_result->>'access_allowed')::boolean is distinct from false then
    raise exception 'TEST_FAILED_STALE_CREDENTIAL_VERSION_ALLOWED';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_target::text, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_target,
      'role', 'authenticated',
      'email', '0000098@almodawat.sa',
      'session_id', v_new_session,
      'iat', floor(extract(epoch from clock_timestamp() + interval '2 seconds'))::bigint,
      'app_metadata', jsonb_build_object('credential_version', 2)
    )::text,
    true
  );
  if public.patch83u_credential_access_allowed() is distinct from true then
    raise exception 'TEST_FAILED_RLS_CREDENTIAL_GATE_DENIED_FRESH_SESSION';
  end if;
  perform pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_target,
      'role', 'authenticated',
      'email', '0000098@almodawat.sa',
      'session_id', v_new_session,
      'iat', floor(extract(epoch from clock_timestamp() + interval '2 seconds'))::bigint,
      'app_metadata', jsonb_build_object('credential_version', 1)
    )::text,
    true
  );
  if public.patch83u_credential_access_allowed() is distinct from false then
    raise exception 'TEST_FAILED_RLS_CREDENTIAL_GATE_ALLOWED_STALE_VERSION';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  -- Reset requires a same-organization active Super Admin, exact Employee ID,
  -- a reason, and a manually entered password held only by the Edge handler.
  begin
    perform public.patch83u_begin_admin_reset(
      v_operator, v_target, 'proof.reset.non-super-admin', '0000098',
      'Only a global Super Admin may reset credentials',
      'PATCH83U_RESET_USER_PASSWORD'
    );
    raise exception 'TEST_FAILED_NON_SUPER_ADMIN_RESET_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_ACTIVE_SUPER_ADMIN_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.patch83u_begin_admin_reset(
      v_admin, v_target, 'proof.reset.wrong-confirmation', '0000098',
      'Wrong backend confirmation must be rejected', 'RESET USER PASSWORD'
    );
    raise exception 'TEST_FAILED_WRONG_RESET_CONFIRMATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_RESET_CONFIRMATION_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.patch83u_begin_admin_reset(
      v_admin, v_admin, 'proof.reset.self', 'ADMIN-83U', 'Self reset must be rejected',
      'PATCH83U_RESET_USER_PASSWORD'
    );
    raise exception 'TEST_FAILED_SELF_RESET_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_SELF_RESET_DENIED%' then raise; end if;
  end;
  begin
    perform public.patch83u_begin_admin_reset(
      v_admin, v_target, 'proof.reset.wrong-id', 'WRONG-ID', 'Wrong identity must be rejected',
      'PATCH83U_RESET_USER_PASSWORD'
    );
    raise exception 'TEST_FAILED_WRONG_EMPLOYEE_CONFIRMATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_EMPLOYEE_ID_CONFIRMATION_REQUIRED%' then raise; end if;
  end;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'active' and credential_version = 2
  )
    or not exists (select 1 from public.user_roles where user_id = v_target and is_active = true)
    or exists (
      select 1 from public.user_credential_suspended_roles
      where user_id = v_target
    )
  then raise exception 'TEST_FAILED_RESET_AUTHORIZATION_REJECTION_WROTE_STATE'; end if;

  v_result := public.patch83u_begin_admin_reset(
    v_admin,
    v_target,
    'proof.reset.0000098',
    '0000098',
    'Controlled SQL proof administrator reset',
    'PATCH83U_RESET_USER_PASSWORD'
  );
  v_operation := nullif(v_result->>'operation_id', '')::uuid;
  if v_operation is null
    or (v_result->>'current_credential_version')::integer <> 2
    or (v_result->>'next_credential_version')::integer <> 3
    or (v_result->>'roles_suspended')::integer <> 1
  then raise exception 'TEST_FAILED_ADMIN_RESET_BEGIN_RESULT'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'reset_in_progress'
      and pending_operation_id = v_operation and pending_credential_version = 3
      and role_suspension_id is not null
      and operation_source = 'admin_reset'
      and reconciliation_auth_changed = false
      and password_reset_at is null
  )
    or exists (select 1 from public.user_roles where user_id = v_target and is_active = true)
    or not exists (
      select 1 from public.user_credential_suspended_roles
      where user_id = v_target and suspension_status = 'suspended'
    )
  then raise exception 'TEST_FAILED_ADMIN_RESET_SUSPENSION_STATE'; end if;

  begin
    perform public.patch83u_finalize_admin_reset(
      v_admin, v_target, v_operation, 3, '0000098@almodawat.sa'
    );
    raise exception 'TEST_FAILED_ADMIN_RESET_WITHOUT_AUTH_PROOF_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_ADMIN_RESET_DATABASE_PROOF_FAILED%' then raise; end if;
  end;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'reset_in_progress'
      and pending_operation_id = v_operation and credential_version = 2
      and password_reset_at is null
  )
    or exists (select 1 from public.user_roles where user_id = v_target and is_active = true)
  then raise exception 'TEST_FAILED_ADMIN_RESET_PROOF_REJECTION_WROTE_STATE'; end if;

  -- With no Auth write, abort(false) may restore access only because this reset
  -- began from active. The completed suspension remains immutable evidence while
  -- the active credential state drops its pointer to that historical set.
  v_result := public.patch83u_abort_admin_reset(
    v_admin, v_target, v_operation, false,
    'PATCH83U_PROOF_ABORT_NO_AUTH_CHANGE',
    'The controlled proof aborted before the Auth write.'
  );
  if v_result->>'credential_state' <> 'active'
    or (v_result->>'reconciliation_required')::boolean is distinct from false
  then raise exception 'TEST_FAILED_ACTIVE_ABORT_RESULT'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'active'
      and credential_version = 2 and role_suspension_id is null
      and operation_source is null and reconciliation_auth_changed = false
  )
    or not exists (select 1 from public.user_roles where user_id = v_target and is_active = true)
  then raise exception 'TEST_FAILED_ACTIVE_ABORT_ROLE_RESTORE'; end if;

  -- Force one protected role snapshot into an invalid organization shape. The
  -- abort must fail closed with its unchanged-Auth provenance intact; once the
  -- reference is repaired, reconciliation may restore the prior active state
  -- only from database proof and must report the exact controlled outcome.
  insert into public.user_roles (
    user_id, role, scope, organization_id, is_active, assigned_by
  ) values (
    v_target, 'viewer', 'assigned_only', v_org, true, v_admin
  );
  v_result := public.patch83u_begin_admin_reset(
    v_admin, v_target, 'proof.reset.blocked-restore', '0000098',
    'Controlled blocked role restoration proof', 'PATCH83U_RESET_USER_PASSWORD'
  );
  v_operation := nullif(v_result->>'operation_id', '')::uuid;
  select role_suspension_id into v_suspension
  from public.user_credential_states where user_id = v_target;
  update public.user_credential_suspended_roles
  set role_organization_id = v_other_org
  where suspension_id = v_suspension and user_id = v_target and role = 'viewer';

  v_result := public.patch83u_abort_admin_reset(
    v_admin, v_target, v_operation, false,
    'PATCH83U_PROOF_ROLE_RESTORE_BLOCKED',
    'The protected role reference requires reconciliation.'
  );
  if v_result->>'credential_state' <> 'recovery_required'
    or (v_result->>'recovery_required')::boolean is distinct from true
    or (v_result->>'reconciliation_required')::boolean is distinct from true
  then raise exception 'TEST_FAILED_BLOCKED_ABORT_RESULT'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'recovery_required'
      and credential_version = 2 and role_suspension_id = v_suspension
      and operation_source = 'admin_reset'
      and reconciliation_auth_changed = false
      and operation_previous_state = 'active'
  )
    or exists (select 1 from public.user_roles where user_id = v_target and is_active = true)
    or not exists (
      select 1 from public.user_credential_suspended_roles
      where suspension_id = v_suspension and suspension_status = 'blocked'
        and role = 'viewer'
    )
    or not exists (
      select 1 from public.user_credential_suspended_roles
      where suspension_id = v_suspension and suspension_status = 'suspended'
        and role = 'employee'
    )
  then raise exception 'TEST_FAILED_BLOCKED_ABORT_EVIDENCE'; end if;

  update public.user_credential_suspended_roles
  set role_organization_id = v_org
  where suspension_id = v_suspension and user_id = v_target and role = 'viewer';
  v_result := public.patch83u_reconcile_credential_state(
    v_admin, v_target, 'proof.reset.blocked-restore.finish', '0000098'
  );
  if v_result->>'credential_state' <> 'active'
    or v_result->>'outcome' <> 'admin_reset_abort_restored_from_database_proof'
    or (v_result->>'reconciliation_required')::boolean is distinct from false
  then raise exception 'TEST_FAILED_ABORT_RECONCILIATION_OUTCOME'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'active'
      and credential_version = 2 and role_suspension_id is null
      and operation_source is null and reconciliation_auth_changed = false
  )
    or (select count(*) from public.user_roles where user_id = v_target and is_active = true) <> 2
  then raise exception 'TEST_FAILED_ABORT_RECONCILIATION_RESTORE'; end if;

  v_result := public.patch83u_begin_admin_reset(
    v_admin, v_target, 'proof.reset.execute', '0000098',
    'Controlled SQL proof administrator reset', 'PATCH83U_RESET_USER_PASSWORD'
  );
  v_operation := nullif(v_result->>'operation_id', '')::uuid;
  if v_operation is null or (v_result->>'next_credential_version')::integer <> 3 then
    raise exception 'TEST_FAILED_ADMIN_RESET_EXECUTION_BEGIN';
  end if;

  -- Metadata version 3 represents the server-side Auth update with the manually
  -- entered temporary password; the password itself never enters this test/RPC.
  update auth.users
  set raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{credential_version}',
        '3'::jsonb,
        true
      ),
      updated_at = clock_timestamp()
  where id = v_target;

  begin
    perform public.patch83u_finalize_admin_reset(
      v_admin, v_target, v_operation, 3, '0000098@almodawat.sa'
    );
    raise exception 'TEST_FAILED_ADMIN_RESET_WITH_LIVE_SESSIONS_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_AUTH_SESSIONS_STILL_ACTIVE%' then raise; end if;
  end;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'reset_in_progress'
      and pending_operation_id = v_operation and credential_version = 2
      and password_reset_at is null
  ) then raise exception 'TEST_FAILED_ADMIN_RESET_LIVE_SESSION_REJECTION_WROTE_STATE'; end if;

  delete from auth.sessions where user_id = v_target;
  v_result := public.patch83u_confirm_session_revocation(
    v_admin, v_target, 'proof.admin-reset.sessions-revoked'
  );
  if (v_result->>'sessions_revoked')::boolean is distinct from true then
    raise exception 'TEST_FAILED_ADMIN_RESET_SESSION_REVOCATION_PROOF';
  end if;

  v_result := public.patch83u_finalize_admin_reset(
    v_admin, v_target, v_operation, 3, '0000098@almodawat.sa'
  );
  if v_result->>'credential_state' <> 'admin_reset_change_required'
    or (v_result->>'credential_version')::integer <> 3
    or (v_result->>'must_change_password')::boolean is distinct from true
    or (v_result->>'must_reauthenticate')::boolean is distinct from true
  then raise exception 'TEST_FAILED_ADMIN_RESET_FINALIZE_RESULT'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'admin_reset_change_required'
      and credential_version = 3 and session_valid_after > to_timestamp(0)
      and role_suspension_id is not null and pending_operation_id is null
      and operation_source is null and reconciliation_auth_changed = false
      and password_reset_at is not null
  )
    or not exists (
      select 1 from public.profiles
      where id = v_target and user_status = 'invited' and is_active = true
    )
    or exists (select 1 from public.user_roles where user_id = v_target and is_active = true)
  then raise exception 'TEST_FAILED_ADMIN_RESET_REQUIRED_CHANGE_STATE'; end if;

  select password_reset_at into v_password_reset_at
  from public.user_credential_states where user_id = v_target;

  -- A repeat reset while access is already forced-change must reuse the exact
  -- suspension set. abort(false) cannot restore those roles because the prior
  -- credential state was not active.
  select role_suspension_id into v_suspension
  from public.user_credential_states where user_id = v_target;
  select count(*) into v_events_before
  from public.user_credential_suspended_roles
  where suspension_id = v_suspension and user_id = v_target;
  v_result := public.patch83u_begin_admin_reset(
    v_admin, v_target, 'proof.reset.repeat', '0000098',
    'Controlled repeated administrator reset proof', 'PATCH83U_RESET_USER_PASSWORD'
  );
  v_operation := nullif(v_result->>'operation_id', '')::uuid;
  if v_operation is null or (v_result->>'roles_suspended')::integer <> 0 then
    raise exception 'TEST_FAILED_REPEAT_RESET_BEGIN_RESULT';
  end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'reset_in_progress'
      and role_suspension_id = v_suspension
      and operation_source = 'admin_reset'
      and operation_previous_state = 'admin_reset_change_required'
      and password_reset_at = v_password_reset_at
  )
    or (select count(*) from public.user_credential_suspended_roles
        where suspension_id = v_suspension and user_id = v_target) <> v_events_before
  then raise exception 'TEST_FAILED_REPEAT_RESET_SUSPENSION_REPLACED'; end if;

  v_result := public.patch83u_abort_admin_reset(
    v_admin, v_target, v_operation, false,
    'PATCH83U_PROOF_REPEAT_ABORT',
    'The repeated reset stopped before changing Auth.'
  );
  if v_result->>'credential_state' <> 'admin_reset_change_required'
    or (v_result->>'reconciliation_required')::boolean is distinct from false
  then raise exception 'TEST_FAILED_REPEAT_RESET_ABORT_RESULT'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'admin_reset_change_required'
      and credential_version = 3 and role_suspension_id = v_suspension
      and operation_source is null and reconciliation_auth_changed = false
      and password_reset_at = v_password_reset_at
  )
    or exists (select 1 from public.user_roles where user_id = v_target and is_active = true)
    or not exists (
      select 1 from public.user_credential_suspended_roles
      where suspension_id = v_suspension and suspension_status = 'suspended'
    )
  then raise exception 'TEST_FAILED_REPEAT_RESET_ABORT_RESTORED_ACCESS'; end if;

  -- Old sessions carry an earlier credential version and must be denied even if
  -- Auth session rows have not yet disappeared from the database.
  v_result := public.patch83u_get_credential_state(
    v_target, 2, '0000098@almodawat.sa', v_new_session::text
  );
  if (v_result->>'access_allowed')::boolean is distinct from false then
    raise exception 'TEST_FAILED_ADMIN_RESET_OLD_SESSION_ALLOWED';
  end if;

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (
    v_reset_session,
    v_target,
    date_trunc('second', clock_timestamp()) + interval '1 second',
    date_trunc('second', clock_timestamp()) + interval '1 second'
  );
  v_result := public.patch83u_begin_required_password_change(
    v_target, v_reset_session::text, 3
  );
  v_operation := nullif(v_result->>'operation_id', '')::uuid;
  if v_operation is null or (v_result->>'next_credential_version')::integer <> 4 then
    raise exception 'TEST_FAILED_RESET_REQUIRED_CHANGE_BEGIN';
  end if;

  update auth.users
  set raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{credential_version}',
        '4'::jsonb,
        true
      ),
      updated_at = clock_timestamp()
  where id = v_target;

  delete from auth.sessions where user_id = v_target;
  v_result := public.patch83u_confirm_session_revocation(
    v_target, v_target, 'proof.reset-change.sessions-revoked'
  );
  if (v_result->>'sessions_revoked')::boolean is distinct from true then
    raise exception 'TEST_FAILED_RESET_CHANGE_SESSION_REVOCATION_PROOF';
  end if;

  v_result := public.patch83u_finalize_required_password_change(
    v_target, v_operation, 4, '0000098@almodawat.sa'
  );
  if v_result->>'credential_state' <> 'active'
    or (v_result->>'credential_version')::integer <> 4
    or (v_result->>'reconciliation_required')::boolean is distinct from false
  then raise exception 'TEST_FAILED_RESET_REQUIRED_CHANGE_FINALIZE'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_target and credential_state = 'active'
      and credential_version = 4 and invalidated_session_id = v_reset_session
      and role_suspension_id is null and operation_source is null
      and reconciliation_auth_changed = false
  )
    or not exists (select 1 from public.user_roles where user_id = v_target and is_active = true)
    or not exists (
      select 1 from public.user_credential_suspended_roles
      where user_id = v_target and suspension_status = 'restored'
        and restored_user_role_id is not null
    )
    or not exists (
      select 1 from public.user_account_provisioning
      where id = v_provisioning and provisioning_status = 'completed'
    )
  then raise exception 'TEST_FAILED_RESET_ROLE_RESTORE_OR_QUEUE_REGRESSION'; end if;

  -- Late-write reconciliation must distinguish the administrator reset from the
  -- user's later required password change, even when the reset began while the
  -- account was still in its initial_change_required provisioning state.
  insert into public.user_management_import_batches (
    id, organization_id, file_name, source_format, row_count, valid_count,
    invalid_count, status, created_by, applied_by, applied_at
  ) values (
    v_reconcile_batch, v_org, 'patch83u-reconciliation-proof.xlsx', 'xlsx',
    1, 1, 0, 'applied', v_admin, v_admin, now()
  );
  insert into public.user_management_import_rows (
    id, organization_id, batch_id, row_number, raw_data, normalized_email,
    validation_status, validation_errors, validation_warnings,
    action_status, matched_user_id
  ) values (
    v_reconcile_row, v_org, v_reconcile_batch, 2,
    jsonb_build_object(
      'employee_id', '0000100',
      'contact_email', 'reconcile.user@example.test',
      'account_action', 'create_or_update',
      'department_code', 'IT',
      'role', 'employee',
      'role_scope', 'assigned_only',
      'status', 'active',
      'user_type', 'employee'
    ),
    '0000100@almodawat.sa', 'valid', array[]::text[], array[]::text[],
    'pending_account_creation', null
  );
  insert into public.user_account_provisioning (
    id, organization_id, import_batch_id, import_row_id, auth_user_id,
    employee_id, auth_email, contact_email, full_name_en, full_name_ar, phone,
    department_id, department_code, job_title, requested_role,
    requested_scope, requested_user_type, requested_lifecycle, account_action,
    provisioning_status, created_by
  ) values (
    v_reconcile_provisioning, v_org, v_reconcile_batch, v_reconcile_row, null,
    '0000100', '0000100@almodawat.sa', 'reconcile.user@example.test',
    'Reconciliation User', 'مستخدم التسوية', '+966501010100',
    v_department, 'IT', 'Reconciliation Analyst', 'employee', 'assigned_only',
    'employee', 'active', 'create_or_update', 'queued', v_admin
  );

  v_claim := public.patch83u_claim_provisioning(
    v_admin, v_reconcile_provisioning,
    'proof.reconcile.provision.0000100', '0000100'
  );
  v_attempt := nullif(v_claim->>'attempt_id', '')::uuid;
  if v_attempt is null then raise exception 'TEST_FAILED_RECONCILE_TARGET_CLAIM'; end if;

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, created_at, updated_at
  ) values (
    v_reconcile_target, 'authenticated', 'authenticated', '0000100@almodawat.sa', '', now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'credential_version', 1,
      'patch83u_provisioning_id', v_reconcile_provisioning::text
    ),
    now(), now()
  );
  perform public.patch83u_finalize_provisioning(
    v_admin, v_reconcile_provisioning, v_attempt,
    v_reconcile_target, '0000100@almodawat.sa'
  );
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_reconcile_target
      and identity_mode = 'employee_id_managed'
      and credential_state = 'initial_change_required' and credential_version = 1
  )
    or exists (
      select 1 from public.user_roles
      where user_id = v_reconcile_target and is_active = true
    )
  then raise exception 'TEST_FAILED_RECONCILE_TARGET_INITIAL_STATE'; end if;

  v_result := public.patch83u_begin_admin_reset(
    v_admin,
    v_reconcile_target,
    'proof.reconcile.admin-reset.begin',
    '0000100',
    'Controlled late administrator reset proof',
    'PATCH83U_RESET_USER_PASSWORD'
  );
  v_operation := nullif(v_result->>'operation_id', '')::uuid;
  if v_operation is null then raise exception 'TEST_FAILED_LATE_ADMIN_RESET_BEGIN'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_reconcile_target
      and credential_state = 'reset_in_progress'
      and operation_source = 'admin_reset'
      and operation_previous_state = 'initial_change_required'
      and pending_credential_version = 2
  ) then raise exception 'TEST_FAILED_ADMIN_RESET_OPERATION_SOURCE'; end if;

  update auth.users
  set raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{credential_version}',
        '2'::jsonb,
        true
      ),
      updated_at = clock_timestamp()
  where id = v_reconcile_target;
  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (
    v_reconcile_admin_session, v_reconcile_target,
    clock_timestamp(), clock_timestamp()
  );

  -- Reconciliation sees the exact pending Auth version but cannot truthfully
  -- finalize while a target Auth session remains. It must route through the
  -- auth-changed abort path and preserve both operation provenance fields.
  v_result := public.patch83u_reconcile_credential_state(
    v_admin, v_reconcile_target,
    'proof.reconcile.admin-reset.live-sessions', '0000100'
  );
  if v_result->>'credential_state' <> 'recovery_required'
    or v_result->>'outcome' <> 'admin_reset_auth_change_recovery_required'
    or (v_result->>'recovery_required')::boolean is distinct from true
    or (v_result->>'reconciliation_required')::boolean is distinct from true
  then raise exception 'TEST_FAILED_LIVE_SESSION_ADMIN_RESET_RECOVERY'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_reconcile_target
      and credential_state = 'recovery_required'
      and credential_version = 2
      and operation_source = 'admin_reset'
      and reconciliation_auth_changed = true
      and operation_previous_state = 'initial_change_required'
      and role_suspension_id is not null
  ) then raise exception 'TEST_FAILED_LATE_ADMIN_RESET_PROOF_NOT_PRESERVED'; end if;
  if exists (
    select 1 from public.user_roles
    where user_id = v_reconcile_target and is_active = true
  ) then raise exception 'TEST_FAILED_LIVE_SESSION_ADMIN_RESET_ACTIVATED_ROLE'; end if;

  delete from auth.sessions where user_id = v_reconcile_target;
  perform public.patch83u_confirm_session_revocation(
    v_admin, v_reconcile_target, 'proof.reconcile.admin-reset.sessions'
  );

  v_result := public.patch83u_reconcile_credential_state(
    v_admin,
    v_reconcile_target,
    'proof.reconcile.admin-reset.finish',
    '0000100'
  );
  if v_result->>'credential_state' <> 'admin_reset_change_required'
    or v_result->>'outcome' <> 'admin_reset_change_required_restored'
    or (v_result->>'reconciliation_required')::boolean is distinct from false
  then raise exception 'TEST_FAILED_ADMIN_RESET_LATE_PROOF_OUTCOME'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_reconcile_target
      and credential_state = 'admin_reset_change_required'
      and credential_version = 2 and operation_source is null
      and reconciliation_auth_changed = false
      and role_suspension_id is not null
  )
    or exists (
      select 1 from public.user_roles
      where user_id = v_reconcile_target and is_active = true
    )
    or not exists (
      select 1 from public.user_account_provisioning
      where id = v_reconcile_provisioning
        and provisioning_status = 'initial_change_required'
    )
  then raise exception 'TEST_FAILED_ADMIN_RESET_LATE_PROOF_ACTIVATED_ACCESS'; end if;

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (
    v_reconcile_session,
    v_reconcile_target,
    date_trunc('second', clock_timestamp()) + interval '1 second',
    date_trunc('second', clock_timestamp()) + interval '1 second'
  );
  v_result := public.patch83u_begin_required_password_change(
    v_reconcile_target, v_reconcile_session::text, 2
  );
  v_operation := nullif(v_result->>'operation_id', '')::uuid;
  if v_operation is null then raise exception 'TEST_FAILED_LATE_PASSWORD_CHANGE_BEGIN'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_reconcile_target
      and credential_state = 'password_change_in_progress'
      and operation_source = 'password_change'
      and operation_previous_state = 'admin_reset_change_required'
      and pending_credential_version = 3
  ) then raise exception 'TEST_FAILED_PASSWORD_CHANGE_OPERATION_SOURCE'; end if;

  update auth.users
  set raw_app_meta_data = jsonb_set(
        coalesce(raw_app_meta_data, '{}'::jsonb),
        '{credential_version}',
        '3'::jsonb,
        true
      ),
      updated_at = clock_timestamp()
  where id = v_reconcile_target;
  v_result := public.patch83u_reconcile_credential_state(
    v_admin, v_reconcile_target,
    'proof.reconcile.password-change.live-sessions', '0000100'
  );
  if v_result->>'credential_state' <> 'recovery_required'
    or v_result->>'outcome' <> 'password_change_auth_change_recovery_required'
    or (v_result->>'recovery_required')::boolean is distinct from true
    or (v_result->>'reconciliation_required')::boolean is distinct from true
  then raise exception 'TEST_FAILED_LIVE_SESSION_PASSWORD_CHANGE_RECOVERY'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_reconcile_target
      and credential_state = 'recovery_required'
      and credential_version = 3
      and operation_source = 'password_change'
      and reconciliation_auth_changed = true
      and operation_previous_state = 'admin_reset_change_required'
      and role_suspension_id is not null
  ) then raise exception 'TEST_FAILED_LATE_PASSWORD_CHANGE_PROOF_NOT_PRESERVED'; end if;
  if exists (
    select 1 from public.user_roles
    where user_id = v_reconcile_target and is_active = true
  ) then raise exception 'TEST_FAILED_ABORTED_PASSWORD_CHANGE_ACTIVATED_ROLE'; end if;

  delete from auth.sessions where user_id = v_reconcile_target;
  perform public.patch83u_confirm_session_revocation(
    v_reconcile_target,
    v_reconcile_target,
    'proof.reconcile.password-change.sessions'
  );

  v_result := public.patch83u_reconcile_credential_state(
    v_admin,
    v_reconcile_target,
    'proof.reconcile.password-change.finish',
    '0000100'
  );
  if v_result->>'credential_state' <> 'active'
    or v_result->>'outcome' <> 'credential_access_restored_from_database_proof'
    or (v_result->>'reconciliation_required')::boolean is distinct from false
  then raise exception 'TEST_FAILED_PASSWORD_CHANGE_LATE_PROOF_OUTCOME'; end if;
  if not exists (
    select 1 from public.user_credential_states
    where user_id = v_reconcile_target and credential_state = 'active'
      and credential_version = 3 and operation_source is null
      and reconciliation_auth_changed = false and role_suspension_id is null
      and sessions_revoked_at is not null
  )
    or not exists (
      select 1 from public.user_roles
      where user_id = v_reconcile_target and organization_id = v_org
        and role = 'employee' and scope = 'assigned_only' and is_active = true
    )
    or not exists (
      select 1 from public.user_account_provisioning
      where id = v_reconcile_provisioning and provisioning_status = 'completed'
        and completed_at is not null
    )
  then raise exception 'TEST_FAILED_PASSWORD_CHANGE_LATE_PROOF_ACCESS_RESTORE'; end if;

  -- Reconciliation also requires exact identity confirmation and must be
  -- idempotent for a fully consistent completed account.
  select count(*) into v_events_before
  from public.user_credential_events
  where provisioning_id = v_provisioning;
  begin
    perform public.patch83u_reconcile_provisioning(
      v_admin, v_provisioning, 'proof.reconcile.wrong-id', 'WRONG-ID'
    );
    raise exception 'TEST_FAILED_RECONCILE_WRONG_EMPLOYEE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_EMPLOYEE_ID_CONFIRMATION_REQUIRED%' then raise; end if;
  end;
  if not exists (
    select 1 from public.user_account_provisioning
    where id = v_provisioning and provisioning_status = 'completed'
      and auth_user_id = v_target and profile_id = v_target
  )
    or (select count(*) from public.user_credential_events where provisioning_id = v_provisioning) <> v_events_before
  then raise exception 'TEST_FAILED_RECONCILE_CONFIRMATION_REJECTION_WROTE_STATE'; end if;

  v_result := public.patch83u_reconcile_provisioning(
    v_admin, v_provisioning, 'proof.reconcile.0000098', '0000098'
  );
  if v_result->>'provisioning_status' <> 'completed'
    or v_result->>'outcome' <> 'already_completed'
    or (v_result->>'reconciliation_required')::boolean is distinct from false
  then raise exception 'TEST_FAILED_COMPLETED_RECONCILIATION_RESULT'; end if;
  if not exists (
    select 1 from public.user_credential_events
    where provisioning_id = v_provisioning
      and event_type = 'provisioning_reconciled'
      and event_code = 'PATCH83U_PROVISIONING_RECONCILED'
      and details->>'outcome' = 'already_completed'
  ) then raise exception 'TEST_FAILED_RECONCILIATION_EVIDENCE'; end if;

  -- Credential/provisioning evidence is append-only, including to service-role
  -- callers; a rejected tamper attempt must leave the row unchanged.
  begin
    update public.user_credential_events
    set details = jsonb_build_object('outcome', 'tampered')
    where id = (
      select id from public.user_credential_events
      where provisioning_id = v_provisioning
        and event_type = 'provisioning_reconciled'
      order by created_at desc, id desc
      limit 1
    );
    raise exception 'TEST_FAILED_CREDENTIAL_EVENT_MUTATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83U_CREDENTIAL_EVENTS_APPEND_ONLY%' then raise; end if;
  end;
  if not exists (
    select 1 from public.user_credential_events
    where provisioning_id = v_provisioning
      and event_type = 'provisioning_reconciled'
      and details->>'outcome' = 'already_completed'
  ) then raise exception 'TEST_FAILED_CREDENTIAL_EVENT_WAS_MUTATED'; end if;

  raise notice 'Patch 83U credential governance proof passed; transaction will be rolled back.';
end;
$$;

rollback;
