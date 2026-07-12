-- Patch 83R: controlled department lifecycle management.
-- Additive lifecycle metadata and fixed service-role bridge functions only.

alter table public.departments
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists successor_department_id uuid references public.departments(id) on delete set null;

create index if not exists idx_departments_org_lifecycle
  on public.departments (organization_id, is_active, archived_at);
create index if not exists idx_departments_active_name_en_norm
  on public.departments (
    organization_id,
    lower(regexp_replace(btrim(coalesce(name_en, '')), '\s+', ' ', 'g'))
  ) where is_active = true;
create index if not exists idx_departments_active_name_ar_norm
  on public.departments (
    organization_id,
    lower(regexp_replace(btrim(coalesce(name_ar, '')), '\s+', ' ', 'g'))
  ) where is_active = true and nullif(btrim(name_ar), '') is not null;

create or replace function public.patch83r_guard_department_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_lifecycle_action text := pg_catalog.current_setting('patch83r.lifecycle_action', true);
begin
  if tg_op = 'UPDATE' and new.code is distinct from old.code then
    raise exception 'PATCH83R_DEPARTMENT_CODE_IMMUTABLE';
  end if;

  if tg_op = 'UPDATE'
     and old.archived_at is not null
     and coalesce(v_lifecycle_action, '') not in ('rename', 'archive', 'restore') then
    raise exception 'PATCH83R_ARCHIVED_DEPARTMENT_MATCH';
  end if;

  if tg_op = 'INSERT' and exists (
    select 1
    from public.departments d
    where d.organization_id = new.organization_id
      and d.archived_at is not null
      and (
        (
          nullif(pg_catalog.btrim(new.code), '') is not null
          and pg_catalog.lower(pg_catalog.btrim(d.code)) = pg_catalog.lower(pg_catalog.btrim(new.code))
        )
        or (
          nullif(pg_catalog.btrim(new.name_en), '') is not null
          and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(d.name_en), '\s+', ' ', 'g'))
            = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(new.name_en), '\s+', ' ', 'g'))
        )
        or (
          nullif(pg_catalog.btrim(new.name_ar), '') is not null
          and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(d.name_ar), '\s+', ' ', 'g'))
            = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(new.name_ar), '\s+', ' ', 'g'))
        )
      )
  ) then
    raise exception 'PATCH83R_ARCHIVED_DEPARTMENT_MATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_patch83r_department_identity on public.departments;
create trigger trg_patch83r_department_identity
before insert or update on public.departments
for each row execute function public.patch83r_guard_department_identity();

create or replace function public.patch83r_guard_active_department_assignment()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.department_id is null then
    return new;
  end if;

  if tg_table_name = 'profiles' then
    if new.is_active = true
       and coalesce(new.user_status::text, 'active') in ('active', 'invited')
       and (tg_op = 'INSERT' or new.department_id is distinct from old.department_id
            or new.is_active is distinct from old.is_active
            or new.user_status is distinct from old.user_status)
       and not exists (
         select 1 from public.departments d
         where d.id = new.department_id
           and d.organization_id = new.organization_id
           and d.is_active = true
           and d.archived_at is null
       ) then
      raise exception 'PATCH83R_ARCHIVED_DEPARTMENT_ASSIGNMENT_DENIED';
    end if;
  elsif tg_table_name = 'user_roles' then
    if new.is_active = true
       and (tg_op = 'INSERT' or new.department_id is distinct from old.department_id
            or new.is_active is distinct from old.is_active)
       and not exists (
         select 1 from public.departments d
         where d.id = new.department_id
           and d.is_active = true
           and d.archived_at is null
           and (new.organization_id is null or d.organization_id = new.organization_id)
       ) then
      raise exception 'PATCH83R_ARCHIVED_DEPARTMENT_ASSIGNMENT_DENIED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_patch83r_profile_department_assignment on public.profiles;
create trigger trg_patch83r_profile_department_assignment
before insert or update of department_id, is_active, user_status on public.profiles
for each row execute function public.patch83r_guard_active_department_assignment();

drop trigger if exists trg_patch83r_role_department_assignment on public.user_roles;
create trigger trg_patch83r_role_department_assignment
before insert or update of department_id, is_active on public.user_roles
for each row execute function public.patch83r_guard_active_department_assignment();

