-- Gate 14C-D-v2-H1: correct only the seven adjudicated post-187 ACL findings.
-- The legacy cleanup table and its seven retained rows are preserved. This
-- migration changes privileges only and aborts on an unexpected partial state.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  v_table_oid oid;
  v_sequence_oid oid;
  v_table_owner oid;
  v_sequence_owner oid;
  v_table_rls boolean;
  v_table_force_rls boolean;
  v_table_rows_before bigint;
  v_table_rows_after bigint;
  v_table_signature_before text;
  v_table_signature_after text;
  v_policy_signature_before text;
  v_policy_signature_after text;
  v_sequence_signature_before text;
  v_sequence_signature_after text;
  v_sequence_state_before text;
  v_sequence_state_after text;
  v_owned_sequence_dependency_before boolean;
  v_owned_sequence_dependency_after boolean;
  v_role text;
  v_privilege text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_namespace n
    where n.nspname = 'public'
  ) then
    raise exception 'PATCH188_PUBLIC_SCHEMA_REQUIRED';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_roles r
    where r.rolname in ('anon', 'authenticated', 'service_role')
  ) <> 3 then
    raise exception 'PATCH188_REQUIRED_ROLES_MISSING';
  end if;

  select c.oid
  into v_table_oid
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'cleanup_backup_seed_20260709'
    and c.relkind in ('r', 'p');

  if v_table_oid is null
     and pg_catalog.to_regclass('public.cleanup_backup_seed_20260709') is not null
  then
    raise exception 'PATCH188_CLEANUP_OBJECT_IS_NOT_A_TABLE';
  end if;

  select c.oid
  into v_sequence_oid
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'cleanup_backup_seed_20260709_id_seq'
    and c.relkind = 'S';

  if v_sequence_oid is null
     and pg_catalog.to_regclass('public.cleanup_backup_seed_20260709_id_seq') is not null
  then
    raise exception 'PATCH188_CLEANUP_SEQUENCE_NAME_HAS_WRONG_OBJECT_TYPE';
  end if;

  if (v_table_oid is null) <> (v_sequence_oid is null) then
    raise exception 'PATCH188_CLEANUP_TABLE_SEQUENCE_PARTIAL_STATE';
  end if;

  if v_table_oid is not null then
    select
      c.relowner,
      c.relrowsecurity,
      c.relforcerowsecurity,
      pg_catalog.md5(coalesce(pg_catalog.string_agg(
        pg_catalog.concat_ws('|',
          a.attnum::text,
          a.attname,
          pg_catalog.format_type(a.atttypid, a.atttypmod),
          a.attnotnull::text,
          coalesce(pg_catalog.pg_get_expr(d.adbin, d.adrelid), '')
        ),
        E'\n' order by a.attnum
      ), ''))
    into
      v_table_owner,
      v_table_rls,
      v_table_force_rls,
      v_table_signature_before
    from pg_catalog.pg_class c
    join pg_catalog.pg_attribute a
      on a.attrelid = c.oid
     and a.attnum > 0
     and not a.attisdropped
    left join pg_catalog.pg_attrdef d
      on d.adrelid = a.attrelid
     and d.adnum = a.attnum
    where c.oid = v_table_oid
    group by c.relowner, c.relrowsecurity, c.relforcerowsecurity;

    select pg_catalog.md5(coalesce(pg_catalog.string_agg(
      pg_catalog.concat_ws('|',
        p.polname,
        p.polpermissive::text,
        p.polcmd,
        p.polroles::text,
        coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), ''),
        coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '')
      ),
      E'\n' order by p.polname
    ), ''))
    into v_policy_signature_before
    from pg_catalog.pg_policy p
    where p.polrelid = v_table_oid;

    execute 'select pg_catalog.count(*) from public.cleanup_backup_seed_20260709'
      into v_table_rows_before;

    select c.relowner
    into v_sequence_owner
    from pg_catalog.pg_class c
    where c.oid = v_sequence_oid;

    select pg_catalog.md5(pg_catalog.concat_ws('|',
      s.seqtypid::text,
      s.seqstart::text,
      s.seqincrement::text,
      s.seqmax::text,
      s.seqmin::text,
      s.seqcache::text,
      s.seqcycle::text
    ))
    into v_sequence_signature_before
    from pg_catalog.pg_sequence s
    where s.seqrelid = v_sequence_oid;

    execute 'select pg_catalog.concat_ws(''|'', last_value::text, is_called::text) from public.cleanup_backup_seed_20260709_id_seq'
      into v_sequence_state_before;

    select exists (
      select 1
      from pg_catalog.pg_depend d
      join pg_catalog.pg_attribute a
        on a.attrelid = d.refobjid
       and a.attnum = d.refobjsubid
      where d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
        and d.objid = v_sequence_oid
        and d.refclassid = 'pg_catalog.pg_class'::pg_catalog.regclass
        and d.refobjid = v_table_oid
        and d.deptype = 'a'
        and a.attname = 'id'
    ) into v_owned_sequence_dependency_before;

    if not v_owned_sequence_dependency_before then
      raise exception 'PATCH188_CLEANUP_SEQUENCE_OWNERSHIP_DRIFT';
    end if;
  end if;

  revoke all privileges on schema public from service_role;
  grant usage on schema public to service_role;

  if v_table_oid is not null then
    execute 'revoke all privileges on table public.cleanup_backup_seed_20260709 from anon, authenticated, service_role';
    execute 'revoke all privileges on sequence public.cleanup_backup_seed_20260709_id_seq from anon, authenticated, service_role';
  end if;

  if not pg_catalog.has_schema_privilege('service_role', 'public', 'USAGE')
     or pg_catalog.has_schema_privilege('service_role', 'public', 'CREATE')
  then
    raise exception 'PATCH188_SERVICE_ROLE_SCHEMA_ACL_ASSERTION_FAILED';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_namespace n
    cross join lateral pg_catalog.aclexplode(
      coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))
    ) a
    join pg_catalog.pg_roles r on r.oid = a.grantee
    where n.nspname = 'public'
      and r.rolname = 'service_role'
      and a.privilege_type <> 'USAGE'
  ) then
    raise exception 'PATCH188_SERVICE_ROLE_DIRECT_SCHEMA_ACL_DRIFT';
  end if;

  if v_table_oid is not null then
    foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
      foreach v_privilege in array array[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
      ] loop
        if pg_catalog.has_table_privilege(v_role, v_table_oid, v_privilege) then
          raise exception 'PATCH188_TABLE_PRIVILEGE_REMAINS role=% privilege=%', v_role, v_privilege;
        end if;
      end loop;

      foreach v_privilege in array array['USAGE', 'SELECT', 'UPDATE'] loop
        if pg_catalog.has_sequence_privilege(v_role, v_sequence_oid, v_privilege) then
          raise exception 'PATCH188_SEQUENCE_PRIVILEGE_REMAINS role=% privilege=%', v_role, v_privilege;
        end if;
      end loop;
    end loop;

    if pg_catalog.to_regclass('public.cleanup_backup_seed_20260709') is null
       or pg_catalog.to_regclass('public.cleanup_backup_seed_20260709_id_seq') is null
       or pg_catalog.to_regclass('public.cleanup_backup_seed_20260709')::oid <> v_table_oid
       or pg_catalog.to_regclass('public.cleanup_backup_seed_20260709_id_seq')::oid <> v_sequence_oid
    then
      raise exception 'PATCH188_CLEANUP_OBJECT_IDENTITY_CHANGED';
    end if;

    select
      pg_catalog.md5(coalesce(pg_catalog.string_agg(
        pg_catalog.concat_ws('|',
          a.attnum::text,
          a.attname,
          pg_catalog.format_type(a.atttypid, a.atttypmod),
          a.attnotnull::text,
          coalesce(pg_catalog.pg_get_expr(d.adbin, d.adrelid), '')
        ),
        E'\n' order by a.attnum
      ), ''))
    into v_table_signature_after
    from pg_catalog.pg_attribute a
    left join pg_catalog.pg_attrdef d
      on d.adrelid = a.attrelid
     and d.adnum = a.attnum
    where a.attrelid = v_table_oid
      and a.attnum > 0
      and not a.attisdropped;

    select pg_catalog.md5(coalesce(pg_catalog.string_agg(
      pg_catalog.concat_ws('|',
        p.polname,
        p.polpermissive::text,
        p.polcmd,
        p.polroles::text,
        coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), ''),
        coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '')
      ),
      E'\n' order by p.polname
    ), ''))
    into v_policy_signature_after
    from pg_catalog.pg_policy p
    where p.polrelid = v_table_oid;

    select pg_catalog.md5(pg_catalog.concat_ws('|',
      s.seqtypid::text,
      s.seqstart::text,
      s.seqincrement::text,
      s.seqmax::text,
      s.seqmin::text,
      s.seqcache::text,
      s.seqcycle::text
    ))
    into v_sequence_signature_after
    from pg_catalog.pg_sequence s
    where s.seqrelid = v_sequence_oid;

    execute 'select pg_catalog.concat_ws(''|'', last_value::text, is_called::text) from public.cleanup_backup_seed_20260709_id_seq'
      into v_sequence_state_after;

    select exists (
      select 1
      from pg_catalog.pg_depend d
      join pg_catalog.pg_attribute a
        on a.attrelid = d.refobjid
       and a.attnum = d.refobjsubid
      where d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
        and d.objid = v_sequence_oid
        and d.refclassid = 'pg_catalog.pg_class'::pg_catalog.regclass
        and d.refobjid = v_table_oid
        and d.deptype = 'a'
        and a.attname = 'id'
    ) into v_owned_sequence_dependency_after;

    execute 'select pg_catalog.count(*) from public.cleanup_backup_seed_20260709'
      into v_table_rows_after;

    if v_table_rows_before <> v_table_rows_after
       or v_table_rows_after <> 7
    then
      raise exception 'PATCH188_CLEANUP_ROW_COUNT_CHANGED expected=7 before=% after=%',
        v_table_rows_before,
        v_table_rows_after;
    end if;

    if (select c.relowner from pg_catalog.pg_class c where c.oid = v_table_oid) <> v_table_owner
       or (select c.relowner from pg_catalog.pg_class c where c.oid = v_sequence_oid) <> v_sequence_owner
    then
      raise exception 'PATCH188_CLEANUP_OWNER_CHANGED';
    end if;

    if (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = v_table_oid) <> v_table_rls
       or (select c.relforcerowsecurity from pg_catalog.pg_class c where c.oid = v_table_oid) <> v_table_force_rls
    then
      raise exception 'PATCH188_CLEANUP_RLS_STATE_CHANGED';
    end if;

    if v_table_signature_after is distinct from v_table_signature_before
       or v_policy_signature_after is distinct from v_policy_signature_before
       or v_sequence_signature_after is distinct from v_sequence_signature_before
       or v_sequence_state_after is distinct from v_sequence_state_before
       or v_owned_sequence_dependency_after is distinct from v_owned_sequence_dependency_before
    then
      raise exception 'PATCH188_CLEANUP_STRUCTURE_OR_POLICY_CHANGED';
    end if;
  end if;
end;
$migration$;

commit;
