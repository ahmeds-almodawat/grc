-- Patch 83U staging SQL Editor checkpoint pack.
-- Run exactly one named block at the corresponding operator checkpoint.
-- Save only the single patch83u_evidence JSON cell as compact or multiline
-- UTF-8 JSON in the fixed Run 006 checkpoint filename listed below.
-- Do not use the clipboard or paste checkpoint JSON into a terminal prompt.
-- Required selection order (do not execute the whole file):
-- before_employee_sessions -> immediately_before_reset ->
-- immediately_after_reset -> before_required_password_change ->
-- immediately_after_password_change_finalization -> after_fresh_employee_login.
-- The harness rejects a wrong, stale, or out-of-order checkpoint label.
-- The harness waits only for the next fixed filename and never writes these files.
-- Create or replace the expected file only after the current harness starts;
-- files predating that invocation are not accepted.

-- CHECKPOINT 1: before employee sessions
-- FILE: 01-before-employee-sessions.json
BEGIN READ ONLY;

WITH
runtime_snapshot AS (
  SELECT
    rc.schema_version,
    rc.enforcement_state,
    rc.state_version,
    rc.compatible_edge_contract_version AS edge_contract,
    rc.compatible_frontend_contract_version AS frontend_contract,
    rc.designated_super_admin_id,
    pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NOT NULL
      AS request_hash_function_available
  FROM public.patch83u_runtime_control rc
  WHERE rc.singleton
),
target_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    p.organization_id = (
      SELECT admin_profile.organization_id
      FROM public.profiles admin_profile
      WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
    ) AS same_organization_as_designated_admin,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    cs.requested_lifecycle,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    (SELECT count(*)::integer FROM auth.sessions s WHERE s.user_id = p.id)
      AS session_count,
    (SELECT count(*)::integer FROM auth.refresh_tokens rt
      WHERE rt.user_id = p.id::text AND rt.revoked = false)
      AS unrevoked_refresh_token_count,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
),
admin_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
),
finalizer AS (
  SELECT p.oid, p.prokind, p.prosecdef, p.proconfig, p.proacl, p.proowner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)'
  )
),
recovery_wrapper AS (
  SELECT p.oid, p.prosecdef, p.proconfig, p.proacl, p.proowner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.patch83u_reconcile_credential_state(uuid,uuid,text,text)'
  )
),
recovery_implementation AS (
  SELECT p.oid, p.prosecdef, p.proconfig, p.proacl, p.proowner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)'
  )
),
standard_recovery_implementation AS (
  SELECT p.oid, p.proacl, p.proowner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.patch83u_reconcile_credential_state_standard_impl(uuid,uuid,text,text)'
  )
)
SELECT jsonb_build_object(
  'checkpoint', 'before_employee_sessions',
  'expected_project_ref', 'zghsgzrdwbqdrpuxanac',
  'operator_project_confirmation_required', true,
  'transaction_read_only', current_setting('transaction_read_only') = 'on',
  'captured_at', clock_timestamp(),
  'runtime', (SELECT to_jsonb(runtime_snapshot) FROM runtime_snapshot),
  'applied_migrations', (
    SELECT coalesce(jsonb_agg(version ORDER BY version), '[]'::jsonb)
    FROM supabase_migrations.schema_migrations
    WHERE version IN ('174', '176', '177')
  ),
  'finalizer', jsonb_build_object(
    'name', 'patch83u_finalize_password_change_after_revocation',
    'name_bytes', octet_length('patch83u_finalize_password_change_after_revocation'),
    'exists', EXISTS (SELECT 1 FROM finalizer),
    'routine_kind_function',
      coalesce((SELECT prokind = 'f' FROM finalizer), false),
    'destination_name_unique', (
      SELECT count(*) = 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'patch83u_finalize_password_change_after_revocation'
    ),
    'old_or_truncated_name_absent', NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'patch83u_finalize_required_password_change_after_session_revoca',
          'patch83u_finalize_required_password_change_after_session_revocation'
        )
    ),
    'security_definer', coalesce((SELECT prosecdef FROM finalizer), false),
    'restricted_search_path', coalesce((
      SELECT proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      FROM finalizer
    ), false),
    'service_role_execute_only', coalesce((
      SELECT
        has_function_privilege('service_role', oid, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
        AND NOT has_function_privilege('anon', oid, 'EXECUTE')
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.aclexplode(
            coalesce(proacl, pg_catalog.acldefault('f', proowner))
          ) acl
          WHERE acl.privilege_type = 'EXECUTE'
            AND (
              acl.grantee NOT IN (
                proowner,
                pg_catalog.to_regrole('service_role')::oid
              )
              OR (
                acl.grantee = pg_catalog.to_regrole('service_role')::oid
                AND acl.is_grantable
              )
            )
        )
      FROM finalizer
    ), false)
  ),
  'recovery', jsonb_build_object(
    'wrapper_exists', EXISTS (SELECT 1 FROM recovery_wrapper),
    'implementation_exists', EXISTS (SELECT 1 FROM recovery_implementation),
    'standard_implementation_exists',
      EXISTS (SELECT 1 FROM standard_recovery_implementation),
    'wrapper_security_definer',
      coalesce((SELECT prosecdef FROM recovery_wrapper), false),
    'wrapper_restricted_search_path', coalesce((
      SELECT proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      FROM recovery_wrapper
    ), false),
    'wrapper_service_role_execute_only', coalesce((
      SELECT
        has_function_privilege('service_role', oid, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
        AND NOT has_function_privilege('anon', oid, 'EXECUTE')
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.aclexplode(
            coalesce(proacl, pg_catalog.acldefault('f', proowner))
          ) acl
          WHERE acl.privilege_type = 'EXECUTE'
            AND (
              acl.grantee NOT IN (
                proowner,
                pg_catalog.to_regrole('service_role')::oid
              )
              OR (
                acl.grantee = pg_catalog.to_regrole('service_role')::oid
                AND acl.is_grantable
              )
            )
        )
      FROM recovery_wrapper
    ), false),
    'implementation_not_callable_by_service_role', coalesce((
      SELECT NOT has_function_privilege('service_role', oid, 'EXECUTE')
      FROM recovery_implementation
    ), false),
    'standard_implementation_owner_only', coalesce((
      SELECT
        NOT has_function_privilege('service_role', oid, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
        AND NOT has_function_privilege('anon', oid, 'EXECUTE')
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.aclexplode(
            coalesce(proacl, pg_catalog.acldefault('f', proowner))
          ) acl
          WHERE acl.privilege_type = 'EXECUTE'
            AND acl.grantee <> proowner
        )
      FROM standard_recovery_implementation
    ), false)
  ),
  'target', (SELECT to_jsonb(target_snapshot) FROM target_snapshot),
  'admin', (SELECT to_jsonb(admin_snapshot) FROM admin_snapshot),
  'audit', '{}'::jsonb,
  'eligible_super_admin_count', (
    SELECT count(DISTINCT ur.user_id)::integer
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.user_credential_states cs ON cs.user_id = p.id
    WHERE ur.is_active
      AND ur.role = 'super_admin'
      AND ur.scope = 'global'
      AND p.is_active
      AND p.user_status = 'active'
      AND cs.credential_state = 'active'
      AND p.organization_id = (
        SELECT admin_profile.organization_id
        FROM public.profiles admin_profile
        WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
      )
      AND public.patch83u_effective_super_admin_eligible(
        ur.user_id,
        p.organization_id
      )
  )
) AS patch83u_evidence;

