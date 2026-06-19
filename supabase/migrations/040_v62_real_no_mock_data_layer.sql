-- v6.2 Real No-Mock Data Layer
-- Purpose: register production data-result controls and demo-data boundary checks.

create table if not exists public.v62_real_data_result_status_catalog (
  status_code text primary key,
  title_en text not null,
  title_ar text not null,
  production_meaning text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.v62_production_data_layer_controls (
  control_code text primary key,
  title_en text not null,
  title_ar text not null,
  control_type text not null check (control_type in ('contract','demo_boundary','empty_state','error_state','audit','test')),
  required_for_pilot boolean not null default true,
  required_for_production boolean not null default true,
  status text not null default 'unverified' check (status in ('unverified','in_progress','passed','failed','waived')),
  evidence_note text,
  owner_role text not null default 'IT / Quality',
  updated_at timestamptz not null default now()
);

create table if not exists public.v62_demo_data_boundary_checks (
  check_code text primary key,
  title_en text not null,
  title_ar text not null,
  expected_state text not null,
  current_state text not null default 'unverified',
  severity text not null default 'high' check (severity in ('low','medium','high','critical')),
  updated_at timestamptz not null default now()
);

alter table public.v62_real_data_result_status_catalog enable row level security;
alter table public.v62_production_data_layer_controls enable row level security;
alter table public.v62_demo_data_boundary_checks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'v62_real_data_result_status_catalog' and policyname = 'v62 result status authenticated read'
  ) then
    create policy "v62 result status authenticated read" on public.v62_real_data_result_status_catalog for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'v62_production_data_layer_controls' and policyname = 'v62 data controls authenticated read'
  ) then
    create policy "v62 data controls authenticated read" on public.v62_production_data_layer_controls for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'v62_demo_data_boundary_checks' and policyname = 'v62 demo boundary authenticated read'
  ) then
    create policy "v62 demo boundary authenticated read" on public.v62_demo_data_boundary_checks for select to authenticated using (true);
  end if;
end $$;

create or replace function public.seed_v62_real_no_mock_data_layer_defaults()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.v62_real_data_result_status_catalog (status_code, title_en, title_ar, production_meaning) values
    ('live', 'Live data', 'بيانات فعلية', 'Query succeeded and returned real data.'),
    ('empty', 'Empty live result', 'نتيجة فعلية فارغة', 'Query succeeded but no live rows exist.'),
    ('unauthorized', 'Unauthorized', 'غير مصرح', 'The current user/session/role is not allowed to view the data.'),
    ('configuration_error', 'Configuration error', 'خطأ في الإعدادات', 'The live data source is missing or misconfigured.'),
    ('query_error', 'Query error', 'خطأ في الاستعلام', 'The live query failed and must not be hidden as fake data.')
  on conflict (status_code) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    production_meaning = excluded.production_meaning;

  insert into public.v62_production_data_layer_controls (control_code, title_en, title_ar, control_type, evidence_note, owner_role) values
    ('LIVE_RESULT_CONTRACT', 'Typed live-data result contract exists', 'وجود عقد نوعي لنتائج البيانات الفعلية', 'contract', 'src/lib/liveResult.ts', 'IT'),
    ('DEMO_BOUNDARY', 'Demo fixtures isolated from production runtime', 'عزل البيانات التجريبية عن تشغيل الإنتاج', 'demo_boundary', 'src/demo only; VITE_ALLOW_DEMO_DATA=false in production', 'IT'),
    ('EMPTY_STATES', 'Empty live results show empty states', 'إظهار حالة فارغة عند عدم وجود بيانات فعلية', 'empty_state', 'UI should not show fictional rows when tables are empty.', 'IT / Quality'),
    ('QUERY_ERRORS_VISIBLE', 'Query errors are visible and not converted to fake data', 'إظهار أخطاء الاستعلام وعدم تحويلها إلى بيانات وهمية', 'error_state', 'query_error status must be surfaced to users/admins.', 'IT'),
    ('STATIC_AUDIT', 'Static no-mock audit passes', 'نجاح فحص عدم استخدام البيانات الوهمية', 'audit', 'npm run v62:static-strict', 'IT'),
    ('DEMO_BOUNDARY_AUDIT', 'Demo boundary audit passes', 'نجاح فحص حدود البيانات التجريبية', 'audit', 'npm run v62:demo-boundary', 'IT')
  on conflict (control_code) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    control_type = excluded.control_type,
    evidence_note = excluded.evidence_note,
    owner_role = excluded.owner_role,
    updated_at = now();

  insert into public.v62_demo_data_boundary_checks (check_code, title_en, title_ar, expected_state, severity) values
    ('NO_DEMO_IMPORTS', 'No production module imports src/demo', 'عدم استيراد وحدات الإنتاج لمجلد البيانات التجريبية', '0 imports outside src/demo', 'critical'),
    ('PROD_DEMO_FLAG_FALSE', 'Production demo flag is false', 'تعطيل علامة البيانات التجريبية في الإنتاج', 'VITE_ALLOW_DEMO_DATA=false', 'critical'),
    ('DEMO_HELPER_ONLY', 'Demo flag used only through helper', 'استخدام علامة البيانات التجريبية عبر مساعد مخصص فقط', 'Only src/lib/demoMode.ts reads VITE_ALLOW_DEMO_DATA', 'high')
  on conflict (check_code) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    expected_state = excluded.expected_state,
    severity = excluded.severity,
    updated_at = now();
end;
$$;

create or replace view public.v_v62_real_data_layer_scorecard as
select
  count(*)::int as total_controls,
  count(*) filter (where status = 'passed')::int as passed_controls,
  count(*) filter (where status = 'unverified')::int as unverified_controls,
  count(*) filter (where required_for_production and status <> 'passed')::int as production_open_controls,
  case
    when count(*) = 0 then 0
    else round((count(*) filter (where status = 'passed')::numeric / count(*)::numeric) * 100, 2)
  end as readiness_percent
from public.v62_production_data_layer_controls;

create or replace view public.v_v62_demo_boundary_scorecard as
select
  count(*)::int as total_checks,
  count(*) filter (where current_state = expected_state)::int as passed_checks,
  count(*) filter (where current_state <> expected_state and severity in ('critical','high'))::int as blocking_checks,
  count(*) filter (where current_state = 'unverified')::int as unverified_checks
from public.v62_demo_data_boundary_checks;
