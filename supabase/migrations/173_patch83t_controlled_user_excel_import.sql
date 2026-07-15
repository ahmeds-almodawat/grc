-- Patch 83T: controlled User Excel Import.
-- Additive only. This migration is intentionally not applied by the patch implementation.

-- The canonical profile email remains the Auth/login identity. Patch 83T adds a
-- separate optional business contact address so managed Employee-ID identities
-- can keep the required synthetic Auth email without losing a contact address.
alter table public.profiles
  add column if not exists contact_email text;

alter table public.user_management_import_batches
  drop constraint if exists user_management_import_batches_source_format_check;

alter table public.user_management_import_batches
  alter column source_format set default 'csv';

alter table public.user_management_import_batches
  add constraint user_management_import_batches_source_format_check
  check (source_format in ('csv', 'xlsx'));

alter table public.user_management_import_batches
  add column if not exists duplicate_employee_id_count integer not null default 0,
  add column if not exists duplicate_contact_email_count integer not null default 0,
  add column if not exists invalid_phone_count integer not null default 0,
  add column if not exists existing_user_update_count integer not null default 0,
  add column if not exists pending_account_creation_count integer not null default 0;

-- Unknown identities need a durable, server-owned handoff to Patch 83U. The
-- workbook never contains a password and authenticated browser roles receive no
-- direct access to this table. Imported snapshot columns are immutable after
-- insertion; only the controlled provisioning state machine may bind the actual
-- Auth user/profile and change operational fields.
create table if not exists public.user_account_provisioning (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_batch_id uuid not null references public.user_management_import_batches(id) on delete cascade,
  import_row_id uuid not null unique references public.user_management_import_rows(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete restrict,
  employee_id text not null,
  auth_email text not null,
  contact_email text,
  full_name_en text not null,
  full_name_ar text,
  phone text,
  division_id uuid references public.divisions(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  department_code text not null,
  job_title text not null,
  requested_role public.app_role not null,
  requested_scope public.access_scope not null,
  requested_user_type text not null check (requested_user_type in (
    'employee', 'contractor', 'vendor', 'external_auditor', 'service_account'
  )),
  requested_lifecycle text not null check (requested_lifecycle in (
    'active', 'inactive', 'archived', 'invited', 'locked'
  )),
  account_action text not null check (account_action in (
    'create', 'update', 'create_or_update'
  )),
  provisioning_status text not null default 'queued' check (provisioning_status in (
    'queued',
    'held_lifecycle',
    'provisioning',
    'auth_created_pending_finalize',
    'initial_change_required',
    'completed',
    'retryable_failed',
    'policy_blocked',
    'reconciliation_required',
    'cancelled'
  )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  attempt_id uuid,
  request_id text,
  lease_expires_at timestamptz,
  claimed_at timestamptz,
  claimed_by uuid references public.profiles(id) on delete set null,
  auth_created_at timestamptz,
  completed_at timestamptz,
  reconciled_at timestamptz,
  reconciled_by uuid references public.profiles(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  last_error_code text,
  last_error_message text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_patch83t_provisioning_auth_email
on public.user_account_provisioning (lower(auth_email))
where provisioning_status not in ('completed', 'cancelled');

create unique index if not exists uq_patch83t_provisioning_org_employee
on public.user_account_provisioning (organization_id, employee_id)
where provisioning_status not in ('completed', 'cancelled');

create index if not exists idx_patch83t_provisioning_queue
on public.user_account_provisioning (organization_id, provisioning_status, created_at);

create or replace function public.patch83t_guard_provisioning_snapshot()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'PATCH83T_PROVISIONING_RECORD_DELETE_DENIED';
  end if;

  if row(
    new.organization_id, new.import_batch_id, new.import_row_id,
    new.employee_id, new.auth_email, new.contact_email,
    new.full_name_en, new.full_name_ar, new.phone, new.division_id,
    new.department_id, new.department_code, new.job_title, new.requested_role,
    new.requested_scope, new.requested_user_type, new.requested_lifecycle,
    new.account_action,
    new.created_by, new.created_at
  ) is distinct from row(
    old.organization_id, old.import_batch_id, old.import_row_id,
    old.employee_id, old.auth_email, old.contact_email,
    old.full_name_en, old.full_name_ar, old.phone, old.division_id,
    old.department_id, old.department_code, old.job_title, old.requested_role,
    old.requested_scope, old.requested_user_type, old.requested_lifecycle,
    old.account_action,
    old.created_by, old.created_at
  ) then
    raise exception 'PATCH83T_PROVISIONING_SNAPSHOT_IMMUTABLE';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_patch83t_guard_provisioning_snapshot
on public.user_account_provisioning;
create trigger trg_patch83t_guard_provisioning_snapshot
before update or delete on public.user_account_provisioning
for each row execute function public.patch83t_guard_provisioning_snapshot();

alter table public.user_account_provisioning enable row level security;
alter table public.user_account_provisioning force row level security;
revoke all on table public.user_account_provisioning from public, anon, authenticated;
grant select, insert, update on table public.user_account_provisioning to service_role;

comment on table public.user_account_provisioning is
'Patch 83T service-role-only, non-secret provisioning handoff. Snapshot identity, profile, hierarchy, role/scope, user type, and requested lifecycle values are immutable and passwords are never stored.';

create or replace function public.patch83t_user_import_identity_references(
  p_actor_id uuid,
  p_employee_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor_org uuid;
  v_auth_identities jsonb;
  v_profile_identities jsonb;
  v_provisioning_identities jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'PATCH83T_SERVICE_ROLE_REQUIRED';
  end if;

  select p.organization_id
  into v_actor_org
  from public.profiles p
  where p.id = p_actor_id
    and p.organization_id is not null
    and p.is_active = true
    and p.user_status = 'active';

  if v_actor_org is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role in ('super_admin', 'governance_admin')
      and ur.scope = 'global'
      and (ur.organization_id is null or ur.organization_id = v_actor_org)
      and ur.division_id is null
      and ur.department_id is null
      and ur.unit_id is null
  ) then
    raise exception 'PATCH83T_USER_ADMIN_REQUIRED';
  end if;

  if p_employee_ids is null
    or cardinality(p_employee_ids) < 1
    or cardinality(p_employee_ids) > 5000
  then
    raise exception 'PATCH83T_EMPLOYEE_ID_REFERENCE_COUNT_INVALID';
  end if;
  if exists (
    select 1
    from unnest(p_employee_ids) input(employee_id)
    where input.employee_id is null
      or btrim(input.employee_id) = ''
      or length(btrim(input.employee_id)) > 64
      or btrim(input.employee_id) !~ '^[A-Za-z0-9._-]+$'
  ) then
    raise exception 'PATCH83T_EMPLOYEE_ID_REFERENCE_INVALID';
  end if;
  if exists (
    select 1
    from unnest(p_employee_ids) input(employee_id)
    group by lower(btrim(input.employee_id))
    having count(*) > 1
  ) then
    raise exception 'PATCH83T_EMPLOYEE_ID_REFERENCE_DUPLICATE';
  end if;

  with input as (
    select btrim(value) as employee_id, ordinality
    from unnest(p_employee_ids) with ordinality as ids(value, ordinality)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'employee_id', input.employee_id,
      'auth_email', lower(input.employee_id) || '@almodawat.sa',
      'auth_user_id', au.id,
      'organization_match', case
        when au.id is null then null
        when p.id is null then false
        else p.organization_id = v_actor_org
      end
    ) order by input.ordinality
  ), '[]'::jsonb)
  into v_auth_identities
  from input
  left join auth.users au
    on lower(btrim(au.email)) = lower(input.employee_id) || '@almodawat.sa'
  left join public.profiles p on p.id = au.id;

  with input as (
    select btrim(value) as employee_id, ordinality
    from unnest(p_employee_ids) with ordinality as ids(value, ordinality)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'employee_id', input.employee_id,
      'auth_email', lower(input.employee_id) || '@almodawat.sa',
      'profile_id', p.id,
      'organization_match', p.organization_id = v_actor_org,
      'employee_id_match', p.employee_no = input.employee_id,
      'employee_id_case_insensitive_match',
        lower(btrim(p.employee_no)) = lower(input.employee_id),
      'auth_email_match', lower(btrim(p.email)) = lower(input.employee_id) || '@almodawat.sa',
      'has_cross_org_active_role', exists (
        select 1
        from public.user_roles ur
        where ur.user_id = p.id
          and ur.is_active = true
          and ur.organization_id is not null
          and ur.organization_id <> v_actor_org
      )
    ) order by input.ordinality, p.id
  ), '[]'::jsonb)
  into v_profile_identities
  from input
  join public.profiles p
    on lower(btrim(p.employee_no)) = lower(input.employee_id)
    or lower(btrim(p.email)) = lower(input.employee_id) || '@almodawat.sa';

  with input as (
    select btrim(value) as employee_id, ordinality
    from unnest(p_employee_ids) with ordinality as ids(value, ordinality)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'employee_id', input.employee_id,
      'auth_email', lower(input.employee_id) || '@almodawat.sa',
      'provisioning_id', q.id,
      'status', q.provisioning_status,
      'organization_match', case when q.id is null then null else q.organization_id = v_actor_org end
    ) order by input.ordinality
  ), '[]'::jsonb)
  into v_provisioning_identities
  from input
  left join public.user_account_provisioning q
    on q.provisioning_status not in ('completed', 'cancelled')
   and (
     lower(q.auth_email) = lower(input.employee_id) || '@almodawat.sa'
     or q.employee_id = input.employee_id
   );

  return jsonb_build_object(
    'auth_identities', v_auth_identities,
    'profile_identities', v_profile_identities,
    'provisioning_identities', v_provisioning_identities
  );