ROLLBACK;

-- CHECKPOINT 3: immediately after reset
-- FILE: 03-immediately-after-reset.json
BEGIN READ ONLY;

WITH
runtime_snapshot AS (
  SELECT
    rc.schema_version,
    rc.enforcement_state,
    rc.state_version,
    rc.compatible_edge_contract_version AS edge_contract,
    rc.compatible_frontend_contract_version AS frontend_contract,
    rc.designated_super_admin_id,
    pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NOT NULL
      AS request_hash_function_available
  FROM public.patch83u_runtime_control rc
  WHERE rc.singleton
),
target_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    p.organization_id = (
      SELECT admin_profile.organization_id
      FROM public.profiles admin_profile
      WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
    ) AS same_organization_as_designated_admin,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    cs.requested_lifecycle,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    (SELECT count(*)::integer FROM auth.sessions s WHERE s.user_id = p.id)
      AS session_count,
    (SELECT count(*)::integer FROM auth.refresh_tokens rt
      WHERE rt.user_id = p.id::text AND rt.revoked = false)
      AS unrevoked_refresh_token_count,
    cs.reconciliation_auth_changed,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
),
admin_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
),
latest_event AS (
  SELECT
    e.event_type,
    e.event_code,
    e.credential_version,
    encode(
      extensions.digest(
        pg_catalog.convert_to(e.request_id, 'UTF8'),
        'sha256'
      ),
      'hex'
    ) AS request_id_hash,
    e.created_at
  FROM public.user_credential_events e
  WHERE e.user_id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 1
),
latest_operation AS (
  SELECT
    op.operation_type,
    op.operation_status,
    op.current_credential_version,
    op.next_credential_version,
    op.resulting_credential_state,
    op.auth_changed,
    op.session_revocation_confirmed,
    encode(
      extensions.digest(
        pg_catalog.convert_to(op.request_id, 'UTF8'),
        'sha256'
      ),
      'hex'
    ) AS request_id_hash,
    op.completed_at
  FROM public.patch83u_credential_operations op
  WHERE op.target_user_id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
  ORDER BY op.created_at DESC, op.operation_id DESC
  LIMIT 1
)
SELECT jsonb_build_object(
  'checkpoint', 'immediately_after_reset',
  'expected_project_ref', 'zghsgzrdwbqdrpuxanac',
  'operator_project_confirmation_required', true,
  'transaction_read_only', current_setting('transaction_read_only') = 'on',
  'captured_at', clock_timestamp(),
  'runtime', (SELECT to_jsonb(runtime_snapshot) FROM runtime_snapshot),
  'target', (SELECT to_jsonb(target_snapshot) FROM target_snapshot),
  'admin', (SELECT to_jsonb(admin_snapshot) FROM admin_snapshot),
  'audit', jsonb_build_object(
    'credential_event_count', (
      SELECT count(*)::integer FROM public.user_credential_events e
      WHERE e.user_id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
    ),
    'latest_event_type', (SELECT event_type FROM latest_event),
    'latest_event_code', (SELECT event_code FROM latest_event),
    'latest_event_credential_version', (SELECT credential_version FROM latest_event),
    'latest_event_request_id_hash', (SELECT request_id_hash FROM latest_event),
    'latest_event_at', (SELECT created_at FROM latest_event),
    'operation_count', (
      SELECT count(*)::integer FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
    ),
    'latest_operation_type', (SELECT operation_type FROM latest_operation),
    'latest_operation_status', (SELECT operation_status FROM latest_operation),
    'latest_operation_current_version',
      (SELECT current_credential_version FROM latest_operation),
    'latest_operation_next_version',
      (SELECT next_credential_version FROM latest_operation),
    'latest_operation_resulting_state',
      (SELECT resulting_credential_state FROM latest_operation),
    'latest_operation_auth_changed', (SELECT auth_changed FROM latest_operation),
    'latest_operation_revocation_confirmed',
      (SELECT session_revocation_confirmed FROM latest_operation),
    'latest_operation_request_id_hash',
      (SELECT request_id_hash FROM latest_operation),
    'latest_operation_completed_at', (SELECT completed_at FROM latest_operation)
  ),
  'eligible_super_admin_count', (
    SELECT count(DISTINCT ur.user_id)::integer
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.user_credential_states cs ON cs.user_id = p.id
    WHERE ur.is_active
      AND ur.role = 'super_admin'
      AND ur.scope = 'global'
      AND p.is_active
      AND p.user_status = 'active'
      AND cs.credential_state = 'active'
      AND p.organization_id = (
        SELECT admin_profile.organization_id
        FROM public.profiles admin_profile
        WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
      )
      AND public.patch83u_effective_super_admin_eligible(
        ur.user_id,
        p.organization_id
      )
  )
) AS patch83u_evidence;

