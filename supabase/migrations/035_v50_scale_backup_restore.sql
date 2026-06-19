-- =========================================================
-- GRC Control Center v5.0
-- Scale readiness, query optimization, production backup,
-- and restore dry-run execution controls
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type v50_control_status as enum ('not_started','in_progress','passed','warning','blocked','waived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type v50_priority as enum ('critical','high','medium','low');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type v50_backup_type as enum ('database','storage','auth_users','browser_export','full_platform','restore_dryrun');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type v50_restore_result as enum ('not_started','running','passed','failed','partial','waived');
exception when duplicate_object then null;
end $$;

-- =========================
-- SCALE TEST PLANS
-- =========================

create table if not exists v50_scale_test_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique,
  title_en text not null,
  title_ar text,
  target_departments integer not null default 50,
  target_users integer not null default 1000,
  target_projects integer not null default 120,
  target_tasks integer not null default 1500,
  target_ovrs integer not null default 500,
  target_risks integer not null default 300,
  target_evidence_files integer not null default 800,
  status v50_control_status not null default 'not_started',
  owner_name text,
  planned_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists v50_scale_test_results (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references v50_scale_test_plans(id) on delete cascade,
  metric_name text not null,
  metric_name_ar text,
  measured_value numeric(18,2),
  target_value numeric(18,2),
  unit text default 'ms',
  status v50_control_status not null default 'not_started',
  measured_at timestamptz default now(),
  notes text
);

-- =========================
-- QUERY OPTIMIZATION QUEUE
-- =========================

create table if not exists v50_query_optimization_items (
  id uuid primary key default gen_random_uuid(),
  object_name text not null,
  object_type text not null default 'view',
  page_or_module text,
  risk_reason text not null,
  recommendation text not null,
  priority v50_priority not null default 'medium',
  status v50_control_status not null default 'not_started',
  owner_name text,
  evidence_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- PRODUCTION BACKUP STRATEGY
-- =========================

create table if not exists v50_backup_strategy_items (
  id uuid primary key default gen_random_uuid(),
  backup_type v50_backup_type not null,
  title_en text not null,
  title_ar text,
  required_frequency text not null default 'daily',
  owner_name text,
  storage_location text,
  verification_method text,
  escalation_owner text,
  status v50_control_status not null default 'not_started',
  last_verified_at timestamptz,
  next_due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists v50_backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_type v50_backup_type not null,
  run_label text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status v50_control_status not null default 'in_progress',
  size_mb numeric(18,2),
  file_count integer,
  storage_location text,
  performed_by text,
  verification_note text,
  failure_reason text,
  created_at timestamptz not null default now()
);

-- =========================
-- RESTORE DRY RUNS
-- =========================

create table if not exists v50_restore_dryrun_jobs (
  id uuid primary key default gen_random_uuid(),
  job_code text not null unique,
  title_en text not null,
  title_ar text,
  source_backup_run_id uuid references v50_backup_runs(id) on delete set null,
  restore_environment text not null default 'staging',
  planned_date date,
  started_at timestamptz,
  completed_at timestamptz,
  result v50_restore_result not null default 'not_started',
  owner_name text,
  approver_name text,
  approval_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists v50_restore_dryrun_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references v50_restore_dryrun_jobs(id) on delete cascade,
  step_order integer not null default 1,
  title_en text not null,
  title_ar text,
  expected_result text,
  actual_result text,
  status v50_control_status not null default 'not_started',
  evidence_reference text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================
-- INDEX SUPPORT
-- =========================

-- Safe indexes for common high-volume access patterns. Some may already exist from prior migrations.
create index if not exists idx_projects_org_status_due_v50 on projects(organization_id, status, target_end_date);
create index if not exists idx_tasks_org_assigned_status_due_v50 on tasks(organization_id, assigned_to, status, due_date);
create index if not exists idx_tasks_org_owner_status_due_v50 on tasks(organization_id, owner_id, status, due_date);
create index if not exists idx_milestones_org_owner_status_due_v50 on milestones(organization_id, owner_id, status, due_date);
create index if not exists idx_approvals_org_approver_status_v50 on approvals(organization_id, approver_id, status);
create index if not exists idx_evidence_org_status_created_v50 on evidence_files(organization_id, status, created_at desc);
create index if not exists idx_audit_logs_org_table_created_v50 on audit_logs(organization_id, table_name, created_at desc);
create index if not exists idx_notifications_user_created_v50 on notifications(user_id, created_at desc);

-- Optional indexes only if these tables exist; dynamic execution avoids install failure if earlier optional modules differ.
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='ovr_reports') then
    execute 'create index if not exists idx_ovr_org_status_severity_v50 on ovr_reports(organization_id, status, severity_level)';
    execute 'create index if not exists idx_ovr_org_department_created_v50 on ovr_reports(organization_id, department_id, created_at desc)';
  end if;
end $$;

-- =========================
-- SCORECARD VIEWS
-- =========================

create or replace view v_v50_scale_readiness_scorecard as
select
  count(*) as total_controls,
  count(*) filter (where status = 'passed') as passed_controls,
  count(*) filter (where status = 'blocked') as blocked_controls,
  count(*) filter (where status = 'warning') as warning_controls,
  case
    when count(*) = 0 then 0
    else round((count(*) filter (where status = 'passed'))::numeric * 100 / count(*), 2)
  end as readiness_percent
from v50_scale_test_plans;

create or replace view v_v50_query_optimization_queue as
select
  id,
  object_name,
  object_type,
  page_or_module,
  risk_reason,
  recommendation,
  priority,
  status,
  owner_name,
  evidence_note,
  created_at,
  updated_at
from v50_query_optimization_items
order by
  case priority when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
  created_at;

create or replace view v_v50_backup_restore_scorecard as
select
  (select count(*) from v50_backup_strategy_items) as backup_controls,
  (select count(*) from v50_backup_strategy_items where status='passed') as backup_passed,
  (select count(*) from v50_backup_strategy_items where status='blocked') as backup_blocked,
  (select count(*) from v50_backup_runs where created_at >= now() - interval '7 days') as backup_runs_last_7_days,
  (select count(*) from v50_restore_dryrun_jobs where result='passed') as restore_dryruns_passed,
  (select count(*) from v50_restore_dryrun_jobs where result in ('failed','partial')) as restore_dryruns_with_issues;

create or replace view v_v50_restore_dryrun_queue as
select
  j.id,
  j.job_code,
  j.title_en,
  j.title_ar,
  j.restore_environment,
  j.planned_date,
  j.result,
  j.owner_name,
  j.approver_name,
  count(s.id) as total_steps,
  count(s.id) filter (where s.status='passed') as passed_steps,
  count(s.id) filter (where s.status='blocked') as blocked_steps,
  j.created_at,
  j.updated_at
from v50_restore_dryrun_jobs j
left join v50_restore_dryrun_steps s on s.job_id = j.id
group by j.id
order by j.planned_date nulls last, j.created_at desc;

-- =========================
-- SEED DEFAULTS
-- =========================

create or replace function seed_v50_scale_backup_restore_defaults()
returns void as $$
declare
  restore_job_id uuid;
begin
  insert into v50_scale_test_plans (plan_code, title_en, title_ar, target_departments, target_users, target_projects, target_tasks, target_ovrs, target_risks, status, owner_name)
  values
    ('SCALE-1000-USERS', '1,000 user / 50 department scale simulation', 'محاكاة 1000 مستخدم و50 قسم', 50, 1000, 120, 1500, 500, 300, 'not_started', 'System Admin'),
    ('SCALE-DASHBOARD', 'Executive dashboard load timing', 'قياس سرعة لوحة التحكم التنفيذية', 50, 1000, 120, 1500, 500, 300, 'not_started', 'IT'),
    ('SCALE-SEARCH', 'Global search response timing', 'قياس سرعة البحث الشامل', 50, 1000, 120, 1500, 500, 300, 'not_started', 'IT')
  on conflict (plan_code) do nothing;

  insert into v50_query_optimization_items (object_name, object_type, page_or_module, risk_reason, recommendation, priority, status)
  values
    ('v_global_search_index', 'view', 'Global Search', 'Can become heavy as records grow', 'Confirm indexes on linked source tables and apply pagination/limit defaults.', 'high', 'not_started'),
    ('v_executive_command_summary', 'view', 'Executive Command Center', 'Executive dashboard may scan multiple objects', 'Use summary views and avoid loading detail tables on first paint.', 'high', 'not_started'),
    ('v_v34_pilot_wave_summary', 'view', 'Pilot Operations', 'Pilot dashboard may grow with waves/issues', 'Keep queue limited and export full detail only on demand.', 'medium', 'not_started'),
    ('evidence_files', 'table', 'Evidence Center', 'Evidence metadata can grow quickly', 'Default to recent/pending evidence with filters and pagination.', 'high', 'not_started'),
    ('audit_logs', 'table', 'Security/Audit', 'Audit logs become large in production', 'Use date filters and retention/archive strategy.', 'critical', 'not_started')
  on conflict do nothing;

  insert into v50_backup_strategy_items (backup_type, title_en, title_ar, required_frequency, owner_name, verification_method, escalation_owner, status)
  values
    ('database', 'PostgreSQL/Supabase database backup', 'نسخة احتياطية لقاعدة بيانات Supabase/PostgreSQL', 'daily', 'IT / System Admin', 'Restore sample database and compare table counts', 'Executive Sponsor', 'not_started'),
    ('storage', 'Supabase Storage evidence backup', 'نسخة احتياطية لملفات الأدلة في Supabase Storage', 'daily', 'IT / System Admin', 'Verify file count and sample file open test', 'Executive Sponsor', 'not_started'),
    ('auth_users', 'Auth/user recovery plan', 'خطة استرجاع المستخدمين والصلاحيات', 'weekly', 'System Admin', 'User access sample verification', 'Governance Admin', 'not_started'),
    ('browser_export', 'Browser export package', 'حزمة التصدير من المتصفح', 'weekly', 'Governance Admin', 'Open exported JSON/CSV and verify core sections', 'Governance Admin', 'not_started'),
    ('restore_dryrun', 'Restore dry-run proof', 'إثبات تجربة الاسترجاع', 'monthly', 'IT / System Admin', 'Documented restore drill with signoff', 'Executive Sponsor', 'not_started')
  on conflict do nothing;

  insert into v50_restore_dryrun_jobs (job_code, title_en, title_ar, restore_environment, planned_date, result, owner_name)
  values ('RESTORE-DRYRUN-001', 'First production backup restore dry-run', 'أول تجربة استرجاع من نسخة احتياطية', 'staging', current_date + 7, 'not_started', 'IT / System Admin')
  on conflict (job_code) do nothing;

  select id into restore_job_id from v50_restore_dryrun_jobs where job_code = 'RESTORE-DRYRUN-001';

  if restore_job_id is not null then
    insert into v50_restore_dryrun_steps (job_id, step_order, title_en, title_ar, expected_result, status)
    values
      (restore_job_id, 1, 'Confirm backup source exists', 'تأكيد وجود مصدر النسخة الاحتياطية', 'Backup file/location is accessible', 'not_started'),
      (restore_job_id, 2, 'Restore database to staging', 'استرجاع قاعدة البيانات إلى بيئة تجريبية', 'Database restores without SQL errors', 'not_started'),
      (restore_job_id, 3, 'Verify critical table counts', 'مطابقة عدد السجلات للجداول الحرجة', 'Core table counts match backup report', 'not_started'),
      (restore_job_id, 4, 'Verify evidence storage samples', 'اختبار عينات من ملفات الأدلة', 'Sample evidence files open correctly', 'not_started'),
      (restore_job_id, 5, 'Run application smoke test', 'تشغيل اختبار سريع للتطبيق', 'Home, OVR, dashboards, export pages load', 'not_started'),
      (restore_job_id, 6, 'Document issues and signoff', 'توثيق المشاكل والاعتماد', 'Restore dry-run signed off or action plan created', 'not_started')
    on conflict do nothing;
  end if;
end;
$$ language plpgsql;
