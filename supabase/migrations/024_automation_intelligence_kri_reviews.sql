
-- =========================================================
-- GRC Control Center - Migration 024
-- Automation Intelligence, KRI Thresholds, Recurring Reviews,
-- Committee Action Automation and Executive Exception Rules
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type automation_rule_type as enum (
    'due_reminder',
    'overdue_escalation',
    'kri_breach',
    'risk_appetite_breach',
    'committee_action_followup',
    'recurring_review_due',
    'evidence_review_delay',
    'backup_restore_due',
    'executive_exception'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type automation_action_type as enum (
    'notify_owner',
    'notify_manager',
    'notify_executive',
    'create_escalation',
    'create_review_task',
    'flag_dashboard',
    'require_action_plan',
    'require_approval'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type review_area_type as enum (
    'risk',
    'control',
    'compliance',
    'audit_finding',
    'policy',
    'ovr',
    'committee_decision',
    'backup',
    'access_review',
    'department_scorecard'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type review_status as enum (
    'scheduled',
    'due_soon',
    'due',
    'overdue',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type kri_direction as enum (
    'higher_is_worse',
    'lower_is_worse',
    'outside_range_is_worse'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type breach_level as enum (
    'normal',
    'watch',
    'warning',
    'critical'
  );
exception when duplicate_object then null;
end $$;

-- =========================
-- RISK APPETITE & KRI TABLES
-- =========================

create table if not exists risk_appetite_statements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  appetite_code text not null,
  title_en text not null,
  title_ar text not null,
  category risk_category default 'other',
  statement_en text,
  statement_ar text,
  max_residual_score integer default 12 check (max_residual_score between 1 and 25),
  max_critical_risks integer default 0 check (max_critical_risks >= 0),
  max_high_risks integer default 5 check (max_high_risks >= 0),
  tolerance_notes text,
  owner_id uuid references profiles(id) on delete set null,
  is_active boolean not null default true,
  effective_from date default current_date,
  review_due_date date,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, appetite_code)
);

create table if not exists key_risk_indicators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  kri_code text not null,
  title_en text not null,
  title_ar text not null,
  category risk_category default 'other',
  department_id uuid references departments(id) on delete set null,
  owner_id uuid references profiles(id) on delete set null,
  unit_label text,
  direction kri_direction not null default 'higher_is_worse',
  watch_threshold numeric(18,4),
  warning_threshold numeric(18,4),
  critical_threshold numeric(18,4),
  lower_threshold numeric(18,4),
  upper_threshold numeric(18,4),
  data_source text,
  review_frequency control_frequency not null default 'monthly',
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, kri_code)
);

create table if not exists kri_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  kri_id uuid not null references key_risk_indicators(id) on delete cascade,
  observed_at date not null default current_date,
  value numeric(18,4) not null,
  breach_level breach_level not null default 'normal',
  source_reference text,
  notes text,
  entered_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kri_id, observed_at)
);

-- =========================
-- RECURRING REVIEWS & AUTOMATION RULES
-- =========================

create table if not exists recurring_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  review_code text not null,
  title_en text not null,
  title_ar text not null,
  area review_area_type not null,
  linked_record_id uuid,
  department_id uuid references departments(id) on delete set null,
  owner_id uuid references profiles(id) on delete set null,
  reviewer_id uuid references profiles(id) on delete set null,
  frequency control_frequency not null default 'monthly',
  next_due_date date not null,
  reminder_days_before integer not null default 7,
  status review_status not null default 'scheduled',
  last_completed_at timestamptz,
  completion_evidence_id uuid references evidence_files(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, review_code)
);

create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  rule_code text not null,
  title_en text not null,
  title_ar text not null,
  rule_type automation_rule_type not null,
  action_type automation_action_type not null,
  priority priority_level not null default 'medium',
  condition_json jsonb not null default '{}'::jsonb,
  action_json jsonb not null default '{}'::jsonb,
  applies_to_scope access_scope not null default 'global',
  department_id uuid references departments(id) on delete set null,
  is_active boolean not null default true,
  last_run_at timestamptz,
  run_count integer not null default 0,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rule_code)
);

