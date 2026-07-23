-- Run only in a disposable post-182 validation database.
begin read only;

do $test$
declare
  v_table text;
  v_tables constant text[] := array[
    'company_rollout_waves','final_go_live_stop_rules','final_pilot_signoff_matrix',
    'final_validation_runs','i18n_translation_coverage_items','mock_data_allowlist',
    'phased_auto_test_cases','phased_auto_test_phases','phased_auto_test_results',
    'phased_auto_test_runs','pilot_execution_runs','pilot_feedback_items',
    'pilot_fix_sprint_items','production_data_switchovers','production_empty_state_checks',
    'production_exception_register_v58','rtl_visual_qa_items','v50_scale_test_results'
  ];
begin
  foreach v_table in array v_tables loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table
        and c.relrowsecurity and c.relforcerowsecurity
    ) then
      raise exception 'GATE5_RLS_CONTRACT_FAILED: %', v_table;
    end if;
    if exists (
      select 1 from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = v_table
        and g.grantee in ('PUBLIC','anon','authenticated')
    ) then
      raise exception 'GATE5_BROWSER_GRANT_REMAINS: %', v_table;
    end if;
    if exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'public' and p.tablename = v_table
    ) then
      raise exception 'GATE5_UNEXPECTED_LEGACY_POLICY: %', v_table;
    end if;
  end loop;

  if to_regclass('public.idx_v210_grc_relationships_unique_codes') is null
     or to_regclass('public.idx_patch15_rpc_classification_reviews_unique_source') is null then
    raise exception 'GATE5_EXPRESSION_INDEX_CONTRACT_FAILED';
  end if;
  if to_regprocedure('public.patch83v_runtime_action_authorized(text,text)') is null
     or to_regprocedure('public.patch83tu_catalog_contract_attestation()') is null then
    raise exception 'GATE5_ATTESTATION_CONTRACT_FAILED';
  end if;
  if exists (
    select 1 from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name in ('runtime_action_reviews', 'runtime_action_review_events')
      and g.grantee in ('PUBLIC', 'anon', 'authenticated')
      and g.privilege_type <> 'SELECT'
  ) then
    raise exception 'GATE7_RUNTIME_ACTION_BROWSER_DML_REMAINS';
  end if;
  if exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename in ('runtime_action_reviews', 'runtime_action_review_events')
      and p.cmd <> 'SELECT'
      and p.policyname <> 'patch83u_credential_gate'
  ) then
    raise exception 'GATE7_RUNTIME_ACTION_WRITE_POLICY_REMAINS';
  end if;
  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('runtime_action_reviews', 'runtime_action_review_events')
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'GATE7_RUNTIME_ACTION_FORCE_RLS_FAILED';
  end if;
  if has_function_privilege('anon', 'public.patch83tu_catalog_contract_attestation()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.patch83tu_catalog_contract_attestation()', 'EXECUTE') then
    raise exception 'GATE5_ATTESTATION_ACL_FAILED';
  end if;
  if (public.patch83tu_catalog_contract_attestation() ->> 'edge_service_rpc_count')::integer <> 24
     or (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean is not true then
    raise exception 'GATE7_ATTESTATION_INCOMPLETE';
  end if;
  if to_regprocedure(
       'public.patch83u_last_eligible_super_admin_count()'
     ) is not null then
    raise exception 'GATE7R_FIXTURE_ONLY_LAST_SUPER_ADMIN_HELPER_PRESENT';
  end if;
  if to_regprocedure(
       'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)'
     ) is null
     or has_function_privilege(
       'service_role',
       'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)',
       'EXECUTE'
     ) then
    raise exception 'GATE7R_OWNER_ONLY_RECOVERY_CONTRACT_FAILED';
  end if;
  if coalesce(
       (public.patch83tu_catalog_contract_attestation()
         -> 'last_super_admin_recovery_contract'
         ->> 'wrapper_calls_owner_only_implementation')::boolean,
       false
     ) is not true then
    raise exception 'GATE7R_RECOVERY_WRAPPER_LINEAGE_FAILED';
  end if;
end;
$test$;

rollback;
