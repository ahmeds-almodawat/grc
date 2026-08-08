-- Patch 83U post-go-live hotfix: preserve the protected provisioning lifecycle
-- across an intervening governed administrator reset.
--
-- The existing finalizer activated the reserved role only when the immediately
-- preceding credential state was initial_change_required. A governed reset
-- changes that immediate state to admin_reset_change_required without completing
-- the still-pending provisioning record. This migration treats either the
-- original state or a still-pending invited provisioning lifecycle as requiring
-- the same exact-role proof and activation.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $patch83u_189_preflight$
begin
  if to_regprocedure(
    'public.patch83u_finalize_required_password_change(uuid,uuid,text,integer,text,boolean)'
  ) is null
    or to_regprocedure(
      'public.patch83u_reconcile_provisioning(uuid,uuid,text,text)'
    ) is null
  then
    raise exception 'PATCH83U_189_REQUIRED_FUNCTION_MISSING';
  end if;
end;
$patch83u_189_preflight$;

create or replace function public.patch83u_finalize_required_password_change(
  p_actor_id uuid,
  p_operation_id uuid,
  p_request_id text,
  p_applied_credential_version integer,
  p_verified_auth_email text,
  p_session_revocation_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_state public.user_credential_states%rowtype;
  v_queue public.user_account_provisioning%rowtype;
  v_operation public.patch83u_credential_operations%rowtype;
  v_result jsonb;
  v_role_id uuid;
  v_matching_role_count integer := 0;
  v_active_role_count integer := 0;
  v_role_update_count integer := 0;
  v_next_state text;
  v_role_activation_required boolean := false;
  v_role_activation_failed boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  perform public.patch83u_require_service_role();
  perform public.patch83u_require_enforced_runtime();

  if nullif(btrim(coalesce(p_request_id, '')), '') is null
    or length(p_request_id) > 128
    or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'PATCH83U_REQUEST_ID_INVALID';
  end if;

  select op.* into v_operation
  from public.patch83u_credential_operations op
  where op.operation_id = p_operation_id
    and op.operation_type = 'password_change'
    and op.actor_id = p_actor_id
    and op.target_user_id = p_actor_id
    and op.request_id = p_request_id
  for update;
  if v_operation.operation_id is null then
    raise exception 'PATCH83U_PASSWORD_CHANGE_OPERATION_INVALID';
  end if;
  if v_operation.operation_status in (
    'completed', 'recovery_required', 'session_revocation_review_required'
  ) and v_operation.safe_result is not null then
    return v_operation.safe_result || jsonb_build_object('idempotent_replay', true);
  end if;

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_actor_id
  for update;

  if v_state.user_id is null
    or v_state.credential_state <> 'password_change_in_progress'
    or v_state.pending_operation_id is distinct from p_operation_id
    or v_state.pending_credential_version is distinct from p_applied_credential_version
    or v_operation.current_credential_version is distinct from v_state.credential_version
    or v_operation.next_credential_version is distinct from p_applied_credential_version
  then
    raise exception 'PATCH83U_PASSWORD_CHANGE_OPERATION_INVALID';
  end if;
  if lower(btrim(coalesce(p_verified_auth_email, ''))) <> v_state.auth_email
    or not exists (
      select 1 from auth.users u
      where u.id = p_actor_id
        and lower(btrim(u.email)) = v_state.auth_email
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until <= now())
        and public.patch83u_auth_credential_version(u.raw_app_meta_data) = p_applied_credential_version
        and 1 = (
          select count(*) from auth.identities ai
          where ai.user_id = u.id and ai.provider = 'email'
        )
        and 1 = (
          select count(*) from auth.identities ai
          where ai.user_id = u.id
            and ai.provider = 'email'
            and lower(btrim(coalesce(ai.identity_data ->> 'email', '')))
              = v_state.auth_email
        )
    )
  then
    raise exception 'PATCH83U_PASSWORD_CHANGE_DATABASE_PROOF_FAILED';
  end if;
  if coalesce(p_session_revocation_confirmed, false)
    and exists (select 1 from auth.sessions s where s.user_id = p_actor_id)
  then
    raise exception 'PATCH83U_AUTH_SESSIONS_STILL_ACTIVE';
  end if;

  -- The direct first-password path remains unchanged. The added branch detects
  -- a still-pending invited provisioning lifecycle after an administrator reset.
  -- Any partial or contradictory pending signal requires the complete proof
  -- below and therefore fails closed instead of silently granting access.
  v_role_activation_required :=
    v_state.operation_previous_state = 'initial_change_required'
    or (
      v_state.operation_previous_state = 'admin_reset_change_required'
      and v_state.provisioning_id is not null
      and (
        exists (
          select 1
          from public.user_account_provisioning q0
          where q0.id = v_state.provisioning_id
            and q0.provisioning_status = 'initial_change_required'
        )
        or exists (
          select 1
          from public.profiles p0
          where p0.id = p_actor_id
            and p0.user_status = 'invited'
        )
      )
    );

  if v_role_activation_required then
    select q.* into v_queue
    from public.user_account_provisioning q
    where q.id = v_state.provisioning_id
    for update;

    if v_queue.id is null
      or v_queue.organization_id is distinct from v_state.organization_id
      or v_queue.auth_user_id is distinct from p_actor_id
      or v_queue.profile_id is distinct from p_actor_id
      or v_queue.auth_email is distinct from v_state.auth_email
      or v_queue.provisioning_status <> 'initial_change_required'
      or v_queue.last_error_code is not null
      or v_queue.last_error_message is not null
      or not public.patch83u_role_scope_allowed(
        v_queue.requested_role, v_queue.requested_scope
      )
      or not public.patch83u_role_assignment_valid(
        v_state.organization_id,
        v_queue.requested_scope,
        v_state.organization_id,
        null,
        case when v_queue.requested_scope = 'department'
          then v_queue.department_id else null end,
        null
      )
      or not exists (
        select 1
        from public.profiles p
        where p.id = p_actor_id
          and p.organization_id = v_state.organization_id
          and p.employee_no = v_queue.employee_id
          and lower(btrim(p.email)) = v_queue.auth_email
          and p.is_active = true
          and p.user_status = 'invited'
      )
    then
      v_role_activation_failed := true;
    else
      -- Lock every target role in deterministic order. This stabilizes both the
      -- exact matching-row count and the zero-active-role proof.
      perform 1
      from public.user_roles ur
      where ur.user_id = p_actor_id
      order by ur.id
      for update;

      select count(*)::integer
      into v_matching_role_count
      from public.user_roles ur
      where ur.user_id = p_actor_id
        and ur.role = v_queue.requested_role
        and ur.scope = v_queue.requested_scope
        and ur.organization_id is not distinct from v_state.organization_id
        and ur.division_id is null
        and ur.department_id is not distinct from (
          case when v_queue.requested_scope = 'department' then v_queue.department_id else null end
        )
        and ur.unit_id is null;

      select count(*)::integer
      into v_active_role_count
      from public.user_roles ur
      where ur.user_id = p_actor_id
        and ur.is_active = true;

      select ur.id into v_role_id
      from public.user_roles ur
      where ur.user_id = p_actor_id
        and ur.role = v_queue.requested_role
        and ur.scope = v_queue.requested_scope
        and ur.organization_id is not distinct from v_state.organization_id
        and ur.division_id is null
        and ur.department_id is not distinct from (
          case when v_queue.requested_scope = 'department' then v_queue.department_id else null end
        )
        and ur.unit_id is null
      order by ur.id
      limit 1;

      if v_matching_role_count <> 1
        or v_role_id is null
        or v_active_role_count <> 0
        or exists (
          select 1 from public.user_roles ur
          where ur.id = v_role_id and ur.is_active = true
        )
      then
        v_role_activation_failed := true;
      elsif coalesce(p_session_revocation_confirmed, false) then
        perform set_config('patch83u.controlled_role_restore', 'on', true);
        update public.user_roles
        set is_active = true,
            assigned_by = p_actor_id,
            assigned_at = clock_timestamp()
        where id = v_role_id
          and user_id = p_actor_id
          and is_active = false;
        get diagnostics v_role_update_count = row_count;
        perform set_config('patch83u.controlled_role_restore', 'off', true);

        if v_role_update_count <> 1 then
          v_role_activation_failed := true;
        else
          insert into public.role_change_audit (
            organization_id, target_user_id, user_role_id, action,
            new_data, reason, changed_by
          )
          select v_state.organization_id, p_actor_id, v_role_id, 'reactivated',
            to_jsonb(ur), 'Patch 83U initial password change completed', p_actor_id
          from public.user_roles ur where ur.id = v_role_id;
        end if;
      end if;
    end if;
  end if;

  v_next_state := case
    when v_role_activation_failed then 'recovery_required'
    when not coalesce(p_session_revocation_confirmed, false)
      then 'session_revocation_review_required'
    else 'active'
  end;

  update public.user_credential_states
  set credential_state = v_next_state,
      credential_version = p_applied_credential_version,
      session_valid_after = v_now,
      invalidated_session_id = v_state.pending_session_id,
      role_suspension_id = null,
      pending_operation_id = null,
      operation_source = case when v_next_state = 'active'
        then null else 'password_change' end,
      reconciliation_auth_changed = v_next_state <> 'active',
      pending_session_id = null,
      pending_credential_version = null,
      operation_previous_state = case when v_next_state = 'active'
        then null else operation_previous_state end,
      operation_previous_lifecycle = case when v_next_state = 'active'
        then null else operation_previous_lifecycle end,
      operation_previous_session_valid_after = case when v_next_state = 'active'
        then null else operation_previous_session_valid_after end,
      password_changed_at = v_now,
      sessions_revoked_at = case
        when p_session_revocation_confirmed then v_now else sessions_revoked_at end,
      reconciliation_checked_at = case when v_next_state <> 'active'
        then v_now else reconciliation_checked_at end
  where user_id = p_actor_id;

  if v_role_activation_required and v_next_state = 'active' then
    perform set_config('patch83u.controlled_lifecycle_transition', 'on', true);
    update public.profiles
    set user_status = 'active', is_active = true
    where id = p_actor_id
      and organization_id = v_state.organization_id
      and user_status = 'invited'
      and is_active = true;
    if not found then
      raise exception 'PATCH83U_PROVISIONED_PROFILE_ACTIVATION_FAILED';
    end if;
    perform set_config('patch83u.controlled_lifecycle_transition', 'off', true);
  end if;

  if v_queue.id is not null and v_next_state = 'active' then
    update public.user_account_provisioning
    set provisioning_status = 'completed',
        completed_at = v_now,
        last_error_code = null,
        last_error_message = null
    where id = v_queue.id
      and provisioning_status = 'initial_change_required';
    if not found then
      raise exception 'PATCH83U_PROVISIONING_COMPLETION_FAILED';
    end if;
  elsif v_queue.id is not null and v_next_state = 'recovery_required' then
    update public.user_account_provisioning
    set provisioning_status = 'reconciliation_required',
        completed_at = null,
        last_error_code = 'PATCH83U_PROVISIONED_ROLE_ACTIVATION_FAILED',
        last_error_message = 'The protected newly provisioned role could not be activated exactly once.'
    where id = v_queue.id;
  end if;

  v_result := jsonb_build_object(
    'user_id', p_actor_id,
    'request_id', p_request_id,
    'credential_state', v_next_state,
    'credential_version', p_applied_credential_version,
    'must_reauthenticate', true,
    'reconciliation_required', v_next_state = 'recovery_required',
    'session_revocation_review_required',
      v_next_state = 'session_revocation_review_required',
    'idempotent_replay', false
  );

  update public.patch83u_credential_operations
  set operation_status = case
        when v_next_state = 'active' then 'completed'
        when v_next_state = 'session_revocation_review_required'
          then 'session_revocation_review_required'
        else 'recovery_required'
      end,
      resulting_credential_state = v_next_state,
      auth_changed = true,
      session_revocation_confirmed = coalesce(p_session_revocation_confirmed, false),
      safe_result = v_result,
      completed_at = v_now,
      updated_at = v_now
  where operation_id = p_operation_id;

  insert into public.user_credential_events (
    organization_id, user_id, provisioning_id, actor_id, event_type,
    credential_version, session_id, request_id, event_code, details
  ) values (
    v_state.organization_id, p_actor_id, v_state.provisioning_id, p_actor_id,
    case when v_next_state = 'session_revocation_review_required'
      then 'session_revocation_review_required'
      else 'password_change_completed'
    end,
    p_applied_credential_version, v_state.pending_session_id, p_request_id,
    case
      when v_next_state = 'active' then 'PATCH83U_PASSWORD_CHANGE_COMPLETED'
      when v_next_state = 'session_revocation_review_required'
        then 'PATCH83U_SESSION_REVOCATION_REVIEW_REQUIRED'
      else 'PATCH83U_PASSWORD_CHANGE_RECOVERY_REQUIRED'
    end,
    jsonb_build_object(
      'operation_id', p_operation_id,
      'new_provisioned_role_activation_required', v_role_activation_required,
      'new_provisioned_role_activated', v_role_update_count = 1,
      'existing_role_rows_preserved', not v_role_activation_required,
      'session_access_invalidated', true,
      'direct_auth_session_revocation_confirmed',
        coalesce(p_session_revocation_confirmed, false)
    )
  );

  return v_result;
