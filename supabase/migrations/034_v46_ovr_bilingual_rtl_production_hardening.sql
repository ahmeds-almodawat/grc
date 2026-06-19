-- =========================================================
-- GRC Control Center - Migration 034
-- v4.6 OVR Production Workflow + OVR Risk Calibration
-- + Bilingual Completion Registry + RTL Visual QA Registry
-- =========================================================

-- ---------------------------------------------------------
-- Safe enum extensions for OVR production workflow
-- ---------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'ovr_status' and e.enumlabel = 'major_escalation'
  ) then
    alter type public.ovr_status add value 'major_escalation';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'ovr_status' and e.enumlabel = 'rca_required'
  ) then
    alter type public.ovr_status add value 'rca_required';
  end if;
end $$;

-- ---------------------------------------------------------
-- OVR report production fields
-- ---------------------------------------------------------
alter table public.ovr_reports
add column if not exists quality_manager_id uuid references public.profiles(id) on delete set null;

alter table public.ovr_reports
add column if not exists final_quality_classification text;

alter table public.ovr_reports
add column if not exists closure_summary text;

alter table public.ovr_reports
add column if not exists closure_ready_at timestamptz;

alter table public.ovr_reports
add column if not exists returned_for_clarification_reason text;

alter table public.ovr_reports
add column if not exists rca_required boolean not null default false;

alter table public.ovr_reports
add column if not exists rca_summary text;

alter table public.ovr_reports
add column if not exists clinical_escalation_required boolean not null default false;

alter table public.ovr_reports
add column if not exists executive_visible boolean not null default false;

alter table public.ovr_reports
add column if not exists patient_safety_flag boolean not null default false;

alter table public.ovr_reports
add column if not exists final_severity_level public.ovr_severity_level;

alter table public.ovr_reports
add column if not exists occurrence_confirmed_by_quality boolean not null default false;

create index if not exists idx_ovr_reports_quality_manager on public.ovr_reports(quality_manager_id);
create index if not exists idx_ovr_reports_production_flags on public.ovr_reports(rca_required, clinical_escalation_required, executive_visible, patient_safety_flag);

-- ---------------------------------------------------------
-- OVR production checklist templates
-- ---------------------------------------------------------
create table if not exists public.ovr_production_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  checklist_code text not null,
  checklist_area text not null,
  title_en text not null,
  title_ar text not null,
  applies_to_status text,
  applies_to_severity public.ovr_severity_level,
  is_required_for_closure boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, checklist_code)
);

drop trigger if exists trg_ovr_production_checklist_templates_updated_at on public.ovr_production_checklist_templates;
create trigger trg_ovr_production_checklist_templates_updated_at
before update on public.ovr_production_checklist_templates
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- Per-OVR checklist completion
-- ---------------------------------------------------------
create table if not exists public.ovr_production_checklist_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ovr_report_id uuid not null references public.ovr_reports(id) on delete cascade,
  template_id uuid references public.ovr_production_checklist_templates(id) on delete set null,
  checklist_code text not null,
  result_status text not null default 'pending' check (result_status in ('pending','complete','not_applicable','failed')),
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ovr_report_id, checklist_code)
);

drop trigger if exists trg_ovr_production_checklist_results_updated_at on public.ovr_production_checklist_results;
create trigger trg_ovr_production_checklist_results_updated_at
before update on public.ovr_production_checklist_results
for each row execute function public.set_updated_at();

create index if not exists idx_ovr_checklist_results_ovr on public.ovr_production_checklist_results(ovr_report_id);
create index if not exists idx_ovr_checklist_results_status on public.ovr_production_checklist_results(result_status);

