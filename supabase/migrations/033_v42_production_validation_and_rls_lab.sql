-- =========================================================
-- GRC Control Center - Migration 033
-- v4.2 Production Validation, Release Candidate Controls,
-- Fresh Supabase Install Verification, and RLS Persona Lab
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists production_validation_runs (
  id uuid primary key default gen_random_uuid(),
  validation_area text not null,
  run_name text not null,
  status text not null default 'pending' check (status in ('pending','pass','warning','blocked','failed','cancelled')),
  score numeric(5,2) default 0 check (score >= 0 and score <= 100),
  evidence_summary text,
  evidence_path text,
  owner_name text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists release_candidate_controls (
  id uuid primary key default gen_random_uuid(),
  control_code text not null unique,
  control_name_en text not null,
  control_name_ar text,
  phase text not null,
  required_for_pilot boolean not null default true,
  required_for_production boolean not null default true,
  status text not null default 'pending' check (status in ('pending','pass','warning','blocked','not_applicable')),
  owner_role text,
  evidence_required boolean not null default true,
  evidence_note text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists supabase_install_verification_items (
  id uuid primary key default gen_random_uuid(),
  item_code text not null unique,
  item_name_en text not null,
  item_name_ar text,
  item_type text not null check (item_type in ('table','view','function','policy','storage','seed','environment','manual')),
  expected_name text not null,
  is_required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','verified','missing','warning','not_applicable')),
  verification_note text,
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rls_persona_test_cases (
  id uuid primary key default gen_random_uuid(),
  persona_code text not null,
  persona_name_en text not null,
  persona_name_ar text,
  role_name text not null,
  scope_name text not null,
  test_code text not null,
  test_name_en text not null,
  test_name_ar text,
  expected_behavior text not null check (expected_behavior in ('allow','deny')),
  target_module text not null,
  test_steps text not null,
  pass_condition text not null,
  priority integer not null default 1 check (priority between 1 and 5),
  is_hard_stop boolean not null default false,
  created_at timestamptz not null default now(),
  unique (persona_code, test_code)
);

create table if not exists rls_persona_test_runs (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid references rls_persona_test_cases(id) on delete cascade,
  test_cycle text not null default 'staging',
  tester_name text,
  result text not null default 'pending' check (result in ('pending','pass','failed','blocked','not_applicable')),
  evidence_note text,
  screenshot_path text,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration 025 introduced this table for scenario-based persona tests. A
-- CREATE TABLE IF NOT EXISTS does not add the v4.2 test-case columns when that
-- earlier shape is present, so upgrade it explicitly and retain both models.
alter table rls_persona_test_runs
  add column if not exists test_case_id uuid references rls_persona_test_cases(id) on delete cascade,
  add column if not exists test_cycle text not null default 'staging',
  add column if not exists tester_name text,
  add column if not exists screenshot_path text,
  add column if not exists updated_at timestamptz not null default now();

alter table rls_persona_test_runs
  drop constraint if exists rls_persona_test_runs_result_check;

alter table rls_persona_test_runs
  add constraint rls_persona_test_runs_result_check
  check (result in ('pending','pass','fail','failed','warning','blocked','not_applicable'));

create table if not exists rls_violation_findings (
  id uuid primary key default gen_random_uuid(),
  finding_code text not null unique,
  severity text not null default 'high' check (severity in ('critical','high','medium','low')),
  persona_code text not null,
  module_name text not null,
  finding_summary text not null,
  expected_behavior text not null,
  actual_behavior text not null,
  status text not null default 'open' check (status in ('open','in_progress','fixed','accepted_risk','closed')),
  owner_name text,
  due_date date,
  fix_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_production_validation_runs_updated_at on production_validation_runs;
create trigger trg_production_validation_runs_updated_at
before update on production_validation_runs
for each row execute function set_updated_at();

drop trigger if exists trg_release_candidate_controls_updated_at on release_candidate_controls;
create trigger trg_release_candidate_controls_updated_at
before update on release_candidate_controls
for each row execute function set_updated_at();

drop trigger if exists trg_supabase_install_verification_items_updated_at on supabase_install_verification_items;
create trigger trg_supabase_install_verification_items_updated_at
before update on supabase_install_verification_items
for each row execute function set_updated_at();

drop trigger if exists trg_rls_persona_test_runs_updated_at on rls_persona_test_runs;
create trigger trg_rls_persona_test_runs_updated_at
before update on rls_persona_test_runs
for each row execute function set_updated_at();

drop trigger if exists trg_rls_violation_findings_updated_at on rls_violation_findings;
create trigger trg_rls_violation_findings_updated_at
before update on rls_violation_findings
for each row execute function set_updated_at();

create index if not exists idx_production_validation_runs_area on production_validation_runs(validation_area, status);
create index if not exists idx_release_candidate_controls_status on release_candidate_controls(status, phase);
create index if not exists idx_supabase_install_items_status on supabase_install_verification_items(status, item_type);
create index if not exists idx_rls_persona_cases_persona on rls_persona_test_cases(persona_code, expected_behavior);
create index if not exists idx_rls_persona_runs_result on rls_persona_test_runs(result, test_cycle);
create index if not exists idx_rls_findings_status on rls_violation_findings(status, severity);

create or replace view v_v42_release_candidate_scorecard as
select
  count(*) as total_controls,
  count(*) filter (where status = 'pass') as passed_controls,
  count(*) filter (where status = 'warning') as warning_controls,
  count(*) filter (where status = 'blocked') as blocked_controls,
  count(*) filter (where required_for_pilot and status = 'pass') as pilot_passed_controls,
  count(*) filter (where required_for_pilot) as pilot_required_controls,
  count(*) filter (where required_for_production and status = 'pass') as production_passed_controls,
  count(*) filter (where required_for_production) as production_required_controls,
  case when count(*) = 0 then 0 else round((count(*) filter (where status = 'pass')::numeric / count(*)::numeric) * 100, 2) end as overall_score,
  case when count(*) filter (where required_for_pilot) = 0 then 0 else round((count(*) filter (where required_for_pilot and status = 'pass')::numeric / count(*) filter (where required_for_pilot)::numeric) * 100, 2) end as pilot_score,
  case when count(*) filter (where required_for_production) = 0 then 0 else round((count(*) filter (where required_for_production and status = 'pass')::numeric / count(*) filter (where required_for_production)::numeric) * 100, 2) end as production_score
from release_candidate_controls;

create or replace view v_v42_supabase_install_status as
select
  item_type,
  count(*) as total_items,
  count(*) filter (where status = 'verified') as verified_items,
  count(*) filter (where status = 'missing') as missing_items,
  count(*) filter (where status = 'warning') as warning_items,
  case when count(*) = 0 then 0 else round((count(*) filter (where status = 'verified')::numeric / count(*)::numeric) * 100, 2) end as verification_score
from supabase_install_verification_items
group by item_type
order by item_type;

create or replace view v_v42_rls_persona_matrix as
select
  persona_code,
  persona_name_en,
  persona_name_ar,
  role_name,
  scope_name,
  expected_behavior,
  count(*) as test_count,
  count(*) filter (where is_hard_stop) as hard_stop_count,
  string_agg(distinct target_module, ', ' order by target_module) as modules
from rls_persona_test_cases
group by persona_code, persona_name_en, persona_name_ar, role_name, scope_name, expected_behavior
order by persona_code, expected_behavior;

create or replace view v_v42_rls_test_case_queue as
select
  tc.id,
  tc.persona_code,
  tc.persona_name_en,
  tc.role_name,
  tc.scope_name,
  tc.test_code,
  tc.test_name_en,
  tc.expected_behavior,
  tc.target_module,
  tc.priority,
  tc.is_hard_stop,
  coalesce(last_run.result, 'pending') as last_result,
  last_run.tested_at as last_tested_at
from rls_persona_test_cases tc
left join lateral (
  select r.result, r.tested_at
  from rls_persona_test_runs r
  where r.test_case_id = tc.id
  order by r.created_at desc
  limit 1
) last_run on true
order by tc.is_hard_stop desc, tc.priority asc, tc.persona_code, tc.test_code;

create or replace view v_v42_rls_readiness_summary as
select
  count(*) as total_test_cases,
  count(*) filter (where last_result = 'pass') as passed_cases,
  count(*) filter (where last_result = 'failed') as failed_cases,
  count(*) filter (where last_result = 'pending') as pending_cases,
  count(*) filter (where is_hard_stop and last_result = 'failed') as failed_hard_stops,
  count(*) filter (where is_hard_stop and last_result = 'pending') as pending_hard_stops,
  case when count(*) = 0 then 0 else round((count(*) filter (where last_result = 'pass')::numeric / count(*)::numeric) * 100, 2) end as rls_test_score
from v_v42_rls_test_case_queue;

create or replace function seed_v42_release_validation_defaults()
returns void as $$
begin
  insert into release_candidate_controls (control_code, control_name_en, control_name_ar, phase, required_for_pilot, required_for_production, owner_role, evidence_note)
  values
    ('RC_LOCAL_BUILD', 'Local typecheck and production build pass', 'نجاح فحص TypeScript وبناء الإنتاج محلياً', 'v4.0', true, true, 'IT/System Admin', 'Attach build log.'),
    ('RC_PATCH_CONSOLIDATION', 'All patches consolidated into one clean repo', 'دمج جميع التصحيحات في مستودع نظيف واحد', 'v4.0', true, true, 'IT/System Admin', 'Attach patch inventory.'),
    ('RC_FRESH_SUPABASE', 'Fresh Supabase install completes without SQL errors', 'تنصيب Supabase جديد يكتمل دون أخطاء SQL', 'v4.1', true, true, 'IT/System Admin', 'Attach migration run log.'),
    ('RC_STORAGE_BUCKET', 'Evidence storage bucket exists and is restricted', 'وجود حاوية الأدلة مع تقييد الصلاحيات', 'v4.1', true, true, 'IT/System Admin', 'Attach storage policy evidence.'),
    ('RC_RLS_PERSONAS', 'RLS persona tests completed', 'اكتمال اختبارات الصلاحيات حسب الشخصيات', 'v4.2', true, true, 'Governance/IT', 'Attach RLS persona lab results.'),
    ('RC_OVR_CONFIDENTIALITY', 'OVR confidentiality verified', 'التحقق من سرية OVR', 'v4.2', true, true, 'Quality/IT', 'Employee cannot view unrelated OVR.'),
    ('RC_NO_SELF_APPROVAL', 'Self-approval is blocked', 'منع الموافقة الذاتية', 'v4.2', true, true, 'Governance/IT', 'Attach approval test result.')
  on conflict (control_code) do nothing;

  insert into supabase_install_verification_items (item_code, item_name_en, item_name_ar, item_type, expected_name)
  values
    ('T_ORGANIZATIONS', 'Organizations table', 'جدول المنشآت', 'table', 'organizations'),
    ('T_PROFILES', 'Profiles table', 'جدول المستخدمين', 'table', 'profiles'),
    ('T_PROJECTS', 'Projects table', 'جدول المشاريع', 'table', 'projects'),
    ('T_RISKS', 'Risks table', 'جدول المخاطر', 'table', 'risks'),
    ('T_OVR', 'OVR reports table', 'جدول تقارير OVR', 'table', 'ovr_reports'),
    ('V_SEARCH', 'Global search view', 'عرض البحث الشامل', 'view', 'v_global_search_index'),
    ('V_RLS_MATRIX', 'RLS persona matrix view', 'عرض مصفوفة صلاحيات الشخصيات', 'view', 'v_v42_rls_persona_matrix'),
    ('F_SEED_V42', 'v4.2 seed function', 'دالة تهيئة v4.2', 'function', 'seed_v42_release_validation_defaults'),
    ('S_EVIDENCE_BUCKET', 'Evidence storage bucket', 'حاوية ملفات الأدلة', 'storage', 'grc-evidence')
  on conflict (item_code) do nothing;

  insert into rls_persona_test_cases (persona_code, persona_name_en, persona_name_ar, role_name, scope_name, test_code, test_name_en, test_name_ar, expected_behavior, target_module, test_steps, pass_condition, priority, is_hard_stop)
  values
    ('CEO', 'CEO / Executive', 'الرئيس التنفيذي / الإدارة التنفيذية', 'executive', 'global', 'CEO_VIEW_GLOBAL', 'Can view executive command data', 'يمكنه عرض بيانات مركز القيادة', 'allow', 'Executive Command', 'Login as CEO persona and open Executive Command Center.', 'Global executive data is visible.', 1, false),
    ('EMPLOYEE', 'Employee', 'موظف', 'employee', 'assigned_only', 'EMPLOYEE_DENY_OTHER_OVR', 'Cannot view unrelated OVR', 'لا يمكنه عرض بلاغ OVR غير متعلق به', 'deny', 'OVR', 'Login as employee and try to access another department OVR.', 'Access is denied or no row is returned.', 1, true),
    ('DEPT_MANAGER', 'Department Manager', 'مدير قسم', 'department_manager', 'department', 'DEPT_DENY_OTHER_DEPT', 'Cannot view other department tasks', 'لا يمكنه عرض مهام قسم آخر', 'deny', 'Tasks', 'Login as department manager and query unrelated department tasks.', 'No unrelated rows are returned.', 1, true),
    ('AUDITOR', 'Auditor', 'مراجع داخلي', 'auditor', 'global', 'AUDITOR_DENY_SELF_CLOSE', 'Cannot self-approve or bypass closure', 'لا يمكنه الموافقة الذاتية أو تجاوز الإغلاق', 'deny', 'Approvals', 'Attempt self-approval as auditor on own submitted item.', 'Self-approval is blocked.', 1, true),
    ('QUALITY_MANAGER', 'Quality Manager', 'مدير الجودة', 'governance_admin', 'department', 'QUALITY_CLOSE_OVR', 'Can close OVR with evidence', 'يمكنه إغلاق OVR مع وجود دليل', 'allow', 'OVR', 'Login as Quality Manager and close OVR after accepted evidence.', 'OVR closure succeeds with audit trail.', 1, false),
    ('PROJECT_OWNER', 'Project Owner', 'مالك المشروع', 'project_owner', 'assigned_only', 'PROJECT_OWNER_DENY_APPROVE_OWN', 'Cannot approve own project', 'لا يمكنه الموافقة على مشروعه', 'deny', 'Projects', 'Login as project owner and attempt to approve own project.', 'Approval is blocked.', 1, true),
    ('VIEWER', 'Scoped Viewer', 'مطلع محدود', 'viewer', 'department', 'VIEWER_DENY_WRITE', 'Cannot create or update records', 'لا يمكنه إنشاء أو تعديل السجلات', 'deny', 'All', 'Login as viewer and attempt to create project/task/OVR.', 'Write action is denied.', 2, false)
  on conflict (persona_code, test_code) do nothing;
end;
$$ language plpgsql;

-- Enable RLS on validation tables; allow authenticated read/write initially.
-- Tighten these policies after final role mapping in your production Supabase project.
alter table production_validation_runs enable row level security;
alter table release_candidate_controls enable row level security;
alter table supabase_install_verification_items enable row level security;
alter table rls_persona_test_cases enable row level security;
alter table rls_persona_test_runs enable row level security;
alter table rls_violation_findings enable row level security;

do $$ begin
  create policy "Authenticated can read production validation" on production_validation_runs for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated can manage production validation" on production_validation_runs for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated can read release controls" on release_candidate_controls for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated can manage release controls" on release_candidate_controls for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated can read install verification" on supabase_install_verification_items for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated can manage install verification" on supabase_install_verification_items for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated can read rls persona cases" on rls_persona_test_cases for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated can manage rls persona cases" on rls_persona_test_cases for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated can read rls persona runs" on rls_persona_test_runs for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated can manage rls persona runs" on rls_persona_test_runs for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated can read rls violation findings" on rls_violation_findings for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated can manage rls violation findings" on rls_violation_findings for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