end;
$$;

create or replace function public.patch83u_reconcile_provisioning(
  p_actor_id uuid,
  p_provisioning_id uuid,
  p_request_id text,
  p_employee_id_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_queue public.user_account_provisioning%rowtype;
  v_auth_user_id uuid;
  v_profile public.profiles%rowtype;
  v_state public.user_credential_states%rowtype;
  v_status text;
  v_outcome text;
  v_error_code text;
  v_error_message text;
  v_role_id uuid;
  v_role_is_active boolean := false;
  v_employee_id_conflict boolean := false;
  v_auth_user_count integer := 0;
  v_auth_version integer;
  v_email_identity_count integer := 0;
  v_exact_email_identity_count integer := 0;
  v_matching_role_count integer := 0;
  v_active_role_count integer := 0;
  v_role_update_count integer := 0;
  v_profile_update_count integer := 0;
  v_post_password_activation_recovered boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  v_org_id := public.patch83u_require_super_admin(p_actor_id);
  if nullif(btrim(coalesce(p_request_id, '')), '') is null
    or length(p_request_id) > 128
    or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'PATCH83U_REQUEST_ID_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('patch83u-provisioning:' || p_provisioning_id::text, 0)
  );

  select q.* into v_queue
  from public.user_account_provisioning q
  where q.id = p_provisioning_id
    and q.organization_id = v_org_id
  for update;

  if v_queue.id is null then
    raise exception 'PATCH83U_PROVISIONING_NOT_FOUND';
  end if;
  if p_employee_id_confirmation is distinct from v_queue.employee_id then
    raise exception 'PATCH83U_EMPLOYEE_ID_CONFIRMATION_REQUIRED';
  end if;
  if v_queue.provisioning_status = 'provisioning'
    and v_queue.lease_expires_at is not null
    and v_queue.lease_expires_at > clock_timestamp()
  then
    raise exception 'PATCH83U_PROVISIONING_LEASE_ACTIVE';
  end if;
  if v_queue.provisioning_status in ('held_lifecycle', 'cancelled') then
    raise exception 'PATCH83U_PROVISIONING_STATE_INVALID: %', v_queue.provisioning_status;
  end if;
  if v_queue.auth_email <> public.patch83u_expected_auth_email(v_queue.employee_id) then
    raise exception 'PATCH83U_PROVISIONING_IDENTITY_INVALID';
  end if;
  if v_queue.account_action not in ('create', 'create_or_update') then
    raise exception 'PATCH83U_PROVISIONING_ACCOUNT_ACTION_INVALID';
  end if;
  if v_queue.contact_email is not null and (
    v_queue.contact_email <> lower(btrim(v_queue.contact_email))
    or v_queue.contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'PATCH83U_CONTACT_EMAIL_INVALID';
  end if;

  select count(*)::integer
  into v_auth_user_count
  from auth.users u
  where lower(btrim(u.email)) = v_queue.auth_email;

  select u.id into v_auth_user_id
  from auth.users u
  where lower(btrim(u.email)) = v_queue.auth_email
  order by u.id
  limit 1;

  select exists (
    select 1
    from public.profiles p
    where lower(btrim(p.employee_no)) = lower(v_queue.employee_id)
      and (
        v_auth_user_id is null
        or p.id <> v_auth_user_id
        or btrim(p.employee_no) is distinct from v_queue.employee_id
      )
  ) into v_employee_id_conflict;

  if v_employee_id_conflict then
    v_status := 'reconciliation_required';
    v_outcome := 'employee_id_case_insensitive_conflict';
    v_error_code := 'PATCH83U_EMPLOYEE_ID_CASE_INSENSITIVE_CONFLICT';
    v_error_message := 'A profile already owns the case-insensitive Employee ID login identity.';
  elsif v_auth_user_id is null then
    if v_queue.auth_user_id is not null
      or v_queue.profile_id is not null
      or exists (
        select 1 from public.profiles p
        where p.employee_no = v_queue.employee_id
          and p.organization_id = v_org_id
      )
    then
      v_status := 'reconciliation_required';
      v_outcome := 'auth_missing_with_bound_records';
      v_error_code := 'PATCH83U_AUTH_RECORD_MISSING';
      v_error_message := 'The protected record is bound to application data, but the exact Auth identity is missing.';
    else
      v_status := 'queued';
      v_outcome := 'auth_missing_ready_to_retry';
      v_error_code := null;
      v_error_message := null;
    end if;
  elsif v_auth_user_count <> 1 or not exists (
    select 1 from auth.users u
    where u.id = v_auth_user_id
      and lower(btrim(u.email)) = v_queue.auth_email
      and u.raw_app_meta_data ->> 'patch83u_provisioning_id' = v_queue.id::text
      and public.patch83u_auth_credential_version(u.raw_app_meta_data) >= 1
  ) then
    v_status := 'reconciliation_required';
    v_outcome := 'auth_identity_not_owned';
    v_error_code := 'PATCH83U_EXISTING_AUTH_ACCOUNT_NOT_OWNED';
    v_error_message := 'The exact Auth alias exists without matching protected provisioning ownership.';
  elsif v_queue.auth_user_id is not null and v_queue.auth_user_id <> v_auth_user_id then
    v_status := 'reconciliation_required';
    v_outcome := 'auth_user_binding_conflict';
    v_error_code := 'PATCH83U_AUTH_IDENTITY_CONFLICT';
    v_error_message := 'The protected Auth user binding does not match the canonical Auth alias.';
  elsif exists (
    select 1 from public.profiles p
    where p.id <> v_auth_user_id
      and (
        lower(btrim(p.email)) = v_queue.auth_email
        or lower(btrim(p.employee_no)) = lower(v_queue.employee_id)
      )
  ) then
    v_status := 'reconciliation_required';
    v_outcome := 'profile_identity_conflict';
    v_error_code := 'PATCH83U_PROFILE_IDENTITY_CONFLICT';
    v_error_message := 'A different profile already owns the exact Employee ID or synthetic Auth email identity.';
  else
    select p.* into v_profile
    from public.profiles p
    where p.id = v_auth_user_id
    for update;

    if v_profile.id is null then
      v_status := 'auth_created_pending_finalize';
      v_outcome := 'profile_finalize_required';
      v_error_code := null;
      v_error_message := null;
    elsif v_profile.organization_id is distinct from v_org_id
      or v_profile.employee_no is distinct from v_queue.employee_id
      or lower(btrim(v_profile.email)) <> v_queue.auth_email
      or lower(btrim(coalesce(v_profile.contact_email, ''))) is distinct from
         lower(btrim(coalesce(v_queue.contact_email, '')))
      or v_profile.department_id is distinct from v_queue.department_id
    then
      v_status := 'reconciliation_required';
      v_outcome := 'profile_snapshot_mismatch';
      v_error_code := 'PATCH83U_PROFILE_SNAPSHOT_MISMATCH';
      v_error_message := 'The bound profile does not match the immutable provisioning snapshot.';
    else
      select cs.* into v_state
      from public.user_credential_states cs
      where cs.user_id = v_auth_user_id
      for update;

      select coalesce(bool_or(ur.is_active), false)
      into v_role_is_active
      from public.user_roles ur
      where ur.user_id = v_auth_user_id
        and ur.role = v_queue.requested_role
        and ur.scope = v_queue.requested_scope
        and ur.organization_id is not distinct from v_org_id
        and ur.division_id is null
        and ur.department_id is not distinct from (
          case when v_queue.requested_scope = 'department' then v_queue.department_id else null end
        )
        and ur.unit_id is null;

      if v_state.user_id is null
        or v_state.organization_id is distinct from v_org_id
        or v_state.provisioning_id is distinct from v_queue.id
        or v_state.auth_email <> v_queue.auth_email
      then
        v_status := 'reconciliation_required';
        v_outcome := 'credential_state_mismatch';
        v_error_code := 'PATCH83U_CREDENTIAL_STATE_MISMATCH';
        v_error_message := 'The credential state is missing or does not match the protected provisioning identity.';
      -- Migration 189's one-time recovery uses the existing Super Admin plus
      -- exact Employee-ID protected bridge. It is intentionally limited to the
      -- reported Employee/assigned_only state and changes no credential data.
      elsif v_queue.provisioning_status = 'initial_change_required'
        and v_state.credential_state = 'active'
        and v_profile.user_status = 'invited'
      then
        perform ai.id
        from auth.identities ai
        where ai.user_id = v_auth_user_id
        order by ai.id
        for share;

        select public.patch83u_auth_credential_version(u.raw_app_meta_data)
        into v_auth_version
        from auth.users u
        where u.id = v_auth_user_id
          and lower(btrim(u.email)) = v_queue.auth_email
          and u.email_confirmed_at is not null
          and u.deleted_at is null
          and (u.banned_until is null or u.banned_until <= now())
          and nullif(u.encrypted_password, '') is not null
          and u.raw_app_meta_data ->> 'patch83u_provisioning_id' = v_queue.id::text
        for share;

        select
          count(*) filter (where ai.provider = 'email')::integer,
          count(*) filter (
            where ai.provider = 'email'
              and lower(btrim(coalesce(ai.identity_data ->> 'email', '')))
                = v_queue.auth_email
          )::integer
        into v_email_identity_count, v_exact_email_identity_count
        from auth.identities ai
        where ai.user_id = v_auth_user_id;

        perform ur.id
        from public.user_roles ur
        where ur.user_id = v_auth_user_id
        order by ur.id
        for update;

        select count(*)::integer
        into v_matching_role_count
        from public.user_roles ur
        where ur.user_id = v_auth_user_id
          and ur.role = v_queue.requested_role
          and ur.scope = v_queue.requested_scope
          and ur.organization_id is not distinct from v_org_id
          and ur.division_id is null
          and ur.department_id is null
          and ur.unit_id is null;

        select count(*)::integer
        into v_active_role_count
        from public.user_roles ur
        where ur.user_id = v_auth_user_id
          and ur.is_active = true;

        select ur.id into v_role_id
        from public.user_roles ur
        where ur.user_id = v_auth_user_id
          and ur.role = v_queue.requested_role
          and ur.scope = v_queue.requested_scope
          and ur.organization_id is not distinct from v_org_id
          and ur.division_id is null
          and ur.department_id is null
          and ur.unit_id is null
        order by ur.id
        limit 1;

        if v_queue.auth_user_id is distinct from v_auth_user_id
          or v_queue.profile_id is distinct from v_auth_user_id
          or v_queue.requested_role is distinct from 'employee'
          or v_queue.requested_scope is distinct from 'assigned_only'
          or v_queue.last_error_code is not null
          or v_queue.last_error_message is not null
          or v_profile.id is distinct from v_auth_user_id
          or v_profile.organization_id is distinct from v_org_id
          or v_profile.employee_no is distinct from v_queue.employee_id
          or lower(btrim(v_profile.email)) is distinct from v_queue.auth_email
          or v_profile.is_active is distinct from true
          or v_profile.user_status is distinct from 'invited'
          or v_state.organization_id is distinct from v_org_id
          or v_state.provisioning_id is distinct from v_queue.id
          or v_state.auth_email is distinct from v_queue.auth_email
          or v_state.credential_state is distinct from 'active'
          or v_state.credential_version < 1
          or v_state.requested_lifecycle is distinct from 'active'
          or v_state.pending_operation_id is not null
          or v_state.pending_session_id is not null
          or v_state.pending_credential_version is not null
          or v_state.role_suspension_id is not null
          or v_state.operation_source is not null
          or v_state.reconciliation_auth_changed is distinct from false
          or v_auth_version is distinct from v_state.credential_version
          or v_email_identity_count <> 1
          or v_exact_email_identity_count <> 1
          or not public.patch83u_role_scope_allowed(
            v_queue.requested_role, v_queue.requested_scope
          )
          or not public.patch83u_role_assignment_valid(
            v_org_id,
            v_queue.requested_scope,
            v_org_id,
            null,
            null,
            null
          )
          or v_matching_role_count <> 1
          or v_role_id is null
          or v_active_role_count <> 0
          or exists (
            select 1
            from public.user_roles ur
            where ur.id = v_role_id
              and ur.is_active = true
          )
        then
          raise exception 'PATCH83U_POST_PROVISIONING_ROLE_ACTIVATION_PROOF_FAILED';
        end if;

        perform set_config('patch83u.controlled_role_restore', 'on', true);
        update public.user_roles
        set is_active = true,
            assigned_by = p_actor_id,
            assigned_at = v_now
        where id = v_role_id
          and user_id = v_auth_user_id
          and is_active = false;
        get diagnostics v_role_update_count = row_count;
        perform set_config('patch83u.controlled_role_restore', 'off', true);
        if v_role_update_count <> 1 then
          raise exception 'PATCH83U_POST_PROVISIONING_ROLE_ACTIVATION_CHANGED';
        end if;

        insert into public.role_change_audit (
          organization_id, target_user_id, user_role_id, action,
          new_data, reason, changed_by
        )
        select v_org_id, v_auth_user_id, v_role_id, 'reactivated',
          to_jsonb(ur), 'Patch 83U post-provisioning role activation recovery', p_actor_id
        from public.user_roles ur
        where ur.id = v_role_id;

        perform set_config('patch83u.controlled_lifecycle_transition', 'on', true);
        update public.profiles
        set user_status = 'active',
            is_active = true
        where id = v_auth_user_id
          and organization_id = v_org_id
          and user_status = 'invited'
          and is_active = true;
        get diagnostics v_profile_update_count = row_count;
        perform set_config('patch83u.controlled_lifecycle_transition', 'off', true);
        if v_profile_update_count <> 1 then
          raise exception 'PATCH83U_POST_PROVISIONING_PROFILE_ACTIVATION_CHANGED';
        end if;

        v_post_password_activation_recovered := true;
        v_role_is_active := true;
        v_status := 'completed';
        -- Preserve the RC3 Edge contract allowlist. The audit event below
        -- distinguishes recovery from the ordinary already-completed result.
        v_outcome := 'already_completed';
        v_error_code := null;
        v_error_message := null;
      elsif v_state.credential_state = 'active'
        and v_profile.user_status = 'active'
        and v_profile.is_active = true
        and v_role_is_active
      then
        v_status := 'completed';
        v_outcome := 'already_completed';
        v_error_code := null;
        v_error_message := null;
      elsif v_state.credential_state in (
        'initial_change_required',
        'admin_reset_change_required',
        'password_change_in_progress'
      )
        and v_profile.user_status = 'invited'
        and not v_role_is_active
      then
        v_status := 'initial_change_required';
        v_outcome := 'password_change_pending';
        v_error_code := null;
        v_error_message := null;
      else
        v_status := 'reconciliation_required';
        v_outcome := 'lifecycle_or_role_mismatch';
        v_error_code := 'PATCH83U_LIFECYCLE_ROLE_MISMATCH';
        v_error_message := 'The profile lifecycle, credential state, and role activation state are inconsistent.';
      end if;
    end if;
  end if;

  update public.user_account_provisioning
  set auth_user_id = case
        when v_auth_user_id is not null
          and v_outcome not in ('auth_identity_not_owned', 'auth_user_binding_conflict')
          then v_auth_user_id
        else auth_user_id
      end,
      auth_created_at = case
        when v_auth_user_id is not null
          and v_outcome not in ('auth_identity_not_owned', 'auth_user_binding_conflict')
          then coalesce(auth_created_at, clock_timestamp())
        else auth_created_at
      end,
      profile_id = case when v_profile.id is not null then v_profile.id else profile_id end,
      provisioning_status = v_status,
      completed_at = case
        when v_status = 'completed' then coalesce(completed_at, v_now)
        else completed_at
      end,
      lease_expires_at = null,
      attempt_id = null,
      request_id = btrim(p_request_id),
      reconciled_at = v_now,
      reconciled_by = p_actor_id,
      last_error_code = v_error_code,
      last_error_message = v_error_message
  where id = v_queue.id;
  if not found then
    raise exception 'PATCH83U_PROVISIONING_RECONCILIATION_CHANGED';
  end if;

  insert into public.user_credential_events (
    organization_id, user_id, provisioning_id, actor_id, event_type,
    credential_version, request_id, event_code, details
  ) values (
    v_org_id, v_profile.id, v_queue.id, p_actor_id,
    'provisioning_reconciled', v_state.credential_version, btrim(p_request_id),
    case
      when v_post_password_activation_recovered
        then 'PATCH83U_POST_PROVISIONING_ROLE_ACTIVATED'
      when v_status = 'reconciliation_required'
        then 'PATCH83U_RECONCILIATION_REQUIRED'
      else 'PATCH83U_PROVISIONING_RECONCILED'
    end,
    jsonb_build_object(
      'outcome', v_outcome,
      'provisioning_status', v_status,
      'post_password_role_activation_recovered',
        v_post_password_activation_recovered,
      'role_rows_changed', v_role_update_count,
      'profile_status_rows_changed', v_profile_update_count,
      'credential_state_preserved', v_post_password_activation_recovered,
      'credential_version_preserved', v_post_password_activation_recovered
    )
  );

  return jsonb_build_object(
    'provisioning_id', v_queue.id,
    'provisioning_status', v_status,
    'outcome', v_outcome,
    'reconciliation_required', v_status = 'reconciliation_required'
  );
end;
$$;

revoke all on function public.patch83u_finalize_required_password_change(
  uuid, uuid, text, integer, text, boolean
) from public, anon, authenticated;
grant execute on function public.patch83u_finalize_required_password_change(
  uuid, uuid, text, integer, text, boolean
) to service_role;

revoke all on function public.patch83u_reconcile_provisioning(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.patch83u_reconcile_provisioning(
  uuid, uuid, text, text
) to service_role;

comment on function public.patch83u_finalize_required_password_change(
  uuid, uuid, text, integer, text, boolean
) is
'Service-only finalization with exact operation/request/Auth proof. Migration 189 also recognizes a still-pending invited provisioning lifecycle after an intervening governed admin reset; only its exact inactive reserved role may be activated once.';

comment on function public.patch83u_reconcile_provisioning(
  uuid, uuid, text, text
) is
'Service-only, Super-Admin and exact-Employee-ID reconciliation. Migration 189 permits one fail-closed Employee/assigned_only post-password activation only when Auth, profile, credential version, provisioning identity, zero-active-role, and exact inactive-role proofs all agree.';

commit;