-- ---------------------------------------------------------
-- OVR risk calibration rules
-- ---------------------------------------------------------
create table if not exists public.ovr_risk_calibration_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  rule_code text not null,
  rule_name_en text not null,
  rule_name_ar text not null,
  occurrence_category text,
  severity_level public.ovr_severity_level,
  recurrence_window_days integer not null default 30 check (recurrence_window_days > 0),
  recurrence_threshold integer not null default 3 check (recurrence_threshold > 0),
  severity_weight numeric(10,2) not null default 1,
  recurrence_weight numeric(10,2) not null default 1,
  closure_delay_weight numeric(10,2) not null default 1,
  critical_trigger boolean not null default false,
  executive_alert boolean not null default false,
  recommended_action_en text,
  recommended_action_ar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rule_code)
);

drop trigger if exists trg_ovr_risk_calibration_rules_updated_at on public.ovr_risk_calibration_rules;
create trigger trg_ovr_risk_calibration_rules_updated_at
before update on public.ovr_risk_calibration_rules
for each row execute function public.set_updated_at();

create index if not exists idx_ovr_risk_rules_category on public.ovr_risk_calibration_rules(occurrence_category);
create index if not exists idx_ovr_risk_rules_severity on public.ovr_risk_calibration_rules(severity_level);
create index if not exists idx_ovr_risk_rules_active on public.ovr_risk_calibration_rules(is_active);

-- ---------------------------------------------------------
-- Bilingual completion registry
-- ---------------------------------------------------------
create table if not exists public.i18n_translation_coverage_items (
  id uuid primary key default gen_random_uuid(),
  area_code text not null,
  module_name text not null,
  item_key text not null,
  english_text text not null,
  arabic_text text,
  status text not null default 'pending' check (status in ('complete','pending','needs_review','not_applicable')),
  owner_role text,
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (area_code, item_key)
);

drop trigger if exists trg_i18n_translation_coverage_items_updated_at on public.i18n_translation_coverage_items;
create trigger trg_i18n_translation_coverage_items_updated_at
before update on public.i18n_translation_coverage_items
for each row execute function public.set_updated_at();

create index if not exists idx_i18n_translation_coverage_status on public.i18n_translation_coverage_items(status);
create index if not exists idx_i18n_translation_coverage_priority on public.i18n_translation_coverage_items(priority);

-- ---------------------------------------------------------
-- RTL visual QA registry
-- ---------------------------------------------------------
create table if not exists public.rtl_visual_qa_items (
  id uuid primary key default gen_random_uuid(),
  screen_code text not null,
  screen_name_en text not null,
  screen_name_ar text not null,
  qa_area text not null,
  expected_result_en text not null,
  expected_result_ar text not null,
  status text not null default 'not_tested' check (status in ('passed','failed','not_tested','needs_review')),
  device_size text not null default 'desktop' check (device_size in ('desktop','tablet','mobile','print')),
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  evidence_note text,
  tested_by uuid references public.profiles(id) on delete set null,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (screen_code, qa_area, device_size)
);

drop trigger if exists trg_rtl_visual_qa_items_updated_at on public.rtl_visual_qa_items;
create trigger trg_rtl_visual_qa_items_updated_at
before update on public.rtl_visual_qa_items
for each row execute function public.set_updated_at();

create index if not exists idx_rtl_visual_qa_status on public.rtl_visual_qa_items(status);
create index if not exists idx_rtl_visual_qa_severity on public.rtl_visual_qa_items(severity);

