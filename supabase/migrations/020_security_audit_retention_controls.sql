-- =========================================================
-- GRC Control Center - Migration 020
-- Security governance, audit-depth monitoring, data retention
-- =========================================================

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type security_event_severity as enum ('critical', 'high', 'medium', 'low');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type retention_rule_status as enum ('draft', 'active', 'paused', 'retired');
exception when duplicate_object then null;
end $$;

-- =========================
-- SECURITY REVIEW EVENTS
-- =========================

create table if not exists security_review_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,

  activity_type text not null,
  severity security_event_severity not null default 'medium',

  summary_en text not null,
  summary_ar text,

  source_table text,
  source_record_id uuid,
  metadata jsonb not null default '{}'::jsonb,

  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  resolution_note text,

  created_at timestamptz not null default now()
);

create index if not exists idx_security_review_events_org on security_review_events(organization_id);
create index if not exists idx_security_review_events_actor on security_review_events(actor_id);
create index if not exists idx_security_review_events_type on security_review_events(activity_type);
create index if not exists idx_security_review_events_severity on security_review_events(severity);
create index if not exists idx_security_review_events_created on security_review_events(created_at);
create index if not exists idx_security_review_events_unresolved on security_review_events(organization_id, severity) where resolved_at is null;

-- =========================
-- DATA RETENTION RULES
-- Note: These rules are metadata only. They do not delete data.
-- Actual archiving/deletion should remain approved and logged.
-- =========================

create table if not exists data_retention_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,

  rule_key text not null,
  title_en text not null,
  title_ar text,
  description_en text,
  description_ar text,

  target_table text not null,
  date_column text not null default 'created_at',
  retention_months integer not null check (retention_months > 0),

  requires_approval boolean not null default true,
  requires_backup_before_action boolean not null default true,
  status retention_rule_status not null default 'draft',

  owner_role app_role,
  owner_id uuid references profiles(id) on delete set null,
  last_reviewed_at timestamptz,
  next_review_date date,

  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, rule_key)
);

create index if not exists idx_data_retention_rules_org on data_retention_rules(organization_id);
create index if not exists idx_data_retention_rules_table on data_retention_rules(target_table);
create index if not exists idx_data_retention_rules_status on data_retention_rules(status);
create index if not exists idx_data_retention_rules_next_review on data_retention_rules(next_review_date);

drop trigger if exists trg_data_retention_rules_updated_at on data_retention_rules;
create trigger trg_data_retention_rules_updated_at
before update on data_retention_rules
for each row execute function set_updated_at();

-- =========================
-- ACCESS REVIEW CYCLES
-- =========================

create table if not exists access_review_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,

  cycle_name text not null,
  scope access_scope not null default 'global',
  division_id uuid references divisions(id) on delete set null,
  department_id uuid references departments(id) on delete set null,

  status text not null default 'open',
  due_date date,

  reviewer_id uuid references profiles(id) on delete set null,
  completed_by uuid references profiles(id) on delete set null,
  completed_at timestamptz,
  notes text,

  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_access_review_cycles_org on access_review_cycles(organization_id);
create index if not exists idx_access_review_cycles_status on access_review_cycles(status);
create index if not exists idx_access_review_cycles_due on access_review_cycles(due_date);

drop trigger if exists trg_access_review_cycles_updated_at on access_review_cycles;
create trigger trg_access_review_cycles_updated_at
before update on access_review_cycles
for each row execute function set_updated_at();

-- =========================
-- SEED DEFAULT RETENTION RULES
-- =========================

insert into data_retention_rules (
  organization_id,
  rule_key,
  title_en,
  title_ar,
  description_en,
  description_ar,
  target_table,
  date_column,
  retention_months,
  requires_approval,
  requires_backup_before_action,
  status,
  owner_role,
  next_review_date
)
select
  o.id,
  seed.rule_key,
  seed.title_en,
  seed.title_ar,
  seed.description_en,
  seed.description_ar,
  seed.target_table,
  seed.date_column,
  seed.retention_months,
  seed.requires_approval,
  seed.requires_backup_before_action,
  'active'::retention_rule_status,
  seed.owner_role::app_role,
  current_date + interval '90 days'
