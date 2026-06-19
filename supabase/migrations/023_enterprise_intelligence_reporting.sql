-- =========================================================
-- GRC Control Center - Migration 023
-- Enterprise intelligence, report studio, evidence vault,
-- scheduled backup metadata, department scorecards, board packs
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type public.report_output_format as enum ('csv','json','print','pdf_ready');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.backup_schedule_frequency as enum ('manual','daily','weekly','monthly','quarterly');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.backup_run_status as enum ('planned','running','completed','failed','verified','restore_tested');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scorecard_signal as enum ('excellent','healthy','watch','at_risk','critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scenario_status as enum ('draft','active','under_review','approved','archived');
exception when duplicate_object then null;
end $$;

-- =========================
-- ADVANCED REPORT BUILDER
-- =========================

create table if not exists public.report_builder_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  template_code text not null,
  title_en text not null,
  title_ar text,
  description_en text,
  description_ar text,
  source_view text not null,
  default_columns text[] not null default '{}',
  default_filters jsonb not null default '{}'::jsonb,
  output_formats public.report_output_format[] not null default array['csv','json','print']::public.report_output_format[],
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_code)
);

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  template_id uuid references public.report_builder_templates(id) on delete set null,
  report_title text not null,
  source_view text not null,
  filters jsonb not null default '{}'::jsonb,
  selected_columns text[] not null default '{}',
  output_format public.report_output_format not null default 'csv',
  row_count integer not null default 0,
  status text not null default 'generated',
  file_name text,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now()
);

-- =========================
-- SCHEDULED BACKUP METADATA
-- Note: scheduling metadata only. Real automation should be server-side.
-- =========================

create table if not exists public.backup_schedule_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  plan_code text not null,
  title_en text not null,
  title_ar text,
  frequency public.backup_schedule_frequency not null default 'weekly',
  include_tables text[] not null default array[
    'projects','milestones','tasks','risks','compliance_items','audit_findings','ovr_reports','evidence_files','approvals','profiles','departments','user_roles'
  ],
  include_storage_manifest boolean not null default true,
  require_restore_dry_run boolean not null default true,
  retention_days integer not null default 90 check (retention_days > 0),
  owner_id uuid references public.profiles(id) on delete set null,
  next_due_at timestamptz,
  last_run_at timestamptz,
  last_status public.backup_run_status,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plan_code)
);

create table if not exists public.backup_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  plan_id uuid references public.backup_schedule_plans(id) on delete set null,
  status public.backup_run_status not null default 'planned',
  package_name text,
  row_count integer not null default 0,
  storage_manifest_count integer not null default 0,
  checksum text,
  error_message text,
  restore_dry_run_job_id uuid references public.restore_dry_run_jobs(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null
);

-- =========================
-- EVIDENCE VAULT VERSIONING
-- =========================

create table if not exists public.evidence_file_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_id uuid not null references public.evidence_files(id) on delete cascade,
  version_no integer not null default 1 check (version_no > 0),
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  version_note text,
  checksum text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (evidence_id, version_no)
);

create table if not exists public.evidence_retention_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_id uuid not null references public.evidence_files(id) on delete cascade,
  review_status text not null default 'pending',
  reason text,
  recommended_action text not null default 'keep',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================
-- DEPARTMENT SCORECARDS / TARGETS
-- =========================

create table if not exists public.department_kpi_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  metric_code text not null,
  metric_name_en text not null,
  metric_name_ar text,
  target_value numeric(12,2) not null,
  warning_threshold numeric(12,2),
  critical_threshold numeric(12,2),
  direction text not null default 'lower_is_better' check (direction in ('lower_is_better','higher_is_better')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, department_id, metric_code)
);

create table if not exists public.department_scorecard_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  period_month date not null default date_trunc('month', current_date)::date,
  signal public.scorecard_signal not null default 'watch',
  executive_note text,
  action_required text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================
-- BOARD PACKS / EXECUTIVE BRIEFINGS
-- =========================

