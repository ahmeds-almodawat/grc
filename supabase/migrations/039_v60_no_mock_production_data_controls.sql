-- =========================================================
-- GRC Control Center - v6.0 No-Mock Production Data Controls
-- =========================================================

create table if not exists production_data_controls (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title_en text not null,
  title_ar text,
  control_area text not null default 'production_data',
  severity text not null default 'critical',
  required_status text not null default 'passed',
  current_status text not null default 'not_tested',
  owner_role text,
  evidence_required boolean not null default true,
  evidence_note text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists no_mock_audit_runs (
  id uuid primary key default gen_random_uuid(),
  run_label text not null default 'manual',
  total_findings integer not null default 0,
  production_blocking_findings integer not null default 0,
  critical_findings integer not null default 0,
  high_findings integer not null default 0,
  medium_findings integer not null default 0,
  files_with_findings integer not null default 0,
  report_path text,
  passed boolean generated always as (production_blocking_findings = 0) stored,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists production_empty_state_checks (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  section_key text not null,
  expected_behavior_en text not null default 'Show no live data message; do not show demo/fallback rows.',
  expected_behavior_ar text,
  checked_status text not null default 'not_tested',
  notes text,
  checked_by uuid references profiles(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(page_key, section_key)
);

create or replace function set_v60_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_v60_production_data_controls_updated on production_data_controls;
create trigger trg_v60_production_data_controls_updated
before update on production_data_controls
for each row execute function set_v60_updated_at();

create or replace function seed_v60_no_mock_controls_defaults()
returns void as $$
begin
  insert into production_data_controls (code, title_en, title_ar, severity, owner_role, evidence_note)
  values
    ('NO_SILENT_FALLBACK', 'No silent fallback/demo/sample/mock data in production UI', 'منع ظهور بيانات بديلة أو تجريبية بشكل صامت في واجهة الإنتاج', 'critical', 'governance_admin', 'Attach v60-production-data-audit.json with zero production-blocking findings.'),
    ('DEMO_ENV_GUARD', 'Demo data allowed only when VITE_ALLOW_DEMO_DATA=true and not production', 'السماح بالبيانات التجريبية فقط خارج الإنتاج وبإعداد واضح', 'critical', 'it_admin', 'Attach production environment screenshot showing VITE_ALLOW_DEMO_DATA=false.'),
    ('LIVE_EMPTY_STATE', 'Empty Supabase results show live-data empty states, not fake rows', 'نتائج Supabase الفارغة تعرض رسالة عدم توفر بيانات فعلية وليس صفوف وهمية', 'high', 'governance_admin', 'Attach screenshots from empty staging data.'),
    ('SUPABASE_REQUIRED', 'Production requires configured Supabase URL and anon key', 'الإنتاج يتطلب إعداد Supabase URL و anon key', 'critical', 'it_admin', 'Attach deployment environment variable evidence.'),
    ('PHASED_TESTS_PASS', 'v6.0 phased tests pass before pilot', 'اجتياز اختبارات v6.0 المرحلية قبل التجربة', 'high', 'project_owner', 'Attach release/v60/v60-phase-results.json.')
  on conflict (code) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    severity = excluded.severity,
    owner_role = excluded.owner_role,
    evidence_note = excluded.evidence_note;

  insert into production_empty_state_checks (page_key, section_key, expected_behavior_ar)
  values
    ('home', 'executive_daily_check', 'عرض رسالة عدم توفر بيانات فعلية عند عدم وجود بيانات.'),
    ('executive_command', 'critical_stream', 'عدم عرض مخاطر أو قرارات وهمية عند عدم وجود بيانات.'),
    ('projects', 'project_list', 'قائمة فارغة مع إرشاد للاستيراد أو الإنشاء.'),
    ('risks', 'risk_register', 'عدم عرض مخاطر تجريبية في الإنتاج.'),
    ('ovr', 'ovr_queue', 'عدم عرض بلاغات OVR تجريبية في الإنتاج.'),
    ('reports', 'report_catalog', 'عرض الكتالوج الحقيقي فقط أو رسالة إعداد.'),
    ('admin', 'access_matrix', 'عدم عرض مستخدمين وهميين أو أدوار تجريبية.')
  on conflict (page_key, section_key) do nothing;
end;
$$ language plpgsql;

create or replace view v_v60_no_mock_control_scorecard as
select
  count(*) as total_controls,
  count(*) filter (where current_status = required_status) as passed_controls,
  count(*) filter (where current_status <> required_status and severity = 'critical') as critical_open_controls,
  count(*) filter (where current_status <> required_status and severity = 'high') as high_open_controls,
  case when count(*) = 0 then 0 else round((count(*) filter (where current_status = required_status)::numeric / count(*)::numeric) * 100, 2) end as readiness_percent
from production_data_controls;

create or replace view v_v60_latest_no_mock_audit as
select *
from no_mock_audit_runs
order by created_at desc
limit 1;

create or replace view v_v60_empty_state_readiness as
select
  count(*) as total_checks,
  count(*) filter (where checked_status = 'passed') as passed_checks,
  count(*) filter (where checked_status <> 'passed') as open_checks,
  case when count(*) = 0 then 0 else round((count(*) filter (where checked_status = 'passed')::numeric / count(*)::numeric) * 100, 2) end as readiness_percent
from production_empty_state_checks;
