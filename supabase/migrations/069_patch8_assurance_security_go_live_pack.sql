-- Patch 8: Assurance, Security, and Go-Live Pack
-- Purpose: turn production readiness into governed operating evidence instead of proof-only claims.
-- Scope: go-live gates, external auditor packages, read-only portal sessions, retention/confidentiality, training, SOPs, board packs, signoffs, rollback/restore exercises, monitoring checks, pilot signoff, and production decisions.
-- Important: this patch does not mark the platform production-ready. It creates the records needed for real approval.

create extension if not exists pgcrypto;

create table if not exists public.assurance_go_live_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  gate_code text not null,
  gate_name text not null,
  gate_area text not null default 'general',
  gate_owner_id uuid,
  gate_owner_name text,
  is_critical boolean not null default true,
  gate_status text not null default 'not_started' check (gate_status in ('not_started','in_progress','evidence_submitted','approved','rejected','waived')),
  evidence_required_count integer not null default 0,
  evidence_accepted_count integer not null default 0,
  due_date date,
  approved_by uuid,
  approved_at timestamptz,
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, gate_code)
);

create table if not exists public.assurance_external_auditor_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  package_code text not null,
  package_title text not null,
  package_scope text,
  package_status text not null default 'draft' check (package_status in ('draft','prepared','approved','published','revoked','expired')),
  evidence_item_count integer not null default 0,
  approved_by uuid,
  approved_at timestamptz,
  expiry_date date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, package_code)
);

create table if not exists public.assurance_external_auditor_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  package_id uuid references public.assurance_external_auditor_packages(id) on delete set null,
  auditor_name text not null,
  auditor_email text,
  access_scope text not null default 'read_only',
  session_status text not null default 'requested' check (session_status in ('requested','approved','active','expired','revoked','closed')),
  starts_at timestamptz,
  expires_at timestamptz,
  last_accessed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assurance_retention_confidentiality_controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  control_code text not null,
  control_name text not null,
  control_area text not null default 'confidentiality',
  retention_period_months integer,
  confidentiality_level text not null default 'internal' check (confidentiality_level in ('public','internal','confidential','restricted')),
  implementation_status text not null default 'not_started' check (implementation_status in ('not_started','implemented','tested','exception','retired')),
  owner_id uuid,
  owner_name text,
  last_tested_at timestamptz,
  next_review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, control_code)
);

create table if not exists public.assurance_training_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  training_code text not null,
  training_title text not null,
  target_role text,
  required_count integer not null default 0,
  completed_count integer not null default 0,
  overdue_count integer not null default 0,
  training_status text not null default 'planned' check (training_status in ('planned','active','completed','overdue','cancelled')),
  owner_id uuid,
  owner_name text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, training_code)
);

create table if not exists public.assurance_sop_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sop_code text not null,
  sop_title text not null,
  sop_area text not null default 'go_live',
  version_label text,
  sop_status text not null default 'draft' check (sop_status in ('draft','under_review','approved','published','retired')),
  owner_id uuid,
  owner_name text,
  approved_by uuid,
  approved_at timestamptz,
  next_review_date date,
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sop_code)
);

create table if not exists public.assurance_board_committee_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pack_code text not null,
  pack_title text not null,
  committee_name text,
  pack_period text,
  pack_status text not null default 'draft' check (pack_status in ('draft','prepared','submitted','approved','returned','archived')),
  evidence_summary text,
  decision_required boolean not null default false,
  submitted_at timestamptz,
  approved_at timestamptz,
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, pack_code)
);

create table if not exists public.assurance_go_live_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  signoff_code text not null,
  signoff_area text not null,
  signoff_owner_id uuid,
  signoff_owner_name text,
  signoff_role text,
  signoff_status text not null default 'not_requested' check (signoff_status in ('not_requested','requested','signed','rejected','withdrawn')),
  signed_at timestamptz,
  signoff_notes text,
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, signoff_code)
);