-- ---------------------------------------------------------
-- Views: OVR production queue and risk calibration score
-- ---------------------------------------------------------
create or replace view public.v_v46_ovr_production_queue as
select
  r.organization_id,
  r.id as ovr_report_id,
  r.ovr_number,
  r.occurrence_date,
  r.occurrence_location,
  r.occurrence_category,
  r.status,
  r.severity_level,
  coalesce(r.final_severity_level, r.severity_level) as confirmed_severity_level,
  r.department_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  r.supervisor_id,
  r.quality_reviewer_id,
  r.quality_manager_id,
  r.corrective_action_required,
  r.evidence_required,
  r.linked_project_id,
  r.rca_required,
  r.clinical_escalation_required,
  r.executive_visible,
  r.patient_safety_flag,
  r.occurrence_confirmed_by_quality,
  (select count(*) from public.evidence_files e where e.ovr_report_id = r.id and e.status = 'accepted')::int as accepted_evidence_count,
  (select count(*) from public.ovr_production_checklist_results c where c.ovr_report_id = r.id and c.result_status = 'failed')::int as failed_checklist_count,
  (select count(*) from public.ovr_production_checklist_results c where c.ovr_report_id = r.id and c.result_status = 'pending')::int as pending_checklist_count,
  case
    when r.status = 'closed' then 'closed'
    when r.severity_level in ('level_4','sentinel') and r.quality_manager_id is null then 'needs_quality_manager'
    when r.evidence_required and not exists (select 1 from public.evidence_files e where e.ovr_report_id = r.id and e.status = 'accepted') then 'needs_accepted_evidence'
    when r.status = 'returned_for_clarification' and coalesce(nullif(trim(r.returned_for_clarification_reason), ''), '') = '' then 'needs_return_reason'
    when r.status in ('submitted','under_supervisor_review') then 'needs_supervisor_hod_review'
    when r.status in ('under_quality_review','quality_closure_review') then 'needs_quality_review'
    else 'in_progress'
  end as production_blocker
from public.ovr_reports r
left join public.departments d on d.id = r.department_id;

