-- =========================================================
-- GRC Control Center - Migration 019
-- Performance signals, responsive readiness, module pressure
-- =========================================================

create table if not exists ui_performance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  page_key text not null,
  event_type text not null default 'page_load',
  load_ms integer,
  viewport_width integer,
  viewport_height integer,
  device_category text,
  language text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ui_performance_load_nonnegative check (load_ms is null or load_ms >= 0)
);

create index if not exists idx_ui_performance_events_created_at on ui_performance_events(created_at desc);
create index if not exists idx_ui_performance_events_page_key on ui_performance_events(page_key);
create index if not exists idx_ui_performance_events_device on ui_performance_events(device_category);
create index if not exists idx_ui_performance_events_user on ui_performance_events(user_id);

alter table ui_performance_events enable row level security;

drop policy if exists ui_performance_events_insert_own on ui_performance_events;
create policy ui_performance_events_insert_own
on ui_performance_events
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists ui_performance_events_read_control_roles on ui_performance_events;
create policy ui_performance_events_read_control_roles
on ui_performance_events
for select
to authenticated
using (
  exists (
    select 1
    from user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role in ('super_admin', 'executive', 'governance_admin')
  )
  or user_id = auth.uid()
);

create or replace view v_ui_performance_summary as
with recent as (
  select *
  from ui_performance_events
  where created_at >= now() - interval '30 days'
), scoped as (
  select
    organization_id,
    count(*)::integer as total_events,
    coalesce(round(avg(load_ms))::integer, 0) as avg_load_ms,
    coalesce(round(percentile_cont(0.95) within group (order by load_ms))::integer, 0) as p95_load_ms,
    count(*) filter (where device_category in ('mobile', 'tablet'))::integer as mobile_events,
    count(*) filter (where load_ms >= 2500)::integer as slow_events,
    max(created_at) as last_event_at
  from recent
  group by organization_id
)
select
  organization_id,
  total_events,
  avg_load_ms,
  p95_load_ms,
  mobile_events,
  slow_events,
  last_event_at,
  greatest(0, least(100, 100 - (slow_events * 8) - case when p95_load_ms > 2500 then 15 else 0 end - case when avg_load_ms > 1200 then 8 else 0 end))::integer as performance_score
from scoped
union all
select
  (select id from organizations order by created_at limit 1) as organization_id,
  0 as total_events,
  0 as avg_load_ms,
  0 as p95_load_ms,
  0 as mobile_events,
  0 as slow_events,
  null::timestamptz as last_event_at,
  100 as performance_score
where not exists (select 1 from recent);

create or replace view v_module_payload_pressure as
select
  'projects'::text as module_key,
  'Projects & Actions'::text as module_name_en,
  'المشاريع وخطط العمل'::text as module_name_ar,
  count(*) filter (where status not in ('closed','cancelled'))::integer as open_items,
  count(*) filter (where target_end_date < current_date and status not in ('closed','cancelled'))::integer as overdue_items,
  count(*) filter (where risk_level = 'critical' and status not in ('closed','cancelled'))::integer as critical_items,
  least(100, count(*) filter (where status not in ('closed','cancelled')) * 1 + count(*) filter (where target_end_date < current_date and status not in ('closed','cancelled')) * 5 + count(*) filter (where risk_level = 'critical' and status not in ('closed','cancelled')) * 7)::integer as pressure_score
from projects
union all
select
  'tasks',
  'Tasks',
  'المهام',
  count(*) filter (where status not in ('closed','approved','cancelled'))::integer,
  count(*) filter (where due_date < current_date and status not in ('closed','approved','cancelled'))::integer,
  0::integer,
  least(100, count(*) filter (where status not in ('closed','approved','cancelled')) * 1 + count(*) filter (where due_date < current_date and status not in ('closed','approved','cancelled')) * 4)::integer
from tasks
union all
select
  'risks',
  'Risk Register',
  'سجل المخاطر',
  count(*) filter (where status not in ('closed','cancelled'))::integer,
  count(*) filter (where next_review_date < current_date and status not in ('closed','cancelled'))::integer,
  count(*) filter (where risk_level = 'critical' and status not in ('closed','cancelled'))::integer,
  least(100, count(*) filter (where status not in ('closed','cancelled')) * 1 + count(*) filter (where next_review_date < current_date and status not in ('closed','cancelled')) * 4 + count(*) filter (where risk_level = 'critical' and status not in ('closed','cancelled')) * 6)::integer
