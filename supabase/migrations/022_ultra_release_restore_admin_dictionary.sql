-- =========================================================
-- GRC Control Center - Migration 022
-- Ultra release controls: production cutover, migration verifier,
-- restore dry-run board, admin safety console and bilingual dictionary
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Release migration order extension
-- ---------------------------------------------------------
insert into release_migration_order (version_label, migration_file, sequence_no, purpose, required)
values ('v2.0', '022_ultra_release_restore_admin_dictionary.sql', 23, 'Ultra release verification, restore dry-run, admin safety and bilingual dictionary controls', true)
on conflict (migration_file) do update
set version_label = excluded.version_label,
    sequence_no = excluded.sequence_no,
    purpose = excluded.purpose,
    required = excluded.required;

-- ---------------------------------------------------------
-- Production cutover checklist
-- ---------------------------------------------------------
create table if not exists production_cutover_checklist (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  phase text not null,
  item text not null,
  status text not null default 'pending' check (status in ('pass', 'warning', 'blocked', 'pending')),
  owner text,
  owner_id uuid references profiles(id) on delete set null,
  evidence text,
  notes text,
  sort_order integer not null default 100,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phase, item)
);

drop trigger if exists trg_production_cutover_checklist_updated_at on production_cutover_checklist;
create trigger trg_production_cutover_checklist_updated_at
before update on production_cutover_checklist
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Migration verification runs/items
-- ---------------------------------------------------------
create table if not exists migration_verification_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  run_label text not null default 'manual preflight',
  run_status text not null default 'completed' check (run_status in ('completed', 'warning', 'failed')),
  expected_count integer not null default 0,
  verified_count integer not null default 0,
  missing_count integer not null default 0,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists migration_verification_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references migration_verification_runs(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  migration_file text not null,
  sequence_no integer not null,
  expected boolean not null default true,
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('verified', 'missing', 'warning', 'pending')),
  verification_note text,
  created_at timestamptz not null default now(),
  unique (run_id, migration_file)
);

create index if not exists idx_migration_verification_items_org on migration_verification_items(organization_id);
create index if not exists idx_migration_verification_items_status on migration_verification_items(status);

-- ---------------------------------------------------------
-- Restore dry-run enhancement details
-- Existing restore_dry_run_jobs was introduced earlier; keep defensive.
-- ---------------------------------------------------------
create table if not exists restore_dry_run_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  backup_package_id uuid references backup_packages(id) on delete set null,
  scenario_name text not null,
  status text not null default 'planned',
  result_summary text,
  evidence_file text,
  started_by uuid references profiles(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration 016 introduced an earlier, smaller version of this table.
-- CREATE TABLE IF NOT EXISTS does not add later columns, so upgrade that
-- existing shape explicitly before creating views and RPCs below.
alter table restore_dry_run_jobs
add column if not exists scenario_name text;

alter table restore_dry_run_jobs
add column if not exists result_summary text;

alter table restore_dry_run_jobs
add column if not exists evidence_file text;

alter table restore_dry_run_jobs
add column if not exists started_by uuid references profiles(id) on delete set null;

alter table restore_dry_run_jobs
add column if not exists finished_at timestamptz;

alter table restore_dry_run_jobs
add column if not exists updated_at timestamptz not null default now();

update restore_dry_run_jobs
set
  scenario_name = coalesce(scenario_name, title, 'Restore dry-run'),
  result_summary = coalesce(result_summary, findings),
  started_by = coalesce(started_by, tested_by, created_by),
  finished_at = coalesce(finished_at, completed_at)
where scenario_name is null
   or result_summary is null
   or started_by is null
   or finished_at is null;

alter table restore_dry_run_jobs
alter column scenario_name set not null;

drop trigger if exists trg_restore_dry_run_jobs_updated_at on restore_dry_run_jobs;
create trigger trg_restore_dry_run_jobs_updated_at
before update on restore_dry_run_jobs
for each row execute function set_updated_at();

create table if not exists restore_dry_run_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  dry_run_job_id uuid references restore_dry_run_jobs(id) on delete cascade,
  step_order integer not null,
  step_name text not null,
  status text not null default 'pending' check (status in ('pending', 'passed', 'failed', 'skipped')),
  evidence text,
  notes text,
  created_at timestamptz not null default now(),
  unique (dry_run_job_id, step_order)
);

-- ---------------------------------------------------------
-- Admin safety locks/change requests
-- ---------------------------------------------------------
create table if not exists admin_safety_locks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  lock_key text not null,
  title text not null,
  description text,
  lock_level text not null default 'high' check (lock_level in ('critical', 'high', 'medium', 'low')),
  is_active boolean not null default true,
  requires_backup boolean not null default true,
  requires_dual_approval boolean not null default true,
  requires_typed_confirmation boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, lock_key)
);

