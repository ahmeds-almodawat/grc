-- Patch 83U.1: narrowly scoped last-designated-Super-Admin recovery.
--
-- This forward-only correction does not mutate Auth credentials or delete Auth
-- sessions. It adds:
--   * atomic zero-session proof/finalization for required password changes;
--   * an emergency-only, service-role-only recovery path for the designated
--     legacy Super Admin when the ordinary active-credential guard cannot run.

begin;

-- ---------------------------------------------------------------------------
-- Atomic required-password-change session-revocation proof and finalization
-- ---------------------------------------------------------------------------

create or replace function public.patch83u_finalize_required_password_change_after_session_revocation(
  p_actor_id uuid,
  p_operation_id uuid,
  p_request_id text,
  p_applied_credential_version integer,
  p_verified_auth_email text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_operation public.patch83u_credential_operations%rowtype;
  v_auth_session_count integer;
  v_result jsonb;
begin
  perform public.patch83u_require_service_role();
  perform public.patch83u_require_enforced_runtime();

  perform rc.singleton
  from public.patch83u_runtime_control rc
  where rc.singleton = true
    and rc.enforcement_state = 'enforced'
  for share;
  if not found then
    raise exception 'PATCH83U_RUNTIME_NOT_ENFORCED';
  end if;

  -- The supported Auth Admin global sign-out is complete before this RPC.
  -- Take the session-table lock before any Auth identity lock: password-grant
  -- paths can create a session before updating auth.users. Later Auth locks use
  -- NOWAIT so an Admin user-first writer fails this transaction closed instead
  -- of forming a user/session wait cycle. There are no external calls while
  -- these locks are held.
  lock table auth.sessions in share mode;
  lock table auth.identities in share mode nowait;

  perform u.id
  from auth.users u
  where u.id = p_actor_id
  for share nowait;
  if not found then
    raise exception 'PATCH83U_PASSWORD_CHANGE_DATABASE_PROOF_FAILED';
  end if;

  select op.* into v_operation
  from public.patch83u_credential_operations op
  where op.operation_id = p_operation_id
    and op.operation_type = 'password_change'
    and op.actor_id = p_actor_id
    and op.target_user_id = p_actor_id
    and op.request_id = p_request_id;

  -- Preserve the existing finalizer's exact terminal replay behavior. A replay
  -- does not activate or mutate credential state, so a later fresh login does
  -- not turn a completed request into an error.
  if v_operation.operation_id is not null
    and v_operation.operation_status in (
      'completed', 'recovery_required', 'session_revocation_review_required'
    )
    and v_operation.safe_result is not null
  then
    return public.patch83u_finalize_required_password_change(
      p_actor_id,
      p_operation_id,
      p_request_id,
      p_applied_credential_version,
      p_verified_auth_email,
      true
    );
  end if;

  select count(*)::integer into v_auth_session_count
  from auth.sessions s
  where s.user_id = p_actor_id;
  if v_auth_session_count <> 0 then
    raise exception 'PATCH83U_AUTH_SESSIONS_STILL_ACTIVE';
  end if;

  v_result := public.patch83u_finalize_required_password_change(
    p_actor_id,
    p_operation_id,
    p_request_id,
    p_applied_credential_version,
    p_verified_auth_email,
    true
  );
  return v_result;
end;
$$;

revoke all on function public.patch83u_finalize_required_password_change_after_session_revocation(
  uuid, uuid, text, integer, text
) from public, anon, authenticated;
grant execute on function public.patch83u_finalize_required_password_change_after_session_revocation(
  uuid, uuid, text, integer, text
) to service_role;

comment on function public.patch83u_finalize_required_password_change_after_session_revocation(
  uuid, uuid, text, integer, text
) is
'Service-only atomic required-password-change finalization. It holds auth.sessions stable, requires exact zero-session proof, and calls the existing protected finalizer without mutating Auth storage.';

-- ---------------------------------------------------------------------------
-- Emergency last-designated-Super-Admin recovery
-- ---------------------------------------------------------------------------

-- Retain the complete ordinary reconciliation implementation behind an
-- owner-only name. It continues to call patch83u_require_super_admin unchanged.
alter function public.patch83u_reconcile_credential_state(
  uuid, uuid, text, text
) rename to patch83u_reconcile_credential_state_standard_impl;

revoke all on function public.patch83u_reconcile_credential_state_standard_impl(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;

create function public.patch83u_reconcile_last_super_admin_recovery(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_request_id text,
  p_employee_id_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_runtime public.patch83u_runtime_control%rowtype;
  v_profile public.profiles%rowtype;
  v_state public.user_credential_states%rowtype;
  v_operation public.patch83u_credential_operations%rowtype;
  v_org_id uuid;
  v_auth_email text;
  v_auth_email_confirmed_at timestamptz;
  v_auth_deleted_at timestamptz;
  v_auth_banned_until timestamptz;
  v_auth_metadata jsonb;
  v_auth_version integer;
  v_auth_session_count integer;
  v_target_super_admin_count integer;
  v_target_valid_super_admin_count integer;
  v_org_super_admin_count integer;
  v_org_valid_super_admin_count integer;
  v_operation_count integer;
  v_request_event_count integer;
  v_recovery_event_count integer;
  v_expected_operation_status text;
  v_expected_operation_result text;
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
  v_operation_result jsonb;
begin
  perform public.patch83u_require_service_role();

  if p_actor_id is null
    or p_target_user_id is null
    or nullif(btrim(coalesce(p_request_id, '')), '') is null
    or length(p_request_id) > 128
    or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'PATCH83U_REQUEST_ID_INVALID';
  end if;

  select rc.* into v_runtime
  from public.patch83u_runtime_control rc
  where rc.singleton = true
  for update;

  if v_runtime.singleton is null
    or v_runtime.enforcement_state <> 'emergency_suspended'
  then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_RUNTIME_INVALID';
  end if;
  if p_actor_id is distinct from p_target_user_id
    or p_actor_id is distinct from v_runtime.designated_super_admin_id
  then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_ACTOR_INVALID';
  end if;

  -- Read only to discover the organization. The value is rechecked after the
  -- organization-wide eligibility lock is held.
  select p.organization_id into v_org_id
  from public.profiles p
  where p.id = p_target_user_id;
  if v_org_id is null then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_PROFILE_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'patch83u-super-admin-eligibility:' || v_org_id::text,
      0
    )
  );

  select p.* into v_profile
  from public.profiles p
  where p.id = p_target_user_id
  for update;

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_target_user_id
  for update;

  if v_profile.id is null
    or v_profile.organization_id is distinct from v_org_id
    or v_profile.is_active is distinct from true
    or v_profile.user_status is distinct from 'active'
    or v_state.user_id is null
    or v_state.organization_id is distinct from v_org_id
    or v_state.requested_lifecycle is distinct from 'active'
    or v_state.identity_mode is distinct from 'legacy_verified'
    or v_state.provisioning_id is not null
  then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_PROFILE_INVALID';
  end if;
  if p_employee_id_confirmation is distinct from v_profile.employee_no then
    raise exception 'PATCH83U_EMPLOYEE_ID_CONFIRMATION_REQUIRED';
  end if;

  -- The profile row blocks new FK-backed assignments for the target. The
  -- organization advisory lock is the canonical role-administration lock.
  perform ur.id
  from public.user_roles ur
  where ur.user_id = p_target_user_id
    and ur.is_active = true
  order by ur.id
  for update;

  perform ur.id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where p.organization_id = v_org_id
    and p.is_active = true
    and p.user_status = 'active'
    and ur.is_active = true
    and ur.role = 'super_admin'
  order by ur.id
  for update of ur;

  select count(*)::integer,
         count(*) filter (
           where ur.scope = 'global'
             and public.patch83u_role_scope_allowed(ur.role, ur.scope)
             and public.patch83u_role_assignment_valid(
               v_org_id,
               ur.scope,
               ur.organization_id,
               ur.division_id,
               ur.department_id,
               ur.unit_id
             )
         )::integer
  into v_target_super_admin_count, v_target_valid_super_admin_count
  from public.user_roles ur
  where ur.user_id = p_target_user_id
    and ur.is_active = true
    and ur.role = 'super_admin';

  select
    count(*)::integer,
    count(*) filter (
      where ur.scope = 'global'
        and public.patch83u_role_scope_allowed(ur.role, ur.scope)
        and public.patch83u_role_assignment_valid(
          v_org_id,
          ur.scope,
          ur.organization_id,
          ur.division_id,
          ur.department_id,
          ur.unit_id
        )
    )::integer
  into v_org_super_admin_count, v_org_valid_super_admin_count
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where p.organization_id = v_org_id
    and p.is_active = true
    and p.user_status = 'active'
    and ur.is_active = true
    and ur.role = 'super_admin';

  if v_target_super_admin_count <> 1
    or v_target_valid_super_admin_count <> 1
    or v_org_super_admin_count <> 1
    or v_org_valid_super_admin_count <> 1
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p_target_user_id
        and ur.is_active = true
        and (
          not public.patch83u_role_scope_allowed(ur.role, ur.scope)
          or not public.patch83u_role_assignment_valid(
            v_org_id,
            ur.scope,
            ur.organization_id,
            ur.division_id,
            ur.department_id,
            ur.unit_id
          )
        )
    )
  then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_ROLE_INVALID';
  end if;

  -- Take the potentially waiting session-table lock before any Auth identity
  -- lock. Password-grant paths can create a session before updating auth.users,
  -- while Admin changes can lock auth.users before touching sessions. The later
  -- identity/user locks therefore use NOWAIT: contention fails recovery closed
  -- and releases the session lock instead of forming a wait cycle.
  lock table auth.sessions in share mode;
  lock table auth.identities in share mode nowait;

  select
    u.email,
    u.email_confirmed_at,
    u.deleted_at,
    u.banned_until,
    u.raw_app_meta_data
  into
    v_auth_email,
    v_auth_email_confirmed_at,
    v_auth_deleted_at,
    v_auth_banned_until,
    v_auth_metadata
  from auth.users u
  where u.id = p_target_user_id
  for share nowait;

  if not found then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_AUTH_INVALID';
  end if;

  v_auth_version := public.patch83u_auth_credential_version(v_auth_metadata);
  if v_auth_email is distinct from v_state.auth_email
    or v_auth_email_confirmed_at is null
    or v_auth_deleted_at is not null
    or (v_auth_banned_until is not null and v_auth_banned_until > now())
    or v_auth_version is distinct from v_state.credential_version
    or 1 <> (
      select count(*)
      from auth.identities ai
      where ai.user_id = p_target_user_id
        and ai.provider = 'email'
    )
    or 1 <> (
      select count(*)
      from auth.identities ai
      where ai.user_id = p_target_user_id
        and ai.provider = 'email'
        and ai.identity_data ->> 'email' = v_state.auth_email
    )
  then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_AUTH_INVALID';
  end if;

  select count(*)::integer into v_auth_session_count
  from auth.sessions s
  where s.user_id = p_target_user_id;
  if v_auth_session_count <> 0 then
    raise exception 'PATCH83U_AUTH_SESSIONS_STILL_ACTIVE';
  end if;

  -- A recovery request ID is globally single-use within the append-only
  -- credential evidence stream. An exact successful replay is safe; any other
  -- reuse is rejected.
  select
    count(*)::integer,
    count(*) filter (
      where e.event_type = 'credential_reconciled'
        and e.event_code = 'PATCH83U_LAST_SUPER_ADMIN_RECOVERED'
        and e.actor_id = p_actor_id
        and e.user_id = p_target_user_id
        and e.credential_version = v_state.credential_version
        and e.details ->> 'recovery_authorization'
          = 'last_designated_super_admin_emergency_self_recovery'
    )::integer
  into v_request_event_count, v_recovery_event_count
  from public.user_credential_events e
  where e.request_id = btrim(p_request_id);

  if v_request_event_count > 0 then
    if v_request_event_count <> 1
      or v_recovery_event_count <> 1
      or v_state.credential_state is distinct from 'active'
      or v_state.operation_source is not null
      or v_state.reconciliation_auth_changed is distinct from false
      or exists (
        select 1
        from public.patch83u_credential_operations op
        where op.request_id = btrim(p_request_id)
      )
      or exists (
        select 1
        from public.patch83u_runtime_events re
        where re.request_id = btrim(p_request_id)
      )
    then
      raise exception 'PATCH83U_RECOVERY_REQUEST_ID_REUSED';
    end if;
    return jsonb_build_object(
      'user_id', p_target_user_id,
      'request_id', btrim(p_request_id),
      'credential_state', 'active',
      'credential_version', v_state.credential_version,
      'outcome', 'last_super_admin_recovered_from_emergency_proof',
      'recovery_authorization',
        'last_designated_super_admin_emergency_self_recovery',
      'auth_session_count', 0,
      'recovery_required', false,
      'reconciliation_required', false,
      'idempotent_replay', true
    );
  end if;

  if exists (
      select 1
      from public.patch83u_credential_operations op
      where op.request_id = btrim(p_request_id)
    )
    or exists (
      select 1
      from public.patch83u_runtime_events re
      where re.request_id = btrim(p_request_id)
    )
  then
    raise exception 'PATCH83U_RECOVERY_REQUEST_ID_REUSED';
  end if;

  if v_state.credential_state not in (
      'recovery_required',
      'reconciliation_required',
      'session_revocation_review_required'
    )
    or v_state.credential_version < 1
    or v_state.pending_operation_id is not null
    or v_state.pending_session_id is not null
    or v_state.pending_credential_version is not null
    or v_state.role_suspension_id is not null
    or v_state.operation_source is distinct from 'password_change'
    or v_state.reconciliation_auth_changed is distinct from true
    or v_state.operation_previous_state is null
    or v_state.operation_previous_state not in (
        'existing_password_change_required',
        'initial_change_required',
        'admin_reset_change_required',
        'reactivation_change_required'
      )
    or v_state.operation_previous_lifecycle is distinct from 'active'
    or v_state.operation_previous_session_valid_after is null
    or v_state.operation_previous_session_valid_after > v_state.session_valid_after
  then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_STATE_INVALID';
  end if;

  v_expected_operation_status := case
    when v_state.credential_state = 'session_revocation_review_required'
      then 'session_revocation_review_required'
    else 'recovery_required'
  end;
  v_expected_operation_result := case
    when v_state.credential_state = 'session_revocation_review_required'
      then 'session_revocation_review_required'
    else 'recovery_required'
  end;

  perform op.operation_id
  from public.patch83u_credential_operations op
  where op.operation_type = 'password_change'
    and op.organization_id = v_org_id
    and op.actor_id = p_actor_id
    and op.target_user_id = p_target_user_id
    and op.operation_status = v_expected_operation_status
    and op.resulting_credential_state = v_expected_operation_result
    and op.auth_changed = true
    and op.next_credential_version = v_state.credential_version
  order by op.created_at, op.operation_id
  for update;

  select count(*)::integer into v_operation_count
  from public.patch83u_credential_operations op
  where op.operation_type = 'password_change'
    and op.organization_id = v_org_id
    and op.actor_id = p_actor_id
    and op.target_user_id = p_target_user_id
    and op.operation_status = v_expected_operation_status
    and op.resulting_credential_state = v_expected_operation_result
    and op.auth_changed = true
    and op.next_credential_version = v_state.credential_version;

  if v_operation_count <> 1 then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_OPERATION_INVALID';
  end if;

  select op.* into v_operation
  from public.patch83u_credential_operations op
  where op.operation_type = 'password_change'
    and op.organization_id = v_org_id
    and op.actor_id = p_actor_id
    and op.target_user_id = p_target_user_id
    and op.operation_status = v_expected_operation_status
    and op.resulting_credential_state = v_expected_operation_result
    and op.auth_changed = true
    and op.next_credential_version = v_state.credential_version
  order by op.created_at, op.operation_id
  limit 1;

  if v_operation.operation_id is null
    or v_operation.current_credential_version + 1
      is distinct from v_state.credential_version
    or v_operation.safe_result is null
    or v_operation.safe_result ->> 'request_id'
      is distinct from v_operation.request_id
    or v_operation.safe_result ->> 'credential_version'
      is distinct from v_state.credential_version::text
    or v_operation.safe_result ->> 'credential_state'
      is distinct from v_expected_operation_result
    or (
      v_state.credential_state = 'session_revocation_review_required'
      and (
        v_operation.session_revocation_confirmed is distinct from false
        or v_operation.safe_result -> 'session_revocation_review_required'
          is distinct from 'true'::jsonb
        or coalesce(
          v_operation.safe_result -> 'reconciliation_required',
          'false'::jsonb
        ) is distinct from 'false'::jsonb
        or coalesce(
          v_operation.safe_result -> 'recovery_required',
          'false'::jsonb
        ) is distinct from 'false'::jsonb
      )
    )
  then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_OPERATION_INVALID';
  end if;

  update public.user_credential_states
  set credential_state = 'active',
      session_valid_after = v_now,
      role_suspension_id = null,
      operation_source = null,
      reconciliation_auth_changed = false,
      operation_previous_state = null,
      operation_previous_lifecycle = null,
      operation_previous_session_valid_after = null,
      sessions_revoked_at = v_now,
      reconciliation_checked_at = v_now,
      updated_at = v_now
  where user_id = p_target_user_id
    and organization_id = v_org_id
    and credential_version = v_state.credential_version
    and credential_state = v_state.credential_state
    and operation_source = 'password_change'
    and reconciliation_auth_changed = true;
  if not found then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_STATE_CHANGED';
  end if;

  v_operation_result := v_operation.safe_result || jsonb_build_object(
    'credential_state', 'active',
    'credential_version', v_state.credential_version,
    'must_reauthenticate', true,
    'recovery_required', false,
    'reconciliation_required', false,
    'session_revocation_review_required', false,
    'reconciled_by_request_id', btrim(p_request_id)
  );

  update public.patch83u_credential_operations
  set operation_status = 'completed',
      resulting_credential_state = 'active',
      session_revocation_confirmed = true,
      safe_result = v_operation_result,
      completed_at = coalesce(completed_at, v_now),
      updated_at = v_now
  where operation_id = v_operation.operation_id
    and operation_status = v_expected_operation_status
    and resulting_credential_state = v_expected_operation_result
    and auth_changed = true;
  if not found then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RECOVERY_OPERATION_CHANGED';
  end if;

  insert into public.user_credential_events (
    organization_id,
    user_id,
    provisioning_id,
    actor_id,
    event_type,
    credential_version,
    request_id,
    event_code,
    details
  ) values (
    v_org_id,
    p_target_user_id,
    null,
    p_actor_id,
    'credential_reconciled',
    v_state.credential_version,
    btrim(p_request_id),
    'PATCH83U_LAST_SUPER_ADMIN_RECOVERED',
    jsonb_build_object(
      'outcome', 'last_super_admin_recovered_from_emergency_proof',
      'recovery_authorization',
        'last_designated_super_admin_emergency_self_recovery',
      'runtime_state', v_runtime.enforcement_state,
      'runtime_state_version', v_runtime.state_version,
      'previous_credential_state', v_state.credential_state,
      'operation_source', v_state.operation_source,
      'operation_previous_state', v_state.operation_previous_state,
      'operation_previous_lifecycle', v_state.operation_previous_lifecycle,
      'credential_operation_id', v_operation.operation_id,
      'credential_operation_request_id', v_operation.request_id,
      'auth_session_count', v_auth_session_count,
      'target_valid_super_admin_assignment_count',
        v_target_valid_super_admin_count,
      'organization_active_super_admin_assignment_count',
        v_org_super_admin_count,
      'organization_valid_super_admin_assignment_count',
        v_org_valid_super_admin_count,
      'profile_preserved', true,
      'role_rows_preserved', true,
      'provisioning_rows_preserved', true
    )
  );

  v_result := jsonb_build_object(
    'user_id', p_target_user_id,
    'request_id', btrim(p_request_id),
    'credential_state', 'active',
    'credential_version', v_state.credential_version,
    'outcome', 'last_super_admin_recovered_from_emergency_proof',
    'recovery_authorization',
      'last_designated_super_admin_emergency_self_recovery',
    'auth_session_count', v_auth_session_count,
    'recovery_required', false,
    'reconciliation_required', false,
    'idempotent_replay', false
  );
  return v_result;
