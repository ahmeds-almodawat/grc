begin;

do $$
declare
  v_definition text;
  v_security_invoker boolean;
begin
  select pg_get_functiondef('ovr_v11_private.executive_actor_organization(uuid)'::regprocedure)
    into v_definition;

  if lower(v_definition) not like '%ur.role in (''executive'', ''super_admin'')%' then
    raise exception 'HF1_ROLE_ENTITLEMENT_MISSING';
  end if;
  if v_definition not like '%ur.scope = ''global''%' or v_definition not like '%ur.is_active%' then
    raise exception 'HF1_GLOBAL_ACTIVE_SCOPE_GUARD_MISSING';
  end if;
  if v_definition not like '%patch83u_role_assignment_valid%' then
    raise exception 'HF1_PATCH83U_ROLE_GUARD_MISSING';
  end if;
  if v_definition ~* E'ur\\.role[^\\n]*(division_head|department_manager|employee|viewer|governance_admin)' then
    raise exception 'HF1_LOWER_SCOPE_AGGREGATE_EXPANSION';
  end if;

  if has_function_privilege('anon', 'ovr_v11_private.executive_actor_organization(uuid)', 'execute')
     or has_function_privilege('authenticated', 'ovr_v11_private.executive_actor_organization(uuid)', 'execute')
     or has_function_privilege('service_role', 'ovr_v11_private.executive_actor_organization(uuid)', 'execute') then
    raise exception 'HF1_PRIVATE_RESOLVER_EXECUTE_EXPOSED';
  end if;

  select coalesce(c.reloptions @> array['security_invoker=true'], false)
    into v_security_invoker
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'v_recent_governed_activity';

  if not coalesce(v_security_invoker, false) then
    raise exception 'HF1_RECENT_ACTIVITY_NOT_SECURITY_INVOKER';
  end if;
  if has_table_privilege('anon', 'public.v_recent_governed_activity', 'select') then
    raise exception 'HF1_RECENT_ACTIVITY_ANON_EXPOSED';
  end if;
  if not has_table_privilege('authenticated', 'public.v_recent_governed_activity', 'select') then
    raise exception 'HF1_RECENT_ACTIVITY_AUTHENTICATED_READ_MISSING';
  end if;
end;
$$;

rollback;
