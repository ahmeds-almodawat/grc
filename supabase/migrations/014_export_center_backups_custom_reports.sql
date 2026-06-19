-- =========================================================
-- GRC Control Center - Migration 014
-- Export Center, external backup metadata and custom reports
-- =========================================================

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type export_job_status as enum ('queued', 'processing', 'completed', 'failed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type export_job_type as enum ('dataset', 'report', 'backup');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type data_export_format as enum ('csv', 'json', 'backup_json', 'report_json');
exception when duplicate_object then null;
end $$;

-- =========================
-- CUSTOM REPORT DEFINITIONS
-- =========================

create table if not exists custom_report_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  report_key text not null,
  name_en text not null,
  name_ar text,
  description text,

  datasets text[] not null default '{}',
  filters jsonb not null default '{}'::jsonb,
  columns jsonb not null default '{}'::jsonb,

  is_active boolean not null default true,

  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, report_key)
);

-- =========================
-- DATA EXPORT / BACKUP LOG
-- =========================

create table if not exists data_export_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  export_type export_job_type not null default 'dataset',
  dataset_key text,
  report_definition_id uuid references custom_report_definitions(id) on delete set null,

  export_format data_export_format not null default 'csv',
  file_name text,
  row_count integer not null default 0 check (row_count >= 0),
  filters jsonb not null default '{}'::jsonb,

  status export_job_status not null default 'completed',
  status_message text,

  generated_by uuid references profiles(id) on delete set null,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- BACKUP RUN METADATA
-- This tracks backup packages created externally; actual JSON is downloaded by browser.
-- =========================

