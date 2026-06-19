-- v6.7.3 Security Definer Execute Lockdown
-- Purpose:
--   1. Remove broad EXECUTE privileges from every public SECURITY DEFINER function.
--   2. Preserve authenticated access only through SECURITY INVOKER helpers/RPCs.
--   3. Keep privileged seed, maintenance, release, and cross-user operations service_role-only.

begin;

-- The original user_roles SELECT policy called has_any_role(), which queried
-- user_roles again. SECURITY DEFINER previously hid that recursion. The
-- least-privilege replacement lets users read their own role rows; invoker
-- authorization helpers can then evaluate only the current user's roles.
drop policy if exists user_roles_read_self_or_admin on public.user_roles;
drop policy if exists user_roles_read_self on public.user_roles;
create policy user_roles_read_self on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

-- SECURITY INVOKER authorization helpers need read permission on their two
-- source tables. RLS remains enabled and restricts users to allowed rows.
grant select on table public.profiles to authenticated;
grant select on table public.user_roles to authenticated;

-- RLS predicate helpers are read-only and evaluate the current authenticated
-- user's own profile/role rows. They no longer require owner privileges.
alter function public.current_user_org_id() security invoker;
alter function public.has_any_role(public.app_role[]) security invoker;
alter function public.has_global_role(public.app_role[]) security invoker;
alter function public.can_access_org(uuid) security invoker;
alter function public.can_access_scope(uuid, uuid, uuid, uuid) security invoker;
alter function public.can_manage_grc() security invoker;
alter function public.has_role(public.app_role) security invoker;
alter function public.has_role(uuid, public.app_role) security invoker;
alter function public.can_read_organization(uuid) security invoker;

-- Clear inherited/default and explicit broad grants from the invoker functions,
-- then restore only the roles that need to evaluate RLS.
revoke all on function public.current_user_org_id() from public, anon, authenticated;
revoke all on function public.has_any_role(public.app_role[]) from public, anon, authenticated;
revoke all on function public.has_global_role(public.app_role[]) from public, anon, authenticated;
revoke all on function public.can_access_org(uuid) from public, anon, authenticated;
revoke all on function public.can_access_scope(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_manage_grc() from public, anon, authenticated;
revoke all on function public.has_role(public.app_role) from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.can_read_organization(uuid) from public, anon, authenticated;

grant execute on function public.current_user_org_id() to authenticated, service_role;
grant execute on function public.has_any_role(public.app_role[]) to authenticated, service_role;
grant execute on function public.has_global_role(public.app_role[]) to authenticated, service_role;
grant execute on function public.can_access_org(uuid) to authenticated, service_role;
grant execute on function public.can_access_scope(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_grc() to authenticated, service_role;
grant execute on function public.has_role(public.app_role) to authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.can_read_organization(uuid) to authenticated, service_role;

-- Every function that still runs with owner privileges is privileged. Remove
-- PUBLIC/default and explicit anon/authenticated execution, and retain only
-- service_role for trusted server-side use. Trigger execution is unaffected.
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
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      fn.signature
    );
    execute format(
      'grant execute on function %s to service_role',
      fn.signature
    );
  end loop;
end
$$;

commit;
