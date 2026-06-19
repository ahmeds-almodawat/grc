-- =========================================================
-- GRC Control Center - Migration 009
-- Access Control & Role Governance
-- Adds role assignment audit, admin-safe RPC helpers, access views,
-- and warnings for risky role/scope combinations during 1K rollout.
-- =========================================================

-- Role governance audit trail
create table if not exists role_change_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  target_user_id uuid references profiles(id) on delete cascade,
  user_role_id uuid references user_roles(id) on delete set null,
  action text not null check (action in ('assigned', 'deactivated', 'reactivated', 'scope_changed')),
  old_data jsonb,
  new_data jsonb,
  reason text,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_role_change_audit_target on role_change_audit(target_user_id);
create index if not exists idx_role_change_audit_org on role_change_audit(organization_id);
create index if not exists idx_role_change_audit_changed_at on role_change_audit(changed_at);

-- Helper: active role check used by admin RPCs and RLS/debug views.
create or replace function has_active_role(p_role app_role)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = p_role
      and ur.is_active = true
  );
$$;

create or replace function can_manage_roles()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select has_active_role('super_admin'::app_role)
      or has_active_role('executive'::app_role)
      or has_active_role('governance_admin'::app_role);
$$;

-- Admin-safe role assignment. This avoids direct table manipulation from UI.
create or replace function assign_user_role(
  p_user_id uuid,
  p_role app_role,
  p_scope access_scope default 'assigned_only',
  p_organization_id uuid default null,
  p_division_id uuid default null,
  p_department_id uuid default null,
  p_unit_id uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_role_id uuid;
  v_org_id uuid;
begin
  if not can_manage_roles() then
    raise exception 'Not allowed to manage user roles';
  end if;

  select organization_id into v_org_id
  from profiles
  where id = p_user_id;

  v_org_id := coalesce(p_organization_id, v_org_id);

  if p_scope = 'global' and p_organization_id is null and v_org_id is null then
    raise exception 'Global role requires organization_id when user profile has no organization';
  end if;

  if p_scope = 'division' and p_division_id is null then
    raise exception 'Division scoped role requires division_id';
  end if;

  if p_scope = 'department' and p_department_id is null then
    raise exception 'Department scoped role requires department_id';
  end if;

  if p_scope = 'unit' and p_unit_id is null then
    raise exception 'Unit scoped role requires unit_id';
  end if;

  select id into v_existing_id
  from user_roles
  where user_id = p_user_id
    and role = p_role
    and scope = p_scope
    and coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_org_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(division_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_division_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_department_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;

  if v_existing_id is not null then
    update user_roles
    set is_active = true,
        assigned_by = auth.uid(),
        assigned_at = now()
    where id = v_existing_id
    returning id into v_role_id;

    insert into role_change_audit (organization_id, target_user_id, user_role_id, action, new_data, reason, changed_by)
    select v_org_id, p_user_id, v_role_id, 'reactivated', to_jsonb(ur), p_reason, auth.uid()
    from user_roles ur
    where ur.id = v_role_id;

    return v_role_id;
  end if;

  insert into user_roles (
    user_id,
    role,
    scope,
    organization_id,
    division_id,
    department_id,
    unit_id,
    is_active,
    assigned_by
  ) values (
    p_user_id,
    p_role,
    p_scope,
    v_org_id,
    p_division_id,
    p_department_id,
    p_unit_id,
    true,
    auth.uid()
  )
  returning id into v_role_id;

  insert into role_change_audit (organization_id, target_user_id, user_role_id, action, new_data, reason, changed_by)
  select v_org_id, p_user_id, v_role_id, 'assigned', to_jsonb(ur), p_reason, auth.uid()
  from user_roles ur
  where ur.id = v_role_id;

  return v_role_id;
end;
$$;

create or replace function deactivate_user_role(
  p_user_role_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_target_user_id uuid;
  v_org_id uuid;
begin
  if not can_manage_roles() then
    raise exception 'Not allowed to manage user roles';
  end if;

  select to_jsonb(ur), ur.user_id, ur.organization_id
  into v_old, v_target_user_id, v_org_id
  from user_roles ur
  where ur.id = p_user_role_id;

  if v_old is null then
    raise exception 'Role assignment not found';
  end if;

  update user_roles
  set is_active = false
  where id = p_user_role_id;

  insert into role_change_audit (organization_id, target_user_id, user_role_id, action, old_data, reason, changed_by)
  values (v_org_id, v_target_user_id, p_user_role_id, 'deactivated', v_old, p_reason, auth.uid());
end;
$$;

-- Access control matrix for admin review.
create or replace view v_access_control_matrix as
select
  p.organization_id,
  p.id as user_id,
  p.employee_no,
  p.full_name_en,
  p.full_name_ar,
  p.email,
  p.job_title,
  p.is_active as user_active,
  d.name_en as division_name,
  dep.name_en as department_name,
  u.name_en as unit_name,
  coalesce(count(ur.id) filter (where ur.is_active = true), 0) as active_role_count,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_role_id', ur.id,
        'role', ur.role,
        'scope', ur.scope,
        'organization_id', ur.organization_id,
        'division_id', ur.division_id,
        'department_id', ur.department_id,
        'unit_id', ur.unit_id,
        'is_active', ur.is_active,
        'assigned_at', ur.assigned_at
      ) order by ur.role::text
    ) filter (where ur.id is not null),
    '[]'::jsonb
  ) as roles,
  (
    select count(*)
    from projects pr
    where pr.owner_id = p.id
      and pr.status not in ('closed', 'cancelled')
  ) as owned_open_projects,
  (
    select count(*)
    from tasks t
    where (t.owner_id = p.id or t.assigned_to = p.id)
      and t.status not in ('closed', 'approved', 'cancelled')
  ) as open_tasks,
  (
    select count(*)
    from approvals a
    where a.approver_id = p.id
      and a.status = 'pending'
  ) as pending_approvals
