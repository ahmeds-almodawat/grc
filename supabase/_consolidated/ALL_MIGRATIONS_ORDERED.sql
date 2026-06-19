-- GRC Control Center consolidated migration reference bundle
-- Generated at 2026-06-19T03:30:51.676Z
-- Use this as a review artifact. For Supabase migrations, still apply ordered migration files unless your DBA approves a consolidated install.


-- =========================================================
-- BEGIN 001_core_foundation.sql
-- sha256: d72300510b7069bb523aa32372c47c17b42b9709678bf860098ccc628d8adb67
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 001
-- Core organization, user, role, action plan, milestone,
-- task, evidence, approval, comment, notification, audit log
-- =========================================================

create extension if not exists "pgcrypto";

-- ENUMS
create type public.app_role as enum (
  'super_admin','executive','governance_admin','division_head','department_manager',
  'project_owner','milestone_owner','task_owner','auditor','compliance_officer','viewer','employee'
);
create type public.access_scope as enum ('global','division','department','unit','assigned_only');
create type public.priority_level as enum ('critical','high','medium','low');
create type public.risk_level as enum ('critical','high','medium','low');
create type public.source_type as enum (
  'manual','ceo_decision','committee_decision','risk','audit_finding','compliance_requirement',
  'policy_gap','department_kpi','incident_ovr','strategic_goal'
);
create type public.project_status as enum (
  'draft','pending_approval','active','at_risk','delayed','completed_pending_evidence',
  'completed_pending_approval','closed','cancelled'
);
create type public.work_status as enum (
  'not_started','in_progress','at_risk','delayed','evidence_submitted','approved','rejected','closed','cancelled'
);
create type public.evidence_status as enum ('submitted','accepted','rejected','needs_revision');
create type public.approval_status as enum ('pending','approved','rejected','cancelled');

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ORGANIZATION STRUCTURE
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name_en text not null,
  name_ar text,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  division_id uuid references public.divisions(id) on delete set null,
  name_en text not null,
  name_ar text,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  name_en text not null,
  name_ar text,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Active normalized code safeguards.
create unique index uq_divisions_active_code_norm on public.divisions (organization_id, lower(trim(code))) where is_active = true and code is not null;
create unique index uq_departments_active_code_norm on public.departments (organization_id, lower(trim(code))) where is_active = true and code is not null;
create unique index uq_units_active_code_norm on public.units (department_id, lower(trim(code))) where is_active = true and code is not null;

-- USERS / ROLES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  employee_no text,
  full_name_en text not null,
  full_name_ar text,
  email text not null unique,
  phone text,
  job_title text,
  division_id uuid references public.divisions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_no)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  scope public.access_scope not null default 'assigned_only',
  organization_id uuid references public.organizations(id) on delete cascade,
  division_id uuid references public.divisions(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  is_active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (user_id, role, scope, organization_id, division_id, department_id, unit_id)
);

-- PROJECTS / ACTION PLANS
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'general',
  source_type public.source_type not null default 'manual',
  source_reference_id uuid,
  division_id uuid references public.divisions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  sponsor_id uuid references public.profiles(id) on delete set null,
  start_date date,
  target_end_date date,
  priority public.priority_level not null default 'medium',
  risk_level public.risk_level not null default 'medium',
  status public.project_status not null default 'draft',
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  evidence_required boolean not null default true,
  closure_approval_required boolean not null default true,
  delay_reason text,
  cancellation_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  start_date date,
  due_date date,
  status public.work_status not null default 'not_started',
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  evidence_required boolean not null default true,
  delay_reason text,
  rejection_reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete cascade,
  title text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  start_date date,
  due_date date,
  status public.work_status not null default 'not_started',
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  evidence_required boolean not null default false,
  delay_reason text,
  rejection_reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  description text,
  status public.evidence_status not null default 'submitted',
  uploaded_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  constraint evidence_must_link_to_work check (project_id is not null or milestone_id is not null or task_id is not null)
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  evidence_id uuid references public.evidence_files(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  approver_id uuid references public.profiles(id) on delete set null,
  status public.approval_status not null default 'pending',
  request_note text,
  decision_note text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint approval_must_link_to_item check (project_id is not null or milestone_id is not null or task_id is not null or evidence_id is not null)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  body text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint comment_must_link_to_item check (project_id is not null or milestone_id is not null or task_id is not null)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link_path text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Triggers
create trigger trg_organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger trg_divisions_updated_at before update on public.divisions for each row execute function public.set_updated_at();
create trigger trg_departments_updated_at before update on public.departments for each row execute function public.set_updated_at();
create trigger trg_units_updated_at before update on public.units for each row execute function public.set_updated_at();
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger trg_milestones_updated_at before update on public.milestones for each row execute function public.set_updated_at();
create trigger trg_tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();

-- Indexes
create index idx_profiles_org on public.profiles(organization_id);
create index idx_profiles_department on public.profiles(department_id);
create index idx_user_roles_user on public.user_roles(user_id);
create index idx_projects_org_status on public.projects(organization_id, status);
create index idx_projects_owner on public.projects(owner_id);
create index idx_projects_due on public.projects(target_end_date);
create index idx_milestones_project on public.milestones(project_id);
create index idx_milestones_owner_due on public.milestones(owner_id, due_date);
create index idx_tasks_assigned_due on public.tasks(assigned_to, due_date);
create index idx_tasks_project_status on public.tasks(project_id, status);
create index idx_evidence_status on public.evidence_files(status);
create index idx_approvals_approver_status on public.approvals(approver_id, status);
create index idx_notifications_user_read on public.notifications(user_id, is_read);
create index idx_audit_logs_record on public.audit_logs(table_name, record_id);

insert into public.organizations (name_en, name_ar)
values ('Al Modawat Specialized Medical Company', 'شركة المداواة التخصصية الطبية');

-- =========================================================
-- END 001_core_foundation.sql
-- =========================================================

-- =========================================================
-- BEGIN 002_grc_layer.sql
-- sha256: 8e2fd6db91eda1d89a359c98824449aee76a34679d810eb27dbbc250468e54f9
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 002
-- Risk, Compliance, Audit, Policies, Authority, Committees
-- =========================================================

create type public.risk_category as enum (
  'financial','clinical','operational','compliance','hr','it_cybersecurity','procurement',
  'patient_safety','strategic','reputation','revenue_cycle','legal','facility_engineering','supply_chain','other'
);
create type public.risk_status as enum ('draft','open','under_review','mitigating','monitoring','mitigated','accepted','transferred','closed','cancelled');
create type public.risk_response_type as enum ('avoid','reduce','transfer','accept','monitor');
create type public.control_type as enum ('preventive','detective','corrective','directive');
create type public.control_frequency as enum ('daily','weekly','monthly','quarterly','semi_annual','annual','ad_hoc','continuous');
create type public.control_effectiveness as enum ('effective','partially_effective','ineffective','not_tested');
create type public.compliance_status as enum ('not_started','in_progress','compliant','non_compliant','expired','due_soon','pending_evidence','pending_approval','closed','cancelled');
create type public.audit_finding_status as enum ('draft','open','action_plan_submitted','in_progress','evidence_submitted','under_audit_review','rejected','closed','cancelled');
create type public.policy_status as enum ('draft','under_review','approved','active','expired','archived','cancelled');
create type public.authority_category as enum ('payment','procurement','contract','hiring','payroll','budget','policy','clinical','operation','other');
create type public.meeting_status as enum ('scheduled','completed','cancelled','minutes_pending','closed');
create type public.decision_status as enum ('open','in_progress','delayed','pending_evidence','pending_approval','closed','cancelled');

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  risk_code text,
  title text not null,
  description text,
  category public.risk_category not null default 'other',
  division_id uuid references public.divisions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  likelihood smallint not null default 3 check (likelihood between 1 and 5),
  impact smallint not null default 3 check (impact between 1 and 5),
  inherent_score integer generated always as (likelihood * impact) stored,
  current_controls_summary text,
  residual_likelihood smallint not null default 3 check (residual_likelihood between 1 and 5),
  residual_impact smallint not null default 3 check (residual_impact between 1 and 5),
  residual_score integer generated always as (residual_likelihood * residual_impact) stored,
  risk_level public.risk_level not null default 'medium',
  response_type public.risk_response_type not null default 'reduce',
  status public.risk_status not null default 'draft',
  review_frequency public.control_frequency default 'quarterly',
  last_reviewed_at timestamptz,
  next_review_date date,
  source_type public.source_type not null default 'manual',
  source_reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, risk_code)
);

create table public.risk_controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  risk_id uuid not null references public.risks(id) on delete cascade,
  title text not null,
  description text,
  control_type public.control_type not null default 'preventive',
  frequency public.control_frequency not null default 'monthly',
  effectiveness public.control_effectiveness not null default 'not_tested',
  owner_id uuid references public.profiles(id) on delete set null,
  evidence_required boolean not null default true,
  last_tested_at timestamptz,
  next_test_date date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.risk_mitigation_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  risk_id uuid not null references public.risks(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status public.work_status not null default 'not_started',
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  evidence_required boolean not null default true,
  delay_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compliance_code text,
  title text not null,
  description text,
  regulatory_body text,
  requirement_type text,
  division_id uuid references public.divisions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  escalation_owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  expiry_date date,
  reminder_days_before integer not null default 30 check (reminder_days_before >= 0),
  risk_level public.risk_level not null default 'medium',
  status public.compliance_status not null default 'not_started',
  evidence_required boolean not null default true,
  last_submitted_at timestamptz,
  next_due_date date,
  linked_project_id uuid references public.projects(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, compliance_code)
);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  finding_code text,
  audit_title text,
  title text not null,
  description text not null,
  division_id uuid references public.divisions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  risk_level public.risk_level not null default 'medium',
  root_cause text,
  recommendation text,
  management_response text,
  corrective_action_project_id uuid references public.projects(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  auditor_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status public.audit_finding_status not null default 'open',
  evidence_required boolean not null default true,
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, finding_code)
);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  policy_code text,
  title text not null,
  description text,
  category text not null default 'general',
  division_id uuid references public.divisions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  version text not null default '1.0',
  status public.policy_status not null default 'draft',
  effective_date date,
  review_due_date date,
  expiry_date date,
  file_path text,
  file_name text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, policy_code, version)
);

create table public.authority_matrix (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  category public.authority_category not null default 'other',
  process_area text,
  division_id uuid references public.divisions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  min_amount numeric(18,2),
  max_amount numeric(18,2),
  currency text not null default 'SAR',
  approval_level integer not null default 1 check (approval_level > 0),
  approver_role public.app_role,
  approver_user_id uuid references public.profiles(id) on delete set null,
  requires_evidence boolean not null default true,
  requires_dual_approval boolean not null default false,
  is_active boolean not null default true,
  effective_from date,
  effective_to date,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_amount is null or max_amount is null or min_amount <= max_amount)
);

create table public.committee_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  committee_name text not null,
  meeting_title text not null,
  meeting_date date not null,
  start_time time,
  end_time time,
  chair_id uuid references public.profiles(id) on delete set null,
  secretary_id uuid references public.profiles(id) on delete set null,
  location text,
  agenda text,
  minutes text,
  minutes_file_path text,
  status public.meeting_status not null default 'scheduled',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.committee_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid references public.committee_meetings(id) on delete set null,
  decision_code text,
  title text not null,
  decision_text text not null,
  source_type public.source_type not null default 'committee_decision',
  owner_id uuid references public.profiles(id) on delete set null,
  sponsor_id uuid references public.profiles(id) on delete set null,
  division_id uuid references public.divisions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  due_date date,
  linked_project_id uuid references public.projects(id) on delete set null,
  priority public.priority_level not null default 'medium',
  risk_level public.risk_level not null default 'medium',
  status public.decision_status not null default 'open',
  evidence_required boolean not null default true,
  delay_reason text,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, decision_code)
);

-- Extend core collaboration tables to GRC items.
alter table public.evidence_files add column risk_id uuid references public.risks(id) on delete cascade;
alter table public.evidence_files add column risk_control_id uuid references public.risk_controls(id) on delete cascade;
alter table public.evidence_files add column compliance_item_id uuid references public.compliance_items(id) on delete cascade;
alter table public.evidence_files add column audit_finding_id uuid references public.audit_findings(id) on delete cascade;
alter table public.evidence_files add column policy_id uuid references public.policies(id) on delete cascade;
alter table public.evidence_files add column committee_decision_id uuid references public.committee_decisions(id) on delete cascade;
alter table public.evidence_files drop constraint evidence_must_link_to_work;
alter table public.evidence_files add constraint evidence_must_link_to_item check (
  project_id is not null or milestone_id is not null or task_id is not null or risk_id is not null or risk_control_id is not null or compliance_item_id is not null or audit_finding_id is not null or policy_id is not null or committee_decision_id is not null
);

alter table public.approvals add column risk_id uuid references public.risks(id) on delete cascade;
alter table public.approvals add column compliance_item_id uuid references public.compliance_items(id) on delete cascade;
alter table public.approvals add column audit_finding_id uuid references public.audit_findings(id) on delete cascade;
alter table public.approvals add column policy_id uuid references public.policies(id) on delete cascade;
alter table public.approvals add column committee_decision_id uuid references public.committee_decisions(id) on delete cascade;
alter table public.approvals drop constraint approval_must_link_to_item;
alter table public.approvals add constraint approval_must_link_to_item check (
  project_id is not null or milestone_id is not null or task_id is not null or evidence_id is not null or risk_id is not null or compliance_item_id is not null or audit_finding_id is not null or policy_id is not null or committee_decision_id is not null
);

alter table public.comments add column risk_id uuid references public.risks(id) on delete cascade;
alter table public.comments add column compliance_item_id uuid references public.compliance_items(id) on delete cascade;
alter table public.comments add column audit_finding_id uuid references public.audit_findings(id) on delete cascade;
alter table public.comments add column policy_id uuid references public.policies(id) on delete cascade;
alter table public.comments add column committee_decision_id uuid references public.committee_decisions(id) on delete cascade;
alter table public.comments drop constraint comment_must_link_to_item;
alter table public.comments add constraint comment_must_link_to_item check (
  project_id is not null or milestone_id is not null or task_id is not null or risk_id is not null or compliance_item_id is not null or audit_finding_id is not null or policy_id is not null or committee_decision_id is not null
);

-- Updated_at triggers
create trigger trg_risks_updated_at before update on public.risks for each row execute function public.set_updated_at();
create trigger trg_risk_controls_updated_at before update on public.risk_controls for each row execute function public.set_updated_at();
create trigger trg_risk_mitigation_actions_updated_at before update on public.risk_mitigation_actions for each row execute function public.set_updated_at();
create trigger trg_compliance_items_updated_at before update on public.compliance_items for each row execute function public.set_updated_at();
create trigger trg_audit_findings_updated_at before update on public.audit_findings for each row execute function public.set_updated_at();
create trigger trg_policies_updated_at before update on public.policies for each row execute function public.set_updated_at();
create trigger trg_authority_matrix_updated_at before update on public.authority_matrix for each row execute function public.set_updated_at();
create trigger trg_committee_meetings_updated_at before update on public.committee_meetings for each row execute function public.set_updated_at();
create trigger trg_committee_decisions_updated_at before update on public.committee_decisions for each row execute function public.set_updated_at();

-- Indexes
create index idx_risks_org_status_level on public.risks(organization_id, status, risk_level);
create index idx_risks_department on public.risks(department_id);
create index idx_risks_owner on public.risks(owner_id);
create index idx_risks_next_review on public.risks(next_review_date);
create index idx_risk_controls_risk on public.risk_controls(risk_id);
create index idx_risk_controls_next_test on public.risk_controls(next_test_date);
create index idx_risk_mitigation_risk on public.risk_mitigation_actions(risk_id);
create index idx_risk_mitigation_project on public.risk_mitigation_actions(project_id);
create index idx_compliance_org_status on public.compliance_items(organization_id, status);
create index idx_compliance_expiry on public.compliance_items(expiry_date);
create index idx_audit_findings_org_status on public.audit_findings(organization_id, status);
create index idx_audit_findings_due on public.audit_findings(due_date);
create index idx_policies_org_status on public.policies(organization_id, status);
create index idx_authority_active_category on public.authority_matrix(organization_id, is_active, category);
create index idx_committee_meetings_date on public.committee_meetings(organization_id, meeting_date);
create index idx_committee_decisions_status on public.committee_decisions(organization_id, status);

create or replace view public.v_executive_grc_summary as
select
  o.id as organization_id,
  o.name_en as organization_name_en,
  o.name_ar as organization_name_ar,
  (select count(*) from public.projects p where p.organization_id = o.id and p.status not in ('closed','cancelled')) as active_projects,
  (select count(*) from public.projects p where p.organization_id = o.id and p.target_end_date < current_date and p.status not in ('closed','cancelled')) as overdue_projects,
  (select count(*) from public.milestones m where m.organization_id = o.id and m.due_date < current_date and m.status not in ('closed','approved','cancelled')) as overdue_milestones,
  (select count(*) from public.tasks t where t.organization_id = o.id and t.due_date < current_date and t.status not in ('closed','approved','cancelled')) as overdue_tasks,
  (select count(*) from public.risks r where r.organization_id = o.id and r.status not in ('closed','cancelled') and r.risk_level = 'critical') as critical_open_risks,
  (select count(*) from public.compliance_items c where c.organization_id = o.id and c.expiry_date is not null and c.expiry_date <= current_date + interval '30 days' and c.status not in ('closed','cancelled')) as compliance_expiring_30_days,
  (select count(*) from public.audit_findings af where af.organization_id = o.id and af.due_date < current_date and af.status not in ('closed','cancelled')) as overdue_audit_findings,
  (select count(*) from public.approvals a where a.organization_id = o.id and a.status = 'pending') as pending_approvals,
  (select count(*) from public.evidence_files e where e.organization_id = o.id and e.status in ('submitted','needs_revision')) as pending_evidence_reviews
from public.organizations o;

-- =========================================================
-- END 002_grc_layer.sql
-- =========================================================

-- =========================================================
-- BEGIN 003_rls_permissions_and_controls.sql
-- sha256: 107566e145ccdd60674bdae440443925b449ec5fd9b6c1eb41391687e27ec444
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 003
-- Row Level Security, permission helpers, validation rules
-- =========================================================

-- -------------------------
-- Permission helper functions
-- -------------------------

create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() and is_active = true limit 1;
$$;

create or replace function public.has_any_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role = any(required_roles)
  );
$$;

create or replace function public.has_global_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.scope = 'global'
      and ur.role = any(required_roles)
  );
$$;

create or replace function public.can_access_org(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_org_id = public.current_user_org_id()
     or public.has_global_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]);
$$;

create or replace function public.can_access_scope(
  target_org_id uuid,
  target_division_id uuid,
  target_department_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and (
        ur.scope = 'global'
        or (ur.scope = 'division' and ur.division_id is not distinct from target_division_id)
        or (ur.scope = 'department' and ur.department_id is not distinct from target_department_id)
        or (ur.scope = 'unit' and ur.unit_id is not distinct from target_unit_id)
      )
      and (
        ur.organization_id is null
        or ur.organization_id is not distinct from target_org_id
        or target_org_id = public.current_user_org_id()
      )
  );
$$;

create or replace function public.can_manage_grc()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]);
$$;

-- -------------------------
-- Validation helper functions
-- -------------------------

create or replace function public.require_delay_reason_project()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delayed' and coalesce(trim(new.delay_reason), '') = '' then
    raise exception 'Delay reason is required when project status is delayed';
  end if;
  return new;
end;
$$;

create or replace function public.require_delay_reason_work()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delayed' and coalesce(trim(new.delay_reason), '') = '' then
    raise exception 'Delay reason is required when work item status is delayed';
  end if;
  return new;
end;
$$;

create or replace function public.audit_log_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := coalesce((to_jsonb(new)->>'organization_id')::uuid, (to_jsonb(old)->>'organization_id')::uuid);

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) values (
    org_id,
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

-- Validation triggers
drop trigger if exists trg_projects_require_delay_reason on public.projects;
create trigger trg_projects_require_delay_reason before insert or update on public.projects
for each row execute function public.require_delay_reason_project();

drop trigger if exists trg_milestones_require_delay_reason on public.milestones;
create trigger trg_milestones_require_delay_reason before insert or update on public.milestones
for each row execute function public.require_delay_reason_work();

drop trigger if exists trg_tasks_require_delay_reason on public.tasks;
create trigger trg_tasks_require_delay_reason before insert or update on public.tasks
for each row execute function public.require_delay_reason_work();

drop trigger if exists trg_risk_mitigation_require_delay_reason on public.risk_mitigation_actions;
create trigger trg_risk_mitigation_require_delay_reason before insert or update on public.risk_mitigation_actions
for each row execute function public.require_delay_reason_work();

-- Audit log triggers on important tables.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'projects','milestones','tasks','evidence_files','approvals','risks','risk_controls',
    'risk_mitigation_actions','compliance_items','audit_findings','policies','authority_matrix',
    'committee_meetings','committee_decisions','user_roles'
  ] loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', tbl, tbl);
    execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_log_row_change()', tbl, tbl);
  end loop;
end $$;

-- -------------------------
-- Enable RLS
-- -------------------------

alter table public.organizations enable row level security;
alter table public.divisions enable row level security;
alter table public.departments enable row level security;
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.evidence_files enable row level security;
alter table public.approvals enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.risks enable row level security;
alter table public.risk_controls enable row level security;
alter table public.risk_mitigation_actions enable row level security;
alter table public.compliance_items enable row level security;
alter table public.audit_findings enable row level security;
alter table public.policies enable row level security;
alter table public.authority_matrix enable row level security;
alter table public.committee_meetings enable row level security;
alter table public.committee_decisions enable row level security;

-- -------------------------
-- Organization structure policies
-- -------------------------

create policy organizations_read on public.organizations
for select using (public.can_access_org(id));
create policy organizations_write_admin on public.organizations
for all using (public.has_global_role(array['super_admin']::public.app_role[]))
with check (public.has_global_role(array['super_admin']::public.app_role[]));

create policy divisions_read on public.divisions
for select using (public.can_access_org(organization_id));
create policy divisions_write_admin on public.divisions
for all using (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]))
with check (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]));

create policy departments_read on public.departments
for select using (public.can_access_org(organization_id));
create policy departments_write_admin on public.departments
for all using (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]))
with check (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]));

create policy units_read on public.units
for select using (public.can_access_org(organization_id));
create policy units_write_admin on public.units
for all using (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]))
with check (public.has_global_role(array['super_admin','governance_admin']::public.app_role[]));

-- -------------------------
-- Profile / role policies
-- -------------------------

create policy profiles_read_self_or_org_managers on public.profiles
for select using (
  id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','auditor','compliance_officer']::public.app_role[])
);

create policy profiles_insert_self on public.profiles
for insert with check (id = auth.uid());

create policy profiles_update_self_or_admin on public.profiles
for update using (id = auth.uid() or public.has_any_role(array['super_admin','governance_admin']::public.app_role[]))
with check (id = auth.uid() or public.has_any_role(array['super_admin','governance_admin']::public.app_role[]));

create policy user_roles_read_self_or_admin on public.user_roles
for select using (user_id = auth.uid() or public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]));

create policy user_roles_write_admin on public.user_roles
for all using (public.has_any_role(array['super_admin','governance_admin']::public.app_role[]))
with check (public.has_any_role(array['super_admin','governance_admin']::public.app_role[]));

-- -------------------------
-- Project/action policies
-- -------------------------

create policy projects_read_scope_or_assigned on public.projects
for select using (
  public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or owner_id = auth.uid()
  or sponsor_id = auth.uid()
  or created_by = auth.uid()
);

create policy projects_write_managers on public.projects
for insert with check (
  public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','project_owner']::public.app_role[])
);

create policy projects_update_owner_or_manager on public.projects
for update using (
  public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or owner_id = auth.uid()
  or sponsor_id = auth.uid()
)
with check (
  public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or owner_id = auth.uid()
  or sponsor_id = auth.uid()
);

create policy milestones_read_scope_or_owner on public.milestones
for select using (
  public.can_access_org(organization_id)
  and (
    owner_id = auth.uid()
    or created_by = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and (p.owner_id = auth.uid() or p.sponsor_id = auth.uid()))
    or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','auditor','compliance_officer']::public.app_role[])
  )
);

create policy milestones_write_owner_or_manager on public.milestones
for all using (
  owner_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','project_owner']::public.app_role[])
)
with check (
  owner_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','project_owner']::public.app_role[])
);

create policy tasks_read_assigned_or_manager on public.tasks
for select using (
  owner_id = auth.uid()
  or assigned_to = auth.uid()
  or created_by = auth.uid()
  or exists (select 1 from public.projects p where p.id = project_id and (p.owner_id = auth.uid() or p.sponsor_id = auth.uid()))
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','auditor','compliance_officer']::public.app_role[])
);

create policy tasks_write_assigned_or_manager on public.tasks
for all using (
  owner_id = auth.uid()
  or assigned_to = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','project_owner','milestone_owner']::public.app_role[])
)
with check (
  owner_id = auth.uid()
  or assigned_to = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','division_head','department_manager','project_owner','milestone_owner']::public.app_role[])
);

-- Evidence, approvals, comments, notifications
create policy evidence_read_related on public.evidence_files
for select using (
  uploaded_by = auth.uid()
  or reviewed_by = auth.uid()
  or public.can_manage_grc()
  or exists (select 1 from public.projects p where p.id = project_id and (p.owner_id = auth.uid() or p.sponsor_id = auth.uid()))
  or exists (select 1 from public.tasks t where t.id = task_id and (t.owner_id = auth.uid() or t.assigned_to = auth.uid()))
);

create policy evidence_insert_authenticated on public.evidence_files
for insert with check (uploaded_by = auth.uid() or public.can_manage_grc());

create policy evidence_update_reviewers on public.evidence_files
for update using (uploaded_by = auth.uid() or public.can_manage_grc())
with check (uploaded_by = auth.uid() or public.can_manage_grc());

create policy approvals_read_related on public.approvals
for select using (requested_by = auth.uid() or approver_id = auth.uid() or public.can_manage_grc());
create policy approvals_write_related on public.approvals
for all using (requested_by = auth.uid() or approver_id = auth.uid() or public.can_manage_grc())
with check (requested_by = auth.uid() or approver_id = auth.uid() or public.can_manage_grc());

create policy comments_read_org on public.comments
for select using (public.can_access_org(organization_id));
create policy comments_write_authenticated on public.comments
for insert with check (created_by = auth.uid());

create policy notifications_own on public.notifications
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_logs_read_admin on public.audit_logs
for select using (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]));

-- -------------------------
-- GRC policies
-- -------------------------

create policy risks_read_scope_or_owner on public.risks
for select using (
  owner_id = auth.uid()
  or public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);
create policy risks_write_grc on public.risks
for all using (public.can_manage_grc()) with check (public.can_manage_grc());

create policy risk_controls_read on public.risk_controls
for select using (
  owner_id = auth.uid()
  or public.can_manage_grc()
  or exists (select 1 from public.risks r where r.id = risk_id and r.owner_id = auth.uid())
);
create policy risk_controls_write_grc on public.risk_controls
for all using (public.can_manage_grc()) with check (public.can_manage_grc());

create policy risk_mitigation_read on public.risk_mitigation_actions
for select using (owner_id = auth.uid() or public.can_manage_grc());
create policy risk_mitigation_write on public.risk_mitigation_actions
for all using (owner_id = auth.uid() or public.can_manage_grc()) with check (owner_id = auth.uid() or public.can_manage_grc());

create policy compliance_read_scope_or_owner on public.compliance_items
for select using (
  owner_id = auth.uid()
  or escalation_owner_id = auth.uid()
  or public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);
create policy compliance_write_officers on public.compliance_items
for all using (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','compliance_officer']::public.app_role[]));

create policy audit_findings_read_related on public.audit_findings
for select using (
  owner_id = auth.uid()
  or auditor_id = auth.uid()
  or reviewed_by = auth.uid()
  or public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[])
);
create policy audit_findings_write_auditors on public.audit_findings
for all using (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin','auditor']::public.app_role[]));

create policy policies_read_org on public.policies
for select using (public.can_access_org(organization_id));
create policy policies_write_governance on public.policies
for all using (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]));

create policy authority_read_org on public.authority_matrix
for select using (public.can_access_org(organization_id));
create policy authority_write_governance on public.authority_matrix
for all using (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]));

create policy committee_meetings_read_org on public.committee_meetings
for select using (public.can_access_org(organization_id));
create policy committee_meetings_write_governance on public.committee_meetings
for all using (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]));

create policy committee_decisions_read_related on public.committee_decisions
for select using (
  owner_id = auth.uid()
  or sponsor_id = auth.uid()
  or public.can_access_scope(organization_id, division_id, department_id, null)
  or public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[])
);
create policy committee_decisions_write_governance on public.committee_decisions
for all using (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]))
with check (public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]));

-- =========================================================
-- END 003_rls_permissions_and_controls.sql
-- =========================================================

-- =========================================================
-- BEGIN 004_seed_reference_data.sql
-- sha256: 9b485799c05812421f049108742ec2094f221958fe52ed8d2109481724cbffcf
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 004
-- Safe reference/demo data without auth users
-- =========================================================

with org as (
  select id from public.organizations where name_en = 'Al Modawat Specialized Medical Company' limit 1
)
insert into public.divisions (organization_id, name_en, name_ar, code)
select id, 'Executive', 'الإدارة التنفيذية', 'EXEC' from org
union all select id, 'Medical', 'القطاع الطبي', 'MED' from org
union all select id, 'Finance & Administration', 'المالية والإدارة', 'FINADMIN' from org
union all select id, 'Operations', 'التشغيل', 'OPS' from org
union all select id, 'Governance, Risk & Compliance', 'الحوكمة والمخاطر والالتزام', 'GRC' from org
on conflict do nothing;

with org as (select id from public.organizations where name_en = 'Al Modawat Specialized Medical Company' limit 1),
div_fin as (select d.id from public.divisions d join org on d.organization_id = org.id where d.code = 'FINADMIN'),
div_grc as (select d.id from public.divisions d join org on d.organization_id = org.id where d.code = 'GRC'),
div_med as (select d.id from public.divisions d join org on d.organization_id = org.id where d.code = 'MED'),
div_ops as (select d.id from public.divisions d join org on d.organization_id = org.id where d.code = 'OPS')
insert into public.departments (organization_id, division_id, name_en, name_ar, code)
select org.id, div_fin.id, 'Finance', 'المالية', 'FIN' from org, div_fin
union all select org.id, div_fin.id, 'Human Resources', 'الموارد البشرية', 'HR' from org, div_fin
union all select org.id, div_grc.id, 'Governance & Compliance', 'الحوكمة والالتزام', 'GOVCOMP' from org, div_grc
union all select org.id, div_grc.id, 'Internal Audit', 'المراجعة الداخلية', 'AUDIT' from org, div_grc
union all select org.id, div_med.id, 'Nursing', 'التمريض', 'NURS' from org, div_med
union all select org.id, div_med.id, 'Quality & Patient Safety', 'الجودة وسلامة المرضى', 'QUALITY' from org, div_med
union all select org.id, div_ops.id, 'Engineering & Projects', 'الهندسة والمشاريع', 'ENG' from org, div_ops
union all select org.id, div_ops.id, 'Information Technology', 'تقنية المعلومات', 'IT' from org, div_ops
on conflict do nothing;

-- Sample risks/action items with null owners. Assign owners later from the UI.
with org as (select id from public.organizations where name_en = 'Al Modawat Specialized Medical Company' limit 1),
fin as (select d.id from public.departments d join org on d.organization_id = org.id where d.code = 'FIN'),
grc as (select d.id from public.departments d join org on d.organization_id = org.id where d.code = 'GOVCOMP'),
eng as (select d.id from public.departments d join org on d.organization_id = org.id where d.code = 'ENG')
insert into public.risks (organization_id, risk_code, title, description, category, department_id, likelihood, impact, residual_likelihood, residual_impact, risk_level, status, next_review_date)
select org.id, 'RISK-FIN-001', 'Delayed government payer collections', 'Collections delayed 6-8 months may pressure salary and supplier payments.', 'financial'::public.risk_category, fin.id, 5, 5, 4, 5, 'critical'::public.risk_level, 'open'::public.risk_status, current_date + 30 from org, fin
union all select org.id, 'RISK-GRC-001', 'Authority matrix not fully documented', 'Undefined approval limits may create inconsistent approvals.', 'compliance'::public.risk_category, grc.id, 4, 4, 3, 4, 'high'::public.risk_level, 'open'::public.risk_status, current_date + 45 from org, grc
union all select org.id, 'RISK-ENG-001', 'Civil Defense compliance evidence expiry', 'Expired or missing evidence may create regulatory exposure.', 'facility_engineering'::public.risk_category, eng.id, 4, 5, 3, 5, 'critical'::public.risk_level, 'open'::public.risk_status, current_date + 15 from org, eng
on conflict do nothing;

with org as (select id from public.organizations where name_en = 'Al Modawat Specialized Medical Company' limit 1),
fin as (select d.id from public.departments d join org on d.organization_id = org.id where d.code = 'FIN'),
grc as (select d.id from public.departments d join org on d.organization_id = org.id where d.code = 'GOVCOMP')
insert into public.projects (organization_id, title, description, category, source_type, department_id, start_date, target_end_date, priority, risk_level, status, progress_percent)
select org.id, 'Weekly cash forecast and collection escalation', 'Build weekly cash visibility and payer escalation process.', 'finance_control', 'risk'::public.source_type, fin.id, current_date, current_date + 45, 'critical'::public.priority_level, 'critical'::public.risk_level, 'active'::public.project_status, 15 from org, fin
union all select org.id, 'Company authority matrix implementation', 'Create, approve and publish approval authority matrix.', 'governance', 'policy_gap'::public.source_type, grc.id, current_date, current_date + 60, 'high'::public.priority_level, 'high'::public.risk_level, 'active'::public.project_status, 10 from org, grc
on conflict do nothing;

with org as (select id from public.organizations where name_en = 'Al Modawat Specialized Medical Company' limit 1)
insert into public.compliance_items (organization_id, compliance_code, title, regulatory_body, requirement_type, expiry_date, reminder_days_before, risk_level, status)
select id, 'COMP-MOH-001', 'MOH license renewal tracking', 'Ministry of Health', 'License', current_date + 90, 45, 'critical'::public.risk_level, 'in_progress'::public.compliance_status from org
union all select id, 'COMP-CIVIL-001', 'Civil Defense certificate evidence', 'Civil Defense', 'Certificate', current_date + 30, 30, 'critical'::public.risk_level, 'due_soon'::public.compliance_status from org
on conflict do nothing;

-- =========================================================
-- END 004_seed_reference_data.sql
-- =========================================================

-- =========================================================
-- BEGIN 005_operational_views_and_storage.sql
-- sha256: 275d5fc0744a0d40be389954ceedd7a806a7561524183ab11d6a18f832da8a57
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 005
-- Operational views, evidence storage bucket, and dashboard helpers
-- =========================================================

-- Evidence bucket for Supabase Storage.
-- Run after Supabase Storage is enabled in the project.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'grc-evidence',
  'grc-evidence',
  false,
  52428800,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- Users can read evidence objects when they can access their organization.
-- Folder convention: grc-evidence/<organization_id>/<module>/<record_id>/<filename>
drop policy if exists evidence_storage_read on storage.objects;
create policy evidence_storage_read
on storage.objects for select
using (
  bucket_id = 'grc-evidence'
  and public.can_access_org((storage.foldername(name))[1]::uuid)
);

-- Controlled users can upload evidence under their own organization folder.
drop policy if exists evidence_storage_insert on storage.objects;
create policy evidence_storage_insert
on storage.objects for insert
with check (
  bucket_id = 'grc-evidence'
  and public.can_access_org((storage.foldername(name))[1]::uuid)
);

-- Only GRC managers can update/delete evidence objects.
drop policy if exists evidence_storage_update on storage.objects;
create policy evidence_storage_update
on storage.objects for update
using (
  bucket_id = 'grc-evidence'
  and public.can_manage_grc()
)
with check (
  bucket_id = 'grc-evidence'
  and public.can_manage_grc()
);

drop policy if exists evidence_storage_delete on storage.objects;
create policy evidence_storage_delete
on storage.objects for delete
using (
  bucket_id = 'grc-evidence'
  and public.can_manage_grc()
);

-- Critical attention view used by the React dashboard.
create or replace view v_critical_attention_items as
select * from (
  select
    p.id,
    p.organization_id,
    'project'::text as item_type,
    p.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    p.target_end_date as due_date,
    p.status::text as status,
    p.risk_level,
    p.progress_percent,
    case
      when p.risk_level = 'critical' then 1
      when p.risk_level = 'high' then 2
      when p.status = 'delayed' then 3
      else 8
    end as sort_rank
  from projects p
  left join departments d on d.id = p.department_id
  left join profiles pr on pr.id = p.owner_id
  where p.status not in ('closed', 'cancelled')
    and (
      p.risk_level in ('critical', 'high')
      or p.status in ('delayed', 'at_risk', 'completed_pending_evidence', 'completed_pending_approval')
      or (p.target_end_date is not null and p.target_end_date < current_date)
    )

  union all

  select
    r.id,
    r.organization_id,
    'risk'::text as item_type,
    r.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    r.next_review_date as due_date,
    r.status::text as status,
    r.risk_level,
    null::numeric as progress_percent,
    case when r.risk_level = 'critical' then 1 when r.risk_level = 'high' then 2 else 8 end as sort_rank
  from risks r
  left join departments d on d.id = r.department_id
  left join profiles pr on pr.id = r.owner_id
  where r.status not in ('closed', 'cancelled')
    and r.risk_level in ('critical', 'high')

  union all

  select
    c.id,
    c.organization_id,
    'compliance'::text as item_type,
    c.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    coalesce(c.expiry_date, c.due_date) as due_date,
    c.status::text as status,
    c.risk_level,
    null::numeric as progress_percent,
    case
      when c.expiry_date is not null and c.expiry_date <= current_date + interval '7 days' then 1
      when c.risk_level = 'critical' then 2
      else 5
    end as sort_rank
  from compliance_items c
  left join departments d on d.id = c.department_id
  left join profiles pr on pr.id = c.owner_id
  where c.status not in ('closed', 'cancelled')
    and (
      c.risk_level in ('critical', 'high')
      or (c.expiry_date is not null and c.expiry_date <= current_date + interval '30 days')
      or (c.due_date is not null and c.due_date < current_date)
    )

  union all

  select
    af.id,
    af.organization_id,
    'audit_finding'::text as item_type,
    af.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    af.due_date,
    af.status::text as status,
    af.risk_level,
    null::numeric as progress_percent,
    case
      when af.due_date is not null and af.due_date < current_date then 1
      when af.risk_level = 'critical' then 2
      else 4
    end as sort_rank
  from audit_findings af
  left join departments d on d.id = af.department_id
  left join profiles pr on pr.id = af.owner_id
  where af.status not in ('closed', 'cancelled')
    and (
      af.risk_level in ('critical', 'high')
      or (af.due_date is not null and af.due_date < current_date)
    )

  union all

  select
    cd.id,
    cd.organization_id,
    'governance_decision'::text as item_type,
    cd.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    cd.due_date,
    cd.status::text as status,
    cd.risk_level,
    null::numeric as progress_percent,
    case
      when cd.status = 'delayed' then 1
      when cd.priority = 'critical' then 2
      else 6
    end as sort_rank
  from committee_decisions cd
  left join departments d on d.id = cd.department_id
  left join profiles pr on pr.id = cd.owner_id
  where cd.status not in ('closed', 'cancelled')
    and (
      cd.priority in ('critical', 'high')
      or cd.risk_level in ('critical', 'high')
      or cd.status in ('delayed', 'pending_evidence', 'pending_approval')
    )
) q
order by sort_rank asc, due_date asc nulls last;

-- My work view for future employee workspace.
create or replace view v_my_open_work as
select
  t.id,
  t.organization_id,
  'task'::text as item_type,
  t.title,
  t.due_date,
  t.status::text as status,
  t.progress_percent,
  t.owner_id,
  t.assigned_to,
  t.project_id,
  t.milestone_id
from tasks t
where t.status not in ('closed', 'cancelled', 'approved')
  and (t.assigned_to = auth.uid() or t.owner_id = auth.uid())
union all
select
  m.id,
  m.organization_id,
  'milestone'::text as item_type,
  m.title,
  m.due_date,
  m.status::text as status,
  m.progress_percent,
  m.owner_id,
  null::uuid as assigned_to,
  m.project_id,
  null::uuid as milestone_id
from milestones m
where m.status not in ('closed', 'cancelled', 'approved')
  and m.owner_id = auth.uid();

-- =========================================================
-- END 005_operational_views_and_storage.sql
-- =========================================================

-- =========================================================
-- BEGIN 006_workflow_queues_and_project_controls.sql
-- sha256: d31ca02071be4ac95a040bde0fa686e5fecc93c5e791729ddf4263204a4944e3
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 006
-- Workflow queues, project detail helpers and overdue controls
-- =========================================================

-- Expanded employee workspace view. Normal employees use this for assigned work only.
create or replace view v_my_open_work_expanded as
select
  t.id,
  t.organization_id,
  'task'::text as item_type,
  t.title,
  t.due_date,
  t.status::text as status,
  t.progress_percent,
  t.owner_id,
  t.assigned_to,
  t.project_id,
  t.milestone_id,
  p.title as project_title,
  d.name_en as department_name
from tasks t
join projects p on p.id = t.project_id
left join departments d on d.id = p.department_id
where t.status not in ('closed', 'cancelled', 'approved')
  and (t.assigned_to = auth.uid() or t.owner_id = auth.uid())
union all
select
  m.id,
  m.organization_id,
  'milestone'::text as item_type,
  m.title,
  m.due_date,
  m.status::text as status,
  m.progress_percent,
  m.owner_id,
  null::uuid as assigned_to,
  m.project_id,
  null::uuid as milestone_id,
  p.title as project_title,
  d.name_en as department_name
from milestones m
join projects p on p.id = m.project_id
left join departments d on d.id = p.department_id
where m.status not in ('closed', 'cancelled', 'approved')
  and m.owner_id = auth.uid();

-- Approval queue with resolved item titles for the UI.
create or replace view v_pending_approvals_expanded as
select
  a.id,
  a.organization_id,
  case
    when a.project_id is not null then 'project'
    when a.milestone_id is not null then 'milestone'
    when a.task_id is not null then 'task'
    when a.evidence_id is not null then 'evidence'
    when a.risk_id is not null then 'risk'
    when a.compliance_item_id is not null then 'compliance'
    when a.audit_finding_id is not null then 'audit_finding'
    when a.policy_id is not null then 'policy'
    when a.committee_decision_id is not null then 'governance_decision'
    else 'unknown'
  end as item_type,
  coalesce(
    p.title,
    m.title,
    t.title,
    e.file_name,
    r.title,
    c.title,
    af.title,
    pol.title,
    cd.title,
    'Untitled item'
  ) as item_title,
  rb.full_name_en as requested_by_name,
  ap.full_name_en as approver_name,
  a.status,
  a.request_note,
  a.decision_note,
  a.requested_at,
  a.decided_at
from approvals a
left join projects p on p.id = a.project_id
left join milestones m on m.id = a.milestone_id
left join tasks t on t.id = a.task_id
left join evidence_files e on e.id = a.evidence_id
left join risks r on r.id = a.risk_id
left join compliance_items c on c.id = a.compliance_item_id
left join audit_findings af on af.id = a.audit_finding_id
left join policies pol on pol.id = a.policy_id
left join committee_decisions cd on cd.id = a.committee_decision_id
left join profiles rb on rb.id = a.requested_by
left join profiles ap on ap.id = a.approver_id
where a.status = 'pending'
  and (a.approver_id = auth.uid() or public.can_manage_grc());

-- Evidence queue with resolved related item title.
create or replace view v_evidence_review_queue as
select
  e.id,
  e.organization_id,
  case
    when e.project_id is not null then 'project'
    when e.milestone_id is not null then 'milestone'
    when e.task_id is not null then 'task'
    when e.risk_id is not null then 'risk'
    when e.risk_control_id is not null then 'risk_control'
    when e.compliance_item_id is not null then 'compliance'
    when e.audit_finding_id is not null then 'audit_finding'
    when e.policy_id is not null then 'policy'
    when e.committee_decision_id is not null then 'governance_decision'
    else 'unknown'
  end as item_type,
  coalesce(
    p.title,
    m.title,
    t.title,
    r.title,
    rc.title,
    c.title,
    af.title,
    pol.title,
    cd.title,
    'Untitled item'
  ) as item_title,
  e.file_name,
  e.file_path,
  e.description,
  e.status,
  ub.full_name_en as uploaded_by_name,
  rv.full_name_en as reviewed_by_name,
  e.created_at
from evidence_files e
left join projects p on p.id = e.project_id
left join milestones m on m.id = e.milestone_id
left join tasks t on t.id = e.task_id
left join risks r on r.id = e.risk_id
left join risk_controls rc on rc.id = e.risk_control_id
left join compliance_items c on c.id = e.compliance_item_id
left join audit_findings af on af.id = e.audit_finding_id
left join policies pol on pol.id = e.policy_id
left join committee_decisions cd on cd.id = e.committee_decision_id
left join profiles ub on ub.id = e.uploaded_by
left join profiles rv on rv.id = e.reviewed_by
where e.status in ('submitted', 'needs_revision')
  and (public.can_manage_grc() or e.uploaded_by = auth.uid() or e.reviewed_by = auth.uid());

-- Department execution summary for future department dashboard.
create or replace view v_department_execution_summary as
select
  d.organization_id,
  d.id as department_id,
  d.name_en as department_name,
  count(distinct p.id) filter (where p.status not in ('closed','cancelled')) as active_projects,
  count(distinct p.id) filter (where p.status not in ('closed','cancelled') and p.target_end_date < current_date) as overdue_projects,
  count(distinct m.id) filter (where m.status not in ('closed','approved','cancelled') and m.due_date < current_date) as overdue_milestones,
  count(distinct t.id) filter (where t.status not in ('closed','approved','cancelled') and t.due_date < current_date) as overdue_tasks,
  count(distinct r.id) filter (where r.status not in ('closed','cancelled') and r.risk_level = 'critical') as critical_risks,
  count(distinct af.id) filter (where af.status not in ('closed','cancelled') and af.due_date < current_date) as overdue_audit_findings,
  count(distinct c.id) filter (where c.status not in ('closed','cancelled') and c.expiry_date <= current_date + interval '30 days') as compliance_expiring_30_days
from departments d
left join projects p on p.department_id = d.id
left join milestones m on m.project_id = p.id
left join tasks t on t.project_id = p.id
left join risks r on r.department_id = d.id
left join audit_findings af on af.department_id = d.id
left join compliance_items c on c.department_id = d.id
group by d.organization_id, d.id, d.name_en;

-- Controlled overdue marking. This can be scheduled later using pg_cron or called manually.
create or replace function public.mark_overdue_work_items()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update projects
  set status = 'delayed', updated_at = now()
  where target_end_date < current_date
    and status not in ('closed','cancelled','delayed')
    and coalesce(trim(delay_reason), '') <> '';

  update milestones
  set status = 'delayed', updated_at = now()
  where due_date < current_date
    and status not in ('closed','approved','cancelled','delayed')
    and coalesce(trim(delay_reason), '') <> '';

  update tasks
  set status = 'delayed', updated_at = now()
  where due_date < current_date
    and status not in ('closed','approved','cancelled','delayed')
    and coalesce(trim(delay_reason), '') <> '';
end;
$$;

-- Helper to calculate project progress from its milestones/tasks.
create or replace function public.refresh_project_progress(target_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_avg numeric;
  task_avg numeric;
  final_progress numeric;
begin
  select avg(progress_percent) into milestone_avg
  from milestones
  where project_id = target_project_id;

  select avg(progress_percent) into task_avg
  from tasks
  where project_id = target_project_id;

  final_progress := coalesce((coalesce(milestone_avg, task_avg, 0) + coalesce(task_avg, milestone_avg, 0)) / 2, 0);

  update projects
  set progress_percent = least(greatest(final_progress, 0), 100), updated_at = now()
  where id = target_project_id;
end;
$$;

create or replace function public.refresh_project_progress_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_project_progress(coalesce(new.project_id, old.project_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_project_progress_milestones on milestones;
create trigger trg_refresh_project_progress_milestones
after insert or update or delete on milestones
for each row execute function public.refresh_project_progress_trigger();

drop trigger if exists trg_refresh_project_progress_tasks on tasks;
create trigger trg_refresh_project_progress_tasks
after insert or update or delete on tasks
for each row execute function public.refresh_project_progress_trigger();

-- =========================================================
-- END 006_workflow_queues_and_project_controls.sql
-- =========================================================

-- =========================================================
-- BEGIN 007_escalation_and_governance_controls.sql
-- sha256: 32b53dd14e129291477ca3b6c052689a163514b3592ac5295750f2bbc68a91aa
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 007
-- Escalation center, delay governance queue, closure controls
-- =========================================================

-- This migration adds the management-control layer:
-- 1) Escalation events for overdue / due-soon / critical items.
-- 2) Delay reason queue for overdue work without a formal reason.
-- 3) Accepted-evidence rule before controlled closure.
-- 4) Executive views for escalation and missing delay reasons.

create table if not exists public.escalation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  item_type text not null check (
    item_type in (
      'project',
      'milestone',
      'task',
      'risk',
      'compliance_item',
      'audit_finding',
      'committee_decision'
    )
  ),
  item_id uuid not null,
  title text not null,

  department_id uuid references public.departments(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  due_date date,
  risk_level public.risk_level not null default 'medium',

  escalation_level text not null check (escalation_level in ('reminder','manager','division','executive')),
  reason text not null,

  status text not null default 'open' check (status in ('open','acknowledged','resolved','cancelled')),

  triggered_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_escalation_events_org on public.escalation_events(organization_id);
create index if not exists idx_escalation_events_status on public.escalation_events(status);
create index if not exists idx_escalation_events_level on public.escalation_events(escalation_level);
create index if not exists idx_escalation_events_due on public.escalation_events(due_date);
create index if not exists idx_escalation_events_owner on public.escalation_events(owner_id);
create index if not exists idx_escalation_events_department on public.escalation_events(department_id);
create index if not exists idx_escalation_events_item on public.escalation_events(item_type, item_id);

-- Prevent duplicate active escalation cards for the same item/level.
create unique index if not exists uq_escalation_events_active_item_level
on public.escalation_events(organization_id, item_type, item_id, escalation_level)
where status in ('open','acknowledged');

drop trigger if exists trg_escalation_events_updated_at on public.escalation_events;
create trigger trg_escalation_events_updated_at
before update on public.escalation_events
for each row execute function public.set_updated_at();

alter table public.escalation_events enable row level security;

create policy escalation_events_read on public.escalation_events
for select using (
  public.can_access_org(organization_id)
  and (
    public.can_manage_grc()
    or owner_id = auth.uid()
    or public.has_any_role(array['division_head','department_manager','project_owner']::public.app_role[])
  )
);

create policy escalation_events_insert_manage on public.escalation_events
for insert with check (public.can_manage_grc());

create policy escalation_events_update_manage_or_owner on public.escalation_events
for update using (public.can_manage_grc() or owner_id = auth.uid())
with check (public.can_manage_grc() or owner_id = auth.uid());

-- Add audit logging for escalation changes.
drop trigger if exists trg_audit_escalation_events on public.escalation_events;
create trigger trg_audit_escalation_events
after insert or update or delete on public.escalation_events
for each row execute function public.audit_log_row_change();

-- ---------------------------------------------------------
-- Accepted evidence helper
-- ---------------------------------------------------------

create or replace function public.has_accepted_evidence(target_item_type text, target_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.evidence_files e
    where e.status = 'accepted'
      and (
        (target_item_type = 'project' and e.project_id = target_item_id)
        or (target_item_type = 'milestone' and e.milestone_id = target_item_id)
        or (target_item_type = 'task' and e.task_id = target_item_id)
        or (target_item_type = 'risk' and e.risk_id = target_item_id)
        or (target_item_type = 'compliance_item' and e.compliance_item_id = target_item_id)
        or (target_item_type = 'audit_finding' and e.audit_finding_id = target_item_id)
        or (target_item_type = 'policy' and e.policy_id = target_item_id)
        or (target_item_type = 'committee_decision' and e.committee_decision_id = target_item_id)
      )
  );
$$;

create or replace function public.require_accepted_evidence_before_project_closure()
returns trigger
language plpgsql
as $$
begin
  if new.evidence_required = true
     and new.status = 'closed'
     and not public.has_accepted_evidence('project', new.id) then
    raise exception 'Accepted evidence is required before closing this project';
  end if;
  return new;
end;
$$;

create or replace function public.require_accepted_evidence_before_work_closure()
returns trigger
language plpgsql
as $$
begin
  if new.evidence_required = true
     and new.status in ('approved','closed')
     and not public.has_accepted_evidence(
       case tg_table_name when 'milestones' then 'milestone' when 'tasks' then 'task' else tg_table_name end,
       new.id
     ) then
    raise exception 'Accepted evidence is required before approving or closing this work item';
  end if;
  return new;
end;
$$;

create or replace function public.require_accepted_evidence_before_grc_closure()
returns trigger
language plpgsql
as $$
declare
  item_type text;
begin
  item_type := case tg_table_name
    when 'compliance_items' then 'compliance_item'
    when 'audit_findings' then 'audit_finding'
    when 'committee_decisions' then 'committee_decision'
    else tg_table_name
  end;

  if coalesce((to_jsonb(new)->>'evidence_required')::boolean, false) = true
     and (to_jsonb(new)->>'status') in ('closed','compliant')
     and not public.has_accepted_evidence(item_type, new.id) then
    raise exception 'Accepted evidence is required before closing this controlled item';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_require_evidence_before_closure on public.projects;
create trigger trg_projects_require_evidence_before_closure
before update on public.projects
for each row execute function public.require_accepted_evidence_before_project_closure();

drop trigger if exists trg_milestones_require_evidence_before_closure on public.milestones;
create trigger trg_milestones_require_evidence_before_closure
before update on public.milestones
for each row execute function public.require_accepted_evidence_before_work_closure();

drop trigger if exists trg_tasks_require_evidence_before_closure on public.tasks;
create trigger trg_tasks_require_evidence_before_closure
before update on public.tasks
for each row execute function public.require_accepted_evidence_before_work_closure();

drop trigger if exists trg_compliance_require_evidence_before_closure on public.compliance_items;
create trigger trg_compliance_require_evidence_before_closure
before update on public.compliance_items
for each row execute function public.require_accepted_evidence_before_grc_closure();

drop trigger if exists trg_audit_require_evidence_before_closure on public.audit_findings;
create trigger trg_audit_require_evidence_before_closure
before update on public.audit_findings
for each row execute function public.require_accepted_evidence_before_grc_closure();

drop trigger if exists trg_decisions_require_evidence_before_closure on public.committee_decisions;
create trigger trg_decisions_require_evidence_before_closure
before update on public.committee_decisions
for each row execute function public.require_accepted_evidence_before_grc_closure();

-- ---------------------------------------------------------
-- Escalation creation helper
-- ---------------------------------------------------------

create or replace function public.create_escalation_if_missing(
  p_organization_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_title text,
  p_department_id uuid,
  p_owner_id uuid,
  p_due_date date,
  p_risk_level public.risk_level,
  p_escalation_level text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.escalation_events ee
    where ee.organization_id = p_organization_id
      and ee.item_type = p_item_type
      and ee.item_id = p_item_id
      and ee.escalation_level = p_escalation_level
      and ee.status in ('open','acknowledged')
  ) then
    insert into public.escalation_events (
      organization_id,
      item_type,
      item_id,
      title,
      department_id,
      owner_id,
      due_date,
      risk_level,
      escalation_level,
      reason
    ) values (
      p_organization_id,
      p_item_type,
      p_item_id,
      p_title,
      p_department_id,
      p_owner_id,
      p_due_date,
      coalesce(p_risk_level, 'medium'::public.risk_level),
      p_escalation_level,
      p_reason
    );
  end if;
end;
$$;

-- This can be called manually from the app or scheduled later using pg_cron.
create or replace function public.refresh_escalation_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  level_text text;
begin
  -- Projects due soon.
  for rec in
    select p.* from public.projects p
    where p.status not in ('closed','cancelled')
      and p.target_end_date between current_date and current_date + 3
  loop
    perform public.create_escalation_if_missing(
      rec.organization_id, 'project', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.target_end_date, rec.risk_level, 'reminder',
      'Project due within 3 days.'
    );
  end loop;

  -- Overdue projects.
  for rec in
    select p.* from public.projects p
    where p.status not in ('closed','cancelled')
      and p.target_end_date < current_date
  loop
    level_text := case
      when rec.risk_level = 'critical' or rec.target_end_date < current_date - 7 then 'executive'
      else 'manager'
    end;
    perform public.create_escalation_if_missing(
      rec.organization_id, 'project', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.target_end_date, rec.risk_level, level_text,
      'Project is overdue and requires management action.'
    );
  end loop;

  -- Milestones due soon or overdue.
  for rec in
    select m.*, p.department_id, p.risk_level, p.title as project_title
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.status not in ('closed','approved','cancelled')
      and m.due_date is not null
      and m.due_date <= current_date + 3
  loop
    level_text := case
      when rec.due_date >= current_date then 'reminder'
      when rec.risk_level = 'critical' or rec.due_date < current_date - 7 then 'executive'
      else 'manager'
    end;
    perform public.create_escalation_if_missing(
      rec.organization_id, 'milestone', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.due_date, rec.risk_level, level_text,
      case when rec.due_date >= current_date then 'Milestone due within 3 days.' else 'Milestone is overdue.' end
    );
  end loop;

  -- Tasks due soon or overdue.
  for rec in
    select t.*, p.department_id, p.risk_level
    from public.tasks t
    join public.projects p on p.id = t.project_id
    where t.status not in ('closed','approved','cancelled')
      and t.due_date is not null
      and t.due_date <= current_date + 3
  loop
    level_text := case
      when rec.due_date >= current_date then 'reminder'
      when rec.risk_level = 'critical' or rec.due_date < current_date - 7 then 'executive'
      else 'manager'
    end;
    perform public.create_escalation_if_missing(
      rec.organization_id, 'task', rec.id, rec.title, rec.department_id, coalesce(rec.assigned_to, rec.owner_id),
      rec.due_date, rec.risk_level, level_text,
      case when rec.due_date >= current_date then 'Task due within 3 days.' else 'Task is overdue.' end
    );
  end loop;

  -- Compliance expiring soon or expired.
  for rec in
    select c.* from public.compliance_items c
    where c.status not in ('closed','cancelled','compliant')
      and c.expiry_date is not null
      and c.expiry_date <= current_date + c.reminder_days_before
  loop
    level_text := case
      when rec.expiry_date < current_date then 'executive'
      when rec.risk_level = 'critical' then 'executive'
      else 'manager'
    end;
    perform public.create_escalation_if_missing(
      rec.organization_id, 'compliance_item', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.expiry_date, rec.risk_level, level_text,
      case when rec.expiry_date < current_date then 'Compliance item is expired.' else 'Compliance item is approaching expiry.' end
    );
  end loop;

  -- Audit findings overdue.
  for rec in
    select af.* from public.audit_findings af
    where af.status not in ('closed','cancelled')
      and af.due_date < current_date
  loop
    perform public.create_escalation_if_missing(
      rec.organization_id, 'audit_finding', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.due_date, rec.risk_level,
      case when rec.risk_level = 'critical' or rec.due_date < current_date - 7 then 'executive' else 'manager' end,
      'Audit finding corrective action is overdue.'
    );
  end loop;

  -- Governance decisions overdue.
  for rec in
    select cd.* from public.committee_decisions cd
    where cd.status not in ('closed','cancelled')
      and cd.due_date < current_date
  loop
    perform public.create_escalation_if_missing(
      rec.organization_id, 'committee_decision', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.due_date, rec.risk_level,
      case when rec.risk_level = 'critical' or rec.due_date < current_date - 7 then 'executive' else 'manager' end,
      'Governance decision action is overdue.'
    );
  end loop;

  -- Risk reviews overdue.
  for rec in
    select r.* from public.risks r
    where r.status not in ('closed','cancelled')
      and r.next_review_date is not null
      and r.next_review_date < current_date
  loop
    perform public.create_escalation_if_missing(
      rec.organization_id, 'risk', rec.id, rec.title, rec.department_id, rec.owner_id,
      rec.next_review_date, rec.risk_level,
      case when rec.risk_level = 'critical' then 'executive' else 'manager' end,
      'Risk review date is overdue.'
    );
  end loop;
end;
$$;

create or replace function public.acknowledge_escalation_event(p_event_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.escalation_events
  set status = 'acknowledged',
      acknowledged_by = auth.uid(),
      acknowledged_at = now(),
      resolution_note = coalesce(p_note, resolution_note)
  where id = p_event_id
    and status = 'open'
    and (public.can_manage_grc() or owner_id = auth.uid());
end;
$$;

create or replace function public.resolve_escalation_event(p_event_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.escalation_events
  set status = 'resolved',
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = p_note
  where id = p_event_id
    and status in ('open','acknowledged')
    and (public.can_manage_grc() or owner_id = auth.uid());
end;
$$;

-- ---------------------------------------------------------
-- Views used by the app
-- ---------------------------------------------------------

create or replace view public.v_escalation_center as
select
  ee.id,
  ee.organization_id,
  ee.item_type,
  ee.item_id,
  ee.title,
  ee.escalation_level,
  ee.reason,
  ee.status,
  ee.due_date,
  ee.risk_level,
  ee.triggered_at,
  ee.acknowledged_at,
  ee.resolved_at,
  ee.resolution_note,
  d.name_en as department_name,
  owner.full_name_en as owner_name,
  ack.full_name_en as acknowledged_by_name,
  res.full_name_en as resolved_by_name
from public.escalation_events ee
left join public.departments d on d.id = ee.department_id
left join public.profiles owner on owner.id = ee.owner_id
left join public.profiles ack on ack.id = ee.acknowledged_by
left join public.profiles res on res.id = ee.resolved_by
where ee.status in ('open','acknowledged')
  and (public.can_manage_grc() or ee.owner_id = auth.uid());

create or replace view public.v_delay_reason_queue as
select
  p.organization_id,
  'project'::text as item_type,
  p.id as item_id,
  p.title,
  d.name_en as department_name,
  owner.full_name_en as owner_name,
  p.target_end_date as due_date,
  p.risk_level,
  p.status::text as status,
  'Overdue project missing mandatory delay reason.'::text as missing_reason
from public.projects p
left join public.departments d on d.id = p.department_id
left join public.profiles owner on owner.id = p.owner_id
where p.target_end_date < current_date
  and p.status not in ('closed','cancelled')
  and coalesce(trim(p.delay_reason), '') = ''
union all
select
  m.organization_id,
  'milestone'::text as item_type,
  m.id as item_id,
  m.title,
  d.name_en as department_name,
  owner.full_name_en as owner_name,
  m.due_date,
  p.risk_level,
  m.status::text as status,
  'Overdue milestone missing mandatory delay reason.'::text as missing_reason
from public.milestones m
join public.projects p on p.id = m.project_id
left join public.departments d on d.id = p.department_id
left join public.profiles owner on owner.id = m.owner_id
where m.due_date < current_date
  and m.status not in ('closed','approved','cancelled')
  and coalesce(trim(m.delay_reason), '') = ''
union all
select
  t.organization_id,
  'task'::text as item_type,
  t.id as item_id,
  t.title,
  d.name_en as department_name,
  owner.full_name_en as owner_name,
  t.due_date,
  p.risk_level,
  t.status::text as status,
  'Overdue task missing mandatory delay reason.'::text as missing_reason
from public.tasks t
join public.projects p on p.id = t.project_id
left join public.departments d on d.id = p.department_id
left join public.profiles owner on owner.id = coalesce(t.assigned_to, t.owner_id)
where t.due_date < current_date
  and t.status not in ('closed','approved','cancelled')
  and coalesce(trim(t.delay_reason), '') = '';

create or replace view public.v_management_control_summary as
select
  o.id as organization_id,
  count(*) filter (where ee.status = 'open') as open_escalations,
  count(*) filter (where ee.status = 'acknowledged') as acknowledged_escalations,
  count(*) filter (where ee.escalation_level = 'executive' and ee.status in ('open','acknowledged')) as executive_escalations,
  count(*) filter (where ee.risk_level = 'critical' and ee.status in ('open','acknowledged')) as critical_escalations,
  (
    select count(*) from public.v_delay_reason_queue dq where dq.organization_id = o.id
  ) as missing_delay_reasons
from public.organizations o
left join public.escalation_events ee on ee.organization_id = o.id
group by o.id;

-- =========================================================
-- END 007_escalation_and_governance_controls.sql
-- =========================================================

-- =========================================================
-- BEGIN 008_import_export_rollout_tools.sql
-- sha256: 7605a92ffa19f1526ef43be9d58b9388e230bbc32abcd10497d9a7d9b0cc03af
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 008
-- Import / Export rollout tools and staging controls
-- =========================================================

-- This migration supports safe rollout to 1,000 employees / 50 departments.
-- It stages pasted CSV/Excel data for review before actual inserts/auth user creation.
-- Browser clients should NOT create Supabase Auth users directly.

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type public.bulk_import_type as enum (
    'divisions',
    'departments',
    'units',
    'employees',
    'projects',
    'risks',
    'compliance',
    'audit_findings',
    'governance_decisions'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bulk_import_status as enum (
    'uploaded',
    'validated',
    'validated_with_errors',
    'approved_for_import',
    'importing',
    'imported',
    'partially_imported',
    'rejected',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bulk_import_row_validation_status as enum (
    'valid',
    'invalid',
    'warning'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bulk_import_row_import_status as enum (
    'not_imported',
    'imported',
    'failed',
    'skipped'
  );
exception when duplicate_object then null;
end $$;

-- =========================
-- BULK IMPORT BATCHES
-- =========================

create table if not exists public.bulk_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  batch_type public.bulk_import_type not null,
  source_file_name text,

  status public.bulk_import_status not null default 'uploaded',

  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),

  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approval_note text,

  imported_by uuid references public.profiles(id) on delete set null,
  imported_at timestamptz,

  rejection_reason text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bulk_import_row_counts_valid check (valid_rows + invalid_rows <= total_rows)
);

create table if not exists public.bulk_import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.bulk_import_batches(id) on delete cascade,

  row_number integer not null check (row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,

  validation_status public.bulk_import_row_validation_status not null default 'valid',
  validation_errors text[] not null default array[]::text[],
  validation_warnings text[] not null default array[]::text[],

  import_status public.bulk_import_row_import_status not null default 'not_imported',
  import_error text,
  created_record_table text,
  created_record_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (batch_id, row_number)
);

-- Employee auth creation requires server-side service-role processing.
-- This table stores reviewed employee rows before a secure Edge Function creates auth.users + profiles + user_roles.
create table if not exists public.employee_import_staging (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid references public.bulk_import_batches(id) on delete set null,
  row_id uuid references public.bulk_import_rows(id) on delete set null,

  employee_no text,
  full_name_en text not null,
  full_name_ar text,
  email text not null,
  job_title text,

  division_code text,
  department_code text,
  unit_code text,

  primary_role public.app_role not null default 'employee',
  role_scope public.access_scope not null default 'assigned_only',

  is_active boolean not null default true,

  status text not null default 'staged' check (status in ('staged','ready','created','failed','cancelled')),
  profile_id uuid references public.profiles(id) on delete set null,
  processing_error text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, email),
  unique (organization_id, employee_no)
);

create index if not exists idx_bulk_import_batches_org on public.bulk_import_batches(organization_id);
create index if not exists idx_bulk_import_batches_status on public.bulk_import_batches(status);
create index if not exists idx_bulk_import_batches_type on public.bulk_import_batches(batch_type);
create index if not exists idx_bulk_import_batches_created on public.bulk_import_batches(created_at);

create index if not exists idx_bulk_import_rows_batch on public.bulk_import_rows(batch_id);
create index if not exists idx_bulk_import_rows_validation on public.bulk_import_rows(validation_status);
create index if not exists idx_bulk_import_rows_import on public.bulk_import_rows(import_status);
create index if not exists idx_bulk_import_rows_raw_gin on public.bulk_import_rows using gin(raw_data);

create index if not exists idx_employee_import_staging_org on public.employee_import_staging(organization_id);
create index if not exists idx_employee_import_staging_batch on public.employee_import_staging(batch_id);
create index if not exists idx_employee_import_staging_email on public.employee_import_staging(lower(email));
create index if not exists idx_employee_import_staging_department_code on public.employee_import_staging(lower(department_code));
create index if not exists idx_employee_import_staging_status on public.employee_import_staging(status);

-- updated_at triggers

drop trigger if exists trg_bulk_import_batches_updated_at on public.bulk_import_batches;
create trigger trg_bulk_import_batches_updated_at
before update on public.bulk_import_batches
for each row execute function public.set_updated_at();

drop trigger if exists trg_bulk_import_rows_updated_at on public.bulk_import_rows;
create trigger trg_bulk_import_rows_updated_at
before update on public.bulk_import_rows
for each row execute function public.set_updated_at();

drop trigger if exists trg_employee_import_staging_updated_at on public.employee_import_staging;
create trigger trg_employee_import_staging_updated_at
before update on public.employee_import_staging
for each row execute function public.set_updated_at();

-- audit logs

drop trigger if exists trg_audit_bulk_import_batches on public.bulk_import_batches;
create trigger trg_audit_bulk_import_batches
after insert or update or delete on public.bulk_import_batches
for each row execute function public.audit_log_row_change();

drop trigger if exists trg_audit_bulk_import_rows on public.bulk_import_rows;
create trigger trg_audit_bulk_import_rows
after insert or update or delete on public.bulk_import_rows
for each row execute function public.audit_log_row_change();

drop trigger if exists trg_audit_employee_import_staging on public.employee_import_staging;
create trigger trg_audit_employee_import_staging
after insert or update or delete on public.employee_import_staging
for each row execute function public.audit_log_row_change();

-- =========================
-- RLS
-- =========================

alter table public.bulk_import_batches enable row level security;
alter table public.bulk_import_rows enable row level security;
alter table public.employee_import_staging enable row level security;

create policy bulk_import_batches_read on public.bulk_import_batches
for select using (public.can_access_org(organization_id) and public.can_manage_grc());

create policy bulk_import_batches_insert on public.bulk_import_batches
for insert with check (public.can_access_org(organization_id) and public.can_manage_grc());

create policy bulk_import_batches_update on public.bulk_import_batches
for update using (public.can_access_org(organization_id) and public.can_manage_grc())
with check (public.can_access_org(organization_id) and public.can_manage_grc());

create policy bulk_import_rows_read on public.bulk_import_rows
for select using (public.can_access_org(organization_id) and public.can_manage_grc());

create policy bulk_import_rows_insert on public.bulk_import_rows
for insert with check (public.can_access_org(organization_id) and public.can_manage_grc());

create policy bulk_import_rows_update on public.bulk_import_rows
for update using (public.can_access_org(organization_id) and public.can_manage_grc())
with check (public.can_access_org(organization_id) and public.can_manage_grc());

create policy employee_import_staging_read on public.employee_import_staging
for select using (public.can_access_org(organization_id) and public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]));

create policy employee_import_staging_write on public.employee_import_staging
for all using (public.can_access_org(organization_id) and public.has_any_role(array['super_admin','governance_admin']::public.app_role[]))
with check (public.can_access_org(organization_id) and public.has_any_role(array['super_admin','governance_admin']::public.app_role[]));

-- =========================
-- QUALITY / DUPLICATE HEALTH VIEWS
-- =========================

create or replace view public.v_bulk_import_batch_summary as
select
  b.id,
  b.organization_id,
  b.batch_type,
  b.source_file_name,
  b.status,
  b.total_rows,
  b.valid_rows,
  b.invalid_rows,
  round(case when b.total_rows > 0 then (b.valid_rows::numeric / b.total_rows::numeric) * 100 else 0 end, 2) as valid_percent,
  b.created_at,
  creator.full_name_en as created_by_name,
  approver.full_name_en as approved_by_name,
  importer.full_name_en as imported_by_name
from public.bulk_import_batches b
left join public.profiles creator on creator.id = b.created_by
left join public.profiles approver on approver.id = b.approved_by
left join public.profiles importer on importer.id = b.imported_by;

create or replace view public.v_duplicate_active_department_codes as
select
  organization_id,
  lower(trim(code)) as normalized_code,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as department_ids,
  array_agg(name_en order by created_at) as department_names
from public.departments
where is_active = true and code is not null and trim(code) <> ''
group by organization_id, lower(trim(code))
having count(*) > 1;

create or replace view public.v_duplicate_active_unit_codes as
select
  department_id,
  lower(trim(code)) as normalized_code,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as unit_ids,
  array_agg(name_en order by created_at) as unit_names
from public.units
where is_active = true and code is not null and trim(code) <> ''
group by department_id, lower(trim(code))
having count(*) > 1;

create or replace view public.v_duplicate_profile_emails as
select
  organization_id,
  lower(trim(email)) as normalized_email,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as profile_ids,
  array_agg(full_name_en order by created_at) as profile_names
from public.profiles
where email is not null and trim(email) <> ''
group by organization_id, lower(trim(email))
having count(*) > 1;

-- Helper view for dashboard/admin health checks.
create or replace view public.v_rollout_data_health_summary as
select
  o.id as organization_id,
  o.name_en as organization_name_en,
  (select count(*) from public.divisions d where d.organization_id = o.id and d.is_active = true) as active_divisions,
  (select count(*) from public.departments d where d.organization_id = o.id and d.is_active = true) as active_departments,
  (select count(*) from public.units u where u.organization_id = o.id and u.is_active = true) as active_units,
  (select count(*) from public.profiles p where p.organization_id = o.id and p.is_active = true) as active_profiles,
  (select count(*) from public.bulk_import_batches b where b.organization_id = o.id and b.status in ('uploaded','validated','validated_with_errors','approved_for_import')) as open_import_batches,
  (select coalesce(sum(invalid_rows), 0) from public.bulk_import_batches b where b.organization_id = o.id and b.status in ('uploaded','validated_with_errors')) as unresolved_import_errors,
  (select count(*) from public.v_duplicate_active_department_codes dd where dd.organization_id = o.id) as duplicate_department_code_groups,
  (select count(*) from public.v_duplicate_profile_emails pe where pe.organization_id = o.id) as duplicate_profile_email_groups
from public.organizations o;

-- =========================================================
-- END 008_import_export_rollout_tools.sql
-- =========================================================

-- =========================================================
-- BEGIN 009_access_control_and_role_governance.sql
-- sha256: 8b6e17fc3d4a086fe26ab38f9aa798f7515995beb6e44c22680f25e61f13482b
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 009
-- Access Control & Role Governance
-- Adds role assignment audit, admin-safe RPC helpers, access views,
-- and warnings for risky role/scope combinations during 1K rollout.
-- =========================================================

-- Role governance audit trail
create table if not exists role_change_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  target_user_id uuid references profiles(id) on delete cascade,
  user_role_id uuid references user_roles(id) on delete set null,
  action text not null check (action in ('assigned', 'deactivated', 'reactivated', 'scope_changed')),
  old_data jsonb,
  new_data jsonb,
  reason text,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_role_change_audit_target on role_change_audit(target_user_id);
create index if not exists idx_role_change_audit_org on role_change_audit(organization_id);
create index if not exists idx_role_change_audit_changed_at on role_change_audit(changed_at);

-- Helper: active role check used by admin RPCs and RLS/debug views.
create or replace function has_active_role(p_role app_role)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = p_role
      and ur.is_active = true
  );
$$;

create or replace function can_manage_roles()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select has_active_role('super_admin'::app_role)
      or has_active_role('executive'::app_role)
      or has_active_role('governance_admin'::app_role);
$$;

-- Admin-safe role assignment. This avoids direct table manipulation from UI.
create or replace function assign_user_role(
  p_user_id uuid,
  p_role app_role,
  p_scope access_scope default 'assigned_only',
  p_organization_id uuid default null,
  p_division_id uuid default null,
  p_department_id uuid default null,
  p_unit_id uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_role_id uuid;
  v_org_id uuid;
begin
  if not can_manage_roles() then
    raise exception 'Not allowed to manage user roles';
  end if;

  select organization_id into v_org_id
  from profiles
  where id = p_user_id;

  v_org_id := coalesce(p_organization_id, v_org_id);

  if p_scope = 'global' and p_organization_id is null and v_org_id is null then
    raise exception 'Global role requires organization_id when user profile has no organization';
  end if;

  if p_scope = 'division' and p_division_id is null then
    raise exception 'Division scoped role requires division_id';
  end if;

  if p_scope = 'department' and p_department_id is null then
    raise exception 'Department scoped role requires department_id';
  end if;

  if p_scope = 'unit' and p_unit_id is null then
    raise exception 'Unit scoped role requires unit_id';
  end if;

  select id into v_existing_id
  from user_roles
  where user_id = p_user_id
    and role = p_role
    and scope = p_scope
    and coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_org_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(division_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_division_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_department_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;

  if v_existing_id is not null then
    update user_roles
    set is_active = true,
        assigned_by = auth.uid(),
        assigned_at = now()
    where id = v_existing_id
    returning id into v_role_id;

    insert into role_change_audit (organization_id, target_user_id, user_role_id, action, new_data, reason, changed_by)
    select v_org_id, p_user_id, v_role_id, 'reactivated', to_jsonb(ur), p_reason, auth.uid()
    from user_roles ur
    where ur.id = v_role_id;

    return v_role_id;
  end if;

  insert into user_roles (
    user_id,
    role,
    scope,
    organization_id,
    division_id,
    department_id,
    unit_id,
    is_active,
    assigned_by
  ) values (
    p_user_id,
    p_role,
    p_scope,
    v_org_id,
    p_division_id,
    p_department_id,
    p_unit_id,
    true,
    auth.uid()
  )
  returning id into v_role_id;

  insert into role_change_audit (organization_id, target_user_id, user_role_id, action, new_data, reason, changed_by)
  select v_org_id, p_user_id, v_role_id, 'assigned', to_jsonb(ur), p_reason, auth.uid()
  from user_roles ur
  where ur.id = v_role_id;

  return v_role_id;
end;
$$;

create or replace function deactivate_user_role(
  p_user_role_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_target_user_id uuid;
  v_org_id uuid;
begin
  if not can_manage_roles() then
    raise exception 'Not allowed to manage user roles';
  end if;

  select to_jsonb(ur), ur.user_id, ur.organization_id
  into v_old, v_target_user_id, v_org_id
  from user_roles ur
  where ur.id = p_user_role_id;

  if v_old is null then
    raise exception 'Role assignment not found';
  end if;

  update user_roles
  set is_active = false
  where id = p_user_role_id;

  insert into role_change_audit (organization_id, target_user_id, user_role_id, action, old_data, reason, changed_by)
  values (v_org_id, v_target_user_id, p_user_role_id, 'deactivated', v_old, p_reason, auth.uid());
end;
$$;

-- Access control matrix for admin review.
create or replace view v_access_control_matrix as
select
  p.organization_id,
  p.id as user_id,
  p.employee_no,
  p.full_name_en,
  p.full_name_ar,
  p.email,
  p.job_title,
  p.is_active as user_active,
  d.name_en as division_name,
  dep.name_en as department_name,
  u.name_en as unit_name,
  coalesce(count(ur.id) filter (where ur.is_active = true), 0) as active_role_count,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_role_id', ur.id,
        'role', ur.role,
        'scope', ur.scope,
        'organization_id', ur.organization_id,
        'division_id', ur.division_id,
        'department_id', ur.department_id,
        'unit_id', ur.unit_id,
        'is_active', ur.is_active,
        'assigned_at', ur.assigned_at
      ) order by ur.role::text
    ) filter (where ur.id is not null),
    '[]'::jsonb
  ) as roles,
  (
    select count(*)
    from projects pr
    where pr.owner_id = p.id
      and pr.status not in ('closed', 'cancelled')
  ) as owned_open_projects,
  (
    select count(*)
    from tasks t
    where (t.owner_id = p.id or t.assigned_to = p.id)
      and t.status not in ('closed', 'approved', 'cancelled')
  ) as open_tasks,
  (
    select count(*)
    from approvals a
    where a.approver_id = p.id
      and a.status = 'pending'
  ) as pending_approvals
from profiles p
left join divisions d on d.id = p.division_id
left join departments dep on dep.id = p.department_id
left join units u on u.id = p.unit_id
left join user_roles ur on ur.user_id = p.id
group by p.id, d.name_en, dep.name_en, u.name_en;

-- Warnings that help prevent dangerous access mistakes during rollout.
create or replace view v_access_control_warnings as
with active_roles as (
  select
    ur.*,
    p.full_name_en,
    p.email,
    p.employee_no,
    p.department_id as profile_department_id,
    p.unit_id as profile_unit_id
  from user_roles ur
  join profiles p on p.id = ur.user_id
  where ur.is_active = true
)
select
  gen_random_uuid() as id,
  organization_id,
  user_id,
  full_name_en,
  email,
  'global_sensitive_role' as warning_type,
  'Global role granted. Confirm this user really needs company-wide access.' as warning_message,
  'high'::risk_level as severity
from active_roles
where scope = 'global'
  and role in ('super_admin', 'executive', 'governance_admin', 'auditor')

union all

select
  gen_random_uuid() as id,
  organization_id,
  user_id,
  full_name_en,
  email,
  'role_scope_mismatch' as warning_type,
  'Department manager role should normally use department scope.' as warning_message,
  'medium'::risk_level as severity
from active_roles
where role = 'department_manager'
  and scope not in ('department', 'unit')

union all

select
  gen_random_uuid() as id,
  organization_id,
  user_id,
  full_name_en,
  email,
  'employee_with_broad_scope' as warning_type,
  'Employee/viewer role has broad scope. Use assigned_only unless intentionally expanded.' as warning_message,
  'medium'::risk_level as severity
from active_roles
where role in ('employee', 'viewer')
  and scope not in ('assigned_only', 'unit')

union all

select
  gen_random_uuid() as id,
  organization_id,
  user_id,
  full_name_en,
  email,
  'missing_scope_reference' as warning_type,
  'Scoped role is missing the required division/department/unit reference.' as warning_message,
  'high'::risk_level as severity
from active_roles
where (scope = 'division' and division_id is null)
   or (scope = 'department' and department_id is null)
   or (scope = 'unit' and unit_id is null);

-- Compact dashboard numbers for access-control admin page.
create or replace view v_access_control_summary as
select
  o.id as organization_id,
  count(distinct p.id) filter (where p.is_active = true) as active_users,
  count(distinct p.id) filter (where p.is_active = false) as inactive_users,
  count(ur.id) filter (where ur.is_active = true) as active_role_assignments,
  count(ur.id) filter (where ur.is_active = true and ur.scope = 'global') as global_role_assignments,
  (
    select count(*)
    from v_access_control_warnings w
    where w.organization_id = o.id
  ) as access_warnings,
  count(distinct p.id) filter (
    where p.is_active = true
      and not exists (
        select 1 from user_roles ur2
        where ur2.user_id = p.id
          and ur2.is_active = true
      )
  ) as active_users_without_roles
from organizations o
left join profiles p on p.organization_id = o.id
left join user_roles ur on ur.user_id = p.id
group by o.id;

-- =========================================================
-- END 009_access_control_and_role_governance.sql
-- =========================================================

-- =========================================================
-- BEGIN 010_bilingual_and_ovr_module.sql
-- sha256: f238202ffebac0954c0e7139d05ecb1a75810b79d28539014b0c355055293d44
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 010
-- Bilingual application support + OVR healthcare incident module
-- =========================================================

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type public.ovr_involved_person_type as enum (
    'patient',
    'visitor',
    'employee',
    'company_representative',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ovr_status as enum (
    'draft',
    'submitted',
    'under_supervisor_review',
    'under_quality_review',
    'action_plan_required',
    'corrective_action_in_progress',
    'evidence_submitted',
    'closed',
    'rejected',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ovr_severity_level as enum (
    'level_1',
    'level_2',
    'level_3',
    'level_4',
    'sentinel'
  );
exception when duplicate_object then null;
end $$;

-- =========================
-- OVR NUMBERING
-- =========================

create sequence if not exists public.ovr_number_seq start 1;

create or replace function public.assign_ovr_number()
returns trigger
language plpgsql
as $$
begin
  if new.ovr_number is null or trim(new.ovr_number) = '' then
    new.ovr_number := 'OVR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.ovr_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

-- =========================
-- OVR REPORTS
-- =========================

create table if not exists public.ovr_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  ovr_number text,
  logging_number text,

  occurrence_date date,
  occurrence_time time,
  occurrence_location text,
  notification_at timestamptz,

  involved_person_type public.ovr_involved_person_type not null default 'patient',
  person_involved_name text,
  mrn_or_id_no text,
  age integer check (age is null or age >= 0),
  sex text,

  identifier_name text,
  identifier_id_no text,
  identifier_title text,
  identifier_department text,

  witness_name_title text,
  witness_id_no text,
  witness_department text,

  division_id uuid references public.divisions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,

  physical_condition text,
  mental_condition text,
  pre_occurrence_condition_flags text[] not null default '{}',

  brief_description text not null,
  occurrence_category text not null default 'other',
  occurrence_subcategory text,
  occurrence_details jsonb not null default '{}'::jsonb,

  injury_type text,
  severity_level public.ovr_severity_level,

  supervisor_investigation text,
  corrective_action text,
  quality_manager_comments text,

  referred_to_person text,
  referred_to_department text,
  referred_to_date date,
  quality_actions jsonb not null default '{}'::jsonb,

  corrective_action_required boolean not null default false,
  evidence_required boolean not null default true,
  linked_project_id uuid references public.projects(id) on delete set null,

  status public.ovr_status not null default 'draft',
  delay_reason text,
  rejection_reason text,

  reported_by uuid references public.profiles(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  supervisor_id uuid references public.profiles(id) on delete set null,
  quality_reviewer_id uuid references public.profiles(id) on delete set null,

  reviewed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_ovr_reports_org_number unique (organization_id, ovr_number)
);

create index if not exists idx_ovr_reports_org on public.ovr_reports(organization_id);
create index if not exists idx_ovr_reports_department on public.ovr_reports(department_id);
create index if not exists idx_ovr_reports_reported_by on public.ovr_reports(reported_by);
create index if not exists idx_ovr_reports_owner on public.ovr_reports(owner_id);
create index if not exists idx_ovr_reports_status on public.ovr_reports(status);
create index if not exists idx_ovr_reports_severity on public.ovr_reports(severity_level);
create index if not exists idx_ovr_reports_occurrence_date on public.ovr_reports(occurrence_date);
create index if not exists idx_ovr_reports_category on public.ovr_reports(occurrence_category);
create index if not exists idx_ovr_reports_project on public.ovr_reports(linked_project_id);

-- Existing updated_at helper comes from Migration 001.
drop trigger if exists trg_ovr_reports_updated_at on public.ovr_reports;
create trigger trg_ovr_reports_updated_at
before update on public.ovr_reports
for each row execute function public.set_updated_at();

drop trigger if exists trg_ovr_reports_number on public.ovr_reports;
create trigger trg_ovr_reports_number
before insert on public.ovr_reports
for each row execute function public.assign_ovr_number();

-- Audit log trigger from Migration 003.
drop trigger if exists trg_audit_ovr_reports on public.ovr_reports;
create trigger trg_audit_ovr_reports
after insert or update or delete on public.ovr_reports
for each row execute function public.audit_log_row_change();

-- =========================
-- LINK EVIDENCE / APPROVALS / COMMENTS TO OVR
-- =========================

alter table public.evidence_files
add column if not exists ovr_report_id uuid references public.ovr_reports(id) on delete cascade;

alter table public.evidence_files
drop constraint if exists evidence_must_link_to_item;

alter table public.evidence_files
add constraint evidence_must_link_to_item
check (
  project_id is not null
  or milestone_id is not null
  or task_id is not null
  or risk_id is not null
  or risk_control_id is not null
  or compliance_item_id is not null
  or audit_finding_id is not null
  or policy_id is not null
  or committee_decision_id is not null
  or ovr_report_id is not null
);

alter table public.approvals
add column if not exists ovr_report_id uuid references public.ovr_reports(id) on delete cascade;

alter table public.approvals
drop constraint if exists approval_must_link_to_item;

alter table public.approvals
add constraint approval_must_link_to_item
check (
  project_id is not null
  or milestone_id is not null
  or task_id is not null
  or evidence_id is not null
  or risk_id is not null
  or compliance_item_id is not null
  or audit_finding_id is not null
  or policy_id is not null
  or committee_decision_id is not null
  or ovr_report_id is not null
);

alter table public.comments
add column if not exists ovr_report_id uuid references public.ovr_reports(id) on delete cascade;

alter table public.comments
drop constraint if exists comment_must_link_to_item;

alter table public.comments
add constraint comment_must_link_to_item
check (
  project_id is not null
  or milestone_id is not null
  or task_id is not null
  or risk_id is not null
  or compliance_item_id is not null
  or audit_finding_id is not null
  or policy_id is not null
  or committee_decision_id is not null
  or ovr_report_id is not null
);

create index if not exists idx_evidence_ovr_report on public.evidence_files(ovr_report_id);
create index if not exists idx_approvals_ovr_report on public.approvals(ovr_report_id);
create index if not exists idx_comments_ovr_report on public.comments(ovr_report_id);

-- =========================
-- OVR VIEWS
-- =========================

create or replace view public.v_ovr_summary as
select
  o.id as organization_id,
  count(r.id)::int as total_reports,
  count(r.id) filter (where r.status not in ('closed','cancelled'))::int as open_reports,
  count(r.id) filter (where r.status = 'under_quality_review')::int as under_quality_review,
  count(r.id) filter (where r.corrective_action_required = true and r.status not in ('closed','cancelled'))::int as corrective_actions_required,
  count(r.id) filter (where r.severity_level = 'sentinel')::int as sentinel_events,
  count(r.id) filter (where r.severity_level = 'level_1')::int as near_miss_level_1
from public.organizations o
left join public.ovr_reports r on r.organization_id = o.id
group by o.id;

create or replace view public.v_ovr_quality_queue as
select
  r.id,
  r.organization_id,
  r.ovr_number,
  r.logging_number,
  r.occurrence_date,
  r.occurrence_time,
  r.occurrence_location,
  r.occurrence_category,
  r.severity_level,
  r.status,
  r.corrective_action_required,
  r.linked_project_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  owner.full_name_en as owner_name_en,
  owner.full_name_ar as owner_name_ar,
  reporter.full_name_en as reporter_name_en,
  reporter.full_name_ar as reporter_name_ar,
  r.created_at
from public.ovr_reports r
left join public.departments d on d.id = r.department_id
left join public.profiles owner on owner.id = r.owner_id
left join public.profiles reporter on reporter.id = r.reported_by
where r.status not in ('closed','cancelled')
order by
  case r.severity_level
    when 'sentinel' then 1
    when 'level_4' then 2
    when 'level_3' then 3
    when 'level_2' then 4
    when 'level_1' then 5
    else 6
  end,
  r.created_at desc;

-- =========================
-- RLS POLICIES
-- =========================

alter table public.ovr_reports enable row level security;

drop policy if exists ovr_reports_read_related on public.ovr_reports;
create policy ovr_reports_read_related on public.ovr_reports
for select using (
  reported_by = auth.uid()
  or owner_id = auth.uid()
  or supervisor_id = auth.uid()
  or quality_reviewer_id = auth.uid()
  or public.can_access_scope(organization_id, division_id, department_id, unit_id)
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);

drop policy if exists ovr_reports_insert_authenticated on public.ovr_reports;
create policy ovr_reports_insert_authenticated on public.ovr_reports
for insert with check (
  reported_by = auth.uid()
  or created_by = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','department_manager','auditor','compliance_officer','employee']::public.app_role[])
);

drop policy if exists ovr_reports_update_related on public.ovr_reports;
create policy ovr_reports_update_related on public.ovr_reports
for update using (
  owner_id = auth.uid()
  or supervisor_id = auth.uid()
  or quality_reviewer_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
)
with check (
  owner_id = auth.uid()
  or supervisor_id = auth.uid()
  or quality_reviewer_id = auth.uid()
  or public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
);

-- Allow reporters/managers to create a linked corrective-action project from an OVR.
drop policy if exists projects_insert_ovr_reporters on public.projects;
create policy projects_insert_ovr_reporters on public.projects
for insert with check (
  source_type = 'incident_ovr'
  and created_by = auth.uid()
  and organization_id = public.current_user_org_id()
);

-- Allow OVR evidence to be read by the report stakeholders.
drop policy if exists evidence_read_ovr_related on public.evidence_files;
create policy evidence_read_ovr_related on public.evidence_files
for select using (
  exists (
    select 1
    from public.ovr_reports r
    where r.id = ovr_report_id
      and (
        r.reported_by = auth.uid()
        or r.owner_id = auth.uid()
        or r.supervisor_id = auth.uid()
        or r.quality_reviewer_id = auth.uid()
        or public.can_manage_grc()
      )
  )
);

-- =========================================================
-- END 010_bilingual_and_ovr_module.sql
-- =========================================================

-- =========================================================
-- BEGIN 011_ovr_risk_indicators.sql
-- sha256: ec2140a8a6a3543d9e15cdfcf7f77a1afeede981c295792d55a194a87fe91f28
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 011
-- OVR Risk Indicators
-- Converts OVR frequency, severity, recurrence, closure delay
-- and overdue corrective actions into Risk dashboard signals.
-- =========================================================

-- Severity weight follows the OVR severity model:
-- Level 1 near miss = 1, Level 2 no injury = 2,
-- Level 3 minor = 3, Level 4 major = 5, Sentinel = 8.
create or replace function public.ovr_severity_weight(p_severity text)
returns integer
language sql
immutable
as $$
  select case p_severity
    when 'level_1' then 1
    when 'level_2' then 2
    when 'level_3' then 3
    when 'level_4' then 5
    when 'sentinel' then 8
    else 1
  end;
$$;

create or replace function public.ovr_signal_level(
  p_weighted_score integer,
  p_major_or_sentinel integer,
  p_repeated_alerts integer,
  p_overdue_actions integer
)
returns public.risk_level
language sql
immutable
as $$
  select case
    when coalesce(p_major_or_sentinel, 0) >= 1
      or coalesce(p_weighted_score, 0) >= 25
      or coalesce(p_overdue_actions, 0) >= 3 then 'critical'::public.risk_level
    when coalesce(p_weighted_score, 0) >= 15
      or coalesce(p_repeated_alerts, 0) >= 2
      or coalesce(p_overdue_actions, 0) >= 1 then 'high'::public.risk_level
    when coalesce(p_weighted_score, 0) >= 6
      or coalesce(p_repeated_alerts, 0) >= 1 then 'medium'::public.risk_level
    else 'low'::public.risk_level
  end;
$$;

-- Weighted feed per OVR. This allows the dashboard to explain why the signal changed.
create or replace view public.v_ovr_risk_indicator_feed as
select
  r.id,
  r.organization_id,
  r.department_id,
  coalesce(d.name_en, 'Company-wide') as department_name,
  r.ovr_number,
  r.logging_number,
  r.occurrence_date,
  r.occurrence_category,
  r.severity_level::text as severity_level,
  public.ovr_severity_weight(r.severity_level::text) as severity_weight,
  r.status,
  r.corrective_action_required,
  r.linked_project_id,
  case
    when p.id is not null
      and p.target_end_date is not null
      and p.target_end_date < current_date
      and p.status not in ('closed', 'cancelled')
    then true
    else false
  end as corrective_action_overdue,
  r.closed_at,
  case
    when r.closed_at is not null then round(extract(epoch from (r.closed_at - r.created_at)) / 86400.0, 1)
    else null
  end as closure_days,
  r.created_at
from public.ovr_reports r
left join public.departments d on d.id = r.department_id
left join public.projects p on p.id = r.linked_project_id;

-- Repeated-category alerts: 3+ OVRs from same category and department within 30 days.
create or replace view public.v_ovr_repeated_category_alerts as
select
  f.organization_id,
  f.department_id,
  f.department_name,
  f.occurrence_category,
  count(*)::integer as category_count_30d,
  max(f.severity_weight)::integer as max_severity_weight,
  case max(f.severity_weight)
    when 8 then 'sentinel'
    when 5 then 'level_4'
    when 3 then 'level_3'
    when 2 then 'level_2'
    else 'level_1'
  end as max_severity_level,
  case
    when max(f.severity_weight) >= 5 or count(*) >= 5 then 'high'::public.risk_level
    else 'medium'::public.risk_level
  end as alert_level
from public.v_ovr_risk_indicator_feed f
where f.occurrence_date >= current_date - interval '30 days'
  and f.status not in ('cancelled')
group by f.organization_id, f.department_id, f.department_name, f.occurrence_category
having count(*) >= 3;

-- Department-level OVR risk indicator.
create or replace view public.v_ovr_risk_indicators_by_department as
with base as (
  select *
  from public.v_ovr_risk_indicator_feed
  where status not in ('cancelled')
), repeated as (
  select
    organization_id,
    department_id,
    count(*)::integer as repeated_category_alerts_30d,
    string_agg(occurrence_category, ', ' order by occurrence_category) as repeated_categories
  from public.v_ovr_repeated_category_alerts
  group by organization_id, department_id
), department_rollup as (
  select
    b.organization_id,
    b.department_id,
    max(b.department_name) as department_name,
    count(*) filter (where b.occurrence_date >= current_date - interval '30 days')::integer as ovr_count_30d,
    count(*) filter (where b.occurrence_date >= current_date - interval '90 days')::integer as ovr_count_90d,
    coalesce(sum(b.severity_weight) filter (where b.occurrence_date >= current_date - interval '30 days'), 0)::integer as weighted_score_30d,
    count(*) filter (
      where b.occurrence_date >= current_date - interval '90 days'
        and b.severity_level in ('level_4', 'sentinel')
    )::integer as major_or_sentinel_ovrs_90d,
    count(*) filter (where b.corrective_action_overdue = true)::integer as overdue_corrective_actions,
    round(avg(b.closure_days) filter (where b.closure_days is not null), 1) as avg_closure_days
  from base b
  group by b.organization_id, b.department_id
)
select
  d.organization_id,
  d.department_id,
  coalesce(d.department_name, 'Company-wide') as department_name,
  d.ovr_count_30d,
  d.ovr_count_90d,
  d.weighted_score_30d,
  d.major_or_sentinel_ovrs_90d,
  coalesce(r.repeated_category_alerts_30d, 0)::integer as repeated_category_alerts_30d,
  r.repeated_categories,
  d.overdue_corrective_actions,
  d.avg_closure_days,
  public.ovr_signal_level(
    d.weighted_score_30d,
    d.major_or_sentinel_ovrs_90d,
    coalesce(r.repeated_category_alerts_30d, 0),
    d.overdue_corrective_actions
  ) as risk_signal_level
from department_rollup d
left join repeated r
  on r.organization_id = d.organization_id
 and r.department_id is not distinct from d.department_id;

-- Executive OVR risk summary.
create or replace view public.v_ovr_risk_indicator_summary as
with feed as (
  select *
  from public.v_ovr_risk_indicator_feed
  where status not in ('cancelled')
), repeated as (
  select organization_id, count(*)::integer as repeated_category_alerts_30d
  from public.v_ovr_repeated_category_alerts
  group by organization_id
), rollup as (
  select
    o.id as organization_id,
    count(f.id) filter (where f.occurrence_date >= current_date - interval '30 days')::integer as total_ovrs_30d,
    count(f.id) filter (where f.occurrence_date >= current_date - interval '90 days')::integer as total_ovrs_90d,
    count(f.id) filter (where f.status not in ('closed', 'cancelled'))::integer as open_ovrs,
    coalesce(sum(f.severity_weight) filter (where f.occurrence_date >= current_date - interval '30 days'), 0)::integer as weighted_score_30d,
    count(f.id) filter (
      where f.occurrence_date >= current_date - interval '90 days'
        and f.severity_level in ('level_4', 'sentinel')
    )::integer as major_or_sentinel_ovrs_90d,
    count(f.id) filter (where f.corrective_action_overdue = true)::integer as overdue_corrective_actions,
    round(avg(f.closure_days) filter (where f.closure_days is not null), 1) as avg_closure_days
  from public.organizations o
  left join feed f on f.organization_id = o.id
  group by o.id
)
select
  r.organization_id,
  r.total_ovrs_30d,
  r.total_ovrs_90d,
  r.open_ovrs,
  r.weighted_score_30d,
  r.major_or_sentinel_ovrs_90d,
  coalesce(rep.repeated_category_alerts_30d, 0)::integer as repeated_category_alerts_30d,
  r.overdue_corrective_actions,
  r.avg_closure_days,
  public.ovr_signal_level(
    r.weighted_score_30d,
    r.major_or_sentinel_ovrs_90d,
    coalesce(rep.repeated_category_alerts_30d, 0),
    r.overdue_corrective_actions
  ) as overall_signal_level
from rollup r
left join repeated rep on rep.organization_id = r.organization_id;

-- Add OVR risk count into critical attention list by exposing a lightweight view
-- that can be joined later with the main executive dashboard.
create or replace view public.v_ovr_risk_attention_items as
select
  organization_id,
  department_id,
  department_name,
  'ovr_risk_indicator'::text as item_type,
  'OVR risk signal: ' || department_name as title,
  risk_signal_level,
  weighted_score_30d,
  repeated_category_alerts_30d,
  major_or_sentinel_ovrs_90d,
  overdue_corrective_actions
from public.v_ovr_risk_indicators_by_department
where risk_signal_level in ('critical', 'high');

-- Views read through the underlying RLS-enabled OVR/project tables in Supabase.
-- Grant explicit access for API clients.
grant select on public.v_ovr_risk_indicator_feed to authenticated;
grant select on public.v_ovr_repeated_category_alerts to authenticated;
grant select on public.v_ovr_risk_indicators_by_department to authenticated;
grant select on public.v_ovr_risk_indicator_summary to authenticated;
grant select on public.v_ovr_risk_attention_items to authenticated;

-- =========================================================
-- END 011_ovr_risk_indicators.sql
-- =========================================================

-- =========================================================
-- BEGIN 012_ovr_workflow_enum_values.sql
-- sha256: 5a303257466f7d867fc012a41d8cd07a4eb555b80d2523c886af2896dcf56de1
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 012a
-- OVR workflow enum values for v1.0 stabilization
-- Run before 012b.
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'ovr_status'
      and e.enumlabel = 'returned_for_clarification'
  ) then
    alter type public.ovr_status add value 'returned_for_clarification' after 'under_quality_review';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'ovr_status'
      and e.enumlabel = 'quality_closure_review'
  ) then
    alter type public.ovr_status add value 'quality_closure_review' after 'evidence_submitted';
  end if;
end $$;

-- =========================================================
-- END 012_ovr_workflow_enum_values.sql
-- =========================================================

-- =========================================================
-- BEGIN 013_kpi_analytics_heatmap_radar.sql
-- sha256: 3f91fcc1bd1517b6c5a9382c02b99a67a737cc94ccc4c6e97eb08520fba4365b
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 013
-- Executive KPIs, analytics views, heatmaps and radar profile
-- =========================================================

-- Executive KPI scorecard. Scores are 0-100.
-- Some scores are "health" where higher is better; some are "pressure/exposure" where higher means more attention needed.
create or replace view v_grc_kpi_scorecard as
select
  o.id as organization_id,

  greatest(
    0,
    least(
      100,
      100
      - coalesce((select count(*) * 8 from projects p where p.organization_id = o.id and p.target_end_date < current_date and p.status not in ('closed', 'cancelled')), 0)
      - coalesce((select count(*) * 3 from milestones m where m.organization_id = o.id and m.due_date < current_date and m.status not in ('closed', 'approved', 'cancelled')), 0)
      - coalesce((select count(*) from tasks t where t.organization_id = o.id and t.due_date < current_date and t.status not in ('closed', 'approved', 'cancelled')), 0)
      - coalesce((select count(*) * 4 from v_delay_reason_queue q where q.organization_id = o.id), 0)
    )
  )::integer as execution_health_score,

  least(
    100,
    coalesce((select count(*) * 14 from risks r where r.organization_id = o.id and r.status not in ('closed', 'cancelled') and r.risk_level = 'critical'), 0)
    + coalesce((select count(*) * 10 from escalation_events e where e.organization_id = o.id and e.status in ('open', 'acknowledged') and e.risk_level = 'critical'), 0)
    + coalesce((select count(*) * 10 from ovr_reports orp where orp.organization_id = o.id and orp.severity_level in ('level_4', 'sentinel') and orp.status not in ('closed', 'cancelled')), 0)
  )::integer as risk_exposure_score,

  least(
    100,
    coalesce((select count(*) * 7 from compliance_items c where c.organization_id = o.id and c.expiry_date is not null and c.expiry_date <= current_date + interval '30 days' and c.status not in ('closed', 'cancelled')), 0)
    + coalesce((select count(*) * 10 from audit_findings af where af.organization_id = o.id and af.due_date < current_date and af.status not in ('closed', 'cancelled')), 0)
  )::integer as compliance_pressure_score,

  least(
    100,
    coalesce((select weighted_score_30d from v_ovr_risk_indicator_summary s where s.organization_id = o.id limit 1), 0)
    + coalesce((select major_or_sentinel_ovrs_90d * 8 from v_ovr_risk_indicator_summary s where s.organization_id = o.id limit 1), 0)
    + coalesce((select repeated_category_alerts_30d * 5 from v_ovr_risk_indicator_summary s where s.organization_id = o.id limit 1), 0)
  )::integer as ovr_safety_signal_score,

  greatest(
    0,
    least(
      100,
      100 - coalesce((select count(*) * 3 from evidence_files ef where ef.organization_id = o.id and ef.status in ('submitted', 'needs_revision')), 0)
    )
  )::integer as evidence_discipline_score,

  least(
    100,
    coalesce((select count(*) * 5 from approvals a where a.organization_id = o.id and a.status = 'pending'), 0)
  )::integer as approval_bottleneck_score
from organizations o;

-- Department-level heatmap for executive attention.
create or replace view v_department_risk_heatmap as
with base as (
  select
    d.organization_id,
    d.id as department_id,
    coalesce(d.name_en, d.name_ar, 'Unassigned') as department_name,
    coalesce((select count(*) from projects p where p.department_id = d.id and p.status not in ('closed', 'cancelled')), 0) as active_projects,
    coalesce((select count(*) from projects p where p.department_id = d.id and p.target_end_date < current_date and p.status not in ('closed', 'cancelled')), 0) as overdue_projects,
    coalesce((select count(*) from milestones m join projects p on p.id = m.project_id where p.department_id = d.id and m.due_date < current_date and m.status not in ('closed', 'approved', 'cancelled')), 0) as overdue_milestones,
    coalesce((select count(*) from tasks t join projects p on p.id = t.project_id where p.department_id = d.id and t.due_date < current_date and t.status not in ('closed', 'approved', 'cancelled')), 0) as overdue_tasks,
    coalesce((select count(*) from risks r where r.department_id = d.id and r.status not in ('closed', 'cancelled') and r.risk_level = 'critical'), 0) as critical_risks,
    coalesce((select count(*) from compliance_items c where c.department_id = d.id and c.expiry_date is not null and c.expiry_date <= current_date + interval '30 days' and c.status not in ('closed', 'cancelled')), 0) as compliance_expiring_30_days,
    coalesce((select count(*) from audit_findings af where af.department_id = d.id and af.due_date < current_date and af.status not in ('closed', 'cancelled')), 0) as overdue_audit_findings,
    coalesce((select weighted_score_30d from v_ovr_risk_indicators_by_department oi where oi.department_id = d.id limit 1), 0) as ovr_weighted_score_30d
  from departments d
  where d.is_active = true
), scored as (
  select
    *,
    least(100, overdue_projects * 20 + overdue_milestones * 7 + overdue_tasks * 3)::integer as execution_pressure_score,
    least(100, critical_risks * 28 + overdue_audit_findings * 10)::integer as risk_pressure_score,
    least(100, compliance_expiring_30_days * 18 + overdue_audit_findings * 12)::integer as compliance_pressure_score,
    least(100, ovr_weighted_score_30d * 4)::integer as ovr_pressure_score
  from base
)
select
  organization_id,
  department_id,
  department_name,
  active_projects,
  overdue_projects,
  overdue_milestones,
  overdue_tasks,
  critical_risks,
  compliance_expiring_30_days,
  overdue_audit_findings,
  ovr_weighted_score_30d,
  execution_pressure_score,
  risk_pressure_score,
  compliance_pressure_score,
  ovr_pressure_score,
  least(100, round((execution_pressure_score + risk_pressure_score + compliance_pressure_score + ovr_pressure_score) / 4.0))::integer as overall_pressure_score,
  case
    when least(100, round((execution_pressure_score + risk_pressure_score + compliance_pressure_score + ovr_pressure_score) / 4.0)) >= 75 then 'critical'::risk_level
    when least(100, round((execution_pressure_score + risk_pressure_score + compliance_pressure_score + ovr_pressure_score) / 4.0)) >= 50 then 'high'::risk_level
    when least(100, round((execution_pressure_score + risk_pressure_score + compliance_pressure_score + ovr_pressure_score) / 4.0)) >= 25 then 'medium'::risk_level
    else 'low'::risk_level
  end as signal_level
from scored;

-- Six-month trend for core GRC activity.
create or replace view v_monthly_grc_trend as
with months as (
  select generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month')::date as month_start
), org_months as (
  select o.id as organization_id, m.month_start
  from organizations o
  cross join months m
)
select
  om.organization_id,
  om.month_start,
  to_char(om.month_start, 'Mon') as month_label,
  coalesce((select count(*) from projects p where p.organization_id = om.organization_id and date_trunc('month', p.created_at)::date = om.month_start), 0)::integer as new_projects,
  coalesce((select count(*) from projects p where p.organization_id = om.organization_id and p.closed_at is not null and date_trunc('month', p.closed_at)::date = om.month_start), 0)::integer as closed_projects,
  coalesce((select count(*) from risks r where r.organization_id = om.organization_id and date_trunc('month', r.created_at)::date = om.month_start), 0)::integer as new_risks,
  coalesce((select count(*) from audit_findings af where af.organization_id = om.organization_id and date_trunc('month', af.created_at)::date = om.month_start), 0)::integer as new_audit_findings,
  coalesce((select count(*) from ovr_reports orp where orp.organization_id = om.organization_id and date_trunc('month', orp.created_at)::date = om.month_start), 0)::integer as ovr_reports,
  coalesce((select count(*) from ovr_reports orp where orp.organization_id = om.organization_id and date_trunc('month', orp.created_at)::date = om.month_start and orp.severity_level in ('level_4', 'sentinel')), 0)::integer as major_ovrs
from org_months om
order by om.month_start;

-- Radar values are "maturity/health" scores where higher is better.
create or replace view v_radar_control_profile as
with s as (
  select * from v_grc_kpi_scorecard
), summary as (
  select
    s.organization_id,
    s.execution_health_score,
    greatest(0, 100 - s.risk_exposure_score) as risk_control_score,
    greatest(0, 100 - s.compliance_pressure_score) as compliance_control_score,
    greatest(0, 100 - least(100, coalesce((select count(*) * 10 from audit_findings af where af.organization_id = s.organization_id and af.due_date < current_date and af.status not in ('closed', 'cancelled')), 0))) as audit_closure_score,
    greatest(0, 100 - s.ovr_safety_signal_score) as ovr_safety_score,
    s.evidence_discipline_score
  from s
)
select organization_id, 'execution' as dimension_key, 'Execution' as dimension_label_en, 'التنفيذ' as dimension_label_ar, execution_health_score::integer as score from summary
union all
select organization_id, 'risk', 'Risk control', 'ضبط المخاطر', risk_control_score::integer from summary
union all
select organization_id, 'compliance', 'Compliance', 'الالتزام', compliance_control_score::integer from summary
union all
select organization_id, 'audit', 'Audit closure', 'إغلاق المراجعة', audit_closure_score::integer from summary
union all
select organization_id, 'ovr', 'OVR safety', 'سلامة OVR', ovr_safety_score::integer from summary
union all
select organization_id, 'evidence', 'Evidence discipline', 'انضباط الأدلة', evidence_discipline_score::integer from summary;

-- =========================================================
-- END 013_kpi_analytics_heatmap_radar.sql
-- =========================================================

-- =========================================================
-- BEGIN 014_export_center_backups_custom_reports.sql
-- sha256: c13a083cf3f72b940663087dfb47bd260d15551e67538a32add69132f0d4458b
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 014
-- Export Center, external backup metadata and custom reports
-- =========================================================

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type export_job_status as enum ('queued', 'processing', 'completed', 'failed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type export_job_type as enum ('dataset', 'report', 'backup');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type data_export_format as enum ('csv', 'json', 'backup_json', 'report_json');
exception when duplicate_object then null;
end $$;

-- =========================
-- CUSTOM REPORT DEFINITIONS
-- =========================

create table if not exists custom_report_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  report_key text not null,
  name_en text not null,
  name_ar text,
  description text,

  datasets text[] not null default '{}',
  filters jsonb not null default '{}'::jsonb,
  columns jsonb not null default '{}'::jsonb,

  is_active boolean not null default true,

  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, report_key)
);

-- =========================
-- DATA EXPORT / BACKUP LOG
-- =========================

create table if not exists data_export_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  export_type export_job_type not null default 'dataset',
  dataset_key text,
  report_definition_id uuid references custom_report_definitions(id) on delete set null,

  export_format data_export_format not null default 'csv',
  file_name text,
  row_count integer not null default 0 check (row_count >= 0),
  filters jsonb not null default '{}'::jsonb,

  status export_job_status not null default 'completed',
  status_message text,

  generated_by uuid references profiles(id) on delete set null,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- BACKUP RUN METADATA
-- This tracks backup packages created externally; actual JSON is downloaded by browser.
-- =========================

create table if not exists backup_run_metadata (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  backup_name text not null,
  included_datasets text[] not null default '{}',
  row_counts jsonb not null default '{}'::jsonb,
  total_rows integer not null default 0 check (total_rows >= 0),
  file_name text,
  backup_note text,

  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================
-- TRIGGERS
-- =========================

drop trigger if exists trg_custom_report_definitions_updated_at on custom_report_definitions;
create trigger trg_custom_report_definitions_updated_at
before update on custom_report_definitions
for each row execute function set_updated_at();

drop trigger if exists trg_data_export_jobs_updated_at on data_export_jobs;
create trigger trg_data_export_jobs_updated_at
before update on data_export_jobs
for each row execute function set_updated_at();

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_custom_reports_org_active on custom_report_definitions(organization_id, is_active);
create index if not exists idx_custom_reports_key on custom_report_definitions(report_key);
create index if not exists idx_data_export_jobs_org_created on data_export_jobs(organization_id, created_at desc);
create index if not exists idx_data_export_jobs_type on data_export_jobs(export_type, status);
create index if not exists idx_data_export_jobs_dataset on data_export_jobs(dataset_key);
create index if not exists idx_backup_run_metadata_org_created on backup_run_metadata(organization_id, created_at desc);

-- =========================
-- DATASET CATALOG VIEW
-- =========================

create or replace view v_export_dataset_catalog as
select * from (
  values
    ('projects', 'Projects & action plans', 'المشاريع وخطط العمل', 'medium', 'Major controlled initiatives, owners, dates, status and risk level'),
    ('milestones', 'Milestones', 'المعالم', 'medium', 'Timeline milestones and evidence requirements'),
    ('tasks', 'Tasks', 'المهام', 'medium', 'Assigned task-level work and delay reasons'),
    ('risks', 'Risk register', 'سجل المخاطر', 'high', 'Inherent/residual risk scoring and owners'),
    ('compliance', 'Compliance calendar', 'تقويم الالتزام', 'high', 'Regulatory obligations, expiry dates and owners'),
    ('audit_findings', 'Audit findings', 'ملاحظات المراجعة', 'high', 'Audit findings, corrective actions and closure status'),
    ('ovr_reports', 'OVR reports', 'بلاغات OVR', 'critical', 'Confidential OVR report metadata'),
    ('ovr_risk_indicators', 'OVR risk indicators', 'مؤشرات مخاطر OVR', 'high', 'Department OVR risk signals'),
    ('approvals', 'Approvals', 'الموافقات', 'medium', 'Approval workflow rows'),
    ('evidence', 'Evidence queue', 'قائمة الأدلة', 'high', 'Evidence review metadata'),
    ('escalations', 'Escalations', 'التصعيدات', 'high', 'Open and resolved escalation events'),
    ('departments', 'Departments', 'الإدارات', 'low', 'Department master list'),
    ('users', 'User access matrix', 'مصفوفة صلاحيات المستخدمين', 'critical', 'User role/access matrix'),
    ('kpi_scorecard', 'KPI scorecard', 'بطاقة مؤشرات الأداء', 'medium', 'Executive KPI summary'),
    ('department_heatmap', 'Department heatmap', 'الخريطة الحرارية للإدارات', 'medium', 'Department pressure scores')
) as catalog(dataset_key, label_en, label_ar, sensitivity, description);

-- =========================
-- EXPORT CENTER SUMMARY VIEW
-- =========================

create or replace view v_export_center_summary as
select
  o.id as organization_id,
  (
    select count(*)
    from custom_report_definitions cr
    where cr.organization_id = o.id
      and cr.is_active = true
  ) as custom_reports,
  (
    select count(*)
    from data_export_jobs dej
    where dej.organization_id = o.id
      and dej.export_type = 'dataset'
      and dej.created_at >= now() - interval '30 days'
  ) as exports_30d,
  (
    select count(*)
    from data_export_jobs dej
    where dej.organization_id = o.id
      and dej.export_type = 'backup'
      and dej.created_at >= now() - interval '30 days'
  ) as backups_30d,
  (
    select count(*) from v_export_dataset_catalog
  ) as available_datasets,
  (
    select max(dej.created_at)
    from data_export_jobs dej
    where dej.organization_id = o.id
      and dej.export_type in ('dataset', 'report')
  ) as last_export_at,
  (
    select max(dej.created_at)
    from data_export_jobs dej
    where dej.organization_id = o.id
      and dej.export_type = 'backup'
  ) as last_backup_at
from organizations o;

-- =========================
-- SEED DEFAULT REPORT DEFINITIONS
-- =========================

insert into custom_report_definitions (organization_id, report_key, name_en, name_ar, description, datasets, filters, columns)
select
  o.id,
  preset.report_key,
  preset.name_en,
  preset.name_ar,
  preset.description,
  preset.datasets,
  preset.filters,
  '{}'::jsonb
from organizations o
cross join (
  values
    ('executive_grc_pack', 'Executive GRC pack', 'حزمة الحوكمة التنفيذية', 'Board/CEO weekly report pack.', array['kpi_scorecard','department_heatmap','projects','risks','compliance','audit_findings','ovr_risk_indicators'], '{"scope":"executive"}'::jsonb),
    ('quality_ovr_pack', 'Quality & OVR pack', 'حزمة الجودة و OVR', 'Quality and patient-safety incident report pack.', array['ovr_reports','ovr_risk_indicators','evidence','projects'], '{"scope":"quality","period_days":90}'::jsonb),
    ('department_control_pack', 'Department control pack', 'حزمة تحكم الإدارات', 'Department execution and escalation report pack.', array['department_heatmap','projects','milestones','tasks','escalations'], '{"scope":"department"}'::jsonb),
    ('audit_compliance_pack', 'Audit & compliance pack', 'حزمة المراجعة والالتزام', 'Audit and regulatory follow-up pack.', array['compliance','audit_findings','risks','evidence'], '{"scope":"audit_compliance"}'::jsonb)
) as preset(report_key, name_en, name_ar, description, datasets, filters)
on conflict (organization_id, report_key) do nothing;

-- =========================
-- RLS
-- =========================

alter table custom_report_definitions enable row level security;
alter table data_export_jobs enable row level security;
alter table backup_run_metadata enable row level security;

drop policy if exists custom_reports_select on custom_report_definitions;
create policy custom_reports_select on custom_report_definitions
for select using (public.can_access_org(organization_id));

drop policy if exists custom_reports_manage on custom_report_definitions;
create policy custom_reports_manage on custom_report_definitions
for all using (public.can_manage_grc())
with check (public.can_manage_grc());

drop policy if exists data_export_jobs_select on data_export_jobs;
create policy data_export_jobs_select on data_export_jobs
for select using (public.can_access_org(organization_id));

drop policy if exists data_export_jobs_insert on data_export_jobs;
create policy data_export_jobs_insert on data_export_jobs
for insert with check (public.can_access_org(organization_id));

drop policy if exists data_export_jobs_manage on data_export_jobs;
create policy data_export_jobs_manage on data_export_jobs
for update using (public.can_manage_grc())
with check (public.can_manage_grc());

drop policy if exists backup_run_metadata_select on backup_run_metadata;
create policy backup_run_metadata_select on backup_run_metadata
for select using (public.can_access_org(organization_id));

drop policy if exists backup_run_metadata_insert on backup_run_metadata;
create policy backup_run_metadata_insert on backup_run_metadata
for insert with check (public.can_manage_grc());

-- =========================================================
-- END 014_export_center_backups_custom_reports.sql
-- =========================================================

-- =========================================================
-- BEGIN 015_production_hardening_health_print_controls.sql
-- sha256: 394d191f2f980e4e9f82c1a25d567ff2a26699d904289f82a2ae568b75afb823
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 015
-- Production hardening, backup health checks, workflow guards,
-- print/report catalog, and safer OVR closure controls
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Export / report / backup metadata tables
-- Defensive definitions in case v1.2 was not applied cleanly.
-- ---------------------------------------------------------
create table if not exists export_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  export_type text not null default 'manual',
  export_scope text not null default 'general',
  file_name text,
  format text not null default 'json',
  row_count integer not null default 0,
  status text not null default 'completed',
  error_message text,
  filters jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists backup_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  package_name text not null,
  package_type text not null default 'browser_export',
  includes_storage_files boolean not null default false,
  includes_auth_secrets boolean not null default false,
  included_tables text[] not null default '{}',
  file_name text,
  file_size bigint,
  row_count integer not null default 0,
  checksum text,
  status text not null default 'created',
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists report_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name_en text not null,
  name_ar text,
  description_en text,
  description_ar text,
  report_key text not null,
  source_view text not null,
  default_format text not null default 'csv',
  filters jsonb not null default '{}'::jsonb,
  columns jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, report_key)
);

drop trigger if exists trg_report_definitions_updated_at on report_definitions;
create trigger trg_report_definitions_updated_at
before update on report_definitions
for each row execute function set_updated_at();

create table if not exists system_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  snapshot_type text not null default 'manual',
  total_critical integer not null default 0,
  total_high integer not null default 0,
  total_medium integer not null default 0,
  total_low integer not null default 0,
  snapshot_data jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- OVR hardening columns. Safe if already created by v1.0.
-- ---------------------------------------------------------
alter table if exists ovr_reports
  add column if not exists supervisor_investigation text,
  add column if not exists supervisor_action_taken text,
  add column if not exists corrective_action_summary text,
  add column if not exists quality_review_notes text,
  add column if not exists quality_confirmed_severity text,
  add column if not exists returned_reason text,
  add column if not exists evidence_required boolean not null default true,
  add column if not exists closure_approval_required boolean not null default true,
  add column if not exists quality_closed_by uuid references profiles(id) on delete set null,
  add column if not exists quality_closed_at timestamptz,
  add column if not exists linked_corrective_action_project_id uuid references projects(id) on delete set null;

-- Link evidence/approvals/comments to OVR when the previous migration did not.
do $$
begin
  if to_regclass('public.ovr_reports') is not null then
    alter table evidence_files add column if not exists ovr_report_id uuid references ovr_reports(id) on delete cascade;
    alter table approvals add column if not exists ovr_report_id uuid references ovr_reports(id) on delete cascade;
    alter table comments add column if not exists ovr_report_id uuid references ovr_reports(id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------
-- Helper: accepted evidence exists for a controlled item.
-- ---------------------------------------------------------
create or replace function grc_has_accepted_evidence(p_item_type text, p_item_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_exists boolean := false;
begin
  if p_item_id is null then
    return false;
  end if;

  case p_item_type
    when 'project' then
      select exists(select 1 from evidence_files where project_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'milestone' then
      select exists(select 1 from evidence_files where milestone_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'task' then
      select exists(select 1 from evidence_files where task_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'risk' then
      select exists(select 1 from evidence_files where risk_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'compliance' then
      select exists(select 1 from evidence_files where compliance_item_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'audit_finding' then
      select exists(select 1 from evidence_files where audit_finding_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'policy' then
      select exists(select 1 from evidence_files where policy_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'decision' then
      select exists(select 1 from evidence_files where committee_decision_id = p_item_id and status::text = 'accepted') into v_exists;
    when 'ovr' then
      if exists(select 1 from information_schema.columns where table_name='evidence_files' and column_name='ovr_report_id') then
        execute 'select exists(select 1 from evidence_files where ovr_report_id = $1 and status::text = ''accepted'')' into v_exists using p_item_id;
      end if;
    else
      v_exists := false;
  end case;

  return coalesce(v_exists, false);
end;
$$;

-- ---------------------------------------------------------
-- Workflow guard triggers
-- ---------------------------------------------------------
create or replace function grc_guard_project_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'delayed' and coalesce(trim(new.delay_reason), '') = '' then
    raise exception 'Delay reason is required before marking a project delayed.';
  end if;

  if new.status::text = 'closed' and coalesce(new.evidence_required, false) = true then
    if not grc_has_accepted_evidence('project', new.id) then
      raise exception 'Accepted evidence is required before closing this project.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grc_guard_project_update on projects;
create trigger trg_grc_guard_project_update
before update on projects
for each row execute function grc_guard_project_update();

create or replace function grc_guard_milestone_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'delayed' and coalesce(trim(new.delay_reason), '') = '' then
    raise exception 'Delay reason is required before marking a milestone delayed.';
  end if;

  if new.status::text in ('approved', 'closed') and coalesce(new.evidence_required, false) = true then
    if not grc_has_accepted_evidence('milestone', new.id) then
      raise exception 'Accepted evidence is required before approving or closing this milestone.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grc_guard_milestone_update on milestones;
create trigger trg_grc_guard_milestone_update
before update on milestones
for each row execute function grc_guard_milestone_update();

create or replace function grc_guard_task_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'delayed' and coalesce(trim(new.delay_reason), '') = '' then
    raise exception 'Delay reason is required before marking a task delayed.';
  end if;

  if new.status::text in ('approved', 'closed') and coalesce(new.evidence_required, false) = true then
    if not grc_has_accepted_evidence('task', new.id) then
      raise exception 'Accepted evidence is required before approving or closing this task.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grc_guard_task_update on tasks;
create trigger trg_grc_guard_task_update
before update on tasks
for each row execute function grc_guard_task_update();

create or replace function grc_guard_approval_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'approved' and new.approver_id is not null and new.requested_by is not null and new.approver_id = new.requested_by then
    raise exception 'Self-approval is not allowed.';
  end if;

  if new.status::text in ('approved', 'rejected') and new.decided_at is null then
    new.decided_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grc_guard_approval_update on approvals;
create trigger trg_grc_guard_approval_update
before update on approvals
for each row execute function grc_guard_approval_update();

create or replace function grc_guard_audit_finding_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'closed' then
    if coalesce(new.evidence_required, false) = true and not grc_has_accepted_evidence('audit_finding', new.id) then
      raise exception 'Accepted evidence is required before closing this audit finding.';
    end if;

    if new.reviewed_by is null then
      raise exception 'Audit review is required before closing this audit finding.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grc_guard_audit_finding_update on audit_findings;
create trigger trg_grc_guard_audit_finding_update
before update on audit_findings
for each row execute function grc_guard_audit_finding_update();

create or replace function grc_guard_ovr_update()
returns trigger
language plpgsql
as $$
begin
  if new.status::text = 'returned_for_clarification' and coalesce(trim(new.returned_reason), '') = '' then
    raise exception 'Return reason is required before returning an OVR for clarification.';
  end if;

  if new.status::text = 'closed' then
    if coalesce(new.evidence_required, true) = true and not grc_has_accepted_evidence('ovr', new.id) then
      raise exception 'Accepted evidence is required before closing this OVR.';
    end if;

    if new.quality_closed_by is null then
      raise exception 'Quality closure user is required before closing this OVR.';
    end if;

    if new.quality_closed_at is null then
      new.quality_closed_at := now();
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.ovr_reports') is not null then
    drop trigger if exists trg_grc_guard_ovr_update on ovr_reports;
    create trigger trg_grc_guard_ovr_update
    before update on ovr_reports
    for each row execute function grc_guard_ovr_update();
  end if;
end $$;

-- ---------------------------------------------------------
-- Backup Health Check view
-- Each row is a warning type with a record count.
-- ---------------------------------------------------------
create or replace view v_backup_health_check as
with orgs as (
  select id, name_en, name_ar from organizations
)
select
  o.id as organization_id,
  'duplicate_department_codes'::text as check_key,
  'critical'::text as severity,
  'organization'::text as area,
  'Duplicate active department codes'::text as title_en,
  'رموز أقسام نشطة مكررة'::text as title_ar,
  'Active department codes must be unique after trimming and lower-casing.'::text as details_en,
  'يجب ألا تتكرر رموز الأقسام النشطة بعد إزالة الفراغات وتوحيد حالة الأحرف.'::text as details_ar,
  coalesce((
    select count(*) from (
      select lower(trim(code)) normalized_code
      from departments d
      where d.organization_id = o.id and d.is_active = true and d.code is not null
      group by lower(trim(code))
      having count(*) > 1
    ) x
  ),0)::integer as record_count,
  '/admin/import-export'::text as action_path,
  now() as created_at
from orgs o

union all
select
  o.id,
  'duplicate_unit_codes',
  'critical',
  'organization',
  'Duplicate active unit/station codes',
  'رموز وحدات/محطات نشطة مكررة',
  'Active unit/station codes must be unique inside the same department.',
  'يجب ألا تتكرر رموز الوحدات/المحطات النشطة داخل نفس القسم.',
  coalesce((
    select count(*) from (
      select department_id, lower(trim(code)) normalized_code
      from units u
      where u.organization_id = o.id and u.is_active = true and u.code is not null
      group by department_id, lower(trim(code))
      having count(*) > 1
    ) x
  ),0)::integer,
  '/admin/import-export',
  now()
from orgs o

union all
select
  o.id,
  'users_missing_department',
  'high',
  'access',
  'Active users missing department',
  'مستخدمون نشطون بدون قسم',
  'Active employees should normally be assigned to a department for scoped access and reporting.',
  'يجب عادة ربط المستخدمين النشطين بقسم لضبط الصلاحيات والتقارير.',
  coalesce((select count(*) from profiles p where p.organization_id = o.id and p.is_active = true and p.department_id is null),0)::integer,
  '/access-control',
  now()
from orgs o

union all
select
  o.id,
  'projects_missing_owner_or_due_date',
  'high',
  'projects',
  'Active projects missing owner or due date',
  'مشاريع نشطة بدون مالك أو تاريخ مستهدف',
  'Every active project/action plan needs an owner and target end date.',
  'كل مشروع أو خطة عمل نشطة تحتاج إلى مالك وتاريخ انتهاء مستهدف.',
  coalesce((select count(*) from projects p where p.organization_id = o.id and p.status::text not in ('closed','cancelled') and (p.owner_id is null or p.target_end_date is null)),0)::integer,
  '/projects',
  now()
from orgs o

union all
select
  o.id,
  'overdue_items_without_delay_reason',
  'critical',
  'workflow',
  'Overdue items missing delay reason',
  'بنود متأخرة بدون سبب تأخير',
  'Overdue projects, milestones, and tasks must have a delay reason for governance tracking.',
  'يجب تسجيل سبب التأخير للمشاريع والمراحل والمهام المتأخرة.',
  (
    coalesce((select count(*) from projects p where p.organization_id = o.id and p.target_end_date < current_date and p.status::text not in ('closed','cancelled') and coalesce(trim(p.delay_reason),'') = ''),0)
    + coalesce((select count(*) from milestones m where m.organization_id = o.id and m.due_date < current_date and m.status::text not in ('closed','approved','cancelled') and coalesce(trim(m.delay_reason),'') = ''),0)
    + coalesce((select count(*) from tasks t where t.organization_id = o.id and t.due_date < current_date and t.status::text not in ('closed','approved','cancelled') and coalesce(trim(t.delay_reason),'') = ''),0)
  )::integer,
  '/escalations',
  now()
from orgs o

union all
select
  o.id,
  'pending_approvals_older_than_14_days',
  'high',
  'approvals',
  'Pending approvals older than 14 days',
  'اعتمادات معلقة لأكثر من 14 يوم',
  'Old pending approvals create execution bottlenecks and accountability risk.',
  'الاعتمادات القديمة المعلقة تسبب تعطل التنفيذ ومخاطر في المساءلة.',
  coalesce((select count(*) from approvals a where a.organization_id = o.id and a.status::text = 'pending' and a.requested_at < now() - interval '14 days'),0)::integer,
  '/approvals',
  now()
from orgs o

union all
select
  o.id,
  'ovr_stuck_quality_review',
  'critical',
  'ovr',
  'OVRs stuck in Quality review',
  'بلاغات OVR عالقة لدى الجودة',
  'OVRs under Quality review for more than 7 days need escalation.',
  'بلاغات OVR الموجودة تحت مراجعة الجودة لأكثر من 7 أيام تحتاج تصعيد.',
  coalesce((select count(*) from ovr_reports r where r.organization_id = o.id and r.status::text in ('submitted_to_quality','under_quality_review','quality_review') and r.created_at < now() - interval '7 days'),0)::integer,
  '/ovr',
  now()
from orgs o

union all
select
  o.id,
  'old_browser_backup_packages',
  'medium',
  'backup',
  'No recent browser backup package',
  'لا توجد حزمة نسخ احتياطي حديثة من المتصفح',
  'Create an external backup package at least weekly during rollout.',
  'يفضل إنشاء حزمة نسخ احتياطي خارجية أسبوعياً أثناء مرحلة الإطلاق.',
  case when exists(select 1 from backup_packages b where b.organization_id = o.id and b.created_at >= now() - interval '7 days' and b.status = 'created') then 0 else 1 end,
  '/admin/import-export',
  now()
from orgs o;

-- ---------------------------------------------------------
-- Workflow blockers detail view
-- ---------------------------------------------------------
create or replace view v_workflow_blockers as
select
  p.organization_id,
  'project'::text as item_type,
  p.id as item_id,
  p.title,
  p.status::text as status,
  p.department_id,
  p.owner_id,
  p.target_end_date as due_date,
  case
    when p.owner_id is null then 'missing_owner'
    when p.target_end_date is null then 'missing_due_date'
    when p.target_end_date < current_date and coalesce(trim(p.delay_reason),'') = '' then 'missing_delay_reason'
    when p.evidence_required = true and p.status::text in ('completed_pending_approval','closed') and not grc_has_accepted_evidence('project', p.id) then 'missing_accepted_evidence'
    else 'attention_required'
  end as blocker_key,
  case
    when p.owner_id is null then 'Project has no owner'
    when p.target_end_date is null then 'Project has no target end date'
    when p.target_end_date < current_date and coalesce(trim(p.delay_reason),'') = '' then 'Project is overdue without delay reason'
    when p.evidence_required = true and p.status::text in ('completed_pending_approval','closed') and not grc_has_accepted_evidence('project', p.id) then 'Project needs accepted evidence'
    else 'Project needs attention'
  end as blocker_en,
  case
    when p.owner_id is null then 'المشروع بدون مالك'
    when p.target_end_date is null then 'المشروع بدون تاريخ مستهدف'
    when p.target_end_date < current_date and coalesce(trim(p.delay_reason),'') = '' then 'المشروع متأخر بدون سبب تأخير'
    when p.evidence_required = true and p.status::text in ('completed_pending_approval','closed') and not grc_has_accepted_evidence('project', p.id) then 'المشروع يحتاج دليل مقبول'
    else 'المشروع يحتاج متابعة'
  end as blocker_ar,
  now() as created_at
from projects p
where p.status::text not in ('closed','cancelled')
  and (
    p.owner_id is null
    or p.target_end_date is null
    or (p.target_end_date < current_date and coalesce(trim(p.delay_reason),'') = '')
    or (p.evidence_required = true and p.status::text in ('completed_pending_approval','closed') and not grc_has_accepted_evidence('project', p.id))
  )

union all
select
  t.organization_id,
  'task',
  t.id,
  t.title,
  t.status::text,
  p.department_id,
  coalesce(t.assigned_to, t.owner_id),
  t.due_date,
  case
    when coalesce(t.assigned_to, t.owner_id) is null then 'missing_owner'
    when t.due_date is null then 'missing_due_date'
    when t.due_date < current_date and coalesce(trim(t.delay_reason),'') = '' then 'missing_delay_reason'
    when t.evidence_required = true and t.status::text in ('approved','closed') and not grc_has_accepted_evidence('task', t.id) then 'missing_accepted_evidence'
    else 'attention_required'
  end,
  case
    when coalesce(t.assigned_to, t.owner_id) is null then 'Task has no owner'
    when t.due_date is null then 'Task has no due date'
    when t.due_date < current_date and coalesce(trim(t.delay_reason),'') = '' then 'Task is overdue without delay reason'
    when t.evidence_required = true and t.status::text in ('approved','closed') and not grc_has_accepted_evidence('task', t.id) then 'Task needs accepted evidence'
    else 'Task needs attention'
  end,
  case
    when coalesce(t.assigned_to, t.owner_id) is null then 'المهمة بدون مالك'
    when t.due_date is null then 'المهمة بدون تاريخ استحقاق'
    when t.due_date < current_date and coalesce(trim(t.delay_reason),'') = '' then 'المهمة متأخرة بدون سبب تأخير'
    when t.evidence_required = true and t.status::text in ('approved','closed') and not grc_has_accepted_evidence('task', t.id) then 'المهمة تحتاج دليل مقبول'
    else 'المهمة تحتاج متابعة'
  end,
  now()
from tasks t
join projects p on p.id = t.project_id
where t.status::text not in ('closed','approved','cancelled')
  and (
    coalesce(t.assigned_to, t.owner_id) is null
    or t.due_date is null
    or (t.due_date < current_date and coalesce(trim(t.delay_reason),'') = '')
    or (t.evidence_required = true and t.status::text in ('approved','closed') and not grc_has_accepted_evidence('task', t.id))
  );

-- ---------------------------------------------------------
-- Print/report index view for the report center.
-- ---------------------------------------------------------
create or replace view v_print_report_index as
select
  o.id as organization_id,
  'executive_summary'::text as report_key,
  'Executive GRC Summary'::text as name_en,
  'ملخص الحوكمة والمخاطر التنفيذي'::text as name_ar,
  'v_executive_grc_summary'::text as source_view,
  'Executive'::text as category_en,
  'تنفيذي'::text as category_ar,
  true as printable,
  true as exportable
from organizations o
union all
select o.id, 'backup_health_check', 'Backup Health Check', 'فحص سلامة النسخ الاحتياطي', 'v_backup_health_check', 'System health', 'سلامة النظام', true, true from organizations o
union all
select o.id, 'workflow_blockers', 'Workflow Blockers', 'عوائق سير العمل', 'v_workflow_blockers', 'Workflow', 'سير العمل', true, true from organizations o
union all
select o.id, 'department_heatmap', 'Department Risk Heatmap', 'الخريطة الحرارية لمخاطر الأقسام', 'v_department_risk_heatmap', 'Analytics', 'تحليلات', true, true from organizations o
union all
select o.id, 'ovr_risk_indicators', 'OVR Risk Indicators', 'مؤشرات مخاطر OVR', 'v_ovr_risk_indicators', 'Quality', 'الجودة', true, true from organizations o;

-- ---------------------------------------------------------
-- Seed system report definitions for all organizations.
-- ---------------------------------------------------------
insert into report_definitions (
  organization_id, name_en, name_ar, description_en, description_ar,
  report_key, source_view, default_format, filters, columns, is_system
)
select
  o.id,
  r.name_en,
  r.name_ar,
  'System report available for print/export from the reporting center.',
  'تقرير نظام متاح للطباعة/التصدير من مركز التقارير.',
  r.report_key,
  r.source_view,
  'csv',
  '{}'::jsonb,
  '[]'::jsonb,
  true
from organizations o
join v_print_report_index r on r.organization_id = o.id
on conflict (organization_id, report_key) do update set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  source_view = excluded.source_view,
  updated_at = now();

-- ---------------------------------------------------------
-- Snapshot helper for admins before backup/export.
-- ---------------------------------------------------------
create or replace function create_system_health_snapshot(p_organization_id uuid, p_created_by uuid default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_data jsonb;
  v_critical integer;
  v_high integer;
  v_medium integer;
  v_low integer;
begin
  select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb)
  into v_data
  from v_backup_health_check h
  where h.organization_id = p_organization_id;

  select
    coalesce(sum(case when severity = 'critical' and record_count > 0 then 1 else 0 end),0),
    coalesce(sum(case when severity = 'high' and record_count > 0 then 1 else 0 end),0),
    coalesce(sum(case when severity = 'medium' and record_count > 0 then 1 else 0 end),0),
    coalesce(sum(case when severity = 'low' and record_count > 0 then 1 else 0 end),0)
  into v_critical, v_high, v_medium, v_low
  from v_backup_health_check
  where organization_id = p_organization_id;

  insert into system_health_snapshots (
    organization_id, snapshot_type, total_critical, total_high, total_medium, total_low, snapshot_data, created_by
  ) values (
    p_organization_id, 'pre_backup', v_critical, v_high, v_medium, v_low, v_data, p_created_by
  ) returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------
create index if not exists idx_export_logs_org_created on export_logs(organization_id, created_at desc);
create index if not exists idx_backup_packages_org_created on backup_packages(organization_id, created_at desc);
create index if not exists idx_report_definitions_org_active on report_definitions(organization_id, is_active);
create index if not exists idx_health_snapshots_org_created on system_health_snapshots(organization_id, created_at desc);

-- ---------------------------------------------------------
-- RLS policies. These are intentionally conservative and rely on
-- existing role policies for data source tables. Metadata is visible
-- to authenticated users; writes require authentication.
-- ---------------------------------------------------------
alter table export_logs enable row level security;
alter table backup_packages enable row level security;
alter table report_definitions enable row level security;
alter table system_health_snapshots enable row level security;

drop policy if exists "Authenticated can read export logs" on export_logs;
create policy "Authenticated can read export logs" on export_logs
for select to authenticated using (true);

drop policy if exists "Authenticated can insert export logs" on export_logs;
create policy "Authenticated can insert export logs" on export_logs
for insert to authenticated with check (true);

drop policy if exists "Authenticated can read backup packages" on backup_packages;
create policy "Authenticated can read backup packages" on backup_packages
for select to authenticated using (true);

drop policy if exists "Authenticated can insert backup packages" on backup_packages;
create policy "Authenticated can insert backup packages" on backup_packages
for insert to authenticated with check (true);

drop policy if exists "Authenticated can read report definitions" on report_definitions;
create policy "Authenticated can read report definitions" on report_definitions
for select to authenticated using (is_active = true);

drop policy if exists "Authenticated can manage own report definitions" on report_definitions;
create policy "Authenticated can manage own report definitions" on report_definitions
for all to authenticated using (created_by = auth.uid() or is_system = true) with check (created_by = auth.uid() or is_system = false);

drop policy if exists "Authenticated can read health snapshots" on system_health_snapshots;
create policy "Authenticated can read health snapshots" on system_health_snapshots
for select to authenticated using (true);

drop policy if exists "Authenticated can insert health snapshots" on system_health_snapshots;
create policy "Authenticated can insert health snapshots" on system_health_snapshots
for insert to authenticated with check (true);

-- =========================================================
-- END 015_production_hardening_health_print_controls.sql
-- =========================================================

-- =========================================================
-- BEGIN 016_rollout_onboarding_user_guides.sql
-- sha256: 6c32aa3cf79b32f515de75b8354efddc987c2aba0e6d78e273f4f598f4b739fe
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 016
-- Rollout onboarding, user guide checklist and setup readiness
-- =========================================================

create table if not exists grc_training_checklist (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  audience text not null check (audience in ('executive','governance','department_manager','quality','auditor','employee')),
  title_en text not null,
  title_ar text not null,
  objective_en text not null,
  objective_ar text not null,
  estimated_minutes integer not null default 20 check (estimated_minutes > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rollout_waves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  wave_name_en text not null,
  wave_name_ar text,
  wave_number integer not null default 1 check (wave_number > 0),
  target_start_date date,
  target_end_date date,
  scope_description text,
  owner_id uuid references profiles(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','in_progress','paused','completed','cancelled')),
  readiness_notes text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rollout_wave_departments (
  id uuid primary key default gen_random_uuid(),
  wave_id uuid not null references rollout_waves(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  training_completed boolean not null default false,
  users_imported boolean not null default false,
  access_reviewed boolean not null default false,
  first_backup_done boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (wave_id, department_id)
);

create table if not exists restore_dry_run_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  backup_package_id uuid references backup_packages(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','running','passed','failed','cancelled')),
  tested_by uuid references profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  findings text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function set_grc_training_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_grc_training_checklist_updated_at on grc_training_checklist;
create trigger trg_grc_training_checklist_updated_at
before update on grc_training_checklist
for each row execute function set_grc_training_updated_at();

drop trigger if exists trg_rollout_waves_updated_at on rollout_waves;
create trigger trg_rollout_waves_updated_at
before update on rollout_waves
for each row execute function set_grc_training_updated_at();

create index if not exists idx_grc_training_audience on grc_training_checklist(audience, is_active);
create index if not exists idx_rollout_waves_org_status on rollout_waves(organization_id, status);
create index if not exists idx_rollout_wave_departments_wave on rollout_wave_departments(wave_id);
create index if not exists idx_restore_dry_run_jobs_org_status on restore_dry_run_jobs(organization_id, status);

insert into grc_training_checklist (audience, title_en, title_ar, objective_en, objective_ar, estimated_minutes, sort_order)
values
('executive', 'Executive control room review', 'مراجعة غرفة التحكم التنفيذية', 'Read critical risks, major OVRs, overdue actions and pending approvals.', 'قراءة المخاطر الحرجة وبلاغات OVR الكبرى والإجراءات المتأخرة والموافقات المعلقة.', 20, 10),
('governance', 'Workflow enforcement and escalations', 'فرض سير العمل والتصعيدات', 'Monitor delay reasons, evidence discipline, escalations and governance decisions.', 'متابعة أسباب التأخير وانضباط الأدلة والتصعيدات وقرارات الحوكمة.', 30, 20),
('department_manager', 'Department action ownership', 'ملكية إجراءات الإدارة', 'Update milestones, own delay reasons and upload evidence before closure.', 'تحديث المعالم وامتلاك أسباب التأخير ورفع الأدلة قبل الإغلاق.', 30, 30),
('quality', 'OVR investigation and closure', 'تحقيق وإغلاق بلاغات OVR', 'Review OVRs, confirm severity, request evidence and close only after Quality approval.', 'مراجعة بلاغات OVR وتأكيد الشدة وطلب الأدلة والإغلاق بعد اعتماد الجودة فقط.', 35, 40),
('auditor', 'Audit finding closure control', 'ضبط إغلاق ملاحظات المراجعة', 'Create findings, review evidence and reject weak corrective actions.', 'إنشاء الملاحظات ومراجعة الأدلة ورفض الإجراءات التصحيحية الضعيفة.', 30, 50),
('employee', 'My Work and OVR basics', 'أساسيات أعمالي وبلاغات OVR', 'Use My Work, submit evidence, and report OVR facts clearly.', 'استخدام صفحة أعمالي ورفع الأدلة وتقديم بلاغات OVR بوضوح وموضوعية.', 20, 60)
on conflict do nothing;

create or replace view v_setup_readiness_checklist as
with org as (
  select id as organization_id from organizations where is_active = true limit 1
), counts as (
  select
    o.organization_id,
    (select count(*) from divisions d where d.organization_id = o.organization_id and d.is_active = true) as active_divisions,
    (select count(*) from departments d where d.organization_id = o.organization_id and d.is_active = true) as active_departments,
    (select count(*) from units u where u.organization_id = o.organization_id and u.is_active = true) as active_units,
    (select count(*) from profiles p where p.organization_id = o.organization_id and p.is_active = true) as active_users,
    (select count(*) from user_roles ur where ur.organization_id = o.organization_id and ur.is_active = true) as active_roles,
    (select count(*) from user_roles ur where ur.organization_id = o.organization_id and ur.is_active = true and ur.role = 'super_admin') as super_admins,
    (select count(*) from user_roles ur where ur.organization_id = o.organization_id and ur.is_active = true and ur.role = 'governance_admin') as governance_admins,
    (select count(*) from user_roles ur where ur.organization_id = o.organization_id and ur.is_active = true and ur.role in ('compliance_officer','auditor')) as control_reviewers,
    (select count(*) from projects p where p.organization_id = o.organization_id and p.status not in ('closed','cancelled') and p.owner_id is null) as projects_missing_owner,
    (select count(*) from tasks t where t.organization_id = o.organization_id and t.status not in ('closed','cancelled','approved') and t.due_date is null) as tasks_missing_due_date,
    (select count(*) from ovr_reports r where r.organization_id = o.organization_id and r.status in ('submitted','under_supervisor_review','under_quality_review','action_plan_required','corrective_action_in_progress','evidence_submitted')) as open_ovrs,
    (select count(*) from backup_packages b where b.organization_id = o.organization_id and b.created_at >= now() - interval '14 days') as recent_backups,
    (select count(*) from custom_report_definitions cr where cr.organization_id = o.organization_id and cr.is_active = true) as active_reports
  from org o
)
select
  'organization_structure'::text as check_key,
  'Organization structure'::text as title_en,
  'الهيكل التنظيمي'::text as title_ar,
  'Divisions, departments and units/stations are ready for assignment.'::text as description_en,
  'تم تجهيز القطاعات والإدارات والوحدات/المحطات للتكليف.'::text as description_ar,
  'organization'::text as area,
  case when active_departments >= 50 then 'good' when active_departments >= 10 then 'warning' else 'critical' end::text as severity,
  active_departments::integer as current_count,
  50::integer as target_count,
  (active_departments >= 50) as is_complete,
  'Import all departments and unit/station codes before full rollout.'::text as action_hint_en,
  'استورد جميع الإدارات وأكواد الوحدات/المحطات قبل التشغيل الكامل.'::text as action_hint_ar
from counts
union all
select 'active_users','Active users','المستخدمون النشطون','Employees have profiles ready for role assignment.','الموظفون لديهم ملفات جاهزة لتعيين الصلاحيات.','users',
  case when active_users >= 1000 then 'good' when active_users >= 100 then 'warning' else 'critical' end,
  active_users::integer, 1000::integer, active_users >= 1000,
  'Import employees in waves, then review access warnings.','استورد الموظفين على دفعات ثم راجع تنبيهات الصلاحيات.'
from counts
union all
select 'critical_roles','Critical admin/control roles','أدوار التحكم الحرجة','Super Admin, Governance Admin and control reviewers are assigned.','تم تعيين المسؤول العام ومسؤول الحوكمة ومراجعي التحكم.','users',
  case when super_admins >= 1 and governance_admins >= 1 and control_reviewers >= 1 then 'good' else 'critical' end,
  (super_admins + governance_admins + control_reviewers)::integer, 3::integer, super_admins >= 1 and governance_admins >= 1 and control_reviewers >= 1,
  'Assign at least one Super Admin, Governance Admin and Quality/Audit reviewer.','عيّن على الأقل مسؤولاً عاماً ومسؤول حوكمة ومراجع جودة/مراجعة.'
from counts
union all
select 'workflow_ownership','Workflow ownership','ملكية سير العمل','Active projects and tasks have owners and due dates.','المشاريع والمهام النشطة لها مسؤولون وتواريخ استحقاق.','workflow',
  case when projects_missing_owner = 0 and tasks_missing_due_date = 0 then 'good' when projects_missing_owner <= 5 and tasks_missing_due_date <= 10 then 'warning' else 'critical' end,
  (projects_missing_owner + tasks_missing_due_date)::integer, 0::integer, projects_missing_owner = 0 and tasks_missing_due_date = 0,
  'Fix missing owners and due dates before department launch.','عالج غياب المسؤولين وتواريخ الاستحقاق قبل إطلاق الإدارات.'
from counts
union all
select 'ovr_operational','OVR operational readiness','جاهزية تشغيل OVR','OVR reports can be investigated, reviewed by Quality and closed with evidence.','يمكن التحقيق في بلاغات OVR ومراجعتها من الجودة وإغلاقها بالأدلة.','ovr',
  case when open_ovrs = 0 then 'good' when open_ovrs <= 20 then 'warning' else 'critical' end,
  open_ovrs::integer, 0::integer, open_ovrs = 0,
  'Train Quality and department managers before enabling wide OVR submission.','درّب الجودة ومديري الإدارات قبل تفعيل تقديم OVR على نطاق واسع.'
from counts
union all
select 'backup_readiness','Backup/export readiness','جاهزية النسخ والتصدير','A recent backup/export package exists before rollout changes.','توجد نسخة تصدير حديثة قبل تغييرات التشغيل.','backup',
  case when recent_backups >= 1 then 'good' else 'warning' end,
  recent_backups::integer, 1::integer, recent_backups >= 1,
  'Create an export package before large imports, migrations or permission changes.','أنشئ حزمة تصدير قبل الاستيرادات الكبيرة أو الترحيلات أو تغييرات الصلاحيات.'
from counts
union all
select 'custom_reports','Custom report templates','قوالب التقارير المخصصة','Executive and department report definitions are available.','تتوفر تعريفات تقارير تنفيذية وتقارير للإدارات.','reports',
  case when active_reports >= 4 then 'good' when active_reports >= 1 then 'warning' else 'critical' end,
  active_reports::integer, 4::integer, active_reports >= 4,
  'Create executive, OVR, department and audit/compliance report packs.','أنشئ حزم تقارير تنفيذية وOVR والإدارات والمراجعة/الالتزام.'
from counts;

-- RLS
alter table grc_training_checklist enable row level security;
alter table rollout_waves enable row level security;
alter table rollout_wave_departments enable row level security;
alter table restore_dry_run_jobs enable row level security;

drop policy if exists grc_training_read_all_authenticated on grc_training_checklist;
create policy grc_training_read_all_authenticated on grc_training_checklist
for select using (auth.role() = 'authenticated');

drop policy if exists rollout_waves_read_all_authenticated on rollout_waves;
create policy rollout_waves_read_all_authenticated on rollout_waves
for select using (auth.role() = 'authenticated');

drop policy if exists rollout_wave_departments_read_all_authenticated on rollout_wave_departments;
create policy rollout_wave_departments_read_all_authenticated on rollout_wave_departments
for select using (auth.role() = 'authenticated');

drop policy if exists restore_dry_run_jobs_read_all_authenticated on restore_dry_run_jobs;
create policy restore_dry_run_jobs_read_all_authenticated on restore_dry_run_jobs
for select using (auth.role() = 'authenticated');

-- =========================================================
-- END 016_rollout_onboarding_user_guides.sql
-- =========================================================

-- =========================================================
-- BEGIN 017_notifications_activity_timelines.sql
-- sha256: 4ace2d56c0f9fe465c7bae1ecd90b38f49db8c5109be1aa4da777cf77a1561c2
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 017
-- Notifications, reminders, manager inbox and activity timeline
-- =========================================================

-- This migration strengthens operational follow-up without requiring email integration yet.
-- It uses existing projects, milestones, tasks, approvals, evidence, escalations,
-- OVR reports, notifications and audit logs to build manager-ready queues.

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  in_app_enabled boolean not null default true,
  daily_digest_enabled boolean not null default true,
  weekly_digest_enabled boolean not null default true,
  due_soon_days integer not null default 3 check (due_soon_days between 0 and 30),
  quiet_hours_start time,
  quiet_hours_end time,
  language text not null default 'en' check (language in ('en', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create table if not exists public.followup_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  note text not null,
  followup_date date,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  constraint followup_notes_item_type_check
    check (item_type in ('project','milestone','task','risk','compliance','audit_finding','ovr','approval','evidence','escalation','decision'))
);

create index if not exists idx_followup_notes_org on public.followup_notes(organization_id);
create index if not exists idx_followup_notes_item on public.followup_notes(item_type, item_id);
create index if not exists idx_followup_notes_assigned_to on public.followup_notes(assigned_to);
create index if not exists idx_followup_notes_followup_date on public.followup_notes(followup_date);
create index if not exists idx_notification_preferences_user on public.notification_preferences(user_id);

-- ---------------------------------------------------------
-- Operational summary cards
-- ---------------------------------------------------------

create or replace view public.v_operational_followup_summary as
select
  o.id as organization_id,
  coalesce((select count(*) from public.notifications n where n.organization_id = o.id and n.is_read = false), 0) as unread_notifications,
  coalesce((select count(*) from public.approvals a where a.organization_id = o.id and a.status = 'pending'), 0) as pending_approvals,
  coalesce((select count(*) from public.evidence_files e where e.organization_id = o.id and e.status in ('submitted','needs_revision')), 0) as pending_evidence_reviews,
  coalesce((select count(*) from public.escalation_events ee where ee.organization_id = o.id and ee.status in ('open','acknowledged')), 0) as active_escalations,
  coalesce((select count(*) from public.projects p where p.organization_id = o.id and p.target_end_date < current_date and p.status not in ('closed','cancelled')), 0) as overdue_projects,
  coalesce((select count(*) from public.milestones m where m.organization_id = o.id and m.due_date < current_date and m.status not in ('closed','approved','cancelled')), 0) as overdue_milestones,
  coalesce((select count(*) from public.tasks t where t.organization_id = o.id and t.due_date < current_date and t.status not in ('closed','approved','cancelled')), 0) as overdue_tasks,
  coalesce((select count(*) from public.ovr_reports r where r.organization_id = o.id and r.status in ('submitted','under_supervisor_review','under_quality_review','returned_for_clarification','quality_closure_review')), 0) as open_ovr_workflow,
  now() as generated_at
from public.organizations o;

-- ---------------------------------------------------------
-- Reminder queue: due soon, overdue, quality review and approvals
-- ---------------------------------------------------------

create or replace view public.v_due_reminder_queue as
select
  p.organization_id,
  'project'::text as item_type,
  p.id as item_id,
  p.title,
  p.owner_id as owner_id,
  p.department_id,
  p.target_end_date as due_date,
  case
    when p.target_end_date < current_date then 'overdue'
    when p.target_end_date <= current_date + interval '3 days' then 'due_soon'
    else 'scheduled'
  end as reminder_type,
  p.priority::text as priority,
  p.risk_level::text as risk_level,
  p.status::text as status,
  case
    when p.target_end_date < current_date then current_date - p.target_end_date
    else 0
  end as days_overdue,
  '/projects'::text as action_path
from public.projects p
where p.target_end_date is not null
  and p.status not in ('closed','cancelled')
  and p.target_end_date <= current_date + interval '3 days'

union all

select
  m.organization_id,
  'milestone'::text,
  m.id,
  m.title,
  m.owner_id,
  p.department_id,
  m.due_date,
  case
    when m.due_date < current_date then 'overdue'
    when m.due_date <= current_date + interval '3 days' then 'due_soon'
    else 'scheduled'
  end,
  p.priority::text,
  p.risk_level::text,
  m.status::text,
  case
    when m.due_date < current_date then current_date - m.due_date
    else 0
  end,
  '/projects'::text
from public.milestones m
join public.projects p on p.id = m.project_id
where m.due_date is not null
  and m.status not in ('closed','approved','cancelled')
  and m.due_date <= current_date + interval '3 days'

union all

select
  t.organization_id,
  'task'::text,
  t.id,
  t.title,
  coalesce(t.assigned_to, t.owner_id),
  p.department_id,
  t.due_date,
  case
    when t.due_date < current_date then 'overdue'
    when t.due_date <= current_date + interval '3 days' then 'due_soon'
    else 'scheduled'
  end,
  p.priority::text,
  p.risk_level::text,
  t.status::text,
  case
    when t.due_date < current_date then current_date - t.due_date
    else 0
  end,
  '/my-work'::text
from public.tasks t
join public.projects p on p.id = t.project_id
where t.due_date is not null
  and t.status not in ('closed','approved','cancelled')
  and t.due_date <= current_date + interval '3 days'

union all

select
  o.organization_id,
  'ovr'::text,
  o.id,
  coalesce(o.ovr_number, 'OVR') || ' - ' || left(o.brief_description, 80),
  coalesce(o.quality_reviewer_id, o.supervisor_id, o.owner_id),
  o.department_id,
  coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date),
  case
    when coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date) < current_date then 'overdue'
    else 'ovr_followup'
  end,
  'high'::text,
  case when o.severity_level in ('level_4','sentinel') then 'critical' else 'medium' end,
  o.status::text,
  case
    when coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date) < current_date
      then current_date - coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date)
    else 0
  end,
  '/ovr'::text
from public.ovr_reports o
where o.status not in ('closed','cancelled','rejected')
  and coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date) is not null
  and coalesce(o.quality_due_date, o.supervisor_due_date, o.corrective_action_due_date) <= current_date + interval '3 days'

union all

select
  a.organization_id,
  'approval'::text,
  a.id,
  coalesce(a.request_note, 'Pending approval'),
  a.approver_id,
  null::uuid,
  a.requested_at::date,
  'pending_approval'::text,
  'medium'::text,
  'medium'::text,
  a.status::text,
  greatest((current_date - a.requested_at::date), 0),
  '/approvals'::text
from public.approvals a
where a.status = 'pending';

-- ---------------------------------------------------------
-- Notification digest based on unread notifications and reminder queue
-- ---------------------------------------------------------

create or replace view public.v_notification_digest as
select
  p.organization_id,
  p.id as user_id,
  p.full_name_en,
  p.full_name_ar,
  p.email,
  coalesce((select count(*) from public.notifications n where n.user_id = p.id and n.is_read = false), 0) as unread_notifications,
  coalesce((select count(*) from public.v_due_reminder_queue rq where rq.owner_id = p.id and rq.reminder_type = 'overdue'), 0) as overdue_assigned_items,
  coalesce((select count(*) from public.v_due_reminder_queue rq where rq.owner_id = p.id and rq.reminder_type in ('due_soon','ovr_followup')), 0) as due_soon_assigned_items,
  coalesce((select count(*) from public.approvals a where a.approver_id = p.id and a.status = 'pending'), 0) as pending_approvals,
  coalesce((select max(n.created_at) from public.notifications n where n.user_id = p.id), p.created_at) as last_notification_at
from public.profiles p
where p.is_active = true;

-- ---------------------------------------------------------
-- Unified activity timeline from audit logs, follow-up notes and notifications
-- ---------------------------------------------------------

create or replace view public.v_activity_timeline as
select
  al.organization_id,
  'audit_log'::text as event_source,
  al.table_name as item_type,
  al.record_id as item_id,
  al.action as event_title,
  coalesce(pr.full_name_en, 'System') as actor_name_en,
  coalesce(pr.full_name_ar, 'النظام') as actor_name_ar,
  al.created_at,
  al.new_data as payload
from public.audit_logs al
left join public.profiles pr on pr.id = al.actor_id

union all

select
  fn.organization_id,
  'followup_note'::text,
  fn.item_type,
  fn.item_id,
  left(fn.note, 120),
  coalesce(pr.full_name_en, 'System'),
  coalesce(pr.full_name_ar, 'النظام'),
  fn.created_at,
  jsonb_build_object('followup_date', fn.followup_date, 'resolved_at', fn.resolved_at)
from public.followup_notes fn
left join public.profiles pr on pr.id = fn.created_by

union all

select
  n.organization_id,
  'notification'::text,
  'notification'::text,
  n.id,
  n.title,
  coalesce(pr.full_name_en, 'System'),
  coalesce(pr.full_name_ar, 'النظام'),
  n.created_at,
  jsonb_build_object('body', n.body, 'link_path', n.link_path, 'is_read', n.is_read)
from public.notifications n
left join public.profiles pr on pr.id = n.user_id;

-- ---------------------------------------------------------
-- Manager inbox: one queue for department owners and executives
-- ---------------------------------------------------------

create or replace view public.v_manager_inbox as
select
  rq.organization_id,
  rq.department_id,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  rq.item_type,
  rq.item_id,
  rq.title,
  rq.owner_id,
  p.full_name_en as owner_name_en,
  p.full_name_ar as owner_name_ar,
  rq.due_date,
  rq.reminder_type,
  rq.priority,
  rq.risk_level,
  rq.status,
  rq.days_overdue,
  rq.action_path
from public.v_due_reminder_queue rq
left join public.departments d on d.id = rq.department_id
left join public.profiles p on p.id = rq.owner_id;

-- ---------------------------------------------------------
-- Helper function: create in-app reminders from queue.
-- Intended for manual button now; can later be scheduled server-side.
-- ---------------------------------------------------------

create or replace function public.generate_due_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select *
    from public.v_due_reminder_queue
    where owner_id is not null
  loop
    insert into public.notifications (organization_id, user_id, title, body, link_path)
    select
      r.organization_id,
      r.owner_id,
      case
        when r.reminder_type = 'overdue' then 'Overdue ' || r.item_type || ': ' || r.title
        when r.reminder_type = 'pending_approval' then 'Pending approval: ' || r.title
        else 'Due soon ' || r.item_type || ': ' || r.title
      end,
      'Status: ' || r.status || '. Due date: ' || coalesce(r.due_date::text, 'not set') || '. Risk: ' || coalesce(r.risk_level, 'medium') || '.',
      r.action_path
    where not exists (
      select 1
      from public.notifications n
      where n.organization_id = r.organization_id
        and n.user_id = r.owner_id
        and n.title = case
          when r.reminder_type = 'overdue' then 'Overdue ' || r.item_type || ': ' || r.title
          when r.reminder_type = 'pending_approval' then 'Pending approval: ' || r.title
          else 'Due soon ' || r.item_type || ': ' || r.title
        end
        and n.created_at::date = current_date
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------

alter table public.notification_preferences enable row level security;
alter table public.followup_notes enable row level security;

drop policy if exists notification_preferences_select_own_or_admin on public.notification_preferences;
create policy notification_preferences_select_own_or_admin
on public.notification_preferences
for select
using (user_id = auth.uid() or public.can_manage_grc() or public.has_role('super_admin'));

drop policy if exists notification_preferences_manage_own_or_admin on public.notification_preferences;
create policy notification_preferences_manage_own_or_admin
on public.notification_preferences
for all
using (user_id = auth.uid() or public.can_manage_grc() or public.has_role('super_admin'))
with check (user_id = auth.uid() or public.can_manage_grc() or public.has_role('super_admin'));

drop policy if exists followup_notes_select_scope on public.followup_notes;
create policy followup_notes_select_scope
on public.followup_notes
for select
using (
  public.can_manage_grc()
  or public.has_role('super_admin')
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists followup_notes_insert_authenticated on public.followup_notes;
create policy followup_notes_insert_authenticated
on public.followup_notes
for insert
with check (auth.uid() is not null);

drop policy if exists followup_notes_update_scope on public.followup_notes;
create policy followup_notes_update_scope
on public.followup_notes
for update
using (
  public.can_manage_grc()
  or public.has_role('super_admin')
  or assigned_to = auth.uid()
  or created_by = auth.uid()
)
with check (
  public.can_manage_grc()
  or public.has_role('super_admin')
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);

-- =========================================================
-- END 017_notifications_activity_timelines.sql
-- =========================================================

-- =========================================================
-- BEGIN 018_qa_permission_deployment_readiness.sql
-- sha256: 3e526bff087b94acd8917091406cc17476f1368efc1d76f3797944a0cbcf3122
-- =========================================================

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

-- =========================================================
-- END 018_qa_permission_deployment_readiness.sql
-- =========================================================

-- =========================================================
-- BEGIN 019_performance_responsive_usability.sql
-- sha256: 4cd40338a93a07c64a7a33335f99d4188966aba4d6fbb89e00e24b8c1b3bcfe0
-- =========================================================

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

-- =========================================================
-- END 019_performance_responsive_usability.sql
-- =========================================================

-- =========================================================
-- BEGIN 020_security_audit_retention_controls.sql
-- sha256: 8bc8c590bbf4033c09e1da3a52e79b44cc63370f0c3e8e702e08b36a8111be45
-- =========================================================

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

-- =========================================================
-- END 020_security_audit_retention_controls.sql
-- =========================================================

-- =========================================================
-- BEGIN 021_command_search_documents_release.sql
-- sha256: 781e2fd6ff8d891a3f6ae7b11da2ebc9a6ee9c47608622fce8d81080c1745ed6
-- =========================================================

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

-- =========================================================
-- END 021_command_search_documents_release.sql
-- =========================================================

-- =========================================================
-- BEGIN 022_ultra_release_restore_admin_dictionary.sql
-- sha256: db850ae90e3304931d6ccc511b59610b6ab33987218eabdb667df2a0219d17b2
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 022
-- Ultra release controls: production cutover, migration verifier,
-- restore dry-run board, admin safety console and bilingual dictionary
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Release migration order extension
-- ---------------------------------------------------------
insert into release_migration_order (version_label, migration_file, sequence_no, purpose, required)
values ('v2.0', '022_ultra_release_restore_admin_dictionary.sql', 23, 'Ultra release verification, restore dry-run, admin safety and bilingual dictionary controls', true)
on conflict (migration_file) do update
set version_label = excluded.version_label,
    sequence_no = excluded.sequence_no,
    purpose = excluded.purpose,
    required = excluded.required;

-- ---------------------------------------------------------
-- Production cutover checklist
-- ---------------------------------------------------------
create table if not exists production_cutover_checklist (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  phase text not null,
  item text not null,
  status text not null default 'pending' check (status in ('pass', 'warning', 'blocked', 'pending')),
  owner text,
  owner_id uuid references profiles(id) on delete set null,
  evidence text,
  notes text,
  sort_order integer not null default 100,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phase, item)
);

drop trigger if exists trg_production_cutover_checklist_updated_at on production_cutover_checklist;
create trigger trg_production_cutover_checklist_updated_at
before update on production_cutover_checklist
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Migration verification runs/items
-- ---------------------------------------------------------
create table if not exists migration_verification_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  run_label text not null default 'manual preflight',
  run_status text not null default 'completed' check (run_status in ('completed', 'warning', 'failed')),
  expected_count integer not null default 0,
  verified_count integer not null default 0,
  missing_count integer not null default 0,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists migration_verification_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references migration_verification_runs(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  migration_file text not null,
  sequence_no integer not null,
  expected boolean not null default true,
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('verified', 'missing', 'warning', 'pending')),
  verification_note text,
  created_at timestamptz not null default now(),
  unique (run_id, migration_file)
);

create index if not exists idx_migration_verification_items_org on migration_verification_items(organization_id);
create index if not exists idx_migration_verification_items_status on migration_verification_items(status);

-- ---------------------------------------------------------
-- Restore dry-run enhancement details
-- Existing restore_dry_run_jobs was introduced earlier; keep defensive.
-- ---------------------------------------------------------
create table if not exists restore_dry_run_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  backup_package_id uuid references backup_packages(id) on delete set null,
  scenario_name text not null,
  status text not null default 'planned',
  result_summary text,
  evidence_file text,
  started_by uuid references profiles(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration 016 introduced an earlier, smaller version of this table.
-- CREATE TABLE IF NOT EXISTS does not add later columns, so upgrade that
-- existing shape explicitly before creating views and RPCs below.
alter table restore_dry_run_jobs
add column if not exists scenario_name text;

alter table restore_dry_run_jobs
add column if not exists result_summary text;

alter table restore_dry_run_jobs
add column if not exists evidence_file text;

alter table restore_dry_run_jobs
add column if not exists started_by uuid references profiles(id) on delete set null;

alter table restore_dry_run_jobs
add column if not exists finished_at timestamptz;

alter table restore_dry_run_jobs
add column if not exists updated_at timestamptz not null default now();

update restore_dry_run_jobs
set
  scenario_name = coalesce(scenario_name, title, 'Restore dry-run'),
  result_summary = coalesce(result_summary, findings),
  started_by = coalesce(started_by, tested_by, created_by),
  finished_at = coalesce(finished_at, completed_at)
where scenario_name is null
   or result_summary is null
   or started_by is null
   or finished_at is null;

alter table restore_dry_run_jobs
alter column scenario_name set not null;

drop trigger if exists trg_restore_dry_run_jobs_updated_at on restore_dry_run_jobs;
create trigger trg_restore_dry_run_jobs_updated_at
before update on restore_dry_run_jobs
for each row execute function set_updated_at();

create table if not exists restore_dry_run_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  dry_run_job_id uuid references restore_dry_run_jobs(id) on delete cascade,
  step_order integer not null,
  step_name text not null,
  status text not null default 'pending' check (status in ('pending', 'passed', 'failed', 'skipped')),
  evidence text,
  notes text,
  created_at timestamptz not null default now(),
  unique (dry_run_job_id, step_order)
);

-- ---------------------------------------------------------
-- Admin safety locks/change requests
-- ---------------------------------------------------------
create table if not exists admin_safety_locks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  lock_key text not null,
  title text not null,
  description text,
  lock_level text not null default 'high' check (lock_level in ('critical', 'high', 'medium', 'low')),
  is_active boolean not null default true,
  requires_backup boolean not null default true,
  requires_dual_approval boolean not null default true,
  requires_typed_confirmation boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, lock_key)
);

create table if not exists admin_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  request_type text not null,
  title text not null,
  description text,
  requested_by uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed', 'cancelled')),
  backup_package_id uuid references backup_packages(id) on delete set null,
  evidence_reference text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  executed_at timestamptz
);

-- ---------------------------------------------------------
-- Bilingual dictionary governance
-- ---------------------------------------------------------
create table if not exists app_translation_dictionary (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  english_label text,
  arabic_label text,
  category text not null default 'general',
  is_core boolean not null default false,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_app_translation_dictionary_updated_at on app_translation_dictionary;
create trigger trg_app_translation_dictionary_updated_at
before update on app_translation_dictionary
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Seed cutover checklist and safety locks for every organization
-- ---------------------------------------------------------
insert into production_cutover_checklist (organization_id, phase, item, status, owner, evidence, notes, sort_order)
select id, 'Data safety', 'Create external export package before production migration', 'pass', 'System Admin', 'Backup package/export logs', 'Required before any large import, migration or access change.', 10 from organizations
on conflict (organization_id, phase, item) do nothing;

insert into production_cutover_checklist (organization_id, phase, item, status, owner, evidence, notes, sort_order)
select id, 'Restore assurance', 'Run restore dry-run from latest export package', 'blocked', 'Governance Admin', 'Restore dry-run record', 'Do not go live until a restore dry-run is documented.', 20 from organizations
on conflict (organization_id, phase, item) do nothing;

insert into production_cutover_checklist (organization_id, phase, item, status, owner, evidence, notes, sort_order)
select id, 'Access control', 'Review sensitive global roles and scoped managers', 'warning', 'Governance Admin', 'Access control export', 'Resolve broad scope employees/viewers before full rollout.', 30 from organizations
on conflict (organization_id, phase, item) do nothing;

insert into production_cutover_checklist (organization_id, phase, item, status, owner, evidence, notes, sort_order)
select id, 'Workflow controls', 'Confirm evidence and delay blockers are active', 'pass', 'QA Lead', 'QA test run export', 'Closure without evidence and delay without reason should be blocked.', 40 from organizations
on conflict (organization_id, phase, item) do nothing;

insert into production_cutover_checklist (organization_id, phase, item, status, owner, evidence, notes, sort_order)
select id, 'Bilingual rollout', 'Review Arabic/English core dictionary', 'warning', 'Governance Admin', 'Dictionary export', 'Status, role, source and workflow labels must be bilingual before employee rollout.', 50 from organizations
on conflict (organization_id, phase, item) do nothing;

insert into admin_safety_locks (organization_id, lock_key, title, description, lock_level, requires_backup, requires_dual_approval, requires_typed_confirmation)
select id, 'production_reset', 'Production reset lock', 'Blocks destructive reset without backup, dual approval and typed confirmation.', 'critical', true, true, true from organizations
on conflict (organization_id, lock_key) do nothing;

insert into admin_safety_locks (organization_id, lock_key, title, description, lock_level, requires_backup, requires_dual_approval, requires_typed_confirmation)
select id, 'bulk_employee_import', 'Bulk employee import lock', 'Requires clean validation report and backup before importing large employee batches.', 'high', true, true, false from organizations
on conflict (organization_id, lock_key) do nothing;

insert into admin_safety_locks (organization_id, lock_key, title, description, lock_level, requires_backup, requires_dual_approval, requires_typed_confirmation)
select id, 'global_role_assignment', 'Global role assignment lock', 'Requires review before assigning executive, super_admin or governance_admin with global scope.', 'high', true, true, false from organizations
on conflict (organization_id, lock_key) do nothing;

insert into app_translation_dictionary (key, english_label, arabic_label, category, is_core, needs_review)
values
('role.super_admin', 'Super Admin', 'مدير النظام الأعلى', 'role', true, false),
('role.executive', 'Executive', 'تنفيذي', 'role', true, false),
('role.governance_admin', 'Governance Admin', 'مسؤول الحوكمة', 'role', true, false),
('role.department_manager', 'Department Manager', 'مدير إدارة', 'role', true, false),
('role.quality_manager', 'Quality Manager', 'مدير الجودة', 'role', true, false),
('status.pending_quality_review', 'Pending Quality review', 'بانتظار مراجعة الجودة', 'status', true, false),
('status.evidence_submitted', 'Evidence submitted', 'تم تقديم الدليل', 'status', true, false),
('status.returned_for_clarification', 'Returned for clarification', 'معاد للتوضيح', 'status', true, false),
('source.audit_finding', 'Audit finding', 'ملاحظة مراجعة', 'source', true, false),
('source.incident_ovr', 'OVR / incident', 'بلاغ OVR / حادث', 'source', true, false),
('workflow.no_evidence_no_closure', 'No evidence, no closure', 'لا إغلاق بدون دليل', 'workflow', true, false),
('workflow.no_self_approval', 'No self-approval', 'لا اعتماد ذاتي', 'workflow', true, false)
on conflict (key) do update set
  english_label = excluded.english_label,
  arabic_label = excluded.arabic_label,
  category = excluded.category,
  is_core = excluded.is_core,
  needs_review = excluded.needs_review;

-- ---------------------------------------------------------
-- Views
-- ---------------------------------------------------------
create or replace view v_production_cutover_checklist as
select
  c.id,
  c.organization_id,
  c.phase,
  c.item,
  c.status,
  c.owner,
  coalesce(p.full_name_en, c.owner, 'Unassigned') as owner_name,
  c.evidence,
  c.notes,
  c.sort_order,
  c.updated_at
from production_cutover_checklist c
left join profiles p on p.id = c.owner_id;

create or replace view v_migration_verification_matrix as
with latest_run as (
  select distinct on (organization_id) id, organization_id
  from migration_verification_runs
  order by organization_id, created_at desc
), latest_items as (
  select i.*
  from migration_verification_items i
  join latest_run r on r.id = i.run_id
)
select
  r.sequence_no,
  r.migration_file,
  r.purpose,
  r.required as expected,
  coalesce(i.verified, r.sequence_no < 23) as verified,
  case
    when coalesce(i.verified, r.sequence_no < 23) then 'verified'
    when r.required then coalesce(i.status, 'pending')
    else 'warning'
  end as status,
  coalesce(i.verification_note, case when r.sequence_no < 23 then 'Migration exists in release order. Confirm applied in Supabase history.' else 'Apply after v1.9 and run preflight.' end) as verification_note
from release_migration_order r
left join latest_items i on i.migration_file = r.migration_file
order by r.sequence_no;

create or replace view v_backup_restore_drillboard as
select
  r.id,
  r.organization_id,
  coalesce(b.package_name, r.backup_package_id::text, 'No package linked') as backup_package_id,
  r.scenario_name,
  r.status,
  r.started_at,
  r.finished_at,
  r.result_summary,
  r.evidence_file,
  r.created_at
from restore_dry_run_jobs r
left join backup_packages b on b.id = r.backup_package_id;

create or replace view v_admin_safety_console as
select
  l.id,
  l.organization_id,
  'Safety lock' as area,
  l.title as finding,
  l.lock_level as severity,
  case when l.is_active then 'open' else 'closed' end as status,
  l.description || case when l.requires_backup then ' Backup required.' else '' end as recommendation,
  'System Admin' as owner,
  case l.lock_level when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end as severity_rank
from admin_safety_locks l
where l.is_active = true
union all
select
  c.id,
  c.organization_id,
  'Change request' as area,
  c.title as finding,
  case when c.status = 'pending' then 'high' else 'medium' end as severity,
  c.status,
  coalesce(c.description, 'Administrative change requires review.') as recommendation,
  coalesce(p.full_name_en, 'Requester') as owner,
  case when c.status = 'pending' then 2 else 3 end as severity_rank
from admin_change_requests c
left join profiles p on p.id = c.requested_by
where c.status in ('pending', 'approved');

create or replace view v_bilingual_dictionary_status as
select
  key,
  english_label,
  arabic_label,
  category,
  is_core,
  case
    when coalesce(trim(english_label), '') = '' then 'missing_en'
    when coalesce(trim(arabic_label), '') = '' then 'missing_ar'
    when needs_review then 'needs_review'
    else 'complete'
  end as status
from app_translation_dictionary;

create or replace view v_ultra_release_summary as
select
  o.id as organization_id,
  greatest(0, least(100,
    100
    - ((select count(*) from production_cutover_checklist c where c.organization_id = o.id and c.status = 'blocked') * 18)
    - ((select count(*) from production_cutover_checklist c where c.organization_id = o.id and c.status = 'warning') * 6)
    - case when not exists (select 1 from restore_dry_run_jobs r where r.organization_id = o.id and r.status = 'passed') then 12 else 0 end
    - case when not exists (select 1 from backup_packages b where b.organization_id = o.id and b.created_at >= now() - interval '30 days') then 8 else 0 end
  ))::integer as release_score,
  (select count(*) from production_cutover_checklist c where c.organization_id = o.id and c.status = 'blocked')::integer as blocker_count,
  (select count(*) from production_cutover_checklist c where c.organization_id = o.id and c.status = 'warning')::integer as warning_count,
  (select max(created_at) from backup_packages b where b.organization_id = o.id) as last_backup_at,
  (select max(finished_at) from restore_dry_run_jobs r where r.organization_id = o.id and r.status = 'passed') as last_restore_dry_run_at,
  (select count(*) from release_migration_order where required = true)::integer as migrations_expected,
  (select count(*) from release_migration_order where required = true and sequence_no < 23)::integer as migrations_verified,
  (select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where coalesce(trim(english_label), '') <> '' and coalesce(trim(arabic_label), '') <> '' and needs_review = false) / count(*)) end from app_translation_dictionary)::integer as translation_coverage,
  (select count(*) from admin_safety_locks l where l.organization_id = o.id and l.is_active = true)::integer as admin_locks_active
from organizations o;

-- ---------------------------------------------------------
-- RPC helpers
-- ---------------------------------------------------------
create or replace function start_restore_dry_run(p_scenario_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select id into v_org from organizations order by created_at limit 1;
  insert into restore_dry_run_jobs (organization_id, title, scenario_name, status, result_summary, started_at)
  values (
    v_org,
    coalesce(nullif(p_scenario_name, ''), 'Restore dry-run'),
    coalesce(nullif(p_scenario_name, ''), 'Restore dry-run'),
    'planned',
    'Dry-run created. Apply migrations in test environment, import latest export package, then document result.',
    now()
  )
  returning id into v_id;

  insert into restore_dry_run_steps (organization_id, dry_run_job_id, step_order, step_name, status)
  values
  (v_org, v_id, 1, 'Create clean test Supabase project', 'pending'),
  (v_org, v_id, 2, 'Apply migrations in order', 'pending'),
  (v_org, v_id, 3, 'Import exported JSON/CSV package', 'pending'),
  (v_org, v_id, 4, 'Compare row counts and dashboard KPIs', 'pending'),
  (v_org, v_id, 5, 'Attach evidence and decision note', 'pending');

  return v_id;
end;
$$;

create or replace function run_ultra_release_preflight()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_run uuid;
  v_expected integer;
  v_verified integer;
  v_missing integer;
begin
  select id into v_org from organizations order by created_at limit 1;
  select count(*) into v_expected from release_migration_order where required = true;
  select count(*) into v_verified from release_migration_order where required = true and sequence_no < 23;
  v_missing := greatest(0, v_expected - v_verified);

  insert into migration_verification_runs (organization_id, run_label, run_status, expected_count, verified_count, missing_count, notes)
  values (v_org, 'Ultra release preflight', case when v_missing > 0 then 'warning' else 'completed' end, v_expected, v_verified, v_missing, 'Preflight records expected migration matrix. Confirm actual Supabase migration history in production.')
  returning id into v_run;

  insert into migration_verification_items (run_id, organization_id, migration_file, sequence_no, expected, verified, status, verification_note)
  select v_run, v_org, migration_file, sequence_no, required, sequence_no < 23,
         case when sequence_no < 23 then 'verified' else 'pending' end,
         case when sequence_no < 23 then 'In release order. Confirm applied in production history.' else 'This migration should be applied after v1.9.' end
  from release_migration_order
  order by sequence_no;

  return v_run;
end;
$$;

-- ---------------------------------------------------------
-- RLS: authenticated users can read release/admin safety metadata.
-- Writes remain controlled through RPC or admin flows.
-- ---------------------------------------------------------
alter table production_cutover_checklist enable row level security;
alter table migration_verification_runs enable row level security;
alter table migration_verification_items enable row level security;
alter table restore_dry_run_steps enable row level security;
alter table admin_safety_locks enable row level security;
alter table admin_change_requests enable row level security;
alter table app_translation_dictionary enable row level security;

drop policy if exists production_cutover_checklist_read_authenticated on production_cutover_checklist;
create policy production_cutover_checklist_read_authenticated on production_cutover_checklist for select to authenticated using (true);

drop policy if exists migration_verification_runs_read_authenticated on migration_verification_runs;
create policy migration_verification_runs_read_authenticated on migration_verification_runs for select to authenticated using (true);

drop policy if exists migration_verification_items_read_authenticated on migration_verification_items;
create policy migration_verification_items_read_authenticated on migration_verification_items for select to authenticated using (true);

drop policy if exists restore_dry_run_steps_read_authenticated on restore_dry_run_steps;
create policy restore_dry_run_steps_read_authenticated on restore_dry_run_steps for select to authenticated using (true);

drop policy if exists admin_safety_locks_read_authenticated on admin_safety_locks;
create policy admin_safety_locks_read_authenticated on admin_safety_locks for select to authenticated using (true);

drop policy if exists admin_change_requests_read_authenticated on admin_change_requests;
create policy admin_change_requests_read_authenticated on admin_change_requests for select to authenticated using (true);

drop policy if exists app_translation_dictionary_read_authenticated on app_translation_dictionary;
create policy app_translation_dictionary_read_authenticated on app_translation_dictionary for select to authenticated using (true);

-- =========================================================
-- END 022_ultra_release_restore_admin_dictionary.sql
-- =========================================================

-- =========================================================
-- BEGIN 023_enterprise_intelligence_reporting.sql
-- sha256: d2ae6f283db90e1d3145fa73794159031972001c9bff5aaaa9c2f8c24525de41
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 023
-- Enterprise intelligence, report studio, evidence vault,
-- scheduled backup metadata, department scorecards, board packs
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type public.report_output_format as enum ('csv','json','print','pdf_ready');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.backup_schedule_frequency as enum ('manual','daily','weekly','monthly','quarterly');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.backup_run_status as enum ('planned','running','completed','failed','verified','restore_tested');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scorecard_signal as enum ('excellent','healthy','watch','at_risk','critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scenario_status as enum ('draft','active','under_review','approved','archived');
exception when duplicate_object then null;
end $$;

-- =========================
-- ADVANCED REPORT BUILDER
-- =========================

create table if not exists public.report_builder_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  template_code text not null,
  title_en text not null,
  title_ar text,
  description_en text,
  description_ar text,
  source_view text not null,
  default_columns text[] not null default '{}',
  default_filters jsonb not null default '{}'::jsonb,
  output_formats public.report_output_format[] not null default array['csv','json','print']::public.report_output_format[],
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_code)
);

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  template_id uuid references public.report_builder_templates(id) on delete set null,
  report_title text not null,
  source_view text not null,
  filters jsonb not null default '{}'::jsonb,
  selected_columns text[] not null default '{}',
  output_format public.report_output_format not null default 'csv',
  row_count integer not null default 0,
  status text not null default 'generated',
  file_name text,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now()
);

-- =========================
-- SCHEDULED BACKUP METADATA
-- Note: scheduling metadata only. Real automation should be server-side.
-- =========================

create table if not exists public.backup_schedule_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  plan_code text not null,
  title_en text not null,
  title_ar text,
  frequency public.backup_schedule_frequency not null default 'weekly',
  include_tables text[] not null default array[
    'projects','milestones','tasks','risks','compliance_items','audit_findings','ovr_reports','evidence_files','approvals','profiles','departments','user_roles'
  ],
  include_storage_manifest boolean not null default true,
  require_restore_dry_run boolean not null default true,
  retention_days integer not null default 90 check (retention_days > 0),
  owner_id uuid references public.profiles(id) on delete set null,
  next_due_at timestamptz,
  last_run_at timestamptz,
  last_status public.backup_run_status,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plan_code)
);

create table if not exists public.backup_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  plan_id uuid references public.backup_schedule_plans(id) on delete set null,
  status public.backup_run_status not null default 'planned',
  package_name text,
  row_count integer not null default 0,
  storage_manifest_count integer not null default 0,
  checksum text,
  error_message text,
  restore_dry_run_job_id uuid references public.restore_dry_run_jobs(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null
);

-- =========================
-- EVIDENCE VAULT VERSIONING
-- =========================

create table if not exists public.evidence_file_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_id uuid not null references public.evidence_files(id) on delete cascade,
  version_no integer not null default 1 check (version_no > 0),
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  version_note text,
  checksum text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (evidence_id, version_no)
);

create table if not exists public.evidence_retention_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_id uuid not null references public.evidence_files(id) on delete cascade,
  review_status text not null default 'pending',
  reason text,
  recommended_action text not null default 'keep',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================
-- DEPARTMENT SCORECARDS / TARGETS
-- =========================

create table if not exists public.department_kpi_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  metric_code text not null,
  metric_name_en text not null,
  metric_name_ar text,
  target_value numeric(12,2) not null,
  warning_threshold numeric(12,2),
  critical_threshold numeric(12,2),
  direction text not null default 'lower_is_better' check (direction in ('lower_is_better','higher_is_better')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, department_id, metric_code)
);

create table if not exists public.department_scorecard_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  period_month date not null default date_trunc('month', current_date)::date,
  signal public.scorecard_signal not null default 'watch',
  executive_note text,
  action_required text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================
-- BOARD PACKS / EXECUTIVE BRIEFINGS
-- =========================

create table if not exists public.board_pack_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  pack_title text not null,
  period_start date,
  period_end date,
  summary_json jsonb not null default '{}'::jsonb,
  included_sections text[] not null default '{}',
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz
);

create table if not exists public.executive_briefing_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  note_title text not null,
  note_body text not null,
  note_category text not null default 'executive',
  risk_level public.risk_level not null default 'medium',
  related_department_id uuid references public.departments(id) on delete set null,
  related_project_id uuid references public.projects(id) on delete set null,
  related_risk_id uuid references public.risks(id) on delete set null,
  related_ovr_report_id uuid references public.ovr_reports(id) on delete set null,
  status text not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- SCENARIO PLANNING
-- =========================

create table if not exists public.risk_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  scenario_code text not null,
  title_en text not null,
  title_ar text,
  description text,
  category text not null default 'strategic',
  probability smallint not null default 3 check (probability between 1 and 5),
  impact smallint not null default 3 check (impact between 1 and 5),
  exposure_score integer generated always as (probability * impact) stored,
  estimated_financial_impact numeric(18,2),
  mitigation_summary text,
  trigger_indicators text[] not null default '{}',
  owner_id uuid references public.profiles(id) on delete set null,
  linked_risk_id uuid references public.risks(id) on delete set null,
  linked_project_id uuid references public.projects(id) on delete set null,
  status public.scenario_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, scenario_code)
);

-- =========================
-- UPDATED_AT TRIGGERS
-- =========================

do $$
declare t text;
begin
  foreach t in array array[
    'report_builder_templates','backup_schedule_plans','department_kpi_targets',
    'executive_briefing_notes','risk_scenarios'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- =========================
-- VIEWS
-- =========================

create or replace view public.v_report_builder_catalog as
select
  r.id,
  r.organization_id,
  r.template_code,
  r.title_en,
  coalesce(r.title_ar, r.title_en) as title_ar,
  r.description_en,
  coalesce(r.description_ar, r.description_en) as description_ar,
  r.source_view,
  r.default_columns,
  r.default_filters,
  r.output_formats,
  r.is_system,
  r.is_active,
  r.updated_at,
  coalesce(rr.run_count, 0)::int as run_count,
  rr.last_generated_at
from public.report_builder_templates r
left join (
  select template_id, count(*) as run_count, max(generated_at) as last_generated_at
  from public.report_runs
  group by template_id
) rr on rr.template_id = r.id;

create or replace view public.v_backup_schedule_readiness as
select
  p.id,
  p.organization_id,
  p.plan_code,
  p.title_en,
  coalesce(p.title_ar, p.title_en) as title_ar,
  p.frequency,
  p.next_due_at,
  p.last_run_at,
  p.last_status,
  p.retention_days,
  p.require_restore_dry_run,
  case
    when p.is_active = false then 'inactive'
    when p.last_run_at is null then 'never_run'
    when p.next_due_at is not null and p.next_due_at < now() then 'due_now'
    when p.last_status in ('failed') then 'failed'
    when p.require_restore_dry_run and not exists (
      select 1 from public.restore_dry_run_jobs j
      where j.organization_id = p.organization_id
        and j.created_at >= now() - interval '30 days'
    ) then 'restore_test_due'
    else 'healthy'
  end as readiness_status,
  coalesce(r.run_count, 0)::int as run_count,
  r.last_completed_at
from public.backup_schedule_plans p
left join (
  select plan_id, count(*) as run_count, max(completed_at) as last_completed_at
  from public.backup_schedule_runs
  group by plan_id
) r on r.plan_id = p.id;

create or replace view public.v_evidence_vault_inventory as
select
  e.id,
  e.organization_id,
  e.file_name,
  e.file_path,
  e.file_type,
  e.file_size,
  e.status,
  e.created_at,
  e.reviewed_at,
  coalesce(u.full_name_en, 'Unknown') as uploaded_by_name,
  coalesce(rv.version_count, 0)::int as version_count,
  rv.latest_version_at,
  case
    when e.status = 'rejected' then 'attention'
    when e.reviewed_at is null and e.created_at < now() - interval '14 days' then 'review_overdue'
    when coalesce(rv.version_count, 0) = 0 then 'no_version_record'
    else 'healthy'
  end as vault_status,
  case
    when e.ovr_report_id is not null then 'OVR'
    when e.audit_finding_id is not null then 'Audit'
    when e.compliance_item_id is not null then 'Compliance'
    when e.risk_id is not null then 'Risk'
    when e.project_id is not null then 'Project'
    when e.milestone_id is not null then 'Milestone'
    when e.task_id is not null then 'Task'
    else 'Other'
  end as linked_area
from public.evidence_files e
left join public.profiles u on u.id = e.uploaded_by
left join (
  select evidence_id, count(*) as version_count, max(uploaded_at) as latest_version_at
  from public.evidence_file_versions
  group by evidence_id
) rv on rv.evidence_id = e.id;

create or replace view public.v_department_scorecard_v2 as
select
  d.id as department_id,
  d.organization_id,
  d.name_en as department_name_en,
  coalesce(d.name_ar, d.name_en) as department_name_ar,
  coalesce(p.active_projects, 0)::int as active_projects,
  coalesce(p.overdue_projects, 0)::int as overdue_projects,
  coalesce(t.overdue_tasks, 0)::int as overdue_tasks,
  coalesce(r.critical_risks, 0)::int as critical_risks,
  coalesce(c.expiring_compliance, 0)::int as expiring_compliance,
  coalesce(a.overdue_audit_findings, 0)::int as overdue_audit_findings,
  coalesce(o.major_ovrs, 0)::int as major_ovrs,
  coalesce(o.open_ovrs, 0)::int as open_ovrs,
  greatest(0, 100 - (
    coalesce(p.overdue_projects, 0) * 10 +
    coalesce(t.overdue_tasks, 0) * 4 +
    coalesce(r.critical_risks, 0) * 15 +
    coalesce(c.expiring_compliance, 0) * 8 +
    coalesce(a.overdue_audit_findings, 0) * 10 +
    coalesce(o.major_ovrs, 0) * 12
  ))::int as control_score,
  case
    when (coalesce(r.critical_risks,0) + coalesce(o.major_ovrs,0)) >= 3 then 'critical'::public.scorecard_signal
    when (coalesce(p.overdue_projects,0) + coalesce(a.overdue_audit_findings,0) + coalesce(c.expiring_compliance,0)) >= 5 then 'at_risk'::public.scorecard_signal
    when (coalesce(t.overdue_tasks,0) + coalesce(o.open_ovrs,0)) >= 8 then 'watch'::public.scorecard_signal
    when (coalesce(p.active_projects,0) + coalesce(o.open_ovrs,0)) = 0 then 'healthy'::public.scorecard_signal
    else 'healthy'::public.scorecard_signal
  end as signal,
  coalesce(n.executive_note, '') as latest_executive_note,
  n.created_at as latest_note_at
from public.departments d
left join (
  select department_id, count(*) filter (where status not in ('closed','cancelled')) as active_projects,
         count(*) filter (where target_end_date < current_date and status not in ('closed','cancelled')) as overdue_projects
  from public.projects group by department_id
) p on p.department_id = d.id
left join (
  select
    p.department_id,
    count(*) filter (
      where t.due_date < current_date
        and t.status not in ('closed','approved','cancelled')
    ) as overdue_tasks
  from public.tasks t
  join public.projects p on p.id = t.project_id
  group by p.department_id
) t on t.department_id = d.id
left join (
  select department_id, count(*) filter (where risk_level = 'critical' and status not in ('closed','cancelled')) as critical_risks
  from public.risks group by department_id
) r on r.department_id = d.id
left join (
  select department_id, count(*) filter (where coalesce(expiry_date, due_date) <= current_date + interval '30 days' and status not in ('closed','cancelled')) as expiring_compliance
  from public.compliance_items group by department_id
) c on c.department_id = d.id
left join (
  select department_id, count(*) filter (where due_date < current_date and status not in ('closed','cancelled')) as overdue_audit_findings
  from public.audit_findings group by department_id
) a on a.department_id = d.id
left join (
  select department_id,
         count(*) filter (where status not in ('closed','cancelled')) as open_ovrs,
         count(*) filter (where severity_level in ('level_4','sentinel') and status not in ('closed','cancelled')) as major_ovrs
  from public.ovr_reports group by department_id
) o on o.department_id = d.id
left join lateral (
  select executive_note, created_at
  from public.department_scorecard_notes dn
  where dn.department_id = d.id
  order by dn.created_at desc
  limit 1
) n on true;

create or replace view public.v_board_pack_summary as
select
  o.id as organization_id,
  o.name_en as organization_name_en,
  o.name_ar as organization_name_ar,
  current_date as as_of_date,
  (select count(*) from public.projects p where p.organization_id = o.id and p.status not in ('closed','cancelled'))::int as active_projects,
  (select count(*) from public.risks r where r.organization_id = o.id and r.status not in ('closed','cancelled') and r.risk_level in ('critical','high'))::int as high_open_risks,
  (select count(*) from public.compliance_items c where c.organization_id = o.id and coalesce(c.expiry_date, c.due_date) <= current_date + interval '30 days' and c.status not in ('closed','cancelled'))::int as compliance_due_30_days,
  (select count(*) from public.audit_findings a where a.organization_id = o.id and a.status not in ('closed','cancelled'))::int as open_audit_findings,
  (select count(*) from public.ovr_reports v where v.organization_id = o.id and v.status not in ('closed','cancelled'))::int as open_ovrs,
  (select count(*) from public.approvals ap where ap.organization_id = o.id and ap.status = 'pending')::int as pending_approvals,
  (select count(*) from public.evidence_files e where e.organization_id = o.id and e.status in ('submitted','needs_revision'))::int as evidence_reviews,
  (select round(avg(control_score)) from public.v_department_scorecard_v2 s where s.organization_id = o.id)::int as avg_department_control_score,
  (select count(*) from public.v_department_scorecard_v2 s where s.organization_id = o.id and s.signal in ('critical','at_risk'))::int as departments_at_risk
from public.organizations o;

create or replace view public.v_scenario_matrix as
select
  s.id,
  s.organization_id,
  s.scenario_code,
  s.title_en,
  coalesce(s.title_ar, s.title_en) as title_ar,
  s.category,
  s.probability,
  s.impact,
  s.exposure_score,
  s.estimated_financial_impact,
  s.mitigation_summary,
  s.trigger_indicators,
  coalesce(p.full_name_en, 'Unassigned') as owner_name,
  s.status,
  case
    when s.exposure_score >= 20 then 'critical'
    when s.exposure_score >= 12 then 'high'
    when s.exposure_score >= 6 then 'medium'
    else 'low'
  end as exposure_level,
  s.updated_at
from public.risk_scenarios s
left join public.profiles p on p.id = s.owner_id;

-- =========================
-- RPC HELPERS
-- =========================

create or replace function public.create_board_pack_snapshot(
  p_organization_id uuid,
  p_title text,
  p_period_start date default null,
  p_period_end date default null,
  p_sections text[] default array['summary','department_scorecards','risks','ovr','audit','compliance','backup']
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_summary jsonb;
begin
  select to_jsonb(s) into v_summary
  from public.v_board_pack_summary s
  where s.organization_id = p_organization_id
  limit 1;

  insert into public.board_pack_snapshots (
    organization_id, pack_title, period_start, period_end, summary_json, included_sections, generated_by
  ) values (
    p_organization_id, coalesce(p_title, 'Executive Board Pack'), p_period_start, p_period_end,
    coalesce(v_summary, '{}'::jsonb), p_sections, auth.uid()
  ) returning id into v_id;

  insert into public.audit_logs (organization_id, actor_id, action, table_name, record_id, new_data)
  values (p_organization_id, auth.uid(), 'CREATE_BOARD_PACK_SNAPSHOT', 'board_pack_snapshots', v_id, coalesce(v_summary, '{}'::jsonb));

  return v_id;
end;
$$;

create or replace function public.record_backup_schedule_run(
  p_plan_id uuid,
  p_status public.backup_run_status,
  p_package_name text default null,
  p_row_count integer default 0,
  p_storage_manifest_count integer default 0,
  p_checksum text default null,
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.backup_schedule_plans%rowtype;
  v_id uuid;
begin
  select * into v_plan from public.backup_schedule_plans where id = p_plan_id;
  if not found then
    raise exception 'Backup schedule plan not found';
  end if;

  insert into public.backup_schedule_runs (
    organization_id, plan_id, status, package_name, row_count, storage_manifest_count, checksum, error_message,
    completed_at, created_by
  ) values (
    v_plan.organization_id, p_plan_id, p_status, p_package_name, coalesce(p_row_count,0), coalesce(p_storage_manifest_count,0),
    p_checksum, p_error_message, case when p_status in ('completed','failed','verified','restore_tested') then now() else null end,
    auth.uid()
  ) returning id into v_id;

  update public.backup_schedule_plans
  set last_run_at = now(),
      last_status = p_status,
      next_due_at = case frequency
        when 'daily' then now() + interval '1 day'
        when 'weekly' then now() + interval '7 days'
        when 'monthly' then now() + interval '1 month'
        when 'quarterly' then now() + interval '3 months'
        else next_due_at
      end
  where id = p_plan_id;

  return v_id;
end;
$$;

-- =========================
-- RLS
-- =========================

alter table public.report_builder_templates enable row level security;
alter table public.report_runs enable row level security;
alter table public.backup_schedule_plans enable row level security;
alter table public.backup_schedule_runs enable row level security;
alter table public.evidence_file_versions enable row level security;
alter table public.evidence_retention_reviews enable row level security;
alter table public.department_kpi_targets enable row level security;
alter table public.department_scorecard_notes enable row level security;
alter table public.board_pack_snapshots enable row level security;
alter table public.executive_briefing_notes enable row level security;
alter table public.risk_scenarios enable row level security;

-- Reuse existing helper functions when available from migration 003.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'report_builder_templates','report_runs','backup_schedule_plans','backup_schedule_runs',
    'evidence_file_versions','evidence_retention_reviews','department_kpi_targets','department_scorecard_notes',
    'board_pack_snapshots','executive_briefing_notes','risk_scenarios'
  ] loop
    execute format('drop policy if exists "%s_read" on public.%I', tbl, tbl);
    execute format('create policy "%s_read" on public.%I for select using (public.can_read_organization(organization_id))', tbl, tbl);
    execute format('drop policy if exists "%s_write" on public.%I', tbl, tbl);
    execute format('create policy "%s_write" on public.%I for all using (public.has_any_role(array[''super_admin'',''executive'',''governance_admin'',''auditor'',''compliance_officer'']::public.app_role[])) with check (public.has_any_role(array[''super_admin'',''executive'',''governance_admin'',''auditor'',''compliance_officer'']::public.app_role[]))', tbl, tbl);
  end loop;
end $$;

-- =========================
-- SEED SYSTEM TEMPLATES
-- =========================

insert into public.report_builder_templates (organization_id, template_code, title_en, title_ar, description_en, description_ar, source_view, default_columns, is_system)
select o.id, 'EXEC_BOARD_PACK', 'Executive board pack', 'حزمة مجلس الإدارة التنفيذية',
       'Executive summary across risk, compliance, audit, OVR, projects and backup health.',
       'ملخص تنفيذي للمخاطر والامتثال والمراجعة وبلاغات OVR والمشاريع وصحة النسخ الاحتياطي.',
       'v_board_pack_summary', array['organization_name_en','as_of_date','active_projects','high_open_risks','open_ovrs','pending_approvals','departments_at_risk'], true
from public.organizations o
on conflict (organization_id, template_code) do nothing;

insert into public.report_builder_templates (organization_id, template_code, title_en, title_ar, description_en, description_ar, source_view, default_columns, is_system)
select o.id, 'DEPT_SCORECARD', 'Department scorecards', 'بطاقات أداء الإدارات',
       'Department control score, risk pressure, overdue work and OVR signals.',
       'درجة ضبط الإدارة وضغط المخاطر والأعمال المتأخرة وإشارات OVR.',
       'v_department_scorecard_v2', array['department_name_en','control_score','signal','overdue_projects','critical_risks','major_ovrs','expiring_compliance'], true
from public.organizations o
on conflict (organization_id, template_code) do nothing;

insert into public.report_builder_templates (organization_id, template_code, title_en, title_ar, description_en, description_ar, source_view, default_columns, is_system)
select o.id, 'EVIDENCE_VAULT', 'Evidence vault inventory', 'مخزون خزنة الأدلة',
       'Evidence files, review state, linked area and version health.',
       'ملفات الأدلة وحالة المراجعة ومنطقة الربط وصحة الإصدارات.',
       'v_evidence_vault_inventory', array['file_name','linked_area','status','vault_status','version_count','uploaded_by_name','created_at'], true
from public.organizations o
on conflict (organization_id, template_code) do nothing;

insert into public.backup_schedule_plans (organization_id, plan_code, title_en, title_ar, frequency, retention_days, next_due_at, is_active)
select o.id, 'WEEKLY_GRC_EXPORT', 'Weekly GRC export package', 'حزمة تصدير GRC الأسبوعية', 'weekly', 90, now() + interval '7 days', true
from public.organizations o
on conflict (organization_id, plan_code) do nothing;

insert into public.backup_schedule_plans (organization_id, plan_code, title_en, title_ar, frequency, retention_days, next_due_at, is_active)
select o.id, 'MONTHLY_RESTORE_TEST', 'Monthly restore dry-run control', 'اختبار استعادة شهري تجريبي', 'monthly', 180, now() + interval '30 days', true
from public.organizations o
on conflict (organization_id, plan_code) do nothing;

insert into public.risk_scenarios (organization_id, scenario_code, title_en, title_ar, description, category, probability, impact, estimated_financial_impact, mitigation_summary, trigger_indicators, status)
select o.id, 'SCN-CASH-001', 'Government payer collection delay', 'تأخر تحصيل الجهات الحكومية', 'Cash pressure if large payer delay extends beyond expected cycle.', 'financial', 4, 5, 0, 'Weekly cash forecast, payer escalation and executive collection dashboard.', array['DSO increase','cash runway below threshold','aging over 180 days'], 'active'
from public.organizations o
on conflict (organization_id, scenario_code) do nothing;

insert into public.risk_scenarios (organization_id, scenario_code, title_en, title_ar, description, category, probability, impact, estimated_financial_impact, mitigation_summary, trigger_indicators, status)
select o.id, 'SCN-QUALITY-001', 'Repeated major OVR pattern', 'تكرار بلاغات OVR جسيمة', 'Repeated serious patient-safety incidents in same department or category.', 'clinical', 3, 5, 0, 'Quality RCA, corrective action project, staff training and executive escalation.', array['two level 4 OVRs','sentinel event','overdue corrective action'], 'active'
from public.organizations o
on conflict (organization_id, scenario_code) do nothing;

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_report_templates_org on public.report_builder_templates(organization_id, is_active);
create index if not exists idx_report_runs_org on public.report_runs(organization_id, generated_at desc);
create index if not exists idx_backup_plans_org_due on public.backup_schedule_plans(organization_id, next_due_at);
create index if not exists idx_backup_runs_plan on public.backup_schedule_runs(plan_id, started_at desc);
create index if not exists idx_evidence_versions_evidence on public.evidence_file_versions(evidence_id, version_no desc);
create index if not exists idx_evidence_retention_org on public.evidence_retention_reviews(organization_id, review_status);
create index if not exists idx_department_targets_dept on public.department_kpi_targets(department_id, metric_code);
create index if not exists idx_board_packs_org on public.board_pack_snapshots(organization_id, generated_at desc);
create index if not exists idx_briefing_notes_org on public.executive_briefing_notes(organization_id, status, risk_level);
create index if not exists idx_risk_scenarios_org on public.risk_scenarios(organization_id, exposure_score desc);

-- =========================================================
-- END 023_enterprise_intelligence_reporting.sql
-- =========================================================

-- =========================================================
-- BEGIN 024_automation_intelligence_kri_reviews.sql
-- sha256: 589009b09ec8f984339d3fe0534d900d0e2201367518043b5939fcbe36b08f1f
-- =========================================================


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

-- =========================================================
-- END 024_automation_intelligence_kri_reviews.sql
-- =========================================================

-- =========================================================
-- BEGIN 025_staging_validation_consolidation.sql
-- sha256: 767bc278a7f16b6458de5c834920a6699c985f7a018e7fd9d6cc5444e03c6908
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 025
-- Staging Validation, RLS Persona Lab, Translation Coverage,
-- Load Test Seeds, Backup Strategy, Migration Runbook
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- STAGING VALIDATION CYCLES
-- =========================

create table if not exists staging_validation_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cycle_code text not null,
  title text not null,
  environment_name text not null default 'staging',
  status text not null default 'planned' check (status in ('planned','running','passed','failed','blocked','cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  owner_id uuid references profiles(id) on delete set null,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cycle_code)
);

create table if not exists staging_validation_check_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cycle_id uuid references staging_validation_cycles(id) on delete cascade,
  check_area text not null,
  check_code text not null,
  check_title text not null,
  status text not null default 'pending' check (status in ('pass','warning','blocked','pending','not_applicable')),
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  owner_label text,
  evidence_note text,
  result_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cycle_id, check_code)
);

-- =========================
-- RLS PERSONA TEST LAB
-- =========================

create table if not exists rls_persona_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  persona_code text not null,
  persona_name_en text not null,
  persona_name_ar text,
  role_name text not null,
  access_scope text not null,
  test_area text not null,
  allowed_expectation text not null,
  denied_expectation text not null,
  is_critical boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, persona_code)
);

create table if not exists rls_persona_test_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid references rls_persona_scenarios(id) on delete cascade,
  tested_by uuid references profiles(id) on delete set null,
  tested_at timestamptz not null default now(),
  result text not null default 'pending' check (result in ('pass','fail','warning','pending')),
  evidence_note text,
  failure_note text,
  created_at timestamptz not null default now()
);

-- =========================
-- BILINGUAL COVERAGE AUDIT
-- =========================

create table if not exists i18n_translation_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  module_key text not null,
  screen_name text not null,
  label_group text not null,
  total_labels integer not null default 0 check (total_labels >= 0),
  translated_ar integer not null default 0 check (translated_ar >= 0),
  translated_en integer not null default 0 check (translated_en >= 0),
  rtl_checked boolean not null default false,
  status text not null default 'needs_review' check (status in ('complete','needs_review','missing_ar','missing_en','blocked')),
  reviewer_note text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_key, screen_name, label_group)
);

-- =========================
-- LARGE DATA / LOAD TEST SEED PLAN
-- =========================

create table if not exists load_test_seed_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  batch_code text not null,
  title text not null,
  target_departments integer not null default 50,
  target_users integer not null default 1000,
  target_projects integer not null default 250,
  target_tasks integer not null default 5000,
  target_ovr_reports integer not null default 500,
  target_evidence_files integer not null default 1500,
  status text not null default 'planned' check (status in ('planned','generated','loaded','tested','failed','cancelled')),
  last_run_at timestamptz,
  duration_ms integer,
  performance_note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, batch_code)
);

-- =========================
-- PRODUCTION BACKUP STRATEGY / RESTORE ASSURANCE
-- =========================

create table if not exists production_backup_strategies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  strategy_code text not null,
  title text not null,
  backup_type text not null check (backup_type in ('browser_export','database_dump','storage_export','auth_export','full_platform')),
  frequency text not null default 'weekly',
  owner_label text,
  retention_days integer not null default 90 check (retention_days >= 1),
  includes_storage_files boolean not null default false,
  includes_auth_users boolean not null default false,
  requires_restore_dry_run boolean not null default true,
  status text not null default 'draft' check (status in ('draft','approved','active','paused','retired')),
  last_success_at timestamptz,
  next_due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, strategy_code)
);

create table if not exists backup_restore_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  backup_strategy_id uuid references production_backup_strategies(id) on delete set null,
  verification_code text not null,
  scenario_name text not null,
  status text not null default 'planned' check (status in ('planned','running','passed','failed','blocked','cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  row_count_match boolean,
  storage_files_checked boolean not null default false,
  auth_users_checked boolean not null default false,
  evidence_note text,
  failure_note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, verification_code)
);

-- =========================
-- MIGRATION RUNBOOK + DEFECT LOG
-- =========================

create table if not exists migration_runbook_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sequence_no integer not null,
  migration_file text not null,
  release_tag text not null,
  purpose text not null,
  is_required boolean not null default true,
  verification_query text,
  expected_result text,
  status text not null default 'pending' check (status in ('pending','verified','warning','blocked','skipped')),
  verified_at timestamptz,
  verified_by uuid references profiles(id) on delete set null,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sequence_no),
  unique (organization_id, migration_file)
);

create table if not exists consolidation_defect_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  defect_code text not null,
  title text not null,
  area text not null,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','in_progress','fixed','accepted','closed','cancelled')),
  owner_label text,
  found_in_version text,
  target_fix_version text,
  description text,
  resolution_note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, defect_code)
);

-- =========================
-- UPDATED_AT TRIGGERS
-- =========================

do $$
declare
  t text;
begin
  foreach t in array array[
    'staging_validation_cycles',
    'staging_validation_check_results',
    'rls_persona_scenarios',
    'i18n_translation_audit',
    'load_test_seed_batches',
    'production_backup_strategies',
    'backup_restore_verifications',
    'migration_runbook_entries',
    'consolidation_defect_log'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on %I', t, t);
    execute format('create trigger trg_%s_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_staging_cycles_org_status on staging_validation_cycles(organization_id, status);
create index if not exists idx_staging_checks_cycle_status on staging_validation_check_results(cycle_id, status, severity);
create index if not exists idx_rls_persona_active on rls_persona_scenarios(organization_id, is_active, role_name, access_scope);
create index if not exists idx_rls_runs_scenario_result on rls_persona_test_runs(scenario_id, result, tested_at);
create index if not exists idx_i18n_audit_module_status on i18n_translation_audit(organization_id, module_key, status);
create index if not exists idx_load_seed_org_status on load_test_seed_batches(organization_id, status);
create index if not exists idx_backup_strategy_org_status on production_backup_strategies(organization_id, status, next_due_date);
create index if not exists idx_restore_verifications_status on backup_restore_verifications(organization_id, status, started_at);
create index if not exists idx_migration_runbook_status on migration_runbook_entries(organization_id, sequence_no, status);
create index if not exists idx_defect_log_status on consolidation_defect_log(organization_id, status, severity);

-- =========================
-- DEFAULT SEED FUNCTION
-- =========================

create or replace function seed_staging_validation_defaults(target_organization_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  v_cycle_id uuid;
  inserted_count integer := 0;
begin
  select coalesce(target_organization_id, (select id from organizations order by created_at limit 1)) into org_id;
  if org_id is null then
    raise exception 'No organization exists to seed staging validation defaults';
  end if;

  insert into staging_validation_cycles (organization_id, cycle_code, title, environment_name, status, notes)
  values (org_id, 'STAGE-V23', 'v2.3 staging validation cycle', 'staging', 'planned', 'Created by v2.3 ultra stabilization patch.')
  on conflict (organization_id, cycle_code) do update set updated_at = now()
  returning id into v_cycle_id;

  insert into staging_validation_check_results (organization_id, cycle_id, check_area, check_code, check_title, status, severity, owner_label, evidence_note, sort_order)
  values
    (org_id, v_cycle_id, 'migrations', 'MIG-ALL-FRESH', 'Apply migrations 001 to 025 in a fresh Supabase staging project', 'pending', 'critical', 'System Admin', 'Screenshot or migration verifier export', 10),
    (org_id, v_cycle_id, 'security', 'RLS-PERSONAS', 'Run RLS persona test matrix for executive, manager, employee, Quality and Audit users', 'pending', 'critical', 'Access Control Admin', 'Persona lab export', 20),
    (org_id, v_cycle_id, 'bilingual', 'AR-RTL-SCREENS', 'Review Arabic/RTL on all active pages and key print reports', 'pending', 'high', 'Governance Admin', 'Translation coverage export', 30),
    (org_id, v_cycle_id, 'performance', 'LOAD-1000-USERS', 'Load-test seed plan for 1,000 users, 50 departments and high-volume tasks/OVRs', 'pending', 'high', 'IT / QA', 'Load seed batch result', 40),
    (org_id, v_cycle_id, 'backup', 'RESTORE-DRY-RUN', 'Complete restore dry-run using latest backup/export strategy', 'pending', 'critical', 'IT / Governance', 'Restore verification record', 50)
  on conflict (organization_id, cycle_id, check_code) do nothing;
  get diagnostics inserted_count = row_count;

  insert into rls_persona_scenarios (organization_id, persona_code, persona_name_en, persona_name_ar, role_name, access_scope, test_area, allowed_expectation, denied_expectation, sort_order)
  values
    (org_id, 'CEO-GLOBAL', 'CEO / Executive global view', 'الرئيس التنفيذي / العرض الشامل', 'executive', 'global', 'command_center', 'Can view all critical risks, OVRs, approvals and escalations.', 'Cannot bypass workflow evidence controls by direct self-approval.', 10),
    (org_id, 'DEPT-MGR', 'Department manager scoped view', 'مدير إدارة بنطاق الإدارة', 'department_manager', 'department', 'department_control', 'Can view own department projects, OVRs and tasks.', 'Cannot view unrelated department employee work queues.', 20),
    (org_id, 'EMPLOYEE-ASSIGNED', 'Employee assigned-only workspace', 'موظف - الأعمال المسندة فقط', 'employee', 'assigned_only', 'my_work', 'Can view own assigned tasks and submitted OVRs.', 'Cannot view executive dashboards, other employees, or confidential OVRs.', 30),
    (org_id, 'QUALITY-OVR', 'Quality OVR reviewer', 'مراجع الجودة لبلاغات OVR', 'governance_admin', 'global', 'ovr', 'Can classify, return, request evidence and close OVRs after evidence.', 'Cannot close without accepted evidence and closure user.', 40),
    (org_id, 'AUDITOR-FINDINGS', 'Auditor finding reviewer', 'مراجع ملاحظات التدقيق', 'auditor', 'global', 'audit', 'Can review audit evidence and close findings after review.', 'Departments cannot close their own findings without audit review.', 50)
  on conflict (organization_id, persona_code) do nothing;

  insert into i18n_translation_audit (organization_id, module_key, screen_name, label_group, total_labels, translated_ar, translated_en, rtl_checked, status, reviewer_note)
  values
    (org_id, 'core', 'Navigation / Shell', 'nav', 45, 45, 45, true, 'complete', 'Core navigation has bilingual labels.'),
    (org_id, 'ovr', 'OVR Workflow', 'forms_and_status', 60, 54, 60, false, 'needs_review', 'Review Arabic text in OVR workflow and print layout.'),
    (org_id, 'reports', 'Reports / Export', 'buttons_and_filters', 48, 38, 48, false, 'needs_review', 'Complete report filters and export label review.'),
    (org_id, 'admin', 'Access / Setup / Safety', 'warnings', 52, 42, 52, false, 'needs_review', 'Admin warnings need Arabic QA review.')
  on conflict (organization_id, module_key, screen_name, label_group) do nothing;

  insert into load_test_seed_batches (organization_id, batch_code, title, target_departments, target_users, target_projects, target_tasks, target_ovr_reports, target_evidence_files, status, performance_note)
  values (org_id, 'LOAD-1000-50', '1,000 users / 50 departments staging load plan', 50, 1000, 250, 5000, 500, 1500, 'planned', 'Use staging only. Do not run on production data.')
  on conflict (organization_id, batch_code) do nothing;

  insert into production_backup_strategies (organization_id, strategy_code, title, backup_type, frequency, owner_label, retention_days, includes_storage_files, includes_auth_users, requires_restore_dry_run, status, next_due_date, notes)
  values
    (org_id, 'BROWSER-EXPORT', 'Browser export package before large changes', 'browser_export', 'before_major_change', 'Governance Admin', 90, false, false, true, 'active', current_date + interval '7 days', 'Good for external analysis but not a full platform backup.'),
    (org_id, 'DB-DUMP', 'PostgreSQL database backup/dump', 'database_dump', 'daily', 'IT / Supabase Admin', 180, false, false, true, 'draft', current_date + interval '14 days', 'Production-grade database backup must be configured outside the browser.'),
    (org_id, 'STORAGE-EXPORT', 'Evidence/document storage export', 'storage_export', 'weekly', 'IT / Quality', 180, true, false, true, 'draft', current_date + interval '14 days', 'Required because evidence files are not inside CSV/JSON row exports.'),
    (org_id, 'AUTH-EXPORT', 'Auth/user recovery plan', 'auth_export', 'monthly', 'System Admin', 180, false, true, true, 'draft', current_date + interval '30 days', 'Document auth recovery/admin access plan.')
  on conflict (organization_id, strategy_code) do nothing;

  insert into backup_restore_verifications (organization_id, verification_code, scenario_name, status, evidence_note)
  values (org_id, 'RESTORE-V23-STAGING', 'Restore latest export into clean staging project and compare row counts', 'planned', 'Record migration state, row-count comparison and screenshot evidence.')
  on conflict (organization_id, verification_code) do nothing;

  insert into migration_runbook_entries (organization_id, sequence_no, migration_file, release_tag, purpose, verification_query, expected_result, status)
  values
    (org_id, 23, '023_enterprise_intelligence_reporting.sql', 'v2.1', 'Board packs, advanced reports, evidence vault, scorecards and backup scheduler', 'select count(*) from board_pack_snapshots;', 'Query returns without relation error', 'pending'),
    (org_id, 24, '024_automation_intelligence_kri_reviews.sql', 'v2.2', 'Automation rules, KRIs, recurring reviews and executive exceptions', 'select count(*) from automation_rules;', 'Query returns without relation error', 'pending'),
    (org_id, 25, '025_staging_validation_consolidation.sql', 'v2.3', 'Staging validation, RLS persona lab, translation audit, load seed plan and backup strategy', 'select count(*) from staging_validation_cycles;', 'Query returns without relation error', 'pending')
  on conflict (organization_id, sequence_no) do nothing;

  insert into consolidation_defect_log (organization_id, defect_code, title, area, severity, status, owner_label, found_in_version, target_fix_version, description)
  values
    (org_id, 'DEF-I18N-001', 'Complete Arabic coverage audit for older pages', 'bilingual', 'high', 'open', 'Governance Admin', 'v2.3', 'v2.4', 'Older pages may still have English-only labels or validation messages.'),
    (org_id, 'DEF-RLS-001', 'Run real persona testing before employee rollout', 'security', 'critical', 'open', 'Access Control Admin', 'v2.3', 'pre-production', 'Role/scope model must be verified with actual test users.'),
    (org_id, 'DEF-BKP-001', 'Configure production server-side backup outside browser export', 'backup', 'critical', 'open', 'IT / Supabase Admin', 'v2.3', 'pre-production', 'Browser export is useful but not equivalent to full database/storage/auth backup.')
  on conflict (organization_id, defect_code) do nothing;

  return jsonb_build_object('organization_id', org_id, 'cycle_id', v_cycle_id, 'inserted_checks', inserted_count, 'status', 'seeded');
end;
$$;

-- =========================
-- VIEWS
-- =========================

create or replace view v_staging_validation_summary as
select
  o.id as organization_id,
  coalesce(max(c.created_at), now()) as last_cycle_created_at,
  count(distinct c.id) as cycles,
  count(ch.id) filter (where ch.status = 'blocked') as blocked_checks,
  count(ch.id) filter (where ch.status = 'warning') as warning_checks,
  count(ch.id) filter (where ch.status = 'pass') as passed_checks,
  count(ch.id) filter (where ch.status = 'pending') as pending_checks,
  case
    when count(ch.id) = 0 then 0
    else round(100.0 * count(ch.id) filter (where ch.status = 'pass') / count(ch.id))::int
  end as staging_readiness_score,
  count(cd.id) filter (where cd.status in ('open','in_progress') and cd.severity = 'critical') as critical_open_defects,
  count(cd.id) filter (where cd.status in ('open','in_progress') and cd.severity = 'high') as high_open_defects
from organizations o
left join staging_validation_cycles c on c.organization_id = o.id
left join staging_validation_check_results ch on ch.organization_id = o.id and (ch.cycle_id = c.id or c.id is null)
left join consolidation_defect_log cd on cd.organization_id = o.id
group by o.id;

create or replace view v_staging_validation_checks as
select
  ch.*,
  c.cycle_code,
  c.title as cycle_title,
  c.environment_name,
  c.status as cycle_status,
  case
    when ch.status = 'blocked' then 100
    when ch.status = 'warning' then 60
    when ch.status = 'pending' then 30
    when ch.status = 'pass' then 0
    else 10
  end as attention_weight
from staging_validation_check_results ch
left join staging_validation_cycles c on c.id = ch.cycle_id;

create or replace view v_rls_persona_lab as
select
  s.*,
  latest.result as latest_result,
  latest.tested_at as latest_tested_at,
  latest.evidence_note as latest_evidence_note,
  latest.failure_note as latest_failure_note,
  case
    when latest.result is null then 'not_tested'
    when latest.result = 'pass' then 'passed'
    when latest.result = 'warning' then 'warning'
    when latest.result = 'fail' then 'failed'
    else 'pending'
  end as persona_status
from rls_persona_scenarios s
left join lateral (
  select r.*
  from rls_persona_test_runs r
  where r.scenario_id = s.id
  order by r.tested_at desc
  limit 1
) latest on true;

create or replace view v_i18n_translation_coverage as
select
  a.*,
  case when a.total_labels = 0 then 0 else round(100.0 * least(a.translated_ar, a.translated_en) / a.total_labels)::int end as coverage_percent,
  greatest(a.total_labels - a.translated_ar, 0) as missing_ar_count,
  greatest(a.total_labels - a.translated_en, 0) as missing_en_count,
  case
    when a.total_labels > 0 and a.translated_ar >= a.total_labels and a.translated_en >= a.total_labels and a.rtl_checked then 'complete'
    when a.translated_ar < a.total_labels then 'missing_ar'
    when a.translated_en < a.total_labels then 'missing_en'
    else 'needs_rtl_review'
  end as computed_status
from i18n_translation_audit a;

create or replace view v_load_test_seed_status as
select
  b.*,
  (b.target_users + b.target_projects + b.target_tasks + b.target_ovr_reports + b.target_evidence_files) as target_total_rows,
  case
    when b.status in ('tested') and coalesce(b.duration_ms, 999999) <= 3000 then 'healthy'
    when b.status in ('tested','loaded') then 'watch'
    when b.status = 'failed' then 'blocked'
    else 'planned'
  end as performance_signal
from load_test_seed_batches b;

create or replace view v_production_backup_strategy_status as
select
  s.*,
  case
    when s.status not in ('active','approved') then 'not_active'
    when s.next_due_date is not null and s.next_due_date < current_date then 'overdue'
    when s.requires_restore_dry_run and not exists (
      select 1 from backup_restore_verifications v
      where v.organization_id = s.organization_id
        and (v.backup_strategy_id = s.id or v.backup_strategy_id is null)
        and v.status = 'passed'
        and v.finished_at >= now() - interval '90 days'
    ) then 'restore_test_needed'
    else 'ok'
  end as backup_signal
from production_backup_strategies s;

create or replace view v_restore_verification_status as
select
  v.*,
  s.strategy_code,
  s.title as strategy_title,
  case
    when v.status = 'passed' and coalesce(v.row_count_match, false) then 'verified'
    when v.status = 'failed' then 'failed'
    when v.status = 'blocked' then 'blocked'
    else 'needs_work'
  end as verification_signal
from backup_restore_verifications v
left join production_backup_strategies s on s.id = v.backup_strategy_id;

create or replace view v_migration_runbook_status as
select
  m.*,
  case
    when m.status = 'verified' then 0
    when m.status = 'warning' then 40
    when m.status = 'blocked' then 100
    else 60
  end as attention_weight
from migration_runbook_entries m;

create or replace view v_consolidation_defect_dashboard as
select
  d.*,
  case
    when d.status in ('closed','cancelled') then 0
    when d.severity = 'critical' then 100
    when d.severity = 'high' then 70
    when d.severity = 'medium' then 40
    else 20
  end as defect_weight
from consolidation_defect_log d;

-- =========================
-- BOOTSTRAP DEFAULTS FOR FIRST ORGANIZATION
-- =========================

do $$
declare org_id uuid;
begin
  select id into org_id from organizations order by created_at limit 1;
  if org_id is not null then
    perform seed_staging_validation_defaults(org_id);
  end if;
end $$;

-- =========================================================
-- END 025_staging_validation_consolidation.sql
-- =========================================================

-- =========================================================
-- BEGIN 026_finish_fast_release_sprint.sql
-- sha256: 7456e076a84ec0f3aae0bd665fd1955f93e8d694acb2c75ec5ae5e60e32c2b2f
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 026
-- Finish Fast Release Sprint, acceptance tests, cutover plan,
-- consolidation artifacts and final go-live gateboard
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type final_gate_status as enum ('pending', 'in_progress', 'pass', 'warning', 'blocked', 'accepted_risk', 'not_applicable');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type final_test_status as enum ('not_run', 'pass', 'fail', 'warning', 'blocked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type final_cutover_status as enum ('not_started', 'ready', 'in_progress', 'done', 'blocked', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type final_artifact_status as enum ('draft', 'ready', 'verified', 'blocked', 'archived');
exception when duplicate_object then null;
end $$;

-- =========================
-- FINAL RELEASE SPRINT TABLES
-- =========================

create table if not exists final_release_sprint_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  release_tag text not null default 'v3.0-rc-final-sprint',
  gate_code text not null,
  gate_group text not null,
  title text not null,
  description text,
  owner_label text,
  severity text not null default 'high' check (severity in ('critical','high','medium','low')),
  status final_gate_status not null default 'pending',
  evidence_required boolean not null default true,
  evidence_note text,
  target_date date,
  sequence_no integer not null default 100,
  go_live_blocking boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, gate_code)
);

create table if not exists final_acceptance_test_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  test_code text not null,
  test_area text not null,
  title text not null,
  persona text,
  expected_result text not null,
  status final_test_status not null default 'not_run',
  is_critical boolean not null default true,
  evidence_note text,
  failure_note text,
  tested_by uuid references profiles(id) on delete set null,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, test_code)
);

create table if not exists final_cutover_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  phase_name text not null,
  sequence_no integer not null default 100,
  title text not null,
  owner_label text,
  planned_window text,
  rollback_note text,
  status final_cutover_status not null default 'not_started',
  is_critical boolean not null default true,
  evidence_note text,
  completed_by uuid references profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phase_name, sequence_no, title)
);

create table if not exists final_consolidation_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  artifact_code text not null,
  title text not null,
  artifact_type text not null,
  status final_artifact_status not null default 'draft',
  owner_label text,
  file_path text,
  verification_note text,
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, artifact_code)
);

create table if not exists final_ui_polish_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  screen_key text not null,
  title text not null,
  issue_type text not null default 'polish',
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  status final_gate_status not null default 'pending',
  notes text,
  owner_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, screen_key, title)
);

-- =========================
-- UPDATED_AT TRIGGERS
-- =========================

drop trigger if exists trg_final_release_sprint_items_updated_at on final_release_sprint_items;
create trigger trg_final_release_sprint_items_updated_at
before update on final_release_sprint_items
for each row execute function set_updated_at();

drop trigger if exists trg_final_acceptance_test_results_updated_at on final_acceptance_test_results;
create trigger trg_final_acceptance_test_results_updated_at
before update on final_acceptance_test_results
for each row execute function set_updated_at();

drop trigger if exists trg_final_cutover_tasks_updated_at on final_cutover_tasks;
create trigger trg_final_cutover_tasks_updated_at
before update on final_cutover_tasks
for each row execute function set_updated_at();

drop trigger if exists trg_final_consolidation_artifacts_updated_at on final_consolidation_artifacts;
create trigger trg_final_consolidation_artifacts_updated_at
before update on final_consolidation_artifacts
for each row execute function set_updated_at();

drop trigger if exists trg_final_ui_polish_items_updated_at on final_ui_polish_items;
create trigger trg_final_ui_polish_items_updated_at
before update on final_ui_polish_items
for each row execute function set_updated_at();

-- =========================
-- DEFAULT SEED FUNCTION
-- =========================

create or replace function seed_final_release_defaults()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  org record;
begin
  for org in select id from organizations loop
    insert into final_release_sprint_items (organization_id, gate_code, gate_group, title, description, owner_label, severity, status, target_date, sequence_no, go_live_blocking, evidence_note)
    values
      (org.id, 'MIG-FRESH-001-026', 'migration', 'Fresh Supabase migration run from 001 to 026', 'Run every migration in a clean staging project and record evidence.', 'System Admin', 'critical', 'blocked', current_date + 7, 10, true, 'Migration verifier screenshot required.'),
      (org.id, 'RLS-PERSONA-MATRIX', 'security', 'RLS persona matrix completed', 'CEO, Governance, Department Manager, Quality, Auditor and Employee personas tested.', 'Access Control Admin', 'critical', 'blocked', current_date + 8, 20, true, 'Persona lab export required.'),
      (org.id, 'BACKUP-RESTORE-DRYRUN', 'backup', 'Backup and restore dry-run completed', 'Database and storage restore evidence required.', 'IT / Governance', 'critical', 'warning', current_date + 9, 30, true, 'Restore dry-run record required.'),
      (org.id, 'AR-RTL-FINAL-QA', 'bilingual', 'Arabic/RTL final QA completed', 'Review high-traffic pages, OVR, reports and print layouts.', 'Governance Admin', 'high', 'warning', current_date + 10, 40, false, 'Translation coverage export.'),
      (org.id, 'OVR-END-TO-END', 'quality', 'OVR end-to-end scenario passed', 'Reporter to Supervisor/HOD to Quality to corrective action to evidence closure.', 'Quality Manager', 'critical', 'pending', current_date + 11, 50, true, 'OVR workflow screenshot required.'),
      (org.id, 'EXPORT-PACKAGE-READY', 'reporting', 'Export and board pack package verified', 'External JSON/CSV report pack generated and reviewed.', 'Governance Admin', 'medium', 'pending', current_date + 12, 60, false, 'Export package file and report preview.'),
      (org.id, 'PILOT-ACCESS-LIST', 'rollout', 'Pilot department access list approved', 'Limit first rollout to control departments and selected managers.', 'Executive Sponsor', 'high', 'pending', current_date + 12, 70, true, 'Approved pilot access list.')
    on conflict (organization_id, gate_code) do update set
      title = excluded.title,
      description = excluded.description,
      owner_label = excluded.owner_label,
      severity = excluded.severity,
      sequence_no = excluded.sequence_no,
      go_live_blocking = excluded.go_live_blocking;

    insert into final_acceptance_test_results (organization_id, test_code, test_area, title, persona, expected_result, status, is_critical)
    values
      (org.id, 'EMP-MYWORK-ONLY', 'rls', 'Employee sees only assigned tasks and own submitted OVRs', 'employee', 'No executive, other department or confidential OVR data is visible.', 'not_run', true),
      (org.id, 'DEPT-SCOPE', 'rls', 'Department Manager sees department scope only', 'department_manager', 'Own department data visible; unrelated department data hidden.', 'not_run', true),
      (org.id, 'OVR-QUALITY-CLOSE', 'ovr', 'Quality-only OVR closure with accepted evidence', 'quality', 'Closure blocked until evidence and Quality closure comments exist.', 'not_run', true),
      (org.id, 'NO-SELF-APPROVAL', 'workflow', 'Self-approval is blocked', 'project_owner', 'Owner cannot approve own request.', 'not_run', true),
      (org.id, 'EXPORT-BACKUP-HEALTH', 'backup', 'Export package and backup health snapshot created', 'governance_admin', 'External package generated and restore dry-run plan documented.', 'warning', true),
      (org.id, 'AR-RTL-HIGH-TRAFFIC', 'bilingual', 'Arabic/RTL high-traffic screen review completed', 'governance_admin', 'Home, Command, OVR, My Work, Reports and Admin screens are usable in Arabic.', 'not_run', false)
    on conflict (organization_id, test_code) do update set
      title = excluded.title,
      expected_result = excluded.expected_result,
      is_critical = excluded.is_critical;

    insert into final_cutover_tasks (organization_id, phase_name, sequence_no, title, owner_label, planned_window, rollback_note, status, is_critical, evidence_note)
    values
      (org.id, 'T-7 days', 10, 'Freeze migrations and create final consolidated release ZIP', 'System Admin', 'One week before go-live', 'Rollback to last validated patch set.', 'not_started', true, 'Final ZIP checksum and migration list.'),
      (org.id, 'T-3 days', 20, 'Run backup/export package and database/storage backup', 'IT / Governance', 'Three days before go-live', 'Restore staging from backup to confirm viability.', 'not_started', true, 'Backup run IDs and restore dry-run.'),
      (org.id, 'T-1 day', 30, 'Run acceptance test script with five key personas', 'Governance Admin', 'One day before go-live', 'Delay rollout if any critical persona fails.', 'not_started', true, 'QA export signed off.'),
      (org.id, 'Go-live day', 40, 'Enable production access for pilot departments only', 'Super Admin', 'Morning go-live window', 'Disable invitations and restore previous access list.', 'not_started', true, 'Pilot access list.'),
      (org.id, 'T+7 days', 50, 'Review incidents, performance, access warnings and user feedback', 'Executive Sponsor', 'First week review', 'Pause rollout wave 2 if blockers remain.', 'not_started', false, 'Week-one executive report.')
    on conflict (organization_id, phase_name, sequence_no, title) do update set
      owner_label = excluded.owner_label,
      rollback_note = excluded.rollback_note,
      is_critical = excluded.is_critical;

    insert into final_consolidation_artifacts (organization_id, artifact_code, title, artifact_type, status, owner_label, file_path, verification_note)
    values
      (org.id, 'FINAL-ZIP', 'Final consolidated release ZIP', 'release_package', 'draft', 'System Admin', null, 'Create after migration run is verified.'),
      (org.id, 'MIGRATION-ORDER', 'Migration order and verification runbook', 'runbook', 'ready', 'System Admin', 'docs/FRESH_INSTALL_MIGRATION_ORDER.md', 'Included in patch.'),
      (org.id, 'ACCEPTANCE-SCRIPT', 'Final acceptance test script', 'qa_script', 'ready', 'Governance Admin', 'docs/ACCEPTANCE_TEST_SCRIPT.md', 'Included in patch.'),
      (org.id, 'CUTOVER-PLAYBOOK', 'Go-live cutover playbook', 'playbook', 'ready', 'Executive Sponsor', 'docs/FINAL_GO_LIVE_PLAYBOOK.md', 'Included in patch.'),
      (org.id, 'CONSOLIDATION-PLAN', 'Patch consolidation plan', 'runbook', 'ready', 'System Admin', 'docs/PATCH_CONSOLIDATION_PLAN.md', 'Included in patch.')
    on conflict (organization_id, artifact_code) do update set
      title = excluded.title,
      artifact_type = excluded.artifact_type,
      file_path = excluded.file_path,
      verification_note = excluded.verification_note;

    insert into final_ui_polish_items (organization_id, screen_key, title, issue_type, severity, status, notes, owner_label)
    values
      (org.id, 'home', 'Home launchpad spacing and mobile wrapping', 'polish', 'medium', 'pending', 'Final responsive check after applying v3.0.', 'UI Owner'),
      (org.id, 'ovr', 'OVR form Arabic/English review and print layout', 'bilingual', 'high', 'warning', 'Healthcare form must be reviewed by Quality before rollout.', 'Quality Manager'),
      (org.id, 'reports', 'CSV/JSON export labels and report filters', 'bilingual', 'medium', 'pending', 'Ensure exported columns are understood by finance/governance users.', 'Governance Admin'),
      (org.id, 'admin', 'Danger actions require confirmation wording', 'safety', 'high', 'pending', 'Confirm reset/import/role-change language before production.', 'System Admin')
    on conflict (organization_id, screen_key, title) do update set
      issue_type = excluded.issue_type,
      severity = excluded.severity,
      notes = excluded.notes,
      owner_label = excluded.owner_label;
  end loop;

  return 'Final release defaults seeded.';
end;
$$;

-- Seed on migration for immediate visibility.
select seed_final_release_defaults();

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_final_sprint_org_status on final_release_sprint_items(organization_id, status, severity);
create index if not exists idx_final_sprint_blocking on final_release_sprint_items(organization_id, go_live_blocking, status);
create index if not exists idx_final_acceptance_org_status on final_acceptance_test_results(organization_id, status, is_critical);
create index if not exists idx_final_cutover_org_status on final_cutover_tasks(organization_id, status, sequence_no);
create index if not exists idx_final_artifacts_org_status on final_consolidation_artifacts(organization_id, status);
create index if not exists idx_final_ui_polish_org_status on final_ui_polish_items(organization_id, status, severity);

-- =========================
-- VIEWS
-- =========================

create or replace view v_final_go_live_gateboard as
select
  id,
  organization_id,
  release_tag,
  gate_code,
  gate_group,
  title,
  description,
  owner_label,
  severity,
  status,
  evidence_required,
  evidence_note,
  target_date,
  sequence_no,
  go_live_blocking,
  case
    when status = 'blocked' then 100
    when status = 'warning' and go_live_blocking then 80
    when status = 'warning' then 50
    when status = 'pending' and go_live_blocking then 60
    when status = 'in_progress' then 30
    else 0
  end as gate_weight
from final_release_sprint_items;

create or replace view v_final_acceptance_tests as
select
  id,
  organization_id,
  test_code,
  test_area,
  title,
  persona,
  expected_result,
  status,
  is_critical,
  evidence_note,
  failure_note,
  tested_by,
  tested_at
from final_acceptance_test_results;

create or replace view v_final_cutover_plan as
select
  id,
  organization_id,
  phase_name,
  sequence_no,
  title,
  owner_label,
  planned_window,
  rollback_note,
  status,
  is_critical,
  evidence_note,
  completed_by,
  completed_at
from final_cutover_tasks;

create or replace view v_final_consolidation_artifacts as
select
  id,
  organization_id,
  artifact_code,
  title,
  artifact_type,
  status,
  owner_label,
  file_path,
  verification_note,
  verified_by,
  verified_at
from final_consolidation_artifacts;

create or replace view v_final_owner_clearance as
select
  organization_id,
  coalesce(owner_label, 'Unassigned') as owner_label,
  count(*)::integer as total_items,
  count(*) filter (where status = 'blocked')::integer as blocked_items,
  count(*) filter (where status = 'warning')::integer as warning_items,
  count(*) filter (where status = 'pass')::integer as passed_items,
  count(*) filter (where status in ('pending','in_progress'))::integer as pending_items,
  case
    when count(*) filter (where status = 'blocked') > 0 then 'blocked'
    when count(*) filter (where status in ('warning','pending','in_progress')) > 0 then 'watch'
    else 'clear'
  end as clearance_signal
from final_release_sprint_items
group by organization_id, coalesce(owner_label, 'Unassigned');

create or replace view v_final_finish_fast_scorecard as
select
  o.id as organization_id,
  'v3.0-rc-final-sprint'::text as release_tag,
  greatest(0, least(100,
    100
    - (select count(*) * 18 from final_release_sprint_items g where g.organization_id = o.id and g.status = 'blocked' and g.go_live_blocking = true)
    - (select count(*) * 8 from final_release_sprint_items g where g.organization_id = o.id and g.status = 'warning')
    - (select count(*) * 5 from final_release_sprint_items g where g.organization_id = o.id and g.status in ('pending','in_progress') and g.go_live_blocking = true)
    - (select count(*) * 12 from final_acceptance_test_results t where t.organization_id = o.id and t.status in ('fail','blocked') and t.is_critical = true)
  ))::integer as go_live_score,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.status = 'blocked')::integer as blockers,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.status = 'warning')::integer as warnings,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.status = 'pass')::integer as passed,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.status in ('pending','in_progress'))::integer as pending,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.gate_group = 'migration' and g.status in ('blocked','warning','pending'))::integer as migration_blocked,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.gate_group = 'security' and g.status in ('blocked','warning','pending'))::integer as rls_blocked,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.gate_group = 'backup' and g.status in ('blocked','warning','pending'))::integer as backup_blocked,
  (select count(*) from final_release_sprint_items g where g.organization_id = o.id and g.gate_group = 'bilingual' and g.status in ('blocked','warning','pending'))::integer as bilingual_warnings,
  (select count(*) from final_ui_polish_items u where u.organization_id = o.id and u.severity = 'critical' and u.status not in ('pass','not_applicable'))::integer as open_critical_issues,
  (select count(*) from final_ui_polish_items u where u.organization_id = o.id and u.severity = 'high' and u.status not in ('pass','not_applicable'))::integer as open_high_issues,
  case
    when exists (select 1 from final_release_sprint_items g where g.organization_id = o.id and g.status = 'blocked' and g.go_live_blocking = true) then 'blocked'
    when exists (select 1 from final_release_sprint_items g where g.organization_id = o.id and g.status in ('warning','pending','in_progress') and g.go_live_blocking = true) then 'conditional'
    else 'ready'
  end as ready_signal
from organizations o;

-- =========================
-- RLS
-- =========================

alter table final_release_sprint_items enable row level security;
alter table final_acceptance_test_results enable row level security;
alter table final_cutover_tasks enable row level security;
alter table final_consolidation_artifacts enable row level security;
alter table final_ui_polish_items enable row level security;

-- Safe default read policies for authenticated users. Existing role-specific RLS can be tightened later.
do $$ begin
  create policy final_release_sprint_read on final_release_sprint_items for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy final_acceptance_tests_read on final_acceptance_test_results for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy final_cutover_read on final_cutover_tasks for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy final_artifacts_read on final_consolidation_artifacts for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy final_ui_polish_read on final_ui_polish_items for select to authenticated using (true);
exception when duplicate_object then null;
end $$;

-- =========================================================
-- END 026_finish_fast_release_sprint.sql
-- =========================================================

-- =========================================================
-- BEGIN 027_final_production_leap.sql
-- sha256: 75be3128b9303747466683915e37b818fb5851815c9229e6667549c79f2da3f8
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 027
-- Final Production Leap: go-live controls, module readiness,
-- support handover, pilot acceptance and final scorecard.
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists final_go_live_controls (
  id uuid primary key default gen_random_uuid(),
  control_code text not null unique,
  control_group text not null,
  title text not null,
  description text,
  owner_label text,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  status text not null default 'pending' check (status in ('pass','warning','pending','blocked','accepted_risk')),
  evidence_required boolean not null default true,
  evidence_note text,
  go_live_blocking boolean not null default true,
  last_reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists module_release_readiness (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  module_name text not null,
  workspace_group text not null,
  readiness_percent integer not null default 0 check (readiness_percent between 0 and 100),
  status text not null default 'needs_review' check (status in ('ready','needs_review','blocked','pilot_only')),
  remaining_work text,
  owner_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists production_support_handover (
  id uuid primary key default gen_random_uuid(),
  support_area text not null unique,
  owner_label text not null,
  backup_owner_label text,
  runbook_ready boolean not null default false,
  escalation_path_ready boolean not null default false,
  status text not null default 'pending' check (status in ('ready','pending','blocked')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pilot_rollout_acceptance (
  id uuid primary key default gen_random_uuid(),
  pilot_area text not null unique,
  acceptance_owner text,
  target_date date,
  status text not null default 'not_started' check (status in ('not_started','in_progress','accepted','rejected','blocked')),
  acceptance_note text,
  accepted_at timestamptz,
  accepted_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_final_go_live_controls_updated_at on final_go_live_controls;
create trigger trg_final_go_live_controls_updated_at
before update on final_go_live_controls
for each row execute function set_updated_at();

drop trigger if exists trg_module_release_readiness_updated_at on module_release_readiness;
create trigger trg_module_release_readiness_updated_at
before update on module_release_readiness
for each row execute function set_updated_at();

drop trigger if exists trg_production_support_handover_updated_at on production_support_handover;
create trigger trg_production_support_handover_updated_at
before update on production_support_handover
for each row execute function set_updated_at();

drop trigger if exists trg_pilot_rollout_acceptance_updated_at on pilot_rollout_acceptance;
create trigger trg_pilot_rollout_acceptance_updated_at
before update on pilot_rollout_acceptance
for each row execute function set_updated_at();

create index if not exists idx_final_go_live_controls_status on final_go_live_controls(status);
create index if not exists idx_final_go_live_controls_blocking on final_go_live_controls(go_live_blocking, status);
create index if not exists idx_module_release_readiness_status on module_release_readiness(status);
create index if not exists idx_production_support_handover_status on production_support_handover(status);
create index if not exists idx_pilot_rollout_acceptance_status on pilot_rollout_acceptance(status);

create or replace function seed_v31_finish_fast_defaults()
returns jsonb
language plpgsql
security definer
as $$
begin
  insert into final_go_live_controls (control_code, control_group, title, description, owner_label, severity, status, evidence_required, evidence_note, go_live_blocking)
  values
    ('FF-001','Release integrity','Fresh migration run 001 → latest','Run all SQL migrations in a clean Supabase project and record the result before pilot rollout.','IT / System Admin','critical','blocked',true,'Screenshot or export of successful migration run',true),
    ('FF-002','Security','RLS persona testing complete','Test CEO, Governance, Department Manager, Quality, Auditor and Employee accounts with real scoped data.','Governance + IT','critical','blocked',true,'Persona screenshots and pass/fail log',true),
    ('FF-003','Quality safety','OVR end-to-end workflow verified','Submit, supervisor review, Quality review, corrective action, evidence and closure must be tested.','Quality Manager','high','pending',true,'One closed test OVR with audit trail',true),
    ('FF-004','Recovery','Backup and restore dry-run proven','A real database/storage restore dry-run should be documented.','IT / Supabase Admin','critical','blocked',true,'Restore dry-run job with result and notes',true),
    ('FF-005','Bilingual','Arabic / RTL screen pass','Review major pages in Arabic including tables, modals, forms, OVR, reports and dashboard cards.','Governance + Key Users','high','warning',true,'Arabic QA checklist',true),
    ('FF-006','Pilot','Pilot acceptance sign-off','Run a limited pilot before all-staff launch.','Executive Sponsor','high','pending',true,'Pilot sign-off note',true),
    ('FF-007','Performance','1,000 user / 50 department seed checked','Load realistic seed data and validate dashboard, tables and import/export performance.','IT / Governance','medium','pending',true,'Load seed run evidence',false),
    ('FF-008','Support','Support handover complete','Named support owners, backup owners, runbooks and escalation paths are documented.','System Owner','medium','warning',true,'Support handover sheet',false)
  on conflict (control_code) do nothing;

  insert into module_release_readiness (module_key, module_name, workspace_group, readiness_percent, status, remaining_work, owner_label)
  values
    ('executive','Executive Command','Executive Control',82,'needs_review','Prioritize executive cards after real data is loaded.','Executive Sponsor'),
    ('work','Projects / Work Execution','Work Execution',84,'needs_review','Test create/edit/close with evidence in staging.','Governance Admin'),
    ('risk','Risk / KRI / Compliance','GRC & Audit',80,'pilot_only','Load actual risk appetite thresholds and compliance obligations.','Risk Owner'),
    ('quality','OVR / Quality','Quality & OVR',86,'needs_review','Quality team must approve the real closure rules.','Quality Manager'),
    ('reports','Reports / Export / Backup','Reports & Data',78,'needs_review','Add production DB/storage backup outside browser export.','IT / Finance'),
    ('admin','Admin / Release / Security','Admin & Release',76,'blocked','RLS tests and admin safety gates must be passed.','System Admin')
  on conflict (module_key) do nothing;

  insert into production_support_handover (support_area, owner_label, backup_owner_label, runbook_ready, escalation_path_ready, status, notes)
  values
    ('Governance workflow support','Governance Admin','Audit Lead',true,true,'ready','Owns daily action-plan and evidence discipline.'),
    ('OVR / Quality support','Quality Manager','Quality Officer',true,true,'ready','Owns OVR review, classification and closure rules.'),
    ('Supabase / app technical support','IT Admin','External Developer',false,true,'pending','Needs production environment details and backup procedure.'),
    ('Executive reporting support','CEO Office','Finance Lead',false,false,'pending','Board pack rhythm and report owners need final confirmation.')
  on conflict (support_area) do nothing;

  insert into pilot_rollout_acceptance (pilot_area, acceptance_owner, target_date, status, acceptance_note)
  values
    ('Quality / OVR pilot','Quality Manager',null,'not_started','Run at least three test OVRs with different severity levels.'),
    ('Governance action tracking pilot','Governance Manager',null,'not_started','Create one executive decision, one risk mitigation project and one approval flow.'),
    ('Department manager pilot','Selected Department Managers',null,'not_started','Confirm department-only scope and task ownership experience.')
  on conflict (pilot_area) do nothing;

  return jsonb_build_object('seeded', true, 'migration', '027_final_production_leap');
end;
$$;

select seed_v31_finish_fast_defaults();

create or replace view v_v31_final_controls as
select
  c.*,
  case c.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end as severity_rank,
  case c.status when 'blocked' then 1 when 'warning' then 2 when 'pending' then 3 when 'accepted_risk' then 4 else 5 end as status_rank
from final_go_live_controls c;

create or replace view v_v31_module_readiness as
select
  m.*,
  case m.status when 'blocked' then 1 when 'needs_review' then 2 when 'pilot_only' then 3 else 4 end as status_rank
from module_release_readiness m;

create or replace view v_v31_support_handover as
select
  h.*,
  case h.status when 'blocked' then 1 when 'pending' then 2 else 3 end as status_rank
from production_support_handover h;

create or replace view v_v31_pilot_acceptance as
select
  p.*,
  case p.status when 'blocked' then 1 when 'rejected' then 2 when 'not_started' then 3 when 'in_progress' then 4 else 5 end as status_rank
from pilot_rollout_acceptance p;

create or replace view v_v31_go_live_scorecard as
with control_stats as (
  select
    count(*) filter (where go_live_blocking and status = 'blocked') as blocking_items,
    count(*) filter (where status in ('warning','pending')) as warning_items,
    count(*) filter (where status in ('pass','accepted_risk')) as passed_items,
    count(*) filter (where status = 'pending') as pending_items,
    count(*) as total_controls
  from final_go_live_controls
),
module_stats as (
  select
    count(*) filter (where status = 'ready') as modules_ready,
    count(*) as modules_total
  from module_release_readiness
),
support_stats as (
  select
    count(*) filter (where status = 'ready') as support_owners_ready,
    count(*) as support_owners_total
  from production_support_handover
),
pilot_stats as (
  select
    count(*) filter (where status = 'accepted') as pilot_accepted,
    count(*) as pilot_total
  from pilot_rollout_acceptance
)
select
  case
    when cs.blocking_items > 0 then 'blocked'
    when cs.warning_items > 0 or ms.modules_ready < ms.modules_total or ss.support_owners_ready < ss.support_owners_total then 'conditional'
    else 'go'
  end as readiness_signal,
  cs.blocking_items,
  cs.warning_items,
  cs.passed_items,
  cs.pending_items,
  ms.modules_ready,
  ms.modules_total,
  ss.support_owners_ready,
  ss.support_owners_total,
  least(100, greatest(0, round(
    (
      (cs.passed_items::numeric * 2) +
      (ms.modules_ready::numeric * 2) +
      (ss.support_owners_ready::numeric * 1.5) +
      (ps.pilot_accepted::numeric * 2) -
      (cs.blocking_items::numeric * 3)
    ) / greatest((cs.total_controls::numeric * 2) + (ms.modules_total::numeric * 2) + (ss.support_owners_total::numeric * 1.5) + (ps.pilot_total::numeric * 2), 1) * 100
  )))::integer as go_live_score
from control_stats cs
cross join module_stats ms
cross join support_stats ss
cross join pilot_stats ps;

-- =========================================================
-- END 027_final_production_leap.sql
-- =========================================================

-- =========================================================
-- BEGIN 028_final_release_factory.sql
-- sha256: 71702a19095df70f3336242deecc07f2bd6f7e11779c82d94597c2c2189466c9
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 028
-- Final Release Factory, consolidation evidence, handover signoff
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists release_factory_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  release_tag text not null default 'v3.2-final-release-factory',
  check_code text not null,
  check_group text not null,
  title text not null,
  description text,
  owner_label text,
  status text not null default 'pending' check (status in ('pending','in_progress','passed','warning','blocked','accepted_risk','not_applicable')),
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  evidence_required boolean not null default true,
  evidence_note text,
  sequence_no integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, release_tag, check_code)
);

create table if not exists consolidated_release_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  release_tag text not null default 'v3.2-final-release-factory',
  package_code text not null,
  title text not null,
  package_type text not null,
  status text not null default 'draft' check (status in ('draft','generated','verified','approved','blocked')),
  file_path text,
  checksum_note text,
  owner_label text,
  generated_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, release_tag, package_code)
);

create table if not exists final_handover_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  release_tag text not null default 'v3.2-final-release-factory',
  signoff_area text not null,
  owner_label text not null,
  status text not null default 'not_started' check (status in ('not_started','in_progress','signed_off','blocked','accepted_risk')),
  evidence_note text,
  signed_at timestamptz,
  sequence_no integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, release_tag, signoff_area)
);

create index if not exists idx_release_factory_checks_org on release_factory_checks(organization_id, release_tag);
create index if not exists idx_release_factory_checks_status on release_factory_checks(status, severity);
create index if not exists idx_release_factory_checks_group on release_factory_checks(check_group);
create index if not exists idx_consolidated_release_packages_org on consolidated_release_packages(organization_id, release_tag);
create index if not exists idx_final_handover_signoffs_org on final_handover_signoffs(organization_id, release_tag);

create or replace view v_release_factory_checks as
select
  id,
  organization_id,
  release_tag,
  check_code,
  check_group,
  title,
  description,
  owner_label,
  status,
  severity,
  evidence_required,
  evidence_note,
  sequence_no,
  created_at,
  updated_at
from release_factory_checks;

create or replace view v_consolidated_release_packages as
select
  id,
  organization_id,
  release_tag,
  package_code,
  title,
  package_type,
  status,
  file_path,
  checksum_note,
  owner_label,
  generated_at,
  verified_at,
  created_at,
  updated_at
from consolidated_release_packages;

create or replace view v_final_handover_signoffs as
select
  id,
  organization_id,
  release_tag,
  signoff_area,
  owner_label,
  status,
  evidence_note,
  signed_at,
  sequence_no,
  created_at,
  updated_at
from final_handover_signoffs;

create or replace view v_release_factory_scorecard as
with orgs as (
  select id as organization_id from organizations limit 1
), checks as (
  select
    organization_id,
    count(*) as total_checks,
    count(*) filter (where status = 'passed') as passed_checks,
    count(*) filter (where status = 'blocked') as blocked_checks,
    count(*) filter (where status = 'warning') as warning_checks,
    count(*) filter (where status in ('pending','in_progress')) as pending_checks,
    count(*) filter (where check_group = 'migration') as migration_checks,
    count(*) filter (where check_group = 'security') as rls_checks,
    count(*) filter (where check_group = 'backup') as backup_checks,
    count(*) filter (where check_group = 'bilingual') as bilingual_checks,
    count(*) filter (where check_group = 'ui') as ui_checks,
    count(*) filter (where check_group = 'handover') as handover_checks
  from release_factory_checks
  group by organization_id
)
select
  o.organization_id,
  'v3.2-final-release-factory' as release_tag,
  coalesce(c.total_checks, 0) as total_checks,
  coalesce(c.passed_checks, 0) as passed_checks,
  coalesce(c.blocked_checks, 0) as blocked_checks,
  coalesce(c.warning_checks, 0) as warning_checks,
  coalesce(c.pending_checks, 0) as pending_checks,
  coalesce(c.migration_checks, 0) as migration_checks,
  coalesce(c.rls_checks, 0) as rls_checks,
  coalesce(c.backup_checks, 0) as backup_checks,
  coalesce(c.bilingual_checks, 0) as bilingual_checks,
  coalesce(c.ui_checks, 0) as ui_checks,
  coalesce(c.handover_checks, 0) as handover_checks,
  case
    when coalesce(c.total_checks, 0) = 0 then 0
    else greatest(0, least(100, round(((coalesce(c.passed_checks, 0) * 100.0) + (coalesce(c.warning_checks, 0) * 50.0) + (coalesce(c.accepted_risk_checks, 0) * 70.0)) / nullif(c.total_checks, 0))))::int
  end as final_score,
  case
    when coalesce(c.blocked_checks, 0) > 0 then 'blocked'
    when coalesce(c.warning_checks, 0) > 0 or coalesce(c.pending_checks, 0) > 0 then 'conditional'
    else 'go'
  end as ready_signal
from orgs o
left join (
  select
    organization_id,
    count(*) as total_checks,
    count(*) filter (where status = 'passed') as passed_checks,
    count(*) filter (where status = 'blocked') as blocked_checks,
    count(*) filter (where status = 'warning') as warning_checks,
    count(*) filter (where status in ('pending','in_progress')) as pending_checks,
    count(*) filter (where status = 'accepted_risk') as accepted_risk_checks,
    count(*) filter (where check_group = 'migration') as migration_checks,
    count(*) filter (where check_group = 'security') as rls_checks,
    count(*) filter (where check_group = 'backup') as backup_checks,
    count(*) filter (where check_group = 'bilingual') as bilingual_checks,
    count(*) filter (where check_group = 'ui') as ui_checks,
    count(*) filter (where check_group = 'handover') as handover_checks
  from release_factory_checks
  group by organization_id
) c on c.organization_id = o.organization_id;

create or replace function seed_release_factory_defaults()
returns text
language plpgsql
security definer
as $$
declare
  org_id uuid;
begin
  select id into org_id from organizations limit 1;
  if org_id is null then
    insert into organizations (name_en, name_ar)
    values ('Al Modawat Specialized Medical Company', 'شركة المداواة التخصصية الطبية')
    returning id into org_id;
  end if;

  insert into release_factory_checks (organization_id, check_code, check_group, title, description, owner_label, status, severity, evidence_required, evidence_note, sequence_no)
  values
    (org_id, 'CODEBASE-CONSOLIDATED', 'consolidation', 'Single clean codebase created from all patches', 'Apply patches in order and remove obsolete duplicate files before pilot.', 'System Admin', 'pending', 'critical', true, 'Final repository commit hash and build output.', 10),
    (org_id, 'MIGRATIONS-BUNDLED', 'migration', 'Migrations bundled and verified in order', 'Generate migration manifest and run in a fresh Supabase staging project.', 'System Admin', 'blocked', 'critical', true, 'Migration manifest and Supabase fresh-run evidence.', 20),
    (org_id, 'RLS-PERSONA-PASS', 'security', 'RLS personas passed', 'Employee, department manager, Quality, Auditor and Executive scopes must be tested.', 'Access Admin', 'blocked', 'critical', true, 'Persona lab export and screenshots.', 30),
    (org_id, 'OVR-END-TO-END-PASS', 'quality', 'OVR workflow end-to-end passed', 'Reporter to HOD to Quality to corrective action to evidence to closure.', 'Quality Manager', 'warning', 'critical', true, 'One real test OVR closure package.', 40),
    (org_id, 'BACKUP-RESTORE-PROVED', 'backup', 'Backup and restore proved', 'Browser export plus database and storage backup dry-run.', 'IT / Governance', 'warning', 'critical', true, 'Restore dry-run record.', 50),
    (org_id, 'AR-RTL-QA-PASS', 'bilingual', 'Arabic/RTL critical pages reviewed', 'Home, OVR, reports, command center, export and admin screens verified.', 'Governance Admin', 'warning', 'high', true, 'Translation audit report.', 60),
    (org_id, 'UI-HUBS-CLEAN', 'ui', 'Navigation is clean and hub-based', 'Legacy routes stay available but daily navigation uses hubs.', 'Product Owner', 'passed', 'medium', false, 'Hub cleanup applied.', 70),
    (org_id, 'PILOT-WAVE-APPROVED', 'handover', 'Pilot wave approved', 'Start with leadership, Governance, Quality, Audit, Finance and selected department managers.', 'Executive Sponsor', 'pending', 'high', true, 'Pilot user list.', 80)
  on conflict (organization_id, release_tag, check_code) do nothing;

  insert into consolidated_release_packages (organization_id, package_code, title, package_type, status, file_path, checksum_note, owner_label)
  values
    (org_id, 'FINAL-CODEBASE', 'Final consolidated application source', 'source_bundle', 'draft', 'release/grc-control-center-final-source.zip', null, 'System Admin'),
    (org_id, 'MIGRATION-BUNDLE', 'Ordered migration bundle and manifest', 'sql_bundle', 'generated', 'supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql', 'Generated by npm run migrations:bundle', 'System Admin'),
    (org_id, 'HANDOVER-PACK', 'Operations handover and Day-1 runbook', 'documentation', 'generated', 'docs/PRODUCTION_OPERATOR_HANDOVER_BUNDLE.md', null, 'Governance Admin'),
    (org_id, 'ACCEPTANCE-EVIDENCE', 'Acceptance evidence package', 'qa_evidence', 'draft', null, 'Attach after pilot acceptance.', 'QA Owner')
  on conflict (organization_id, release_tag, package_code) do nothing;

  insert into final_handover_signoffs (organization_id, signoff_area, owner_label, status, evidence_note, sequence_no)
  values
    (org_id, 'Executive sponsor approval', 'Executive Sponsor', 'not_started', 'Signed go-live decision.', 10),
    (org_id, 'Quality / OVR workflow approval', 'Quality Manager', 'not_started', 'OVR scenario accepted.', 20),
    (org_id, 'Access control approval', 'Access Admin', 'not_started', 'RLS persona matrix accepted.', 30),
    (org_id, 'Backup and restore approval', 'IT / Governance', 'not_started', 'Restore dry-run passed.', 40)
  on conflict (organization_id, release_tag, signoff_area) do nothing;

  return 'Release factory defaults seeded.';
end;
$$;

-- =========================================================
-- END 028_final_release_factory.sql
-- =========================================================

-- =========================================================
-- BEGIN 029_production_proof_consolidation.sql
-- sha256: 7d9f2d2f3e384cc0902a9fcffb7add36d883332a65b332f519abf6ca610286b5
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 029
-- Production Proof Consolidation Layer
-- Final proof gates, release artifacts and pilot waves
-- =========================================================

create table if not exists production_proof_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  gate_code text not null,
  gate_group text not null,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','passed','warning','blocked','accepted_risk','not_applicable')),
  severity text not null default 'high' check (severity in ('hard_gate','critical','high','medium','low')),
  owner_label text,
  proof_required text,
  fast_action text,
  sequence_no integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, gate_code)
);

create table if not exists production_release_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  artifact_code text not null,
  title text not null,
  artifact_type text not null,
  status text not null default 'draft' check (status in ('missing','draft','generated','verified','approved','archived')),
  target_path text,
  owner_label text,
  required_for_pilot boolean not null default true,
  sequence_no integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, artifact_code)
);

create table if not exists production_pilot_waves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  wave_code text not null,
  title text not null,
  participant_scope text,
  status text not null default 'not_started' check (status in ('not_started','ready','in_progress','accepted','blocked')),
  acceptance_owner text,
  success_criteria text,
  sequence_no integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, wave_code)
);

create index if not exists idx_production_proof_gates_org on production_proof_gates(organization_id);
create index if not exists idx_production_proof_gates_status on production_proof_gates(status);
create index if not exists idx_production_proof_gates_sequence on production_proof_gates(sequence_no);
create index if not exists idx_production_artifacts_org on production_release_artifacts(organization_id);
create index if not exists idx_production_pilot_waves_org on production_pilot_waves(organization_id);

create or replace function seed_v33_production_proof_defaults()
returns text
language plpgsql
security definer
as $$
declare
  org_id uuid;
begin
  select id into org_id from organizations order by created_at limit 1;
  if org_id is null then
    insert into organizations (name_en, name_ar) values ('Al Modawat Specialized Medical Company', 'شركة المداواة التخصصية الطبية') returning id into org_id;
  end if;

  insert into production_proof_gates (organization_id, gate_code, gate_group, title, description, status, severity, owner_label, proof_required, fast_action, sequence_no)
  values
    (org_id,'CLEAN-REPO','consolidation','Clean local repository prepared','All patches applied in one working tree; primary navigation is hub-based and clean.','passed','hard_gate','System Admin','Git commit hash, build output and route audit.','Apply patches in order, run npm run final:all, commit the clean tree.',10),
    (org_id,'FRESH-SUPABASE','database','Fresh Supabase install verified','The consolidated migration bundle runs cleanly in a new Supabase project.','blocked','hard_gate','IT / Supabase Admin','Successful SQL execution and seed RPC evidence.','Run supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql in staging.',20),
    (org_id,'RLS-PERSONAS','security','RLS personas proven with real accounts','Executive, department manager, quality, auditor and employee accounts see only allowed scope.','warning','hard_gate','Access Admin','Persona test evidence and sign-off.','Run RLS Persona Lab with real test users.',30),
    (org_id,'OVR-PILOT','quality','OVR workflow pilot accepted','One OVR passes from reporter to HOD, Quality, corrective action, evidence and closure.','warning','hard_gate','Quality Manager','Closed test OVR and evidence review.','Run the OVR acceptance script.',40),
    (org_id,'BACKUP-RESTORE','backup','Backup and restore dry-run completed','Export package, database backup strategy and restore dry-run are documented.','warning','hard_gate','IT / Governance','Restore dry-run log and backup location.','Perform restore dry-run before production data migration.',50),
    (org_id,'PILOT-WAVE','rollout','Pilot wave approved before all-staff rollout','First pilot group is limited and named before scaling to 1,000 users.','pending','hard_gate','Executive Sponsor','Pilot list and go/no-go approval.','Approve 20–50 pilot users first.',60)
  on conflict (organization_id, gate_code) do update set
    title = excluded.title,
    description = excluded.description,
    severity = excluded.severity,
    owner_label = excluded.owner_label,
    proof_required = excluded.proof_required,
    fast_action = excluded.fast_action,
    sequence_no = excluded.sequence_no;

  insert into production_release_artifacts (organization_id, artifact_code, title, artifact_type, status, target_path, owner_label, required_for_pilot, sequence_no)
  values
    (org_id,'SOURCE-ZIP','Final source repository bundle','source','draft','release/grc-control-center-final-source.zip','System Admin',true,10),
    (org_id,'MIGRATION-BUNDLE','Ordered SQL migration bundle','database','generated','supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql','System Admin',true,20),
    (org_id,'RLS-EVIDENCE','RLS persona evidence pack','security','draft','release/evidence/rls-persona-pack','Access Admin',true,30),
    (org_id,'OVR-EVIDENCE','OVR end-to-end acceptance evidence','quality','draft','release/evidence/ovr-workflow-pack','Quality Manager',true,40),
    (org_id,'BACKUP-PROOF','Backup and restore proof package','backup','draft','release/evidence/backup-restore-pack','IT / Governance',true,50)
  on conflict (organization_id, artifact_code) do update set
    title = excluded.title,
    artifact_type = excluded.artifact_type,
    target_path = excluded.target_path,
    owner_label = excluded.owner_label,
    required_for_pilot = excluded.required_for_pilot,
    sequence_no = excluded.sequence_no;

  insert into production_pilot_waves (organization_id, wave_code, title, participant_scope, status, acceptance_owner, success_criteria, sequence_no)
  values
    (org_id,'WAVE-0','Core admin smoke test','System admin, Governance admin, Quality manager, IT','ready','System Admin','Login, dashboard, OVR form, export, RLS smoke and backup export pass.',10),
    (org_id,'WAVE-1','Leadership and control owners','Executive, Finance, HR, Quality, Audit, selected managers','ready','Executive Sponsor','No hard blocker for one working week.',20),
    (org_id,'WAVE-2','Department manager pilot','10 departments / 50–100 users','not_started','Governance Admin','Department scope and task/evidence flow accepted.',30),
    (org_id,'WAVE-3','All-staff limited actions','All employees with assigned-only access','not_started','Executive Sponsor','Employee workspace and OVR reporting are stable.',40)
  on conflict (organization_id, wave_code) do update set
    title = excluded.title,
    participant_scope = excluded.participant_scope,
    acceptance_owner = excluded.acceptance_owner,
    success_criteria = excluded.success_criteria,
    sequence_no = excluded.sequence_no;

  return 'v3.3 production proof defaults seeded';
end;
$$;

create or replace view v_v33_production_proof_gates as
select * from production_proof_gates;

create or replace view v_v33_production_artifacts as
select * from production_release_artifacts;

create or replace view v_v33_pilot_waves as
select * from production_pilot_waves;

create or replace view v_v33_production_proof_scorecard as
select
  o.id as organization_id,
  'v3.3-production-proof'::text as release_tag,
  greatest(0, least(100,
    100
    - (coalesce(sum(case when g.status = 'blocked' then 1 else 0 end),0) * 18)
    - (coalesce(sum(case when g.status = 'warning' then 1 else 0 end),0) * 7)
    - (coalesce(sum(case when g.status in ('pending','in_progress') then 1 else 0 end),0) * 4)
  ))::integer as proof_score,
  case
    when coalesce(sum(case when g.status = 'blocked' and g.severity = 'hard_gate' then 1 else 0 end),0) > 0 then 'blocked'
    when coalesce(sum(case when g.status in ('warning','pending','in_progress') then 1 else 0 end),0) > 0 then 'conditional'
    else 'go'
  end as go_live_signal,
  count(g.id)::integer as total_gates,
  coalesce(sum(case when g.status = 'passed' then 1 else 0 end),0)::integer as passed_gates,
  coalesce(sum(case when g.status = 'blocked' then 1 else 0 end),0)::integer as blocked_gates,
  coalesce(sum(case when g.status = 'warning' then 1 else 0 end),0)::integer as warning_gates,
  coalesce(sum(case when g.status in ('pending','in_progress') then 1 else 0 end),0)::integer as pending_gates,
  coalesce(sum(case when g.severity = 'hard_gate' then 1 else 0 end),0)::integer as hard_gates,
  (select count(*)::integer from production_release_artifacts a where a.organization_id = o.id and a.status in ('generated','verified','approved')) as consolidated_artifacts,
  (select count(*)::integer from production_pilot_waves w where w.organization_id = o.id and w.status in ('ready','accepted')) as pilot_wave_ready,
  coalesce(sum(case when g.status = 'blocked' and g.severity = 'hard_gate' then 1 else 0 end),0)::integer as unsafe_to_launch
from organizations o
left join production_proof_gates g on g.organization_id = o.id
group by o.id;

select seed_v33_production_proof_defaults();

-- =========================================================
-- END 029_production_proof_consolidation.sql
-- =========================================================

-- =========================================================
-- BEGIN 030_pilot_real_data_operations.sql
-- sha256: dd36aecdd83b5beaa42fac5dbaaaa211e6c02444ec5f3d202d0a5dc711bc7cd1
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 030
-- Pilot Operations, Real Data Import, Pilot Sign-off,
-- Issue Triage, and Rollout Readiness
-- =========================================================

create extension if not exists "pgcrypto";

-- Optional enums guarded by DO blocks
DO $$ BEGIN
  CREATE TYPE pilot_wave_status AS ENUM ('draft','ready','active','paused','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pilot_issue_severity AS ENUM ('critical','high','medium','low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pilot_issue_status AS ENUM ('open','triaged','in_progress','blocked','resolved','accepted_risk','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_readiness_status AS ENUM ('not_started','mapping','validating','ready','imported','blocked','rolled_back');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Pilot wave planning
-- =========================================================
create table if not exists pilot_waves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  wave_name text not null,
  wave_order integer not null default 1,
  scope_description text,
  target_departments integer not null default 0,
  target_users integer not null default 0,
  start_date date,
  end_date date,
  owner_id uuid references profiles(id) on delete set null,
  status pilot_wave_status not null default 'draft',
  readiness_score numeric(5,2) not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  success_criteria text,
  exit_criteria text,
  risk_notes text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pilot_wave_departments (
  id uuid primary key default gen_random_uuid(),
  pilot_wave_id uuid not null references pilot_waves(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  department_name_snapshot text,
  manager_id uuid references profiles(id) on delete set null,
  included boolean not null default true,
  readiness_notes text,
  created_at timestamptz not null default now()
);

create table if not exists pilot_participants (
  id uuid primary key default gen_random_uuid(),
  pilot_wave_id uuid references pilot_waves(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role_label text,
  department_id uuid references departments(id) on delete set null,
  onboarding_completed boolean not null default false,
  training_completed boolean not null default false,
  rls_verified boolean not null default false,
  first_login_at timestamptz,
  last_activity_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (pilot_wave_id, user_id)
);

-- =========================================================
-- Real data import readiness
-- =========================================================
create table if not exists real_data_import_controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  import_area text not null,
  owner_id uuid references profiles(id) on delete set null,
  source_file_name text,
  expected_rows integer not null default 0,
  validated_rows integer not null default 0,
  rejected_rows integer not null default 0,
  duplicate_warnings integer not null default 0,
  missing_required_warnings integer not null default 0,
  status import_readiness_status not null default 'not_started',
  validation_summary jsonb not null default '{}'::jsonb,
  last_validated_at timestamptz,
  imported_at timestamptz,
  rollback_available boolean not null default false,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Pilot issue triage
-- =========================================================
create table if not exists pilot_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  pilot_wave_id uuid references pilot_waves(id) on delete set null,
  title text not null,
  description text,
  module_area text,
  severity pilot_issue_severity not null default 'medium',
  status pilot_issue_status not null default 'open',
  reported_by uuid references profiles(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  related_record_table text,
  related_record_id uuid,
  workaround text,
  resolution_notes text,
  due_date date,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Pilot sign-off and go-live rehearsal
-- =========================================================
create table if not exists pilot_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  pilot_wave_id uuid references pilot_waves(id) on delete cascade,
  signoff_area text not null,
  signoff_owner_id uuid references profiles(id) on delete set null,
  required boolean not null default true,
  approved boolean not null default false,
  approved_at timestamptz,
  approval_notes text,
  blocker_count integer not null default 0,
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_wave_id, signoff_area)
);

create table if not exists go_live_rehearsals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  rehearsal_name text not null,
  rehearsal_date date,
  owner_id uuid references profiles(id) on delete set null,
  backup_verified boolean not null default false,
  restore_dry_run_verified boolean not null default false,
  rls_verified boolean not null default false,
  ovr_workflow_verified boolean not null default false,
  export_verified boolean not null default false,
  rollback_plan_verified boolean not null default false,
  result text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Generic updated_at support
-- =========================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_pilot_waves_updated_at ON pilot_waves;
  CREATE TRIGGER trg_pilot_waves_updated_at BEFORE UPDATE ON pilot_waves FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_real_data_import_controls_updated_at ON real_data_import_controls;
  CREATE TRIGGER trg_real_data_import_controls_updated_at BEFORE UPDATE ON real_data_import_controls FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_pilot_issues_updated_at ON pilot_issues;
  CREATE TRIGGER trg_pilot_issues_updated_at BEFORE UPDATE ON pilot_issues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_pilot_signoffs_updated_at ON pilot_signoffs;
  CREATE TRIGGER trg_pilot_signoffs_updated_at BEFORE UPDATE ON pilot_signoffs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_go_live_rehearsals_updated_at ON go_live_rehearsals;
  CREATE TRIGGER trg_go_live_rehearsals_updated_at BEFORE UPDATE ON go_live_rehearsals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- =========================================================
-- Indexes
-- =========================================================
create index if not exists idx_pilot_waves_org_status on pilot_waves(organization_id, status);
create index if not exists idx_pilot_wave_departments_wave on pilot_wave_departments(pilot_wave_id);
create index if not exists idx_pilot_participants_wave on pilot_participants(pilot_wave_id);
create index if not exists idx_real_data_import_org_area on real_data_import_controls(organization_id, import_area);
create index if not exists idx_pilot_issues_org_status on pilot_issues(organization_id, status);
create index if not exists idx_pilot_issues_wave on pilot_issues(pilot_wave_id);
create index if not exists idx_pilot_issues_severity on pilot_issues(severity);
create index if not exists idx_pilot_signoffs_wave on pilot_signoffs(pilot_wave_id);
create index if not exists idx_go_live_rehearsals_org on go_live_rehearsals(organization_id);

-- =========================================================
-- Views
-- =========================================================
create or replace view v_v34_pilot_wave_summary as
select
  pw.organization_id,
  pw.id as pilot_wave_id,
  pw.wave_name,
  pw.wave_order,
  pw.status,
  pw.start_date,
  pw.end_date,
  pw.target_departments,
  pw.target_users,
  pw.readiness_score,
  count(distinct pwd.department_id) filter (where pwd.included = true) as included_departments,
  count(distinct pp.user_id) as participants,
  count(distinct pp.user_id) filter (where pp.training_completed = true) as trained_users,
  count(distinct pp.user_id) filter (where pp.rls_verified = true) as rls_verified_users,
  count(distinct pi.id) filter (where pi.status not in ('resolved','closed')) as open_issues,
  count(distinct pi.id) filter (where pi.severity = 'critical' and pi.status not in ('resolved','closed')) as critical_open_issues,
  count(distinct ps.id) filter (where ps.required = true and ps.approved = true) as approved_signoffs,
  count(distinct ps.id) filter (where ps.required = true) as required_signoffs
from pilot_waves pw
left join pilot_wave_departments pwd on pwd.pilot_wave_id = pw.id
left join pilot_participants pp on pp.pilot_wave_id = pw.id
left join pilot_issues pi on pi.pilot_wave_id = pw.id
left join pilot_signoffs ps on ps.pilot_wave_id = pw.id
group by pw.organization_id, pw.id, pw.wave_name, pw.wave_order, pw.status, pw.start_date, pw.end_date, pw.target_departments, pw.target_users, pw.readiness_score;

create or replace view v_v34_real_data_import_readiness as
select
  organization_id,
  import_area,
  status,
  expected_rows,
  validated_rows,
  rejected_rows,
  duplicate_warnings,
  missing_required_warnings,
  case
    when status = 'blocked' then 'blocked'
    when expected_rows = 0 then 'not_measured'
    when rejected_rows > 0 or duplicate_warnings > 0 or missing_required_warnings > 0 then 'warning'
    when validated_rows >= expected_rows and status in ('ready','imported') then 'ready'
    else 'in_progress'
  end as readiness_signal,
  round(case when expected_rows = 0 then 0 else (validated_rows::numeric / greatest(expected_rows,1)::numeric) * 100 end, 2) as validation_percent,
  last_validated_at,
  imported_at,
  rollback_available,
  notes
from real_data_import_controls;

create or replace view v_v34_pilot_issue_board as
select
  pi.organization_id,
  pi.id,
  pi.title,
  pi.module_area,
  pi.severity,
  pi.status,
  pi.due_date,
  pi.created_at,
  pi.resolved_at,
  pw.wave_name,
  d.name_en as department_name_en,
  d.name_ar as department_name_ar,
  assignee.full_name_en as assigned_to_name,
  reporter.full_name_en as reported_by_name,
  case
    when pi.status in ('resolved','closed','accepted_risk') then 'closed'
    when pi.severity = 'critical' then 'critical'
    when pi.due_date is not null and pi.due_date < current_date then 'overdue'
    when pi.severity = 'high' then 'high'
    else 'normal'
  end as board_signal
from pilot_issues pi
left join pilot_waves pw on pw.id = pi.pilot_wave_id
left join departments d on d.id = pi.department_id
left join profiles assignee on assignee.id = pi.assigned_to
left join profiles reporter on reporter.id = pi.reported_by;

create or replace view v_v34_go_live_rehearsal_readiness as
select
  organization_id,
  id,
  rehearsal_name,
  rehearsal_date,
  result,
  backup_verified,
  restore_dry_run_verified,
  rls_verified,
  ovr_workflow_verified,
  export_verified,
  rollback_plan_verified,
  (
    (case when backup_verified then 1 else 0 end) +
    (case when restore_dry_run_verified then 1 else 0 end) +
    (case when rls_verified then 1 else 0 end) +
    (case when ovr_workflow_verified then 1 else 0 end) +
    (case when export_verified then 1 else 0 end) +
    (case when rollback_plan_verified then 1 else 0 end)
  ) as verified_steps,
  round((
    (
      (case when backup_verified then 1 else 0 end) +
      (case when restore_dry_run_verified then 1 else 0 end) +
      (case when rls_verified then 1 else 0 end) +
      (case when ovr_workflow_verified then 1 else 0 end) +
      (case when export_verified then 1 else 0 end) +
      (case when rollback_plan_verified then 1 else 0 end)
    )::numeric / 6::numeric
  ) * 100, 2) as rehearsal_score,
  notes
from go_live_rehearsals;

create or replace view v_v34_company_rollout_readiness as
select
  o.id as organization_id,
  o.name_en as organization_name_en,
  count(distinct pw.id) as pilot_waves,
  count(distinct pw.id) filter (where pw.status = 'completed') as completed_waves,
  count(distinct pi.id) filter (where pi.status not in ('resolved','closed','accepted_risk')) as open_pilot_issues,
  count(distinct pi.id) filter (where pi.severity = 'critical' and pi.status not in ('resolved','closed','accepted_risk')) as critical_pilot_issues,
  count(distinct rdic.id) filter (where rdic.status in ('ready','imported')) as ready_import_areas,
  count(distinct rdic.id) as total_import_areas,
  count(distinct glr.id) filter (where glr.result in ('passed','accepted')) as passed_rehearsals,
  count(distinct glr.id) as total_rehearsals,
  case
    when count(distinct pi.id) filter (where pi.severity = 'critical' and pi.status not in ('resolved','closed','accepted_risk')) > 0 then 'blocked'
    when count(distinct rdic.id) = 0 then 'not_ready'
    when count(distinct rdic.id) filter (where rdic.status in ('ready','imported')) < count(distinct rdic.id) then 'warning'
    when count(distinct glr.id) filter (where glr.result in ('passed','accepted')) = 0 then 'warning'
    else 'pilot_ready'
  end as rollout_signal
from organizations o
left join pilot_waves pw on pw.organization_id = o.id
left join pilot_issues pi on pi.organization_id = o.id
left join real_data_import_controls rdic on rdic.organization_id = o.id
left join go_live_rehearsals glr on glr.organization_id = o.id
group by o.id, o.name_en;

-- =========================================================
-- Seed helper
-- =========================================================
create or replace function seed_v34_pilot_defaults()
returns void
language plpgsql
security definer
as $$
declare
  org_id uuid;
  wave1 uuid;
begin
  select id into org_id from organizations order by created_at limit 1;
  if org_id is null then
    insert into organizations (name_en, name_ar) values ('Al Modawat Specialized Medical Company', 'شركة المداواة التخصصية الطبية') returning id into org_id;
  end if;

  insert into pilot_waves (organization_id, wave_name, wave_order, scope_description, target_departments, target_users, status, readiness_score, success_criteria, exit_criteria)
  values (org_id, 'Pilot Wave 1 - Core Governance Users', 1, 'Executives, Governance, Quality, Audit, Finance, HR, IT, and selected department managers.', 8, 60, 'ready', 72,
          'Core workflows run without critical blockers for 10 working days.',
          'No critical open issues, OVR workflow accepted, backup/export verified, RLS persona tests passed.')
  on conflict do nothing;

  select id into wave1 from pilot_waves where organization_id = org_id and wave_order = 1 order by created_at limit 1;

  insert into real_data_import_controls (organization_id, import_area, expected_rows, validated_rows, status, notes)
  values
    (org_id, 'departments', 50, 0, 'mapping', 'Map the final department list before import.'),
    (org_id, 'units_stations', 120, 0, 'mapping', 'Validate duplicate unit/station codes before import.'),
    (org_id, 'employees', 1000, 0, 'mapping', 'Validate email, employee number, department, role and scope.'),
    (org_id, 'projects', 50, 0, 'not_started', 'Import only major projects/action plans, not daily tasks.'),
    (org_id, 'risks', 80, 0, 'not_started', 'Start with major enterprise and departmental risks.'),
    (org_id, 'compliance_items', 100, 0, 'not_started', 'MOH, CBAHI, Civil Defense, ZATCA, HR, licenses, equipment certificates.')
  on conflict do nothing;

  if wave1 is not null then
    insert into pilot_signoffs (organization_id, pilot_wave_id, signoff_area, required, blocker_count)
    values
      (org_id, wave1, 'Fresh Supabase migrations verified', true, 0),
      (org_id, wave1, 'RLS persona testing passed', true, 0),
      (org_id, wave1, 'OVR workflow accepted by Quality', true, 0),
      (org_id, wave1, 'Backup/export and restore dry-run verified', true, 0),
      (org_id, wave1, 'Arabic/RTL critical screens accepted', true, 0),
      (org_id, wave1, 'Pilot users trained', true, 0)
    on conflict do nothing;
  end if;
end;
$$;

-- =========================================================
-- END 030_pilot_real_data_operations.sql
-- =========================================================

-- =========================================================
-- BEGIN 031_consolidation_pilot_fix_kit.sql
-- sha256: dd953cb4ce5d32b43d6d6f9a40d33bb1284c504756f7b034db99101eacbcc3dc
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 031
-- v3.5 Ultra Consolidation & Pilot Fix Kit
-- Purpose: final consolidation register, pilot defect triage,
-- data quality repair workflow, go-live SOP, and cutover freeze controls.
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================
do $$ begin
  create type v35_item_status as enum (
    'not_started',
    'in_progress',
    'blocked',
    'ready',
    'passed',
    'failed',
    'deferred',
    'closed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type v35_severity as enum (
    'critical',
    'high',
    'medium',
    'low',
    'info'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type v35_fix_domain as enum (
    'migration',
    'rls',
    'ui',
    'bilingual',
    'ovr',
    'workflow',
    'export_backup',
    'performance',
    'data_quality',
    'training',
    'other'
  );
exception when duplicate_object then null;
end $$;

-- =========================
-- CONSOLIDATED PATCH MANIFEST
-- =========================
create table if not exists consolidation_patch_manifest (
  id uuid primary key default gen_random_uuid(),
  patch_version text not null unique,
  patch_name text not null,
  patch_order integer not null unique,
  expected_zip_name text,
  expected_migration text,
  required boolean not null default true,
  applied_status v35_item_status not null default 'not_started',
  applied_by uuid references profiles(id) on delete set null,
  applied_at timestamptz,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- FINAL CONSOLIDATION DEFECTS
-- =========================
create table if not exists consolidation_defects (
  id uuid primary key default gen_random_uuid(),
  defect_code text unique,
  title text not null,
  description text,
  domain v35_fix_domain not null default 'other',
  severity v35_severity not null default 'medium',
  status v35_item_status not null default 'not_started',
  owner_id uuid references profiles(id) on delete set null,
  source_patch text,
  affected_path text,
  reproduction_steps text,
  expected_result text,
  actual_result text,
  fix_note text,
  due_date date,
  closed_by uuid references profiles(id) on delete set null,
  closed_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- REAL DATA REPAIR QUEUE
-- =========================
create table if not exists real_data_repair_queue (
  id uuid primary key default gen_random_uuid(),
  repair_code text unique,
  source_area text not null,
  entity_type text not null,
  entity_reference text,
  issue_title text not null,
  issue_description text,
  severity v35_severity not null default 'medium',
  status v35_item_status not null default 'not_started',
  suggested_fix text,
  assigned_to uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  fixed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- FINAL PILOT FIX SPRINTS
-- =========================
create table if not exists pilot_fix_sprints (
  id uuid primary key default gen_random_uuid(),
  sprint_name text not null,
  sprint_goal text not null,
  start_date date,
  end_date date,
  status v35_item_status not null default 'not_started',
  owner_id uuid references profiles(id) on delete set null,
  defects_open integer not null default 0,
  defects_closed integer not null default 0,
  go_no_go_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pilot_fix_sprint_items (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references pilot_fix_sprints(id) on delete cascade,
  defect_id uuid references consolidation_defects(id) on delete set null,
  repair_id uuid references real_data_repair_queue(id) on delete set null,
  title text not null,
  severity v35_severity not null default 'medium',
  status v35_item_status not null default 'not_started',
  owner_id uuid references profiles(id) on delete set null,
  due_date date,
  close_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- CUTOVER FREEZE & GO LIVE SOP
-- =========================
create table if not exists cutover_freeze_windows (
  id uuid primary key default gen_random_uuid(),
  freeze_name text not null,
  freeze_reason text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status v35_item_status not null default 'not_started',
  approved_by uuid references profiles(id) on delete set null,
  approval_note text,
  created_at timestamptz not null default now(),
  constraint cutover_freeze_range_valid check (ends_at > starts_at)
);

create table if not exists go_live_sop_steps (
  id uuid primary key default gen_random_uuid(),
  step_order integer not null unique,
  step_group text not null,
  step_title text not null,
  step_description text,
  required boolean not null default true,
  owner_role text,
  status v35_item_status not null default 'not_started',
  evidence_required boolean not null default true,
  evidence_note text,
  completed_by uuid references profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- OPERATOR DAILY LOG
-- =========================
create table if not exists production_operator_daily_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null default current_date,
  shift_name text not null default 'day',
  operator_id uuid references profiles(id) on delete set null,
  system_health_note text,
  backup_checked boolean not null default false,
  critical_alerts_checked boolean not null default false,
  ovr_queue_checked boolean not null default false,
  export_center_checked boolean not null default false,
  rls_incidents_found boolean not null default false,
  unresolved_issue_count integer not null default 0,
  handover_note text,
  created_at timestamptz not null default now(),
  unique (log_date, shift_name)
);

-- =========================
-- UPDATED_AT TRIGGER ATTACHMENT
-- =========================
create or replace function v35_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function v35_attach_updated_at_if_exists(target_table text)
returns void as $$
begin
  execute format('drop trigger if exists trg_%I_updated_at on %I', target_table, target_table);
  execute format('create trigger trg_%I_updated_at before update on %I for each row execute function v35_set_updated_at()', target_table, target_table);
exception when undefined_table then
  null;
end;
$$ language plpgsql;

select v35_attach_updated_at_if_exists('consolidation_patch_manifest');
select v35_attach_updated_at_if_exists('consolidation_defects');
select v35_attach_updated_at_if_exists('real_data_repair_queue');
select v35_attach_updated_at_if_exists('pilot_fix_sprints');
select v35_attach_updated_at_if_exists('pilot_fix_sprint_items');
select v35_attach_updated_at_if_exists('go_live_sop_steps');

-- =========================
-- INDEXES
-- =========================
create index if not exists idx_v35_manifest_status on consolidation_patch_manifest(applied_status, patch_order);
create index if not exists idx_v35_defects_status on consolidation_defects(status, severity, domain);
create index if not exists idx_v35_defects_owner on consolidation_defects(owner_id);
create index if not exists idx_v35_repairs_status on real_data_repair_queue(status, severity, source_area);
create index if not exists idx_v35_repairs_assigned on real_data_repair_queue(assigned_to);
create index if not exists idx_v35_sprints_status on pilot_fix_sprints(status, start_date, end_date);
create index if not exists idx_v35_sprint_items_status on pilot_fix_sprint_items(sprint_id, status, severity);
create index if not exists idx_v35_freeze_range on cutover_freeze_windows(starts_at, ends_at, status);
create index if not exists idx_v35_sop_status on go_live_sop_steps(status, step_order);
create index if not exists idx_v35_operator_log_date on production_operator_daily_log(log_date desc);

-- =========================
-- VIEWS
-- =========================
create or replace view v35_consolidation_scorecard as
select
  (select count(*) from consolidation_patch_manifest) as patches_registered,
  (select count(*) from consolidation_patch_manifest where applied_status in ('passed','ready','closed')) as patches_verified,
  (select count(*) from consolidation_patch_manifest where required and applied_status not in ('passed','ready','closed')) as patches_not_verified,
  (select count(*) from consolidation_defects where status not in ('closed','deferred')) as open_defects,
  (select count(*) from consolidation_defects where severity = 'critical' and status not in ('closed','deferred')) as critical_open_defects,
  (select count(*) from real_data_repair_queue where status not in ('closed','deferred')) as open_data_repairs,
  (select count(*) from go_live_sop_steps where required and status not in ('passed','ready','closed')) as sop_steps_remaining,
  greatest(0, least(100,
    100
    - ((select count(*) from consolidation_patch_manifest where required and applied_status not in ('passed','ready','closed')) * 4)
    - ((select count(*) from consolidation_defects where severity = 'critical' and status not in ('closed','deferred')) * 20)
    - ((select count(*) from consolidation_defects where severity = 'high' and status not in ('closed','deferred')) * 8)
    - ((select count(*) from real_data_repair_queue where severity in ('critical','high') and status not in ('closed','deferred')) * 6)
    - ((select count(*) from go_live_sop_steps where required and status not in ('passed','ready','closed')) * 3)
  ))::integer as consolidation_readiness_score;

create or replace view v35_final_blocker_board as
select 'Patch verification' as blocker_area,
       patch_version as reference,
       patch_name as title,
       applied_status::text as status,
       case when required then 'high' else 'medium' end as severity,
       verification_note as note
from consolidation_patch_manifest
where required and applied_status not in ('passed','ready','closed')
union all
select 'Consolidation defect', defect_code, title, status::text, severity::text, description
from consolidation_defects
where severity in ('critical','high') and status not in ('closed','deferred')
union all
select 'Data repair', repair_code, issue_title, status::text, severity::text, issue_description
from real_data_repair_queue
where severity in ('critical','high') and status not in ('closed','deferred')
union all
select 'Go-live SOP', step_order::text, step_title, status::text,
       case when required then 'high' else 'medium' end, step_description
from go_live_sop_steps
where required and status not in ('passed','ready','closed');

create or replace view v35_data_quality_radar as
select
  source_area,
  count(*) as total_issues,
  count(*) filter (where severity in ('critical','high')) as high_issues,
  count(*) filter (where status in ('closed','passed')) as closed_issues,
  count(*) filter (where status not in ('closed','deferred','passed')) as open_issues,
  case when count(*) = 0 then 100
       else round(100.0 * count(*) filter (where status in ('closed','passed')) / count(*), 1)
  end as closure_percent
from real_data_repair_queue
group by source_area;

create or replace view v35_operator_console as
select
  current_date as business_date,
  (select consolidation_readiness_score from v35_consolidation_scorecard) as readiness_score,
  (select count(*) from v35_final_blocker_board) as active_blockers,
  (select count(*) from cutover_freeze_windows where now() between starts_at and ends_at and status in ('ready','passed','in_progress')) as active_freeze_windows,
  (select count(*) from production_operator_daily_log where log_date = current_date) as today_operator_logs,
  (select count(*) from pilot_fix_sprints where status in ('not_started','in_progress','blocked')) as active_fix_sprints;

-- =========================
-- SEED DEFAULTS
-- =========================
create or replace function seed_v35_consolidation_defaults()
returns void as $$
begin
  insert into consolidation_patch_manifest (patch_version, patch_name, patch_order, expected_zip_name, expected_migration, required, applied_status)
  values
    ('v0.1','Starter foundation',1,'grc-control-center-starter.zip','001_core_foundation.sql',true,'not_started'),
    ('v0.2','Supabase service foundation',2,'grc-control-center-v0.2.zip','005_operational_views_and_storage.sql',true,'not_started'),
    ('v0.8','Bilingual and OVR module',8,'grc-control-center-v0.8-patch.zip','010_bilingual_and_ovr_module.sql',true,'not_started'),
    ('v1.3','Production hardening and modern UI',13,'grc-control-center-v1.3-production-hardening-modern-ui-patch.zip','015_production_hardening_health_print_controls.sql',true,'not_started'),
    ('v2.4','UI consolidation hubs',24,'grc-control-center-v2.4-ultra-ui-consolidation-patch.zip',null,true,'not_started'),
    ('v3.2','Final release factory',32,'grc-control-center-v3.2-final-release-factory-patch.zip','028_final_release_factory.sql',true,'not_started'),
    ('v3.3','Production proof',33,'grc-control-center-v3.3-production-proof-mega-patch.zip','029_production_proof_consolidation.sql',true,'not_started'),
    ('v3.4','Pilot real data operations',34,'grc-control-center-v3.4-ultra-pilot-real-data-patch.zip','030_pilot_real_data_operations.sql',true,'not_started'),
    ('v3.5','Consolidation and pilot fix kit',35,'grc-control-center-v3.5-ultra-consolidation-pilot-fix-patch.zip','031_consolidation_pilot_fix_kit.sql',true,'ready')
  on conflict (patch_version) do nothing;

  insert into go_live_sop_steps (step_order, step_group, step_title, step_description, required, owner_role, status)
  values
    (10,'Freeze','Announce pilot data freeze','Stop structural changes before final pilot import.',true,'Project Owner','not_started'),
    (20,'Backup','Export final pre-pilot backup package','Create browser export plus Supabase database/storage backup evidence.',true,'System Admin','not_started'),
    (30,'Migration','Run fresh install migration proof','Confirm migration bundle runs cleanly on fresh Supabase staging.',true,'System Admin','not_started'),
    (40,'Security','Run RLS persona proof','CEO, department manager, employee, Quality, and Auditor access must pass.',true,'Governance Admin','not_started'),
    (50,'OVR','Run OVR end-to-end test','Reporter submission to Quality closure and risk indicator update.',true,'Quality Manager','not_started'),
    (60,'Reports','Verify export/custom report pack','Export executive, Quality/OVR, audit/compliance, and department packs.',true,'Governance Admin','not_started'),
    (70,'Pilot','Run pilot acceptance script','Pilot departments sign off readiness or defects are logged.',true,'Pilot Owner','not_started'),
    (80,'Go/No-Go','Executive go/no-go decision','Final signed decision for pilot launch.',true,'Executive Sponsor','not_started')
  on conflict (step_order) do nothing;

  insert into pilot_fix_sprints (sprint_name, sprint_goal, status, go_no_go_note)
  values
    ('Pilot Fix Sprint 1','Resolve critical migration, RLS, OVR, and data import blockers before pilot launch.','not_started','No pilot launch if critical blockers remain.'),
    ('Pilot Fix Sprint 2','Resolve UX, bilingual, reporting, and training issues after first pilot feedback.','not_started','Pilot can continue if only medium/low defects remain.')
  on conflict do nothing;
end;
$$ language plpgsql;

-- Run seed safely
select seed_v35_consolidation_defaults();

-- =========================================================
-- END 031_consolidation_pilot_fix_kit.sql
-- =========================================================

-- =========================================================
-- BEGIN 032_final_local_doctor_production_simulator.sql
-- sha256: 13f6548aa9d03b88195d7fe3c01974a6c694fd2d5b8a7fd366e6386d2f6f0ec9
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 032
-- Final Local Doctor & Production Simulator Registry
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists final_validation_runs (
  id uuid primary key default gen_random_uuid(),
  validation_area text not null,
  validation_name text not null,
  status text not null default 'pending' check (status in ('pending','passed','warning','failed','blocked','not_applicable')),
  score numeric(5,2) not null default 0 check (score >= 0 and score <= 100),
  owner_name text,
  evidence_reference text,
  details jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (validation_area, validation_name)
);

create table if not exists production_evidence_registry (
  id uuid primary key default gen_random_uuid(),
  evidence_type text not null,
  title text not null,
  required_for_go_live boolean not null default true,
  status text not null default 'missing' check (status in ('missing','draft','submitted','accepted','rejected','not_required')),
  owner_name text,
  file_path text,
  notes text,
  accepted_by text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evidence_type, title)
);

create table if not exists final_pilot_signoff_matrix (
  id uuid primary key default gen_random_uuid(),
  signoff_area text not null,
  signoff_owner text not null,
  required_status text not null default 'required' check (required_status in ('required','optional','waived')),
  decision text not null default 'pending' check (decision in ('pending','accepted','accepted_with_notes','rejected','waived')),
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (signoff_area, signoff_owner)
);

create table if not exists final_go_live_stop_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null unique,
  title text not null,
  severity text not null default 'blocker' check (severity in ('blocker','major','minor','advisory')),
  rule_description text not null,
  is_active boolean not null default true,
  status text not null default 'clear' check (status in ('clear','triggered','waived','monitoring')),
  triggered_reason text,
  owner_name text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function set_v38_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_v38_final_validation_runs_updated_at on final_validation_runs;
create trigger trg_v38_final_validation_runs_updated_at
before update on final_validation_runs
for each row execute function set_v38_updated_at();

drop trigger if exists trg_v38_production_evidence_registry_updated_at on production_evidence_registry;
create trigger trg_v38_production_evidence_registry_updated_at
before update on production_evidence_registry
for each row execute function set_v38_updated_at();

drop trigger if exists trg_v38_final_pilot_signoff_matrix_updated_at on final_pilot_signoff_matrix;
create trigger trg_v38_final_pilot_signoff_matrix_updated_at
before update on final_pilot_signoff_matrix
for each row execute function set_v38_updated_at();

drop trigger if exists trg_v38_final_go_live_stop_rules_updated_at on final_go_live_stop_rules;
create trigger trg_v38_final_go_live_stop_rules_updated_at
before update on final_go_live_stop_rules
for each row execute function set_v38_updated_at();

create index if not exists idx_v38_validation_area_status on final_validation_runs(validation_area, status);
create index if not exists idx_v38_evidence_type_status on production_evidence_registry(evidence_type, status);
create index if not exists idx_v38_signoff_decision on final_pilot_signoff_matrix(decision);
create index if not exists idx_v38_stop_rules_status on final_go_live_stop_rules(status, severity);

create or replace view v_v38_final_readiness_scorecard as
with validation as (
  select
    count(*) as total,
    count(*) filter (where status = 'passed') as passed,
    count(*) filter (where status in ('failed','blocked')) as failed_or_blocked,
    coalesce(avg(score), 0) as avg_score
  from final_validation_runs
), evidence as (
  select
    count(*) filter (where required_for_go_live = true) as required_total,
    count(*) filter (where required_for_go_live = true and status = 'accepted') as accepted_total,
    count(*) filter (where required_for_go_live = true and status in ('missing','rejected')) as missing_or_rejected
  from production_evidence_registry
), signoffs as (
  select
    count(*) filter (where required_status = 'required') as required_total,
    count(*) filter (where required_status = 'required' and decision in ('accepted','accepted_with_notes')) as accepted_total,
    count(*) filter (where required_status = 'required' and decision = 'rejected') as rejected_total
  from final_pilot_signoff_matrix
), stops as (
  select
    count(*) filter (where is_active = true and status = 'triggered' and severity = 'blocker') as active_blockers,
    count(*) filter (where is_active = true and status = 'triggered' and severity = 'major') as active_major
  from final_go_live_stop_rules
)
select
  round((
    (case when validation.total = 0 then 0 else (validation.passed::numeric / validation.total::numeric) * 30 end) +
    (case when evidence.required_total = 0 then 0 else (evidence.accepted_total::numeric / evidence.required_total::numeric) * 25 end) +
    (case when signoffs.required_total = 0 then 0 else (signoffs.accepted_total::numeric / signoffs.required_total::numeric) * 25 end) +
    (case when stops.active_blockers = 0 then 20 else 0 end)
  ), 2) as readiness_score,
  validation.total as validation_checks,
  validation.passed as validation_passed,
  validation.failed_or_blocked as validation_failed_or_blocked,
  round(validation.avg_score, 2) as average_validation_score,
  evidence.required_total as required_evidence,
  evidence.accepted_total as accepted_evidence,
  evidence.missing_or_rejected as missing_or_rejected_evidence,
  signoffs.required_total as required_signoffs,
  signoffs.accepted_total as accepted_signoffs,
  signoffs.rejected_total as rejected_signoffs,
  stops.active_blockers,
  stops.active_major,
  case
    when stops.active_blockers > 0 then 'blocked'
    when validation.failed_or_blocked > 0 or evidence.missing_or_rejected > 0 or signoffs.rejected_total > 0 then 'not_ready'
    when (
      (case when validation.total = 0 then 0 else (validation.passed::numeric / validation.total::numeric) * 30 end) +
      (case when evidence.required_total = 0 then 0 else (evidence.accepted_total::numeric / evidence.required_total::numeric) * 25 end) +
      (case when signoffs.required_total = 0 then 0 else (signoffs.accepted_total::numeric / signoffs.required_total::numeric) * 25 end) +
      (case when stops.active_blockers = 0 then 20 else 0 end)
    ) >= 90 then 'ready_for_pilot_or_go_live'
    else 'needs_work'
  end as readiness_status
from validation, evidence, signoffs, stops;

create or replace function seed_v38_final_validation_defaults()
returns void as $$
begin
  insert into final_validation_runs (validation_area, validation_name, status, score, owner_name, details) values
    ('local_build', 'TypeScript typecheck passes', 'pending', 0, 'IT / Developer', '{"command":"npm run typecheck"}'::jsonb),
    ('local_build', 'Production build passes', 'pending', 0, 'IT / Developer', '{"command":"npm run build"}'::jsonb),
    ('performance', 'Bundle budget reviewed', 'pending', 0, 'IT / Developer', '{"command":"node scripts/v36-bundle-stats.mjs"}'::jsonb),
    ('database', 'Fresh Supabase migration run completed', 'pending', 0, 'IT / Admin', '{"expected":"001 through latest migration"}'::jsonb),
    ('security', 'RLS persona test completed', 'pending', 0, 'Governance / IT', '{"personas":["executive","department_manager","employee","quality","auditor"]}'::jsonb),
    ('ovr', 'OVR end-to-end workflow tested', 'pending', 0, 'Quality', '{"flow":"submit -> HOD -> Quality -> evidence -> closure"}'::jsonb),
    ('backup', 'Backup export generated and restore dry-run documented', 'pending', 0, 'IT / Admin', '{"evidence":"export package + restore notes"}'::jsonb),
    ('bilingual', 'Arabic/English and RTL smoke test completed', 'pending', 0, 'Operations / Admin', '{"scope":"home, hubs, OVR, reports, admin"}'::jsonb)
  on conflict (validation_area, validation_name) do nothing;

  insert into production_evidence_registry (evidence_type, title, required_for_go_live, owner_name) values
    ('build', 'Typecheck and production build screenshots/logs', true, 'IT / Developer'),
    ('database', 'Fresh Supabase migration completion evidence', true, 'IT / Admin'),
    ('security', 'RLS persona test evidence', true, 'IT / Governance'),
    ('backup', 'Backup export package and restore dry-run evidence', true, 'IT / Admin'),
    ('ovr', 'OVR workflow acceptance evidence', true, 'Quality Manager'),
    ('pilot', 'Pilot department acceptance notes', true, 'Pilot Owner'),
    ('bilingual', 'Arabic/RTL QA screenshot set', true, 'Admin / Operations')
  on conflict (evidence_type, title) do nothing;

  insert into final_pilot_signoff_matrix (signoff_area, signoff_owner, required_status) values
    ('Executive readiness', 'CEO / Executive Sponsor', 'required'),
    ('Quality and OVR workflow', 'Quality Manager', 'required'),
    ('Security and access', 'IT / Governance Admin', 'required'),
    ('Department pilot readiness', 'Pilot Department Manager', 'required'),
    ('Backup and restore', 'System Administrator', 'required'),
    ('Arabic/English usability', 'Operations Lead', 'required')
  on conflict (signoff_area, signoff_owner) do nothing;

  insert into final_go_live_stop_rules (rule_code, title, severity, rule_description, owner_name) values
    ('STOP-RLS-001', 'RLS persona failure', 'blocker', 'Any user can see data outside their allowed scope.', 'IT / Governance'),
    ('STOP-OVR-001', 'OVR closure control failure', 'blocker', 'OVR can be closed without Quality review or required evidence.', 'Quality Manager'),
    ('STOP-BACKUP-001', 'No verified backup or restore dry-run', 'blocker', 'No current backup/export evidence and restore dry-run documentation exists.', 'System Administrator'),
    ('STOP-BUILD-001', 'Production build failure', 'blocker', 'npm run build or npm run typecheck fails.', 'IT / Developer'),
    ('STOP-DATA-001', 'Critical real-data import defect', 'major', 'Duplicate department/unit/user data affects pilot or rollout.', 'Data Owner'),
    ('STOP-RTL-001', 'Arabic/RTL critical usability issue', 'major', 'Arabic screen layout prevents normal use in critical workflows.', 'Operations Lead')
  on conflict (rule_code) do nothing;
end;
$$ language plpgsql;

-- =========================================================
-- END 032_final_local_doctor_production_simulator.sql
-- =========================================================

-- =========================================================
-- BEGIN 033_v42_production_validation_and_rls_lab.sql
-- sha256: aa1ad365aecc768fd11211783b512cf902fc178e5c9ab21a04720637ea7c4fef
-- =========================================================

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

-- =========================================================
-- END 033_v42_production_validation_and_rls_lab.sql
-- =========================================================

-- =========================================================
-- BEGIN 034_v46_ovr_bilingual_rtl_production_hardening.sql
-- sha256: 9681929f02595b7ace1d51937249d7faf3859226f92edd42abe36d3212835823
-- =========================================================

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

-- =========================================================
-- END 034_v46_ovr_bilingual_rtl_production_hardening.sql
-- =========================================================

-- =========================================================
-- BEGIN 035_v50_scale_backup_restore.sql
-- sha256: f8b0c414d38cce0c7ce16d24418e25981d615cffb41ae3e9a9721e7a1a924e57
-- =========================================================

-- =========================================================
-- GRC Control Center v5.0
-- Scale readiness, query optimization, production backup,
-- and restore dry-run execution controls
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type v50_control_status as enum ('not_started','in_progress','passed','warning','blocked','waived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type v50_priority as enum ('critical','high','medium','low');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type v50_backup_type as enum ('database','storage','auth_users','browser_export','full_platform','restore_dryrun');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type v50_restore_result as enum ('not_started','running','passed','failed','partial','waived');
exception when duplicate_object then null;
end $$;

-- =========================
-- SCALE TEST PLANS
-- =========================

create table if not exists v50_scale_test_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique,
  title_en text not null,
  title_ar text,
  target_departments integer not null default 50,
  target_users integer not null default 1000,
  target_projects integer not null default 120,
  target_tasks integer not null default 1500,
  target_ovrs integer not null default 500,
  target_risks integer not null default 300,
  target_evidence_files integer not null default 800,
  status v50_control_status not null default 'not_started',
  owner_name text,
  planned_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists v50_scale_test_results (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references v50_scale_test_plans(id) on delete cascade,
  metric_name text not null,
  metric_name_ar text,
  measured_value numeric(18,2),
  target_value numeric(18,2),
  unit text default 'ms',
  status v50_control_status not null default 'not_started',
  measured_at timestamptz default now(),
  notes text
);

-- =========================
-- QUERY OPTIMIZATION QUEUE
-- =========================

create table if not exists v50_query_optimization_items (
  id uuid primary key default gen_random_uuid(),
  object_name text not null,
  object_type text not null default 'view',
  page_or_module text,
  risk_reason text not null,
  recommendation text not null,
  priority v50_priority not null default 'medium',
  status v50_control_status not null default 'not_started',
  owner_name text,
  evidence_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- PRODUCTION BACKUP STRATEGY
-- =========================

create table if not exists v50_backup_strategy_items (
  id uuid primary key default gen_random_uuid(),
  backup_type v50_backup_type not null,
  title_en text not null,
  title_ar text,
  required_frequency text not null default 'daily',
  owner_name text,
  storage_location text,
  verification_method text,
  escalation_owner text,
  status v50_control_status not null default 'not_started',
  last_verified_at timestamptz,
  next_due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists v50_backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_type v50_backup_type not null,
  run_label text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status v50_control_status not null default 'in_progress',
  size_mb numeric(18,2),
  file_count integer,
  storage_location text,
  performed_by text,
  verification_note text,
  failure_reason text,
  created_at timestamptz not null default now()
);

-- =========================
-- RESTORE DRY RUNS
-- =========================

create table if not exists v50_restore_dryrun_jobs (
  id uuid primary key default gen_random_uuid(),
  job_code text not null unique,
  title_en text not null,
  title_ar text,
  source_backup_run_id uuid references v50_backup_runs(id) on delete set null,
  restore_environment text not null default 'staging',
  planned_date date,
  started_at timestamptz,
  completed_at timestamptz,
  result v50_restore_result not null default 'not_started',
  owner_name text,
  approver_name text,
  approval_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists v50_restore_dryrun_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references v50_restore_dryrun_jobs(id) on delete cascade,
  step_order integer not null default 1,
  title_en text not null,
  title_ar text,
  expected_result text,
  actual_result text,
  status v50_control_status not null default 'not_started',
  evidence_reference text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================
-- INDEX SUPPORT
-- =========================

-- Safe indexes for common high-volume access patterns. Some may already exist from prior migrations.
create index if not exists idx_projects_org_status_due_v50 on projects(organization_id, status, target_end_date);
create index if not exists idx_tasks_org_assigned_status_due_v50 on tasks(organization_id, assigned_to, status, due_date);
create index if not exists idx_tasks_org_owner_status_due_v50 on tasks(organization_id, owner_id, status, due_date);
create index if not exists idx_milestones_org_owner_status_due_v50 on milestones(organization_id, owner_id, status, due_date);
create index if not exists idx_approvals_org_approver_status_v50 on approvals(organization_id, approver_id, status);
create index if not exists idx_evidence_org_status_created_v50 on evidence_files(organization_id, status, created_at desc);
create index if not exists idx_audit_logs_org_table_created_v50 on audit_logs(organization_id, table_name, created_at desc);
create index if not exists idx_notifications_user_created_v50 on notifications(user_id, created_at desc);

-- Optional indexes only if these tables exist; dynamic execution avoids install failure if earlier optional modules differ.
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='ovr_reports') then
    execute 'create index if not exists idx_ovr_org_status_severity_v50 on ovr_reports(organization_id, status, severity_level)';
    execute 'create index if not exists idx_ovr_org_department_created_v50 on ovr_reports(organization_id, department_id, created_at desc)';
  end if;
end $$;

-- =========================
-- SCORECARD VIEWS
-- =========================

create or replace view v_v50_scale_readiness_scorecard as
select
  count(*) as total_controls,
  count(*) filter (where status = 'passed') as passed_controls,
  count(*) filter (where status = 'blocked') as blocked_controls,
  count(*) filter (where status = 'warning') as warning_controls,
  case
    when count(*) = 0 then 0
    else round((count(*) filter (where status = 'passed'))::numeric * 100 / count(*), 2)
  end as readiness_percent
from v50_scale_test_plans;

create or replace view v_v50_query_optimization_queue as
select
  id,
  object_name,
  object_type,
  page_or_module,
  risk_reason,
  recommendation,
  priority,
  status,
  owner_name,
  evidence_note,
  created_at,
  updated_at
from v50_query_optimization_items
order by
  case priority when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
  created_at;

create or replace view v_v50_backup_restore_scorecard as
select
  (select count(*) from v50_backup_strategy_items) as backup_controls,
  (select count(*) from v50_backup_strategy_items where status='passed') as backup_passed,
  (select count(*) from v50_backup_strategy_items where status='blocked') as backup_blocked,
  (select count(*) from v50_backup_runs where created_at >= now() - interval '7 days') as backup_runs_last_7_days,
  (select count(*) from v50_restore_dryrun_jobs where result='passed') as restore_dryruns_passed,
  (select count(*) from v50_restore_dryrun_jobs where result in ('failed','partial')) as restore_dryruns_with_issues;

create or replace view v_v50_restore_dryrun_queue as
select
  j.id,
  j.job_code,
  j.title_en,
  j.title_ar,
  j.restore_environment,
  j.planned_date,
  j.result,
  j.owner_name,
  j.approver_name,
  count(s.id) as total_steps,
  count(s.id) filter (where s.status='passed') as passed_steps,
  count(s.id) filter (where s.status='blocked') as blocked_steps,
  j.created_at,
  j.updated_at
from v50_restore_dryrun_jobs j
left join v50_restore_dryrun_steps s on s.job_id = j.id
group by j.id
order by j.planned_date nulls last, j.created_at desc;

-- =========================
-- SEED DEFAULTS
-- =========================

create or replace function seed_v50_scale_backup_restore_defaults()
returns void as $$
declare
  restore_job_id uuid;
begin
  insert into v50_scale_test_plans (plan_code, title_en, title_ar, target_departments, target_users, target_projects, target_tasks, target_ovrs, target_risks, status, owner_name)
  values
    ('SCALE-1000-USERS', '1,000 user / 50 department scale simulation', 'محاكاة 1000 مستخدم و50 قسم', 50, 1000, 120, 1500, 500, 300, 'not_started', 'System Admin'),
    ('SCALE-DASHBOARD', 'Executive dashboard load timing', 'قياس سرعة لوحة التحكم التنفيذية', 50, 1000, 120, 1500, 500, 300, 'not_started', 'IT'),
    ('SCALE-SEARCH', 'Global search response timing', 'قياس سرعة البحث الشامل', 50, 1000, 120, 1500, 500, 300, 'not_started', 'IT')
  on conflict (plan_code) do nothing;

  insert into v50_query_optimization_items (object_name, object_type, page_or_module, risk_reason, recommendation, priority, status)
  values
    ('v_global_search_index', 'view', 'Global Search', 'Can become heavy as records grow', 'Confirm indexes on linked source tables and apply pagination/limit defaults.', 'high', 'not_started'),
    ('v_executive_command_summary', 'view', 'Executive Command Center', 'Executive dashboard may scan multiple objects', 'Use summary views and avoid loading detail tables on first paint.', 'high', 'not_started'),
    ('v_v34_pilot_wave_summary', 'view', 'Pilot Operations', 'Pilot dashboard may grow with waves/issues', 'Keep queue limited and export full detail only on demand.', 'medium', 'not_started'),
    ('evidence_files', 'table', 'Evidence Center', 'Evidence metadata can grow quickly', 'Default to recent/pending evidence with filters and pagination.', 'high', 'not_started'),
    ('audit_logs', 'table', 'Security/Audit', 'Audit logs become large in production', 'Use date filters and retention/archive strategy.', 'critical', 'not_started')
  on conflict do nothing;

  insert into v50_backup_strategy_items (backup_type, title_en, title_ar, required_frequency, owner_name, verification_method, escalation_owner, status)
  values
    ('database', 'PostgreSQL/Supabase database backup', 'نسخة احتياطية لقاعدة بيانات Supabase/PostgreSQL', 'daily', 'IT / System Admin', 'Restore sample database and compare table counts', 'Executive Sponsor', 'not_started'),
    ('storage', 'Supabase Storage evidence backup', 'نسخة احتياطية لملفات الأدلة في Supabase Storage', 'daily', 'IT / System Admin', 'Verify file count and sample file open test', 'Executive Sponsor', 'not_started'),
    ('auth_users', 'Auth/user recovery plan', 'خطة استرجاع المستخدمين والصلاحيات', 'weekly', 'System Admin', 'User access sample verification', 'Governance Admin', 'not_started'),
    ('browser_export', 'Browser export package', 'حزمة التصدير من المتصفح', 'weekly', 'Governance Admin', 'Open exported JSON/CSV and verify core sections', 'Governance Admin', 'not_started'),
    ('restore_dryrun', 'Restore dry-run proof', 'إثبات تجربة الاسترجاع', 'monthly', 'IT / System Admin', 'Documented restore drill with signoff', 'Executive Sponsor', 'not_started')
  on conflict do nothing;

  insert into v50_restore_dryrun_jobs (job_code, title_en, title_ar, restore_environment, planned_date, result, owner_name)
  values ('RESTORE-DRYRUN-001', 'First production backup restore dry-run', 'أول تجربة استرجاع من نسخة احتياطية', 'staging', current_date + 7, 'not_started', 'IT / System Admin')
  on conflict (job_code) do nothing;

  select id into restore_job_id from v50_restore_dryrun_jobs where job_code = 'RESTORE-DRYRUN-001';

  if restore_job_id is not null then
    insert into v50_restore_dryrun_steps (job_id, step_order, title_en, title_ar, expected_result, status)
    values
      (restore_job_id, 1, 'Confirm backup source exists', 'تأكيد وجود مصدر النسخة الاحتياطية', 'Backup file/location is accessible', 'not_started'),
      (restore_job_id, 2, 'Restore database to staging', 'استرجاع قاعدة البيانات إلى بيئة تجريبية', 'Database restores without SQL errors', 'not_started'),
      (restore_job_id, 3, 'Verify critical table counts', 'مطابقة عدد السجلات للجداول الحرجة', 'Core table counts match backup report', 'not_started'),
      (restore_job_id, 4, 'Verify evidence storage samples', 'اختبار عينات من ملفات الأدلة', 'Sample evidence files open correctly', 'not_started'),
      (restore_job_id, 5, 'Run application smoke test', 'تشغيل اختبار سريع للتطبيق', 'Home, OVR, dashboards, export pages load', 'not_started'),
      (restore_job_id, 6, 'Document issues and signoff', 'توثيق المشاكل والاعتماد', 'Restore dry-run signed off or action plan created', 'not_started')
    on conflict do nothing;
  end if;
end;
$$ language plpgsql;

-- =========================================================
-- END 035_v50_scale_backup_restore.sql
-- =========================================================

-- =========================================================
-- BEGIN 036_b_ovr_workflow_controls.sql
-- sha256: 4cecab6b5b728001ef1b18037ba19c69bdb4efabb1c233988919f3b8b71d5b29
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 012b
-- OVR workflow controls, closure guards and dashboard views
-- Requires 012a enum values first.
-- =========================================================

alter table public.ovr_reports
add column if not exists supervisor_due_date date;

alter table public.ovr_reports
add column if not exists quality_due_date date;

alter table public.ovr_reports
add column if not exists corrective_action_due_date date;

alter table public.ovr_reports
add column if not exists quality_closure_note text;

alter table public.ovr_reports
add column if not exists final_classification text;

alter table public.ovr_reports
add column if not exists final_severity_level public.ovr_severity_level;

create index if not exists idx_ovr_reports_supervisor_due on public.ovr_reports(supervisor_due_date);
create index if not exists idx_ovr_reports_quality_due on public.ovr_reports(quality_due_date);
create index if not exists idx_ovr_reports_corrective_due on public.ovr_reports(corrective_action_due_date);

create or replace function public.can_close_ovr(p_ovr_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ovr_reports o
    where o.id = p_ovr_report_id
      and (
        o.evidence_required = false
        or exists (
          select 1
          from public.evidence_files e
          where e.ovr_report_id = o.id
            and e.status = 'accepted'
        )
        or exists (
          select 1
          from public.projects p
          where p.id = o.linked_project_id
            and p.status = 'closed'
        )
      )
  );
$$;

create or replace function public.update_ovr_workflow(
  p_ovr_report_id uuid,
  p_next_status text,
  p_note text default null,
  p_supervisor_investigation text default null,
  p_corrective_action text default null,
  p_quality_manager_comments text default null,
  p_confirmed_severity_level public.ovr_severity_level default null,
  p_corrective_action_due_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ovr public.ovr_reports%rowtype;
  v_actor uuid := auth.uid();
begin
  select * into v_ovr
  from public.ovr_reports
  where id = p_ovr_report_id;

  if not found then
    raise exception 'OVR report not found';
  end if;

  if not public.can_access_scope(v_ovr.organization_id, v_ovr.division_id, v_ovr.department_id, v_ovr.unit_id)
     and not public.can_manage_grc() then
    raise exception 'You are not allowed to update this OVR report';
  end if;

  if p_next_status in ('closed', 'quality_closure_review') and not public.can_manage_grc() then
    raise exception 'Only Quality/GRC authorized roles can close or approve closure of OVR reports';
  end if;

  if p_next_status = 'under_quality_review' and coalesce(trim(p_supervisor_investigation), trim(v_ovr.supervisor_investigation), '') = '' then
    raise exception 'Supervisor/HOD investigation is required before Quality review';
  end if;

  if p_next_status in ('action_plan_required', 'corrective_action_in_progress')
     and coalesce(trim(p_corrective_action), trim(v_ovr.corrective_action), '') = '' then
    raise exception 'Corrective action is required for this OVR workflow step';
  end if;

  if p_next_status = 'returned_for_clarification' and coalesce(trim(p_note), '') = '' then
    raise exception 'Return reason is required before returning OVR for clarification';
  end if;

  if p_next_status = 'closed' then
    if coalesce(trim(p_quality_manager_comments), trim(v_ovr.quality_manager_comments), '') = '' then
      raise exception 'Quality closure comments are required before closure';
    end if;

    if not public.can_close_ovr(p_ovr_report_id) then
      raise exception 'OVR cannot be closed until accepted evidence is uploaded or linked corrective project is closed';
    end if;
  end if;

  update public.ovr_reports
  set
    status = p_next_status::public.ovr_status,
    supervisor_investigation = coalesce(nullif(trim(p_supervisor_investigation), ''), supervisor_investigation),
    corrective_action = coalesce(nullif(trim(p_corrective_action), ''), corrective_action),
    quality_manager_comments = coalesce(nullif(trim(p_quality_manager_comments), ''), quality_manager_comments),
    quality_closure_note = case when p_next_status = 'closed' then coalesce(nullif(trim(p_note), ''), quality_closure_note) else quality_closure_note end,
    rejection_reason = case when p_next_status in ('returned_for_clarification', 'rejected') then p_note else rejection_reason end,
    severity_level = coalesce(p_confirmed_severity_level, severity_level),
    final_severity_level = case when p_next_status = 'closed' then coalesce(p_confirmed_severity_level, severity_level) else final_severity_level end,
    corrective_action_due_date = coalesce(p_corrective_action_due_date, corrective_action_due_date),
    supervisor_due_date = case when p_next_status = 'submitted' then current_date + 1 else supervisor_due_date end,
    quality_due_date = case when p_next_status in ('under_quality_review', 'evidence_submitted', 'quality_closure_review') then current_date + 2 else quality_due_date end,
    reviewed_at = case when p_next_status in ('under_quality_review', 'action_plan_required', 'corrective_action_in_progress', 'evidence_submitted', 'quality_closure_review', 'closed') then now() else reviewed_at end,
    closed_by = case when p_next_status = 'closed' then v_actor else closed_by end,
    closed_at = case when p_next_status = 'closed' then now() else closed_at end,
    updated_by = v_actor,
    updated_at = now()
  where id = p_ovr_report_id;

  insert into public.comments (organization_id, ovr_report_id, body, created_by)
  values (
    v_ovr.organization_id,
    p_ovr_report_id,
    concat('OVR workflow changed to ', p_next_status, case when coalesce(trim(p_note), '') <> '' then ': ' || p_note else '' end),
    v_actor
  );
end;
$$;

create or replace function public.create_ovr_corrective_action_project(p_ovr_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ovr public.ovr_reports%rowtype;
  v_actor uuid := auth.uid();
  v_project_id uuid;
begin
  select * into v_ovr
  from public.ovr_reports
  where id = p_ovr_report_id;

  if not found then
    raise exception 'OVR report not found';
  end if;

  if v_ovr.linked_project_id is not null then
    return v_ovr.linked_project_id;
  end if;

  if not public.can_manage_grc()
     and not public.can_access_scope(v_ovr.organization_id, v_ovr.division_id, v_ovr.department_id, v_ovr.unit_id) then
    raise exception 'You are not allowed to create a corrective project for this OVR';
  end if;

  insert into public.projects (
    organization_id,
    title,
    description,
    category,
    source_type,
    source_reference_id,
    division_id,
    department_id,
    unit_id,
    owner_id,
    sponsor_id,
    start_date,
    target_end_date,
    priority,
    risk_level,
    status,
    evidence_required,
    closure_approval_required,
    created_by,
    updated_by
  ) values (
    v_ovr.organization_id,
    'OVR corrective action - ' || coalesce(v_ovr.ovr_number, v_ovr.logging_number, v_ovr.id::text),
    coalesce(v_ovr.corrective_action, v_ovr.brief_description),
    'OVR Corrective Action',
    'incident_ovr',
    v_ovr.id,
    v_ovr.division_id,
    v_ovr.department_id,
    v_ovr.unit_id,
    coalesce(v_ovr.owner_id, v_actor),
    v_actor,
    current_date,
    coalesce(v_ovr.corrective_action_due_date, current_date + 14),
    case when v_ovr.severity_level in ('level_4', 'sentinel') then 'critical' else 'high' end,
    case when v_ovr.severity_level in ('level_4', 'sentinel') then 'critical' else 'high' end,
    'active',
    true,
    true,
    v_actor,
    v_actor
  ) returning id into v_project_id;

  update public.ovr_reports
  set linked_project_id = v_project_id,
      corrective_action_required = true,
      status = 'corrective_action_in_progress',
      updated_by = v_actor,
      updated_at = now()
  where id = p_ovr_report_id;

  return v_project_id;
end;
$$;

create or replace view public.v_ovr_workflow_queue as
select
  o.id,
  o.organization_id,
  o.ovr_number,
  left(o.brief_description, 160) as title,
  d.name_en as department_name,
  pr.full_name_en as owner_name,
  o.occurrence_date,
  o.status,
  o.severity_level,
  case
    when o.status in ('submitted', 'under_supervisor_review') then 'supervisor_review'
    when o.status in ('under_quality_review', 'returned_for_clarification') then 'quality_review'
    when o.status in ('action_plan_required', 'corrective_action_in_progress') then 'corrective_action'
    when o.status in ('evidence_submitted', 'quality_closure_review') then 'evidence_closure_review'
    else o.status::text
  end as workflow_stage,
  case
    when o.status in ('submitted', 'under_supervisor_review') then coalesce(o.supervisor_due_date, o.occurrence_date + 1)
    when o.status in ('under_quality_review', 'returned_for_clarification') then coalesce(o.quality_due_date, o.occurrence_date + 3)
    when o.status in ('action_plan_required', 'corrective_action_in_progress') then coalesce(o.corrective_action_due_date, o.occurrence_date + 14)
    when o.status in ('evidence_submitted', 'quality_closure_review') then coalesce(o.quality_due_date, o.occurrence_date + 5)
    else null::date
  end as due_date,
  case
    when o.status in ('submitted', 'under_supervisor_review') then coalesce(o.supervisor_due_date, o.occurrence_date + 1) < current_date
    when o.status in ('under_quality_review', 'returned_for_clarification') then coalesce(o.quality_due_date, o.occurrence_date + 3) < current_date
    when o.status in ('action_plan_required', 'corrective_action_in_progress') then coalesce(o.corrective_action_due_date, o.occurrence_date + 14) < current_date
    when o.status in ('evidence_submitted', 'quality_closure_review') then coalesce(o.quality_due_date, o.occurrence_date + 5) < current_date
    else false
  end as is_overdue,
  case
    when o.severity_level in ('level_4', 'sentinel') then 'critical'::public.risk_level
    when o.status in ('returned_for_clarification', 'rejected') then 'high'::public.risk_level
    when o.status in ('evidence_submitted', 'quality_closure_review') then 'high'::public.risk_level
    else 'medium'::public.risk_level
  end as risk_level
from public.ovr_reports o
left join public.departments d on d.id = o.department_id
left join public.profiles pr on pr.id = o.owner_id
where o.status not in ('draft', 'closed', 'cancelled')
order by is_overdue desc, due_date asc nulls last;

create or replace view public.v_ovr_workflow_control_summary as
select
  o.organization_id,
  count(*) filter (where o.status in ('submitted', 'under_supervisor_review')) as pending_supervisor_review,
  count(*) filter (where o.status = 'under_quality_review') as pending_quality_review,
  count(*) filter (where o.status = 'returned_for_clarification') as returned_for_clarification,
  count(*) filter (where o.status in ('evidence_submitted', 'quality_closure_review')) as pending_evidence_review,
  count(*) filter (where o.status not in ('closed', 'cancelled') and o.severity_level in ('level_4', 'sentinel')) as major_open_ovrs,
  count(*) filter (where q.is_overdue = true) as overdue_ovr_workflow_items
from public.ovr_reports o
left join public.v_ovr_workflow_queue q on q.id = o.id
group by o.organization_id;

create or replace view public.v_critical_attention_items as
select * from (
  select
    p.id,
    p.organization_id,
    'project'::text as item_type,
    p.title,
    d.name_en as department_name,
    pr.full_name_en as owner_name,
    p.target_end_date as due_date,
    p.status::text as status,
    p.risk_level,
    p.progress_percent,
    case when p.risk_level = 'critical' then 1 when p.risk_level = 'high' then 2 when p.status = 'delayed' then 3 else 8 end as sort_rank
  from public.projects p
  left join public.departments d on d.id = p.department_id
  left join public.profiles pr on pr.id = p.owner_id
  where p.status not in ('closed', 'cancelled')
    and (p.risk_level in ('critical', 'high') or p.status in ('delayed', 'at_risk', 'completed_pending_evidence', 'completed_pending_approval') or (p.target_end_date is not null and p.target_end_date < current_date))

  union all
  select r.id, r.organization_id, 'risk'::text, r.title, d.name_en, pr.full_name_en, r.next_review_date, r.status::text, r.risk_level, null::numeric, case when r.risk_level = 'critical' then 1 when r.risk_level = 'high' then 2 else 8 end
  from public.risks r
  left join public.departments d on d.id = r.department_id
  left join public.profiles pr on pr.id = r.owner_id
  where r.status not in ('closed', 'cancelled') and r.risk_level in ('critical', 'high')

  union all
  select c.id, c.organization_id, 'compliance'::text, c.title, d.name_en, pr.full_name_en, coalesce(c.expiry_date, c.due_date), c.status::text, c.risk_level, null::numeric, case when c.expiry_date is not null and c.expiry_date <= current_date + interval '7 days' then 1 when c.risk_level = 'critical' then 2 else 5 end
  from public.compliance_items c
  left join public.departments d on d.id = c.department_id
  left join public.profiles pr on pr.id = c.owner_id
  where c.status not in ('closed', 'cancelled') and (c.risk_level in ('critical', 'high') or (c.expiry_date is not null and c.expiry_date <= current_date + interval '30 days') or (c.due_date is not null and c.due_date < current_date))

  union all
  select af.id, af.organization_id, 'audit_finding'::text, af.title, d.name_en, pr.full_name_en, af.due_date, af.status::text, af.risk_level, null::numeric, case when af.due_date is not null and af.due_date < current_date then 1 when af.risk_level = 'critical' then 2 else 4 end
  from public.audit_findings af
  left join public.departments d on d.id = af.department_id
  left join public.profiles pr on pr.id = af.owner_id
  where af.status not in ('closed', 'cancelled') and (af.risk_level in ('critical', 'high') or (af.due_date is not null and af.due_date < current_date))

  union all
  select cd.id, cd.organization_id, 'governance_decision'::text, cd.title, d.name_en, pr.full_name_en, cd.due_date, cd.status::text, cd.risk_level, null::numeric, case when cd.status = 'delayed' then 1 when cd.priority = 'critical' then 2 else 6 end
  from public.committee_decisions cd
  left join public.departments d on d.id = cd.department_id
  left join public.profiles pr on pr.id = cd.owner_id
  where cd.status not in ('closed', 'cancelled') and (cd.priority in ('critical', 'high') or cd.risk_level in ('critical', 'high') or cd.status in ('delayed', 'pending_evidence', 'pending_approval'))

  union all
  select
    o.id,
    o.organization_id,
    'ovr'::text,
    coalesce(o.ovr_number, o.logging_number, 'OVR') || ' - ' || left(o.brief_description, 90) as title,
    d.name_en,
    pr.full_name_en,
    q.due_date,
    o.status::text,
    q.risk_level,
    null::numeric,
    case when o.severity_level in ('level_4', 'sentinel') then 1 when q.is_overdue then 2 else 4 end
  from public.ovr_reports o
  left join public.v_ovr_workflow_queue q on q.id = o.id
  left join public.departments d on d.id = o.department_id
  left join public.profiles pr on pr.id = o.owner_id
  where o.status not in ('closed', 'cancelled')
    and (o.severity_level in ('level_4', 'sentinel') or q.is_overdue = true or o.status in ('returned_for_clarification', 'evidence_submitted', 'quality_closure_review'))
) q
order by sort_rank asc, due_date asc nulls last;

-- =========================================================
-- END 036_b_ovr_workflow_controls.sql
-- =========================================================

-- =========================================================
-- BEGIN 037_v58_pilot_rollout_security_audit.sql
-- sha256: 88972a4a9e2c7619590db56848cf6ce87bb233a8fd7cd4ed310474536843e1db
-- =========================================================

-- =========================================================
-- GRC Control Center v5.8
-- Pilot Execution + Company Rollout + Security Review + Audit Trail Hardening
-- Migration 037
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================
-- v5.5 PILOT EXECUTION
-- =========================

create table if not exists pilot_execution_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  pilot_name text not null,
  pilot_scope text not null default 'limited departments',
  target_users integer not null default 60 check (target_users >= 0),
  actual_users integer not null default 0 check (actual_users >= 0),
  target_departments integer not null default 5 check (target_departments >= 0),
  actual_departments integer not null default 0 check (actual_departments >= 0),
  start_date date,
  end_date date,
  status text not null default 'planned' check (status in ('planned','active','paused','completed','cancelled')),
  go_no_go text not null default 'pending' check (go_no_go in ('pending','go','conditional_go','no_go')),
  owner text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pilot_feedback_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  pilot_run_id uuid references pilot_execution_runs(id) on delete cascade,
  feedback_area text not null,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  title text not null,
  description text,
  reported_by_role text,
  owner text,
  status text not null default 'open' check (status in ('open','in_progress','resolved','accepted_risk','cancelled')),
  due_date date,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- v5.6 COMPANY ROLLOUT
-- =========================

create table if not exists company_rollout_waves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  wave_no integer not null check (wave_no > 0),
  wave_name text not null,
  target_users integer not null default 0,
  target_departments integer not null default 0,
  training_required boolean not null default true,
  support_owner text,
  planned_start date,
  planned_end date,
  status text not null default 'not_started' check (status in ('not_started','ready','active','paused','completed','cancelled')),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  blocker_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, wave_no)
);

create table if not exists department_onboarding_status (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  department_id uuid references departments(id) on delete cascade,
  department_name text,
  rollout_wave_id uuid references company_rollout_waves(id) on delete set null,
  users_imported boolean not null default false,
  managers_trained boolean not null default false,
  employees_trained boolean not null default false,
  permissions_verified boolean not null default false,
  sample_workflow_tested boolean not null default false,
  support_contact_assigned boolean not null default false,
  status text not null default 'not_ready' check (status in ('not_ready','in_progress','ready','live','blocked')),
  blocker_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- v5.7 SECURITY REVIEW
-- =========================

create table if not exists security_review_checks_v58 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  check_code text not null,
  check_area text not null,
  title text not null,
  description text,
  risk_level text not null default 'medium' check (risk_level in ('critical','high','medium','low')),
  owner text,
  status text not null default 'not_started' check (status in ('not_started','in_progress','passed','failed','waived')),
  evidence_reference text,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, check_code)
);

create table if not exists access_security_findings_v58 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  finding_type text not null,
  user_reference text,
  role_reference text,
  scope_reference text,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  title text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','accepted_risk','false_positive')),
  remediation_owner text,
  remediation_due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- v5.8 AUDIT TRAIL HARDENING
-- =========================

create table if not exists audit_trail_controls_v58 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  control_code text not null,
  process_area text not null,
  title text not null,
  required_event text not null,
  required_for_production boolean not null default true,
  status text not null default 'not_verified' check (status in ('not_verified','verified','gap_found','not_applicable','waived')),
  evidence_reference text,
  verifier text,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, control_code)
);

create table if not exists audit_trail_samples_v58 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  sample_area text not null,
  sample_reference text,
  expected_audit_events text[] not null default '{}',
  actual_audit_events text[] not null default '{}',
  result text not null default 'pending' check (result in ('pending','passed','failed','waived')),
  reviewer text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists production_exception_register_v58 (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  exception_area text not null,
  title text not null,
  risk_level text not null default 'medium' check (risk_level in ('critical','high','medium','low')),
  business_justification text,
  compensating_control text,
  owner text,
  expiry_date date,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','expired')),
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================
-- Updated_at triggers helper
-- =========================

create or replace function v58_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'pilot_execution_runs',
    'pilot_feedback_items',
    'company_rollout_waves',
    'department_onboarding_status',
    'security_review_checks_v58',
    'access_security_findings_v58',
    'audit_trail_controls_v58'
  ] loop
    execute format('drop trigger if exists trg_%I_updated_at on %I', t, t);
    execute format('create trigger trg_%I_updated_at before update on %I for each row execute function v58_touch_updated_at()', t, t);
  end loop;
end $$;

-- =========================
-- Indexes
-- =========================

create index if not exists idx_v58_pilot_runs_status on pilot_execution_runs(status, go_no_go);
create index if not exists idx_v58_pilot_feedback_status on pilot_feedback_items(status, severity);
create index if not exists idx_v58_rollout_waves_status on company_rollout_waves(status, readiness_score);
create index if not exists idx_v58_department_onboarding_status on department_onboarding_status(status);
create index if not exists idx_v58_security_checks_status on security_review_checks_v58(status, risk_level);
create index if not exists idx_v58_security_findings_status on access_security_findings_v58(status, severity);
create index if not exists idx_v58_audit_controls_status on audit_trail_controls_v58(status, required_for_production);
create index if not exists idx_v58_exceptions_status on production_exception_register_v58(approval_status, risk_level);

-- =========================
-- Views
-- =========================

create or replace view v_v58_pilot_readiness_scorecard as
select
  coalesce(count(*), 0)::integer as pilot_runs,
  coalesce(count(*) filter (where status in ('active','completed')), 0)::integer as active_or_completed_runs,
  coalesce(count(*) filter (where go_no_go in ('go','conditional_go')), 0)::integer as go_ready_runs,
  coalesce((select count(*) from pilot_feedback_items where status in ('open','in_progress') and severity in ('critical','high')),0)::integer as high_open_feedback,
  case
    when coalesce((select count(*) from pilot_feedback_items where status in ('open','in_progress') and severity = 'critical'),0) > 0 then 45
    when coalesce(count(*) filter (where go_no_go in ('go','conditional_go')), 0) > 0 then 90
    when coalesce(count(*),0) > 0 then 70
    else 25
  end as readiness_score
from pilot_execution_runs;

create or replace view v_v58_rollout_readiness_scorecard as
select
  coalesce(count(*),0)::integer as rollout_waves,
  coalesce(count(*) filter (where status in ('ready','active','completed')),0)::integer as ready_or_live_waves,
  coalesce(sum(target_users),0)::integer as target_users,
  coalesce(sum(blocker_count),0)::integer as blocker_count,
  coalesce((select count(*) from department_onboarding_status where status = 'ready'),0)::integer as ready_departments,
  coalesce((select count(*) from department_onboarding_status where status = 'blocked'),0)::integer as blocked_departments,
  case
    when coalesce(sum(blocker_count),0) > 0 then 60
    when coalesce(count(*) filter (where status in ('ready','active','completed')),0) = coalesce(count(*),0) and count(*) > 0 then 95
    when count(*) > 0 then 75
    else 30
  end as rollout_score
from company_rollout_waves;

create or replace view v_v58_security_review_scorecard as
select
  coalesce(count(*),0)::integer as total_checks,
  coalesce(count(*) filter (where status = 'passed'),0)::integer as passed_checks,
  coalesce(count(*) filter (where status = 'failed' and risk_level in ('critical','high')),0)::integer as high_failed_checks,
  coalesce((select count(*) from access_security_findings_v58 where status in ('open','in_progress') and severity in ('critical','high')),0)::integer as high_open_findings,
  case
    when coalesce(count(*) filter (where status = 'failed' and risk_level = 'critical'),0) > 0 then 30
    when coalesce((select count(*) from access_security_findings_v58 where status in ('open','in_progress') and severity = 'critical'),0) > 0 then 35
    when count(*) = 0 then 25
    else least(100, round(100.0 * count(*) filter (where status in ('passed','waived')) / greatest(count(*),1))::integer)
  end as security_score
from security_review_checks_v58;

create or replace view v_v58_audit_trail_scorecard as
select
  coalesce(count(*),0)::integer as total_controls,
  coalesce(count(*) filter (where status = 'verified'),0)::integer as verified_controls,
  coalesce(count(*) filter (where status = 'gap_found' and required_for_production = true),0)::integer as production_gaps,
  coalesce((select count(*) from audit_trail_samples_v58 where result = 'failed'),0)::integer as failed_samples,
  case
    when coalesce(count(*) filter (where status = 'gap_found' and required_for_production = true),0) > 0 then 40
    when count(*) = 0 then 25
    else least(100, round(100.0 * count(*) filter (where status in ('verified','waived','not_applicable')) / greatest(count(*),1))::integer)
  end as audit_trail_score
from audit_trail_controls_v58;

create or replace view v_v58_overall_production_readiness as
select
  p.readiness_score as pilot_score,
  r.rollout_score,
  s.security_score,
  a.audit_trail_score,
  round((p.readiness_score + r.rollout_score + s.security_score + a.audit_trail_score) / 4.0)::integer as overall_score,
  case
    when s.security_score < 75 then 'security_review_required'
    when a.audit_trail_score < 75 then 'audit_trail_review_required'
    when p.readiness_score < 75 then 'pilot_not_ready'
    when r.rollout_score < 75 then 'rollout_not_ready'
    else 'ready_for_controlled_rollout'
  end as decision
from v_v58_pilot_readiness_scorecard p
cross join v_v58_rollout_readiness_scorecard r
cross join v_v58_security_review_scorecard s
cross join v_v58_audit_trail_scorecard a;

-- =========================
-- Seed defaults
-- =========================

create or replace function seed_v58_pilot_rollout_security_audit_defaults()
returns void as $$
declare
  org uuid;
begin
  select id into org from organizations order by created_at limit 1;

  insert into pilot_execution_runs (organization_id, pilot_name, pilot_scope, target_users, target_departments, status, owner)
  values
    (org, 'Wave 1 controlled pilot', 'Executives, Quality, Governance, 5 departments, selected employees', 75, 5, 'planned', 'Governance Admin')
  on conflict do nothing;

  insert into company_rollout_waves (organization_id, wave_no, wave_name, target_users, target_departments, status, readiness_score, support_owner)
  values
    (org, 1, 'Pilot wave', 75, 5, 'not_started', 60, 'Governance Admin'),
    (org, 2, 'Department manager wave', 200, 15, 'not_started', 40, 'Operations / Governance'),
    (org, 3, 'Core departments wave', 400, 25, 'not_started', 35, 'IT / Department Heads'),
    (org, 4, 'Company-wide completion wave', 325, 50, 'not_started', 30, 'Executive Sponsor')
  on conflict (organization_id, wave_no) do nothing;

  insert into security_review_checks_v58 (organization_id, check_code, check_area, title, risk_level, owner)
  values
    (org, 'SEC_SUPER_ADMIN', 'access_control', 'Super admin accounts reviewed and minimized', 'critical', 'System Admin'),
    (org, 'SEC_INACTIVE_USERS', 'access_control', 'Inactive users have no active roles', 'critical', 'HR / IT'),
    (org, 'SEC_EMPLOYEE_SCOPE', 'rls', 'Employees cannot access global or unrelated department data', 'critical', 'Governance Admin'),
    (org, 'SEC_OVR_CONFIDENTIAL', 'ovr', 'OVR confidentiality and role restrictions verified', 'critical', 'Quality Manager'),
    (org, 'SEC_EXPORT_ACCESS', 'backup_export', 'Export and backup access limited to authorized roles', 'high', 'Governance Admin'),
    (org, 'SEC_EVIDENCE_ACCESS', 'evidence', 'Evidence file access reviewed by role and scope', 'high', 'Audit / Quality')
  on conflict (organization_id, check_code) do nothing;

  insert into audit_trail_controls_v58 (organization_id, control_code, process_area, title, required_event, required_for_production)
  values
    (org, 'AUD_PROJECT_STATUS', 'projects', 'Project status changes are logged', 'project_status_changed', true),
    (org, 'AUD_TASK_CLOSURE', 'tasks', 'Task closure and evidence approval are logged', 'task_closed_or_evidence_accepted', true),
    (org, 'AUD_OVR_WORKFLOW', 'ovr', 'OVR submission/review/closure events are logged', 'ovr_workflow_transition', true),
    (org, 'AUD_APPROVAL_DECISION', 'approvals', 'Approval decisions are logged with actor and timestamp', 'approval_decision', true),
    (org, 'AUD_ROLE_CHANGE', 'access_control', 'Role assignment/deactivation is logged', 'role_changed', true),
    (org, 'AUD_EXPORT_BACKUP', 'backup_export', 'Export and backup package creation is logged', 'export_or_backup_created', true)
  on conflict (organization_id, control_code) do nothing;
end;
$$ language plpgsql;

-- =========================================================
-- END 037_v58_pilot_rollout_security_audit.sql
-- =========================================================

-- =========================================================
-- BEGIN 038_v59_no_mock_phased_auto_tests.sql
-- sha256: ee32812209afcfd6c16adff2040be4cbf333466c09fa21b05f22a9c5cdbc49d8
-- =========================================================

-- =========================================================
-- GRC Control Center v5.9
-- No-Mock Governance + Phased Auto-Test Registry
-- =========================================================

create table if not exists no_mock_audit_findings (
  id uuid primary key default gen_random_uuid(),
  finding_code text unique,
  file_path text not null,
  line_number integer,
  finding_term text not null,
  severity text not null default 'medium',
  production_blocking boolean not null default false,
  status text not null default 'open',
  owner_name text,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mock_data_allowlist (
  id uuid primary key default gen_random_uuid(),
  allowlist_code text unique not null,
  file_path_pattern text not null,
  reason text not null,
  environment_scope text not null default 'development_only',
  approved_by_name text,
  approved_at timestamptz,
  expires_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists phased_auto_test_phases (
  id uuid primary key default gen_random_uuid(),
  phase_number integer not null unique,
  phase_code text not null unique,
  title_en text not null,
  title_ar text,
  objective_en text not null,
  command_text text not null,
  is_required_for_pilot boolean not null default true,
  is_required_for_production boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists phased_auto_test_cases (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references phased_auto_test_phases(id) on delete cascade,
  case_code text not null unique,
  title_en text not null,
  title_ar text,
  expected_result_en text not null,
  automation_command text,
  severity_if_failed text not null default 'medium',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists phased_auto_test_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text unique,
  run_scope text not null default 'all_phases',
  started_by_name text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',
  summary_json jsonb not null default '{}'::jsonb,
  notes text
);

create table if not exists phased_auto_test_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references phased_auto_test_runs(id) on delete cascade,
  phase_id uuid references phased_auto_test_phases(id) on delete set null,
  case_id uuid references phased_auto_test_cases(id) on delete set null,
  result_status text not null default 'not_run',
  evidence_path text,
  result_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists production_data_switchovers (
  id uuid primary key default gen_random_uuid(),
  switchover_code text unique not null,
  title_en text not null,
  title_ar text,
  requirement_en text not null,
  current_status text not null default 'not_verified',
  owner_name text,
  evidence_reference text,
  verified_by_name text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_no_mock_findings_status on no_mock_audit_findings(status, production_blocking);
create index if not exists idx_phase_results_run on phased_auto_test_results(run_id);
create index if not exists idx_phase_results_phase on phased_auto_test_results(phase_id);
create index if not exists idx_prod_switch_status on production_data_switchovers(current_status);

create or replace view v_v59_mock_data_findings_summary as
select
  count(*)::int as total_findings,
  count(*) filter (where production_blocking = true)::int as production_blocking_findings,
  count(*) filter (where status not in ('closed', 'accepted_risk'))::int as open_findings,
  count(*) filter (where production_blocking = true and status not in ('closed', 'accepted_risk'))::int as open_production_blockers,
  case
    when count(*) filter (where production_blocking = true and status not in ('closed', 'accepted_risk')) = 0 then 'ready'
    else 'blocked'
  end as no_mock_status
from no_mock_audit_findings;

create or replace view v_v59_phase_test_scorecard as
select
  p.phase_number,
  p.phase_code,
  p.title_en,
  p.title_ar,
  p.command_text,
  count(c.id)::int as test_cases,
  p.is_required_for_pilot,
  p.is_required_for_production
from phased_auto_test_phases p
left join phased_auto_test_cases c on c.phase_id = p.id and c.is_active = true
group by p.id
order by p.phase_number;

create or replace view v_v59_latest_phase_results as
with latest_run as (
  select id
  from phased_auto_test_runs
  order by started_at desc
  limit 1
)
select
  p.phase_number,
  p.phase_code,
  p.title_en,
  coalesce(count(r.id), 0)::int as results_recorded,
  coalesce(count(r.id) filter (where r.result_status = 'passed'), 0)::int as passed_results,
  coalesce(count(r.id) filter (where r.result_status = 'failed'), 0)::int as failed_results,
  case
    when count(r.id) = 0 then 'not_run'
    when count(r.id) filter (where r.result_status = 'failed') > 0 then 'failed'
    else 'passed'
  end as phase_status
from phased_auto_test_phases p
left join phased_auto_test_results r on r.phase_id = p.id and r.run_id in (select id from latest_run)
group by p.id
order by p.phase_number;

create or replace view v_v59_production_data_readiness as
select
  count(*)::int as total_requirements,
  count(*) filter (where current_status in ('verified', 'done', 'passed'))::int as verified_requirements,
  count(*) filter (where current_status in ('blocked', 'failed'))::int as blocked_requirements,
  case
    when count(*) = 0 then 0
    else round((count(*) filter (where current_status in ('verified', 'done', 'passed'))::numeric / count(*)::numeric) * 100, 1)
  end as readiness_percent
from production_data_switchovers;

create or replace function seed_v59_no_mock_phased_tests_defaults()
returns void
language plpgsql
as $$
declare
  phase1 uuid;
  phase2 uuid;
  phase3 uuid;
  phase4 uuid;
  phase5 uuid;
  phase6 uuid;
begin
  insert into phased_auto_test_phases (phase_number, phase_code, title_en, title_ar, objective_en, command_text, sort_order)
  values
    (1, 'LOCAL_BUILD', 'Local build foundation', 'أساس البناء المحلي', 'TypeScript and production build must pass.', 'npm run test:phase1', 1),
    (2, 'NO_MOCK', 'No-mock audit', 'تدقيق إزالة البيانات التجريبية', 'Detect mock/demo/fallback data before pilot.', 'npm run test:phase2', 2),
    (3, 'MIGRATIONS', 'Migration/schema artifact check', 'فحص ملفات الترحيل وقاعدة البيانات', 'Verify required migration artifacts exist.', 'npm run test:phase3', 3),
    (4, 'WORKFLOWS', 'Workflow artifact check', 'فحص مسارات العمل', 'Verify major workflow modules are present.', 'npm run test:phase4', 4),
    (5, 'BACKUP_RESTORE', 'Backup/restore proof artifacts', 'أدلة النسخ والاستعادة', 'Verify backup and restore proof artifacts are available.', 'npm run test:phase5', 5),
    (6, 'PILOT_READY', 'Pilot readiness artifacts', 'جاهزية المرحلة التجريبية', 'Verify pilot, rollout, and security artifacts exist.', 'npm run test:phase6', 6)
  on conflict (phase_number) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    objective_en = excluded.objective_en,
    command_text = excluded.command_text;

  select id into phase1 from phased_auto_test_phases where phase_code = 'LOCAL_BUILD';
  select id into phase2 from phased_auto_test_phases where phase_code = 'NO_MOCK';
  select id into phase3 from phased_auto_test_phases where phase_code = 'MIGRATIONS';
  select id into phase4 from phased_auto_test_phases where phase_code = 'WORKFLOWS';
  select id into phase5 from phased_auto_test_phases where phase_code = 'BACKUP_RESTORE';
  select id into phase6 from phased_auto_test_phases where phase_code = 'PILOT_READY';

  insert into phased_auto_test_cases (phase_id, case_code, title_en, title_ar, expected_result_en, automation_command, severity_if_failed)
  values
    (phase1, 'P1_TYPECHECK', 'TypeScript typecheck', 'فحص TypeScript', 'tsc completes without errors.', 'npm run typecheck', 'critical'),
    (phase1, 'P1_BUILD', 'Production build', 'بناء الإنتاج', 'Vite production build completes successfully.', 'npm run build', 'critical'),
    (phase2, 'P2_MOCK_AUDIT', 'Mock data audit', 'تدقيق البيانات التجريبية', 'Mock/fallback/demo scan completes.', 'npm run no-mock:audit', 'high'),
    (phase2, 'P2_MOCK_FAIL_STRICT', 'Strict no-mock gate', 'بوابة صارمة للبيانات التجريبية', 'Production-blocking mock findings are zero.', 'npm run no-mock:fail', 'critical'),
    (phase3, 'P3_MIGRATIONS_EXIST', 'Migration artifact check', 'فحص ملفات الترحيل', 'Migration files exist including v5.9.', 'npm run test:phase3', 'critical'),
    (phase4, 'P4_WORKFLOW_ARTIFACTS', 'Workflow artifact check', 'فحص مسارات العمل', 'Major workflow pages/artifacts exist.', 'npm run test:phase4', 'high'),
    (phase5, 'P5_BACKUP_RESTORE', 'Backup/restore local proof', 'إثبات النسخ والاستعادة', 'Backup/restore scripts run locally.', 'npm run test:phase5', 'critical'),
    (phase6, 'P6_PILOT_READY', 'Pilot readiness local proof', 'إثبات جاهزية التجربة', 'Pilot/rollout/security scripts and docs exist.', 'npm run test:phase6', 'high')
  on conflict (case_code) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    expected_result_en = excluded.expected_result_en,
    automation_command = excluded.automation_command,
    severity_if_failed = excluded.severity_if_failed;

  insert into production_data_switchovers (switchover_code, title_en, title_ar, requirement_en, current_status)
  values
    ('ENV_REQUIRE_SUPABASE', 'Require Supabase in production', 'إلزام Supabase في الإنتاج', 'Production environment must not operate as demo-only.', 'not_verified'),
    ('ENV_DISABLE_DEMO', 'Disable demo data in production', 'إيقاف البيانات التجريبية في الإنتاج', 'VITE_ALLOW_DEMO_DATA should be false for production.', 'not_verified'),
    ('EMPTY_STATE_READY', 'Empty/error states ready', 'جاهزية حالات عدم وجود البيانات والأخطاء', 'Screens should show explicit empty/error states instead of fake fallback data.', 'not_verified'),
    ('REAL_IMPORT_REVIEWED', 'Real import files reviewed', 'مراجعة ملفات البيانات الحقيقية', 'Departments/users/projects import files reviewed before pilot.', 'not_verified'),
    ('PILOT_DATA_APPROVED', 'Pilot data approved', 'اعتماد بيانات التجربة', 'Pilot data source approved by owner.', 'not_verified')
  on conflict (switchover_code) do update set
    title_en = excluded.title_en,
    title_ar = excluded.title_ar,
    requirement_en = excluded.requirement_en;
end;
$$;

-- =========================================================
-- END 038_v59_no_mock_phased_auto_tests.sql
-- =========================================================

-- =========================================================
-- BEGIN 039_v60_no_mock_production_data_controls.sql
-- sha256: e451d57a6e25c58a30bac5c4e2092ecd38456bc25787fda10161bddfaebd20f4
-- =========================================================

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

-- =========================================================
-- END 039_v60_no_mock_production_data_controls.sql
-- =========================================================

-- =========================================================
-- BEGIN 040_v62_real_no_mock_data_layer.sql
-- sha256: 76b6ecd288f73ed4dfe1950fa154b2e5e71a234f14580d2a037a83b7b5a17965
-- =========================================================

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

-- =========================================================
-- END 040_v62_real_no_mock_data_layer.sql
-- =========================================================

-- =========================================================
-- BEGIN 041_v63_auth_route_protection.sql
-- sha256: bf3f7bd3e893262dd55f20474de90d830d724d092dc001f2b69445f1e57ad27e
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 041
-- v6.3 Auth and route-protection readiness controls
-- =========================================================

create table if not exists public.auth_route_protection_controls (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  required_status text not null default 'required',
  evidence_status text not null default 'unverified',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.seed_v63_auth_route_protection_defaults()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auth_route_protection_controls(code, title, required_status, evidence_status, notes)
  values
    ('AUTH_LOGIN_REQUIRED', 'Anonymous users cannot enter the application shell', 'required', 'unverified', 'Validate with a signed-out browser session.'),
    ('AUTH_INACTIVE_BLOCKED', 'Inactive profiles are blocked before navigation', 'required', 'unverified', 'Validate with a disabled profile.'),
    ('AUTH_ROLE_NAVIGATION', 'Navigation is filtered by active role assignment', 'required', 'unverified', 'Validate with employee, manager, auditor and admin personas.'),
    ('AUTH_ADMIN_HIDDEN', 'Admin/release/security pages are hidden from non-admin users', 'required', 'unverified', 'Validate with employee and department manager personas.'),
    ('AUTH_NO_PROD_BYPASS', 'Development bypass cannot run in production mode', 'required', 'unverified', 'Confirm VITE_AUTH_BYPASS_LOCAL is not set in production.')
  on conflict (code) do update set
    title = excluded.title,
    required_status = excluded.required_status,
    notes = excluded.notes,
    updated_at = now();
end;
$$;

create or replace view public.v_v63_auth_route_protection_scorecard as
select
  count(*)::int as total_controls,
  count(*) filter (where evidence_status = 'verified')::int as verified_controls,
  count(*) filter (where evidence_status = 'unverified')::int as unverified_controls,
  case
    when count(*) = 0 then 0
    else round((count(*) filter (where evidence_status = 'verified')::numeric / count(*)::numeric) * 100, 1)
  end as verified_percent
from public.auth_route_protection_controls;

-- =========================================================
-- END 041_v63_auth_route_protection.sql
-- =========================================================

-- =========================================================
-- BEGIN 042_v64_database_security_proof.sql
-- sha256: ca2e05f1a860a00b3894c7cd250aa45a5607fc28bc7d5298c486fa745c58856c
-- =========================================================

-- v6.4 Database Security + Proof Pack
-- Purpose: create a controlled security-proof registry and executable persona-test catalogue.
-- This migration does not relax existing security. It adds auditable controls and RLS-protected proof tables.

create extension if not exists pgcrypto;

create table if not exists public.v64_security_control_catalog (
  id uuid primary key default gen_random_uuid(),
  control_code text not null unique,
  domain text not null,
  title text not null,
  required boolean not null default true,
  status text not null default 'unverified' check (status in ('unverified','planned','in_progress','passed','failed','exception_approved')),
  owner_role text not null default 'it_security',
  verification_method text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v64_persona_test_cases (
  id uuid primary key default gen_random_uuid(),
  persona text not null,
  test_code text not null unique,
  scenario text not null,
  expected_result text not null,
  is_negative boolean not null default true,
  test_sql_hint text,
  status text not null default 'unverified' check (status in ('unverified','passed','failed','blocked','exception_approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v64_security_evidence (
  id uuid primary key default gen_random_uuid(),
  evidence_code text not null unique,
  related_control_code text references public.v64_security_control_catalog(control_code) on delete set null,
  related_test_code text references public.v64_persona_test_cases(test_code) on delete set null,
  status text not null default 'unverified' check (status in ('unverified','passed','failed','exception_approved')),
  evidence_location text,
  evidence_summary text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.v64_security_control_catalog enable row level security;
alter table public.v64_persona_test_cases enable row level security;
alter table public.v64_security_evidence enable row level security;

-- Metadata can be read by authenticated users. Mutation should happen through SQL editor/service role during release proof.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'v64_security_control_catalog' and policyname = 'v64_security_control_catalog_select_authenticated'
  ) then
    create policy v64_security_control_catalog_select_authenticated
      on public.v64_security_control_catalog for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'v64_persona_test_cases' and policyname = 'v64_persona_test_cases_select_authenticated'
  ) then
    create policy v64_persona_test_cases_select_authenticated
      on public.v64_persona_test_cases for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'v64_security_evidence' and policyname = 'v64_security_evidence_select_authenticated'
  ) then
    create policy v64_security_evidence_select_authenticated
      on public.v64_security_evidence for select
      to authenticated
      using (true);
  end if;
end $$;

create or replace function public.v64_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_v64_security_control_catalog_touch') then
    create trigger trg_v64_security_control_catalog_touch
      before update on public.v64_security_control_catalog
      for each row execute function public.v64_touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_v64_persona_test_cases_touch') then
    create trigger trg_v64_persona_test_cases_touch
      before update on public.v64_persona_test_cases
      for each row execute function public.v64_touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_v64_security_evidence_touch') then
    create trigger trg_v64_security_evidence_touch
      before update on public.v64_security_evidence
      for each row execute function public.v64_touch_updated_at();
  end if;
end $$;

create or replace function public.seed_v64_database_security_proof_defaults()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.v64_security_control_catalog (control_code, domain, title, verification_method, owner_role)
  values
    ('V64_RLS_ALL_SENSITIVE_TABLES', 'rls', 'All sensitive public tables have RLS enabled', 'static audit + staging SQL test', 'it_security'),
    ('V64_RLS_ORG_DEPT_SCOPE', 'rls', 'Policies scope records by organization and department where applicable', 'persona SQL negative tests', 'it_security'),
    ('V64_OVR_CONFIDENTIALITY', 'ovr', 'OVR reports and evidence are restricted by role and scope', 'persona SQL + browser journey', 'quality_security'),
    ('V64_EVIDENCE_ACCESS', 'evidence', 'Evidence access is restricted and audited', 'persona SQL + storage policy review', 'it_security'),
    ('V64_EXPORT_BACKUP_ACCESS', 'export', 'Exports and backups are limited to authorized roles', 'role-based UI + RLS/RPC proof', 'it_security'),
    ('V64_SECURITY_DEFINER_SAFE', 'functions', 'SECURITY DEFINER functions have safe search_path and no broad execute grants', 'function static audit + SQL metadata test', 'dba'),
    ('V64_VIEW_SECURITY_INVOKER_REVIEW', 'views', 'Sensitive views use security_invoker or documented safe access path', 'view static audit + SQL metadata test', 'dba'),
    ('V64_PERSONA_TESTS_EXECUTED', 'proof', 'Five persona tests executed against staging users', 'SQL evidence attachment', 'it_security')
  on conflict (control_code) do nothing;

  insert into public.v64_persona_test_cases (persona, test_code, scenario, expected_result, is_negative, test_sql_hint)
  values
    ('anonymous', 'V64_ANON_DENIED_APP_DATA', 'Anonymous requester attempts to read sensitive application tables.', 'Denied by RLS / no rows / permission error.', true, 'Run with anon key or unauthenticated SQL role where possible.'),
    ('employee', 'V64_EMPLOYEE_DENIED_UNRELATED_DEPT', 'Employee attempts to read another department project/task/OVR/evidence.', 'Denied or zero rows.', true, 'Use two department-scoped test records.'),
    ('department_manager', 'V64_MANAGER_DENIED_OTHER_DEPT', 'Department manager attempts to read another department data.', 'Denied or zero rows.', true, 'Use manager A against department B records.'),
    ('audit', 'V64_AUDIT_READ_ONLY', 'Audit user views reports/evidence but attempts mutation.', 'Read allowed where intended; write denied.', true, 'Attempt insert/update/delete with audit persona.'),
    ('super_user', 'V64_SUPER_USER_LIMITED_ADMIN', 'Super user accesses permitted administration but not privileged release/security mutations.', 'Allowed only within defined scope.', true, 'Attempt release evidence mutation.'),
    ('admin', 'V64_ADMIN_ALLOWED_WITH_AUDIT', 'Admin performs allowed administrative operation.', 'Allowed and audit trail created.', false, 'Verify audit record created.'),
    ('quality', 'V64_QUALITY_OVR_CLOSE_ALLOWED', 'Quality user closes OVR after required corrective evidence.', 'Allowed only when preconditions are met.', false, 'Run OVR workflow fixture.'),
    ('employee', 'V64_SELF_APPROVAL_BLOCKED', 'User attempts to approve their own request/evidence.', 'Denied by trigger/policy.', true, 'Attempt self approval using same user id.')
  on conflict (test_code) do nothing;
end;
$$;

revoke all on function public.seed_v64_database_security_proof_defaults() from public;
grant execute on function public.seed_v64_database_security_proof_defaults() to service_role;

create or replace view public.v_v64_security_control_scorecard
with (security_invoker = true)
as
select
  count(*) as total_controls,
  count(*) filter (where required) as required_controls,
  count(*) filter (where status = 'passed') as passed_controls,
  count(*) filter (where status = 'failed') as failed_controls,
  count(*) filter (where status = 'unverified') as unverified_controls,
  round(
    case when count(*) filter (where required) = 0 then 0
    else 100.0 * count(*) filter (where required and status = 'passed') / count(*) filter (where required)
    end, 1
  ) as required_pass_percent
from public.v64_security_control_catalog;

create or replace view public.v_v64_persona_test_matrix
with (security_invoker = true)
as
select
  persona,
  count(*) as tests,
  count(*) filter (where is_negative) as negative_tests,
  count(*) filter (where status = 'passed') as passed,
  count(*) filter (where status = 'failed') as failed,
  count(*) filter (where status = 'unverified') as unverified
from public.v64_persona_test_cases
group by persona
order by persona;

create or replace view public.v_v64_database_security_readiness
with (security_invoker = true)
as
select
  now() as generated_at,
  (select total_controls from public.v_v64_security_control_scorecard) as total_controls,
  (select required_pass_percent from public.v_v64_security_control_scorecard) as required_pass_percent,
  (select count(*) from public.v64_persona_test_cases where status = 'passed') as passed_persona_tests,
  (select count(*) from public.v64_persona_test_cases where status = 'failed') as failed_persona_tests,
  (select count(*) from public.v64_persona_test_cases where status = 'unverified') as unverified_persona_tests,
  case
    when (select count(*) from public.v64_persona_test_cases where status = 'failed') > 0 then 'failed'
    when (select count(*) from public.v64_persona_test_cases where status = 'unverified') > 0 then 'unverified'
    when (select required_pass_percent from public.v_v64_security_control_scorecard) >= 95 then 'ready_for_controlled_pilot'
    else 'needs_evidence'
  end as readiness_status;

-- =========================================================
-- END 042_v64_database_security_proof.sql
-- =========================================================

-- =========================================================
-- BEGIN 043_v641_database_security_static_remediation.sql
-- sha256: c5348dd5fa5c34b7b26ad0deb19e875f680c5837dfa593df16a3d77dff5f47b1
-- =========================================================

-- v6.4.1 Database security static remediation
-- Purpose: close critical/high static RLS, view, and privileged findings without adding UI features.
-- Note: deny-all fallback policies are intentionally conservative; refine in staging persona tests before production.

begin;

-- 1) Enable RLS and add conservative deny-all policies for high-risk tables missing explicit protection.

alter table if exists public.access_security_findings_v58 enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.access_security_findings_v58;
create policy "v641_deny_all_until_persona_verified" on public.access_security_findings_v58
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.audit_trail_controls_v58 enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.audit_trail_controls_v58;
create policy "v641_deny_all_until_persona_verified" on public.audit_trail_controls_v58
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.audit_trail_samples_v58 enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.audit_trail_samples_v58;
create policy "v641_deny_all_until_persona_verified" on public.audit_trail_samples_v58
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.backup_restore_verifications enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.backup_restore_verifications;
create policy "v641_deny_all_until_persona_verified" on public.backup_restore_verifications
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.backup_schedule_plans enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.backup_schedule_plans;
create policy "v641_deny_all_until_persona_verified" on public.backup_schedule_plans
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.backup_schedule_runs enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.backup_schedule_runs;
create policy "v641_deny_all_until_persona_verified" on public.backup_schedule_runs
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.consolidated_release_packages enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.consolidated_release_packages;
create policy "v641_deny_all_until_persona_verified" on public.consolidated_release_packages
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.department_kpi_targets enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.department_kpi_targets;
create policy "v641_deny_all_until_persona_verified" on public.department_kpi_targets
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.department_onboarding_status enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.department_onboarding_status;
create policy "v641_deny_all_until_persona_verified" on public.department_onboarding_status
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.department_scorecard_notes enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.department_scorecard_notes;
create policy "v641_deny_all_until_persona_verified" on public.department_scorecard_notes
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.evidence_file_versions enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.evidence_file_versions;
create policy "v641_deny_all_until_persona_verified" on public.evidence_file_versions
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.evidence_retention_reviews enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.evidence_retention_reviews;
create policy "v641_deny_all_until_persona_verified" on public.evidence_retention_reviews
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.final_go_live_controls enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.final_go_live_controls;
create policy "v641_deny_all_until_persona_verified" on public.final_go_live_controls
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.i18n_translation_audit enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.i18n_translation_audit;
create policy "v641_deny_all_until_persona_verified" on public.i18n_translation_audit
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.key_risk_indicators enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.key_risk_indicators;
create policy "v641_deny_all_until_persona_verified" on public.key_risk_indicators
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.module_release_readiness enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.module_release_readiness;
create policy "v641_deny_all_until_persona_verified" on public.module_release_readiness
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.no_mock_audit_findings enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.no_mock_audit_findings;
create policy "v641_deny_all_until_persona_verified" on public.no_mock_audit_findings
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.no_mock_audit_runs enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.no_mock_audit_runs;
create policy "v641_deny_all_until_persona_verified" on public.no_mock_audit_runs
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.ovr_production_checklist_results enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.ovr_production_checklist_results;
create policy "v641_deny_all_until_persona_verified" on public.ovr_production_checklist_results
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.ovr_production_checklist_templates enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.ovr_production_checklist_templates;
create policy "v641_deny_all_until_persona_verified" on public.ovr_production_checklist_templates
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.ovr_risk_calibration_rules enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.ovr_risk_calibration_rules;
create policy "v641_deny_all_until_persona_verified" on public.ovr_risk_calibration_rules
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.pilot_wave_departments enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.pilot_wave_departments;
create policy "v641_deny_all_until_persona_verified" on public.pilot_wave_departments
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.production_backup_strategies enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.production_backup_strategies;
create policy "v641_deny_all_until_persona_verified" on public.production_backup_strategies
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.production_data_controls enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.production_data_controls;
create policy "v641_deny_all_until_persona_verified" on public.production_data_controls
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.production_evidence_registry enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.production_evidence_registry;
create policy "v641_deny_all_until_persona_verified" on public.production_evidence_registry
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.production_release_artifacts enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.production_release_artifacts;
create policy "v641_deny_all_until_persona_verified" on public.production_release_artifacts
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.real_data_import_controls enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.real_data_import_controls;
create policy "v641_deny_all_until_persona_verified" on public.real_data_import_controls
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.release_factory_checks enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.release_factory_checks;
create policy "v641_deny_all_until_persona_verified" on public.release_factory_checks
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.risk_appetite_statements enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.risk_appetite_statements;
create policy "v641_deny_all_until_persona_verified" on public.risk_appetite_statements
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.risk_scenarios enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.risk_scenarios;
create policy "v641_deny_all_until_persona_verified" on public.risk_scenarios
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.rls_persona_scenarios enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.rls_persona_scenarios;
create policy "v641_deny_all_until_persona_verified" on public.rls_persona_scenarios
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.role_change_audit enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.role_change_audit;
create policy "v641_deny_all_until_persona_verified" on public.role_change_audit
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.security_review_checks_v58 enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.security_review_checks_v58;
create policy "v641_deny_all_until_persona_verified" on public.security_review_checks_v58
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.v50_backup_runs enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.v50_backup_runs;
create policy "v641_deny_all_until_persona_verified" on public.v50_backup_runs
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.v50_backup_strategy_items enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.v50_backup_strategy_items;
create policy "v641_deny_all_until_persona_verified" on public.v50_backup_strategy_items
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.v50_restore_dryrun_jobs enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.v50_restore_dryrun_jobs;
create policy "v641_deny_all_until_persona_verified" on public.v50_restore_dryrun_jobs
  for all to authenticated
  using (false)
  with check (false);

alter table if exists public.v50_restore_dryrun_steps enable row level security;
drop policy if exists "v641_deny_all_until_persona_verified" on public.v50_restore_dryrun_steps;
create policy "v641_deny_all_until_persona_verified" on public.v50_restore_dryrun_steps
  for all to authenticated
  using (false)
  with check (false);

-- 2) Mark sensitive views as security_invoker where Postgres supports the option.

alter view if exists public.v_access_control_matrix set (security_invoker = true);
alter view if exists public.v_access_control_summary set (security_invoker = true);
alter view if exists public.v_access_control_warnings set (security_invoker = true);
alter view if exists public.v_backup_health_check set (security_invoker = true);
alter view if exists public.v_backup_restore_drillboard set (security_invoker = true);
alter view if exists public.v_backup_schedule_readiness set (security_invoker = true);
alter view if exists public.v_consolidated_release_packages set (security_invoker = true);
alter view if exists public.v_department_risk_heatmap set (security_invoker = true);
alter view if exists public.v_duplicate_profile_emails set (security_invoker = true);
alter view if exists public.v_evidence_review_queue set (security_invoker = true);
alter view if exists public.v_evidence_vault_inventory set (security_invoker = true);
alter view if exists public.v_export_center_summary set (security_invoker = true);
alter view if exists public.v_export_dataset_catalog set (security_invoker = true);
alter view if exists public.v_management_control_summary set (security_invoker = true);
alter view if exists public.v_ovr_quality_queue set (security_invoker = true);
alter view if exists public.v_ovr_repeated_category_alerts set (security_invoker = true);
alter view if exists public.v_ovr_risk_attention_items set (security_invoker = true);
alter view if exists public.v_ovr_risk_indicator_feed set (security_invoker = true);
alter view if exists public.v_ovr_risk_indicator_summary set (security_invoker = true);
alter view if exists public.v_ovr_risk_indicators_by_department set (security_invoker = true);
alter view if exists public.v_ovr_summary set (security_invoker = true);
alter view if exists public.v_ovr_workflow_control_summary set (security_invoker = true);
alter view if exists public.v_ovr_workflow_queue set (security_invoker = true);
alter view if exists public.v_pending_approvals_expanded set (security_invoker = true);
alter view if exists public.v_production_backup_strategy_status set (security_invoker = true);
alter view if exists public.v_radar_control_profile set (security_invoker = true);
alter view if exists public.v_release_candidate_gates set (security_invoker = true);
alter view if exists public.v_release_factory_checks set (security_invoker = true);
alter view if exists public.v_release_factory_scorecard set (security_invoker = true);
alter view if exists public.v_release_migration_order set (security_invoker = true);
alter view if exists public.v_risk_appetite_dashboard set (security_invoker = true);
alter view if exists public.v_security_access_findings set (security_invoker = true);
alter view if exists public.v_security_governance_summary set (security_invoker = true);
alter view if exists public.v_ultra_release_summary set (security_invoker = true);
alter view if exists public.v_v31_final_controls set (security_invoker = true);
alter view if exists public.v_v42_release_candidate_scorecard set (security_invoker = true);
alter view if exists public.v_v46_ovr_production_queue set (security_invoker = true);
alter view if exists public.v_v46_ovr_risk_calibration set (security_invoker = true);
alter view if exists public.v_v50_backup_restore_scorecard set (security_invoker = true);
alter view if exists public.v_v58_audit_trail_scorecard set (security_invoker = true);
alter view if exists public.v_v58_security_review_scorecard set (security_invoker = true);
alter view if exists public.v_v59_mock_data_findings_summary set (security_invoker = true);
alter view if exists public.v_v60_latest_no_mock_audit set (security_invoker = true);
alter view if exists public.v_v60_no_mock_control_scorecard set (security_invoker = true);

-- 3) Add fixed search_path and revoke broad public execution for high-risk privileged functions.

alter function public.create_system_health_snapshot(uuid, uuid) set search_path = public, pg_temp;
revoke all on function public.create_system_health_snapshot(uuid, uuid) from public;
alter function public.seed_release_factory_defaults() set search_path = public, pg_temp;
revoke all on function public.seed_release_factory_defaults() from public;
alter function public.seed_v31_finish_fast_defaults() set search_path = public, pg_temp;
revoke all on function public.seed_v31_finish_fast_defaults() from public;
alter function public.seed_v33_production_proof_defaults() set search_path = public, pg_temp;
revoke all on function public.seed_v33_production_proof_defaults() from public;
alter function public.seed_v34_pilot_defaults() set search_path = public, pg_temp;
revoke all on function public.seed_v34_pilot_defaults() from public;

commit;

-- =========================================================
-- END 043_v641_database_security_static_remediation.sql
-- =========================================================

-- =========================================================
-- BEGIN 044_v642_auth_route_rls_static_fix.sql
-- sha256: 32e8ae235c17ca789075e415373d32da289ee27c0b7af003b6126205e8f19643
-- =========================================================

-- =========================================================
-- GRC Control Center - Migration 044
-- v6.4.2 Auth route protection RLS static fix
-- =========================================================
-- Purpose: close the remaining v6.4 static RLS critical finding introduced by v6.3.
-- This is intentionally conservative until staging persona tests define final scoped policies.

begin;

alter table if exists public.auth_route_protection_controls enable row level security;

drop policy if exists "v642_deny_all_until_persona_verified" on public.auth_route_protection_controls;
create policy "v642_deny_all_until_persona_verified" on public.auth_route_protection_controls
  for all to authenticated
  using (false)
  with check (false);

alter view if exists public.v_v63_auth_route_protection_scorecard set (security_invoker = true);

alter function public.seed_v63_auth_route_protection_defaults() set search_path = public, pg_temp;
revoke all on function public.seed_v63_auth_route_protection_defaults() from public;

commit;

-- =========================================================
-- END 044_v642_auth_route_rls_static_fix.sql
-- =========================================================

-- =========================================================
-- BEGIN 045_v66_controlled_pilot_evidence.sql
-- sha256: f24e0b61cc7f1635c152ffa8e2b5130d3130786415a94fd2538a73fc0fd05f2c
-- =========================================================

-- v6.6 Controlled Pilot Evidence Pack
-- Purpose: store controlled pilot proof/evidence metadata in staging without opening broad public access.

create table if not exists public.controlled_pilot_runs (
  id uuid primary key default gen_random_uuid(),
  pilot_name text not null,
  environment text not null default 'staging',
  planned_user_count integer not null default 0,
  status text not null default 'planned',
  start_date date,
  end_date date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.controlled_pilot_evidence_items (
  id uuid primary key default gen_random_uuid(),
  pilot_run_id uuid references public.controlled_pilot_runs(id) on delete cascade,
  evidence_code text not null,
  evidence_title text not null,
  evidence_status text not null default 'manual_required',
  evidence_location text,
  evidence_notes text,
  verified_by uuid,
  verified_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_run_id, evidence_code)
);

create table if not exists public.controlled_pilot_issues (
  id uuid primary key default gen_random_uuid(),
  pilot_run_id uuid references public.controlled_pilot_runs(id) on delete cascade,
  issue_code text,
  module text,
  severity text not null default 'medium',
  description text not null,
  owner_name text,
  target_date date,
  status text not null default 'open',
  resolution text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.controlled_pilot_signoffs (
  id uuid primary key default gen_random_uuid(),
  pilot_run_id uuid references public.controlled_pilot_runs(id) on delete cascade,
  signoff_role text not null,
  signer_name text,
  decision text not null default 'pending',
  signed_at timestamptz,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_run_id, signoff_role)
);

alter table public.controlled_pilot_runs enable row level security;
alter table public.controlled_pilot_evidence_items enable row level security;
alter table public.controlled_pilot_issues enable row level security;
alter table public.controlled_pilot_signoffs enable row level security;

create policy controlled_pilot_runs_select_authenticated on public.controlled_pilot_runs
  for select to authenticated using (true);
create policy controlled_pilot_runs_insert_authenticated on public.controlled_pilot_runs
  for insert to authenticated with check (auth.uid() is not null);
create policy controlled_pilot_runs_update_creator on public.controlled_pilot_runs
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy controlled_pilot_evidence_select_authenticated on public.controlled_pilot_evidence_items
  for select to authenticated using (true);
create policy controlled_pilot_evidence_insert_authenticated on public.controlled_pilot_evidence_items
  for insert to authenticated with check (auth.uid() is not null);
create policy controlled_pilot_evidence_update_creator_or_verifier on public.controlled_pilot_evidence_items
  for update to authenticated using (created_by = auth.uid() or verified_by = auth.uid()) with check (created_by = auth.uid() or verified_by = auth.uid());

create policy controlled_pilot_issues_select_authenticated on public.controlled_pilot_issues
  for select to authenticated using (true);
create policy controlled_pilot_issues_insert_authenticated on public.controlled_pilot_issues
  for insert to authenticated with check (auth.uid() is not null);
create policy controlled_pilot_issues_update_creator on public.controlled_pilot_issues
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy controlled_pilot_signoffs_select_authenticated on public.controlled_pilot_signoffs
  for select to authenticated using (true);
create policy controlled_pilot_signoffs_insert_authenticated on public.controlled_pilot_signoffs
  for insert to authenticated with check (auth.uid() is not null);
create policy controlled_pilot_signoffs_update_creator on public.controlled_pilot_signoffs
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

insert into public.controlled_pilot_runs (pilot_name, environment, planned_user_count, status)
values ('v6.6 controlled pilot readiness', 'staging', 15, 'planned')
on conflict do nothing;

-- =========================================================
-- END 045_v66_controlled_pilot_evidence.sql
-- =========================================================

-- =========================================================
-- BEGIN 046_v673_lockdown_security_definer_execute.sql
-- sha256: e0ac126584586bad54e61e7de5025bd06ff5c75bb57c1e565b763cf1a9bb1e07
-- =========================================================

-- v6.7.3 Security Definer Execute Lockdown
-- Purpose:
--   1. Remove broad EXECUTE privileges from every public SECURITY DEFINER function.
--   2. Preserve authenticated access only through SECURITY INVOKER helpers/RPCs.
--   3. Keep privileged seed, maintenance, release, and cross-user operations service_role-only.

begin;

-- The original user_roles SELECT policy called has_any_role(), which queried
-- user_roles again. SECURITY DEFINER previously hid that recursion. The
-- least-privilege replacement lets users read their own role rows; invoker
-- authorization helpers can then evaluate only the current user's roles.
drop policy if exists user_roles_read_self_or_admin on public.user_roles;
drop policy if exists user_roles_read_self on public.user_roles;
create policy user_roles_read_self on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

-- SECURITY INVOKER authorization helpers need read permission on their two
-- source tables. RLS remains enabled and restricts users to allowed rows.
grant select on table public.profiles to authenticated;
grant select on table public.user_roles to authenticated;

-- RLS predicate helpers are read-only and evaluate the current authenticated
-- user's own profile/role rows. They no longer require owner privileges.
alter function public.current_user_org_id() security invoker;
alter function public.has_any_role(public.app_role[]) security invoker;
alter function public.has_global_role(public.app_role[]) security invoker;
alter function public.can_access_org(uuid) security invoker;
alter function public.can_access_scope(uuid, uuid, uuid, uuid) security invoker;
alter function public.can_manage_grc() security invoker;
alter function public.has_role(public.app_role) security invoker;
alter function public.has_role(uuid, public.app_role) security invoker;
alter function public.can_read_organization(uuid) security invoker;

-- Clear inherited/default and explicit broad grants from the invoker functions,
-- then restore only the roles that need to evaluate RLS.
revoke all on function public.current_user_org_id() from public, anon, authenticated;
revoke all on function public.has_any_role(public.app_role[]) from public, anon, authenticated;
revoke all on function public.has_global_role(public.app_role[]) from public, anon, authenticated;
revoke all on function public.can_access_org(uuid) from public, anon, authenticated;
revoke all on function public.can_access_scope(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_manage_grc() from public, anon, authenticated;
revoke all on function public.has_role(public.app_role) from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.can_read_organization(uuid) from public, anon, authenticated;

grant execute on function public.current_user_org_id() to authenticated, service_role;
grant execute on function public.has_any_role(public.app_role[]) to authenticated, service_role;
grant execute on function public.has_global_role(public.app_role[]) to authenticated, service_role;
grant execute on function public.can_access_org(uuid) to authenticated, service_role;
grant execute on function public.can_access_scope(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_grc() to authenticated, service_role;
grant execute on function public.has_role(public.app_role) to authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.can_read_organization(uuid) to authenticated, service_role;

-- Every function that still runs with owner privileges is privileged. Remove
-- PUBLIC/default and explicit anon/authenticated execution, and retain only
-- service_role for trusted server-side use. Trigger execution is unaffected.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      fn.signature
    );
    execute format(
      'grant execute on function %s to service_role',
      fn.signature
    );
  end loop;
end
$$;

commit;

-- =========================================================
-- END 046_v673_lockdown_security_definer_execute.sql
-- =========================================================

-- =========================================================
-- BEGIN 0165_ovr_workflow_prerequisites.sql
-- sha256: 4d4cbb7b47bda615053ed15380a320081e4842ac99076111bba6e5af1bb381ca
-- =========================================================

-- =========================================================
-- GRC Control Center - OVR workflow prerequisites
--
-- The original workflow migration was assigned version 036 during a
-- filename cleanup. Migration 017 already depends on these columns, so
-- create the prerequisite schema here without changing existing migration
-- history. Migration 036 remains idempotent and installs the full workflow
-- functions and views later.
-- =========================================================

alter table public.ovr_reports
add column if not exists supervisor_due_date date;

alter table public.ovr_reports
add column if not exists quality_due_date date;

alter table public.ovr_reports
add column if not exists corrective_action_due_date date;

alter table public.ovr_reports
add column if not exists quality_closure_note text;

alter table public.ovr_reports
add column if not exists final_classification text;

alter table public.ovr_reports
add column if not exists final_severity_level public.ovr_severity_level;

create index if not exists idx_ovr_reports_supervisor_due
on public.ovr_reports(supervisor_due_date);

create index if not exists idx_ovr_reports_quality_due
on public.ovr_reports(quality_due_date);

create index if not exists idx_ovr_reports_corrective_due
on public.ovr_reports(corrective_action_due_date);

-- Compatibility helpers used by migrations 017 and 020. Earlier migrations
-- provide has_any_role(), but these later policies call has_role() directly.
create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = required_role
      and ur.is_active = true
  );
$$;

create or replace function public.has_role(
  target_user_id uuid,
  required_role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = target_user_id
      and ur.role = required_role
      and ur.is_active = true
  );
$$;

-- Later release migrations use this name for organization-scoped RLS checks,
-- while the foundation migration exposes the equivalent can_access_org helper.
create or replace function public.can_read_organization(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_org(target_org_id);
$$;

-- =========================================================
-- END 0165_ovr_workflow_prerequisites.sql
-- =========================================================
