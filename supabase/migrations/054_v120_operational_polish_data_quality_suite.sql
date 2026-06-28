-- =========================================================
-- GRC Control Center - v12.0
-- Operational Polish + Data Quality Command Suite
--
-- Purpose:
-- - Add a safe, additive operational polish layer around the v10/v11 GRC foundation.
-- - Improve program usability through workspace/module health, saved views, dashboard tiles,
--   data-quality checks, workflow SLA monitoring, feedback/backlog, help/glossary,
--   release readiness, executive narratives, decision logs, and adoption metrics.
-- - Avoid hard dependencies on optional enterprise tables so this migration can apply after
--   v11.0.1 and in local Docker environments with older schema drift.
--
-- Safety:
-- - References only core stable tables: organizations, profiles, departments.
-- - Avoids hard references to optional/nonexistent evidence tables.
-- - Enables RLS on all v12.0 tables.
-- - Grants authenticated users select/insert/update only; no delete grant is introduced.
-- - Views are security_invoker.
-- - No patient identifiers or confidential OVR fields are required or introduced.
-- =========================================================

-- -------------------------
-- Enum guards
-- -------------------------
do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v120_record_status') then
    create type public.v120_record_status as enum ('draft','active','under_review','approved','closed','archived');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v120_health') then
    create type public.v120_health as enum ('excellent','good','watch','attention','critical','unknown');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v120_feedback_status') then
    create type public.v120_feedback_status as enum ('new','triaged','planned','in_progress','resolved','deferred','closed');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'v120_sla_status') then
    create type public.v120_sla_status as enum ('within_sla','warning','breached','paused','not_applicable');
  end if;
end $$;

-- -------------------------
-- Workspace and navigation polish
-- -------------------------
create table if not exists public.v120_program_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_key text not null,
  display_name text not null,
  display_name_ar text,
  purpose text,
  owner_id uuid references public.profiles(id) on delete set null,
  sponsor_id uuid references public.profiles(id) on delete set null,
  health public.v120_health not null default 'unknown',
  status public.v120_record_status not null default 'active',
  sort_order integer not null default 100,
  accent_key text not null default 'neutral',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, workspace_key)
);

create table if not exists public.v120_workspace_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.v120_program_workspaces(id) on delete cascade,
  module_key text not null,
  module_name text not null,
  module_name_ar text,
  module_group text not null default 'governance',
  route_path text,
  icon_key text,
  health public.v120_health not null default 'unknown',
  maturity_score numeric(5,2) check (maturity_score is null or maturity_score between 0 and 100),
  is_enabled boolean not null default true,
  is_pilot_ready boolean not null default false,
  polish_notes text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_key)
);

create table if not exists public.v120_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  module_key text not null,
  view_name text not null,
  filters jsonb not null default '{}'::jsonb,
  columns jsonb not null default '[]'::jsonb,
  sort_model jsonb not null default '[]'::jsonb,
  density text not null default 'comfortable' check (density in ('compact','comfortable','spacious')),
  is_default boolean not null default false,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id, module_key, view_name)
);

create table if not exists public.v120_dashboard_tiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.v120_program_workspaces(id) on delete cascade,
  tile_key text not null,
  title text not null,
  title_ar text,
  metric_key text,
  metric_source text not null default 'manual_or_view',
  visualization text not null default 'stat' check (visualization in ('stat','trend','bar','donut','table','narrative','calendar')),
  target_route text,
  display_order integer not null default 100,
  health public.v120_health not null default 'unknown',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tile_key)
);

-- -------------------------
-- Data quality and SLA monitoring
-- -------------------------
create table if not exists public.v120_data_quality_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_key text not null,
  module_key text not null,
  table_name text not null,
  field_name text,
  rule_type text not null default 'completeness' check (rule_type in ('completeness','validity','consistency','timeliness','uniqueness','approval','security','workflow')),
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  owner_id uuid references public.profiles(id) on delete set null,
  check_frequency text not null default 'weekly' check (check_frequency in ('daily','weekly','monthly','quarterly','on_demand')),
  is_active boolean not null default true,
  description text,
  remediation_guidance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rule_key)
);

