-- Production Gate 9R / migration 184
-- Fix mutable function search paths and reconcile direct EXECUTE privileges.
-- Function bodies and table data are not changed.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $patch184_harden$
declare
  v_signature text;
  v_oid oid;
  v_owner text;
  v_is_definer boolean;
  v_search_path text[];
  v_all constant text[] := array[
    'public.require_delay_reason_project()',
    'public.require_delay_reason_work()',
    'public.ovr_signal_level(integer,integer,integer,integer)',
    'public.grc_has_accepted_evidence(text,uuid)',
    'public.grc_guard_project_update()',
    'public.grc_guard_milestone_update()',
    'public.grc_guard_task_update()',
    'public.grc_guard_approval_update()',
    'public.set_v38_updated_at()',
    'public.require_accepted_evidence_before_project_closure()',
    'public.require_accepted_evidence_before_work_closure()',
    'public.require_accepted_evidence_before_grc_closure()',
    'public.seed_v59_no_mock_phased_tests_defaults()',
    'public.set_v60_updated_at()',
    'public.set_updated_at()',
    'public.assign_ovr_number()',
    'public.ovr_severity_weight(text)',
    'public.search_grc_global(text,integer)',
    'public.calculate_kri_breach_level(public.kri_direction,numeric,numeric,numeric,numeric,numeric,numeric)',
    'public.set_kri_observation_breach_level()',
    'public.v35_set_updated_at()',
    'public.v35_attach_updated_at_if_exists(text)',
    'public.seed_v35_consolidation_defaults()',
    'public.seed_v38_final_validation_defaults()',
    'public.seed_v42_release_validation_defaults()',
    'public.seed_v50_scale_backup_restore_defaults()',
    'public.v58_touch_updated_at()',
    'public.seed_v58_pilot_rollout_security_audit_defaults()',
    'public.seed_v60_no_mock_controls_defaults()',
    'public.patch4_set_immutable_event_hash()',
    'public.set_grc_training_updated_at()',
    'public.patch4_compute_event_hash(text,jsonb,timestamp with time zone,uuid)',
    'public.patch19_sync_profile_status()',
    'public.get_pilot_go_no_go_dashboard()',
    'public.get_executive_readiness_summary()',
    'public.get_daily_operations_landing_summary()',
    'public.trg_enforce_live_environment_lock()'
  ];
  -- Category B: intentional authenticated read helpers/RPCs, including helper
  -- calls made from security-invoker views or trigger execution chains.
  v_authenticated constant text[] := array[
    'public.ovr_signal_level(integer,integer,integer,integer)',
    'public.grc_has_accepted_evidence(text,uuid)',
    'public.ovr_severity_weight(text)',
    'public.search_grc_global(text,integer)',
    'public.calculate_kri_breach_level(public.kri_direction,numeric,numeric,numeric,numeric,numeric,numeric)',
    'public.patch4_compute_event_hash(text,jsonb,timestamp with time zone,uuid)',
    'public.get_pilot_go_no_go_dashboard()',
    'public.get_executive_readiness_summary()',
    'public.get_daily_operations_landing_summary()'
  ];
  -- Category C: data-seeding helpers are service-role-only.
  v_service_only constant text[] := array[
    'public.seed_v59_no_mock_phased_tests_defaults()',
    'public.seed_v35_consolidation_defaults()',
    'public.seed_v38_final_validation_defaults()',
    'public.seed_v42_release_validation_defaults()',
    'public.seed_v50_scale_backup_restore_defaults()',
    'public.seed_v58_pilot_rollout_security_audit_defaults()',
    'public.seed_v60_no_mock_controls_defaults()'
  ];
