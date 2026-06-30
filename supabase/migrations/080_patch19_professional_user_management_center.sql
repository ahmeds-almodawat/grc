-- Patch 19 - Professional User Management Center
-- Adds app-level user lifecycle controls, import tracking, audit history, and
-- read-only roster views without deleting users or seeding user data.

alter table public.profiles add column if not exists user_status text;
alter table public.profiles alter column user_status set default 'active';
alter table public.profiles add column if not exists user_type text;
alter table public.profiles alter column user_type set default 'employee';
alter table public.profiles add column if not exists deactivated_at timestamptz;
alter table public.profiles add column if not exists deactivated_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists deactivation_reason text;
alter table public.profiles add column if not exists last_reviewed_at timestamptz;
alter table public.profiles add column if not exists last_login_at timestamptz;

-- Recovery note: Patch 19 lifecycle status is additive. Existing authenticated
-- users default to active when status is missing/null/unknown so migration order
-- cannot lock out current super_admin or governance_admin accounts.
update public.profiles
set user_status = 'active'
where user_status is null
  or user_status not in ('active', 'inactive', 'archived', 'invited', 'locked');

update public.profiles
set user_type = 'employee'
where user_type is null
  or user_type not in ('employee', 'contractor', 'vendor', 'external_auditor', 'service_account');

alter table public.profiles alter column user_status set not null;
alter table public.profiles alter column user_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_user_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_status_check
      check (user_status in ('active', 'inactive', 'archived', 'invited', 'locked'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_user_type_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_type_check
      check (user_type in ('employee', 'contractor', 'vendor', 'external_auditor', 'service_account'));
  end if;
end $$;

create or replace function public.patch19_sync_profile_status()
returns trigger
language plpgsql
as $$
begin
  if new.user_status is null or new.user_status not in ('active', 'inactive', 'archived', 'invited', 'locked') then
    new.user_status := 'active';
  end if;
  if new.user_type is null or new.user_type not in ('employee', 'contractor', 'vendor', 'external_auditor', 'service_account') then
    new.user_type := 'employee';
  end if;

  if new.user_status in ('inactive', 'archived', 'locked') then
    new.is_active := false;
    if new.deactivated_at is null then
      new.deactivated_at := now();
    end if;
  else
    new.is_active := true;
    if new.user_status = 'active' then
      new.deactivated_at := null;
      new.deactivated_by := null;
      new.deactivation_reason := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_patch19_sync_profile_status on public.profiles;
create trigger trg_patch19_sync_profile_status
before insert or update of user_status, is_active, deactivated_at, deactivated_by, deactivation_reason
on public.profiles
for each row execute function public.patch19_sync_profile_status();

create table if not exists public.user_management_audit_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in (
    'profile_updated',
    'department_updated',
    'role_assigned',
    'deactivated',
    'reactivated',
    'archived',
    'unarchived',
    'import_applied',
    'bulk_action'
  )),
  reason text,
  old_data jsonb,
  new_data jsonb,
  linked_record_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_management_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_code text not null default ('UM-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  file_name text,
  source_format text not null default 'csv' check (source_format in ('csv')),
  row_count integer not null default 0,
  valid_count integer not null default 0,
  invalid_count integer not null default 0,
  duplicate_email_count integer not null default 0,
  unknown_department_count integer not null default 0,
  unknown_role_count integer not null default 0,
  status text not null default 'previewed' check (status in ('previewed', 'applied', 'rejected', 'failed')),
  validation_summary jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  applied_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create table if not exists public.user_management_import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.user_management_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  normalized_email text,
  validation_status text not null default 'error' check (validation_status in ('valid', 'warning', 'error')),
  validation_errors text[] not null default array[]::text[],
  validation_warnings text[] not null default array[]::text[],
  action_status text not null default 'pending' check (action_status in (
    'pending',
    'updated_existing_user',
    'pending_account_creation',
    'skipped_invalid'
  )),
  matched_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch19_profiles_status on public.profiles(organization_id, user_status);
create index if not exists idx_patch19_profiles_user_type on public.profiles(organization_id, user_type);
create index if not exists idx_patch19_audit_org_user on public.user_management_audit_history(organization_id, target_user_id, created_at desc);
create index if not exists idx_patch19_import_batches_org on public.user_management_import_batches(organization_id, created_at desc);
create index if not exists idx_patch19_import_rows_batch on public.user_management_import_rows(batch_id, validation_status);

alter table public.user_management_audit_history enable row level security;
alter table public.user_management_import_batches enable row level security;
alter table public.user_management_import_rows enable row level security;

drop policy if exists user_management_audit_history_org_read on public.user_management_audit_history;
create policy user_management_audit_history_org_read
on public.user_management_audit_history
for select to authenticated
using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  or public.can_access_org(organization_id)
);

drop policy if exists user_management_audit_history_admin_insert on public.user_management_audit_history;
create policy user_management_audit_history_admin_insert
on public.user_management_audit_history
for insert to authenticated
with check (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
);

drop policy if exists user_management_import_batches_org_read on public.user_management_import_batches;
create policy user_management_import_batches_org_read
on public.user_management_import_batches
for select to authenticated
using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  or public.can_access_org(organization_id)
);

