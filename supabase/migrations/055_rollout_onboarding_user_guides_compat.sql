-- =========================================================
-- GRC Control Center - Migration 016
-- Rollout onboarding, user guide checklist and setup readiness
-- =========================================================

create table if not exists grc_training_checklist (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  audience text not null check (audience in ('executive','governance','department_manager','quality','auditor','employee')),
  title_en text not null,
  title_ar text not null,
  objective_en text not null,
  objective_ar text not null,
  estimated_minutes integer not null default 20 check (estimated_minutes > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rollout_waves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  wave_name_en text not null,
  wave_name_ar text,
  wave_number integer not null default 1 check (wave_number > 0),
  target_start_date date,
  target_end_date date,
  scope_description text,
  owner_id uuid references profiles(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','in_progress','paused','completed','cancelled')),
  readiness_notes text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rollout_wave_departments (
  id uuid primary key default gen_random_uuid(),
  wave_id uuid not null references rollout_waves(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  training_completed boolean not null default false,
  users_imported boolean not null default false,
  access_reviewed boolean not null default false,
  first_backup_done boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (wave_id, department_id)
);

create table if not exists restore_dry_run_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  backup_package_id uuid references backup_packages(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','running','passed','failed','cancelled')),
  tested_by uuid references profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  findings text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function set_grc_training_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_grc_training_checklist_updated_at on grc_training_checklist;
create trigger trg_grc_training_checklist_updated_at
before update on grc_training_checklist
for each row execute function set_grc_training_updated_at();

drop trigger if exists trg_rollout_waves_updated_at on rollout_waves;
create trigger trg_rollout_waves_updated_at
before update on rollout_waves
for each row execute function set_grc_training_updated_at();

create index if not exists idx_grc_training_audience on grc_training_checklist(audience, is_active);
create index if not exists idx_rollout_waves_org_status on rollout_waves(organization_id, status);
create index if not exists idx_rollout_wave_departments_wave on rollout_wave_departments(wave_id);
create index if not exists idx_restore_dry_run_jobs_org_status on restore_dry_run_jobs(organization_id, status);

insert into grc_training_checklist (audience, title_en, title_ar, objective_en, objective_ar, estimated_minutes, sort_order)
values
('executive', 'Executive control room review', 'مراجعة غرفة التحكم التنفيذية', 'Read critical risks, major OVRs, overdue actions and pending approvals.', 'قراءة المخاطر الحرجة وبلاغات OVR الكبرى والإجراءات المتأخرة والموافقات المعلقة.', 20, 10),
('governance', 'Workflow enforcement and escalations', 'فرض سير العمل والتصعيدات', 'Monitor delay reasons, evidence discipline, escalations and governance decisions.', 'متابعة أسباب التأخير وانضباط الأدلة والتصعيدات وقرارات الحوكمة.', 30, 20),
('department_manager', 'Department action ownership', 'ملكية إجراءات الإدارة', 'Update milestones, own delay reasons and upload evidence before closure.', 'تحديث المعالم وامتلاك أسباب التأخير ورفع الأدلة قبل الإغلاق.', 30, 30),
('quality', 'OVR investigation and closure', 'تحقيق وإغلاق بلاغات OVR', 'Review OVRs, confirm severity, request evidence and close only after Quality approval.', 'مراجعة بلاغات OVR وتأكيد الشدة وطلب الأدلة والإغلاق بعد اعتماد الجودة فقط.', 35, 40),
('auditor', 'Audit finding closure control', 'ضبط إغلاق ملاحظات المراجعة', 'Create findings, review evidence and reject weak corrective actions.', 'إنشاء الملاحظات ومراجعة الأدلة ورفض الإجراءات التصحيحية الضعيفة.', 30, 50),
('employee', 'My Work and OVR basics', 'أساسيات أعمالي وبلاغات OVR', 'Use My Work, submit evidence, and report OVR facts clearly.', 'استخدام صفحة أعمالي ورفع الأدلة وتقديم بلاغات OVR بوضوح وموضوعية.', 20, 60)
on conflict do nothing;

create or replace view v_setup_readiness_checklist as
with org as (
  select id as organization_id from organizations where is_active = true limit 1
), counts as (
  select
    o.organization_id,
    (select count(*) from divisions d where d.organization_id = o.organization_id and d.is_active = true) as active_divisions,
    (select count(*) from departments d where d.organization_id = o.organization_id and d.is_active = true) as active_departments,
    (select count(*) from units u where u.organization_id = o.organization_id and u.is_active = true) as active_units,
    (select count(*) from profiles p where p.organization_id = o.organization_id and p.is_active = true) as active_users,
    (select count(*) from user_roles ur where ur.organization_id = o.organization_id and ur.is_active = true) as active_roles,
    (select count(*) from user_roles ur where ur.organization_id = o.organization_id and ur.is_active = true and ur.role = 'super_admin') as super_admins,
    (select count(*) from user_roles ur where ur.organization_id = o.organization_id and ur.is_active = true and ur.role = 'governance_admin') as governance_admins,
    (select count(*) from user_roles ur where ur.organization_id = o.organization_id and ur.is_active = true and ur.role in ('compliance_officer','auditor')) as control_reviewers,
    (select count(*) from projects p where p.organization_id = o.organization_id and p.status not in ('closed','cancelled') and p.owner_id is null) as projects_missing_owner,
    (select count(*) from tasks t where t.organization_id = o.organization_id and t.status not in ('closed','cancelled','approved') and t.due_date is null) as tasks_missing_due_date,
    (select count(*) from ovr_reports r where r.organization_id = o.organization_id and r.status in ('submitted','under_supervisor_review','under_quality_review','action_plan_required','corrective_action_in_progress','evidence_submitted')) as open_ovrs,
    (select count(*) from backup_packages b where b.organization_id = o.organization_id and b.created_at >= now() - interval '14 days') as recent_backups,
    (select count(*) from custom_report_definitions cr where cr.organization_id = o.organization_id and cr.is_active = true) as active_reports
  from org o
)
select
  'organization_structure'::text as check_key,
  'Organization structure'::text as title_en,
  'الهيكل التنظيمي'::text as title_ar,
  'Divisions, departments and units/stations are ready for assignment.'::text as description_en,
  'تم تجهيز القطاعات والإدارات والوحدات/المحطات للتكليف.'::text as description_ar,
  'organization'::text as area,
  case when active_departments >= 50 then 'good' when active_departments >= 10 then 'warning' else 'critical' end::text as severity,
  active_departments::integer as current_count,
  50::integer as target_count,
  (active_departments >= 50) as is_complete,
  'Import all departments and unit/station codes before full rollout.'::text as action_hint_en,
  'استورد جميع الإدارات وأكواد الوحدات/المحطات قبل التشغيل الكامل.'::text as action_hint_ar
from counts
union all
select 'active_users','Active users','المستخدمون النشطون','Employees have profiles ready for role assignment.','الموظفون لديهم ملفات جاهزة لتعيين الصلاحيات.','users',
  case when active_users >= 1000 then 'good' when active_users >= 100 then 'warning' else 'critical' end,
  active_users::integer, 1000::integer, active_users >= 1000,
  'Import employees in waves, then review access warnings.','استورد الموظفين على دفعات ثم راجع تنبيهات الصلاحيات.'
from counts
union all
select 'critical_roles','Critical admin/control roles','أدوار التحكم الحرجة','Super Admin, Governance Admin and control reviewers are assigned.','تم تعيين المسؤول العام ومسؤول الحوكمة ومراجعي التحكم.','users',
  case when super_admins >= 1 and governance_admins >= 1 and control_reviewers >= 1 then 'good' else 'critical' end,
  (super_admins + governance_admins + control_reviewers)::integer, 3::integer, super_admins >= 1 and governance_admins >= 1 and control_reviewers >= 1,
  'Assign at least one Super Admin, Governance Admin and Quality/Audit reviewer.','عيّن على الأقل مسؤولاً عاماً ومسؤول حوكمة ومراجع جودة/مراجعة.'
from counts
union all
select 'workflow_ownership','Workflow ownership','ملكية سير العمل','Active projects and tasks have owners and due dates.','المشاريع والمهام النشطة لها مسؤولون وتواريخ استحقاق.','workflow',
  case when projects_missing_owner = 0 and tasks_missing_due_date = 0 then 'good' when projects_missing_owner <= 5 and tasks_missing_due_date <= 10 then 'warning' else 'critical' end,
  (projects_missing_owner + tasks_missing_due_date)::integer, 0::integer, projects_missing_owner = 0 and tasks_missing_due_date = 0,
  'Fix missing owners and due dates before department launch.','عالج غياب المسؤولين وتواريخ الاستحقاق قبل إطلاق الإدارات.'
from counts
union all
select 'ovr_operational','OVR operational readiness','جاهزية تشغيل OVR','OVR reports can be investigated, reviewed by Quality and closed with evidence.','يمكن التحقيق في بلاغات OVR ومراجعتها من الجودة وإغلاقها بالأدلة.','ovr',
  case when open_ovrs = 0 then 'good' when open_ovrs <= 20 then 'warning' else 'critical' end,
  open_ovrs::integer, 0::integer, open_ovrs = 0,
  'Train Quality and department managers before enabling wide OVR submission.','درّب الجودة ومديري الإدارات قبل تفعيل تقديم OVR على نطاق واسع.'
from counts
union all
select 'backup_readiness','Backup/export readiness','جاهزية النسخ والتصدير','A recent backup/export package exists before rollout changes.','توجد نسخة تصدير حديثة قبل تغييرات التشغيل.','backup',
  case when recent_backups >= 1 then 'good' else 'warning' end,
  recent_backups::integer, 1::integer, recent_backups >= 1,
  'Create an export package before large imports, migrations or permission changes.','أنشئ حزمة تصدير قبل الاستيرادات الكبيرة أو الترحيلات أو تغييرات الصلاحيات.'
from counts
union all
select 'custom_reports','Custom report templates','قوالب التقارير المخصصة','Executive and department report definitions are available.','تتوفر تعريفات تقارير تنفيذية وتقارير للإدارات.','reports',
  case when active_reports >= 4 then 'good' when active_reports >= 1 then 'warning' else 'critical' end,
  active_reports::integer, 4::integer, active_reports >= 4,
  'Create executive, OVR, department and audit/compliance report packs.','أنشئ حزم تقارير تنفيذية وOVR والإدارات والمراجعة/الالتزام.'
from counts;

-- RLS
alter table grc_training_checklist enable row level security;
alter table rollout_waves enable row level security;
alter table rollout_wave_departments enable row level security;
alter table restore_dry_run_jobs enable row level security;

drop policy if exists grc_training_read_all_authenticated on grc_training_checklist;
create policy grc_training_read_all_authenticated on grc_training_checklist
for select using (auth.role() = 'authenticated');

drop policy if exists rollout_waves_read_all_authenticated on rollout_waves;
create policy rollout_waves_read_all_authenticated on rollout_waves
for select using (auth.role() = 'authenticated');

drop policy if exists rollout_wave_departments_read_all_authenticated on rollout_wave_departments;
create policy rollout_wave_departments_read_all_authenticated on rollout_wave_departments
for select using (auth.role() = 'authenticated');

drop policy if exists restore_dry_run_jobs_read_all_authenticated on restore_dry_run_jobs;
create policy restore_dry_run_jobs_read_all_authenticated on restore_dry_run_jobs
for select using (auth.role() = 'authenticated');
