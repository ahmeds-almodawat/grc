-- =========================================================
-- GRC Control Center - Migration 031
-- v3.5 Ultra Consolidation & Pilot Fix Kit
-- Purpose: final consolidation register, pilot defect triage,
-- data quality repair workflow, go-live SOP, and cutover freeze controls.
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================
do $$ begin
  create type v35_item_status as enum (
    'not_started',
    'in_progress',
    'blocked',
    'ready',
    'passed',
    'failed',
    'deferred',
    'closed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type v35_severity as enum (
    'critical',
    'high',
    'medium',
    'low',
    'info'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type v35_fix_domain as enum (
    'migration',
    'rls',
    'ui',
    'bilingual',
    'ovr',
    'workflow',
    'export_backup',
    'performance',
    'data_quality',
    'training',
    'other'
  );
exception when duplicate_object then null;
end $$;

-- =========================
-- CONSOLIDATED PATCH MANIFEST
-- =========================
create table if not exists consolidation_patch_manifest (
  id uuid primary key default gen_random_uuid(),
  patch_version text not null unique,
  patch_name text not null,
  patch_order integer not null unique,
  expected_zip_name text,
  expected_migration text,
  required boolean not null default true,
  applied_status v35_item_status not null default 'not_started',
  applied_by uuid references profiles(id) on delete set null,
  applied_at timestamptz,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- FINAL CONSOLIDATION DEFECTS
-- =========================
create table if not exists consolidation_defects (
  id uuid primary key default gen_random_uuid(),
  defect_code text unique,
  title text not null,
  description text,
  domain v35_fix_domain not null default 'other',
  severity v35_severity not null default 'medium',
  status v35_item_status not null default 'not_started',
  owner_id uuid references profiles(id) on delete set null,
  source_patch text,
  affected_path text,
  reproduction_steps text,
  expected_result text,
  actual_result text,
  fix_note text,
  due_date date,
  closed_by uuid references profiles(id) on delete set null,
  closed_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- REAL DATA REPAIR QUEUE
-- =========================
create table if not exists real_data_repair_queue (
  id uuid primary key default gen_random_uuid(),
  repair_code text unique,
  source_area text not null,
  entity_type text not null,
  entity_reference text,
  issue_title text not null,
  issue_description text,
  severity v35_severity not null default 'medium',
  status v35_item_status not null default 'not_started',
  suggested_fix text,
  assigned_to uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  fixed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- FINAL PILOT FIX SPRINTS
-- =========================
create table if not exists pilot_fix_sprints (
  id uuid primary key default gen_random_uuid(),
  sprint_name text not null,
  sprint_goal text not null,
  start_date date,
  end_date date,
  status v35_item_status not null default 'not_started',
  owner_id uuid references profiles(id) on delete set null,
  defects_open integer not null default 0,
  defects_closed integer not null default 0,
  go_no_go_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pilot_fix_sprint_items (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references pilot_fix_sprints(id) on delete cascade,
  defect_id uuid references consolidation_defects(id) on delete set null,
  repair_id uuid references real_data_repair_queue(id) on delete set null,
  title text not null,
  severity v35_severity not null default 'medium',
  status v35_item_status not null default 'not_started',
  owner_id uuid references profiles(id) on delete set null,
  due_date date,
  close_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- CUTOVER FREEZE & GO LIVE SOP
-- =========================
create table if not exists cutover_freeze_windows (
  id uuid primary key default gen_random_uuid(),
  freeze_name text not null,
  freeze_reason text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status v35_item_status not null default 'not_started',
  approved_by uuid references profiles(id) on delete set null,
  approval_note text,
  created_at timestamptz not null default now(),
  constraint cutover_freeze_range_valid check (ends_at > starts_at)
);

create table if not exists go_live_sop_steps (
  id uuid primary key default gen_random_uuid(),
  step_order integer not null unique,
  step_group text not null,
  step_title text not null,
  step_description text,
  required boolean not null default true,
  owner_role text,
  status v35_item_status not null default 'not_started',
  evidence_required boolean not null default true,
  evidence_note text,
  completed_by uuid references profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- OPERATOR DAILY LOG
-- =========================
create table if not exists production_operator_daily_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null default current_date,
  shift_name text not null default 'day',
  operator_id uuid references profiles(id) on delete set null,
  system_health_note text,
  backup_checked boolean not null default false,
  critical_alerts_checked boolean not null default false,
  ovr_queue_checked boolean not null default false,
  export_center_checked boolean not null default false,
  rls_incidents_found boolean not null default false,
  unresolved_issue_count integer not null default 0,
  handover_note text,
  created_at timestamptz not null default now(),
  unique (log_date, shift_name)
);

-- =========================
-- UPDATED_AT TRIGGER ATTACHMENT
-- =========================
create or replace function v35_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function v35_attach_updated_at_if_exists(target_table text)
returns void as $$
begin
  execute format('drop trigger if exists trg_%I_updated_at on %I', target_table, target_table);
  execute format('create trigger trg_%I_updated_at before update on %I for each row execute function v35_set_updated_at()', target_table, target_table);
exception when undefined_table then
  null;
end;
$$ language plpgsql;

select v35_attach_updated_at_if_exists('consolidation_patch_manifest');
select v35_attach_updated_at_if_exists('consolidation_defects');
select v35_attach_updated_at_if_exists('real_data_repair_queue');
select v35_attach_updated_at_if_exists('pilot_fix_sprints');
select v35_attach_updated_at_if_exists('pilot_fix_sprint_items');
select v35_attach_updated_at_if_exists('go_live_sop_steps');

-- =========================
-- INDEXES
-- =========================
create index if not exists idx_v35_manifest_status on consolidation_patch_manifest(applied_status, patch_order);
create index if not exists idx_v35_defects_status on consolidation_defects(status, severity, domain);
create index if not exists idx_v35_defects_owner on consolidation_defects(owner_id);
create index if not exists idx_v35_repairs_status on real_data_repair_queue(status, severity, source_area);
create index if not exists idx_v35_repairs_assigned on real_data_repair_queue(assigned_to);
create index if not exists idx_v35_sprints_status on pilot_fix_sprints(status, start_date, end_date);
create index if not exists idx_v35_sprint_items_status on pilot_fix_sprint_items(sprint_id, status, severity);
create index if not exists idx_v35_freeze_range on cutover_freeze_windows(starts_at, ends_at, status);
create index if not exists idx_v35_sop_status on go_live_sop_steps(status, step_order);
create index if not exists idx_v35_operator_log_date on production_operator_daily_log(log_date desc);

-- =========================
-- VIEWS
-- =========================
create or replace view v35_consolidation_scorecard as
select
  (select count(*) from consolidation_patch_manifest) as patches_registered,
  (select count(*) from consolidation_patch_manifest where applied_status in ('passed','ready','closed')) as patches_verified,
  (select count(*) from consolidation_patch_manifest where required and applied_status not in ('passed','ready','closed')) as patches_not_verified,
  (select count(*) from consolidation_defects where status not in ('closed','deferred')) as open_defects,
  (select count(*) from consolidation_defects where severity = 'critical' and status not in ('closed','deferred')) as critical_open_defects,
  (select count(*) from real_data_repair_queue where status not in ('closed','deferred')) as open_data_repairs,
  (select count(*) from go_live_sop_steps where required and status not in ('passed','ready','closed')) as sop_steps_remaining,
  greatest(0, least(100,
    100
    - ((select count(*) from consolidation_patch_manifest where required and applied_status not in ('passed','ready','closed')) * 4)
    - ((select count(*) from consolidation_defects where severity = 'critical' and status not in ('closed','deferred')) * 20)
    - ((select count(*) from consolidation_defects where severity = 'high' and status not in ('closed','deferred')) * 8)
    - ((select count(*) from real_data_repair_queue where severity in ('critical','high') and status not in ('closed','deferred')) * 6)
    - ((select count(*) from go_live_sop_steps where required and status not in ('passed','ready','closed')) * 3)
  ))::integer as consolidation_readiness_score;

create or replace view v35_final_blocker_board as
select 'Patch verification' as blocker_area,
       patch_version as reference,
       patch_name as title,
       applied_status::text as status,
       case when required then 'high' else 'medium' end as severity,
       verification_note as note
from consolidation_patch_manifest
where required and applied_status not in ('passed','ready','closed')
union all
select 'Consolidation defect', defect_code, title, status::text, severity::text, description
from consolidation_defects
where severity in ('critical','high') and status not in ('closed','deferred')
union all
select 'Data repair', repair_code, issue_title, status::text, severity::text, issue_description
from real_data_repair_queue
where severity in ('critical','high') and status not in ('closed','deferred')
union all
select 'Go-live SOP', step_order::text, step_title, status::text,
       case when required then 'high' else 'medium' end, step_description
from go_live_sop_steps
where required and status not in ('passed','ready','closed');

create or replace view v35_data_quality_radar as
select
  source_area,
  count(*) as total_issues,
  count(*) filter (where severity in ('critical','high')) as high_issues,
  count(*) filter (where status in ('closed','passed')) as closed_issues,
  count(*) filter (where status not in ('closed','deferred','passed')) as open_issues,
  case when count(*) = 0 then 100
       else round(100.0 * count(*) filter (where status in ('closed','passed')) / count(*), 1)
  end as closure_percent
from real_data_repair_queue
group by source_area;

create or replace view v35_operator_console as
select
  current_date as business_date,
  (select consolidation_readiness_score from v35_consolidation_scorecard) as readiness_score,
  (select count(*) from v35_final_blocker_board) as active_blockers,
  (select count(*) from cutover_freeze_windows where now() between starts_at and ends_at and status in ('ready','passed','in_progress')) as active_freeze_windows,
  (select count(*) from production_operator_daily_log where log_date = current_date) as today_operator_logs,
  (select count(*) from pilot_fix_sprints where status in ('not_started','in_progress','blocked')) as active_fix_sprints;

-- =========================
-- SEED DEFAULTS
-- =========================
create or replace function seed_v35_consolidation_defaults()
returns void as $$
begin
  insert into consolidation_patch_manifest (patch_version, patch_name, patch_order, expected_zip_name, expected_migration, required, applied_status)
  values
    ('v0.1','Starter foundation',1,'grc-control-center-starter.zip','001_core_foundation.sql',true,'not_started'),
    ('v0.2','Supabase service foundation',2,'grc-control-center-v0.2.zip','005_operational_views_and_storage.sql',true,'not_started'),
    ('v0.8','Bilingual and OVR module',8,'grc-control-center-v0.8-patch.zip','010_bilingual_and_ovr_module.sql',true,'not_started'),
    ('v1.3','Production hardening and modern UI',13,'grc-control-center-v1.3-production-hardening-modern-ui-patch.zip','015_production_hardening_health_print_controls.sql',true,'not_started'),
    ('v2.4','UI consolidation hubs',24,'grc-control-center-v2.4-ultra-ui-consolidation-patch.zip',null,true,'not_started'),
    ('v3.2','Final release factory',32,'grc-control-center-v3.2-final-release-factory-patch.zip','028_final_release_factory.sql',true,'not_started'),
    ('v3.3','Production proof',33,'grc-control-center-v3.3-production-proof-mega-patch.zip','029_production_proof_consolidation.sql',true,'not_started'),
    ('v3.4','Pilot real data operations',34,'grc-control-center-v3.4-ultra-pilot-real-data-patch.zip','030_pilot_real_data_operations.sql',true,'not_started'),
    ('v3.5','Consolidation and pilot fix kit',35,'grc-control-center-v3.5-ultra-consolidation-pilot-fix-patch.zip','031_consolidation_pilot_fix_kit.sql',true,'ready')
  on conflict (patch_version) do nothing;

  insert into go_live_sop_steps (step_order, step_group, step_title, step_description, required, owner_role, status)
  values
    (10,'Freeze','Announce pilot data freeze','Stop structural changes before final pilot import.',true,'Project Owner','not_started'),
    (20,'Backup','Export final pre-pilot backup package','Create browser export plus Supabase database/storage backup evidence.',true,'System Admin','not_started'),
    (30,'Migration','Run fresh install migration proof','Confirm migration bundle runs cleanly on fresh Supabase staging.',true,'System Admin','not_started'),
    (40,'Security','Run RLS persona proof','CEO, department manager, employee, Quality, and Auditor access must pass.',true,'Governance Admin','not_started'),
    (50,'OVR','Run OVR end-to-end test','Reporter submission to Quality closure and risk indicator update.',true,'Quality Manager','not_started'),
    (60,'Reports','Verify export/custom report pack','Export executive, Quality/OVR, audit/compliance, and department packs.',true,'Governance Admin','not_started'),
    (70,'Pilot','Run pilot acceptance script','Pilot departments sign off readiness or defects are logged.',true,'Pilot Owner','not_started'),
    (80,'Go/No-Go','Executive go/no-go decision','Final signed decision for pilot launch.',true,'Executive Sponsor','not_started')
  on conflict (step_order) do nothing;

  insert into pilot_fix_sprints (sprint_name, sprint_goal, status, go_no_go_note)
  values
    ('Pilot Fix Sprint 1','Resolve critical migration, RLS, OVR, and data import blockers before pilot launch.','not_started','No pilot launch if critical blockers remain.'),
    ('Pilot Fix Sprint 2','Resolve UX, bilingual, reporting, and training issues after first pilot feedback.','not_started','Pilot can continue if only medium/low defects remain.')
  on conflict do nothing;
end;
$$ language plpgsql;

-- Run seed safely
select seed_v35_consolidation_defaults();