create table if not exists automation_run_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  rule_id uuid references automation_rules(id) on delete set null,
  rule_code text,
  run_status text not null default 'completed',
  signals_found integer not null default 0,
  actions_created integer not null default 0,
  run_summary jsonb not null default '{}'::jsonb,
  triggered_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists executive_exception_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  exception_code text not null,
  title_en text not null,
  title_ar text not null,
  area text not null,
  trigger_description_en text,
  trigger_description_ar text,
  severity risk_level not null default 'high',
  auto_escalate boolean not null default true,
  requires_ceo_visibility boolean not null default true,
  requires_action_plan boolean not null default true,
  response_sla_hours integer default 24,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, exception_code)
);

-- =========================
-- TRIGGERS
-- =========================

drop trigger if exists trg_risk_appetite_updated_at on risk_appetite_statements;
create trigger trg_risk_appetite_updated_at before update on risk_appetite_statements for each row execute function set_updated_at();

drop trigger if exists trg_key_risk_indicators_updated_at on key_risk_indicators;
create trigger trg_key_risk_indicators_updated_at before update on key_risk_indicators for each row execute function set_updated_at();

drop trigger if exists trg_recurring_reviews_updated_at on recurring_reviews;
create trigger trg_recurring_reviews_updated_at before update on recurring_reviews for each row execute function set_updated_at();

drop trigger if exists trg_automation_rules_updated_at on automation_rules;
create trigger trg_automation_rules_updated_at before update on automation_rules for each row execute function set_updated_at();

drop trigger if exists trg_executive_exception_rules_updated_at on executive_exception_rules;
create trigger trg_executive_exception_rules_updated_at before update on executive_exception_rules for each row execute function set_updated_at();

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_risk_appetite_org_category on risk_appetite_statements(organization_id, category, is_active);
create index if not exists idx_kri_org_category on key_risk_indicators(organization_id, category, is_active);
create index if not exists idx_kri_observations_kri_date on kri_observations(kri_id, observed_at desc);
create index if not exists idx_kri_observations_breach on kri_observations(organization_id, breach_level, observed_at desc);
create index if not exists idx_recurring_reviews_queue on recurring_reviews(organization_id, status, next_due_date) where is_active = true;
create index if not exists idx_automation_rules_type on automation_rules(organization_id, rule_type, is_active);
create index if not exists idx_automation_log_created on automation_run_log(organization_id, created_at desc);
create index if not exists idx_exception_rules_org on executive_exception_rules(organization_id, severity, is_active);

-- =========================
-- SEED DEFAULT RULES
-- =========================

insert into automation_rules (organization_id, rule_code, title_en, title_ar, rule_type, action_type, priority, condition_json, action_json)
select o.id, code, title_en, title_ar, rule_type::automation_rule_type, action_type::automation_action_type, priority::priority_level, condition_json::jsonb, action_json::jsonb
from organizations o
cross join (values
  ('OVERDUE_CRITICAL_ACTION', 'Critical overdue action escalation', 'تصعيد إجراء حرج متأخر', 'overdue_escalation', 'notify_executive', 'critical', '{"risk_level":"critical","days_overdue":1}', '{"channel":"dashboard","create_escalation":true}'),
  ('OVR_MAJOR_SIGNAL', 'Major OVR executive signal', 'إشارة تنفيذية لبلاغ OVR جسيم', 'executive_exception', 'notify_executive', 'critical', '{"ovr_severity":"major"}', '{"dashboard":"executive_command","require_quality_review":true}'),
  ('KRI_CRITICAL_BREACH', 'Critical KRI breach follow-up', 'متابعة اختراق KRI حرج', 'kri_breach', 'require_action_plan', 'critical', '{"breach_level":"critical"}', '{"create_project":true,"owner_required":true}'),
  ('POLICY_REVIEW_DUE', 'Policy review due reminder', 'تذكير استحقاق مراجعة سياسة', 'recurring_review_due', 'notify_owner', 'medium', '{"days_before_due":14}', '{"notification":true}'),
  ('COMMITTEE_ACTION_OVERDUE', 'Committee decision follow-up', 'متابعة قرارات اللجان', 'committee_action_followup', 'notify_manager', 'high', '{"days_overdue":1}', '{"create_escalation":true}')
) as seed(code, title_en, title_ar, rule_type, action_type, priority, condition_json, action_json)
on conflict (organization_id, rule_code) do nothing;

