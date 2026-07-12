select json_build_object(
  'department_import_batches', (
    select json_build_object(
      'exists', count(*) > 0,
      'rls_enabled', (select relrowsecurity from pg_class where relname = 'department_import_batches')
    )
    from information_schema.tables where table_schema = 'public' and table_name = 'department_import_batches'
  ),
  'policies', (
    select json_agg(json_build_object(
      'policy_name', policyname,
      'roles', roles,
      'cmd', cmd,
      'qual', qual
    ))
    from pg_policies where schemaname = 'public' and tablename = 'department_import_batches'
  ),
  'enum_exists', (
    select count(*) > 0 from pg_type where typname = 'department_import_mode'
  ),
  'rpc_exists', (
    select count(*) > 0 from pg_proc where proname = 'apply_department_import_batch'
  ),
  'rpc_security_definer', (
    select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'apply_department_import_batch'
  ),
  'rpc_search_path', (
    select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'apply_department_import_batch'
  ),
  'rpc_grants', (
    select json_agg(json_build_object(
      'grantee', grantee,
      'privilege_type', privilege_type
    ))
    from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'apply_department_import_batch'
  )
) as post_audit_result;
