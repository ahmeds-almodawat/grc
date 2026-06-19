-- v6.4 executable database security proof tests
-- Run in a fresh Supabase staging database after applying all migrations.
-- This script intentionally raises exceptions when foundational security proof fails.

-- 1) Sensitive tables must have RLS enabled.
do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname ~* '(ovr|evidence|audit|role|user|profile|approval|export|backup|restore|release|security|incident|patient|department|organization|task|project|risk|compliance|control|policy|finding|notification)'
    and c.relrowsecurity = false;

  if missing_count > 0 then
    raise exception 'V64_FAIL_RLS_DISABLED: % sensitive public tables do not have RLS enabled', missing_count;
  end if;
end $$;

-- 2) Sensitive views should use security_invoker where supported.
do $$
declare
  unsafe_views integer;
begin
  select count(*) into unsafe_views
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and c.relname ~* '(ovr|evidence|audit|role|user|profile|approval|export|backup|release|security|risk|compliance|finding|control)'
    and not coalesce((select option_value = 'true' from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), false);

  if unsafe_views > 0 then
    raise exception 'V64_FAIL_VIEW_SECURITY: % sensitive public views do not have security_invoker=true', unsafe_views;
  end if;
end $$;

-- 3) SECURITY DEFINER functions must set a fixed search_path.
do $$
declare
  unsafe_functions integer;
begin
  select count(*) into unsafe_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true
    and not exists (
      select 1
      from unnest(coalesce(p.proconfig, array[]::text[])) cfg
      where cfg like 'search_path=%'
    );

  if unsafe_functions > 0 then
    raise exception 'V64_FAIL_SECURITY_DEFINER_SEARCH_PATH: % public SECURITY DEFINER functions lack fixed search_path', unsafe_functions;
  end if;
end $$;

-- 4) Broad execute grants for security definer functions should not exist.
do $$
declare
  broad_grants integer;
begin
  select count(*) into broad_grants
  from information_schema.routine_privileges rp
  join pg_proc p on p.proname = rp.routine_name
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = rp.routine_schema
  where rp.routine_schema = 'public'
    and p.prosecdef = true
    and rp.privilege_type = 'EXECUTE'
    and rp.grantee in ('PUBLIC', 'authenticated', 'anon');

  if broad_grants > 0 then
    raise exception 'V64_FAIL_BROAD_SECURITY_DEFINER_EXECUTE: % broad execute grants exist on SECURITY DEFINER functions', broad_grants;
  end if;
end $$;

-- 5) v6.4 proof catalogue should be seeded and visible.
select public.seed_v64_database_security_proof_defaults();
select * from public.v_v64_security_control_scorecard;
select * from public.v_v64_persona_test_matrix;
select * from public.v_v64_database_security_readiness;