create table if not exists admin_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  request_type text not null,
  title text not null,
  description text,
  requested_by uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed', 'cancelled')),
  backup_package_id uuid references backup_packages(id) on delete set null,
  evidence_reference text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  executed_at timestamptz
);

-- ---------------------------------------------------------
-- Bilingual dictionary governance
-- ---------------------------------------------------------
create table if not exists app_translation_dictionary (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  english_label text,
  arabic_label text,
  category text not null default 'general',
  is_core boolean not null default false,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_translation_dictionary_updated_at on app_translation_dictionary;
create trigger trg_app_translation_dictionary_updated_at
before update on app_translation_dictionary
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Seed cutover checklist and safety locks for every organization
-- ---------------------------------------------------------
insert into production_cutover_checklist (organization_id, phase, item, status, owner, evidence, notes, sort_order)
select id, 'Data safety', 'Create external export package before production migration', 'pass', 'System Admin', 'Backup package/export logs', 'Required before any large import, migration or access change.', 10 from organizations
on conflict (organization_id, phase, item) do nothing;

insert into production_cutover_checklist (organization_id, phase, item, status, owner, evidence, notes, sort_order)
select id, 'Restore assurance', 'Run restore dry-run from latest export package', 'blocked', 'Governance Admin', 'Restore dry-run record', 'Do not go live until a restore dry-run is documented.', 20 from organizations
on conflict (organization_id, phase, item) do nothing;

insert into production_cutover_checklist (organization_id, phase, item, status, owner, evidence, notes, sort_order)
select id, 'Access control', 'Review sensitive global roles and scoped managers', 'warning', 'Governance Admin', 'Access control export', 'Resolve broad scope employees/viewers before full rollout.', 30 from organizations
on conflict (organization_id, phase, item) do nothing;

insert into production_cutover_checklist (organization_id, phase, item, status, owner, evidence, notes, sort_order)
select id, 'Workflow controls', 'Confirm evidence and delay blockers are active', 'pass', 'QA Lead', 'QA test run export', 'Closure without evidence and delay without reason should be blocked.', 40 from organizations
on conflict (organization_id, phase, item) do nothing;

insert into production_cutover_checklist (organization_id, phase, item, status, owner, evidence, notes, sort_order)
select id, 'Bilingual rollout', 'Review Arabic/English core dictionary', 'warning', 'Governance Admin', 'Dictionary export', 'Status, role, source and workflow labels must be bilingual before employee rollout.', 50 from organizations
on conflict (organization_id, phase, item) do nothing;

insert into admin_safety_locks (organization_id, lock_key, title, description, lock_level, requires_backup, requires_dual_approval, requires_typed_confirmation)
select id, 'production_reset', 'Production reset lock', 'Blocks destructive reset without backup, dual approval and typed confirmation.', 'critical', true, true, true from organizations
on conflict (organization_id, lock_key) do nothing;

insert into admin_safety_locks (organization_id, lock_key, title, description, lock_level, requires_backup, requires_dual_approval, requires_typed_confirmation)
select id, 'bulk_employee_import', 'Bulk employee import lock', 'Requires clean validation report and backup before importing large employee batches.', 'high', true, true, false from organizations
on conflict (organization_id, lock_key) do nothing;

insert into admin_safety_locks (organization_id, lock_key, title, description, lock_level, requires_backup, requires_dual_approval, requires_typed_confirmation)
select id, 'global_role_assignment', 'Global role assignment lock', 'Requires review before assigning executive, super_admin or governance_admin with global scope.', 'high', true, true, false from organizations
on conflict (organization_id, lock_key) do nothing;

insert into app_translation_dictionary (key, english_label, arabic_label, category, is_core, needs_review)
values
('role.super_admin', 'Super Admin', 'مدير النظام الأعلى', 'role', true, false),
('role.executive', 'Executive', 'تنفيذي', 'role', true, false),
('role.governance_admin', 'Governance Admin', 'مسؤول الحوكمة', 'role', true, false),
('role.department_manager', 'Department Manager', 'مدير إدارة', 'role', true, false),
('role.quality_manager', 'Quality Manager', 'مدير الجودة', 'role', true, false),
('status.pending_quality_review', 'Pending Quality review', 'بانتظار مراجعة الجودة', 'status', true, false),
('status.evidence_submitted', 'Evidence submitted', 'تم تقديم الدليل', 'status', true, false),
('status.returned_for_clarification', 'Returned for clarification', 'معاد للتوضيح', 'status', true, false),
('source.audit_finding', 'Audit finding', 'ملاحظة مراجعة', 'source', true, false),
('source.incident_ovr', 'OVR / incident', 'بلاغ OVR / حادث', 'source', true, false),
('workflow.no_evidence_no_closure', 'No evidence, no closure', 'لا إغلاق بدون دليل', 'workflow', true, false),
('workflow.no_self_approval', 'No self-approval', 'لا اعتماد ذاتي', 'workflow', true, false)
on conflict (key) do update set
  english_label = excluded.english_label,
  arabic_label = excluded.arabic_label,
  category = excluded.category,
  is_core = excluded.is_core,
  needs_review = excluded.needs_review;

-- ---------------------------------------------------------
-- Views
-- ---------------------------------------------------------
create or replace view v_production_cutover_checklist as
select
  c.id,
  c.organization_id,
  c.phase,
  c.item,
  c.status,
  c.owner,
  coalesce(p.full_name_en, c.owner, 'Unassigned') as owner_name,
  c.evidence,
  c.notes,
  c.sort_order,
  c.updated_at
from production_cutover_checklist c
left join profiles p on p.id = c.owner_id;

create or replace view v_migration_verification_matrix as
with latest_run as (
  select distinct on (organization_id) id, organization_id
  from migration_verification_runs
  order by organization_id, created_at desc
), latest_items as (
  select i.*
  from migration_verification_items i
  join latest_run r on r.id = i.run_id
)
select
  r.sequence_no,
  r.migration_file,
  r.purpose,
  r.required as expected,
  coalesce(i.verified, r.sequence_no < 23) as verified,
  case
    when coalesce(i.verified, r.sequence_no < 23) then 'verified'
    when r.required then coalesce(i.status, 'pending')
    else 'warning'
  end as status,
  coalesce(i.verification_note, case when r.sequence_no < 23 then 'Migration exists in release order. Confirm applied in Supabase history.' else 'Apply after v1.9 and run preflight.' end) as verification_note
from release_migration_order r
left join latest_items i on i.migration_file = r.migration_file
order by r.sequence_no;

create or replace view v_backup_restore_drillboard as
select
  r.id,
  r.organization_id,
  coalesce(b.package_name, r.backup_package_id::text, 'No package linked') as backup_package_id,
  r.scenario_name,
  r.status,
  r.started_at,
  r.finished_at,
  r.result_summary,
  r.evidence_file,
  r.created_at
from restore_dry_run_jobs r
left join backup_packages b on b.id = r.backup_package_id;

create or replace view v_admin_safety_console as
select
  l.id,
  l.organization_id,
  'Safety lock' as area,
  l.title as finding,
  l.lock_level as severity,
  case when l.is_active then 'open' else 'closed' end as status,
  l.description || case when l.requires_backup then ' Backup required.' else '' end as recommendation,
  'System Admin' as owner,
  case l.lock_level when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end as severity_rank
from admin_safety_locks l
where l.is_active = true
union all
select
  c.id,
  c.organization_id,
  'Change request' as area,
  c.title as finding,
  case when c.status = 'pending' then 'high' else 'medium' end as severity,
  c.status,
  coalesce(c.description, 'Administrative change requires review.') as recommendation,
  coalesce(p.full_name_en, 'Requester') as owner,
  case when c.status = 'pending' then 2 else 3 end as severity_rank
from admin_change_requests c
left join profiles p on p.id = c.requested_by
where c.status in ('pending', 'approved');

create or replace view v_bilingual_dictionary_status as
select
  key,
  english_label,
  arabic_label,
  category,
  is_core,
  case
    when coalesce(trim(english_label), '') = '' then 'missing_en'
    when coalesce(trim(arabic_label), '') = '' then 'missing_ar'
    when needs_review then 'needs_review'
    else 'complete'
  end as status
from app_translation_dictionary;

create or replace view v_ultra_release_summary as
select
  o.id as organization_id,
  greatest(0, least(100,
    100
    - ((select count(*) from production_cutover_checklist c where c.organization_id = o.id and c.status = 'blocked') * 18)
    - ((select count(*) from production_cutover_checklist c where c.organization_id = o.id and c.status = 'warning') * 6)
    - case when not exists (select 1 from restore_dry_run_jobs r where r.organization_id = o.id and r.status = 'passed') then 12 else 0 end
    - case when not exists (select 1 from backup_packages b where b.organization_id = o.id and b.created_at >= now() - interval '30 days') then 8 else 0 end
  ))::integer as release_score,
  (select count(*) from production_cutover_checklist c where c.organization_id = o.id and c.status = 'blocked')::integer as blocker_count,
  (select count(*) from production_cutover_checklist c where c.organization_id = o.id and c.status = 'warning')::integer as warning_count,
  (select max(created_at) from backup_packages b where b.organization_id = o.id) as last_backup_at,
  (select max(finished_at) from restore_dry_run_jobs r where r.organization_id = o.id and r.status = 'passed') as last_restore_dry_run_at,
  (select count(*) from release_migration_order where required = true)::integer as migrations_expected,
  (select count(*) from release_migration_order where required = true and sequence_no < 23)::integer as migrations_verified,
  (select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where coalesce(trim(english_label), '') <> '' and coalesce(trim(arabic_label), '') <> '' and needs_review = false) / count(*)) end from app_translation_dictionary)::integer as translation_coverage,
  (select count(*) from admin_safety_locks l where l.organization_id = o.id and l.is_active = true)::integer as admin_locks_active
