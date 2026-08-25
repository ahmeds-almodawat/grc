-- P3 hosted service-role contract reconciliation.
--
-- Older workflow functions read only request.jwt.claim.role. Hosted GoTrue
-- exposes the effective JWT role through auth.role(), while selected internal
-- bridges deliberately set the legacy GUC to de-privilege nested calls. Keep
-- that explicit override first, add the canonical hosted role second, and
-- retain current_user as the direct SQL fallback.

do $$
declare
  v_function record;
  v_definition text;
  v_rewritten text;
  v_updated integer := 0;
  v_legacy_read constant text :=
    'current_setting(''request.jwt.claim.role'', true)';
  v_legacy_current_user constant text :=
    'coalesce(current_setting(''request.jwt.claim.role'', true), current_user)';
  v_legacy_empty constant text :=
    'coalesce(current_setting(''request.jwt.claim.role'', true), '''')';
  v_effective_role constant text :=
    'coalesce(nullif(current_setting(''request.jwt.claim.role'', true), ''''), auth.role(), current_user)';
  v_current_user_sentinel constant text := '__PATCH229_CURRENT_USER_ROLE__';
  v_empty_sentinel constant text := '__PATCH229_EMPTY_ROLE__';
  v_bare_sentinel constant text := '__PATCH229_BARE_ROLE__';
begin
  for v_function in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%current_setting(''request.jwt.claim.role'', true)%'
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_rewritten := replace(v_definition, v_legacy_current_user, v_current_user_sentinel);
    v_rewritten := replace(v_rewritten, v_legacy_empty, v_empty_sentinel);
    v_rewritten := replace(v_rewritten, v_legacy_read, v_bare_sentinel);
    v_rewritten := replace(v_rewritten, v_current_user_sentinel, v_effective_role);
    v_rewritten := replace(v_rewritten, v_empty_sentinel, v_effective_role);
    v_rewritten := replace(v_rewritten, v_bare_sentinel, v_effective_role);

    if v_rewritten = v_definition then
      raise exception 'PATCH229_EXPECTED_ROLE_READ_NOT_FOUND: %.%(%)',
        v_function.proname, 'public', v_function.arguments;
    end if;

    execute v_rewritten;
    v_updated := v_updated + 1;
  end loop;

  if v_updated = 0 then
    raise exception 'PATCH229_NO_LEGACY_ROLE_READS_RECONCILED';
  end if;
end;
$$;

do $$
declare
  v_invalid integer;
  v_sentinels integer;
begin
  select count(*) into v_invalid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosrc like '%current_setting(''request.jwt.claim.role'', true)%'
    and (
      p.prosrc not like '%auth.role()%'
      or p.prosrc not like '%current_user%'
    );

  if v_invalid <> 0 then
    raise exception 'PATCH229_NONCANONICAL_HOSTED_ROLE_READS_REMAIN: %', v_invalid;
  end if;

  select count(*) into v_sentinels
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosrc like '%__PATCH229_%';

  if v_sentinels <> 0 then
    raise exception 'PATCH229_ROLE_SENTINELS_REMAIN: %', v_sentinels;
  end if;
end;
$$;
