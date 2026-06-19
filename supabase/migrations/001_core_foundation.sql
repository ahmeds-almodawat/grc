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