create table if not exists public.v120_data_quality_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid references public.v120_data_quality_rules(id) on delete set null,
  source_table text not null,
  source_record_id uuid,
  title text not null,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  status public.v120_feedback_status not null default 'new',
  detected_at timestamptz not null default now(),
  due_date date,
  assigned_to uuid references public.profiles(id) on delete set null,
  remediation_note text,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v120_workflow_sla_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null,
  process_name text not null,
  status_from text,
  status_to text,
  max_hours integer not null check (max_hours between 1 and 8760),
  warning_hours integer check (warning_hours is null or warning_hours between 1 and 8760),
  escalation_role text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v120_workflow_sla_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sla_policy_id uuid references public.v120_workflow_sla_policies(id) on delete set null,
  source_table text not null,
  source_record_id uuid,
  owner_id uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  warning_at timestamptz,
  closed_at timestamptz,
  status public.v120_sla_status not null default 'within_sla',
  escalation_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------
-- Feedback, polish backlog, help, glossary
-- -------------------------
create table if not exists public.v120_user_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  module_key text not null default 'general',
  title text not null,
  description text,
  impact text not null default 'medium' check (impact in ('critical','high','medium','low')),
  status public.v120_feedback_status not null default 'new',
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  related_route text,
  screenshot_reference text,
  assigned_to uuid references public.profiles(id) on delete set null,
  target_release text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v120_polish_backlog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'ux' check (category in ('ux','copy','arabic_rtl','performance','workflow','accessibility','data_quality','reporting','security','training')),
  module_key text not null default 'general',
  source_feedback_id uuid references public.v120_user_feedback(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  status public.v120_feedback_status not null default 'planned',
  target_release text,
  acceptance_criteria text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v120_help_articles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  article_key text not null,
  title text not null,
  title_ar text,
  module_key text not null default 'general',
  audience_role text not null default 'all',
  content_md text not null default '',
  content_ar_md text,
  status public.v120_record_status not null default 'draft',
  owner_id uuid references public.profiles(id) on delete set null,
  review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, article_key)
);

create table if not exists public.v120_glossary_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  term_key text not null,
  term_en text not null,
  term_ar text,
  definition text not null,
  definition_ar text,
  module_key text not null default 'general',
  owner_id uuid references public.profiles(id) on delete set null,
  status public.v120_record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, term_key)
);

-- -------------------------
-- Release readiness, executive narrative, decision log, adoption
-- -------------------------
create table if not exists public.v120_release_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  release_key text not null,
  check_key text not null,
  check_name text not null,
  area text not null default 'general',
  status public.v120_record_status not null default 'draft',
  health public.v120_health not null default 'unknown',
  evidence_reference text,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, release_key, check_key)
);

create table if not exists public.v120_executive_narratives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_period_start date not null,
  report_period_end date not null,
  narrative_type text not null default 'monthly' check (narrative_type in ('daily','weekly','monthly','quarterly','board','incident','pilot')),
  headline text not null,
  headline_ar text,
  summary_md text not null default '',
  summary_ar_md text,
  health public.v120_health not null default 'unknown',
  prepared_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v120_action_decision_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  decision_key text,
  meeting_date date not null default current_date,
  title text not null,
  decision text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status public.v120_record_status not null default 'active',
  linked_source_type text,
  linked_source_id uuid,
  board_visibility boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, decision_key)
);

create table if not exists public.v120_adoption_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null,
  measurement_date date not null default current_date,
  active_users integer not null default 0 check (active_users >= 0),
  records_created integer not null default 0 check (records_created >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  overdue_items integer not null default 0 check (overdue_items >= 0),
  satisfaction_score numeric(5,2) check (satisfaction_score is null or satisfaction_score between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_key, measurement_date)
);