from risks
union all
select
  'ovr',
  'OVR / Incidents',
  'بلاغات OVR / الحوادث',
  count(*) filter (where status::text not in ('closed','cancelled'))::integer,
  count(*) filter (where created_at < now() - interval '7 days' and status::text not in ('closed','cancelled'))::integer,
  count(*) filter (where severity_level::text in ('level_4','sentinel') and status::text not in ('closed','cancelled'))::integer,
  least(100, count(*) filter (where status::text not in ('closed','cancelled')) * 2 + count(*) filter (where created_at < now() - interval '7 days' and status::text not in ('closed','cancelled')) * 5 + count(*) filter (where severity_level::text in ('level_4','sentinel') and status::text not in ('closed','cancelled')) * 8)::integer
from ovr_reports
union all
select
  'approvals',
  'Approvals',
  'الموافقات',
  count(*) filter (where status = 'pending')::integer,
  count(*) filter (where requested_at < now() - interval '7 days' and status = 'pending')::integer,
  0::integer,
  least(100, count(*) filter (where status = 'pending') * 2 + count(*) filter (where requested_at < now() - interval '7 days' and status = 'pending') * 6)::integer
from approvals
union all
select
  'audit',
  'Audit Follow-up',
  'متابعة المراجعة',
  count(*) filter (where status not in ('closed','cancelled'))::integer,
  count(*) filter (where due_date < current_date and status not in ('closed','cancelled'))::integer,
  count(*) filter (where risk_level = 'critical' and status not in ('closed','cancelled'))::integer,
  least(100, count(*) filter (where status not in ('closed','cancelled')) * 2 + count(*) filter (where due_date < current_date and status not in ('closed','cancelled')) * 6 + count(*) filter (where risk_level = 'critical' and status not in ('closed','cancelled')) * 8)::integer
from audit_findings;

create or replace view v_mobile_readiness_gates as
select
  'responsive_shell'::text as gate_key,
  'passed'::text as status,
  'medium'::text as severity,
  'Responsive shell enabled'::text as title_en,
  'تفعيل الهيكل المتجاوب'::text as title_ar,
  'Navigation, cards and forms include responsive CSS rules for smaller screens.'::text as details_en,
  'تتضمن القائمة والبطاقات والنماذج قواعد CSS متجاوبة للشاشات الصغيرة.'::text as details_ar,
  0::integer as record_count,
  null::text as action_path
union all
select
  'large_open_queues',
  case when coalesce(sum(open_items),0) > 300 then 'blocked' when coalesce(sum(open_items),0) > 100 then 'warning' else 'passed' end,
  'high',
  'Large open queues',
  'قوائم مفتوحة كبيرة',
  'High open item volume can slow daily mobile reviews. Use filters and dashboards first.',
  'ارتفاع عدد البنود المفتوحة قد يبطئ المراجعة اليومية عبر الجوال. استخدم الفلاتر واللوحات أولاً.',
  coalesce(sum(open_items),0)::integer,
  '/operations'
from v_module_payload_pressure
union all
select
  'slow_browser_signals',
  case when coalesce(sum(slow_events),0) > 10 then 'blocked' when coalesce(sum(slow_events),0) > 0 then 'warning' else 'passed' end,
  'medium',
  'Slow browser signals',
  'مؤشرات بطء المتصفح',
  'Recent performance signals are checked for slow page-load experiences.',
  'يتم فحص مؤشرات الأداء الأخيرة لرصد تجارب تحميل الصفحات البطيئة.',
  coalesce(sum(slow_events),0)::integer,
  '/performance'
from v_ui_performance_summary
union all
select
  'touch_friendly_controls',
  'passed',
  'low',
  'Touch-friendly controls',
  'أزرار مناسبة للمس',
  'Primary controls use modern button spacing and responsive wrapping.',
  'تستخدم الأزرار الرئيسية مسافات حديثة والتفافاً متجاوباً.',
  0,
  null;
