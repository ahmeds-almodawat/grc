\set ON_ERROR_STOP on

begin read only;

do $gate11$
declare
  v_table text;
  v_legacy constant text[] := array[
    'company_rollout_waves','final_go_live_stop_rules','final_pilot_signoff_matrix',
    'final_validation_runs','i18n_translation_coverage_items','mock_data_allowlist',
    'phased_auto_test_cases','phased_auto_test_phases','phased_auto_test_results',
    'phased_auto_test_runs','pilot_execution_runs','pilot_feedback_items',
    'pilot_fix_sprint_items','production_data_switchovers','production_empty_state_checks',
    'production_exception_register_v58','rtl_visual_qa_items','v50_scale_test_results'
  ];
  v_scoped constant text[] := array[
    'backup_packages','export_logs','production_validation_runs','release_candidate_controls',
    'rls_persona_test_cases','rls_persona_test_runs','rls_violation_findings',
    'supabase_install_verification_items','system_health_snapshots'
  ];
begin
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p')) <> 607 then
    raise exception 'GATE11_TABLE_COUNT_DRIFT';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('v','m')) <> 528 then
    raise exception 'GATE11_VIEW_COUNT_DRIFT';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public') <> 530 then
    raise exception 'GATE11_FUNCTION_COUNT_DRIFT';
  end if;
  if (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') <> 1978 then
    raise exception 'GATE11_POLICY_COUNT_DRIFT';
  end if;

  foreach v_table in array v_legacy loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity and c.relforcerowsecurity)
      or exists (select 1 from information_schema.role_table_grants g
        where g.table_schema='public' and g.table_name=v_table and g.grantee in ('PUBLIC','anon','authenticated'))
      or exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=v_table) then
      raise exception 'GATE11_LEGACY_TABLE_HARDENING_DRIFT: %', v_table;
    end if;
  end loop;

  foreach v_table in array v_scoped loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity and c.relforcerowsecurity)
      or exists (select 1 from information_schema.role_table_grants g
        where g.table_schema='public' and g.table_name=v_table and g.grantee in ('PUBLIC','anon'))
      or not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=v_table) then
      raise exception 'GATE11_SCOPED_TABLE_HARDENING_DRIFT: %', v_table;
    end if;
  end loop;

  if exists (
    select 1 from pg_policy p
    where (pg_get_expr(p.polqual,p.polrelid) in ('true','(true)')
       or pg_get_expr(p.polwithcheck,p.polrelid) in ('true','(true)'))
      and (
        p.polcmd <> 'r'
        or 0 = any(p.polroles)
        or exists (select 1 from unnest(p.polroles) role_oid
          join pg_roles r on r.oid=role_oid where r.rolname='anon')
      )
  ) then raise exception 'GATE11_UNRESTRICTED_POLICY_PRESENT'; end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and (p.proconfig is null or not exists (
        select 1 from unnest(p.proconfig) c where c like 'search_path=%'
      ))
  ) then raise exception 'GATE11_MUTABLE_SECURITY_DEFINER_PATH'; end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and (has_function_privilege('public',p.oid,'execute') or has_function_privilege('anon',p.oid,'execute'))
  ) then raise exception 'GATE11_PUBLIC_OR_ANON_SECURITY_DEFINER_EXECUTE'; end if;

  if (public.patch83tu_catalog_contract_attestation()->>'overall_pass')::boolean is not true then
    raise exception 'GATE11_PATCH83TU_ATTESTATION_FAILED';
  end if;
  if public.patch83v_runtime_action_authorized('gate11-unknown-action','authenticated_edge_bridge') then
    raise exception 'GATE11_UNKNOWN_RUNTIME_ACTION_ALLOWED';
  end if;
  if exists (select 1 from public.patch83u_runtime_control
    where not singleton or enforcement_state<>'enforced' or state_version<>5
      or compatible_edge_contract_version<>expected_edge_contract_version
      or compatible_frontend_contract_version<>expected_frontend_contract_version) then
    raise exception 'GATE11_SYNTHETIC_RUNTIME_CONTRACT_FAILED';
  end if;
end;
$gate11$;

rollback;
