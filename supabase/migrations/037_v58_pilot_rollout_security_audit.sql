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
