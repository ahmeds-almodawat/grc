-- Production Gate 13B: legacy runtime and post-185 reconciliation.
-- Generated deterministically by scripts/generate-gate13b-migration187.mjs.
-- Do not hand-edit the embedded migration 181-185 statements.
--   181: supabase/migrations/181_patch83tu_catalog_contract_attestation.sql sha256=7339da35ad00a1f23fe776fa7d0c4505812c93e597acbc9a0ce28705a886effb
--   182: supabase/migrations/182_legacy_public_table_rls_and_privilege_hardening.sql sha256=8dd8eaa3e6a6841069d84942e4c0d817f85e94a35541bf45b408a1eb21eb9588
--   183: supabase/migrations/183_security_advisor_rls_reconciliation.sql sha256=371b01b09406138a3620da700efeff0bcca95bb874a028740562e0eac4c8112c
--   184: supabase/migrations/184_security_definer_search_path_and_acl_hardening.sql sha256=69523e1a0f19056d364c4fd6fb6271b9de275e713077b6038013cb8e3b808c6d
--   185: supabase/migrations/185_pilot_go_no_go_anonymous_policy_reconciliation.sql sha256=780efe381ac90a5ae4d8cf256f95246966e9b42c91adcd9a6dc7a13030e0ec65
--
-- Modern path: validates the existing post-185 controls and adds only the
-- common lineage/provenance contract. Legacy path: installs the exact source
-- statements from 181-185 without fabricating their migration-history rows,
-- then records a distinct migration-based runtime activation provenance.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '300s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('gate13b:migration:187:legacy-runtime-bridge', 0)
);

do $patch187_preflight$
declare
  v_path text;
  v_max_version integer;
  v_181_185_count integer;
  v_186_count integer;
  v_above_186_count integer;
  v_invalid_roles integer;
  v_bootstrap_admins integer;
  v_runtime_eligible_admins integer;
  v_transitional_admins integer;
  v_pending_operations integer;
  v_recovery_states integer;
  v_runtime record;
  v_expected_event text;
  v_table text;
  v_view text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception using errcode = 'P0001', message = 'PATCH187_MIGRATION_HISTORY_REQUIRED';
  end if;

  select
    max(case when version ~ '^[0-9]+$' then version::integer end),
    count(*) filter (where version in ('181','182','183','184','185')),
    count(*) filter (where version = '186'),
    count(*) filter (where version ~ '^[0-9]+$' and version::integer > 186)
  into v_max_version, v_181_185_count, v_186_count, v_above_186_count
  from supabase_migrations.schema_migrations;

  if v_max_version = 186 and v_181_185_count = 5
     and v_186_count = 1 and v_above_186_count = 0 then
    v_path := 'modern_legacy_lineage';
    v_expected_event := 'gate13b:186:modern-role-contract-validation';
  elsif v_max_version = 186 and v_181_185_count = 0
        and v_186_count = 1 and v_above_186_count = 0 then
    v_path := 'production_bridge_lineage';
    v_expected_event := 'gate13b:186:legacy-role-scope-reconciliation';
  else
    raise exception using errcode = 'P0001',
      message = 'PATCH187_UNKNOWN_OR_MIXED_MIGRATION_LINEAGE',
      detail = pg_catalog.format(
        'ceiling=%s migrations_181_185=%s migration_186=%s above_186=%s',
        coalesce(v_max_version::text, 'null'), v_181_185_count,
        v_186_count, v_above_186_count
      );
  end if;

  if not exists (
    select 1 from public.patch83b_release_migration_events e
    where e.event_key = v_expected_event
      and e.migration_version = 186
      and e.lineage = v_path
      and e.status = 'completed'
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_MIGRATION_186_ATTESTATION_MISSING';
  end if;

  select count(*)::integer into v_invalid_roles
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.is_active = true
    and (
      public.patch83u_role_scope_allowed(ur.role, ur.scope) is distinct from true
      or public.patch83u_role_assignment_valid(
        p.organization_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      ) is distinct from true
    );
  if v_invalid_roles <> 0 then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_INVALID_ACTIVE_ROLE_ASSIGNMENT_REMAINS';
  end if;

  select count(*)::integer into v_bootstrap_admins
  from public.profiles p
  where public.patch83u_bootstrap_super_admin_eligible(p.id);
  if v_bootstrap_admins <> 1 then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_BOOTSTRAP_SUPER_ADMIN_COUNT_MISMATCH',
      detail = pg_catalog.format('bootstrap_count=%s', v_bootstrap_admins);
  end if;

  select count(*)::integer into v_pending_operations
  from public.user_credential_states cs
  where cs.pending_operation_id is not null;
  if v_pending_operations <> 0 then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_PENDING_CREDENTIAL_OPERATION';
  end if;

  select count(*)::integer into v_recovery_states
  from public.user_credential_states cs
  where cs.credential_state in (
    'recovery_required', 'reconciliation_required',
    'session_revocation_review_required'
  ) or cs.reconciliation_auth_changed;
  if v_recovery_states <> 0 then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_CREDENTIAL_RECOVERY_STATE_PRESENT';
  end if;

  if to_regclass('public.runtime_action_reviews') is null
     or to_regclass('public.runtime_action_review_events') is null
     or to_regprocedure('public.patch83v_runtime_action_authorized(text,text)') is null then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_MIGRATION_180_RUNTIME_AUTHORIZER_MISSING';
  end if;

  select rc.enforcement_state, rc.state_version,
         rc.compatible_edge_contract_version, rc.compatible_frontend_contract_version,
         rc.designated_super_admin_id, rc.prepared_at, rc.activated_at
  into v_runtime
  from public.patch83u_runtime_control rc
  where rc.singleton;
  if not found then
    raise exception using errcode = 'P0001', message = 'PATCH187_RUNTIME_CONTROL_MISSING';
  end if;

  if v_path = 'modern_legacy_lineage' then
    select count(*)::integer into v_runtime_eligible_admins
    from public.profiles p
    where public.patch83u_runtime_super_admin_eligible(p.id, p.organization_id);
    if v_runtime.enforcement_state <> 'enforced' or v_runtime.state_version < 5
       or v_runtime.compatible_edge_contract_version <> 'patch83u-edge-auth-first-v1'
       or v_runtime.compatible_frontend_contract_version <> 'patch83u-frontend-auth-first-v1'
       or to_regprocedure('public.patch83tu_catalog_contract_attestation()') is null
       or (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean is distinct from true
       or v_runtime_eligible_admins <> 1 then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_MODERN_POST185_CONTRACT_INVALID';
    end if;
  else
    if v_runtime.enforcement_state <> 'disabled' or v_runtime.state_version <> 0
       or v_runtime.compatible_edge_contract_version is not null
       or v_runtime.compatible_frontend_contract_version is not null
       or to_regprocedure('public.patch83tu_catalog_contract_attestation()') is not null
       or v_runtime.designated_super_admin_id is not null
       or v_runtime.prepared_at is not null
       or v_runtime.activated_at is not null then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_LEGACY_RUNTIME_OR_CATALOG_PRESTATE_INVALID';
    end if;
    if exists (select 1 from public.patch83u_runtime_events) then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_LEGACY_RUNTIME_EVENT_PRESTATE_INVALID';
    end if;

    foreach v_table in array array[
      'company_rollout_waves','final_go_live_stop_rules','final_pilot_signoff_matrix',
      'final_validation_runs','i18n_translation_coverage_items','mock_data_allowlist',
      'phased_auto_test_cases','phased_auto_test_phases','phased_auto_test_results',
      'phased_auto_test_runs','pilot_execution_runs','pilot_feedback_items',
      'pilot_fix_sprint_items','production_data_switchovers','production_empty_state_checks',
      'production_exception_register_v58','rtl_visual_qa_items','v50_scale_test_results'
    ] loop
      if not exists (
        select 1 from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = v_table
          and c.relkind in ('r','p')
          and not c.relrowsecurity and not c.relforcerowsecurity
      ) or exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = v_table
      ) or (
        select count(*)
        from information_schema.role_table_grants g
        where g.table_schema = 'public'
          and g.table_name = v_table
          and g.grantee in ('anon', 'authenticated', 'service_role')
      ) <> 21 or exists (
        select 1
        from information_schema.role_table_grants g
        join pg_catalog.pg_class c
          on c.relnamespace = 'public'::regnamespace and c.relname = v_table
        join pg_catalog.pg_roles owner_role on owner_role.oid = c.relowner
        where g.table_schema = 'public'
          and g.table_name = v_table
          and g.grantee not in (
            'anon', 'authenticated', 'service_role', owner_role.rolname
          )
      ) then
        raise exception using errcode = 'P0001',
          message = 'PATCH187_LEGACY_PRE182_TABLE_OR_ACL_STATE_INVALID', detail = v_table;
      end if;
    end loop;

    foreach v_view in array array[
      'v_v38_final_readiness_scorecard','v_v46_language_rtl_readiness',
      'v_v46_production_hardening_scorecard','v_v58_overall_production_readiness',
      'v_v58_pilot_readiness_scorecard','v_v58_rollout_readiness_scorecard',
      'v_v59_latest_phase_results','v_v59_phase_test_scorecard',
      'v_v59_production_data_readiness','v_v60_empty_state_readiness'
    ] loop
      if not exists (
        select 1 from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = v_view and c.relkind = 'v'
      ) or (
        select count(*)
        from information_schema.role_table_grants g
        where g.table_schema = 'public'
          and g.table_name = v_view
          and g.grantee in ('anon', 'authenticated', 'service_role')
      ) <> 21 or exists (
        select 1
        from information_schema.role_table_grants g
        join pg_catalog.pg_class c
          on c.relnamespace = 'public'::regnamespace and c.relname = v_view
        join pg_catalog.pg_roles owner_role on owner_role.oid = c.relowner
        where g.table_schema = 'public'
          and g.table_name = v_view
          and g.grantee not in (
            'anon', 'authenticated', 'service_role', owner_role.rolname
          )
      ) then
        raise exception using errcode = 'P0001',
          message = 'PATCH187_LEGACY_PRE182_VIEW_OR_ACL_STATE_INVALID', detail = v_view;
      end if;
    end loop;

    if exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'public' and (
        p.policyname like 'patch183\_%' escape '\'
        or p.policyname in (
          'pilot_go_no_go_reviews_super_admin_read',
          'pilot_go_no_go_events_super_admin_read'
        )
      )
    ) or (
      select count(*) from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.policyname in (
          'pilot_go_no_go_reviews_select_all',
          'pilot_go_no_go_events_select_all'
        )
    ) <> 2 then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_LEGACY_PRE183_OR_PRE185_POLICY_STATE_INVALID';
    end if;

    -- This is the only accepted bridge credential state. It is deliberately
    -- narrower than bootstrap eligibility: the legacy administrator must still
    -- owe the first mandatory password rotation, must have matching zero
    -- credential versions, and must not have a live session or refresh token.
    select count(distinct p.id)::integer into v_transitional_admins
    from public.profiles p
    join public.user_credential_states cs on cs.user_id = p.id
    join auth.users au on au.id = p.id
    where public.patch83u_bootstrap_super_admin_eligible(p.id)
      and p.is_active = true
      and p.user_status = 'active'
      and cs.organization_id = p.organization_id
      and cs.identity_mode = 'legacy_verified'
      and cs.credential_state = 'existing_password_rotation_pending'
      and cs.requested_lifecycle = 'active'
      and cs.credential_version = 0
      and public.patch83u_auth_credential_version(au.raw_app_meta_data) = 0
      and cs.pending_operation_id is null
      and cs.pending_session_id is null
      and cs.pending_credential_version is null
      and cs.operation_source is null
      and cs.role_suspension_id is null
      and cs.reconciliation_auth_changed = false
      and cs.password_changed_at is null
      and not exists (select 1 from auth.sessions s where s.user_id = p.id)
      and not exists (
        select 1 from auth.refresh_tokens rt
        where rt.user_id = p.id::text and rt.revoked = false
      )
      and 1 = (
        select count(*) from public.user_roles ur
        where ur.user_id = p.id and ur.is_active = true
          and ur.role = 'super_admin' and ur.scope = 'global'
          and ur.organization_id = p.organization_id
          and ur.division_id is null and ur.department_id is null and ur.unit_id is null
      );
    if v_transitional_admins <> 1 then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_TRANSITIONAL_SUPER_ADMIN_CONTRACT_MISMATCH',
        detail = pg_catalog.format('transitional_count=%s', v_transitional_admins);
    end if;
  end if;

  perform pg_catalog.set_config('patch83b.migration_187_lineage', v_path, true);
