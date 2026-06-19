-- =========================================================
-- GRC Control Center - Migration 025
-- Staging Validation, RLS Persona Lab, Translation Coverage,
-- Load Test Seeds, Backup Strategy, Migration Runbook
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- STAGING VALIDATION CYCLES
-- =========================

create table if not exists staging_validation_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cycle_code text not null,
  title text not null,
  environment_name text not null default 'staging',
  status text not null default 'planned' check (status in ('planned','running','passed','failed','blocked','cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  owner_id uuid references profiles(id) on delete set null,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cycle_code)
);

create table if not exists staging_validation_check_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cycle_id uuid references staging_validation_cycles(id) on delete cascade,
  check_area text not null,
  check_code text not null,
  check_title text not null,
  status text not null default 'pending' check (status in ('pass','warning','blocked','pending','not_applicable')),
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  owner_label text,
  evidence_note text,
  result_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cycle_id, check_code)
);

-- =========================
-- RLS PERSONA TEST LAB
-- =========================

create table if not exists rls_persona_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  persona_code text not null,
  persona_name_en text not null,
  persona_name_ar text,
  role_name text not null,
  access_scope text not null,
  test_area text not null,
  allowed_expectation text not null,
  denied_expectation text not null,
  is_critical boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, persona_code)
);

create table if not exists rls_persona_test_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid references rls_persona_scenarios(id) on delete cascade,
  tested_by uuid references profiles(id) on delete set null,
  tested_at timestamptz not null default now(),
  result text not null default 'pending' check (result in ('pass','fail','warning','pending')),
  evidence_note text,
  failure_note text,
  created_at timestamptz not null default now()
);

-- =========================
-- BILINGUAL COVERAGE AUDIT
-- =========================

create table if not exists i18n_translation_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  module_key text not null,
  screen_name text not null,
  label_group text not null,
  total_labels integer not null default 0 check (total_labels >= 0),
  translated_ar integer not null default 0 check (translated_ar >= 0),
  translated_en integer not null default 0 check (translated_en >= 0),
  rtl_checked boolean not null default false,
  status text not null default 'needs_review' check (status in ('complete','needs_review','missing_ar','missing_en','blocked')),
  reviewer_note text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_key, screen_name, label_group)
);

-- =========================
-- LARGE DATA / LOAD TEST SEED PLAN
-- =========================

create table if not exists load_test_seed_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  batch_code text not null,
  title text not null,
  target_departments integer not null default 50,
  target_users integer not null default 1000,
  target_projects integer not null default 250,
  target_tasks integer not null default 5000,
  target_ovr_reports integer not null default 500,
  target_evidence_files integer not null default 1500,
  status text not null default 'planned' check (status in ('planned','generated','loaded','tested','failed','cancelled')),
  last_run_at timestamptz,
  duration_ms integer,
  performance_note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, batch_code)
);

-- =========================
-- PRODUCTION BACKUP STRATEGY / RESTORE ASSURANCE
-- =========================

create table if not exists production_backup_strategies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  strategy_code text not null,
  title text not null,
  backup_type text not null check (backup_type in ('browser_export','database_dump','storage_export','auth_export','full_platform')),
  frequency text not null default 'weekly',
  owner_label text,
  retention_days integer not null default 90 check (retention_days >= 1),
  includes_storage_files boolean not null default false,
  includes_auth_users boolean not null default false,
  requires_restore_dry_run boolean not null default true,
  status text not null default 'draft' check (status in ('draft','approved','active','paused','retired')),
  last_success_at timestamptz,
  next_due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, strategy_code)
);

create table if not exists backup_restore_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  backup_strategy_id uuid references production_backup_strategies(id) on delete set null,
  verification_code text not null,
  scenario_name text not null,
  status text not null default 'planned' check (status in ('planned','running','passed','failed','blocked','cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  row_count_match boolean,
  storage_files_checked boolean not null default false,
  auth_users_checked boolean not null default false,
  evidence_note text,
  failure_note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, verification_code)
);

-- =========================
-- MIGRATION RUNBOOK + DEFECT LOG
-- =========================

