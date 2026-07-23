-- Production Gate 5 / Gate 7 remediation / migration 181
-- Service-role-only, schema-only attestation for Patch 83T/U/V release preflight.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $migration$
declare
  v_object text;
  v_function pg_catalog.regprocedure;
  v_relation record;
  v_wrapper_definition text;
begin
  for v_relation in
    select * from (values
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
    ) as required_relations(relation_name, force_required)
  loop
    if to_regclass('public.' || v_relation.relation_name) is null then
      raise exception using errcode = 'P0001',
        message = 'PATCH181_REQUIRED_RELATION_MISSING', detail = v_relation.relation_name;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_relation.relation_name
        and c.relkind in ('r', 'p')
        and c.relrowsecurity
        and c.relforcerowsecurity = v_relation.force_required
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH181_REQUIRED_RLS_CONTRACT_MISSING', detail = v_relation.relation_name;
    end if;
  end loop;

  foreach v_object in array array[
    'public.patch83u_get_capabilities(uuid,text,text)',
    'public.patch83u_get_credential_state(uuid,integer,text,text)',
    'public.patch83t_get_user_import_capabilities(uuid,text,text)',
    'public.patch83t_user_import_identity_references(uuid,text[])',
    'public.patch83u_list_provisioning(uuid)',
    'public.patch83u_claim_provisioning(uuid,uuid,text,text)',
    'public.patch83u_finalize_provisioning(uuid,uuid,uuid,uuid,text)',
    'public.patch83u_fail_provisioning(uuid,uuid,uuid,text,text,boolean)',
    'public.patch83u_reconcile_provisioning(uuid,uuid,text,text)',
    'public.patch83u_prepare_required_password_change(uuid,text,integer,text)',
    'public.patch83u_begin_required_password_change(uuid,text,integer,text)',
    'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)',
    'public.patch83u_finalize_required_password_change(uuid,uuid,text,integer,text,boolean)',
    'public.patch83u_abort_required_password_change(uuid,uuid,text,boolean,boolean,text,text)',
    'public.patch83u_begin_admin_reset(uuid,uuid,text,text,text,text)',
    'public.patch83u_admin_reset_session_revocation_proof(uuid,uuid,uuid,text,integer,text)',
    'public.patch83u_finalize_admin_reset(uuid,uuid,uuid,text,integer,text,boolean)',
    'public.patch83u_abort_admin_reset(uuid,uuid,uuid,text,boolean,boolean,text,text)',
    'public.patch83u_reconcile_credential_state(uuid,uuid,text,text)',
    'public.patch83u_assign_user_role(uuid,uuid,public.app_role,public.access_scope,uuid,uuid,uuid,text)',
    'public.patch83u_deactivate_user_role(uuid,uuid,text)',
    'public.patch83t_apply_user_excel_import(uuid,jsonb)',
    'public.patch83t_update_user_profile(uuid,uuid,jsonb)',
    'public.patch83u_apply_user_lifecycle(uuid,uuid,text,text)',
    'public.patch83v_runtime_action_authorized(text,text)'
  ] loop
    v_function := to_regprocedure(v_object);
    if v_function is null then
      raise exception using errcode = 'P0001',
        message = 'PATCH181_REQUIRED_FUNCTION_MISSING', detail = v_object;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_proc p
      where p.oid = v_function
        and p.prosecdef
        and (
          coalesce(p.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public, pg_temp']
          or coalesce(p.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, extensions, public, pg_temp']
        )
        and has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not has_function_privilege('anon', p.oid, 'EXECUTE')
        and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and not exists (
          select 1
          from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE'
        )
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH181_REQUIRED_FUNCTION_SECURITY_MISMATCH', detail = v_object;
    end if;
  end loop;

  -- Migration 176 is the canonical last-Super-Admin recovery contract. Its
  -- implementation is deliberately owner-only; service_role can reach it only
  -- through the audited reconciliation wrapper. Do not replace this check with
  -- a fixture-only count helper or make the implementation directly callable.
  v_function := to_regprocedure(
    'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)'
  );
  if v_function is null then
    raise exception using errcode = 'P0001',
      message = 'PATCH181_LAST_SUPER_ADMIN_RECOVERY_MISSING';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = v_function
      and p.prosecdef
      and coalesce(p.proconfig, '{}'::text[])
        @> array['search_path=pg_catalog, public, pg_temp']
      and not has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
        ) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      )
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH181_LAST_SUPER_ADMIN_RECOVERY_SECURITY_MISMATCH';
  end if;

  select pg_catalog.pg_get_functiondef(
    to_regprocedure('public.patch83u_reconcile_credential_state(uuid,uuid,text,text)')
  ) into v_wrapper_definition;
  if position(
    'public.patch83u_reconcile_last_super_admin_recovery' in
    coalesce(v_wrapper_definition, '')
  ) = 0 then
    raise exception using errcode = 'P0001',
      message = 'PATCH181_LAST_SUPER_ADMIN_RECOVERY_WRAPPER_MISMATCH';
  end if;

  if to_regprocedure('public.patch83u_finalize_required_password_change_after_session_revoca(uuid,uuid,text,integer,text)') is not null
     or to_regprocedure('public.patch83u_finalize_required_password_change_after_session_revocation(uuid,uuid,text,integer,text)') is not null then
    raise exception using errcode = 'P0001',
      message = 'PATCH181_LEGACY_FINALIZER_STILL_CALLABLE';
  end if;

  if not exists (
    select 1 from public.patch83u_runtime_control rc
    where rc.singleton and rc.enforcement_state = 'enforced' and rc.state_version >= 5
      and rc.compatible_edge_contract_version = rc.expected_edge_contract_version
      and rc.compatible_frontend_contract_version = rc.expected_frontend_contract_version
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH181_RUNTIME_CONTRACT_NOT_ENFORCED';
  end if;
end;
$migration$;

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

revoke all on function public.patch83tu_catalog_contract_attestation() from public, anon, authenticated;
grant execute on function public.patch83tu_catalog_contract_attestation() to service_role;

comment on function public.patch83tu_catalog_contract_attestation() is
  'Patch 181 service-role-only schema attestation v3. Binds all 24 Edge-invoked Patch 83T/U RPCs, the owner-only last-Super-Admin recovery implementation, and the exact RLS contract; returns safe metadata and hashes only.';

commit;
