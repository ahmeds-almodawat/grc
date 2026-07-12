-- Patch 83R focused database behavior tests.
-- Run only inside an outer transaction that is rolled back by the caller.

do $$
declare
  v_org uuid := '83000000-0000-4000-8000-000000000001';
  v_other_org uuid := '83000000-0000-4000-8000-000000000002';
  v_admin uuid := '83000000-0000-4000-8000-000000000011';
  v_user uuid := '83000000-0000-4000-8000-000000000012';
  v_unauthorized uuid := '83000000-0000-4000-8000-000000000013';
  v_department uuid := '83000000-0000-4000-8000-000000000021';
  v_successor uuid := '83000000-0000-4000-8000-000000000022';
  v_conflict uuid := '83000000-0000-4000-8000-000000000023';
  v_archived_successor uuid := '83000000-0000-4000-8000-000000000024';
  v_other_department uuid := '83000000-0000-4000-8000-000000000025';
  v_result jsonb;
begin
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  insert into public.organizations (id, name_en) values
    (v_org, 'Patch 83R Test Organization'),
    (v_other_org, 'Patch 83R Other Organization');
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values
    (v_admin, 'authenticated', 'authenticated', 'patch83r-admin@example.test', '', now(), now(), now()),
    (v_user, 'authenticated', 'authenticated', 'patch83r-user@example.test', '', now(), now(), now()),
    (v_unauthorized, 'authenticated', 'authenticated', 'patch83r-unauthorized@example.test', '', now(), now(), now());
  insert into public.profiles (id, organization_id, full_name_en, email, is_active, user_status)
  values
    (v_admin, v_org, 'Patch 83R Admin', 'patch83r-admin@example.test', true, 'active'),
    (v_user, v_org, 'Patch 83R User', 'patch83r-user@example.test', true, 'active'),
    (v_unauthorized, v_org, 'Patch 83R Unauthorized', 'patch83r-unauthorized@example.test', true, 'active');
  insert into public.user_roles (user_id, role, scope, organization_id, is_active)
  values (v_admin, 'governance_admin', 'global', v_org, true);

  insert into public.departments (id, organization_id, name_en, name_ar, code, is_active) values
    (v_department, v_org, 'Clinical Quality', 'الجودة السريرية', 'CLIN', true),
    (v_successor, v_org, 'Quality Operations', 'عمليات الجودة', 'QOPS', true),
    (v_conflict, v_org, 'Finance', 'المالية', 'FIN', true),
    (v_archived_successor, v_org, 'Former Operations', 'العمليات السابقة', 'FORMER', true),
    (v_other_department, v_other_org, 'Other Organization', null, 'OTHER', true);
  update public.profiles set department_id = v_department where id = v_user;

  -- Authorized rename and immutable code.
  v_result := public.department_lifecycle_rename(v_admin, v_department, 'Clinical Operations', 'العمليات السريرية', 'patch83r-test-rename');
  if v_result->>'code' <> 'CLIN' then raise exception 'TEST_FAILED_CODE_CHANGED'; end if;
  begin
    update public.departments set code = 'CHANGED' where id = v_department;
    raise exception 'TEST_FAILED_CODE_MUTATION_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83R_DEPARTMENT_CODE_IMMUTABLE%' then raise; end if;
  end;

  -- Unauthorized and cross-organization rename denial.
  begin
    perform public.department_lifecycle_rename(v_unauthorized, v_department, 'Denied', '', 'patch83r-test-unauthorized');
    raise exception 'TEST_FAILED_UNAUTHORIZED_RENAME_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83R_ADMIN_ROLE_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.department_lifecycle_rename(v_admin, v_other_department, 'Denied', '', 'patch83r-test-cross-org');
    raise exception 'TEST_FAILED_CROSS_ORG_RENAME_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83R_DEPARTMENT_NOT_FOUND%' then raise; end if;
  end;
  begin
    perform public.department_lifecycle_rename(v_admin, v_department, '  Finance  ', '', 'patch83r-test-conflict');
    raise exception 'TEST_FAILED_DUPLICATE_NAME_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83R_ACTIVE_DEPARTMENT_NAME_CONFLICT%' then raise; end if;
  end;

  -- Archive validation: reason, successor required, self, and archived successor.
  begin
    perform public.department_lifecycle_archive(v_admin, v_department, ' ', null, 'patch83r-test-reason');
    raise exception 'TEST_FAILED_EMPTY_REASON_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83R_ARCHIVE_REASON_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.department_lifecycle_archive(v_admin, v_department, 'Controlled retirement', null, 'patch83r-test-successor-required');
    raise exception 'TEST_FAILED_MISSING_SUCCESSOR_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83R_ACTIVE_USERS_REQUIRE_SUCCESSOR%' then raise; end if;
  end;
  begin
    perform public.department_lifecycle_archive(v_admin, v_department, 'Controlled retirement', v_department, 'patch83r-test-self');
    raise exception 'TEST_FAILED_SELF_SUCCESSOR_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83R_SUCCESSOR_SELF_DENIED%' then raise; end if;
  end;
  perform pg_catalog.set_config('patch83r.lifecycle_action', 'archive', true);
  update public.departments set is_active = false, archived_at = now(), archived_by = v_admin,
    archive_reason = 'Pre-archived test successor' where id = v_archived_successor;
  begin
    perform public.department_lifecycle_archive(v_admin, v_department, 'Controlled retirement', v_archived_successor, 'patch83r-test-archived-successor');
    raise exception 'TEST_FAILED_ARCHIVED_SUCCESSOR_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83R_ACTIVE_SUCCESSOR_REQUIRED%' then raise; end if;
  end;

  -- Transactional reassignment and archive.
  v_result := public.department_lifecycle_archive(v_admin, v_department, 'Controlled retirement', v_successor, 'patch83r-test-archive');
  if (v_result->>'reassigned_user_count')::integer <> 1 then raise exception 'TEST_FAILED_REASSIGNMENT_COUNT'; end if;
  if not exists (select 1 from public.profiles where id = v_user and department_id = v_successor) then
    raise exception 'TEST_FAILED_USER_NOT_REASSIGNED';
  end if;
  if not exists (select 1 from public.departments where id = v_department and is_active = false and code = 'CLIN') then
    raise exception 'TEST_FAILED_DEPARTMENT_NOT_ARCHIVED';
  end if;
  if not exists (select 1 from public.v_department_execution_summary where department_id = v_department and is_active = false) then
    raise exception 'TEST_FAILED_ARCHIVED_HISTORY_VIEW_MISSING';
  end if;
  begin
    perform public.department_lifecycle_rename(v_admin, v_department, 'Archived Rename', '', 'patch83r-test-archived-rename');
    raise exception 'TEST_FAILED_ARCHIVED_RENAME_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83R_ARCHIVED_DEPARTMENT_RENAME_DENIED%' then raise; end if;
  end;

  -- Restore conflict denial then success without identity change.
  update public.departments set name_en = ' Clinical   Operations ' where id = v_conflict;
  begin
    perform public.department_lifecycle_restore(v_admin, v_department, 'patch83r-test-restore-conflict');
    raise exception 'TEST_FAILED_RESTORE_CONFLICT_ALLOWED';
  exception when others then
    if sqlerrm not like '%PATCH83R_ACTIVE_DEPARTMENT_NAME_CONFLICT%' then raise; end if;
  end;
  update public.departments set name_en = 'Finance' where id = v_conflict;
  v_result := public.department_lifecycle_restore(v_admin, v_department, 'patch83r-test-restore');
  if not exists (select 1 from public.departments where id = v_department and is_active = true and code = 'CLIN') then
    raise exception 'TEST_FAILED_RESTORE_IDENTITY';
  end if;
  if (select count(*) from public.audit_logs where record_id = v_department
      and action in ('DEPARTMENT_RENAMED','DEPARTMENT_ARCHIVED','DEPARTMENT_RESTORED')) <> 3 then
    raise exception 'TEST_FAILED_LIFECYCLE_AUDIT_COUNT';
  end if;

  raise notice 'Patch 83R database lifecycle tests passed.';
end;
$$;