-- -------------------------
-- Indexes
-- -------------------------
create index if not exists idx_v120_workspaces_org_status on public.v120_program_workspaces(organization_id, status, health);
create index if not exists idx_v120_modules_org_group on public.v120_workspace_modules(organization_id, module_group, is_enabled, health);
create index if not exists idx_v120_saved_views_profile on public.v120_saved_views(profile_id, module_key, is_default);
create index if not exists idx_v120_tiles_workspace on public.v120_dashboard_tiles(workspace_id, display_order);
create index if not exists idx_v120_dq_rules_org_module on public.v120_data_quality_rules(organization_id, module_key, is_active);
create index if not exists idx_v120_dq_findings_org_status on public.v120_data_quality_findings(organization_id, status, severity, due_date);
create index if not exists idx_v120_sla_policies_org_module on public.v120_workflow_sla_policies(organization_id, module_key, is_active);
create unique index if not exists uq_v120_sla_policies_key on public.v120_workflow_sla_policies (organization_id, module_key, process_name, coalesce(status_from,''), coalesce(status_to,''));
create index if not exists idx_v120_sla_events_org_status on public.v120_workflow_sla_events(organization_id, status, due_at);
create index if not exists idx_v120_feedback_org_status on public.v120_user_feedback(organization_id, status, priority);
create index if not exists idx_v120_polish_org_status on public.v120_polish_backlog(organization_id, status, priority);
create index if not exists idx_v120_help_org_module on public.v120_help_articles(organization_id, module_key, status);
create index if not exists idx_v120_glossary_org_module on public.v120_glossary_terms(organization_id, module_key, status);
create index if not exists idx_v120_readiness_org_release on public.v120_release_readiness_checks(organization_id, release_key, status, health);
create index if not exists idx_v120_narratives_org_period on public.v120_executive_narratives(organization_id, report_period_start, report_period_end);
create index if not exists idx_v120_decisions_org_due on public.v120_action_decision_log(organization_id, status, due_date);
create index if not exists idx_v120_adoption_org_date on public.v120_adoption_metrics(organization_id, measurement_date, module_key);

-- -------------------------
-- Initial safe seed: only organization-level configuration, no confidential data
-- -------------------------
insert into public.v120_program_workspaces (organization_id, workspace_key, display_name, display_name_ar, purpose, health, status, sort_order, accent_key, metadata)
select o.id, seed.workspace_key, seed.display_name, seed.display_name_ar, seed.purpose, seed.health::public.v120_health, 'active'::public.v120_record_status, seed.sort_order, seed.accent_key, seed.metadata::jsonb
from public.organizations o
cross join (values
  ('quality-command','Quality & OVR Command','مركز قيادة الجودة وبلاغات OVR','Manage OVR, Quality review, CAPA linkage, SLA, and closure quality.','good',10,'gold','{"pilot_scope":"quality_ovr"}'),
  ('risk-control-assurance','Risk, Controls & Assurance','المخاطر والضوابط والتأكيد','Manage risk register, controls, testing, issues, and assurance evidence.','watch',20,'blue','{"pilot_scope":"grc_foundation"}'),
  ('enterprise-grc','Enterprise GRC Program','برنامج الحوكمة والمخاطر والالتزام المؤسسي','Manage policies, training, vendor risk, BCP, KRI, and board reporting.','watch',30,'purple','{"pilot_scope":"enterprise_grc"}')
) as seed(workspace_key, display_name, display_name_ar, purpose, health, sort_order, accent_key, metadata)
on conflict (organization_id, workspace_key) do nothing;

