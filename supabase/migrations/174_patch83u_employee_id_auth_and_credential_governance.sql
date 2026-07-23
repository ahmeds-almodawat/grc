-- Patch 83U: Employee-ID authentication and credential governance.
--
-- Additive only. This migration intentionally does not create or update an
-- auth.users password. Supabase Auth administration remains in the authenticated
-- privileged-action Edge bridge. Database functions below record and enforce the
-- server-verified result without persisting a password, credential, bearer value,
-- refresh value, or session secret.

begin;

-- ---------------------------------------------------------------------------
-- Protected credential state and append-only evidence
-- ---------------------------------------------------------------------------

create table if not exists public.patch83u_runtime_control (
  singleton boolean primary key default true check (singleton),
  schema_version text not null default '174.2-auth-first'
    check (schema_version = '174.2-auth-first'),
  enforcement_state text not null default 'disabled' check (enforcement_state in (
    'disabled', 'prepared', 'enforced', 'emergency_suspended'
  )),
  prepared_at timestamptz,
  prepared_by uuid references public.profiles(id) on delete restrict,
  activated_at timestamptz,
  activated_by uuid references public.profiles(id) on delete restrict,
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles(id) on delete restrict,
  activation_reason text,
  last_transition_reason text,
  expected_edge_contract_version text not null default 'patch83u-edge-auth-first-v1'
    check (expected_edge_contract_version = 'patch83u-edge-auth-first-v1'),
  expected_frontend_contract_version text not null default 'patch83u-frontend-auth-first-v1'
    check (expected_frontend_contract_version = 'patch83u-frontend-auth-first-v1'),
  compatible_edge_contract_version text,
  compatible_frontend_contract_version text,
  compatibility_attested_at timestamptz,
  compatibility_attested_by uuid references public.profiles(id) on delete restrict,
  preflight_hash text check (
    preflight_hash is null or preflight_hash ~ '^[0-9a-f]{64}$'
  ),
  designated_super_admin_id uuid references public.profiles(id) on delete restrict,
  last_transition_request_id text,
  state_version integer not null default 0 check (state_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch83u_runtime_prepared_contract check (
    enforcement_state = 'disabled'
    or (
      preflight_hash is not null
      and designated_super_admin_id is not null
      and prepared_at is not null
      and prepared_by is not null
    )
  ),
  constraint patch83u_runtime_enforced_contract check (
    enforcement_state <> 'enforced'
    or (
      activated_at is not null
      and activated_by is not null
      and compatibility_attested_at is not null
      and compatibility_attested_by = designated_super_admin_id
      and compatible_edge_contract_version = expected_edge_contract_version
      and compatible_frontend_contract_version = expected_frontend_contract_version
    )
  )
);

insert into public.patch83u_runtime_control (singleton, enforcement_state)
values (true, 'disabled')
on conflict (singleton) do nothing;

create table if not exists public.patch83u_runtime_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  designated_super_admin_id uuid references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in (
    'prepared', 'compatibility_attested', 'enforced', 'disabled',
    'emergency_suspended'
  )),
  previous_state text not null check (previous_state in (
    'disabled', 'prepared', 'enforced', 'emergency_suspended'
  )),
  resulting_state text not null check (resulting_state in (
    'disabled', 'prepared', 'enforced', 'emergency_suspended'
  )),
  request_id text not null unique check (
    length(request_id) between 1 and 128
    and request_id ~ '^[A-Za-z0-9._:-]+$'
  ),
  confirmation_code text not null check (
    length(confirmation_code) between 1 and 96
    and confirmation_code ~ '^[A-Z0-9_]+$'
  ),
  reason text not null check (length(btrim(reason)) between 1 and 500),
  schema_version text not null,
  edge_contract_version text not null,
  frontend_contract_version text not null,
  preflight_hash text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.user_credential_states (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provisioning_id uuid unique references public.user_account_provisioning(id) on delete set null,
  auth_email text not null,
  identity_mode text not null default 'unverified' check (identity_mode in (
    'legacy_verified', 'employee_id_managed', 'unverified'
  )),
  credential_state text not null default 'active' check (credential_state in (
    'active',
    'existing_password_rotation_pending',
    'existing_password_change_required',
    'initial_change_required',
    'admin_reset_change_required',
    'reactivation_change_required',
    'password_change_in_progress',
    'reset_in_progress',
    'disabled',
    'recovery_required',
    'reconciliation_required',
    'session_revocation_review_required'
  )),
  requested_lifecycle text not null default 'active' check (requested_lifecycle in (
    'active', 'inactive', 'archived', 'invited', 'locked'
  )),
  credential_version integer not null default 0 check (credential_version >= 0),
  session_valid_after timestamptz not null default to_timestamp(0),
  invalidated_session_id uuid,
  role_suspension_id uuid,
  pending_operation_id uuid,
  operation_source text check (operation_source is null or operation_source in (
    'admin_reset', 'password_change'
  )),
  reconciliation_auth_changed boolean not null default false,
  pending_session_id uuid,
  pending_credential_version integer check (
    pending_credential_version is null or pending_credential_version > credential_version
  ),
  operation_previous_state text check (operation_previous_state is null or operation_previous_state in (
    'active',
    'existing_password_rotation_pending',
    'existing_password_change_required',
    'initial_change_required',
    'admin_reset_change_required',
    'reactivation_change_required',
    'disabled',
    'recovery_required',
    'reconciliation_required',
    'session_revocation_review_required'
  )),
  operation_previous_lifecycle text check (operation_previous_lifecycle is null or operation_previous_lifecycle in (
    'active', 'inactive', 'archived', 'invited', 'locked'
  )),
  operation_previous_session_valid_after timestamptz,
  provisioned_at timestamptz,
  password_changed_at timestamptz,
  reset_requested_at timestamptz,
  password_reset_at timestamptz,
  reset_requested_by uuid references public.profiles(id) on delete set null,
  sessions_revoked_at timestamptz,
  reconciliation_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch83u_auth_email_canonical check (
    auth_email = lower(btrim(auth_email))
    and auth_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint patch83u_pending_operation_consistent check (
    (
      credential_state in ('password_change_in_progress', 'reset_in_progress')
      and pending_operation_id is not null
      and pending_credential_version is not null
      and operation_source is not null
    )
    or (
      credential_state not in ('password_change_in_progress', 'reset_in_progress')
      and pending_operation_id is null
      and pending_credential_version is null
      and pending_session_id is null
      and (
        credential_state in (
          'recovery_required', 'reconciliation_required',
          'session_revocation_review_required'
        )
        or operation_source is null
      )
    )
  ),
  constraint patch83u_reconciliation_source_consistent check (
    reconciliation_auth_changed = false
    or (
      credential_state in (
        'recovery_required', 'reconciliation_required',
        'session_revocation_review_required'
      )
      and operation_source is not null
    )
  )
);

create unique index if not exists uq_patch83u_credential_auth_email
on public.user_credential_states (lower(auth_email));

create index if not exists idx_patch83u_credential_org_state
on public.user_credential_states (organization_id, credential_state, updated_at desc);

create table if not exists public.user_credential_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  provisioning_id uuid references public.user_account_provisioning(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'legacy_state_backfilled',
    'provisioning_claimed',
    'provisioning_failed',
    'provisioning_reconciliation_required',
    'provisioning_reconciled',
    'auth_account_verified',
    'profile_created_invited',
    'password_change_started',
    'password_change_completed',
    'password_change_aborted',
    'existing_password_rotation_scheduled',
    'existing_password_rotation_required',
    'admin_reset_started',
    'admin_reset_completed',
    'admin_reset_aborted',
    'roles_suspended',
    'roles_restored',
    'sessions_revoked',
    'session_revocation_review_required',
    'credential_disabled',
    'credential_reactivation_required',
    'credential_reconciled'
  )),
  credential_version integer check (credential_version is null or credential_version >= 0),
  session_id uuid,
  request_id text,
  event_code text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  constraint patch83u_event_request_id_safe check (
    request_id is null or (length(request_id) between 1 and 128 and request_id ~ '^[A-Za-z0-9._:-]+$')
  ),
  constraint patch83u_event_code_safe check (
    event_code is null or (length(event_code) between 1 and 80 and event_code ~ '^[A-Z0-9_]+$')
  )
);

create index if not exists idx_patch83u_events_org_created
on public.user_credential_events (organization_id, created_at desc);

create index if not exists idx_patch83u_events_user_created
on public.user_credential_events (user_id, created_at desc);

create index if not exists idx_patch83u_events_provisioning_created
on public.user_credential_events (provisioning_id, created_at desc);