create or replace function public.department_lifecycle_preview(
  p_actor_id uuid,
  p_department_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor_org uuid;
  v_department public.departments%rowtype;
  v_active_users integer := 0;
  v_open_work integer := 0;
  v_policies integer := 0;
  v_sops integer := 0;
  v_training integer := 0;
  v_evidence integer := 0;
  v_risks integer := 0;
  v_audits integer := 0;
  v_other integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'PATCH83R_SERVICE_ROLE_REQUIRED'; end if;

  select p.organization_id into v_actor_org
  from public.profiles p
  where p.id = p_actor_id and p.is_active = true and coalesce(p.user_status, 'active') = 'active';

  if v_actor_org is null or not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_actor_id and ur.is_active = true
      and ur.role in ('super_admin'::public.app_role, 'governance_admin'::public.app_role)
      and ur.scope = 'global'::public.access_scope
      and (ur.organization_id is null or ur.organization_id = v_actor_org)
  ) then raise exception 'PATCH83R_ADMIN_ROLE_REQUIRED'; end if;

  select * into v_department from public.departments d
  where d.id = p_department_id and d.organization_id = v_actor_org;
  if not found then raise exception 'PATCH83R_DEPARTMENT_NOT_FOUND'; end if;

  select count(*)::integer into v_active_users from public.profiles p
  where p.organization_id = v_actor_org and p.department_id = p_department_id
    and p.is_active = true and coalesce(p.user_status, 'active') = 'active';

  select (
    (select count(*) from public.projects p where p.department_id = p_department_id and p.status::text not in ('closed','cancelled'))
    + (select count(*) from public.tasks t join public.projects p on p.id = t.project_id
       where p.department_id = p_department_id and t.status::text not in ('closed','approved','cancelled'))
  )::integer into v_open_work;
  select count(*)::integer into v_policies from public.policies p
  where p.department_id = p_department_id and p.status::text not in ('archived','cancelled');
  select count(*)::integer into v_risks from public.risks r
  where r.department_id = p_department_id and r.status::text not in ('closed','cancelled');
  select count(*)::integer into v_audits from public.audit_findings a
  where (a.department_id = p_department_id or a.responsible_department_id = p_department_id)
    and a.status::text not in ('closed','cancelled');

  if pg_catalog.to_regclass('public.controlled_documents') is not null then
    execute 'select count(*)::integer from public.controlled_documents where department_id = $1 and document_type = ''sop'' and document_status not in (''retired'',''cancelled'')'
      into v_sops using p_department_id;
  end if;
  if pg_catalog.to_regclass('public.training_programs') is not null then
    execute 'select count(*)::integer from public.training_programs where department_id = $1 and coalesce(active, true) = true'
      into v_training using p_department_id;
  end if;
  if pg_catalog.to_regclass('public.evidence_bridge_links') is not null then
    execute 'select count(*)::integer from public.evidence_bridge_links where department_id = $1 and active = true'
      into v_evidence using p_department_id;
  end if;
  select (
    (select count(*) from public.units u where u.department_id = p_department_id and u.is_active = true)
    + (select count(*) from public.compliance_items c where c.department_id = p_department_id and c.status::text not in ('closed','cancelled'))
  )::integer into v_other;

  return pg_catalog.jsonb_build_object(
    'department_id', v_department.id,
    'organization_id', v_department.organization_id,
    'code', v_department.code,
    'name_en', v_department.name_en,
    'name_ar', v_department.name_ar,
    'is_active', v_department.is_active,
    'archived_at', v_department.archived_at,
    'archived_by', v_department.archived_by,
    'archive_reason', v_department.archive_reason,
    'successor_department_id', v_department.successor_department_id,
    'impact', pg_catalog.jsonb_build_object(
      'active_users', v_active_users,
      'open_assignments_work_items', v_open_work,
      'policies', v_policies,
      'sops', v_sops,
      'training_items', v_training,
      'evidence', v_evidence,
      'risks', v_risks,
      'audits', v_audits,
      'other_active_references', v_other
    )
  );
end;
$$;