insert into public.v120_workspace_modules (organization_id, workspace_id, module_key, module_name, module_name_ar, module_group, route_path, icon_key, health, maturity_score, is_pilot_ready, sort_order, polish_notes)
select o.id, w.id, seed.module_key, seed.module_name, seed.module_name_ar, seed.module_group, seed.route_path, seed.icon_key, seed.health::public.v120_health, seed.maturity_score, seed.is_pilot_ready, seed.sort_order, seed.polish_notes
from public.organizations o
cross join (values
  ('quality-command','ovr-quality','OVR / Quality Workflow','بلاغات الجودة و OVR','quality','/ovr','shield-check','good',85,true,10,'Strong pilot workflow. Continue role/persona UAT and confidentiality guardrails.'),
  ('quality-command','capa-actions','CAPA / Corrective Actions','الإجراءات التصحيحية CAPA','quality','/projects','check-circle','watch',70,true,20,'Keep strengthening source-to-action traceability.'),
  ('risk-control-assurance','risk-register','Risk Register','سجل المخاطر','risk','/risks','alert-triangle','watch',70,true,10,'Use v10 fields for lifecycle, appetite, KRIs, owner and review dates.'),
  ('risk-control-assurance','control-library','Controls Library','مكتبة الضوابط','controls','/governance','sliders','watch',65,true,20,'Link every material risk to preventive/detective/corrective controls.'),
  ('risk-control-assurance','control-testing','Control Testing','اختبار الضوابط','assurance','/audit','clipboard-check','attention',55,false,30,'Needs manual operating-effectiveness sampling before mature assurance.'),
  ('enterprise-grc','policy-control','Policy & Document Control','السياسات والوثائق','policy','/policies','file-text','watch',60,false,10,'v11 data layer exists; UI workflow should be staged after UAT.'),
  ('enterprise-grc','vendor-risk','Third-Party Risk','مخاطر الموردين','vendor','/compliance','briefcase','attention',45,false,20,'Later-phase module; keep synthetic until owner/process agreed.'),
  ('enterprise-grc','bcp-resilience','BCP / Resilience','استمرارية الأعمال والمرونة','resilience','/compliance','activity','attention',45,false,30,'Later-phase module; needs BIA ownership and drill evidence.')
) as seed(seed_workspace_key, module_key, module_name, module_name_ar, module_group, route_path, icon_key, health, maturity_score, is_pilot_ready, sort_order, polish_notes)
join public.v120_program_workspaces w on w.organization_id = o.id and w.workspace_key = seed.seed_workspace_key
on conflict (organization_id, module_key) do nothing;

insert into public.v120_dashboard_tiles (organization_id, workspace_id, tile_key, title, title_ar, metric_key, metric_source, visualization, target_route, display_order, health, config)
select w.organization_id, w.id, seed.tile_key, seed.title, seed.title_ar, seed.metric_key, seed.metric_source, seed.visualization, seed.target_route, seed.display_order, seed.health::public.v120_health, seed.config::jsonb
from public.v120_program_workspaces w
cross join lateral (values
  ('manual-approvals-gate','Manual approval gate','بوابة الاعتمادات اليدوية','v66_gate','release/v700/proof-suite-all.json','stat','/approvals',10,'attention','{"expected_blocker":"v66:strict-proof"}'),
  ('pilot-uat-coverage','Pilot UAT coverage','تغطية اختبار UAT','uat_coverage','release/v99/uat-user-matrix.md','stat','/testing',20,'good','{"users":30,"departments":9}'),
  ('data-quality-open','Open data-quality findings','ملاحظات جودة البيانات المفتوحة','dq_open','v120_data_quality_findings','table','/analytics',30,'unknown','{}'),
  ('workflow-sla-watch','Workflow SLA watch','متابعة اتفاقيات مستوى الخدمة','sla_watch','v120_workflow_sla_events','trend','/escalations',40,'unknown','{}')
) as seed(tile_key, title, title_ar, metric_key, metric_source, visualization, target_route, display_order, health, config)
where w.workspace_key in ('quality-command','risk-control-assurance','enterprise-grc')
on conflict (organization_id, tile_key) do nothing;

