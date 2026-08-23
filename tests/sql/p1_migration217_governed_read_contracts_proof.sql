\set ON_ERROR_STOP on
begin;

do $proof$
declare
  v_actor uuid;
  v_org uuid;
  v_denied boolean;
  v_relation text;
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '217' and name = 'p1_governed_read_contracts'
  ) then raise exception 'P1_217_LEDGER_ENTRY_MISSING'; end if;

  select p.id, p.organization_id into v_actor, v_org
  from public.profiles p
  where p.is_active and p.user_status::text = 'active'
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = p.id and ur.organization_id = p.organization_id
        and ur.is_active and ur.scope::text = 'global' and ur.role::text = 'super_admin'
    )
  order by p.id limit 1;
  if v_actor is null then raise exception 'P1_217_ACTIVE_GLOBAL_REVIEW_ACTOR_REQUIRED'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_actor,
    'role', 'authenticated',
    'organization_id', v_org,
    'app_metadata', jsonb_build_object('organization_id', v_org)
  )::text, true);
  execute 'set local role authenticated';

  foreach v_relation in array array[
    'accreditation_clause_review_tasks',
    'audit_findings',
    'capa_action_plans',
    'committee_decisions',
    'compliance_items',
    'policy_requirements',
    'risks',
    'sop_procedure_steps',
    'v_accreditation_readiness_summary',
    'v_accreditation_requirement_matrix',
    'v_accreditation_gap_dashboard',
    'v_patch30_accreditation_readiness_summary',
    'v_critical_attention_items',
    'v_recent_governed_activity',
    'v_management_control_summary',
    'v_live_grc_capa_queue'
  ] loop
    execute format('select count(*) from public.%I', v_relation);
  end loop;
  execute 'reset role';

  foreach v_relation in array array[
    'accreditation_clause_review_tasks',
    'audit_findings',
    'capa_action_plans',
    'committee_decisions',
    'compliance_items',
    'policy_requirements',
    'risks',
    'sop_procedure_steps',
    'v_accreditation_readiness_summary',
    'v_critical_attention_items',
    'v_recent_governed_activity'
  ] loop
    execute 'set local role anon';
    v_denied := false;
    begin
      execute format('select count(*) from public.%I', v_relation);
    exception when insufficient_privilege then
      v_denied := true;
    end;
    execute 'reset role';
    if not v_denied then raise exception 'P1_217_ANON_READ_ALLOWED:%', v_relation; end if;
  end loop;

  if exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public'
      and table_name in (
        'accreditation_clause_review_tasks','audit_findings','capa_action_plans',
        'committee_decisions','compliance_items','policy_requirements','risks','sop_procedure_steps'
      )
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  ) then raise exception 'P1_217_BROWSER_DML_GRANT_PRESENT'; end if;

  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'v_accreditation_readiness_summary','v_accreditation_requirement_matrix',
        'v_accreditation_gap_dashboard','v_critical_attention_items',
        'v_recent_governed_activity','v_management_control_summary',
        'v_live_grc_capa_queue'
      )
      and not ('security_invoker=true' = any(coalesce(c.reloptions, '{}'::text[])))
  ) then raise exception 'P1_217_SECURITY_INVOKER_MISSING'; end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~* 'profiles\s*\.\s*active_flag'
  ) then raise exception 'P1_217_ACTIVE_FUNCTION_PROFILE_FLAG_DRIFT'; end if;

  if exists (
    select 1 from pg_views
    where schemaname = 'public' and definition ~* 'profiles\s*\.\s*active_flag'
  ) then raise exception 'P1_217_ACTIVE_VIEW_PROFILE_FLAG_DRIFT'; end if;

  raise notice 'P1 MIGRATION 217 GOVERNED READ CONTRACT PROOF PASSED';
end;
$proof$;

rollback;