create table if not exists public.user_credential_suspended_roles (
  id uuid primary key default gen_random_uuid(),
  suspension_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  source_user_role_id uuid references public.user_roles(id) on delete set null,
  role public.app_role not null,
  scope public.access_scope not null,
  role_organization_id uuid references public.organizations(id) on delete restrict,
  division_id uuid references public.divisions(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  suspension_status text not null default 'suspended' check (suspension_status in (
    'suspended', 'restored', 'skipped', 'blocked'
  )),
  suspended_by uuid not null references public.profiles(id) on delete restrict,
  suspended_at timestamptz not null default now(),
  restored_user_role_id uuid references public.user_roles(id) on delete set null,
  restored_at timestamptz,
  restore_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (suspension_id, source_user_role_id),
  constraint patch83u_suspended_role_reference_shape check (
    (scope <> 'division' or division_id is not null)
    and (scope <> 'department' or department_id is not null)
    and (scope <> 'unit' or unit_id is not null)
  ),
  constraint patch83u_restore_error_code_safe check (
    restore_error_code is null or (
      length(restore_error_code) between 1 and 80
      and restore_error_code ~ '^[A-Z0-9_]+$'
    )
  )
);

create table if not exists public.patch83u_credential_operations (
  operation_id uuid primary key default gen_random_uuid(),
  operation_type text not null check (operation_type in ('password_change', 'admin_reset')),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  request_id text not null check (
    length(request_id) between 1 and 128
    and request_id ~ '^[A-Za-z0-9._:-]+$'
  ),
  operation_status text not null default 'prepared' check (operation_status in (
    'prepared', 'in_progress', 'auth_changed', 'completed', 'aborted',
    'recovery_required', 'session_revocation_review_required'
  )),
  current_credential_version integer not null check (current_credential_version >= 0),
  next_credential_version integer not null check (
    next_credential_version = current_credential_version + 1
  ),
  resulting_credential_state text,
  auth_changed boolean not null default false,
  session_revocation_confirmed boolean not null default false,
  safe_result jsonb check (safe_result is null or jsonb_typeof(safe_result) = 'object'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operation_type, actor_id, target_user_id, request_id)
);

create index if not exists idx_patch83u_suspended_roles_operation
on public.user_credential_suspended_roles (suspension_id, suspension_status, id);

create index if not exists idx_patch83u_suspended_roles_user
on public.user_credential_suspended_roles (user_id, suspension_status, suspended_at desc);

alter table public.user_credential_states enable row level security;
alter table public.user_credential_states force row level security;
alter table public.user_credential_events enable row level security;
alter table public.user_credential_events force row level security;
alter table public.user_credential_suspended_roles enable row level security;
alter table public.user_credential_suspended_roles force row level security;
alter table public.patch83u_runtime_control enable row level security;
alter table public.patch83u_runtime_control force row level security;
alter table public.patch83u_runtime_events enable row level security;
alter table public.patch83u_runtime_events force row level security;
alter table public.patch83u_credential_operations enable row level security;
alter table public.patch83u_credential_operations force row level security;

revoke all on table public.user_credential_states from public, anon, authenticated;
revoke all on table public.user_credential_events from public, anon, authenticated;
revoke all on table public.user_credential_suspended_roles from public, anon, authenticated;
revoke all on table public.patch83u_runtime_control from public, anon, authenticated;
revoke all on table public.patch83u_runtime_events from public, anon, authenticated;
revoke all on table public.patch83u_credential_operations from public, anon, authenticated;
revoke all on table public.user_credential_states from service_role;
revoke all on table public.user_credential_events from service_role;
revoke all on table public.user_credential_suspended_roles from service_role;
grant select on table public.user_credential_states to service_role;
revoke all on table public.patch83u_runtime_control from service_role;
revoke all on table public.patch83u_runtime_events from service_role;
revoke all on table public.patch83u_credential_operations from service_role;
grant select on table public.patch83u_runtime_control to service_role;
grant select on table public.patch83u_runtime_events to service_role;
grant select on table public.patch83u_credential_operations to service_role;

comment on table public.user_credential_states is
'Patch 83U authoritative credential state. Contains no password, password digest, bearer value, refresh value, or session secret.';
comment on column public.user_credential_states.identity_mode is
'legacy_verified preserves an existing verified Auth email at credential version 0 without rewriting it; employee_id_managed requires the exact Employee-ID Auth alias; unverified is fail-closed.';
comment on column public.user_credential_states.password_reset_at is
'Completion time of the most recent successfully finalized administrator password reset. Reset requests, failed Auth writes, and aborts never advance this value.';
comment on table public.user_credential_events is
'Patch 83U append-only, non-secret credential and provisioning evidence.';
comment on table public.user_credential_suspended_roles is
'Protected historical role-suspension evidence retained for reconciliation compatibility. Patch 83U credential rotation/reset flows preserve live role rows and do not populate this table.';
comment on table public.patch83u_runtime_control is
'Patch 83U singleton deployment gate. Direct service-role mutation is revoked; audited exact-confirmation SECURITY DEFINER routines are the only runtime mutation path.';
comment on table public.patch83u_runtime_events is
'Patch 83U append-only non-secret runtime transition and compatibility-attestation evidence.';
comment on table public.patch83u_credential_operations is
'Patch 83U no-secret idempotency ledger for password changes and administrator resets. Direct service-role mutation is revoked.';

-- ---------------------------------------------------------------------------
-- Shared validators and guards
-- ---------------------------------------------------------------------------

create or replace function public.patch83u_require_service_role()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'PATCH83U_SERVICE_ROLE_REQUIRED';
  end if;
end;
$$;

create or replace function public.patch83u_auth_credential_version(
  p_raw_app_metadata jsonb
)
returns integer
language plpgsql
immutable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_version_text text;
begin
  -- Legacy Auth users predate credential-version metadata. Absence alone maps to
  -- version 0; an explicitly present value must be a valid non-negative integer.
  -- This never treats malformed or overflowing metadata as a legacy version.
  if p_raw_app_metadata is not null
    and jsonb_typeof(p_raw_app_metadata) <> 'object'
  then
    return null;
  end if;
  if not (coalesce(p_raw_app_metadata, '{}'::jsonb) ? 'credential_version') then
    return 0;
  end if;

  v_version_text := p_raw_app_metadata ->> 'credential_version';
  if v_version_text is null or v_version_text !~ '^[0-9]+$' then
    return null;
  end if;

  begin
    return v_version_text::integer;
  exception when numeric_value_out_of_range then
    return null;
  end;
end;
$$;

create or replace function public.patch83u_runtime_enforcement_state()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select rc.enforcement_state
  from public.patch83u_runtime_control rc
  where rc.singleton = true
$$;

create or replace function public.patch83u_require_enforced_runtime()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if public.patch83u_runtime_enforcement_state() is distinct from 'enforced' then
    raise exception 'PATCH83U_RUNTIME_NOT_ENFORCED';
  end if;
end;
$$;

create or replace function public.patch83u_runtime_credential_state_allowed(
  p_credential_state text,
  p_identity_mode text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce(case public.patch83u_runtime_enforcement_state()
    when 'disabled' then true
    when 'prepared' then true
    when 'emergency_suspended' then
      p_identity_mode = 'legacy_verified'
      and p_credential_state <> 'disabled'
    when 'enforced' then
      p_credential_state = 'active'
      and p_identity_mode in ('employee_id_managed', 'legacy_verified')
    else false
  end, false)
$$;

create or replace function public.patch83u_request_frontend_contract_compatible()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_headers jsonb;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return false;
  end;

  return coalesce(v_headers ->> 'x-patch83u-frontend-contract-version', '')
    = 'patch83u-frontend-auth-first-v1';
end;
$$;

-- Define canonical role helpers before every SQL-language eligibility caller.
-- With check_function_bodies enabled, forward references would make migration
-- 174 fail before the later credential-governance objects can be created.
create or replace function public.patch83u_role_scope_allowed(
  p_role public.app_role,
  p_scope public.access_scope
)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce(case
    when p_role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')
      then p_scope = 'global'
    when p_role = 'division_head'
      then p_scope = 'division'
    when p_role = 'department_manager'
      then p_scope = 'department'
    when p_role in ('project_owner', 'milestone_owner', 'task_owner', 'viewer', 'employee')
      then p_scope = 'assigned_only'
    else false
  end, false);
$$;

create or replace function public.patch83u_role_assignment_valid(
  p_organization_id uuid,
  p_scope public.access_scope,
  p_role_organization_id uuid,
  p_division_id uuid,
  p_department_id uuid,
  p_unit_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_organization_id is null or p_scope is null then
    return false;
  end if;

  if p_scope = 'global' then
    -- Preserve the canonical legacy global-role convention used by
    -- patch83u_require_super_admin and Patch 83T: organization_id may be NULL
    -- or the actor's exact organization, but hierarchy references stay empty.
    return (p_role_organization_id is null or p_role_organization_id = p_organization_id)
      and p_division_id is null
      and p_department_id is null
      and p_unit_id is null;
  end if;

  -- Every non-global scope remains strictly organization-bound.
  if p_role_organization_id is distinct from p_organization_id then
    return false;
  end if;

  if p_scope = 'division' then
    return p_division_id is not null
      and p_department_id is null
      and p_unit_id is null
      and exists (
        select 1 from public.divisions d
        where d.id = p_division_id
          and d.organization_id = p_organization_id
          and d.is_active = true
      );
  elsif p_scope = 'department' then
    return p_department_id is not null
      and p_unit_id is null
      and exists (
        select 1 from public.departments d
        where d.id = p_department_id
          and d.organization_id = p_organization_id
          and d.is_active = true
          and d.archived_at is null
          and (p_division_id is null or d.division_id = p_division_id)
      );
  elsif p_scope = 'unit' then
    return p_unit_id is not null
      and p_department_id is not null
      and exists (
        select 1
        from public.units u
        join public.departments d on d.id = u.department_id
        where u.id = p_unit_id
          and u.organization_id = p_organization_id
          and u.is_active = true
          and d.id = p_department_id
          and d.organization_id = p_organization_id
          and d.is_active = true
          and d.archived_at is null
          and (p_division_id is null or d.division_id = p_division_id)
      );
  end if;

  return p_scope = 'assigned_only'
    and p_division_id is null
    and p_department_id is null
    and p_unit_id is null;
end;
$$;

create or replace function public.patch83u_bootstrap_super_admin_eligible(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.user_credential_states cs on cs.user_id = p.id
    join auth.users u on u.id = p.id
    where p.id = p_user_id
      and p.organization_id is not null
      and p.is_active = true
      and p.user_status = 'active'
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        p.organization_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
      and cs.organization_id = p.organization_id
      and cs.identity_mode = 'legacy_verified'
      and cs.credential_state in (
        'active', 'existing_password_rotation_pending',
        'existing_password_change_required', 'password_change_in_progress'
      )
      and nullif(btrim(u.email), '') is not null
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and lower(btrim(u.email)) = cs.auth_email
      and public.patch83u_auth_credential_version(u.raw_app_meta_data) = cs.credential_version
      and 1 = (
        select count(*) from auth.identities ai
        where ai.user_id = u.id and ai.provider = 'email'
      )
      and exists (
        select 1
        from auth.identities ai
        where ai.user_id = u.id
          and ai.provider = 'email'
          and lower(btrim(coalesce(ai.identity_data ->> 'email', ''))) = lower(btrim(u.email))
      )
  )
$$;

create or replace function public.patch83u_runtime_activation_blockers(
  p_designated_super_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_employee_id_collisions bigint;
  v_synthetic_email_collisions bigint;
  v_invalid_active_role_assignments bigint;
  v_invalid_profile_lifecycle_rows bigint;
  v_orgs_without_bootstrap bigint;
  v_designated_eligible boolean;
begin
  perform public.patch83u_require_service_role();

  select count(*)::bigint into v_employee_id_collisions
  from (
    select lower(btrim(p.employee_no))
    from public.profiles p
    where nullif(btrim(p.employee_no), '') is not null
    group by lower(btrim(p.employee_no))
    having count(*) > 1
  ) collisions;

  select count(*)::bigint into v_synthetic_email_collisions
  from public.profiles p
  join auth.users u
    on lower(btrim(u.email)) = lower(btrim(p.employee_no)) || '@almodawat.sa'
   and u.id <> p.id
  where nullif(btrim(p.employee_no), '') is not null;

  select count(*)::bigint into v_invalid_active_role_assignments
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

  select count(*)::bigint into v_invalid_profile_lifecycle_rows
  from public.profiles p
  where p.user_status not in ('active', 'inactive', 'archived', 'invited', 'locked')
    or p.is_active is distinct from (p.user_status in ('active', 'invited'))
    or (
      p.user_status in ('active', 'invited')
      and (
        p.deactivated_at is not null
        or p.deactivated_by is not null
        or p.deactivation_reason is not null
      )
    )
    or (
      p.user_status in ('inactive', 'archived', 'locked')
      and (
        p.deactivated_at is null
        or p.deactivated_by is null
        or nullif(btrim(coalesce(p.deactivation_reason, '')), '') is null
        or not exists (
          select 1
          from public.profiles deactivation_actor
          where deactivation_actor.id = p.deactivated_by
            and deactivation_actor.organization_id = p.organization_id
        )
      )
    );

  select count(*)::bigint into v_orgs_without_bootstrap
  from public.organizations o
  where not exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.user_credential_states cs on cs.user_id = p.id
    join auth.users u on u.id = p.id
    where p.organization_id = o.id
      and p.is_active = true
      and p.user_status = 'active'
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        p.organization_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
      and cs.organization_id = p.organization_id
      and cs.identity_mode = 'legacy_verified'
      and cs.credential_state in (
        'active', 'existing_password_rotation_pending',
        'existing_password_change_required', 'password_change_in_progress'
      )
      and nullif(btrim(u.email), '') is not null
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and lower(btrim(u.email)) = cs.auth_email
      and public.patch83u_auth_credential_version(u.raw_app_meta_data) = cs.credential_version
      and 1 = (
        select count(*) from auth.identities ai
        where ai.user_id = u.id and ai.provider = 'email'
      )
      and exists (
        select 1 from auth.identities ai
        where ai.user_id = u.id
          and ai.provider = 'email'
          and lower(btrim(coalesce(ai.identity_data ->> 'email', ''))) = lower(btrim(u.email))
      )
  );

  v_designated_eligible := public.patch83u_bootstrap_super_admin_eligible(
    p_designated_super_admin_id
  );

  return jsonb_build_object(
    'blocking_count',
      v_employee_id_collisions + v_synthetic_email_collisions
      + v_invalid_active_role_assignments + v_invalid_profile_lifecycle_rows
      + v_orgs_without_bootstrap
      + case when v_designated_eligible then 0 else 1 end,
    'employee_id_collision_groups', v_employee_id_collisions,
    'synthetic_email_collisions', v_synthetic_email_collisions,
    'invalid_active_role_assignments', v_invalid_active_role_assignments,
    'invalid_profile_lifecycle_rows', v_invalid_profile_lifecycle_rows,
    'organizations_without_eligible_bootstrap_super_admin', v_orgs_without_bootstrap,
    'designated_super_admin_eligible', v_designated_eligible
  );
end;
$$;

create or replace function public.patch83u_break_glass_super_admin_eligible(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_credential_states cs on cs.user_id = p.id
    join public.user_roles ur on ur.user_id = p.id
    join auth.users u on u.id = p.id
    where p.id = p_user_id
      and p.organization_id is not null
      and p.is_active = true
      and p.user_status = 'active'
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        p.organization_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
      and cs.organization_id = p.organization_id
      and cs.identity_mode = 'legacy_verified'
      and cs.credential_state <> 'disabled'
      and nullif(btrim(u.email), '') is not null
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and lower(btrim(u.email)) = cs.auth_email
      and public.patch83u_auth_credential_version(u.raw_app_meta_data) = cs.credential_version
      and 1 = (
        select count(*) from auth.identities ai
        where ai.user_id = u.id and ai.provider = 'email'
      )
      and exists (
        select 1 from auth.identities ai
        where ai.user_id = u.id
          and ai.provider = 'email'
          and lower(btrim(coalesce(ai.identity_data ->> 'email', '')))
            = lower(btrim(u.email))
      )
  )
$$;

create or replace function public.patch83u_effective_super_admin_eligible(
  p_user_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_credential_states cs on cs.user_id = p.id
    join public.user_roles ur on ur.user_id = p.id
    join auth.users u on u.id = p.id
    where p.id = p_user_id
      and p.organization_id = p_organization_id
      and p.is_active = true
      and p.user_status = 'active'
      and cs.organization_id = p.organization_id
      and cs.credential_state = 'active'
      and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        p.organization_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
      and nullif(btrim(u.email), '') is not null
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and lower(btrim(u.email)) = cs.auth_email
      and public.patch83u_auth_credential_version(u.raw_app_meta_data) = cs.credential_version
      and 1 = (
        select count(*) from auth.identities ai
        where ai.user_id = u.id and ai.provider = 'email'
      )
      and 1 = (
        select count(*) from auth.identities ai
        where ai.user_id = u.id
          and ai.provider = 'email'
          and lower(btrim(coalesce(ai.identity_data ->> 'email', '')))
            = lower(btrim(u.email))
      )
  )
$$;

create or replace function public.patch83u_runtime_super_admin_eligible(
  p_user_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select case public.patch83u_runtime_enforcement_state()
    when 'disabled' then
      public.patch83u_bootstrap_super_admin_eligible(p_user_id)
      and exists (
        select 1 from public.profiles p
        where p.id = p_user_id and p.organization_id = p_organization_id
      )
    when 'prepared' then
      public.patch83u_bootstrap_super_admin_eligible(p_user_id)
      and exists (
        select 1 from public.profiles p
        where p.id = p_user_id and p.organization_id = p_organization_id
      )
    when 'enforced' then
      public.patch83u_effective_super_admin_eligible(p_user_id, p_organization_id)
    when 'emergency_suspended' then
      public.patch83u_break_glass_super_admin_eligible(p_user_id)
      and exists (
        select 1 from public.profiles p
        where p.id = p_user_id and p.organization_id = p_organization_id
      )
    else false
  end
$$;

create or replace function public.patch83u_transition_runtime(
  p_actor_id uuid,
  p_target_state text,
  p_request_id text,
  p_reason text,
  p_confirmation text,
  p_preflight_hash text,
  p_designated_super_admin_id uuid,
  p_edge_contract_version text,
  p_frontend_contract_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_runtime public.patch83u_runtime_control%rowtype;
  v_existing public.patch83u_runtime_events%rowtype;
  v_expected_confirmation text;
  v_blockers jsonb;
  v_now timestamptz := clock_timestamp();
begin
  perform public.patch83u_require_service_role();

  if p_target_state is null
    or p_target_state not in ('disabled', 'prepared', 'enforced', 'emergency_suspended')
  then
    raise exception 'PATCH83U_RUNTIME_TARGET_STATE_INVALID';
  end if;
  if nullif(btrim(coalesce(p_request_id, '')), '') is null
    or length(p_request_id) > 128
    or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'PATCH83U_REQUEST_ID_INVALID';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null or length(btrim(p_reason)) > 500 then
    raise exception 'PATCH83U_RUNTIME_REASON_INVALID';
  end if;

  v_expected_confirmation := case p_target_state
    when 'prepared' then 'PATCH83U_PREPARE_CREDENTIAL_GOVERNANCE'
    when 'enforced' then 'PATCH83U_ENFORCE_CREDENTIAL_GOVERNANCE'
    when 'disabled' then 'PATCH83U_DISABLE_CREDENTIAL_GOVERNANCE'
    when 'emergency_suspended' then 'PATCH83U_EMERGENCY_SUSPEND_CREDENTIAL_GOVERNANCE'
  end;
  if p_confirmation is distinct from v_expected_confirmation then
    raise exception 'PATCH83U_RUNTIME_CONFIRMATION_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('patch83u-runtime-control', 0)
  );
  select * into v_runtime
  from public.patch83u_runtime_control
  where singleton = true
  for update;
  if v_runtime.singleton is null then
    raise exception 'PATCH83U_RUNTIME_CONTROL_MISSING';
  end if;

  select * into v_existing
  from public.patch83u_runtime_events e
  where e.request_id = p_request_id;
  if v_existing.id is not null then
    if v_existing.actor_id = p_actor_id
      and v_existing.event_type = p_target_state
      and v_existing.resulting_state = p_target_state
      and v_existing.confirmation_code = v_expected_confirmation
      and v_existing.reason = btrim(p_reason)
      and v_existing.designated_super_admin_id is not distinct from p_designated_super_admin_id
      and v_existing.preflight_hash is not distinct from p_preflight_hash
      and v_existing.edge_contract_version = p_edge_contract_version
      and v_existing.frontend_contract_version = p_frontend_contract_version
      and jsonb_typeof(v_existing.details -> 'resulting_state_version') = 'number'
      and (v_existing.details ->> 'resulting_state_version') ~ '^[0-9]+$'
    then
      return jsonb_build_object(
        'enforcement_state', v_existing.resulting_state,
        'schema_version', v_existing.schema_version,
        'state_version', (v_existing.details ->> 'resulting_state_version')::integer,
        'idempotent_replay', true
      );
    end if;
    raise exception 'PATCH83U_REQUEST_ID_CONFLICT';
  end if;

  if p_target_state in ('prepared', 'enforced') then
    if p_actor_id is distinct from p_designated_super_admin_id
      or not public.patch83u_bootstrap_super_admin_eligible(p_actor_id)
    then
      raise exception 'PATCH83U_DESIGNATED_SUPER_ADMIN_REQUIRED';
    end if;
  else
    -- Break-glass suspension/disable remains service-only, exact-confirmation,
    -- and append-only audited, but it must not depend on the actor's current
    -- credential state. A locked designated bootstrap administrator can still
    -- suspend enforcement; otherwise another structurally verified global
    -- Super Admin can perform the same fail-safe transition.
    if p_designated_super_admin_id is distinct from v_runtime.designated_super_admin_id
      or not (
        p_actor_id is not distinct from v_runtime.designated_super_admin_id
        or public.patch83u_break_glass_super_admin_eligible(p_actor_id)
      )
    then
      raise exception 'PATCH83U_BREAK_GLASS_SUPER_ADMIN_REQUIRED';
    end if;
  end if;
  if p_edge_contract_version is distinct from v_runtime.expected_edge_contract_version then
    raise exception 'PATCH83U_EDGE_CONTRACT_MISMATCH';
  end if;
  if p_frontend_contract_version is distinct from v_runtime.expected_frontend_contract_version then
    raise exception 'PATCH83U_FRONTEND_CONTRACT_MISMATCH';
  end if;

  if p_target_state in ('prepared', 'enforced') then
    if coalesce(p_preflight_hash, '') !~ '^[0-9a-f]{64}$' then
      raise exception 'PATCH83U_PREFLIGHT_HASH_INVALID';
    end if;
    v_blockers := public.patch83u_runtime_activation_blockers(p_designated_super_admin_id);
    if coalesce((v_blockers ->> 'blocking_count')::bigint, 1) <> 0 then
      raise exception 'PATCH83U_RUNTIME_ACTIVATION_BLOCKED';
    end if;
  end if;

  if p_target_state = 'prepared' then
    if v_runtime.enforcement_state not in ('disabled', 'prepared', 'emergency_suspended') then
      raise exception 'PATCH83U_RUNTIME_TRANSITION_INVALID';
    end if;
    update public.patch83u_runtime_control
    set enforcement_state = 'prepared',
        prepared_at = v_now,
        prepared_by = p_actor_id,
        activated_at = null,
        activated_by = null,
        activation_reason = btrim(p_reason),
        last_transition_reason = btrim(p_reason),
        preflight_hash = p_preflight_hash,
        designated_super_admin_id = p_designated_super_admin_id,
        compatible_edge_contract_version = null,
        compatible_frontend_contract_version = null,
        compatibility_attested_at = null,
        compatibility_attested_by = null,
        last_transition_request_id = p_request_id,
        state_version = state_version + 1,
        updated_at = v_now
    where singleton = true;
  elsif p_target_state = 'enforced' then
    if v_runtime.enforcement_state <> 'prepared'
      or v_runtime.preflight_hash is distinct from p_preflight_hash
      or v_runtime.designated_super_admin_id is distinct from p_designated_super_admin_id
      or v_runtime.compatibility_attested_by is distinct from p_designated_super_admin_id
      or v_runtime.compatibility_attested_at is null
      or v_runtime.compatible_edge_contract_version is distinct from v_runtime.expected_edge_contract_version
      or v_runtime.compatible_frontend_contract_version is distinct from v_runtime.expected_frontend_contract_version
    then
      raise exception 'PATCH83U_RUNTIME_NOT_PREPARED';
    end if;
    update public.patch83u_runtime_control
    set enforcement_state = 'enforced',
        activated_at = v_now,
        activated_by = p_actor_id,
        deactivated_at = null,
        deactivated_by = null,
        activation_reason = btrim(p_reason),
        last_transition_reason = btrim(p_reason),
        last_transition_request_id = p_request_id,
        state_version = state_version + 1,
        updated_at = v_now
    where singleton = true;
  elsif p_target_state = 'emergency_suspended' then
    if v_runtime.enforcement_state not in ('prepared', 'enforced', 'emergency_suspended') then
      raise exception 'PATCH83U_RUNTIME_TRANSITION_INVALID';
    end if;
    update public.patch83u_runtime_control
    set enforcement_state = 'emergency_suspended',
        deactivated_at = v_now,
        deactivated_by = p_actor_id,
        last_transition_reason = btrim(p_reason),
        last_transition_request_id = p_request_id,
        state_version = state_version + 1,
        updated_at = v_now
    where singleton = true;
  else
    update public.patch83u_runtime_control
    set enforcement_state = 'disabled',
        deactivated_at = v_now,
        deactivated_by = p_actor_id,
        last_transition_reason = btrim(p_reason),
        last_transition_request_id = p_request_id,
        state_version = state_version + 1,
        updated_at = v_now
    where singleton = true;
  end if;

  insert into public.patch83u_runtime_events (
    actor_id, designated_super_admin_id, event_type, previous_state,
    resulting_state, request_id, confirmation_code, reason, schema_version,
    edge_contract_version, frontend_contract_version, preflight_hash, details
  ) values (
    p_actor_id, p_designated_super_admin_id, p_target_state,
    v_runtime.enforcement_state, p_target_state, p_request_id,
    v_expected_confirmation, btrim(p_reason), v_runtime.schema_version,
    p_edge_contract_version, p_frontend_contract_version, p_preflight_hash,
    coalesce(v_blockers, '{}'::jsonb) || jsonb_build_object(
      'resulting_state_version', v_runtime.state_version + 1
    )
  );

  return jsonb_build_object(
    'enforcement_state', p_target_state,
    'schema_version', v_runtime.schema_version,
    'state_version', v_runtime.state_version + 1,
    'idempotent_replay', false
  );
end;
$$;

create or replace function public.patch83u_get_capabilities(
  p_actor_id uuid,
  p_edge_contract_version text,
  p_frontend_contract_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_runtime public.patch83u_runtime_control%rowtype;
  v_compatible boolean;
  v_status text;
  v_request_id text;
  v_snapshot_state_version integer;
  v_now timestamptz := clock_timestamp();
begin
  perform public.patch83u_require_service_role();
  if p_actor_id is null or not exists (
    select 1 from auth.users u where u.id = p_actor_id
  ) then
    raise exception 'PATCH83U_AUTHENTICATED_ACTOR_REQUIRED';
  end if;

  select * into v_runtime
  from public.patch83u_runtime_control
  where singleton = true;
  if v_runtime.singleton is null then
    raise exception 'PATCH83U_RUNTIME_CONTROL_MISSING';
  end if;
  v_snapshot_state_version := v_runtime.state_version;

  v_compatible := p_edge_contract_version is not distinct from v_runtime.expected_edge_contract_version
    and p_frontend_contract_version is not distinct from v_runtime.expected_frontend_contract_version;
  v_status := case
    when p_edge_contract_version is distinct from v_runtime.expected_edge_contract_version
      then 'edge_contract_mismatch'
    when p_frontend_contract_version is distinct from v_runtime.expected_frontend_contract_version
      then 'frontend_contract_mismatch'
    else 'compatible'
  end;

  if v_runtime.enforcement_state = 'prepared'
    and v_compatible
    and p_actor_id = v_runtime.designated_super_admin_id
    and public.patch83u_bootstrap_super_admin_eligible(p_actor_id)
  then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('patch83u-runtime-control', 0)
    );
    select * into v_runtime
    from public.patch83u_runtime_control
    where singleton = true
    for update;

    -- Revalidate the snapshot after the narrow attestation lock. A concurrent
    -- transition wins; this capability read must not attest a different state.
    if v_runtime.enforcement_state = 'prepared'
      and v_runtime.state_version = v_snapshot_state_version
      and p_actor_id = v_runtime.designated_super_admin_id
      and p_edge_contract_version is not distinct from v_runtime.expected_edge_contract_version
      and p_frontend_contract_version is not distinct from v_runtime.expected_frontend_contract_version
      and public.patch83u_bootstrap_super_admin_eligible(p_actor_id)
      and (
        v_runtime.compatibility_attested_by is distinct from p_actor_id
        or v_runtime.compatible_edge_contract_version is distinct from p_edge_contract_version
        or v_runtime.compatible_frontend_contract_version is distinct from p_frontend_contract_version
        or v_runtime.compatibility_attested_at is null
      )
    then
      update public.patch83u_runtime_control
      set compatible_edge_contract_version = p_edge_contract_version,
          compatible_frontend_contract_version = p_frontend_contract_version,
          compatibility_attested_at = v_now,
          compatibility_attested_by = p_actor_id,
          updated_at = v_now
      where singleton = true;

      v_request_id := 'capability:' || p_actor_id::text || ':' || v_runtime.state_version::text;
      insert into public.patch83u_runtime_events (
        actor_id, designated_super_admin_id, event_type, previous_state,
        resulting_state, request_id, confirmation_code, reason, schema_version,
        edge_contract_version, frontend_contract_version, preflight_hash, details
      ) values (
        p_actor_id, v_runtime.designated_super_admin_id, 'compatibility_attested',
        'prepared', 'prepared', v_request_id, 'PATCH83U_COMPATIBILITY_ATTESTED',
        'Prepared deployment contract compatibility attested.',
        v_runtime.schema_version, p_edge_contract_version,
        p_frontend_contract_version, v_runtime.preflight_hash,
        jsonb_build_object('state_version', v_runtime.state_version)
      ) on conflict (request_id) do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'edge_contract_version', 'patch83u-edge-auth-first-v1',
    'installed_schema_version', 174,
    'runtime_enforcement_state', v_runtime.enforcement_state,
    'credential_state_action_available', true,
    'password_change_action_available', v_runtime.enforcement_state = 'enforced' and v_compatible,
    'provisioning_action_available', v_runtime.enforcement_state = 'enforced' and v_compatible,
    'reset_action_available', v_runtime.enforcement_state = 'enforced' and v_compatible,
    'server_time', v_now,
    'compatibility_status', v_status
  );
end;
$$;

create or replace function public.patch83u_confirm_session_revocation(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_state public.user_credential_states%rowtype;
  v_actor_org_id uuid;
begin
  perform public.patch83u_require_service_role();
  if nullif(btrim(coalesce(p_request_id, '')), '') is null
    or length(p_request_id) > 128
    or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'PATCH83U_REQUEST_ID_INVALID';
  end if;

  if p_actor_id <> p_target_user_id then
    v_actor_org_id := public.patch83u_require_super_admin(p_actor_id);
  end if;

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_target_user_id
    and (v_actor_org_id is null or cs.organization_id = v_actor_org_id)
  for update;

  if v_state.user_id is null then
    raise exception 'PATCH83U_CREDENTIAL_STATE_NOT_FOUND';
  end if;
  if exists (select 1 from auth.sessions s where s.user_id = p_target_user_id) then
    raise exception 'PATCH83U_AUTH_SESSIONS_STILL_ACTIVE';
  end if;

  update public.user_credential_states
  set sessions_revoked_at = clock_timestamp()
  where user_id = p_target_user_id;

  insert into public.user_credential_events (
    organization_id, user_id, provisioning_id, actor_id, event_type,
    credential_version, request_id, event_code, details
  ) values (
    v_state.organization_id, p_target_user_id, v_state.provisioning_id,
    p_actor_id, 'sessions_revoked', v_state.credential_version,
    btrim(p_request_id), 'PATCH83U_AUTH_SESSION_REVOCATION_CONFIRMED',
    jsonb_build_object('database_proof', 'no_auth_sessions_rows')
  );

  return jsonb_build_object(
    'user_id', p_target_user_id,
    'sessions_revoked', true,
    'confirmed_at', clock_timestamp()
  );
end;
$$;

create or replace function public.patch83u_begin_admin_reset(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_request_id text,
  p_employee_id_confirmation text,
  p_reason text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_profile public.profiles%rowtype;
  v_state public.user_credential_states%rowtype;
  v_existing_operation public.patch83u_credential_operations%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_active_super_admin_count integer := 0;
  v_target_is_active_super_admin boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  perform public.patch83u_require_enforced_runtime();
  v_org_id := public.patch83u_require_super_admin(p_actor_id);

  if p_confirmation is distinct from 'PATCH83U_RESET_USER_PASSWORD' then
    raise exception 'PATCH83U_RESET_CONFIRMATION_REQUIRED';
  end if;
  if p_target_user_id = p_actor_id then
    raise exception 'PATCH83U_SELF_RESET_DENIED';
  end if;
  if nullif(btrim(coalesce(p_request_id, '')), '') is null
    or length(p_request_id) > 128
    or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'PATCH83U_REQUEST_ID_INVALID';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null or length(p_reason) > 500 then
    raise exception 'PATCH83U_RESET_REASON_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('patch83u-super-admin-eligibility:' || v_org_id::text, 0)
  );

  select p.* into v_profile
  from public.profiles p
  where p.id = p_target_user_id
    and p.organization_id = v_org_id
  for update;

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_target_user_id
    and cs.organization_id = v_org_id
  for update;

  if v_profile.id is null or v_state.user_id is null then
    raise exception 'PATCH83U_RESET_TARGET_NOT_FOUND';
  end if;
  if nullif(btrim(coalesce(v_profile.employee_no, '')), '') is null
    or p_employee_id_confirmation is distinct from v_profile.employee_no
  then
    raise exception 'PATCH83U_EMPLOYEE_ID_CONFIRMATION_REQUIRED';
  end if;

  select op.* into v_existing_operation
  from public.patch83u_credential_operations op
  where op.operation_type = 'admin_reset'
    and op.actor_id = p_actor_id
    and op.target_user_id = p_target_user_id
    and op.request_id = p_request_id
  for update;
  if v_existing_operation.operation_id is not null then
    if v_existing_operation.operation_status = 'aborted' then
      raise exception 'PATCH83U_ADMIN_RESET_REQUEST_ALREADY_ABORTED';
    end if;
    return jsonb_build_object(
      'operation_id', v_existing_operation.operation_id,
      'request_id', v_existing_operation.request_id,
      'user_id', p_target_user_id,
      'auth_email', v_state.auth_email,
      'current_credential_version', v_existing_operation.current_credential_version,
      'next_credential_version', v_existing_operation.next_credential_version,
      'credential_version', coalesce(
        v_existing_operation.safe_result -> 'credential_version',
        to_jsonb(v_existing_operation.current_credential_version)
      ),
      'result_status', case when v_existing_operation.safe_result is not null
        then coalesce(
          v_existing_operation.safe_result ->> 'credential_state',
          v_existing_operation.resulting_credential_state
        )
        else v_existing_operation.operation_status
      end,
      'completed', v_existing_operation.operation_status in (
        'completed', 'recovery_required', 'session_revocation_review_required'
      ),
      'reconciliation_required', coalesce(
        v_existing_operation.safe_result -> 'reconciliation_required',
        'false'::jsonb
      ),
      'session_revocation_review_required', coalesce(
        v_existing_operation.safe_result -> 'session_revocation_review_required',
        'false'::jsonb
      ),
      'idempotent_replay', true
    );
  end if;
  if v_profile.user_status not in ('active', 'invited') or v_profile.is_active = false then
    raise exception 'PATCH83U_RESET_TARGET_LIFECYCLE_INVALID';
  end if;
  if v_state.identity_mode not in ('employee_id_managed', 'legacy_verified') then
    raise exception 'PATCH83U_RESET_IDENTITY_NOT_VERIFIED';
  end if;
  if v_state.credential_state not in (
    'active', 'existing_password_rotation_pending',
    'existing_password_change_required', 'initial_change_required',
    'admin_reset_change_required', 'reactivation_change_required',
    'recovery_required',
    'reconciliation_required', 'session_revocation_review_required'
  ) then
    raise exception 'PATCH83U_RESET_CREDENTIAL_STATE_INVALID';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = p_target_user_id
      and lower(btrim(u.email)) = v_state.auth_email
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and public.patch83u_auth_credential_version(u.raw_app_meta_data) = v_state.credential_version
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
  ) then
    raise exception 'PATCH83U_RESET_AUTH_DATABASE_PROOF_FAILED';
  end if;
  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_target_user_id
      and ur.is_active = true
      and not public.patch83u_role_assignment_valid(
        v_org_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
  ) then
    raise exception 'PATCH83U_ACTIVE_ROLE_REFERENCE_INVALID';
  end if;

  -- Serialize administrator credential resets with Patch 83U's eligibility
  -- calculation and lock all currently effective Super Admin identities before
  -- the target credential is locked. A password reset must not make the
  -- organization's final usable Super Admin ineffective.
  perform 1
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join public.user_credential_states cs on cs.user_id = p.id
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and public.patch83u_role_assignment_valid(
      v_org_id, ur.scope, ur.organization_id,
      ur.division_id, ur.department_id, ur.unit_id
    )
    and p.organization_id = v_org_id
    and p.is_active = true
    and p.user_status = 'active'
    and cs.organization_id = v_org_id
    and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
    and cs.credential_state = 'active'
    and public.patch83u_effective_super_admin_eligible(ur.user_id, v_org_id)
  for update of ur, p, cs;

  select count(distinct ur.user_id)::integer,
         coalesce(bool_or(ur.user_id = p_target_user_id), false)
  into v_active_super_admin_count, v_target_is_active_super_admin
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join public.user_credential_states cs on cs.user_id = p.id
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and public.patch83u_role_assignment_valid(
      v_org_id, ur.scope, ur.organization_id,
      ur.division_id, ur.department_id, ur.unit_id
    )
    and p.organization_id = v_org_id
    and p.is_active = true
    and p.user_status = 'active'
    and cs.organization_id = v_org_id
    and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
    and cs.credential_state = 'active'
    and public.patch83u_effective_super_admin_eligible(ur.user_id, v_org_id);

  if v_target_is_active_super_admin and v_active_super_admin_count <= 1 then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_RESET_DENIED';
  end if;

  -- Reset state makes normal access ineffective while preserving every existing
  -- role assignment and the profile lifecycle. The role becomes effective again
  -- only after the credential state is safely completed.
  insert into public.patch83u_credential_operations (
    operation_id, operation_type, organization_id, actor_id, target_user_id,
    request_id, operation_status, current_credential_version,
    next_credential_version
  ) values (
    v_operation_id, 'admin_reset', v_org_id, p_actor_id, p_target_user_id,
    p_request_id, 'in_progress', v_state.credential_version,
    v_state.credential_version + 1
  );

  update public.user_credential_states
  set credential_state = 'reset_in_progress',
      requested_lifecycle = v_state.requested_lifecycle,
      session_valid_after = v_now,
      role_suspension_id = null,
      pending_operation_id = v_operation_id,
      operation_source = 'admin_reset',
      reconciliation_auth_changed = false,
      pending_session_id = null,
      pending_credential_version = v_state.credential_version + 1,
      operation_previous_state = v_state.credential_state,
      operation_previous_lifecycle = v_profile.user_status,
      operation_previous_session_valid_after = v_state.session_valid_after,
      reset_requested_at = clock_timestamp(),
      reset_requested_by = p_actor_id
  where user_id = p_target_user_id;

  insert into public.user_credential_events (
    organization_id, user_id, provisioning_id, actor_id, event_type,
    credential_version, request_id, event_code, details
  ) values (
    v_org_id, p_target_user_id, v_state.provisioning_id, p_actor_id,
    'admin_reset_started', v_state.credential_version, btrim(p_request_id),
    'PATCH83U_ADMIN_RESET_STARTED',
    jsonb_build_object(
      'operation_id', v_operation_id,
      'next_credential_version', v_state.credential_version + 1,
      'reason', btrim(p_reason)
    )
  );

  -- Server-only result. The manually entered temporary password never crosses
  -- this RPC boundary and is never persisted in public schema data.
  return jsonb_build_object(
    'operation_id', v_operation_id,
    'request_id', p_request_id,
    'user_id', p_target_user_id,
    'auth_email', v_state.auth_email,
    'current_credential_version', v_state.credential_version,
    'next_credential_version', v_state.credential_version + 1,
    'credential_version', v_state.credential_version,
    'result_status', 'in_progress',
    'completed', false,
    'reconciliation_required', false,
    'session_revocation_review_required', false,
    'idempotent_replay', false
  );
end;
$$;

create or replace function public.patch83u_admin_reset_session_revocation_proof(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_operation_id uuid,
  p_request_id text,
  p_applied_credential_version integer,
  p_verified_auth_email text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_state public.user_credential_states%rowtype;
  v_operation public.patch83u_credential_operations%rowtype;
  v_sessions_revoked boolean;
begin
  perform public.patch83u_require_enforced_runtime();
  v_org_id := public.patch83u_require_super_admin(p_actor_id);

  if p_target_user_id = p_actor_id
    or nullif(btrim(coalesce(p_request_id, '')), '') is null
    or length(p_request_id) > 128
    or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'PATCH83U_ADMIN_RESET_SESSION_PROOF_INVALID';
  end if;

  select op.* into v_operation
  from public.patch83u_credential_operations op
  where op.operation_id = p_operation_id
    and op.operation_type = 'admin_reset'
    and op.organization_id = v_org_id
    and op.actor_id = p_actor_id
    and op.target_user_id = p_target_user_id
    and op.request_id = p_request_id;

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_target_user_id
    and cs.organization_id = v_org_id;

  if v_operation.operation_id is null
    or v_operation.operation_status <> 'in_progress'
    or v_operation.current_credential_version is distinct from v_state.credential_version
    or v_operation.next_credential_version is distinct from p_applied_credential_version
    or v_state.user_id is null
    or v_state.credential_state <> 'reset_in_progress'
    or v_state.pending_operation_id is distinct from p_operation_id
    or v_state.pending_credential_version is distinct from p_applied_credential_version
  then
    raise exception 'PATCH83U_ADMIN_RESET_SESSION_PROOF_INVALID';
  end if;

  if lower(btrim(coalesce(p_verified_auth_email, ''))) <> v_state.auth_email
    or not exists (
      select 1 from auth.users u
      where u.id = p_target_user_id
        and lower(btrim(u.email)) = v_state.auth_email
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until <= now())
        and public.patch83u_auth_credential_version(u.raw_app_meta_data)
          = p_applied_credential_version
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
    raise exception 'PATCH83U_ADMIN_RESET_DATABASE_PROOF_FAILED';
  end if;

  -- This service-only RPC is deliberately read-only. It never deletes or
  -- updates auth.sessions; it reports only whether the supported Auth action
  -- left zero target session rows for the exact protected reset operation.
  v_sessions_revoked := not exists (
    select 1 from auth.sessions s where s.user_id = p_target_user_id
  );

  return jsonb_build_object(
    'user_id', p_target_user_id,
    'operation_id', p_operation_id,
    'request_id', p_request_id,
    'credential_version', p_applied_credential_version,
    'sessions_revoked', v_sessions_revoked
  );
end;
$$;

create or replace function public.patch83u_finalize_admin_reset(
  p_actor_id uuid,
  p_target_user_id uuid,
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
  v_org_id uuid;
  v_state public.user_credential_states%rowtype;
  v_operation public.patch83u_credential_operations%rowtype;
  v_result jsonb;
  v_next_state text;
  v_now timestamptz := clock_timestamp();
begin
  perform public.patch83u_require_enforced_runtime();
  v_org_id := public.patch83u_require_super_admin(p_actor_id);

  select op.* into v_operation
  from public.patch83u_credential_operations op
  where op.operation_id = p_operation_id
    and op.operation_type = 'admin_reset'
    and op.actor_id = p_actor_id
    and op.target_user_id = p_target_user_id
    and op.request_id = p_request_id
  for update;
  if v_operation.operation_id is null then
    raise exception 'PATCH83U_ADMIN_RESET_OPERATION_INVALID';
  end if;
  if v_operation.operation_status in (
    'completed', 'recovery_required', 'session_revocation_review_required'
  )
    and v_operation.safe_result is not null
  then
    return v_operation.safe_result || jsonb_build_object('idempotent_replay', true);
  end if;

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_target_user_id
    and cs.organization_id = v_org_id
  for update;

  if v_state.user_id is null
    or v_state.credential_state <> 'reset_in_progress'
    or v_state.pending_operation_id is distinct from p_operation_id
    or v_state.pending_credential_version is distinct from p_applied_credential_version
  then
    raise exception 'PATCH83U_ADMIN_RESET_OPERATION_INVALID';
  end if;
  if lower(btrim(coalesce(p_verified_auth_email, ''))) <> v_state.auth_email
    or not exists (
      select 1 from auth.users u
      where u.id = p_target_user_id
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
    raise exception 'PATCH83U_ADMIN_RESET_DATABASE_PROOF_FAILED';
  end if;
  if coalesce(p_session_revocation_confirmed, false)
    and exists (select 1 from auth.sessions s where s.user_id = p_target_user_id)
  then
    raise exception 'PATCH83U_AUTH_SESSIONS_STILL_ACTIVE';
  end if;

  v_next_state := case
    when coalesce(p_session_revocation_confirmed, false)
      then 'admin_reset_change_required'
    else 'session_revocation_review_required'
  end;

  update public.user_credential_states
  set credential_state = v_next_state,
      credential_version = p_applied_credential_version,
      session_valid_after = v_now,
      invalidated_session_id = null,
      pending_operation_id = null,
      operation_source = case
        when p_session_revocation_confirmed then null else 'admin_reset'
      end,
      reconciliation_auth_changed = not coalesce(p_session_revocation_confirmed, false),
      pending_session_id = null,
      pending_credential_version = null,
      operation_previous_state = null,
      operation_previous_lifecycle = null,
      operation_previous_session_valid_after = null,
      password_reset_at = v_now,
      sessions_revoked_at = case
        when p_session_revocation_confirmed then clock_timestamp()
        else sessions_revoked_at
      end
  where user_id = p_target_user_id;

  v_result := jsonb_build_object(
    'user_id', p_target_user_id,
    'request_id', p_request_id,
    'credential_state', v_next_state,
    'credential_version', p_applied_credential_version,
    'must_change_password', v_next_state = 'admin_reset_change_required',
    'must_reauthenticate', true,
    'reconciliation_required', v_next_state = 'session_revocation_review_required',
    'session_revocation_review_required', v_next_state = 'session_revocation_review_required',
    'idempotent_replay', false
  );

  update public.patch83u_credential_operations
  set operation_status = case
        when p_session_revocation_confirmed then 'completed'
        else 'session_revocation_review_required'
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
    credential_version, event_code, details
  ) values (
    v_org_id, p_target_user_id, v_state.provisioning_id, p_actor_id,
    case when p_session_revocation_confirmed
      then 'admin_reset_completed'
      else 'session_revocation_review_required'
    end,
    p_applied_credential_version,
    case when p_session_revocation_confirmed
      then 'PATCH83U_ADMIN_RESET_COMPLETED'
      else 'PATCH83U_SESSION_REVOCATION_REVIEW_REQUIRED'
    end,
    jsonb_build_object(
      'operation_id', p_operation_id,
      'role_rows_preserved', true,
      'session_access_invalidated', true,
      'direct_auth_session_revocation_confirmed', coalesce(p_session_revocation_confirmed, false)
    )
  );

  return v_result;
end;
$$;

create or replace function public.patch83u_abort_admin_reset(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_operation_id uuid,
  p_request_id text,
  p_auth_changed boolean,
  p_session_revocation_confirmed boolean,
  p_error_code text,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_state public.user_credential_states%rowtype;
  v_operation public.patch83u_credential_operations%rowtype;
  v_result jsonb;
  v_next_state text;
  v_keep_reconciliation_evidence boolean := false;
  v_safe_message text;
  v_auth_version integer;
  v_effective_credential_version integer;
  v_revocation_proven boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  v_org_id := public.patch83u_require_super_admin(p_actor_id);
  if nullif(btrim(coalesce(p_error_code, '')), '') is null
    or length(p_error_code) > 80
    or p_error_code !~ '^[A-Z0-9_]+$'
  then
    raise exception 'PATCH83U_FAILURE_CODE_INVALID';
  end if;
  v_safe_message := public.patch83u_safe_failure_message(p_error_message);

  select op.* into v_operation
  from public.patch83u_credential_operations op
  where op.operation_id = p_operation_id
    and op.operation_type = 'admin_reset'
    and op.actor_id = p_actor_id
    and op.target_user_id = p_target_user_id
    and op.request_id = p_request_id
  for update;
  if v_operation.operation_id is null then
    raise exception 'PATCH83U_ADMIN_RESET_OPERATION_INVALID';
  end if;
  if v_operation.operation_status in (
    'completed', 'aborted', 'recovery_required',
    'session_revocation_review_required'
  ) and v_operation.safe_result is not null then
    return v_operation.safe_result || jsonb_build_object('idempotent_replay', true);
  end if;

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_target_user_id
    and cs.organization_id = v_org_id
  for update;

  if v_state.user_id is null
    or v_state.credential_state <> 'reset_in_progress'
    or v_state.pending_operation_id is distinct from p_operation_id
  then
    raise exception 'PATCH83U_ADMIN_RESET_OPERATION_INVALID';
  end if;

  if coalesce(p_auth_changed, false) then
    select public.patch83u_auth_credential_version(u.raw_app_meta_data)
    into v_auth_version
    from auth.users u
    where u.id = p_target_user_id
      and lower(btrim(u.email)) = v_state.auth_email;

    -- An attempted Auth write is ambiguous until reconciliation, even when the
    -- follow-up Auth row is missing, unchanged, or carries an unexpected numeric
    -- version. Abort must therefore be total and leave the account recoverable,
    -- never stranded in reset_in_progress.
  end if;

  v_revocation_proven := coalesce(p_session_revocation_confirmed, false)
    and not exists (
      select 1 from auth.sessions s where s.user_id = p_target_user_id
    );
  v_effective_credential_version := case
    when coalesce(p_auth_changed, false)
      and v_auth_version is not null
      and v_auth_version >= v_state.credential_version
      then v_auth_version
    else v_state.credential_version
  end;
  v_next_state := case
    when coalesce(p_auth_changed, false) and not v_revocation_proven
      then 'session_revocation_review_required'
    when coalesce(p_auth_changed, false) then 'recovery_required'
    else v_state.operation_previous_state
  end;
  v_keep_reconciliation_evidence :=
    v_next_state in ('recovery_required', 'session_revocation_review_required')
    and (
      coalesce(p_auth_changed, false)
      or v_state.operation_previous_state = 'active'
    );

  update public.user_credential_states
  set credential_state = v_next_state,
      credential_version = v_effective_credential_version,
      requested_lifecycle = v_state.requested_lifecycle,
      session_valid_after = case
        when v_next_state in ('recovery_required', 'session_revocation_review_required')
          then v_now
        else v_state.operation_previous_session_valid_after
      end,
      role_suspension_id = null,
      pending_operation_id = null,
      operation_source = case
        when v_keep_reconciliation_evidence then operation_source else null
      end,
      reconciliation_auth_changed = case
        when v_keep_reconciliation_evidence then coalesce(p_auth_changed, false)
        else false
      end,
      pending_session_id = null,
      pending_credential_version = null,
      operation_previous_state = case
        when v_keep_reconciliation_evidence then operation_previous_state else null
      end,
      operation_previous_lifecycle = case
        when v_keep_reconciliation_evidence then operation_previous_lifecycle else null
      end,
      operation_previous_session_valid_after = case
        when v_keep_reconciliation_evidence then operation_previous_session_valid_after else null
      end,
      reconciliation_checked_at = case
        when v_next_state in ('recovery_required', 'session_revocation_review_required')
          then v_now
        else reconciliation_checked_at
      end,
      sessions_revoked_at = case
        when v_revocation_proven then v_now else sessions_revoked_at end
  where user_id = p_target_user_id;

  v_result := jsonb_build_object(
    'user_id', p_target_user_id,
    'request_id', p_request_id,
    'credential_state', v_next_state,
    'credential_version', v_effective_credential_version,
    'recovery_required', v_next_state = 'recovery_required',
    'reconciliation_required', v_next_state in (
      'recovery_required', 'reconciliation_required',
      'session_revocation_review_required'
    ),
    'session_revocation_review_required',
      v_next_state = 'session_revocation_review_required',
    'idempotent_replay', false
  );

  update public.patch83u_credential_operations
  set operation_status = case
        when v_next_state = 'session_revocation_review_required'
          then 'session_revocation_review_required'
        when v_next_state = 'recovery_required' then 'recovery_required'
        else 'aborted'
      end,
      resulting_credential_state = v_next_state,
      auth_changed = coalesce(p_auth_changed, false),
      session_revocation_confirmed = v_revocation_proven,
      safe_result = v_result,
      completed_at = v_now,
      updated_at = v_now
  where operation_id = p_operation_id;

  insert into public.user_credential_events (
    organization_id, user_id, provisioning_id, actor_id, event_type,
    credential_version, event_code, details
  ) values (
    v_org_id, p_target_user_id, v_state.provisioning_id, p_actor_id,
    'admin_reset_aborted', v_effective_credential_version, btrim(p_error_code),
    jsonb_build_object(
      'operation_id', p_operation_id,
      'request_id', p_request_id,
      'auth_changed', coalesce(p_auth_changed, false),
      'resulting_state', v_next_state,
      'role_rows_preserved', true,
      'session_revocation_confirmed', v_revocation_proven,
      'message', v_safe_message
    )
  );

  return v_result;
end;
$$;

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
as $$
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

  v_role_division_id := null;
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
$$;

create or replace function public.patch83u_fail_provisioning(
  p_actor_id uuid,
  p_provisioning_id uuid,
  p_attempt_id uuid,
  p_error_code text,
  p_error_message text,
  p_reconciliation_required boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_queue public.user_account_provisioning%rowtype;
  v_status text;
  v_safe_message text;
begin
  v_org_id := public.patch83u_require_super_admin(p_actor_id);

  if nullif(btrim(coalesce(p_error_code, '')), '') is null
    or length(p_error_code) > 80
    or p_error_code !~ '^[A-Z0-9_]+$'
  then
    raise exception 'PATCH83U_FAILURE_CODE_INVALID';
  end if;
  v_safe_message := case
    when btrim(p_error_code) = 'PATCH83U_INITIAL_PASSWORD_POLICY_BLOCKED'
      then 'The current Supabase Auth password policy does not accept this Employee ID as the initial password.'
    else public.patch83u_safe_failure_message(p_error_message)
  end;

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

  v_status := case
    when p_reconciliation_required
      or v_queue.auth_user_id is not null
      or exists (
        select 1 from auth.users u
        where lower(btrim(u.email)) = v_queue.auth_email
          and u.raw_app_meta_data ->> 'patch83u_provisioning_id' = v_queue.id::text
      )
      then 'reconciliation_required'
    when btrim(p_error_code) = 'PATCH83U_INITIAL_PASSWORD_POLICY_BLOCKED'
      then 'policy_blocked'
    else 'retryable_failed'
  end;

  update public.user_account_provisioning
  set provisioning_status = v_status,
      lease_expires_at = null,
      attempt_id = null,
      last_error_code = btrim(p_error_code),
      last_error_message = v_safe_message
  where id = v_queue.id;

  insert into public.user_credential_events (
    organization_id, provisioning_id, actor_id, event_type,
    credential_version, request_id, event_code, details
  ) values (
    v_org_id, v_queue.id, p_actor_id,
    case when v_status = 'reconciliation_required'
      then 'provisioning_reconciliation_required'
      else 'provisioning_failed'
    end,
    1, v_queue.request_id, btrim(p_error_code),
    jsonb_build_object('provisioning_status', v_status, 'message', v_safe_message)
  );

  return jsonb_build_object(
    'provisioning_id', v_queue.id,
    'provisioning_status', v_status,
    'retryable', v_status in ('retryable_failed', 'policy_blocked'),
    'reconciliation_required', v_status = 'reconciliation_required'
  );
end;
$$;

create or replace function public.patch83u_expected_auth_email(p_employee_id text)
returns text
language plpgsql
immutable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_employee_id text := btrim(coalesce(p_employee_id, ''));
begin
  -- Patch 83U preserves the exact trimmed Employee ID and derives only the
  -- lowercase Auth email alias. Hosted Auth policy, not this validator, decides
  -- whether that exact Employee ID is accepted as an initial password.
  if v_employee_id = '' or length(v_employee_id) > 64
    or v_employee_id !~ '^[A-Za-z0-9._-]+$'
  then
    raise exception 'PATCH83U_EMPLOYEE_ID_AUTH_FORMAT_INVALID';
  end if;
  return lower(v_employee_id) || '@almodawat.sa';
end;
$$;

create or replace function public.patch83u_require_super_admin(p_actor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  perform public.patch83u_require_service_role();

  select p.organization_id
  into v_org_id
  from public.profiles p
  join public.user_credential_states cs on cs.user_id = p.id
  join auth.users u on u.id = p.id
  where p.id = p_actor_id
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and cs.organization_id = p.organization_id
    and public.patch83u_runtime_credential_state_allowed(
      cs.credential_state, cs.identity_mode
    )
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
    and lower(btrim(coalesce(u.email, ''))) = cs.auth_email
    and public.patch83u_auth_credential_version(u.raw_app_meta_data) = cs.credential_version
    and 1 = (
      select count(*) from auth.identities ai
      where ai.user_id = u.id and ai.provider = 'email'
    )
    and 1 = (
      select count(*) from auth.identities ai
      where ai.user_id = u.id
        and ai.provider = 'email'
        and lower(btrim(coalesce(ai.identity_data ->> 'email', ''))) = cs.auth_email
    );

  if v_org_id is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        v_org_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
  ) then
    raise exception 'PATCH83U_ACTIVE_SUPER_ADMIN_REQUIRED';
  end if;

  return v_org_id;
end;
$$;

create or replace function public.patch83u_require_role_admin(p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_is_super_admin boolean := false;
begin
  perform public.patch83u_require_service_role();

  select p.organization_id
  into v_org_id
  from public.profiles p
  join public.user_credential_states cs on cs.user_id = p.id
  join auth.users u on u.id = p.id
  where p.id = p_actor_id
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and cs.organization_id = p.organization_id
    and public.patch83u_runtime_credential_state_allowed(
      cs.credential_state, cs.identity_mode
    )
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
    and lower(btrim(coalesce(u.email, ''))) = cs.auth_email
    and public.patch83u_auth_credential_version(u.raw_app_meta_data) = cs.credential_version
    and 1 = (
      select count(*) from auth.identities ai
      where ai.user_id = u.id and ai.provider = 'email'
    )
    and 1 = (
      select count(*) from auth.identities ai
      where ai.user_id = u.id
        and ai.provider = 'email'
        and lower(btrim(coalesce(ai.identity_data ->> 'email', ''))) = cs.auth_email
    );

  if v_org_id is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role in ('super_admin', 'governance_admin')
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        v_org_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
  ) then
    raise exception 'PATCH83U_ACTIVE_ROLE_ADMIN_REQUIRED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        v_org_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
  ) into v_is_super_admin;

  return jsonb_build_object(
    'organization_id', v_org_id,
    'is_super_admin', v_is_super_admin
  );
end;
$$;

create or replace function public.patch83u_assign_user_role(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_role public.app_role,
  p_scope public.access_scope,
  p_division_id uuid default null,
  p_department_id uuid default null,
  p_unit_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_admin jsonb;
  v_org_id uuid;
  v_is_super_admin boolean;
  v_target public.profiles%rowtype;
  v_state public.user_credential_states%rowtype;
  v_role_id uuid;
  v_match_count integer := 0;
  v_action text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_admin := public.patch83u_require_role_admin(p_actor_id);
  v_org_id := (v_admin ->> 'organization_id')::uuid;
  v_is_super_admin := (v_admin ->> 'is_super_admin')::boolean;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('patch83u-super-admin-eligibility:' || v_org_id::text, 0)
  );
  -- Recheck the actor after entering the organization-wide role/admin lock.
  v_admin := public.patch83u_require_role_admin(p_actor_id);
  if (v_admin ->> 'organization_id')::uuid is distinct from v_org_id then
    raise exception 'PATCH83U_ROLE_ADMIN_ORGANIZATION_CHANGED';
  end if;
  v_is_super_admin := (v_admin ->> 'is_super_admin')::boolean;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'PATCH83U_ROLE_REASON_INVALID';
  end if;
  if not public.patch83u_role_scope_allowed(p_role, p_scope) then
    raise exception 'PATCH83U_ROLE_SCOPE_NOT_ALLOWED';
  end if;
  if p_role in ('super_admin', 'executive', 'governance_admin')
    and not v_is_super_admin
  then
    raise exception 'PATCH83U_PRIVILEGED_ROLE_REQUIRES_SUPER_ADMIN';
  end if;
  select p.* into v_target
  from public.profiles p
  where p.id = p_target_user_id
    and p.organization_id = v_org_id
  for update;
  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_target_user_id
    and cs.organization_id = v_org_id
  for update;

  if v_target.id is null or v_state.user_id is null then
    raise exception 'PATCH83U_ROLE_TARGET_NOT_FOUND';
  end if;
  if v_target.is_active is distinct from true
    or v_target.user_status <> 'active'
    or not public.patch83u_runtime_credential_state_allowed(
      v_state.credential_state, v_state.identity_mode
    )
  then
    raise exception 'PATCH83U_ROLE_TARGET_NOT_ACTIVE';
  end if;

  -- Lock every supplied hierarchy record before validating its exact tenant and
  -- parent relationship. The public validator then enforces the complete shape.
  if p_division_id is not null then
    perform 1 from public.divisions d where d.id = p_division_id for share;
    if not found then raise exception 'PATCH83U_ROLE_REFERENCE_INVALID'; end if;
  end if;
  if p_department_id is not null then
    perform 1 from public.departments d where d.id = p_department_id for share;
    if not found then raise exception 'PATCH83U_ROLE_REFERENCE_INVALID'; end if;
  end if;
  if p_unit_id is not null then
    perform 1 from public.units u where u.id = p_unit_id for share;
    if not found then raise exception 'PATCH83U_ROLE_REFERENCE_INVALID'; end if;
  end if;

  if not public.patch83u_role_assignment_valid(
    v_org_id, p_scope, v_org_id,
    p_division_id, p_department_id, p_unit_id
  ) then
    raise exception 'PATCH83U_ROLE_REFERENCE_INVALID';
  end if;

  -- Nullable columns make the historical unique constraint insufficient, so
  -- lock the target's whole role set and fail closed on duplicate identities.
  perform 1
  from public.user_roles ur
  where ur.user_id = p_target_user_id
  order by ur.id
  for update;

  select count(*)::integer, min(ur.id::text)::uuid
  into v_match_count, v_role_id
  from public.user_roles ur
  where ur.user_id = p_target_user_id
    and ur.role = p_role
    and ur.scope = p_scope
    and ur.organization_id is not distinct from v_org_id
    and ur.division_id is not distinct from p_division_id
    and ur.department_id is not distinct from p_department_id
    and ur.unit_id is not distinct from p_unit_id;

  if v_match_count > 1 then
    raise exception 'PATCH83U_ROLE_ASSIGNMENT_AMBIGUOUS';
  elsif v_role_id is null then
    insert into public.user_roles (
      user_id, role, scope, organization_id, division_id,
      department_id, unit_id, is_active, assigned_by, assigned_at
    ) values (
      p_target_user_id, p_role, p_scope, v_org_id, p_division_id,
      p_department_id, p_unit_id, true, p_actor_id, clock_timestamp()
    ) returning id into v_role_id;
    v_action := 'assigned';
  elsif exists (
    select 1 from public.user_roles ur where ur.id = v_role_id and ur.is_active
  ) then
    return jsonb_build_object(
      'id', v_role_id,
      'user_role_id', v_role_id,
      'target_user_id', p_target_user_id,
      'organization_id', v_org_id,
      'role', p_role,
      'scope', p_scope,
      'division_id', p_division_id,
      'department_id', p_department_id,
      'unit_id', p_unit_id,
      'action', 'unchanged',
      'is_active', true
    );
  else
    update public.user_roles
    set is_active = true,
        assigned_by = p_actor_id,
        assigned_at = clock_timestamp()
    where id = v_role_id;
    v_action := 'reactivated';
  end if;

  insert into public.role_change_audit (
    organization_id, target_user_id, user_role_id, action,
    new_data, reason, changed_by
  )
  select v_org_id, p_target_user_id, v_role_id, v_action,
    to_jsonb(ur), v_reason, p_actor_id
  from public.user_roles ur
  where ur.id = v_role_id;

  return jsonb_build_object(
    'id', v_role_id,
    'user_role_id', v_role_id,
    'target_user_id', p_target_user_id,
    'organization_id', v_org_id,
    'role', p_role,
    'scope', p_scope,
    'division_id', p_division_id,
    'department_id', p_department_id,
    'unit_id', p_unit_id,
    'action', v_action,
    'is_active', true
  );
end;
$$;

create or replace function public.patch83u_deactivate_user_role(
  p_actor_id uuid,
  p_user_role_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_admin jsonb;
  v_org_id uuid;
  v_is_super_admin boolean;
  v_role public.user_roles%rowtype;
  v_target public.profiles%rowtype;
  v_state public.user_credential_states%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_other_super_admin_count integer := 0;
begin
  v_admin := public.patch83u_require_role_admin(p_actor_id);
  v_org_id := (v_admin ->> 'organization_id')::uuid;
  v_is_super_admin := (v_admin ->> 'is_super_admin')::boolean;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('patch83u-super-admin-eligibility:' || v_org_id::text, 0)
  );
  v_admin := public.patch83u_require_role_admin(p_actor_id);
  if (v_admin ->> 'organization_id')::uuid is distinct from v_org_id then
    raise exception 'PATCH83U_ROLE_ADMIN_ORGANIZATION_CHANGED';
  end if;
  v_is_super_admin := (v_admin ->> 'is_super_admin')::boolean;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'PATCH83U_ROLE_REASON_INVALID';
  end if;

  select ur.* into v_role
  from public.user_roles ur
  where ur.id = p_user_role_id
  for update;
  if v_role.id is null then
    raise exception 'PATCH83U_ROLE_ASSIGNMENT_NOT_FOUND';
  end if;

  select p.* into v_target
  from public.profiles p
  where p.id = v_role.user_id
    and p.organization_id = v_org_id
  for update;
  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = v_role.user_id
    and cs.organization_id = v_org_id
  for update;

  if v_target.id is null or v_state.user_id is null then
    raise exception 'PATCH83U_ROLE_TARGET_NOT_FOUND';
  end if;
  if v_role.user_id = p_actor_id then
    raise exception 'PATCH83U_SELF_ROLE_DEACTIVATION_DENIED';
  end if;
  if not v_role.is_active then
    raise exception 'PATCH83U_ROLE_ALREADY_INACTIVE';
  end if;
  if v_role.role in ('super_admin', 'executive', 'governance_admin')
    and not v_is_super_admin
  then
    raise exception 'PATCH83U_PRIVILEGED_ROLE_REQUIRES_SUPER_ADMIN';
  end if;

  if v_role.role = 'super_admin'
    and v_role.scope = 'global'
    and public.patch83u_role_assignment_valid(
      v_org_id, v_role.scope, v_role.organization_id,
      v_role.division_id, v_role.department_id, v_role.unit_id
    )
    and v_target.is_active = true
    and v_target.user_status = 'active'
    and v_state.identity_mode in ('employee_id_managed', 'legacy_verified')
    and public.patch83u_runtime_super_admin_eligible(v_role.user_id, v_org_id)
  then
    perform 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    join public.user_credential_states cs on cs.user_id = p.id
    where ur.user_id <> v_role.user_id
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        v_org_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
      and p.organization_id = v_org_id
      and p.is_active = true
      and p.user_status = 'active'
      and cs.organization_id = v_org_id
      and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
      and public.patch83u_runtime_super_admin_eligible(ur.user_id, v_org_id)
    for update of ur, p, cs;

    select count(distinct ur.user_id)::integer
    into v_other_super_admin_count
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    join public.user_credential_states cs on cs.user_id = p.id
    where ur.user_id <> v_role.user_id
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        v_org_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
      and p.organization_id = v_org_id
      and p.is_active = true
      and p.user_status = 'active'
      and cs.organization_id = v_org_id
      and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
      and public.patch83u_runtime_super_admin_eligible(ur.user_id, v_org_id);

    if v_other_super_admin_count < 1 then
      raise exception 'PATCH83U_LAST_SUPER_ADMIN_ROLE_DEACTIVATION_DENIED';
    end if;
  end if;

  update public.user_roles set is_active = false where id = v_role.id;
  insert into public.role_change_audit (
    organization_id, target_user_id, user_role_id, action,
    old_data, reason, changed_by
  ) values (
    v_org_id, v_role.user_id, v_role.id, 'deactivated',
    to_jsonb(v_role), v_reason, p_actor_id
  );

  return jsonb_build_object(
    'id', v_role.id,
    'user_role_id', v_role.id,
    'target_user_id', v_role.user_id,
    'organization_id', v_org_id,
    'role', v_role.role,
    'scope', v_role.scope,
    'division_id', v_role.division_id,
    'department_id', v_role.department_id,
    'unit_id', v_role.unit_id,
    'action', 'deactivated',
    'is_active', false
  );
end;
$$;

create or replace function public.patch83u_apply_user_lifecycle(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_admin jsonb;
  v_org_id uuid;
  v_is_super_admin boolean := false;
  v_target public.profiles%rowtype;
  v_state public.user_credential_states%rowtype;
  v_role public.user_roles%rowtype;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_next_status text;
  v_audit_action text;
  v_expected_active boolean;
  v_expected_credential_event text;
  v_old_profile jsonb;
  v_new_profile jsonb;
  v_lifecycle_audit_id uuid;
  v_linked_count integer := 0;
  v_role_rows_deactivated integer := 0;
  v_role_audit_records integer := 0;
  v_active_role_count_after integer := 0;
  v_credential_events_before integer := 0;
  v_credential_events_after integer := 0;
begin
  perform public.patch83u_require_service_role();

  if p_action is null or p_action not in (
    'patch19_deactivate_user',
    'patch19_reactivate_user',
    'patch19_archive_user',
    'patch19_unarchive_user'
  ) then
    raise exception 'PATCH83U_LIFECYCLE_ACTION_NOT_ALLOWED';
  end if;
  if v_reason is null or length(v_reason) > 500 then
    raise exception 'PATCH83U_LIFECYCLE_REASON_REQUIRED';
  end if;

  v_admin := public.patch83u_require_role_admin(p_actor_id);
  v_org_id := (v_admin ->> 'organization_id')::uuid;
  v_is_super_admin := (v_admin ->> 'is_super_admin')::boolean;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'patch83u-super-admin-eligibility:' || v_org_id::text,
      0
    )
  );

  -- Lock every actor proof row before repeating the canonical authorization
  -- decision. A concurrent lifecycle or role change cannot invalidate the
  -- actor between authorization and the target mutation.
  perform 1
  from public.user_roles ur
  where ur.user_id = p_actor_id
  order by ur.id
  for update;
  perform 1
  from public.profiles p
  where p.id = p_actor_id and p.organization_id = v_org_id
  for update;
  if not found then
    raise exception 'PATCH83U_LIFECYCLE_ACTOR_NOT_FOUND';
  end if;
  perform 1
  from public.user_credential_states cs
  where cs.user_id = p_actor_id and cs.organization_id = v_org_id
  for update;
  if not found then
    raise exception 'PATCH83U_LIFECYCLE_ACTOR_CREDENTIAL_STATE_REQUIRED';
  end if;
  v_admin := public.patch83u_require_role_admin(p_actor_id);
  if (v_admin ->> 'organization_id')::uuid is distinct from v_org_id then
    raise exception 'PATCH83U_LIFECYCLE_ADMIN_ORGANIZATION_CHANGED';
  end if;
  v_is_super_admin := (v_admin ->> 'is_super_admin')::boolean;

  -- Role updates acquire their row before the role-activation trigger locks the
  -- profile. Use the same role->profile order to avoid a lifecycle/role-update
  -- deadlock, then hold the profile row against new role activations.
  perform 1
  from public.user_roles ur
  where ur.user_id = p_target_user_id
  order by ur.id
  for update;

  select p.* into v_target
  from public.profiles p
  where p.id = p_target_user_id
    and p.organization_id = v_org_id
  for update;
  if v_target.id is null then
    raise exception 'PATCH83U_LIFECYCLE_TARGET_NOT_FOUND';
  end if;

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_target_user_id
    and cs.organization_id = v_org_id
  for update;
  if v_state.user_id is null then
    raise exception 'PATCH83U_LIFECYCLE_TARGET_CREDENTIAL_STATE_REQUIRED';
  end if;

  -- A protected provisioning record owns the profile/credential lifecycle
  -- until it reaches a terminal queue state. Never mutate that record
  -- implicitly or allow an administrative lifecycle transition to create
  -- profile/credential/queue drift while provisioning remains open.
  if exists (
    select 1
    from public.user_account_provisioning q
    where q.profile_id = p_target_user_id
      and q.organization_id = v_org_id
      and q.provisioning_status not in ('completed', 'cancelled')
  ) then
    raise exception 'PATCH83U_LIFECYCLE_OPEN_PROVISIONING_DENIED';
  end if;

  if p_target_user_id = p_actor_id
    and p_action in ('patch19_deactivate_user', 'patch19_archive_user')
  then
    raise exception 'PATCH83U_SELF_LIFECYCLE_DEACTIVATION_DENIED';
  end if;
  if not v_is_super_admin and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_target_user_id
      and ur.is_active = true
      and ur.role in ('super_admin', 'executive', 'governance_admin')
  ) then
    raise exception 'PATCH83U_PRIVILEGED_LIFECYCLE_REQUIRES_SUPER_ADMIN';
  end if;
  if v_target.user_status not in ('active', 'inactive', 'archived', 'invited', 'locked')
    or v_target.is_active is distinct from (
      v_target.user_status in ('active', 'invited')
    )
    or (
      v_target.user_status in ('active', 'invited')
      and (
        v_target.deactivated_at is not null
        or v_target.deactivated_by is not null
        or v_target.deactivation_reason is not null
      )
    )
    or (
      v_target.user_status in ('inactive', 'archived', 'locked')
      and (
        v_target.deactivated_at is null
        or v_target.deactivated_by is null
        or nullif(pg_catalog.btrim(coalesce(v_target.deactivation_reason, '')), '') is null
        or not exists (
          select 1
          from public.profiles deactivation_actor
          where deactivation_actor.id = v_target.deactivated_by
            and deactivation_actor.organization_id = v_target.organization_id
        )
      )
    )
  then
    raise exception 'PATCH83U_PROFILE_LIFECYCLE_INCONSISTENT';
  end if;

  if p_action = 'patch19_deactivate_user' then
    if v_target.user_status not in ('active', 'invited')
      or v_target.is_active is distinct from true
    then
      raise exception 'PATCH83U_LIFECYCLE_SOURCE_STATE_INVALID';
    end if;
    v_next_status := 'inactive';
    v_audit_action := 'deactivated';
    v_expected_active := false;
    v_expected_credential_event := 'PATCH83U_PROFILE_LIFECYCLE_BLOCKED';
  elsif p_action = 'patch19_reactivate_user' then
    if v_target.user_status not in ('inactive', 'locked')
      or v_target.is_active is distinct from false
    then
      raise exception 'PATCH83U_LIFECYCLE_SOURCE_STATE_INVALID';
    end if;
    v_next_status := 'active';
    v_audit_action := 'reactivated';
    v_expected_active := true;
    v_expected_credential_event := case
      when v_state.identity_mode in ('employee_id_managed', 'legacy_verified')
        then 'PATCH83U_PROFILE_REACTIVATED'
      else null
    end;
  elsif p_action = 'patch19_archive_user' then
    if v_target.user_status = 'archived' then
      raise exception 'PATCH83U_LIFECYCLE_SOURCE_STATE_INVALID';
    end if;
    v_next_status := 'archived';
    v_audit_action := 'archived';
    v_expected_active := false;
    v_expected_credential_event := 'PATCH83U_PROFILE_LIFECYCLE_BLOCKED';
  else
    if v_target.user_status <> 'archived'
      or v_target.is_active is distinct from false
    then
      raise exception 'PATCH83U_LIFECYCLE_SOURCE_STATE_INVALID';
    end if;
    v_next_status := 'active';
    v_audit_action := 'unarchived';
    v_expected_active := true;
    v_expected_credential_event := case
      when v_state.identity_mode in ('employee_id_managed', 'legacy_verified')
        then 'PATCH83U_PROFILE_REACTIVATED'
      else null
    end;
  end if;

  -- Reactivation/unarchive never makes a historical active role effective by
  -- implication. The target role set is already locked above, so any drift is
  -- stable for this decision and must be reconciled before profile activation.
  if v_expected_active and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_target_user_id
      and ur.is_active = true
  ) then
    raise exception 'PATCH83U_LIFECYCLE_ACTIVE_ROLE_DRIFT';
  end if;

  v_old_profile := to_jsonb(v_target);
  select (
    (select count(*) from public.projects pr
      where pr.owner_id = p_target_user_id or pr.sponsor_id = p_target_user_id) +
    (select count(*) from public.tasks t
      where t.owner_id = p_target_user_id or t.assigned_to = p_target_user_id) +
    (select count(*) from public.approvals a
      where a.requested_by = p_target_user_id or a.approver_id = p_target_user_id) +
    (select count(*) from public.evidence_files e
      where e.uploaded_by = p_target_user_id or e.reviewed_by = p_target_user_id)
  )::integer into v_linked_count;

  if v_expected_credential_event is not null then
    select count(*)::integer into v_credential_events_before
    from public.user_credential_events e
    where e.user_id = p_target_user_id
      and e.actor_id = p_actor_id
      and e.event_code = v_expected_credential_event;
  end if;

  -- Preserve the service-role claim for the trigger boundary. Set only the
  -- canonical actor subject so lifecycle credential events retain attribution.
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::text, true);
  update public.profiles
  set user_status = v_next_status,
      is_active = v_expected_active,
      deactivated_at = case
        when v_expected_active then null else pg_catalog.statement_timestamp() end,
      deactivated_by = case when v_expected_active then null else p_actor_id end,
      deactivation_reason = case when v_expected_active then null else v_reason end,
      last_reviewed_at = pg_catalog.statement_timestamp(),
      updated_at = pg_catalog.statement_timestamp()
  where id = p_target_user_id
    and organization_id = v_org_id;
  if not found then
    raise exception 'PATCH83U_LIFECYCLE_PROFILE_UPDATE_FAILED';
  end if;

  select p.* into v_target
  from public.profiles p where p.id = p_target_user_id;
  select cs.* into v_state
  from public.user_credential_states cs where cs.user_id = p_target_user_id;
  v_new_profile := to_jsonb(v_target);

  if v_target.user_status is distinct from v_next_status
    or v_target.is_active is distinct from v_expected_active
    or v_state.requested_lifecycle is distinct from v_next_status
    or (
      not v_expected_active
      and (
        v_target.deactivated_by is distinct from p_actor_id
        or v_target.deactivation_reason is distinct from v_reason
        or v_state.credential_state <> 'disabled'
      )
    )
    or (
      v_expected_active
      and (
        v_target.deactivated_at is not null
        or v_target.deactivated_by is not null
        or v_target.deactivation_reason is not null
        or v_state.credential_state is distinct from case
          when v_state.identity_mode in ('employee_id_managed', 'legacy_verified')
            then 'reactivation_change_required'
          else 'reconciliation_required'
        end
      )
    )
  then
    raise exception 'PATCH83U_LIFECYCLE_CREDENTIAL_PROOF_FAILED';
  end if;

  if v_expected_credential_event is not null then
    select count(*)::integer into v_credential_events_after
    from public.user_credential_events e
    where e.user_id = p_target_user_id
      and e.actor_id = p_actor_id
      and e.event_code = v_expected_credential_event;
    if v_credential_events_after <> v_credential_events_before + 1 then
      raise exception 'PATCH83U_LIFECYCLE_CREDENTIAL_EVENT_PROOF_FAILED';
    end if;
  end if;

  if not v_expected_active then
    for v_role in
      select ur.*
      from public.user_roles ur
      where ur.user_id = p_target_user_id and ur.is_active = true
      order by ur.id
      for update
    loop
      update public.user_roles
      set is_active = false
      where id = v_role.id and is_active = true;
      if not found then
        raise exception 'PATCH83U_LIFECYCLE_ROLE_DEACTIVATION_FAILED';
      end if;

      insert into public.role_change_audit (
        organization_id, target_user_id, user_role_id, action,
        old_data, new_data, reason, changed_by
      ) values (
        v_org_id, p_target_user_id, v_role.id, 'deactivated',
        to_jsonb(v_role),
        pg_catalog.jsonb_set(to_jsonb(v_role), '{is_active}', 'false'::jsonb, true),
        v_reason, p_actor_id
      );
      v_role_rows_deactivated := v_role_rows_deactivated + 1;
      v_role_audit_records := v_role_audit_records + 1;
    end loop;

    if exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_target_user_id and ur.is_active = true
    ) then
      raise exception 'PATCH83U_LIFECYCLE_ACTIVE_ROLE_PROOF_FAILED';
    end if;
  end if;

  select count(*)::integer into v_active_role_count_after
  from public.user_roles ur
  where ur.user_id = p_target_user_id and ur.is_active = true;
  if v_expected_active and v_active_role_count_after <> 0 then
    raise exception 'PATCH83U_LIFECYCLE_ACTIVE_ROLE_PROOF_FAILED';
  end if;

  insert into public.user_management_audit_history (
    organization_id, target_user_id, actor_id, action, reason,
    old_data, new_data, linked_record_count
  ) values (
    v_org_id, p_target_user_id, p_actor_id, v_audit_action, v_reason,
    v_old_profile, v_new_profile, v_linked_count
  ) returning id into v_lifecycle_audit_id;

  if v_lifecycle_audit_id is null then
    raise exception 'PATCH83U_LIFECYCLE_AUDIT_PROOF_FAILED';
  end if;

  return jsonb_build_object(
    'updated', true,
    'user_id', p_target_user_id,
    'organization_id', v_org_id,
    'action', p_action,
    'audit_action', v_audit_action,
    'user_status', v_target.user_status,
    'is_active', v_target.is_active,
    'credential_state', v_state.credential_state,
    'requested_lifecycle', v_state.requested_lifecycle,
    'deactivated_role_count', v_role_rows_deactivated,
    'role_audit_record_count', v_role_audit_records,
    'remaining_active_role_count', v_active_role_count_after,
    'reactivated_role_count', 0,
    'audit_id', v_lifecycle_audit_id,
    'audit_record_count', 1,
    'credential_event_records', case
      when v_expected_credential_event is null then 0 else 1 end,
    'linked_record_count', v_linked_count
  );
end;
$$;

create or replace function public.patch83u_safe_failure_message(p_message text)
returns text
language sql
immutable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  -- Caller-supplied failure text is never audit-safe: a credential can be any
  -- string and does not need to contain a recognizable keyword. Persist only
  -- this fixed message; the separately validated error code carries the useful
  -- operational classification without retaining caller-controlled content.
  select 'The server-side identity operation failed. No credential detail was retained.'::text;
$$;

create or replace function public.patch83t_update_user_profile(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_actor_is_super_admin boolean := false;
  v_target_is_super_admin boolean := false;
  v_target public.profiles%rowtype;
  v_state public.user_credential_states%rowtype;
  v_full_name_en text;
  v_full_name_ar text;
  v_employee_id text;
  v_contact_email text;
  v_phone text;
  v_job_title text;
  v_user_type text;
  v_reason text;
  v_old_data jsonb;
  v_new_data jsonb;
begin
  perform public.patch83u_require_service_role();
  if jsonb_typeof(coalesce(p_payload, 'null'::jsonb)) <> 'object' then
    raise exception 'PATCH83T_PROFILE_UPDATE_PAYLOAD_INVALID';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_payload) key
    where key not in (
      'full_name_en', 'full_name_ar', 'employee_id', 'contact_email',
      'phone', 'job_title', 'user_type', 'reason'
    )
  ) then
    raise exception 'PATCH83T_PROFILE_UPDATE_FIELD_NOT_ALLOWED';
  end if;

  select p.organization_id
  into v_org_id
  from public.profiles p
  join public.user_credential_states cs on cs.user_id = p.id
  where p.id = p_actor_id
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active'
    and cs.organization_id = p.organization_id
    and public.patch83u_runtime_credential_state_allowed(
      cs.credential_state, cs.identity_mode
    );

  if v_org_id is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role in ('super_admin', 'governance_admin')
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        v_org_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
  ) then
    raise exception 'PATCH83T_ACTIVE_USER_ADMIN_REQUIRED';
  end if;

  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        v_org_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
  ) into v_actor_is_super_admin;

  select p.* into v_target
  from public.profiles p
  where p.id = p_target_user_id
    and p.organization_id = v_org_id
  for update;
  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_target_user_id
    and cs.organization_id = v_org_id
  for update;

  if v_target.id is null or v_state.user_id is null then
    raise exception 'PATCH83T_PROFILE_UPDATE_TARGET_NOT_FOUND';
  end if;
  if v_target.user_status not in ('active', 'inactive', 'archived', 'invited', 'locked')
    or v_target.is_active is distinct from (v_target.user_status in ('active', 'invited'))
  then
    raise exception 'PATCH83T_PROFILE_LIFECYCLE_INCONSISTENT';
  end if;
  if exists (
    select 1
    from public.user_account_provisioning q
    where q.profile_id = p_target_user_id
      and q.provisioning_status not in ('completed', 'cancelled')
  ) then
    raise exception 'PATCH83T_PROFILE_HAS_OPEN_PROVISIONING';
  end if;

  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_target_user_id
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        v_org_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
  ) into v_target_is_super_admin;
  if v_target_is_super_admin and not v_actor_is_super_admin then
    raise exception 'PATCH83T_SUPER_ADMIN_PROFILE_REQUIRES_SUPER_ADMIN';
  end if;

  if (p_payload ? 'full_name_en' and jsonb_typeof(p_payload->'full_name_en') <> 'string')
    or (p_payload ? 'full_name_ar' and jsonb_typeof(p_payload->'full_name_ar') not in ('string', 'null'))
    or (p_payload ? 'employee_id' and jsonb_typeof(p_payload->'employee_id') not in ('string', 'null'))
    or (p_payload ? 'contact_email' and jsonb_typeof(p_payload->'contact_email') not in ('string', 'null'))
    or (p_payload ? 'phone' and jsonb_typeof(p_payload->'phone') not in ('string', 'null'))
    or (p_payload ? 'job_title' and jsonb_typeof(p_payload->'job_title') not in ('string', 'null'))
    or (p_payload ? 'user_type' and jsonb_typeof(p_payload->'user_type') <> 'string')
    or (p_payload ? 'reason' and jsonb_typeof(p_payload->'reason') not in ('string', 'null'))
  then
    raise exception 'PATCH83T_PROFILE_UPDATE_TEXT_FIELDS_REQUIRED';
  end if;

  v_full_name_en := case when p_payload ? 'full_name_en'
    then btrim(coalesce(p_payload->>'full_name_en', '')) else v_target.full_name_en end;
  v_full_name_ar := case when p_payload ? 'full_name_ar'
    then nullif(btrim(coalesce(p_payload->>'full_name_ar', '')), '') else v_target.full_name_ar end;
  v_employee_id := case when p_payload ? 'employee_id'
    then nullif(btrim(coalesce(p_payload->>'employee_id', '')), '') else v_target.employee_no end;
  v_contact_email := case when p_payload ? 'contact_email'
    then nullif(lower(btrim(coalesce(p_payload->>'contact_email', ''))), '') else v_target.contact_email end;
  v_phone := case when p_payload ? 'phone'
    then nullif(btrim(coalesce(p_payload->>'phone', '')), '') else v_target.phone end;
  v_job_title := case when p_payload ? 'job_title'
    then nullif(btrim(coalesce(p_payload->>'job_title', '')), '') else v_target.job_title end;
  v_user_type := case when p_payload ? 'user_type'
    then btrim(coalesce(p_payload->>'user_type', '')) else v_target.user_type end;
  v_reason := nullif(btrim(coalesce(p_payload->>'reason', '')), '');

  if v_full_name_en = '' then
    raise exception 'PATCH83T_PROFILE_FULL_NAME_REQUIRED';
  end if;
  if v_employee_id is null
    or length(v_employee_id) > 64
    or v_employee_id !~ '^[A-Za-z0-9._-]+$'
  then
    raise exception 'PATCH83T_PROFILE_EMPLOYEE_ID_INVALID';
  end if;
  if v_contact_email is not null
    and v_contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'PATCH83T_PROFILE_CONTACT_EMAIL_INVALID';
  end if;
  if v_phone is not null then
    if v_phone ~ '^05[0-9]{8}$' then
      v_phone := '+966' || substr(v_phone, 2);
    elsif v_phone ~ '^9665[0-9]{8}$' then
      v_phone := '+' || v_phone;
    elsif v_phone ~ '^009665[0-9]{8}$' then
      v_phone := '+' || substr(v_phone, 3);
    elsif v_phone !~ '^\+9665[0-9]{8}$' then
      raise exception 'PATCH83T_PROFILE_PHONE_INVALID';
    end if;
  end if;
  if v_user_type not in ('employee', 'contractor', 'vendor', 'external_auditor', 'service_account') then
    raise exception 'PATCH83T_PROFILE_USER_TYPE_INVALID';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'PATCH83T_PROFILE_UPDATE_REASON_INVALID';
  end if;

  if v_state.identity_mode = 'employee_id_managed'
    and v_employee_id is distinct from v_target.employee_no
  then
    raise exception 'PATCH83U_MANAGED_EMPLOYEE_ID_IMMUTABLE';
  end if;
  if v_employee_id is distinct from v_target.employee_no then
    if exists (
      select 1 from public.profiles p
      where p.id <> p_target_user_id
        and lower(btrim(p.employee_no)) = lower(v_employee_id)
    ) or exists (
      select 1 from auth.users u
      where u.id <> p_target_user_id
        and lower(btrim(u.email)) = public.patch83u_expected_auth_email(v_employee_id)
    ) or exists (
      select 1 from public.user_account_provisioning q
      where q.profile_id is distinct from p_target_user_id
        and q.provisioning_status not in ('completed', 'cancelled')
        and (
          lower(btrim(q.employee_id)) = lower(v_employee_id)
          or q.auth_email = public.patch83u_expected_auth_email(v_employee_id)
        )
    ) then
      raise exception 'PATCH83T_PROFILE_EMPLOYEE_ID_CONFLICT';
    end if;
  end if;

  v_old_data := jsonb_build_object(
    'full_name_en', v_target.full_name_en,
    'full_name_ar', v_target.full_name_ar,
    'employee_id', v_target.employee_no,
    'auth_email', v_target.email,
    'contact_email', v_target.contact_email,
    'phone', v_target.phone,
    'job_title', v_target.job_title,
    'user_type', v_target.user_type,
    'user_status', v_target.user_status,
    'is_active', v_target.is_active
  );

  update public.profiles
  set full_name_en = v_full_name_en,
      full_name_ar = v_full_name_ar,
      employee_no = v_employee_id,
      contact_email = v_contact_email,
      phone = v_phone,
      job_title = v_job_title,
      user_type = v_user_type,
      last_reviewed_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = p_target_user_id
    and organization_id = v_org_id;

  select jsonb_build_object(
    'full_name_en', p.full_name_en,
    'full_name_ar', p.full_name_ar,
    'employee_id', p.employee_no,
    'auth_email', p.email,
    'contact_email', p.contact_email,
    'phone', p.phone,
    'job_title', p.job_title,
    'user_type', p.user_type,
    'user_status', p.user_status,
    'is_active', p.is_active
  ) into v_new_data
  from public.profiles p
  where p.id = p_target_user_id;

  insert into public.user_management_audit_history (
    organization_id, target_user_id, actor_id, action, reason, old_data, new_data
  ) values (
    v_org_id, p_target_user_id, p_actor_id, 'profile_updated',
    coalesce(v_reason, 'Patch 83T controlled profile update'),
    v_old_data, v_new_data
  );

  return jsonb_build_object(
    'user_id', p_target_user_id,
    'organization_id', v_org_id,
    'profile', v_new_data
  );