drop policy if exists user_management_import_batches_admin_insert on public.user_management_import_batches;
create policy user_management_import_batches_admin_insert
on public.user_management_import_batches
for insert to authenticated
with check (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
);

drop policy if exists user_management_import_batches_admin_update on public.user_management_import_batches;
create policy user_management_import_batches_admin_update
on public.user_management_import_batches
for update to authenticated
using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
)
with check (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
);

drop policy if exists user_management_import_rows_org_read on public.user_management_import_rows;
create policy user_management_import_rows_org_read
on public.user_management_import_rows
for select to authenticated
using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  or public.can_access_org(organization_id)
);

drop policy if exists user_management_import_rows_admin_insert on public.user_management_import_rows;
create policy user_management_import_rows_admin_insert
on public.user_management_import_rows
for insert to authenticated
with check (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
);

create or replace view public.v_user_management_roster
with (security_invoker = true) as
select
  p.organization_id,
  p.id as user_id,
  p.employee_no,
  p.full_name_en,
  p.full_name_ar,
  p.email,
  p.phone,
  p.job_title,
  coalesce(p.user_type, 'employee') as user_type,
  coalesce(p.user_status, 'active') as user_status,
  p.is_active,
  p.created_at,
  p.updated_at,
  p.last_login_at,
  p.last_reviewed_at,
  p.deactivated_at,
  p.deactivated_by,
  p.deactivation_reason,
  p.division_id,
  div.name_en as division_name,
  p.department_id,
  dep.code as department_code,
  dep.name_en as department_name,
  dep.name_ar as department_name_ar,
  p.unit_id,
  unit.name_en as unit_name,
  coalesce(count(ur.id) filter (where ur.is_active = true), 0)::integer as active_role_count,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_role_id', ur.id,
        'role', ur.role,
        'scope', ur.scope,
        'organization_id', ur.organization_id,
        'department_id', ur.department_id,
        'is_active', ur.is_active,
        'assigned_at', ur.assigned_at
      ) order by ur.role::text
    ) filter (where ur.id is not null),
    '[]'::jsonb
  ) as roles,
  (
    select count(*) from public.projects pr
    where pr.owner_id = p.id or pr.sponsor_id = p.id
  )::integer as linked_project_count,
  (
    select count(*) from public.tasks t
    where t.owner_id = p.id or t.assigned_to = p.id
  )::integer as linked_task_count,
  (
    select count(*) from public.approvals a
    where a.requested_by = p.id or a.approver_id = p.id
  )::integer as linked_approval_count,
  (
    select count(*) from public.evidence_files e
    where e.uploaded_by = p.id or e.reviewed_by = p.id
  )::integer as linked_evidence_count,
  (
    select count(*) from public.projects pr
    where (pr.owner_id = p.id or pr.sponsor_id = p.id)
      and pr.status not in ('closed', 'cancelled')
  )::integer as open_project_count,
  (
    select count(*) from public.tasks t
    where (t.owner_id = p.id or t.assigned_to = p.id)
      and t.status not in ('closed', 'approved', 'cancelled')
  )::integer as open_task_count,
  (
    select count(*) from public.approvals a
    where a.approver_id = p.id and a.status = 'pending'
  )::integer as pending_approval_count
from public.profiles p
left join public.divisions div on div.id = p.division_id
left join public.departments dep on dep.id = p.department_id
left join public.units unit on unit.id = p.unit_id
left join public.user_roles ur on ur.user_id = p.id
group by p.id, div.name_en, dep.code, dep.name_en, dep.name_ar, unit.name_en;

