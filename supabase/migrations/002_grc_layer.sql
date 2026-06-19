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
