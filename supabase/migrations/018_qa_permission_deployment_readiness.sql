-- =========================================================
-- GRC Control Center - Migration 018
-- QA, permission verification and deployment readiness
-- =========================================================

-- Status enums are kept generic and reusable for rollout testing.
do $$ begin
  create type qa_run_status as enum ('planned', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type qa_result_status as enum ('not_tested', 'passed', 'failed', 'blocked', 'not_applicable');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type deployment_gate_status as enum ('not_tested', 'passed', 'warning', 'blocked');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------
-- QA test plan and run tables
-- ---------------------------------------------------------
create table if not exists qa_test_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  category text not null,
  test_key text not null,
  title_en text not null,
  title_ar text,
  description_en text not null,
  description_ar text,
  expected_result_en text not null,
  expected_result_ar text,
  priority priority_level not null default 'medium',
  test_type text not null default 'manual',
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, test_key)
);

create table if not exists qa_test_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  scope text not null default 'production_readiness',
  status qa_run_status not null default 'planned',
  started_by uuid references profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists qa_test_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  run_id uuid not null references qa_test_runs(id) on delete cascade,
  test_case_id uuid references qa_test_cases(id) on delete set null,
  result_status qa_result_status not null default 'not_tested',
  result_note text,
  evidence_file_id uuid references evidence_files(id) on delete set null,
  tested_by uuid references profiles(id) on delete set null,
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, test_case_id)
);

create table if not exists deployment_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  area text not null,
  status deployment_gate_status not null default 'not_tested',
  signed_by uuid references profiles(id) on delete set null,
  signed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, area)
);

-- ---------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------
drop trigger if exists trg_qa_test_cases_updated_at on qa_test_cases;
create trigger trg_qa_test_cases_updated_at
before update on qa_test_cases
for each row execute function set_updated_at();

drop trigger if exists trg_qa_test_runs_updated_at on qa_test_runs;
create trigger trg_qa_test_runs_updated_at
before update on qa_test_runs
for each row execute function set_updated_at();

drop trigger if exists trg_qa_test_results_updated_at on qa_test_results;
create trigger trg_qa_test_results_updated_at
before update on qa_test_results
for each row execute function set_updated_at();

