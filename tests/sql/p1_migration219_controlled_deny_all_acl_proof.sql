begin;

do $$
declare
  v_table text;
  v_role text;
  v_privilege text;
begin
  foreach v_table in array array[
    'patch83b_release_migration_events',
    'patch83u_runtime_control',
    'user_account_provisioning',
    'user_credential_events',
    'user_credential_states',
    'user_credential_suspended_roles'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'P1_MIGRATION_219_RLS_NOT_FORCED: %', v_table;
    end if;

    foreach v_role in array array['public', 'anon', 'authenticated'] loop
      foreach v_privilege in array array[
        'select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'
      ] loop
        if has_table_privilege(v_role, format('public.%I', v_table), v_privilege) then
          raise exception 'P1_MIGRATION_219_BROWSER_PRIVILEGE: %.% %', v_role, v_table, v_privilege;
        end if;
      end loop;
    end loop;
  end loop;

  if not has_table_privilege('service_role', 'public.patch83b_release_migration_events', 'select')
     or not has_table_privilege('service_role', 'public.patch83u_runtime_control', 'select')
     or not has_table_privilege('service_role', 'public.user_credential_states', 'select') then
    raise exception 'P1_MIGRATION_219_REQUIRED_SERVICE_READ_MISSING';
  end if;

  if not has_table_privilege('service_role', 'public.user_account_provisioning', 'select')
     or not has_table_privilege('service_role', 'public.user_account_provisioning', 'insert')
     or not has_table_privilege('service_role', 'public.user_account_provisioning', 'update')
     or has_table_privilege('service_role', 'public.user_account_provisioning', 'delete') then
    raise exception 'P1_MIGRATION_219_PROVISIONING_SERVICE_ACL_MISMATCH';
  end if;

  if has_table_privilege('service_role', 'public.user_credential_events', 'select')
     or has_table_privilege('service_role', 'public.user_credential_suspended_roles', 'select') then
    raise exception 'P1_MIGRATION_219_OWNER_ONLY_TABLE_EXPOSED';
  end if;
end;
$$;

select 'P1 MIGRATION 219 CONTROLLED DENY-ALL ACL PROOF PASSED' as result;

rollback;
