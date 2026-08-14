-- GRC v1.3 F1-R2 business-cycle remediation.
-- One governed assignment ledger, protected work mutations, canonical evidence
-- links, hierarchical progress, reliable closure facts, and corrective OVR close.

begin;

create table if not exists public.work_item_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_type text not null check (item_type in ('project','milestone','task')),
  item_id uuid not null,
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default statement_timestamp(),
  status text not null check (status in ('pending','accepted','declined','superseded','cancelled','legacy_unverified')),
  responded_by uuid references public.profiles(id) on delete restrict,
  responded_at timestamptz,
  decline_reason text,
  superseded_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint work_item_assignments_response_chk check (
    (status = 'accepted' and responded_by = assignee_id and responded_at is not null and decline_reason is null)
    or (status = 'declined' and responded_by = assignee_id and responded_at is not null and nullif(btrim(decline_reason),'') is not null)
    or (status in ('pending','legacy_unverified') and responded_by is null and responded_at is null and decline_reason is null)
    or (status in ('superseded','cancelled'))
  )
);

create unique index if not exists uq_work_item_assignments_current
  on public.work_item_assignments (organization_id,item_type,item_id)
  where status in ('pending','accepted','declined','legacy_unverified');
create index if not exists idx_work_item_assignments_assignee
  on public.work_item_assignments (organization_id,assignee_id,status,assigned_at desc);
create index if not exists idx_work_item_assignments_item
  on public.work_item_assignments (organization_id,item_type,item_id,assigned_at desc);

alter table public.work_item_assignments enable row level security;
drop policy if exists work_item_assignments_exact_read on public.work_item_assignments;
create policy work_item_assignments_exact_read on public.work_item_assignments
for select to authenticated
using (
  assignee_id = auth.uid()
  or assigned_by = auth.uid()
);

revoke insert, update, delete on public.work_item_assignments from public, anon, authenticated;
grant select on public.work_item_assignments to authenticated;

create or replace function public.f1r2_assert_service_role()
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'F1R2_SERVICE_ROLE_REQUIRED';
  end if;
end;
$$;

create or replace function public.f1r2_active_actor(p_actor_id uuid)
returns public.profiles
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_actor public.profiles%rowtype;
begin
  perform public.f1r2_assert_service_role();
  select * into v_actor from public.profiles
  where id = p_actor_id and is_active = true and user_status::text = 'active';
  if not found or v_actor.organization_id is null then
    raise exception 'F1R2_ACTIVE_ACTOR_REQUIRED';
  end if;
  if exists (
    select 1 from public.user_credential_states cs
    where cs.user_id = p_actor_id and cs.credential_state::text <> 'active'
  ) then
    raise exception 'F1R2_ACTIVE_CREDENTIAL_REQUIRED';
  end if;
  return v_actor;
end;
$$;

create or replace function public.f1r2_resolve_project(p_item_type text,p_item_id uuid)
returns public.projects
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_project public.projects%rowtype; v_type text := lower(btrim(coalesce(p_item_type,'')));
begin
  if v_type = 'project' then
    select * into v_project from public.projects where id = p_item_id;
  elsif v_type = 'milestone' then
    select p.* into v_project from public.milestones m join public.projects p on p.id=m.project_id where m.id=p_item_id;
  elsif v_type = 'task' then
    select p.* into v_project from public.tasks t join public.projects p on p.id=t.project_id where t.id=p_item_id;
  end if;
  return v_project;
end;
$$;

create or replace function public.f1r2_current_assignment(p_item_type text,p_item_id uuid)
returns public.work_item_assignments
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select a.* from public.work_item_assignments a
  where a.item_type=lower(btrim(p_item_type)) and a.item_id=p_item_id
    and a.status in ('pending','accepted','declined','legacy_unverified')
  order by a.assigned_at desc,a.id desc limit 1
$$;

