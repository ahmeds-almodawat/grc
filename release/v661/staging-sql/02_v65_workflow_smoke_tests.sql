-- v6.5 staging workflow smoke tests, strengthened by v7.1.
-- Run in a disposable/staging Supabase database after migrations.

begin;

do $$
declare
  missing_relations text[];
begin
  select array_agg(expected_relation order by expected_relation)
  into missing_relations
  from unnest(array[
    'public.organizations',
    'public.profiles',
    'public.user_roles',
    'public.projects',
    'public.milestones',
    'public.tasks',
    'public.evidence_files',
    'public.approvals',
    'public.ovr_reports',
    'public.audit_logs',
    'public.auth_route_protection_controls',
    'public.v64_security_control_catalog'
  ]) as expected_relation
  where to_regclass(expected_relation) is null;

  if coalesce(cardinality(missing_relations), 0) > 0 then
    raise exception 'V65_FAIL_MISSING_CRITICAL_RELATIONS: %',
      array_to_string(missing_relations, ', ');
  end if;
end
$$;

do $$
declare
  rls_failures text[];
begin
  select array_agg(c.relname order by c.relname)
  into rls_failures
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'p')
    and c.relname = any(array[
      'organizations',
      'profiles',
      'user_roles',
      'projects',
      'milestones',
      'tasks',
      'evidence_files',
      'approvals',
      'ovr_reports',
      'audit_logs'
    ])
    and not c.relrowsecurity;

  if coalesce(cardinality(rls_failures), 0) > 0 then
    raise exception 'V65_FAIL_RLS_DISABLED: expected relrowsecurity=true for %',
      array_to_string(rls_failures, ', ');
  end if;
end
$$;

do $$
declare
  broad_execute_functions text[];
begin
  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
  into broad_execute_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and (
      has_function_privilege('public', p.oid, 'EXECUTE')
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if coalesce(cardinality(broad_execute_functions), 0) > 0 then
    raise exception 'V65_FAIL_BROAD_SECURITY_DEFINER_EXECUTE: %',
      array_to_string(broad_execute_functions, ', ');
  end if;
end
$$;

select expected_relation as relation_name,
       to_regclass(expected_relation) is not null as exists
from unnest(array[
  'public.organizations',
  'public.profiles',
  'public.user_roles',
  'public.projects',
  'public.milestones',
  'public.tasks',
  'public.evidence_files',
  'public.approvals',
  'public.ovr_reports',
  'public.audit_logs',
  'public.auth_route_protection_controls',
  'public.v64_security_control_catalog'
]) as expected_relation
order by expected_relation;

select c.relname,
       c.relrowsecurity,
       c.relforcerowsecurity
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind in ('r', 'p')
  and c.relname = any(array[
    'organizations',
    'profiles',
    'user_roles',
    'projects',
    'milestones',
    'tasks',
    'evidence_files',
    'approvals',
    'ovr_reports',
    'audit_logs'
  ])
order by c.relname;

select 'V65_PASS_CRITICAL_RELATIONS' as result,
       12 as expected_relations,
       12 as verified_relations;

select 'V65_PASS_RLS_SECURITY' as result,
       10 as expected_rls_relations,
       10 as verified_rls_relations;

select 'V65_PASS_SECURITY_DEFINER_EXECUTE' as result,
       0 as broad_execute_functions;

rollback;
