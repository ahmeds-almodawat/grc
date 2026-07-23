\set ON_ERROR_STOP on

do $assert_catalog$
declare
  v_table text;
  v_oid oid;
  v_signature text;
  v_expected_auth boolean;
  v_expected_service boolean;
  v_functions constant text[] := array[
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
  v_auth constant text[] := array[
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
  foreach v_table in array array[
    'backup_packages','export_logs','production_validation_runs','release_candidate_controls',
    'rls_persona_test_cases','rls_persona_test_runs','rls_violation_findings',
    'supabase_install_verification_items','system_health_snapshots'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_table and c.relrowsecurity and c.relforcerowsecurity
    ) then raise exception 'GATE9R_RLS_STATE_FAILED: %', v_table; end if;
    if exists (
      select 1 from pg_catalog.pg_policies
      where schemaname='public' and tablename=v_table
      and (btrim(coalesce(qual,''),'() ') = 'true' or btrim(coalesce(with_check,''),'() ') = 'true')
    ) then raise exception 'GATE9R_TRUE_POLICY_REMAINS: %', v_table; end if;
    if pg_catalog.has_table_privilege('anon',format('public.%I',v_table),'select')
       or pg_catalog.has_table_privilege('anon',format('public.%I',v_table),'insert')
       or pg_catalog.has_table_privilege('authenticated',format('public.%I',v_table),'update')
       or pg_catalog.has_table_privilege('authenticated',format('public.%I',v_table),'delete') then
      raise exception 'GATE9R_BROWSER_ACL_FAILED: %', v_table;
    end if;
    if not pg_catalog.has_table_privilege('authenticated',format('public.%I',v_table),'select') then
      raise exception 'GATE9R_AUTH_READ_GRANT_MISSING: %', v_table;
    end if;
  end loop;

  if not pg_catalog.has_table_privilege('authenticated','public.export_logs','insert') then
    raise exception 'GATE9R_EXPORT_APPEND_GRANT_MISSING';
  end if;
  if exists (
    select 1 from unnest(array[
      'backup_packages','production_validation_runs','release_candidate_controls',
      'rls_persona_test_cases','rls_persona_test_runs','rls_violation_findings',
      'supabase_install_verification_items','system_health_snapshots'
    ]) t where pg_catalog.has_table_privilege('authenticated',format('public.%I',t),'insert')
  ) then raise exception 'GATE9R_UNEXPECTED_AUTH_INSERT_GRANT'; end if;

  if cardinality(v_functions) <> 39 then raise exception 'GATE9R_FUNCTION_COUNT_DRIFT'; end if;
  foreach v_signature in array v_functions loop
    v_oid := pg_catalog.to_regprocedure(v_signature);
    v_expected_auth := v_signature = any(v_auth);
    v_expected_service := v_signature = any(v_service);
    if v_oid is null then raise exception 'GATE9R_FUNCTION_MISSING: %', v_signature; end if;
    if exists (select 1 from pg_catalog.pg_proc where oid=v_oid and (prosecdef or proconfig is null)) then
      raise exception 'GATE9R_FUNCTION_SECURITY_STATE_FAILED: %', v_signature;
    end if;
    if pg_catalog.has_function_privilege('public',v_oid,'execute')
       or pg_catalog.has_function_privilege('anon',v_oid,'execute')
       or pg_catalog.has_function_privilege('authenticated',v_oid,'execute') <> v_expected_auth
       or pg_catalog.has_function_privilege('service_role',v_oid,'execute') <> v_expected_service then
      raise exception 'GATE9R_FUNCTION_ACL_FAILED: %', v_signature;
    end if;
  end loop;
end;
$assert_catalog$;

insert into public.profiles(id,organization_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222');
insert into public.user_roles(id,user_id,organization_id,role) values
 ('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','super_admin'),
 ('10000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','employee'),
 ('10000000-0000-4000-8000-000000000003','cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','super_admin');

insert into public.backup_packages values
 ('20000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','org-one'),
 ('20000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','org-two'),
 ('20000000-0000-4000-8000-000000000003',null,'shared');
insert into public.export_logs values
 ('30000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','org-one',null),
 ('30000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','org-two',null);
insert into public.rls_persona_test_runs values
 ('40000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','org-one'),
 ('40000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','org-two');

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

do $runtime_admin$
begin
  if public.current_user_org_id() <> '11111111-1111-4111-8111-111111111111'::uuid
     or not public.has_any_role(array['super_admin']::text[]) then
    raise exception 'GATE9R_RLS_HELPER_REGRESSION';
  end if;
  if (select count(*) from public.backup_packages) <> 2 then
    raise exception 'GATE9R_CROSS_ORG_BACKUP_READ';
  end if;
  if (select count(*) from public.export_logs) <> 1 then
    raise exception 'GATE9R_CROSS_ORG_EXPORT_READ';
  end if;
  if (select count(*) from public.rls_persona_test_runs) <> 1 then
    raise exception 'GATE9R_CROSS_ORG_PERSONA_READ';
  end if;

  begin
    insert into public.export_logs values
      ('30000000-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','forbidden',auth.uid());
    raise exception 'GATE9R_CROSS_ORG_EXPORT_INSERT_ALLOWED';
  exception when insufficient_privilege then null;
  end;

  insert into public.export_logs values
    ('30000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','allowed',auth.uid());

  begin
    update public.export_logs set label='forbidden';
    raise exception 'GATE9R_AUDIT_UPDATE_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end;
$runtime_admin$;

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $runtime_employee$
begin
  if exists (select 1 from public.backup_packages)
     or exists (select 1 from public.production_validation_runs)
     or exists (select 1 from public.system_health_snapshots) then
    raise exception 'GATE9R_UNPRIVILEGED_READ_ALLOWED';
  end if;
end;
$runtime_employee$;

reset role;
select 'GATE9R_SECURITY_ADVISOR_REMEDIATION_OK' as result;