create or replace function public.f1r2_actor_can_manage_item(p_actor_id uuid,p_item_type text,p_item_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_project public.projects%rowtype;
begin
  v_project := public.f1r2_resolve_project(p_item_type,p_item_id);
  if v_project.id is null then return false; end if;
  return public.acc_v13_actor_can_control_project(p_actor_id,v_project);
end;
$$;

drop policy if exists work_item_assignments_exact_read on public.work_item_assignments;
create policy work_item_assignments_exact_read on public.work_item_assignments
for select to authenticated
using (
  assignee_id=auth.uid()
  or assigned_by=auth.uid()
  or public.f1r2_actor_can_manage_item(auth.uid(),item_type,item_id)
);

-- Preserve historical ownership as explicitly unacknowledged; never fabricate acceptance.
insert into public.work_item_assignments(
  organization_id,item_type,item_id,assignee_id,assigned_by,assigned_at,status,created_at,updated_at
)
select p.organization_id,'project',p.id,p.owner_id,coalesce(p.created_by,p.owner_id),p.created_at,
       'legacy_unverified',p.created_at,p.updated_at
from public.projects p
where p.owner_id is not null
  and not exists (select 1 from public.work_item_assignments a where a.item_type='project' and a.item_id=p.id and a.status in ('pending','accepted','declined','legacy_unverified'))
on conflict do nothing;

insert into public.work_item_assignments(
  organization_id,item_type,item_id,assignee_id,assigned_by,assigned_at,status,created_at,updated_at
)
select m.organization_id,'milestone',m.id,m.owner_id,coalesce(m.created_by,m.owner_id),m.created_at,
       'legacy_unverified',m.created_at,m.updated_at
from public.milestones m
where m.owner_id is not null
  and not exists (select 1 from public.work_item_assignments a where a.item_type='milestone' and a.item_id=m.id and a.status in ('pending','accepted','declined','legacy_unverified'))
on conflict do nothing;

insert into public.work_item_assignments(
  organization_id,item_type,item_id,assignee_id,assigned_by,assigned_at,status,created_at,updated_at
)
select t.organization_id,'task',t.id,coalesce(t.assigned_to,t.owner_id),coalesce(t.created_by,t.owner_id,t.assigned_to),t.created_at,
       'legacy_unverified',t.created_at,t.updated_at
from public.tasks t
where coalesce(t.assigned_to,t.owner_id) is not null
  and not exists (select 1 from public.work_item_assignments a where a.item_type='task' and a.item_id=t.id and a.status in ('pending','accepted','declined','legacy_unverified'))
on conflict do nothing;

create or replace function public.f1r2_assign_work_item(
  p_actor_id uuid,p_item_type text,p_item_id uuid,p_assignee_id uuid,p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype; v_assignee public.profiles%rowtype;
  v_project public.projects%rowtype; v_prior public.work_item_assignments%rowtype;
  v_new public.work_item_assignments%rowtype; v_type text := lower(btrim(coalesce(p_item_type,'')));
begin
  v_actor := public.f1r2_active_actor(p_actor_id);
  if v_type not in ('project','milestone','task') then raise exception 'F1R2_ITEM_TYPE_INVALID'; end if;
  v_project := public.f1r2_resolve_project(v_type,p_item_id);
  if v_project.id is null or v_project.organization_id <> v_actor.organization_id then raise exception 'F1R2_ITEM_NOT_FOUND'; end if;
  if not public.f1r2_actor_can_manage_item(p_actor_id,v_type,p_item_id) then raise exception 'F1R2_ASSIGNMENT_NOT_AUTHORIZED'; end if;
  select * into v_assignee from public.profiles where id=p_assignee_id and organization_id=v_actor.organization_id and is_active=true and user_status::text='active';
  if not found then raise exception 'F1R2_ASSIGNEE_NOT_ELIGIBLE'; end if;

  perform pg_advisory_xact_lock(hashtextextended('f1r2-assignment:'||v_type||':'||p_item_id::text,0));
  select * into v_prior from public.work_item_assignments
  where item_type=v_type and item_id=p_item_id and status in ('pending','accepted','declined','legacy_unverified')
  order by assigned_at desc,id desc limit 1 for update;
  if v_prior.id is not null and v_prior.assignee_id=p_assignee_id and v_prior.status in ('pending','accepted','legacy_unverified') then
    return jsonb_build_object('id',v_prior.id,'status',v_prior.status,'item_type',v_type,'item_id',p_item_id,'replayed',true);
  end if;
  if v_prior.id is not null then
    update public.work_item_assignments set status='superseded',superseded_at=statement_timestamp(),updated_at=statement_timestamp() where id=v_prior.id;
  end if;

  insert into public.work_item_assignments(organization_id,item_type,item_id,assignee_id,assigned_by,status)
  values(v_actor.organization_id,v_type,p_item_id,p_assignee_id,p_actor_id,'pending') returning * into v_new;
  if v_type='project' then update public.projects set owner_id=p_assignee_id,updated_by=p_actor_id where id=p_item_id;
  elsif v_type='milestone' then update public.milestones set owner_id=p_assignee_id,updated_by=p_actor_id where id=p_item_id;
  else update public.tasks set assigned_to=p_assignee_id,updated_by=p_actor_id where id=p_item_id; end if;

  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
  values(v_actor.organization_id,p_actor_id,case when v_prior.id is null then 'f1r2_assignment_created' else 'f1r2_assignment_reassigned' end,
    'work_item_assignments',v_new.id,
    case when v_prior.id is null then null else jsonb_build_object('assignment_id',v_prior.id,'assignee_id',v_prior.assignee_id,'status',v_prior.status) end,
    jsonb_build_object('item_type',v_type,'item_id',p_item_id,'assignee_id',p_assignee_id,'status','pending','reason',nullif(btrim(coalesce(p_reason,'')),'')));
  return jsonb_build_object('id',v_new.id,'status',v_new.status,'item_type',v_type,'item_id',p_item_id,'assignee_id',p_assignee_id,'replayed',false);
end;
$$;

create or replace function public.f1r2_respond_work_item_assignment(
  p_actor_id uuid,p_assignment_id uuid,p_decision text,p_decline_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_actor public.profiles%rowtype; v_assignment public.work_item_assignments%rowtype; v_decision text:=lower(btrim(coalesce(p_decision,''))); v_reason text:=nullif(btrim(coalesce(p_decline_reason,'')),'');
begin
  v_actor := public.f1r2_active_actor(p_actor_id);
  select * into v_assignment from public.work_item_assignments where id=p_assignment_id for update;
  if not found or v_assignment.organization_id<>v_actor.organization_id then raise exception 'F1R2_ASSIGNMENT_NOT_FOUND'; end if;
  if v_assignment.assignee_id<>p_actor_id then raise exception 'F1R2_ONLY_ASSIGNEE_MAY_RESPOND'; end if;
  if v_decision not in ('accepted','declined') then raise exception 'F1R2_ASSIGNMENT_DECISION_INVALID'; end if;
  if v_decision='declined' and v_reason is null then raise exception 'F1R2_DECLINE_REASON_REQUIRED'; end if;
  if v_assignment.status=v_decision then
    return jsonb_build_object('id',v_assignment.id,'status',v_assignment.status,'replayed',true);
  end if;
  if v_assignment.status not in ('pending','legacy_unverified') then raise exception 'F1R2_ASSIGNMENT_NOT_RESPONDABLE'; end if;
  update public.work_item_assignments set status=v_decision,responded_by=p_actor_id,responded_at=statement_timestamp(),decline_reason=case when v_decision='declined' then v_reason end,updated_at=statement_timestamp() where id=v_assignment.id returning * into v_assignment;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
  values(v_actor.organization_id,p_actor_id,'f1r2_assignment_'||v_decision,'work_item_assignments',v_assignment.id,
    jsonb_build_object('status','pending'),jsonb_build_object('status',v_decision,'reason',v_reason));
  return jsonb_build_object('id',v_assignment.id,'status',v_assignment.status,'responded_at',v_assignment.responded_at,'replayed',false);
end;
$$;

create or replace function public.f1r2_cancel_work_item_assignment(
  p_actor_id uuid,p_assignment_id uuid,p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_actor public.profiles%rowtype; v_assignment public.work_item_assignments%rowtype; v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_reason is null then raise exception 'F1R2_ASSIGNMENT_CANCEL_REASON_REQUIRED'; end if;
  select * into v_assignment from public.work_item_assignments where id=p_assignment_id for update;
  if not found or v_assignment.organization_id<>v_actor.organization_id then raise exception 'F1R2_ASSIGNMENT_NOT_FOUND'; end if;
  if not public.f1r2_actor_can_manage_item(p_actor_id,v_assignment.item_type,v_assignment.item_id) then raise exception 'F1R2_ASSIGNMENT_CANCEL_DENIED'; end if;
  if v_assignment.status='cancelled' then return jsonb_build_object('id',v_assignment.id,'status','cancelled','replayed',true); end if;
  if v_assignment.status<>'pending' then raise exception 'F1R2_PENDING_ASSIGNMENT_REQUIRED'; end if;
  update public.work_item_assignments set status='cancelled',responded_by=p_actor_id,responded_at=statement_timestamp(),updated_at=statement_timestamp() where id=v_assignment.id returning * into v_assignment;
  if v_assignment.item_type='project' then update public.projects set owner_id=null,updated_by=p_actor_id where id=v_assignment.item_id and owner_id=v_assignment.assignee_id;
  elsif v_assignment.item_type='milestone' then update public.milestones set owner_id=null,updated_by=p_actor_id where id=v_assignment.item_id and owner_id=v_assignment.assignee_id;
  else update public.tasks set assigned_to=null,updated_by=p_actor_id where id=v_assignment.item_id and assigned_to=v_assignment.assignee_id; end if;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
  values(v_actor.organization_id,p_actor_id,'f1r2_assignment_cancelled','work_item_assignments',v_assignment.id,jsonb_build_object('status','pending'),jsonb_build_object('status','cancelled','reason',v_reason));
  return jsonb_build_object('id',v_assignment.id,'status','cancelled','replayed',false);
end;
$$;

create or replace function public.f1r2_list_my_work(p_actor_id uuid)
returns table(
  id uuid,organization_id uuid,item_type text,title text,due_date date,status text,progress_percent numeric,
  project_id uuid,milestone_id uuid,project_title text,department_name text,assignment_id uuid,
  assignment_status text,assigned_at timestamptz,responded_at timestamptz,decline_reason text,assigned_by_name text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_actor public.profiles%rowtype;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  return query
  select p.id,p.organization_id,'project',p.title,p.target_end_date,p.status::text,p.progress_percent,p.id,null::uuid,p.title,d.name_en,
    a.id,a.status,a.assigned_at,a.responded_at,a.decline_reason,ab.full_name_en
  from public.work_item_assignments a join public.projects p on a.item_type='project' and p.id=a.item_id
  left join public.departments d on d.id=p.department_id left join public.profiles ab on ab.id=a.assigned_by
  where a.assignee_id=p_actor_id and a.status in ('pending','accepted','declined','legacy_unverified') and p.status not in ('closed','cancelled')
  union all
  select m.id,m.organization_id,'milestone',m.title,m.due_date,m.status::text,m.progress_percent,m.project_id,null::uuid,p.title,d.name_en,
    a.id,a.status,a.assigned_at,a.responded_at,a.decline_reason,ab.full_name_en
  from public.work_item_assignments a join public.milestones m on a.item_type='milestone' and m.id=a.item_id join public.projects p on p.id=m.project_id
  left join public.departments d on d.id=p.department_id left join public.profiles ab on ab.id=a.assigned_by
  where a.assignee_id=p_actor_id and a.status in ('pending','accepted','declined','legacy_unverified') and m.status not in ('closed','cancelled','approved')
  union all
  select t.id,t.organization_id,'task',t.title,t.due_date,t.status::text,t.progress_percent,t.project_id,t.milestone_id,p.title,d.name_en,
    a.id,a.status,a.assigned_at,a.responded_at,a.decline_reason,ab.full_name_en
  from public.work_item_assignments a join public.tasks t on a.item_type='task' and t.id=a.item_id join public.projects p on p.id=t.project_id
  left join public.departments d on d.id=p.department_id left join public.profiles ab on ab.id=a.assigned_by
  where a.assignee_id=p_actor_id and a.status in ('pending','accepted','declined','legacy_unverified') and t.status not in ('closed','cancelled','approved')
  order by due_date nulls last,item_type,id;
end;
$$;

create or replace function public.f1r2_list_item_participants(p_actor_id uuid,p_item_type text,p_item_id uuid)
returns table(profile_id uuid,display_name text,relationship text,assignment_status text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_actor public.profiles%rowtype; v_project public.projects%rowtype; v_assignment public.work_item_assignments%rowtype;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id); v_project:=public.f1r2_resolve_project(p_item_type,p_item_id);
  if v_project.id is null or v_project.organization_id<>v_actor.organization_id then raise exception 'F1R2_ITEM_NOT_FOUND'; end if;
  v_assignment:=public.f1r2_current_assignment(p_item_type,p_item_id);
  if not (p_actor_id in (v_project.owner_id,v_project.sponsor_id,v_project.created_by) or p_actor_id=v_assignment.assignee_id or public.f1r2_actor_can_manage_item(p_actor_id,p_item_type,p_item_id)) then raise exception 'F1R2_PARTICIPANT_LOOKUP_DENIED'; end if;
  return query
  select p.id,coalesce(nullif(p.full_name_en,''),nullif(p.full_name_ar,''),'Assigned user'),x.relationship,x.assignment_status
  from (
    values(v_project.created_by,'creator'::text,null::text),(v_project.sponsor_id,'sponsor',null::text),(v_assignment.assignee_id,'assignee',v_assignment.status)
  ) x(profile_id,relationship,assignment_status)
  join public.profiles p on p.id=x.profile_id
  where x.profile_id is not null;
end;
$$;

create or replace function public.f1r2_list_project_assignments(p_actor_id uuid,p_project_id uuid)
returns table(item_type text,item_id uuid,assignment_id uuid,assignee_id uuid,assignee_name text,assignment_status text,assigned_at timestamptz,responded_at timestamptz,decline_reason text,assigned_by_name text)
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_actor public.profiles%rowtype; v_project public.projects%rowtype;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  select * into v_project from public.projects where id=p_project_id;
  if not found or v_project.organization_id<>v_actor.organization_id then raise exception 'F1R2_PROJECT_NOT_FOUND'; end if;
  if not (public.f1r2_actor_can_manage_item(p_actor_id,'project',p_project_id) or exists(
    select 1 from public.work_item_assignments a where a.assignee_id=p_actor_id and a.status in('pending','accepted','legacy_unverified') and
      ((a.item_type='project' and a.item_id=p_project_id)
       or (a.item_type='milestone' and exists(select 1 from public.milestones m where m.id=a.item_id and m.project_id=p_project_id))
       or (a.item_type='task' and exists(select 1 from public.tasks t where t.id=a.item_id and t.project_id=p_project_id)))
  )) then raise exception 'F1R2_PROJECT_ASSIGNMENTS_DENIED'; end if;
  return query
  select a.item_type,a.item_id,a.id,a.assignee_id,coalesce(nullif(p.full_name_en,''),nullif(p.full_name_ar,''),'Assigned user'),a.status,a.assigned_at,a.responded_at,a.decline_reason,coalesce(nullif(ab.full_name_en,''),nullif(ab.full_name_ar,''),'Assigning user')
  from public.work_item_assignments a join public.profiles p on p.id=a.assignee_id join public.profiles ab on ab.id=a.assigned_by
  where a.organization_id=v_actor.organization_id and a.status in('pending','accepted','declined','legacy_unverified') and
    ((a.item_type='project' and a.item_id=p_project_id)
     or (a.item_type='milestone' and exists(select 1 from public.milestones m where m.id=a.item_id and m.project_id=p_project_id))
     or (a.item_type='task' and exists(select 1 from public.tasks t where t.id=a.item_id and t.project_id=p_project_id)))
  order by a.item_type,a.item_id;
end $$;

create or replace function public.f1r2_search_eligible_participants(p_actor_id uuid,p_query text default null)
returns table(id uuid,full_name_en text,full_name_ar text,department_id uuid,role_scope_label text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_actor public.profiles%rowtype; v_query text:=lower(btrim(coalesce(p_query,'')));
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if not exists(select 1 from public.user_roles ur where ur.user_id=p_actor_id and ur.is_active=true and ur.role::text in('super_admin','executive','governance_admin','compliance_officer','division_head','department_manager','project_owner')) then raise exception 'F1R2_PARTICIPANT_SEARCH_DENIED'; end if;
  return query
  select p.id,p.full_name_en,p.full_name_ar,p.department_id,string_agg(distinct ur.role::text||' / '||ur.scope::text,', ' order by ur.role::text||' / '||ur.scope::text)
  from public.profiles p join public.user_roles ur on ur.user_id=p.id and ur.is_active=true
  where p.organization_id=v_actor.organization_id and p.is_active=true and p.user_status::text='active'
    and (v_query='' or lower(coalesce(p.full_name_en,'')||' '||coalesce(p.full_name_ar,'')||' '||coalesce(p.employee_no,'')) like '%'||v_query||'%')
  group by p.id,p.full_name_en,p.full_name_ar,p.department_id
  order by p.full_name_en,p.id limit 50;
end;
$$;

-- Exact assignment relationship grants only the item and necessary parent context.
drop policy if exists projects_f1r2_assignment_read on public.projects;
create policy projects_f1r2_assignment_read on public.projects for select to authenticated using (
  exists (select 1 from public.work_item_assignments a where a.organization_id=projects.organization_id and a.assignee_id=auth.uid() and a.status in ('pending','accepted','legacy_unverified') and (
    (a.item_type='project' and a.item_id=projects.id)
    or (a.item_type='milestone' and exists(select 1 from public.milestones m where m.id=a.item_id and m.project_id=projects.id))
    or (a.item_type='task' and exists(select 1 from public.tasks t where t.id=a.item_id and t.project_id=projects.id))
  ))
);
drop policy if exists milestones_f1r2_assignment_read on public.milestones;
create policy milestones_f1r2_assignment_read on public.milestones for select to authenticated using (
  exists (select 1 from public.work_item_assignments a where a.organization_id=milestones.organization_id and a.assignee_id=auth.uid() and a.status in ('pending','accepted','legacy_unverified') and (
    (a.item_type='milestone' and a.item_id=milestones.id)
    or (a.item_type='project' and a.item_id=milestones.project_id)
    or (a.item_type='task' and exists(select 1 from public.tasks t where t.id=a.item_id and t.milestone_id=milestones.id))
  ))
);
drop policy if exists tasks_f1r2_assignment_read on public.tasks;
create policy tasks_f1r2_assignment_read on public.tasks for select to authenticated using (
  exists (select 1 from public.work_item_assignments a where a.organization_id=tasks.organization_id and a.assignee_id=auth.uid() and a.status in ('pending','accepted','legacy_unverified') and (
    (a.item_type='task' and a.item_id=tasks.id)
    or (a.item_type='milestone' and a.item_id=tasks.milestone_id)
    or (a.item_type='project' and a.item_id=tasks.project_id)
  ))
);

-- All work-item writes now pass through the service-role Edge bridge.
drop policy if exists projects_write_managers on public.projects;
drop policy if exists projects_update_owner_or_manager on public.projects;
drop policy if exists projects_insert_ovr_reporters on public.projects;
drop policy if exists milestones_write_owner_or_manager on public.milestones;
drop policy if exists milestones_acc_v13_parent_project_insert on public.milestones;
drop policy if exists tasks_write_assigned_or_manager on public.tasks;
drop policy if exists tasks_acc_v13_parent_project_insert on public.tasks;

create or replace function public.f1r2_create_work_item(p_actor_id uuid,p_item_type text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype; v_project public.projects%rowtype; v_type text:=lower(btrim(coalesce(p_item_type,'')));
  v_id uuid; v_start date; v_due date; v_assignee uuid; v_title text:=nullif(btrim(p_payload->>'title'),''); v_result jsonb;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_title is null then raise exception 'F1R2_TITLE_REQUIRED'; end if;
  v_start:=nullif(p_payload->>'start_date','')::date;
  v_due:=nullif(coalesce(p_payload->>'target_end_date',p_payload->>'due_date'),'')::date;
  if v_start is not null and v_due is not null and v_due<v_start then raise exception 'F1R2_INVALID_DATE_ORDER'; end if;
  v_assignee:=nullif(coalesce(p_payload->>'assigned_to',p_payload->>'owner_id'),'')::uuid;
  if v_type='project' then
    if not exists(select 1 from public.user_roles ur where ur.user_id=p_actor_id and ur.is_active=true and ur.role::text in ('super_admin','executive','governance_admin','division_head','department_manager','project_owner')) then raise exception 'F1R2_PROJECT_CREATE_DENIED'; end if;
    insert into public.projects(organization_id,title,description,category,source_type,department_id,owner_id,sponsor_id,start_date,target_end_date,priority,risk_level,status,progress_percent,evidence_required,closure_approval_required,created_by,updated_by)
    values(v_actor.organization_id,v_title,nullif(btrim(p_payload->>'description'),''),coalesce(nullif(p_payload->>'category',''),'general'),coalesce(nullif(p_payload->>'source_type',''),'manual')::public.source_type,
      nullif(p_payload->>'department_id','')::uuid,null,nullif(p_payload->>'sponsor_id','')::uuid,v_start,v_due,coalesce(nullif(p_payload->>'priority',''),'medium')::public.priority_level,coalesce(nullif(p_payload->>'risk_level',''),'medium')::public.risk_level,
      'draft',0,coalesce((p_payload->>'evidence_required')::boolean,true),coalesce((p_payload->>'closure_approval_required')::boolean,true),p_actor_id,p_actor_id) returning id into v_id;
  elsif v_type in ('milestone','task') then
    v_project:=public.f1r2_resolve_project('project',nullif(p_payload->>'project_id','')::uuid);
    if v_project.id is null or v_project.organization_id<>v_actor.organization_id or not public.acc_v13_actor_can_control_project(p_actor_id,v_project) then raise exception 'F1R2_CHILD_CREATE_DENIED'; end if;
    if v_type='milestone' then
      insert into public.milestones(organization_id,project_id,title,description,owner_id,start_date,due_date,status,progress_percent,evidence_required,created_by,updated_by)
      values(v_actor.organization_id,v_project.id,v_title,nullif(btrim(p_payload->>'description'),''),null,v_start,v_due,'not_started',0,coalesce((p_payload->>'evidence_required')::boolean,true),p_actor_id,p_actor_id) returning id into v_id;
    else
      insert into public.tasks(organization_id,project_id,milestone_id,title,description,owner_id,assigned_to,start_date,due_date,status,progress_percent,evidence_required,created_by,updated_by)
      values(v_actor.organization_id,v_project.id,nullif(p_payload->>'milestone_id','')::uuid,v_title,nullif(btrim(p_payload->>'description'),''),p_actor_id,null,v_start,v_due,'not_started',0,coalesce((p_payload->>'evidence_required')::boolean,false),p_actor_id,p_actor_id) returning id into v_id;
    end if;
  else raise exception 'F1R2_ITEM_TYPE_INVALID'; end if;
  if v_assignee is not null then v_result:=public.f1r2_assign_work_item(p_actor_id,v_type,v_id,v_assignee,'initial assignment'); end if;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,new_data)
  values(v_actor.organization_id,p_actor_id,'f1r2_'||v_type||'_created',v_type||'s',v_id,jsonb_build_object('start_date',v_start,'due_date',v_due,'assignment',v_result));
  return jsonb_build_object('id',v_id,'title',v_title,'assignment',v_result);
end;
$$;

create or replace function public.f1r2_create_ovr_report(p_actor_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_actor public.profiles%rowtype; v_report public.ovr_reports%rowtype; v_notification timestamptz; v_status text:=coalesce(nullif(p_payload->>'status',''),'submitted');
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_status not in ('draft','submitted') then raise exception 'F1R2_OVR_STATUS_INVALID'; end if;
  if nullif(btrim(p_payload->>'brief_description'),'') is null then raise exception 'F1R2_OVR_DESCRIPTION_REQUIRED'; end if;
  if nullif(p_payload->>'notification_at','') is not null then
    if (p_payload->>'notification_at') ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then v_notification:=(p_payload->>'notification_at')::timestamptz;
    else v_notification:=(p_payload->>'notification_at')::timestamp at time zone 'Asia/Riyadh'; end if;
  end if;
  insert into public.ovr_reports(organization_id,logging_number,occurrence_date,occurrence_time,occurrence_location,notification_at,involved_person_type,person_involved_name,mrn_or_id_no,age,sex,department_id,physical_condition,mental_condition,pre_occurrence_condition_flags,brief_description,occurrence_category,severity_level,injury_type,occurrence_details,status,corrective_action_required,evidence_required,reported_by,owner_id,created_by,updated_by)
  values(v_actor.organization_id,nullif(p_payload->>'logging_number',''),nullif(p_payload->>'occurrence_date','')::date,nullif(p_payload->>'occurrence_time','')::time,nullif(p_payload->>'occurrence_location',''),v_notification,
    coalesce(nullif(p_payload->>'involved_person_type',''),'patient')::public.ovr_involved_person_type,nullif(p_payload->>'person_involved_name',''),nullif(p_payload->>'mrn_or_id_no',''),nullif(p_payload->>'age','')::integer,nullif(p_payload->>'sex',''),nullif(p_payload->>'department_id','')::uuid,
    nullif(p_payload->>'physical_condition',''),nullif(p_payload->>'mental_condition',''),coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'pre_occurrence_condition_flags','[]'::jsonb))),'{}'::text[]),
    btrim(p_payload->>'brief_description'),coalesce(nullif(p_payload->>'occurrence_category',''),'other'),nullif(p_payload->>'severity_level','')::public.ovr_severity_level,nullif(p_payload->>'injury_type',''),
    jsonb_build_object('linked_action_plan_requested',coalesce((p_payload->>'create_linked_action_plan')::boolean,false)),v_status::public.ovr_status,
    coalesce((p_payload->>'corrective_action_required')::boolean,(p_payload->>'create_linked_action_plan')::boolean,false),true,p_actor_id,p_actor_id,p_actor_id,p_actor_id)
  returning * into v_report;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,new_data)
  values(v_actor.organization_id,p_actor_id,'f1r2_ovr_submitted','ovr_reports',v_report.id,jsonb_build_object('status',v_report.status,'occurrence_date',v_report.occurrence_date,'occurrence_time',v_report.occurrence_time,'notification_at',v_report.notification_at,'corrective_action_required',v_report.corrective_action_required));
  return jsonb_build_object('id',v_report.id,'ovr_number',v_report.ovr_number,'logging_number',v_report.logging_number,'status',v_report.status,'occurrence_date',v_report.occurrence_date,'occurrence_time',v_report.occurrence_time,'notification_at',v_report.notification_at,'corrective_action_required',v_report.corrective_action_required);
end;
$$;

create or replace function public.f1r2_create_corrective_project(p_actor_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_actor public.profiles%rowtype; v_ovr public.ovr_reports%rowtype; v_owner public.profiles%rowtype; v_sponsor public.profiles%rowtype; v_project_id uuid; v_start date; v_due date; v_assignment jsonb;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  select * into v_ovr from public.ovr_reports where id=nullif(p_payload->>'ovr_report_id','')::uuid for update;
  if not found or v_ovr.organization_id<>v_actor.organization_id then raise exception 'F1R2_OVR_NOT_FOUND'; end if;
  if v_ovr.linked_project_id is not null then raise exception 'F1R2_CORRECTIVE_PROJECT_ALREADY_EXISTS'; end if;
  if not exists(select 1 from public.user_roles ur where ur.user_id=p_actor_id and ur.is_active=true and ur.role::text in ('super_admin','governance_admin','compliance_officer','department_manager') and (ur.organization_id is null or ur.organization_id=v_actor.organization_id)) then raise exception 'F1R2_QUALITY_AUTHORITY_REQUIRED'; end if;
  select * into v_owner from public.profiles where id=nullif(p_payload->>'owner_id','')::uuid and organization_id=v_actor.organization_id and is_active=true and user_status::text='active';
  if not found then raise exception 'F1R2_EXPLICIT_OWNER_REQUIRED'; end if;
  select * into v_sponsor from public.profiles where id=nullif(p_payload->>'sponsor_id','')::uuid and organization_id=v_actor.organization_id and is_active=true and user_status::text='active';
  if not found then raise exception 'F1R2_EXPLICIT_SPONSOR_REQUIRED'; end if;
  v_start:=nullif(p_payload->>'start_date','')::date; v_due:=nullif(p_payload->>'target_end_date','')::date;
  if v_start is null or v_due is null or v_due<v_start then raise exception 'F1R2_CORRECTIVE_DATES_INVALID'; end if;
  insert into public.projects(organization_id,title,description,category,source_type,source_reference_id,department_id,owner_id,sponsor_id,start_date,target_end_date,priority,risk_level,status,progress_percent,evidence_required,closure_approval_required,created_by,updated_by)
  values(v_actor.organization_id,coalesce(nullif(btrim(p_payload->>'title'),''),'Corrective action for '||coalesce(v_ovr.ovr_number,v_ovr.id::text)),nullif(btrim(p_payload->>'description'),''),'corrective_action','incident_ovr',v_ovr.id,v_ovr.department_id,null,v_sponsor.id,v_start,v_due,'high',case when v_ovr.severity_level::text in ('sentinel','level_4') then 'critical'::public.risk_level when v_ovr.severity_level::text='level_3' then 'high'::public.risk_level else 'medium'::public.risk_level end,'active',0,true,true,p_actor_id,p_actor_id)
  returning id into v_project_id;
  v_assignment:=public.f1r2_assign_work_item(p_actor_id,'project',v_project_id,v_owner.id,'OVR corrective project owner');
  update public.ovr_reports set linked_project_id=v_project_id,corrective_action_required=true,status='corrective_action_in_progress',updated_by=p_actor_id where id=v_ovr.id;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,new_data)
  values(v_actor.organization_id,p_actor_id,'f1r2_corrective_project_created','ovr_reports',v_ovr.id,jsonb_build_object('project_id',v_project_id,'owner_id',v_owner.id,'sponsor_id',v_sponsor.id,'start_date',v_start,'target_end_date',v_due));
  return jsonb_build_object('id',v_project_id,'assignment',v_assignment);
end;
$$;

-- Canonical hierarchical rollup: tasks -> milestones -> projects; no double counting.
create or replace function public.refresh_milestone_progress(target_milestone_id uuid)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_progress numeric; v_project_id uuid;
begin
  select avg(case when status='closed' then 100 else progress_percent end),max(project_id::text)::uuid into v_progress,v_project_id
  from public.tasks where milestone_id=target_milestone_id and status<>'cancelled';
  if v_progress is not null then update public.milestones set progress_percent=round(v_progress,2),updated_at=statement_timestamp() where id=target_milestone_id; end if;
  perform public.refresh_project_progress(v_project_id);
  return v_progress;
end;
$$;

create or replace function public.refresh_project_progress(target_project_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_progress numeric;
begin
  if target_project_id is null then return; end if;
  select avg(case when status='closed' then 100 else progress_percent end) into v_progress
  from public.milestones where project_id=target_project_id and status<>'cancelled';
  if v_progress is not null then update public.projects set progress_percent=round(v_progress,2),updated_at=statement_timestamp() where id=target_project_id; end if;
end;
$$;

create or replace function public.f1r2_rollup_task_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin perform public.refresh_milestone_progress(coalesce(new.milestone_id,old.milestone_id)); if coalesce(new.milestone_id,old.milestone_id) is null then perform public.refresh_project_progress(coalesce(new.project_id,old.project_id)); end if; return coalesce(new,old); end $$;
drop trigger if exists trg_refresh_project_progress_tasks on public.tasks;
drop trigger if exists trg_f1r2_rollup_task on public.tasks;
create trigger trg_f1r2_rollup_task after insert or update or delete on public.tasks for each row execute function public.f1r2_rollup_task_trigger();

create or replace function public.f1r2_rollup_milestone_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin perform public.refresh_project_progress(coalesce(new.project_id,old.project_id)); return coalesce(new,old); end $$;
drop trigger if exists trg_refresh_project_progress_milestones on public.milestones;
drop trigger if exists trg_f1r2_rollup_milestone on public.milestones;
create trigger trg_f1r2_rollup_milestone after insert or update or delete on public.milestones for each row execute function public.f1r2_rollup_milestone_trigger();

create or replace function public.f1r2_enforce_project_closure()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
begin
  if new.status='closed' and old.status<>'closed' then new.progress_percent:=100; new.closed_at:=statement_timestamp(); new.closed_by:=coalesce(new.updated_by,auth.uid());
  elsif new.status<>'closed' and old.status='closed' then new.closed_at:=null; new.closed_by:=null; end if;
  return new;
end $$;
drop trigger if exists trg_f1r2_project_closure on public.projects;
create trigger trg_f1r2_project_closure before update of status on public.projects for each row execute function public.f1r2_enforce_project_closure();

-- Require accepted (or compatibility legacy) assignment before assignee work mutation.
create or replace function public.acc_v13_update_work_item_status(p_actor_id uuid,p_item_type text,p_item_id uuid,p_status text,p_progress_percent numeric,p_delay_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare v_actor public.profiles%rowtype; v_project public.projects%rowtype; v_assignment public.work_item_assignments%rowtype; v_old jsonb; v_new jsonb; v_type text:=lower(btrim(coalesce(p_item_type,''))); v_child_count integer;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id); v_project:=public.f1r2_resolve_project(v_type,p_item_id); v_assignment:=public.f1r2_current_assignment(v_type,p_item_id);
  if v_project.id is null or v_project.organization_id<>v_actor.organization_id then raise exception 'F1R2_ITEM_NOT_FOUND'; end if;
  if p_progress_percent is null or p_progress_percent<0 or p_progress_percent>100 then raise exception 'F1R2_PROGRESS_OUT_OF_RANGE'; end if;
  if p_status='delayed' and nullif(btrim(coalesce(p_delay_reason,'')),'') is null then raise exception 'F1R2_DELAY_REASON_REQUIRED'; end if;
  if v_assignment.assignee_id=p_actor_id and v_assignment.status not in ('accepted','legacy_unverified') then raise exception 'F1R2_ASSIGNMENT_ACCEPTANCE_REQUIRED'; end if;
  if v_assignment.assignee_id is distinct from p_actor_id and not public.f1r2_actor_can_manage_item(p_actor_id,v_type,p_item_id) then raise exception 'F1R2_STATUS_UPDATE_DENIED'; end if;
  if v_type in ('milestone','task') and v_assignment.assignee_id is not null and v_assignment.assignee_id<>p_actor_id then raise exception 'F1R2_ASSIGNEE_IMPERSONATION_DENIED'; end if;
  if v_type='project' then
    if p_status not in ('draft','pending_approval','active','at_risk','delayed','completed_pending_evidence','completed_pending_approval','closed','cancelled') then raise exception 'F1R2_STATUS_INVALID'; end if;
    select count(*) into v_child_count from public.milestones where project_id=p_item_id and status<>'cancelled';
    select to_jsonb(p) into v_old from public.projects p where p.id=p_item_id for update;
    if v_old->>'status'=p_status and p_status='closed' then
      return jsonb_build_object('item_type',v_type,'item_id',p_item_id,'status',v_old->>'status','progress_percent',(v_old->>'progress_percent')::numeric,'record',v_old,'replayed',true);
    end if;
    update public.projects set status=p_status::public.project_status,progress_percent=case when v_child_count>0 then progress_percent when p_status='closed' then 100 else p_progress_percent end,delay_reason=case when p_status='delayed' then nullif(btrim(p_delay_reason),'') end,updated_by=p_actor_id where id=p_item_id returning to_jsonb(projects) into v_new;
  elsif v_type='milestone' then
    if p_status not in ('not_started','in_progress','at_risk','delayed','evidence_submitted','approved','rejected','closed','cancelled') then raise exception 'F1R2_STATUS_INVALID'; end if;
    select count(*) into v_child_count from public.tasks where milestone_id=p_item_id and status<>'cancelled';
    select to_jsonb(m) into v_old from public.milestones m where m.id=p_item_id for update;
    update public.milestones set status=p_status::public.work_status,progress_percent=case when v_child_count>0 then progress_percent when p_status='closed' then 100 else p_progress_percent end,delay_reason=case when p_status='delayed' then nullif(btrim(p_delay_reason),'') end,updated_by=p_actor_id where id=p_item_id returning to_jsonb(milestones) into v_new;
  elsif v_type='task' then
    if p_status not in ('not_started','in_progress','at_risk','delayed','evidence_submitted','approved','rejected','closed','cancelled') then raise exception 'F1R2_STATUS_INVALID'; end if;
    select to_jsonb(t) into v_old from public.tasks t where t.id=p_item_id for update;
    update public.tasks set status=p_status::public.work_status,progress_percent=case when p_status='closed' then 100 else p_progress_percent end,delay_reason=case when p_status='delayed' then nullif(btrim(p_delay_reason),'') end,updated_by=p_actor_id where id=p_item_id returning to_jsonb(tasks) into v_new;
  else raise exception 'F1R2_ITEM_TYPE_INVALID'; end if;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data) values(v_actor.organization_id,p_actor_id,'f1r2_status_progress_updated',v_type,p_item_id,v_old,v_new);
  if v_type='project' and v_old->>'status' is distinct from v_new->>'status' then
    if v_new->>'status'='closed' then
      insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data) values(v_actor.organization_id,p_actor_id,'f1r2_project_closed','projects',p_item_id,v_old,jsonb_build_object('status','closed','closed_at',v_new->>'closed_at','closed_by',v_new->>'closed_by'));
    elsif v_old->>'status'='closed' then
      insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data) values(v_actor.organization_id,p_actor_id,'f1r2_project_reopened','projects',p_item_id,v_old,jsonb_build_object('status',v_new->>'status','closed_at',null,'closed_by',null));
    end if;
  end if;
  return jsonb_build_object('item_type',v_type,'item_id',p_item_id,'status',v_new->>'status','progress_percent',(v_new->>'progress_percent')::numeric,'record',v_new,'replayed',false);
