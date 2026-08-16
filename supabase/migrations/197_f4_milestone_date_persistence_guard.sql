begin;

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
      if v_start is null or v_due is null then raise exception 'F1R2_MILESTONE_DATES_REQUIRED'; end if;
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

revoke all on function public.f1r2_create_work_item(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.f1r2_create_work_item(uuid,text,jsonb) to service_role;

commit;
