-- v6.5 staging workflow smoke tests
-- Run in a disposable/staging Supabase database after migrations and seed data.
-- These are proof queries/checks, not a replacement for app-level Playwright tests.

begin;

-- 1) Core workflow tables/views should exist.
select to_regclass('public.projects') as projects_table;
select to_regclass('public.milestones') as milestones_table;
select to_regclass('public.tasks') as tasks_table;
select to_regclass('public.evidence') as evidence_table;
select to_regclass('public.approvals') as approvals_table;

-- 2) OVR/control/security tables should exist.
select to_regclass('public.ovr_reports') as ovr_reports_table;
select to_regclass('public.auth_route_protection_controls') as auth_route_controls_table;
select to_regclass('public.database_security_proof_controls') as db_security_controls_table;

-- 3) RLS must be enabled on sensitive tables where present.
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('projects', 'tasks', 'evidence', 'approvals', 'ovr_reports', 'auth_route_protection_controls')
order by c.relname;

-- 4) Privileged functions should not be executable by public.
select n.nspname as schema_name, p.proname as function_name, has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;

rollback;