end $$;

-- Protected approval decisions; browser update policy is retired.
drop policy if exists approvals_write_related on public.approvals;
create or replace view public.v_pending_approvals_expanded
with (security_invoker = true)
as
select a.id,a.organization_id,
  case when a.project_id is not null then 'project' when a.milestone_id is not null then 'milestone' when a.task_id is not null then 'task' when a.evidence_id is not null then 'evidence' when a.risk_id is not null then 'risk' when a.compliance_item_id is not null then 'compliance' when a.audit_finding_id is not null then 'audit_finding' when a.policy_id is not null then 'policy' when a.committee_decision_id is not null then 'governance_decision' else 'unknown' end as item_type,
  coalesce(p.title,m.title,t.title,e.file_name,r.title,c.title,af.title,pol.title,cd.title,'Untitled item') as item_title,
  rb.full_name_en as requested_by_name,ap.full_name_en as approver_name,
  a.status,a.request_note,a.decision_note,a.requested_at,a.decided_at,
  coalesce(a.project_id,a.milestone_id,a.task_id,a.evidence_id,a.risk_id,a.compliance_item_id,a.audit_finding_id,a.policy_id,a.committee_decision_id) as item_id
from public.approvals a
left join public.projects p on p.id=a.project_id
left join public.milestones m on m.id=a.milestone_id
left join public.tasks t on t.id=a.task_id
left join public.evidence_files e on e.id=a.evidence_id
left join public.risks r on r.id=a.risk_id
left join public.compliance_items c on c.id=a.compliance_item_id
left join public.audit_findings af on af.id=a.audit_finding_id
left join public.policies pol on pol.id=a.policy_id
left join public.committee_decisions cd on cd.id=a.committee_decision_id
left join public.profiles rb on rb.id=a.requested_by
left join public.profiles ap on ap.id=a.approver_id
where a.approver_id=auth.uid() or a.requested_by=auth.uid() or public.can_manage_grc();

