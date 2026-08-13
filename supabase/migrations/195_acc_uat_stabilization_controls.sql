-- ACC UAT stabilization controls (ACC-05 through ACC-08).
-- Source-only until separately reviewed and authorized for a hosted rollout.

create or replace function public.acc_v13_actor_can_control_project(
  p_actor_id uuid,
  p_project public.projects
)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    coalesce(p_actor_id in (p_project.owner_id, p_project.sponsor_id, p_project.created_by), false)
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p_actor_id
        and ur.is_active = true
        and ur.role::text in ('super_admin','executive','governance_admin','division_head','department_manager')
        and (ur.organization_id is null or ur.organization_id = p_project.organization_id)
        and (
          ur.scope::text = 'global'
          or (ur.scope::text = 'division' and ur.division_id = p_project.division_id)
          or (ur.scope::text = 'department' and ur.department_id = p_project.department_id)
          or (ur.scope::text = 'unit' and ur.unit_id = p_project.unit_id)
        )
    );
$$;

revoke all on function public.acc_v13_actor_can_control_project(uuid, public.projects) from public, anon, authenticated;
grant execute on function public.acc_v13_actor_can_control_project(uuid, public.projects) to service_role;

drop policy if exists milestones_acc_v13_parent_project_control on public.milestones;
drop policy if exists milestones_acc_v13_parent_project_read on public.milestones;
create policy milestones_acc_v13_parent_project_read on public.milestones
for select to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and p.organization_id = milestones.organization_id
      and auth.uid() in (p.owner_id, p.sponsor_id, p.created_by)
  )
);

drop policy if exists milestones_acc_v13_parent_project_insert on public.milestones;
create policy milestones_acc_v13_parent_project_insert on public.milestones
for insert to authenticated
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and p.organization_id = milestones.organization_id
      and auth.uid() in (p.owner_id, p.sponsor_id, p.created_by)
  )
);

drop policy if exists tasks_acc_v13_parent_project_control on public.tasks;
drop policy if exists tasks_acc_v13_parent_project_read on public.tasks;
create policy tasks_acc_v13_parent_project_read on public.tasks
for select to authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and p.organization_id = tasks.organization_id
      and auth.uid() in (p.owner_id, p.sponsor_id, p.created_by)
  )
);

drop policy if exists tasks_acc_v13_parent_project_insert on public.tasks;
create policy tasks_acc_v13_parent_project_insert on public.tasks
for insert to authenticated
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and p.organization_id = tasks.organization_id
      and auth.uid() in (p.owner_id, p.sponsor_id, p.created_by)
  )
);

create or replace view public.v_my_open_work_expanded
with (security_invoker = true)
as
select
  p.id,
  p.organization_id,
  'project'::text as item_type,
  p.title,
  p.target_end_date as due_date,
  p.status::text as status,
  p.progress_percent,
  p.owner_id,
  null::uuid as assigned_to,
  p.id as project_id,
  null::uuid as milestone_id,
  p.title as project_title,
  d.name_en as department_name
from public.projects p
left join public.departments d on d.id = p.department_id
where p.status not in ('closed', 'cancelled')
  and auth.uid() in (p.owner_id, p.sponsor_id, p.created_by)
union all
select
  t.id, t.organization_id, 'task'::text, t.title, t.due_date,
  t.status::text, t.progress_percent, t.owner_id, t.assigned_to,
  t.project_id, t.milestone_id, p.title, d.name_en
from public.tasks t
join public.projects p on p.id = t.project_id
left join public.departments d on d.id = p.department_id
where t.status not in ('closed', 'cancelled', 'approved')
  and auth.uid() in (t.assigned_to, t.owner_id)
union all
select
  m.id, m.organization_id, 'milestone'::text, m.title, m.due_date,
  m.status::text, m.progress_percent, m.owner_id, null::uuid,
  m.project_id, null::uuid, p.title, d.name_en