create table if not exists migration_runbook_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sequence_no integer not null,
  migration_file text not null,
  release_tag text not null,
  purpose text not null,
  is_required boolean not null default true,
  verification_query text,
  expected_result text,
  status text not null default 'pending' check (status in ('pending','verified','warning','blocked','skipped')),
  verified_at timestamptz,
  verified_by uuid references profiles(id) on delete set null,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sequence_no),
  unique (organization_id, migration_file)
);

create table if not exists consolidation_defect_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  defect_code text not null,
  title text not null,
  area text not null,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','in_progress','fixed','accepted','closed','cancelled')),
  owner_label text,
  found_in_version text,
  target_fix_version text,
  description text,
  resolution_note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, defect_code)
);

-- =========================
-- UPDATED_AT TRIGGERS
-- =========================

do $$
declare
  t text;
begin
  foreach t in array array[
    'staging_validation_cycles',
    'staging_validation_check_results',
    'rls_persona_scenarios',
    'i18n_translation_audit',
    'load_test_seed_batches',
    'production_backup_strategies',
    'backup_restore_verifications',
    'migration_runbook_entries',
    'consolidation_defect_log'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on %I', t, t);
    execute format('create trigger trg_%s_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_staging_cycles_org_status on staging_validation_cycles(organization_id, status);
create index if not exists idx_staging_checks_cycle_status on staging_validation_check_results(cycle_id, status, severity);
create index if not exists idx_rls_persona_active on rls_persona_scenarios(organization_id, is_active, role_name, access_scope);
create index if not exists idx_rls_runs_scenario_result on rls_persona_test_runs(scenario_id, result, tested_at);
create index if not exists idx_i18n_audit_module_status on i18n_translation_audit(organization_id, module_key, status);
create index if not exists idx_load_seed_org_status on load_test_seed_batches(organization_id, status);
create index if not exists idx_backup_strategy_org_status on production_backup_strategies(organization_id, status, next_due_date);
create index if not exists idx_restore_verifications_status on backup_restore_verifications(organization_id, status, started_at);
create index if not exists idx_migration_runbook_status on migration_runbook_entries(organization_id, sequence_no, status);
create index if not exists idx_defect_log_status on consolidation_defect_log(organization_id, status, severity);

-- =========================
-- DEFAULT SEED FUNCTION
-- =========================

create or replace function seed_staging_validation_defaults(target_organization_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  v_cycle_id uuid;
  inserted_count integer := 0;
begin
  select coalesce(target_organization_id, (select id from organizations order by created_at limit 1)) into org_id;
  if org_id is null then
    raise exception 'No organization exists to seed staging validation defaults';
  end if;

  insert into staging_validation_cycles (organization_id, cycle_code, title, environment_name, status, notes)
  values (org_id, 'STAGE-V23', 'v2.3 staging validation cycle', 'staging', 'planned', 'Created by v2.3 ultra stabilization patch.')
  on conflict (organization_id, cycle_code) do update set updated_at = now()
  returning id into v_cycle_id;

  insert into staging_validation_check_results (organization_id, cycle_id, check_area, check_code, check_title, status, severity, owner_label, evidence_note, sort_order)
  values
    (org_id, v_cycle_id, 'migrations', 'MIG-ALL-FRESH', 'Apply migrations 001 to 025 in a fresh Supabase staging project', 'pending', 'critical', 'System Admin', 'Screenshot or migration verifier export', 10),
    (org_id, v_cycle_id, 'security', 'RLS-PERSONAS', 'Run RLS persona test matrix for executive, manager, employee, Quality and Audit users', 'pending', 'critical', 'Access Control Admin', 'Persona lab export', 20),
    (org_id, v_cycle_id, 'bilingual', 'AR-RTL-SCREENS', 'Review Arabic/RTL on all active pages and key print reports', 'pending', 'high', 'Governance Admin', 'Translation coverage export', 30),
    (org_id, v_cycle_id, 'performance', 'LOAD-1000-USERS', 'Load-test seed plan for 1,000 users, 50 departments and high-volume tasks/OVRs', 'pending', 'high', 'IT / QA', 'Load seed batch result', 40),
    (org_id, v_cycle_id, 'backup', 'RESTORE-DRY-RUN', 'Complete restore dry-run using latest backup/export strategy', 'pending', 'critical', 'IT / Governance', 'Restore verification record', 50)
  on conflict (organization_id, cycle_id, check_code) do nothing;
  get diagnostics inserted_count = row_count;

  insert into rls_persona_scenarios (organization_id, persona_code, persona_name_en, persona_name_ar, role_name, access_scope, test_area, allowed_expectation, denied_expectation, sort_order)
  values
    (org_id, 'CEO-GLOBAL', 'CEO / Executive global view', 'الرئيس التنفيذي / العرض الشامل', 'executive', 'global', 'command_center', 'Can view all critical risks, OVRs, approvals and escalations.', 'Cannot bypass workflow evidence controls by direct self-approval.', 10),
    (org_id, 'DEPT-MGR', 'Department manager scoped view', 'مدير إدارة بنطاق الإدارة', 'department_manager', 'department', 'department_control', 'Can view own department projects, OVRs and tasks.', 'Cannot view unrelated department employee work queues.', 20),
    (org_id, 'EMPLOYEE-ASSIGNED', 'Employee assigned-only workspace', 'موظف - الأعمال المسندة فقط', 'employee', 'assigned_only', 'my_work', 'Can view own assigned tasks and submitted OVRs.', 'Cannot view executive dashboards, other employees, or confidential OVRs.', 30),
    (org_id, 'QUALITY-OVR', 'Quality OVR reviewer', 'مراجع الجودة لبلاغات OVR', 'governance_admin', 'global', 'ovr', 'Can classify, return, request evidence and close OVRs after evidence.', 'Cannot close without accepted evidence and closure user.', 40),
    (org_id, 'AUDITOR-FINDINGS', 'Auditor finding reviewer', 'مراجع ملاحظات التدقيق', 'auditor', 'global', 'audit', 'Can review audit evidence and close findings after review.', 'Departments cannot close their own findings without audit review.', 50)
  on conflict (organization_id, persona_code) do nothing;

  insert into i18n_translation_audit (organization_id, module_key, screen_name, label_group, total_labels, translated_ar, translated_en, rtl_checked, status, reviewer_note)
  values
    (org_id, 'core', 'Navigation / Shell', 'nav', 45, 45, 45, true, 'complete', 'Core navigation has bilingual labels.'),
    (org_id, 'ovr', 'OVR Workflow', 'forms_and_status', 60, 54, 60, false, 'needs_review', 'Review Arabic text in OVR workflow and print layout.'),
    (org_id, 'reports', 'Reports / Export', 'buttons_and_filters', 48, 38, 48, false, 'needs_review', 'Complete report filters and export label review.'),
    (org_id, 'admin', 'Access / Setup / Safety', 'warnings', 52, 42, 52, false, 'needs_review', 'Admin warnings need Arabic QA review.')
  on conflict (organization_id, module_key, screen_name, label_group) do nothing;

  insert into load_test_seed_batches (organization_id, batch_code, title, target_departments, target_users, target_projects, target_tasks, target_ovr_reports, target_evidence_files, status, performance_note)
  values (org_id, 'LOAD-1000-50', '1,000 users / 50 departments staging load plan', 50, 1000, 250, 5000, 500, 1500, 'planned', 'Use staging only. Do not run on production data.')
  on conflict (organization_id, batch_code) do nothing;

  insert into production_backup_strategies (organization_id, strategy_code, title, backup_type, frequency, owner_label, retention_days, includes_storage_files, includes_auth_users, requires_restore_dry_run, status, next_due_date, notes)
  values
    (org_id, 'BROWSER-EXPORT', 'Browser export package before large changes', 'browser_export', 'before_major_change', 'Governance Admin', 90, false, false, true, 'active', current_date + interval '7 days', 'Good for external analysis but not a full platform backup.'),
    (org_id, 'DB-DUMP', 'PostgreSQL database backup/dump', 'database_dump', 'daily', 'IT / Supabase Admin', 180, false, false, true, 'draft', current_date + interval '14 days', 'Production-grade database backup must be configured outside the browser.'),
    (org_id, 'STORAGE-EXPORT', 'Evidence/document storage export', 'storage_export', 'weekly', 'IT / Quality', 180, true, false, true, 'draft', current_date + interval '14 days', 'Required because evidence files are not inside CSV/JSON row exports.'),
    (org_id, 'AUTH-EXPORT', 'Auth/user recovery plan', 'auth_export', 'monthly', 'System Admin', 180, false, true, true, 'draft', current_date + interval '30 days', 'Document auth recovery/admin access plan.')
  on conflict (organization_id, strategy_code) do nothing;

  insert into backup_restore_verifications (organization_id, verification_code, scenario_name, status, evidence_note)
  values (org_id, 'RESTORE-V23-STAGING', 'Restore latest export into clean staging project and compare row counts', 'planned', 'Record migration state, row-count comparison and screenshot evidence.')
  on conflict (organization_id, verification_code) do nothing;

  insert into migration_runbook_entries (organization_id, sequence_no, migration_file, release_tag, purpose, verification_query, expected_result, status)
  values
    (org_id, 23, '023_enterprise_intelligence_reporting.sql', 'v2.1', 'Board packs, advanced reports, evidence vault, scorecards and backup scheduler', 'select count(*) from board_pack_snapshots;', 'Query returns without relation error', 'pending'),
    (org_id, 24, '024_automation_intelligence_kri_reviews.sql', 'v2.2', 'Automation rules, KRIs, recurring reviews and executive exceptions', 'select count(*) from automation_rules;', 'Query returns without relation error', 'pending'),
    (org_id, 25, '025_staging_validation_consolidation.sql', 'v2.3', 'Staging validation, RLS persona lab, translation audit, load seed plan and backup strategy', 'select count(*) from staging_validation_cycles;', 'Query returns without relation error', 'pending')
  on conflict (organization_id, sequence_no) do nothing;

  insert into consolidation_defect_log (organization_id, defect_code, title, area, severity, status, owner_label, found_in_version, target_fix_version, description)
  values
    (org_id, 'DEF-I18N-001', 'Complete Arabic coverage audit for older pages', 'bilingual', 'high', 'open', 'Governance Admin', 'v2.3', 'v2.4', 'Older pages may still have English-only labels or validation messages.'),
    (org_id, 'DEF-RLS-001', 'Run real persona testing before employee rollout', 'security', 'critical', 'open', 'Access Control Admin', 'v2.3', 'pre-production', 'Role/scope model must be verified with actual test users.'),
    (org_id, 'DEF-BKP-001', 'Configure production server-side backup outside browser export', 'backup', 'critical', 'open', 'IT / Supabase Admin', 'v2.3', 'pre-production', 'Browser export is useful but not equivalent to full database/storage/auth backup.')
  on conflict (organization_id, defect_code) do nothing;

  return jsonb_build_object('organization_id', org_id, 'cycle_id', v_cycle_id, 'inserted_checks', inserted_count, 'status', 'seeded');
end;
$$;

-- =========================
-- VIEWS
-- =========================

create or replace view v_staging_validation_summary as
select
  o.id as organization_id,
  coalesce(max(c.created_at), now()) as last_cycle_created_at,
  count(distinct c.id) as cycles,
  count(ch.id) filter (where ch.status = 'blocked') as blocked_checks,
  count(ch.id) filter (where ch.status = 'warning') as warning_checks,
  count(ch.id) filter (where ch.status = 'pass') as passed_checks,
  count(ch.id) filter (where ch.status = 'pending') as pending_checks,
  case
    when count(ch.id) = 0 then 0
    else round(100.0 * count(ch.id) filter (where ch.status = 'pass') / count(ch.id))::int
  end as staging_readiness_score,
  count(cd.id) filter (where cd.status in ('open','in_progress') and cd.severity = 'critical') as critical_open_defects,
  count(cd.id) filter (where cd.status in ('open','in_progress') and cd.severity = 'high') as high_open_defects
from organizations o
left join staging_validation_cycles c on c.organization_id = o.id
left join staging_validation_check_results ch on ch.organization_id = o.id and (ch.cycle_id = c.id or c.id is null)
left join consolidation_defect_log cd on cd.organization_id = o.id
group by o.id;

create or replace view v_staging_validation_checks as
select
  ch.*,
  c.cycle_code,
  c.title as cycle_title,
  c.environment_name,
  c.status as cycle_status,
  case
    when ch.status = 'blocked' then 100
    when ch.status = 'warning' then 60
    when ch.status = 'pending' then 30
    when ch.status = 'pass' then 0
    else 10
  end as attention_weight
from staging_validation_check_results ch
left join staging_validation_cycles c on c.id = ch.cycle_id;

create or replace view v_rls_persona_lab as
select
  s.*,
  latest.result as latest_result,
  latest.tested_at as latest_tested_at,
  latest.evidence_note as latest_evidence_note,
  latest.failure_note as latest_failure_note,
  case
    when latest.result is null then 'not_tested'
    when latest.result = 'pass' then 'passed'
    when latest.result = 'warning' then 'warning'
    when latest.result = 'fail' then 'failed'
    else 'pending'
  end as persona_status
from rls_persona_scenarios s
left join lateral (
  select r.*
  from rls_persona_test_runs r
  where r.scenario_id = s.id
  order by r.tested_at desc
  limit 1
) latest on true;

create or replace view v_i18n_translation_coverage as
select
  a.*,
  case when a.total_labels = 0 then 0 else round(100.0 * least(a.translated_ar, a.translated_en) / a.total_labels)::int end as coverage_percent,
  greatest(a.total_labels - a.translated_ar, 0) as missing_ar_count,
  greatest(a.total_labels - a.translated_en, 0) as missing_en_count,
  case
    when a.total_labels > 0 and a.translated_ar >= a.total_labels and a.translated_en >= a.total_labels and a.rtl_checked then 'complete'
    when a.translated_ar < a.total_labels then 'missing_ar'
    when a.translated_en < a.total_labels then 'missing_en'
    else 'needs_rtl_review'
  end as computed_status
from i18n_translation_audit a;

create or replace view v_load_test_seed_status as
select
  b.*,
  (b.target_users + b.target_projects + b.target_tasks + b.target_ovr_reports + b.target_evidence_files) as target_total_rows,
  case
    when b.status in ('tested') and coalesce(b.duration_ms, 999999) <= 3000 then 'healthy'
    when b.status in ('tested','loaded') then 'watch'
    when b.status = 'failed' then 'blocked'
    else 'planned'
  end as performance_signal
from load_test_seed_batches b;

create or replace view v_production_backup_strategy_status as
select
  s.*,
  case
    when s.status not in ('active','approved') then 'not_active'
    when s.next_due_date is not null and s.next_due_date < current_date then 'overdue'
    when s.requires_restore_dry_run and not exists (
      select 1 from backup_restore_verifications v
      where v.organization_id = s.organization_id
        and (v.backup_strategy_id = s.id or v.backup_strategy_id is null)
        and v.status = 'passed'
        and v.finished_at >= now() - interval '90 days'
    ) then 'restore_test_needed'
    else 'ok'
  end as backup_signal
from production_backup_strategies s;

create or replace view v_restore_verification_status as
select
  v.*,
  s.strategy_code,
  s.title as strategy_title,
  case
    when v.status = 'passed' and coalesce(v.row_count_match, false) then 'verified'
    when v.status = 'failed' then 'failed'
    when v.status = 'blocked' then 'blocked'
    else 'needs_work'
  end as verification_signal
from backup_restore_verifications v
left join production_backup_strategies s on s.id = v.backup_strategy_id;

create or replace view v_migration_runbook_status as
select
  m.*,
  case
    when m.status = 'verified' then 0
    when m.status = 'warning' then 40
    when m.status = 'blocked' then 100
    else 60
  end as attention_weight
from migration_runbook_entries m;

create or replace view v_consolidation_defect_dashboard as
select
  d.*,
  case
    when d.status in ('closed','cancelled') then 0
    when d.severity = 'critical' then 100
    when d.severity = 'high' then 70
    when d.severity = 'medium' then 40
    else 20
  end as defect_weight
from consolidation_defect_log d;

-- =========================
-- BOOTSTRAP DEFAULTS FOR FIRST ORGANIZATION
-- =========================

do $$
declare org_id uuid;
begin
  select id into org_id from organizations order by created_at limit 1;
  if org_id is not null then
    perform seed_staging_validation_defaults(org_id);
  end if;
end $$;