create table if not exists public.assurance_rollback_restore_exercises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  exercise_code text not null,
  exercise_title text not null,
  exercise_type text not null default 'restore_dry_run' check (exercise_type in ('restore_dry_run','rollback_test','backup_validation','disaster_recovery','migration_rehearsal')),
  exercise_status text not null default 'planned' check (exercise_status in ('planned','executed','passed','failed','exception_accepted','cancelled')),
  executed_at timestamptz,
  rto_minutes integer,
  rpo_minutes integer,
  evidence_reference text,
  owner_id uuid,
  owner_name text,
  next_exercise_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, exercise_code)
);

create table if not exists public.assurance_monitoring_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  check_code text not null,
  check_name text not null,
  check_area text not null default 'runtime',
  check_status text not null default 'not_started' check (check_status in ('not_started','configured','tested','failed','waived','retired')),
  alert_owner_id uuid,
  alert_owner_name text,
  last_tested_at timestamptz,
  next_review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, check_code)
);

create table if not exists public.assurance_controlled_pilot_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pilot_code text not null,
  pilot_title text not null,
  pilot_scope text,
  pilot_status text not null default 'planned' check (pilot_status in ('planned','active','completed','failed','accepted_with_conditions','cancelled')),
  participant_count integer not null default 0,
  issue_count integer not null default 0,
  blocking_issue_count integer not null default 0,
  signoff_status text not null default 'not_ready' check (signoff_status in ('not_ready','ready_for_review','signed','rejected')),
  signed_by uuid,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, pilot_code)
);

create table if not exists public.assurance_production_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  decision_code text not null,
  decision_title text not null,
  decision_status text not null default 'draft' check (decision_status in ('draft','go','no_go','conditional_go','deferred','cancelled')),
  decision_body text,
  decision_owner_id uuid,
  decision_owner_name text,
  decision_date date,
  approved_gate_count integer not null default 0,
  critical_blocker_count integer not null default 0,
  workflow_instance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, decision_code)
);

create index if not exists idx_p8_gates_status on public.assurance_go_live_gates(organization_id, gate_status, is_critical, due_date);
create index if not exists idx_p8_packages_status on public.assurance_external_auditor_packages(organization_id, package_status, expiry_date);
create index if not exists idx_p8_sessions_status on public.assurance_external_auditor_portal_sessions(organization_id, session_status, expires_at);
create index if not exists idx_p8_retention_status on public.assurance_retention_confidentiality_controls(organization_id, implementation_status, next_review_date);
create index if not exists idx_p8_training_status on public.assurance_training_records(organization_id, training_status, due_date);
create index if not exists idx_p8_sop_status on public.assurance_sop_register(organization_id, sop_status, next_review_date);
create index if not exists idx_p8_packs_status on public.assurance_board_committee_packs(organization_id, pack_status, submitted_at);
create index if not exists idx_p8_signoffs_status on public.assurance_go_live_signoffs(organization_id, signoff_status, signoff_area);
create index if not exists idx_p8_exercises_status on public.assurance_rollback_restore_exercises(organization_id, exercise_status, next_exercise_date);
create index if not exists idx_p8_monitoring_status on public.assurance_monitoring_readiness_checks(organization_id, check_status, next_review_date);
create index if not exists idx_p8_pilot_status on public.assurance_controlled_pilot_signoffs(organization_id, pilot_status, signoff_status);
create index if not exists idx_p8_decisions_status on public.assurance_production_decisions(organization_id, decision_status, decision_date);

alter table public.assurance_go_live_gates enable row level security;
alter table public.assurance_external_auditor_packages enable row level security;
alter table public.assurance_external_auditor_portal_sessions enable row level security;
alter table public.assurance_retention_confidentiality_controls enable row level security;
alter table public.assurance_training_records enable row level security;
alter table public.assurance_sop_register enable row level security;
alter table public.assurance_board_committee_packs enable row level security;
alter table public.assurance_go_live_signoffs enable row level security;
alter table public.assurance_rollback_restore_exercises enable row level security;
alter table public.assurance_monitoring_readiness_checks enable row level security;
alter table public.assurance_controlled_pilot_signoffs enable row level security;
alter table public.assurance_production_decisions enable row level security;


