select json_build_object(
  'columns', (
    select json_agg(json_build_object('table_name', c.table_name, 'column_name', c.column_name, 'data_type', c.data_type, 'is_nullable', c.is_nullable))
    from information_schema.columns c
    where c.table_schema = 'public'
    and c.table_name in ('organizations', 'divisions', 'departments', 'profiles', 'user_roles', 'audit_logs')
  ),
  'indexes', (
    select json_agg(json_build_object('index_name', c.relname, 'column_name', a.attname, 'is_unique', ix.indisunique))
    from pg_class t, pg_class c, pg_index ix, pg_attribute a
    where t.oid = ix.indrelid
    and ix.indexrelid = c.oid
    and a.attrelid = t.oid
    and a.attnum = any(ix.indkey)
    and t.relkind = 'r'
    and t.relname in ('departments', 'organizations', 'divisions', 'profiles', 'user_roles', 'audit_logs')
    and c.relname = 'uq_departments_active_code_norm'
  ),
  'app_roles', (
    select json_agg(enumlabel)
    from pg_enum
    join pg_type on pg_enum.enumtypid = pg_type.oid
    where typname = 'app_role'
  ),
  'department_import_mode', (
    select json_agg(enumlabel)
    from pg_enum
    join pg_type on pg_enum.enumtypid = pg_type.oid
    where typname = 'department_import_mode'
  ),
  'duplicates', (
    select count(*)
    from (
      select organization_id, lower(trim(code)) as norm_code, count(*)
      from public.departments
      where is_active = true
      group by organization_id, lower(trim(code))
      having count(*) > 1
    ) sub
  ),
  'department_import_batches_exists', (
    select count(*) > 0 from information_schema.tables where table_schema = 'public' and table_name = 'department_import_batches'
  ),
  'apply_department_import_batch_exists', (
    select count(*) > 0 from information_schema.routines where routine_schema = 'public' and routine_name = 'apply_department_import_batch'
  )
) as audit_result;