create or replace view public.v_v46_ovr_risk_calibration as
select
  r.organization_id,
  r.id as ovr_report_id,
  r.ovr_number,
  r.department_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  r.occurrence_category,
  r.severity_level,
  coalesce(rule.severity_weight,
    case r.severity_level
      when 'level_1' then 1
      when 'level_2' then 2
      when 'level_3' then 3
      when 'level_4' then 5
      when 'sentinel' then 8
      else 1
    end
  ) as severity_weight,
  (
    select count(*)
    from public.ovr_reports r2
    where r2.organization_id = r.organization_id
      and coalesce(r2.department_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(r.department_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and r2.occurrence_category = r.occurrence_category
      and r2.occurrence_date >= coalesce(r.occurrence_date, current_date) - interval '30 days'
      and r2.occurrence_date <= coalesce(r.occurrence_date, current_date)
  )::int as recurrence_30d,
  greatest(0, coalesce((current_date - r.occurrence_date), 0))::int as age_days,
  (
    coalesce(rule.severity_weight,
      case r.severity_level
        when 'level_1' then 1
        when 'level_2' then 2
        when 'level_3' then 3
        when 'level_4' then 5
        when 'sentinel' then 8
        else 1
      end
    )
    + least(10, (
      select count(*)
      from public.ovr_reports r2
      where r2.organization_id = r.organization_id
        and coalesce(r2.department_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(r.department_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and r2.occurrence_category = r.occurrence_category
        and r2.occurrence_date >= coalesce(r.occurrence_date, current_date) - interval '30 days'
        and r2.occurrence_date <= coalesce(r.occurrence_date, current_date)
    ) * coalesce(rule.recurrence_weight, 1))
    + case when r.status not in ('closed','cancelled') and r.occurrence_date < current_date - interval '7 days' then coalesce(rule.closure_delay_weight, 1) else 0 end
  )::numeric(10,2) as calibrated_risk_score,
  case
    when r.severity_level = 'sentinel' or r.severity_level = 'level_4' then true
    when rule.critical_trigger then true
    else false
  end as executive_alert_recommended,
  rule.rule_code as matching_rule_code
from public.ovr_reports r
left join public.departments d on d.id = r.department_id
left join lateral (
  select rr.*
  from public.ovr_risk_calibration_rules rr
  where rr.is_active = true
    and (rr.organization_id = r.organization_id or rr.organization_id is null)
    and (rr.occurrence_category is null or rr.occurrence_category = r.occurrence_category)
    and (rr.severity_level is null or rr.severity_level = r.severity_level)
  order by (rr.organization_id is not null) desc, (rr.occurrence_category is not null) desc, (rr.severity_level is not null) desc
  limit 1
) rule on true;

create or replace view public.v_v46_language_rtl_readiness as
select
  'i18n' as area,
  count(*)::int as total_items,
  count(*) filter (where status = 'complete')::int as passed_or_complete,
  count(*) filter (where status in ('pending','needs_review'))::int as open_items,
  case when count(*) = 0 then 0 else round((count(*) filter (where status = 'complete')::numeric / count(*)::numeric) * 100, 2) end as readiness_percent
from public.i18n_translation_coverage_items
union all
select
  'rtl' as area,
  count(*)::int as total_items,
  count(*) filter (where status = 'passed')::int as passed_or_complete,
  count(*) filter (where status in ('failed','not_tested','needs_review'))::int as open_items,
  case when count(*) = 0 then 0 else round((count(*) filter (where status = 'passed')::numeric / count(*)::numeric) * 100, 2) end as readiness_percent
from public.rtl_visual_qa_items;

create or replace view public.v_v46_production_hardening_scorecard as
select
  coalesce((select readiness_percent from public.v_v46_language_rtl_readiness where area = 'i18n'), 0) as i18n_readiness_percent,
  coalesce((select readiness_percent from public.v_v46_language_rtl_readiness where area = 'rtl'), 0) as rtl_readiness_percent,
  (select count(*) from public.v_v46_ovr_production_queue where production_blocker not in ('closed','in_progress'))::int as ovr_blockers,
  (select count(*) from public.v_v46_ovr_risk_calibration where executive_alert_recommended = true)::int as executive_ovr_alerts,
  round((
    coalesce((select readiness_percent from public.v_v46_language_rtl_readiness where area = 'i18n'), 0) * 0.25 +
    coalesce((select readiness_percent from public.v_v46_language_rtl_readiness where area = 'rtl'), 0) * 0.25 +
    case when (select count(*) from public.v_v46_ovr_production_queue where production_blocker not in ('closed','in_progress')) = 0 then 100 else 70 end * 0.30 +
    case when (select count(*) from public.ovr_risk_calibration_rules where is_active = true) >= 5 then 100 else 70 end * 0.20
  )::numeric, 2) as v46_readiness_percent;

-- ---------------------------------------------------------
-- Seed defaults
-- ---------------------------------------------------------
create or replace function public.seed_v46_ovr_bilingual_rtl_defaults()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  select id into org_id from public.organizations order by created_at limit 1;

  insert into public.ovr_production_checklist_templates (organization_id, checklist_code, checklist_area, title_en, title_ar, applies_to_status, applies_to_severity, is_required_for_closure, sort_order)
  values
    (org_id, 'OVR_SUPERVISOR_INVESTIGATION', 'supervisor_hod', 'Supervisor/HOD investigation is completed', 'تم إكمال تحقيق المشرف / رئيس القسم', 'under_supervisor_review', null, true, 10),
    (org_id, 'OVR_QUALITY_CLASSIFICATION', 'quality', 'Quality confirmed occurrence category and severity', 'أكدت الجودة تصنيف الحدث ومستوى الخطورة', 'under_quality_review', null, true, 20),
    (org_id, 'OVR_CORRECTIVE_ACTION', 'corrective_action', 'Corrective action owner and due date are defined', 'تم تحديد مالك الإجراء التصحيحي وتاريخ الاستحقاق', 'action_plan_required', null, true, 30),
    (org_id, 'OVR_ACCEPTED_EVIDENCE', 'evidence', 'Accepted evidence is attached before closure', 'تم إرفاق دليل مقبول قبل الإغلاق', 'quality_closure_review', null, true, 40),
    (org_id, 'OVR_MAJOR_ESCALATION', 'escalation', 'Major/sentinel event escalation is documented', 'تم توثيق تصعيد الحدث الجسيم / الجلل', 'major_escalation', 'level_4', true, 50),
    (org_id, 'OVR_RCA_SUMMARY', 'rca', 'RCA summary is completed when required', 'تم إكمال ملخص تحليل السبب الجذري عند الحاجة', 'rca_required', null, true, 60)
  on conflict (organization_id, checklist_code) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    checklist_area = excluded.checklist_area,
    applies_to_status = excluded.applies_to_status,
    applies_to_severity = excluded.applies_to_severity,
    is_required_for_closure = excluded.is_required_for_closure,
    sort_order = excluded.sort_order;

  insert into public.ovr_risk_calibration_rules (organization_id, rule_code, rule_name_en, rule_name_ar, occurrence_category, severity_level, recurrence_window_days, recurrence_threshold, severity_weight, recurrence_weight, closure_delay_weight, critical_trigger, executive_alert, recommended_action_en, recommended_action_ar)
  values
    (org_id, 'OVR_MAJOR_ANY', 'Major OVR immediate executive alert', 'تنبيه تنفيذي فوري لأي بلاغ جسيم', null, 'level_4', 30, 1, 5, 2, 2, true, true, 'Escalate to Quality Manager, Medical Director, and executive dashboard.', 'التصعيد إلى مدير الجودة والمدير الطبي ولوحة الإدارة التنفيذية.'),
    (org_id, 'OVR_SENTINEL_ANY', 'Sentinel event executive escalation', 'تصعيد الحدث الجلل للإدارة التنفيذية', null, 'sentinel', 30, 1, 8, 3, 3, true, true, 'Start RCA and executive incident review immediately.', 'بدء تحليل السبب الجذري ومراجعة تنفيذية فورية للحدث.'),
    (org_id, 'OVR_MEDICATION_RECUR', 'Repeated medication OVRs', 'تكرار بلاغات أخطاء الأدوية', 'medication', null, 30, 3, 2, 2, 1, true, true, 'Open medication safety improvement action plan.', 'فتح خطة تحسين سلامة الأدوية.'),
    (org_id, 'OVR_FALL_RECUR', 'Repeated falls or injury OVRs', 'تكرار بلاغات السقوط أو الإصابة', 'falls_injury', null, 30, 2, 2, 2, 1, true, true, 'Review fall prevention controls and unit compliance.', 'مراجعة ضوابط منع السقوط والتزام الوحدة.'),
    (org_id, 'OVR_ENVIRONMENT_RECUR', 'Repeated environment of care OVRs', 'تكرار بلاغات بيئة الرعاية', 'environment_of_care', null, 30, 3, 2, 1.5, 1, false, false, 'Review facility/equipment control effectiveness.', 'مراجعة فعالية ضوابط المرافق والمعدات.'),
    (org_id, 'OVR_OVERDUE_CLOSURE', 'OVR closure delay signal', 'مؤشر تأخر إغلاق بلاغ OVR', null, null, 30, 1, 1, 1, 3, false, true, 'Escalate overdue OVR corrective action follow-up.', 'تصعيد متابعة الإجراء التصحيحي المتأخر للبلاغ.')
  on conflict (organization_id, rule_code) do update set
    rule_name_en = excluded.rule_name_en,
    rule_name_ar = excluded.rule_name_ar,
    occurrence_category = excluded.occurrence_category,
    severity_level = excluded.severity_level,
    recurrence_window_days = excluded.recurrence_window_days,
    recurrence_threshold = excluded.recurrence_threshold,
    severity_weight = excluded.severity_weight,
    recurrence_weight = excluded.recurrence_weight,
    closure_delay_weight = excluded.closure_delay_weight,
    critical_trigger = excluded.critical_trigger,
    executive_alert = excluded.executive_alert,
    recommended_action_en = excluded.recommended_action_en,
    recommended_action_ar = excluded.recommended_action_ar;

  insert into public.i18n_translation_coverage_items (area_code, module_name, item_key, english_text, arabic_text, status, owner_role, priority)
  values
    ('global', 'Shared status labels', 'status.closed', 'Closed', 'مغلق', 'complete', 'governance_admin', 'critical'),
    ('global', 'Shared status labels', 'status.delayed', 'Delayed', 'متأخر', 'complete', 'governance_admin', 'critical'),
    ('global', 'Shared roles', 'role.executive', 'Executive', 'تنفيذي', 'complete', 'governance_admin', 'critical'),
    ('global', 'Shared roles', 'role.department_manager', 'Department Manager', 'مدير القسم', 'complete', 'governance_admin', 'critical'),
    ('ovr', 'OVR workflow', 'ovr.confidential_banner', 'Confidential - do not file in the medical record', 'سري - لا يحفظ في السجل الطبي', 'complete', 'quality_manager', 'critical'),
    ('ovr', 'OVR workflow', 'ovr.quality_closure', 'Quality closure review', 'مراجعة إغلاق الجودة', 'complete', 'quality_manager', 'critical'),
    ('reports', 'Print reports', 'report.executive_summary', 'Executive GRC summary', 'ملخص الحوكمة والمخاطر والامتثال التنفيذي', 'complete', 'governance_admin', 'high'),
    ('export', 'Export center', 'export.backup_package', 'Backup package', 'حزمة النسخ الاحتياطي', 'complete', 'super_admin', 'high')
  on conflict (area_code, item_key) do update set
    english_text = excluded.english_text,
    arabic_text = excluded.arabic_text,
    status = excluded.status,
    priority = excluded.priority;

  insert into public.rtl_visual_qa_items (screen_code, screen_name_en, screen_name_ar, qa_area, expected_result_en, expected_result_ar, status, device_size, severity)
  values
    ('home', 'Home / Launchpad', 'الرئيسية / منصة الانطلاق', 'hero_alignment', 'Hero cards align correctly in RTL and LTR.', 'تظهر بطاقات الصفحة الرئيسية بمحاذاة صحيحة عربي وإنجليزي.', 'not_tested', 'desktop', 'high'),
    ('dashboard', 'Executive Dashboard', 'لوحة القيادة التنفيذية', 'kpi_cards', 'KPI cards preserve number direction and Arabic labels.', 'تحافظ بطاقات المؤشرات على اتجاه الأرقام وتسميات اللغة العربية.', 'not_tested', 'desktop', 'high'),
    ('ovr', 'OVR Workflow', 'سير عمل OVR', 'form_layout', 'OVR form fields, buttons, and confidentiality banner are visible without zoom.', 'حقول نموذج OVR والأزرار وشريط السرية واضحة دون الحاجة للتكبير.', 'not_tested', 'desktop', 'critical'),
    ('ovr_print', 'OVR Print', 'طباعة OVR', 'print_layout', 'Bilingual print report is clean and aligned.', 'تقرير الطباعة الثنائي اللغة واضح ومتناسق.', 'not_tested', 'print', 'critical'),
    ('reports', 'Reports & Export', 'التقارير والتصدير', 'table_scroll', 'Wide tables scroll safely without hiding actions.', 'الجداول العريضة قابلة للتمرير دون إخفاء الإجراءات.', 'not_tested', 'desktop', 'high'),
    ('mobile_home', 'Mobile Home', 'الرئيسية للجوال', 'mobile_cards', 'Cards stack cleanly on mobile width.', 'تظهر البطاقات بشكل عمودي منظم في عرض الجوال.', 'not_tested', 'mobile', 'medium'),
    ('modal_forms', 'Modal Forms', 'النماذج المنبثقة', 'sticky_actions', 'Save/cancel buttons remain visible in long forms.', 'تبقى أزرار الحفظ والإلغاء ظاهرة في النماذج الطويلة.', 'not_tested', 'desktop', 'critical')
  on conflict (screen_code, qa_area, device_size) do update set
    screen_name_en = excluded.screen_name_en,
    screen_name_ar = excluded.screen_name_ar,
    expected_result_en = excluded.expected_result_en,
    expected_result_ar = excluded.expected_result_ar,
    severity = excluded.severity;

  return 'v4.6 OVR, bilingual, and RTL production hardening defaults seeded.';
end;
$$;