create or replace view public.v_user_management_summary
with (security_invoker = true) as
select
  o.id as organization_id,
  count(p.id)::integer as total_users,
  count(p.id) filter (where coalesce(p.user_status, 'active') = 'active')::integer as active_users,
  count(p.id) filter (where coalesce(p.user_status, 'active') = 'inactive')::integer as inactive_users,
  count(p.id) filter (where coalesce(p.user_status, 'active') = 'archived')::integer as archived_users,
  count(p.id) filter (where coalesce(p.user_status, 'active') = 'invited')::integer as invited_users,
  count(p.id) filter (where coalesce(p.user_status, 'active') = 'locked')::integer as locked_users,
  count(p.id) filter (where p.department_id is null and coalesce(p.user_status, 'active') <> 'archived')::integer as missing_department_users,
  count(p.id) filter (
    where coalesce(p.user_status, 'active') <> 'archived'
      and not exists (
        select 1 from public.user_roles ur
        where ur.user_id = p.id and ur.is_active = true
      )
  )::integer as missing_role_users,
  count(p.id) filter (
    where coalesce(p.user_status, 'active') = 'invited'
      or p.department_id is null
      or not exists (
        select 1 from public.user_roles ur
        where ur.user_id = p.id and ur.is_active = true
      )
  )::integer as pending_setup_users
from public.organizations o
left join public.profiles p on p.organization_id = o.id
group by o.id;

create or replace view public.v_user_profile_completeness
with (security_invoker = true) as
select
  p.organization_id,
  p.id as user_id,
  p.email,
  p.full_name_en,
  p.full_name_ar,
  p.employee_no,
  p.job_title,
  p.department_id,
  coalesce(p.user_status, 'active') as user_status,
  (p.full_name_en is not null and trim(p.full_name_en) <> '') as has_english_name,
  (p.email is not null and trim(p.email) <> '') as has_email,
  (p.department_id is not null) as has_department,
  exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.is_active = true) as has_active_role,
  (
    (p.full_name_en is not null and trim(p.full_name_en) <> '')
    and (p.email is not null and trim(p.email) <> '')
    and p.department_id is not null
    and exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.is_active = true)
  ) as profile_complete
from public.profiles p;