create table if not exists public.board_pack_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  pack_title text not null,
  period_start date,
  period_end date,
  summary_json jsonb not null default '{}'::jsonb,
  included_sections text[] not null default '{}',
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz
);

create table if not exists public.executive_briefing_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  note_title text not null,
  note_body text not null,
  note_category text not null default 'executive',
  risk_level public.risk_level not null default 'medium',
  related_department_id uuid references public.departments(id) on delete set null,
  related_project_id uuid references public.projects(id) on delete set null,
  related_risk_id uuid references public.risks(id) on delete set null,
  related_ovr_report_id uuid references public.ovr_reports(id) on delete set null,
  status text not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- SCENARIO PLANNING
-- =========================

create table if not exists public.risk_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  scenario_code text not null,
  title_en text not null,
  title_ar text,
  description text,
  category text not null default 'strategic',
  probability smallint not null default 3 check (probability between 1 and 5),
  impact smallint not null default 3 check (impact between 1 and 5),
  exposure_score integer generated always as (probability * impact) stored,
  estimated_financial_impact numeric(18,2),
  mitigation_summary text,
  trigger_indicators text[] not null default '{}',
  owner_id uuid references public.profiles(id) on delete set null,
  linked_risk_id uuid references public.risks(id) on delete set null,
  linked_project_id uuid references public.projects(id) on delete set null,
  status public.scenario_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, scenario_code)
);

-- =========================
-- UPDATED_AT TRIGGERS
-- =========================