create or replace function public.f1r2_decide_approval(p_actor_id uuid,p_approval_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_actor public.profiles%rowtype; v_approval public.approvals%rowtype; v_decision text:=lower(btrim(coalesce(p_decision,'')));
begin
  v_actor:=public.f1r2_active_actor(p_actor_id); if v_decision not in ('approved','rejected') then raise exception 'F1R2_APPROVAL_DECISION_INVALID'; end if;
  select * into v_approval from public.approvals where id=p_approval_id for update;
  if not found or v_approval.organization_id<>v_actor.organization_id or v_approval.approver_id<>p_actor_id then raise exception 'F1R2_APPROVAL_DECISION_DENIED'; end if;
  if v_approval.requested_by=p_actor_id then raise exception 'F1R2_SELF_APPROVAL_DENIED'; end if;
  if v_approval.status::text=v_decision then return jsonb_build_object('id',v_approval.id,'status',v_approval.status,'replayed',true); end if;
  if v_approval.status::text<>'pending' then raise exception 'F1R2_APPROVAL_NOT_PENDING'; end if;
  update public.approvals set status=v_decision::public.approval_status,decision_note=nullif(btrim(coalesce(p_note,'')),''),decided_at=statement_timestamp() where id=p_approval_id returning * into v_approval;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,new_data) values(v_actor.organization_id,p_actor_id,'f1r2_approval_'||v_decision,'approvals',v_approval.id,jsonb_build_object('status',v_decision));
  return jsonb_build_object('id',v_approval.id,'status',v_approval.status,'decided_at',v_approval.decided_at,'replayed',false);