from organizations o
cross join (
  values
    ('audit_logs', 'Audit logs retention', 'مدة حفظ سجلات التدقيق', 'Keep system audit history for governance review and investigations.', 'الاحتفاظ بسجل التدقيق للمراجعات والتحقيقات الحوكمية.', 'audit_logs', 'created_at', 84, true, true, 'governance_admin'),
    ('security_review_events', 'Security review events', 'أحداث المراجعة الأمنية', 'Keep security review actions and exceptions as controlled governance records.', 'الاحتفاظ بإجراءات المراجعة الأمنية والاستثناءات كسجلات حوكمة مضبوطة.', 'security_review_events', 'created_at', 84, true, true, 'super_admin'),
    ('ovr_reports', 'OVR report retention', 'مدة حفظ بلاغات OVR', 'OVR records are confidential and should follow healthcare quality retention policy.', 'بلاغات OVR سرية ويجب أن تتبع سياسة احتفاظ الجودة الصحية.', 'ovr_reports', 'created_at', 120, true, true, 'governance_admin'),
    ('evidence_files', 'Evidence metadata retention', 'مدة حفظ بيانات الأدلة', 'Retain evidence metadata; storage binaries should follow backup and legal requirements.', 'الاحتفاظ ببيانات الأدلة؛ ملفات التخزين تتبع متطلبات النسخ والنظام.', 'evidence_files', 'created_at', 84, true, true, 'governance_admin'),
    ('approvals', 'Approval records retention', 'مدة حفظ سجلات الموافقات', 'Approval decisions support accountability and should be retained.', 'قرارات الموافقات تدعم المساءلة ويجب الاحتفاظ بها.', 'approvals', 'requested_at', 84, true, true, 'governance_admin'),
    ('export_logs', 'Export logs retention', 'مدة حفظ سجلات التصدير', 'Export activity should remain reviewable for data-governance monitoring.', 'يجب أن تبقى أنشطة التصدير قابلة للمراجعة لمراقبة حوكمة البيانات.', 'export_logs', 'created_at', 36, true, true, 'super_admin'),
    ('ui_performance_events', 'UI performance signal cleanup', 'تنظيف إشارات أداء الواجهة', 'Performance telemetry can be cleaned faster after summary review.', 'يمكن تنظيف مؤشرات الأداء بعد مراجعة الملخصات.', 'ui_performance_events', 'created_at', 12, false, false, 'super_admin')
) as seed(rule_key, title_en, title_ar, description_en, description_ar, target_table, date_column, retention_months, requires_approval, requires_backup_before_action, owner_role)
on conflict (organization_id, rule_key) do nothing;

-- =========================
-- VIEWS
-- =========================

create or replace view v_security_access_findings as
with role_counts as (
  select
    coalesce(ur.organization_id, p.organization_id) as organization_id,
    count(*) filter (
      where ur.is_active = true
        and ur.role in ('super_admin', 'executive', 'governance_admin')
        and ur.scope = 'global'
    ) as sensitive_global_roles,
    count(*) filter (
      where ur.is_active = true
        and ur.role in ('employee', 'viewer')
        and ur.scope in ('global', 'division')
    ) as broad_limited_roles,
    count(*) filter (
      where ur.is_active = true
        and ur.scope = 'department'
        and ur.department_id is null
    ) as missing_department_scope,
    count(*) filter (
      where ur.is_active = true
        and ur.assigned_at < now() - interval '180 days'
        and ur.role in ('super_admin', 'executive', 'governance_admin')
    ) as stale_sensitive_roles
  from user_roles ur
  left join profiles p on p.id = ur.user_id
  group by coalesce(ur.organization_id, p.organization_id)
)
select
  organization_id,
  'sensitive_global_roles'::text as finding_key,
  case when sensitive_global_roles > 5 then 'critical' when sensitive_global_roles > 0 then 'high' else 'low' end as severity,
  'Sensitive global roles require review'::text as title_en,
  'الأدوار الحساسة بنطاق عام تحتاج مراجعة'::text as title_ar,
  'Super admin, executive and governance admin roles should have owner, expiry and quarterly review evidence.'::text as details_en,
  'يجب أن يكون لأدوار مدير النظام والتنفيذي ومسؤول الحوكمة مسؤول وتاريخ انتهاء ودليل مراجعة ربع سنوي.'::text as details_ar,
  sensitive_global_roles as record_count,
  '/access-control'::text as action_path