drop policy if exists assurance_go_live_gates_org_read on public.assurance_go_live_gates;
create policy assurance_go_live_gates_org_read on public.assurance_go_live_gates
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_go_live_gates_org_insert on public.assurance_go_live_gates;
create policy assurance_go_live_gates_org_insert on public.assurance_go_live_gates
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_go_live_gates_org_update on public.assurance_go_live_gates;
create policy assurance_go_live_gates_org_update on public.assurance_go_live_gates
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_external_auditor_packages_org_read on public.assurance_external_auditor_packages;
create policy assurance_external_auditor_packages_org_read on public.assurance_external_auditor_packages
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_external_auditor_packages_org_insert on public.assurance_external_auditor_packages;
create policy assurance_external_auditor_packages_org_insert on public.assurance_external_auditor_packages
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_external_auditor_packages_org_update on public.assurance_external_auditor_packages;
create policy assurance_external_auditor_packages_org_update on public.assurance_external_auditor_packages
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_external_auditor_portal_sessions_org_read on public.assurance_external_auditor_portal_sessions;
create policy assurance_external_auditor_portal_sessions_org_read on public.assurance_external_auditor_portal_sessions
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_external_auditor_portal_sessions_org_insert on public.assurance_external_auditor_portal_sessions;
create policy assurance_external_auditor_portal_sessions_org_insert on public.assurance_external_auditor_portal_sessions
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_external_auditor_portal_sessions_org_update on public.assurance_external_auditor_portal_sessions;
create policy assurance_external_auditor_portal_sessions_org_update on public.assurance_external_auditor_portal_sessions
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_retention_confidentiality_controls_org_read on public.assurance_retention_confidentiality_controls;
create policy assurance_retention_confidentiality_controls_org_read on public.assurance_retention_confidentiality_controls
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_retention_confidentiality_controls_org_insert on public.assurance_retention_confidentiality_controls;
create policy assurance_retention_confidentiality_controls_org_insert on public.assurance_retention_confidentiality_controls
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_retention_confidentiality_controls_org_update on public.assurance_retention_confidentiality_controls;
create policy assurance_retention_confidentiality_controls_org_update on public.assurance_retention_confidentiality_controls
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_training_records_org_read on public.assurance_training_records;
create policy assurance_training_records_org_read on public.assurance_training_records
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_training_records_org_insert on public.assurance_training_records;
create policy assurance_training_records_org_insert on public.assurance_training_records
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_training_records_org_update on public.assurance_training_records;
create policy assurance_training_records_org_update on public.assurance_training_records
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_sop_register_org_read on public.assurance_sop_register;
create policy assurance_sop_register_org_read on public.assurance_sop_register
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_sop_register_org_insert on public.assurance_sop_register;
create policy assurance_sop_register_org_insert on public.assurance_sop_register
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_sop_register_org_update on public.assurance_sop_register;
create policy assurance_sop_register_org_update on public.assurance_sop_register
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_board_committee_packs_org_read on public.assurance_board_committee_packs;
create policy assurance_board_committee_packs_org_read on public.assurance_board_committee_packs
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_board_committee_packs_org_insert on public.assurance_board_committee_packs;
create policy assurance_board_committee_packs_org_insert on public.assurance_board_committee_packs
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_board_committee_packs_org_update on public.assurance_board_committee_packs;
create policy assurance_board_committee_packs_org_update on public.assurance_board_committee_packs
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_go_live_signoffs_org_read on public.assurance_go_live_signoffs;
create policy assurance_go_live_signoffs_org_read on public.assurance_go_live_signoffs
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_go_live_signoffs_org_insert on public.assurance_go_live_signoffs;
create policy assurance_go_live_signoffs_org_insert on public.assurance_go_live_signoffs
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_go_live_signoffs_org_update on public.assurance_go_live_signoffs;
create policy assurance_go_live_signoffs_org_update on public.assurance_go_live_signoffs
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_rollback_restore_exercises_org_read on public.assurance_rollback_restore_exercises;
create policy assurance_rollback_restore_exercises_org_read on public.assurance_rollback_restore_exercises
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_rollback_restore_exercises_org_insert on public.assurance_rollback_restore_exercises;
create policy assurance_rollback_restore_exercises_org_insert on public.assurance_rollback_restore_exercises
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_rollback_restore_exercises_org_update on public.assurance_rollback_restore_exercises;
create policy assurance_rollback_restore_exercises_org_update on public.assurance_rollback_restore_exercises
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_monitoring_readiness_checks_org_read on public.assurance_monitoring_readiness_checks;
create policy assurance_monitoring_readiness_checks_org_read on public.assurance_monitoring_readiness_checks
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_monitoring_readiness_checks_org_insert on public.assurance_monitoring_readiness_checks;
create policy assurance_monitoring_readiness_checks_org_insert on public.assurance_monitoring_readiness_checks
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_monitoring_readiness_checks_org_update on public.assurance_monitoring_readiness_checks;
create policy assurance_monitoring_readiness_checks_org_update on public.assurance_monitoring_readiness_checks
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_controlled_pilot_signoffs_org_read on public.assurance_controlled_pilot_signoffs;
create policy assurance_controlled_pilot_signoffs_org_read on public.assurance_controlled_pilot_signoffs
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_controlled_pilot_signoffs_org_insert on public.assurance_controlled_pilot_signoffs;
create policy assurance_controlled_pilot_signoffs_org_insert on public.assurance_controlled_pilot_signoffs
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_controlled_pilot_signoffs_org_update on public.assurance_controlled_pilot_signoffs;
create policy assurance_controlled_pilot_signoffs_org_update on public.assurance_controlled_pilot_signoffs
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_production_decisions_org_read on public.assurance_production_decisions;
create policy assurance_production_decisions_org_read on public.assurance_production_decisions
  for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_production_decisions_org_insert on public.assurance_production_decisions;