begin
  if cardinality(v_all) <> 37 then
    raise exception using errcode = 'P0001', message = 'PATCH184_FUNCTION_INVENTORY_COUNT_DRIFT';
  end if;

  foreach v_signature in array v_all loop
    v_oid := pg_catalog.to_regprocedure(v_signature);
    if v_oid is null then
      raise exception using errcode = 'P0001',
        message = 'PATCH184_REQUIRED_FUNCTION_MISSING_OR_SIGNATURE_DRIFT', detail = v_signature;
    end if;

    select pg_catalog.pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig
      into v_owner, v_is_definer, v_search_path
    from pg_catalog.pg_proc p where p.oid = v_oid;

    if v_owner <> 'postgres' or v_is_definer then
      raise exception using errcode = 'P0001',
        message = 'PATCH184_FUNCTION_OWNER_OR_SECURITY_MODE_DRIFT', detail = v_signature;
    end if;
    execute format('alter function %s security invoker', v_signature);
    execute format('alter function %s set search_path to pg_catalog, public, extensions, pg_temp', v_signature);
    execute format('revoke all on function %s from public, anon, authenticated, service_role', v_signature);

    if v_signature = any(v_authenticated) then
      execute format('grant execute on function %s to authenticated, service_role', v_signature);
      execute format(
        'comment on function %s is %L', v_signature,
        'Gate 9R category B: SECURITY INVOKER authenticated read/helper surface; fixed search_path; anon/PUBLIC denied.'
      );
    elsif v_signature = any(v_service_only) then
      execute format('grant execute on function %s to service_role', v_signature);
      execute format(
        'comment on function %s is %L', v_signature,
        'Gate 9R category C: service-role-only helper; SECURITY INVOKER; fixed search_path; browser roles denied.'
      );
    else
      execute format(
        'comment on function %s is %L', v_signature,
        'Gate 9R category D: internal trigger/administrative helper; SECURITY INVOKER; fixed search_path; direct browser and service-role EXECUTE denied.'
      );
    end if;
  end loop;

  -- These two legacy read-only helpers are genuine policy dependencies. Their
  -- source queries are auth.uid()-scoped and the underlying profiles/user_roles
  -- policies permit the current user's own rows, so owner elevation is not
  -- required. Keep authenticated EXECUTE while removing anon/PUBLIC elevation.
  foreach v_signature in array array[
    'public.current_user_org_id()',
    'public.has_any_role(text[])'
  ] loop
    v_oid := pg_catalog.to_regprocedure(v_signature);
    if v_oid is null then
      raise exception using errcode = 'P0001',
        message = 'PATCH184_REQUIRED_RLS_HELPER_MISSING_OR_SIGNATURE_DRIFT', detail = v_signature;
    end if;
    select pg_catalog.pg_get_userbyid(p.proowner), p.prosecdef
      into v_owner, v_is_definer
    from pg_catalog.pg_proc p where p.oid = v_oid;
    if v_owner <> 'postgres' then
      raise exception using errcode = 'P0001',
        message = 'PATCH184_RLS_HELPER_OWNER_DRIFT', detail = v_signature;
    end if;
    execute format('alter function %s security invoker', v_signature);
    execute format('alter function %s set search_path to pg_catalog, public, pg_temp', v_signature);
    execute format('revoke all on function %s from public, anon, authenticated, service_role', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
    execute format(
      'comment on function %s is %L', v_signature,
      'Gate 9R category A: auth.uid()-scoped SECURITY INVOKER RLS helper; authenticated/service_role only; fixed search_path.'
    );
  end loop;
end;
$patch184_harden$;

do $patch184_verify$
declare
  v_signature text;
  v_oid oid;
  v_expected_auth boolean;
  v_expected_service boolean;
  v_all constant text[] := array[
    'public.require_delay_reason_project()','public.require_delay_reason_work()',
    'public.ovr_signal_level(integer,integer,integer,integer)','public.grc_has_accepted_evidence(text,uuid)',
    'public.grc_guard_project_update()','public.grc_guard_milestone_update()',
    'public.grc_guard_task_update()','public.grc_guard_approval_update()',
    'public.set_v38_updated_at()','public.require_accepted_evidence_before_project_closure()',
    'public.require_accepted_evidence_before_work_closure()','public.require_accepted_evidence_before_grc_closure()',
    'public.seed_v59_no_mock_phased_tests_defaults()','public.set_v60_updated_at()',
    'public.set_updated_at()','public.assign_ovr_number()','public.ovr_severity_weight(text)',
    'public.search_grc_global(text,integer)',
    'public.calculate_kri_breach_level(public.kri_direction,numeric,numeric,numeric,numeric,numeric,numeric)',
    'public.set_kri_observation_breach_level()','public.v35_set_updated_at()',
    'public.v35_attach_updated_at_if_exists(text)','public.seed_v35_consolidation_defaults()',
    'public.seed_v38_final_validation_defaults()','public.seed_v42_release_validation_defaults()',
    'public.seed_v50_scale_backup_restore_defaults()','public.v58_touch_updated_at()',
    'public.seed_v58_pilot_rollout_security_audit_defaults()',
    'public.seed_v60_no_mock_controls_defaults()','public.patch4_set_immutable_event_hash()',
    'public.set_grc_training_updated_at()',
    'public.patch4_compute_event_hash(text,jsonb,timestamp with time zone,uuid)',
    'public.patch19_sync_profile_status()','public.get_pilot_go_no_go_dashboard()',
    'public.get_executive_readiness_summary()','public.get_daily_operations_landing_summary()',
    'public.trg_enforce_live_environment_lock()',
    'public.current_user_org_id()','public.has_any_role(text[])'
  ];
  v_authenticated constant text[] := array[
    'public.ovr_signal_level(integer,integer,integer,integer)','public.grc_has_accepted_evidence(text,uuid)',
    'public.ovr_severity_weight(text)','public.search_grc_global(text,integer)',
    'public.calculate_kri_breach_level(public.kri_direction,numeric,numeric,numeric,numeric,numeric,numeric)',
    'public.patch4_compute_event_hash(text,jsonb,timestamp with time zone,uuid)',
    'public.get_pilot_go_no_go_dashboard()','public.get_executive_readiness_summary()',
    'public.get_daily_operations_landing_summary()','public.current_user_org_id()',
    'public.has_any_role(text[])'
  ];
  v_service constant text[] := array[
    'public.ovr_signal_level(integer,integer,integer,integer)','public.grc_has_accepted_evidence(text,uuid)',
    'public.ovr_severity_weight(text)','public.search_grc_global(text,integer)',
    'public.calculate_kri_breach_level(public.kri_direction,numeric,numeric,numeric,numeric,numeric,numeric)',
    'public.patch4_compute_event_hash(text,jsonb,timestamp with time zone,uuid)',
    'public.get_pilot_go_no_go_dashboard()','public.get_executive_readiness_summary()',
    'public.get_daily_operations_landing_summary()','public.current_user_org_id()',
    'public.has_any_role(text[])','public.seed_v59_no_mock_phased_tests_defaults()',
    'public.seed_v35_consolidation_defaults()','public.seed_v38_final_validation_defaults()',
    'public.seed_v42_release_validation_defaults()','public.seed_v50_scale_backup_restore_defaults()',
    'public.seed_v58_pilot_rollout_security_audit_defaults()',
    'public.seed_v60_no_mock_controls_defaults()'
  ];
begin
  foreach v_signature in array v_all loop
    v_oid := pg_catalog.to_regprocedure(v_signature);
    v_expected_auth := v_signature = any(v_authenticated);
    v_expected_service := v_signature = any(v_service);

    if exists (select 1 from pg_catalog.pg_proc p where p.oid = v_oid and p.prosecdef) then
      raise exception using errcode = 'P0001', message = 'PATCH184_UNEXPECTED_SECURITY_DEFINER', detail = v_signature;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_proc p where p.oid = v_oid
      and p.proconfig is not null
      and p.proconfig[1] like 'search_path=pg_catalog, public%pg_temp'
    ) then
      raise exception using errcode = 'P0001', message = 'PATCH184_SAFE_SEARCH_PATH_NOT_SET', detail = v_signature;
    end if;
    if pg_catalog.has_function_privilege('public', v_oid, 'execute')
       or pg_catalog.has_function_privilege('anon', v_oid, 'execute')
       or pg_catalog.has_function_privilege('authenticated', v_oid, 'execute') <> v_expected_auth
       or pg_catalog.has_function_privilege('service_role', v_oid, 'execute') <> v_expected_service then
      raise exception using errcode = 'P0001', message = 'PATCH184_EXECUTE_ACL_POSTCONDITION_FAILED', detail = v_signature;
    end if;
  end loop;
end;
$patch184_verify$;

commit;