drop trigger if exists trg_deployment_signoffs_updated_at on deployment_signoffs;
create trigger trg_deployment_signoffs_updated_at
before update on deployment_signoffs
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Default QA test plan seeding
-- ---------------------------------------------------------
create or replace function seed_default_qa_test_cases(target_org_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  inserted_count integer := 0;
begin
  select coalesce(target_org_id, (select id from organizations order by created_at limit 1)) into org_id;
  if org_id is null then
    return 0;
  end if;

  insert into qa_test_cases (
    organization_id, category, test_key, title_en, title_ar,
    description_en, description_ar, expected_result_en, expected_result_ar,
    priority, test_type
  ) values
  (org_id, 'permissions', 'employee_assigned_only', 'Employee sees assigned work only', 'الموظف يرى الأعمال المسندة له فقط', 'Verify employee users cannot see unrelated department projects, audit findings, approvals or access-control pages.', 'تحقق أن الموظف لا يرى مشاريع أو ملاحظات مراجعة أو موافقات أو صفحات صلاحيات لا تخصه.', 'Only assigned tasks, evidence requests and own OVR submissions are visible.', 'تظهر فقط المهام وطلبات الأدلة المسندة وبلاغات OVR الخاصة به.', 'critical', 'permission_check'),
  (org_id, 'permissions', 'department_manager_scope_isolation', 'Department manager scope isolation', 'عزل نطاق مدير الإدارة', 'Login as managers from two departments and verify cross-department data isolation.', 'ادخل كمديرين من إدارتين وتحقق من عزل البيانات بين الإدارات.', 'Each manager sees only scoped department data unless granted broader role.', 'يرى كل مدير بيانات نطاق إدارته فقط ما لم تمنح له صلاحية أوسع.', 'critical', 'permission_check'),
  (org_id, 'permissions', 'global_role_review', 'Sensitive global roles reviewed', 'مراجعة الأدوار العامة الحساسة', 'Review super admin, executive, governance admin and auditor users with global scope.', 'راجع مستخدمي المدير العام والتنفيذي ومسؤول الحوكمة والمراجع بصلاحية عامة.', 'Every sensitive global role has a justified owner and approval.', 'كل دور حساس عام له مالك ومبرر واعتماد.', 'high', 'manual'),
  (org_id, 'workflow', 'close_without_evidence_blocked', 'Closure without evidence is blocked', 'منع الإغلاق بدون دليل', 'Attempt to close an evidence-required project, milestone, task, audit finding or OVR without accepted evidence.', 'حاول إغلاق بند يتطلب الدليل دون وجود دليل مقبول.', 'The system blocks closure and displays a clear reason.', 'النظام يمنع الإغلاق ويعرض سبباً واضحاً.', 'critical', 'workflow_check'),
  (org_id, 'workflow', 'delay_without_reason_blocked', 'Delay without reason is blocked', 'منع التأخير بدون سبب', 'Attempt to set delayed status or leave an overdue item without a delay reason.', 'حاول تعيين الحالة متأخر أو ترك بند متأخر بدون سبب.', 'The system requires a delay reason.', 'النظام يطلب سبب التأخير.', 'critical', 'workflow_check'),
  (org_id, 'workflow', 'self_approval_blocked', 'Self-approval is blocked', 'منع الاعتماد الذاتي', 'Request approval and try approving with the same user.', 'اطلب موافقة وحاول اعتمادها بنفس المستخدم.', 'The system blocks self-approval.', 'النظام يمنع الاعتماد الذاتي.', 'critical', 'workflow_check'),
  (org_id, 'ovr', 'quality_only_ovr_closure', 'Quality-only OVR closure', 'إغلاق OVR بواسطة الجودة فقط', 'Attempt to close an OVR as reporter or department manager.', 'حاول إغلاق OVR كمبلغ أو مدير إدارة.', 'Only Quality closure roles can close after accepted evidence and comments.', 'لا تغلق البلاغات إلا أدوار الجودة بعد الدليل المقبول والتعليقات.', 'critical', 'workflow_check'),
  (org_id, 'ovr', 'major_ovr_escalation', 'Major OVR escalation appears on dashboard', 'تصعيد OVR الكبير يظهر في اللوحة', 'Create or identify a major severity OVR and verify executive visibility.', 'أنشئ أو حدد بلاغ OVR كبير وتحقق من ظهوره تنفيذياً.', 'Major OVRs appear in executive critical attention views until closed.', 'تظهر بلاغات OVR الكبيرة في لوحات الانتباه التنفيذي حتى الإغلاق.', 'high', 'manual'),
  (org_id, 'backup', 'backup_package_created', 'Backup/export package created', 'إنشاء حزمة تصدير/نسخ', 'Create a browser export package before large imports or go-live.', 'أنشئ حزمة تصدير قبل الاستيراد الكبير أو التشغيل.', 'Backup metadata exists and recent backup health check passes.', 'توجد بيانات النسخ ويجتاز فحص النسخة الحديثة.', 'high', 'manual'),
  (org_id, 'backup', 'restore_dry_run_logged', 'Restore dry-run logged', 'تسجيل تجربة الاستعادة الجافة', 'Record a dry-run restore result before production rollout.', 'سجل نتيجة تجربة استعادة جافة قبل التشغيل الفعلي.', 'Restore dry-run job is documented with result and notes.', 'تجربة الاستعادة موثقة بالنتيجة والملاحظات.', 'high', 'manual'),
  (org_id, 'reports', 'executive_report_export', 'Executive report export works', 'تصدير التقرير التنفيذي يعمل', 'Export executive GRC report pack and verify CSV/JSON opens externally.', 'صدّر حزمة التقرير التنفيذي وتحقق من فتح CSV/JSON خارجياً.', 'Export file is complete and readable outside the system.', 'ملف التصدير كامل وقابل للقراءة خارج النظام.', 'medium', 'manual'),
  (org_id, 'performance', 'manager_dashboard_load', 'Manager dashboard loads acceptably', 'تحميل لوحة المدير بشكل مقبول', 'Open dashboard, department control, OVR and operations pages after representative data import.', 'افتح اللوحة وتحكم الإدارات وOVR والعمليات بعد استيراد بيانات ممثلة.', 'Pages load without errors and remain usable with expected data volume.', 'تعمل الصفحات بدون أخطاء وتبقى قابلة للاستخدام مع حجم البيانات المتوقع.', 'medium', 'manual')
  on conflict (organization_id, test_key) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    description_en = excluded.description_en,
    description_ar = excluded.description_ar,
    expected_result_en = excluded.expected_result_en,
    expected_result_ar = excluded.expected_result_ar,
    priority = excluded.priority,
    test_type = excluded.test_type,
    is_active = true,
    updated_at = now();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- ---------------------------------------------------------
-- Deployment gates view
-- Combines health checks, access warnings and workflow blockers.
-- ---------------------------------------------------------
create or replace view v_deployment_readiness_gates as
select
  h.organization_id,
  h.check_key as gate_key,
  h.area as category,
  h.severity,
  case
    when h.record_count = 0 then 'passed'
    when h.severity = 'critical' then 'blocked'
    else 'warning'
  end as status,
  h.title_en,
  h.title_ar,
  h.details_en,
  h.details_ar,
  h.record_count,
  h.action_path
from v_backup_health_check h

union all
select
  w.organization_id,
  'access_' || w.warning_type as gate_key,
  'permissions' as category,
  w.severity::text as severity,
  case when w.severity::text = 'critical' then 'blocked' else 'warning' end as status,
  'Access warning: ' || w.warning_type as title_en,
  'تحذير صلاحيات: ' || w.warning_type as title_ar,
  w.warning_message as details_en,
  w.warning_message as details_ar,
  count(*)::integer as record_count,
  '/access-control' as action_path
from v_access_control_warnings w
group by w.organization_id, w.warning_type, w.warning_message, w.severity

union all
select
  b.organization_id,
  'workflow_' || b.blocker_key as gate_key,
  'workflow' as category,
  case when b.blocker_key in ('missing_accepted_evidence','missing_delay_reason') then 'critical' else 'high' end as severity,
  case when b.blocker_key in ('missing_accepted_evidence','missing_delay_reason') then 'blocked' else 'warning' end as status,
  b.blocker_en as title_en,
  b.blocker_ar as title_ar,
  'Workflow blocker requires action before production rollout.' as details_en,
  'مشكلة في سير العمل تحتاج معالجة قبل التشغيل الفعلي.' as details_ar,
  count(*)::integer as record_count,
  '/backup-health-check' as action_path
from v_workflow_blockers b
group by b.organization_id, b.blocker_key, b.blocker_en, b.blocker_ar;

-- ---------------------------------------------------------
-- QA test case library view
-- ---------------------------------------------------------
create or replace view v_qa_test_case_library as
select
  id,
  organization_id,
  category,
  test_key,
  title_en,
  title_ar,
  description_en,
  description_ar,
  expected_result_en,
  expected_result_ar,
  priority::text as priority,
  test_type,
  is_active,
  created_at,
  updated_at
from qa_test_cases;

-- ---------------------------------------------------------
-- Permission persona matrix for manual RLS/UAT testing
-- ---------------------------------------------------------
create or replace view v_permission_test_personas as
select * from (
  values
  ('executive_global','executive','global','All dashboards, critical risks, major OVRs, approvals and executive reports.','كل اللوحات والمخاطر الحرجة وبلاغات OVR الكبرى والموافقات والتقارير التنفيذية.','Direct database administration and Quality-only OVR closure unless Quality role is also granted.','إدارة قاعدة البيانات المباشرة وإغلاق OVR الخاص بالجودة ما لم تمنح له صلاحية الجودة.','Login, open executive pages, confirm visibility, then try restricted closure actions.','سجل الدخول وافتح الصفحات التنفيذية ثم جرّب إجراءات الإغلاق المقيدة.','high'),
  ('governance_admin_global','governance_admin','global','GRC workflows, risk, compliance, audit follow-up, projects, escalations and reports.','مسارات الحوكمة والمخاطر والالتزام والمراجعة والمشاريع والتصعيدات والتقارير.','System-level user management unless also super admin.','إدارة المستخدمين على مستوى النظام ما لم يكن مديراً عاماً أيضاً.','Verify GRC management access and restricted admin actions.','تحقق من إدارة GRC ومنع الإجراءات الإدارية المقيدة.','high'),
  ('department_manager_department','department_manager','department','Own department projects, tasks, OVRs, evidence requests and follow-up queues.','مشاريع ومهام وبلاغات OVR وطلبات الأدلة وقوائم المتابعة الخاصة بالإدارة.','Other departments, access control, audit closure and Quality-only OVR closure.','الإدارات الأخرى، الصلاحيات، إغلاق المراجعة، وإغلاق OVR الخاص بالجودة.','Use two department managers and verify cross-department data isolation.','استخدم مديرين من إدارتين وتحقق من عزل البيانات.', 'critical'),
  ('quality_manager_global','compliance_officer','global','OVR queues, Quality review, closure controls, OVR risk indicators and evidence review.','قوائم OVR ومراجعة الجودة وضوابط الإغلاق ومؤشرات مخاطر OVR ومراجعة الأدلة.','Unrelated access-control administration and non-quality approval chains.','إدارة الصلاحيات غير المرتبطة ومسارات الموافقات غير الخاصة بالجودة.','Submit, return, require action, review evidence and close test OVRs.','قدّم وأعد واطلب إجراء وراجع الدليل وأغلق بلاغات اختبارية.', 'critical'),
  ('auditor_global','auditor','global','Audit findings, evidence review, closure approval and audit reports.','ملاحظات المراجعة ومراجعة الأدلة واعتماد الإغلاق وتقارير المراجعة.','Department self-closure and unrelated HR/user admin actions.','إغلاق الإدارات الذاتي وإجراءات الموارد البشرية/المستخدمين غير المرتبطة.','Create finding, reject weak evidence, approve valid closure.','أنشئ ملاحظة وارفض الدليل الضعيف واعتمد الإغلاق الصحيح.', 'high'),
  ('employee_assigned_only','employee','assigned_only','My Work, assigned evidence requests, comments and own OVR submissions.','أعمالي وطلبات الأدلة المسندة والتعليقات وبلاغات OVR الخاصة به.','Executive data, unrelated projects, other employees, access control and approvals.','البيانات التنفيذية والمشاريع غير المرتبطة والموظفين الآخرين والصلاحيات والموافقات.','Login, search for unrelated data and confirm no results are visible.','سجل الدخول وابحث عن بيانات غير مرتبطة وتأكد من عدم ظهورها.', 'critical')
) as p(persona_key, role_name, scope_name, expected_visibility_en, expected_visibility_ar, must_block_en, must_block_ar, test_steps_en, test_steps_ar, risk_level);

-- ---------------------------------------------------------
-- QA run summary view
-- ---------------------------------------------------------
create or replace view v_qa_test_runs_summary as
select
  r.id,
  r.organization_id,
  r.title,
  r.scope,
  r.status::text as status,
  r.started_at,
  r.completed_at,
  count(res.id)::integer as total_cases,
  count(res.id) filter (where res.result_status = 'passed')::integer as passed_cases,
  count(res.id) filter (where res.result_status = 'failed')::integer as failed_cases,
  count(res.id) filter (where res.result_status = 'blocked')::integer as blocked_cases
from qa_test_runs r
left join qa_test_results res on res.run_id = r.id
group by r.id;

-- ---------------------------------------------------------
-- QA readiness scorecard view
-- ---------------------------------------------------------
create or replace view v_qa_readiness_summary as
with orgs as (
  select id from organizations
), gate_counts as (
  select
    organization_id,
    count(*)::integer as total_gates,
    count(*) filter (where status = 'passed')::integer as passed_gates,
    count(*) filter (where status = 'warning')::integer as warning_gates,
    count(*) filter (where status = 'blocked')::integer as blocked_gates,
    count(*) filter (where severity = 'critical' and status <> 'passed')::integer as critical_blockers,
    count(*) filter (where severity = 'high' and status <> 'passed')::integer as high_blockers
  from v_deployment_readiness_gates
  group by organization_id
), access_counts as (
  select organization_id, count(*)::integer as permission_warnings
  from v_access_control_warnings
  group by organization_id
), workflow_counts as (
  select organization_id, count(*)::integer as workflow_blockers
  from v_workflow_blockers
  group by organization_id
), run_counts as (
  select
    organization_id,
    count(*) filter (where status = 'in_progress')::integer as active_test_runs,
    count(*) filter (where status = 'completed')::integer as completed_test_runs,
    max(started_at) as last_test_run_at
  from qa_test_runs
  group by organization_id
), result_counts as (
  select organization_id, count(*) filter (where result_status in ('failed','blocked'))::integer as failed_test_results
  from qa_test_results
  group by organization_id
)
select
  o.id as organization_id,
  coalesce(g.total_gates,0) as total_gates,
  coalesce(g.passed_gates,0) as passed_gates,
  coalesce(g.warning_gates,0) as warning_gates,
  coalesce(g.blocked_gates,0) as blocked_gates,
  coalesce(g.critical_blockers,0) as critical_blockers,
  coalesce(g.high_blockers,0) as high_blockers,
  coalesce(a.permission_warnings,0) as permission_warnings,
  coalesce(w.workflow_blockers,0) as workflow_blockers,
  coalesce(r.active_test_runs,0) as active_test_runs,
  coalesce(r.completed_test_runs,0) as completed_test_runs,
  coalesce(rc.failed_test_results,0) as failed_test_results,
  greatest(0, least(100,
    100
    - coalesce(g.blocked_gates,0) * 12
    - coalesce(g.warning_gates,0) * 5
    - coalesce(rc.failed_test_results,0) * 4
  ))::integer as readiness_score,
  r.last_test_run_at
from orgs o
left join gate_counts g on g.organization_id = o.id
left join access_counts a on a.organization_id = o.id
left join workflow_counts w on w.organization_id = o.id
left join run_counts r on r.organization_id = o.id
left join result_counts rc on rc.organization_id = o.id;

-- ---------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------
create index if not exists idx_qa_test_cases_org on qa_test_cases(organization_id);
create index if not exists idx_qa_test_cases_category on qa_test_cases(category);
create index if not exists idx_qa_test_runs_org on qa_test_runs(organization_id);
create index if not exists idx_qa_test_runs_status on qa_test_runs(status);
create index if not exists idx_qa_test_results_run on qa_test_results(run_id);
create index if not exists idx_qa_test_results_status on qa_test_results(result_status);
create index if not exists idx_deployment_signoffs_org on deployment_signoffs(organization_id);

-- ---------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------
alter table qa_test_cases enable row level security;
alter table qa_test_runs enable row level security;
alter table qa_test_results enable row level security;
alter table deployment_signoffs enable row level security;

drop policy if exists qa_test_cases_read on qa_test_cases;
create policy qa_test_cases_read on qa_test_cases
for select using (public.can_access_org(organization_id));

drop policy if exists qa_test_cases_manage on qa_test_cases;
create policy qa_test_cases_manage on qa_test_cases
for all using (
  public.has_global_role(array['super_admin','governance_admin','auditor']::public.app_role[])
) with check (
  public.has_global_role(array['super_admin','governance_admin','auditor']::public.app_role[])
);

drop policy if exists qa_test_runs_read on qa_test_runs;
create policy qa_test_runs_read on qa_test_runs
for select using (public.can_access_org(organization_id));

drop policy if exists qa_test_runs_manage on qa_test_runs;
create policy qa_test_runs_manage on qa_test_runs
for all using (
  public.has_global_role(array['super_admin','governance_admin','auditor']::public.app_role[])
) with check (
  public.has_global_role(array['super_admin','governance_admin','auditor']::public.app_role[])
);

drop policy if exists qa_test_results_read on qa_test_results;
create policy qa_test_results_read on qa_test_results
for select using (public.can_access_org(organization_id));

drop policy if exists qa_test_results_manage on qa_test_results;
create policy qa_test_results_manage on qa_test_results
for all using (
  public.has_global_role(array['super_admin','governance_admin','auditor']::public.app_role[])
) with check (
  public.has_global_role(array['super_admin','governance_admin','auditor']::public.app_role[])
);

drop policy if exists deployment_signoffs_read on deployment_signoffs;
create policy deployment_signoffs_read on deployment_signoffs
for select using (public.can_access_org(organization_id));

drop policy if exists deployment_signoffs_manage on deployment_signoffs;
create policy deployment_signoffs_manage on deployment_signoffs
for all using (
  public.has_global_role(array['super_admin','executive','governance_admin']::public.app_role[])
) with check (
  public.has_global_role(array['super_admin','executive','governance_admin']::public.app_role[])
);