end;
$$;

revoke all on function public.patch83t_update_user_profile(uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.patch83t_update_user_profile(uuid, uuid, jsonb)
to service_role;

create or replace function public.patch83u_guard_event_append_only()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  raise exception 'PATCH83U_CREDENTIAL_EVENTS_APPEND_ONLY';
end;
$$;

drop trigger if exists trg_patch83u_events_append_only on public.user_credential_events;
create trigger trg_patch83u_events_append_only
before update or delete on public.user_credential_events
for each row execute function public.patch83u_guard_event_append_only();

drop trigger if exists trg_patch83u_runtime_events_append_only on public.patch83u_runtime_events;
create trigger trg_patch83u_runtime_events_append_only
before update or delete on public.patch83u_runtime_events
for each row execute function public.patch83u_guard_event_append_only();

create or replace function public.patch83u_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.patch83u_guard_managed_profile_employee_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.employee_no is distinct from old.employee_no
    and new.employee_no is not null
    and (
      exists (
        select 1
        from public.profiles p
        where p.id <> old.id
          and lower(btrim(p.employee_no)) = lower(btrim(new.employee_no))
      )
      or exists (
        select 1
        from auth.users u
        where u.id <> old.id
          and lower(btrim(u.email)) = lower(btrim(new.employee_no)) || '@almodawat.sa'
      )
      or exists (
        select 1
        from public.user_account_provisioning q
        where q.profile_id is distinct from old.id
          and q.provisioning_status not in ('completed', 'cancelled')
          and (
            lower(btrim(q.employee_id)) = lower(btrim(new.employee_no))
            or lower(btrim(q.auth_email)) = lower(btrim(new.employee_no)) || '@almodawat.sa'
          )
      )
    )
  then
    raise exception 'PATCH83U_EMPLOYEE_ID_CASE_INSENSITIVE_CONFLICT';
  end if;

  if exists (
    select 1
    from public.user_credential_states cs
    where cs.user_id = old.id
      and cs.identity_mode = 'employee_id_managed'
  ) then
    if new.employee_no is distinct from old.employee_no then
      raise exception 'PATCH83U_MANAGED_EMPLOYEE_ID_IMMUTABLE';
    end if;
    if new.email is distinct from public.patch83u_expected_auth_email(new.employee_no) then
      raise exception 'PATCH83U_MANAGED_PROFILE_AUTH_EMAIL_IMMUTABLE';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.patch83u_guard_profile_security_boundary()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor_org_id uuid;
  v_deactivation_metadata_changed boolean := false;
  v_lifecycle_changed boolean := false;
  v_target_was_eligible_super_admin boolean := false;
  v_marker text;
begin
  if tg_op = 'INSERT' then
    -- Profiles are tenant identity roots. Legacy self-insert policies must not
    -- let an authenticated Auth identity choose an organization before the
    -- controlled server-side provisioning flow has established its identity.
    if auth.role() is distinct from 'service_role' then
      raise exception 'PATCH83U_PROFILE_INSERT_SERVICE_ROLE_REQUIRED';
    end if;

    if new.user_status not in ('active', 'inactive', 'archived', 'invited', 'locked')
      or new.is_active is distinct from (new.user_status in ('active', 'invited'))
    then
      raise exception 'PATCH83U_PROFILE_LIFECYCLE_INCONSISTENT';
    end if;

    if new.user_status in ('active', 'invited') then
      new.deactivated_at := null;
      new.deactivated_by := null;
      new.deactivation_reason := null;
    else
      if auth.role() is distinct from 'service_role' then
        new.deactivated_at := pg_catalog.statement_timestamp();
        new.deactivated_by := auth.uid();
      else
        new.deactivated_at := coalesce(
          new.deactivated_at,
          pg_catalog.statement_timestamp()
        );
      end if;
      new.deactivation_reason := nullif(
        pg_catalog.btrim(coalesce(new.deactivation_reason, '')),
        ''
      );

      if new.deactivated_at is null
        or new.deactivated_by is null
        or new.deactivation_reason is null
        or not exists (
          select 1
          from public.profiles deactivation_actor
          where deactivation_actor.id = new.deactivated_by
            and deactivation_actor.organization_id = new.organization_id
        )
      then
        raise exception 'PATCH83U_PROFILE_DEACTIVATION_METADATA_INCONSISTENT';
      end if;
    end if;

    return new;
  end if;

  if new.organization_id is distinct from old.organization_id then
    -- No Patch 83U operation owns the coordinated profile/credential/role
    -- rewrite that an organization transfer would require. Deny it even to a
    -- service-role caller so the last-Super-Admin and tenant joins cannot be
    -- bypassed through an incomplete profile-only move.
    raise exception 'PATCH83U_PROFILE_ORGANIZATION_IMMUTABLE';
  end if;

  if new.user_status not in ('active', 'inactive', 'archived', 'invited', 'locked')
    or new.is_active is distinct from (new.user_status in ('active', 'invited'))
  then
    raise exception 'PATCH83U_PROFILE_LIFECYCLE_INCONSISTENT';
  end if;

  v_lifecycle_changed := new.user_status is distinct from old.user_status
    or new.is_active is distinct from old.is_active;
  v_deactivation_metadata_changed :=
    new.deactivated_at is distinct from old.deactivated_at
    or new.deactivated_by is distinct from old.deactivated_by
    or new.deactivation_reason is distinct from old.deactivation_reason;

  -- Direct authenticated writes may request a lifecycle transition, but they
  -- must not rewrite its audit metadata independently. For a transition into
  -- a blocked lifecycle, the database supplies the actor and timestamp. The
  -- service role remains available to the controlled Patch 83T/83U routines
  -- that repair or synchronize an existing lifecycle record.
  if auth.role() is distinct from 'service_role'
    and not v_lifecycle_changed
    and v_deactivation_metadata_changed
  then
    raise exception 'PATCH83U_DIRECT_DEACTIVATION_METADATA_CHANGE_DENIED';
  end if;

  if new.user_status in ('active', 'invited') then
    new.deactivated_at := null;
    new.deactivated_by := null;
    new.deactivation_reason := null;
  elsif v_lifecycle_changed or v_deactivation_metadata_changed then
    if auth.role() is distinct from 'service_role' then
      new.deactivated_at := pg_catalog.statement_timestamp();
      new.deactivated_by := auth.uid();
    else
      new.deactivated_at := coalesce(
        new.deactivated_at,
        pg_catalog.statement_timestamp()
      );
    end if;
    new.deactivation_reason := nullif(
      pg_catalog.btrim(coalesce(new.deactivation_reason, '')),
      ''
    );

    if new.deactivated_at is null
      or new.deactivated_by is null
      or new.deactivation_reason is null
      or not exists (
        select 1
        from public.profiles deactivation_actor
        where deactivation_actor.id = new.deactivated_by
          and deactivation_actor.organization_id = new.organization_id
      )
    then
      raise exception 'PATCH83U_PROFILE_DEACTIVATION_METADATA_INCONSISTENT';
    end if;
  end if;

  if not v_lifecycle_changed then
    return new;
  end if;

  -- Lifecycle removal must protect the last runtime-eligible global Super
  -- Admin regardless of whether the write came from browser RLS or a
  -- service-role routine. Patch 83T is the sole batch exception: it first
  -- proves the complete replacement set under the same organization lock and
  -- sets the exact organization:actor transaction marker used below.
  if old.is_active = true
    and old.user_status = 'active'
    and (new.is_active = false or new.user_status <> 'active')
  then
    v_target_was_eligible_super_admin :=
      public.patch83u_runtime_super_admin_eligible(old.id, old.organization_id);

    if v_target_was_eligible_super_admin then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
          'patch83u-super-admin-eligibility:' || old.organization_id::text,
          0
        )
      );

      v_marker := coalesce(
        current_setting('patch83u.super_admin_batch_guard_verified', true),
        ''
      );
      if v_marker <> old.organization_id::text || ':' || coalesce(auth.uid()::text, '') then
        perform 1
        from public.user_roles ur
        join public.profiles p on p.id = ur.user_id
        join public.user_credential_states cs on cs.user_id = p.id
        where ur.user_id <> old.id
          and ur.is_active = true
          and ur.role = 'super_admin'
          and ur.scope = 'global'
          and public.patch83u_role_assignment_valid(
            old.organization_id, ur.scope, ur.organization_id,
            ur.division_id, ur.department_id, ur.unit_id
          )
          and p.organization_id = old.organization_id
          and p.is_active = true
          and p.user_status = 'active'
          and cs.organization_id = old.organization_id
          and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
          and public.patch83u_runtime_super_admin_eligible(
            ur.user_id, old.organization_id
          )
        for update of ur, p, cs;

        if not found then
          raise exception 'PATCH83U_LAST_SUPER_ADMIN_PROFILE_DEACTIVATION_DENIED';
        end if;
      end if;
    end if;
  end if;

  -- Server-only Patch 83T/83U functions already perform their operation-specific
  -- actor, scope, and confirmation checks. The trigger above independently
  -- enforces the last-Super-Admin invariant. Browser-originated changes must
  -- never be self lifecycle changes and require an active canonical
  -- same-organization role administrator.
  if auth.role() = 'service_role' then
    return new;
  end if;
  if auth.uid() is null or auth.uid() = old.id then
    raise exception 'PATCH83U_DIRECT_SELF_LIFECYCLE_CHANGE_DENIED';
  end if;

  select p.organization_id
  into v_actor_org_id
  from public.profiles p
  join public.user_credential_states cs
    on cs.user_id = p.id
   and cs.organization_id = p.organization_id
  where p.id = auth.uid()
    and p.organization_id = old.organization_id
    and p.is_active = true
    and p.user_status = 'active'
    and public.patch83u_credential_access_allowed();

  if v_actor_org_id is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role in ('super_admin', 'governance_admin')
      and ur.scope = 'global'
      and public.patch83u_role_assignment_valid(
        v_actor_org_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      )
  ) then
    raise exception 'PATCH83U_PROFILE_LIFECYCLE_ADMIN_REQUIRED';
  end if;

  return new;
