-- =========================================================
-- v9.8 Admin Setup Actions
-- Secure server-bridge helpers for creating departments and
-- finalizing newly created Auth users with profiles and roles.
-- =========================================================

begin;

create or replace function public.v98_create_department(
  p_actor_id uuid,
  p_name_en text,
  p_name_ar text default null,
  p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_org uuid;
  v_department_id uuid;
  v_name_en text := nullif(trim(p_name_en), '');
  v_name_ar text := nullif(trim(p_name_ar), '');
  v_code text := upper(nullif(trim(p_code), ''));
begin
  if auth.role() <> 'service_role' then
    raise exception 'V98_DEPARTMENT_SERVICE_ROLE_REQUIRED';
  end if;

  select p.organization_id
    into v_actor_org
  from public.profiles p
  where p.id = p_actor_id
    and p.is_active = true;

  if v_actor_org is null then
    raise exception 'V98_ACTIVE_ACTOR_ORGANIZATION_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role in ('super_admin', 'governance_admin')
      and (
        ur.organization_id is null
        or ur.organization_id = v_actor_org
      )
  ) then
    raise exception 'V98_DEPARTMENT_ADMIN_NOT_AUTHORIZED';
  end if;

  if v_name_en is null or length(v_name_en) > 160 then
    raise exception 'V98_DEPARTMENT_NAME_INVALID';
  end if;

  if v_name_ar is not null and length(v_name_ar) > 160 then
    raise exception 'V98_DEPARTMENT_ARABIC_NAME_INVALID';
  end if;

  if v_code is null
     or length(v_code) < 2
     or length(v_code) > 24
     or v_code !~ '^[A-Z0-9_-]+$' then
    raise exception 'V98_DEPARTMENT_CODE_INVALID';
  end if;

  if exists (
    select 1
    from public.departments d
    where d.organization_id = v_actor_org
      and d.is_active = true
      and upper(trim(d.code)) = v_code
  ) then
    raise exception 'V98_DEPARTMENT_CODE_EXISTS: %', v_code;
  end if;

  if exists (
    select 1
    from public.departments d
    where d.organization_id = v_actor_org
      and d.is_active = true
      and lower(trim(d.name_en)) = lower(v_name_en)
  ) then
    raise exception 'V98_DEPARTMENT_NAME_EXISTS: %', v_name_en;
  end if;

  select d.id
    into v_department_id
  from public.departments d
  where d.organization_id = v_actor_org
    and d.is_active = false
    and (
      upper(trim(d.code)) = v_code
      or lower(trim(d.name_en)) = lower(v_name_en)
    )
  order by
    case when upper(trim(d.code)) = v_code then 0 else 1 end,
    d.created_at,
    d.id
  limit 1;

  if v_department_id is null then
    insert into public.departments (
      organization_id,
      name_en,
      name_ar,
      code,
      is_active
    )
    values (
      v_actor_org,
      v_name_en,
      v_name_ar,
      v_code,
      true
    )
    returning id into v_department_id;
  else
    update public.departments
    set name_en = v_name_en,
        name_ar = v_name_ar,
        code = v_code,
        is_active = true,
        updated_at = now()
    where id = v_department_id;
  end if;

  return jsonb_build_object(
    'id', v_department_id,
    'organization_id', v_actor_org,
    'name_en', v_name_en,
    'name_ar', v_name_ar,
    'code', v_code
  );
end;
$$;

revoke all on function public.v98_create_department(uuid, text, text, text)
from public, anon, authenticated;
grant execute on function public.v98_create_department(uuid, text, text, text)
to service_role;

create or replace function public.v98_finalize_created_user(
  p_actor_id uuid,
  p_user_id uuid,
  p_email text,
  p_full_name_en text,
  p_full_name_ar text default null,
  p_department_id uuid default null,
  p_role public.app_role default 'employee',
  p_scope public.access_scope default 'assigned_only'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_org uuid;
  v_role_id uuid;
  v_email text := lower(nullif(trim(p_email), ''));
  v_full_name_en text := nullif(trim(p_full_name_en), '');
  v_full_name_ar text := nullif(trim(p_full_name_ar), '');
begin
  if auth.role() <> 'service_role' then
    raise exception 'V98_USER_SERVICE_ROLE_REQUIRED';
  end if;

  select p.organization_id
    into v_actor_org
  from public.profiles p
  where p.id = p_actor_id
    and p.is_active = true;

  if v_actor_org is null then
    raise exception 'V98_ACTIVE_ACTOR_ORGANIZATION_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role = 'super_admin'
      and (
        ur.organization_id is null
        or ur.organization_id = v_actor_org
      )
  ) then
    raise exception 'V98_USER_CREATION_REQUIRES_SUPER_ADMIN';
  end if;

  if p_user_id is null or not exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and lower(u.email) = v_email
  ) then
    raise exception 'V98_AUTH_USER_MISSING_OR_EMAIL_MISMATCH';
  end if;

  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'V98_USER_EMAIL_INVALID';
  end if;

  if v_full_name_en is null or length(v_full_name_en) > 180 then
    raise exception 'V98_USER_NAME_INVALID';
  end if;

  if v_full_name_ar is not null and length(v_full_name_ar) > 180 then
    raise exception 'V98_USER_ARABIC_NAME_INVALID';
  end if;

  if p_department_id is not null and not exists (
    select 1
    from public.departments d
    where d.id = p_department_id
      and d.organization_id = v_actor_org
      and d.is_active = true
  ) then
    raise exception 'V98_USER_DEPARTMENT_INVALID';
  end if;

  if p_scope = 'department' and p_department_id is null then
    raise exception 'V98_DEPARTMENT_SCOPE_REQUIRES_DEPARTMENT';
  end if;

  if p_scope in ('division', 'unit') then
    raise exception 'V98_USER_SCOPE_REQUIRES_DEDICATED_STRUCTURE_SELECTION';
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(p.email) = v_email
      and p.id <> p_user_id
  ) then
    raise exception 'V98_PROFILE_EMAIL_ALREADY_IN_USE';
  end if;

  insert into public.profiles (
    id,
    organization_id,
    full_name_en,
    full_name_ar,
    email,
    department_id,
    is_active
  )
  values (
    p_user_id,
    v_actor_org,
    v_full_name_en,
    v_full_name_ar,
    v_email,
    p_department_id,
    true
  )
  on conflict (id) do update
  set organization_id = excluded.organization_id,
      full_name_en = excluded.full_name_en,
      full_name_ar = excluded.full_name_ar,
      email = excluded.email,
      department_id = excluded.department_id,
      is_active = true,
      updated_at = now();

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_role_id := public.assign_user_role(
    p_user_id,
    p_role,
    p_scope,
    v_actor_org,
    null,
    case when p_scope = 'department' then p_department_id else null end,
    null,
    'Created through v9.8 secure admin user setup'
  );

  return jsonb_build_object(
    'id', p_user_id,
    'profile_id', p_user_id,
    'role_id', v_role_id,
    'organization_id', v_actor_org,
    'department_id', p_department_id,
    'role', p_role,
    'scope', p_scope
  );
end;
$$;

revoke all on function public.v98_finalize_created_user(
  uuid, uuid, text, text, text, uuid, public.app_role, public.access_scope
)
from public, anon, authenticated;
grant execute on function public.v98_finalize_created_user(
  uuid, uuid, text, text, text, uuid, public.app_role, public.access_scope
)
to service_role;

commit;
