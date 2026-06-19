-- v7.2 Finish Runtime Bridge + Real Authenticated Persona Proof
-- A service-role-only dispatcher for the authenticated Edge Function bridge.

begin;

-- RLS cannot authorize an authenticated client unless the role first has the
-- underlying table privilege. Grant only the operations used by the targeted
-- runtime workflows; DELETE remains server/admin only.
grant usage on schema public to authenticated;
grant select on table
  public.organizations,
  public.divisions,
  public.departments,
  public.units,
  public.profiles,
  public.user_roles,
  public.projects,
  public.milestones,
  public.tasks,
  public.evidence_files,
  public.approvals,
  public.ovr_reports,
  public.comments,
  public.escalation_events,
  public.board_pack_snapshots,
  public.backup_schedule_plans,
  public.backup_schedule_runs,
  public.data_export_jobs,
  public.export_logs,
  public.role_change_audit
to authenticated;

grant insert, update on table
  public.projects,
  public.milestones,
  public.tasks,
  public.evidence_files,
  public.approvals,
  public.ovr_reports,
  public.comments
to authenticated;

grant usage, select on sequence public.ovr_number_seq to authenticated;

grant all on table
  public.organizations,
  public.divisions,
  public.departments,
  public.units,
  public.profiles,
  public.user_roles,
  public.projects,
  public.milestones,
  public.tasks,
  public.evidence_files,
  public.approvals,
  public.ovr_reports,
  public.comments,
  public.audit_logs,
  public.escalation_events,
  public.board_pack_snapshots,
  public.backup_schedule_plans,
  public.backup_schedule_runs,
  public.data_export_jobs,
  public.export_logs,
  public.role_change_audit
to service_role;

grant all on sequence public.ovr_number_seq to service_role;

-- Role changes are now service-bridge-only. The legacy ALL policy also
-- participated in SELECT and recursively called has_any_role(user_roles).
drop policy if exists user_roles_write_admin on public.user_roles;

-- Backup and export metadata is not ordinary same-organization content.
-- Restrict it to explicitly trusted operational roles.
drop policy if exists backup_schedule_plans_read on public.backup_schedule_plans;
create policy backup_schedule_plans_read on public.backup_schedule_plans
for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role in (
        'super_admin', 'executive', 'governance_admin',
        'auditor', 'compliance_officer'
      )
      and (
        ur.organization_id is null
        or ur.organization_id = backup_schedule_plans.organization_id
      )
  )
);

drop policy if exists backup_schedule_runs_read on public.backup_schedule_runs;
create policy backup_schedule_runs_read on public.backup_schedule_runs
for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role in (
        'super_admin', 'executive', 'governance_admin',
        'auditor', 'compliance_officer'
      )
      and (
        ur.organization_id is null
        or ur.organization_id = backup_schedule_runs.organization_id
      )
  )
);

drop policy if exists data_export_jobs_select on public.data_export_jobs;
create policy data_export_jobs_select on public.data_export_jobs
for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role in (
        'super_admin', 'executive', 'governance_admin',
        'auditor', 'compliance_officer'
      )
      and (
        ur.organization_id is null
        or ur.organization_id = data_export_jobs.organization_id
      )
  )
);

drop policy if exists "Authenticated can read export logs" on public.export_logs;
drop policy if exists export_logs_read_privileged on public.export_logs;
create policy export_logs_read_privileged on public.export_logs
for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role in (
        'super_admin', 'executive', 'governance_admin',
        'auditor', 'compliance_officer'
      )
      and (
        ur.organization_id is null
        or ur.organization_id = export_logs.organization_id
      )
  )
);