end;
$$;

create or replace function public.patch83u_guard_credential_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_employee_id text;
  v_profile_auth_email text;
begin
  if new.identity_mode = 'employee_id_managed' then
    select p.employee_no, p.email
    into v_employee_id, v_profile_auth_email
    from public.profiles p
    where p.id = new.user_id;

    if v_employee_id is null
      or new.auth_email <> public.patch83u_expected_auth_email(v_employee_id)
      or v_profile_auth_email <> public.patch83u_expected_auth_email(v_employee_id)
    then
      raise exception 'PATCH83U_MANAGED_AUTH_IDENTITY_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.patch83u_guard_role_activation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_credential_state text;
  v_credential_org_id uuid;
  v_identity_mode text;
  v_has_credential_state boolean := false;
  v_controlled_restore boolean := false;
  v_profile_org_id uuid;
begin
  v_controlled_restore := auth.role() = 'service_role'
    and coalesce(current_setting('patch83u.controlled_role_restore', true), '') = 'on';

  if not new.is_active then
    return new;
  end if;

  select p.organization_id
  into v_profile_org_id
  from public.profiles p
  where p.id = new.user_id
    and p.organization_id is not null
    and p.is_active = true
    and (
      p.user_status = 'active'
      or (v_controlled_restore and p.user_status = 'invited')
    )
  -- Serialize the lifecycle decision with profile UPDATE. A role INSERT/active
  -- UPDATE that started before deactivation must wait, re-read the committed
  -- lifecycle, and fail instead of committing an active role afterward.
  for share;
  if v_profile_org_id is null then
    raise exception 'PATCH83U_ACTIVE_ROLE_PROFILE_LIFECYCLE_INVALID';
  end if;

  if not public.patch83u_role_scope_allowed(new.role, new.scope) then
    raise exception 'PATCH83U_ACTIVE_ROLE_SCOPE_NOT_ALLOWED';
  end if;

  if not public.patch83u_role_assignment_valid(
    v_profile_org_id, new.scope, new.organization_id,
    new.division_id, new.department_id, new.unit_id
  ) then
    raise exception 'PATCH83U_ACTIVE_ROLE_REFERENCE_INVALID';
  end if;
  select true, cs.credential_state, cs.organization_id, cs.identity_mode
  into v_has_credential_state, v_credential_state, v_credential_org_id, v_identity_mode
  from public.user_credential_states cs
  where cs.user_id = new.user_id;

  if not coalesce(v_has_credential_state, false)
    or v_credential_org_id is distinct from v_profile_org_id
    or (
      not public.patch83u_runtime_credential_state_allowed(
        v_credential_state, v_identity_mode
      )
      and not v_controlled_restore
    )
  then
    raise exception 'PATCH83U_ACTIVE_ROLE_CREDENTIAL_LOCKED';
  end if;

  return new;