ROLLBACK;

-- CHECKPOINT 4: before required password change
-- FILE: 04-before-required-password-change.json
BEGIN READ ONLY;

WITH
runtime_snapshot AS (
  SELECT
    rc.schema_version,
    rc.enforcement_state,
    rc.state_version,
    rc.compatible_edge_contract_version AS edge_contract,
    rc.compatible_frontend_contract_version AS frontend_contract,
    rc.designated_super_admin_id,
    pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NOT NULL
      AS request_hash_function_available
  FROM public.patch83u_runtime_control rc
  WHERE rc.singleton
),
target_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    p.organization_id = (
      SELECT admin_profile.organization_id
      FROM public.profiles admin_profile
      WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
    ) AS same_organization_as_designated_admin,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    cs.requested_lifecycle,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    (SELECT count(*)::integer FROM auth.sessions s WHERE s.user_id = p.id)
      AS session_count,
    (SELECT count(*)::integer FROM auth.refresh_tokens rt
      WHERE rt.user_id = p.id::text AND rt.revoked = false)
      AS unrevoked_refresh_token_count,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
),
admin_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
)
SELECT jsonb_build_object(
  'checkpoint', 'before_required_password_change',
  'expected_project_ref', 'zghsgzrdwbqdrpuxanac',
  'operator_project_confirmation_required', true,
  'transaction_read_only', current_setting('transaction_read_only') = 'on',
  'captured_at', clock_timestamp(),
  'runtime', (SELECT to_jsonb(runtime_snapshot) FROM runtime_snapshot),
  'target', (SELECT to_jsonb(target_snapshot) FROM target_snapshot),
  'admin', (SELECT to_jsonb(admin_snapshot) FROM admin_snapshot),
  'audit', '{}'::jsonb,
  'eligible_super_admin_count', (
    SELECT count(DISTINCT ur.user_id)::integer
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.user_credential_states cs ON cs.user_id = p.id
    WHERE ur.is_active
      AND ur.role = 'super_admin'
      AND ur.scope = 'global'
      AND p.is_active
      AND p.user_status = 'active'
      AND cs.credential_state = 'active'
      AND p.organization_id = (
        SELECT admin_profile.organization_id
        FROM public.profiles admin_profile
        WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
      )
      AND public.patch83u_effective_super_admin_eligible(
        ur.user_id,
        p.organization_id
      )
  )
) AS patch83u_evidence;

