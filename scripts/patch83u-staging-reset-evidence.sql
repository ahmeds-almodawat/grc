\set QUIET 1
\pset tuples_only on
\pset format unaligned
\set ON_ERROR_STOP on

begin read only;

select jsonb_build_object(
  'project_ref', :'expected_project_ref',
  'database_target_verified_by_harness', true,
  'transaction_read_only', current_setting('transaction_read_only') = 'on',
  'captured_at', clock_timestamp(),
  'runtime', (
    select jsonb_build_object(
      'enforcement_state', rc.enforcement_state,
      'state_version', rc.state_version,
      'edge_contract', rc.compatible_edge_contract_version,
      'frontend_contract', rc.compatible_frontend_contract_version,
      'designated_super_admin_id', rc.designated_super_admin_id,
      'updated_at', rc.updated_at
    )
    from public.patch83u_runtime_control rc
    where rc.singleton
  ),
  'applied_migrations', (
    select coalesce(jsonb_agg(version order by version), '[]'::jsonb)
    from (
      select version
      from supabase_migrations.schema_migrations
      where version in ('174', '176', '177')
    ) applied
  ),
  'finalizer', jsonb_build_object(
    'name', 'patch83u_finalize_password_change_after_revocation',
    'exists', to_regprocedure(
      'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)'
    ) is not null,
    'security_definer', coalesce((
      select p.prosecdef
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'patch83u_finalize_password_change_after_revocation'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'uuid, uuid, text, integer, text'
    ), false),
    'restricted_search_path', coalesce((
      select p.proconfig @> array['search_path=pg_catalog, public, pg_temp']::text[]
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'patch83u_finalize_password_change_after_revocation'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'uuid, uuid, text, integer, text'
    ), false),
    'service_role_execute_only', coalesce((
      select
        has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              p.proacl,
              pg_catalog.acldefault('f', p.proowner)
            )
          ) acl
          left join pg_catalog.pg_roles granted_role on granted_role.oid = acl.grantee
          where acl.privilege_type = 'EXECUTE'
            and (
              acl.grantee = 0
              or (
                acl.grantee <> p.proowner
                and granted_role.rolname <> 'service_role'
              )
            )
        )
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'patch83u_finalize_password_change_after_revocation'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'uuid, uuid, text, integer, text'
    ), false)
  ),
  'recovery', jsonb_build_object(
    'wrapper_exists', to_regprocedure(
      'public.patch83u_reconcile_credential_state(uuid,uuid,text,text)'
    ) is not null,
    'implementation_exists', to_regprocedure(
      'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)'
    ) is not null,
    'wrapper_security_definer', coalesce((
      select p.prosecdef
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'patch83u_reconcile_credential_state'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'uuid, uuid, text, text'
    ), false),
    'wrapper_restricted_search_path', coalesce((
      select p.proconfig @> array['search_path=pg_catalog, public, pg_temp']::text[]
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'patch83u_reconcile_credential_state'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'uuid, uuid, text, text'
    ), false),
    'wrapper_service_role_execute_only', coalesce((
      select
        has_function_privilege('service_role', p.oid, 'EXECUTE')
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              p.proacl,
              pg_catalog.acldefault('f', p.proowner)
            )
          ) acl
          left join pg_catalog.pg_roles granted_role on granted_role.oid = acl.grantee
          where acl.privilege_type = 'EXECUTE'
            and (
              acl.grantee = 0
              or (
                acl.grantee <> p.proowner
                and granted_role.rolname <> 'service_role'
              )
            )
        )
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'patch83u_reconcile_credential_state'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'uuid, uuid, text, text'
    ), false),
    'implementation_not_callable_by_service_role', coalesce((
      select not has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'patch83u_reconcile_last_super_admin_recovery'
        and pg_catalog.pg_get_function_identity_arguments(p.oid)
          = 'uuid, uuid, text, text'
    ), false)
  ),
  'target', (
    select jsonb_build_object(
      'user_id', p.id,
      'profile_state', p.user_status,
      'profile_active', p.is_active,
      'credential_state', cs.credential_state,
      'credential_version', cs.credential_version,
      'auth_credential_version',
        public.patch83u_auth_credential_version(au.raw_app_meta_data),
      'requested_lifecycle', cs.requested_lifecycle,
      'role', min(ur.role::text) filter (where ur.is_active),
      'scope', min(ur.scope::text) filter (where ur.is_active),
      'active_role_count', count(*) filter (where ur.is_active),
      'pending_operation', cs.pending_operation_id is not null,
      'pending_operation_count', (
        select count(*)::integer
        from public.patch83u_credential_operations op
        where op.target_user_id = p.id
          and op.operation_status in ('prepared', 'in_progress', 'auth_changed')
      ),
      'session_count', (
        select count(*)::integer from auth.sessions s where s.user_id = p.id
      ),
      'unrevoked_refresh_token_count', (
        select count(*)::integer
        from auth.refresh_tokens rt
        where rt.user_id = p.id::text and rt.revoked = false
      ),
      'updated_at', cs.updated_at
    )
    from public.profiles p
    join public.user_credential_states cs on cs.user_id = p.id
    join auth.users au on au.id = p.id
    left join public.user_roles ur on ur.user_id = p.id
    where p.id = :'target_user_id'::uuid
    group by p.id, p.user_status, p.is_active, cs.credential_state,
      cs.credential_version, cs.requested_lifecycle, cs.pending_operation_id,
      cs.updated_at, au.raw_app_meta_data
  ),
  'admin', (
    select jsonb_build_object(
      'user_id', p.id,
      'profile_state', p.user_status,
      'profile_active', p.is_active,
      'credential_state', cs.credential_state,
      'credential_version', cs.credential_version,
      'auth_credential_version',
        public.patch83u_auth_credential_version(au.raw_app_meta_data),
      'role', min(ur.role::text) filter (where ur.is_active),
      'scope', min(ur.scope::text) filter (where ur.is_active),
      'active_role_count', count(*) filter (where ur.is_active),
      'pending_operation', cs.pending_operation_id is not null,
      'pending_operation_count', (
        select count(*)::integer
        from public.patch83u_credential_operations op
        where op.target_user_id = p.id
          and op.operation_status in ('prepared', 'in_progress', 'auth_changed')
      ),
      'updated_at', cs.updated_at
    )
    from public.profiles p
    join public.user_credential_states cs on cs.user_id = p.id
    join auth.users au on au.id = p.id
    left join public.user_roles ur on ur.user_id = p.id
    where p.id = :'admin_user_id'::uuid
    group by p.id, p.user_status, p.is_active, cs.credential_state,
      cs.credential_version, cs.pending_operation_id, cs.updated_at,
      au.raw_app_meta_data
  ),
  'audit', jsonb_build_object(
    'credential_event_count', (
      select count(*)::integer
      from public.user_credential_events e
      where e.user_id = :'target_user_id'::uuid
    ),
    'latest_event_type', (
      select e.event_type
      from public.user_credential_events e
      where e.user_id = :'target_user_id'::uuid
      order by e.created_at desc, e.id desc
      limit 1
    ),
    'latest_event_code', (
      select e.event_code
      from public.user_credential_events e
      where e.user_id = :'target_user_id'::uuid
      order by e.created_at desc, e.id desc
      limit 1
    ),
    'latest_event_credential_version', (
      select e.credential_version
      from public.user_credential_events e
      where e.user_id = :'target_user_id'::uuid
      order by e.created_at desc, e.id desc
      limit 1
    ),
    'latest_event_at', (
      select e.created_at
      from public.user_credential_events e
      where e.user_id = :'target_user_id'::uuid
      order by e.created_at desc, e.id desc
      limit 1
    ),
    'operation_count', (
      select count(*)::integer
      from public.patch83u_credential_operations op
      where op.target_user_id = :'target_user_id'::uuid
    ),
    'latest_operation_type', (
      select op.operation_type
      from public.patch83u_credential_operations op
      where op.target_user_id = :'target_user_id'::uuid
      order by op.created_at desc, op.operation_id desc
      limit 1
    ),
    'latest_operation_status', (
      select op.operation_status
      from public.patch83u_credential_operations op
      where op.target_user_id = :'target_user_id'::uuid
      order by op.created_at desc, op.operation_id desc
      limit 1
    ),
    'latest_operation_current_version', (
      select op.current_credential_version
      from public.patch83u_credential_operations op
      where op.target_user_id = :'target_user_id'::uuid
      order by op.created_at desc, op.operation_id desc
      limit 1
    ),
    'latest_operation_next_version', (
      select op.next_credential_version
      from public.patch83u_credential_operations op
      where op.target_user_id = :'target_user_id'::uuid
      order by op.created_at desc, op.operation_id desc
      limit 1
    ),
    'latest_operation_resulting_state', (
      select op.resulting_credential_state
      from public.patch83u_credential_operations op
      where op.target_user_id = :'target_user_id'::uuid
      order by op.created_at desc, op.operation_id desc
      limit 1
    ),
    'latest_operation_auth_changed', (
      select op.auth_changed
      from public.patch83u_credential_operations op
      where op.target_user_id = :'target_user_id'::uuid
      order by op.created_at desc, op.operation_id desc
      limit 1
    ),
    'latest_operation_revocation_confirmed', (
      select op.session_revocation_confirmed
      from public.patch83u_credential_operations op
      where op.target_user_id = :'target_user_id'::uuid
      order by op.created_at desc, op.operation_id desc
      limit 1
    ),
    'latest_operation_completed_at', (
      select op.completed_at
      from public.patch83u_credential_operations op
      where op.target_user_id = :'target_user_id'::uuid
      order by op.created_at desc, op.operation_id desc
      limit 1
    )
  ),
  'eligible_super_admin_count', (
    select count(distinct ur.user_id)::integer
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    join public.user_credential_states cs on cs.user_id = p.id
    where ur.is_active
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and p.is_active
      and p.user_status = 'active'
      and cs.credential_state = 'active'
      and public.patch83u_effective_super_admin_eligible(
        ur.user_id,
        p.organization_id
      )
  )
);

rollback;