insert into executive_exception_rules (organization_id, exception_code, title_en, title_ar, area, trigger_description_en, trigger_description_ar, severity, response_sla_hours)
select o.id, code, title_en, title_ar, area, desc_en, desc_ar, severity::risk_level, sla
from organizations o
cross join (values
  ('ANY_MAJOR_OVR', 'Any major OVR', 'أي بلاغ OVR جسيم', 'OVR', 'Any Level 4 / major OVR should appear immediately in executive command.', 'أي بلاغ مستوى 4 / جسيم يجب أن يظهر فوراً في القيادة التنفيذية.', 'critical', 4),
  ('THREE_REPEAT_OVR_30D', 'Repeated OVR pattern', 'نمط تكرار بلاغات OVR', 'Patient Safety', 'Three repeated OVRs in one category or department within 30 days.', 'ثلاثة بلاغات OVR متكررة في نفس التصنيف أو الإدارة خلال 30 يوماً.', 'high', 24),
  ('CRITICAL_RISK_OVER_APPETITE', 'Critical risks over appetite', 'مخاطر حرجة تتجاوز الشهية', 'Risk', 'Critical/open risk count exceeds approved appetite.', 'عدد المخاطر الحرجة/المفتوحة يتجاوز الشهية المعتمدة.', 'critical', 24),
  ('NO_RECENT_BACKUP', 'No recent backup/export', 'لا توجد نسخة تصدير حديثة', 'Backup', 'No completed backup/export package within the approved interval.', 'لا توجد حزمة تصدير/نسخ مكتملة ضمن الفترة المعتمدة.', 'high', 48)
) as seed(code, title_en, title_ar, area, desc_en, desc_ar, severity, sla)
on conflict (organization_id, exception_code) do nothing;

-- =========================
-- KRI BREACH CALCULATION HELPER
-- =========================

create or replace function calculate_kri_breach_level(
  p_direction kri_direction,
  p_value numeric,
  p_watch numeric,
  p_warning numeric,
  p_critical numeric,
  p_lower numeric,
  p_upper numeric
) returns breach_level
language plpgsql stable as $$
begin
  if p_direction = 'higher_is_worse' then
    if p_critical is not null and p_value >= p_critical then return 'critical'; end if;
    if p_warning is not null and p_value >= p_warning then return 'warning'; end if;
    if p_watch is not null and p_value >= p_watch then return 'watch'; end if;
    return 'normal';
  elsif p_direction = 'lower_is_worse' then
    if p_critical is not null and p_value <= p_critical then return 'critical'; end if;
    if p_warning is not null and p_value <= p_warning then return 'warning'; end if;
    if p_watch is not null and p_value <= p_watch then return 'watch'; end if;
    return 'normal';
  else
    if (p_lower is not null and p_value < p_lower) or (p_upper is not null and p_value > p_upper) then
      return 'warning';
    end if;
    return 'normal';
  end if;
end;
$$;

create or replace function set_kri_observation_breach_level()
returns trigger language plpgsql as $$
declare
  k key_risk_indicators%rowtype;
begin
  select * into k from key_risk_indicators where id = new.kri_id;
  new.organization_id := coalesce(new.organization_id, k.organization_id);
  new.breach_level := calculate_kri_breach_level(k.direction, new.value, k.watch_threshold, k.warning_threshold, k.critical_threshold, k.lower_threshold, k.upper_threshold);
  return new;
end;
$$;

drop trigger if exists trg_set_kri_breach on kri_observations;
create trigger trg_set_kri_breach before insert or update on kri_observations for each row execute function set_kri_observation_breach_level();

-- =========================
-- VIEWS
-- =========================

create or replace view v_automation_command_summary as
select
  o.id as organization_id,
  count(distinct ar.id) filter (where ar.is_active) as active_rules,
  count(distinct rr.id) filter (where rr.is_active and rr.next_due_date <= current_date + interval '7 days') as reviews_due_7_days,
  count(distinct rr.id) filter (where rr.is_active and rr.next_due_date < current_date and rr.status <> 'completed') as overdue_reviews,
  count(distinct ko.id) filter (where ko.breach_level in ('warning','critical') and ko.observed_at >= current_date - interval '30 days') as kri_breaches_30_days,
  count(distinct ko.id) filter (where ko.breach_level = 'critical' and ko.observed_at >= current_date - interval '30 days') as critical_kri_breaches_30_days,
  count(distinct eer.id) filter (where eer.is_active and eer.requires_ceo_visibility) as executive_exception_rules,
  count(distinct al.id) filter (where al.created_at >= now() - interval '7 days') as automation_runs_7_days