end;
$$;

create or replace function public.patch83u_guard_last_super_admin_role_removal()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_target_eligible boolean := false;
  v_marker text;
begin
  if old.is_active = false or old.role <> 'super_admin' or old.scope <> 'global' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select p.organization_id,
         p.is_active = true
           and p.user_status = 'active'
           and cs.organization_id = p.organization_id
           and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
           and public.patch83u_runtime_super_admin_eligible(old.user_id, p.organization_id)
  into v_org_id, v_target_eligible
  from public.profiles p
  left join public.user_credential_states cs on cs.user_id = p.id
  where p.id = old.user_id;

  if v_org_id is null
    or not coalesce(v_target_eligible, false)
    or not public.patch83u_role_assignment_valid(
      v_org_id, old.scope, old.organization_id,
      old.division_id, old.department_id, old.unit_id
    )
  then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE'
    and new.user_id = old.user_id
    and new.is_active = true
    and new.role = 'super_admin'
    and new.scope = 'global'
    and public.patch83u_role_assignment_valid(
      v_org_id, new.scope, new.organization_id,
      new.division_id, new.department_id, new.unit_id
    )
  then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('patch83u-super-admin-eligibility:' || v_org_id::text, 0)
  );

  v_marker := coalesce(current_setting('patch83u.super_admin_batch_guard_verified', true), '');
  if v_marker = v_org_id::text || ':' || coalesce(auth.uid()::text, '') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if auth.uid() = old.user_id then
    raise exception 'PATCH83U_SELF_ROLE_DEACTIVATION_DENIED';
  end if;

  perform 1
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  join public.user_credential_states cs on cs.user_id = p.id
  where ur.user_id <> old.user_id
    and ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and public.patch83u_role_assignment_valid(
      v_org_id, ur.scope, ur.organization_id,
      ur.division_id, ur.department_id, ur.unit_id
    )
    and p.organization_id = v_org_id
    and p.is_active = true
    and p.user_status = 'active'
    and cs.organization_id = v_org_id
    and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
    and public.patch83u_runtime_super_admin_eligible(ur.user_id, v_org_id)
  for update of ur, p, cs;

  if not found then
    raise exception 'PATCH83U_LAST_SUPER_ADMIN_ROLE_DEACTIVATION_DENIED';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.patch83u_suspend_roles_for_credential_lock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  -- Credential state makes an existing assignment ineffective while enforcement
  -- is active. It never rewrites or deletes the canonical user_roles row.
  new.role_suspension_id := null;
  return new;
end;
$$;

drop trigger if exists trg_patch83u_guard_managed_profile_employee_id on public.profiles;
create trigger trg_patch83u_guard_managed_profile_employee_id
before update of employee_no, email on public.profiles
for each row execute function public.patch83u_guard_managed_profile_employee_id();

drop trigger if exists trg_patch83u_guard_profile_security_boundary on public.profiles;
create trigger trg_patch83u_guard_profile_security_boundary
before insert or update of organization_id, user_status, is_active,
  deactivated_at, deactivated_by, deactivation_reason
on public.profiles
for each row execute function public.patch83u_guard_profile_security_boundary();

drop trigger if exists trg_patch83u_guard_credential_identity on public.user_credential_states;
create trigger trg_patch83u_guard_credential_identity
before insert or update of user_id, auth_email, identity_mode
on public.user_credential_states
for each row execute function public.patch83u_guard_credential_identity();

drop trigger if exists trg_patch83u_guard_role_activation on public.user_roles;
create trigger trg_patch83u_guard_role_activation
before insert or update of user_id, role, scope, organization_id,
  division_id, department_id, unit_id, is_active
on public.user_roles
for each row execute function public.patch83u_guard_role_activation();

drop trigger if exists trg_patch83u_suspend_roles_for_credential_lock on public.user_credential_states;

drop trigger if exists trg_patch83u_guard_last_super_admin_role_removal on public.user_roles;
create trigger trg_patch83u_guard_last_super_admin_role_removal
before update or delete on public.user_roles
for each row execute function public.patch83u_guard_last_super_admin_role_removal();

drop trigger if exists trg_patch83u_credential_states_updated_at on public.user_credential_states;
create trigger trg_patch83u_credential_states_updated_at
before update on public.user_credential_states
for each row execute function public.patch83u_set_updated_at();

drop trigger if exists trg_patch83u_suspended_roles_updated_at on public.user_credential_suspended_roles;
create trigger trg_patch83u_suspended_roles_updated_at
before update on public.user_credential_suspended_roles
for each row execute function public.patch83u_set_updated_at();

drop trigger if exists trg_patch83u_runtime_control_updated_at on public.patch83u_runtime_control;
create trigger trg_patch83u_runtime_control_updated_at
before update on public.patch83u_runtime_control
for each row execute function public.patch83u_set_updated_at();

drop trigger if exists trg_patch83u_credential_operations_updated_at on public.patch83u_credential_operations;
create trigger trg_patch83u_credential_operations_updated_at
before update on public.patch83u_credential_operations
for each row execute function public.patch83u_set_updated_at();

-- ---------------------------------------------------------------------------
-- Legacy compatibility and lifecycle synchronization
-- ---------------------------------------------------------------------------

insert into public.user_credential_states (
  user_id,
  organization_id,
  auth_email,
  identity_mode,
  credential_state,
  requested_lifecycle,
  credential_version,
  session_valid_after,
  created_at,
  updated_at
)
select
  p.id,
  p.organization_id,
  lower(coalesce(
    nullif(btrim(u.email), ''),
    'unverified-' || p.id::text || '@identity.invalid'
  )),
  case
    when u.id is not null
      and nullif(btrim(u.email), '') is not null
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and public.patch83u_auth_credential_version(u.raw_app_meta_data) = 0
      and 1 = (
        select count(*)
        from auth.identities ai
        where ai.user_id = u.id
          and ai.provider = 'email'
      )
      and 1 = (
        select count(*)
        from auth.identities ai
        where ai.user_id = u.id
          and ai.provider = 'email'
          and lower(btrim(coalesce(ai.identity_data ->> 'email', '')))
            = lower(btrim(u.email))
      )
      then 'legacy_verified'
    else 'unverified'
  end,
  case
    when p.user_status = 'active'
      and p.is_active = true
      and u.id is not null
      and nullif(btrim(u.email), '') is not null
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and public.patch83u_auth_credential_version(u.raw_app_meta_data) = 0
      and 1 = (
        select count(*)
        from auth.identities ai
        where ai.user_id = u.id
          and ai.provider = 'email'
      )
      and 1 = (
        select count(*)
        from auth.identities ai
        where ai.user_id = u.id
          and ai.provider = 'email'
          and lower(btrim(coalesce(ai.identity_data ->> 'email', '')))
            = lower(btrim(u.email))
      )
      then 'existing_password_rotation_pending'
    when p.user_status = 'active' and p.is_active = true
      then 'reconciliation_required'
    when p.user_status = 'invited' then 'reconciliation_required'
    else 'disabled'
  end,
  p.user_status,
  0,
  to_timestamp(0),
  now(),
  now()
from public.profiles p
left join auth.users u on u.id = p.id
where p.organization_id is not null
on conflict (user_id) do nothing;

insert into public.user_credential_events (
  organization_id,
  user_id,
  event_type,
  credential_version,
  event_code,
  details
)
select
  cs.organization_id,
  cs.user_id,
  'legacy_state_backfilled',
  cs.credential_version,
  'PATCH83U_LEGACY_BACKFILL',
  jsonb_build_object(
    'credential_state', cs.credential_state,
    'identity_mode', cs.identity_mode,
    'auth_identity_verified', cs.identity_mode = 'legacy_verified',
    'employee_id_alias_enforced', false
  )
from public.user_credential_states cs
where not exists (
  select 1
  from public.user_credential_events e
  where e.user_id = cs.user_id
    and e.event_type = 'legacy_state_backfilled'
);

insert into public.user_credential_events (
  organization_id, user_id, event_type, credential_version, event_code, details
)
select cs.organization_id, cs.user_id, 'existing_password_rotation_scheduled',
  cs.credential_version, 'PATCH83U_EXISTING_ROTATION_SCHEDULED',
  jsonb_build_object('role_rows_preserved', true, 'password_preserved', true)
from public.user_credential_states cs
where cs.credential_state = 'existing_password_rotation_pending'
  and not exists (
    select 1 from public.user_credential_events e
    where e.user_id = cs.user_id
      and e.event_type = 'existing_password_rotation_scheduled'
  );

-- Credential rotation never rewrites existing user_roles rows. Runtime-aware RLS
-- makes those rows ineffective only after controlled enforcement.
drop trigger if exists trg_patch83u_suspend_roles_for_credential_lock
on public.user_credential_states;

create or replace function public.patch83u_sync_profile_credential_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_auth_email text;
  v_next_state text;
  v_controlled_update_count integer := 0;
begin
  if new.organization_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select lower(nullif(btrim(u.email), ''))
    into v_auth_email
    from auth.users u
    where u.id = new.id;
    v_auth_email := coalesce(v_auth_email, lower(new.email));
    -- Legacy rows were backfilled before this trigger was installed. Every new
    -- generic profile fails closed until a controlled identity flow proves its
    -- Auth record and establishes the appropriate credential state.
    v_next_state := case
      when new.user_status in ('inactive', 'archived', 'locked') or new.is_active = false
        then 'disabled'
      else 'reconciliation_required'
    end;

    insert into public.user_credential_states (
      user_id, organization_id, auth_email, identity_mode, credential_state,
      requested_lifecycle, credential_version, session_valid_after
    ) values (
      new.id, new.organization_id, v_auth_email, 'unverified', v_next_state,
      new.user_status, 0, to_timestamp(0)
    ) on conflict (user_id) do nothing;
    return new;
  end if;

  -- Password-change finalization and protected reconciliation already proved
  -- and wrote the terminal credential state before activating the profile.
  -- Their exact service-only marker suppresses only the generic reactivation
  -- rewrite; it still keeps the requested lifecycle aligned to this profile.
  if coalesce(
    current_setting('patch83u.controlled_lifecycle_transition', true),
    ''
  ) = 'on' then
    if auth.role() is distinct from 'service_role'
      or new.user_status <> 'active'
      or new.is_active is distinct from true
    then
      raise exception 'PATCH83U_CONTROLLED_LIFECYCLE_TRANSITION_INVALID';
    end if;

    update public.user_credential_states
    set requested_lifecycle = 'active'
    where user_id = new.id
      and organization_id = new.organization_id;
    get diagnostics v_controlled_update_count = row_count;
    if v_controlled_update_count <> 1 then
      raise exception 'PATCH83U_CONTROLLED_LIFECYCLE_STATE_PROOF_FAILED';
    end if;
    return new;
  end if;

  if (new.user_status is distinct from old.user_status or new.is_active is distinct from old.is_active)
    and exists (
      select 1
      from public.user_credential_states cs
      where cs.user_id = new.id
        and (
          cs.credential_state in ('reset_in_progress', 'password_change_in_progress')
          or (
            cs.credential_state in ('recovery_required', 'reconciliation_required')
            and cs.operation_source is not null
          )
        )
    )
  then
    raise exception 'PATCH83U_CREDENTIAL_OPERATION_IN_PROGRESS';
  end if;

  if new.user_status in ('inactive', 'archived', 'locked') or new.is_active = false then
    update public.user_credential_states
    set credential_state = 'disabled',
        requested_lifecycle = new.user_status,
        session_valid_after = clock_timestamp(),
        pending_operation_id = null,
        operation_source = null,
        reconciliation_auth_changed = false,
        pending_session_id = null,
        pending_credential_version = null,
        operation_previous_state = null,
        operation_previous_lifecycle = null,
        operation_previous_session_valid_after = null
    where user_id = new.id;

    insert into public.user_credential_events (
      organization_id, user_id, actor_id, event_type, credential_version, event_code,
      details
    )
    select new.organization_id, new.id, auth.uid(), 'credential_disabled',
      cs.credential_version, 'PATCH83U_PROFILE_LIFECYCLE_BLOCKED',
      jsonb_build_object('user_status', new.user_status)
    from public.user_credential_states cs
    where cs.user_id = new.id;
  elsif new.user_status = 'invited'
    and old.user_status is distinct from 'invited'
  then
    update public.user_credential_states
    set credential_state = case
          when identity_mode in ('employee_id_managed', 'legacy_verified')
            then 'initial_change_required'
          else 'reconciliation_required'
        end,
        requested_lifecycle = 'invited',
        session_valid_after = clock_timestamp(),
        pending_operation_id = null,
        operation_source = null,
        reconciliation_auth_changed = false,
        pending_session_id = null,
        pending_credential_version = null,
        operation_previous_state = null,
        operation_previous_lifecycle = null,
        operation_previous_session_valid_after = null
    where user_id = new.id
      and credential_state not in ('reset_in_progress', 'password_change_in_progress');
  elsif new.user_status = 'active'
    and new.is_active = true
    and (old.user_status in ('inactive', 'archived', 'locked', 'invited') or old.is_active = false)
  then
    update public.user_credential_states
    set credential_state = case
          when identity_mode in ('employee_id_managed', 'legacy_verified')
            then 'reactivation_change_required'
          else 'reconciliation_required'
        end,
        requested_lifecycle = 'active',
        session_valid_after = clock_timestamp(),
        pending_operation_id = null,
        operation_source = null,
        reconciliation_auth_changed = false,
        pending_session_id = null,
        pending_credential_version = null,
        operation_previous_state = null,
        operation_previous_lifecycle = null,
        operation_previous_session_valid_after = null
    where user_id = new.id
      and credential_state not in ('reset_in_progress', 'password_change_in_progress');

    insert into public.user_credential_events (
      organization_id, user_id, actor_id, event_type, credential_version, event_code,
      details
    )
    select new.organization_id, new.id, auth.uid(), 'credential_reactivation_required',
      cs.credential_version, 'PATCH83U_PROFILE_REACTIVATED', '{}'::jsonb
    from public.user_credential_states cs
    where cs.user_id = new.id
      and cs.credential_state = 'reactivation_change_required';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_patch83u_sync_profile_credential_lifecycle on public.profiles;
