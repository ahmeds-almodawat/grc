-- v22.0 Control Testing + CAPA Execution Engine
-- Add-only schema contract for professional control assurance workflow.
-- No broad authenticated write policies are created in this migration.

create table if not exists public.v220_control_test_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  control_id uuid,
  framework_requirement_id uuid,
  test_code text not null,
  test_title text not null,
  test_objective text not null,
  test_frequency text not null default 'annual',
  test_method text not null default 'inspection',
  sample_population text,
  sample_size integer,
  owner_profile_id uuid,
  reviewer_profile_id uuid,
  status text not null default 'planned' check (status in ('planned','in_progress','passed','failed','deferred','requires_management_action','closed')),
  planned_start_date date,
  planned_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v220_control_test_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  test_plan_id uuid not null references public.v220_control_test_plans(id) on delete cascade,
  step_order integer not null default 1,
  procedure_text text not null,
  expected_evidence text,
  pass_fail_criteria text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.v220_control_test_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  test_plan_id uuid not null references public.v220_control_test_plans(id) on delete cascade,
  result text not null check (result in ('passed','failed','partial','not_tested','deferred')),
  tested_by_profile_id uuid,
  reviewed_by_profile_id uuid,
  tested_at timestamptz,
  reviewer_conclusion text,
  evidence_summary text,
  exception_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v220_control_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  test_result_id uuid references public.v220_control_test_results(id) on delete cascade,
  linked_risk_id uuid,
  linked_issue_id uuid,
  exception_title text not null,
  severity text not null default 'medium' check (severity in ('blocker','high','medium','low')),
  root_cause text,
  management_response text,
  status text not null default 'open' check (status in ('open','management_response_due','capa_required','accepted_risk','closed')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v220_capa_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  exception_id uuid references public.v220_control_exceptions(id) on delete cascade,
  linked_audit_finding_id uuid,
  linked_compliance_item_id uuid,
  action_title text not null,
  corrective_action text not null,
  preventive_action text,
  owner_profile_id uuid,
  due_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','submitted_for_review','retest_required','closed','rejected','overdue')),
  evidence_required boolean not null default true,
  retest_required boolean not null default true,
  closure_approved_by_profile_id uuid,
  closure_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_v220_control_test_plans_org_status on public.v220_control_test_plans(organization_id, status);
create index if not exists idx_v220_control_test_results_plan on public.v220_control_test_results(test_plan_id);
create index if not exists idx_v220_control_exceptions_org_severity on public.v220_control_exceptions(organization_id, severity, status);
create index if not exists idx_v220_capa_actions_org_due on public.v220_capa_actions(organization_id, due_date, status);

alter table public.v220_control_test_plans enable row level security;
alter table public.v220_control_test_steps enable row level security;
alter table public.v220_control_test_results enable row level security;
alter table public.v220_control_exceptions enable row level security;
alter table public.v220_capa_actions enable row level security;

comment on table public.v220_control_test_plans is 'v22 control test plan backbone: control, framework requirement, method, owner, reviewer, status and period.';
comment on table public.v220_control_test_results is 'v22 control test result and reviewer conclusion records.';
comment on table public.v220_control_exceptions is 'v22 failed test/exception management with severity and management response.';
comment on table public.v220_capa_actions is 'v22 CAPA actions requiring evidence and retest before closure.';