ROLLBACK;

-- CHECKPOINT 5: immediately after password-change finalization
-- FILE: 05-immediately-after-password-change-finalization.json
BEGIN READ ONLY;

WITH
runtime_snapshot AS (
  SELECT
    rc.schema_version,
    rc.enforcement_state,
    rc.state_version,
    rc.compatible_edge_contract_version AS edge_contract,
    rc.compatible_frontend_contract_version AS frontend_contract,
    rc.designated_super_admin_id,
    pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NOT NULL
      AS request_hash_function_available
  FROM public.patch83u_runtime_control rc
  WHERE rc.singleton
),
target_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    p.organization_id = (
      SELECT admin_profile.organization_id
      FROM public.profiles admin_profile
      WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
    ) AS same_organization_as_designated_admin,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    cs.requested_lifecycle,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    (SELECT count(*)::integer FROM auth.sessions s WHERE s.user_id = p.id)
      AS session_count,
    (SELECT count(*)::integer FROM auth.refresh_tokens rt
      WHERE rt.user_id = p.id::text AND rt.revoked = false)
      AS unrevoked_refresh_token_count,
    cs.password_changed_at IS NOT NULL AS password_changed_at_set,
    cs.sessions_revoked_at IS NOT NULL AS sessions_revoked_at_set,
    cs.reconciliation_auth_changed,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
),
admin_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
),
latest_event AS (
  SELECT
    e.event_type,
    e.event_code,
    e.credential_version,
    encode(
      extensions.digest(
        pg_catalog.convert_to(e.request_id, 'UTF8'),
        'sha256'
      ),
      'hex'
    ) AS request_id_hash,
    e.created_at
  FROM public.user_credential_events e
  WHERE e.user_id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 1
),
latest_operation AS (
  SELECT
    op.operation_type,
    op.operation_status,
    op.current_credential_version,
    op.next_credential_version,
    op.resulting_credential_state,
    op.auth_changed,
    op.session_revocation_confirmed,
    encode(
      extensions.digest(
        pg_catalog.convert_to(op.request_id, 'UTF8'),
        'sha256'
      ),
      'hex'
    ) AS request_id_hash,
    op.completed_at
  FROM public.patch83u_credential_operations op
  WHERE op.target_user_id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
  ORDER BY op.created_at DESC, op.operation_id DESC
  LIMIT 1
)
SELECT jsonb_build_object(
  'checkpoint', 'immediately_after_password_change_finalization',
  'expected_project_ref', 'zghsgzrdwbqdrpuxanac',
  'operator_project_confirmation_required', true,
  'transaction_read_only', current_setting('transaction_read_only') = 'on',
  'captured_at', clock_timestamp(),
  'runtime', (SELECT to_jsonb(runtime_snapshot) FROM runtime_snapshot),
  'target', (SELECT to_jsonb(target_snapshot) FROM target_snapshot),
  'admin', (SELECT to_jsonb(admin_snapshot) FROM admin_snapshot),
  'audit', jsonb_build_object(
    'credential_event_count', (
      SELECT count(*)::integer FROM public.user_credential_events e
      WHERE e.user_id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
    ),
    'latest_event_type', (SELECT event_type FROM latest_event),
    'latest_event_code', (SELECT event_code FROM latest_event),
    'latest_event_credential_version', (SELECT credential_version FROM latest_event),
    'latest_event_request_id_hash', (SELECT request_id_hash FROM latest_event),
    'latest_event_at', (SELECT created_at FROM latest_event),
    'operation_count', (
      SELECT count(*)::integer FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
    ),
    'latest_operation_type', (SELECT operation_type FROM latest_operation),
    'latest_operation_status', (SELECT operation_status FROM latest_operation),
    'latest_operation_current_version',
      (SELECT current_credential_version FROM latest_operation),
    'latest_operation_next_version',
      (SELECT next_credential_version FROM latest_operation),
    'latest_operation_resulting_state',
      (SELECT resulting_credential_state FROM latest_operation),
    'latest_operation_auth_changed', (SELECT auth_changed FROM latest_operation),
    'latest_operation_revocation_confirmed',
      (SELECT session_revocation_confirmed FROM latest_operation),
    'latest_operation_request_id_hash',
      (SELECT request_id_hash FROM latest_operation),
    'latest_operation_completed_at', (SELECT completed_at FROM latest_operation)
  ),
  'eligible_super_admin_count', (
    SELECT count(DISTINCT ur.user_id)::integer
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.user_credential_states cs ON cs.user_id = p.id
    WHERE ur.is_active
      AND ur.role = 'super_admin'
      AND ur.scope = 'global'
      AND p.is_active
      AND p.user_status = 'active'
      AND cs.credential_state = 'active'
      AND p.organization_id = (
        SELECT admin_profile.organization_id
        FROM public.profiles admin_profile
        WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
      )
      AND public.patch83u_effective_super_admin_eligible(
        ur.user_id,
        p.organization_id
      )
  )
) AS patch83u_evidence;