from organizations o
left join automation_rules ar on ar.organization_id = o.id
left join recurring_reviews rr on rr.organization_id = o.id
left join kri_observations ko on ko.organization_id = o.id
left join executive_exception_rules eer on eer.organization_id = o.id
left join automation_run_log al on al.organization_id = o.id
group by o.id;

create or replace view v_risk_appetite_dashboard as
with risk_counts as (
  select organization_id, category,
    count(*) filter (where status not in ('closed','cancelled') and risk_level = 'critical') as critical_open_risks,
    count(*) filter (where status not in ('closed','cancelled') and risk_level = 'high') as high_open_risks,
    coalesce(max(residual_score),0) as max_residual_score,
    coalesce(avg(residual_score),0)::numeric(10,2) as avg_residual_score
  from risks
  group by organization_id, category
)
select
  ras.id,
  ras.organization_id,
  ras.appetite_code,
  ras.title_en,
  ras.title_ar,
  ras.category,
  ras.max_residual_score,
  ras.max_critical_risks,
  ras.max_high_risks,
  coalesce(rc.critical_open_risks,0) as critical_open_risks,
  coalesce(rc.high_open_risks,0) as high_open_risks,
  coalesce(rc.max_residual_score,0) as actual_max_residual_score,
  coalesce(rc.avg_residual_score,0) as actual_avg_residual_score,
  case
    when coalesce(rc.critical_open_risks,0) > ras.max_critical_risks then 'critical'
    when coalesce(rc.max_residual_score,0) > ras.max_residual_score then 'warning'
    when coalesce(rc.high_open_risks,0) > ras.max_high_risks then 'watch'
    else 'normal'
  end as appetite_status,
  ras.review_due_date,
  ras.is_active
from risk_appetite_statements ras
left join risk_counts rc on rc.organization_id = ras.organization_id and rc.category = ras.category
where ras.is_active = true;

create or replace view v_kri_breach_register as
select
  ko.id,
  ko.organization_id,
  ko.kri_id,
  kri.kri_code,
  kri.title_en,
  kri.title_ar,
  kri.category,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  kri.unit_label,
  kri.direction,
  ko.observed_at,
  ko.value,
  kri.watch_threshold,
  kri.warning_threshold,
  kri.critical_threshold,
  ko.breach_level,
  kri.owner_id,
  p.full_name_en as owner_name_en,
  p.full_name_ar as owner_name_ar,
  ko.notes
from kri_observations ko
join key_risk_indicators kri on kri.id = ko.kri_id
left join departments d on d.id = kri.department_id
left join profiles p on p.id = kri.owner_id
where ko.breach_level <> 'normal';

create or replace view v_recurring_review_queue as
select
  rr.id,
  rr.organization_id,
  rr.review_code,
  rr.title_en,
  rr.title_ar,
  rr.area,
  rr.linked_record_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  owner.full_name_en as owner_name_en,
  owner.full_name_ar as owner_name_ar,
  reviewer.full_name_en as reviewer_name_en,
  reviewer.full_name_ar as reviewer_name_ar,
  rr.frequency,
  rr.next_due_date,
  rr.reminder_days_before,
  case
    when rr.status = 'completed' then 'completed'::review_status
    when rr.next_due_date < current_date then 'overdue'::review_status
    when rr.next_due_date <= current_date then 'due'::review_status
    when rr.next_due_date <= current_date + (rr.reminder_days_before || ' days')::interval then 'due_soon'::review_status
    else rr.status
  end as computed_status,
  greatest(current_date - rr.next_due_date, 0) as days_overdue,
  rr.last_completed_at,
  rr.notes
from recurring_reviews rr
left join departments d on d.id = rr.department_id
left join profiles owner on owner.id = rr.owner_id
left join profiles reviewer on reviewer.id = rr.reviewer_id
where rr.is_active = true;