end;
$$;

revoke all on function public.patch83t_user_import_identity_references(uuid, text[])
from public, anon, authenticated;
grant execute on function public.patch83t_user_import_identity_references(uuid, text[])
to service_role;

create or replace function public.patch83t_apply_user_excel_import(
  p_actor_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor_org uuid;
  v_actor_is_super_admin boolean := false;
  v_rows jsonb;
  v_row jsonb;
  v_batch_id uuid;
  v_import_row_id uuid;
  v_provisioning_id uuid;
  v_provisioning_ids uuid[] := array[]::uuid[];
  v_payload_sha256 text;
  v_employee_id text;
  v_auth_email text;
  v_contact_email text;
  v_phone text;
  v_department_code text;
  v_department_id uuid;
  v_division_id uuid;
  v_role public.app_role;
  v_scope public.access_scope;
  v_status text;
  v_user_type text;
  v_account_action text;
  v_employee_user_id uuid;
  v_employee_match_org uuid;
  v_synthetic_profile_user_id uuid;
  v_synthetic_profile_match_count integer;
  v_synthetic_profile_match_org uuid;
  v_synthetic_profile_employee_id text;
  v_auth_identity_user_id uuid;
  v_auth_identity_match_count integer;
  v_open_provisioning_id uuid;
  v_employee_match_count integer;
  v_target_user uuid;
  v_expected_target_user uuid;
  v_expected_planned_action text;
  v_expected_active_role_ids uuid[];
  v_actual_active_role_ids uuid[];
  v_old_profile jsonb;
  v_new_profile jsonb;
  v_updated_count integer := 0;
  v_pending_count integer := 0;
  v_row_index integer := 0;
  v_preflight_target_users uuid[] := array[]::uuid[];
  v_user_role_id uuid;
  v_requested_role_id uuid;
  v_requested_role_count integer;
  v_role_should_activate boolean;
  v_credential_state text;
  v_credential_suspension_id uuid;
  v_target_is_active_super_admin boolean;
  v_target_credential_eligible boolean := true;
  v_active_super_admin_count integer := 0;
  v_super_admin_removal_count integer := 0;
  v_super_admin_addition_count integer := 0;
  v_database_row_count integer := 0;
  v_database_audit_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'PATCH83T_SERVICE_ROLE_REQUIRED';
  end if;

  if coalesce(p_payload->>'execution_confirmation', '') <> 'EXECUTE USER IMPORT' then
    raise exception 'PATCH83T_EXECUTION_CONFIRMATION_REQUIRED';
  end if;

  select p.organization_id
  into v_actor_org
  from public.profiles p
  where p.id = p_actor_id
    and p.organization_id is not null
    and p.is_active = true
    and coalesce(p.user_status, 'active') = 'active';

  if v_actor_org is null then
    raise exception 'PATCH83T_ACTIVE_ACTOR_REQUIRED';
  end if;

  -- Serialize controlled imports for an organization. This makes the batch-level
  -- last-Super-Admin calculation stable across concurrent Patch 83T executions.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('patch83t-user-import:' || v_actor_org::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('patch83u-super-admin-eligibility:' || v_actor_org::text, 0)
  );

  perform 1
  from public.profiles p
  where p.id = p_actor_id
    and p.organization_id = v_actor_org
    and p.is_active = true
    and coalesce(p.user_status, 'active') = 'active'
  for update;
  if not found then
    raise exception 'PATCH83T_ACTIVE_ACTOR_REQUIRED';
  end if;

  perform 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role in ('super_admin', 'governance_admin')
      and ur.scope = 'global'
      and (ur.organization_id is null or ur.organization_id = v_actor_org)
      and ur.division_id is null
      and ur.department_id is null
      and ur.unit_id is null
    for update;
  if not found then
    raise exception 'PATCH83T_USER_ADMIN_REQUIRED';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and (ur.organization_id is null or ur.organization_id = v_actor_org)
      and ur.division_id is null
      and ur.department_id is null
      and ur.unit_id is null
  ) into v_actor_is_super_admin;

  -- Lock the organization's currently eligible Super Admin identities and role
  -- assignments so lifecycle/role changes cannot invalidate the batch guard.
  perform 1
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.is_active = true
    and ur.role = 'super_admin'
    and ur.scope = 'global'
    and (ur.organization_id is null or ur.organization_id = v_actor_org)
    and ur.division_id is null
    and ur.department_id is null
    and ur.unit_id is null
    and p.organization_id = v_actor_org
    and p.is_active = true
    and coalesce(p.user_status, 'active') = 'active'
  for update of ur, p;
  if to_regclass('public.user_credential_states') is not null then
    execute $patch83t_lock_eligible_admins$
      select 1
      from public.user_credential_states cs
      join public.profiles p on p.id = cs.user_id
      where p.organization_id = $1
        and p.is_active = true
        and p.user_status = 'active'
        and cs.organization_id = $1
        and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
        and cs.credential_state = 'active'
      for update of cs
    $patch83t_lock_eligible_admins$ using v_actor_org;
  end if;

  if coalesce(p_payload->>'source_format', '') <> 'xlsx' then
    raise exception 'PATCH83T_XLSX_SOURCE_REQUIRED';
  end if;

  v_rows := coalesce(p_payload->'rows', '[]'::jsonb);
  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'PATCH83T_ROWS_ARRAY_REQUIRED';
  end if;
  if jsonb_array_length(v_rows) = 0 or jsonb_array_length(v_rows) > 5000 then
    raise exception 'PATCH83T_ROW_COUNT_INVALID';
  end if;
  v_payload_sha256 := encode(digest(convert_to(v_rows::text, 'UTF8'), 'sha256'), 'hex');

  if exists (
    select 1
    from jsonb_array_elements(v_rows) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(item->>'validation_status', '') <> 'valid'
  ) then
    raise exception 'PATCH83T_ALL_ROWS_MUST_BE_VALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_rows) item
    group by trim(item->>'employee_id')
    having trim(item->>'employee_id') <> '' and count(*) > 1
  ) then
    raise exception 'PATCH83T_DUPLICATE_EMPLOYEE_ID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_rows) item
    group by lower(trim(item->>'employee_id'))
    having lower(trim(item->>'employee_id')) <> '' and count(*) > 1
  ) then
    raise exception 'PATCH83T_AUTH_EMAIL_ALIAS_COLLISION';
  end if;

  -- Full preflight. Any rejection occurs before batch, row, profile, role, or audit writes.
  for v_row in select value from jsonb_array_elements(v_rows)
  loop
    if jsonb_typeof(v_row->'employee_id') <> 'string'
      or (v_row ? 'contact_email' and jsonb_typeof(v_row->'contact_email') not in ('string', 'null'))
      or (v_row ? 'phone' and jsonb_typeof(v_row->'phone') not in ('string', 'null'))
      or jsonb_typeof(v_row->'department_code') <> 'string'
      or jsonb_typeof(v_row->'account_action') <> 'string'
    then
      raise exception 'PATCH83T_TEXT_FIELDS_REQUIRED';
    end if;

    if not (v_row ? 'expected_matched_user_id')
      or jsonb_typeof(v_row->'expected_matched_user_id') not in ('string', 'null')
      or not (v_row ? 'expected_planned_action')
      or jsonb_typeof(v_row->'expected_planned_action') <> 'string'
      or not (v_row ? 'expected_active_role_ids')
      or jsonb_typeof(v_row->'expected_active_role_ids') <> 'array'
    then
      raise exception 'PATCH83T_PREVIEW_ASSERTIONS_REQUIRED';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_row->'expected_active_role_ids') role_id
      where jsonb_typeof(role_id) <> 'string'
    ) then
      raise exception 'PATCH83T_PREVIEW_ROLE_IDS_INVALID';
    end if;

    begin
      v_expected_target_user := nullif(trim(coalesce(v_row->>'expected_matched_user_id', '')), '')::uuid;
    exception when invalid_text_representation then
      raise exception 'PATCH83T_PREVIEW_TARGET_INVALID';
    end;
    v_expected_planned_action := trim(coalesce(v_row->>'expected_planned_action', ''));
    if v_expected_planned_action not in ('update_existing_profile', 'pending_account_creation') then
      raise exception 'PATCH83T_PREVIEW_ACTION_INVALID';
    end if;
    begin
      select coalesce(array_agg(role_id::uuid order by role_id::uuid), array[]::uuid[])
      into v_expected_active_role_ids
      from jsonb_array_elements_text(v_row->'expected_active_role_ids') role_id;
    exception when invalid_text_representation then
      raise exception 'PATCH83T_PREVIEW_ROLE_IDS_INVALID';
    end;

    v_employee_id := trim(coalesce(v_row->>'employee_id', ''));
    v_auth_email := lower(v_employee_id) || '@almodawat.sa';
    v_contact_email := lower(trim(coalesce(v_row->>'contact_email', '')));
    v_phone := trim(coalesce(v_row->>'phone', ''));
    v_department_code := trim(coalesce(v_row->>'department_code', ''));
    v_status := trim(coalesce(v_row->>'status', ''));
    v_user_type := trim(coalesce(v_row->>'user_type', ''));
    v_account_action := trim(coalesce(v_row->>'account_action', ''));

    if v_employee_id = ''
      or trim(coalesce(v_row->>'full_name_en', '')) = ''
      or v_department_code = ''
      or trim(coalesce(v_row->>'job_title', '')) = ''
      or trim(coalesce(v_row->>'role', '')) = ''
      or trim(coalesce(v_row->>'role_scope', '')) = ''
      or v_status = ''
      or v_user_type = ''
      or v_account_action = ''
    then
      raise exception 'PATCH83T_REQUIRED_FIELD_MISSING at row %', coalesce(v_row->>'row_number', '?');
    end if;

    if v_user_type = 'employee' and trim(coalesce(v_row->>'full_name_ar', '')) = '' then
      raise exception 'PATCH83T_ARABIC_NAME_REQUIRED at row %', coalesce(v_row->>'row_number', '?');
    end if;

    if v_contact_email <> ''
      and v_contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then
      raise exception 'PATCH83T_CONTACT_EMAIL_INVALID at row %', coalesce(v_row->>'row_number', '?');
    end if;

    if length(v_employee_id) > 64
      or v_employee_id !~ '^[A-Za-z0-9._-]+$'
    then
      raise exception 'PATCH83T_EMPLOYEE_ID_AUTH_INCOMPATIBLE at row %', coalesce(v_row->>'row_number', '?');
    end if;

    if v_account_action not in ('create', 'update', 'create_or_update') then
      raise exception 'PATCH83T_ACCOUNT_ACTION_INVALID at row %', coalesce(v_row->>'row_number', '?');
    end if;

    if v_status not in ('active', 'inactive', 'archived', 'invited', 'locked') then
      raise exception 'PATCH83T_STATUS_INVALID at row %', coalesce(v_row->>'row_number', '?');
    end if;
    if v_user_type not in ('employee', 'contractor', 'vendor', 'external_auditor', 'service_account') then
      raise exception 'PATCH83T_USER_TYPE_INVALID at row %', coalesce(v_row->>'row_number', '?');
    end if;
    if trim(v_row->>'role') not in (
      'super_admin', 'executive', 'governance_admin', 'division_head', 'department_manager',
      'project_owner', 'milestone_owner', 'task_owner', 'auditor', 'compliance_officer', 'viewer', 'employee'
    ) then
      raise exception 'PATCH83T_ROLE_INVALID at row %', coalesce(v_row->>'row_number', '?');
    end if;
    if trim(v_row->>'role_scope') not in ('global', 'department', 'assigned_only') then
      raise exception 'PATCH83T_ROLE_SCOPE_INVALID at row %', coalesce(v_row->>'row_number', '?');
    end if;

    v_role := trim(v_row->>'role')::public.app_role;
    v_scope := trim(v_row->>'role_scope')::public.access_scope;
    if v_role = 'division_head' then
      raise exception 'PATCH83T_DIVISION_HEAD_SCOPE_UNSUPPORTED at row %', coalesce(v_row->>'row_number', '?');
    end if;
    if not (
      (v_role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer') and v_scope = 'global')
      or (v_role = 'department_manager' and v_scope = 'department')
      or (v_role in ('project_owner', 'milestone_owner', 'task_owner', 'viewer', 'employee') and v_scope = 'assigned_only')
    ) then
      raise exception 'PATCH83T_ROLE_SCOPE_COMBINATION_INVALID at row %', coalesce(v_row->>'row_number', '?');
    end if;
    if v_role in ('super_admin', 'executive', 'governance_admin') and not v_actor_is_super_admin then
      raise exception 'PATCH83T_PRIVILEGED_ROLE_REQUIRES_SUPER_ADMIN';
    end if;

    v_department_id := null;
    select d.id
    into v_department_id
    from public.departments d
    where d.organization_id = v_actor_org
      and lower(trim(d.code)) = lower(v_department_code)
      and d.is_active = true
      and d.archived_at is null
    limit 1;

    if v_department_id is null then
      if exists (
        select 1
        from public.departments d
        where d.organization_id = v_actor_org
          and lower(trim(d.code)) = lower(v_department_code)
          and (d.is_active = false or d.archived_at is not null)
      ) then
        raise exception 'PATCH83T_ARCHIVED_DEPARTMENT_RESTORE_REQUIRED at row %', coalesce(v_row->>'row_number', '?');
      end if;
      raise exception 'PATCH83T_ACTIVE_DEPARTMENT_REQUIRED at row %', coalesce(v_row->>'row_number', '?');
    end if;

    if v_scope = 'department' and v_department_id is null then
      raise exception 'PATCH83T_DEPARTMENT_SCOPE_REFERENCE_REQUIRED';
    end if;

    if v_phone <> '' then
      if v_phone ~ '^05[0-9]{8}$' then
        v_phone := '+966' || substr(v_phone, 2);
      elsif v_phone ~ '^9665[0-9]{8}$' then
        v_phone := '+' || v_phone;
      elsif v_phone ~ '^009665[0-9]{8}$' then
        v_phone := '+' || substr(v_phone, 3);
      elsif v_phone !~ '^\+9665[0-9]{8}$' then
        raise exception 'PATCH83T_PHONE_INVALID at row %', coalesce(v_row->>'row_number', '?');
      end if;
    end if;

    v_employee_user_id := null;
    v_synthetic_profile_user_id := null;
    v_auth_identity_user_id := null;
    v_open_provisioning_id := null;

    select count(*), min(p.id::text)::uuid, min(p.organization_id::text)::uuid
    into v_employee_match_count, v_employee_user_id, v_employee_match_org
    from public.profiles p
    where trim(p.employee_no) = v_employee_id;
    if v_employee_match_count > 1 then
      raise exception 'PATCH83T_AMBIGUOUS_EMPLOYEE_ID';
    end if;
    if v_employee_user_id is not null and v_employee_match_org is distinct from v_actor_org then
      raise exception 'PATCH83T_EMPLOYEE_ID_ORGANIZATION_CONFLICT';
    end if;
    if exists (
      select 1
      from public.profiles p
      where lower(btrim(p.employee_no)) = lower(v_employee_id)
        and btrim(p.employee_no) is distinct from v_employee_id
    ) then
      raise exception 'PATCH83T_EMPLOYEE_ID_CASE_INSENSITIVE_CONFLICT';
    end if;

    select count(*), min(p.id::text)::uuid, min(p.organization_id::text)::uuid, min(p.employee_no)
    into v_synthetic_profile_match_count, v_synthetic_profile_user_id,
         v_synthetic_profile_match_org, v_synthetic_profile_employee_id
    from public.profiles p
    where lower(trim(p.email)) = v_auth_email;
    if v_synthetic_profile_match_count > 1 then
      raise exception 'PATCH83T_AMBIGUOUS_SYNTHETIC_AUTH_EMAIL';
    end if;
    if v_synthetic_profile_user_id is not null
      and v_synthetic_profile_match_org is distinct from v_actor_org
    then
      raise exception 'PATCH83T_AUTH_EMAIL_ORGANIZATION_CONFLICT';
    end if;
    if v_synthetic_profile_user_id is not null
      and v_synthetic_profile_employee_id is not null
      and v_synthetic_profile_employee_id is distinct from v_employee_id
    then
      raise exception 'PATCH83T_SYNTHETIC_PROFILE_EMPLOYEE_ID_CONFLICT';
    end if;
    if v_employee_user_id is not null
      and v_synthetic_profile_user_id is not null
      and v_employee_user_id <> v_synthetic_profile_user_id
    then
      raise exception 'PATCH83T_EMPLOYEE_AUTH_EMAIL_CROSS_USER_CONFLICT';
    end if;

    v_target_user := coalesce(v_employee_user_id, v_synthetic_profile_user_id);

    select count(*), min(au.id::text)::uuid
    into v_auth_identity_match_count, v_auth_identity_user_id
    from auth.users au
    where lower(btrim(au.email)) = v_auth_email;
    if v_auth_identity_match_count > 1 then
      raise exception 'PATCH83T_AMBIGUOUS_AUTH_IDENTITY';
    end if;
    if v_synthetic_profile_user_id is not null and v_auth_identity_user_id is null then
      raise exception 'PATCH83T_PROFILE_AUTH_IDENTITY_MISMATCH';
    end if;
    if v_target_user is not null
      and v_auth_identity_user_id is not null
      and v_auth_identity_user_id <> v_target_user
    then
      raise exception 'PATCH83T_AUTH_IDENTITY_CROSS_USER_CONFLICT';
    end if;

    select q.id
    into v_open_provisioning_id
    from public.user_account_provisioning q
    where q.provisioning_status not in ('completed', 'cancelled')
      and (
        lower(q.auth_email) = v_auth_email
        or lower(btrim(q.employee_id)) = lower(v_employee_id)
      )
    order by q.created_at, q.id
    limit 1
    for update;

    if v_account_action = 'create' then
      if v_target_user is not null then
        raise exception 'PATCH83T_CREATE_PROFILE_ALREADY_EXISTS at row %', coalesce(v_row->>'row_number', '?');
      end if;
      if v_auth_identity_user_id is not null then
        raise exception 'PATCH83T_CREATE_AUTH_IDENTITY_ALREADY_EXISTS at row %', coalesce(v_row->>'row_number', '?');
      end if;
      if v_open_provisioning_id is not null then
        raise exception 'PATCH83T_CREATE_OPEN_PROVISIONING_EXISTS at row %', coalesce(v_row->>'row_number', '?');
      end if;
    elsif v_account_action = 'update' then
      if v_target_user is null then
        raise exception 'PATCH83T_UPDATE_PROFILE_NOT_FOUND at row %', coalesce(v_row->>'row_number', '?');
      end if;
      if v_open_provisioning_id is not null then
        raise exception 'PATCH83T_UPDATE_OPEN_PROVISIONING_CONFLICT at row %', coalesce(v_row->>'row_number', '?');
      end if;
    else
      if v_target_user is null and v_auth_identity_user_id is not null then
        raise exception 'PATCH83T_CREATE_OR_UPDATE_AUTH_IDENTITY_WITHOUT_PROFILE at row %', coalesce(v_row->>'row_number', '?');
      end if;
      if v_open_provisioning_id is not null then
        raise exception 'PATCH83T_CREATE_OR_UPDATE_OPEN_PROVISIONING_CONFLICT at row %', coalesce(v_row->>'row_number', '?');
      end if;
    end if;

    if v_target_user is distinct from v_expected_target_user
      or v_expected_planned_action is distinct from (
        case
          when v_target_user is null then 'pending_account_creation'
          else 'update_existing_profile'
        end
      )
    then
      raise exception 'PATCH83T_PREVIEW_IDENTITY_CHANGED';
    end if;

    if v_target_user is not null and v_target_user = any(v_preflight_target_users) then
      raise exception 'PATCH83T_MULTIPLE_ROWS_TARGET_SAME_USER';
    end if;
    v_preflight_target_users := pg_catalog.array_append(v_preflight_target_users, v_target_user);

    if v_target_user is null then
      v_actual_active_role_ids := array[]::uuid[];
      if v_actual_active_role_ids is distinct from v_expected_active_role_ids then
        raise exception 'PATCH83T_PREVIEW_ROLE_STATE_CHANGED';
      end if;
      v_pending_count := v_pending_count + 1;
    else
      -- Hold the resolved profile stable through execution. The execution pass
      -- repeats identity checks and must resolve to this exact target.
      perform 1
      from public.profiles p
      where p.id = v_target_user
        and p.organization_id = v_actor_org
      for update;
      if not found then
        raise exception 'PATCH83T_TARGET_ORGANIZATION_MISMATCH';
      end if;

      -- Lock every existing assignment for the target. Together with the
      -- profile lock (which blocks new FK-backed assignments), this keeps the
      -- previewed role state stable until the transaction completes.
      perform 1
      from public.user_roles ur
      where ur.user_id = v_target_user
      for update;

      select coalesce(array_agg(ur.id order by ur.id), array[]::uuid[])
      into v_actual_active_role_ids
      from public.user_roles ur
      where ur.user_id = v_target_user
        and ur.is_active = true
        and (ur.organization_id is null or ur.organization_id = v_actor_org);
      if v_actual_active_role_ids is distinct from v_expected_active_role_ids then
        raise exception 'PATCH83T_PREVIEW_ROLE_STATE_CHANGED';
      end if;

      if v_target_user = p_actor_id and v_status <> 'active' then
        raise exception 'PATCH83T_SELF_DEACTIVATION_DENIED';
      end if;

      if exists (
        select 1
        from public.user_roles ur
        where ur.user_id = v_target_user
          and ur.is_active = true
          and ur.organization_id is not null
          and ur.organization_id <> v_actor_org
      ) then
        raise exception 'PATCH83T_CROSS_ORG_ROLE_ASSIGNMENT_REQUIRES_REVIEW';
      end if;

      if not v_actor_is_super_admin and exists (
        select 1
        from public.user_roles ur
        where ur.user_id = v_target_user
          and ur.is_active = true
          and ur.role in ('super_admin', 'executive', 'governance_admin')
          and (ur.organization_id is null or ur.organization_id = v_actor_org)
      ) then
        raise exception 'PATCH83T_PRIVILEGED_ROLE_CHANGE_REQUIRES_SUPER_ADMIN';
      end if;

      if v_target_user = p_actor_id and (
        v_role not in ('super_admin', 'governance_admin')
        or not exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p_actor_id
            and ur.is_active = true
            and ur.role = v_role
            and ur.scope = v_scope
            and ur.organization_id is not distinct from v_actor_org
            and ur.division_id is null
            and ur.department_id is not distinct from case when v_scope = 'department' then v_department_id else null end
            and ur.unit_id is null
        )
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p_actor_id
            and ur.is_active = true
            and (ur.organization_id is null or ur.organization_id = v_actor_org)
            and not (
              ur.role = v_role
              and ur.scope = v_scope
              and ur.organization_id is not distinct from v_actor_org
              and ur.division_id is null
              and ur.department_id is not distinct from case when v_scope = 'department' then v_department_id else null end
              and ur.unit_id is null
            )
        )
      ) then
        raise exception 'PATCH83T_SELF_ROLE_CHANGE_DENIED';
      end if;

      if to_regclass('public.user_credential_states') is not null then
        execute $patch83t_target_super$
          select exists (
            select 1
            from public.user_roles ur
            join public.profiles p on p.id = ur.user_id
            join public.user_credential_states cs on cs.user_id = p.id
            where ur.user_id = $1
              and ur.is_active = true
              and ur.role = 'super_admin'
              and ur.scope = 'global'
              and (ur.organization_id is null or ur.organization_id = $2)
              and ur.division_id is null
              and ur.department_id is null
              and ur.unit_id is null
              and p.organization_id = $2
              and p.is_active = true
              and p.user_status = 'active'
              and cs.organization_id = $2
              and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
              and cs.credential_state = 'active'
          )
        $patch83t_target_super$
        into v_target_is_active_super_admin
        using v_target_user, v_actor_org;

        execute $patch83t_target_credential$
          select exists (
            select 1
            from public.profiles p
            join public.user_credential_states cs on cs.user_id = p.id
            where p.id = $1
              and p.organization_id = $2
              and p.is_active = true
              and p.user_status = 'active'
              and cs.organization_id = $2
              and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
              and cs.credential_state = 'active'
          )
        $patch83t_target_credential$
        into v_target_credential_eligible
        using v_target_user, v_actor_org;
      else
        select exists (
          select 1
          from public.user_roles ur
          join public.profiles p on p.id = ur.user_id
          where ur.user_id = v_target_user
            and ur.is_active = true
            and ur.role = 'super_admin'
            and ur.scope = 'global'
            and (ur.organization_id is null or ur.organization_id = v_actor_org)
            and ur.division_id is null
            and ur.department_id is null
            and ur.unit_id is null
            and p.organization_id = v_actor_org
            and p.is_active = true
            and coalesce(p.user_status, 'active') = 'active'
        ) into v_target_is_active_super_admin;
        v_target_credential_eligible := true;
      end if;

      if v_target_is_active_super_admin
        and (v_status <> 'active' or v_role <> 'super_admin')
      then
        v_super_admin_removal_count := v_super_admin_removal_count + 1;
      elsif not v_target_is_active_super_admin
        and v_status = 'active'
        and v_role = 'super_admin'
        and v_target_credential_eligible
      then
        v_super_admin_addition_count := v_super_admin_addition_count + 1;
      end if;

      v_updated_count := v_updated_count + 1;
    end if;
  end loop;

  if to_regclass('public.user_credential_states') is not null then
    execute $patch83t_super_count$
      select count(distinct ur.user_id)::integer
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id
      join public.user_credential_states cs on cs.user_id = p.id
      where ur.is_active = true
        and ur.role = 'super_admin'
        and ur.scope = 'global'
        and (ur.organization_id is null or ur.organization_id = $1)
        and ur.division_id is null
        and ur.department_id is null
        and ur.unit_id is null
        and p.organization_id = $1
        and p.is_active = true
        and p.user_status = 'active'
        and cs.organization_id = $1
        and cs.identity_mode in ('employee_id_managed', 'legacy_verified')
        and cs.credential_state = 'active'
    $patch83t_super_count$
    into v_active_super_admin_count
    using v_actor_org;
  else
    select count(distinct ur.user_id)::integer
    into v_active_super_admin_count
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.is_active = true
      and ur.role = 'super_admin'
      and ur.scope = 'global'
      and (ur.organization_id is null or ur.organization_id = v_actor_org)
      and ur.division_id is null
      and ur.department_id is null
      and ur.unit_id is null
      and p.organization_id = v_actor_org
      and p.is_active = true
      and coalesce(p.user_status, 'active') = 'active';
  end if;

  if v_super_admin_removal_count > 0
    and v_active_super_admin_count
        - v_super_admin_removal_count
        + v_super_admin_addition_count < 1
  then
    raise exception 'PATCH83T_LAST_SUPER_ADMIN_DEACTIVATION_DENIED';
  end if;

  insert into public.user_management_import_batches (
    organization_id,
    file_name,
    source_format,
    row_count,
    valid_count,
    invalid_count,
    duplicate_employee_id_count,
    duplicate_contact_email_count,
    unknown_department_count,
    unknown_role_count,
    invalid_phone_count,
    existing_user_update_count,
    pending_account_creation_count,
    status,
    validation_summary,
    created_by,
    applied_by,
    applied_at
  ) values (
    v_actor_org,
    nullif(trim(p_payload->>'file_name'), ''),
    'xlsx',
    jsonb_array_length(v_rows),
    jsonb_array_length(v_rows),
    0,
    0,
    0,
    0,
    0,
    0,
    v_updated_count,
    v_pending_count,
    'applied',
    jsonb_build_object(
      'row_count', jsonb_array_length(v_rows),
      'valid_count', jsonb_array_length(v_rows),
      'invalid_count', 0,
      'existing_user_update_count', v_updated_count,
      'pending_account_creation_count', v_pending_count,
      'payload_sha256', v_payload_sha256,
      'execution_confirmation', 'EXECUTE USER IMPORT',
      'source', 'controlled_user_excel_import'
    ),
    p_actor_id,
    p_actor_id,
    now()
  ) returning id into v_batch_id;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'patch83u.super_admin_batch_guard_verified',
    v_actor_org::text || ':' || p_actor_id::text,
    true
  );

  v_updated_count := 0;
  v_pending_count := 0;
  v_row_index := 0;
  for v_row in select value from jsonb_array_elements(v_rows)
  loop
    v_row_index := v_row_index + 1;
    v_employee_id := trim(v_row->>'employee_id');
    v_auth_email := lower(v_employee_id) || '@almodawat.sa';
    v_contact_email := lower(trim(coalesce(v_row->>'contact_email', '')));
    v_phone := trim(coalesce(v_row->>'phone', ''));
    v_department_code := trim(v_row->>'department_code');
    v_status := trim(v_row->>'status');
    v_user_type := trim(v_row->>'user_type');
    v_account_action := trim(v_row->>'account_action');
    v_role := trim(v_row->>'role')::public.app_role;
    v_scope := trim(v_row->>'role_scope')::public.access_scope;

    if v_phone ~ '^05[0-9]{8}$' then
      v_phone := '+966' || substr(v_phone, 2);
    elsif v_phone ~ '^9665[0-9]{8}$' then
      v_phone := '+' || v_phone;
    elsif v_phone ~ '^009665[0-9]{8}$' then
      v_phone := '+' || substr(v_phone, 3);
    end if;

    select d.id, d.division_id
    into strict v_department_id, v_division_id
    from public.departments d
    where d.organization_id = v_actor_org
      and lower(trim(d.code)) = lower(v_department_code)
      and d.is_active = true
      and d.archived_at is null;

    v_employee_user_id := null;
    v_synthetic_profile_user_id := null;
    v_auth_identity_user_id := null;
    v_open_provisioning_id := null;

    select count(*), min(p.id::text)::uuid, min(p.organization_id::text)::uuid
    into v_employee_match_count, v_employee_user_id, v_employee_match_org
    from public.profiles p
    where trim(p.employee_no) = v_employee_id;
    if v_employee_match_count > 1 then
      raise exception 'PATCH83T_AMBIGUOUS_EMPLOYEE_ID';
    end if;
    if v_employee_user_id is not null and v_employee_match_org is distinct from v_actor_org then
      raise exception 'PATCH83T_EMPLOYEE_ID_ORGANIZATION_CONFLICT';
    end if;
    if exists (
      select 1
      from public.profiles p
      where lower(btrim(p.employee_no)) = lower(v_employee_id)
        and btrim(p.employee_no) is distinct from v_employee_id
    ) then
      raise exception 'PATCH83T_EMPLOYEE_ID_CASE_INSENSITIVE_CONFLICT';
    end if;

    select count(*), min(p.id::text)::uuid, min(p.organization_id::text)::uuid, min(p.employee_no)
    into v_synthetic_profile_match_count, v_synthetic_profile_user_id,
         v_synthetic_profile_match_org, v_synthetic_profile_employee_id
    from public.profiles p
    where lower(trim(p.email)) = v_auth_email;
    if v_synthetic_profile_match_count > 1 then
      raise exception 'PATCH83T_AMBIGUOUS_SYNTHETIC_AUTH_EMAIL';
    end if;
    if v_synthetic_profile_user_id is not null
      and v_synthetic_profile_match_org is distinct from v_actor_org
    then
      raise exception 'PATCH83T_AUTH_EMAIL_ORGANIZATION_CONFLICT';
    end if;
    if v_synthetic_profile_user_id is not null
      and v_synthetic_profile_employee_id is not null
      and v_synthetic_profile_employee_id is distinct from v_employee_id
    then
      raise exception 'PATCH83T_SYNTHETIC_PROFILE_EMPLOYEE_ID_CONFLICT';
    end if;
    if v_employee_user_id is not null
      and v_synthetic_profile_user_id is not null
      and v_employee_user_id <> v_synthetic_profile_user_id
    then
      raise exception 'PATCH83T_EMPLOYEE_AUTH_EMAIL_CROSS_USER_CONFLICT';
    end if;

    v_target_user := coalesce(v_employee_user_id, v_synthetic_profile_user_id);
    select count(*), min(au.id::text)::uuid
    into v_auth_identity_match_count, v_auth_identity_user_id
    from auth.users au
    where lower(btrim(au.email)) = v_auth_email;
    if v_auth_identity_match_count > 1 then
      raise exception 'PATCH83T_AMBIGUOUS_AUTH_IDENTITY';
    end if;
    if v_synthetic_profile_user_id is not null and v_auth_identity_user_id is null then
      raise exception 'PATCH83T_PROFILE_AUTH_IDENTITY_MISMATCH';
    end if;
    if v_target_user is not null
      and v_auth_identity_user_id is not null
      and v_auth_identity_user_id <> v_target_user
    then
      raise exception 'PATCH83T_AUTH_IDENTITY_CROSS_USER_CONFLICT';
    end if;
    if v_target_user is null and v_auth_identity_user_id is not null then
      raise exception 'PATCH83T_AUTH_IDENTITY_CHANGED_DURING_EXECUTION';
    end if;

    select q.id
    into v_open_provisioning_id
    from public.user_account_provisioning q
    where q.provisioning_status not in ('completed', 'cancelled')
      and (
        lower(q.auth_email) = v_auth_email
        or lower(btrim(q.employee_id)) = lower(v_employee_id)
      )
    order by q.created_at, q.id
    limit 1
    for update;
    if v_open_provisioning_id is not null then
      raise exception 'PATCH83T_PROVISIONING_IDENTITY_CHANGED_DURING_EXECUTION';
    end if;

    if v_account_action = 'create' and v_target_user is not null then
      raise exception 'PATCH83T_CREATE_IDENTITY_CHANGED_DURING_EXECUTION';
    elsif v_account_action = 'update' and v_target_user is null then
      raise exception 'PATCH83T_UPDATE_IDENTITY_CHANGED_DURING_EXECUTION';
    end if;
    if v_target_user is distinct from v_preflight_target_users[v_row_index] then
      raise exception 'PATCH83T_IDENTITY_CHANGED_DURING_EXECUTION';
    end if;

    select coalesce(array_agg(role_id::uuid order by role_id::uuid), array[]::uuid[])
    into v_expected_active_role_ids
    from jsonb_array_elements_text(v_row->'expected_active_role_ids') role_id;
    select coalesce(array_agg(ur.id order by ur.id), array[]::uuid[])
    into v_actual_active_role_ids
    from public.user_roles ur
    where ur.user_id = v_target_user
      and ur.is_active = true
      and (ur.organization_id is null or ur.organization_id = v_actor_org);
    if v_actual_active_role_ids is distinct from v_expected_active_role_ids then
      raise exception 'PATCH83T_PREVIEW_ROLE_STATE_CHANGED';
    end if;

    insert into public.user_management_import_rows (
      organization_id,
      batch_id,
      row_number,
      raw_data,
      normalized_email,
      validation_status,
      validation_errors,
      validation_warnings,
      action_status,
      matched_user_id
    ) values (
      v_actor_org,
      v_batch_id,
      coalesce((v_row->>'row_number')::integer, 0),
      jsonb_build_object(
        'employee_id', v_employee_id,
        'auth_email', v_auth_email,
        'contact_email', nullif(v_contact_email, ''),
        'account_action', v_account_action,
        'department_code', v_department_code,
        'planned_action', case when v_target_user is null then 'pending_account_creation' else 'update_existing_profile' end,
        'planned_operation', case when v_target_user is null then 'pending_account_creation' else 'update_existing_profile' end
      ),
      v_auth_email,
      'valid',
      array[]::text[],
      case
        when v_target_user is null then array['Separate controlled Supabase Auth account creation is required.']::text[]
        else array[]::text[]
      end,
      case when v_target_user is null then 'pending_account_creation' else 'updated_existing_user' end,
      v_target_user
    ) returning id into v_import_row_id;

    if v_target_user is null then
      v_auth_email := lower(v_employee_id) || '@almodawat.sa';
      insert into public.user_account_provisioning (
        organization_id,
        import_batch_id,
        import_row_id,
        employee_id,
        auth_email,
        contact_email,
        full_name_en,
        full_name_ar,
        phone,
        division_id,
        department_id,
        department_code,
        job_title,
        requested_role,
        requested_scope,
        requested_user_type,
        requested_lifecycle,
        account_action,
        provisioning_status,
        created_by
      ) values (
        v_actor_org,
        v_batch_id,
        v_import_row_id,
        v_employee_id,
        v_auth_email,
        nullif(v_contact_email, ''),
        trim(v_row->>'full_name_en'),
        nullif(trim(coalesce(v_row->>'full_name_ar', '')), ''),
        nullif(v_phone, ''),
        v_division_id,
        v_department_id,
        v_department_code,
        trim(v_row->>'job_title'),
        v_role,
        v_scope,
        v_user_type,
        v_status,
        v_account_action,
        case when v_status in ('active', 'invited') then 'queued' else 'held_lifecycle' end,
        p_actor_id
      ) returning id into v_provisioning_id;
      v_provisioning_ids := pg_catalog.array_append(v_provisioning_ids, v_provisioning_id);
      v_pending_count := v_pending_count + 1;
      continue;
    end if;

    select jsonb_build_object(
      'full_name_en', p.full_name_en,
      'full_name_ar', p.full_name_ar,
      'employee_no', p.employee_no,
      'email', p.email,
      'contact_email', p.contact_email,
      'phone', p.phone,
      'division_id', p.division_id,
      'department_id', p.department_id,
      'unit_id', p.unit_id,
      'job_title', p.job_title,
      'user_type', p.user_type,
      'user_status', p.user_status,
      'active_roles', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'role', ur.role,
            'role_scope', ur.scope,
            'organization_id', ur.organization_id,
            'division_id', ur.division_id,
            'department_id', ur.department_id,
            'unit_id', ur.unit_id
          ) order by ur.role::text, ur.scope::text, ur.id::text
        )
        from public.user_roles ur
        where ur.user_id = p.id
          and ur.is_active = true
          and (ur.organization_id is null or ur.organization_id = v_actor_org)
      ), '[]'::jsonb)
    )
    into v_old_profile
    from public.profiles p
    where p.id = v_target_user
    for update;

    update public.profiles
    set
      full_name_en = trim(v_row->>'full_name_en'),
      full_name_ar = nullif(trim(coalesce(v_row->>'full_name_ar', '')), ''),
      employee_no = v_employee_id,
      contact_email = nullif(v_contact_email, ''),
      phone = nullif(v_phone, ''),
      job_title = trim(v_row->>'job_title'),
      division_id = v_division_id,
      department_id = v_department_id,
      unit_id = null,
      user_type = v_user_type,
      user_status = v_status,
      is_active = v_status in ('active', 'invited'),
      deactivated_at = case
        when v_status in ('inactive', 'archived', 'locked') then coalesce(deactivated_at, now())
        else null
      end,
      deactivated_by = case when v_status in ('inactive', 'archived', 'locked') then p_actor_id else null end,
      deactivation_reason = case
        when v_status in ('inactive', 'archived', 'locked') then 'Patch 83T controlled User Excel Import'
        else null
      end,
      last_reviewed_at = now(),
      updated_at = now()
    where id = v_target_user
      and organization_id = v_actor_org;

    if not found then
      raise exception 'PATCH83T_TARGET_ORGANIZATION_MISMATCH';
    end if;

    v_role_should_activate := v_status = 'active';
    v_credential_state := null;
    v_credential_suspension_id := null;
    if to_regclass('public.user_credential_states') is not null then
      execute
        'select credential_state, role_suspension_id
           from public.user_credential_states
          where user_id = $1
          for update'
      into v_credential_state, v_credential_suspension_id
      using v_target_user;

      if v_credential_state is null then
        raise exception 'PATCH83T_TARGET_CREDENTIAL_STATE_REQUIRED';
      end if;
      if not (
        (v_status = 'active' and v_credential_state in ('active', 'reactivation_change_required'))
        or (v_status = 'invited' and v_credential_state = 'initial_change_required')
        or (v_status in ('inactive', 'archived', 'locked') and v_credential_state = 'disabled')
      ) then
        raise exception 'PATCH83T_TARGET_CREDENTIAL_RECONCILIATION_REQUIRED';
      end if;
      v_role_should_activate := v_status = 'active' and v_credential_state = 'active';
    end if;

    -- The workbook role is authoritative for the imported organization. Remove
    -- stale active assignments through the audited role helper. Invited and
    -- reactivated managed identities keep the exact desired role inactive in a
    -- protected suspension set until the required password change completes.
    for v_user_role_id in
      select ur.id
      from public.user_roles ur
      where ur.user_id = v_target_user
        and ur.is_active = true
        and (
          not v_role_should_activate
          or (
            (ur.organization_id is null or ur.organization_id = v_actor_org)
            and not (
              ur.role = v_role
              and ur.scope = v_scope
              and ur.organization_id is not distinct from v_actor_org
              and ur.division_id is null
              and ur.department_id is not distinct from case when v_scope = 'department' then v_department_id else null end
              and ur.unit_id is null
            )
          )
        )
      order by ur.id
      for update
    loop
      perform public.deactivate_user_role(
        v_user_role_id,
        'Patch 83T controlled User Excel Import'
      );
    end loop;

    select count(*), min(ur.id::text)::uuid
    into v_requested_role_count, v_requested_role_id
    from public.user_roles ur
    where ur.user_id = v_target_user
      and ur.role = v_role
      and ur.scope = v_scope
      and ur.organization_id is not distinct from v_actor_org
      and ur.division_id is null
      and ur.department_id is not distinct from case when v_scope = 'department' then v_department_id else null end
      and ur.unit_id is null;
    if v_requested_role_count > 1 then
      raise exception 'PATCH83T_REQUESTED_ROLE_ASSIGNMENT_AMBIGUOUS';
    end if;

    if v_role_should_activate and not exists (
      select 1 from public.user_roles ur
      where ur.id = v_requested_role_id and ur.is_active = true
    ) then
      perform public.assign_user_role(
        v_target_user,
        v_role,
        v_scope,
        v_actor_org,
        null,
        case when v_scope = 'department' then v_department_id else null end,
        null,
        'Patch 83T controlled User Excel Import'
      );
      select ur.id into v_requested_role_id
      from public.user_roles ur
      where ur.user_id = v_target_user
        and ur.role = v_role
        and ur.scope = v_scope
        and ur.organization_id is not distinct from v_actor_org
        and ur.division_id is null
        and ur.department_id is not distinct from case when v_scope = 'department' then v_department_id else null end
        and ur.unit_id is null
      order by ur.id
      limit 1;
    elsif not v_role_should_activate then
      if v_requested_role_id is null then
        insert into public.user_roles (
          user_id, role, scope, organization_id, division_id,
          department_id, unit_id, is_active, assigned_by
        ) values (
          v_target_user, v_role, v_scope, v_actor_org, null,
          case when v_scope = 'department' then v_department_id else null end,
          null, false, p_actor_id
        ) returning id into v_requested_role_id;

        insert into public.role_change_audit (
          organization_id, target_user_id, user_role_id, action,
          new_data, reason, changed_by
        )
        select v_actor_org, v_target_user, v_requested_role_id, 'assigned',
          to_jsonb(ur),
          'Patch 83T requested role held until credential activation', p_actor_id
        from public.user_roles ur where ur.id = v_requested_role_id;
      end if;

      if to_regclass('public.user_credential_states') is not null then
        if v_credential_suspension_id is null then
          v_credential_suspension_id := gen_random_uuid();
          execute
            'update public.user_credential_states
                set role_suspension_id = $2
              where user_id = $1'
          using v_target_user, v_credential_suspension_id;
        end if;

        execute
          'update public.user_credential_suspended_roles
              set suspension_status = ''skipped'',
                  restore_error_code = ''PATCH83T_IMPORT_ROLE_REPLACED''
            where suspension_id = $1
              and user_id = $2
              and source_user_role_id is distinct from $3
              and suspension_status in (''suspended'', ''blocked'')'
        using v_credential_suspension_id, v_target_user, v_requested_role_id;

        execute
          'insert into public.user_credential_suspended_roles (
             suspension_id, organization_id, user_id, source_user_role_id,
             role, scope, role_organization_id, division_id, department_id,
             unit_id, suspension_status, suspended_by
           ) values ($1, $2, $3, $4, $5, $6, $2, null, $7, null, ''suspended'', $8)
           on conflict (suspension_id, source_user_role_id) do update
             set suspension_status = ''suspended'',
                 restored_user_role_id = null,
                 restored_at = null,
                 restore_error_code = null,
                 suspended_by = excluded.suspended_by,
                 suspended_at = clock_timestamp()'
        using v_credential_suspension_id, v_actor_org, v_target_user,
          v_requested_role_id, v_role, v_scope,
          case when v_scope = 'department' then v_department_id else null end,
          p_actor_id;
      end if;
    end if;

    select jsonb_build_object(
      'batch_id', v_batch_id,
      'full_name_en', p.full_name_en,
      'full_name_ar', p.full_name_ar,
      'employee_no', p.employee_no,
      'email', p.email,
      'contact_email', p.contact_email,
      'phone', p.phone,
      'division_id', p.division_id,
      'department_id', p.department_id,
      'unit_id', p.unit_id,
      'job_title', p.job_title,
      'user_type', p.user_type,
      'user_status', p.user_status,
      'active_roles', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'role', ur.role,
            'role_scope', ur.scope,
            'organization_id', ur.organization_id,
            'division_id', ur.division_id,
            'department_id', ur.department_id,
            'unit_id', ur.unit_id
          ) order by ur.role::text, ur.scope::text, ur.id::text
        )
        from public.user_roles ur
        where ur.user_id = p.id
          and ur.is_active = true
          and (ur.organization_id is null or ur.organization_id = v_actor_org)
      ), '[]'::jsonb)
    )
    into v_new_profile
    from public.profiles p
    where p.id = v_target_user;

    insert into public.user_management_audit_history (
      organization_id,
      target_user_id,
      actor_id,
      action,
      reason,
      old_data,
      new_data
    ) values (
      v_actor_org,
      v_target_user,
      p_actor_id,
      'import_applied',
      'Patch 83T controlled User Excel Import',
      v_old_profile,
      v_new_profile
    );
    v_updated_count := v_updated_count + 1;
  end loop;

  select count(*)::integer
  into v_database_row_count
  from public.user_management_import_rows r
  where r.batch_id = v_batch_id;

  select count(*)::integer
  into v_database_audit_count
  from public.user_management_audit_history h
  where h.organization_id = v_actor_org
    and h.new_data->>'batch_id' = v_batch_id::text;

  perform set_config('patch83u.super_admin_batch_guard_verified', '', true);

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'updated_count', v_updated_count,
    'pending_account_creation_count', v_pending_count,
    'provisioning_ids', to_jsonb(v_provisioning_ids),
    'database_proof', jsonb_build_object(
      'import_row_count', v_database_row_count,
      'provisioning_record_count', (
        select count(*)::integer
        from public.user_account_provisioning q
        where q.import_batch_id = v_batch_id
      ),
      'audit_record_count', v_database_audit_count,
      'payload_sha256', v_payload_sha256
    )
  );
end;
$$;

revoke all on function public.patch83t_apply_user_excel_import(uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.patch83t_apply_user_excel_import(uuid, jsonb)
to service_role;

comment on function public.patch83t_apply_user_excel_import(uuid, jsonb) is
'Patch 83T atomic, organization-scoped User Excel Import. Requires a verified active administrator through the service-role Edge bridge; unknown accounts remain pending and no Auth users are created.';

comment on table public.user_management_import_batches is
'Preview-first controlled user import batches. Patch 83T adds xlsx sources and summary-only validation metrics.';