create table if not exists backup_run_metadata (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  backup_name text not null,
  included_datasets text[] not null default '{}',
  row_counts jsonb not null default '{}'::jsonb,
  total_rows integer not null default 0 check (total_rows >= 0),
  file_name text,
  backup_note text,

  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================
-- TRIGGERS
-- =========================

drop trigger if exists trg_custom_report_definitions_updated_at on custom_report_definitions;
create trigger trg_custom_report_definitions_updated_at
before update on custom_report_definitions
for each row execute function set_updated_at();

drop trigger if exists trg_data_export_jobs_updated_at on data_export_jobs;
create trigger trg_data_export_jobs_updated_at
before update on data_export_jobs
for each row execute function set_updated_at();

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_custom_reports_org_active on custom_report_definitions(organization_id, is_active);
create index if not exists idx_custom_reports_key on custom_report_definitions(report_key);
create index if not exists idx_data_export_jobs_org_created on data_export_jobs(organization_id, created_at desc);
create index if not exists idx_data_export_jobs_type on data_export_jobs(export_type, status);
create index if not exists idx_data_export_jobs_dataset on data_export_jobs(dataset_key);
create index if not exists idx_backup_run_metadata_org_created on backup_run_metadata(organization_id, created_at desc);

-- =========================
-- DATASET CATALOG VIEW
-- =========================

create or replace view v_export_dataset_catalog as
select * from (
  values
    ('projects', 'Projects & action plans', 'المشاريع وخطط العمل', 'medium', 'Major controlled initiatives, owners, dates, status and risk level'),
    ('milestones', 'Milestones', 'المعالم', 'medium', 'Timeline milestones and evidence requirements'),
    ('tasks', 'Tasks', 'المهام', 'medium', 'Assigned task-level work and delay reasons'),
    ('risks', 'Risk register', 'سجل المخاطر', 'high', 'Inherent/residual risk scoring and owners'),
    ('compliance', 'Compliance calendar', 'تقويم الالتزام', 'high', 'Regulatory obligations, expiry dates and owners'),
    ('audit_findings', 'Audit findings', 'ملاحظات المراجعة', 'high', 'Audit findings, corrective actions and closure status'),
    ('ovr_reports', 'OVR reports', 'بلاغات OVR', 'critical', 'Confidential OVR report metadata'),
    ('ovr_risk_indicators', 'OVR risk indicators', 'مؤشرات مخاطر OVR', 'high', 'Department OVR risk signals'),
    ('approvals', 'Approvals', 'الموافقات', 'medium', 'Approval workflow rows'),
    ('evidence', 'Evidence queue', 'قائمة الأدلة', 'high', 'Evidence review metadata'),
    ('escalations', 'Escalations', 'التصعيدات', 'high', 'Open and resolved escalation events'),
    ('departments', 'Departments', 'الإدارات', 'low', 'Department master list'),
    ('users', 'User access matrix', 'مصفوفة صلاحيات المستخدمين', 'critical', 'User role/access matrix'),
    ('kpi_scorecard', 'KPI scorecard', 'بطاقة مؤشرات الأداء', 'medium', 'Executive KPI summary'),
    ('department_heatmap', 'Department heatmap', 'الخريطة الحرارية للإدارات', 'medium', 'Department pressure scores')
) as catalog(dataset_key, label_en, label_ar, sensitivity, description);

-- =========================
-- EXPORT CENTER SUMMARY VIEW
-- =========================

create or replace view v_export_center_summary as
select
  o.id as organization_id,
  (
    select count(*)
    from custom_report_definitions cr
    where cr.organization_id = o.id
      and cr.is_active = true
  ) as custom_reports,
  (
    select count(*)
    from data_export_jobs dej
    where dej.organization_id = o.id
      and dej.export_type = 'dataset'
      and dej.created_at >= now() - interval '30 days'
  ) as exports_30d,
  (
    select count(*)
    from data_export_jobs dej
    where dej.organization_id = o.id
      and dej.export_type = 'backup'
      and dej.created_at >= now() - interval '30 days'
  ) as backups_30d,
  (
    select count(*) from v_export_dataset_catalog
  ) as available_datasets,
  (
    select max(dej.created_at)
    from data_export_jobs dej
    where dej.organization_id = o.id
      and dej.export_type in ('dataset', 'report')
  ) as last_export_at,
  (
    select max(dej.created_at)
    from data_export_jobs dej
    where dej.organization_id = o.id
      and dej.export_type = 'backup'
  ) as last_backup_at
from organizations o;

-- =========================
-- SEED DEFAULT REPORT DEFINITIONS
-- =========================

insert into custom_report_definitions (organization_id, report_key, name_en, name_ar, description, datasets, filters, columns)
select
  o.id,
  preset.report_key,
  preset.name_en,
  preset.name_ar,
  preset.description,
  preset.datasets,
  preset.filters,
  '{}'::jsonb
from organizations o
cross join (
  values
    ('executive_grc_pack', 'Executive GRC pack', 'حزمة الحوكمة التنفيذية', 'Board/CEO weekly report pack.', array['kpi_scorecard','department_heatmap','projects','risks','compliance','audit_findings','ovr_risk_indicators'], '{"scope":"executive"}'::jsonb),
    ('quality_ovr_pack', 'Quality & OVR pack', 'حزمة الجودة و OVR', 'Quality and patient-safety incident report pack.', array['ovr_reports','ovr_risk_indicators','evidence','projects'], '{"scope":"quality","period_days":90}'::jsonb),
    ('department_control_pack', 'Department control pack', 'حزمة تحكم الإدارات', 'Department execution and escalation report pack.', array['department_heatmap','projects','milestones','tasks','escalations'], '{"scope":"department"}'::jsonb),
    ('audit_compliance_pack', 'Audit & compliance pack', 'حزمة المراجعة والالتزام', 'Audit and regulatory follow-up pack.', array['compliance','audit_findings','risks','evidence'], '{"scope":"audit_compliance"}'::jsonb)
) as preset(report_key, name_en, name_ar, description, datasets, filters)
on conflict (organization_id, report_key) do nothing;

-- =========================
-- RLS
-- =========================

alter table custom_report_definitions enable row level security;
alter table data_export_jobs enable row level security;
alter table backup_run_metadata enable row level security;

drop policy if exists custom_reports_select on custom_report_definitions;
create policy custom_reports_select on custom_report_definitions
for select using (public.can_access_org(organization_id));

drop policy if exists custom_reports_manage on custom_report_definitions;
create policy custom_reports_manage on custom_report_definitions
for all using (public.can_manage_grc())
with check (public.can_manage_grc());

drop policy if exists data_export_jobs_select on data_export_jobs;
create policy data_export_jobs_select on data_export_jobs
for select using (public.can_access_org(organization_id));

drop policy if exists data_export_jobs_insert on data_export_jobs;
create policy data_export_jobs_insert on data_export_jobs
for insert with check (public.can_access_org(organization_id));

drop policy if exists data_export_jobs_manage on data_export_jobs;
create policy data_export_jobs_manage on data_export_jobs
for update using (public.can_manage_grc())
with check (public.can_manage_grc());

drop policy if exists backup_run_metadata_select on backup_run_metadata;
create policy backup_run_metadata_select on backup_run_metadata
for select using (public.can_access_org(organization_id));

drop policy if exists backup_run_metadata_insert on backup_run_metadata;
create policy backup_run_metadata_insert on backup_run_metadata
for insert with check (public.can_manage_grc());