insert into public.v120_data_quality_rules (organization_id, rule_key, module_key, table_name, field_name, rule_type, severity, description, remediation_guidance)
select o.id, seed.rule_key, seed.module_key, seed.table_name, seed.field_name, seed.rule_type, seed.severity, seed.description, seed.remediation_guidance
from public.organizations o
cross join (values
  ('risk-owner-required','risk-register','risks','owner_id','completeness','high','Every active risk should have an accountable owner.','Assign an owner before UAT signoff.'),
  ('control-owner-required','control-library','risk_controls','owner_id','completeness','high','Every active control should have a control owner.','Assign a control owner and review frequency.'),
  ('capa-due-date-required','capa-actions','projects','target_end_date','timeliness','medium','CAPA/action projects should have due dates.','Add target end date and escalation owner.'),
  ('policy-review-date-required','policy-control','v110_policy_documents','next_review_date','timeliness','medium','Published policies should have a next review date.','Add policy review cycle before broad rollout.'),
  ('pilot-approval-scope-required','approvals','pilot-signoff','scope','approval','critical','Controlled pilot approvals must state scope and max users.','Fill real Management/Admin, IT, and Quality approval files.')
) as seed(rule_key, module_key, table_name, field_name, rule_type, severity, description, remediation_guidance)
on conflict (organization_id, rule_key) do nothing;

insert into public.v120_workflow_sla_policies (organization_id, module_key, process_name, status_from, status_to, max_hours, warning_hours, escalation_role)
select o.id, seed.module_key, seed.process_name, seed.status_from, seed.status_to, seed.max_hours, seed.warning_hours, seed.escalation_role
from public.organizations o
cross join (values
  ('ovr-quality','OVR manager first review','submitted','manager_review',24,18,'department_manager'),
  ('ovr-quality','Quality validation','manager_review','quality_validation',48,36,'compliance_officer'),
  ('capa-actions','CAPA owner update','active','at_risk',168,120,'project_owner'),
  ('control-testing','Control test review','submitted','approved',120,96,'auditor')
) as seed(module_key, process_name, status_from, status_to, max_hours, warning_hours, escalation_role)
where not exists (
  select 1
  from public.v120_workflow_sla_policies existing
  where existing.organization_id = o.id
    and existing.module_key = seed.module_key
    and existing.process_name = seed.process_name
    and coalesce(existing.status_from, '') = coalesce(seed.status_from, '')
    and coalesce(existing.status_to, '') = coalesce(seed.status_to, '')
);

insert into public.v120_glossary_terms (organization_id, term_key, term_en, term_ar, definition, definition_ar, module_key, status)
select o.id, seed.term_key, seed.term_en, seed.term_ar, seed.definition, seed.definition_ar, seed.module_key, 'active'::public.v120_record_status
from public.organizations o
cross join (values
  ('capa','CAPA','الإجراءات التصحيحية والوقائية','Corrective and preventive action used to fix root causes and prevent recurrence.','إجراء تصحيحي ووقائي لمعالجة السبب الجذري ومنع تكرار المشكلة.','capa-actions'),
  ('inherent-risk','Inherent Risk','المخاطر الكامنة','Risk level before considering existing controls.','مستوى الخطر قبل احتساب أثر الضوابط القائمة.','risk-register'),
  ('residual-risk','Residual Risk','المخاطر المتبقية','Risk level after considering existing controls and treatment.','مستوى الخطر بعد احتساب الضوابط والمعالجة.','risk-register'),
  ('operating-effectiveness','Operating Effectiveness','فاعلية التشغيل','Evidence that a control operated as designed during the period.','دليل على أن الضابط عمل حسب التصميم خلال الفترة.','control-testing'),
  ('risk-appetite','Risk Appetite','شهية المخاطر','The level of risk the organization is willing to accept.','مستوى المخاطر الذي تقبله المنشأة ضمن حدود محددة.','risk-register')
) as seed(term_key, term_en, term_ar, definition, definition_ar, module_key)
on conflict (organization_id, term_key) do nothing;

