-- HF-1 migration 234 service-only aggregate proof.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'dashboard_recent_governed_activity_v1'
    and pg_get_function_identity_arguments(p.oid) = 'p_actor_id uuid, p_limit integer';

  if v_definition is null then
    raise exception 'HF1_RECENT_ACTIVITY_AGGREGATE_MISSING';
  end if;
  if v_definition not like '%SECURITY DEFINER%' then
    raise exception 'HF1_RECENT_ACTIVITY_AGGREGATE_NOT_DEFINER';
  end if;
  if v_definition not like '%assert_service_caller()%' then
    raise exception 'HF1_RECENT_ACTIVITY_SERVICE_GUARD_MISSING';
  end if;
  if v_definition not like '%executive_actor_organization(p_actor_id)%' then
    raise exception 'HF1_RECENT_ACTIVITY_ENTITLEMENT_GUARD_MISSING';
  end if;
  if v_definition not like '%activity.organization_id = v_organization_id%' then
    raise exception 'HF1_RECENT_ACTIVITY_ORGANIZATION_FILTER_MISSING';
  end if;

  if has_function_privilege('anon', 'public.dashboard_recent_governed_activity_v1(uuid, integer)', 'execute')
     or has_function_privilege('authenticated', 'public.dashboard_recent_governed_activity_v1(uuid, integer)', 'execute') then
    raise exception 'HF1_RECENT_ACTIVITY_BROWSER_EXECUTE_EXPOSED';
  end if;
  if not has_function_privilege('service_role', 'public.dashboard_recent_governed_activity_v1(uuid, integer)', 'execute') then
    raise exception 'HF1_RECENT_ACTIVITY_SERVICE_EXECUTE_MISSING';
  end if;
end;
$$;