end $$;

-- Canonical evidence linkage is created in the same transaction as metadata insert.
create table if not exists public.f1r2_evidence_link_reconciliation (
  evidence_file_id uuid primary key references public.evidence_files(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null,
  detected_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz
);
alter table public.f1r2_evidence_link_reconciliation enable row level security;
alter table public.f1r2_evidence_link_reconciliation force row level security;
revoke all on public.f1r2_evidence_link_reconciliation from public,anon,authenticated,service_role;

create or replace function public.f1r2_sync_evidence_link()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_type text; v_id uuid; v_count integer;
begin
  v_count:=num_nonnulls(new.project_id,new.milestone_id,new.task_id,new.ovr_report_id,new.audit_finding_id,new.risk_id,new.compliance_item_id);
  if v_count<>1 then
    insert into public.f1r2_evidence_link_reconciliation(evidence_file_id,organization_id,reason) values(new.id,new.organization_id,'ambiguous_parent_count_'||v_count) on conflict(evidence_file_id) do update set reason=excluded.reason,detected_at=statement_timestamp();
    return new;
  end if;
  v_type:=case when new.project_id is not null then 'project' when new.milestone_id is not null then 'milestone' when new.task_id is not null then 'task' when new.ovr_report_id is not null then 'ovr' when new.audit_finding_id is not null then 'audit_finding' when new.risk_id is not null then 'risk' else 'compliance' end;
  v_id:=coalesce(new.project_id,new.milestone_id,new.task_id,new.ovr_report_id,new.audit_finding_id,new.risk_id,new.compliance_item_id);
  insert into public.evidence_links(organization_id,evidence_file_id,linked_item_type,linked_item_id,linked_item_title,link_reason,is_primary,required_for_closure,required_for_approval,linked_by)
  values(new.organization_id,new.id,v_type,v_id,coalesce(new.evidence_title,new.file_name),'canonical upload parent',true,true,v_type in ('project','milestone','task'),coalesce(new.created_by,new.uploaded_by))
  on conflict(organization_id,evidence_file_id,linked_item_type,linked_item_id) do update set is_active=true,linked_item_title=excluded.linked_item_title;
  delete from public.f1r2_evidence_link_reconciliation where evidence_file_id=new.id;
  return new;
end $$;
drop trigger if exists trg_f1r2_sync_evidence_link on public.evidence_files;
create trigger trg_f1r2_sync_evidence_link after insert or update of project_id,milestone_id,task_id,ovr_report_id,audit_finding_id,risk_id,compliance_item_id on public.evidence_files for each row execute function public.f1r2_sync_evidence_link();

insert into public.evidence_links(organization_id,evidence_file_id,linked_item_type,linked_item_id,linked_item_title,link_reason,is_primary,required_for_closure,required_for_approval,linked_by)
select e.organization_id,e.id,x.item_type,x.item_id,coalesce(e.evidence_title,e.file_name),'migration 196 canonical backfill',true,true,x.item_type in ('project','milestone','task'),coalesce(e.created_by,e.uploaded_by)
from public.evidence_files e
cross join lateral (values(
  case when e.project_id is not null then 'project' when e.milestone_id is not null then 'milestone' when e.task_id is not null then 'task' when e.ovr_report_id is not null then 'ovr' when e.audit_finding_id is not null then 'audit_finding' when e.risk_id is not null then 'risk' when e.compliance_item_id is not null then 'compliance' end,
  coalesce(e.project_id,e.milestone_id,e.task_id,e.ovr_report_id,e.audit_finding_id,e.risk_id,e.compliance_item_id)
)) x(item_type,item_id)
where num_nonnulls(e.project_id,e.milestone_id,e.task_id,e.ovr_report_id,e.audit_finding_id,e.risk_id,e.compliance_item_id)=1
on conflict(organization_id,evidence_file_id,linked_item_type,linked_item_id) do nothing;

insert into public.f1r2_evidence_link_reconciliation(evidence_file_id,organization_id,reason)
select e.id,e.organization_id,'ambiguous_parent_count_'||num_nonnulls(e.project_id,e.milestone_id,e.task_id,e.ovr_report_id,e.audit_finding_id,e.risk_id,e.compliance_item_id)
from public.evidence_files e
where num_nonnulls(e.project_id,e.milestone_id,e.task_id,e.ovr_report_id,e.audit_finding_id,e.risk_id,e.compliance_item_id)<>1
on conflict(evidence_file_id) do nothing;

create or replace function public.f1r2_get_evidence_pack(p_actor_id uuid,p_item_type text,p_item_id uuid)
returns table(evidence_file_id uuid,evidence_code text,evidence_title text,file_name text,status text,sensitivity_level text,reviewer_name text,reviewed_at timestamptz,linked_item_type text,linked_item_id uuid,required_for_closure boolean,required_for_approval boolean)
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_actor public.profiles%rowtype; v_project public.projects%rowtype; v_type text:=lower(btrim(coalesce(p_item_type,''))); v_ovr public.ovr_reports%rowtype;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_type='ovr' then
    select * into v_ovr from public.ovr_reports where id=p_item_id;
    if not found or v_ovr.organization_id<>v_actor.organization_id or not (p_actor_id in(v_ovr.reported_by,v_ovr.owner_id,v_ovr.supervisor_id,v_ovr.quality_reviewer_id) or exists(select 1 from public.user_roles ur where ur.user_id=p_actor_id and ur.is_active=true and ur.role::text in('super_admin','governance_admin','compliance_officer','auditor'))) then raise exception 'F1R2_EVIDENCE_PACK_DENIED'; end if;
  else
    v_project:=public.f1r2_resolve_project(v_type,p_item_id);
    if v_project.id is null or v_project.organization_id<>v_actor.organization_id or not (public.f1r2_actor_can_manage_item(p_actor_id,v_type,p_item_id) or exists(select 1 from public.work_item_assignments a where a.assignee_id=p_actor_id and a.status in('pending','accepted','legacy_unverified') and a.item_type=v_type and a.item_id=p_item_id) or exists(select 1 from public.approvals a where a.approver_id=p_actor_id and a.organization_id=v_actor.organization_id and (a.project_id=v_project.id or a.milestone_id=p_item_id or a.task_id=p_item_id))) then raise exception 'F1R2_EVIDENCE_PACK_DENIED'; end if;
  end if;
  return query
  select distinct e.id,e.evidence_code,e.evidence_title,e.file_name,coalesce(e.review_status,e.status::text),e.sensitivity_level,r.full_name_en,e.reviewed_at,l.linked_item_type,l.linked_item_id,l.required_for_closure,l.required_for_approval
  from public.evidence_links l join public.evidence_files e on e.id=l.evidence_file_id and e.is_current_version=true left join public.profiles r on r.id=coalesce(e.reviewer_id,e.reviewed_by)
  where l.is_active=true and l.organization_id=v_actor.organization_id and (
    (v_type='project' and (l.linked_item_type='project' and l.linked_item_id=p_item_id or l.linked_item_type='milestone' and exists(select 1 from public.milestones m where m.id=l.linked_item_id and m.project_id=p_item_id) or l.linked_item_type='task' and exists(select 1 from public.tasks t where t.id=l.linked_item_id and t.project_id=p_item_id)))
    or (v_type='milestone' and (l.linked_item_type='milestone' and l.linked_item_id=p_item_id or l.linked_item_type='task' and exists(select 1 from public.tasks t where t.id=l.linked_item_id and t.milestone_id=p_item_id)))
    or (v_type='task' and l.linked_item_type='task' and l.linked_item_id=p_item_id)
    or (v_type='ovr' and (l.linked_item_type='ovr' and l.linked_item_id=p_item_id or v_ovr.linked_project_id is not null and (l.linked_item_type='project' and l.linked_item_id=v_ovr.linked_project_id or l.linked_item_type='milestone' and exists(select 1 from public.milestones m where m.id=l.linked_item_id and m.project_id=v_ovr.linked_project_id) or l.linked_item_type='task' and exists(select 1 from public.tasks t where t.id=l.linked_item_id and t.project_id=v_ovr.linked_project_id))))
  );
end $$;

create or replace function public.can_close_ovr(p_ovr_report_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
  select exists(
    select 1 from public.ovr_reports o join public.projects p on p.id=o.linked_project_id and p.organization_id=o.organization_id
    where o.id=p_ovr_report_id and p.status='closed' and p.progress_percent=100
      and not exists(select 1 from public.milestones m where m.project_id=p.id and m.status not in('closed','cancelled'))
      and not exists(select 1 from public.tasks t where t.project_id=p.id and t.status not in('closed','cancelled'))
      and not exists(select 1 from public.evidence_requirements er where er.organization_id=o.organization_id and er.is_active=true and er.required_for_gate in('closure','approval') and er.linked_item_id in(o.id,p.id) and er.gate_status<>'satisfied')
      and not exists(
        select 1 from public.approvals a
        where a.organization_id=o.organization_id
          and (a.project_id=p.id or a.milestone_id in(select m.id from public.milestones m where m.project_id=p.id) or a.task_id in(select t.id from public.tasks t where t.project_id=p.id))
          and not exists(
            select 1 from public.approvals newer
            where newer.organization_id=a.organization_id
              and newer.project_id is not distinct from a.project_id
              and newer.milestone_id is not distinct from a.milestone_id
              and newer.task_id is not distinct from a.task_id
              and (newer.requested_at,newer.id)>(a.requested_at,a.id)
          )
          and a.status<>'approved'
      )
      and exists(select 1 from public.evidence_links l join public.evidence_files e on e.id=l.evidence_file_id where l.organization_id=o.organization_id and l.is_active=true and coalesce(e.review_status,e.status::text)='accepted' and (l.linked_item_id=o.id or l.linked_item_id=p.id or l.linked_item_id in(select m.id from public.milestones m where m.project_id=p.id) or l.linked_item_id in(select t.id from public.tasks t where t.project_id=p.id)))
      and o.status='corrective_action_in_progress'
      and coalesce(o.dispute_reason,'')=''
      and o.escalated_at is null
  )
$$;

create or replace function public.f1r2_finalize_corrective_ovr(p_actor_id uuid,p_ovr_report_id uuid,p_final_verdict text,p_final_severity public.ovr_severity_level,p_closure_comment text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_actor public.profiles%rowtype; v_ovr public.ovr_reports%rowtype; v_now timestamptz:=statement_timestamp(); v_key text:=nullif(btrim(p_idempotency_key),'');
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_key is null or length(v_key)>200 then raise exception 'F1R2_IDEMPOTENCY_KEY_REQUIRED'; end if;
  if nullif(btrim(p_final_verdict),'') is null or nullif(btrim(p_closure_comment),'') is null or p_final_severity is null then raise exception 'F1R2_FINAL_VERDICT_FIELDS_REQUIRED'; end if;
  select * into v_ovr from public.ovr_reports where id=p_ovr_report_id for update;
  if not found or v_ovr.organization_id<>v_actor.organization_id then raise exception 'F1R2_OVR_NOT_FOUND'; end if;
  if v_ovr.status='closed' and v_ovr.final_verdict=p_final_verdict then return jsonb_build_object('id',v_ovr.id,'status','closed','closed_at',v_ovr.closed_at,'replayed',true); end if;
  if v_ovr.status<>'corrective_action_in_progress' then raise exception 'F1R2_CORRECTIVE_CLOSURE_STATE_REQUIRED'; end if;
  if not exists(select 1 from public.user_roles ur where ur.user_id=p_actor_id and ur.is_active=true and ur.role::text in('super_admin','governance_admin','compliance_officer') and (ur.organization_id is null or ur.organization_id=v_actor.organization_id)) then raise exception 'F1R2_QUALITY_CLOSURE_AUTHORITY_REQUIRED'; end if;
  if not public.can_close_ovr(p_ovr_report_id) then raise exception 'F1R2_OVR_CLOSURE_PREREQUISITES_NOT_MET'; end if;
  if exists(select 1 from public.audit_logs a where a.organization_id=v_actor.organization_id and a.action='f1r2_ovr_closed' and a.record_id=p_ovr_report_id and a.new_data->>'idempotency_key'=v_key) then raise exception 'F1R2_IDEMPOTENCY_CONFLICT'; end if;
  update public.ovr_reports set status='closed',final_verdict=btrim(p_final_verdict),final_verdict_at=v_now,final_severity_level=p_final_severity,quality_manager_comments=btrim(p_closure_comment),quality_closed_by=p_actor_id,quality_closed_at=v_now,closed_by=p_actor_id,closed_at=v_now,updated_by=p_actor_id where id=p_ovr_report_id returning * into v_ovr;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data) values(v_actor.organization_id,p_actor_id,'f1r2_ovr_final_verdict','ovr_reports',p_ovr_report_id,jsonb_build_object('status','corrective_action_in_progress'),jsonb_build_object('status','closed','idempotency_key',v_key,'final_severity',p_final_severity,'verdict_recorded',true));
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,new_data) values(v_actor.organization_id,p_actor_id,'f1r2_ovr_closed','ovr_reports',p_ovr_report_id,jsonb_build_object('status','closed','closed_at',v_now,'idempotency_key',v_key));
  return jsonb_build_object('id',v_ovr.id,'status',v_ovr.status,'final_verdict',v_ovr.final_verdict,'final_verdict_at',v_ovr.final_verdict_at,'closed_at',v_ovr.closed_at,'closed_by',v_ovr.closed_by,'replayed',false);
end $$;

-- Correct the non-OVR evidence access boolean and include exact assignment/approval relationships.
create or replace function public.acc_v13_authorize_evidence_access(p_actor_id uuid,p_evidence_file_id uuid,p_intent text default 'view')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_actor public.profiles%rowtype; v_evidence public.evidence_files%rowtype; v_allowed boolean:=false; v_intent text:=lower(btrim(coalesce(p_intent,'view')));
begin
  v_actor:=public.f1r2_active_actor(p_actor_id); if v_intent not in('view','download') then raise exception 'F1R2_EVIDENCE_INTENT_INVALID'; end if;
  select * into v_evidence from public.evidence_files where id=p_evidence_file_id;
  if not found or v_evidence.organization_id<>v_actor.organization_id then raise exception 'F1R2_EVIDENCE_NOT_FOUND'; end if;
  select exists(
    select 1 from public.evidence_links l where l.evidence_file_id=v_evidence.id and l.organization_id=v_actor.organization_id and l.is_active=true and (
      p_actor_id in(v_evidence.uploaded_by,v_evidence.reviewed_by,v_evidence.evidence_owner_id,v_evidence.reviewer_id)
      or exists(select 1 from public.user_roles ur where ur.user_id=p_actor_id and ur.is_active=true and ur.role::text in('super_admin','governance_admin','executive','auditor','compliance_officer') and (ur.organization_id is null or ur.organization_id=v_actor.organization_id))
      or exists(select 1 from public.work_item_assignments a where a.assignee_id=p_actor_id and a.status in('pending','accepted','legacy_unverified') and ((l.linked_item_type=a.item_type and l.linked_item_id=a.item_id) or (l.linked_item_type='project' and a.item_type in('milestone','task') and (public.f1r2_resolve_project(a.item_type,a.item_id)).id=l.linked_item_id)))
      or exists(select 1 from public.approvals ap where ap.approver_id=p_actor_id and ap.organization_id=v_actor.organization_id and (ap.project_id=l.linked_item_id or ap.milestone_id=l.linked_item_id or ap.task_id=l.linked_item_id))
      or (l.linked_item_type='ovr' and exists(select 1 from public.ovr_reports o where o.id=l.linked_item_id and p_actor_id in(o.reported_by,o.owner_id,o.supervisor_id,o.quality_reviewer_id)))
    )
  ) into v_allowed;
  if not v_allowed then raise exception 'F1R2_EVIDENCE_ACCESS_DENIED'; end if;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,new_data) values(v_actor.organization_id,p_actor_id,'f1r2_evidence_'||v_intent,'evidence_files',v_evidence.id,jsonb_build_object('intent',v_intent));
  return jsonb_build_object('evidence_file_id',v_evidence.id,'file_name',v_evidence.file_name,'file_path',v_evidence.file_path,'file_type',v_evidence.file_type,'intent',v_intent);