from role_counts
union all
select
  organization_id,
  'broad_limited_roles',
  case when broad_limited_roles > 0 then 'high' else 'low' end,
  'Broad scope assigned to limited roles',
  'نطاق واسع لأدوار محدودة',
  'Employees/viewers should not have global or division access unless approved as an exception.',
  'يجب ألا يحصل الموظفون أو المشاهدون على صلاحية عامة أو على مستوى قطاع إلا كاستثناء معتمد.',
  broad_limited_roles,
  '/access-control'
from role_counts
union all
select
  organization_id,
  'missing_department_scope',
  case when missing_department_scope > 0 then 'medium' else 'low' end,
  'Scoped roles missing department references',
  'أدوار محددة النطاق بدون إدارة مرتبطة',
  'Department-scoped roles must reference the department so RLS and dashboards remain accurate.',
  'يجب أن ترتبط الأدوار ذات نطاق الإدارة بالإدارة لضمان دقة الصلاحيات واللوحات.',
  missing_department_scope,
  '/access-control'
from role_counts
union all
select
  organization_id,
  'stale_sensitive_roles',
  case when stale_sensitive_roles > 0 then 'medium' else 'low' end,
  'Sensitive roles older than review window',
  'أدوار حساسة أقدم من فترة المراجعة',
  'Sensitive access older than 180 days should be re-certified before full rollout.',
  'الصلاحيات الحساسة الأقدم من 180 يوماً يجب إعادة اعتمادها قبل التشغيل الكامل.',
  stale_sensitive_roles,
  '/security'
from role_counts;

create or replace view v_data_retention_readiness as
select
  r.organization_id,
  r.rule_key,
  r.title_en,
  r.title_ar,
  r.target_table,
  r.retention_months,
  r.status,
  r.requires_approval,
  r.last_reviewed_at,
  r.next_review_date,
  case r.target_table
    when 'audit_logs' then (select count(*) from audit_logs a where a.organization_id = r.organization_id and a.created_at < now() - make_interval(months => r.retention_months))
    when 'security_review_events' then (select count(*) from security_review_events s where s.organization_id = r.organization_id and s.created_at < now() - make_interval(months => r.retention_months))
    when 'ovr_reports' then (select count(*) from ovr_reports o where o.organization_id = r.organization_id and o.created_at < now() - make_interval(months => r.retention_months))
    when 'evidence_files' then (select count(*) from evidence_files e where e.organization_id = r.organization_id and e.created_at < now() - make_interval(months => r.retention_months))
    when 'approvals' then (select count(*) from approvals ap where ap.organization_id = r.organization_id and ap.requested_at < now() - make_interval(months => r.retention_months))
    when 'export_logs' then (select count(*) from export_logs el where el.organization_id = r.organization_id and el.created_at < now() - make_interval(months => r.retention_months))
    when 'ui_performance_events' then (select count(*) from ui_performance_events u where u.organization_id = r.organization_id and u.created_at < now() - make_interval(months => r.retention_months))
    else 0
  end as records_past_retention
from data_retention_rules r
where r.status in ('active', 'paused');

create or replace view v_sensitive_activity_timeline as
select
  e.id,
  e.organization_id,
  e.activity_type,
  e.severity::text as severity,
  p.full_name_en as actor_name,
  e.summary_en,
  coalesce(e.summary_ar, e.summary_en) as summary_ar,
  e.source_table,
  e.source_record_id,
  e.created_at
from security_review_events e
left join profiles p on p.id = e.actor_id
union all
select
  a.id,
  a.organization_id,
  'audit_log'::text,
  case
    when a.action ilike '%delete%' or a.action ilike '%role%' then 'high'
    when a.action ilike '%approve%' or a.action ilike '%close%' then 'medium'
    else 'low'
  end,
  p.full_name_en,
  concat('Audit action: ', a.action, ' on ', a.table_name),
  concat('إجراء تدقيق: ', a.action, ' على ', a.table_name),
  a.table_name,
  a.record_id,
  a.created_at
from audit_logs a
left join profiles p on p.id = a.actor_id
where a.created_at >= now() - interval '30 days';

