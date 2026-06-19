-- =========================================================
-- GRC Control Center - Migration 030
-- Pilot Operations, Real Data Import, Pilot Sign-off,
-- Issue Triage, and Rollout Readiness
-- =========================================================

create extension if not exists "pgcrypto";

-- Optional enums guarded by DO blocks
DO $$ BEGIN
  CREATE TYPE pilot_wave_status AS ENUM ('draft','ready','active','paused','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pilot_issue_severity AS ENUM ('critical','high','medium','low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pilot_issue_status AS ENUM ('open','triaged','in_progress','blocked','resolved','accepted_risk','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_readiness_status AS ENUM ('not_started','mapping','validating','ready','imported','blocked','rolled_back');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Pilot wave planning
-- =========================================================
create table if not exists pilot_waves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  wave_name text not null,
  wave_order integer not null default 1,
  scope_description text,
  target_departments integer not null default 0,
  target_users integer not null default 0,
  start_date date,
  end_date date,
  owner_id uuid references profiles(id) on delete set null,
  status pilot_wave_status not null default 'draft',
  readiness_score numeric(5,2) not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  success_criteria text,
  exit_criteria text,
  risk_notes text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pilot_wave_departments (
  id uuid primary key default gen_random_uuid(),
  pilot_wave_id uuid not null references pilot_waves(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  department_name_snapshot text,
  manager_id uuid references profiles(id) on delete set null,
  included boolean not null default true,
  readiness_notes text,
  created_at timestamptz not null default now()
);

create table if not exists pilot_participants (
  id uuid primary key default gen_random_uuid(),
  pilot_wave_id uuid references pilot_waves(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role_label text,
  department_id uuid references departments(id) on delete set null,
  onboarding_completed boolean not null default false,
  training_completed boolean not null default false,
  rls_verified boolean not null default false,
  first_login_at timestamptz,
  last_activity_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (pilot_wave_id, user_id)
);

-- =========================================================
-- Real data import readiness
-- =========================================================
create table if not exists real_data_import_controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  import_area text not null,
  owner_id uuid references profiles(id) on delete set null,
  source_file_name text,
  expected_rows integer not null default 0,
  validated_rows integer not null default 0,
  rejected_rows integer not null default 0,
  duplicate_warnings integer not null default 0,
  missing_required_warnings integer not null default 0,
  status import_readiness_status not null default 'not_started',
  validation_summary jsonb not null default '{}'::jsonb,
  last_validated_at timestamptz,
  imported_at timestamptz,
  rollback_available boolean not null default false,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Pilot issue triage
-- =========================================================
create table if not exists pilot_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  pilot_wave_id uuid references pilot_waves(id) on delete set null,
  title text not null,
  description text,
  module_area text,
  severity pilot_issue_severity not null default 'medium',
  status pilot_issue_status not null default 'open',
  reported_by uuid references profiles(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  related_record_table text,
  related_record_id uuid,
  workaround text,
  resolution_notes text,
  due_date date,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Pilot sign-off and go-live rehearsal
-- =========================================================
create table if not exists pilot_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  pilot_wave_id uuid references pilot_waves(id) on delete cascade,
  signoff_area text not null,
  signoff_owner_id uuid references profiles(id) on delete set null,
  required boolean not null default true,
  approved boolean not null default false,
  approved_at timestamptz,
  approval_notes text,
  blocker_count integer not null default 0,
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_wave_id, signoff_area)
);

create table if not exists go_live_rehearsals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  rehearsal_name text not null,
  rehearsal_date date,
  owner_id uuid references profiles(id) on delete set null,
  backup_verified boolean not null default false,
  restore_dry_run_verified boolean not null default false,
  rls_verified boolean not null default false,
  ovr_workflow_verified boolean not null default false,
  export_verified boolean not null default false,
  rollback_plan_verified boolean not null default false,
  result text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Generic updated_at support
-- =========================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_pilot_waves_updated_at ON pilot_waves;
  CREATE TRIGGER trg_pilot_waves_updated_at BEFORE UPDATE ON pilot_waves FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_real_data_import_controls_updated_at ON real_data_import_controls;
  CREATE TRIGGER trg_real_data_import_controls_updated_at BEFORE UPDATE ON real_data_import_controls FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_pilot_issues_updated_at ON pilot_issues;
  CREATE TRIGGER trg_pilot_issues_updated_at BEFORE UPDATE ON pilot_issues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_pilot_signoffs_updated_at ON pilot_signoffs;
  CREATE TRIGGER trg_pilot_signoffs_updated_at BEFORE UPDATE ON pilot_signoffs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_go_live_rehearsals_updated_at ON go_live_rehearsals;
  CREATE TRIGGER trg_go_live_rehearsals_updated_at BEFORE UPDATE ON go_live_rehearsals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- =========================================================
-- Indexes
-- =========================================================
create index if not exists idx_pilot_waves_org_status on pilot_waves(organization_id, status);
create index if not exists idx_pilot_wave_departments_wave on pilot_wave_departments(pilot_wave_id);
create index if not exists idx_pilot_participants_wave on pilot_participants(pilot_wave_id);
create index if not exists idx_real_data_import_org_area on real_data_import_controls(organization_id, import_area);
create index if not exists idx_pilot_issues_org_status on pilot_issues(organization_id, status);
create index if not exists idx_pilot_issues_wave on pilot_issues(pilot_wave_id);
create index if not exists idx_pilot_issues_severity on pilot_issues(severity);
create index if not exists idx_pilot_signoffs_wave on pilot_signoffs(pilot_wave_id);
create index if not exists idx_go_live_rehearsals_org on go_live_rehearsals(organization_id);

-- =========================================================
-- Views
-- =========================================================
create or replace view v_v34_pilot_wave_summary as
select
  pw.organization_id,
  pw.id as pilot_wave_id,
  pw.wave_name,
  pw.wave_order,
  pw.status,
  pw.start_date,
  pw.end_date,
  pw.target_departments,
  pw.target_users,
  pw.readiness_score,
  count(distinct pwd.department_id) filter (where pwd.included = true) as included_departments,
  count(distinct pp.user_id) as participants,
  count(distinct pp.user_id) filter (where pp.training_completed = true) as trained_users,
  count(distinct pp.user_id) filter (where pp.rls_verified = true) as rls_verified_users,
  count(distinct pi.id) filter (where pi.status not in ('resolved','closed')) as open_issues,
  count(distinct pi.id) filter (where pi.severity = 'critical' and pi.status not in ('resolved','closed')) as critical_open_issues,
  count(distinct ps.id) filter (where ps.required = true and ps.approved = true) as approved_signoffs,
  count(distinct ps.id) filter (where ps.required = true) as required_signoffs
from pilot_waves pw
left join pilot_wave_departments pwd on pwd.pilot_wave_id = pw.id
left join pilot_participants pp on pp.pilot_wave_id = pw.id
left join pilot_issues pi on pi.pilot_wave_id = pw.id
left join pilot_signoffs ps on ps.pilot_wave_id = pw.id
group by pw.organization_id, pw.id, pw.wave_name, pw.wave_order, pw.status, pw.start_date, pw.end_date, pw.target_departments, pw.target_users, pw.readiness_score;

create or replace view v_v34_real_data_import_readiness as
select
  organization_id,
  import_area,
  status,
  expected_rows,
  validated_rows,
  rejected_rows,
  duplicate_warnings,
  missing_required_warnings,
  case
    when status = 'blocked' then 'blocked'
    when expected_rows = 0 then 'not_measured'
    when rejected_rows > 0 or duplicate_warnings > 0 or missing_required_warnings > 0 then 'warning'
    when validated_rows >= expected_rows and status in ('ready','imported') then 'ready'
    else 'in_progress'
  end as readiness_signal,
  round(case when expected_rows = 0 then 0 else (validated_rows::numeric / greatest(expected_rows,1)::numeric) * 100 end, 2) as validation_percent,
  last_validated_at,
  imported_at,
  rollback_available,
  notes
from real_data_import_controls;

create or replace view v_v34_pilot_issue_board as
select
  pi.organization_id,
  pi.id,
  pi.title,
  pi.module_area,
  pi.severity,
  pi.status,
  pi.due_date,
  pi.created_at,
  pi.resolved_at,
  pw.wave_name,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  assignee.full_name_en as assigned_to_name,
  reporter.full_name_en as reported_by_name,
  case
    when pi.status in ('resolved','closed','accepted_risk') then 'closed'
    when pi.severity = 'critical' then 'critical'
    when pi.due_date is not null and pi.due_date < current_date then 'overdue'
    when pi.severity = 'high' then 'high'
    else 'normal'
  end as board_signal
from pilot_issues pi
left join pilot_waves pw on pw.id = pi.pilot_wave_id
left join departments d on d.id = pi.department_id
left join profiles assignee on assignee.id = pi.assigned_to
left join profiles reporter on reporter.id = pi.reported_by;

create or replace view v_v34_go_live_rehearsal_readiness as
select
  organization_id,
  id,
  rehearsal_name,
  rehearsal_date,
  result,
  backup_verified,
  restore_dry_run_verified,
  rls_verified,
  ovr_workflow_verified,
  export_verified,
  rollback_plan_verified,
  (
    (case when backup_verified then 1 else 0 end) +
    (case when restore_dry_run_verified then 1 else 0 end) +
    (case when rls_verified then 1 else 0 end) +
    (case when ovr_workflow_verified then 1 else 0 end) +
    (case when export_verified then 1 else 0 end) +
    (case when rollback_plan_verified then 1 else 0 end)
  ) as verified_steps,
  round((
    (
      (case when backup_verified then 1 else 0 end) +
      (case when restore_dry_run_verified then 1 else 0 end) +
      (case when rls_verified then 1 else 0 end) +
      (case when ovr_workflow_verified then 1 else 0 end) +
      (case when export_verified then 1 else 0 end) +
      (case when rollback_plan_verified then 1 else 0 end)
    )::numeric / 6::numeric
  ) * 100, 2) as rehearsal_score,
  notes
from go_live_rehearsals;

create or replace view v_v34_company_rollout_readiness as
select
  o.id as organization_id,
  o.name_en as organization_name_en,
  count(distinct pw.id) as pilot_waves,
  count(distinct pw.id) filter (where pw.status = 'completed') as completed_waves,
  count(distinct pi.id) filter (where pi.status not in ('resolved','closed','accepted_risk')) as open_pilot_issues,
  count(distinct pi.id) filter (where pi.severity = 'critical' and pi.status not in ('resolved','closed','accepted_risk')) as critical_pilot_issues,
  count(distinct rdic.id) filter (where rdic.status in ('ready','imported')) as ready_import_areas,
  count(distinct rdic.id) as total_import_areas,
  count(distinct glr.id) filter (where glr.result in ('passed','accepted')) as passed_rehearsals,
  count(distinct glr.id) as total_rehearsals,
  case
    when count(distinct pi.id) filter (where pi.severity = 'critical' and pi.status not in ('resolved','closed','accepted_risk')) > 0 then 'blocked'
    when count(distinct rdic.id) = 0 then 'not_ready'
    when count(distinct rdic.id) filter (where rdic.status in ('ready','imported')) < count(distinct rdic.id) then 'warning'
    when count(distinct glr.id) filter (where glr.result in ('passed','accepted')) = 0 then 'warning'
    else 'pilot_ready'
  end as rollout_signal
from organizations o
left join pilot_waves pw on pw.organization_id = o.id
left join pilot_issues pi on pi.organization_id = o.id
left join real_data_import_controls rdic on rdic.organization_id = o.id
left join go_live_rehearsals glr on glr.organization_id = o.id
group by o.id, o.name_en;

-- =========================================================
-- Seed helper
-- =========================================================
create or replace function seed_v34_pilot_defaults()
returns void
language plpgsql
security definer
as $$
declare
  org_id uuid;
  wave1 uuid;
begin
  select id into org_id from organizations order by created_at limit 1;
  if org_id is null then
    insert into organizations (name_en, name_ar) values ('Al Modawat Specialized Medical Company', 'شركة المداواة التخصصية الطبية') returning id into org_id;
  end if;

  insert into pilot_waves (organization_id, wave_name, wave_order, scope_description, target_departments, target_users, status, readiness_score, success_criteria, exit_criteria)
  values (org_id, 'Pilot Wave 1 - Core Governance Users', 1, 'Executives, Governance, Quality, Audit, Finance, HR, IT, and selected department managers.', 8, 60, 'ready', 72,
          'Core workflows run without critical blockers for 10 working days.',
          'No critical open issues, OVR workflow accepted, backup/export verified, RLS persona tests passed.')
  on conflict do nothing;

  select id into wave1 from pilot_waves where organization_id = org_id and wave_order = 1 order by created_at limit 1;

  insert into real_data_import_controls (organization_id, import_area, expected_rows, validated_rows, status, notes)
  values
    (org_id, 'departments', 50, 0, 'mapping', 'Map the final department list before import.'),
    (org_id, 'units_stations', 120, 0, 'mapping', 'Validate duplicate unit/station codes before import.'),
    (org_id, 'employees', 1000, 0, 'mapping', 'Validate email, employee number, department, role and scope.'),
    (org_id, 'projects', 50, 0, 'not_started', 'Import only major projects/action plans, not daily tasks.'),
    (org_id, 'risks', 80, 0, 'not_started', 'Start with major enterprise and departmental risks.'),
    (org_id, 'compliance_items', 100, 0, 'not_started', 'MOH, CBAHI, Civil Defense, ZATCA, HR, licenses, equipment certificates.')
  on conflict do nothing;

  if wave1 is not null then
    insert into pilot_signoffs (organization_id, pilot_wave_id, signoff_area, required, blocker_count)
    values
      (org_id, wave1, 'Fresh Supabase migrations verified', true, 0),
      (org_id, wave1, 'RLS persona testing passed', true, 0),
      (org_id, wave1, 'OVR workflow accepted by Quality', true, 0),
      (org_id, wave1, 'Backup/export and restore dry-run verified', true, 0),
      (org_id, wave1, 'Arabic/RTL critical screens accepted', true, 0),
      (org_id, wave1, 'Pilot users trained', true, 0)
    on conflict do nothing;
  end if;
end;
$$;
