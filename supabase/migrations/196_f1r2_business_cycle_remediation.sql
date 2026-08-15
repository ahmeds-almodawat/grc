-- GRC v1.3 F1-R2 business-cycle remediation.
-- One governed assignment ledger, protected work mutations, canonical evidence
-- links, hierarchical progress, reliable closure facts, and corrective OVR close.

begin;

-- F2-R1 keeps every privileged mutation behind the verified service-role Edge
-- bridge.  RLS policies below deliberately use only row-local predicates and
-- never depend on these protected RPCs.

create table if not exists public.work_item_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_type text not null check (item_type in ('project','milestone','task')),
  item_id uuid not null,
  project_id uuid not null,
  milestone_id uuid,
  task_id uuid,
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
  ),
  constraint work_item_assignments_context_chk check (
    (item_type='project' and project_id=item_id and milestone_id is null and task_id is null)
    or (item_type='milestone' and milestone_id=item_id and task_id is null)
    or (item_type='task' and task_id=item_id)
  )
);

create unique index if not exists uq_work_item_assignments_current
  on public.work_item_assignments (organization_id,item_type,item_id)
  where status in ('pending','accepted','declined','legacy_unverified');
create index if not exists idx_work_item_assignments_assignee
  on public.work_item_assignments (organization_id,assignee_id,status,assigned_at desc);
create index if not exists idx_work_item_assignments_item
  on public.work_item_assignments (organization_id,item_type,item_id,assigned_at desc);
create index if not exists idx_work_item_assignments_context
  on public.work_item_assignments (organization_id,assignee_id,project_id,milestone_id,task_id,status);

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
declare
  v_project public.projects%rowtype;
  v_project_assignment public.work_item_assignments%rowtype;
begin
  v_project := public.f1r2_resolve_project(p_item_type,p_item_id);
  if v_project.id is null then return false; end if;
  v_project_assignment := public.f1r2_current_assignment('project',v_project.id);
  if p_actor_id in (v_project.sponsor_id,v_project.created_by) then return true; end if;
  if p_actor_id=v_project.owner_id and (
    v_project_assignment.id is null
    or (v_project_assignment.assignee_id=p_actor_id and v_project_assignment.status in ('accepted','legacy_unverified'))
  ) then return true; end if;
  return public.f1r2_actor_scope_allows_context(
    p_actor_id,v_project.organization_id,v_project.division_id,v_project.department_id,v_project.unit_id,
    array['super_admin','executive','governance_admin','division_head','department_manager']
  );
end;
$$;

create or replace function public.f1r2_lock_work_item(p_item_type text,p_item_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_type text:=lower(btrim(coalesce(p_item_type,'')));
  v_project_id uuid; v_milestone_id uuid;
begin
  if v_type not in ('project','milestone','task') or p_item_id is null then
    raise exception 'F1R2_ITEM_TYPE_INVALID';
  end if;
  if v_type='project' then
    v_project_id:=p_item_id;
  elsif v_type='milestone' then
    select m.project_id into v_project_id from public.milestones m where m.id=p_item_id;
    v_milestone_id:=p_item_id;
  else
    select t.project_id,t.milestone_id into v_project_id,v_milestone_id from public.tasks t where t.id=p_item_id;
  end if;
  if v_project_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('f1r2-work-item:project:'||v_project_id::text,0));
  end if;
  if v_milestone_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('f1r2-work-item:milestone:'||v_milestone_id::text,0));
  end if;
  if v_type='task' then
    perform pg_advisory_xact_lock(hashtextextended('f1r2-work-item:task:'||p_item_id::text,0));
  end if;
end;
$$;

drop policy if exists work_item_assignments_exact_read on public.work_item_assignments;
create policy work_item_assignments_exact_read on public.work_item_assignments
for select to authenticated
using (
  assignee_id=(select auth.uid())
  or assigned_by=(select auth.uid())
);

create or replace function public.f1r2_actor_scope_allows_context(
  p_actor_id uuid,
  p_organization_id uuid,
  p_division_id uuid,
  p_department_id uuid,
  p_unit_id uuid,
  p_allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.is_active = true
      and ur.role::text = any(p_allowed_roles)
      and (ur.organization_id is null or ur.organization_id = p_organization_id)
      and (
        ur.scope::text = 'global'
        or (ur.scope::text = 'division' and ur.division_id is not null and ur.division_id = p_division_id)
        or (ur.scope::text = 'department' and ur.department_id is not null and ur.department_id = p_department_id)
        or (ur.scope::text = 'unit' and ur.unit_id is not null and ur.unit_id = p_unit_id)
      )
  )
$$;

create or replace function public.f1r2_assignment_candidate_is_eligible(
  p_candidate_id uuid,
  p_organization_id uuid,
  p_division_id uuid,
  p_department_id uuid,
  p_unit_id uuid,
  p_assignment_purpose text
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
    join public.user_roles ur on ur.user_id = p.id and ur.is_active = true
    where p.id = p_candidate_id
      and p.organization_id = p_organization_id
      and p.is_active = true
      and p.user_status::text = 'active'
      and (ur.organization_id is null or ur.organization_id = p_organization_id)
      and (
        ur.scope::text = 'global'
        or ur.scope::text = 'assigned_only'
        or (ur.scope::text = 'division' and ur.division_id = p_division_id)
        or (ur.scope::text = 'department' and ur.department_id = p_department_id)
        or (ur.scope::text = 'unit' and ur.unit_id = p_unit_id)
      )
      and case lower(btrim(coalesce(p_assignment_purpose,'')))
        when 'project_owner' then ur.role::text in ('project_owner','department_manager','division_head','governance_admin','super_admin')
        when 'milestone_owner' then ur.role::text in ('milestone_owner','project_owner','department_manager','division_head','governance_admin','super_admin')
        when 'task_owner' then ur.role::text in ('task_owner','milestone_owner','project_owner','employee','department_manager','division_head','governance_admin','super_admin')
        when 'sponsor' then ur.role::text in ('executive','governance_admin','division_head','department_manager','super_admin')
        else false
      end
  )
$$;

-- Preserve historical ownership as explicitly unacknowledged; never fabricate acceptance.
insert into public.work_item_assignments(
  organization_id,item_type,item_id,project_id,milestone_id,task_id,assignee_id,assigned_by,assigned_at,status,created_at,updated_at
)
select p.organization_id,'project',p.id,p.id,null::uuid,null::uuid,p.owner_id,coalesce(p.created_by,p.owner_id),p.created_at,
       'legacy_unverified',p.created_at,p.updated_at
from public.projects p
where p.owner_id is not null
  and not exists (select 1 from public.work_item_assignments a where a.item_type='project' and a.item_id=p.id and a.status in ('pending','accepted','declined','legacy_unverified'))
on conflict do nothing;

insert into public.work_item_assignments(
  organization_id,item_type,item_id,project_id,milestone_id,task_id,assignee_id,assigned_by,assigned_at,status,created_at,updated_at
)
select m.organization_id,'milestone',m.id,m.project_id,m.id,null::uuid,m.owner_id,coalesce(m.created_by,m.owner_id),m.created_at,
       'legacy_unverified',m.created_at,m.updated_at
from public.milestones m
where m.owner_id is not null
  and not exists (select 1 from public.work_item_assignments a where a.item_type='milestone' and a.item_id=m.id and a.status in ('pending','accepted','declined','legacy_unverified'))
on conflict do nothing;

insert into public.work_item_assignments(
  organization_id,item_type,item_id,project_id,milestone_id,task_id,assignee_id,assigned_by,assigned_at,status,created_at,updated_at
)
select t.organization_id,'task',t.id,t.project_id,t.milestone_id,t.id,coalesce(t.assigned_to,t.owner_id),coalesce(t.created_by,t.owner_id,t.assigned_to),t.created_at,
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
  v_milestone_id uuid; v_item_status text;
begin
  v_actor := public.f1r2_active_actor(p_actor_id);
  if v_type not in ('project','milestone','task') then raise exception 'F1R2_ITEM_TYPE_INVALID'; end if;
  perform public.f1r2_lock_work_item(v_type,p_item_id);
  if v_type='project' then
    select p.status::text into v_item_status from public.projects p where p.id=p_item_id for update;
  elsif v_type='milestone' then
    select m.status::text into v_item_status from public.milestones m where m.id=p_item_id for update;
  else
    select t.status::text into v_item_status from public.tasks t where t.id=p_item_id for update;
  end if;
  if not found then raise exception 'F1R2_ITEM_NOT_FOUND'; end if;
  if v_item_status in ('closed','cancelled') then raise exception 'F1R2_TERMINAL_WORK_ITEM_ASSIGNMENT_DENIED'; end if;
  v_project := public.f1r2_resolve_project(v_type,p_item_id);
  if v_project.id is null or v_project.organization_id <> v_actor.organization_id then raise exception 'F1R2_ITEM_NOT_FOUND'; end if;
  if not public.f1r2_actor_can_manage_item(p_actor_id,v_type,p_item_id) then raise exception 'F1R2_ASSIGNMENT_NOT_AUTHORIZED'; end if;
  select * into v_assignee from public.profiles where id=p_assignee_id and organization_id=v_actor.organization_id and is_active=true and user_status::text='active';
  if not found then raise exception 'F1R2_ASSIGNEE_NOT_ELIGIBLE'; end if;
  if not public.f1r2_assignment_candidate_is_eligible(
    p_assignee_id,v_project.organization_id,v_project.division_id,v_project.department_id,v_project.unit_id,
    case v_type when 'project' then 'project_owner' when 'milestone' then 'milestone_owner' else 'task_owner' end
  ) then raise exception 'F1R2_ASSIGNEE_NOT_ELIGIBLE'; end if;

  select * into v_prior from public.work_item_assignments
  where item_type=v_type and item_id=p_item_id and status in ('pending','accepted','declined','legacy_unverified')
  order by assigned_at desc,id desc limit 1 for update;
  if v_prior.id is not null and v_prior.assignee_id=p_assignee_id and v_prior.status in ('pending','accepted','legacy_unverified') then
    return jsonb_build_object('id',v_prior.id,'status',v_prior.status,'item_type',v_type,'item_id',p_item_id,'replayed',true);
  end if;
  if v_prior.id is not null then
    update public.work_item_assignments set status='superseded',superseded_at=statement_timestamp(),updated_at=statement_timestamp() where id=v_prior.id;
  end if;

  if v_type='milestone' then
    v_milestone_id:=p_item_id;
  elsif v_type='task' then
    select t.milestone_id into v_milestone_id from public.tasks t where t.id=p_item_id;
  end if;
  insert into public.work_item_assignments(
    organization_id,item_type,item_id,project_id,milestone_id,task_id,assignee_id,assigned_by,status
  ) values(
    v_actor.organization_id,v_type,p_item_id,v_project.id,v_milestone_id,
    case when v_type='task' then p_item_id end,p_assignee_id,p_actor_id,'pending'
  ) returning * into v_new;
  -- Pending is a proposal, never live execution authority.  A handoff revokes
  -- the prior execution owner and acceptance installs the new one.
  if v_type='project' then update public.projects set owner_id=null,updated_by=p_actor_id where id=p_item_id;
  elsif v_type='milestone' then update public.milestones set owner_id=null,updated_by=p_actor_id where id=p_item_id;
  else update public.tasks set assigned_to=null,updated_by=p_actor_id where id=p_item_id; end if;

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
declare
  v_actor public.profiles%rowtype; v_assignment public.work_item_assignments%rowtype;
  v_decision text:=lower(btrim(coalesce(p_decision,''))); v_reason text:=nullif(btrim(coalesce(p_decline_reason,'')),'');
  v_old_status text; v_item_type text; v_item_id uuid; v_item_status text;
