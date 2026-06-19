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
