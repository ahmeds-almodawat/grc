-- =========================================================
-- GRC Control Center - Migration 015
-- Production hardening, backup health checks, workflow guards,
-- print/report catalog, and safer OVR closure controls
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Export / report / backup metadata tables
-- Defensive definitions in case v1.2 was not applied cleanly.
-- ---------------------------------------------------------
create table if not exists export_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  export_type text not null default 'manual',
  export_scope text not null default 'general',
  file_name text,
  format text not null default 'json',
  row_count integer not null default 0,
  status text not null default 'completed',
  error_message text,
  filters jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists backup_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  package_name text not null,
  package_type text not null default 'browser_export',
  includes_storage_files boolean not null default false,
  includes_auth_secrets boolean not null default false,
  included_tables text[] not null default '{}',
  file_name text,
  file_size bigint,
  row_count integer not null default 0,
  checksum text,
  status text not null default 'created',
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists report_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name_en text not null,
  name_ar text,
  description_en text,
  description_ar text,
  report_key text not null,
  source_view text not null,
  default_format text not null default 'csv',
  filters jsonb not null default '{}'::jsonb,
  columns jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, report_key)
);

drop trigger if exists trg_report_definitions_updated_at on report_definitions;
create trigger trg_report_definitions_updated_at
before update on report_definitions
for each row execute function set_updated_at();

create table if not exists system_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  snapshot_type text not null default 'manual',
  total_critical integer not null default 0,
  total_high integer not null default 0,
  total_medium integer not null default 0,
  total_low integer not null default 0,
  snapshot_data jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- OVR hardening columns. Safe if already created by v1.0.
-- ---------------------------------------------------------
alter table if exists ovr_reports
  add column if not exists supervisor_investigation text,
  add column if not exists supervisor_action_taken text,
  add column if not exists corrective_action_summary text,
  add column if not exists quality_review_notes text,
  add column if not exists quality_confirmed_severity text,
  add column if not exists returned_reason text,
  add column if not exists evidence_required boolean not null default true,
  add column if not exists closure_approval_required boolean not null default true,
  add column if not exists quality_closed_by uuid references profiles(id) on delete set null,
  add column if not exists quality_closed_at timestamptz,
  add column if not exists linked_corrective_action_project_id uuid references projects(id) on delete set null;