insert into public.v120_release_readiness_checks (organization_id, release_key, check_key, check_name, area, status, health, evidence_reference, notes)
select o.id, 'v12.0', seed.check_key, seed.check_name, seed.area, seed.status::public.v120_record_status, seed.health::public.v120_health, seed.evidence_reference, seed.notes
from public.organizations o
cross join (values
  ('static-proof','v12 static polish proof','technical','approved','good','release/v120/v120-polish-static-audit.json','Patch static validation should pass before migration apply.'),
  ('migration-apply','Local Docker migration apply','database','under_review','watch','supabase/migrations/054_v120_operational_polish_data_quality_suite.sql','Apply with Supabase CLI after v11.0.1 hotfix.'),
  ('uat-persona','Persona UAT smoke','uat','under_review','watch','release/v99/uat-user-matrix.md','Confirm representative users see correct modules and no external leakage.'),
  ('manual-approval','v66 human approval gate','governance','draft','attention','release/v674/approvals','Real approvals are still required before light production.')
) as seed(check_key, check_name, area, status, health, evidence_reference, notes)
on conflict (organization_id, release_key, check_key) do nothing;

-- -------------------------
-- Views for dashboards / reporting
-- -------------------------
create or replace view public.v120_workspace_health_summary
with (security_invoker = true)
as
select
  w.organization_id,
  w.id as workspace_id,
  w.workspace_key,
  w.display_name,
  w.display_name_ar,
  w.health,
  w.status,
  count(m.id)::integer as module_count,
  count(m.id) filter (where m.is_pilot_ready)::integer as pilot_ready_modules,
  count(m.id) filter (where m.health in ('attention','critical'))::integer as modules_needing_attention,
  round(avg(m.maturity_score), 2) as average_maturity_score,
  max(w.updated_at) as last_workspace_update
from public.v120_program_workspaces w
left join public.v120_workspace_modules m on m.workspace_id = w.id and m.organization_id = w.organization_id
group by w.organization_id, w.id, w.workspace_key, w.display_name, w.display_name_ar, w.health, w.status;

create or replace view public.v120_data_quality_board
with (security_invoker = true)
as
select
  r.organization_id,
  r.module_key,
  count(f.id)::integer as findings_total,
  count(f.id) filter (where f.status in ('new','triaged','planned','in_progress'))::integer as findings_open,
  count(f.id) filter (where f.severity = 'critical')::integer as critical_findings,
  count(f.id) filter (where f.severity = 'high')::integer as high_findings,
  count(f.id) filter (where f.due_date is not null and f.due_date < current_date and f.status not in ('resolved','closed'))::integer as overdue_findings,
  max(f.detected_at) as last_detected_at
from public.v120_data_quality_rules r
left join public.v120_data_quality_findings f on f.rule_id = r.id and f.organization_id = r.organization_id
where r.is_active = true
group by r.organization_id, r.module_key;

create or replace view public.v120_polish_backlog_board
with (security_invoker = true)
as
select
  organization_id,
  module_key,
  category,
  count(*)::integer as item_count,
  count(*) filter (where status in ('new','triaged','planned','in_progress'))::integer as open_count,
  count(*) filter (where priority in ('critical','high'))::integer as high_priority_count,
  count(*) filter (where status = 'resolved')::integer as resolved_count,
  max(updated_at) as last_update
from public.v120_polish_backlog
group by organization_id, module_key, category;