begin
  v_actor := public.f1r2_active_actor(p_actor_id);
  select item_type,item_id into v_item_type,v_item_id from public.work_item_assignments where id=p_assignment_id;
  if not found then raise exception 'F1R2_ASSIGNMENT_NOT_FOUND'; end if;
  perform public.f1r2_lock_work_item(v_item_type,v_item_id);
  if v_item_type='project' then
    select p.status::text into v_item_status from public.projects p where p.id=v_item_id for update;
  elsif v_item_type='milestone' then
    select m.status::text into v_item_status from public.milestones m where m.id=v_item_id for update;
  elsif v_item_type='task' then
    select t.status::text into v_item_status from public.tasks t where t.id=v_item_id for update;
  else
    raise exception 'F1R2_ITEM_TYPE_INVALID';
  end if;
  if not found then raise exception 'F1R2_ITEM_NOT_FOUND'; end if;
  select * into v_assignment from public.work_item_assignments where id=p_assignment_id for update;
  if not found or v_assignment.organization_id<>v_actor.organization_id then raise exception 'F1R2_ASSIGNMENT_NOT_FOUND'; end if;
  if v_assignment.assignee_id<>p_actor_id then raise exception 'F1R2_ONLY_ASSIGNEE_MAY_RESPOND'; end if;
  if v_decision not in ('accepted','declined') then raise exception 'F1R2_ASSIGNMENT_DECISION_INVALID'; end if;
  if v_decision='declined' and v_reason is null then raise exception 'F1R2_DECLINE_REASON_REQUIRED'; end if;
  if v_item_status in ('closed','cancelled') then raise exception 'F1R2_TERMINAL_WORK_ITEM_RESPONSE_DENIED'; end if;
  if v_assignment.status=v_decision then
    return jsonb_build_object('id',v_assignment.id,'status',v_assignment.status,'replayed',true);
  end if;
  if v_assignment.status not in ('pending','legacy_unverified') then raise exception 'F1R2_ASSIGNMENT_NOT_RESPONDABLE'; end if;
  v_old_status:=v_assignment.status;
  update public.work_item_assignments set status=v_decision,responded_by=p_actor_id,responded_at=statement_timestamp(),decline_reason=case when v_decision='declined' then v_reason end,updated_at=statement_timestamp() where id=v_assignment.id returning * into v_assignment;
  if v_assignment.item_type='project' then
    update public.projects set owner_id=case when v_decision='accepted' then p_actor_id end,updated_by=p_actor_id where id=v_assignment.item_id;
  elsif v_assignment.item_type='milestone' then
    update public.milestones set owner_id=case when v_decision='accepted' then p_actor_id end,updated_by=p_actor_id where id=v_assignment.item_id;
  else
    update public.tasks set assigned_to=case when v_decision='accepted' then p_actor_id end,updated_by=p_actor_id where id=v_assignment.item_id;
  end if;
  -- A pending project is assigned but is not execution-active.  Acceptance is
  -- the sole transition that starts a newly created draft project.
  if v_decision='accepted' and v_assignment.item_type='project' then
    update public.projects
       set status='active',updated_by=p_actor_id,updated_at=statement_timestamp()
     where id=v_assignment.item_id and status='draft';
  end if;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
  values(v_actor.organization_id,p_actor_id,'f1r2_assignment_'||v_decision,'work_item_assignments',v_assignment.id,
    jsonb_build_object('status',v_old_status),jsonb_build_object('status',v_decision,'reason',v_reason));
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
declare
  v_actor public.profiles%rowtype; v_assignment public.work_item_assignments%rowtype;
  v_reason text:=nullif(btrim(coalesce(p_reason,'')),''); v_item_type text; v_item_id uuid;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_reason is null then raise exception 'F1R2_ASSIGNMENT_CANCEL_REASON_REQUIRED'; end if;
  select item_type,item_id into v_item_type,v_item_id from public.work_item_assignments where id=p_assignment_id;
  if not found then raise exception 'F1R2_ASSIGNMENT_NOT_FOUND'; end if;
  perform public.f1r2_lock_work_item(v_item_type,v_item_id);
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
  order by 5 nulls last,3,1;
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
declare v_actor public.profiles%rowtype; v_project public.projects%rowtype; v_full_visibility boolean:=false;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  select * into v_project from public.projects where id=p_project_id;
  if not found or v_project.organization_id<>v_actor.organization_id then raise exception 'F1R2_PROJECT_NOT_FOUND'; end if;
  v_full_visibility:=public.f1r2_actor_can_manage_item(p_actor_id,'project',p_project_id) or exists(
    select 1 from public.work_item_assignments a
    where a.assignee_id=p_actor_id and a.item_type='project' and a.item_id=p_project_id
      and a.status in('accepted','legacy_unverified')
  );
  if not (v_full_visibility or exists(
    select 1 from public.work_item_assignments a where a.assignee_id=p_actor_id and a.status in('pending','accepted','legacy_unverified') and
      ((a.item_type='project' and a.item_id=p_project_id)
       or (a.item_type='milestone' and exists(select 1 from public.milestones m where m.id=a.item_id and m.project_id=p_project_id))
       or (a.item_type='task' and exists(select 1 from public.tasks t where t.id=a.item_id and t.project_id=p_project_id)))
  )) then raise exception 'F1R2_PROJECT_ASSIGNMENTS_DENIED'; end if;
  return query
  select a.item_type,a.item_id,a.id,a.assignee_id,
    case when v_full_visibility or a.assignee_id=p_actor_id then coalesce(nullif(p.full_name_en,''),nullif(p.full_name_ar,''),'Assigned user') else 'Restricted participant' end,
    a.status,a.assigned_at,
    case when v_full_visibility or a.assignee_id=p_actor_id then a.responded_at end,
    case when v_full_visibility or a.assignee_id=p_actor_id then a.decline_reason end,
    case when v_full_visibility or a.assignee_id=p_actor_id then coalesce(nullif(ab.full_name_en,''),nullif(ab.full_name_ar,''),'Assigning user') else 'Restricted participant' end
  from public.work_item_assignments a join public.profiles p on p.id=a.assignee_id join public.profiles ab on ab.id=a.assigned_by
  where a.organization_id=v_actor.organization_id and a.status in('pending','accepted','declined','legacy_unverified')
    and (v_full_visibility or a.assignee_id=p_actor_id or (a.item_type='project' and a.item_id=p_project_id)) and
    ((a.item_type='project' and a.item_id=p_project_id)
     or (a.item_type='milestone' and exists(select 1 from public.milestones m where m.id=a.item_id and m.project_id=p_project_id))
     or (a.item_type='task' and exists(select 1 from public.tasks t where t.id=a.item_id and t.project_id=p_project_id)))
  order by a.item_type,a.item_id;
end $$;