create or replace view v_security_governance_summary as
with orgs as (
  select id as organization_id from organizations where is_active = true
), access_findings as (
  select organization_id, sum(record_count) as total_findings
  from v_security_access_findings
  where severity in ('critical', 'high', 'medium')
  group by organization_id
), sensitive_roles as (
  select coalesce(ur.organization_id, p.organization_id) as organization_id,
         count(*) filter (where ur.is_active = true and ur.role in ('super_admin', 'executive', 'governance_admin')) as active_sensitive_roles,
         count(*) filter (where ur.is_active = true and ur.scope = 'global' and ur.assigned_at < now() - interval '180 days') as stale_global_roles
  from user_roles ur
  left join profiles p on p.id = ur.user_id
  group by coalesce(ur.organization_id, p.organization_id)
), retention as (
  select organization_id,
         count(*) filter (where status = 'active') as retention_rules_active,
         coalesce(sum(records_past_retention), 0) as pending_retention_actions
  from v_data_retention_readiness
  group by organization_id
), events as (
  select organization_id,
         count(*) filter (where resolved_at is null) as pending_security_reviews,
         count(*) filter (where severity in ('critical','high') and created_at >= now() - interval '30 days') as high_risk_audit_events_30d,
         max(created_at) as last_review_at
  from security_review_events
  group by organization_id
)
select
  o.organization_id,
  greatest(
    0,
    least(
      100,
      100
      - coalesce(af.total_findings, 0) * 4
      - coalesce(sr.stale_global_roles, 0) * 5
      - coalesce(ev.high_risk_audit_events_30d, 0) * 6
      - case when coalesce(rt.retention_rules_active, 0) = 0 then 15 else 0 end
      - least(coalesce(rt.pending_retention_actions, 0), 10)
    )
  )::integer as security_score,
  coalesce(sr.active_sensitive_roles, 0) as active_sensitive_roles,
  coalesce(sr.stale_global_roles, 0) as stale_global_roles,
  coalesce(af.total_findings, 0) as unresolved_access_warnings,
  coalesce(ev.pending_security_reviews, 0) as pending_security_reviews,
  coalesce(ev.high_risk_audit_events_30d, 0) as high_risk_audit_events_30d,
  coalesce(rt.retention_rules_active, 0) as retention_rules_active,
  coalesce(rt.pending_retention_actions, 0) as pending_retention_actions,
  ev.last_review_at
from orgs o
left join access_findings af on af.organization_id = o.organization_id
left join sensitive_roles sr on sr.organization_id = o.organization_id
left join retention rt on rt.organization_id = o.organization_id
left join events ev on ev.organization_id = o.organization_id;

-- =========================
-- RLS
-- =========================

alter table security_review_events enable row level security;
alter table data_retention_rules enable row level security;
alter table access_review_cycles enable row level security;

drop policy if exists security_review_events_read on security_review_events;
create policy security_review_events_read on security_review_events
for select using (
  public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'executive')
  or public.has_role(auth.uid(), 'governance_admin')
  or public.has_role(auth.uid(), 'auditor')
);

drop policy if exists security_review_events_insert on security_review_events;
create policy security_review_events_insert on security_review_events
for insert with check (
  public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'governance_admin')
  or public.has_role(auth.uid(), 'auditor')
);

drop policy if exists security_review_events_update on security_review_events;
create policy security_review_events_update on security_review_events
for update using (
  public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'governance_admin')
) with check (
  public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'governance_admin')
);

drop policy if exists data_retention_rules_read on data_retention_rules;
create policy data_retention_rules_read on data_retention_rules
for select using (
  public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'executive')
  or public.has_role(auth.uid(), 'governance_admin')
  or public.has_role(auth.uid(), 'auditor')
);

drop policy if exists data_retention_rules_write on data_retention_rules;
create policy data_retention_rules_write on data_retention_rules
for all using (
  public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'governance_admin')
) with check (
  public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'governance_admin')
);

drop policy if exists access_review_cycles_read on access_review_cycles;
create policy access_review_cycles_read on access_review_cycles
for select using (
  public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'executive')
  or public.has_role(auth.uid(), 'governance_admin')
  or public.has_role(auth.uid(), 'auditor')
  or reviewer_id = auth.uid()
);

drop policy if exists access_review_cycles_write on access_review_cycles;
create policy access_review_cycles_write on access_review_cycles
for all using (
  public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'governance_admin')
) with check (
  public.has_role(auth.uid(), 'super_admin')
  or public.has_role(auth.uid(), 'governance_admin')
);