create trigger trg_patch83u_sync_profile_credential_lifecycle
after insert or update of user_status, is_active on public.profiles
for each row execute function public.patch83u_sync_profile_credential_lifecycle();

-- ---------------------------------------------------------------------------
-- Credential-version, Auth-email, and session-freshness RLS gate
-- ---------------------------------------------------------------------------

create or replace function public.patch83u_credential_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select case public.patch83u_runtime_enforcement_state()
    when 'disabled' then auth.uid() is not null
    when 'prepared' then auth.uid() is not null
    when 'emergency_suspended' then exists (
      select 1
      from public.user_credential_states cs
      join public.profiles p
        on p.id = cs.user_id
       and p.organization_id = cs.organization_id
      where cs.user_id = auth.uid()
        and cs.identity_mode = 'legacy_verified'
        and cs.credential_state <> 'disabled'
        and p.is_active = true
        and p.user_status = 'active'
        and lower(coalesce(auth.jwt() ->> 'email', '')) = cs.auth_email
        and public.patch83u_auth_credential_version(
          auth.jwt() -> 'app_metadata'
        ) = cs.credential_version
        and coalesce(auth.jwt() ->> 'session_id', '') ~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and (
          cs.invalidated_session_id is null
          or cs.invalidated_session_id <> (auth.jwt() ->> 'session_id')::uuid
        )
        and exists (
          select 1 from auth.sessions s
          where s.id = (auth.jwt() ->> 'session_id')::uuid
            and s.user_id = cs.user_id
            and s.created_at >= cs.session_valid_after
        )
    )
    when 'enforced' then
      public.patch83u_request_frontend_contract_compatible()
      and exists (
        select 1
        from public.user_credential_states cs
        join public.profiles p
          on p.id = cs.user_id
         and p.organization_id = cs.organization_id
        where cs.user_id = auth.uid()
          and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
          and cs.credential_state = 'active'
          and p.is_active = true
          and p.user_status = 'active'
          and lower(coalesce(auth.jwt() ->> 'email', '')) = cs.auth_email
          and public.patch83u_auth_credential_version(
            auth.jwt() -> 'app_metadata'
          ) = cs.credential_version
          and coalesce(auth.jwt() ->> 'session_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          and exists (
            select 1
            from auth.sessions s
            where s.id = (auth.jwt() ->> 'session_id')::uuid
              and s.user_id = cs.user_id
              and s.created_at >= cs.session_valid_after
          )
          and (
            cs.invalidated_session_id is null
            or auth.jwt() ->> 'session_id' <> cs.invalidated_session_id::text
          )
      )
    else false
  end;
$$;

create or replace function public.patch83u_profile_update_allowed(
  p_target_user_id uuid,
  p_target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles actor
    join public.user_credential_states cs
      on cs.user_id = actor.id
     and cs.organization_id = actor.organization_id
    where actor.id = auth.uid()
      and actor.organization_id = p_target_organization_id
      and actor.is_active = true
      and actor.user_status = 'active'
      and public.patch83u_credential_access_allowed()
      and (
        p_target_user_id = actor.id
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = actor.id
            and ur.is_active = true
            and ur.role in ('super_admin', 'governance_admin')
            and ur.scope = 'global'
            and public.patch83u_role_assignment_valid(
              actor.organization_id, ur.scope, ur.organization_id,
              ur.division_id, ur.department_id, ur.unit_id
            )
        )
      )
  );
$$;

create or replace function public.patch83u_user_role_mutation_allowed(
  p_target_user_id uuid,
  p_role public.app_role,
  p_scope public.access_scope,
  p_role_organization_id uuid,
  p_division_id uuid,
  p_department_id uuid,
  p_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles actor
    join public.user_credential_states actor_state
      on actor_state.user_id = actor.id
     and actor_state.organization_id = actor.organization_id
    join public.profiles target
      on target.id = p_target_user_id
     and target.organization_id = actor.organization_id
    join public.user_roles actor_role
      on actor_role.user_id = actor.id
     and actor_role.is_active = true
     and actor_role.role in ('super_admin', 'governance_admin')
     and actor_role.scope = 'global'
     and (actor_role.organization_id is null or actor_role.organization_id = actor.organization_id)
     and actor_role.division_id is null
     and actor_role.department_id is null
     and actor_role.unit_id is null
    where actor.id = auth.uid()
      and actor.id <> p_target_user_id
      and actor.is_active = true
      and actor.user_status = 'active'
      and public.patch83u_credential_access_allowed()
      and public.patch83u_role_scope_allowed(p_role, p_scope)
      and public.patch83u_role_assignment_valid(
        target.organization_id, p_scope, p_role_organization_id,
        p_division_id, p_department_id, p_unit_id
      )
      and (
        p_role not in ('super_admin', 'executive', 'governance_admin')
        or actor_role.role = 'super_admin'
      )
  );
$$;

-- Restrictive policies are ANDed with every existing permissive policy. This
-- closes direct owner/assignee branches as well as role-helper branches while
-- preserving the original policy logic for credential-active users.
--
-- Twenty-nine legacy release/operations tables are read through authenticated
-- browser views but predate the repository's RLS baseline. Harden only that
-- audited set before installing the universal restrictive gate. The permissive
-- compatibility policy preserves the former operation shape for credential-
-- active callers while adding tenant scope wherever the legacy table has a
-- stable organization_id. The eleven tables without a tenant key contain
-- global release metadata and therefore receive credential-gated global scope.
-- SELECT is explicit because security-invoker views require base-relation
-- privileges; this grants no mutation privilege and creates no new view grant.
do $patch83u_legacy_browser_base_tables$
declare
  v_table record;
begin
  for v_table in
    select *
    from (
      values
        ('automation_rules', true),
        ('automation_run_log', true),
        ('consolidation_defect_log', true),
        ('executive_exception_rules', true),
        ('final_handover_signoffs', true),
        ('go_live_rehearsals', true),
        ('kri_observations', true),
        ('load_test_seed_batches', true),
        ('migration_runbook_entries', true),
        ('pilot_issues', true),
        ('pilot_participants', true),
        ('pilot_signoffs', true),
        ('pilot_waves', true),
        ('production_pilot_waves', true),
        ('production_proof_gates', true),
        ('recurring_reviews', true),
        ('staging_validation_check_results', true),
        ('staging_validation_cycles', true),
        ('consolidation_defects', false),
        ('consolidation_patch_manifest', false),
        ('cutover_freeze_windows', false),
        ('go_live_sop_steps', false),
        ('pilot_fix_sprints', false),
        ('pilot_rollout_acceptance', false),
        ('production_operator_daily_log', false),
        ('production_support_handover', false),
        ('real_data_repair_queue', false),
        ('v50_query_optimization_items', false),
        ('v50_scale_test_plans', false)
    ) as audited(table_name, organization_scoped)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table.table_name
        and c.relkind in ('r', 'p')
    ) then
      raise exception 'PATCH83U_AUDITED_BROWSER_BASE_TABLE_MISSING:%',
        v_table.table_name;
    end if;

    execute format(
      'alter table %I.%I enable row level security',
      'public', v_table.table_name
    );
    execute format(
      'drop policy if exists patch83u_browser_base_scope on %I.%I',
      'public', v_table.table_name
    );

    if v_table.organization_scoped then
      execute format(
        'create policy patch83u_browser_base_scope on %I.%I as permissive for all to authenticated using (organization_id = public.current_user_org_id() and public.patch83u_credential_access_allowed()) with check (organization_id = public.current_user_org_id() and public.patch83u_credential_access_allowed())',
        'public', v_table.table_name
      );
    else
      execute format(
        'create policy patch83u_browser_base_scope on %I.%I as permissive for all to authenticated using (public.patch83u_credential_access_allowed()) with check (public.patch83u_credential_access_allowed())',
        'public', v_table.table_name
      );
    end if;

    execute format(
      'grant select on table %I.%I to authenticated',
      'public', v_table.table_name
    );
  end loop;
end;
$patch83u_legacy_browser_base_tables$;

do $patch83u_rls$
declare
  v_table record;
begin
  for v_table in
    select n.nspname as schema_name, c.relname as table_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity = true
      and c.relname <> 'profiles'
  loop
    execute format(
      'drop policy if exists patch83u_credential_gate on %I.%I',
      v_table.schema_name,
      v_table.table_name
    );
    execute format(
      'create policy patch83u_credential_gate on %I.%I as restrictive for all to authenticated using (public.patch83u_credential_access_allowed()) with check (public.patch83u_credential_access_allowed())',
      v_table.schema_name,
      v_table.table_name
    );
  end loop;
end;
$patch83u_rls$;

-- Preserve the existing authenticated view grant set while removing owner
-- execution from every ordinary public view that the authenticated role can
-- currently read (including grants inherited from PUBLIC). This catalog loop
-- also covers deployed-schema ACL drift without broadening access. An exposed
-- materialized view cannot inherit base-table RLS, so migration 174 fails closed
-- instead of accepting that surface.
do $patch83u_authenticated_views$
declare
  v_view record;
begin
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'm'
      and has_table_privilege('authenticated', c.oid, 'SELECT')
  ) then
    raise exception 'PATCH83U_AUTHENTICATED_MATERIALIZED_VIEW_EXPOSURE';
  end if;

  for v_view in
    select n.nspname as schema_name, c.relname as view_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and has_table_privilege('authenticated', c.oid, 'SELECT')
  loop
    execute format(
      'alter view %I.%I set (security_invoker = true)',
      v_view.schema_name, v_view.view_name
    );
  end loop;
end;
$patch83u_authenticated_views$;

-- Close the historical direct-browser search exception in both governed
-- runtime registries. The browser now calls the authenticated Edge bridge; the
-- bridge first enforces exact Patch 83U credential/session state and then calls
-- the SECURITY INVOKER search RPC with a caller-JWT client so view/base RLS is
-- still authoritative.
insert into public.runtime_rpc_classifications (
  rpc_name,
  frontend_transport,
  classification,
  risk_level,
  allowed_frontend_use,
  requires_authenticated_bridge,
  service_role_only,
  reviewed_at,
  signoff_status,
  signoff_notes,
  source_file,
  source_line,
  bridge_validation_status,
  production_exception_reason
) values (
  'search_grc_global',
  'authenticated_edge_bridge',
  'edge_bridge_required',
  'medium',
  true,
  true,
  false,
  now(),
  'approved_for_production',
  'Patch 83U exact credential/email/version/session enforcement precedes a caller-JWT SECURITY INVOKER search; security-invoker views and credential-gated base-table RLS remain authoritative.',
  'src/lib/commandCenterApi.ts',
  181,
  'authenticated_bridge_present',
  null
)
on conflict (rpc_name) do update set
  frontend_transport = excluded.frontend_transport,
  classification = excluded.classification,
  risk_level = excluded.risk_level,
  allowed_frontend_use = excluded.allowed_frontend_use,
  requires_authenticated_bridge = excluded.requires_authenticated_bridge,
  service_role_only = excluded.service_role_only,
  reviewed_at = excluded.reviewed_at,
  signoff_status = excluded.signoff_status,
  signoff_notes = excluded.signoff_notes,
  source_file = excluded.source_file,
  source_line = excluded.source_line,
  bridge_validation_status = excluded.bridge_validation_status,
  production_exception_reason = excluded.production_exception_reason,
  updated_at = now();

insert into public.runtime_action_reviews (
  action_name,
  action_transport,
  module_name,
  risk_level,
  classification,
  review_status,
  required_access_level,
  owner_role,
  review_notes,
  reviewed_at
) values (
  'search_grc_global',
  'authenticated_edge_bridge',
  'Global Search',
  'medium',
  'read_only_search',
  'approved',
  'credential-active authenticated user with caller-JWT RLS-scoped access',
  'Governance Platform Owner',
  'Direct browser RPC exception closed. The Edge bridge enforces Patch 83U credential state before retaining caller-scoped RLS for the read.',
  now()
)
on conflict (action_name) do update set
  action_transport = excluded.action_transport,
  module_name = excluded.module_name,
  risk_level = excluded.risk_level,
  classification = excluded.classification,
  review_status = excluded.review_status,
  required_access_level = excluded.required_access_level,
  owner_role = excluded.owner_role,
  review_notes = excluded.review_notes,
  reviewed_at = excluded.reviewed_at;

-- The historical permissive user_roles policy authorizes broad role names and
-- is intentionally preserved for read compatibility. These restrictive
-- mutation policies are ANDed with it so direct PostgREST writes cannot bypass
-- the service-only Patch 83U role routines, tenant boundary, canonical global
-- administrator shape, privileged-role authority, or non-self rule.
drop policy if exists patch83u_user_roles_insert_gate on public.user_roles;
create policy patch83u_user_roles_insert_gate
on public.user_roles as restrictive for insert to authenticated
with check (public.patch83u_user_role_mutation_allowed(
  user_id, role, scope, organization_id, division_id, department_id, unit_id
));

drop policy if exists patch83u_user_roles_update_gate on public.user_roles;
create policy patch83u_user_roles_update_gate
on public.user_roles as restrictive for update to authenticated
using (public.patch83u_user_role_mutation_allowed(
  user_id, role, scope, organization_id, division_id, department_id, unit_id
))
with check (public.patch83u_user_role_mutation_allowed(
  user_id, role, scope, organization_id, division_id, department_id, unit_id
));

drop policy if exists patch83u_user_roles_delete_gate on public.user_roles;
create policy patch83u_user_roles_delete_gate
on public.user_roles as restrictive for delete to authenticated
using (public.patch83u_user_role_mutation_allowed(
  user_id, role, scope, organization_id, division_id, department_id, unit_id
));

drop policy if exists patch83u_profile_credential_read_gate on public.profiles;
create policy patch83u_profile_credential_read_gate
on public.profiles as restrictive for select to authenticated
using (public.patch83u_credential_access_allowed());

drop policy if exists patch83u_profile_credential_insert_gate on public.profiles;
create policy patch83u_profile_credential_insert_gate
on public.profiles as restrictive for insert to authenticated
-- Profile creation is a protected provisioning operation. The service role
-- bypasses authenticated RLS only after Edge/database actor validation; a
-- browser identity can never self-create a tenant profile in any runtime state.
with check (false);

drop policy if exists patch83u_profile_credential_update_gate on public.profiles;
create policy patch83u_profile_credential_update_gate
on public.profiles as restrictive for update to authenticated
using (public.patch83u_credential_access_allowed())
with check (public.patch83u_credential_access_allowed());

drop policy if exists patch83u_profile_same_org_update_gate on public.profiles;
create policy patch83u_profile_same_org_update_gate
on public.profiles as restrictive for update to authenticated
using (public.patch83u_profile_update_allowed(id, organization_id))
with check (public.patch83u_profile_update_allowed(id, organization_id));

drop policy if exists patch83u_profile_credential_delete_gate on public.profiles;
create policy patch83u_profile_credential_delete_gate
on public.profiles as restrictive for delete to authenticated
using (public.patch83u_credential_access_allowed());

-- Storage policies live outside public and therefore are not reached by the
-- public-table loop. These restrictive gates are ANDed with the existing
-- evidence/object policies and do not broaden bucket or object access.
drop policy if exists patch83u_storage_credential_read_gate on storage.objects;
create policy patch83u_storage_credential_read_gate
on storage.objects as restrictive for select to authenticated
using (public.patch83u_credential_access_allowed());

drop policy if exists patch83u_storage_credential_insert_gate on storage.objects;
create policy patch83u_storage_credential_insert_gate
on storage.objects as restrictive for insert to authenticated
with check (public.patch83u_credential_access_allowed());

drop policy if exists patch83u_storage_credential_update_gate on storage.objects;
create policy patch83u_storage_credential_update_gate
on storage.objects as restrictive for update to authenticated
using (public.patch83u_credential_access_allowed())
with check (public.patch83u_credential_access_allowed());

drop policy if exists patch83u_storage_credential_delete_gate on storage.objects;
create policy patch83u_storage_credential_delete_gate
on storage.objects as restrictive for delete to authenticated
using (public.patch83u_credential_access_allowed());

-- ---------------------------------------------------------------------------
-- Self state and administrator provisioning reads
-- ---------------------------------------------------------------------------

