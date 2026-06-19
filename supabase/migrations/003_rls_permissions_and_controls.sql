-- =========================================================
-- GRC Control Center - Migration 003
-- Row Level Security, permission helpers, validation rules
-- =========================================================

-- -------------------------
-- Permission helper functions
-- -------------------------

create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() and is_active = true limit 1;
$$;

create or replace function public.has_any_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role = any(required_roles)
  );
$$;

create or replace function public.has_global_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.scope = 'global'
      and ur.role = any(required_roles)
  );
$$;

create or replace function public.can_access_org(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_org_id = public.current_user_org_id()
     or public.has_global_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]);
$$;

create or replace function public.can_access_scope(
  target_org_id uuid,
  target_division_id uuid,
  target_department_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and (
        ur.scope = 'global'
        or (ur.scope = 'division' and ur.division_id is not distinct from target_division_id)
        or (ur.scope = 'department' and ur.department_id is not distinct from target_department_id)
        or (ur.scope = 'unit' and ur.unit_id is not distinct from target_unit_id)
      )
      and (
        ur.organization_id is null
        or ur.organization_id is not distinct from target_org_id
        or target_org_id = public.current_user_org_id()
      )
  );
$$;

create or replace function public.can_manage_grc()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]);
$$;

-- -------------------------
-- Validation helper functions
-- -------------------------

create or replace function public.require_delay_reason_project()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delayed' and coalesce(trim(new.delay_reason), '') = '' then
    raise exception 'Delay reason is required when project status is delayed';
  end if;
  return new;
end;
$$;

create or replace function public.require_delay_reason_work()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delayed' and coalesce(trim(new.delay_reason), '') = '' then
    raise exception 'Delay reason is required when work item status is delayed';
  end if;
  return new;
end;
$$;

create or replace function public.audit_log_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := coalesce((to_jsonb(new)->>'organization_id')::uuid, (to_jsonb(old)->>'organization_id')::uuid);

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    org_id,
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

-- Validation triggers
drop trigger if exists trg_projects_require_delay_reason on public.projects;
create trigger trg_projects_require_delay_reason before insert or update on public.projects
for each row execute function public.require_delay_reason_project();

drop trigger if exists trg_milestones_require_delay_reason on public.milestones;
create trigger trg_milestones_require_delay_reason before insert or update on public.milestones
for each row execute function public.require_delay_reason_work();

drop trigger if exists trg_tasks_require_delay_reason on public.tasks;
create trigger trg_tasks_require_delay_reason before insert or update on public.tasks
for each row execute function public.require_delay_reason_work();

drop trigger if exists trg_risk_mitigation_require_delay_reason on public.risk_mitigation_actions;
create trigger trg_risk_mitigation_require_delay_reason before insert or update on public.risk_mitigation_actions
for each row execute function public.require_delay_reason_work();

-- Audit log triggers on important tables.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'projects','milestones','tasks','evidence_files','approvals','risks','risk_controls',
    'risk_mitigation_actions','compliance_items','audit_findings','policies','authority_matrix',
    'committee_meetings','committee_decisions','user_roles'
  ] loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', tbl, tbl);
    execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_log_row_change()', tbl, tbl);
  end loop;
end $$;

-- -------------------------
-- Enable RLS
-- -------------------------

alter table public.organizations enable row level security;
alter table public.divisions enable row level security;
alter table public.departments enable row level security;
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.evidence_files enable row level security;
alter table public.approvals enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.risks enable row level security;
alter table public.risk_controls enable row level security;
alter table public.risk_mitigation_actions enable row level security;
alter table public.compliance_items enable row level security;
alter table public.audit_findings enable row level security;
alter table public.policies enable row level security;
alter table public.authority_matrix enable row level security;
alter table public.committee_meetings enable row level security;
alter table public.committee_decisions enable row level security;

-- -------------------------
-- Organization structure policies
-- -------------------------

create policy organizations_read on public.organizations
for select using (public.can_access_org(id));
create policy organizations_write_admin on public.organizations
for all using (public.has_global_role(array['super_admin']::public.app_role[]))
with check (public.has_global_role(array['super_admin']::public.app_role[]));

create policy divisions_read on public.divisions
for select using (public.can_access_org(organization_id));
create policy divisions_write_admin on public.divisions
for all using (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]))
with check (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]));

create policy departments_read on public.departments
for select using (public.can_access_org(organization_id));
create policy departments_write_admin on public.departments
for all using (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]))
with check (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]));

create policy units_read on public.units
for select using (public.can_access_org(organization_id));
create policy units_write_admin on public.units
for all using (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]))
with check (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]));

-- -------------------------
-- Profile / role policies
-- -------------------------

create policy profiles_read_self_or_org_managers on public.profiles
for select using (
  id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','auditor','compliance_officer']::public.app_role[])
);

create policy profiles_insert_self on public.profiles
for insert with check (id = auth.uid());

create policy profiles_update_self_or_admin on public.profiles
for update using (id = auth.uid() or public.has_any_role(array['super_admin','governance_admin']::public.app_role[]))
with check (id = auth.uid() or public.has_any_role(array['super_admin','governance_admin']::public.app_role[]));

create policy user_roles_read_self_or_admin on public.user_roles
for select using (user_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]));

