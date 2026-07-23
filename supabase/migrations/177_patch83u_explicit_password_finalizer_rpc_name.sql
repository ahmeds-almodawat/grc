-- Patch 83U.2: give the atomic password finalizer an explicit RPC-safe name.
--
-- Migration 176 declared a 67-byte PostgreSQL identifier. PostgreSQL stores at
-- most 63 bytes, so the hosted object was created with the truncated name used
-- below. Rename that exact object in place; do not duplicate its protected body.

begin;

do $patch83u_password_finalizer_rename_preflight$
declare
  v_old_name constant text :=
    'patch83u_finalize_required_password_change_after_session_revoca';
  v_old_signature constant text :=
    'public.patch83u_finalize_required_password_change_after_session_revoca(uuid,uuid,text,integer,text)';
  v_destination_name constant text :=
    'patch83u_finalize_password_change_after_revocation';
  v_old_oid oid;
begin
  if pg_catalog.octet_length(v_destination_name) >= 63 then
    raise exception 'PATCH83U_PASSWORD_FINALIZER_DESTINATION_NAME_TOO_LONG';
  end if;

  v_old_oid := pg_catalog.to_regprocedure(v_old_signature);
  if v_old_oid is null then
    raise exception 'PATCH83U_PASSWORD_FINALIZER_SOURCE_MISSING';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = v_old_name
  ) <> 1 then
    raise exception 'PATCH83U_PASSWORD_FINALIZER_SOURCE_NOT_UNIQUE';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = v_destination_name
  ) then
    raise exception 'PATCH83U_PASSWORD_FINALIZER_DESTINATION_CONFLICT';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = v_old_oid
      and p.prokind = 'f'
      and p.prosecdef = true
      and exists (
        select 1
        from pg_catalog.unnest(
          coalesce(p.proconfig, array[]::text[])
        ) config_entry
        where config_entry =
          'search_path=pg_catalog, public, pg_temp'
      )
  ) then
    raise exception 'PATCH83U_PASSWORD_FINALIZER_SOURCE_SECURITY_CONTRACT_INVALID';
  end if;
end;
$patch83u_password_finalizer_rename_preflight$;

alter function public.patch83u_finalize_required_password_change_after_session_revoca(
  uuid,
  uuid,
  text,
  integer,
  text
) rename to patch83u_finalize_password_change_after_revocation;

alter function public.patch83u_finalize_password_change_after_revocation(
  uuid,
  uuid,
  text,
  integer,
  text
) security definer;

alter function public.patch83u_finalize_password_change_after_revocation(
  uuid,
  uuid,
  text,
  integer,
  text
) set search_path = pg_catalog, public, pg_temp;

revoke all on function public.patch83u_finalize_password_change_after_revocation(
  uuid,
  uuid,
  text,
  integer,
  text
) from public, anon, authenticated;

revoke grant option for execute on function public.patch83u_finalize_password_change_after_revocation(
  uuid,
  uuid,
  text,
  integer,
  text
) from service_role;

grant execute on function public.patch83u_finalize_password_change_after_revocation(
  uuid,
  uuid,
  text,
  integer,
  text
) to service_role;

comment on function public.patch83u_finalize_password_change_after_revocation(
  uuid,
  uuid,
  text,
  integer,
  text
) is
'Service-role-only atomic required-password finalization after supported global Auth revocation. Renamed in place by Patch 83U migration 177; preserves the migration-176 zero-session lock and credential-finalization body.';

do $patch83u_password_finalizer_rename_postcondition$
declare
  v_old_name constant text :=
    'patch83u_finalize_required_password_change_after_session_revoca';
  v_new_signature constant text :=
    'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)';
  v_old_signature constant text :=
    'public.patch83u_finalize_required_password_change_after_session_revoca(uuid,uuid,text,integer,text)';
  v_new_oid oid;
begin
  if pg_catalog.to_regprocedure(v_old_signature) is not null
    or exists (
      select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = v_old_name
    )
  then
    raise exception 'PATCH83U_PASSWORD_FINALIZER_SOURCE_STILL_PRESENT';
  end if;

  v_new_oid := pg_catalog.to_regprocedure(v_new_signature);
  if v_new_oid is null then
    raise exception 'PATCH83U_PASSWORD_FINALIZER_DESTINATION_MISSING';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'patch83u_finalize_password_change_after_revocation'
  ) <> 1 then
    raise exception 'PATCH83U_PASSWORD_FINALIZER_DESTINATION_NOT_UNIQUE';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = v_new_oid
      and p.prokind = 'f'
      and p.prosecdef = true
      and exists (
        select 1
        from pg_catalog.unnest(
          coalesce(p.proconfig, array[]::text[])
        ) config_entry
        where config_entry =
          'search_path=pg_catalog, public, pg_temp'
      )
  ) then
    raise exception 'PATCH83U_PASSWORD_FINALIZER_DESTINATION_SECURITY_CONTRACT_INVALID';
  end if;

  if pg_catalog.has_function_privilege('anon', v_new_oid, 'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated', v_new_oid, 'EXECUTE')
    or not pg_catalog.has_function_privilege('service_role', v_new_oid, 'EXECUTE')
    or exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          p.proacl,
          pg_catalog.acldefault('f', p.proowner)
        )
      ) acl
      where p.oid = v_new_oid
        and acl.privilege_type = 'EXECUTE'
        and acl.grantee not in (
          p.proowner,
          (
            select r.oid
            from pg_catalog.pg_roles r
            where r.rolname = 'service_role'
          )
        )
    )
    or exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          p.proacl,
          pg_catalog.acldefault('f', p.proowner)
        )
      ) acl
      where p.oid = v_new_oid
        and acl.privilege_type = 'EXECUTE'
        and acl.grantee = (
          select r.oid
          from pg_catalog.pg_roles r
          where r.rolname = 'service_role'
        )
        and acl.is_grantable
    )
  then
    raise exception 'PATCH83U_PASSWORD_FINALIZER_DESTINATION_EXECUTE_CONTRACT_INVALID';
  end if;
end;
$patch83u_password_finalizer_rename_postcondition$;

commit;