drop function if exists public.f1r2_search_eligible_participants(uuid,text);
create or replace function public.f1r2_search_eligible_participants(
  p_actor_id uuid,p_item_type text,p_item_id uuid,p_assignment_purpose text,
  p_query text default null,p_limit integer default 50
)
returns table(id uuid,full_name_en text,full_name_ar text,department_id uuid,role_scope_label text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype; v_project public.projects%rowtype;
  v_organization_id uuid; v_division_id uuid; v_department_id uuid; v_unit_id uuid;
  v_query text:=lower(btrim(coalesce(p_query,''))); v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if lower(btrim(coalesce(p_item_type,'')))='project_create' then
    if p_item_id is null then
      v_organization_id:=v_actor.organization_id;
    else
      select d.organization_id,d.division_id,d.id into v_organization_id,v_division_id,v_department_id
      from public.departments d where d.id=p_item_id and d.organization_id=v_actor.organization_id and d.is_active=true;
      if not found then raise exception 'F1R2_PARTICIPANT_SEARCH_CONTEXT_INVALID'; end if;
    end if;
    if not public.f1r2_actor_scope_allows_context(
      p_actor_id,v_organization_id,v_division_id,v_department_id,v_unit_id,
      array['super_admin','executive','governance_admin','division_head','department_manager']
    ) then raise exception 'F1R2_PARTICIPANT_SEARCH_DENIED'; end if;
  elsif lower(btrim(coalesce(p_item_type,'')))='ovr' then
    select o.organization_id,o.division_id,o.department_id,o.unit_id
      into v_organization_id,v_division_id,v_department_id,v_unit_id
    from public.ovr_reports o where o.id=p_item_id and o.organization_id=v_actor.organization_id;
    if not found or not public.f1r2_actor_scope_allows_context(
      p_actor_id,v_organization_id,v_division_id,v_department_id,v_unit_id,
      array['super_admin','governance_admin','compliance_officer','department_manager']
    ) then raise exception 'F1R2_PARTICIPANT_SEARCH_DENIED'; end if;
  else
    v_project:=public.f1r2_resolve_project(lower(btrim(coalesce(p_item_type,''))),p_item_id);
    if v_project.id is null or v_project.organization_id<>v_actor.organization_id
       or not public.f1r2_actor_can_manage_item(p_actor_id,p_item_type,p_item_id)
    then raise exception 'F1R2_PARTICIPANT_SEARCH_DENIED'; end if;
    v_organization_id:=v_project.organization_id; v_division_id:=v_project.division_id;
    v_department_id:=v_project.department_id; v_unit_id:=v_project.unit_id;
  end if;
  return query
  select p.id,p.full_name_en,p.full_name_ar,p.department_id,string_agg(distinct ur.role::text||' / '||ur.scope::text,', ' order by ur.role::text||' / '||ur.scope::text)
  from public.profiles p join public.user_roles ur on ur.user_id=p.id and ur.is_active=true
  where p.organization_id=v_organization_id and p.is_active=true and p.user_status::text='active'
    and (ur.organization_id is null or ur.organization_id=v_organization_id)
    and (
      ur.scope::text in('global','assigned_only')
      or (ur.scope::text='division' and ur.division_id=v_division_id)
      or (ur.scope::text='department' and ur.department_id=v_department_id)
      or (ur.scope::text='unit' and ur.unit_id=v_unit_id)
    )
    and public.f1r2_assignment_candidate_is_eligible(
      p.id,v_organization_id,v_division_id,v_department_id,v_unit_id,p_assignment_purpose
    )
    and (v_query='' or lower(coalesce(p.full_name_en,'')||' '||coalesce(p.full_name_ar,'')||' '||coalesce(p.employee_no,'')) like '%'||v_query||'%')
  group by p.id,p.full_name_en,p.full_name_ar,p.department_id
  order by p.full_name_en,p.id limit v_limit;
end;
$$;

-- Exact assignment relationship grants only the item and necessary parent
-- context.  The ledger persists normalized hierarchy identifiers, so these
-- policies never recurse through projects/milestones/tasks to resolve parents.
drop policy if exists projects_f1r2_assignment_read on public.projects;
create policy projects_f1r2_assignment_read on public.projects for select to authenticated using (
  exists (
    select 1 from public.work_item_assignments a
    where a.organization_id=projects.organization_id
      and a.assignee_id=(select auth.uid())
      and a.project_id=projects.id
      and a.status in ('pending','accepted','legacy_unverified')
  )
);
drop policy if exists milestones_f1r2_assignment_read on public.milestones;
create policy milestones_f1r2_assignment_read on public.milestones for select to authenticated using (
  exists (
    select 1 from public.work_item_assignments a
    where a.organization_id=milestones.organization_id
      and a.assignee_id=(select auth.uid())
      and a.project_id=milestones.project_id
      and (
        (a.item_type='milestone' and a.milestone_id=milestones.id and a.status in ('pending','accepted','legacy_unverified'))
        or (a.item_type='project' and a.status in ('accepted','legacy_unverified'))
        or (a.item_type='task' and a.milestone_id=milestones.id and a.status in ('pending','accepted','legacy_unverified'))
      )
  )
);
drop policy if exists tasks_f1r2_assignment_read on public.tasks;
create policy tasks_f1r2_assignment_read on public.tasks for select to authenticated using (
  exists (
    select 1 from public.work_item_assignments a
    where a.organization_id=tasks.organization_id
      and a.assignee_id=(select auth.uid())
      and a.project_id=tasks.project_id
      and (
        (a.item_type='task' and a.task_id=tasks.id and a.status in ('pending','accepted','legacy_unverified'))
        or (a.item_type='milestone' and a.milestone_id=tasks.milestone_id and a.status in ('accepted','legacy_unverified'))
        or (a.item_type='project' and a.status in ('accepted','legacy_unverified'))
      )
  )
);

-- Existing permissive read policies may independently grant creator, owner, or
-- scoped-manager access.  A restrictive policy makes active-account state a
-- mandatory condition for every authenticated read on the assignment surface.
drop policy if exists work_item_assignments_f1r2_active_actor on public.work_item_assignments;
create policy work_item_assignments_f1r2_active_actor on public.work_item_assignments
as restrictive for select to authenticated
using (
  (select public.patch83u_credential_access_allowed())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and p.user_status::text='active')
);
drop policy if exists projects_f1r2_active_actor on public.projects;
create policy projects_f1r2_active_actor on public.projects
as restrictive for select to authenticated
using (
  (select public.patch83u_credential_access_allowed())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and p.user_status::text='active')
);
drop policy if exists milestones_f1r2_active_actor on public.milestones;
create policy milestones_f1r2_active_actor on public.milestones
as restrictive for select to authenticated
using (
  (select public.patch83u_credential_access_allowed())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and p.user_status::text='active')
);
drop policy if exists tasks_f1r2_active_actor on public.tasks;
create policy tasks_f1r2_active_actor on public.tasks
as restrictive for select to authenticated
using (
  (select public.patch83u_credential_access_allowed())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active=true and p.user_status::text='active')
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
  v_department public.departments%rowtype; v_milestone public.milestones%rowtype;
  v_id uuid; v_start date; v_due date; v_assignee uuid; v_owner_id uuid;
  v_department_id uuid:=nullif(p_payload->>'department_id','')::uuid;
  v_division_id uuid:=nullif(p_payload->>'division_id','')::uuid;
  v_unit_id uuid:=nullif(p_payload->>'unit_id','')::uuid;
  v_sponsor_id uuid:=nullif(p_payload->>'sponsor_id','')::uuid;
  v_title text:=nullif(btrim(p_payload->>'title'),''); v_result jsonb;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_title is null then raise exception 'F1R2_TITLE_REQUIRED'; end if;
  v_start:=nullif(p_payload->>'start_date','')::date;
  v_due:=nullif(coalesce(p_payload->>'target_end_date',p_payload->>'due_date'),'')::date;
  if v_start is not null and v_due is not null and v_due<v_start then raise exception 'F1R2_INVALID_DATE_ORDER'; end if;
  v_owner_id:=nullif(p_payload->>'owner_id','')::uuid;
  v_assignee:=case when v_type='task' then nullif(p_payload->>'assigned_to','')::uuid else v_owner_id end;
  if v_type='project' then
    if v_department_id is not null then
      select * into v_department from public.departments where id=v_department_id and organization_id=v_actor.organization_id and is_active=true;
      if not found then raise exception 'F1R2_PROJECT_DEPARTMENT_INVALID'; end if;
      if v_division_id is null then v_division_id:=v_department.division_id; end if;
      if v_division_id is distinct from v_department.division_id then raise exception 'F1R2_PROJECT_SCOPE_MISMATCH'; end if;
    end if;
    if v_unit_id is not null and not exists(
      select 1 from public.units u where u.id=v_unit_id and u.organization_id=v_actor.organization_id
        and u.department_id is not distinct from v_department_id and u.is_active=true
    ) then raise exception 'F1R2_PROJECT_UNIT_INVALID'; end if;
    if not public.f1r2_actor_scope_allows_context(
      p_actor_id,v_actor.organization_id,v_division_id,v_department_id,v_unit_id,
      array['super_admin','executive','governance_admin','division_head','department_manager']
    ) then raise exception 'F1R2_PROJECT_CREATE_DENIED'; end if;
    if v_sponsor_id is not null and not public.f1r2_assignment_candidate_is_eligible(
      v_sponsor_id,v_actor.organization_id,v_division_id,v_department_id,v_unit_id,'sponsor'
    ) then raise exception 'F1R2_SPONSOR_NOT_ELIGIBLE'; end if;
    insert into public.projects(organization_id,title,description,category,source_type,division_id,department_id,unit_id,owner_id,sponsor_id,start_date,target_end_date,priority,risk_level,status,progress_percent,evidence_required,closure_approval_required,created_by,updated_by)
    values(v_actor.organization_id,v_title,nullif(btrim(p_payload->>'description'),''),coalesce(nullif(p_payload->>'category',''),'general'),coalesce(nullif(p_payload->>'source_type',''),'manual')::public.source_type,
      v_division_id,v_department_id,v_unit_id,null,v_sponsor_id,v_start,v_due,coalesce(nullif(p_payload->>'priority',''),'medium')::public.priority_level,coalesce(nullif(p_payload->>'risk_level',''),'medium')::public.risk_level,
      'draft',0,coalesce((p_payload->>'evidence_required')::boolean,true),coalesce((p_payload->>'closure_approval_required')::boolean,true),p_actor_id,p_actor_id) returning id into v_id;
  elsif v_type in ('milestone','task') then
    v_project:=public.f1r2_resolve_project('project',nullif(p_payload->>'project_id','')::uuid);
    if v_project.id is null or v_project.organization_id<>v_actor.organization_id or not public.acc_v13_actor_can_control_project(p_actor_id,v_project) then raise exception 'F1R2_CHILD_CREATE_DENIED'; end if;
    if v_project.status in ('closed','cancelled') then raise exception 'F1R2_CLOSED_PROJECT_CHILD_MUTATION_DENIED'; end if;
    if v_type='milestone' then
      insert into public.milestones(organization_id,project_id,title,description,owner_id,start_date,due_date,status,progress_percent,evidence_required,created_by,updated_by)
      values(v_actor.organization_id,v_project.id,v_title,nullif(btrim(p_payload->>'description'),''),null,v_start,v_due,'not_started',0,coalesce((p_payload->>'evidence_required')::boolean,true),p_actor_id,p_actor_id) returning id into v_id;
    else
      if nullif(p_payload->>'milestone_id','') is not null then
        select * into v_milestone from public.milestones
        where id=nullif(p_payload->>'milestone_id','')::uuid
          and project_id=v_project.id and organization_id=v_actor.organization_id;
        if not found then raise exception 'F1R2_TASK_MILESTONE_PROJECT_MISMATCH'; end if;
        if v_milestone.status in ('closed','cancelled') then raise exception 'F1R2_CLOSED_MILESTONE_TASK_MUTATION_DENIED'; end if;
      end if;
      if v_owner_id is not null and not public.f1r2_assignment_candidate_is_eligible(
        v_owner_id,v_project.organization_id,v_project.division_id,v_project.department_id,v_project.unit_id,'task_owner'
      ) then raise exception 'F1R2_TASK_OWNER_NOT_ELIGIBLE'; end if;
      insert into public.tasks(organization_id,project_id,milestone_id,title,description,owner_id,assigned_to,start_date,due_date,status,progress_percent,evidence_required,created_by,updated_by)
      values(v_actor.organization_id,v_project.id,v_milestone.id,v_title,nullif(btrim(p_payload->>'description'),''),v_owner_id,null,v_start,v_due,'not_started',0,coalesce((p_payload->>'evidence_required')::boolean,false),p_actor_id,p_actor_id) returning id into v_id;
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
declare
  v_actor public.profiles%rowtype; v_report public.ovr_reports%rowtype; v_notification timestamptz;
  v_department_id uuid:=nullif(p_payload->>'department_id','')::uuid;
  v_status text:=coalesce(nullif(p_payload->>'status',''),'submitted');
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_status not in ('draft','submitted') then raise exception 'F1R2_OVR_STATUS_INVALID'; end if;
  if nullif(btrim(p_payload->>'brief_description'),'') is null then raise exception 'F1R2_OVR_DESCRIPTION_REQUIRED'; end if;
  if v_department_id is not null and not exists(
    select 1 from public.departments d
    where d.id=v_department_id and d.organization_id=v_actor.organization_id and d.is_active=true
  ) then raise exception 'F1R2_OVR_DEPARTMENT_INVALID'; end if;
  if nullif(p_payload->>'notification_at','') is not null then
    if (p_payload->>'notification_at') ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then v_notification:=(p_payload->>'notification_at')::timestamptz;
    else v_notification:=(p_payload->>'notification_at')::timestamp at time zone 'Asia/Riyadh'; end if;
  end if;
  insert into public.ovr_reports(organization_id,logging_number,occurrence_date,occurrence_time,occurrence_location,notification_at,involved_person_type,person_involved_name,mrn_or_id_no,age,sex,department_id,physical_condition,mental_condition,pre_occurrence_condition_flags,brief_description,occurrence_category,severity_level,injury_type,occurrence_details,status,corrective_action_required,evidence_required,reported_by,owner_id,created_by,updated_by)
  values(v_actor.organization_id,nullif(p_payload->>'logging_number',''),nullif(p_payload->>'occurrence_date','')::date,nullif(p_payload->>'occurrence_time','')::time,nullif(p_payload->>'occurrence_location',''),v_notification,
    coalesce(nullif(p_payload->>'involved_person_type',''),'patient')::public.ovr_involved_person_type,nullif(p_payload->>'person_involved_name',''),nullif(p_payload->>'mrn_or_id_no',''),nullif(p_payload->>'age','')::integer,nullif(p_payload->>'sex',''),v_department_id,
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
  if not public.f1r2_actor_scope_allows_context(
    p_actor_id,v_ovr.organization_id,v_ovr.division_id,v_ovr.department_id,v_ovr.unit_id,
    array['super_admin','governance_admin','compliance_officer','department_manager']
  ) then raise exception 'F1R2_QUALITY_AUTHORITY_REQUIRED'; end if;
  select * into v_owner from public.profiles where id=nullif(p_payload->>'owner_id','')::uuid and organization_id=v_actor.organization_id and is_active=true and user_status::text='active';
  if not found then raise exception 'F1R2_EXPLICIT_OWNER_REQUIRED'; end if;
  select * into v_sponsor from public.profiles where id=nullif(p_payload->>'sponsor_id','')::uuid and organization_id=v_actor.organization_id and is_active=true and user_status::text='active';
  if not found then raise exception 'F1R2_EXPLICIT_SPONSOR_REQUIRED'; end if;
  if not public.f1r2_assignment_candidate_is_eligible(v_owner.id,v_ovr.organization_id,v_ovr.division_id,v_ovr.department_id,v_ovr.unit_id,'project_owner') then raise exception 'F1R2_OWNER_NOT_ELIGIBLE'; end if;
  if not public.f1r2_assignment_candidate_is_eligible(v_sponsor.id,v_ovr.organization_id,v_ovr.division_id,v_ovr.department_id,v_ovr.unit_id,'sponsor') then raise exception 'F1R2_SPONSOR_NOT_ELIGIBLE'; end if;
  v_start:=nullif(p_payload->>'start_date','')::date; v_due:=nullif(p_payload->>'target_end_date','')::date;
  if v_start is null or v_due is null or v_due<v_start then raise exception 'F1R2_CORRECTIVE_DATES_INVALID'; end if;
  insert into public.projects(organization_id,title,description,category,source_type,source_reference_id,division_id,department_id,unit_id,owner_id,sponsor_id,start_date,target_end_date,priority,risk_level,status,progress_percent,evidence_required,closure_approval_required,created_by,updated_by)
  values(v_actor.organization_id,coalesce(nullif(btrim(p_payload->>'title'),''),'Corrective action for '||coalesce(v_ovr.ovr_number,v_ovr.id::text)),nullif(btrim(p_payload->>'description'),''),'corrective_action','incident_ovr',v_ovr.id,v_ovr.division_id,v_ovr.department_id,v_ovr.unit_id,null,v_sponsor.id,v_start,v_due,'high',case when v_ovr.severity_level::text in ('sentinel','level_4') then 'critical'::public.risk_level when v_ovr.severity_level::text='level_3' then 'high'::public.risk_level else 'medium'::public.risk_level end,'draft',0,coalesce(v_ovr.evidence_required,true),true,p_actor_id,p_actor_id)
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
declare v_progress numeric;
begin
  select avg(case when status='closed' then 100 else progress_percent end) into v_progress
  from public.tasks where milestone_id=target_milestone_id and status<>'cancelled';
  if v_progress is not null then
    update public.milestones
       set progress_percent=case when status='closed' then 100 else round(v_progress,2) end,
           updated_at=statement_timestamp()
     where id=target_milestone_id;
  end if;
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
  if v_progress is not null then
    update public.projects
       set progress_percent=case when status='closed' then 100 else round(v_progress,2) end,
           updated_at=statement_timestamp()
     where id=target_project_id;
  end if;
end;
$$;

create or replace function public.f1r2_rollup_task_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if old.milestone_id is not null then perform public.refresh_milestone_progress(old.milestone_id); end if;
  if new.milestone_id is not null and new.milestone_id is distinct from old.milestone_id then perform public.refresh_milestone_progress(new.milestone_id); end if;
  if old.milestone_id is null then perform public.refresh_project_progress(old.project_id); end if;
  if new.milestone_id is null and new.project_id is distinct from old.project_id then perform public.refresh_project_progress(new.project_id); end if;
  return coalesce(new,old);
end $$;
drop trigger if exists trg_refresh_project_progress_tasks on public.tasks;
drop trigger if exists trg_f1r2_rollup_task on public.tasks;
create trigger trg_f1r2_rollup_task after insert or update or delete on public.tasks for each row execute function public.f1r2_rollup_task_trigger();

create or replace function public.f1r2_rollup_milestone_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  perform public.refresh_project_progress(old.project_id);
  if new.project_id is distinct from old.project_id then perform public.refresh_project_progress(new.project_id); end if;
  return coalesce(new,old);
end $$;
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

create or replace function public.f1r2_latest_approval_satisfied(
  p_item_type text,p_item_id uuid,p_required boolean
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $$
  with ranked as (
    select a.status::text as status
    from public.approvals a
    where case lower(btrim(coalesce(p_item_type,'')))
      when 'project' then a.project_id=p_item_id
      when 'milestone' then a.milestone_id=p_item_id
      when 'task' then a.task_id=p_item_id
      else false end
    -- requested_at is historically transaction-timestamp based, so multiple
    -- governed requests can legitimately tie inside one transaction. A still
    -- pending request is the newest unresolved review at that timestamp;
    -- otherwise the most recently decided request wins the tie.
    order by a.requested_at desc,a.decided_at desc nulls first,a.id desc
    limit 1
  )
  select case
    when not coalesce(p_required,false) then true
    else coalesce((select status='approved' from ranked),false)
  end
$$;

create or replace function public.f1r2_item_evidence_satisfied(
  p_organization_id uuid,p_item_type text,p_item_id uuid,p_evidence_required boolean
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $$
  select
    not exists (
      select 1 from public.evidence_requirements er
      where er.organization_id=p_organization_id and er.is_active=true
        and er.linked_item_type=lower(btrim(coalesce(p_item_type,'')))
        and er.linked_item_id=p_item_id
        and er.required_for_gate in('closure','approval')
        and er.gate_status<>'satisfied'
    )
    and (
      not coalesce(p_evidence_required,false)
      or exists (
        select 1
        from public.evidence_links l
        join public.evidence_files e on e.id=l.evidence_file_id
        where l.organization_id=p_organization_id and l.is_active=true
          and l.linked_item_type=lower(btrim(coalesce(p_item_type,'')))
          and l.linked_item_id=p_item_id
          and e.is_current_version=true
          and coalesce(e.review_status,e.status::text)='accepted'
      )
    )
$$;

create or replace function public.f1r2_can_close_work_item(p_item_type text,p_item_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare v_type text:=lower(btrim(coalesce(p_item_type,''))); v_project public.projects%rowtype; v_milestone public.milestones%rowtype; v_task public.tasks%rowtype;
begin
  if v_type='project' then
    select * into v_project from public.projects where id=p_item_id;
    if not found then return false; end if;
    return public.f1r2_item_evidence_satisfied(v_project.organization_id,'project',v_project.id,v_project.evidence_required)
      and public.f1r2_latest_approval_satisfied('project',v_project.id,v_project.closure_approval_required)
      and not exists(select 1 from public.milestones m where m.project_id=v_project.id and m.status not in('closed','cancelled'))
      and not exists(select 1 from public.tasks t where t.project_id=v_project.id and t.status not in('closed','cancelled'))
      and not exists(select 1 from public.milestones m where m.project_id=v_project.id and not public.f1r2_item_evidence_satisfied(m.organization_id,'milestone',m.id,m.evidence_required))
      and not exists(select 1 from public.tasks t where t.project_id=v_project.id and not public.f1r2_item_evidence_satisfied(t.organization_id,'task',t.id,t.evidence_required))
      and not exists(select 1 from public.milestones m where m.project_id=v_project.id and exists(select 1 from public.approvals a where a.milestone_id=m.id) and not public.f1r2_latest_approval_satisfied('milestone',m.id,true))
      and not exists(select 1 from public.tasks t where t.project_id=v_project.id and exists(select 1 from public.approvals a where a.task_id=t.id) and not public.f1r2_latest_approval_satisfied('task',t.id,true));
  elsif v_type='milestone' then
    select * into v_milestone from public.milestones where id=p_item_id;
    if not found then return false; end if;
    return public.f1r2_item_evidence_satisfied(v_milestone.organization_id,'milestone',v_milestone.id,v_milestone.evidence_required)
      and (not exists(select 1 from public.approvals a where a.milestone_id=v_milestone.id) or public.f1r2_latest_approval_satisfied('milestone',v_milestone.id,true))
      and not exists(select 1 from public.tasks t where t.milestone_id=v_milestone.id and t.status not in('closed','cancelled'))
      and not exists(select 1 from public.tasks t where t.milestone_id=v_milestone.id and not public.f1r2_item_evidence_satisfied(t.organization_id,'task',t.id,t.evidence_required));
  elsif v_type='task' then
    select * into v_task from public.tasks where id=p_item_id;
    if not found then return false; end if;
    return public.f1r2_item_evidence_satisfied(v_task.organization_id,'task',v_task.id,v_task.evidence_required)
      and (not exists(select 1 from public.approvals a where a.task_id=v_task.id) or public.f1r2_latest_approval_satisfied('task',v_task.id,true));
  end if;
  return false;
end $$;

-- Require accepted (or compatibility legacy) assignment before assignee work mutation.
create or replace function public.acc_v13_update_work_item_status(p_actor_id uuid,p_item_type text,p_item_id uuid,p_status text,p_progress_percent numeric,p_delay_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_actor public.profiles%rowtype; v_project public.projects%rowtype; v_assignment public.work_item_assignments%rowtype;
  v_milestone public.milestones%rowtype; v_old jsonb; v_new jsonb;
  v_type text:=lower(btrim(coalesce(p_item_type,''))); v_child_count integer; v_current_status text;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  perform public.f1r2_lock_work_item(v_type,p_item_id);
  if v_type='project' then
    select p.status::text into v_current_status from public.projects p where p.id=p_item_id for update;
  elsif v_type='milestone' then
    select m.status::text into v_current_status from public.milestones m where m.id=p_item_id for update;
  elsif v_type='task' then
    select t.status::text into v_current_status from public.tasks t where t.id=p_item_id for update;
  else
    raise exception 'F1R2_ITEM_TYPE_INVALID';
  end if;
  if not found then raise exception 'F1R2_ITEM_NOT_FOUND'; end if;
  v_project:=public.f1r2_resolve_project(v_type,p_item_id);
  select * into v_assignment from public.work_item_assignments
  where item_type=v_type and item_id=p_item_id and status in('pending','accepted','declined','legacy_unverified')
  order by assigned_at desc,id desc limit 1 for update;
  if v_project.id is null or v_project.organization_id<>v_actor.organization_id then raise exception 'F1R2_ITEM_NOT_FOUND'; end if;
  if p_progress_percent is null or p_progress_percent<0 or p_progress_percent>100 then raise exception 'F1R2_PROGRESS_OUT_OF_RANGE'; end if;
  if p_status='delayed' and nullif(btrim(coalesce(p_delay_reason,'')),'') is null then raise exception 'F1R2_DELAY_REASON_REQUIRED'; end if;
  if v_type='project' and p_status not in ('draft','pending_approval','active','at_risk','delayed','completed_pending_evidence','completed_pending_approval','closed','cancelled') then raise exception 'F1R2_STATUS_INVALID'; end if;
  -- A pending project assignment is a pre-execution acknowledgement state.
  -- No ordinary actor, including creator, sponsor, scoped manager, or Super
  -- Admin, may begin project execution before the assignee accepts.  Governed
  -- cancellation remains available to an otherwise-authorized controller.
  if v_type='project' and v_assignment.status='pending' and p_status not in ('draft','cancelled') then raise exception 'F1R2_PENDING_PROJECT_EXECUTION_DENIED'; end if;
  if v_assignment.assignee_id=p_actor_id and v_assignment.status not in ('accepted','legacy_unverified') then raise exception 'F1R2_ASSIGNMENT_ACCEPTANCE_REQUIRED'; end if;
  if v_assignment.assignee_id is distinct from p_actor_id and not public.f1r2_actor_can_manage_item(p_actor_id,v_type,p_item_id) then raise exception 'F1R2_STATUS_UPDATE_DENIED'; end if;
  if v_type in ('milestone','task') and v_assignment.assignee_id is not null and v_assignment.assignee_id<>p_actor_id then raise exception 'F1R2_ASSIGNEE_IMPERSONATION_DENIED'; end if;
  if v_type in ('milestone','task') and v_project.status='closed' then raise exception 'F1R2_CLOSED_PROJECT_CHILD_MUTATION_DENIED'; end if;
  if v_type='task' then
    select m.* into v_milestone from public.tasks t join public.milestones m on m.id=t.milestone_id where t.id=p_item_id;
    if v_milestone.id is not null and v_milestone.status='closed' then raise exception 'F1R2_CLOSED_MILESTONE_TASK_MUTATION_DENIED'; end if;
  end if;
  if p_status='closed' and not public.f1r2_can_close_work_item(v_type,p_item_id) then raise exception 'F1R2_CLOSURE_PREREQUISITES_NOT_MET'; end if;
  if v_type='project' then
    select count(*) into v_child_count from public.milestones where project_id=p_item_id and status<>'cancelled';
    select to_jsonb(p) into v_old from public.projects p where p.id=p_item_id for update;
    if v_old->>'status'=p_status and p_status='closed' then
      return jsonb_build_object('item_type',v_type,'item_id',p_item_id,'status',v_old->>'status','progress_percent',(v_old->>'progress_percent')::numeric,'record',v_old,'replayed',true);
    end if;
    update public.projects
       set status=p_status::public.project_status,
           progress_percent=case when v_child_count>0 then progress_percent when p_status='closed' then 100 else p_progress_percent end,
           delay_reason=case when p_status='delayed' then nullif(btrim(p_delay_reason),'') end,
           owner_id=case when p_status='cancelled' and v_assignment.status='pending' then null else owner_id end,
           updated_by=p_actor_id
     where id=p_item_id returning to_jsonb(projects) into v_new;
    if p_status='cancelled' and v_assignment.status='pending' then
      update public.work_item_assignments
         set status='cancelled',responded_by=p_actor_id,responded_at=statement_timestamp(),updated_at=statement_timestamp()
       where id=v_assignment.id and status='pending';
      insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
      values(v_actor.organization_id,p_actor_id,'f1r2_assignment_cancelled','work_item_assignments',v_assignment.id,
        jsonb_build_object('status','pending'),
        jsonb_build_object('status','cancelled','reason','project_cancelled','project_id',p_item_id));
    end if;
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
  elsif v_type in('milestone','task') and v_old->>'status'='closed' and v_new->>'status'<>'closed' then
    insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
    values(v_actor.organization_id,p_actor_id,'f1r2_'||v_type||'_reopened',v_type||'s',p_item_id,v_old,jsonb_build_object('status',v_new->>'status'));
  end if;
  return jsonb_build_object('item_type',v_type,'item_id',p_item_id,'status',v_new->>'status','progress_percent',(v_new->>'progress_percent')::numeric,'record',v_new,'replayed',false);
end $$;

-- Protected approval decisions; browser update policy is retired.
create or replace function public.acc_v13_actor_can_request_approval(
  p_actor_id uuid,p_item_type text,p_item_id uuid
)
returns boolean
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  v_project public.projects%rowtype; v_assignment public.work_item_assignments%rowtype;
  v_item_type text:=lower(trim(coalesce(p_item_type,'')));
begin
  v_project:=public.acc_v13_resolve_approval_project(v_item_type,p_item_id);
  if v_project.id is null then return false; end if;
  v_assignment:=public.f1r2_current_assignment(v_item_type,p_item_id);
  if v_item_type='project' then
    return public.f1r2_actor_can_manage_item(p_actor_id,'project',p_item_id);
  elsif v_item_type='milestone' then
    return (v_assignment.assignee_id=p_actor_id and v_assignment.status in('accepted','legacy_unverified'))
      or public.f1r2_actor_can_manage_item(p_actor_id,'milestone',p_item_id);
  elsif v_item_type='task' then
    return exists(select 1 from public.tasks t where t.id=p_item_id and t.owner_id=p_actor_id)
      or (v_assignment.assignee_id=p_actor_id and v_assignment.status in('accepted','legacy_unverified'))
      or public.f1r2_actor_can_manage_item(p_actor_id,'task',p_item_id);
  end if;
  return false;
end;
$$;

create or replace function public.acc_v13_request_approval(
  p_actor_id uuid,p_organization_id uuid,p_item_type text,p_item_id uuid,p_approver_id uuid,p_request_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_project public.projects%rowtype; v_item_type text:=lower(trim(coalesce(p_item_type,'')));
  v_approval public.approvals%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'ACC_V13_SERVICE_ROLE_REQUIRED'; end if;
  perform public.f1r2_lock_work_item(v_item_type,p_item_id);
  v_project:=public.acc_v13_resolve_approval_project(v_item_type,p_item_id);
  if v_project.id is null or v_project.organization_id<>p_organization_id then raise exception 'ACC_V13_APPROVAL_ITEM_NOT_FOUND'; end if;
  if not public.acc_v13_actor_can_request_approval(p_actor_id,v_item_type,p_item_id) then raise exception 'ACC_V13_APPROVAL_REQUESTER_NOT_AUTHORIZED'; end if;
  if not public.acc_v13_is_eligible_approver(p_actor_id,p_approver_id,v_item_type,p_item_id) then raise exception 'ACC_V13_APPROVER_NOT_ELIGIBLE'; end if;
  insert into public.approvals(organization_id,project_id,milestone_id,task_id,requested_by,approver_id,status,request_note)
  values(p_organization_id,case when v_item_type='project' then p_item_id end,case when v_item_type='milestone' then p_item_id end,case when v_item_type='task' then p_item_id end,p_actor_id,p_approver_id,'pending',nullif(trim(coalesce(p_request_note,'')),''))
  returning * into v_approval;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,new_data)
  values(p_organization_id,p_actor_id,'acc_v13_approval_requested','approvals',v_approval.id,jsonb_build_object('item_type',v_item_type,'item_id',p_item_id,'approver_id',p_approver_id));
  return jsonb_build_object('id',v_approval.id,'status',v_approval.status);
end;
$$;

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

create or replace function public.f1r2_evidence_requirement_flags(
  p_organization_id uuid,p_item_type text,p_item_id uuid
)
returns table(required_for_closure boolean,required_for_approval boolean)
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare v_type text:=lower(btrim(coalesce(p_item_type,'')));
begin
  if v_type='project' then
    return query select p.evidence_required,p.closure_approval_required from public.projects p
      where p.id=p_item_id and p.organization_id=p_organization_id;
  elsif v_type='milestone' then
    return query select m.evidence_required,exists(select 1 from public.approvals a where a.milestone_id=m.id)
      from public.milestones m where m.id=p_item_id and m.organization_id=p_organization_id;
  elsif v_type='task' then
    return query select t.evidence_required,exists(select 1 from public.approvals a where a.task_id=t.id)
      from public.tasks t where t.id=p_item_id and t.organization_id=p_organization_id;
  elsif v_type='ovr' then
    return query select o.evidence_required,o.closure_approval_required from public.ovr_reports o
      where o.id=p_item_id and o.organization_id=p_organization_id;
  elsif v_type in('risk','compliance','audit_finding') then
    return query select
      exists(select 1 from public.evidence_requirements er where er.organization_id=p_organization_id and er.is_active=true and er.linked_item_type=v_type and er.linked_item_id=p_item_id and er.required_for_gate='closure'),
      exists(select 1 from public.evidence_requirements er where er.organization_id=p_organization_id and er.is_active=true and er.linked_item_type=v_type and er.linked_item_id=p_item_id and er.required_for_gate='approval');
  end if;
end;
$$;

-- Evidence parent mutation is deliberately narrower than evidence read
-- entitlement.  Pending assignees, approver-only users, and auditor-only
-- users never satisfy this predicate.  An accepted/legacy-compatible
-- assignee may correct evidence only for the exact assigned work item.
create or replace function public.f1r2_actor_can_mutate_evidence_parent(
  p_actor_id uuid,p_item_type text,p_item_id uuid
)
returns boolean
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_project public.projects%rowtype;
  v_ovr public.ovr_reports%rowtype;
  v_type text:=lower(btrim(coalesce(p_item_type,'')));
  v_organization_id uuid; v_division_id uuid; v_department_id uuid; v_unit_id uuid;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_type in('project','milestone','task') then
    v_project:=public.f1r2_resolve_project(v_type,p_item_id);
    if v_project.id is null or v_project.organization_id<>v_actor.organization_id then return false; end if;
    return public.f1r2_actor_can_manage_item(p_actor_id,v_type,p_item_id)
      or exists(
        select 1 from public.work_item_assignments a
        where a.organization_id=v_actor.organization_id
          and a.item_type=v_type and a.item_id=p_item_id
          and a.assignee_id=p_actor_id
          and a.status in('accepted','legacy_unverified')
      );
  elsif v_type='ovr' then
    select * into v_ovr from public.ovr_reports o where o.id=p_item_id;
    if not found or v_ovr.organization_id<>v_actor.organization_id then return false; end if;
    return coalesce(p_actor_id in(v_ovr.reported_by,v_ovr.owner_id,v_ovr.supervisor_id,v_ovr.quality_reviewer_id),false)
      or public.f1r2_actor_scope_allows_context(
        p_actor_id,v_ovr.organization_id,v_ovr.division_id,v_ovr.department_id,v_ovr.unit_id,
        array['super_admin','governance_admin','compliance_officer','division_head','department_manager']
      );
  elsif v_type='risk' then
    select r.organization_id,r.division_id,r.department_id,r.unit_id
      into v_organization_id,v_division_id,v_department_id,v_unit_id
    from public.risks r where r.id=p_item_id;
  elsif v_type='compliance' then
    select c.organization_id,c.division_id,c.department_id,c.unit_id
      into v_organization_id,v_division_id,v_department_id,v_unit_id
    from public.compliance_items c where c.id=p_item_id;
  elsif v_type='audit_finding' then
    select a.organization_id,a.division_id,a.department_id,a.unit_id
      into v_organization_id,v_division_id,v_department_id,v_unit_id
    from public.audit_findings a where a.id=p_item_id;
  else
    return false;
  end if;
  if not found or v_organization_id<>v_actor.organization_id then return false; end if;
  return public.f1r2_actor_scope_allows_context(
    p_actor_id,v_organization_id,v_division_id,v_department_id,v_unit_id,
    array['super_admin','governance_admin','compliance_officer','division_head','department_manager']
  );
end;
$$;

-- Parent changes are not ordinary evidence-row edits.  Only the verified
-- service bridge may establish the transaction-local actor used by the
-- canonical-link trigger and audit trail.
create or replace function public.f1r2_guard_evidence_parent_change()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_actor_text text;
  v_actor_id uuid;
begin
  if row(new.project_id,new.milestone_id,new.task_id,new.ovr_report_id,new.audit_finding_id,new.risk_id,new.compliance_item_id)
     is not distinct from
     row(old.project_id,old.milestone_id,old.task_id,old.ovr_report_id,old.audit_finding_id,old.risk_id,old.compliance_item_id)
     and coalesce(current_setting('f1r2.force_evidence_relink',true),'')<>'true'
  then
    return new;
  end if;
  if auth.role() is distinct from 'service_role' then
    raise exception 'F1R2_EVIDENCE_RELINK_SERVICE_ROLE_REQUIRED';
  end if;
  v_actor_text:=nullif(current_setting('f1r2.verified_evidence_actor_id',true),'');
  if v_actor_text is null then
    raise exception 'F1R2_EVIDENCE_RELINK_ACTOR_CONTEXT_REQUIRED';
  end if;
  begin
    v_actor_id:=v_actor_text::uuid;
  exception when invalid_text_representation then
    raise exception 'F1R2_EVIDENCE_RELINK_ACTOR_CONTEXT_INVALID';
  end;
  if new.updated_by is distinct from v_actor_id then
    raise exception 'F1R2_EVIDENCE_RELINK_ACTOR_MISMATCH';
  end if;
  return new;
end;
$$;

create or replace function public.f1r2_relink_evidence_parent(
  p_actor_id uuid,
  p_evidence_file_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_evidence public.evidence_files%rowtype;
  v_reconciliation public.f1r2_evidence_link_reconciliation%rowtype;
  v_type text:=lower(btrim(coalesce(p_item_type,'')));
  v_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  v_source_type text;
  v_source_id uuid;
  v_source_count integer:=0;
  v_target_organization_id uuid;
  v_division_id uuid;
  v_department_id uuid;
  v_unit_id uuid;
  v_target_allowed boolean:=false;
  v_source_allowed boolean:=false;
  v_direct_source_allowed boolean:=false;
  v_reconciliation_allowed boolean:=false;
  v_is_reconciliation boolean:=false;
  v_now timestamptz:=statement_timestamp();
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_type not in ('project','milestone','task','ovr','risk','compliance','audit_finding') or p_item_id is null then
    raise exception 'F1R2_EVIDENCE_RELINK_TARGET_INVALID';
  end if;
  if v_reason is null or length(v_reason)>500 then
    raise exception 'F1R2_EVIDENCE_RELINK_REASON_REQUIRED';
  end if;

  select * into v_evidence
  from public.evidence_files
  where id=p_evidence_file_id
  for update;
  if not found or v_evidence.organization_id<>v_actor.organization_id then
    raise exception 'F1R2_EVIDENCE_NOT_FOUND';
  end if;
  if v_evidence.locked_at is not null then
    raise exception 'F1R2_EVIDENCE_RELINK_LOCKED';
  end if;
  v_direct_source_allowed:=coalesce(
    p_actor_id in(v_evidence.uploaded_by,v_evidence.created_by,v_evidence.evidence_owner_id,v_evidence.reviewer_id,v_evidence.reviewed_by),
    false
  );

  if v_type='project' then
    select p.organization_id,p.division_id,p.department_id,p.unit_id
      into v_target_organization_id,v_division_id,v_department_id,v_unit_id
    from public.projects p where p.id=p_item_id;
  elsif v_type='milestone' then
    select m.organization_id,p.division_id,p.department_id,p.unit_id
      into v_target_organization_id,v_division_id,v_department_id,v_unit_id
    from public.milestones m join public.projects p on p.id=m.project_id where m.id=p_item_id;
  elsif v_type='task' then
    select t.organization_id,p.division_id,p.department_id,p.unit_id
      into v_target_organization_id,v_division_id,v_department_id,v_unit_id
    from public.tasks t join public.projects p on p.id=t.project_id where t.id=p_item_id;
  elsif v_type='ovr' then
    select o.organization_id,o.division_id,o.department_id,o.unit_id
      into v_target_organization_id,v_division_id,v_department_id,v_unit_id
    from public.ovr_reports o where o.id=p_item_id;
  elsif v_type='risk' then
    select r.organization_id,r.division_id,r.department_id,r.unit_id
      into v_target_organization_id,v_division_id,v_department_id,v_unit_id
    from public.risks r where r.id=p_item_id;
  elsif v_type='compliance' then
    select c.organization_id,c.division_id,c.department_id,c.unit_id
      into v_target_organization_id,v_division_id,v_department_id,v_unit_id
    from public.compliance_items c where c.id=p_item_id;
  else
    select a.organization_id,a.division_id,a.department_id,a.unit_id
      into v_target_organization_id,v_division_id,v_department_id,v_unit_id
    from public.audit_findings a where a.id=p_item_id;
  end if;
  if not found or v_target_organization_id<>v_actor.organization_id then
    raise exception 'F1R2_EVIDENCE_RELINK_TARGET_INVALID';
  end if;

  -- The evidence row lock serializes every governed relink for this file.
  -- Resolve the current active canonical source independently of the target.
  select count(*)::integer into v_source_count
  from public.evidence_links l
  where l.evidence_file_id=v_evidence.id and l.organization_id=v_evidence.organization_id
    and l.is_primary=true and l.is_active=true;

  if v_source_count=1 then
    select l.linked_item_type,l.linked_item_id into v_source_type,v_source_id
    from public.evidence_links l
    where l.evidence_file_id=v_evidence.id and l.organization_id=v_evidence.organization_id
      and l.is_primary=true and l.is_active=true
    for update;
    if not (
      (v_source_type='project' and v_evidence.project_id=v_source_id)
      or (v_source_type='milestone' and v_evidence.milestone_id=v_source_id)
      or (v_source_type='task' and v_evidence.task_id=v_source_id)
      or (v_source_type='ovr' and v_evidence.ovr_report_id=v_source_id)
      or (v_source_type='risk' and v_evidence.risk_id=v_source_id)
      or (v_source_type='compliance' and v_evidence.compliance_item_id=v_source_id)
      or (v_source_type='audit_finding' and v_evidence.audit_finding_id=v_source_id)
    ) then
      raise exception 'F1R2_EVIDENCE_CANONICAL_SOURCE_MISMATCH';
    end if;
    v_source_allowed:=v_direct_source_allowed
      or public.f1r2_actor_can_mutate_evidence_parent(p_actor_id,v_source_type,v_source_id);
    v_target_allowed:=public.f1r2_actor_can_mutate_evidence_parent(p_actor_id,v_type,p_item_id);
    if not v_source_allowed or not v_target_allowed then
      raise exception 'F1R2_EVIDENCE_RELINK_DENIED';
    end if;
    if (v_source_type,v_source_id) is not distinct from (v_type,p_item_id) then
      return jsonb_build_object(
        'evidence_file_id',p_evidence_file_id,'linked_item_type',v_type,'linked_item_id',p_item_id,
        'relinked_by',p_actor_id,'replayed',true
      );
    end if;
  elsif v_source_count=0 then
    select * into v_reconciliation
    from public.f1r2_evidence_link_reconciliation r
    where r.evidence_file_id=v_evidence.id and r.organization_id=v_evidence.organization_id
    for update;
    if not found then raise exception 'F1R2_EVIDENCE_RECONCILIATION_REQUIRED'; end if;
    v_is_reconciliation:=true;
    v_reconciliation_allowed:=public.f1r2_actor_scope_allows_context(
      p_actor_id,v_target_organization_id,v_division_id,v_department_id,v_unit_id,
      array['super_admin','governance_admin','compliance_officer']
    );
    if not v_reconciliation_allowed then
      raise exception 'F1R2_EVIDENCE_RECONCILIATION_DENIED';
    end if;
  else
    raise exception 'F1R2_EVIDENCE_CANONICAL_SOURCE_AMBIGUOUS';
  end if;

  perform set_config('f1r2.verified_evidence_actor_id',p_actor_id::text,true);
  perform set_config('f1r2.evidence_relink_reason',v_reason,true);
  perform set_config('f1r2.force_evidence_relink',case when v_is_reconciliation then 'true' else 'false' end,true);
  update public.evidence_files
     set project_id=case when v_type='project' then p_item_id end,
         milestone_id=case when v_type='milestone' then p_item_id end,
         task_id=case when v_type='task' then p_item_id end,
         ovr_report_id=case when v_type='ovr' then p_item_id end,
         audit_finding_id=case when v_type='audit_finding' then p_item_id end,
         risk_id=case when v_type='risk' then p_item_id end,
         compliance_item_id=case when v_type='compliance' then p_item_id end,
         updated_by=p_actor_id
   where id=p_evidence_file_id;
  perform set_config('f1r2.verified_evidence_actor_id','',true);
  perform set_config('f1r2.evidence_relink_reason','',true);
  perform set_config('f1r2.force_evidence_relink','',true);

  if v_is_reconciliation then
    insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
    values(v_actor.organization_id,p_actor_id,'f1r2_evidence_reconciliation_resolved','evidence_files',v_evidence.id,
      jsonb_build_object(
        'reconciliation_reason',v_reconciliation.reason,
        'detected_at',v_reconciliation.detected_at,
        'resolved_at',v_reconciliation.resolved_at,
        'active_canonical_parent_count',0
      ),
      jsonb_build_object(
        'parent_type',v_type,'parent_id',p_item_id,'reason',v_reason,
        'resolved_at',v_now,'active_canonical_parent_count',1
      ));
  end if;

  return jsonb_build_object(
    'evidence_file_id',p_evidence_file_id,
    'linked_item_type',v_type,
    'linked_item_id',p_item_id,
    'relinked_by',p_actor_id,
    'reconciliation_resolved',v_is_reconciliation,
    'replayed',false
  );
end;
$$;

create or replace function public.f1r2_sync_evidence_link()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare
  v_type text; v_id uuid; v_count integer; v_required_closure boolean:=false; v_required_approval boolean:=false;
  v_old_type text; v_old_id uuid; v_actor_id uuid; v_linked_by uuid; v_relink_reason text;
begin
  if tg_op='UPDATE' and row(new.project_id,new.milestone_id,new.task_id,new.ovr_report_id,new.audit_finding_id,new.risk_id,new.compliance_item_id)
     is not distinct from
     row(old.project_id,old.milestone_id,old.task_id,old.ovr_report_id,old.audit_finding_id,old.risk_id,old.compliance_item_id)
     and coalesce(current_setting('f1r2.force_evidence_relink',true),'')<>'true'
  then
    return new;
  end if;
  if tg_op='UPDATE' then
    v_actor_id:=nullif(current_setting('f1r2.verified_evidence_actor_id',true),'')::uuid;
    v_relink_reason:=nullif(current_setting('f1r2.evidence_relink_reason',true),'');
  end if;
  v_linked_by:=coalesce(v_actor_id,new.created_by,new.uploaded_by);
  v_count:=num_nonnulls(new.project_id,new.milestone_id,new.task_id,new.ovr_report_id,new.audit_finding_id,new.risk_id,new.compliance_item_id);
  select l.linked_item_type,l.linked_item_id into v_old_type,v_old_id
  from public.evidence_links l
  where l.evidence_file_id=new.id and l.organization_id=new.organization_id and l.is_primary=true and l.is_active=true
  order by l.linked_at desc,l.id desc limit 1;
  -- Relinking is authoritative: retire every prior canonical parent before
  -- accepting a replacement.  An ambiguous row therefore has no usable link.
  update public.evidence_links
     set is_active=false
   where evidence_file_id=new.id and organization_id=new.organization_id
     and is_primary=true and is_active=true;
  if v_count<>1 then
    insert into public.f1r2_evidence_link_reconciliation(evidence_file_id,organization_id,reason)
    values(new.id,new.organization_id,'ambiguous_parent_count_'||v_count)
    on conflict(evidence_file_id) do update set reason=excluded.reason,detected_at=statement_timestamp(),resolved_at=null;
    insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
    values(new.organization_id,v_actor_id,'f1r2_evidence_link_reconciliation_required','evidence_files',new.id,
      case when v_old_id is null then null else jsonb_build_object('parent_type',v_old_type,'parent_id',v_old_id) end,
      jsonb_build_object('canonical_link_suspended',true,'parent_candidate_count',v_count,'reconciliation_required',true));
    return new;
  end if;
  v_type:=case when new.project_id is not null then 'project' when new.milestone_id is not null then 'milestone' when new.task_id is not null then 'task' when new.ovr_report_id is not null then 'ovr' when new.audit_finding_id is not null then 'audit_finding' when new.risk_id is not null then 'risk' else 'compliance' end;
  v_id:=coalesce(new.project_id,new.milestone_id,new.task_id,new.ovr_report_id,new.audit_finding_id,new.risk_id,new.compliance_item_id);
  select f.required_for_closure,f.required_for_approval into strict v_required_closure,v_required_approval
  from public.f1r2_evidence_requirement_flags(new.organization_id,v_type,v_id) f;
  insert into public.evidence_links(organization_id,evidence_file_id,linked_item_type,linked_item_id,linked_item_title,link_reason,is_primary,required_for_closure,required_for_approval,linked_by)
  values(new.organization_id,new.id,v_type,v_id,coalesce(new.evidence_title,new.file_name),case when tg_op='UPDATE' then coalesce(v_relink_reason,'governed canonical relink') else 'canonical upload parent' end,true,v_required_closure,v_required_approval,v_linked_by)
  on conflict(organization_id,evidence_file_id,linked_item_type,linked_item_id) do update
    set is_active=true,is_primary=true,linked_item_title=excluded.linked_item_title,
        required_for_closure=excluded.required_for_closure,required_for_approval=excluded.required_for_approval,
        link_reason=excluded.link_reason,linked_by=excluded.linked_by,linked_at=statement_timestamp();
  if v_old_id is not null and (v_old_type,v_old_id) is distinct from (v_type,v_id) then
    insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
    values(new.organization_id,v_actor_id,'f1r2_evidence_relinked','evidence_files',new.id,
      jsonb_build_object('parent_type',v_old_type,'parent_id',v_old_id),
      jsonb_build_object('parent_type',v_type,'parent_id',v_id,'reason',v_relink_reason,'relinked_at',statement_timestamp()));
  end if;
  delete from public.f1r2_evidence_link_reconciliation where evidence_file_id=new.id;
  return new;
exception when no_data_found or too_many_rows then
  insert into public.f1r2_evidence_link_reconciliation(evidence_file_id,organization_id,reason)
  values(new.id,new.organization_id,'canonical_parent_not_unique_or_wrong_organization')
  on conflict(evidence_file_id) do update set reason=excluded.reason,detected_at=statement_timestamp(),resolved_at=null;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
  values(new.organization_id,v_actor_id,'f1r2_evidence_link_reconciliation_required','evidence_files',new.id,
    case when v_old_id is null then null else jsonb_build_object('parent_type',v_old_type,'parent_id',v_old_id) end,
    jsonb_build_object('canonical_link_suspended',true,'reason','canonical_parent_not_unique_or_wrong_organization','reconciliation_required',true));
  return new;
end $$;
drop trigger if exists trg_f1r2_guard_evidence_parent_change on public.evidence_files;
create trigger trg_f1r2_guard_evidence_parent_change
before update of project_id,milestone_id,task_id,ovr_report_id,audit_finding_id,risk_id,compliance_item_id on public.evidence_files
for each row execute function public.f1r2_guard_evidence_parent_change();
drop trigger if exists trg_f1r2_sync_evidence_link on public.evidence_files;
create trigger trg_f1r2_sync_evidence_link after insert or update of project_id,milestone_id,task_id,ovr_report_id,audit_finding_id,risk_id,compliance_item_id on public.evidence_files for each row execute function public.f1r2_sync_evidence_link();

update public.evidence_links l
set is_active=false
where l.is_primary=true and l.is_active=true
  and exists(select 1 from public.evidence_files e where e.id=l.evidence_file_id);

insert into public.evidence_links(organization_id,evidence_file_id,linked_item_type,linked_item_id,linked_item_title,link_reason,is_primary,required_for_closure,required_for_approval,linked_by)
select e.organization_id,e.id,x.item_type,x.item_id,coalesce(e.evidence_title,e.file_name),'migration 196 canonical backfill',true,
  f.required_for_closure,f.required_for_approval,
  coalesce(e.created_by,e.uploaded_by)
from public.evidence_files e
cross join lateral (values(
  case when e.project_id is not null then 'project' when e.milestone_id is not null then 'milestone' when e.task_id is not null then 'task' when e.ovr_report_id is not null then 'ovr' when e.audit_finding_id is not null then 'audit_finding' when e.risk_id is not null then 'risk' when e.compliance_item_id is not null then 'compliance' end,
  coalesce(e.project_id,e.milestone_id,e.task_id,e.ovr_report_id,e.audit_finding_id,e.risk_id,e.compliance_item_id)
)) x(item_type,item_id)
cross join lateral public.f1r2_evidence_requirement_flags(e.organization_id,x.item_type,x.item_id) f
where num_nonnulls(e.project_id,e.milestone_id,e.task_id,e.ovr_report_id,e.audit_finding_id,e.risk_id,e.compliance_item_id)=1
on conflict(organization_id,evidence_file_id,linked_item_type,linked_item_id) do update
  set is_active=true,is_primary=true,required_for_closure=excluded.required_for_closure,
      required_for_approval=excluded.required_for_approval,link_reason=excluded.link_reason;

create unique index if not exists uq_f1r2_one_active_primary_evidence_link
on public.evidence_links(evidence_file_id)
where is_active=true and is_primary=true;

insert into public.f1r2_evidence_link_reconciliation(evidence_file_id,organization_id,reason)
select e.id,e.organization_id,'ambiguous_parent_count_'||num_nonnulls(e.project_id,e.milestone_id,e.task_id,e.ovr_report_id,e.audit_finding_id,e.risk_id,e.compliance_item_id)
from public.evidence_files e
where num_nonnulls(e.project_id,e.milestone_id,e.task_id,e.ovr_report_id,e.audit_finding_id,e.risk_id,e.compliance_item_id)<>1
on conflict(evidence_file_id) do nothing;

insert into public.f1r2_evidence_link_reconciliation(evidence_file_id,organization_id,reason)
select e.id,e.organization_id,'canonical_parent_not_unique_or_wrong_organization'
from public.evidence_files e
where num_nonnulls(e.project_id,e.milestone_id,e.task_id,e.ovr_report_id,e.audit_finding_id,e.risk_id,e.compliance_item_id)=1
  and not exists(select 1 from public.evidence_links l where l.evidence_file_id=e.id and l.is_active=true and l.is_primary=true)
on conflict(evidence_file_id) do update set reason=excluded.reason,detected_at=statement_timestamp(),resolved_at=null;

create or replace function public.f1r2_work_item_contains(
  p_parent_type text,p_parent_id uuid,p_child_type text,p_child_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $$
  select case lower(btrim(coalesce(p_parent_type,'')))
    when 'project' then case lower(btrim(coalesce(p_child_type,'')))
      when 'project' then p_child_id=p_parent_id
      when 'milestone' then exists(select 1 from public.milestones m where m.id=p_child_id and m.project_id=p_parent_id)
      when 'task' then exists(select 1 from public.tasks t where t.id=p_child_id and t.project_id=p_parent_id)
      else false end
    when 'milestone' then case lower(btrim(coalesce(p_child_type,'')))
      when 'milestone' then p_child_id=p_parent_id
      when 'task' then exists(select 1 from public.tasks t where t.id=p_child_id and t.milestone_id=p_parent_id)
      else false end
    when 'task' then lower(btrim(coalesce(p_child_type,'')))='task' and p_child_id=p_parent_id
    else false end
$$;

create or replace function public.f1r2_actor_has_work_evidence_entitlement(
  p_actor_id uuid,p_item_type text,p_item_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare v_actor public.profiles%rowtype; v_project public.projects%rowtype;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  v_project:=public.f1r2_resolve_project(p_item_type,p_item_id);
  if v_project.id is null or v_project.organization_id<>v_actor.organization_id then return false; end if;
  return public.f1r2_actor_can_manage_item(p_actor_id,p_item_type,p_item_id)
    or exists(
      select 1 from public.work_item_assignments a
      where a.organization_id=v_actor.organization_id and a.assignee_id=p_actor_id
        and a.status in('accepted','legacy_unverified')
        and public.f1r2_work_item_contains(a.item_type,a.item_id,p_item_type,p_item_id)
    )
    or exists(
      select 1 from public.approvals a
      where a.organization_id=v_actor.organization_id and a.approver_id=p_actor_id
        -- Approval participants retain read-only evidence access after an
        -- immutable approved/rejected decision for audit reconstruction.
        and a.status::text in('pending','approved','rejected')
        and (
          (a.project_id is not null and public.f1r2_work_item_contains('project',a.project_id,p_item_type,p_item_id))
          or (a.milestone_id is not null and public.f1r2_work_item_contains('milestone',a.milestone_id,p_item_type,p_item_id))
          or (a.task_id is not null and public.f1r2_work_item_contains('task',a.task_id,p_item_type,p_item_id))
        )
    );
end $$;

create or replace function public.f1r2_actor_has_ovr_evidence_entitlement(p_actor_id uuid,p_ovr_report_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare v_actor public.profiles%rowtype; v_ovr public.ovr_reports%rowtype;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  select * into v_ovr from public.ovr_reports where id=p_ovr_report_id;
  if not found or v_ovr.organization_id<>v_actor.organization_id then return false; end if;
  return coalesce(p_actor_id in(v_ovr.reported_by,v_ovr.owner_id,v_ovr.supervisor_id,v_ovr.quality_reviewer_id),false)
    or public.f1r2_actor_scope_allows_context(
      p_actor_id,v_ovr.organization_id,v_ovr.division_id,v_ovr.department_id,v_ovr.unit_id,
      array['super_admin','governance_admin','compliance_officer','auditor']
    );
end $$;

create or replace function public.f1r2_get_evidence_pack(p_actor_id uuid,p_item_type text,p_item_id uuid)
returns table(evidence_file_id uuid,evidence_code text,evidence_title text,file_name text,status text,sensitivity_level text,reviewer_name text,reviewed_at timestamptz,linked_item_type text,linked_item_id uuid,required_for_closure boolean,required_for_approval boolean)
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_actor public.profiles%rowtype; v_project public.projects%rowtype; v_type text:=lower(btrim(coalesce(p_item_type,''))); v_ovr public.ovr_reports%rowtype;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_type='ovr' then
    select * into v_ovr from public.ovr_reports where id=p_item_id;
    if not found or not public.f1r2_actor_has_ovr_evidence_entitlement(p_actor_id,p_item_id) then raise exception 'F1R2_EVIDENCE_PACK_DENIED'; end if;
  else
    v_project:=public.f1r2_resolve_project(v_type,p_item_id);
    if v_project.id is null or v_project.organization_id<>v_actor.organization_id or not public.f1r2_actor_has_work_evidence_entitlement(p_actor_id,v_type,p_item_id) then raise exception 'F1R2_EVIDENCE_PACK_DENIED'; end if;
  end if;
  return query
  select distinct e.id,e.evidence_code,e.evidence_title,e.file_name,coalesce(e.review_status,e.status::text),e.sensitivity_level,r.full_name_en,e.reviewed_at,l.linked_item_type,l.linked_item_id,f.required_for_closure,f.required_for_approval
  from public.evidence_links l join public.evidence_files e on e.id=l.evidence_file_id and e.is_current_version=true left join public.profiles r on r.id=coalesce(e.reviewer_id,e.reviewed_by)
  cross join lateral public.f1r2_evidence_requirement_flags(l.organization_id,l.linked_item_type,l.linked_item_id) f
  where l.is_active=true and l.organization_id=v_actor.organization_id and (
    (v_type in('project','milestone','task')
      and public.f1r2_work_item_contains(v_type,p_item_id,l.linked_item_type,l.linked_item_id)
      and public.f1r2_actor_has_work_evidence_entitlement(p_actor_id,l.linked_item_type,l.linked_item_id))
    or (v_type='ovr' and l.linked_item_type='ovr' and l.linked_item_id=p_item_id
      and public.f1r2_actor_has_ovr_evidence_entitlement(p_actor_id,p_item_id))
    or (v_type='ovr' and v_ovr.linked_project_id is not null
      and public.f1r2_work_item_contains('project',v_ovr.linked_project_id,l.linked_item_type,l.linked_item_id)
      and public.f1r2_actor_has_work_evidence_entitlement(p_actor_id,l.linked_item_type,l.linked_item_id))
  );
end $$;

create or replace function public.can_close_ovr(p_ovr_report_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
  select exists(
    select 1 from public.ovr_reports o join public.projects p on p.id=o.linked_project_id and p.organization_id=o.organization_id
    where o.id=p_ovr_report_id and p.status='closed' and p.progress_percent=100
      and public.f1r2_can_close_work_item('project',p.id)
      and public.f1r2_item_evidence_satisfied(o.organization_id,'ovr',o.id,o.evidence_required)
      and o.status in('corrective_action_in_progress','reopened','quality_final_review')
  )
$$;

create or replace function public.f1r2_guard_corrective_ovr_final_verdict()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
begin
  if new.linked_project_id is not null
     and new.status='quality_final_review'
     and (old.status is distinct from new.status or old.final_verdict is distinct from new.final_verdict)
     and not public.can_close_ovr(new.id)
  then
    raise exception 'F1R2_OVR_CLOSURE_PREREQUISITES_NOT_MET';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_f1r2_guard_corrective_ovr_final_verdict on public.ovr_reports;
create trigger trg_f1r2_guard_corrective_ovr_final_verdict
before update of status,final_verdict on public.ovr_reports
for each row execute function public.f1r2_guard_corrective_ovr_final_verdict();

create or replace function public.f1r2_finalize_corrective_ovr(p_actor_id uuid,p_ovr_report_id uuid,p_final_verdict text,p_final_severity public.ovr_severity_level,p_closure_comment text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_actor public.profiles%rowtype; v_ovr public.ovr_reports%rowtype; v_now timestamptz:=statement_timestamp(); v_key text:=nullif(btrim(p_idempotency_key),''); v_old_status text;
begin
  v_actor:=public.f1r2_active_actor(p_actor_id);
  if v_key is null or length(v_key)>200 then raise exception 'F1R2_IDEMPOTENCY_KEY_REQUIRED'; end if;
  if nullif(btrim(p_final_verdict),'') is null or nullif(btrim(p_closure_comment),'') is null or p_final_severity is null then raise exception 'F1R2_FINAL_VERDICT_FIELDS_REQUIRED'; end if;
  select * into v_ovr from public.ovr_reports where id=p_ovr_report_id for update;
  if not found or v_ovr.organization_id<>v_actor.organization_id then raise exception 'F1R2_OVR_NOT_FOUND'; end if;
  if v_ovr.status='quality_final_review' and v_ovr.final_verdict=p_final_verdict then return jsonb_build_object('id',v_ovr.id,'status','quality_final_review','final_verdict_at',v_ovr.final_verdict_at,'replayed',true); end if;
  if v_ovr.status not in('corrective_action_in_progress','reopened') then raise exception 'F1R2_CORRECTIVE_CLOSURE_STATE_REQUIRED'; end if;
  v_old_status:=v_ovr.status;
  if not public.f1r2_actor_scope_allows_context(p_actor_id,v_ovr.organization_id,v_ovr.division_id,v_ovr.department_id,v_ovr.unit_id,array['super_admin','governance_admin','compliance_officer']) then raise exception 'F1R2_QUALITY_CLOSURE_AUTHORITY_REQUIRED'; end if;
  if not public.can_close_ovr(p_ovr_report_id) then raise exception 'F1R2_OVR_CLOSURE_PREREQUISITES_NOT_MET'; end if;
  if exists(select 1 from public.audit_logs a where a.organization_id=v_actor.organization_id and a.action='f1r2_ovr_final_verdict' and a.record_id=p_ovr_report_id and a.new_data->>'idempotency_key'=v_key) then raise exception 'F1R2_IDEMPOTENCY_CONFLICT'; end if;
  update public.ovr_reports
     set status='quality_final_review',final_verdict=btrim(p_final_verdict),final_quality_classification=btrim(p_final_verdict),
         final_verdict_at=v_now,final_severity_level=p_final_severity,quality_manager_comments=btrim(p_closure_comment),
         quality_closed_by=p_actor_id,closure_ready_at=v_now,closed_by=null,closed_at=null,updated_by=p_actor_id
   where id=p_ovr_report_id returning * into v_ovr;
  insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data)
  values(v_actor.organization_id,p_actor_id,'f1r2_ovr_final_verdict','ovr_reports',p_ovr_report_id,
    jsonb_build_object('status',v_old_status),
    jsonb_build_object('status','quality_final_review','idempotency_key',v_key,'final_severity',p_final_severity,'verdict_recorded',true,'reporter_decision_required',true));
  return jsonb_build_object('id',v_ovr.id,'status',v_ovr.status,'final_verdict',v_ovr.final_verdict,'final_verdict_at',v_ovr.final_verdict_at,'closed_at',v_ovr.closed_at,'closed_by',v_ovr.closed_by,'reporter_decision_required',true,'replayed',false);
end $$;

-- Correct the non-OVR evidence access boolean and include exact assignment/approval relationships.
create or replace function public.acc_v13_authorize_evidence_access(p_actor_id uuid,p_evidence_file_id uuid,p_intent text default 'view')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_actor public.profiles%rowtype; v_evidence public.evidence_files%rowtype; v_allowed boolean:=false; v_intent text:=lower(btrim(coalesce(p_intent,'view')));
begin
  v_actor:=public.f1r2_active_actor(p_actor_id); if v_intent not in('view','download') then raise exception 'F1R2_EVIDENCE_INTENT_INVALID'; end if;
  select * into v_evidence from public.evidence_files where id=p_evidence_file_id;
  if not found or v_evidence.organization_id<>v_actor.organization_id then raise exception 'F1R2_EVIDENCE_NOT_FOUND'; end if;
  select coalesce(p_actor_id in(v_evidence.uploaded_by,v_evidence.reviewed_by,v_evidence.evidence_owner_id,v_evidence.reviewer_id),false)
    or exists(
      select 1 from public.evidence_links l
      where l.evidence_file_id=v_evidence.id and l.organization_id=v_actor.organization_id and l.is_active=true
        and (
          (l.linked_item_type in('project','milestone','task') and public.f1r2_actor_has_work_evidence_entitlement(p_actor_id,l.linked_item_type,l.linked_item_id))
          or (l.linked_item_type='ovr' and public.f1r2_actor_has_ovr_evidence_entitlement(p_actor_id,l.linked_item_id))
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
revoke all on function public.f1r2_lock_work_item(text,uuid) from public,anon,authenticated;
revoke all on function public.f1r2_assign_work_item(uuid,text,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.f1r2_respond_work_item_assignment(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.f1r2_cancel_work_item_assignment(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.f1r2_list_my_work(uuid) from public,anon,authenticated;
revoke all on function public.f1r2_list_item_participants(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.f1r2_list_project_assignments(uuid,uuid) from public,anon,authenticated;
revoke all on function public.f1r2_search_eligible_participants(uuid,text,uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.f1r2_create_work_item(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.f1r2_create_ovr_report(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.f1r2_create_corrective_project(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.f1r2_decide_approval(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.f1r2_get_evidence_pack(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.f1r2_relink_evidence_parent(uuid,uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.f1r2_finalize_corrective_ovr(uuid,uuid,text,public.ovr_severity_level,text,text) from public,anon,authenticated;
revoke all on function public.acc_v13_update_work_item_status(uuid,text,uuid,text,numeric,text) from public,anon,authenticated;
revoke all on function public.acc_v13_authorize_evidence_access(uuid,uuid,text) from public,anon,authenticated;

grant execute on function public.f1r2_assert_service_role() to service_role;
grant execute on function public.f1r2_active_actor(uuid) to service_role;
grant execute on function public.f1r2_resolve_project(text,uuid) to service_role;
grant execute on function public.f1r2_current_assignment(text,uuid) to service_role;
grant execute on function public.f1r2_actor_can_manage_item(uuid,text,uuid) to service_role;
grant execute on function public.f1r2_lock_work_item(text,uuid) to service_role;
grant execute on function public.f1r2_assign_work_item(uuid,text,uuid,uuid,text) to service_role;
grant execute on function public.f1r2_respond_work_item_assignment(uuid,uuid,text,text) to service_role;
grant execute on function public.f1r2_cancel_work_item_assignment(uuid,uuid,text) to service_role;
grant execute on function public.f1r2_list_my_work(uuid) to service_role;
grant execute on function public.f1r2_list_item_participants(uuid,text,uuid) to service_role;
grant execute on function public.f1r2_list_project_assignments(uuid,uuid) to service_role;
grant execute on function public.f1r2_search_eligible_participants(uuid,text,uuid,text,text,integer) to service_role;
grant execute on function public.f1r2_create_work_item(uuid,text,jsonb) to service_role;
grant execute on function public.f1r2_create_ovr_report(uuid,jsonb) to service_role;
grant execute on function public.f1r2_create_corrective_project(uuid,jsonb) to service_role;
grant execute on function public.f1r2_decide_approval(uuid,uuid,text,text) to service_role;
grant execute on function public.f1r2_get_evidence_pack(uuid,text,uuid) to service_role;
grant execute on function public.f1r2_relink_evidence_parent(uuid,uuid,text,uuid,text) to service_role;
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
revoke execute on function public.f1r2_guard_evidence_parent_change() from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_evidence_requirement_flags(uuid,text,uuid) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_guard_corrective_ovr_final_verdict() from public,anon,authenticated,service_role;
revoke execute on function public.can_close_ovr(uuid) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_actor_scope_allows_context(uuid,uuid,uuid,uuid,uuid,text[]) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_assignment_candidate_is_eligible(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_latest_approval_satisfied(text,uuid,boolean) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_item_evidence_satisfied(uuid,text,uuid,boolean) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_can_close_work_item(text,uuid) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_work_item_contains(text,uuid,text,uuid) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_actor_has_work_evidence_entitlement(uuid,text,uuid) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_actor_has_ovr_evidence_entitlement(uuid,uuid) from public,anon,authenticated,service_role;
revoke execute on function public.f1r2_actor_can_mutate_evidence_parent(uuid,text,uuid) from public,anon,authenticated,service_role;

comment on table public.work_item_assignments is 'F1-R2 canonical immutable assignment history for projects, milestones, and tasks.';
comment on function public.f1r2_finalize_corrective_ovr(uuid,uuid,text,public.ovr_severity_level,text,text) is 'F1-R2 Quality final-verdict path from corrective_action_in_progress; reporter acceptance or dispute remains mandatory.';
comment on function public.f1r2_relink_evidence_parent(uuid,uuid,text,uuid,text) is 'F1-R2 protected canonical evidence-parent relink with verified actor context and one authoritative audit event.';
comment on column public.tasks.owner_id is 'Accountable task owner; distinct from the execution assignee when assigned_to differs.';
comment on column public.tasks.assigned_to is 'Accepted execution assignee; pending proposals remain only in work_item_assignments.';

commit;
