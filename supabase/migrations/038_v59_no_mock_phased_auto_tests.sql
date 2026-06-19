-- =========================================================
-- GRC Control Center v5.9
-- No-Mock Governance + Phased Auto-Test Registry
-- =========================================================

create table if not exists no_mock_audit_findings (
  id uuid primary key default gen_random_uuid(),
  finding_code text unique,
  file_path text not null,
  line_number integer,
  finding_term text not null,
  severity text not null default 'medium',
  production_blocking boolean not null default false,
  status text not null default 'open',
  owner_name text,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mock_data_allowlist (
  id uuid primary key default gen_random_uuid(),
  allowlist_code text unique not null,
  file_path_pattern text not null,
  reason text not null,
  environment_scope text not null default 'development_only',
  approved_by_name text,
  approved_at timestamptz,
  expires_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists phased_auto_test_phases (
  id uuid primary key default gen_random_uuid(),
  phase_number integer not null unique,
  phase_code text not null unique,
  title_en text not null,
  title_ar text,
  objective_en text not null,
  command_text text not null,
  is_required_for_pilot boolean not null default true,
  is_required_for_production boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists phased_auto_test_cases (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references phased_auto_test_phases(id) on delete cascade,
  case_code text not null unique,
  title_en text not null,
  title_ar text,
  expected_result_en text not null,
  automation_command text,
  severity_if_failed text not null default 'medium',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists phased_auto_test_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text unique,
  run_scope text not null default 'all_phases',
  started_by_name text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',
  summary_json jsonb not null default '{}'::jsonb,
  notes text
);

create table if not exists phased_auto_test_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references phased_auto_test_runs(id) on delete cascade,
  phase_id uuid references phased_auto_test_phases(id) on delete set null,
  case_id uuid references phased_auto_test_cases(id) on delete set null,
  result_status text not null default 'not_run',
  evidence_path text,
  result_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists production_data_switchovers (
  id uuid primary key default gen_random_uuid(),
  switchover_code text unique not null,
  title_en text not null,
  title_ar text,
  requirement_en text not null,
  current_status text not null default 'not_verified',
  owner_name text,
  evidence_reference text,
  verified_by_name text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_no_mock_findings_status on no_mock_audit_findings(status, production_blocking);
create index if not exists idx_phase_results_run on phased_auto_test_results(run_id);
create index if not exists idx_phase_results_phase on phased_auto_test_results(phase_id);
create index if not exists idx_prod_switch_status on production_data_switchovers(current_status);

create or replace view v_v59_mock_data_findings_summary as
select
  count(*)::int as total_findings,
  count(*) filter (where production_blocking = true)::int as production_blocking_findings,
  count(*) filter (where status not in ('closed', 'accepted_risk'))::int as open_findings,
  count(*) filter (where production_blocking = true and status not in ('closed', 'accepted_risk'))::int as open_production_blockers,
  case
    when count(*) filter (where production_blocking = true and status not in ('closed', 'accepted_risk')) = 0 then 'ready'
    else 'blocked'
  end as no_mock_status
from no_mock_audit_findings;

create or replace view v_v59_phase_test_scorecard as
select
  p.phase_number,
  p.phase_code,
  p.title_en,
  p.title_ar,
  p.command_text,
  count(c.id)::int as test_cases,
  p.is_required_for_pilot,
  p.is_required_for_production
from phased_auto_test_phases p
left join phased_auto_test_cases c on c.phase_id = p.id and c.is_active = true
group by p.id
order by p.phase_number;

create or replace view v_v59_latest_phase_results as
with latest_run as (
  select id
  from phased_auto_test_runs
  order by started_at desc
  limit 1
)
select
  p.phase_number,
  p.phase_code,
  p.title_en,
  coalesce(count(r.id), 0)::int as results_recorded,
  coalesce(count(r.id) filter (where r.result_status = 'passed'), 0)::int as passed_results,
  coalesce(count(r.id) filter (where r.result_status = 'failed'), 0)::int as failed_results,
  case
    when count(r.id) = 0 then 'not_run'
    when count(r.id) filter (where r.result_status = 'failed') > 0 then 'failed'
    else 'passed'
  end as phase_status
from phased_auto_test_phases p
left join phased_auto_test_results r on r.phase_id = p.id and r.run_id in (select id from latest_run)
group by p.id
order by p.phase_number;

create or replace view v_v59_production_data_readiness as
select
  count(*)::int as total_requirements,
  count(*) filter (where current_status in ('verified', 'done', 'passed'))::int as verified_requirements,
  count(*) filter (where current_status in ('blocked', 'failed'))::int as blocked_requirements,
  case
    when count(*) = 0 then 0
    else round((count(*) filter (where current_status in ('verified', 'done', 'passed'))::numeric / count(*)::numeric) * 100, 1)
  end as readiness_percent
from production_data_switchovers;

create or replace function seed_v59_no_mock_phased_tests_defaults()
returns void
language plpgsql
as $$
declare
  phase1 uuid;
  phase2 uuid;
  phase3 uuid;
  phase4 uuid;
  phase5 uuid;
  phase6 uuid;
begin
  insert into phased_auto_test_phases (phase_number, phase_code, title_en, title_ar, objective_en, command_text, sort_order)
  values
    (1, 'LOCAL_BUILD', 'Local build foundation', 'أساس البناء المحلي', 'TypeScript and production build must pass.', 'npm run test:phase1', 1),
    (2, 'NO_MOCK', 'No-mock audit', 'تدقيق إزالة البيانات التجريبية', 'Detect mock/demo/fallback data before pilot.', 'npm run test:phase2', 2),
    (3, 'MIGRATIONS', 'Migration/schema artifact check', 'فحص ملفات الترحيل وقاعدة البيانات', 'Verify required migration artifacts exist.', 'npm run test:phase3', 3),
    (4, 'WORKFLOWS', 'Workflow artifact check', 'فحص مسارات العمل', 'Verify major workflow modules are present.', 'npm run test:phase4', 4),
    (5, 'BACKUP_RESTORE', 'Backup/restore proof artifacts', 'أدلة النسخ والاستعادة', 'Verify backup and restore proof artifacts are available.', 'npm run test:phase5', 5),
    (6, 'PILOT_READY', 'Pilot readiness artifacts', 'جاهزية المرحلة التجريبية', 'Verify pilot, rollout, and security artifacts exist.', 'npm run test:phase6', 6)
  on conflict (phase_number) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    objective_en = excluded.objective_en,
    command_text = excluded.command_text;

  select id into phase1 from phased_auto_test_phases where phase_code = 'LOCAL_BUILD';
  select id into phase2 from phased_auto_test_phases where phase_code = 'NO_MOCK';
  select id into phase3 from phased_auto_test_phases where phase_code = 'MIGRATIONS';
  select id into phase4 from phased_auto_test_phases where phase_code = 'WORKFLOWS';
  select id into phase5 from phased_auto_test_phases where phase_code = 'BACKUP_RESTORE';
  select id into phase6 from phased_auto_test_phases where phase_code = 'PILOT_READY';

  insert into phased_auto_test_cases (phase_id, case_code, title_en, title_ar, expected_result_en, automation_command, severity_if_failed)
  values
    (phase1, 'P1_TYPECHECK', 'TypeScript typecheck', 'فحص TypeScript', 'tsc completes without errors.', 'npm run typecheck', 'critical'),
    (phase1, 'P1_BUILD', 'Production build', 'بناء الإنتاج', 'Vite production build completes successfully.', 'npm run build', 'critical'),
    (phase2, 'P2_MOCK_AUDIT', 'Mock data audit', 'تدقيق البيانات التجريبية', 'Mock/fallback/demo scan completes.', 'npm run no-mock:audit', 'high'),
    (phase2, 'P2_MOCK_FAIL_STRICT', 'Strict no-mock gate', 'بوابة صارمة للبيانات التجريبية', 'Production-blocking mock findings are zero.', 'npm run no-mock:fail', 'critical'),
    (phase3, 'P3_MIGRATIONS_EXIST', 'Migration artifact check', 'فحص ملفات الترحيل', 'Migration files exist including v5.9.', 'npm run test:phase3', 'critical'),
    (phase4, 'P4_WORKFLOW_ARTIFACTS', 'Workflow artifact check', 'فحص مسارات العمل', 'Major workflow pages/artifacts exist.', 'npm run test:phase4', 'high'),
    (phase5, 'P5_BACKUP_RESTORE', 'Backup/restore local proof', 'إثبات النسخ والاستعادة', 'Backup/restore scripts run locally.', 'npm run test:phase5', 'critical'),
    (phase6, 'P6_PILOT_READY', 'Pilot readiness local proof', 'إثبات جاهزية التجربة', 'Pilot/rollout/security scripts and docs exist.', 'npm run test:phase6', 'high')
  on conflict (case_code) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    expected_result_en = excluded.expected_result_en,
    automation_command = excluded.automation_command,
    severity_if_failed = excluded.severity_if_failed;

  insert into production_data_switchovers (switchover_code, title_en, title_ar, requirement_en, current_status)
  values
    ('ENV_REQUIRE_SUPABASE', 'Require Supabase in production', 'إلزام Supabase في الإنتاج', 'Production environment must not operate as demo-only.', 'not_verified'),
    ('ENV_DISABLE_DEMO', 'Disable demo data in production', 'إيقاف البيانات التجريبية في الإنتاج', 'VITE_ALLOW_DEMO_DATA should be false for production.', 'not_verified'),
    ('EMPTY_STATE_READY', 'Empty/error states ready', 'جاهزية حالات عدم وجود البيانات والأخطاء', 'Screens should show explicit empty/error states instead of fake fallback data.', 'not_verified'),
    ('REAL_IMPORT_REVIEWED', 'Real import files reviewed', 'مراجعة ملفات البيانات الحقيقية', 'Departments/users/projects import files reviewed before pilot.', 'not_verified'),
    ('PILOT_DATA_APPROVED', 'Pilot data approved', 'اعتماد بيانات التجربة', 'Pilot data source approved by owner.', 'not_verified')
  on conflict (switchover_code) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    requirement_en = excluded.requirement_en;
end;
$$;
