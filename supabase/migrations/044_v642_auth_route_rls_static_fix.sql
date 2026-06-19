-- =========================================================
-- GRC Control Center - Migration 044
-- v6.4.2 Auth route protection RLS static fix
-- =========================================================
-- Purpose: close the remaining v6.4 static RLS critical finding introduced by v6.3.
-- This is intentionally conservative until staging persona tests define final scoped policies.

begin;

alter table if exists public.auth_route_protection_controls enable row level security;

drop policy if exists "v642_deny_all_until_persona_verified" on public.auth_route_protection_controls;
create policy "v642_deny_all_until_persona_verified" on public.auth_route_protection_controls
  for all to authenticated
  using (false)
  with check (false);

alter view if exists public.v_v63_auth_route_protection_scorecard set (security_invoker = true);

alter function public.seed_v63_auth_route_protection_defaults() set search_path = public, pg_temp;
revoke all on function public.seed_v63_auth_route_protection_defaults() from public;

commit;