create policy assurance_production_decisions_org_insert on public.assurance_production_decisions
  for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists assurance_production_decisions_org_update on public.assurance_production_decisions;
create policy assurance_production_decisions_org_update on public.assurance_production_decisions
  for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_assurance_go_live_summary
with (security_invoker = true) as
select
  org.organization_id,
  coalesce(g.critical_gate_count, 0)::integer as critical_gate_count,
  coalesce(g.critical_gate_not_approved_count, 0)::integer as critical_gate_not_approved_count,
  coalesce(s.signoff_required_count, 0)::integer as signoff_required_count,
  coalesce(s.signoff_signed_count, 0)::integer as signoff_signed_count,
  coalesce(r.restore_exercise_count, 0)::integer as restore_exercise_count,
  coalesce(r.failed_restore_exercise_count, 0)::integer as failed_restore_exercise_count,
  coalesce(t.training_campaign_count, 0)::integer as training_campaign_count,
  coalesce(t.training_overdue_count, 0)::integer as training_overdue_count,
  coalesce(m.monitoring_check_count, 0)::integer as monitoring_check_count,
  coalesce(m.monitoring_failed_count, 0)::integer as monitoring_failed_count,
  coalesce(p.open_auditor_session_count, 0)::integer as open_auditor_session_count,
  coalesce(d.go_decision_count, 0)::integer as go_decision_count
