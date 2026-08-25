begin;

do $$
declare
  v_actor uuid;
  v_org uuid;
  v_table text;
  v_count bigint;
begin
  select p.id, p.organization_id
  into v_actor, v_org
  from public.profiles p
  where p.is_active and p.user_status = 'active'
  order by p.id
  limit 1;

  if v_actor is null then
    raise exception 'P2_MIGRATION_221_ACTIVE_PROFILE_REQUIRED';
  end if;

  foreach v_table in array array[
    'accreditation_clauses','accreditation_review_cycles',
    'audit_execution_engagements','audit_execution_findings',
    'audit_execution_programs','audit_execution_signoffs',
    'audit_execution_test_steps','capa_action_items',
    'clinical_governance_escalations','evidence_bridge_links',
    'evidence_collection_requests','ovr_rca_cases'
  ] loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity
    ) then
      raise exception 'P2_MIGRATION_221_RLS_REQUIRED: %', v_table;
    end if;

    if not has_table_privilege(
      'authenticated', format('public.%I', v_table), 'select'
    ) then
      raise exception 'P2_MIGRATION_221_AUTHENTICATED_READ_MISSING: %', v_table;
    end if;

    if has_table_privilege('anon', format('public.%I', v_table), 'select') then
      raise exception 'P2_MIGRATION_221_ANON_READ_EXPOSED: %', v_table;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('v_patch38_unified_work_queue', 'v_patch38_my_work_queue')
      and c.relkind = 'v'
      and coalesce(c.reloptions, array[]::text[])
        @> array['security_invoker=true']
    group by n.nspname
    having count(*) = 2
  ) then
    raise exception 'P2_MIGRATION_221_SECURITY_INVOKER_REQUIRED';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_actor,
    'role', 'authenticated',
    'organization_id', v_org,
    'app_metadata', jsonb_build_object('organization_id', v_org)
  )::text, true);
  select count(*) into v_count from public.v_patch38_my_work_queue;
  execute 'reset role';
end;
$$;

select 'P2 MIGRATION 221 MY WORK READ CONTRACT PROOF PASSED' as result;

rollback;