create or replace function public.patch19_user_management_bridge(
  p_actor_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_org uuid;
  v_actor_is_super_admin boolean;
  v_actor_can_manage_users boolean;
  v_target_user uuid;
  v_target_org uuid;
  v_target_role public.app_role;
  v_result uuid;
  v_department_id uuid;
  v_old_profile jsonb;
  v_new_profile jsonb;
  v_linked_count integer := 0;
  v_batch_id uuid;
  v_rows jsonb;
  v_row jsonb;
  v_email text;
  v_status text;
  v_row_department_id uuid;
  v_row_role public.app_role;
  v_updated_count integer := 0;
  v_pending_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'PATCH19_SERVICE_ROLE_REQUIRED';
  end if;

  select organization_id into v_actor_org
  from public.profiles
  where id = p_actor_id
    and is_active = true
    and coalesce(user_status, 'active') = 'active';

  if v_actor_org is null then
    raise exception 'PATCH19_ACTIVE_ACTOR_REQUIRED';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = p_actor_id
      and is_active = true
      and role = 'super_admin'
  ) into v_actor_is_super_admin;

  select exists (
    select 1 from public.user_roles
    where user_id = p_actor_id
      and is_active = true
      and role in ('super_admin', 'governance_admin')
  ) into v_actor_can_manage_users;

  if not v_actor_can_manage_users then
    raise exception 'PATCH19_USER_ADMIN_REQUIRED';
  end if;

  if p_action not in (
    'patch19_update_user_profile',
    'patch19_update_user_department',
    'patch19_assign_user_role',
    'patch19_deactivate_user',
    'patch19_reactivate_user',
    'patch19_archive_user',
    'patch19_unarchive_user',
    'patch19_apply_import_batch'
  ) then
    raise exception 'PATCH19_ACTION_NOT_ALLOWED: %', p_action;
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if p_action = 'patch19_apply_import_batch' then
    v_rows := coalesce(p_payload->'rows', '[]'::jsonb);
    insert into public.user_management_import_batches (
      organization_id,
      file_name,
      row_count,
      valid_count,
      invalid_count,
      duplicate_email_count,
      unknown_department_count,
      unknown_role_count,
      status,
      validation_summary,
      created_by,
      applied_by,
      applied_at
    ) values (
      v_actor_org,
      nullif(p_payload->>'file_name', ''),
      jsonb_array_length(v_rows),
      coalesce((p_payload->>'valid_count')::integer, 0),
      coalesce((p_payload->>'invalid_count')::integer, 0),
      coalesce((p_payload->>'duplicate_email_count')::integer, 0),
      coalesce((p_payload->>'unknown_department_count')::integer, 0),
      coalesce((p_payload->>'unknown_role_count')::integer, 0),
      'applied',
      coalesce(p_payload->'validation_summary', '{}'::jsonb),
      p_actor_id,
      p_actor_id,
      now()
    )
    returning id into v_batch_id;

    for v_row in select value from jsonb_array_elements(v_rows)
    loop
      v_email := lower(trim(coalesce(v_row->>'email', '')));
      v_target_user := null;
      select id into v_target_user
      from public.profiles
      where organization_id = v_actor_org and lower(email) = v_email
      limit 1;

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
        v_row,
        nullif(v_email, ''),
        coalesce(nullif(v_row->>'validation_status', ''), 'error'),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'validation_errors', '[]'::jsonb))), array[]::text[]),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'validation_warnings', '[]'::jsonb))), array[]::text[]),
        case
          when coalesce(v_row->>'validation_status', 'error') <> 'valid' then 'skipped_invalid'
          when v_target_user is null then 'pending_account_creation'
          else 'updated_existing_user'
        end,
        v_target_user
      );

      if coalesce(v_row->>'validation_status', 'error') = 'valid' and v_target_user is not null then
        v_status := coalesce(nullif(v_row->>'status', ''), 'active');
        v_row_department_id := nullif(v_row->>'department_id', '')::uuid;
        select to_jsonb(p) into v_old_profile from public.profiles p where p.id = v_target_user;

        update public.profiles
        set
          full_name_en = coalesce(nullif(v_row->>'full_name_en', ''), full_name_en),
          full_name_ar = nullif(v_row->>'full_name_ar', ''),
          employee_no = nullif(v_row->>'employee_no', ''),
          job_title = nullif(v_row->>'job_title', ''),
          department_id = v_row_department_id,
          user_type = coalesce(nullif(v_row->>'user_type', ''), user_type),
          user_status = v_status,
          deactivated_by = case when v_status in ('inactive', 'archived', 'locked') then p_actor_id else deactivated_by end,
          deactivation_reason = case when v_status in ('inactive', 'archived', 'locked') then 'Patch 19 CSV import' else deactivation_reason end,
          last_reviewed_at = now()
        where id = v_target_user;

        if v_status in ('inactive', 'archived', 'locked') then
          update public.user_roles set is_active = false where user_id = v_target_user and is_active = true;
        end if;

        if nullif(v_row->>'role', '') is not null and v_status in ('active', 'invited') then
          v_row_role := (v_row->>'role')::public.app_role;
          if v_row_role in ('super_admin', 'executive', 'governance_admin') and not v_actor_is_super_admin then
            raise exception 'PATCH19_PRIVILEGED_ROLE_REQUIRES_SUPER_ADMIN';
          end if;
          perform public.assign_user_role(
            v_target_user,
            v_row_role,
            case when v_row_department_id is null then 'assigned_only'::public.access_scope else 'department'::public.access_scope end,
            v_actor_org,
            null,
            v_row_department_id,
            null,
            'Patch 19 CSV import'
          );
        end if;

        select to_jsonb(p) into v_new_profile from public.profiles p where p.id = v_target_user;
        insert into public.user_management_audit_history (
          organization_id, target_user_id, actor_id, action, reason, old_data, new_data
        ) values (
          v_actor_org, v_target_user, p_actor_id, 'import_applied', 'Patch 19 CSV import', v_old_profile, v_new_profile
        );
        v_updated_count := v_updated_count + 1;
      elsif coalesce(v_row->>'validation_status', 'error') = 'valid' and v_target_user is null then
        v_pending_count := v_pending_count + 1;
      end if;
    end loop;

    return jsonb_build_object('batch_id', v_batch_id, 'updated_count', v_updated_count, 'pending_account_creation_count', v_pending_count);
  end if;

  v_target_user := nullif(p_payload->>'user_id', '')::uuid;
  select p.organization_id, to_jsonb(p)
  into v_target_org, v_old_profile
  from public.profiles p
  where p.id = v_target_user;

  if v_target_user is null or v_target_org is null then
    raise exception 'PATCH19_TARGET_USER_NOT_FOUND';
  end if;

  if v_actor_org is distinct from v_target_org and not v_actor_is_super_admin then
    raise exception 'PATCH19_CROSS_ORG_DENIED';
  end if;

  select
    (
      (select count(*) from public.projects pr where pr.owner_id = v_target_user or pr.sponsor_id = v_target_user) +
      (select count(*) from public.tasks t where t.owner_id = v_target_user or t.assigned_to = v_target_user) +
      (select count(*) from public.approvals a where a.requested_by = v_target_user or a.approver_id = v_target_user) +
      (select count(*) from public.evidence_files e where e.uploaded_by = v_target_user or e.reviewed_by = v_target_user)
    )::integer
  into v_linked_count;

  if p_action in ('patch19_deactivate_user', 'patch19_archive_user') and v_target_user = p_actor_id then
    raise exception 'PATCH19_SELF_DEACTIVATION_DENIED';
  end if;

  if p_action in ('patch19_deactivate_user', 'patch19_archive_user') and exists (
    select 1 from public.user_roles
    where user_id = v_target_user and is_active = true and role = 'super_admin'
  ) and (
    select count(*)
    from public.user_roles
    where is_active = true and role = 'super_admin'
      and organization_id is not distinct from v_target_org
  ) <= 1 then
    raise exception 'PATCH19_LAST_SUPER_ADMIN_DEACTIVATION_DENIED';
  end if;

  if p_action = 'patch19_update_user_profile' then
    update public.profiles
    set
      full_name_en = coalesce(nullif(p_payload->>'full_name_en', ''), full_name_en),
      full_name_ar = nullif(p_payload->>'full_name_ar', ''),
      employee_no = nullif(p_payload->>'employee_no', ''),
      job_title = nullif(p_payload->>'job_title', ''),
      user_type = coalesce(nullif(p_payload->>'user_type', ''), user_type),
      last_reviewed_at = now()
    where id = v_target_user;
    select to_jsonb(p) into v_new_profile from public.profiles p where p.id = v_target_user;
    insert into public.user_management_audit_history (
      organization_id, target_user_id, actor_id, action, reason, old_data, new_data, linked_record_count
    ) values (
      v_target_org, v_target_user, p_actor_id, 'profile_updated', nullif(p_payload->>'reason', ''), v_old_profile, v_new_profile, v_linked_count
    );
    return jsonb_build_object('updated', true);
  end if;

  if p_action = 'patch19_update_user_department' then
    v_department_id := nullif(p_payload->>'department_id', '')::uuid;
    if v_department_id is not null and not exists (
      select 1 from public.departments
      where id = v_department_id and organization_id = v_target_org and is_active = true
    ) then
      raise exception 'PATCH19_DEPARTMENT_NOT_FOUND';
    end if;
    update public.profiles
    set department_id = v_department_id, last_reviewed_at = now()
    where id = v_target_user;
    select to_jsonb(p) into v_new_profile from public.profiles p where p.id = v_target_user;
    insert into public.user_management_audit_history (
      organization_id, target_user_id, actor_id, action, reason, old_data, new_data, linked_record_count
    ) values (
      v_target_org, v_target_user, p_actor_id, 'department_updated', nullif(p_payload->>'reason', ''), v_old_profile, v_new_profile, v_linked_count
    );
    return jsonb_build_object('updated', true);
  end if;

  if p_action = 'patch19_assign_user_role' then
    v_target_role := nullif(p_payload->>'role', '')::public.app_role;
    if v_target_role is null then
      raise exception 'PATCH19_ROLE_REQUIRED';
    end if;
    if v_target_role in ('super_admin', 'executive', 'governance_admin') and not v_actor_is_super_admin then
      raise exception 'PATCH19_PRIVILEGED_ROLE_REQUIRES_SUPER_ADMIN';
    end if;
    v_result := public.assign_user_role(
      v_target_user,
      v_target_role,
      coalesce(nullif(p_payload->>'scope', '')::public.access_scope, 'assigned_only'),
      v_target_org,
      nullif(p_payload->>'division_id', '')::uuid,
      nullif(p_payload->>'department_id', '')::uuid,
      nullif(p_payload->>'unit_id', '')::uuid,
      nullif(p_payload->>'reason', '')
    );
    insert into public.user_management_audit_history (
      organization_id, target_user_id, actor_id, action, reason, old_data, new_data, linked_record_count
    ) values (
      v_target_org,
      v_target_user,
      p_actor_id,
      'role_assigned',
      nullif(p_payload->>'reason', ''),
      v_old_profile,
      jsonb_build_object('role_id', v_result, 'role', v_target_role),
      v_linked_count
    );
    return jsonb_build_object('id', v_result);
  end if;

  if p_action = 'patch19_deactivate_user' then
    update public.profiles
    set user_status = 'inactive',
        deactivated_by = p_actor_id,
        deactivation_reason = coalesce(nullif(p_payload->>'reason', ''), 'App-level deactivation'),
        last_reviewed_at = now()
    where id = v_target_user;
    update public.user_roles set is_active = false where user_id = v_target_user and is_active = true;
    select to_jsonb(p) into v_new_profile from public.profiles p where p.id = v_target_user;
    insert into public.user_management_audit_history (
      organization_id, target_user_id, actor_id, action, reason, old_data, new_data, linked_record_count
    ) values (
      v_target_org, v_target_user, p_actor_id, 'deactivated', nullif(p_payload->>'reason', ''), v_old_profile, v_new_profile, v_linked_count
    );
    return jsonb_build_object('updated', true);
  end if;

  if p_action = 'patch19_reactivate_user' then
    update public.profiles
    set user_status = 'active',
        last_reviewed_at = now()
    where id = v_target_user;
    select to_jsonb(p) into v_new_profile from public.profiles p where p.id = v_target_user;
    insert into public.user_management_audit_history (
      organization_id, target_user_id, actor_id, action, reason, old_data, new_data, linked_record_count
    ) values (
      v_target_org, v_target_user, p_actor_id, 'reactivated', nullif(p_payload->>'reason', ''), v_old_profile, v_new_profile, v_linked_count
    );
    return jsonb_build_object('updated', true);
  end if;

  if p_action = 'patch19_archive_user' then
    update public.profiles
    set user_status = 'archived',
        deactivated_by = p_actor_id,
        deactivation_reason = coalesce(nullif(p_payload->>'reason', ''), 'App-level archive'),
        last_reviewed_at = now()
    where id = v_target_user;
    update public.user_roles set is_active = false where user_id = v_target_user and is_active = true;
    select to_jsonb(p) into v_new_profile from public.profiles p where p.id = v_target_user;
    insert into public.user_management_audit_history (
      organization_id, target_user_id, actor_id, action, reason, old_data, new_data, linked_record_count
    ) values (
      v_target_org, v_target_user, p_actor_id, 'archived', nullif(p_payload->>'reason', ''), v_old_profile, v_new_profile, v_linked_count
    );
    return jsonb_build_object('updated', true);
  end if;

  if p_action = 'patch19_unarchive_user' then
    update public.profiles
    set user_status = 'active',
        last_reviewed_at = now()
    where id = v_target_user;
    select to_jsonb(p) into v_new_profile from public.profiles p where p.id = v_target_user;
    insert into public.user_management_audit_history (
      organization_id, target_user_id, actor_id, action, reason, old_data, new_data, linked_record_count
    ) values (
      v_target_org, v_target_user, p_actor_id, 'unarchived', nullif(p_payload->>'reason', ''), v_old_profile, v_new_profile, v_linked_count
    );
    return jsonb_build_object('updated', true);
  end if;

  raise exception 'PATCH19_UNREACHABLE_ACTION';
end;
$$;

revoke all on function public.patch19_user_management_bridge(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.patch19_user_management_bridge(uuid, text, jsonb)
to service_role;

grant select on public.v_user_management_summary to authenticated;
grant select on public.v_user_management_roster to authenticated;
grant select on public.v_user_profile_completeness to authenticated;
grant select on public.user_management_audit_history to authenticated;
grant select on public.user_management_import_batches to authenticated;
grant select on public.user_management_import_rows to authenticated;

comment on table public.user_management_audit_history is 'Patch 19 user lifecycle audit history. Users are deactivated or archived at app level; no hard user deletion is performed.';
comment on table public.user_management_import_batches is 'Patch 19 preview-first CSV import batch register for user management.';
comment on table public.user_management_import_rows is 'Patch 19 CSV import row validation and application history.';
