-- =========================================================
-- GRC Control Center - Migration 021
-- Executive Command Center, Global Search, Document Center,
-- Cross-Module Relationship Map and Release Candidate Controls
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================
do $$ begin
  create type grc_document_type as enum (
    'policy',
    'procedure',
    'form',
    'authority_matrix',
    'committee_charter',
    'signed_approval',
    'license_certificate',
    'contract',
    'report',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type release_gate_status as enum ('pass', 'warning', 'blocked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type release_gate_severity as enum ('pass', 'warning', 'blocker');
exception when duplicate_object then null;
end $$;

-- =========================
-- DOCUMENT CENTER
-- =========================
create table if not exists document_center_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  document_code text,
  title text not null,
  description text,
  document_type grc_document_type not null default 'other',
  category text not null default 'general',
  division_id uuid references divisions(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  owner_id uuid references profiles(id) on delete set null,
  version text not null default '1.0',
  status policy_status not null default 'draft',
  risk_level risk_level not null default 'medium',
  review_due_date date,
  expiry_date date,
  file_name text,
  file_path text,
  linked_entity_table text,
  linked_entity_id uuid,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, document_code, version)
);

drop trigger if exists trg_document_center_items_updated_at on document_center_items;
create trigger trg_document_center_items_updated_at
before update on document_center_items
for each row execute function set_updated_at();

create index if not exists idx_document_center_org on document_center_items(organization_id);
create index if not exists idx_document_center_type on document_center_items(document_type);
create index if not exists idx_document_center_department on document_center_items(department_id);
create index if not exists idx_document_center_owner on document_center_items(owner_id);
create index if not exists idx_document_center_status on document_center_items(status);
create index if not exists idx_document_center_review_due on document_center_items(review_due_date);
create index if not exists idx_document_center_expiry on document_center_items(expiry_date);

-- =========================
-- RELEASE CANDIDATE GATES
-- =========================
create table if not exists release_candidate_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  gate_area text not null,
  gate_name text not null,
  severity release_gate_severity not null default 'warning',
  status release_gate_status not null default 'warning',
  owner text,
  owner_id uuid references profiles(id) on delete set null,
  evidence_required boolean not null default true,
  evidence_reference text,
  notes text,
  target_date date,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_release_candidate_gates_updated_at on release_candidate_gates;
create trigger trg_release_candidate_gates_updated_at
before update on release_candidate_gates
for each row execute function set_updated_at();

create index if not exists idx_release_candidate_gates_org on release_candidate_gates(organization_id);
create index if not exists idx_release_candidate_gates_status on release_candidate_gates(status);
create index if not exists idx_release_candidate_gates_severity on release_candidate_gates(severity);

-- =========================
-- MIGRATION ORDER REFERENCE
-- =========================
create table if not exists release_migration_order (
  id uuid primary key default gen_random_uuid(),
  version_label text not null,
  migration_file text not null unique,
  sequence_no integer not null unique,
  purpose text not null,
  required boolean not null default true,
  created_at timestamptz not null default now()
);

insert into release_migration_order (version_label, migration_file, sequence_no, purpose, required)
values
('v0.1', '001_core_foundation.sql', 1, 'Core organization, users, roles, projects, milestones, tasks, evidence, approvals and audit logs', true),
('v0.2', '002_grc_layer.sql', 2, 'Risk, controls, compliance, audit findings, policies, authority matrix and committees', true),
('v0.3', '003_rls_permissions_and_controls.sql', 3, 'Baseline RLS and permission helper policies', true),
('v0.4', '004_seed_reference_data.sql', 4, 'Reference and demo seed data', true),
('v0.5', '005_operational_views_and_storage.sql', 5, 'Operational views and storage buckets', true),
('v0.6', '006_workflow_queues_and_project_controls.sql', 6, 'Workflow queues and project progress controls', true),
('v0.7', '007_escalation_and_governance_controls.sql', 7, 'Escalation events and governance controls', true),
('v0.8', '008_import_export_rollout_tools.sql', 8, 'Import/export rollout tools and staging tables', true),
('v0.9', '009_access_control_and_role_governance.sql', 9, 'Access control and role governance', true),
('v1.0', '010_bilingual_and_ovr_module.sql', 10, 'Bilingual foundation and OVR module', true),
('v1.1', '011_ovr_risk_indicators.sql', 11, 'OVR risk indicators and department safety signals', true),
('v1.2a', '012a_ovr_workflow_enum_values.sql', 12, 'OVR workflow enum values', true),
('v1.2b', '012b_ovr_workflow_controls.sql', 13, 'OVR workflow controls and closure safeguards', true),
('v1.3', '013_kpi_analytics_heatmap_radar.sql', 14, 'KPI analytics, heatmaps and radar dashboard views', true),
('v1.4', '014_export_center_backups_custom_reports.sql', 15, 'Export center, backup packages and custom reports', true),
('v1.5', '015_production_hardening_health_print_controls.sql', 16, 'Production hardening, health checks and print controls', true),
('v1.6', '016_rollout_onboarding_user_guides.sql', 17, 'Rollout setup and user guides', true),
('v1.7', '017_notifications_activity_timelines.sql', 18, 'Notifications, reminders and activity timelines', true),
('v1.8', '018_qa_permission_deployment_readiness.sql', 19, 'QA, permission tests and deployment readiness', true),
('v1.8.1', '019_performance_responsive_usability.sql', 20, 'Performance and responsive usability monitoring', true),
('v1.8.2', '020_security_audit_retention_controls.sql', 21, 'Security, audit and retention controls', true),
('v1.9', '021_command_search_documents_release.sql', 22, 'Command Center, global search, document center and release candidate readiness', true)
on conflict (migration_file) do update
set version_label = excluded.version_label,
    sequence_no = excluded.sequence_no,
    purpose = excluded.purpose,
    required = excluded.required;

-- =========================
-- SEED RELEASE GATES
-- =========================
insert into release_candidate_gates (organization_id, gate_area, gate_name, severity, status, owner, evidence_required, notes)
select id, 'Database', 'All migrations applied in order', 'blocker', 'warning', 'System Admin', true, 'Confirm all required migrations are applied from 001 through 021.' from organizations
on conflict do nothing;

insert into release_candidate_gates (organization_id, gate_area, gate_name, severity, status, owner, evidence_required, notes)
select id, 'Access', 'Sensitive global roles reviewed', 'blocker', 'blocked', 'Governance Admin', true, 'Resolve broad-scope access findings before opening the platform to all employees.' from organizations
on conflict do nothing;

insert into release_candidate_gates (organization_id, gate_area, gate_name, severity, status, owner, evidence_required, notes)
select id, 'Backup', 'Export package and restore dry-run documented', 'blocker', 'warning', 'IT / Governance', true, 'Create an external backup package and record restore dry-run before mass import.' from organizations
on conflict do nothing;

insert into release_candidate_gates (organization_id, gate_area, gate_name, severity, status, owner, evidence_required, notes)
select id, 'OVR', 'Quality workflow tested end-to-end', 'warning', 'warning', 'Quality Manager', true, 'Test submit, supervisor review, quality return, evidence and closure.' from organizations
on conflict do nothing;

-- =========================
-- DOCUMENT CENTER VIEWS
-- =========================
create or replace view v_document_center_items as
select
  d.id,
  d.organization_id,
  d.document_code,
  d.title,
  d.document_type::text as document_type,
  d.category,
  d.version,
  d.status::text as status,
  d.risk_level::text as risk_level,
  d.review_due_date,
  d.expiry_date,
  d.file_name,
  d.file_path,
  coalesce(dep.name_en, 'Company-wide') as department_name,
  coalesce(owner.full_name_en, d.owner_id::text, 'Unassigned') as owner_name,
  d.updated_at
from document_center_items d
left join departments dep on dep.id = d.department_id
left join profiles owner on owner.id = d.owner_id
union all
select
  p.id,
  p.organization_id,
  p.policy_code as document_code,
  p.title,
  'policy' as document_type,
  p.category,
  p.version,
  p.status::text as status,
  'medium' as risk_level,
  p.review_due_date,
  p.expiry_date,
  p.file_name,
  p.file_path,
  coalesce(dep.name_en, 'Company-wide') as department_name,
  coalesce(owner.full_name_en, p.owner_id::text, 'Unassigned') as owner_name,
  p.updated_at
from policies p
left join departments dep on dep.id = p.department_id
left join profiles owner on owner.id = p.owner_id;

create or replace view v_document_center_summary as
select
  o.id as organization_id,
  count(v.*) as total_documents,
  count(*) filter (where v.status in ('active', 'approved')) as active_documents,
  count(*) filter (where v.review_due_date <= current_date + interval '30 days' and v.status not in ('archived', 'cancelled')) as review_due_30_days,
  count(*) filter (where v.expiry_date is not null and v.expiry_date < current_date and v.status not in ('archived', 'cancelled')) as expired_documents,
  count(*) filter (where v.owner_name = 'Unassigned') as missing_owner,
  count(*) filter (where v.file_name is null and v.file_path is null) as missing_file
from organizations o
left join v_document_center_items v on v.organization_id = o.id
group by o.id;

-- =========================
-- GLOBAL SEARCH INDEX
-- =========================
create or replace view v_global_search_index as
select
  p.id::text as id,
  'projects' as source_table,
  'Action plan' as source_type,
  p.title,
  coalesce(p.description, '') as subtitle,
  coalesce(dep.name_en, 'Company-wide') as department_name,
  coalesce(owner.full_name_en, 'Unassigned') as owner_name,
  p.status::text as status,
  p.risk_level::text as risk_level,
  concat_ws(' ', p.title, p.description, p.category, dep.name_en, owner.full_name_en, p.status::text, p.risk_level::text) as search_text,
  '/projects' as action_path,
  p.updated_at
from projects p
left join departments dep on dep.id = p.department_id
left join profiles owner on owner.id = p.owner_id
union all
select
  r.id::text,
  'risks',
  'Risk',
  r.title,
  coalesce(r.description, ''),
  coalesce(dep.name_en, 'Company-wide'),
  coalesce(owner.full_name_en, 'Unassigned'),
  r.status::text,
  r.risk_level::text,
  concat_ws(' ', r.risk_code, r.title, r.description, r.category::text, dep.name_en, owner.full_name_en, r.status::text, r.risk_level::text),
  '/risks',
  r.updated_at
from risks r
left join departments dep on dep.id = r.department_id
left join profiles owner on owner.id = r.owner_id
union all
select
  c.id::text,
  'compliance_items',
  'Compliance',
  c.title,
  coalesce(c.description, ''),
  coalesce(dep.name_en, 'Company-wide'),
  coalesce(owner.full_name_en, 'Unassigned'),
  c.status::text,
  c.risk_level::text,
  concat_ws(' ', c.compliance_code, c.title, c.description, c.regulatory_body, dep.name_en, owner.full_name_en, c.status::text, c.risk_level::text),
  '/compliance',
  c.updated_at
from compliance_items c
left join departments dep on dep.id = c.department_id
left join profiles owner on owner.id = c.owner_id
union all
select
  af.id::text,
  'audit_findings',
  'Audit finding',
  af.title,
  coalesce(af.description, ''),
  coalesce(dep.name_en, 'Company-wide'),
  coalesce(owner.full_name_en, 'Unassigned'),
  af.status::text,
  af.risk_level::text,
  concat_ws(' ', af.finding_code, af.audit_title, af.title, af.description, af.root_cause, af.recommendation, dep.name_en, owner.full_name_en, af.status::text, af.risk_level::text),
  '/audit',
  af.updated_at
from audit_findings af
left join departments dep on dep.id = af.department_id
left join profiles owner on owner.id = af.owner_id
union all
select
  e.id::text,
  'evidence_files',
  'Evidence',
  e.file_name,
  coalesce(e.description, ''),
  'Evidence Center',
  coalesce(uploader.full_name_en, 'Unassigned'),
  e.status::text,
  'medium',
  concat_ws(' ', e.file_name, e.description, e.status::text, uploader.full_name_en),
  '/evidence',
  e.created_at
from evidence_files e
left join profiles uploader on uploader.id = e.uploaded_by
union all
select
  d.id::text,
  'documents',
  'Document',
  d.title,
  concat_ws(' ', d.document_type, d.version),
  d.department_name,
  d.owner_name,
  d.status,
  d.risk_level,
  concat_ws(' ', d.document_code, d.title, d.document_type, d.category, d.department_name, d.owner_name, d.status, d.risk_level),
  '/documents',
  d.updated_at
from v_document_center_items d;

create or replace function search_grc_global(p_query text, p_limit integer default 50)
returns table (
  id text,
  source_table text,
  source_type text,
  title text,
  subtitle text,
  department_name text,
  owner_name text,
  status text,
  risk_level text,
  search_text text,
  action_path text,
  updated_at timestamptz
)
language sql
stable
as $$
  select
    g.id,
    g.source_table,
    g.source_type,
    g.title,
    g.subtitle,
    g.department_name,
    g.owner_name,
    g.status,
    g.risk_level,
    g.search_text,
    g.action_path,
    g.updated_at
  from v_global_search_index g
  where p_query is not null
    and length(trim(p_query)) > 0
    and g.search_text ilike ('%' || trim(p_query) || '%')
  order by
    case when g.title ilike ('%' || trim(p_query) || '%') then 0 else 1 end,
    case g.risk_level when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
    g.updated_at desc nulls last
  limit coalesce(p_limit, 50);
$$;

-- =========================
-- EXECUTIVE COMMAND CENTER VIEWS
-- =========================
create or replace view v_executive_command_stream as
select
  ('project-' || p.id::text) as id,
  'Project' as item_type,
  p.title,
  coalesce(dep.name_en, 'Company-wide') as department_name,
  coalesce(owner.full_name_en, 'Unassigned') as owner_name,
  p.status::text as status,
  p.risk_level::text as risk_level,
  p.target_end_date as due_date,
  case
    when p.target_end_date < current_date then 'Project is overdue'
    when p.risk_level = 'critical' then 'Critical project requires executive monitoring'
    else 'High priority project requires attention'
  end as reason,
  '/projects' as action_path,
  case when p.risk_level = 'critical' then 1 else 5 end as sort_rank
from projects p
left join departments dep on dep.id = p.department_id
left join profiles owner on owner.id = p.owner_id
where p.status not in ('closed', 'cancelled')
  and (p.risk_level in ('critical', 'high') or p.target_end_date < current_date)
union all
select
  ('risk-' || r.id::text),
  'Risk',
  r.title,
  coalesce(dep.name_en, 'Company-wide'),
  coalesce(owner.full_name_en, 'Unassigned'),
  r.status::text,
  r.risk_level::text,
  r.next_review_date,
  case when r.next_review_date < current_date then 'Risk review is overdue' else 'Critical or high risk remains open' end,
  '/risks',
  case when r.risk_level = 'critical' then 2 else 6 end
from risks r
left join departments dep on dep.id = r.department_id
left join profiles owner on owner.id = r.owner_id
where r.status not in ('closed', 'cancelled')
  and r.risk_level in ('critical', 'high')
union all
select
  ('compliance-' || c.id::text),
  'Compliance',
  c.title,
  coalesce(dep.name_en, 'Company-wide'),
  coalesce(owner.full_name_en, 'Unassigned'),
  c.status::text,
  c.risk_level::text,
  coalesce(c.expiry_date, c.due_date),
  'Compliance item is expired, due soon or missing evidence',
  '/compliance',
  3
from compliance_items c
left join departments dep on dep.id = c.department_id
left join profiles owner on owner.id = c.owner_id
where c.status not in ('closed', 'cancelled')
  and (c.expiry_date <= current_date + interval '30 days' or c.due_date < current_date or c.risk_level in ('critical', 'high'))
union all
select
  ('audit-' || af.id::text),
  'Audit finding',
  af.title,
  coalesce(dep.name_en, 'Company-wide'),
  coalesce(owner.full_name_en, 'Unassigned'),
  af.status::text,
  af.risk_level::text,
  af.due_date,
  'Audit finding remains open or overdue',
  '/audit',
  4
from audit_findings af
left join departments dep on dep.id = af.department_id
left join profiles owner on owner.id = af.owner_id
where af.status not in ('closed', 'cancelled')
  and (af.due_date < current_date or af.risk_level in ('critical', 'high'));

create or replace view v_executive_command_summary as
select
  o.id as organization_id,
  (select count(*) from v_executive_command_stream s where s.risk_level in ('critical', 'high')) as critical_now,
  (select count(*) from approvals a where a.organization_id = o.id and a.status = 'pending') as pending_executive_decisions,
  (select count(*) from v_department_risk_heatmap h where h.organization_id = o.id and coalesce(h.overall_pressure_score, 0) >= 70) as department_pressure_count,
  (select count(*) from v_document_center_items d where d.organization_id = o.id and d.review_due_date <= current_date + interval '30 days') as policy_review_due_30_days,
  (select count(*) from v_global_search_index) as search_indexed_records,
  greatest(0, least(100,
    100
    - ((select count(*) from release_candidate_gates g where g.organization_id = o.id and g.status = 'blocked') * 25)
    - ((select count(*) from release_candidate_gates g where g.organization_id = o.id and g.status = 'warning') * 8)
  )) as release_readiness_score,
  case
    when exists (select 1 from v_backup_health_check b where b.organization_id = o.id and b.severity = 'critical') then 'critical'
    when exists (select 1 from v_backup_health_check b where b.organization_id = o.id and b.severity = 'warning') then 'warning'
    else 'healthy'
  end as backup_health
from organizations o;

-- =========================
-- CROSS-MODULE RELATIONSHIP MAP
-- =========================
create or replace view v_cross_module_relationship_map as
select
  ('risk-project-' || r.id::text || '-' || p.id::text) as id,
  'Risk' as source_type,
  r.id::text as source_id,
  r.title as source_title,
  'mitigated_by' as relationship_type,
  'Action plan' as target_type,
  p.id::text as target_id,
  p.title as target_title,
  p.status::text as status,
  p.risk_level::text as risk_level,
  coalesce(dep.name_en, 'Company-wide') as department_name
from risks r
join projects p on p.source_reference_id = r.id or p.id in (select project_id from risk_mitigation_actions where risk_id = r.id and project_id is not null)
left join departments dep on dep.id = p.department_id
union all
select
  ('audit-project-' || af.id::text || '-' || p.id::text),
  'Audit finding',
  af.id::text,
  af.title,
  'corrected_by',
  'Action plan',
  p.id::text,
  p.title,
  p.status::text,
  p.risk_level::text,
  coalesce(dep.name_en, 'Company-wide')
from audit_findings af
join projects p on p.id = af.corrective_action_project_id
left join departments dep on dep.id = p.department_id
union all
select
  ('compliance-project-' || c.id::text || '-' || p.id::text),
  'Compliance',
  c.id::text,
  c.title,
  'remediated_by',
  'Action plan',
  p.id::text,
  p.title,
  p.status::text,
  p.risk_level::text,
  coalesce(dep.name_en, 'Company-wide')
from compliance_items c
join projects p on p.id = c.linked_project_id
left join departments dep on dep.id = p.department_id
union all
select
  ('evidence-project-' || e.id::text || '-' || p.id::text),
  'Evidence',
  e.id::text,
  e.file_name,
  'supports_closure_of',
  'Action plan',
  p.id::text,
  p.title,
  e.status::text,
  p.risk_level::text,
  coalesce(dep.name_en, 'Company-wide')
from evidence_files e
join projects p on p.id = e.project_id
left join departments dep on dep.id = p.department_id;

-- =========================
-- RELEASE VIEWS
-- =========================
create or replace view v_release_candidate_gates as
select
  g.*,
  coalesce(owner.full_name_en, g.owner, 'Unassigned') as owner_name,
  case g.severity when 'blocker' then 1 when 'warning' then 2 else 3 end as severity_rank
from release_candidate_gates g
left join profiles owner on owner.id = g.owner_id;

create or replace view v_release_migration_order as
select * from release_migration_order order by sequence_no;

-- =========================
-- RLS
-- =========================
alter table document_center_items enable row level security;
alter table release_candidate_gates enable row level security;
alter table release_migration_order enable row level security;

drop policy if exists document_center_items_read on document_center_items;
create policy document_center_items_read on document_center_items
for select to authenticated
using (true);

drop policy if exists document_center_items_write on document_center_items;
create policy document_center_items_write on document_center_items
for all to authenticated
using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.is_active = true and ur.role in ('super_admin', 'executive', 'governance_admin', 'compliance_officer')))
with check (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.is_active = true and ur.role in ('super_admin', 'executive', 'governance_admin', 'compliance_officer')));

drop policy if exists release_candidate_gates_read on release_candidate_gates;
create policy release_candidate_gates_read on release_candidate_gates
for select to authenticated
using (true);

drop policy if exists release_candidate_gates_write on release_candidate_gates;
create policy release_candidate_gates_write on release_candidate_gates
for all to authenticated
using (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.is_active = true and ur.role in ('super_admin', 'executive', 'governance_admin')))
with check (exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.is_active = true and ur.role in ('super_admin', 'executive', 'governance_admin')));

drop policy if exists release_migration_order_read on release_migration_order;
create policy release_migration_order_read on release_migration_order
for select to authenticated
using (true);
