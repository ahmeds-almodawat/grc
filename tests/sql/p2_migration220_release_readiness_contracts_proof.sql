begin;

do $$
declare
  v_actor uuid;
  v_org uuid;
  v_relation text;
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
    raise exception 'P2_MIGRATION_220_ACTIVE_PROFILE_REQUIRED';
  end if;

  foreach v_table in array array[
    'admin_change_requests','admin_safety_locks','app_translation_dictionary',
    'bilingual_readiness_items','document_center_items','final_go_live_controls',
    'migration_verification_items','migration_verification_runs','module_release_readiness',
    'policies','production_cutover_checklist','production_go_no_go_access_reviews',
    'production_go_no_go_confidentiality_checks','production_go_no_go_cycles',
    'production_go_no_go_decisions','production_go_no_go_launch_monitoring_checks',
    'production_go_no_go_restore_rollback_proofs','production_go_no_go_staging_persona_runs',
    'production_readiness_signoffs','release_candidate_gates','release_migration_order',
    'risk_mitigation_actions','runtime_rpc_classifications'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relrowsecurity
    ) then
      raise exception 'P2_MIGRATION_220_RLS_REQUIRED: %', v_table;
    end if;
    if not has_table_privilege('authenticated', format('public.%I', v_table), 'select') then
      raise exception 'P2_MIGRATION_220_AUTHENTICATED_SOURCE_READ_MISSING: %', v_table;
    end if;
    if has_table_privilege('anon', format('public.%I', v_table), 'select') then
      raise exception 'P2_MIGRATION_220_ANON_SOURCE_READ_EXPOSED: %', v_table;
    end if;
  end loop;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_actor, 'role', 'authenticated', 'organization_id', v_org,
    'app_metadata', jsonb_build_object('organization_id', v_org)
  )::text, true);

  foreach v_relation in array array[
    'v_admin_safety_console','v_bilingual_dictionary_status','v_cross_module_relationship_map',
    'v_document_center_items','v_document_center_summary','v_executive_command_stream',
    'v_executive_command_summary','v_migration_verification_matrix',
    'v_patch40_controlled_pilot_readiness_summary','v_patch40_missing_translation_register',
    'v_patch40_proof_suite_readiness_summary','v_patch40_runtime_rpc_signoff_dashboard',
    'v_production_cutover_checklist','v_production_go_no_go_decision_queue',
    'v_production_go_no_go_evidence_queue','v_production_go_no_go_monitoring_dashboard',
    'v_production_go_no_go_summary','v_release_candidate_gates','v_release_migration_order',
    'v_v31_final_controls','v_v31_go_live_scorecard','v_v31_module_readiness',
    'v_v31_pilot_acceptance','v_v31_support_handover'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_relation and c.relkind = 'v'
        and c.reloptions @> array['security_invoker=true']
    ) then
      raise exception 'P2_MIGRATION_220_SECURITY_INVOKER_REQUIRED: %', v_relation;
    end if;
    if not has_table_privilege('authenticated', format('public.%I', v_relation), 'select') then
      raise exception 'P2_MIGRATION_220_AUTHENTICATED_VIEW_READ_MISSING: %', v_relation;
    end if;
    execute format('select count(*) from public.%I', v_relation) into v_count;
  end loop;

  execute 'reset role';
end;
$$;

do $$
declare
  v_relation text;
begin
  foreach v_relation in array array[
    'v_admin_safety_console','v_bilingual_dictionary_status','v_cross_module_relationship_map',
    'v_document_center_items','v_document_center_summary','v_executive_command_stream',
    'v_executive_command_summary','v_migration_verification_matrix',
    'v_patch40_controlled_pilot_readiness_summary','v_patch40_missing_translation_register',
    'v_patch40_proof_suite_readiness_summary','v_patch40_runtime_rpc_signoff_dashboard',
    'v_production_cutover_checklist','v_production_go_no_go_decision_queue',
    'v_production_go_no_go_evidence_queue','v_production_go_no_go_monitoring_dashboard',
    'v_production_go_no_go_summary','v_release_candidate_gates','v_release_migration_order',
    'v_v31_final_controls','v_v31_go_live_scorecard','v_v31_module_readiness',
    'v_v31_pilot_acceptance','v_v31_support_handover'
  ] loop
    if has_table_privilege('anon', format('public.%I', v_relation), 'select') then
      raise exception 'P2_MIGRATION_220_ANON_VIEW_READ_EXPOSED: %', v_relation;
    end if;
  end loop;
end;
$$;

select 'P2 MIGRATION 220 RELEASE READINESS CONTRACT PROOF PASSED' as result;

rollback;