-- Link evidence/approvals/comments to OVR when the previous migration did not.
do $$
begin
  if to_regclass('public.ovr_reports') is not null then
    alter table evidence_files add column if not exists ovr_report_id uuid references ovr_reports(id) on delete cascade;
    alter table approvals add column if not exists ovr_report_id uuid references ovr_reports(id) on delete cascade;
    alter table comments add column if not exists ovr_report_id uuid references ovr_reports(id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------
-- Helper: accepted evidence exists for a controlled item.
-- ---------------------------------------------------------
create or replace function grc_has_accepted_evidence(p_item_type text, p_item_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_exists boolean := false;
begin
  if p_item_id is null then
    return false;
  end if;

  case p_item_type
    when 'project' then
      select exists(select 1 from evidence_files where project_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'milestone' then
      select exists(select 1 from evidence_files where milestone_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'task' then
      select exists(select 1 from evidence_files where task_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'risk' then
      select exists(select 1 from evidence_files where risk_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'compliance' then
      select exists(select 1 from evidence_files where compliance_item_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'audit_finding' then
      select exists(select 1 from evidence_files where audit_finding_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'policy' then
      select exists(select 1 from evidence_files where policy_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'decision' then
      select exists(select 1 from evidence_files where committee_decision_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'ovr' then
      if exists(select 1 from information_schema.columns where table_name='evidence_files' and column_name='ovr_report_id') then
        execute 'select exists(select 1 from evidence_files where ovr_report_id = $1 and status::text = ''accepted'')' into v_exists using p_item_id;
      end if;
    else
      v_exists := false;
  end case;

  return coalesce(v_exists, false);
end;
$$;

-- ---------------------------------------------------------
-- Workflow guard triggers
-- ---------------------------------------------------------
create or replace function grc_guard_project_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'delayed' and coalesce(trim(new.delay_reason), '') = '' then
    raise exception 'Delay reason is required before marking a project delayed.';
  end if;

  if new.status::text = 'closed' and coalesce(new.evidence_required, false) = true then
    if not grc_has_accepted_evidence('project', new.id) then
      raise exception 'Accepted evidence is required before closing this project.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grc_guard_project_update on projects;
create trigger trg_grc_guard_project_update
before update on projects
for each row execute function grc_guard_project_update();

create or replace function grc_guard_milestone_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'delayed' and coalesce(trim(new.delay_reason), '') = '' then
    raise exception 'Delay reason is required before marking a milestone delayed.';
  end if;

  if new.status::text in ('approved', 'closed') and coalesce(new.evidence_required, false) = true then
    if not grc_has_accepted_evidence('milestone', new.id) then
      raise exception 'Accepted evidence is required before approving or closing this milestone.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grc_guard_milestone_update on milestones;
create trigger trg_grc_guard_milestone_update
before update on milestones
for each row execute function grc_guard_milestone_update();

create or replace function grc_guard_task_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'delayed' and coalesce(trim(new.delay_reason), '') = '' then
    raise exception 'Delay reason is required before marking a task delayed.';
  end if;

  if new.status::text in ('approved', 'closed') and coalesce(new.evidence_required, false) = true then
    if not grc_has_accepted_evidence('task', new.id) then
      raise exception 'Accepted evidence is required before approving or closing this task.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grc_guard_task_update on tasks;
create trigger trg_grc_guard_task_update
before update on tasks
for each row execute function grc_guard_task_update();

create or replace function grc_guard_approval_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'approved' and new.approver_id is not null and new.requested_by is not null and new.approver_id = new.requested_by then
    raise exception 'Self-approval is not allowed.';
  end if;

  if new.status::text in ('approved', 'rejected') and new.decided_at is null then
    new.decided_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grc_guard_approval_update on approvals;
create trigger trg_grc_guard_approval_update
before update on approvals
for each row execute function grc_guard_approval_update();

create or replace function grc_guard_audit_finding_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'closed' then
    if coalesce(new.evidence_required, false) = true and not grc_has_accepted_evidence('audit_finding', new.id) then
      raise exception 'Accepted evidence is required before closing this audit finding.';
    end if;

    if new.reviewed_by is null then
      raise exception 'Audit review is required before closing this audit finding.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grc_guard_audit_finding_update on audit_findings;
create trigger trg_grc_guard_audit_finding_update
before update on audit_findings
for each row execute function grc_guard_audit_finding_update();

create or replace function grc_guard_ovr_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'returned_for_clarification' and coalesce(trim(new.returned_reason), '') = '' then
    raise exception 'Return reason is required before returning an OVR for clarification.';
  end if;

  if new.status::text = 'closed' then
    if coalesce(new.evidence_required, true) = true and not grc_has_accepted_evidence('ovr', new.id) then
      raise exception 'Accepted evidence is required before closing this OVR.';
    end if;

    if new.quality_closed_by is null then
      raise exception 'Quality closure user is required before closing this OVR.';
    end if;

    if new.quality_closed_at is null then
      new.quality_closed_at := now();
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.ovr_reports') is not null then
    drop trigger if exists trg_grc_guard_ovr_update on ovr_reports;
    create trigger trg_grc_guard_ovr_update
    before update on ovr_reports
    for each row execute function grc_guard_ovr_update();
  end if;
end $$;

-- ---------------------------------------------------------
-- Backup Health Check view
-- Each row is a warning type with a record count.
-- ---------------------------------------------------------
create or replace view v_backup_health_check as
with orgs as (
  select id, name_en, name_ar from organizations
)
select
  o.id as organization_id,
  'duplicate_department_codes'::text as check_key,
  'critical'::text as severity,
  'organization'::text as area,
  'Duplicate active department codes'::text as title_en,
  'رموز أقسام نشطة مكررة'::text as title_ar,
  'Active department codes must be unique after trimming and lower-casing.'::text as details_en,
  'يجب ألا تتكرر رموز الأقسام النشطة بعد إزالة الفراغات وتوحيد حالة الأحرف.'::text as details_ar,
  coalesce((
    select count(*) from (
      select lower(trim(code)) normalized_code
      from departments d
      where d.organization_id = o.id and d.is_active = true and d.code is not null
      group by lower(trim(code))
      having count(*) > 1
    ) x
  ),0)::integer as record_count,
  '/admin/import-export'::text as action_path,
  now() as created_at
from orgs o

union all
select
  o.id,
  'duplicate_unit_codes',
  'critical',
  'organization',
  'Duplicate active unit/station codes',
  'رموز وحدات/محطات نشطة مكررة',
  'Active unit/station codes must be unique inside the same department.',
  'يجب ألا تتكرر رموز الوحدات/المحطات النشطة داخل نفس القسم.',
  coalesce((
    select count(*) from (
      select department_id, lower(trim(code)) normalized_code
      from units u
      where u.organization_id = o.id and u.is_active = true and u.code is not null
      group by department_id, lower(trim(code))
      having count(*) > 1
    ) x
  ),0)::integer,
  '/admin/import-export',
  now()
from orgs o

union all
select
  o.id,
  'users_missing_department',
  'high',
  'access',
  'Active users missing department',
  'مستخدمون نشطون بدون قسم',
  'Active employees should normally be assigned to a department for scoped access and reporting.',
  'يجب عادة ربط المستخدمين النشطين بقسم لضبط الصلاحيات والتقارير.',
  coalesce((select count(*) from profiles p where p.organization_id = o.id and p.is_active = true and p.department_id is null),0)::integer,
  '/access-control',
  now()
from orgs o

union all
select
  o.id,
  'projects_missing_owner_or_due_date',
  'high',
  'projects',
  'Active projects missing owner or due date',
  'مشاريع نشطة بدون مالك أو تاريخ مستهدف',
  'Every active project/action plan needs an owner and target end date.',
  'كل مشروع أو خطة عمل نشطة تحتاج إلى مالك وتاريخ انتهاء مستهدف.',
  coalesce((select count(*) from projects p where p.organization_id = o.id and p.status::text not in ('closed','cancelled') and (p.owner_id is null or p.target_end_date is null)),0)::integer,
  '/projects',
  now()
from orgs o

union all
select
  o.id,
  'overdue_items_without_delay_reason',
  'critical',
  'workflow',
  'Overdue items missing delay reason',
  'بنود متأخرة بدون سبب تأخير',
  'Overdue projects, milestones, and tasks must have a delay reason for governance tracking.',
  'يجب تسجيل سبب التأخير للمشاريع والمراحل والمهام المتأخرة.',
  (
    coalesce((select count(*) from projects p where p.organization_id = o.id and p.target_end_date < current_date and p.status::text not in ('closed','cancelled') and coalesce(trim(p.delay_reason),'') = ''),0)
    + coalesce((select count(*) from milestones m where m.organization_id = o.id and m.due_date < current_date and m.status::text not in ('closed','approved','cancelled') and coalesce(trim(m.delay_reason),'') = ''),0)
    + coalesce((select count(*) from tasks t where t.organization_id = o.id and t.due_date < current_date and t.status::text not in ('closed','approved','cancelled') and coalesce(trim(t.delay_reason),'') = ''),0)
  )::integer,
  '/escalations',
  now()
from orgs o

union all
select
  o.id,
  'pending_approvals_older_than_14_days',
  'high',
  'approvals',
  'Pending approvals older than 14 days',
  'اعتمادات معلقة لأكثر من 14 يوم',
  'Old pending approvals create execution bottlenecks and accountability risk.',
  'الاعتمادات القديمة المعلقة تسبب تعطل التنفيذ ومخاطر في المساءلة.',
  coalesce((select count(*) from approvals a where a.organization_id = o.id and a.status::text = 'pending' and a.requested_at < now() - interval '14 days'),0)::integer,
  '/approvals',
  now()
from orgs o

union all
select
  o.id,
  'ovr_stuck_quality_review',
  'critical',
  'ovr',
  'OVRs stuck in Quality review',
  'بلاغات OVR عالقة لدى الجودة',
  'OVRs under Quality review for more than 7 days need escalation.',
  'بلاغات OVR الموجودة تحت مراجعة الجودة لأكثر من 7 أيام تحتاج تصعيد.',
  coalesce((select count(*) from ovr_reports r where r.organization_id = o.id and r.status::text in ('submitted_to_quality','under_quality_review','quality_review') and r.created_at < now() - interval '7 days'),0)::integer,
  '/ovr',
  now()
from orgs o

union all
select
  o.id,
  'old_browser_backup_packages',
  'medium',
  'backup',
  'No recent browser backup package',
  'لا توجد حزمة نسخ احتياطي حديثة من المتصفح',
  'Create an external backup package at least weekly during rollout.',
  'يفضل إنشاء حزمة نسخ احتياطي خارجية أسبوعياً أثناء مرحلة الإطلاق.',
  case when exists(select 1 from backup_packages b where b.organization_id = o.id and b.created_at >= now() - interval '7 days' and b.status = 'created') then 0 else 1 end,
  '/admin/import-export',
  now()
from orgs o;

-- ---------------------------------------------------------
-- Workflow blockers detail view
-- ---------------------------------------------------------
create or replace view v_workflow_blockers as
select
  p.organization_id,
  'project'::text as item_type,
  p.id as item_id,
  p.title,
  p.status::text as status,
  p.department_id,
  p.owner_id,
  p.target_end_date as due_date,
  case
    when p.owner_id is null then 'missing_owner'
    when p.target_end_date is null then 'missing_due_date'
    when p.target_end_date < current_date and coalesce(trim(p.delay_reason),'') = '' then 'missing_delay_reason'
    when p.evidence_required = true and p.status::text in ('completed_pending_approval','closed') and not grc_has_accepted_evidence('project', p.id) then 'missing_accepted_evidence'
    else 'attention_required'
  end as blocker_key,
  case
    when p.owner_id is null then 'Project has no owner'
    when p.target_end_date is null then 'Project has no target end date'
    when p.target_end_date < current_date and coalesce(trim(p.delay_reason),'') = '' then 'Project is overdue without delay reason'
    when p.evidence_required = true and p.status::text in ('completed_pending_approval','closed') and not grc_has_accepted_evidence('project', p.id) then 'Project needs accepted evidence'
    else 'Project needs attention'
  end as blocker_en,
  case
    when p.owner_id is null then 'المشروع بدون مالك'
    when p.target_end_date is null then 'المشروع بدون تاريخ مستهدف'
    when p.target_end_date < current_date and coalesce(trim(p.delay_reason),'') = '' then 'المشروع متأخر بدون سبب تأخير'
    when p.evidence_required = true and p.status::text in ('completed_pending_approval','closed') and not grc_has_accepted_evidence('project', p.id) then 'المشروع يحتاج دليل مقبول'
    else 'المشروع يحتاج متابعة'
  end as blocker_ar,
  now() as created_at
from projects p
where p.status::text not in ('closed','cancelled')
  and (
    p.owner_id is null
    or p.target_end_date is null
    or (p.target_end_date < current_date and coalesce(trim(p.delay_reason),'') = '')
    or (p.evidence_required = true and p.status::text in ('completed_pending_approval','closed') and not grc_has_accepted_evidence('project', p.id))
  )

union all
select
  t.organization_id,
  'task',
  t.id,
  t.title,
  t.status::text,
  p.department_id,
  coalesce(t.assigned_to, t.owner_id),
  t.due_date,
  case
    when coalesce(t.assigned_to, t.owner_id) is null then 'missing_owner'
    when t.due_date is null then 'missing_due_date'
    when t.due_date < current_date and coalesce(trim(t.delay_reason),'') = '' then 'missing_delay_reason'
    when t.evidence_required = true and t.status::text in ('approved','closed') and not grc_has_accepted_evidence('task', t.id) then 'missing_accepted_evidence'
    else 'attention_required'
  end,
  case
    when coalesce(t.assigned_to, t.owner_id) is null then 'Task has no owner'
    when t.due_date is null then 'Task has no due date'
    when t.due_date < current_date and coalesce(trim(t.delay_reason),'') = '' then 'Task is overdue without delay reason'
    when t.evidence_required = true and t.status::text in ('approved','closed') and not grc_has_accepted_evidence('task', t.id) then 'Task needs accepted evidence'
    else 'Task needs attention'
  end,
  case
    when coalesce(t.assigned_to, t.owner_id) is null then 'المهمة بدون مالك'
    when t.due_date is null then 'المهمة بدون تاريخ استحقاق'
    when t.due_date < current_date and coalesce(trim(t.delay_reason),'') = '' then 'المهمة متأخرة بدون سبب تأخير'
    when t.evidence_required = true and t.status::text in ('approved','closed') and not grc_has_accepted_evidence('task', t.id) then 'المهمة تحتاج دليل مقبول'
    else 'المهمة تحتاج متابعة'
  end,
  now()
from tasks t
join projects p on p.id = t.project_id
where t.status::text not in ('closed','approved','cancelled')
  and (
    coalesce(t.assigned_to, t.owner_id) is null
    or t.due_date is null
    or (t.due_date < current_date and coalesce(trim(t.delay_reason),'') = '')
    or (t.evidence_required = true and t.status::text in ('approved','closed') and not grc_has_accepted_evidence('task', t.id))
  );

-- ---------------------------------------------------------
-- Print/report index view for the report center.
-- ---------------------------------------------------------
create or replace view v_print_report_index as
select
  o.id as organization_id,
  'executive_summary'::text as report_key,
  'Executive GRC Summary'::text as name_en,
  'ملخص الحوكمة والمخاطر التنفيذي'::text as name_ar,
  'v_executive_grc_summary'::text as source_view,
  'Executive'::text as category_en,
  'تنفيذي'::text as category_ar,
  true as printable,
  true as exportable
from organizations o
union all
select o.id, 'backup_health_check', 'Backup Health Check', 'فحص سلامة النسخ الاحتياطي', 'v_backup_health_check', 'System health', 'سلامة النظام', true, true from organizations o
union all
select o.id, 'workflow_blockers', 'Workflow Blockers', 'عوائق سير العمل', 'v_workflow_blockers', 'Workflow', 'سير العمل', true, true from organizations o
union all
select o.id, 'department_heatmap', 'Department Risk Heatmap', 'الخريطة الحرارية لمخاطر الأقسام', 'v_department_risk_heatmap', 'Analytics', 'تحليلات', true, true from organizations o
union all
select o.id, 'ovr_risk_indicators', 'OVR Risk Indicators', 'مؤشرات مخاطر OVR', 'v_ovr_risk_indicators', 'Quality', 'الجودة', true, true from organizations o;

-- ---------------------------------------------------------
-- Seed system report definitions for all organizations.
-- ---------------------------------------------------------
insert into report_definitions (
  organization_id, name_en, name_ar, description_en, description_ar,
  report_key, source_view, default_format, filters, columns, is_system
)
select
  o.id,
  r.name_en,
  r.name_ar,
  'System report available for print/export from the reporting center.',
  'تقرير نظام متاح للطباعة/التصدير من مركز التقارير.',
  r.report_key,
  r.source_view,
  'csv',
  '{}'::jsonb,
  '[]'::jsonb,
  true
from organizations o
join v_print_report_index r on r.organization_id = o.id
on conflict (organization_id, report_key) do update set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  source_view = excluded.source_view,
  updated_at = now();

-- ---------------------------------------------------------
-- Snapshot helper for admins before backup/export.
-- ---------------------------------------------------------
create or replace function create_system_health_snapshot(p_organization_id uuid, p_created_by uuid default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_data jsonb;
  v_critical integer;
  v_high integer;
  v_medium integer;
  v_low integer;
begin
  select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb)
  into v_data
  from v_backup_health_check h
  where h.organization_id = p_organization_id;

  select
    coalesce(sum(case when severity = 'critical' and record_count > 0 then 1 else 0 end),0),
    coalesce(sum(case when severity = 'high' and record_count > 0 then 1 else 0 end),0),
    coalesce(sum(case when severity = 'medium' and record_count > 0 then 1 else 0 end),0),
    coalesce(sum(case when severity = 'low' and record_count > 0 then 1 else 0 end),0)
  into v_critical, v_high, v_medium, v_low
  from v_backup_health_check
  where organization_id = p_organization_id;

  insert into system_health_snapshots (
    organization_id, snapshot_type, total_critical, total_high, total_medium, total_low, snapshot_data, created_by
  ) values (
    p_organization_id, 'pre_backup', v_critical, v_high, v_medium, v_low, v_data, p_created_by
  ) returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------
create index if not exists idx_export_logs_org_created on export_logs(organization_id, created_at desc);
create index if not exists idx_backup_packages_org_created on backup_packages(organization_id, created_at desc);
create index if not exists idx_report_definitions_org_active on report_definitions(organization_id, is_active);
create index if not exists idx_health_snapshots_org_created on system_health_snapshots(organization_id, created_at desc);

-- ---------------------------------------------------------
-- RLS policies. These are intentionally conservative and rely on
-- existing role policies for data source tables. Metadata is visible
-- to authenticated users; writes require authentication.
-- ---------------------------------------------------------
alter table export_logs enable row level security;
alter table backup_packages enable row level security;
alter table report_definitions enable row level security;
alter table system_health_snapshots enable row level security;

drop policy if exists "Authenticated can read export logs" on export_logs;
create policy "Authenticated can read export logs" on export_logs
for select to authenticated using (true);

drop policy if exists "Authenticated can insert export logs" on export_logs;
create policy "Authenticated can insert export logs" on export_logs
for insert to authenticated with check (true);

drop policy if exists "Authenticated can read backup packages" on backup_packages;
create policy "Authenticated can read backup packages" on backup_packages
for select to authenticated using (true);

drop policy if exists "Authenticated can insert backup packages" on backup_packages;
create policy "Authenticated can insert backup packages" on backup_packages
for insert to authenticated with check (true);

drop policy if exists "Authenticated can read report definitions" on report_definitions;
create policy "Authenticated can read report definitions" on report_definitions
for select to authenticated using (is_active = true);

drop policy if exists "Authenticated can manage own report definitions" on report_definitions;
create policy "Authenticated can manage own report definitions" on report_definitions
for all to authenticated using (created_by = auth.uid() or is_system = true) with check (created_by = auth.uid() or is_system = false);

drop policy if exists "Authenticated can read health snapshots" on system_health_snapshots;
create policy "Authenticated can read health snapshots" on system_health_snapshots
for select to authenticated using (true);

drop policy if exists "Authenticated can insert health snapshots" on system_health_snapshots;
create policy "Authenticated can insert health snapshots" on system_health_snapshots
for insert to authenticated with check (true);