create or replace view v_automation_rule_catalog as
select
  ar.id,
  ar.organization_id,
  ar.rule_code,
  ar.title_en,
  ar.title_ar,
  ar.rule_type,
  ar.action_type,
  ar.priority,
  ar.applies_to_scope,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  ar.condition_json,
  ar.action_json,
  ar.is_active,
  ar.last_run_at,
  ar.run_count,
  case
    when ar.last_run_at is null then 'never_run'
    when ar.last_run_at < now() - interval '7 days' then 'stale'
    else 'healthy'
  end as rule_health
from automation_rules ar
left join departments d on d.id = ar.department_id;

create or replace view v_committee_action_automation as
select
  cd.id,
  cd.organization_id,
  cd.decision_code,
  cd.title,
  cd.decision_text,
  cm.committee_name,
  cm.meeting_date,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  owner.full_name_en as owner_name_en,
  owner.full_name_ar as owner_name_ar,
  cd.due_date,
  cd.priority,
  cd.risk_level,
  cd.status,
  greatest(current_date - cd.due_date, 0) as days_overdue,
  case
    when cd.status in ('closed','cancelled') then 'closed'
    when cd.due_date < current_date then 'overdue'
    when cd.due_date <= current_date + interval '7 days' then 'due_soon'
    when cd.linked_project_id is null and cd.evidence_required then 'needs_project_or_evidence'
    else 'on_track'
  end as automation_signal,
  cd.linked_project_id
from committee_decisions cd
left join committee_meetings cm on cm.id = cd.meeting_id
left join departments d on d.id = cd.department_id
left join profiles owner on owner.id = cd.owner_id;

create or replace view v_executive_exception_dashboard as
select
  eer.id,
  eer.organization_id,
  eer.exception_code,
  eer.title_en,
  eer.title_ar,
  eer.area,
  eer.trigger_description_en,
  eer.trigger_description_ar,
  eer.severity,
  eer.response_sla_hours,
  eer.requires_ceo_visibility,
  eer.requires_action_plan,
  eer.is_active,
  case
    when eer.severity = 'critical' then 100
    when eer.severity = 'high' then 75
    when eer.severity = 'medium' then 45
    else 25
  end as command_weight
from executive_exception_rules eer
where eer.is_active = true;

-- =========================
-- AUTOMATION REFRESH RPC
-- =========================

create or replace function refresh_automation_intelligence(p_organization_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  due_reviews integer := 0;
  kri_breaches integer := 0;
  committee_overdue integer := 0;
  rule_count integer := 0;
begin
  select coalesce(p_organization_id, (select id from organizations order by created_at limit 1)) into org_id;

  update recurring_reviews
  set status = case
      when next_due_date < current_date then 'overdue'::review_status
      when next_due_date <= current_date then 'due'::review_status
      when next_due_date <= current_date + (reminder_days_before || ' days')::interval then 'due_soon'::review_status
      else status
    end,
    updated_at = now()
  where organization_id = org_id
    and is_active = true
    and status not in ('completed','cancelled');

  get diagnostics due_reviews = row_count;

  select count(*) into kri_breaches
  from kri_observations
  where organization_id = org_id
    and breach_level in ('warning','critical')
    and observed_at >= current_date - interval '30 days';

  select count(*) into committee_overdue
  from committee_decisions
  where organization_id = org_id
    and due_date < current_date
    and status not in ('closed','cancelled');

  update automation_rules
  set last_run_at = now(), run_count = run_count + 1, updated_at = now()
  where organization_id = org_id and is_active = true;

  get diagnostics rule_count = row_count;

  insert into automation_run_log (organization_id, rule_code, run_status, signals_found, actions_created, run_summary)
  values (
    org_id,
    'MANUAL_REFRESH',
    'completed',
    due_reviews + kri_breaches + committee_overdue,
    0,
    jsonb_build_object('due_reviews', due_reviews, 'kri_breaches', kri_breaches, 'committee_overdue', committee_overdue, 'rules_touched', rule_count)
  );

  return jsonb_build_object(
    'organization_id', org_id,
    'due_reviews', due_reviews,
    'kri_breaches_30_days', kri_breaches,
    'committee_overdue', committee_overdue,
    'rules_touched', rule_count,
    'refreshed_at', now()
  );
end;
$$;
