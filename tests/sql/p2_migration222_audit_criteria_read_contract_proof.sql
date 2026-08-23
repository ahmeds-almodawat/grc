begin;

do $$
declare
  v_actor uuid;
  v_org uuid;
  v_count bigint;
  v_definition text;
begin
  select p.id, p.organization_id
  into v_actor, v_org
  from public.profiles p
  where p.is_active and p.user_status::text = 'active'
  order by p.id
  limit 1;

  if v_actor is null then
    raise exception 'P2_MIGRATION_222_ACTIVE_PROFILE_REQUIRED';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'v_ui4_audit_criteria_contract'
      and c.relkind = 'v'
      and coalesce(c.reloptions, array[]::text[])
        @> array['security_invoker=true']
  ) then
    raise exception 'P2_MIGRATION_222_SECURITY_INVOKER_REQUIRED';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.v_ui4_audit_criteria_contract',
    'select'
  ) then
    raise exception 'P2_MIGRATION_222_AUTHENTICATED_VIEW_READ_MISSING';
  end if;

  if has_table_privilege(
    'anon',
    'public.v_ui4_audit_criteria_contract',
    'select'
  ) then
    raise exception 'P2_MIGRATION_222_ANON_VIEW_READ_EXPOSED';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.ui4_audit_finding_has_legitimate_criterion(uuid)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.ui4_audit_finding_has_legitimate_criterion(uuid)',
    'execute'
  ) then
    raise exception 'P2_MIGRATION_222_OWNER_HELPER_EXPOSED';
  end if;

  select pg_get_viewdef(
    'public.v_ui4_audit_criteria_contract'::regclass,
    true
  ) into v_definition;
  if v_definition ~* 'ui4_audit_finding_has_legitimate_criterion' then
    raise exception 'P2_MIGRATION_222_VIEW_STILL_CALLS_OWNER_HELPER';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_actor,
    'role', 'authenticated',
    'organization_id', v_org,
    'app_metadata', jsonb_build_object('organization_id', v_org)
  )::text, true);
  select count(*) into v_count
  from public.v_ui4_audit_criteria_contract;
  execute 'reset role';
end;
$$;

select 'P2 MIGRATION 222 AUDIT CRITERIA READ CONTRACT PROOF PASSED' as result;

rollback;