create or replace function public.patch83u_get_credential_state(
  p_actor_id uuid,
  p_token_credential_version integer,
  p_token_email text,
  p_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_result jsonb;
  v_token_matches boolean := false;
  v_verified_session_id uuid;
  v_runtime_state text;
  v_profile public.profiles%rowtype;
  v_state public.user_credential_states%rowtype;
  v_access_allowed boolean := false;
begin
  perform public.patch83u_require_service_role();
  v_runtime_state := public.patch83u_runtime_enforcement_state();

  if p_actor_id is null
    or p_token_credential_version is null
    or p_token_credential_version < 0
    or lower(btrim(coalesce(p_token_email, ''))) <> btrim(coalesce(p_token_email, ''))
    or coalesce(p_session_id, '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  then
    v_token_matches := false;
  else
    v_verified_session_id := p_session_id::uuid;
    select exists (
      select 1
      from auth.sessions s
      where s.id = v_verified_session_id
        and s.user_id = p_actor_id
    )
    into v_token_matches;
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id = p_actor_id
  for update;
  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_actor_id
    and cs.organization_id = v_profile.organization_id
  for update;

  if v_profile.id is null or v_state.user_id is null then
    return jsonb_build_object(
      'managed', false,
      'user_id', p_actor_id,
      'credential_state', 'unmanaged',
      'credential_version', 0,
      'password_reset_at', null,
      'access_allowed', false,
      'change_required', false,
      'recovery_required', false,
      'reconciliation_required', true,
      'auth_email', null,
      'message', 'This account does not have a managed credential record.'
    );
  end if;

  if v_runtime_state = 'enforced'
    and v_state.credential_state = 'existing_password_rotation_pending'
    and v_state.identity_mode = 'legacy_verified'
    and v_profile.is_active = true
    and v_profile.user_status = 'active'
    and v_token_matches
    and v_state.credential_version = p_token_credential_version
    and v_state.auth_email = lower(btrim(coalesce(p_token_email, '')))
    and exists (
      select 1 from auth.sessions s
      where s.id = v_verified_session_id
        and s.user_id = p_actor_id
        and s.created_at >= v_state.session_valid_after
    )
  then
    update public.user_credential_states
    set credential_state = 'existing_password_change_required'
    where user_id = p_actor_id
      and credential_state = 'existing_password_rotation_pending';
    if found then
      insert into public.user_credential_events (
        organization_id, user_id, actor_id, event_type, credential_version,
        session_id, event_code, details
      ) values (
        v_state.organization_id, p_actor_id, p_actor_id,
        'existing_password_rotation_required', v_state.credential_version,
        v_verified_session_id, 'PATCH83U_EXISTING_ROTATION_REQUIRED',
        jsonb_build_object('role_rows_preserved', true, 'lazy_transition', true)
      );
      v_state.credential_state := 'existing_password_change_required';
    end if;
  end if;

  v_access_allowed := case v_runtime_state
    when 'disabled' then
      v_token_matches and v_profile.is_active and v_profile.user_status = 'active'
    when 'prepared' then
      v_token_matches and v_profile.is_active and v_profile.user_status = 'active'
    when 'emergency_suspended' then
      v_token_matches
      and v_profile.is_active
      and v_profile.user_status = 'active'
      and v_state.identity_mode = 'legacy_verified'
      and v_state.credential_state <> 'disabled'
      and v_state.credential_version = p_token_credential_version
      and v_state.auth_email = lower(btrim(coalesce(p_token_email, '')))
      and (
        v_state.invalidated_session_id is null
        or v_state.invalidated_session_id <> v_verified_session_id
      )
      and exists (
        select 1 from auth.sessions s
        where s.id = v_verified_session_id
          and s.user_id = p_actor_id
          and s.created_at >= v_state.session_valid_after
      )
    when 'enforced' then
      v_state.credential_state = 'active'
      and v_state.identity_mode in ('employee_id_managed', 'legacy_verified')
      and v_profile.is_active
      and v_profile.user_status = 'active'
      and v_token_matches
      and v_state.credential_version = p_token_credential_version
      and v_state.auth_email = lower(btrim(coalesce(p_token_email, '')))
      and (v_state.invalidated_session_id is null or v_state.invalidated_session_id <> v_verified_session_id)
      and exists (
        select 1 from auth.sessions s
        where s.id = v_verified_session_id
          and s.user_id = p_actor_id
          and s.created_at >= v_state.session_valid_after
      )
    else false
  end;

  select jsonb_build_object(
    'managed', true,
    'user_id', v_profile.id,
    'organization_id', v_profile.organization_id,
    'auth_email', v_state.auth_email,
    'identity_mode', v_state.identity_mode,
    'credential_state', v_state.credential_state,
    'credential_version', v_state.credential_version,
    'password_reset_at', v_state.password_reset_at,
    'requested_lifecycle', v_state.requested_lifecycle,
    'user_status', v_profile.user_status,
    'is_active', v_profile.is_active,
    'access_allowed', v_access_allowed,
    'change_required', v_state.credential_state in (
      'existing_password_change_required',
      'initial_change_required',
      'admin_reset_change_required',
      'reactivation_change_required',
      'password_change_in_progress'
    ),
    'recovery_required', v_state.credential_state = 'recovery_required',
    'reconciliation_required', v_state.credential_state in (
      'recovery_required', 'reconciliation_required',
      'session_revocation_review_required'
    ),
    'session_revocation_review_required',
      v_state.credential_state = 'session_revocation_review_required',
    'session_valid_after', v_state.session_valid_after,
    'message', case
      when v_state.credential_state in (
        'existing_password_change_required', 'initial_change_required',
        'admin_reset_change_required', 'reactivation_change_required'
      )
        then 'A password change is required before application access is allowed.'
      when v_state.credential_state = 'recovery_required'
        then 'A partially completed password change requires controlled recovery before application access is allowed.'
      when v_state.credential_state = 'session_revocation_review_required'
        then 'Session revocation requires administrator review before application access is allowed.'
      when v_state.credential_state = 'reconciliation_required'
        then 'Credential reconciliation is required before application access is allowed.'
      when v_state.credential_state = 'disabled'
        then 'This account is disabled.'
      when not v_token_matches
        then 'This session is no longer valid.'
      when v_state.credential_version <> p_token_credential_version
        then 'This session uses a stale credential version.'
      when v_state.auth_email <> lower(btrim(coalesce(p_token_email, '')))
        then 'This session does not match the managed sign-in identity.'
      else null
    end
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.patch83u_list_provisioning(p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_rows jsonb;
begin
  v_org_id := public.patch83u_require_super_admin(p_actor_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'import_batch_id', q.import_batch_id,
      'import_row_id', q.import_row_id,
      'employee_id', q.employee_id,
      'auth_email', q.auth_email,
      'contact_email', q.contact_email,
      'full_name_en', q.full_name_en,
      'full_name_ar', q.full_name_ar,
      'phone', q.phone,
      'department_id', q.department_id,
      'department_code', q.department_code,
      'job_title', q.job_title,
      'requested_role', q.requested_role,
      'requested_scope', q.requested_scope,
      'requested_user_type', q.requested_user_type,
      'requested_lifecycle', q.requested_lifecycle,
      'account_action', q.account_action,
      'provisioning_status', q.provisioning_status,
      'attempt_count', q.attempt_count,
      'last_error_code', q.last_error_code,
      'last_error_message', q.last_error_message,
      'profile_id', q.profile_id,
      'created_at', q.created_at,
      'updated_at', q.updated_at
    ) order by q.created_at desc, q.id
  ), '[]'::jsonb)
  into v_rows
  from public.user_account_provisioning q
  where q.organization_id = v_org_id;

  return jsonb_build_object(
    'organization_id', v_org_id,
    'rows', v_rows,
    'count', jsonb_array_length(v_rows)
  );
end;
$$;

create or replace function public.patch83u_claim_provisioning(
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
  v_attempt_id uuid := gen_random_uuid();
  v_auth_create_required boolean;
  v_existing_auth_user_id uuid;
begin
  perform public.patch83u_require_enforced_runtime();
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

  select q.*
  into v_queue
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
  if v_queue.provisioning_status in ('held_lifecycle', 'initial_change_required', 'completed', 'cancelled') then
    raise exception 'PATCH83U_PROVISIONING_STATE_INVALID: %', v_queue.provisioning_status;
  end if;
  if v_queue.provisioning_status = 'provisioning'
    and v_queue.lease_expires_at is not null
    and v_queue.lease_expires_at > now()
  then
    raise exception 'PATCH83U_PROVISIONING_LEASE_ACTIVE';
  end if;
  if v_queue.requested_lifecycle not in ('active', 'invited') then
    raise exception 'PATCH83U_PROVISIONING_LIFECYCLE_NOT_ELIGIBLE';
  end if;
  if v_queue.auth_email <> public.patch83u_expected_auth_email(v_queue.employee_id) then
    raise exception 'PATCH83U_PROVISIONING_IDENTITY_INVALID';
  end if;
  if exists (
    select 1
    from public.profiles p
    where lower(btrim(p.employee_no)) = lower(v_queue.employee_id)
      and (
        v_queue.profile_id is null
        or p.id <> v_queue.profile_id
        or btrim(p.employee_no) is distinct from v_queue.employee_id
      )
  ) or exists (
    select 1
    from public.user_account_provisioning other_q
    where other_q.id <> v_queue.id
      and other_q.provisioning_status not in ('completed', 'cancelled')
      and lower(btrim(other_q.employee_id)) = lower(v_queue.employee_id)
  ) then
    raise exception 'PATCH83U_EMPLOYEE_ID_CASE_INSENSITIVE_CONFLICT';
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
  if not public.patch83u_role_scope_allowed(v_queue.requested_role, v_queue.requested_scope) then
    raise exception 'PATCH83U_ROLE_SCOPE_INVALID';
  end if;
  if not exists (
    select 1
    from public.departments d
    where d.id = v_queue.department_id
      and d.organization_id = v_org_id
      and d.is_active = true
      and d.archived_at is null
      and d.division_id is not distinct from v_queue.division_id
      and lower(btrim(d.code)) = lower(btrim(v_queue.department_code))
  ) then
    raise exception 'PATCH83U_ACTIVE_DEPARTMENT_REQUIRED';
  end if;

  if exists (
    select 1
    from public.user_credential_states cs
    where lower(cs.auth_email) = lower(v_queue.auth_email)
      and (v_queue.auth_user_id is null or cs.user_id <> v_queue.auth_user_id)
  ) then
    raise exception 'PATCH83U_AUTH_EMAIL_CONFLICT';
  end if;

  select u.id
  into v_existing_auth_user_id
  from auth.users u
  where lower(btrim(u.email)) = v_queue.auth_email
  limit 1;

  if v_existing_auth_user_id is not null then
    if v_queue.auth_user_id is not null and v_queue.auth_user_id <> v_existing_auth_user_id then
      raise exception 'PATCH83U_AUTH_IDENTITY_CONFLICT';
    end if;
    if not exists (
      select 1
      from auth.users u
      where u.id = v_existing_auth_user_id
        and lower(btrim(u.email)) = v_queue.auth_email
        and u.raw_app_meta_data ->> 'patch83u_provisioning_id' = v_queue.id::text
        and public.patch83u_auth_credential_version(u.raw_app_meta_data) = 1
    ) then
      raise exception 'PATCH83U_EXISTING_AUTH_ACCOUNT_NOT_OWNED';
    end if;
    update public.user_account_provisioning
    set auth_user_id = v_existing_auth_user_id,
        auth_created_at = coalesce(auth_created_at, now())
    where id = v_queue.id;
    v_queue.auth_user_id := v_existing_auth_user_id;
  end if;

  v_auth_create_required := v_queue.auth_user_id is null;

  update public.user_account_provisioning
  set provisioning_status = 'provisioning',
      attempt_count = attempt_count + 1,
      attempt_id = v_attempt_id,
      request_id = btrim(p_request_id),
      lease_expires_at = now() + interval '5 minutes',
      claimed_at = now(),
      claimed_by = p_actor_id,
      last_error_code = null,
      last_error_message = null
  where id = v_queue.id;

  insert into public.user_credential_events (
    organization_id, provisioning_id, actor_id, event_type,
    credential_version, request_id, event_code, details
  ) values (
    v_org_id, v_queue.id, p_actor_id, 'provisioning_claimed',
    1, btrim(p_request_id), 'PATCH83U_PROVISIONING_CLAIMED',
    jsonb_build_object(
      'attempt_id', v_attempt_id,
      'auth_create_required', v_auth_create_required
    )
  );

  -- This complete normalized snapshot is returned only to the server-side Edge
  -- handler. That handler must not return employee_id or this object to a browser.
  return jsonb_build_object(
    'provisioning_id', v_queue.id,
    'attempt_id', v_attempt_id,
    'request_id', btrim(p_request_id),
    'organization_id', v_org_id,
    'auth_user_id', v_queue.auth_user_id,
    'employee_id', v_queue.employee_id,
    'auth_email', v_queue.auth_email,
    'contact_email', v_queue.contact_email,
    'full_name_en', v_queue.full_name_en,
    'full_name_ar', v_queue.full_name_ar,
    'phone', v_queue.phone,
    'division_id', v_queue.division_id,
    'department_id', v_queue.department_id,
    'department_code', v_queue.department_code,
    'job_title', v_queue.job_title,
    'requested_role', v_queue.requested_role,
    'requested_scope', v_queue.requested_scope,
    'requested_user_type', v_queue.requested_user_type,
    'requested_lifecycle', v_queue.requested_lifecycle,
    'account_action', v_queue.account_action,
    'auth_create_required', v_auth_create_required,
    'credential_version', 1,
    'lease_expires_at', now() + interval '5 minutes'
  );
end;
$$;

create or replace function public.patch83u_restore_suspended_roles(
  p_actor_id uuid,
  p_user_id uuid,
  p_suspension_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_actor_org_id uuid;
  v_credential_state text;
  v_snapshot public.user_credential_suspended_roles%rowtype;
  v_role public.user_roles%rowtype;
  v_role_id uuid;
  v_restored integer := 0;
  v_blocked integer := 0;
begin
  perform public.patch83u_require_service_role();

  select p.organization_id into v_org_id
  from public.profiles p
  where p.id = p_user_id
  for update;
  if v_org_id is null or p_suspension_id is null then
    raise exception 'PATCH83U_ROLE_RESTORE_CONTEXT_INVALID';
  end if;

  select cs.credential_state into v_credential_state
  from public.user_credential_states cs
  where cs.user_id = p_user_id
    and cs.organization_id = v_org_id
  for update;
  if v_credential_state is null then
    raise exception 'PATCH83U_ROLE_RESTORE_CREDENTIAL_STATE_REQUIRED';
  end if;
  if p_actor_id = p_user_id then
    if v_credential_state <> 'password_change_in_progress' then
      raise exception 'PATCH83U_SELF_ROLE_RESTORE_STATE_INVALID';
    end if;
  else
    v_actor_org_id := public.patch83u_require_super_admin(p_actor_id);
    if v_actor_org_id is distinct from v_org_id
      or v_credential_state not in (
        'reset_in_progress', 'recovery_required', 'reconciliation_required'
      )
    then
      raise exception 'PATCH83U_ADMIN_ROLE_RESTORE_CONTEXT_INVALID';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('patch83u-role-restore:' || p_suspension_id::text, 0)
  );

  -- The profile lock blocks concurrent FK-backed role inserts while all existing
  -- assignments are held stable. Hierarchy rows are share-locked below so a
  -- successful preflight cannot be invalidated between validation and restore.
  perform 1
  from public.user_roles ur
  where ur.user_id = p_user_id
  order by ur.id
  for update;

  -- Validate and lock the complete suspension set before reactivating any role.
  -- A single invalid snapshot keeps every role inactive so a recovery state can
  -- never be committed with a partially restored permission set.
  for v_snapshot in
    select sr.*
    from public.user_credential_suspended_roles sr
    where sr.suspension_id = p_suspension_id
      and sr.user_id = p_user_id
      and sr.organization_id = v_org_id
      and sr.suspension_status in ('suspended', 'blocked')
    order by sr.id
    for update
  loop
    if v_snapshot.division_id is not null then
      perform 1
      from public.divisions d
      where d.id = v_snapshot.division_id
      for share;
    end if;
    if v_snapshot.department_id is not null then
      perform 1
      from public.departments d
      where d.id = v_snapshot.department_id
      for share;
    end if;
    if v_snapshot.unit_id is not null then
      perform 1
      from public.units u
      where u.id = v_snapshot.unit_id
      for share;
    end if;

    if not public.patch83u_role_assignment_valid(
      v_org_id, v_snapshot.scope, v_snapshot.role_organization_id,
      v_snapshot.division_id, v_snapshot.department_id, v_snapshot.unit_id
    ) then
      update public.user_credential_suspended_roles
      set suspension_status = 'blocked',
          restore_error_code = 'PATCH83U_ROLE_REFERENCE_INVALID'
      where id = v_snapshot.id;
      v_blocked := v_blocked + 1;
      continue;
    end if;

    if v_snapshot.source_user_role_id is not null then
      select ur.* into v_role
      from public.user_roles ur
      where ur.id = v_snapshot.source_user_role_id
      for update;

      if v_role.id is not null and (
        v_role.user_id is distinct from p_user_id
        or v_role.role is distinct from v_snapshot.role
        or v_role.scope is distinct from v_snapshot.scope
        or v_role.organization_id is distinct from v_snapshot.role_organization_id
        or v_role.division_id is distinct from v_snapshot.division_id
        or v_role.department_id is distinct from v_snapshot.department_id
        or v_role.unit_id is distinct from v_snapshot.unit_id
      ) then
        update public.user_credential_suspended_roles
        set suspension_status = 'blocked',
            restore_error_code = 'PATCH83U_ROLE_SNAPSHOT_CHANGED'
        where id = v_snapshot.id;
        v_blocked := v_blocked + 1;
      end if;
    end if;
  end loop;

  if v_blocked > 0 then
    return jsonb_build_object('restored_count', 0, 'blocked_count', v_blocked);
  end if;

  perform set_config('patch83u.controlled_role_restore', 'on', true);

  for v_snapshot in
    select sr.*
    from public.user_credential_suspended_roles sr
    where sr.suspension_id = p_suspension_id
      and sr.user_id = p_user_id
      and sr.organization_id = v_org_id
      and sr.suspension_status in ('suspended', 'blocked')
    order by sr.id
    for update
  loop
    v_role_id := null;

    if v_snapshot.source_user_role_id is not null then
      select ur.* into v_role
      from public.user_roles ur
      where ur.id = v_snapshot.source_user_role_id
      for update;
      v_role_id := v_role.id;
    end if;

    if v_role_id is null then
      select ur.id into v_role_id
      from public.user_roles ur
      where ur.user_id = p_user_id
        and ur.role = v_snapshot.role
        and ur.scope = v_snapshot.scope
        and ur.organization_id is not distinct from v_snapshot.role_organization_id
        and ur.division_id is not distinct from v_snapshot.division_id
        and ur.department_id is not distinct from v_snapshot.department_id
        and ur.unit_id is not distinct from v_snapshot.unit_id
      order by ur.assigned_at, ur.id
      limit 1
      for update;
    end if;

    if v_role_id is null then
      insert into public.user_roles (
        user_id, role, scope, organization_id, division_id,
        department_id, unit_id, is_active, assigned_by
      ) values (
        p_user_id, v_snapshot.role, v_snapshot.scope,
        v_snapshot.role_organization_id, v_snapshot.division_id,
        v_snapshot.department_id, v_snapshot.unit_id, true, p_actor_id
      ) returning id into v_role_id;
    else
      update public.user_roles
      set is_active = true,
          assigned_by = p_actor_id,
          assigned_at = clock_timestamp()
      where id = v_role_id;
    end if;

    insert into public.role_change_audit (
      organization_id, target_user_id, user_role_id, action,
      new_data, reason, changed_by
    )
    select v_org_id, p_user_id, v_role_id, 'reactivated', to_jsonb(ur),
      'Patch 83U role restored after required password change', p_actor_id
    from public.user_roles ur
    where ur.id = v_role_id;

    update public.user_credential_suspended_roles
    set suspension_status = 'restored',
        restored_user_role_id = v_role_id,
        restored_at = clock_timestamp(),
        restore_error_code = null
    where id = v_snapshot.id;
    v_restored := v_restored + 1;
  end loop;

  perform set_config('patch83u.controlled_role_restore', 'off', true);

  if v_restored > 0 then
    insert into public.user_credential_events (
      organization_id, user_id, actor_id, event_type,
      credential_version, event_code, details
    )
    select v_org_id, p_user_id, p_actor_id, 'roles_restored',
      cs.credential_version, 'PATCH83U_ROLES_RESTORED',
      jsonb_build_object(
        'suspension_id', p_suspension_id,
        'restored_count', v_restored,
        'blocked_count', v_blocked
      )
    from public.user_credential_states cs
    where cs.user_id = p_user_id;
  end if;

  return jsonb_build_object('restored_count', v_restored, 'blocked_count', v_blocked);
end;
$$;

create or replace function public.patch83u_prepare_required_password_change(
  p_actor_id uuid,
  p_session_id text,
  p_token_credential_version integer,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_state public.user_credential_states%rowtype;
  v_profile public.profiles%rowtype;
  v_operation public.patch83u_credential_operations%rowtype;
  v_session_id uuid;
  v_employee_id text;
  v_terminal boolean := false;
begin
  perform public.patch83u_require_service_role();
  perform public.patch83u_require_enforced_runtime();
  if nullif(btrim(coalesce(p_request_id, '')), '') is null
    or length(p_request_id) > 128
    or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'PATCH83U_REQUEST_ID_INVALID';
  end if;

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_actor_id;
  select p.* into v_profile
  from public.profiles p
  where p.id = p_actor_id
    and p.organization_id = v_state.organization_id;
  if v_state.user_id is null or v_profile.id is null then
    raise exception 'PATCH83U_CREDENTIAL_STATE_NOT_FOUND';
  end if;
  v_employee_id := nullif(btrim(v_profile.employee_no), '');

  select op.* into v_operation
  from public.patch83u_credential_operations op
  where op.operation_type = 'password_change'
    and op.actor_id = p_actor_id
    and op.target_user_id = p_actor_id
    and op.request_id = p_request_id;
  if v_operation.operation_id is not null then
    if v_operation.operation_status = 'aborted' then
      raise exception 'PATCH83U_PASSWORD_CHANGE_REQUEST_ALREADY_ABORTED';
    end if;
    if v_operation.operation_status = 'in_progress' then
      raise exception 'PATCH83U_PASSWORD_CHANGE_RECONCILIATION_REQUIRED';
    end if;
    v_terminal := v_operation.operation_status in (
      'completed', 'recovery_required', 'session_revocation_review_required'
    );
    return jsonb_build_object(
      'user_id', p_actor_id,
      'request_id', p_request_id,
      'auth_email', v_state.auth_email,
      'employee_id', v_employee_id,
      'identity_mode', v_state.identity_mode,
      'current_credential_version', case when v_terminal
        then v_state.credential_version
        else v_operation.current_credential_version
      end,
      'completed', v_terminal,
      'result_status', case when v_terminal
        then coalesce(
          v_operation.safe_result ->> 'credential_state',
          v_operation.resulting_credential_state
        )
        else v_operation.operation_status
      end,
      'must_reauthenticate', true
    );
  end if;

  if coalesce(p_session_id, '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  then
    raise exception 'PATCH83U_SESSION_ID_INVALID';
  end if;
  v_session_id := p_session_id::uuid;
  if v_state.credential_state not in (
    'existing_password_change_required', 'initial_change_required',
    'admin_reset_change_required', 'reactivation_change_required'
  ) then
    raise exception 'PATCH83U_PASSWORD_CHANGE_STATE_INVALID';
  end if;
  if v_state.credential_version is distinct from p_token_credential_version then
    raise exception 'PATCH83U_CREDENTIAL_VERSION_STALE';
  end if;
  if v_state.invalidated_session_id = v_session_id or not exists (
    select 1 from auth.sessions s
    where s.id = v_session_id
      and s.user_id = p_actor_id
      and s.created_at >= v_state.session_valid_after
  ) then
    raise exception 'PATCH83U_SESSION_NOT_ACTIVE';
  end if;
  if v_profile.is_active = false
    or v_profile.user_status not in ('active', 'invited')
    or v_state.identity_mode not in ('employee_id_managed', 'legacy_verified')
    or not exists (
      select 1 from auth.users u
      where u.id = p_actor_id
        and lower(btrim(u.email)) = v_state.auth_email
        and public.patch83u_auth_credential_version(u.raw_app_meta_data) = v_state.credential_version
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
    or (
      v_state.identity_mode = 'employee_id_managed'
      and (
        v_employee_id is null
        or v_state.auth_email <> public.patch83u_expected_auth_email(v_employee_id)
      )
    )
  then
    raise exception 'PATCH83U_PASSWORD_CHANGE_IDENTITY_PROOF_FAILED';
  end if;

  return jsonb_build_object(
    'user_id', p_actor_id,
    'request_id', p_request_id,
    'auth_email', v_state.auth_email,
    'employee_id', v_employee_id,
    'identity_mode', v_state.identity_mode,
    'current_credential_version', v_state.credential_version,
    'completed', false,
    'result_status', 'ready',
    'must_reauthenticate', true
  );
end;
$$;

create or replace function public.patch83u_begin_required_password_change(
  p_actor_id uuid,
  p_session_id text,
  p_token_credential_version integer,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_state public.user_credential_states%rowtype;
  v_profile public.profiles%rowtype;
  v_operation public.patch83u_credential_operations%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_session_id uuid;
  v_employee_id text;
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

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_actor_id
  for update;

  select p.* into v_profile
  from public.profiles p
  where p.id = p_actor_id
    and p.organization_id = v_state.organization_id
  for update;

  if v_state.user_id is null or v_profile.id is null then
    raise exception 'PATCH83U_CREDENTIAL_STATE_NOT_FOUND';
  end if;
  v_employee_id := nullif(btrim(v_profile.employee_no), '');

  -- A repeated request is resolved before reauthentication/session checks. This
  -- makes a lost response safe: the caller receives the original operation and
  -- never performs a second Auth password update or version increment.
  select op.* into v_operation
  from public.patch83u_credential_operations op
  where op.operation_type = 'password_change'
    and op.actor_id = p_actor_id
    and op.target_user_id = p_actor_id
    and op.request_id = p_request_id
  for update;
  if v_operation.operation_id is not null then
    if v_operation.operation_status = 'aborted' then
      raise exception 'PATCH83U_PASSWORD_CHANGE_REQUEST_ALREADY_ABORTED';
    end if;
    if v_operation.operation_status = 'in_progress' then
      raise exception 'PATCH83U_PASSWORD_CHANGE_RECONCILIATION_REQUIRED';
    end if;
    return jsonb_build_object(
      'user_id', p_actor_id,
      'request_id', p_request_id,
      'operation_id', v_operation.operation_id,
      'auth_email', v_state.auth_email,
      'employee_id', v_employee_id,
      'identity_mode', v_state.identity_mode,
      'current_credential_version', v_operation.current_credential_version,
      'next_credential_version', v_operation.next_credential_version,
      'idempotent_replay', true
    );
  end if;

  if coalesce(p_session_id, '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  then
    raise exception 'PATCH83U_SESSION_ID_INVALID';
  end if;
  v_session_id := p_session_id::uuid;

  if v_state.credential_state not in (
    'existing_password_change_required',
    'initial_change_required',
    'admin_reset_change_required',
    'reactivation_change_required'
  ) then
    raise exception 'PATCH83U_PASSWORD_CHANGE_STATE_INVALID';
  end if;
  if v_state.credential_version is distinct from p_token_credential_version then
    raise exception 'PATCH83U_CREDENTIAL_VERSION_STALE';
  end if;
  if v_state.invalidated_session_id = v_session_id then
    raise exception 'PATCH83U_SESSION_NOT_ACTIVE';
  end if;
  if not exists (
    select 1 from auth.sessions s
    where s.id = v_session_id
      and s.user_id = p_actor_id
      and s.created_at >= v_state.session_valid_after
  ) then
    raise exception 'PATCH83U_SESSION_NOT_ACTIVE';
  end if;
  if v_profile.is_active = false
    or v_profile.user_status not in ('active', 'invited')
    or v_state.identity_mode not in ('employee_id_managed', 'legacy_verified')
    or not exists (
      select 1
      from auth.users u
      where u.id = p_actor_id
        and lower(btrim(u.email)) = v_state.auth_email
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until <= now())
        and public.patch83u_auth_credential_version(u.raw_app_meta_data) = v_state.credential_version
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
    or (
      v_state.identity_mode = 'employee_id_managed'
      and (
        v_employee_id is null
        or v_state.auth_email <> public.patch83u_expected_auth_email(v_employee_id)
      )
    )
  then
    raise exception 'PATCH83U_PASSWORD_CHANGE_IDENTITY_PROOF_FAILED';
  end if;

  insert into public.patch83u_credential_operations (
    operation_id, operation_type, organization_id, actor_id, target_user_id,
    request_id, operation_status, current_credential_version,
    next_credential_version
  ) values (
    v_operation_id, 'password_change', v_state.organization_id,
    p_actor_id, p_actor_id, p_request_id, 'in_progress',
    v_state.credential_version, v_state.credential_version + 1
  );

  update public.user_credential_states
  set credential_state = 'password_change_in_progress',
      pending_operation_id = v_operation_id,
      operation_source = 'password_change',
      reconciliation_auth_changed = false,
      pending_session_id = v_session_id,
      pending_credential_version = credential_version + 1,
      operation_previous_state = credential_state,
      operation_previous_lifecycle = requested_lifecycle,
      operation_previous_session_valid_after = session_valid_after,
      session_valid_after = v_now
  where user_id = p_actor_id;

  insert into public.user_credential_events (
    organization_id, user_id, provisioning_id, actor_id, event_type,
    credential_version, session_id, request_id, event_code, details
  ) values (
    v_state.organization_id, p_actor_id, v_state.provisioning_id, p_actor_id,
    'password_change_started', v_state.credential_version, v_session_id,
    p_request_id, 'PATCH83U_PASSWORD_CHANGE_STARTED',
    jsonb_build_object(
      'operation_id', v_operation_id,
      'next_credential_version', v_state.credential_version + 1,
      'previous_state', v_state.credential_state
    )
  );

  return jsonb_build_object(
    'user_id', p_actor_id,
    'request_id', p_request_id,
    'operation_id', v_operation_id,
    'employee_id', v_employee_id,
    'auth_email', v_state.auth_email,
    'identity_mode', v_state.identity_mode,
    'current_credential_version', v_state.credential_version,
    'next_credential_version', v_state.credential_version + 1,
    'idempotent_replay', false
  );
end;
$$;

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

  -- Existing users retain their exact role rows throughout rotation. The only
  -- role mutation permitted here is the one-time activation of the exact
  -- inactive role precreated for a newly provisioned account.
  v_role_activation_required :=
    v_state.operation_previous_state = 'initial_change_required';
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
      -- Lock the complete matching set before proving there is exactly one row.
      perform 1
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
    where id = v_queue.id;
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

create or replace function public.patch83u_abort_required_password_change(
  p_actor_id uuid,
  p_operation_id uuid,
  p_request_id text,
  p_auth_changed boolean,
  p_session_revocation_confirmed boolean,
  p_error_code text,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_state public.user_credential_states%rowtype;
  v_operation public.patch83u_credential_operations%rowtype;
  v_result jsonb;
  v_next_state text;
  v_safe_message text;
  v_auth_version integer;
  v_effective_credential_version integer;
  v_revocation_proven boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  perform public.patch83u_require_service_role();
  if nullif(btrim(coalesce(p_request_id, '')), '') is null
    or length(p_request_id) > 128
    or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'PATCH83U_REQUEST_ID_INVALID';
  end if;
  if nullif(btrim(coalesce(p_error_code, '')), '') is null
    or length(p_error_code) > 80
    or p_error_code !~ '^[A-Z0-9_]+$'
  then
    raise exception 'PATCH83U_FAILURE_CODE_INVALID';
  end if;
  v_safe_message := public.patch83u_safe_failure_message(p_error_message);

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
    'completed', 'aborted', 'recovery_required',
    'session_revocation_review_required'
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
    or v_operation.current_credential_version is distinct from v_state.credential_version
    or v_operation.next_credential_version is distinct from v_state.pending_credential_version
  then
    raise exception 'PATCH83U_PASSWORD_CHANGE_OPERATION_INVALID';
  end if;

  v_revocation_proven := coalesce(p_session_revocation_confirmed, false)
    and not exists (select 1 from auth.sessions s where s.user_id = p_actor_id);
  v_next_state := case
    when coalesce(p_auth_changed, false) and not v_revocation_proven
      then 'session_revocation_review_required'
    when coalesce(p_auth_changed, false) then 'recovery_required'
    else v_state.operation_previous_state
  end;

  if coalesce(p_auth_changed, false) then
    select public.patch83u_auth_credential_version(u.raw_app_meta_data)
    into v_auth_version
    from auth.users u
    where u.id = p_actor_id
      and lower(btrim(u.email)) = v_state.auth_email;

  end if;

  v_effective_credential_version := case
    when coalesce(p_auth_changed, false)
      and v_auth_version is not null
      and v_auth_version >= v_state.credential_version
      then v_auth_version
    else v_state.credential_version
  end;

  update public.user_credential_states
  set credential_state = v_next_state,
      credential_version = v_effective_credential_version,
      session_valid_after = case
        when coalesce(p_auth_changed, false) then v_now
        else operation_previous_session_valid_after
      end,
      invalidated_session_id = case
        when coalesce(p_auth_changed, false) then pending_session_id
        else invalidated_session_id
      end,
      role_suspension_id = null,
      reconciliation_checked_at = case
        when coalesce(p_auth_changed, false) then v_now
        else reconciliation_checked_at
      end,
      pending_operation_id = null,
      operation_source = case
        when coalesce(p_auth_changed, false) then operation_source else null
      end,
      reconciliation_auth_changed = coalesce(p_auth_changed, false),
      pending_session_id = null,
      pending_credential_version = null,
      operation_previous_state = case
        when coalesce(p_auth_changed, false) then operation_previous_state else null
      end,
      operation_previous_lifecycle = case
        when coalesce(p_auth_changed, false) then operation_previous_lifecycle else null
      end,
      operation_previous_session_valid_after = case
        when coalesce(p_auth_changed, false) then operation_previous_session_valid_after else null
      end,
      sessions_revoked_at = case
        when v_revocation_proven then v_now else sessions_revoked_at end
  where user_id = p_actor_id;

  v_result := jsonb_build_object(
    'user_id', p_actor_id,
    'request_id', p_request_id,
    'credential_state', v_next_state,
    'credential_version', v_effective_credential_version,
    'recovery_required', v_next_state = 'recovery_required',
    'reconciliation_required', v_next_state in (
      'recovery_required', 'reconciliation_required'
    ),
    'session_revocation_review_required',
      v_next_state = 'session_revocation_review_required',
    'idempotent_replay', false
  );

  update public.patch83u_credential_operations
  set operation_status = case
        when v_next_state = 'session_revocation_review_required'
          then 'session_revocation_review_required'
        when v_next_state = 'recovery_required' then 'recovery_required'
        else 'aborted'
      end,
      resulting_credential_state = v_next_state,
      auth_changed = coalesce(p_auth_changed, false),
      session_revocation_confirmed = v_revocation_proven,
      safe_result = v_result,
      completed_at = v_now,
      updated_at = v_now
  where operation_id = p_operation_id;

  insert into public.user_credential_events (
    organization_id, user_id, provisioning_id, actor_id, event_type,
    credential_version, session_id, request_id, event_code, details
  ) values (
    v_state.organization_id, p_actor_id, v_state.provisioning_id, p_actor_id,
    'password_change_aborted', v_effective_credential_version, v_state.pending_session_id,
    p_request_id, btrim(p_error_code), jsonb_build_object(
      'operation_id', p_operation_id,
      'auth_changed', coalesce(p_auth_changed, false),
      'resulting_state', v_next_state,
      'role_rows_preserved', true,
      'session_revocation_confirmed', v_revocation_proven,
      'message', v_safe_message
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
  v_role_is_active boolean := false;
  v_employee_id_conflict boolean := false;
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

  select u.id into v_auth_user_id
  from auth.users u
  where lower(btrim(u.email)) = v_queue.auth_email
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
      or exists (select 1 from public.profiles p where p.employee_no = v_queue.employee_id and p.organization_id = v_org_id)
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
  elsif not exists (
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
    where p.id = v_auth_user_id;

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
      where cs.user_id = v_auth_user_id;

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
        'initial_change_required', 'password_change_in_progress'
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
        when v_status = 'completed' then coalesce(completed_at, clock_timestamp())
        else completed_at
      end,
      lease_expires_at = null,
      attempt_id = null,
      request_id = btrim(p_request_id),
      reconciled_at = clock_timestamp(),
      reconciled_by = p_actor_id,
      last_error_code = v_error_code,
      last_error_message = v_error_message
  where id = v_queue.id;

  insert into public.user_credential_events (
    organization_id, user_id, provisioning_id, actor_id, event_type,
    credential_version, request_id, event_code, details
  ) values (
    v_org_id, v_profile.id, v_queue.id, p_actor_id,
    'provisioning_reconciled', v_state.credential_version, btrim(p_request_id),
    case when v_status = 'reconciliation_required'
      then 'PATCH83U_RECONCILIATION_REQUIRED'
      else 'PATCH83U_PROVISIONING_RECONCILED'
    end,
    jsonb_build_object('outcome', v_outcome, 'provisioning_status', v_status)
  );

  return jsonb_build_object(
    'provisioning_id', v_queue.id,
    'provisioning_status', v_status,
    'outcome', v_outcome,
    'reconciliation_required', v_status = 'reconciliation_required'
  );
end;
$$;

create or replace function public.patch83u_reconcile_credential_state(
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
  v_org_id uuid;
  v_profile public.profiles%rowtype;
  v_state public.user_credential_states%rowtype;
  v_queue public.user_account_provisioning%rowtype;
  v_auth_version integer;
  v_blocked integer := 0;
  v_role_id uuid;
  v_matching_role_count integer := 0;
  v_result jsonb;
  v_outcome text;
  v_result_state text;
  v_operation_request_id text;
begin
  v_org_id := public.patch83u_require_super_admin(p_actor_id);
  if nullif(btrim(coalesce(p_request_id, '')), '') is null
    or length(p_request_id) > 128
    or p_request_id !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception 'PATCH83U_REQUEST_ID_INVALID';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id = p_target_user_id
    and p.organization_id = v_org_id
  for update;

  select cs.* into v_state
  from public.user_credential_states cs
  where cs.user_id = p_target_user_id
    and cs.organization_id = v_org_id
  for update;

  if v_profile.id is null or v_state.user_id is null then
    raise exception 'PATCH83U_RECONCILIATION_TARGET_NOT_FOUND';
  end if;
  if p_employee_id_confirmation is distinct from v_profile.employee_no then
    raise exception 'PATCH83U_EMPLOYEE_ID_CONFIRMATION_REQUIRED';
  end if;

  select public.patch83u_auth_credential_version(u.raw_app_meta_data)
  into v_auth_version
  from auth.users u
  where u.id = p_target_user_id
    and lower(btrim(u.email)) = v_state.auth_email;

  if v_auth_version is null then
    raise exception 'PATCH83U_RECONCILIATION_AUTH_PROOF_FAILED';
  end if;

  if v_state.credential_state in ('reset_in_progress', 'password_change_in_progress') then
    select op.request_id into v_operation_request_id
    from public.patch83u_credential_operations op
    where op.operation_id = v_state.pending_operation_id
      and op.target_user_id = p_target_user_id
      and op.operation_type = case v_state.credential_state
        when 'reset_in_progress' then 'admin_reset'
        else 'password_change'
      end;
    if v_operation_request_id is null then
      raise exception 'PATCH83U_CREDENTIAL_OPERATION_LEDGER_MISSING';
    end if;
  end if;

  -- Crash recovery is deterministic: unchanged Auth metadata means abort the
  -- stale begin; the exact pending version means finish the proven Auth write.
  if v_state.credential_state = 'reset_in_progress' then
    if v_auth_version = v_state.credential_version then
      v_result := public.patch83u_abort_admin_reset(
        p_actor_id, p_target_user_id, v_state.pending_operation_id,
        v_operation_request_id, false, false,
        'PATCH83U_STALE_OPERATION_RECOVERED',
        'No Auth credential change was found; the stale reset was safely aborted.'
      );
      return v_result || jsonb_build_object('outcome', 'stale_admin_reset_aborted');
    elsif v_auth_version = v_state.pending_credential_version then
      if exists (select 1 from auth.sessions s where s.user_id = p_target_user_id) then
        -- The Auth write is proven, but finalization cannot truthfully claim
        -- revocation. Advance to reconciliation instead of leaving a dead-end
        -- in-progress state; a fresh manual reset can then establish a target
        -- session and perform the required global sign-out.
        v_result := public.patch83u_abort_admin_reset(
          p_actor_id, p_target_user_id, v_state.pending_operation_id,
          v_operation_request_id, true, false,
          'PATCH83U_RECOVERY_SESSIONS_STILL_ACTIVE',
          'The Auth credential changed, but active sessions still require a fresh administrator reset.'
        );
        return v_result || jsonb_build_object(
          'outcome', 'admin_reset_auth_change_recovery_required'
        );
      else
        v_result := public.patch83u_finalize_admin_reset(
          p_actor_id, p_target_user_id, v_state.pending_operation_id,
          v_operation_request_id, v_auth_version, v_state.auth_email, true
        );
        return v_result || jsonb_build_object('outcome', 'admin_reset_finalized_from_proof');
      end if;
    end if;
  elsif v_state.credential_state = 'password_change_in_progress' then
    if v_auth_version = v_state.credential_version then
      v_result := public.patch83u_abort_required_password_change(
        p_target_user_id, v_state.pending_operation_id,
        v_operation_request_id, false, false,
        'PATCH83U_STALE_OPERATION_RECOVERED',
        'No Auth credential change was found; the stale password change was safely aborted.'
      );
      return v_result || jsonb_build_object('outcome', 'stale_password_change_aborted');
    elsif v_auth_version = v_state.pending_credential_version then
      if exists (select 1 from auth.sessions s where s.user_id = p_target_user_id) then
        v_result := public.patch83u_abort_required_password_change(
          p_target_user_id, v_state.pending_operation_id,
          v_operation_request_id, true, false,
          'PATCH83U_RECOVERY_SESSIONS_STILL_ACTIVE',
          'The Auth credential changed, but active sessions still require a fresh administrator reset.'
        );
        return v_result || jsonb_build_object(
          'outcome', 'password_change_auth_change_recovery_required'
        );
      else
        v_result := public.patch83u_finalize_required_password_change(
          p_target_user_id, v_state.pending_operation_id,
          v_operation_request_id, v_auth_version, v_state.auth_email, true
        );
        return v_result || jsonb_build_object('outcome', 'password_change_finalized_from_proof');
      end if;
    end if;
  end if;

  if v_state.credential_state in ('reset_in_progress', 'password_change_in_progress') then
    update public.user_credential_states
    set credential_state = 'recovery_required',
        session_valid_after = clock_timestamp(),
        pending_operation_id = null,
        pending_session_id = null,
        pending_credential_version = null,
        reconciliation_checked_at = clock_timestamp()
    where user_id = p_target_user_id;
    v_state.credential_state := 'recovery_required';
  end if;

  if v_state.credential_state not in (
    'recovery_required', 'reconciliation_required',
    'session_revocation_review_required'
  ) then
    raise exception 'PATCH83U_RECONCILIATION_STATE_INVALID';
  end if;
  if v_auth_version <> v_state.credential_version then
    raise exception 'PATCH83U_RECONCILIATION_VERSION_AMBIGUOUS';
  end if;

  -- A proven administrator reset always remains forced-change. Existing role
  -- and profile rows stay unchanged; reconciliation must never silently grant
  -- application access before session revocation is proven.
  if v_state.operation_source = 'admin_reset'
    and v_state.reconciliation_auth_changed = true
  then
    if exists (select 1 from auth.sessions s where s.user_id = p_target_user_id) then
      raise exception 'PATCH83U_AUTH_SESSIONS_STILL_ACTIVE';
    end if;
    update public.user_credential_states
    set credential_state = 'admin_reset_change_required',
        session_valid_after = clock_timestamp(),
        operation_source = null,
        reconciliation_auth_changed = false,
        operation_previous_state = null,
        operation_previous_lifecycle = null,
        operation_previous_session_valid_after = null,
        sessions_revoked_at = clock_timestamp(),
        reconciliation_checked_at = clock_timestamp()
    where user_id = p_target_user_id;
    v_outcome := 'admin_reset_change_required_restored';
    v_result_state := 'admin_reset_change_required';
  -- Reset never physically suspended roles. An unchanged-Auth reconciliation
  -- may restore the prior credential state only when the preserved profile and
  -- role rows still prove the same valid active lifecycle.
  elsif v_state.operation_source = 'admin_reset'
    and v_state.operation_previous_state = 'active'
  then
    v_blocked := case when v_profile.is_active = true
      and v_profile.user_status = v_state.operation_previous_lifecycle
      and not exists (
        select 1 from public.user_roles ur
        where ur.user_id = p_target_user_id
          and ur.is_active = true
          and not public.patch83u_role_assignment_valid(
            v_org_id, ur.scope, ur.organization_id,
            ur.division_id, ur.department_id, ur.unit_id
          )
      )
      then 0 else 1 end;

    if v_blocked = 0 then
      update public.user_credential_states
      set credential_state = v_state.operation_previous_state,
          session_valid_after = v_state.operation_previous_session_valid_after,
          role_suspension_id = null,
          operation_source = null,
          reconciliation_auth_changed = false,
          operation_previous_state = null,
          operation_previous_lifecycle = null,
          operation_previous_session_valid_after = null,
          reconciliation_checked_at = clock_timestamp()
      where user_id = p_target_user_id;
      v_outcome := 'admin_reset_abort_restored_from_database_proof';
      v_result_state := v_state.operation_previous_state;
    else
      v_outcome := 'role_reconciliation_still_blocked';
      v_result_state := 'recovery_required';
    end if;
  elsif v_state.operation_source = 'password_change'
    and v_state.reconciliation_auth_changed = true
    and v_state.operation_previous_state in (
    'existing_password_change_required', 'initial_change_required',
    'admin_reset_change_required', 'reactivation_change_required'
  ) then
    if exists (select 1 from auth.sessions s where s.user_id = p_target_user_id) then
      raise exception 'PATCH83U_AUTH_SESSIONS_STILL_ACTIVE';
    end if;
    if v_state.provisioning_id is not null
      and exists (
        select 1
        from public.user_account_provisioning q0
        where q0.id = v_state.provisioning_id
          and q0.organization_id = v_org_id
          and q0.profile_id = p_target_user_id
          and q0.provisioning_status = 'initial_change_required'
      )
    then
      select q.* into v_queue
      from public.user_account_provisioning q
      where q.id = v_state.provisioning_id
        and q.organization_id = v_org_id
        and q.profile_id = p_target_user_id
      for update;

      perform 1
      from public.user_roles ur
      where ur.user_id = p_target_user_id
        and ur.role = v_queue.requested_role
        and ur.scope = v_queue.requested_scope
        and ur.organization_id is not distinct from v_org_id
        and ur.division_id is null
        and ur.department_id is not distinct from (
          case when v_queue.requested_scope = 'department' then v_queue.department_id else null end
        )
        and ur.unit_id is null
      order by ur.id
      for update;

      select count(*)::integer into v_matching_role_count
      from public.user_roles ur
      where ur.user_id = p_target_user_id
        and ur.role = v_queue.requested_role
        and ur.scope = v_queue.requested_scope
        and ur.organization_id is not distinct from v_org_id
        and ur.division_id is null
        and ur.department_id is not distinct from (
          case when v_queue.requested_scope = 'department' then v_queue.department_id else null end
        )
        and ur.unit_id is null;

      select ur.id into v_role_id
      from public.user_roles ur
      where ur.user_id = p_target_user_id
        and ur.role = v_queue.requested_role
        and ur.scope = v_queue.requested_scope
        and ur.organization_id is not distinct from v_org_id
        and ur.division_id is null
        and ur.department_id is not distinct from (
          case when v_queue.requested_scope = 'department' then v_queue.department_id else null end
        )
        and ur.unit_id is null
      order by ur.id
      limit 1;

      if v_queue.id is null
        or v_queue.auth_user_id is distinct from p_target_user_id
        or v_queue.auth_email is distinct from v_state.auth_email
        or v_matching_role_count <> 1
        or v_role_id is null
        or not public.patch83u_role_scope_allowed(v_queue.requested_role, v_queue.requested_scope)
        or not public.patch83u_role_assignment_valid(
          v_org_id,
          v_queue.requested_scope,
          v_org_id,
          null,
          case when v_queue.requested_scope = 'department' then v_queue.department_id else null end,
          null
        )
      then
        v_blocked := v_blocked + 1;
      elsif not exists (
        select 1 from public.user_roles ur where ur.id = v_role_id and ur.is_active
      ) then
        perform set_config('patch83u.controlled_role_restore', 'on', true);
        update public.user_roles
        set is_active = true, assigned_by = p_actor_id, assigned_at = clock_timestamp()
        where id = v_role_id;
        perform set_config('patch83u.controlled_role_restore', 'off', true);
        insert into public.role_change_audit (
          organization_id, target_user_id, user_role_id, action,
          new_data, reason, changed_by
        )
        select v_org_id, p_target_user_id, v_role_id, 'reactivated', to_jsonb(ur),
          'Patch 83U credential reconciliation', p_actor_id
        from public.user_roles ur where ur.id = v_role_id;
      end if;
    end if;

    if v_blocked = 0 then
      perform set_config('patch83u.controlled_lifecycle_transition', 'on', true);
      update public.profiles
      set user_status = 'active', is_active = true
      where id = p_target_user_id;
      perform set_config('patch83u.controlled_lifecycle_transition', 'off', true);

      update public.user_credential_states
      set credential_state = 'active',
          session_valid_after = clock_timestamp(),
          role_suspension_id = null,
          operation_source = null,
          reconciliation_auth_changed = false,
          operation_previous_state = null,
          operation_previous_lifecycle = null,
          operation_previous_session_valid_after = null,
          sessions_revoked_at = clock_timestamp(),
          reconciliation_checked_at = clock_timestamp()
      where user_id = p_target_user_id;

      if v_queue.id is not null then
        update public.user_account_provisioning
        set provisioning_status = 'completed', completed_at = clock_timestamp(),
            last_error_code = null, last_error_message = null
        where id = v_queue.id;
      end if;
      v_outcome := 'credential_access_restored_from_database_proof';
      v_result_state := 'active';
    else
      -- Reassert the locked credential state after any blocked activation
      -- proof. Runtime-aware credential RLS keeps the preserved role rows
      -- ineffective, so recovery cannot commit with application access enabled.
      update public.user_credential_states
      set credential_state = 'recovery_required',
          session_valid_after = clock_timestamp(),
          reconciliation_checked_at = clock_timestamp()
      where user_id = p_target_user_id;
      v_outcome := 'role_reconciliation_still_blocked';
      v_result_state := 'recovery_required';
    end if;
  else
    v_outcome := 'manual_reconciliation_still_required';
    v_result_state := v_state.credential_state;
  end if;

  insert into public.user_credential_events (
    organization_id, user_id, provisioning_id, actor_id, event_type,
    credential_version, request_id, event_code, details
  ) values (
    v_org_id, p_target_user_id, v_state.provisioning_id, p_actor_id,
    'credential_reconciled', v_auth_version, btrim(p_request_id),
    case when v_outcome in (
      'admin_reset_change_required_restored',
      'admin_reset_abort_restored_from_database_proof',
      'credential_access_restored_from_database_proof'
    ) then 'PATCH83U_CREDENTIAL_RECONCILED'
    else case when v_result_state = 'recovery_required'
      then 'PATCH83U_PASSWORD_CHANGE_RECOVERY_REQUIRED'
      else 'PATCH83U_RECONCILIATION_REQUIRED'
    end
    end,
    jsonb_build_object(
      'outcome', v_outcome,
      'existing_role_rows_preserved', true,
      'new_provisioned_role_activation_blocked', v_blocked > 0
    )
  );

  return jsonb_build_object(
    'user_id', p_target_user_id,
    'credential_state', v_result_state,
    'outcome', v_outcome,
    'recovery_required', v_result_state = 'recovery_required',
    'reconciliation_required', v_outcome not in (
      'admin_reset_change_required_restored',
      'admin_reset_abort_restored_from_database_proof',
      'credential_access_restored_from_database_proof'
    )
  );
end;
$$;

-- Every Patch 83U routine defaults to no browser execution. The only exceptions
-- are side-effect-free booleans used inside authenticated restrictive RLS.
do $patch83u_function_privileges$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure::text as function_signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'patch83u\_%' escape '\'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      v_function.function_signature
    );
    execute format(
      'grant execute on function %s to service_role',
      v_function.function_signature
    );
  end loop;
end;
$patch83u_function_privileges$;

grant execute on function public.patch83u_credential_access_allowed()
to authenticated;
grant execute on function public.patch83u_profile_update_allowed(uuid, uuid)
to authenticated;
grant execute on function public.patch83u_user_role_mutation_allowed(
  uuid, public.app_role, public.access_scope, uuid, uuid, uuid, uuid
)
to authenticated;

comment on function public.patch83u_get_credential_state(uuid, integer, text, text) is
'Service-only token/state/session decision. Requires an exact credential version, canonical Auth email, and an existing same-user auth.sessions row.';
comment on function public.patch83u_auth_credential_version(jsonb) is
'Canonical Auth metadata parser. Missing credential_version means legacy version 0 only; malformed, null, or overflowing explicit values fail closed.';
comment on function public.patch83u_claim_provisioning(uuid, uuid, text, text) is
'Service-only claim with exact Employee ID confirmation. Returns a complete server-only provisioning snapshot; callers must never forward it to a browser.';
comment on function public.patch83u_finalize_provisioning(uuid, uuid, uuid, uuid, text) is
'Service-only finalization after exact auth.users email, ownership metadata, credential version, and confirmation proof.';
comment on function public.patch83u_prepare_required_password_change(uuid, text, integer, text) is
'Read-only service-role preparation. Returns exact non-secret identity/version context or the terminal idempotent outcome before current-password reauthentication.';
comment on function public.patch83u_begin_required_password_change(uuid, text, integer, text) is
'Service-only idempotent begin after successful current-password reauthentication; invalidates application access and records no credential material.';
comment on function public.patch83u_finalize_required_password_change(uuid, uuid, text, integer, text, boolean) is
'Service-only finalization with exact operation/request/Auth proof. Existing role rows are preserved; only an exact newly provisioned inactive role may be activated once. Unproven revocation remains fail-closed for review.';
comment on function public.patch83u_abort_required_password_change(uuid, uuid, text, boolean, boolean, text, text) is
'Service-only total abort with no-secret safe result. No-Auth-change restores the prior required state; changed Auth enters recovery or session-revocation review and the request ID is terminal.';
comment on function public.patch83u_begin_admin_reset(uuid, uuid, text, text, text, text) is
'Service-only Super Admin reset begin; requires PATCH83U_RESET_USER_PASSWORD, exact Employee ID confirmation, organization scope, non-self target, and effective last-Super-Admin protection while preserving profile and role rows.';
comment on function public.patch83u_admin_reset_session_revocation_proof(uuid, uuid, uuid, text, integer, text) is
'Read-only service-role proof for one exact administrator-reset operation. It returns only whether zero target auth.sessions rows remain and never mutates Auth session storage.';
comment on function public.patch83t_update_user_profile(uuid, uuid, jsonb) is
'Service-only, organization-scoped controlled profile update with nullable contact email, normalized phone, managed Employee ID immutability, and old/new audit snapshots.';
comment on function public.patch83u_finalize_admin_reset(uuid, uuid, uuid, text, integer, text, boolean) is
'Service-only reset finalization requiring exact operation/request/Auth proof. It preserves profile/role rows and transitions to required change or fail-closed session-revocation review.';
comment on function public.patch83u_abort_admin_reset(uuid, uuid, uuid, text, boolean, boolean, text, text) is
'Service-only total reset abort with a no-secret idempotent result; unchanged Auth restores prior state and changed Auth remains locked for recovery or session-revocation review.';
comment on function public.patch83u_get_capabilities(uuid, text, text) is
'Service-only non-secret schema/Edge/frontend/runtime handshake. Normal reads do not lock the singleton; prepared designated-Super-Admin attestation is narrowly locked and idempotent.';
comment on function public.patch83u_transition_runtime(uuid, text, text, text, text, text, uuid, text, text) is
'Sole service-role runtime mutation path with exact confirmation, idempotent request ID, protected preflight/contract/bootstrap checks, and append-only audit. Disable/emergency are credential-independent break-glass operations for the stored designated or another verified global Super Admin.';
comment on function public.patch83u_reconcile_provisioning(uuid, uuid, text, text) is
'Service-only, organization-scoped reconciliation against the exact canonical auth.users identity and immutable provisioning snapshot.';
comment on function public.patch83u_apply_user_lifecycle(uuid, uuid, text, text) is
'Service-only canonical User Management lifecycle transition with exact action/reason, same-organization role administration, protected provisioning, profile/credential/role synchronization, and database audit proof. Reactivation never restores roles.';
comment on function public.patch83u_reconcile_credential_state(uuid, uuid, text, text) is
'Service-only recovery for stale or partially completed credential operations; exact Auth version/email and operation-source evidence determine the only permitted transition.';
comment on function public.patch83u_assign_user_role(uuid, uuid, public.app_role, public.access_scope, uuid, uuid, uuid, text) is
'Service-only canonical role assignment. Organization is derived from the target profile; actor, role/scope, hierarchy, credential, and privilege invariants are revalidated under the shared organization lock.';
comment on function public.patch83u_deactivate_user_role(uuid, uuid, text) is
'Service-only role deactivation with same-organization scope, non-self enforcement, privileged-role authorization, and canonical eligible last-Super-Admin protection.';
comment on function public.patch83u_user_role_mutation_allowed(uuid, public.app_role, public.access_scope, uuid, uuid, uuid, uuid) is
'Side-effect-free restrictive-RLS decision for direct authenticated user_roles mutations. Requires an active verified canonical global same-organization administrator; privileged roles require Super Admin and self mutation is denied.';

commit;
