-- Patch 83T focused database behavior proof.
-- This file is deliberately rollback-only. Run after migration 173 in a disposable
-- verification database; it must never be used to execute a production import.

begin;

do $$
declare
  v_org uuid := '83a00000-0000-4000-8000-000000000001';
  v_other_org uuid := '83a00000-0000-4000-8000-000000000002';
  v_admin uuid := '83a00000-0000-4000-8000-000000000011';
  v_target uuid := '83a00000-0000-4000-8000-000000000012';
  v_department uuid := '83a00000-0000-4000-8000-000000000021';
  v_admin_role uuid := '83a00000-0000-4000-8000-000000000031';
  v_target_role uuid := '83a00000-0000-4000-8000-000000000032';
  v_payload jsonb;
  v_result jsonb;
  v_provisioning jsonb;
  v_identity_refs jsonb;
  v_batch_id uuid;
  v_batches_before integer;
  v_rows_before integer;
  v_provisioning_before integer;
  v_user_audits_before integer;
begin
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  insert into public.organizations (id, name_en)
  values
    (v_org, 'Patch 83T SQL Proof Organization'),
    (v_other_org, 'Patch 83T Cross-Organization Proof');

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
  ) values
    (v_admin, 'authenticated', 'authenticated', 'patch83t-admin@example.test', '', now(), now(), now()),
    (v_target, 'authenticated', 'authenticated', 'patch83t-target@example.test', '', now(), now(), now());

  insert into public.profiles (
    id, organization_id, employee_no, full_name_en, full_name_ar, email, phone,
    job_title, is_active, user_status, user_type
  ) values
    (v_admin, v_org, 'ADMIN-83T', 'Patch 83T Admin', 'مدير الاختبار',
      'patch83t-admin@example.test', null, 'Administrator', true, 'active', 'employee'),
    (v_target, v_org, '001245', 'Existing User', 'مستخدم قائم',
      'patch83t-target@example.test', '+966501111111', 'Old Title', true, 'active', 'employee');

  insert into public.user_roles (
    id, user_id, role, scope, organization_id, is_active
  ) values
    (v_admin_role, v_admin, 'super_admin', 'global', v_org, true),
    (v_target_role, v_target, 'viewer', 'assigned_only', v_org, true);

  insert into public.departments (
    id, organization_id, name_en, name_ar, code, is_active
  ) values (
    v_department, v_org, 'Information Technology', 'تقنية المعلومات', 'IT', true
  );

  v_identity_refs := public.patch83t_user_import_identity_references(
    v_admin, array['001245', '11111']::text[]
  );
  if jsonb_array_length(v_identity_refs->'auth_identities') <> 2
    or jsonb_array_length(v_identity_refs->'profile_identities') <> 1
    or jsonb_array_length(v_identity_refs->'provisioning_identities') <> 2
    or not exists (
      select 1
      from jsonb_array_elements(v_identity_refs->'profile_identities') item
      where item->>'employee_id' = '001245'
        and item->>'profile_id' = v_target::text
        and (item->>'organization_match')::boolean = true
        and (item->>'employee_id_match')::boolean = true
        and (item->>'employee_id_case_insensitive_match')::boolean = true
        and (item->>'auth_email_match')::boolean = false
        and (item->>'has_cross_org_active_role')::boolean = false
    )
    or exists (
      select 1
      from jsonb_array_elements(v_identity_refs->'profile_identities') item
      where item ?| array[
        'full_name_en', 'full_name_ar', 'contact_email', 'phone', 'job_title'
      ]::text[]
    )
  then raise exception 'TEST_FAILED_SAFE_PROFILE_IDENTITY_REFERENCES'; end if;

  begin
    insert into public.user_roles (
      user_id, role, scope, organization_id, is_active, assigned_by
    ) values (
      v_target, 'viewer', 'assigned_only', v_other_org, true, v_admin
    );
    v_identity_refs := public.patch83t_user_import_identity_references(
      v_admin, array['001245']::text[]
    );
    if not exists (
      select 1
      from jsonb_array_elements(v_identity_refs->'profile_identities') item
      where item->>'profile_id' = v_target::text
        and (item->>'has_cross_org_active_role')::boolean = true
    ) then raise exception 'TEST_FAILED_CROSS_ORG_ROLE_IDENTITY_REFERENCE'; end if;
    raise exception 'PATCH83T_TEST_CROSS_ORG_ROLE_SUBTRANSACTION_ROLLBACK';
  exception when others then
    if sqlerrm not like '%PATCH83T_TEST_CROSS_ORG_ROLE_SUBTRANSACTION_ROLLBACK%' then raise; end if;
  end;

  if exists (
    select 1 from public.user_roles
    where user_id = v_target and organization_id = v_other_org and is_active = true
  ) then raise exception 'TEST_FAILED_CROSS_ORG_ROLE_PROOF_ROLLBACK'; end if;

  -- Historical malformed global roles must neither authorize an administrator
  -- nor survive canonical-global checks. Disable only the later Patch 83U
  -- activation trigger while creating the historical fixture, then immediately
  -- re-enable it before exercising Patch 83T.
  begin
    if exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.user_roles'::regclass
        and tgname = 'trg_patch83u_guard_role_activation'
        and not tgisinternal
    ) then
      execute 'alter table public.user_roles disable trigger trg_patch83u_guard_role_activation';
    end if;
    insert into public.user_roles (
      user_id, role, scope, organization_id, department_id, is_active
    ) values (
      v_target, 'governance_admin', 'global', v_org, v_department, true
    );
    if exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.user_roles'::regclass
        and tgname = 'trg_patch83u_guard_role_activation'
        and not tgisinternal
    ) then
      execute 'alter table public.user_roles enable trigger trg_patch83u_guard_role_activation';
    end if;
    perform public.patch83t_user_import_identity_references(
      v_target, array['001245']::text[]
    );
    raise exception 'TEST_FAILED_MALFORMED_GLOBAL_ADMIN_AUTHORIZED';
  exception when others then
    if sqlerrm not like '%PATCH83T_USER_ADMIN_REQUIRED%' then raise; end if;
  end;

  select count(*) into v_batches_before
  from public.user_management_import_batches where organization_id = v_org;
  select count(*) into v_rows_before
  from public.user_management_import_rows where organization_id = v_org;
  select count(*) into v_provisioning_before
  from public.user_account_provisioning where organization_id = v_org;
  select count(*) into v_user_audits_before
  from public.user_management_audit_history where organization_id = v_org;

  v_payload := jsonb_build_object(
    'file_name', 'patch83t-sql-proof.xlsx',
    'source_format', 'xlsx',
    'execution_confirmation', 'WRONG CONFIRMATION',
    'rows', jsonb_build_array(
      jsonb_build_object(
        'row_number', 2,
        'employee_id', '001245',
        'full_name_en', 'Updated Existing User',
        'full_name_ar', 'مستخدم قائم محدث',
        'contact_email', 'updated.contact@example.test',
        'phone', '+966501234567',
        'department_code', 'IT',
        'job_title', 'Senior Analyst',
        'role', 'employee',
        'role_scope', 'assigned_only',
        'status', 'active',
        'user_type', 'employee',
        'account_action', 'update',
        'validation_status', 'valid',
        'expected_matched_user_id', v_target::text,
        'expected_planned_action', 'update_existing_profile',
        'expected_active_role_ids', jsonb_build_array(v_target_role::text)
      ),
      jsonb_build_object(
        'row_number', 3,
        'employee_id', '11111',
        'full_name_en', 'Pending User',
        'full_name_ar', 'مستخدم قيد الإنشاء',
        'contact_email', '',
        'phone', '+966509876543',
        'department_code', 'IT',
        'job_title', 'Analyst',
        'role', 'employee',
        'role_scope', 'assigned_only',
        'status', 'active',
        'user_type', 'employee',
        'account_action', 'create_or_update',
        'validation_status', 'valid',
        'expected_matched_user_id', null,
        'expected_planned_action', 'pending_account_creation',
        'expected_active_role_ids', '[]'::jsonb
      )
    )
  );

  -- Employee ID matching is exact for ownership but case-insensitive for the
  -- derived Auth alias. A differently-cased historical ID is reported safely
  -- and rejected atomically instead of being updated or duplicated.
  begin
    update public.profiles set employee_no = 'Case-83T' where id = v_target;
    v_identity_refs := public.patch83t_user_import_identity_references(
      v_admin, array['case-83t']::text[]
    );
    if not exists (
      select 1
      from jsonb_array_elements(v_identity_refs->'profile_identities') item
      where item->>'profile_id' = v_target::text
        and (item->>'employee_id_match')::boolean = false
        and (item->>'employee_id_case_insensitive_match')::boolean = true
    ) then
      raise exception 'TEST_FAILED_CASE_INSENSITIVE_IDENTITY_REFERENCE';
    end if;

    perform public.patch83t_apply_user_excel_import(
      v_admin,
      jsonb_build_object(
        'file_name', 'patch83t-case-collision-proof.xlsx',
        'source_format', 'xlsx',
        'execution_confirmation', 'EXECUTE USER IMPORT',
        'rows', jsonb_build_array(jsonb_build_object(
          'row_number', 2,
          'employee_id', 'case-83t',
          'full_name_en', 'Case Collision',
          'full_name_ar', 'تعارض حالة الأحرف',
          'contact_email', null,
          'phone', null,
          'department_code', 'IT',
          'job_title', 'Analyst',
          'role', 'employee',
          'role_scope', 'assigned_only',
          'status', 'active',
          'user_type', 'employee',
          'account_action', 'create_or_update',
          'validation_status', 'valid',
          'expected_matched_user_id', null,
          'expected_planned_action', 'pending_account_creation',
          'expected_active_role_ids', '[]'::jsonb
        ))
      )
    );
    raise exception 'TEST_FAILED_CASE_INSENSITIVE_EMPLOYEE_ID_COLLISION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_EMPLOYEE_ID_CASE_INSENSITIVE_CONFLICT%' then raise; end if;
  end;
  if not exists (
    select 1 from public.profiles where id = v_target and employee_no = '001245'
  )
    or (select count(*) from public.user_management_import_batches where organization_id = v_org) <> v_batches_before
  then raise exception 'TEST_FAILED_CASE_COLLISION_WROTE_DATA'; end if;

  -- Exact confirmation is a database-enforced no-write gate.
  begin
    perform public.patch83t_apply_user_excel_import(v_admin, v_payload);
    raise exception 'TEST_FAILED_WRONG_CONFIRMATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_EXECUTION_CONFIRMATION_REQUIRED%' then raise; end if;
  end;

  if (select count(*) from public.user_management_import_batches where organization_id = v_org) <> v_batches_before
    or (select count(*) from public.user_management_import_rows where organization_id = v_org) <> v_rows_before
    or (select count(*) from public.user_account_provisioning where organization_id = v_org) <> v_provisioning_before
    or (select count(*) from public.user_management_audit_history where organization_id = v_org) <> v_user_audits_before
    or not exists (
      select 1 from public.profiles
      where id = v_target and full_name_en = 'Existing User'
        and phone = '+966501111111' and job_title = 'Old Title'
    )
    or not exists (select 1 from public.user_roles where id = v_target_role and is_active = true)
    or exists (select 1 from auth.users where lower(email) = '11111@almodawat.sa')
  then
    raise exception 'TEST_FAILED_CONFIRMATION_REJECTION_WROTE_DATA';
  end if;

  -- The RPC itself must reject non-service execution before writes.
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.patch83t_apply_user_excel_import(
      v_admin,
      jsonb_set(v_payload, '{execution_confirmation}', '"EXECUTE USER IMPORT"'::jsonb)
    );
    raise exception 'TEST_FAILED_NON_SERVICE_EXECUTION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_SERVICE_ROLE_REQUIRED%' then raise; end if;
  end;
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  if (select count(*) from public.user_management_import_batches where organization_id = v_org) <> v_batches_before
    or (select count(*) from public.user_management_import_rows where organization_id = v_org) <> v_rows_before
    or (select count(*) from public.user_account_provisioning where organization_id = v_org) <> v_provisioning_before
    or (select count(*) from public.user_management_audit_history where organization_id = v_org) <> v_user_audits_before
    or not exists (select 1 from public.user_roles where id = v_target_role and is_active = true)
    or exists (select 1 from auth.users where lower(email) = '11111@almodawat.sa')
  then
    raise exception 'TEST_FAILED_SERVICE_ROLE_REJECTION_WROTE_DATA';
  end if;

  -- A role and scope that are individually valid but not canonical must fail atomically.
  begin
    perform public.patch83t_apply_user_excel_import(
      v_admin,
      jsonb_set(
        jsonb_set(v_payload, '{execution_confirmation}', '"EXECUTE USER IMPORT"'::jsonb),
        '{rows,0,role_scope}',
        '"global"'::jsonb
      )
    );
    raise exception 'TEST_FAILED_NON_CANONICAL_ROLE_SCOPE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_ROLE_SCOPE_COMBINATION_INVALID%' then raise; end if;
  end;

  if (select count(*) from public.user_management_import_batches where organization_id = v_org) <> v_batches_before
    or (select count(*) from public.user_management_import_rows where organization_id = v_org) <> v_rows_before
    or (select count(*) from public.user_account_provisioning where organization_id = v_org) <> v_provisioning_before
    or (select count(*) from public.user_management_audit_history where organization_id = v_org) <> v_user_audits_before
    or not exists (
      select 1 from public.profiles
      where id = v_target and full_name_en = 'Existing User'
        and phone = '+966501111111' and job_title = 'Old Title'
    )
    or not exists (select 1 from public.user_roles where id = v_target_role and is_active = true)
    or exists (select 1 from auth.users where lower(email) = '11111@almodawat.sa')
  then
    raise exception 'TEST_FAILED_ROLE_SCOPE_REJECTION_WROTE_DATA';
  end if;

  -- account_action is independently revalidated by the database. Existing
  -- identities cannot be forced through create, and unknown identities cannot
  -- be forced through update.
  begin
    perform public.patch83t_apply_user_excel_import(
      v_admin,
      jsonb_set(
        jsonb_set(v_payload, '{execution_confirmation}', '"EXECUTE USER IMPORT"'::jsonb),
        '{rows,0,account_action}', '"create"'::jsonb
      )
    );
    raise exception 'TEST_FAILED_CREATE_EXISTING_IDENTITY_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_CREATE_PROFILE_ALREADY_EXISTS%' then raise; end if;
  end;

  begin
    perform public.patch83t_apply_user_excel_import(
      v_admin,
      jsonb_set(
        jsonb_set(v_payload, '{execution_confirmation}', '"EXECUTE USER IMPORT"'::jsonb),
        '{rows,1,account_action}', '"update"'::jsonb
      )
    );
    raise exception 'TEST_FAILED_UPDATE_UNKNOWN_IDENTITY_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_UPDATE_PROFILE_NOT_FOUND%' then raise; end if;
  end;

  begin
    perform public.patch83t_apply_user_excel_import(
      v_admin,
      jsonb_set(
        jsonb_set(v_payload, '{execution_confirmation}', '"EXECUTE USER IMPORT"'::jsonb),
        '{rows,1,account_action}', '"upsert"'::jsonb
      )
    );
    raise exception 'TEST_FAILED_INVALID_ACCOUNT_ACTION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_ACCOUNT_ACTION_INVALID%' then raise; end if;
  end;

  if (select count(*) from public.user_management_import_batches where organization_id = v_org) <> v_batches_before
    or (select count(*) from public.user_management_import_rows where organization_id = v_org) <> v_rows_before
    or (select count(*) from public.user_account_provisioning where organization_id = v_org) <> v_provisioning_before
    or (select count(*) from public.user_management_audit_history where organization_id = v_org) <> v_user_audits_before
  then
    raise exception 'TEST_FAILED_ACCOUNT_ACTION_REJECTION_WROTE_DATA';
  end if;

  -- Execute the exact previewed payload. This is the only mutating call in this proof.
  v_payload := jsonb_set(
    v_payload,
    '{execution_confirmation}',
    '"EXECUTE USER IMPORT"'::jsonb
  );
  v_result := public.patch83t_apply_user_excel_import(v_admin, v_payload);
  v_batch_id := nullif(v_result->>'batch_id', '')::uuid;

  if v_batch_id is null then raise exception 'TEST_FAILED_BATCH_ID_MISSING'; end if;
  if (v_result->>'updated_count')::integer <> 1 then raise exception 'TEST_FAILED_UPDATED_COUNT'; end if;
  if (v_result->>'pending_account_creation_count')::integer <> 1 then raise exception 'TEST_FAILED_PENDING_COUNT'; end if;
  if (v_result->'database_proof'->>'import_row_count')::integer <> 2 then raise exception 'TEST_FAILED_IMPORT_ROW_PROOF'; end if;
  if (v_result->'database_proof'->>'provisioning_record_count')::integer <> 1 then raise exception 'TEST_FAILED_PROVISIONING_PROOF'; end if;
  if (v_result->'database_proof'->>'audit_record_count')::integer < 1 then raise exception 'TEST_FAILED_AUDIT_PROOF'; end if;
  if nullif(v_result->'database_proof'->>'payload_sha256', '') is null then raise exception 'TEST_FAILED_PAYLOAD_HASH_PROOF'; end if;
  if jsonb_array_length(coalesce(v_result->'provisioning_ids', '[]'::jsonb)) <> 1 then raise exception 'TEST_FAILED_PROVISIONING_IDS'; end if;

  if v_result->'database_proof'->>'payload_sha256'
      <> encode(digest(convert_to((v_payload->'rows')::text, 'UTF8'), 'sha256'), 'hex')
  then raise exception 'TEST_FAILED_PAYLOAD_HASH_NOT_DERIVED_FROM_EXECUTED_ROWS'; end if;
  if (v_result->'database_proof'->>'import_row_count')::integer
      <> (select count(*) from public.user_management_import_rows where batch_id = v_batch_id)
    or (v_result->'database_proof'->>'provisioning_record_count')::integer
      <> (select count(*) from public.user_account_provisioning where import_batch_id = v_batch_id)
    or (v_result->'database_proof'->>'audit_record_count')::integer
      <> (
        select count(*) from public.user_management_audit_history
        where organization_id = v_org and new_data->>'batch_id' = v_batch_id::text
      )
  then raise exception 'TEST_FAILED_DATABASE_PROOF_NOT_DATABASE_DERIVED'; end if;

  if not exists (
    select 1 from public.user_management_import_batches b
    where b.id = v_batch_id and b.organization_id = v_org and b.source_format = 'xlsx'
      and b.row_count = 2 and b.valid_count = 2 and b.invalid_count = 0 and b.status = 'applied'
  ) then raise exception 'TEST_FAILED_BATCH_DATABASE_PROOF'; end if;

  if (select count(*) from public.user_management_import_rows where batch_id = v_batch_id) <> 2 then
    raise exception 'TEST_FAILED_IMPORT_ROWS_DATABASE_PROOF';
  end if;
  if not exists (
    select 1 from public.user_management_import_rows
    where batch_id = v_batch_id
      and raw_data->>'employee_id' = '11111'
      and raw_data->>'account_action' = 'create_or_update'
      and raw_data->>'planned_action' = 'pending_account_creation'
      and raw_data->>'planned_operation' = 'pending_account_creation'
  ) then raise exception 'TEST_FAILED_IMPORT_ROW_OPERATION_PROOF'; end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_target and p.organization_id = v_org and p.employee_no = '001245'
      and p.full_name_en = 'Updated Existing User' and p.phone = '+966501234567'
      and p.contact_email = 'updated.contact@example.test'
      and p.department_id = v_department and p.job_title = 'Senior Analyst'
      and p.user_status = 'active' and p.is_active = true
  ) then raise exception 'TEST_FAILED_EXISTING_PROFILE_UPDATE'; end if;

  if exists (select 1 from public.user_roles where id = v_target_role and is_active = true) then
    raise exception 'TEST_FAILED_OLD_ROLE_NOT_DEACTIVATED';
  end if;
  if not exists (
    select 1 from public.user_roles
    where user_id = v_target and organization_id = v_org and role = 'employee'
      and scope = 'assigned_only' and is_active = true
  ) then raise exception 'TEST_FAILED_CANONICAL_ROLE_NOT_ASSIGNED'; end if;

  if not exists (
    select 1 from public.user_management_audit_history
    where organization_id = v_org and target_user_id = v_target
      and actor_id = v_admin and action = 'import_applied'
  ) then raise exception 'TEST_FAILED_USER_AUDIT_MISSING'; end if;
  if not exists (
    select 1 from public.role_change_audit
    where organization_id = v_org and target_user_id = v_target
      and action in ('assigned', 'reactivated', 'deactivated')
  ) then raise exception 'TEST_FAILED_ROLE_AUDIT_MISSING'; end if;

  select to_jsonb(p) into v_provisioning
  from public.user_account_provisioning p
  where p.organization_id = v_org and p.employee_id = '11111';

  if v_provisioning is null then raise exception 'TEST_FAILED_PROVISIONING_RECORD_MISSING'; end if;
  v_identity_refs := public.patch83t_user_import_identity_references(
    v_admin, array['11111']::text[]
  );
  if not exists (
    select 1
    from jsonb_array_elements(v_identity_refs->'provisioning_identities') item
    where item->>'employee_id' = '11111'
      and item->>'auth_email' = '11111@almodawat.sa'
      and item->>'provisioning_id' = v_provisioning->>'id'
      and item->>'status' = 'queued'
      and (item->>'organization_match')::boolean = true
  ) then raise exception 'TEST_FAILED_OPEN_PROVISIONING_IDENTITY_REFERENCE'; end if;
  if not coalesce(
    v_result->'provisioning_ids' @> jsonb_build_array(v_provisioning->>'id'),
    false
  ) then raise exception 'TEST_FAILED_PROVISIONING_ID_NOT_DATABASE_DERIVED'; end if;
  if v_provisioning->>'import_batch_id' <> v_batch_id::text
    or nullif(v_provisioning->>'import_row_id', '') is null
    or not (v_provisioning ? 'auth_user_id')
    or nullif(v_provisioning->>'auth_user_id', '') is not null
    or v_provisioning->>'auth_email' <> '11111@almodawat.sa'
    or v_provisioning->>'full_name_en' <> 'Pending User'
    or v_provisioning->>'full_name_ar' <> 'مستخدم قيد الإنشاء'
    or nullif(v_provisioning->>'contact_email', '') is not null
    or v_provisioning->>'phone' <> '+966509876543'
    or v_provisioning->>'department_id' <> v_department::text
    or v_provisioning->>'department_code' <> 'IT'
    or v_provisioning->>'job_title' <> 'Analyst'
    or v_provisioning->>'requested_role' <> 'employee'
    or v_provisioning->>'requested_scope' <> 'assigned_only'
    or v_provisioning->>'requested_lifecycle' <> 'active'
    or v_provisioning->>'requested_user_type' <> 'employee'
    or v_provisioning->>'account_action' <> 'create_or_update'
    or v_provisioning->>'provisioning_status' <> 'queued'
  then raise exception 'TEST_FAILED_PROVISIONING_SNAPSHOT_INCOMPLETE'; end if;

  -- Identity, hierarchy, role, and lifecycle fields are immutable after the
  -- controlled import has handed the record to provisioning.
  begin
    update public.user_account_provisioning
    set employee_id = 'TAMPERED-EMPLOYEE-ID'
    where id = (v_provisioning->>'id')::uuid;
    raise exception 'TEST_FAILED_PROVISIONING_SNAPSHOT_MUTATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_PROVISIONING_SNAPSHOT_IMMUTABLE%' then raise; end if;
  end;
  if not exists (
    select 1
    from public.user_account_provisioning
    where id = (v_provisioning->>'id')::uuid
      and employee_id = '11111'
  ) then raise exception 'TEST_FAILED_PROVISIONING_SNAPSHOT_CHANGED'; end if;

  begin
    delete from public.user_account_provisioning
    where id = (v_provisioning->>'id')::uuid;
    raise exception 'TEST_FAILED_PROVISIONING_DELETE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83T_PROVISIONING_RECORD_DELETE_DENIED%' then raise; end if;
  end;

  if v_provisioning::text ~* '"(password|temporary_password|encrypted_password|access_token|refresh_token)"' then
    raise exception 'TEST_FAILED_CREDENTIAL_PERSISTED_IN_PROVISIONING';
  end if;
  if exists (select 1 from auth.users where lower(email) = '11111@almodawat.sa') then
    raise exception 'TEST_FAILED_PATCH83T_CREATED_AUTH_USER';
  end if;

  raise notice 'Patch 83T database import proof passed; transaction will be rolled back.';
end;
$$;

rollback;