end;
$patch187_preflight$;

-- Only the production bridge path executes the source-bound 181-185 effects.
-- Every statement remains within this migration transaction; any failure rolls
-- back the complete bridge and migration 181-185 history is never fabricated.
do $patch187_apply_legacy$
begin
  if current_setting('patch83b.migration_187_lineage', true) = 'production_bridge_lineage' then

  -- Exact migration-181 catalog/security effects.
  execute $patch13b_181_001$
create or replace function public.patch83tu_catalog_contract_attestation()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $function$
  with required_functions(signature, contract_group, execution_contract) as (
    values
      ('public.patch83u_get_capabilities(uuid,text,text)'::text, 'edge_service_rpc'::text, 'service_role_only'::text),
      ('public.patch83u_get_credential_state(uuid,integer,text,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83t_get_user_import_capabilities(uuid,text,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83t_user_import_identity_references(uuid,text[])', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_list_provisioning(uuid)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_claim_provisioning(uuid,uuid,text,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_finalize_provisioning(uuid,uuid,uuid,uuid,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_fail_provisioning(uuid,uuid,uuid,text,text,boolean)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_reconcile_provisioning(uuid,uuid,text,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_prepare_required_password_change(uuid,text,integer,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_begin_required_password_change(uuid,text,integer,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_finalize_required_password_change(uuid,uuid,text,integer,text,boolean)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_abort_required_password_change(uuid,uuid,text,boolean,boolean,text,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_begin_admin_reset(uuid,uuid,text,text,text,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_admin_reset_session_revocation_proof(uuid,uuid,uuid,text,integer,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_finalize_admin_reset(uuid,uuid,uuid,text,integer,text,boolean)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_abort_admin_reset(uuid,uuid,uuid,text,boolean,boolean,text,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_reconcile_credential_state(uuid,uuid,text,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_assign_user_role(uuid,uuid,public.app_role,public.access_scope,uuid,uuid,uuid,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_deactivate_user_role(uuid,uuid,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83t_apply_user_excel_import(uuid,jsonb)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83t_update_user_profile(uuid,uuid,jsonb)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_apply_user_lifecycle(uuid,uuid,text,text)', 'edge_service_rpc', 'service_role_only'),
      ('public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)', 'last_super_admin_recovery', 'owner_only'),
      ('public.patch83v_runtime_action_authorized(text,text)', 'auxiliary_contract', 'service_role_only')
  ), function_contracts as (
    select
      rf.signature,
      rf.contract_group,
      rf.execution_contract,
      p.oid is not null as function_exists,
      coalesce(p.prosecdef, false) as security_definer,
      coalesce(p.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public, pg_temp']
        or coalesce(p.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, extensions, public, pg_temp']
        as restricted_search_path,
      case when p.oid is null then null else
        encode(extensions.digest(convert_to(pg_catalog.pg_get_functiondef(p.oid), 'UTF8'), 'sha256'), 'hex')
      end as definition_sha256,
      case when p.oid is null then false
      when rf.execution_contract = 'owner_only' then
        not has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not has_function_privilege('anon', p.oid, 'EXECUTE')
        and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not exists (
          select 1
          from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE'
        )
      else
        has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not has_function_privilege('anon', p.oid, 'EXECUTE')
        and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not exists (
          select 1
          from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE'
        )
      end as execution_contract_pass
    from required_functions rf
    left join pg_catalog.pg_proc p on p.oid = to_regprocedure(rf.signature)
  ), required_relations(relation_name, force_required) as (
    values
      ('department_import_batches'::text, false),
      ('user_management_import_batches'::text, false),
      ('user_management_import_rows'::text, false),
      ('patch83u_credential_operations'::text, true),
      ('patch83u_runtime_control'::text, true),
      ('patch83u_runtime_events'::text, true),
      ('user_account_provisioning'::text, true),
      ('user_credential_events'::text, true),
      ('user_credential_states'::text, true),
      ('user_credential_suspended_roles'::text, true)
  ), relation_contracts as (
    select
      rr.relation_name,
      rr.force_required,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced,
      encode(extensions.digest(convert_to(coalesce((
        select string_agg(
          concat_ws('|', p.policyname, p.permissive, p.roles::text, p.cmd, p.qual, p.with_check),
          E'\n' order by p.policyname
        )
        from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = rr.relation_name
      ), ''), 'UTF8'), 'sha256'), 'hex') as policy_contract_sha256,
      encode(extensions.digest(convert_to(coalesce((
        select string_agg(acl::text, E'\n' order by acl::text)
        from unnest(coalesce(c.relacl, '{}'::aclitem[])) acl
      ), ''), 'UTF8'), 'sha256'), 'hex')
        as acl_sha256
    from required_relations rr
    join pg_catalog.pg_class c on c.oid = to_regclass('public.' || rr.relation_name)
  ), runtime_contract as (
    select
      rc.schema_version,
      rc.enforcement_state,
      rc.state_version,
      rc.expected_edge_contract_version as edge_contract,
      rc.expected_frontend_contract_version as frontend_contract,
      rc.compatible_edge_contract_version = rc.expected_edge_contract_version
        and rc.compatible_frontend_contract_version = rc.expected_frontend_contract_version
        as contracts_compatible
    from public.patch83u_runtime_control rc
    where rc.singleton
  ), contract_result as (
    select
      (select count(*) = 24 from function_contracts where contract_group = 'edge_service_rpc')
        and not exists (
          select 1 from function_contracts
          where not function_exists or not security_definer or not restricted_search_path or not execution_contract_pass
        )
        and position(
          'public.patch83u_reconcile_last_super_admin_recovery' in
          coalesce(pg_catalog.pg_get_functiondef(
            to_regprocedure('public.patch83u_reconcile_credential_state(uuid,uuid,text,text)')
          ), '')
        ) > 0
        as functions_pass,
      not exists (
        select 1 from relation_contracts
        where not rls_enabled or rls_forced <> force_required
      ) as relations_pass,
      coalesce((select enforcement_state = 'enforced' and state_version >= 5 and contracts_compatible from runtime_contract), false)
        as runtime_pass,
      to_regprocedure('public.patch83u_finalize_required_password_change_after_session_revoca(uuid,uuid,text,integer,text)') is null
        and to_regprocedure('public.patch83u_finalize_required_password_change_after_session_revocation(uuid,uuid,text,integer,text)') is null
        as legacy_finalizer_absent
  )
  select jsonb_build_object(
    'attestation_version', 'patch83tu-catalog-contract-v3',
    'safe_metadata_only', true,
    'overall_pass', cr.functions_pass and cr.relations_pass and cr.runtime_pass and cr.legacy_finalizer_absent,
    'edge_service_rpc_count', (select count(*) from function_contracts where contract_group = 'edge_service_rpc'),
    'last_super_admin_recovery_contract', jsonb_build_object(
      'owner_only_implementation_count', (
        select count(*) from function_contracts
        where contract_group = 'last_super_admin_recovery'
          and function_exists and security_definer and restricted_search_path
          and execution_contract_pass
      ),
      'wrapper_calls_owner_only_implementation', position(
        'public.patch83u_reconcile_last_super_admin_recovery' in
        coalesce(pg_catalog.pg_get_functiondef(
          to_regprocedure('public.patch83u_reconcile_credential_state(uuid,uuid,text,text)')
        ), '')
      ) > 0
    ),
    'runtime', (select to_jsonb(runtime_contract) from runtime_contract),
    'functions', (select jsonb_agg(to_jsonb(fc) order by fc.contract_group, fc.signature) from function_contracts fc),
    'relations', (select jsonb_agg(to_jsonb(rc) order by rc.relation_name) from relation_contracts rc),
    'legacy_finalizer_absent', cr.legacy_finalizer_absent
  )
  from contract_result cr;
$function$;
$patch13b_181_001$;

  execute $patch13b_181_002$
revoke all on function public.patch83tu_catalog_contract_attestation() from public, anon, authenticated;
$patch13b_181_002$;

  execute $patch13b_181_003$
grant execute on function public.patch83tu_catalog_contract_attestation() to service_role;
$patch13b_181_003$;

  execute $patch13b_181_004$
comment on function public.patch83tu_catalog_contract_attestation() is
  'Patch 181 service-role-only schema attestation v3. Binds all 24 Edge-invoked Patch 83T/U RPCs, the owner-only last-Super-Admin recovery implementation, and the exact RLS contract; returns safe metadata and hashes only.';
$patch13b_181_004$;

  -- Exact migration-182 catalog/security effects.
  execute $patch13b_182_001$
do $migration$
declare
  v_table text;
  v_view text;
  v_tables constant text[] := array[
    'company_rollout_waves',
    'final_go_live_stop_rules',
    'final_pilot_signoff_matrix',
    'final_validation_runs',
    'i18n_translation_coverage_items',
    'mock_data_allowlist',
    'phased_auto_test_cases',
    'phased_auto_test_phases',
    'phased_auto_test_results',
    'phased_auto_test_runs',
    'pilot_execution_runs',
    'pilot_feedback_items',
    'pilot_fix_sprint_items',
    'production_data_switchovers',
    'production_empty_state_checks',
    'production_exception_register_v58',
    'rtl_visual_qa_items',
    'v50_scale_test_results'
  ];
  v_views constant text[] := array[
    'v_v38_final_readiness_scorecard',
    'v_v46_language_rtl_readiness',
    'v_v46_production_hardening_scorecard',
    'v_v58_overall_production_readiness',
    'v_v58_pilot_readiness_scorecard',
    'v_v58_rollout_readiness_scorecard',
    'v_v59_latest_phase_results',
    'v_v59_phase_test_scorecard',
    'v_v59_production_data_readiness',
    'v_v60_empty_state_readiness'
  ];
begin
  foreach v_table in array v_tables loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relkind in ('r','p')
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH182_REQUIRED_TABLE_MISSING', detail = v_table;
    end if;

    if exists (
      select 1 from pg_catalog.pg_policy p
      join pg_catalog.pg_class c on c.oid = p.polrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH182_UNEXPECTED_EXISTING_POLICY', detail = v_table;
    end if;
  end loop;

  foreach v_view in array v_views loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_view and c.relkind = 'v'
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH182_DEPENDENT_VIEW_MISSING', detail = v_view;
    end if;
  end loop;

  foreach v_table in array v_tables loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', v_table);
    execute format('revoke all privileges on table public.%I from service_role', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
    execute format(
      'comment on table public.%I is %L',
      v_table,
      'Patch 182 legacy-table hardening: FORCE RLS; no direct browser access; service-role/protected-RPC CRUD only. Gate 4 remediation.'
    );
  end loop;

  -- These owner-rights legacy views can transitively expose the remediated tables.
  -- Close browser ACLs instead of depending on view-owner RLS behavior.
  foreach v_view in array v_views loop
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', v_view);
    execute format('revoke all privileges on table public.%I from service_role', v_view);
    execute format('grant select on table public.%I to service_role', v_view);
    execute format(
      'comment on view public.%I is %L',
      v_view,
      'Patch 182 protected legacy evidence view: service-role/protected-RPC read only; browser access revoked.'
    );
  end loop;
end;
$migration$;
$patch13b_182_001$;

  -- Exact migration-183 catalog/security effects.
  execute $patch13b_183_001$
do $patch183_preflight$
declare
  v record;
  v_existing_names text[];
  v_allowed_names text[];
  v_post_count integer;
  v_index integer;
  v_actual_hash text;
begin
  for v in
    select * from (values
      ('backup_packages', array['Authenticated can insert backup packages','Authenticated can read backup packages']::text[], array['7991638461db0b556dcdd004feb33ab115a8036c9c930d681783cfb4b8c3c15e','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_backup_packages_privileged_read'),
      ('export_logs', array['Authenticated can insert export logs','export_logs_read_privileged']::text[], array['7991638461db0b556dcdd004feb33ab115a8036c9c930d681783cfb4b8c3c15e','34c262c8cab824590e54947c34d36c7141e17eec0607198030d9165de8dcdd55']::text[], 'patch183_export_logs_privileged_read'),
      ('production_validation_runs', array['Authenticated can manage production validation','Authenticated can read production validation']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_production_validation_runs_privileged_read'),
      ('release_candidate_controls', array['Authenticated can manage release controls','Authenticated can read release controls']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_release_candidate_controls_privileged_read'),
      ('rls_persona_test_cases', array['Authenticated can manage rls persona cases','Authenticated can read rls persona cases']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_rls_persona_test_cases_privileged_read'),
      ('rls_persona_test_runs', array['Authenticated can manage rls persona runs','Authenticated can read rls persona runs']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_rls_persona_test_runs_privileged_read'),
      ('rls_violation_findings', array['Authenticated can manage rls violation findings','Authenticated can read rls violation findings']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_rls_violation_findings_privileged_read'),
      ('supabase_install_verification_items', array['Authenticated can manage install verification','Authenticated can read install verification']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_supabase_install_verification_items_privileged_read'),
      ('system_health_snapshots', array['Authenticated can insert health snapshots','Authenticated can read health snapshots']::text[], array['7991638461db0b556dcdd004feb33ab115a8036c9c930d681783cfb4b8c3c15e','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_system_health_snapshots_privileged_read')
    ) as expected(table_name, legacy_policy_names, legacy_policy_hashes, read_policy_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v.table_name
        and c.relkind in ('r','p')
        and pg_catalog.pg_get_userbyid(c.relowner) = 'postgres'
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH183_REQUIRED_POST182_TABLE_MISSING_OR_OWNER_DRIFT', detail = v.table_name;
    end if;

    select coalesce(array_agg(p.polname order by p.polname), array[]::text[])
      into v_existing_names
    from pg_catalog.pg_policy p
    join pg_catalog.pg_class c on c.oid = p.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v.table_name;

    v_allowed_names := array['patch83u_credential_gate', v.read_policy_name]
      || v.legacy_policy_names;
    if v.table_name = 'export_logs' then
      v_allowed_names := v_allowed_names || array['patch183_export_logs_append'];
    end if;

    if exists (
      select 1 from unnest(v_existing_names) as policy_name
      where not (policy_name = any(v_allowed_names))
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH183_UNEXPECTED_POLICY_DEFINITION',
        detail = format('%s: %s', v.table_name, array_to_string(v_existing_names, ', '));
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_policy p
      join pg_catalog.pg_class c on c.oid = p.polrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v.table_name
        and p.polname = 'patch83u_credential_gate'
        and p.polpermissive = false
        and p.polcmd = '*'
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH183_CREDENTIAL_GATE_MISSING_OR_DRIFTED', detail = v.table_name;
    end if;

    select count(*) into v_post_count
    from unnest(v_existing_names) policy_name
    where policy_name = v.read_policy_name
       or (v.table_name = 'export_logs' and policy_name = 'patch183_export_logs_append');

    if v_post_count = 0 then
      if exists (
        select 1 from unnest(v.legacy_policy_names) required_name
        where not (required_name = any(v_existing_names))
      ) then
        raise exception using errcode = 'P0001',
          message = 'PATCH183_EXPECTED_PRESTATE_POLICY_MISSING', detail = v.table_name;
      end if;
      for v_index in 1..cardinality(v.legacy_policy_names) loop
        select pg_catalog.encode(extensions.digest(
          pg_catalog.concat_ws('|', p.cmd, p.permissive, pg_catalog.array_to_string(p.roles, ','), coalesce(p.qual,''), coalesce(p.with_check,'')),
          'sha256'
        ), 'hex')
          into v_actual_hash
        from pg_catalog.pg_policies p
        where p.schemaname='public' and p.tablename=v.table_name
          and p.policyname=v.legacy_policy_names[v_index];
        if v_actual_hash is distinct from v.legacy_policy_hashes[v_index] then
          raise exception using errcode = 'P0001',
            message = 'PATCH183_EXPECTED_PRESTATE_POLICY_DEFINITION_DRIFT',
            detail = format('%s.%s', v.table_name, v.legacy_policy_names[v_index]);
        end if;
      end loop;
    elsif v_post_count <> (case when v.table_name = 'export_logs' then 2 else 1 end)
       or exists (
         select 1 from unnest(v.legacy_policy_names) legacy_name
         where legacy_name = any(v_existing_names)
       ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH183_MIXED_OR_INCOMPLETE_POLICY_STATE', detail = v.table_name;
    end if;
  end loop;
end;
$patch183_preflight$;
$patch13b_183_001$;

  execute $patch13b_183_002$
lock table
  public.backup_packages,
  public.export_logs,
  public.production_validation_runs,
  public.release_candidate_controls,
  public.rls_persona_test_cases,
  public.rls_persona_test_runs,
  public.rls_violation_findings,
  public.supabase_install_verification_items,
  public.system_health_snapshots
in share row exclusive mode;
$patch13b_183_002$;

  execute $patch13b_183_003$
alter table public.backup_packages enable row level security;
$patch13b_183_003$;

  execute $patch13b_183_004$
alter table public.backup_packages force row level security;
$patch13b_183_004$;

  execute $patch13b_183_005$
alter table public.export_logs enable row level security;
$patch13b_183_005$;

  execute $patch13b_183_006$
alter table public.export_logs force row level security;
$patch13b_183_006$;

  execute $patch13b_183_007$
alter table public.production_validation_runs enable row level security;
$patch13b_183_007$;

  execute $patch13b_183_008$
alter table public.production_validation_runs force row level security;
$patch13b_183_008$;

  execute $patch13b_183_009$
alter table public.release_candidate_controls enable row level security;
$patch13b_183_009$;

  execute $patch13b_183_010$
alter table public.release_candidate_controls force row level security;
$patch13b_183_010$;

  execute $patch13b_183_011$
alter table public.rls_persona_test_cases enable row level security;
$patch13b_183_011$;

  execute $patch13b_183_012$
alter table public.rls_persona_test_cases force row level security;
$patch13b_183_012$;

  execute $patch13b_183_013$
alter table public.rls_persona_test_runs enable row level security;
$patch13b_183_013$;

  execute $patch13b_183_014$
alter table public.rls_persona_test_runs force row level security;
$patch13b_183_014$;

  execute $patch13b_183_015$
alter table public.rls_violation_findings enable row level security;
$patch13b_183_015$;

  execute $patch13b_183_016$
alter table public.rls_violation_findings force row level security;
$patch13b_183_016$;

  execute $patch13b_183_017$
alter table public.supabase_install_verification_items enable row level security;
$patch13b_183_017$;

  execute $patch13b_183_018$
alter table public.supabase_install_verification_items force row level security;
$patch13b_183_018$;

  execute $patch13b_183_019$
alter table public.system_health_snapshots enable row level security;
$patch13b_183_019$;

  execute $patch13b_183_020$
alter table public.system_health_snapshots force row level security;
$patch13b_183_020$;

  execute $patch13b_183_021$
revoke all privileges on table public.backup_packages from public, anon, authenticated, service_role;
$patch13b_183_021$;

  execute $patch13b_183_022$
revoke all privileges on table public.export_logs from public, anon, authenticated, service_role;
$patch13b_183_022$;

  execute $patch13b_183_023$
revoke all privileges on table public.production_validation_runs from public, anon, authenticated, service_role;
$patch13b_183_023$;

  execute $patch13b_183_024$
revoke all privileges on table public.release_candidate_controls from public, anon, authenticated, service_role;
$patch13b_183_024$;

  execute $patch13b_183_025$
revoke all privileges on table public.rls_persona_test_cases from public, anon, authenticated, service_role;
$patch13b_183_025$;

  execute $patch13b_183_026$
revoke all privileges on table public.rls_persona_test_runs from public, anon, authenticated, service_role;
$patch13b_183_026$;

  execute $patch13b_183_027$
revoke all privileges on table public.rls_violation_findings from public, anon, authenticated, service_role;
$patch13b_183_027$;

  execute $patch13b_183_028$
revoke all privileges on table public.supabase_install_verification_items from public, anon, authenticated, service_role;
$patch13b_183_028$;

  execute $patch13b_183_029$
revoke all privileges on table public.system_health_snapshots from public, anon, authenticated, service_role;
$patch13b_183_029$;

  execute $patch13b_183_030$
grant select on table
  public.backup_packages,
  public.export_logs,
  public.production_validation_runs,
  public.release_candidate_controls,
  public.rls_persona_test_cases,
  public.rls_persona_test_runs,
  public.rls_violation_findings,
  public.supabase_install_verification_items,
  public.system_health_snapshots
to authenticated;
$patch13b_183_030$;

  execute $patch13b_183_031$
grant insert on table public.export_logs to authenticated;
$patch13b_183_031$;

  execute $patch13b_183_032$
grant select, insert, update, delete on table
  public.backup_packages,
  public.export_logs,
  public.production_validation_runs,
  public.release_candidate_controls,
  public.rls_persona_test_cases,
  public.rls_persona_test_runs,
  public.rls_violation_findings,
  public.supabase_install_verification_items,
  public.system_health_snapshots
to service_role;
$patch13b_183_032$;

  execute $patch13b_183_033$
drop policy if exists "Authenticated can insert backup packages" on public.backup_packages;
$patch13b_183_033$;

  execute $patch13b_183_034$
drop policy if exists "Authenticated can read backup packages" on public.backup_packages;
$patch13b_183_034$;

  execute $patch13b_183_035$
drop policy if exists "Authenticated can insert export logs" on public.export_logs;
$patch13b_183_035$;

  execute $patch13b_183_036$
drop policy if exists export_logs_read_privileged on public.export_logs;
$patch13b_183_036$;

  execute $patch13b_183_037$
drop policy if exists "Authenticated can manage production validation" on public.production_validation_runs;
$patch13b_183_037$;

  execute $patch13b_183_038$
drop policy if exists "Authenticated can read production validation" on public.production_validation_runs;
$patch13b_183_038$;

  execute $patch13b_183_039$
drop policy if exists "Authenticated can manage release controls" on public.release_candidate_controls;
$patch13b_183_039$;

  execute $patch13b_183_040$
drop policy if exists "Authenticated can read release controls" on public.release_candidate_controls;
$patch13b_183_040$;

  execute $patch13b_183_041$
drop policy if exists "Authenticated can manage rls persona cases" on public.rls_persona_test_cases;
$patch13b_183_041$;

  execute $patch13b_183_042$
drop policy if exists "Authenticated can read rls persona cases" on public.rls_persona_test_cases;
$patch13b_183_042$;

  execute $patch13b_183_043$
drop policy if exists "Authenticated can manage rls persona runs" on public.rls_persona_test_runs;
$patch13b_183_043$;

  execute $patch13b_183_044$
drop policy if exists "Authenticated can read rls persona runs" on public.rls_persona_test_runs;
$patch13b_183_044$;

  execute $patch13b_183_045$
drop policy if exists "Authenticated can manage rls violation findings" on public.rls_violation_findings;
$patch13b_183_045$;

  execute $patch13b_183_046$
drop policy if exists "Authenticated can read rls violation findings" on public.rls_violation_findings;
$patch13b_183_046$;

  execute $patch13b_183_047$
drop policy if exists "Authenticated can manage install verification" on public.supabase_install_verification_items;
$patch13b_183_047$;

  execute $patch13b_183_048$
drop policy if exists "Authenticated can read install verification" on public.supabase_install_verification_items;
$patch13b_183_048$;

  execute $patch13b_183_049$
drop policy if exists "Authenticated can insert health snapshots" on public.system_health_snapshots;
$patch13b_183_049$;

  execute $patch13b_183_050$
drop policy if exists "Authenticated can read health snapshots" on public.system_health_snapshots;
$patch13b_183_050$;

  execute $patch13b_183_051$
drop policy if exists patch183_backup_packages_privileged_read on public.backup_packages;
$patch13b_183_051$;

  execute $patch13b_183_052$
create policy patch183_backup_packages_privileged_read on public.backup_packages
  for select to authenticated
  using (
    public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );
$patch13b_183_052$;

  execute $patch13b_183_053$
drop policy if exists patch183_export_logs_privileged_read on public.export_logs;
$patch13b_183_053$;

  execute $patch13b_183_054$
create policy patch183_export_logs_privileged_read on public.export_logs
  for select to authenticated
  using (
    public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
    and organization_id = public.current_user_org_id()
  );
$patch13b_183_054$;

  execute $patch13b_183_055$
drop policy if exists patch183_export_logs_append on public.export_logs;
$patch13b_183_055$;

  execute $patch13b_183_056$
create policy patch183_export_logs_append on public.export_logs
  for insert to authenticated
  with check (
    auth.uid() is not null
    and organization_id = public.current_user_org_id()
    and public.patch83u_credential_access_allowed()
  );
$patch13b_183_056$;

  execute $patch13b_183_057$
drop policy if exists patch183_production_validation_runs_privileged_read on public.production_validation_runs;
$patch13b_183_057$;

  execute $patch13b_183_058$
create policy patch183_production_validation_runs_privileged_read on public.production_validation_runs
  for select to authenticated
  using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]));
$patch13b_183_058$;

  execute $patch13b_183_059$
drop policy if exists patch183_release_candidate_controls_privileged_read on public.release_candidate_controls;
$patch13b_183_059$;

  execute $patch13b_183_060$
create policy patch183_release_candidate_controls_privileged_read on public.release_candidate_controls
  for select to authenticated
  using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]));
$patch13b_183_060$;

  execute $patch13b_183_061$
drop policy if exists patch183_rls_persona_test_cases_privileged_read on public.rls_persona_test_cases;
$patch13b_183_061$;

  execute $patch13b_183_062$
create policy patch183_rls_persona_test_cases_privileged_read on public.rls_persona_test_cases
  for select to authenticated
  using (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]));
$patch13b_183_062$;

  execute $patch13b_183_063$
drop policy if exists patch183_rls_persona_test_runs_privileged_read on public.rls_persona_test_runs;
$patch13b_183_063$;

  execute $patch13b_183_064$
create policy patch183_rls_persona_test_runs_privileged_read on public.rls_persona_test_runs
  for select to authenticated
  using (
    public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[])
    and organization_id = public.current_user_org_id()
  );
$patch13b_183_064$;

  execute $patch13b_183_065$
drop policy if exists patch183_rls_violation_findings_privileged_read on public.rls_violation_findings;
$patch13b_183_065$;

  execute $patch13b_183_066$
create policy patch183_rls_violation_findings_privileged_read on public.rls_violation_findings
  for select to authenticated
  using (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]));
$patch13b_183_066$;

  execute $patch13b_183_067$
drop policy if exists patch183_supabase_install_verification_items_privileged_read on public.supabase_install_verification_items;
$patch13b_183_067$;

  execute $patch13b_183_068$
create policy patch183_supabase_install_verification_items_privileged_read on public.supabase_install_verification_items
  for select to authenticated
  using (public.has_any_role(array['super_admin','governance_admin','auditor']::public.app_role[]));
$patch13b_183_068$;

  execute $patch13b_183_069$
drop policy if exists patch183_system_health_snapshots_privileged_read on public.system_health_snapshots;
$patch13b_183_069$;

  execute $patch13b_183_070$
create policy patch183_system_health_snapshots_privileged_read on public.system_health_snapshots
  for select to authenticated
  using (
    public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );
$patch13b_183_070$;

  execute $patch13b_183_071$
-- All dependent views were already security-invoker in the verified post-182
-- staging catalog. Preserve that property and close the remaining anon grant.
do $patch183_views$
declare
  v_view text;
  v_views constant text[] := array[
    'v_backup_health_check','v_backup_restore_drillboard','v_data_retention_readiness',
    'v_rls_persona_lab','v_setup_readiness_checklist','v_ultra_release_summary',
    'v_v42_release_candidate_scorecard','v_v42_rls_persona_matrix',
    'v_v42_rls_test_case_queue','v_v42_supabase_install_status'
  ];
begin
  foreach v_view in array v_views loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_view and c.relkind = 'v'
        and 'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[]))
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH183_DEPENDENT_VIEW_NOT_SECURITY_INVOKER', detail = v_view;
    end if;
    execute format('revoke all privileges on table public.%I from public, anon', v_view);
    execute format('grant select on table public.%I to authenticated, service_role', v_view);
    execute format(
      'comment on view public.%I is %L', v_view,
      'Patch 183 dependent security-invoker view. Browser rows remain constrained by hardened base-table RLS; anon access revoked.'
    );
  end loop;
end;
$patch183_views$;
$patch13b_183_071$;

  execute $patch13b_183_072$
comment on policy patch183_backup_packages_privileged_read on public.backup_packages is 'Gate 9R: privileged, credential-gated, organization-scoped read; browser writes revoked.';
$patch13b_183_072$;

  execute $patch13b_183_073$
comment on policy patch183_export_logs_privileged_read on public.export_logs is 'Gate 9R: privileged, credential-gated, organization-scoped audit-log read.';
$patch13b_183_073$;

  execute $patch13b_183_074$
comment on policy patch183_export_logs_append on public.export_logs is 'Gate 9R: append-only authenticated export event in the caller organization; update/delete revoked.';
$patch13b_183_074$;

  execute $patch13b_183_075$
comment on policy patch183_production_validation_runs_privileged_read on public.production_validation_runs is 'Gate 9R: privileged read; service-role/protected workflow writes only.';
$patch13b_183_075$;

  execute $patch13b_183_076$
comment on policy patch183_release_candidate_controls_privileged_read on public.release_candidate_controls is 'Gate 9R: privileged read; service-role/protected workflow writes only.';
$patch13b_183_076$;

  execute $patch13b_183_077$
comment on policy patch183_rls_persona_test_cases_privileged_read on public.rls_persona_test_cases is 'Gate 9R: security-governance read; service-role/protected workflow writes only.';
$patch13b_183_077$;

  execute $patch13b_183_078$
comment on policy patch183_rls_persona_test_runs_privileged_read on public.rls_persona_test_runs is 'Gate 9R: security-governance, organization-scoped read; service-role writes only.';
$patch13b_183_078$;

  execute $patch13b_183_079$
comment on policy patch183_rls_violation_findings_privileged_read on public.rls_violation_findings is 'Gate 9R: security-governance read; service-role/protected workflow writes only.';
$patch13b_183_079$;

  execute $patch13b_183_080$
comment on policy patch183_supabase_install_verification_items_privileged_read on public.supabase_install_verification_items is 'Gate 9R: security-administration read; service-role/protected workflow writes only.';
$patch13b_183_080$;

  execute $patch13b_183_081$
comment on policy patch183_system_health_snapshots_privileged_read on public.system_health_snapshots is 'Gate 9R: privileged, organization-scoped health read; protected workflow writes only.';
$patch13b_183_081$;

  -- Exact migration-184 catalog/security effects.
  execute $patch13b_184_001$
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
$patch13b_184_001$;

  execute $patch13b_184_002$
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
$patch13b_184_002$;

  -- Exact migration-185 catalog/security effects.
  execute $patch13b_185_001$
do $gate11r_preflight$
declare
  v_table text;
  v_old_policy text;
  v_new_policy text;
  v_old_count integer;
  v_new_count integer;
  v_new_qual text;
begin
  if to_regprocedure('public.patch83u_credential_access_allowed()') is null
     or to_regprocedure('public.has_any_role(public.app_role[])') is null
  then
    raise exception 'PATCH185_REQUIRED_AUTHORIZATION_HELPER_MISSING';
  end if;

  if to_regclass('public.v_patch44_pilot_go_no_go_dashboard') is null
     or not exists (
       select 1
       from pg_class c
       where c.oid = 'public.v_patch44_pilot_go_no_go_dashboard'::regclass
         and c.relkind = 'v'
         and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
     )
  then
    raise exception 'PATCH185_SECURITY_INVOKER_VIEW_REQUIRED';
  end if;

  foreach v_table in array array[
    'pilot_go_no_go_reviews',
    'pilot_go_no_go_events'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null
       or not exists (
         select 1
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = v_table
           and c.relkind in ('r', 'p')
           and c.relrowsecurity
       )
    then
      raise exception 'PATCH185_REQUIRED_RLS_TABLE_MISSING: %', v_table;
    end if;

    if v_table = 'pilot_go_no_go_reviews' then
      v_old_policy := 'pilot_go_no_go_reviews_select_all';
      v_new_policy := 'pilot_go_no_go_reviews_super_admin_read';
    else
      v_old_policy := 'pilot_go_no_go_events_select_all';
      v_new_policy := 'pilot_go_no_go_events_super_admin_read';
    end if;

    select count(*) into v_old_count
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_table
      and p.policyname = v_old_policy
      and p.permissive = 'PERMISSIVE'
      and p.cmd = 'SELECT'
      and p.roles = array['public']::name[]
      and p.qual = 'true'
      and p.with_check is null;

    select count(*), max(p.qual) into v_new_count, v_new_qual
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_table
      and p.policyname = v_new_policy
      and p.permissive = 'PERMISSIVE'
      and p.cmd = 'SELECT'
      and p.roles = array['authenticated']::name[]
      and p.with_check is null;

    if v_old_count = 1 and v_new_count = 0 then
      null;
    elsif v_old_count = 0 and v_new_count = 1 then
      if regexp_replace(coalesce(v_new_qual, ''), '\s+', '', 'g')
           <> regexp_replace(
             '(patch83u_credential_access_allowed() AND has_any_role(ARRAY[''super_admin''::app_role]))',
             '\s+', '', 'g'
           )
      then
        raise exception 'PATCH185_RESTRICTIVE_POLICY_DEFINITION_DRIFT: %', v_table;
      end if;
    else
      raise exception 'PATCH185_POLICY_STATE_CONFLICT: % old=% new=%',
        v_table, v_old_count, v_new_count;
    end if;

    if exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_table
        and p.policyname not in (
          'patch83u_credential_gate', v_old_policy, v_new_policy
        )
    )
    then
      raise exception 'PATCH185_UNEXPECTED_POLICY_PRESENT: %', v_table;
    end if;
  end loop;
end;
$gate11r_preflight$;
$patch13b_185_001$;

  execute $patch13b_185_002$
lock table public.pilot_go_no_go_reviews in share row exclusive mode;
$patch13b_185_002$;

  execute $patch13b_185_003$
lock table public.pilot_go_no_go_events in share row exclusive mode;
$patch13b_185_003$;

  execute $patch13b_185_004$
alter table public.pilot_go_no_go_reviews enable row level security;
$patch13b_185_004$;

  execute $patch13b_185_005$
alter table public.pilot_go_no_go_reviews force row level security;
$patch13b_185_005$;

  execute $patch13b_185_006$
alter table public.pilot_go_no_go_events enable row level security;
$patch13b_185_006$;

  execute $patch13b_185_007$
alter table public.pilot_go_no_go_events force row level security;
$patch13b_185_007$;

  execute $patch13b_185_008$
drop policy if exists pilot_go_no_go_reviews_select_all
  on public.pilot_go_no_go_reviews;
$patch13b_185_008$;

  execute $patch13b_185_009$
drop policy if exists pilot_go_no_go_events_select_all
  on public.pilot_go_no_go_events;
$patch13b_185_009$;

  execute $patch13b_185_010$
do $gate11r_create_policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pilot_go_no_go_reviews'
      and policyname = 'pilot_go_no_go_reviews_super_admin_read'
  ) then
    create policy pilot_go_no_go_reviews_super_admin_read
      on public.pilot_go_no_go_reviews
      as permissive
      for select
      to authenticated
      using (
        public.patch83u_credential_access_allowed()
        and public.has_any_role(array['super_admin']::public.app_role[])
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pilot_go_no_go_events'
      and policyname = 'pilot_go_no_go_events_super_admin_read'
  ) then
    create policy pilot_go_no_go_events_super_admin_read
      on public.pilot_go_no_go_events
      as permissive
      for select
      to authenticated
      using (
        public.patch83u_credential_access_allowed()
        and public.has_any_role(array['super_admin']::public.app_role[])
      );
  end if;
end;
$gate11r_create_policies$;
$patch13b_185_010$;

  execute $patch13b_185_011$
revoke all on table public.pilot_go_no_go_reviews from public, anon, authenticated, service_role;
$patch13b_185_011$;

  execute $patch13b_185_012$
revoke all on table public.pilot_go_no_go_events from public, anon, authenticated, service_role;
$patch13b_185_012$;

  execute $patch13b_185_013$
grant select on table public.pilot_go_no_go_reviews to authenticated, service_role;
$patch13b_185_013$;

  execute $patch13b_185_014$
grant select on table public.pilot_go_no_go_events to authenticated, service_role;
$patch13b_185_014$;

  execute $patch13b_185_015$
revoke all on table public.v_patch44_pilot_go_no_go_dashboard
  from public, anon, authenticated, service_role;
$patch13b_185_015$;

  execute $patch13b_185_016$
grant select on table public.v_patch44_pilot_go_no_go_dashboard
  to authenticated, service_role;
$patch13b_185_016$;

  execute $patch13b_185_017$
comment on policy pilot_go_no_go_reviews_super_admin_read
  on public.pilot_go_no_go_reviews is
  'Gate 11R: credential-valid active global Super Admin read of legacy unscoped pilot governance reviews.';
$patch13b_185_017$;

  execute $patch13b_185_018$
comment on policy pilot_go_no_go_events_super_admin_read
  on public.pilot_go_no_go_events is
  'Gate 11R: credential-valid active global Super Admin read of append-only pilot governance events.';
$patch13b_185_018$;

  execute $patch13b_185_019$
comment on table public.pilot_go_no_go_reviews is
  'Gate 11R remediated: no anonymous access; protected RPC writes; credential-valid global Super Admin reads only.';
$patch13b_185_019$;

  execute $patch13b_185_020$
comment on table public.pilot_go_no_go_events is
  'Gate 11R remediated append-only audit events: no anonymous access; protected RPC writes; credential-valid global Super Admin reads only.';
$patch13b_185_020$;

  execute $patch13b_185_021$
do $gate11r_postflight$
declare
  v_table text;
  v_policy text;
  v_qual text;
begin
  foreach v_table in array array[
    'pilot_go_no_go_reviews',
    'pilot_go_no_go_events'
  ] loop
    v_policy := case v_table
      when 'pilot_go_no_go_reviews' then 'pilot_go_no_go_reviews_super_admin_read'
      else 'pilot_go_no_go_events_super_admin_read'
    end;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'PATCH185_RLS_FORCE_POSTFLIGHT_FAILED: %', v_table;
    end if;

    select p.qual into v_qual
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_table
      and p.policyname = v_policy
      and p.permissive = 'PERMISSIVE'
      and p.cmd = 'SELECT'
      and p.roles = array['authenticated']::name[]
      and p.with_check is null;

    if regexp_replace(coalesce(v_qual, ''), '\s+', '', 'g')
         <> regexp_replace(
           '(patch83u_credential_access_allowed() AND has_any_role(ARRAY[''super_admin''::app_role]))',
           '\s+', '', 'g'
         )
    then
      raise exception 'PATCH185_RESTRICTIVE_POLICY_POSTFLIGHT_FAILED: %', v_table;
    end if;

    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('anon', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_table), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE')
       or not has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT')
    then
      raise exception 'PATCH185_TABLE_ACL_POSTFLIGHT_FAILED: %', v_table;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.v_patch44_pilot_go_no_go_dashboard', 'SELECT')
     or not has_table_privilege('authenticated', 'public.v_patch44_pilot_go_no_go_dashboard', 'SELECT')
     or not has_table_privilege('service_role', 'public.v_patch44_pilot_go_no_go_dashboard', 'SELECT')
  then
    raise exception 'PATCH185_VIEW_ACL_POSTFLIGHT_FAILED';
  end if;

  if has_function_privilege('anon', 'public.create_pilot_go_no_go_review(text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.create_pilot_go_no_go_review(text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.update_pilot_go_no_go_review_status(uuid,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.update_pilot_go_no_go_review_status(uuid,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.record_pilot_go_no_go_event(uuid,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.record_pilot_go_no_go_event(uuid,text,text,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.create_pilot_go_no_go_review(text,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.update_pilot_go_no_go_review_status(uuid,text,text,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.record_pilot_go_no_go_event(uuid,text,text,uuid)', 'EXECUTE')
  then
    raise exception 'PATCH185_PROTECTED_RPC_ACL_DRIFT';
  end if;
end;
$gate11r_postflight$;
$patch13b_185_021$;
  end if;
end;
$patch187_apply_legacy$;

-- Common, truthful activation provenance. The legacy branch deliberately does
-- not populate compatibility_attested_at/by and does not create a historical
-- compatibility_attested runtime event.
alter table public.patch83u_runtime_control
  add column if not exists activation_provenance text not null default 'edge_authenticated';
alter table public.patch83u_runtime_control
  add column if not exists legacy_bridge_id text;
alter table public.patch83u_runtime_control
  add column if not exists legacy_bridge_applied_at timestamptz;

alter table public.patch83u_runtime_control
  drop constraint if exists patch83b_runtime_activation_provenance_contract;
alter table public.patch83u_runtime_control
  add constraint patch83b_runtime_activation_provenance_contract check (
    (activation_provenance = 'edge_authenticated'
      and legacy_bridge_id is null and legacy_bridge_applied_at is null)
    or
    (activation_provenance = 'legacy_migration_bridge'
      and legacy_bridge_id is not null
      and legacy_bridge_id ~ '^[a-z0-9:._-]{1,160}$'
      and legacy_bridge_applied_at is not null)
  );

alter table public.patch83u_runtime_control
  drop constraint if exists patch83u_runtime_prepared_contract;
alter table public.patch83u_runtime_control
  add constraint patch83u_runtime_prepared_contract check (
    enforcement_state = 'disabled'
    or (
      preflight_hash is not null
      and designated_super_admin_id is not null
      and prepared_at is not null
      and (
        (activation_provenance = 'edge_authenticated' and prepared_by is not null)
        or
        (activation_provenance = 'legacy_migration_bridge' and prepared_by is null)
      )
    )
  );

alter table public.patch83u_runtime_control
  drop constraint if exists patch83u_runtime_enforced_contract;
alter table public.patch83u_runtime_control
  add constraint patch83u_runtime_enforced_contract check (
    enforcement_state <> 'enforced'
    or (
      activation_provenance = 'edge_authenticated'
      and activated_at is not null
      and activated_by is not null
      and compatibility_attested_at is not null
      and compatibility_attested_by = designated_super_admin_id
      and compatible_edge_contract_version = expected_edge_contract_version
      and compatible_frontend_contract_version = expected_frontend_contract_version
    )
    or (
      activation_provenance = 'legacy_migration_bridge'
      and state_version = 5
      and activated_at is not null
      and activated_by is null
      and compatibility_attested_at is null
      and compatibility_attested_by is null
      and compatible_edge_contract_version = expected_edge_contract_version
      and compatible_frontend_contract_version = expected_frontend_contract_version
    )
  );

create table if not exists public.patch83b_legacy_runtime_bridges (
  bridge_id text primary key check (
    length(bridge_id) between 1 and 160
    and bridge_id ~ '^[a-z0-9:._-]+$'
  ),
  lineage text not null check (lineage = 'production_bridge_lineage'),
  source_migration_ceiling integer not null check (source_migration_ceiling = 180),
  bridge_migration_version integer not null check (bridge_migration_version = 187),
  source_release_commit text not null check (source_release_commit ~ '^[0-9a-f]{40}$'),
  operator_classification text not null check (
    operator_classification = 'authorized_database_deployment_operator'
  ),
  controls_installed jsonb not null check (
    controls_installed = '[181, 182, 183, 184, 185]'::jsonb
  ),
  role_reconciliation_event_key text not null references
    public.patch83b_release_migration_events(event_key) on delete restrict,
  runtime_state_version integer not null check (runtime_state_version = 5),
  historical_edge_attestation_claimed boolean not null check (
    historical_edge_attestation_claimed = false
  ),
  historical_access_review_claimed boolean not null check (
    historical_access_review_claimed = false
  ),
  auth_rows_changed boolean not null check (auth_rows_changed = false),
  credential_or_session_rows_changed boolean not null check (
    credential_or_session_rows_changed = false
  ),
  mandatory_super_admin_password_rotation text not null check (
    mandatory_super_admin_password_rotation = 'required'
  ),
  transitional_credential_state text not null check (
    transitional_credential_state = 'existing_password_rotation_pending'
  ),
  transitional_database_credential_version integer not null check (
    transitional_database_credential_version = 0
  ),
  transitional_auth_credential_version integer not null check (
    transitional_auth_credential_version = 0
  ),
  transitional_session_count integer not null check (transitional_session_count = 0),
  transitional_unrevoked_refresh_token_count integer not null check (
    transitional_unrevoked_refresh_token_count = 0
  ),
  password_rotation_completed_claimed boolean not null check (
    password_rotation_completed_claimed = false
  ),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

comment on table public.patch83b_legacy_runtime_bridges is
  'Permanent identity-free provenance for the authorized Gate 13B database-migration bridge. It is not an Edge compatibility attestation or executive access-review signoff.';

create or replace function public.patch83b_reject_legacy_runtime_bridge_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  raise exception using errcode = 'P0001',
    message = 'PATCH83B_LEGACY_RUNTIME_BRIDGES_APPEND_ONLY';
end;
$function$;

revoke all on function public.patch83b_reject_legacy_runtime_bridge_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_patch83b_legacy_runtime_bridges_append_only
  on public.patch83b_legacy_runtime_bridges;
create trigger trg_patch83b_legacy_runtime_bridges_append_only
before update or delete on public.patch83b_legacy_runtime_bridges
for each row execute function public.patch83b_reject_legacy_runtime_bridge_mutation();

revoke all privileges on table public.patch83b_legacy_runtime_bridges
  from public, anon, authenticated, service_role;
grant select on table public.patch83b_legacy_runtime_bridges to service_role;
alter table public.patch83b_legacy_runtime_bridges enable row level security;
alter table public.patch83b_legacy_runtime_bridges force row level security;

create or replace function public.patch83b_guard_runtime_activation_provenance()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if old.activation_provenance = 'legacy_migration_bridge'
     and new.enforcement_state in ('disabled', 'prepared', 'emergency_suspended') then
    new.activation_provenance := 'edge_authenticated';
    new.legacy_bridge_id := null;
    new.legacy_bridge_applied_at := null;
  end if;

  if new.activation_provenance = 'legacy_migration_bridge' and (
    current_setting('patch83b.legacy_bridge_migration', true) <> '187'
    or old.enforcement_state <> 'disabled'
    or old.state_version <> 0
    or new.enforcement_state <> 'enforced'
    or new.state_version <> 5
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH83B_LEGACY_RUNTIME_PROVENANCE_TRANSITION_REFUSED';
  end if;
  return new;
end;
$function$;

revoke all on function public.patch83b_guard_runtime_activation_provenance()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_patch83b_runtime_activation_provenance
  on public.patch83u_runtime_control;
create trigger trg_patch83b_runtime_activation_provenance
before update on public.patch83u_runtime_control
for each row execute function public.patch83b_guard_runtime_activation_provenance();

do $patch187_activate_legacy$
declare
  v_admin_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_bridge_id constant text := 'gate13b:187:legacy-upgrade-bridge';
  v_existing public.patch83b_legacy_runtime_bridges%rowtype;
begin
  if current_setting('patch83b.migration_187_lineage', true) <> 'production_bridge_lineage' then
    return;
  end if;

  select p.id into strict v_admin_id
  from public.profiles p
  join public.user_credential_states cs on cs.user_id = p.id
  join auth.users au on au.id = p.id
  where public.patch83u_bootstrap_super_admin_eligible(p.id)
    and cs.credential_state = 'existing_password_rotation_pending'
    and cs.credential_version = 0
    and public.patch83u_auth_credential_version(au.raw_app_meta_data) = 0
    and not exists (select 1 from auth.sessions s where s.user_id = p.id)
    and not exists (
      select 1 from auth.refresh_tokens rt
      where rt.user_id = p.id::text and rt.revoked = false
    );

  perform pg_catalog.set_config('patch83b.legacy_bridge_migration', '187', true);

  update public.patch83u_runtime_control
  set enforcement_state = 'enforced',
      prepared_at = v_now,
      prepared_by = null,
      activated_at = v_now,
      activated_by = null,
      activation_reason = 'Gate 13B authorized legacy database-migration bridge',
      last_transition_reason = 'Controls represented by migrations 181-185 installed and validated by migration 187',
      compatible_edge_contract_version = expected_edge_contract_version,
      compatible_frontend_contract_version = expected_frontend_contract_version,
      compatibility_attested_at = null,
      compatibility_attested_by = null,
      preflight_hash = encode(extensions.digest(
        convert_to('gate13b-legacy-bridge-v1|source-ceiling-180|target-187', 'UTF8'),
        'sha256'
      ), 'hex'),
      designated_super_admin_id = v_admin_id,
      last_transition_request_id = v_bridge_id,
      state_version = 5,
      activation_provenance = 'legacy_migration_bridge',
      legacy_bridge_id = v_bridge_id,
      legacy_bridge_applied_at = v_now
  where singleton and enforcement_state = 'disabled' and state_version = 0;

  if not found then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_LEGACY_RUNTIME_ACTIVATION_PRESTATE_CHANGED';
  end if;

  select * into v_existing
  from public.patch83b_legacy_runtime_bridges b
  where b.bridge_id = v_bridge_id;
  if found then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_LEGACY_BRIDGE_ALREADY_RECORDED';
  end if;

  insert into public.patch83b_legacy_runtime_bridges (
    bridge_id, lineage, source_migration_ceiling, bridge_migration_version,
    source_release_commit, operator_classification, controls_installed,
    role_reconciliation_event_key, runtime_state_version,
    historical_edge_attestation_claimed, historical_access_review_claimed,
    auth_rows_changed, credential_or_session_rows_changed,
    mandatory_super_admin_password_rotation, transitional_credential_state,
    transitional_database_credential_version, transitional_auth_credential_version,
    transitional_session_count, transitional_unrevoked_refresh_token_count,
    password_rotation_completed_claimed, created_at
  ) values (
    v_bridge_id, 'production_bridge_lineage', 180, 187,
    '87074faa9476a6d158199426871167ae30cd5a55',
    'authorized_database_deployment_operator', '[181,182,183,184,185]'::jsonb,
    'gate13b:186:legacy-role-scope-reconciliation', 5,
    false, false, false, false,
    'required', 'existing_password_rotation_pending', 0, 0, 0, 0, false, v_now
  );

  insert into public.patch83b_release_migration_events (
    event_key, migration_version, lineage, event_type, status,
    affected_count, source_release_commit, details
  ) values (
    'gate13b:187:legacy-runtime-bridge', 187,
    'production_bridge_lineage', 'legacy_runtime_bridge', 'completed', 1,
    '87074faa9476a6d158199426871167ae30cd5a55',
    jsonb_build_object(
      'source_migration_ceiling', 180,
      'controls_installed', jsonb_build_array(181,182,183,184,185),
      'runtime_state_version', 5,
      'historical_edge_attestation_claimed', false,
      'historical_access_review_claimed', false,
      'mandatory_super_admin_password_rotation', 'required',
      'transitional_credential_state', 'existing_password_rotation_pending',
      'transitional_database_credential_version', 0,
      'transitional_auth_credential_version', 0,
      'transitional_session_count', 0,
      'transitional_unrevoked_refresh_token_count', 0,
      'password_rotation_completed_claimed', false,
      'identity_exposed', false
    )
  );
end;
$patch187_activate_legacy$;

create or replace function public.patch83b_release_lineage_attestation()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $function$
  with history as (
    select
      count(*) filter (where version in ('181','182','183','184','185')) as count_181_185,
      count(*) filter (where version = '186') as count_186,
      max(case when version ~ '^[0-9]+$' then version::integer end) as ceiling
    from supabase_migrations.schema_migrations
  ), runtime as (
    select schema_version, enforcement_state, state_version,
           activation_provenance, legacy_bridge_id is not null as legacy_bridge_bound,
           compatible_edge_contract_version = expected_edge_contract_version
             and compatible_frontend_contract_version = expected_frontend_contract_version
             as contracts_compatible
    from public.patch83u_runtime_control where singleton
  ), safe_counts as (
    select
      (select count(*) from public.user_roles ur join public.profiles p on p.id = ur.user_id
       where ur.is_active and (
         public.patch83u_role_scope_allowed(ur.role, ur.scope) is distinct from true
         or public.patch83u_role_assignment_valid(
           p.organization_id, ur.scope, ur.organization_id,
           ur.division_id, ur.department_id, ur.unit_id
         ) is distinct from true
       )) as invalid_active_roles,
      (select count(*) from public.profiles p
       where public.patch83u_runtime_super_admin_eligible(p.id, p.organization_id)) as eligible_super_admins,
      (select count(*) from public.user_credential_states cs
       where cs.pending_operation_id is not null) as pending_credential_operations,
      (select count(*) from public.user_credential_states cs
       where cs.credential_state in (
         'recovery_required','reconciliation_required','session_revocation_review_required'
       ) or cs.reconciliation_auth_changed) as recovery_or_reconciliation_states,
      (select count(*)
       from public.patch83u_runtime_control rc
       join public.profiles p on p.id = rc.designated_super_admin_id
       join public.user_credential_states cs on cs.user_id = p.id
       join auth.users au on au.id = p.id
       where rc.singleton
         and p.is_active and p.user_status = 'active'
         and cs.organization_id = p.organization_id
         and cs.identity_mode = 'legacy_verified'
         and cs.credential_state = 'existing_password_rotation_pending'
         and cs.requested_lifecycle = 'active'
         and cs.credential_version = 0
         and public.patch83u_auth_credential_version(au.raw_app_meta_data) = 0
         and cs.pending_operation_id is null
         and cs.pending_session_id is null
         and cs.pending_credential_version is null
         and cs.operation_source is null
         and cs.reconciliation_auth_changed = false
         and not exists (select 1 from auth.sessions s where s.user_id = p.id)
         and not exists (
           select 1 from auth.refresh_tokens rt
           where rt.user_id = p.id::text and rt.revoked = false
         )
      ) as transitional_rotation_required_admins,
      (select count(*)
       from public.patch83u_runtime_control rc
       join public.profiles p on p.id = rc.designated_super_admin_id
       join public.user_credential_states cs on cs.user_id = p.id
       join auth.users au on au.id = p.id
       where rc.singleton
         and public.patch83u_runtime_super_admin_eligible(p.id, p.organization_id)
         and cs.credential_state = 'active'
         and cs.credential_version >= 1
         and public.patch83u_auth_credential_version(au.raw_app_meta_data) = cs.credential_version
         and cs.password_changed_at is not null
         and cs.sessions_revoked_at is not null
         and cs.pending_operation_id is null
         and cs.reconciliation_auth_changed = false
      ) as completed_bridge_rotation_admins
  )
  select jsonb_build_object(
    'attestation_version', 'gate13br3-release-lineage-v2',
    'safe_metadata_only', true,
    'lineage', case
      when h.count_181_185 = 5 and h.count_186 = 1 then 'modern_legacy_lineage'
      when h.count_181_185 = 0 and h.count_186 = 1 then 'production_bridge_lineage'
      else 'unknown'
    end,
    'history', jsonb_build_object(
      'migrations_181_185_count', h.count_181_185,
      'migration_186_count', h.count_186,
      'ceiling_before_187_history_write', h.ceiling
    ),
    'runtime', to_jsonb(r),
    'safe_counts', to_jsonb(sc),
    'mandatory_super_admin_password_rotation', case
      when h.count_181_185 = 0 and h.count_186 = 1
        and sc.transitional_rotation_required_admins = 1 then 'required'
      when h.count_181_185 = 0 and h.count_186 = 1
        and sc.completed_bridge_rotation_admins = 1 then 'completed'
      else 'not_applicable'
    end,
    'patch83tu_attestation_pass',
      (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean,
    'overall_pass',
      r.enforcement_state = 'enforced'
      and r.state_version = 5
      and r.contracts_compatible
      and sc.invalid_active_roles = 0
      and sc.pending_credential_operations = 0
      and sc.recovery_or_reconciliation_states = 0
      and (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean
      and (
        (h.count_181_185 = 5 and h.count_186 = 1
          and r.activation_provenance = 'edge_authenticated'
          and not r.legacy_bridge_bound
          and sc.eligible_super_admins = 1
          and sc.transitional_rotation_required_admins = 0)
        or
        (h.count_181_185 = 0 and h.count_186 = 1
          and r.activation_provenance = 'legacy_migration_bridge'
          and r.legacy_bridge_bound
          and (
            (sc.eligible_super_admins = 0
              and sc.transitional_rotation_required_admins = 1
              and sc.completed_bridge_rotation_admins = 0)
            or
            (sc.eligible_super_admins = 1
              and sc.transitional_rotation_required_admins = 0
              and sc.completed_bridge_rotation_admins = 1)
          ))
      )
  )
  from history h cross join runtime r cross join safe_counts sc;
$function$;

revoke all on function public.patch83b_release_lineage_attestation()
  from public, anon, authenticated;
grant execute on function public.patch83b_release_lineage_attestation() to service_role;

comment on function public.patch83b_release_lineage_attestation() is
  'Service-role-only, schema-and-safe-count Gate 13B lineage attestation. Returns no identities, business rows, credentials, sessions, or tokens.';

do $patch187_postflight$
declare
  v_path text := current_setting('patch83b.migration_187_lineage', true);
  v_attestation jsonb;
  v_browser text;
  v_table text;
begin
  if to_regprocedure('public.patch83tu_catalog_contract_attestation()') is null
     or (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean is distinct from true then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_PATCH83TU_ATTESTATION_FAILED';
  end if;

  v_attestation := public.patch83b_release_lineage_attestation();
  if (v_attestation ->> 'overall_pass')::boolean is distinct from true
     or v_attestation ->> 'lineage' <> v_path then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_RELEASE_LINEAGE_ATTESTATION_FAILED';
  end if;

  foreach v_browser in array array['anon','authenticated'] loop
    if has_function_privilege(v_browser, 'public.patch83b_release_lineage_attestation()', 'EXECUTE') then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_BROWSER_ATTESTATION_EXECUTE_REMAINS', detail = v_browser;
    end if;
  end loop;
  if exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) a
    where p.oid = 'public.patch83b_release_lineage_attestation()'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_PUBLIC_ATTESTATION_EXECUTE_REMAINS';
  end if;

  foreach v_table in array array[
    'patch83b_release_migration_events', 'patch83b_legacy_runtime_bridges'
  ] loop
    if exists (
      select 1 from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = v_table
        and g.grantee in ('PUBLIC','anon','authenticated')
    ) or exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'public' and p.tablename = v_table
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_BRIDGE_EVIDENCE_BROWSER_EXPOSURE', detail = v_table;
    end if;
  end loop;

  if v_path = 'production_bridge_lineage' and (
    exists (select 1 from public.patch83u_runtime_events)
    or not exists (
      select 1 from public.patch83b_legacy_runtime_bridges b
      where b.bridge_id = 'gate13b:187:legacy-upgrade-bridge'
        and not b.historical_edge_attestation_claimed
        and not b.historical_access_review_claimed
        and b.mandatory_super_admin_password_rotation = 'required'
        and b.transitional_credential_state = 'existing_password_rotation_pending'
        and b.transitional_database_credential_version = 0
        and b.transitional_auth_credential_version = 0
        and b.transitional_session_count = 0
        and b.transitional_unrevoked_refresh_token_count = 0
        and not b.password_rotation_completed_claimed
    )
    or v_attestation ->> 'mandatory_super_admin_password_rotation' <> 'required'
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_TRUTHFUL_LEGACY_PROVENANCE_FAILED';
  end if;

  insert into public.patch83b_release_migration_events (
    event_key, migration_version, lineage, event_type, status,
    affected_count, source_release_commit, details
  ) values (
    'gate13b:187:' || replace(v_path, '_lineage', '') || ':catalog-attestation',
    187, v_path, 'post187_catalog_attestation', 'completed', 0,
    '87074faa9476a6d158199426871167ae30cd5a55',
    jsonb_build_object(
      'patch83tu_overall_pass', true,
      'release_lineage_overall_pass', true,
      'identity_exposed', false,
      'history_rows_fabricated', false
    )
  );
end;
$patch187_postflight$;

commit;