end $$;

-- Protected functions are reachable only from the verified-JWT service bridge.
revoke all on function public.f1r2_assert_service_role() from public,anon,authenticated;
revoke all on function public.f1r2_active_actor(uuid) from public,anon,authenticated;
revoke all on function public.f1r2_resolve_project(text,uuid) from public,anon,authenticated;
revoke all on function public.f1r2_current_assignment(text,uuid) from public,anon,authenticated;
revoke all on function public.f1r2_actor_can_manage_item(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.f1r2_assign_work_item(uuid,text,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.f1r2_respond_work_item_assignment(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.f1r2_cancel_work_item_assignment(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.f1r2_list_my_work(uuid) from public,anon,authenticated;
revoke all on function public.f1r2_list_item_participants(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.f1r2_list_project_assignments(uuid,uuid) from public,anon,authenticated;
revoke all on function public.f1r2_search_eligible_participants(uuid,text) from public,anon,authenticated;
revoke all on function public.f1r2_create_work_item(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.f1r2_create_ovr_report(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.f1r2_create_corrective_project(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.f1r2_decide_approval(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.f1r2_get_evidence_pack(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.f1r2_finalize_corrective_ovr(uuid,uuid,text,public.ovr_severity_level,text,text) from public,anon,authenticated;
revoke all on function public.acc_v13_update_work_item_status(uuid,text,uuid,text,numeric,text) from public,anon,authenticated;
revoke all on function public.acc_v13_authorize_evidence_access(uuid,uuid,text) from public,anon,authenticated;

grant execute on function public.f1r2_assert_service_role() to service_role;
grant execute on function public.f1r2_active_actor(uuid) to service_role;
grant execute on function public.f1r2_resolve_project(text,uuid) to service_role;
grant execute on function public.f1r2_current_assignment(text,uuid) to service_role;
grant execute on function public.f1r2_actor_can_manage_item(uuid,text,uuid) to service_role;
grant execute on function public.f1r2_assign_work_item(uuid,text,uuid,uuid,text) to service_role;
grant execute on function public.f1r2_respond_work_item_assignment(uuid,uuid,text,text) to service_role;
grant execute on function public.f1r2_cancel_work_item_assignment(uuid,uuid,text) to service_role;
grant execute on function public.f1r2_list_my_work(uuid) to service_role;
grant execute on function public.f1r2_list_item_participants(uuid,text,uuid) to service_role;
grant execute on function public.f1r2_list_project_assignments(uuid,uuid) to service_role;
grant execute on function public.f1r2_search_eligible_participants(uuid,text) to service_role;
grant execute on function public.f1r2_create_work_item(uuid,text,jsonb) to service_role;
grant execute on function public.f1r2_create_ovr_report(uuid,jsonb) to service_role;
grant execute on function public.f1r2_create_corrective_project(uuid,jsonb) to service_role;
grant execute on function public.f1r2_decide_approval(uuid,uuid,text,text) to service_role;
grant execute on function public.f1r2_get_evidence_pack(uuid,text,uuid) to service_role;
grant execute on function public.f1r2_finalize_corrective_ovr(uuid,uuid,text,public.ovr_severity_level,text,text) to service_role;
grant execute on function public.acc_v13_update_work_item_status(uuid,text,uuid,text,numeric,text) to service_role;
grant execute on function public.acc_v13_authorize_evidence_access(uuid,uuid,text) to service_role;

-- Trigger and internal roll-up helpers are owner-only. They are reached only
-- from table triggers or the service-role finalizers above and must never be
-- callable through PostgREST, including by service_role.
revoke execute on function public.refresh_milestone_progress(uuid) from public,anon,authenticated,service_role;
revoke execute on function public.refresh_project_progress(uuid) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_rollup_task_trigger() from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_rollup_milestone_trigger() from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_enforce_project_closure() from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_sync_evidence_link() from public,anon,authenticated,service_role;
revoke execute on function public.can_close_ovr(uuid) from public,anon,authenticated,service_role;

comment on table public.work_item_assignments is 'F1-R2 canonical immutable assignment history for projects, milestones, and tasks.';
comment on function public.f1r2_finalize_corrective_ovr(uuid,uuid,text,public.ovr_severity_level,text,text) is 'F1-R2 Quality closure path from corrective_action_in_progress with exact work/evidence/approval prerequisites.';

commit;