create or replace function public.department_lifecycle_rename(
  p_actor_id uuid,
  p_department_id uuid,
  p_name_en text,
  p_name_ar text,
  p_request_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor_org uuid;
  v_department public.departments%rowtype;
  v_old jsonb;
  v_name_en text := pg_catalog.btrim(coalesce(p_name_en, ''));
  v_name_ar text := pg_catalog.btrim(coalesce(p_name_ar, ''));
begin
  if auth.role() <> 'service_role' then raise exception 'PATCH83R_SERVICE_ROLE_REQUIRED'; end if;
  select p.organization_id into v_actor_org from public.profiles p
  where p.id = p_actor_id and p.is_active = true and coalesce(p.user_status, 'active') = 'active';
  if v_actor_org is null or not exists (
    select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active = true
      and ur.role in ('super_admin'::public.app_role, 'governance_admin'::public.app_role)
      and ur.scope = 'global'::public.access_scope
      and (ur.organization_id is null or ur.organization_id = v_actor_org)
  ) then raise exception 'PATCH83R_ADMIN_ROLE_REQUIRED'; end if;
  if v_name_en = '' and v_name_ar = '' then raise exception 'PATCH83R_DEPARTMENT_NAME_REQUIRED'; end if;
  if pg_catalog.length(v_name_en) > 180 or pg_catalog.length(v_name_ar) > 180 then
    raise exception 'PATCH83R_DEPARTMENT_NAME_TOO_LONG';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_org::text, 83));
  select * into v_department from public.departments d
  where d.id = p_department_id and d.organization_id = v_actor_org for update;
  if not found then raise exception 'PATCH83R_DEPARTMENT_NOT_FOUND'; end if;
  if not v_department.is_active or v_department.archived_at is not null then
    raise exception 'PATCH83R_ARCHIVED_DEPARTMENT_RENAME_DENIED';
  end if;
  if exists (
    select 1 from public.departments d
    where d.organization_id = v_actor_org and d.id <> p_department_id and d.is_active = true
      and (
        (v_name_en <> '' and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(d.name_en), '\s+', ' ', 'g'))
          = pg_catalog.lower(pg_catalog.regexp_replace(v_name_en, '\s+', ' ', 'g')))
        or (v_name_ar <> '' and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(d.name_ar, '')), '\s+', ' ', 'g'))
          = pg_catalog.lower(pg_catalog.regexp_replace(v_name_ar, '\s+', ' ', 'g')))
      )
  ) then raise exception 'PATCH83R_ACTIVE_DEPARTMENT_NAME_CONFLICT'; end if;

  v_old := pg_catalog.jsonb_build_object('code', v_department.code, 'name_en', v_department.name_en, 'name_ar', v_department.name_ar);
  perform pg_catalog.set_config('patch83r.lifecycle_action', 'rename', true);
  update public.departments set name_en = v_name_en, name_ar = nullif(v_name_ar, '') where id = p_department_id;
  insert into public.audit_logs (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (v_actor_org, p_actor_id, 'DEPARTMENT_RENAMED', 'departments', p_department_id, v_old,
    pg_catalog.jsonb_build_object('code', v_department.code, 'name_en', v_name_en, 'name_ar', nullif(v_name_ar, ''), 'request_id', nullif(pg_catalog.btrim(p_request_id), '')));
  return pg_catalog.jsonb_build_object('department_id', p_department_id, 'code', v_department.code, 'name_en', v_name_en, 'name_ar', nullif(v_name_ar, ''));
end;
$$;

create or replace function public.department_lifecycle_archive(
  p_actor_id uuid,
  p_department_id uuid,
  p_archive_reason text,
  p_successor_department_id uuid default null,
  p_request_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor_org uuid;
  v_department public.departments%rowtype;
  v_successor public.departments%rowtype;
  v_reason text := pg_catalog.btrim(coalesce(p_archive_reason, ''));
  v_active_users integer;
  v_reassigned integer := 0;
  v_roles_deactivated integer := 0;
  v_impact jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'PATCH83R_SERVICE_ROLE_REQUIRED'; end if;
  if v_reason = '' then raise exception 'PATCH83R_ARCHIVE_REASON_REQUIRED'; end if;
  if pg_catalog.length(v_reason) > 1000 then raise exception 'PATCH83R_ARCHIVE_REASON_TOO_LONG'; end if;
  select p.organization_id into v_actor_org from public.profiles p
  where p.id = p_actor_id and p.is_active = true and coalesce(p.user_status, 'active') = 'active';
  if v_actor_org is null or not exists (
    select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active = true
      and ur.role in ('super_admin'::public.app_role, 'governance_admin'::public.app_role)
      and ur.scope = 'global'::public.access_scope
      and (ur.organization_id is null or ur.organization_id = v_actor_org)
  ) then raise exception 'PATCH83R_ADMIN_ROLE_REQUIRED'; end if;

  select * into v_department from public.departments d
  where d.id = p_department_id and d.organization_id = v_actor_org for update;
  if not found then raise exception 'PATCH83R_DEPARTMENT_NOT_FOUND'; end if;
  if not v_department.is_active or v_department.archived_at is not null then raise exception 'PATCH83R_DEPARTMENT_ALREADY_ARCHIVED'; end if;
  if p_successor_department_id = p_department_id then raise exception 'PATCH83R_SUCCESSOR_SELF_DENIED'; end if;

  select count(*)::integer into v_active_users from public.profiles p
  where p.organization_id = v_actor_org and p.department_id = p_department_id
    and p.is_active = true and coalesce(p.user_status, 'active') = 'active';
  if v_active_users > 0 and p_successor_department_id is null then raise exception 'PATCH83R_ACTIVE_USERS_REQUIRE_SUCCESSOR'; end if;
  if p_successor_department_id is not null then
    select * into v_successor from public.departments d
    where d.id = p_successor_department_id and d.organization_id = v_actor_org
      and d.is_active = true and d.archived_at is null for update;
    if not found then raise exception 'PATCH83R_ACTIVE_SUCCESSOR_REQUIRED'; end if;
  end if;

  v_impact := public.department_lifecycle_preview(p_actor_id, p_department_id)->'impact';
  if p_successor_department_id is not null then
    update public.profiles
    set department_id = p_successor_department_id, division_id = v_successor.division_id, unit_id = null, last_reviewed_at = pg_catalog.now()
    where organization_id = v_actor_org and department_id = p_department_id
      and is_active = true and coalesce(user_status, 'active') = 'active';
    get diagnostics v_reassigned = row_count;
    if v_reassigned <> v_active_users then raise exception 'PATCH83R_USER_REASSIGNMENT_INCOMPLETE'; end if;
  end if;

  update public.user_roles set is_active = false
  where department_id = p_department_id and is_active = true
    and (organization_id is null or organization_id = v_actor_org);
  get diagnostics v_roles_deactivated = row_count;

  perform pg_catalog.set_config('patch83r.lifecycle_action', 'archive', true);
  update public.departments
  set is_active = false, archived_at = pg_catalog.now(), archived_by = p_actor_id,
      archive_reason = v_reason, successor_department_id = p_successor_department_id
  where id = p_department_id;

  insert into public.audit_logs (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (v_actor_org, p_actor_id, 'DEPARTMENT_ARCHIVED', 'departments', p_department_id,
    pg_catalog.jsonb_build_object('is_active', true, 'name_en', v_department.name_en, 'name_ar', v_department.name_ar, 'code', v_department.code),
    pg_catalog.jsonb_build_object('is_active', false, 'archive_reason', v_reason,
      'successor_department_id', p_successor_department_id, 'reassigned_user_count', v_reassigned,
      'deactivated_role_count', v_roles_deactivated, 'impact', v_impact,
      'request_id', nullif(pg_catalog.btrim(p_request_id), '')));
  return pg_catalog.jsonb_build_object('department_id', p_department_id, 'archived', true,
    'successor_department_id', p_successor_department_id, 'reassigned_user_count', v_reassigned,
    'deactivated_role_count', v_roles_deactivated, 'impact', v_impact);
end;
$$;

create or replace function public.department_lifecycle_restore(
  p_actor_id uuid,
  p_department_id uuid,
  p_request_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor_org uuid;
  v_department public.departments%rowtype;
  v_old jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'PATCH83R_SERVICE_ROLE_REQUIRED'; end if;
  select p.organization_id into v_actor_org from public.profiles p
  where p.id = p_actor_id and p.is_active = true and coalesce(p.user_status, 'active') = 'active';
  if v_actor_org is null or not exists (
    select 1 from public.user_roles ur where ur.user_id = p_actor_id and ur.is_active = true
      and ur.role in ('super_admin'::public.app_role, 'governance_admin'::public.app_role)
      and ur.scope = 'global'::public.access_scope
      and (ur.organization_id is null or ur.organization_id = v_actor_org)
  ) then raise exception 'PATCH83R_ADMIN_ROLE_REQUIRED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_org::text, 83));
  select * into v_department from public.departments d
  where d.id = p_department_id and d.organization_id = v_actor_org for update;
  if not found then raise exception 'PATCH83R_DEPARTMENT_NOT_FOUND'; end if;
  if v_department.is_active or v_department.archived_at is null then raise exception 'PATCH83R_DEPARTMENT_NOT_ARCHIVED'; end if;
  if exists (
    select 1 from public.departments d
    where d.organization_id = v_actor_org and d.id <> p_department_id and d.is_active = true
      and (
        (nullif(pg_catalog.btrim(v_department.name_en), '') is not null
          and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(d.name_en), '\s+', ' ', 'g'))
            = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(v_department.name_en), '\s+', ' ', 'g')))
        or (nullif(pg_catalog.btrim(v_department.name_ar), '') is not null
          and pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(d.name_ar, '')), '\s+', ' ', 'g'))
            = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(v_department.name_ar), '\s+', ' ', 'g')))
        or (nullif(pg_catalog.btrim(v_department.code), '') is not null
          and pg_catalog.lower(pg_catalog.btrim(d.code)) = pg_catalog.lower(pg_catalog.btrim(v_department.code)))
      )
  ) then raise exception 'PATCH83R_ACTIVE_DEPARTMENT_NAME_CONFLICT'; end if;

  v_old := pg_catalog.jsonb_build_object('is_active', false, 'archived_at', v_department.archived_at,
    'archived_by', v_department.archived_by, 'archive_reason', v_department.archive_reason,
    'successor_department_id', v_department.successor_department_id, 'code', v_department.code,
    'name_en', v_department.name_en, 'name_ar', v_department.name_ar);
  perform pg_catalog.set_config('patch83r.lifecycle_action', 'restore', true);
  update public.departments set is_active = true, archived_at = null, archived_by = null,
    archive_reason = null, successor_department_id = null where id = p_department_id;
  insert into public.audit_logs (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (v_actor_org, p_actor_id, 'DEPARTMENT_RESTORED', 'departments', p_department_id, v_old,
    pg_catalog.jsonb_build_object('is_active', true, 'code', v_department.code,
      'name_en', v_department.name_en, 'name_ar', v_department.name_ar,
      'request_id', nullif(pg_catalog.btrim(p_request_id), '')));
  return pg_catalog.jsonb_build_object('department_id', p_department_id, 'restored', true,
    'code', v_department.code, 'name_en', v_department.name_en, 'name_ar', v_department.name_ar);
end;
$$;

revoke all on function public.patch83r_guard_department_identity() from public, anon, authenticated;
revoke all on function public.patch83r_guard_active_department_assignment() from public, anon, authenticated;
revoke all on function public.department_lifecycle_preview(uuid, uuid) from public, anon, authenticated;
revoke all on function public.department_lifecycle_rename(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.department_lifecycle_archive(uuid, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.department_lifecycle_restore(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.department_lifecycle_preview(uuid, uuid) to service_role;
grant execute on function public.department_lifecycle_rename(uuid, uuid, text, text, text) to service_role;
grant execute on function public.department_lifecycle_archive(uuid, uuid, text, uuid, text) to service_role;
grant execute on function public.department_lifecycle_restore(uuid, uuid, text) to service_role;

create or replace view public.v_department_execution_summary as
select
  d.organization_id,
  d.id as department_id,
  d.name_en as department_name,
  count(distinct p.id) filter (where p.status not in ('closed','cancelled')) as active_projects,
  count(distinct p.id) filter (where p.status not in ('closed','cancelled') and p.target_end_date < current_date) as overdue_projects,
  count(distinct m.id) filter (where m.status not in ('closed','approved','cancelled') and m.due_date < current_date) as overdue_milestones,
  count(distinct t.id) filter (where t.status not in ('closed','approved','cancelled') and t.due_date < current_date) as overdue_tasks,
  count(distinct r.id) filter (where r.status not in ('closed','cancelled') and r.risk_level = 'critical') as critical_risks,
  count(distinct af.id) filter (where af.status not in ('closed','cancelled') and af.due_date < current_date) as overdue_audit_findings,
  count(distinct c.id) filter (where c.status not in ('closed','cancelled') and c.expiry_date <= current_date + interval '30 days') as compliance_expiring_30_days,
  d.name_ar as department_name_ar,
  d.code as department_code,
  d.is_active,
  d.archived_at,
  d.archived_by,
  d.archive_reason,
  d.successor_department_id
from public.departments d
left join public.projects p on p.department_id = d.id
left join public.milestones m on m.project_id = p.id
left join public.tasks t on t.project_id = p.id
left join public.risks r on r.department_id = d.id
left join public.audit_findings af on af.department_id = d.id
left join public.compliance_items c on c.department_id = d.id
group by d.organization_id, d.id, d.name_en, d.name_ar, d.code, d.is_active,
  d.archived_at, d.archived_by, d.archive_reason, d.successor_department_id;