-- Preserve the existing OVR corrective-project workflow while fixing enum
-- values that were previously inferred as text at runtime.
create or replace function public.create_ovr_corrective_action_project(p_ovr_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ovr public.ovr_reports%rowtype;
  v_actor uuid := auth.uid();
  v_project_id uuid;
begin
  select * into v_ovr
  from public.ovr_reports
  where id = p_ovr_report_id;

  if not found then
    raise exception 'OVR report not found';
  end if;

  if v_ovr.linked_project_id is not null then
    return v_ovr.linked_project_id;
  end if;

  if not public.can_manage_grc()
     and not public.can_access_scope(
       v_ovr.organization_id,
       v_ovr.division_id,
       v_ovr.department_id,
       v_ovr.unit_id
     ) then
    raise exception 'You are not allowed to create a corrective project for this OVR';
  end if;

  insert into public.projects (
    organization_id,
    title,
    description,
    category,
    source_type,
    source_reference_id,
    division_id,
    department_id,
    unit_id,
    owner_id,
    sponsor_id,
    start_date,
    target_end_date,
    priority,
    risk_level,
    status,
    evidence_required,
    closure_approval_required,
    created_by,
    updated_by
  ) values (
    v_ovr.organization_id,
    'OVR corrective action - ' || coalesce(
      v_ovr.ovr_number,
      v_ovr.logging_number,
      v_ovr.id::text
    ),
    coalesce(v_ovr.corrective_action, v_ovr.brief_description),
    'OVR Corrective Action',
    'incident_ovr'::public.source_type,
    v_ovr.id,
    v_ovr.division_id,
    v_ovr.department_id,
    v_ovr.unit_id,
    coalesce(v_ovr.owner_id, v_actor),
    v_actor,
    current_date,
    coalesce(v_ovr.corrective_action_due_date, current_date + 14),
    case
      when v_ovr.severity_level in ('level_4', 'sentinel')
        then 'critical'::public.priority_level
      else 'high'::public.priority_level
    end,
    case
      when v_ovr.severity_level in ('level_4', 'sentinel')
        then 'critical'::public.risk_level
      else 'high'::public.risk_level
    end,
    'active'::public.project_status,
    true,
    true,
    v_actor,
    v_actor
  ) returning id into v_project_id;

  update public.ovr_reports
  set linked_project_id = v_project_id,
      corrective_action_required = true,
      status = 'corrective_action_in_progress',
      updated_by = v_actor,
      updated_at = now()
  where id = p_ovr_report_id;

  return v_project_id;
end;
$$;

revoke all on function public.create_ovr_corrective_action_project(uuid)
from public, anon, authenticated;
grant execute on function public.create_ovr_corrective_action_project(uuid)
to service_role;

create or replace function public.v72_execute_privileged_action(
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
  v_result uuid;
  v_target_org uuid;
  v_target_role public.app_role;
  v_target_user uuid;
  v_actor_org uuid;
  v_actor_is_super_admin boolean;
  v_actor_can_manage_roles boolean;
  v_sections text[];
begin
  if auth.role() <> 'service_role' then
    raise exception 'V72_BRIDGE_SERVICE_ROLE_REQUIRED';
  end if;

  if p_actor_id is null or not exists (
    select 1 from public.profiles
    where id = p_actor_id and is_active = true
  ) then
    raise exception 'V72_BRIDGE_ACTIVE_ACTOR_REQUIRED';
  end if;

  if p_action not in (
    'create_board_pack_snapshot',
    'acknowledge_escalation_event',
    'resolve_escalation_event',
    'assign_user_role',
    'deactivate_user_role',
    'update_ovr_workflow',
    'create_ovr_corrective_action_project'
  ) then
    raise exception 'V72_BRIDGE_ACTION_NOT_ALLOWED: %', p_action;
  end if;

  select organization_id into v_actor_org
  from public.profiles
  where id = p_actor_id;

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
      and role in ('super_admin', 'executive', 'governance_admin')
  ) into v_actor_can_manage_roles;

  -- Existing workflow functions use auth.uid(). Set it only after validating
  -- that this dispatcher was called with the service role.
  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if p_action = 'create_board_pack_snapshot' then
    v_target_org := nullif(p_payload->>'organization_id', '')::uuid;
    if v_target_org is null then
      raise exception 'V72_BOARD_PACK_ORGANIZATION_REQUIRED';
    end if;
    if not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p_actor_id
        and ur.is_active = true
        and ur.role in (
          'super_admin', 'executive', 'governance_admin',
          'auditor', 'compliance_officer'
        )
        and (
          ur.organization_id is null
          or ur.organization_id = v_target_org
          or v_actor_org = v_target_org
        )
    ) then
      raise exception 'V72_BOARD_PACK_NOT_AUTHORIZED';
    end if;

    select coalesce(array_agg(value), array[]::text[])
    into v_sections
    from jsonb_array_elements_text(
      coalesce(
        p_payload->'sections',
        '["summary","department_scorecards","risks","ovr","audit","compliance","backup"]'::jsonb
      )
    ) as section(value);

    v_result := public.create_board_pack_snapshot(
      v_target_org,
      coalesce(nullif(p_payload->>'title', ''), 'Executive Board Pack'),
      nullif(p_payload->>'period_start', '')::date,
      nullif(p_payload->>'period_end', '')::date,
      v_sections
    );
    return jsonb_build_object('id', v_result);
  end if;

  if p_action in ('acknowledge_escalation_event', 'resolve_escalation_event') then
    select organization_id into v_target_org
    from public.escalation_events
    where id = nullif(p_payload->>'event_id', '')::uuid;

    if v_target_org is null then
      raise exception 'V72_ESCALATION_NOT_FOUND';
    end if;
    if not exists (
      select 1
      from public.escalation_events event
      where event.id = (p_payload->>'event_id')::uuid
        and (
          event.owner_id = p_actor_id
          or exists (
            select 1 from public.user_roles ur
            where ur.user_id = p_actor_id
              and ur.is_active = true
              and ur.role in (
                'super_admin', 'executive', 'governance_admin',
                'auditor', 'compliance_officer'
              )
              and (
                ur.organization_id is null
                or ur.organization_id = event.organization_id
                or v_actor_org = event.organization_id
              )
          )
        )
    ) then
      raise exception 'V72_ESCALATION_NOT_AUTHORIZED';
    end if;

    if p_action = 'acknowledge_escalation_event' then
      perform public.acknowledge_escalation_event(
        (p_payload->>'event_id')::uuid,
        nullif(p_payload->>'note', '')
      );
    else
      perform public.resolve_escalation_event(
        (p_payload->>'event_id')::uuid,
        nullif(p_payload->>'note', '')
      );
    end if;
    return jsonb_build_object('updated', true);
  end if;

  if p_action = 'assign_user_role' then
    v_target_user := nullif(p_payload->>'user_id', '')::uuid;
    v_target_role := nullif(p_payload->>'role', '')::public.app_role;
    select organization_id into v_target_org
    from public.profiles
    where id = v_target_user and is_active = true;

    if not v_actor_can_manage_roles then
      raise exception 'V72_ROLE_ADMIN_NOT_AUTHORIZED';
    end if;
    if v_target_org is null then
      raise exception 'V72_ROLE_TARGET_NOT_FOUND';
    end if;
    if v_actor_org is distinct from v_target_org and not exists (
      select 1 from public.user_roles
      where user_id = p_actor_id
        and is_active = true
        and role = 'super_admin'
        and organization_id is null
    ) then
      raise exception 'V72_ROLE_ADMIN_CROSS_ORG_DENIED';
    end if;
    if v_target_role in ('super_admin', 'executive', 'governance_admin')
       and not v_actor_is_super_admin then
      raise exception 'V72_PRIVILEGED_ROLE_REQUIRES_SUPER_ADMIN';
    end if;

    v_result := public.assign_user_role(
      v_target_user,
      v_target_role,
      coalesce(nullif(p_payload->>'scope', '')::public.access_scope, 'assigned_only'),
      coalesce(nullif(p_payload->>'organization_id', '')::uuid, v_target_org),
      nullif(p_payload->>'division_id', '')::uuid,
      nullif(p_payload->>'department_id', '')::uuid,
      nullif(p_payload->>'unit_id', '')::uuid,
      nullif(p_payload->>'reason', '')
    );
    return jsonb_build_object('id', v_result);
  end if;

  if p_action = 'deactivate_user_role' then
    select ur.organization_id, ur.role, ur.user_id
    into v_target_org, v_target_role, v_target_user
    from public.user_roles ur
    where ur.id = nullif(p_payload->>'user_role_id', '')::uuid
      and ur.is_active = true;

    if not v_actor_can_manage_roles then
      raise exception 'V72_ROLE_ADMIN_NOT_AUTHORIZED';
    end if;
    if v_target_user is null then
      raise exception 'V72_ROLE_ASSIGNMENT_NOT_FOUND';
    end if;
    if v_actor_org is distinct from v_target_org and not exists (
      select 1 from public.user_roles
      where user_id = p_actor_id
        and is_active = true
        and role = 'super_admin'
        and organization_id is null
    ) then
      raise exception 'V72_ROLE_ADMIN_CROSS_ORG_DENIED';
    end if;
    if v_target_role in ('super_admin', 'executive', 'governance_admin')
       and not v_actor_is_super_admin then
      raise exception 'V72_PRIVILEGED_ROLE_REQUIRES_SUPER_ADMIN';
    end if;
    if v_target_user = p_actor_id then
      raise exception 'V72_SELF_ROLE_DEACTIVATION_DENIED';
    end if;
    if v_target_role = 'super_admin' and (
      select count(*)
      from public.user_roles
      where is_active = true
        and role = 'super_admin'
        and organization_id is not distinct from v_target_org
    ) <= 1 then
      raise exception 'V72_LAST_SUPER_ADMIN_DEACTIVATION_DENIED';
    end if;

    perform public.deactivate_user_role(
      (p_payload->>'user_role_id')::uuid,
      nullif(p_payload->>'reason', '')
    );
    return jsonb_build_object('updated', true);
  end if;

  if p_action in ('update_ovr_workflow', 'create_ovr_corrective_action_project') then
    select organization_id into v_target_org
    from public.ovr_reports
    where id = nullif(p_payload->>'ovr_report_id', '')::uuid;

    if v_target_org is null then
      raise exception 'V72_OVR_NOT_FOUND';
    end if;
    if v_actor_org is distinct from v_target_org and not v_actor_is_super_admin then
      raise exception 'V72_OVR_CROSS_ORG_DENIED';
    end if;

    if p_action = 'update_ovr_workflow' then
      perform public.update_ovr_workflow(
        (p_payload->>'ovr_report_id')::uuid,
        p_payload->>'next_status',
        nullif(p_payload->>'note', ''),
        nullif(p_payload->>'supervisor_investigation', ''),
        nullif(p_payload->>'corrective_action', ''),
        nullif(p_payload->>'quality_manager_comments', ''),
        nullif(p_payload->>'confirmed_severity_level', '')::public.ovr_severity_level,
        nullif(p_payload->>'corrective_action_due_date', '')::date
      );
      return jsonb_build_object('updated', true);
    end if;

    v_result := public.create_ovr_corrective_action_project(
      (p_payload->>'ovr_report_id')::uuid
    );
    return jsonb_build_object('id', v_result);
  end if;

  raise exception 'V72_BRIDGE_UNREACHABLE_ACTION';
end;
$$;

revoke all on function public.v72_execute_privileged_action(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.v72_execute_privileged_action(uuid, text, jsonb)
to service_role;

commit;