end;
$$;

-- The helper is callable only through the service-role reconcile wrapper. Its
-- own first statement still verifies the service-role JWT claim.
revoke all on function public.patch83u_reconcile_last_super_admin_recovery(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;

create function public.patch83u_reconcile_credential_state(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_request_id text,
  p_employee_id_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_runtime_state text;
begin
  perform public.patch83u_require_service_role();

  select rc.enforcement_state into v_runtime_state
  from public.patch83u_runtime_control rc
  where rc.singleton = true
  for update;

  if v_runtime_state is null then
    raise exception 'PATCH83U_RUNTIME_CONTROL_MISSING';
  end if;

  if v_runtime_state = 'emergency_suspended' then
    return public.patch83u_reconcile_last_super_admin_recovery(
      p_actor_id,
      p_target_user_id,
      p_request_id,
      p_employee_id_confirmation
    );
  end if;

  return public.patch83u_reconcile_credential_state_standard_impl(
    p_actor_id,
    p_target_user_id,
    p_request_id,
    p_employee_id_confirmation
  );
end;
$$;

revoke all on function public.patch83u_reconcile_credential_state(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.patch83u_reconcile_credential_state(
  uuid, uuid, text, text
) to service_role;

comment on function public.patch83u_reconcile_credential_state(
  uuid, uuid, text, text
) is
'Service-only credential reconciliation. Emergency suspension permits only exact designated legacy-Super-Admin self-recovery with zero Auth sessions; all other runtime states retain the ordinary Super Admin guard.';
comment on function public.patch83u_reconcile_last_super_admin_recovery(
  uuid, uuid, text, text
) is
'Owner-only implementation for exact designated legacy-Super-Admin emergency self-recovery. The service-role reconcile wrapper is its sole entry point.';

commit;