from (
  select organization_id from public.assurance_go_live_gates
  union select organization_id from public.assurance_go_live_signoffs
  union select organization_id from public.assurance_rollback_restore_exercises
  union select organization_id from public.assurance_training_records
  union select organization_id from public.assurance_monitoring_readiness_checks
  union select organization_id from public.assurance_external_auditor_portal_sessions
  union select organization_id from public.assurance_production_decisions
) org
left join (
  select organization_id,
    count(*) filter (where is_critical)::integer as critical_gate_count,
    count(*) filter (where is_critical and gate_status <> 'approved')::integer as critical_gate_not_approved_count
  from public.assurance_go_live_gates group by organization_id
) g on g.organization_id = org.organization_id
left join (
  select organization_id,
    count(*)::integer as signoff_required_count,
    count(*) filter (where signoff_status = 'signed')::integer as signoff_signed_count
  from public.assurance_go_live_signoffs group by organization_id
) s on s.organization_id = org.organization_id
left join (
  select organization_id,
    count(*)::integer as restore_exercise_count,
    count(*) filter (where exercise_status = 'failed')::integer as failed_restore_exercise_count
  from public.assurance_rollback_restore_exercises group by organization_id
) r on r.organization_id = org.organization_id
left join (
  select organization_id,
    count(*)::integer as training_campaign_count,
    coalesce(sum(overdue_count), 0)::integer as training_overdue_count
  from public.assurance_training_records group by organization_id
) t on t.organization_id = org.organization_id
left join (
  select organization_id,
    count(*)::integer as monitoring_check_count,
    count(*) filter (where check_status = 'failed')::integer as monitoring_failed_count
  from public.assurance_monitoring_readiness_checks group by organization_id
) m on m.organization_id = org.organization_id
left join (
  select organization_id,
    count(*) filter (where session_status in ('approved','active'))::integer as open_auditor_session_count
  from public.assurance_external_auditor_portal_sessions group by organization_id
) p on p.organization_id = org.organization_id
left join (
  select organization_id,
    count(*) filter (where decision_status in ('go','conditional_go'))::integer as go_decision_count
  from public.assurance_production_decisions group by organization_id
) d on d.organization_id = org.organization_id;

create or replace view public.v_assurance_gate_dashboard
with (security_invoker = true) as
select
  organization_id,
  gate_code,
  gate_name,
  gate_area,
  gate_owner_name,
  is_critical,
  gate_status,
  evidence_required_count,
  evidence_accepted_count,
  due_date,
  case
    when is_critical and gate_status <> 'approved' then 'critical_not_approved'
    when evidence_required_count > evidence_accepted_count then 'evidence_gap'
    when due_date is not null and due_date < current_date and gate_status <> 'approved' then 'overdue'
    else 'normal'
  end as gate_signal
from public.assurance_go_live_gates;

create or replace view public.v_assurance_external_auditor_portal
with (security_invoker = true) as
select
  s.organization_id,
  p.package_code,
  p.package_title,
  p.package_status,
  s.auditor_name,
  s.auditor_email,
  s.access_scope,
  s.session_status,
  s.starts_at,
  s.expires_at,
  s.last_accessed_at
from public.assurance_external_auditor_portal_sessions s
left join public.assurance_external_auditor_packages p on p.id = s.package_id;

create or replace view public.v_assurance_signoff_readiness
with (security_invoker = true) as
select organization_id, 'signoff'::text as readiness_type, signoff_code as item_code, signoff_area as item_area, signoff_owner_name as owner_name, signoff_status as item_status,
  case when signoff_status = 'signed' then 'ready' when signoff_status = 'rejected' then 'blocked' else 'pending' end as readiness_signal
from public.assurance_go_live_signoffs
union all
select organization_id, 'training', training_code, target_role, owner_name, training_status,
  case when overdue_count > 0 then 'blocked' when training_status = 'completed' then 'ready' else 'pending' end
from public.assurance_training_records
union all
select organization_id, 'restore', exercise_code, exercise_type, owner_name, exercise_status,
  case when exercise_status = 'passed' then 'ready' when exercise_status = 'failed' then 'blocked' else 'pending' end
from public.assurance_rollback_restore_exercises
union all
select organization_id, 'monitoring', check_code, check_area, alert_owner_name, check_status,
  case when check_status = 'tested' then 'ready' when check_status = 'failed' then 'blocked' else 'pending' end
from public.assurance_monitoring_readiness_checks;

comment on table public.assurance_go_live_gates is 'Patch 8 go-live gate register. Production approval requires real evidence, not proof-only commands.';
comment on table public.assurance_external_auditor_portal_sessions is 'Patch 8 external auditor read-only access session register.';
comment on table public.assurance_go_live_signoffs is 'Patch 8 real management, IT, Quality, and governance signoff register.';
comment on view public.v_assurance_go_live_summary is 'Patch 8 assurance summary; security_invoker keeps RLS active.';