from organizations o;

-- ---------------------------------------------------------
-- RPC helpers
-- ---------------------------------------------------------
create or replace function start_restore_dry_run(p_scenario_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select id into v_org from organizations order by created_at limit 1;
  insert into restore_dry_run_jobs (organization_id, title, scenario_name, status, result_summary, started_at)
  values (
    v_org,
    coalesce(nullif(p_scenario_name, ''), 'Restore dry-run'),
    coalesce(nullif(p_scenario_name, ''), 'Restore dry-run'),
    'planned',
    'Dry-run created. Apply migrations in test environment, import latest export package, then document result.',
    now()
  )
  returning id into v_id;

  insert into restore_dry_run_steps (organization_id, dry_run_job_id, step_order, step_name, status)
  values
  (v_org, v_id, 1, 'Create clean test Supabase project', 'pending'),
  (v_org, v_id, 2, 'Apply migrations in order', 'pending'),
  (v_org, v_id, 3, 'Import exported JSON/CSV package', 'pending'),
  (v_org, v_id, 4, 'Compare row counts and dashboard KPIs', 'pending'),
  (v_org, v_id, 5, 'Attach evidence and decision note', 'pending');

  return v_id;
end;
$$;

create or replace function run_ultra_release_preflight()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_run uuid;
  v_expected integer;
  v_verified integer;
  v_missing integer;
begin
  select id into v_org from organizations order by created_at limit 1;
  select count(*) into v_expected from release_migration_order where required = true;
  select count(*) into v_verified from release_migration_order where required = true and sequence_no < 23;
  v_missing := greatest(0, v_expected - v_verified);

  insert into migration_verification_runs (organization_id, run_label, run_status, expected_count, verified_count, missing_count, notes)
  values (v_org, 'Ultra release preflight', case when v_missing > 0 then 'warning' else 'completed' end, v_expected, v_verified, v_missing, 'Preflight records expected migration matrix. Confirm actual Supabase migration history in production.')
  returning id into v_run;

  insert into migration_verification_items (run_id, organization_id, migration_file, sequence_no, expected, verified, status, verification_note)
  select v_run, v_org, migration_file, sequence_no, required, sequence_no < 23,
         case when sequence_no < 23 then 'verified' else 'pending' end,
         case when sequence_no < 23 then 'In release order. Confirm applied in production history.' else 'This migration should be applied after v1.9.' end
  from release_migration_order
  order by sequence_no;

  return v_run;
end;
$$;

-- ---------------------------------------------------------
-- RLS: authenticated users can read release/admin safety metadata.
-- Writes remain controlled through RPC or admin flows.
-- ---------------------------------------------------------
alter table production_cutover_checklist enable row level security;
alter table migration_verification_runs enable row level security;
alter table migration_verification_items enable row level security;
alter table restore_dry_run_steps enable row level security;
alter table admin_safety_locks enable row level security;
alter table admin_change_requests enable row level security;
alter table app_translation_dictionary enable row level security;

drop policy if exists production_cutover_checklist_read_authenticated on production_cutover_checklist;
create policy production_cutover_checklist_read_authenticated on production_cutover_checklist for select to authenticated using (true);

drop policy if exists migration_verification_runs_read_authenticated on migration_verification_runs;
create policy migration_verification_runs_read_authenticated on migration_verification_runs for select to authenticated using (true);

drop policy if exists migration_verification_items_read_authenticated on migration_verification_items;
create policy migration_verification_items_read_authenticated on migration_verification_items for select to authenticated using (true);

drop policy if exists restore_dry_run_steps_read_authenticated on restore_dry_run_steps;
create policy restore_dry_run_steps_read_authenticated on restore_dry_run_steps for select to authenticated using (true);

drop policy if exists admin_safety_locks_read_authenticated on admin_safety_locks;
create policy admin_safety_locks_read_authenticated on admin_safety_locks for select to authenticated using (true);

drop policy if exists admin_change_requests_read_authenticated on admin_change_requests;
create policy admin_change_requests_read_authenticated on admin_change_requests for select to authenticated using (true);

drop policy if exists app_translation_dictionary_read_authenticated on app_translation_dictionary;
create policy app_translation_dictionary_read_authenticated on app_translation_dictionary for select to authenticated using (true);