ROLLBACK;

-- CHECKPOINT 6: after fresh employee login
-- FILE: 06-after-fresh-employee-login.json
BEGIN READ ONLY;

WITH
runtime_snapshot AS (
  SELECT
    rc.schema_version,
    rc.enforcement_state,
    rc.state_version,
    rc.compatible_edge_contract_version AS edge_contract,
    rc.compatible_frontend_contract_version AS frontend_contract,
    rc.designated_super_admin_id,
    pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NOT NULL
      AS request_hash_function_available
  FROM public.patch83u_runtime_control rc
  WHERE rc.singleton
),
target_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    p.organization_id = (
      SELECT admin_profile.organization_id
      FROM public.profiles admin_profile
      WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
    ) AS same_organization_as_designated_admin,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    cs.requested_lifecycle,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    (SELECT count(*)::integer FROM auth.sessions s WHERE s.user_id = p.id)
      AS session_count,
    (SELECT count(*)::integer FROM auth.refresh_tokens rt
      WHERE rt.user_id = p.id::text AND rt.revoked = false)
      AS unrevoked_refresh_token_count,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
),
admin_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
)
SELECT jsonb_build_object(
  'checkpoint', 'after_fresh_employee_login',
  'expected_project_ref', 'zghsgzrdwbqdrpuxanac',
  'operator_project_confirmation_required', true,
  'transaction_read_only', current_setting('transaction_read_only') = 'on',
  'captured_at', clock_timestamp(),
  'runtime', (SELECT to_jsonb(runtime_snapshot) FROM runtime_snapshot),
  'target', (SELECT to_jsonb(target_snapshot) FROM target_snapshot),
  'admin', (SELECT to_jsonb(admin_snapshot) FROM admin_snapshot),
  'audit', '{}'::jsonb,
  'eligible_super_admin_count', (
    SELECT count(DISTINCT ur.user_id)::integer
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.user_credential_states cs ON cs.user_id = p.id
    WHERE ur.is_active
      AND ur.role = 'super_admin'
      AND ur.scope = 'global'
      AND p.is_active
      AND p.user_status = 'active'
      AND cs.credential_state = 'active'
      AND p.organization_id = (
        SELECT admin_profile.organization_id
        FROM public.profiles admin_profile
        WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
      )
      AND public.patch83u_effective_super_admin_eligible(
        ur.user_id,
        p.organization_id
      )
  )
) AS patch83u_evidence;