create policy user_roles_write_admin on public.user_roles
for all using (public.has_any_role(array['super_admin','governance_admin']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin']::public.app_role[]));

-- -------------------------
-- Project/action policies
-- -------------------------

create policy projects_read_scope_or_assigned on public.projects
for select using (
  public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or owner_id = auth.uid()
  or sponsor_id = auth.uid()
  or created_by = auth.uid()
);

create policy projects_write_managers on public.projects
for insert with check (
  public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','project_owner']::public.app_role[])
);

create policy projects_update_owner_or_manager on public.projects
for update using (
  public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or owner_id = auth.uid()
  or sponsor_id = auth.uid()
)
with check (
  public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or owner_id = auth.uid()
  or sponsor_id = auth.uid()
);

create policy milestones_read_scope_or_owner on public.milestones
for select using (
  public.can_access_org(organization_id)
  and (
    owner_id = auth.uid()
    or created_by = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and (p.owner_id = auth.uid() or p.sponsor_id = auth.uid()))
    or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','auditor','compliance_officer']::public.app_role[])
  )
);

create policy milestones_write_owner_or_manager on public.milestones
for all using (
  owner_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','project_owner']::public.app_role[])
)
with check (
  owner_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','project_owner']::public.app_role[])
);

create policy tasks_read_assigned_or_manager on public.tasks
for select using (
  owner_id = auth.uid()
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (select 1 from public.projects p where p.id = project_id and (p.owner_id = auth.uid() or p.sponsor_id = auth.uid()))
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','auditor','compliance_officer']::public.app_role[])
);

create policy tasks_write_assigned_or_manager on public.tasks
for all using (
  owner_id = auth.uid()
  or assigned_to = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','project_owner','milestone_owner']::public.app_role[])
)
with check (
  owner_id = auth.uid()
  or assigned_to = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','project_owner','milestone_owner']::public.app_role[])
);

-- Evidence, approvals, comments, notifications
create policy evidence_read_related on public.evidence_files
for select using (
  uploaded_by = auth.uid()
  or reviewed_by = auth.uid()
  or public.can_manage_grc()
  or exists (select 1 from public.projects p where p.id = project_id and (p.owner_id = auth.uid() or p.sponsor_id = auth.uid()))
  or exists (select 1 from public.tasks t where t.id = task_id and (t.owner_id = auth.uid() or t.assigned_to = auth.uid()))
);

create policy evidence_insert_authenticated on public.evidence_files
for insert with check (uploaded_by = auth.uid() or public.can_manage_grc());

create policy evidence_update_reviewers on public.evidence_files
for update using (uploaded_by = auth.uid() or public.can_manage_grc())
with check (uploaded_by = auth.uid() or public.can_manage_grc());

create policy approvals_read_related on public.approvals
for select using (requested_by = auth.uid() or approver_id = auth.uid() or public.can_manage_grc());
create policy approvals_write_related on public.approvals
for all using (requested_by = auth.uid() or approver_id = auth.uid() or public.can_manage_grc())
with check (requested_by = auth.uid() or approver_id = auth.uid() or public.can_manage_grc());

create policy comments_read_org on public.comments
for select using (public.can_access_org(organization_id));
create policy comments_write_authenticated on public.comments
for insert with check (created_by = auth.uid());

create policy notifications_own on public.notifications
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_logs_read_admin on public.audit_logs
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]));

-- -------------------------
-- GRC policies
-- -------------------------

create policy risks_read_scope_or_owner on public.risks
for select using (
  owner_id = auth.uid()
  or public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);
create policy risks_write_grc on public.risks
for all using (public.can_manage_grc()) with check (public.can_manage_grc());

create policy risk_controls_read on public.risk_controls
for select using (
  owner_id = auth.uid()
  or public.can_manage_grc()
  or exists (select 1 from public.risks r where r.id = risk_id and r.owner_id = auth.uid())
);
create policy risk_controls_write_grc on public.risk_controls
for all using (public.can_manage_grc()) with check (public.can_manage_grc());

create policy risk_mitigation_read on public.risk_mitigation_actions
for select using (owner_id = auth.uid() or public.can_manage_grc());
create policy risk_mitigation_write on public.risk_mitigation_actions
for all using (owner_id = auth.uid() or public.can_manage_grc()) with check (owner_id = auth.uid() or public.can_manage_grc());

create policy compliance_read_scope_or_owner on public.compliance_items
for select using (
  owner_id = auth.uid()
  or escalation_owner_id = auth.uid()
  or public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);
create policy compliance_write_officers on public.compliance_items
for all using (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]));

create policy audit_findings_read_related on public.audit_findings
for select using (
  owner_id = auth.uid()
  or auditor_id = auth.uid()
  or reviewed_by = auth.uid()
  or public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[])
);
create policy audit_findings_write_auditors on public.audit_findings
for all using (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]));

create policy policies_read_org on public.policies
for select using (public.can_access_org(organization_id));
create policy policies_write_governance on public.policies
for all using (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]));

create policy authority_read_org on public.authority_matrix
for select using (public.can_access_org(organization_id));
create policy authority_write_governance on public.authority_matrix
for all using (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]));

create policy committee_meetings_read_org on public.committee_meetings
for select using (public.can_access_org(organization_id));
create policy committee_meetings_write_governance on public.committee_meetings
for all using (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]));

create policy committee_decisions_read_related on public.committee_decisions
for select using (
  owner_id = auth.uid()
  or sponsor_id = auth.uid()
  or public.can_access_scope(organization_id, division_id, department_id, null)
  or public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[])
);
create policy committee_decisions_write_governance on public.committee_decisions
for all using (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]));