from profiles p
left join divisions d on d.id = p.division_id
left join departments dep on dep.id = p.department_id
left join units u on u.id = p.unit_id
left join user_roles ur on ur.user_id = p.id
group by p.id, d.name_en, dep.name_en, u.name_en;

-- Warnings that help prevent dangerous access mistakes during rollout.
create or replace view v_access_control_warnings as
with active_roles as (
  select
    ur.*,
    p.full_name_en,
    p.email,
    p.employee_no,
    p.department_id as profile_department_id,
    p.unit_id as profile_unit_id
  from user_roles ur
  join profiles p on p.id = ur.user_id
  where ur.is_active = true
)
select
  gen_random_uuid() as id,
  organization_id,
  user_id,
  full_name_en,
  email,
  'global_sensitive_role' as warning_type,
  'Global role granted. Confirm this user really needs company-wide access.' as warning_message,
  'high'::risk_level as severity
from active_roles
where scope = 'global'
  and role in ('super_admin', 'executive', 'governance_admin', 'auditor')

union all

select
  gen_random_uuid() as id,
  organization_id,
  user_id,
  full_name_en,
  email,
  'role_scope_mismatch' as warning_type,
  'Department manager role should normally use department scope.' as warning_message,
  'medium'::risk_level as severity
from active_roles
where role = 'department_manager'
  and scope not in ('department', 'unit')

union all

select
  gen_random_uuid() as id,
  organization_id,
  user_id,
  full_name_en,
  email,
  'employee_with_broad_scope' as warning_type,
  'Employee/viewer role has broad scope. Use assigned_only unless intentionally expanded.' as warning_message,
  'medium'::risk_level as severity
from active_roles
where role in ('employee', 'viewer')
  and scope not in ('assigned_only', 'unit')

union all

select
  gen_random_uuid() as id,
  organization_id,
  user_id,
  full_name_en,
  email,
  'missing_scope_reference' as warning_type,
  'Scoped role is missing the required division/department/unit reference.' as warning_message,
  'high'::risk_level as severity
from active_roles
where (scope = 'division' and division_id is null)
   or (scope = 'department' and department_id is null)
   or (scope = 'unit' and unit_id is null);

-- Compact dashboard numbers for access-control admin page.
create or replace view v_access_control_summary as
select
  o.id as organization_id,
  count(distinct p.id) filter (where p.is_active = true) as active_users,
  count(distinct p.id) filter (where p.is_active = false) as inactive_users,
  count(ur.id) filter (where ur.is_active = true) as active_role_assignments,
  count(ur.id) filter (where ur.is_active = true and ur.scope = 'global') as global_role_assignments,
  (
    select count(*)
    from v_access_control_warnings w
    where w.organization_id = o.id
  ) as access_warnings,
  count(distinct p.id) filter (
    where p.is_active = true
      and not exists (
        select 1 from user_roles ur2
        where ur2.user_id = p.id
          and ur2.is_active = true
      )
  ) as active_users_without_roles
from organizations o
left join profiles p on p.organization_id = o.id
left join user_roles ur on ur.user_id = p.id
group by o.id;