ROLLBACK;

-- CHECKPOINT 2: immediately before reset
-- FILE: 02-immediately-before-reset.json
BEGIN READ ONLY;

WITH
runtime_snapshot AS (
  SELECT
    rc.schema_version,
    rc.enforcement_state,
    rc.state_version,
    rc.compatible_edge_contract_version AS edge_contract,
    rc.compatible_frontend_contract_version AS frontend_contract,
    rc.designated_super_admin_id,
    pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NOT NULL
      AS request_hash_function_available
  FROM public.patch83u_runtime_control rc
  WHERE rc.singleton
),
target_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    p.organization_id = (
      SELECT admin_profile.organization_id
      FROM public.profiles admin_profile
      WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
    ) AS same_organization_as_designated_admin,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    cs.requested_lifecycle,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    (SELECT count(*)::integer FROM auth.sessions s WHERE s.user_id = p.id)
      AS session_count,
    (SELECT count(*)::integer FROM auth.refresh_tokens rt
      WHERE rt.user_id = p.id::text AND rt.revoked = false)
      AS unrevoked_refresh_token_count,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '2a276bdb-cf51-4303-846e-6b7fecf38b0c'::uuid
),
admin_snapshot AS (
  SELECT
    p.id AS user_id,
    p.user_status AS profile_state,
    p.is_active AS profile_active,
    cs.credential_state,
    cs.credential_version,
    public.patch83u_auth_credential_version(au.raw_app_meta_data)
      AS auth_credential_version,
    (SELECT min(ur.role::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS role,
    (SELECT min(ur.scope::text) FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS scope,
    (SELECT count(*)::integer FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.is_active) AS active_role_count,
    cs.pending_operation_id IS NOT NULL AS pending_operation,
    (SELECT count(*)::integer
      FROM public.patch83u_credential_operations op
      WHERE op.target_user_id = p.id
        AND op.operation_status IN ('prepared', 'in_progress', 'auth_changed'))
      AS pending_operation_count,
    cs.updated_at
  FROM public.profiles p
  JOIN public.user_credential_states cs ON cs.user_id = p.id
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
),
finalizer AS (
  SELECT p.oid, p.prokind, p.prosecdef, p.proconfig, p.proacl, p.proowner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)'
  )
),
recovery_wrapper AS (
  SELECT p.oid, p.prosecdef, p.proconfig, p.proacl, p.proowner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.patch83u_reconcile_credential_state(uuid,uuid,text,text)'
  )
),
recovery_implementation AS (
  SELECT p.oid, p.prosecdef, p.proconfig, p.proacl, p.proowner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.patch83u_reconcile_last_super_admin_recovery(uuid,uuid,text,text)'
  )
),
standard_recovery_implementation AS (
  SELECT p.oid, p.proacl, p.proowner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.patch83u_reconcile_credential_state_standard_impl(uuid,uuid,text,text)'
  )
)
SELECT jsonb_build_object(
  'checkpoint', 'immediately_before_reset',
  'expected_project_ref', 'zghsgzrdwbqdrpuxanac',
  'operator_project_confirmation_required', true,
  'transaction_read_only', current_setting('transaction_read_only') = 'on',
  'captured_at', clock_timestamp(),
  'runtime', (SELECT to_jsonb(runtime_snapshot) FROM runtime_snapshot),
  'applied_migrations', (
    SELECT coalesce(jsonb_agg(version ORDER BY version), '[]'::jsonb)
    FROM supabase_migrations.schema_migrations
    WHERE version IN ('174', '176', '177')
  ),
  'finalizer', jsonb_build_object(
    'name', 'patch83u_finalize_password_change_after_revocation',
    'name_bytes', octet_length('patch83u_finalize_password_change_after_revocation'),
    'exists', EXISTS (SELECT 1 FROM finalizer),
    'routine_kind_function',
      coalesce((SELECT prokind = 'f' FROM finalizer), false),
    'destination_name_unique', (
      SELECT count(*) = 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'patch83u_finalize_password_change_after_revocation'
    ),
    'old_or_truncated_name_absent', NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'patch83u_finalize_required_password_change_after_session_revoca',
          'patch83u_finalize_required_password_change_after_session_revocation'
        )
    ),
    'security_definer', coalesce((SELECT prosecdef FROM finalizer), false),
    'restricted_search_path', coalesce((
      SELECT proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      FROM finalizer
    ), false),
    'service_role_execute_only', coalesce((
      SELECT
        has_function_privilege('service_role', oid, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
        AND NOT has_function_privilege('anon', oid, 'EXECUTE')
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.aclexplode(
            coalesce(proacl, pg_catalog.acldefault('f', proowner))
          ) acl
          WHERE acl.privilege_type = 'EXECUTE'
            AND (
              acl.grantee NOT IN (
                proowner,
                pg_catalog.to_regrole('service_role')::oid
              )
              OR (
                acl.grantee = pg_catalog.to_regrole('service_role')::oid
                AND acl.is_grantable
              )
            )
        )
      FROM finalizer
    ), false)
  ),
  'recovery', jsonb_build_object(
    'wrapper_exists', EXISTS (SELECT 1 FROM recovery_wrapper),
    'implementation_exists', EXISTS (SELECT 1 FROM recovery_implementation),
    'standard_implementation_exists',
      EXISTS (SELECT 1 FROM standard_recovery_implementation),
    'wrapper_security_definer',
      coalesce((SELECT prosecdef FROM recovery_wrapper), false),
    'wrapper_restricted_search_path', coalesce((
      SELECT proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      FROM recovery_wrapper
    ), false),
    'wrapper_service_role_execute_only', coalesce((
      SELECT
        has_function_privilege('service_role', oid, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
        AND NOT has_function_privilege('anon', oid, 'EXECUTE')
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.aclexplode(
            coalesce(proacl, pg_catalog.acldefault('f', proowner))
          ) acl
          WHERE acl.privilege_type = 'EXECUTE'
            AND (
              acl.grantee NOT IN (
                proowner,
                pg_catalog.to_regrole('service_role')::oid
              )
              OR (
                acl.grantee = pg_catalog.to_regrole('service_role')::oid
                AND acl.is_grantable
              )
            )
        )
      FROM recovery_wrapper
    ), false),
    'implementation_not_callable_by_service_role', coalesce((
      SELECT NOT has_function_privilege('service_role', oid, 'EXECUTE')
      FROM recovery_implementation
    ), false),
    'standard_implementation_owner_only', coalesce((
      SELECT
        NOT has_function_privilege('service_role', oid, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
        AND NOT has_function_privilege('anon', oid, 'EXECUTE')
        AND NOT EXISTS (
          SELECT 1
          FROM pg_catalog.aclexplode(
            coalesce(proacl, pg_catalog.acldefault('f', proowner))
          ) acl
          WHERE acl.privilege_type = 'EXECUTE'
            AND acl.grantee <> proowner
        )
      FROM standard_recovery_implementation
    ), false)
  ),
  'target', (SELECT to_jsonb(target_snapshot) FROM target_snapshot),
  'admin', (SELECT to_jsonb(admin_snapshot) FROM admin_snapshot),
  'audit', '{}'::jsonb,
  'eligible_super_admin_count', (
    SELECT count(DISTINCT ur.user_id)::integer
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.user_credential_states cs ON cs.user_id = p.id
    WHERE ur.is_active
      AND ur.role = 'super_admin'
      AND ur.scope = 'global'
      AND p.is_active
      AND p.user_status = 'active'
      AND cs.credential_state = 'active'
      AND p.organization_id = (
        SELECT admin_profile.organization_id
        FROM public.profiles admin_profile
        WHERE admin_profile.id = '83d92a59-6909-44e7-80f3-aff60a6734fb'::uuid
      )
      AND public.patch83u_effective_super_admin_eligible(
        ur.user_id,
        p.organization_id
      )
  )
) AS patch83u_evidence;

ROLLBACK;