from public.milestones m
join public.projects p on p.id = m.project_id
left join public.departments d on d.id = p.department_id
where m.status not in ('closed', 'cancelled', 'approved')
  and m.owner_id = auth.uid();

create or replace function public.acc_v13_update_work_item_status(
  p_actor_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_status text,
  p_progress_percent numeric,
  p_delay_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_project public.projects%rowtype;
  v_milestone public.milestones%rowtype;
  v_task public.tasks%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_item_type text := lower(trim(coalesce(p_item_type, '')));
  v_delay_reason text := nullif(trim(coalesce(p_delay_reason, '')), '');
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'ACC_V13_SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_actor from public.profiles
  where id = p_actor_id and is_active = true and user_status::text = 'active';
  if not found or v_actor.organization_id is null then
    raise exception 'ACC_V13_ACTIVE_ACTOR_REQUIRED';
  end if;
  if exists (
    select 1 from public.user_credential_states cs
    where cs.user_id = p_actor_id and cs.credential_state::text <> 'active'
  ) then
    raise exception 'ACC_V13_ACTIVE_CREDENTIAL_REQUIRED';
  end if;
  if p_progress_percent is null or p_progress_percent < 0 or p_progress_percent > 100 then
    raise exception 'ACC_V13_PROGRESS_OUT_OF_RANGE';
  end if;
  if p_status = 'delayed' and v_delay_reason is null then
    raise exception 'ACC_V13_DELAY_REASON_REQUIRED';
  end if;

  if v_item_type = 'project' then
    if p_status not in ('draft','pending_approval','active','at_risk','delayed','completed_pending_evidence','completed_pending_approval','closed','cancelled') then
      raise exception 'ACC_V13_INVALID_PROJECT_STATUS';
    end if;
    select * into v_project from public.projects where id = p_item_id for update;
    if not found or v_project.organization_id <> v_actor.organization_id then
      raise exception 'ACC_V13_WORK_ITEM_NOT_FOUND';
    end if;
    if not public.acc_v13_actor_can_control_project(p_actor_id, v_project) then
      raise exception 'ACC_V13_WORK_ITEM_NOT_AUTHORIZED';
    end if;
    v_old := to_jsonb(v_project);
    update public.projects
       set status = p_status::public.project_status,
           progress_percent = p_progress_percent,
           delay_reason = case when p_status = 'delayed' then v_delay_reason else null end,
           updated_by = p_actor_id
     where id = p_item_id
     returning to_jsonb(projects) into v_new;
  elsif v_item_type = 'milestone' then
    if p_status not in ('not_started','in_progress','at_risk','delayed','evidence_submitted','approved','rejected','closed','cancelled') then
      raise exception 'ACC_V13_INVALID_WORK_STATUS';
    end if;
    select * into v_milestone from public.milestones where id = p_item_id for update;
    select * into v_project from public.projects where id = v_milestone.project_id;
    if v_milestone.id is null or v_project.organization_id <> v_actor.organization_id then
      raise exception 'ACC_V13_WORK_ITEM_NOT_FOUND';
    end if;
    if p_actor_id <> v_milestone.owner_id and not public.acc_v13_actor_can_control_project(p_actor_id, v_project) then
      raise exception 'ACC_V13_WORK_ITEM_NOT_AUTHORIZED';
    end if;
    v_old := to_jsonb(v_milestone);
    update public.milestones
       set status = p_status::public.work_status,
           progress_percent = p_progress_percent,
           delay_reason = case when p_status = 'delayed' then v_delay_reason else null end,
           updated_by = p_actor_id
     where id = p_item_id
     returning to_jsonb(milestones) into v_new;
  elsif v_item_type = 'task' then
    if p_status not in ('not_started','in_progress','at_risk','delayed','evidence_submitted','approved','rejected','closed','cancelled') then
      raise exception 'ACC_V13_INVALID_WORK_STATUS';
    end if;
    select * into v_task from public.tasks where id = p_item_id for update;
    select * into v_project from public.projects where id = v_task.project_id;
    if v_task.id is null or v_project.organization_id <> v_actor.organization_id then
      raise exception 'ACC_V13_WORK_ITEM_NOT_FOUND';
    end if;
    if p_actor_id not in (v_task.owner_id, v_task.assigned_to)
       and not public.acc_v13_actor_can_control_project(p_actor_id, v_project) then
      raise exception 'ACC_V13_WORK_ITEM_NOT_AUTHORIZED';
    end if;
    v_old := to_jsonb(v_task);
    update public.tasks
       set status = p_status::public.work_status,
           progress_percent = p_progress_percent,
           delay_reason = case when p_status = 'delayed' then v_delay_reason else null end,
           updated_by = p_actor_id
     where id = p_item_id
     returning to_jsonb(tasks) into v_new;
  else
    raise exception 'ACC_V13_UNSUPPORTED_WORK_ITEM_TYPE';
  end if;

  insert into public.audit_logs (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (v_actor.organization_id, p_actor_id, 'acc_v13_status_update', v_item_type, p_item_id, v_old, v_new);

  return jsonb_build_object(
    'item_type', v_item_type,
    'item_id', p_item_id,
    'status', p_status,
    'progress_percent', p_progress_percent
  );
end;
$$;

revoke all on function public.acc_v13_update_work_item_status(uuid, text, uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.acc_v13_update_work_item_status(uuid, text, uuid, text, numeric, text) to service_role;

create or replace function public.acc_v13_resolve_approval_project(
  p_item_type text,
  p_item_id uuid
)
returns public.projects
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_item_type text := lower(trim(coalesce(p_item_type, '')));
begin
  if v_item_type = 'project' then
    select * into v_project from public.projects where id = p_item_id;
  elsif v_item_type = 'milestone' then
    select p.* into v_project
    from public.milestones m
    join public.projects p on p.id = m.project_id and p.organization_id = m.organization_id
    where m.id = p_item_id;
  elsif v_item_type = 'task' then
    select p.* into v_project
    from public.tasks t
    join public.projects p on p.id = t.project_id and p.organization_id = t.organization_id
    where t.id = p_item_id;
  end if;
  return v_project;
end;
$$;

create or replace function public.acc_v13_actor_can_request_approval(
  p_actor_id uuid,
  p_item_type text,
  p_item_id uuid
)
returns boolean
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_item_type text := lower(trim(coalesce(p_item_type, '')));
begin
  v_project := public.acc_v13_resolve_approval_project(v_item_type, p_item_id);
  if v_project.id is null then
    return false;
  end if;
  if v_item_type = 'project' then
    return public.acc_v13_actor_can_control_project(p_actor_id, v_project);
  elsif v_item_type = 'milestone' then
    return exists (
      select 1 from public.milestones m
      where m.id = p_item_id
        and m.organization_id = v_project.organization_id
        and (
          m.owner_id = p_actor_id
          or public.acc_v13_actor_can_control_project(p_actor_id, v_project)
        )
    );
  elsif v_item_type = 'task' then
    return exists (
      select 1 from public.tasks t
      where t.id = p_item_id
        and t.organization_id = v_project.organization_id
        and (
          p_actor_id in (t.owner_id, t.assigned_to)
          or public.acc_v13_actor_can_control_project(p_actor_id, v_project)
        )
    );
  end if;
  return false;
end;
$$;

create or replace function public.acc_v13_is_eligible_approver(
  p_requester_id uuid,
  p_approver_id uuid,
  p_item_type text,
  p_item_id uuid
)
returns boolean
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_item_type text := lower(trim(coalesce(p_item_type, '')));
begin
  if p_requester_id is null or p_approver_id is null or p_requester_id = p_approver_id then
    return false;
  end if;
  v_project := public.acc_v13_resolve_approval_project(v_item_type, p_item_id);
  if v_project.id is null or not public.acc_v13_actor_can_request_approval(p_requester_id, v_item_type, p_item_id) then
    return false;
  end if;
  if not exists (
    select 1 from public.profiles ap
    where ap.id = p_approver_id
      and ap.organization_id = v_project.organization_id
      and ap.is_active = true
      and ap.user_status::text = 'active'
  ) then
    return false;
  end if;

  return coalesce((
    (v_item_type = 'project' and p_approver_id = v_project.sponsor_id)
    or (v_item_type in ('milestone','task') and p_approver_id in (v_project.owner_id, v_project.sponsor_id))
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_approver_id
        and ur.organization_id = v_project.organization_id
        and ur.is_active = true
        and (
          (ur.role::text in ('super_admin','governance_admin','executive') and ur.scope::text = 'global')
          or (
            ur.role::text = 'division_head'
            and ur.scope::text = 'division'
            and v_project.division_id is not null
            and ur.division_id = v_project.division_id
          )
          or (
            ur.role::text = 'department_manager'
            and ur.scope::text = 'department'
            and v_project.department_id is not null
            and ur.department_id = v_project.department_id
          )
        )
    )
  ), false);
end;
$$;

create or replace function public.acc_v13_list_eligible_approvers(
  p_actor_id uuid,
  p_item_type text,
  p_item_id uuid
)
returns table (
  id uuid,
  full_name_en text,
  full_name_ar text
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_project public.projects%rowtype;
  v_item_type text := lower(trim(coalesce(p_item_type, '')));
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'ACC_V13_SERVICE_ROLE_REQUIRED';
  end if;
  select * into v_actor from public.profiles
  where profiles.id = p_actor_id
    and profiles.is_active = true
    and profiles.user_status::text = 'active';
  v_project := public.acc_v13_resolve_approval_project(v_item_type, p_item_id);
  if v_actor.id is null or v_project.id is null or v_actor.organization_id <> v_project.organization_id then
    raise exception 'ACC_V13_APPROVAL_ITEM_NOT_FOUND';
  end if;
  if not public.acc_v13_actor_can_request_approval(p_actor_id, v_item_type, p_item_id) then
    raise exception 'ACC_V13_APPROVAL_REQUESTER_NOT_AUTHORIZED';
  end if;

  return query
  select ap.id, ap.full_name_en, ap.full_name_ar
  from public.profiles ap
  where ap.organization_id = v_project.organization_id
    and ap.is_active = true
    and ap.user_status::text = 'active'
    and public.acc_v13_is_eligible_approver(p_actor_id, ap.id, v_item_type, p_item_id)
  order by ap.full_name_en, ap.id;
end;
$$;

create or replace function public.acc_v13_request_approval(
  p_actor_id uuid,
  p_organization_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_approver_id uuid,
  p_request_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_item_type text := lower(trim(coalesce(p_item_type, '')));
  v_approval public.approvals%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'ACC_V13_SERVICE_ROLE_REQUIRED';
  end if;
  v_project := public.acc_v13_resolve_approval_project(v_item_type, p_item_id);
  if v_project.id is null or v_project.organization_id <> p_organization_id then
    raise exception 'ACC_V13_APPROVAL_ITEM_NOT_FOUND';
  end if;
  if not public.acc_v13_actor_can_request_approval(p_actor_id, v_item_type, p_item_id) then
    raise exception 'ACC_V13_APPROVAL_REQUESTER_NOT_AUTHORIZED';
  end if;
  if not public.acc_v13_is_eligible_approver(p_actor_id, p_approver_id, v_item_type, p_item_id) then
    raise exception 'ACC_V13_APPROVER_NOT_ELIGIBLE';
  end if;

  insert into public.approvals (
    organization_id,
    project_id,
    milestone_id,
    task_id,
    requested_by,
    approver_id,
    status,
    request_note
  ) values (
    p_organization_id,
    case when v_item_type = 'project' then p_item_id else null end,
    case when v_item_type = 'milestone' then p_item_id else null end,
    case when v_item_type = 'task' then p_item_id else null end,
    p_actor_id,
    p_approver_id,
    'pending',
    nullif(trim(coalesce(p_request_note, '')), '')
  ) returning * into v_approval;

  insert into public.audit_logs (organization_id, actor_id, action, table_name, record_id, new_data)
  values (
    p_organization_id,
    p_actor_id,
    'acc_v13_approval_requested',
    'approvals',
    v_approval.id,
    jsonb_build_object('item_type', v_item_type, 'item_id', p_item_id, 'approver_id', p_approver_id)
  );

  return jsonb_build_object('id', v_approval.id, 'status', v_approval.status);
end;
$$;

create or replace function public.acc_v13_guard_approval_separation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_item_type text;
  v_item_id uuid;
  v_project public.projects%rowtype;
begin
  if new.requested_by is not null and new.approver_id is not null and new.requested_by = new.approver_id then
    raise exception 'You cannot approve your own request. Select another authorized approver.';
  end if;

  if num_nonnulls(new.project_id, new.milestone_id, new.task_id) > 1 then
    raise exception 'ACC_V13_APPROVAL_ITEM_AMBIGUOUS';
  end if;
  if new.project_id is not null or new.milestone_id is not null or new.task_id is not null then
    if new.requested_by is null or new.approver_id is null then
      raise exception 'ACC_V13_APPROVAL_ACTORS_REQUIRED';
    end if;
    v_item_type := case
      when new.project_id is not null then 'project'
      when new.milestone_id is not null then 'milestone'
      else 'task'
    end;
    v_item_id := coalesce(new.project_id, new.milestone_id, new.task_id);
    v_project := public.acc_v13_resolve_approval_project(v_item_type, v_item_id);
    if v_project.id is null or new.organization_id <> v_project.organization_id then
      raise exception 'ACC_V13_APPROVAL_ITEM_NOT_FOUND';
    end if;
    if not public.acc_v13_is_eligible_approver(new.requested_by, new.approver_id, v_item_type, v_item_id) then
      raise exception 'ACC_V13_APPROVER_NOT_ELIGIBLE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_acc_v13_approval_separation on public.approvals;
create trigger trg_acc_v13_approval_separation
before insert or update of organization_id, project_id, milestone_id, task_id, requested_by, approver_id on public.approvals
for each row execute function public.acc_v13_guard_approval_separation();

revoke all on function public.acc_v13_resolve_approval_project(text, uuid) from public, anon, authenticated;
revoke all on function public.acc_v13_actor_can_request_approval(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.acc_v13_is_eligible_approver(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.acc_v13_list_eligible_approvers(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.acc_v13_request_approval(uuid, uuid, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.acc_v13_guard_approval_separation() from public, anon, authenticated;
grant execute on function public.acc_v13_resolve_approval_project(text, uuid) to service_role;
grant execute on function public.acc_v13_actor_can_request_approval(uuid, text, uuid) to service_role;
grant execute on function public.acc_v13_is_eligible_approver(uuid, uuid, text, uuid) to service_role;
grant execute on function public.acc_v13_list_eligible_approvers(uuid, text, uuid) to service_role;
grant execute on function public.acc_v13_request_approval(uuid, uuid, text, uuid, uuid, text) to service_role;
grant execute on function public.acc_v13_guard_approval_separation() to service_role;

create or replace function public.acc_v13_authorize_evidence_access(
  p_actor_id uuid,
  p_evidence_file_id uuid,
  p_intent text default 'view'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_evidence public.evidence_files%rowtype;
  v_allowed boolean := false;
  v_ovr_allowed boolean := true;
  v_intent text := lower(trim(coalesce(p_intent, 'view')));
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'ACC_V13_SERVICE_ROLE_REQUIRED';
  end if;
  if v_intent not in ('view','download') then
    raise exception 'ACC_V13_EVIDENCE_INTENT_INVALID';
  end if;
  select * into v_actor from public.profiles
  where id = p_actor_id and is_active = true and user_status::text = 'active';
  select * into v_evidence from public.evidence_files where id = p_evidence_file_id;
  if v_actor.id is null or v_evidence.id is null or v_actor.organization_id <> v_evidence.organization_id then
    raise exception 'ACC_V13_EVIDENCE_NOT_FOUND';
  end if;

  v_allowed := coalesce(p_actor_id in (v_evidence.uploaded_by, v_evidence.reviewed_by, v_evidence.evidence_owner_id, v_evidence.reviewer_id), false)
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_actor_id and ur.is_active = true
        and ur.role::text in ('super_admin','governance_admin','executive','auditor','compliance_officer')
        and (ur.organization_id is null or ur.organization_id = v_actor.organization_id)
    )
    or exists (
      select 1 from public.projects p where p.id = v_evidence.project_id
        and p.organization_id = v_evidence.organization_id
        and p_actor_id in (p.owner_id, p.sponsor_id, p.created_by)
    )
    or exists (
      select 1 from public.milestones m join public.projects p on p.id = m.project_id
      where m.id = v_evidence.milestone_id
        and m.organization_id = v_evidence.organization_id
        and p.organization_id = v_evidence.organization_id
        and p_actor_id in (m.owner_id, p.owner_id, p.sponsor_id, p.created_by)
    )
    or exists (
      select 1 from public.tasks t join public.projects p on p.id = t.project_id
      where t.id = v_evidence.task_id
        and t.organization_id = v_evidence.organization_id
        and p.organization_id = v_evidence.organization_id
        and p_actor_id in (t.owner_id, t.assigned_to, p.owner_id, p.sponsor_id, p.created_by)
    );

  if v_evidence.ovr_report_id is not null then
    select exists (
      select 1 from public.ovr_reports r
      where r.id = v_evidence.ovr_report_id
        and r.organization_id = v_evidence.organization_id
        and p_actor_id in (r.reported_by, r.owner_id, r.supervisor_id, r.quality_reviewer_id)
    ) or exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_actor_id and ur.is_active = true
        and ur.role::text in ('super_admin','executive','governance_admin','auditor','compliance_officer')
        and (ur.organization_id is null or ur.organization_id = v_actor.organization_id)
    ) into v_ovr_allowed;
    v_allowed := v_allowed or v_ovr_allowed;
  end if;

  if not v_allowed or not v_ovr_allowed then
    raise exception 'ACC_V13_EVIDENCE_ACCESS_DENIED';
  end if;

  insert into public.audit_logs (organization_id, actor_id, action, table_name, record_id, new_data)
  values (
    v_actor.organization_id,
    p_actor_id,
    'acc_v13_evidence_' || v_intent,
    'evidence_files',
    v_evidence.id,
    jsonb_build_object('intent', v_intent, 'file_type', v_evidence.file_type)
  );

  return jsonb_build_object(
    'evidence_file_id', v_evidence.id,
    'file_name', v_evidence.file_name,
    'file_path', v_evidence.file_path,
    'file_type', v_evidence.file_type,
    'intent', v_intent
  );
end;
$$;

drop policy if exists evidence_storage_read on storage.objects;
-- Authenticated clients retain the existing governed upload policies but no
-- longer receive storage-object SELECT rights. Reads are deliberately issued
-- only by the service-role Edge bridge after this migration's exact-record
-- relationship and OVR-entitlement proof, and expire after 60 seconds.

revoke all on function public.acc_v13_authorize_evidence_access(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.acc_v13_authorize_evidence_access(uuid, uuid, text) to service_role;

comment on function public.acc_v13_update_work_item_status(uuid, text, uuid, text, numeric, text)
is 'ACC v1.3: fail-closed project/milestone/task status update using assignment and scoped-role proof.';
comment on function public.acc_v13_authorize_evidence_access(uuid, uuid, text)
is 'ACC v1.3: authorizes one private evidence view/download before the Edge bridge issues a short-lived signed URL.';