do $$
declare t text;
begin
  foreach t in array array[
    'report_builder_templates','backup_schedule_plans','department_kpi_targets',
    'executive_briefing_notes','risk_scenarios'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- =========================
-- VIEWS
-- =========================

create or replace view public.v_report_builder_catalog as
select
  r.id,
  r.organization_id,
  r.template_code,
  r.title_en,
  coalesce(r.title_ar, r.title_en) as title_ar,
  r.description_en,
  coalesce(r.description_ar, r.description_en) as description_ar,
  r.source_view,
  r.default_columns,
  r.default_filters,
  r.output_formats,
  r.is_system,
  r.is_active,
  r.updated_at,
  coalesce(rr.run_count, 0)::int as run_count,
  rr.last_generated_at
from public.report_builder_templates r
left join (
  select template_id, count(*) as run_count, max(generated_at) as last_generated_at
  from public.report_runs
  group by template_id
) rr on rr.template_id = r.id;

create or replace view public.v_backup_schedule_readiness as
select
  p.id,
  p.organization_id,
  p.plan_code,
  p.title_en,
  coalesce(p.title_ar, p.title_en) as title_ar,
  p.frequency,
  p.next_due_at,
  p.last_run_at,
  p.last_status,
  p.retention_days,
  p.require_restore_dry_run,
  case
    when p.is_active = false then 'inactive'
    when p.last_run_at is null then 'never_run'
    when p.next_due_at is not null and p.next_due_at < now() then 'due_now'
    when p.last_status in ('failed') then 'failed'
    when p.require_restore_dry_run and not exists (
      select 1 from public.restore_dry_run_jobs j
      where j.organization_id = p.organization_id
        and j.created_at >= now() - interval '30 days'
    ) then 'restore_test_due'
    else 'healthy'
  end as readiness_status,
  coalesce(r.run_count, 0)::int as run_count,
  r.last_completed_at
from public.backup_schedule_plans p
left join (
  select plan_id, count(*) as run_count, max(completed_at) as last_completed_at
  from public.backup_schedule_runs
  group by plan_id
) r on r.plan_id = p.id;

create or replace view public.v_evidence_vault_inventory as
select
  e.id,
  e.organization_id,
  e.file_name,
  e.file_path,
  e.file_type,
  e.file_size,
  e.status,
  e.created_at,
  e.reviewed_at,
  coalesce(u.full_name_en, 'Unknown') as uploaded_by_name,
  coalesce(rv.version_count, 0)::int as version_count,
  rv.latest_version_at,
  case
    when e.status = 'rejected' then 'attention'
    when e.reviewed_at is null and e.created_at < now() - interval '14 days' then 'review_overdue'
    when coalesce(rv.version_count, 0) = 0 then 'no_version_record'
    else 'healthy'
  end as vault_status,
  case
    when e.ovr_report_id is not null then 'OVR'
    when e.audit_finding_id is not null then 'Audit'
    when e.compliance_item_id is not null then 'Compliance'
    when e.risk_id is not null then 'Risk'
    when e.project_id is not null then 'Project'
    when e.milestone_id is not null then 'Milestone'
    when e.task_id is not null then 'Task'
    else 'Other'
  end as linked_area
from public.evidence_files e
left join public.profiles u on u.id = e.uploaded_by
left join (
  select evidence_id, count(*) as version_count, max(uploaded_at) as latest_version_at
  from public.evidence_file_versions
  group by evidence_id
) rv on rv.evidence_id = e.id;

create or replace view public.v_department_scorecard_v2 as
select
  d.id as department_id,
  d.organization_id,
  d.name_en as department_name_en,
  coalesce(d.name_ar, d.name_en) as department_name_ar,
  coalesce(p.active_projects, 0)::int as active_projects,
  coalesce(p.overdue_projects, 0)::int as overdue_projects,
  coalesce(t.overdue_tasks, 0)::int as overdue_tasks,
  coalesce(r.critical_risks, 0)::int as critical_risks,
  coalesce(c.expiring_compliance, 0)::int as expiring_compliance,
  coalesce(a.overdue_audit_findings, 0)::int as overdue_audit_findings,
  coalesce(o.major_ovrs, 0)::int as major_ovrs,
  coalesce(o.open_ovrs, 0)::int as open_ovrs,
  greatest(0, 100 - (
    coalesce(p.overdue_projects, 0) * 10 +
    coalesce(t.overdue_tasks, 0) * 4 +
    coalesce(r.critical_risks, 0) * 15 +
    coalesce(c.expiring_compliance, 0) * 8 +
    coalesce(a.overdue_audit_findings, 0) * 10 +
    coalesce(o.major_ovrs, 0) * 12
  ))::int as control_score,
  case
    when (coalesce(r.critical_risks,0) + coalesce(o.major_ovrs,0)) >= 3 then 'critical'::public.scorecard_signal
    when (coalesce(p.overdue_projects,0) + coalesce(a.overdue_audit_findings,0) + coalesce(c.expiring_compliance,0)) >= 5 then 'at_risk'::public.scorecard_signal
    when (coalesce(t.overdue_tasks,0) + coalesce(o.open_ovrs,0)) >= 8 then 'watch'::public.scorecard_signal
    when (coalesce(p.active_projects,0) + coalesce(o.open_ovrs,0)) = 0 then 'healthy'::public.scorecard_signal
    else 'healthy'::public.scorecard_signal
  end as signal,
  coalesce(n.executive_note, '') as latest_executive_note,
  n.created_at as latest_note_at
from public.departments d
left join (
  select department_id, count(*) filter (where status not in ('closed','cancelled')) as active_projects,
         count(*) filter (where target_end_date < current_date and status not in ('closed','cancelled')) as overdue_projects
  from public.projects group by department_id
) p on p.department_id = d.id
left join (
  select
    p.department_id,
    count(*) filter (
      where t.due_date < current_date
        and t.status not in ('closed','approved','cancelled')
    ) as overdue_tasks
  from public.tasks t
  join public.projects p on p.id = t.project_id
  group by p.department_id
) t on t.department_id = d.id
left join (
  select department_id, count(*) filter (where risk_level = 'critical' and status not in ('closed','cancelled')) as critical_risks
  from public.risks group by department_id
) r on r.department_id = d.id
left join (
  select department_id, count(*) filter (where coalesce(expiry_date, due_date) <= current_date + interval '30 days' and status not in ('closed','cancelled')) as expiring_compliance
  from public.compliance_items group by department_id
) c on c.department_id = d.id
left join (
  select department_id, count(*) filter (where due_date < current_date and status not in ('closed','cancelled')) as overdue_audit_findings
  from public.audit_findings group by department_id
) a on a.department_id = d.id
left join (
  select department_id,
         count(*) filter (where status not in ('closed','cancelled')) as open_ovrs,
         count(*) filter (where severity_level in ('level_4','sentinel') and status not in ('closed','cancelled')) as major_ovrs
  from public.ovr_reports group by department_id
) o on o.department_id = d.id
left join lateral (
  select executive_note, created_at
  from public.department_scorecard_notes dn
  where dn.department_id = d.id
  order by dn.created_at desc
  limit 1
) n on true;

create or replace view public.v_board_pack_summary as
select
  o.id as organization_id,
  o.name_en as organization_name_en,
  o.name_ar as organization_name_ar,
  current_date as as_of_date,
  (select count(*) from public.projects p where p.organization_id = o.id and p.status not in ('closed','cancelled'))::int as active_projects,
  (select count(*) from public.risks r where r.organization_id = o.id and r.status not in ('closed','cancelled') and r.risk_level in ('critical','high'))::int as high_open_risks,
  (select count(*) from public.compliance_items c where c.organization_id = o.id and coalesce(c.expiry_date, c.due_date) <= current_date + interval '30 days' and c.status not in ('closed','cancelled'))::int as compliance_due_30_days,
  (select count(*) from public.audit_findings a where a.organization_id = o.id and a.status not in ('closed','cancelled'))::int as open_audit_findings,
  (select count(*) from public.ovr_reports v where v.organization_id = o.id and v.status not in ('closed','cancelled'))::int as open_ovrs,
  (select count(*) from public.approvals ap where ap.organization_id = o.id and ap.status = 'pending')::int as pending_approvals,
  (select count(*) from public.evidence_files e where e.organization_id = o.id and e.status in ('submitted','needs_revision'))::int as evidence_reviews,
  (select round(avg(control_score)) from public.v_department_scorecard_v2 s where s.organization_id = o.id)::int as avg_department_control_score,
  (select count(*) from public.v_department_scorecard_v2 s where s.organization_id = o.id and s.signal in ('critical','at_risk'))::int as departments_at_risk
from public.organizations o;

create or replace view public.v_scenario_matrix as
select
  s.id,
  s.organization_id,
  s.scenario_code,
  s.title_en,
  coalesce(s.title_ar, s.title_en) as title_ar,
  s.category,
  s.probability,
  s.impact,
  s.exposure_score,
  s.estimated_financial_impact,
  s.mitigation_summary,
  s.trigger_indicators,
  coalesce(p.full_name_en, 'Unassigned') as owner_name,
  s.status,
  case
    when s.exposure_score >= 20 then 'critical'
    when s.exposure_score >= 12 then 'high'
    when s.exposure_score >= 6 then 'medium'
    else 'low'
  end as exposure_level,
  s.updated_at
from public.risk_scenarios s
left join public.profiles p on p.id = s.owner_id;

-- =========================
-- RPC HELPERS
-- =========================

create or replace function public.create_board_pack_snapshot(
  p_organization_id uuid,
  p_title text,
  p_period_start date default null,
  p_period_end date default null,
  p_sections text[] default array['summary','department_scorecards','risks','ovr','audit','compliance','backup']
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_summary jsonb;
begin
  select to_jsonb(s) into v_summary
  from public.v_board_pack_summary s
  where s.organization_id = p_organization_id
  limit 1;

  insert into public.board_pack_snapshots (
    organization_id, pack_title, period_start, period_end, summary_json, included_sections, generated_by
  ) values (
    p_organization_id, coalesce(p_title, 'Executive Board Pack'), p_period_start, p_period_end,
    coalesce(v_summary, '{}'::jsonb), p_sections, auth.uid()
  ) returning id into v_id;

  insert into public.audit_logs (organization_id, actor_id, action, table_name, record_id, new_data)
  values (p_organization_id, auth.uid(), 'CREATE_BOARD_PACK_SNAPSHOT', 'board_pack_snapshots', v_id, coalesce(v_summary, '{}'::jsonb));

  return v_id;
end;
$$;

create or replace function public.record_backup_schedule_run(
  p_plan_id uuid,
  p_status public.backup_run_status,
  p_package_name text default null,
  p_row_count integer default 0,
  p_storage_manifest_count integer default 0,
  p_checksum text default null,
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.backup_schedule_plans%rowtype;
  v_id uuid;
begin
  select * into v_plan from public.backup_schedule_plans where id = p_plan_id;
  if not found then
    raise exception 'Backup schedule plan not found';
  end if;

  insert into public.backup_schedule_runs (
    organization_id, plan_id, status, package_name, row_count, storage_manifest_count, checksum, error_message,
    completed_at, created_by
  ) values (
    v_plan.organization_id, p_plan_id, p_status, p_package_name, coalesce(p_row_count,0), coalesce(p_storage_manifest_count,0),
    p_checksum, p_error_message, case when p_status in ('completed','failed','verified','restore_tested') then now() else null end,
    auth.uid()
  ) returning id into v_id;

  update public.backup_schedule_plans
  set last_run_at = now(),
      last_status = p_status,
      next_due_at = case frequency
        when 'daily' then now() + interval '1 day'
        when 'weekly' then now() + interval '7 days'
        when 'monthly' then now() + interval '1 month'
        when 'quarterly' then now() + interval '3 months'
        else next_due_at
      end
  where id = p_plan_id;

  return v_id;
end;
$$;

-- =========================
-- RLS
-- =========================

alter table public.report_builder_templates enable row level security;
alter table public.report_runs enable row level security;
alter table public.backup_schedule_plans enable row level security;
alter table public.backup_schedule_runs enable row level security;
alter table public.evidence_file_versions enable row level security;
alter table public.evidence_retention_reviews enable row level security;
alter table public.department_kpi_targets enable row level security;
alter table public.department_scorecard_notes enable row level security;
alter table public.board_pack_snapshots enable row level security;
alter table public.executive_briefing_notes enable row level security;
alter table public.risk_scenarios enable row level security;

-- Reuse existing helper functions when available from migration 003.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'report_builder_templates','report_runs','backup_schedule_plans','backup_schedule_runs',
    'evidence_file_versions','evidence_retention_reviews','department_kpi_targets','department_scorecard_notes',
    'board_pack_snapshots','executive_briefing_notes','risk_scenarios'
  ] loop
    execute format('drop policy if exists "%s_read" on public.%I', tbl, tbl);
    execute format('create policy "%s_read" on public.%I for select using (public.can_read_organization(organization_id))', tbl, tbl);
    execute format('drop policy if exists "%s_write" on public.%I', tbl, tbl);
    execute format('create policy "%s_write" on public.%I for all using (public.has_any_role(array[''super_admin'',''executive'',''governance_admin'',''auditor'',''compliance_officer'']::public.app_role[])) with check (public.has_any_role(array[''super_admin'',''executive'',''governance_admin'',''auditor'',''compliance_officer'']::public.app_role[]))', tbl, tbl);
  end loop;
end $$;

-- =========================
-- SEED SYSTEM TEMPLATES
-- =========================

insert into public.report_builder_templates (organization_id, template_code, title_en, title_ar, description_en, description_ar, source_view, default_columns, is_system)
select o.id, 'EXEC_BOARD_PACK', 'Executive board pack', 'حزمة مجلس الإدارة التنفيذية',
       'Executive summary across risk, compliance, audit, OVR, projects and backup health.',
       'ملخص تنفيذي للمخاطر والامتثال والمراجعة وبلاغات OVR والمشاريع وصحة النسخ الاحتياطي.',
       'v_board_pack_summary', array['organization_name_en','as_of_date','active_projects','high_open_risks','open_ovrs','pending_approvals','departments_at_risk'], true
from public.organizations o
on conflict (organization_id, template_code) do nothing;

insert into public.report_builder_templates (organization_id, template_code, title_en, title_ar, description_en, description_ar, source_view, default_columns, is_system)
select o.id, 'DEPT_SCORECARD', 'Department scorecards', 'بطاقات أداء الإدارات',
       'Department control score, risk pressure, overdue work and OVR signals.',
       'درجة ضبط الإدارة وضغط المخاطر والأعمال المتأخرة وإشارات OVR.',
       'v_department_scorecard_v2', array['department_name_en','control_score','signal','overdue_projects','critical_risks','major_ovrs','expiring_compliance'], true
from public.organizations o
on conflict (organization_id, template_code) do nothing;

insert into public.report_builder_templates (organization_id, template_code, title_en, title_ar, description_en, description_ar, source_view, default_columns, is_system)
select o.id, 'EVIDENCE_VAULT', 'Evidence vault inventory', 'مخزون خزنة الأدلة',
       'Evidence files, review state, linked area and version health.',
       'ملفات الأدلة وحالة المراجعة ومنطقة الربط وصحة الإصدارات.',
       'v_evidence_vault_inventory', array['file_name','linked_area','status','vault_status','version_count','uploaded_by_name','created_at'], true
from public.organizations o
on conflict (organization_id, template_code) do nothing;

insert into public.backup_schedule_plans (organization_id, plan_code, title_en, title_ar, frequency, retention_days, next_due_at, is_active)
select o.id, 'WEEKLY_GRC_EXPORT', 'Weekly GRC export package', 'حزمة تصدير GRC الأسبوعية', 'weekly', 90, now() + interval '7 days', true
from public.organizations o
on conflict (organization_id, plan_code) do nothing;

insert into public.backup_schedule_plans (organization_id, plan_code, title_en, title_ar, frequency, retention_days, next_due_at, is_active)
select o.id, 'MONTHLY_RESTORE_TEST', 'Monthly restore dry-run control', 'اختبار استعادة شهري تجريبي', 'monthly', 180, now() + interval '30 days', true
from public.organizations o
on conflict (organization_id, plan_code) do nothing;

insert into public.risk_scenarios (organization_id, scenario_code, title_en, title_ar, description, category, probability, impact, estimated_financial_impact, mitigation_summary, trigger_indicators, status)
select o.id, 'SCN-CASH-001', 'Government payer collection delay', 'تأخر تحصيل الجهات الحكومية', 'Cash pressure if large payer delay extends beyond expected cycle.', 'financial', 4, 5, 0, 'Weekly cash forecast, payer escalation and executive collection dashboard.', array['DSO increase','cash runway below threshold','aging over 180 days'], 'active'
from public.organizations o
on conflict (organization_id, scenario_code) do nothing;

insert into public.risk_scenarios (organization_id, scenario_code, title_en, title_ar, description, category, probability, impact, estimated_financial_impact, mitigation_summary, trigger_indicators, status)
select o.id, 'SCN-QUALITY-001', 'Repeated major OVR pattern', 'تكرار بلاغات OVR جسيمة', 'Repeated serious patient-safety incidents in same department or category.', 'clinical', 3, 5, 0, 'Quality RCA, corrective action project, staff training and executive escalation.', array['two level 4 OVRs','sentinel event','overdue corrective action'], 'active'
from public.organizations o
on conflict (organization_id, scenario_code) do nothing;

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_report_templates_org on public.report_builder_templates(organization_id, is_active);
create index if not exists idx_report_runs_org on public.report_runs(organization_id, generated_at desc);
create index if not exists idx_backup_plans_org_due on public.backup_schedule_plans(organization_id, next_due_at);
create index if not exists idx_backup_runs_plan on public.backup_schedule_runs(plan_id, started_at desc);
create index if not exists idx_evidence_versions_evidence on public.evidence_file_versions(evidence_id, version_no desc);
create index if not exists idx_evidence_retention_org on public.evidence_retention_reviews(organization_id, review_status);
create index if not exists idx_department_targets_dept on public.department_kpi_targets(department_id, metric_code);
create index if not exists idx_board_packs_org on public.board_pack_snapshots(organization_id, generated_at desc);
create index if not exists idx_briefing_notes_org on public.executive_briefing_notes(organization_id, status, risk_level);
create index if not exists idx_risk_scenarios_org on public.risk_scenarios(organization_id, exposure_score desc);
