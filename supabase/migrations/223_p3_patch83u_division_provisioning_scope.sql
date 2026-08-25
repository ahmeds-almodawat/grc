-- P3 correction cycle 2: preserve the requested division when finalizing a
-- division-scoped account. The historical finalizer always supplied NULL,
-- causing its own role-reference validator to reject the canonical scope.

create or replace function public.patch83u_finalize_provisioning(
  p_actor_id uuid,
  p_provisioning_id uuid,
  p_attempt_id uuid,
  p_auth_user_id uuid,
  p_verified_auth_email text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_org_id uuid;
  v_queue public.user_account_provisioning%rowtype;
  v_role_id uuid;
  v_role_division_id uuid;
  v_role_department_id uuid;
  v_role_unit_id uuid;
begin
  perform public.patch83u_require_enforced_runtime();
  v_org_id := public.patch83u_require_super_admin(p_actor_id);

  select q.*
  into v_queue
  from public.user_account_provisioning q
  where q.id = p_provisioning_id
    and q.organization_id = v_org_id
  for update;

  if v_queue.id is null then
    raise exception 'PATCH83U_PROVISIONING_NOT_FOUND';
  end if;
  if v_queue.provisioning_status not in ('provisioning', 'auth_created_pending_finalize')
    or v_queue.attempt_id is distinct from p_attempt_id
  then
    raise exception 'PATCH83U_PROVISIONING_ATTEMPT_INVALID';
  end if;
  if p_auth_user_id is null
    or (v_queue.auth_user_id is not null and v_queue.auth_user_id <> p_auth_user_id)
    or lower(btrim(coalesce(p_verified_auth_email, ''))) <> v_queue.auth_email
  then
    raise exception 'PATCH83U_AUTH_IDENTITY_CONFLICT';
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

  -- Database proof of the exact Auth identity and the credential version written
  -- by the server-side bridge. No browser assertion is trusted for this proof.
  if not exists (
    select 1
    from auth.users u
    where u.id = p_auth_user_id
      and lower(btrim(u.email)) = v_queue.auth_email
      and u.email_confirmed_at is not null
      and u.raw_app_meta_data ->> 'patch83u_provisioning_id' = v_queue.id::text
      and public.patch83u_auth_credential_version(u.raw_app_meta_data) = 1
  ) then
    raise exception 'PATCH83U_AUTH_DATABASE_PROOF_FAILED';
  end if;
  if exists (
    select 1 from public.profiles p
    where p.id = p_auth_user_id
       or lower(btrim(p.email)) = v_queue.auth_email
       or lower(btrim(p.employee_no)) = lower(v_queue.employee_id)
  ) then
    raise exception 'PATCH83U_PROFILE_IDENTITY_CONFLICT';
  end if;
  if not public.patch83u_role_scope_allowed(v_queue.requested_role, v_queue.requested_scope) then
    raise exception 'PATCH83U_ROLE_SCOPE_INVALID';
  end if;

  v_role_division_id := case
    when v_queue.requested_scope = 'division' then v_queue.division_id
    else null
  end;
  v_role_department_id := case
    when v_queue.requested_scope = 'department' then v_queue.department_id
    else null
  end;
  v_role_unit_id := null;

  if not public.patch83u_role_assignment_valid(
    v_org_id,
    v_queue.requested_scope,
    v_org_id,
    v_role_division_id,
    v_role_department_id,
    v_role_unit_id
  ) then
    raise exception 'PATCH83U_ROLE_REFERENCE_INVALID';
  end if;

  insert into public.profiles (
    id, organization_id, employee_no, full_name_en, full_name_ar,
    email, contact_email, phone, job_title, division_id, department_id, unit_id,
    is_active, user_status, user_type
  ) values (
    p_auth_user_id, v_org_id, v_queue.employee_id, v_queue.full_name_en,
    v_queue.full_name_ar, v_queue.auth_email, v_queue.contact_email, v_queue.phone,
    v_queue.job_title, v_queue.division_id, v_queue.department_id, null,
    true, 'invited', v_queue.requested_user_type
  );

  insert into public.user_credential_states (
    user_id, organization_id, provisioning_id, auth_email, identity_mode,
    credential_state, requested_lifecycle, credential_version,
    session_valid_after, provisioned_at
  ) values (
    p_auth_user_id, v_org_id, v_queue.id, v_queue.auth_email, 'employee_id_managed',
    'initial_change_required', v_queue.requested_lifecycle, 1,
    clock_timestamp(), clock_timestamp()
  )
  on conflict (user_id) do update
  set organization_id = excluded.organization_id,
      provisioning_id = excluded.provisioning_id,
      auth_email = excluded.auth_email,
      identity_mode = excluded.identity_mode,
      credential_state = excluded.credential_state,
      requested_lifecycle = excluded.requested_lifecycle,
      credential_version = excluded.credential_version,
      session_valid_after = excluded.session_valid_after,
      provisioned_at = excluded.provisioned_at,
      invalidated_session_id = null,
      pending_operation_id = null,
      operation_source = null,
      reconciliation_auth_changed = false,
      pending_session_id = null,
      pending_credential_version = null,
      operation_previous_state = null,
      operation_previous_lifecycle = null,
      operation_previous_session_valid_after = null;

  select ur.id
  into v_role_id
  from public.user_roles ur
  where ur.user_id = p_auth_user_id
    and ur.role = v_queue.requested_role
    and ur.scope = v_queue.requested_scope
    and ur.organization_id is not distinct from v_org_id
    and ur.division_id is not distinct from v_role_division_id
    and ur.department_id is not distinct from v_role_department_id
    and ur.unit_id is not distinct from v_role_unit_id
  limit 1;

  if v_role_id is null then
    insert into public.user_roles (
      user_id, role, scope, organization_id, division_id,
      department_id, unit_id, is_active, assigned_by
    ) values (
      p_auth_user_id, v_queue.requested_role, v_queue.requested_scope,
      v_org_id, v_role_division_id, v_role_department_id, v_role_unit_id,
      false, p_actor_id
    ) returning id into v_role_id;

    insert into public.role_change_audit (
      organization_id, target_user_id, user_role_id, action,
      new_data, reason, changed_by
    )
    select v_org_id, p_auth_user_id, v_role_id, 'assigned', to_jsonb(ur),
      'Patch 83U protected provisioning; inactive until required password change',
      p_actor_id
    from public.user_roles ur
    where ur.id = v_role_id;
  elsif exists (select 1 from public.user_roles ur where ur.id = v_role_id and ur.is_active) then
    raise exception 'PATCH83U_PROVISIONED_ROLE_MUST_BE_INACTIVE';
  end if;

  update public.user_account_provisioning
  set auth_user_id = p_auth_user_id,
      auth_created_at = coalesce(auth_created_at, clock_timestamp()),
      profile_id = p_auth_user_id,
      provisioning_status = 'initial_change_required',
      lease_expires_at = null,
      attempt_id = null,
      last_error_code = null,
      last_error_message = null
  where id = v_queue.id;

  insert into public.user_credential_events (
    organization_id, user_id, provisioning_id, actor_id, event_type,
    credential_version, request_id, event_code, details
  ) values
  (
    v_org_id, p_auth_user_id, v_queue.id, p_actor_id, 'auth_account_verified',
    1, v_queue.request_id, 'PATCH83U_AUTH_DATABASE_PROOF_VERIFIED',
    jsonb_build_object('auth_user_id', p_auth_user_id)
  ),
  (
    v_org_id, p_auth_user_id, v_queue.id, p_actor_id, 'profile_created_invited',
    1, v_queue.request_id, 'PATCH83U_PROFILE_CREATED_INVITED',
    jsonb_build_object(
      'requested_lifecycle', v_queue.requested_lifecycle,
      'role_id', v_role_id,
      'role_active', false
    )
  );

  return jsonb_build_object(
    'provisioning_id', v_queue.id,
    'profile_id', p_auth_user_id,
    'provisioning_status', 'initial_change_required',
    'credential_state', 'initial_change_required',
    'credential_version', 1,
    'must_change_password', true
  );
end;
$function$;

comment on function public.patch83u_finalize_provisioning(uuid, uuid, uuid, uuid, text) is
'Patch 83U governed provisioning finalizer; P3 correction preserves the exact division reference for division-scoped role assignments.';