create or replace view public.v120_executive_readiness_overview
with (security_invoker = true)
as
select
  o.id as organization_id,
  count(rc.id) filter (where rc.release_key = 'v12.0')::integer as v120_checks_total,
  count(rc.id) filter (where rc.release_key = 'v12.0' and rc.health in ('excellent','good'))::integer as checks_good,
  count(rc.id) filter (where rc.release_key = 'v12.0' and rc.health in ('attention','critical'))::integer as checks_attention,
  count(dq.id) filter (where dq.status not in ('resolved','closed'))::integer as open_data_quality_findings,
  count(pb.id) filter (where pb.status not in ('resolved','closed'))::integer as open_polish_items,
  count(sla.id) filter (where sla.status = 'breached')::integer as breached_sla_events,
  max(greatest(coalesce(rc.updated_at, 'epoch'::timestamptz), coalesce(dq.updated_at, 'epoch'::timestamptz), coalesce(pb.updated_at, 'epoch'::timestamptz), coalesce(sla.updated_at, 'epoch'::timestamptz))) as last_activity
from public.organizations o
left join public.v120_release_readiness_checks rc on rc.organization_id = o.id
left join public.v120_data_quality_findings dq on dq.organization_id = o.id
left join public.v120_polish_backlog pb on pb.organization_id = o.id
left join public.v120_workflow_sla_events sla on sla.organization_id = o.id
group by o.id;

create or replace view public.v120_due_diligence_calendar
with (security_invoker = true)
as
select organization_id, 'release_check'::text as item_type, check_key as item_key, check_name as title, due_date, health::text as health, status::text as status, owner_id
from public.v120_release_readiness_checks
where due_date is not null
union all
select organization_id, 'data_quality_finding'::text, coalesce(source_table,'finding') || ':' || id::text, title, due_date, severity, status::text, assigned_to
from public.v120_data_quality_findings
where due_date is not null
union all
select organization_id, 'decision_action'::text, coalesce(decision_key, id::text), title, due_date, 'unknown', status::text, owner_id
from public.v120_action_decision_log
where due_date is not null;

-- -------------------------
-- RLS + grants
-- -------------------------
do $$
declare
  tbl text;
  policy_name text;
  org_select text;
  org_manage text;
begin
  foreach tbl in array array[
    'v120_program_workspaces',
    'v120_workspace_modules',
    'v120_saved_views',
    'v120_dashboard_tiles',
    'v120_data_quality_rules',
    'v120_data_quality_findings',
    'v120_workflow_sla_policies',
    'v120_workflow_sla_events',
    'v120_user_feedback',
    'v120_polish_backlog',
    'v120_help_articles',
    'v120_glossary_terms',
    'v120_release_readiness_checks',
    'v120_executive_narratives',
    'v120_action_decision_log',
    'v120_adoption_metrics'
  ] loop
    org_select := format('exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true and p.organization_id = %I.organization_id)', tbl);
    org_manage := format('exists (select 1 from public.profiles p join public.user_roles ur on ur.user_id = p.id where p.id = auth.uid() and p.organization_id = %I.organization_id and p.is_active = true and ur.is_active = true and ur.role::text in (''super_admin'',''governance_admin'',''compliance_officer'',''auditor'',''executive'',''department_manager''))', tbl);

    execute format('alter table public.%I enable row level security', tbl);

    policy_name := tbl || '_org_select';
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tbl and policyname = policy_name) then
      execute format('create policy %I on public.%I for select to authenticated using (%s)', policy_name, tbl, org_select);
    end if;

    policy_name := tbl || '_org_insert';
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tbl and policyname = policy_name) then
      execute format('create policy %I on public.%I for insert to authenticated with check (%s)', policy_name, tbl, org_manage);
    end if;

    policy_name := tbl || '_org_update';
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tbl and policyname = policy_name) then
      execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', policy_name, tbl, org_manage, org_manage);
    end if;

    execute format('grant select, insert, update on public.%I to authenticated', tbl);
  end loop;
end $$;

grant select on public.v120_workspace_health_summary to authenticated;
grant select on public.v120_data_quality_board to authenticated;
grant select on public.v120_polish_backlog_board to authenticated;
grant select on public.v120_executive_readiness_overview to authenticated;
grant select on public.v120_due_diligence_calendar to authenticated;

-- No delete grants are intentionally added.
