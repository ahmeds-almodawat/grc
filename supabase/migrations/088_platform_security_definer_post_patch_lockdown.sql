-- =========================================================
-- Platform Security Definer Post-Patch Lockdown
-- Purpose:
--   Re-apply least-privilege execute grants after optional/local patch
--   migrations add new SECURITY DEFINER functions.
-- =========================================================

begin;

-- RLS predicate helpers must remain callable by authenticated users, but they
-- do not need owner privileges. Keep them SECURITY INVOKER where present.
do $$
begin
  if to_regprocedure('public.current_user_org_id()') is not null then
    alter function public.current_user_org_id() security invoker;
  end if;
  if to_regprocedure('public.has_any_role(public.app_role[])') is not null then
    alter function public.has_any_role(public.app_role[]) security invoker;
  end if;
  if to_regprocedure('public.has_global_role(public.app_role[])') is not null then
    alter function public.has_global_role(public.app_role[]) security invoker;
  end if;
  if to_regprocedure('public.can_access_org(uuid)') is not null then
    alter function public.can_access_org(uuid) security invoker;
  end if;
  if to_regprocedure('public.can_access_scope(uuid,uuid,uuid,uuid)') is not null then
    alter function public.can_access_scope(uuid, uuid, uuid, uuid) security invoker;
  end if;
  if to_regprocedure('public.can_manage_grc()') is not null then
    alter function public.can_manage_grc() security invoker;
  end if;
  if to_regprocedure('public.has_role(public.app_role)') is not null then
    alter function public.has_role(public.app_role) security invoker;
  end if;
  if to_regprocedure('public.has_role(uuid,public.app_role)') is not null then
    alter function public.has_role(uuid, public.app_role) security invoker;
  end if;
  if to_regprocedure('public.can_read_organization(uuid)') is not null then
    alter function public.can_read_organization(uuid) security invoker;
  end if;
end
$$;

-- Normalize invoker helper grants after changing security mode.
do $$
declare
  fn record;
begin
  for fn in
    select regprocedure_name
    from (
      values
        ('public.current_user_org_id()'::text),
        ('public.has_any_role(public.app_role[])'::text),
        ('public.has_global_role(public.app_role[])'::text),
        ('public.can_access_org(uuid)'::text),
        ('public.can_access_scope(uuid,uuid,uuid,uuid)'::text),
        ('public.can_manage_grc()'::text),
        ('public.has_role(public.app_role)'::text),
        ('public.has_role(uuid,public.app_role)'::text),
        ('public.can_read_organization(uuid)'::text)
    ) as helpers(regprocedure_name)
    where to_regprocedure(regprocedure_name) is not null
  loop
    execute format('revoke all on function %s from public, anon, authenticated', to_regprocedure(fn.regprocedure_name));
    execute format('grant execute on function %s to authenticated, service_role', to_regprocedure(fn.regprocedure_name));
  end loop;
end
$$;

-- Any function still running with owner privileges must be server/trigger only.
-- This includes optional Patch 21 OVR helpers if they exist in the local DB.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.signature);
    execute format('grant execute on function %s to service_role', fn.signature);
  end loop;
end
$$;

commit;
