-- Patch 18: Production Go/No-Go Pack
-- Purpose: move from technical readiness to controlled production approval with staging persona SQL,
-- restore/rollback proof, change freeze, final access/confidentiality review, board pack, executive decision,
-- and post-launch monitoring plan.
-- Important: this patch creates governance structures only. It does not seed fake approvals, fake signoffs,
-- fake board decisions, fake evidence, or copyrighted standards content.

create extension if not exists pgcrypto;

create table if not exists public.production_go_no_go_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_code text not null,
  cycle_name text not null,
  target_launch_at timestamptz,
  environment_name text not null default 'staging',
  decision_status text not null default 'draft'
    check (decision_status in ('draft', 'preparing', 'evidence_review', 'conditional_go', 'go', 'no_go', 'deferred', 'closed')),
  readiness_score numeric(5,2),
  decision_owner_id uuid,
  decision_owner_name text,
  board_pack_url text,
  decision_record_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cycle_code)
);

create table if not exists public.production_go_no_go_staging_persona_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null references public.production_go_no_go_cycles(id) on delete cascade,
  run_code text not null,
  persona_area text not null
    check (persona_area in ('executive', 'quality', 'risk', 'compliance', 'audit', 'it', 'department_manager', 'employee', 'external_auditor', 'board')),
  persona_name text,
  sql_pack_name text,
  sql_pack_version text,
  run_status text not null default 'pending'
    check (run_status in ('pending', 'running', 'passed', 'failed', 'blocked', 'waived')),
  output_hash text,
  output_url text,
  executed_by_name text,
  executed_at timestamptz,
  reviewed_by_name text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, run_code)
);

create table if not exists public.production_go_no_go_restore_rollback_proofs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null references public.production_go_no_go_cycles(id) on delete cascade,
  proof_code text not null,
  proof_type text not null
    check (proof_type in ('backup_created', 'restore_dry_run', 'rollback_plan', 'rollback_test', 'data_export', 'disaster_recovery')),
  proof_status text not null default 'pending'
    check (proof_status in ('pending', 'passed', 'failed', 'blocked', 'waived')),
  backup_reference text,
  restore_environment text,
  recovery_point_objective_minutes integer,
  recovery_time_objective_minutes integer,
  evidence_url text,
  evidence_hash text,
  executed_by_name text,
  executed_at timestamptz,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, proof_code)
);

create table if not exists public.production_go_no_go_change_freezes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null references public.production_go_no_go_cycles(id) on delete cascade,
  freeze_code text not null,
  freeze_scope text not null default 'production_launch'
    check (freeze_scope in ('production_launch', 'data_migration', 'configuration', 'security', 'release_branch')),
  freeze_status text not null default 'planned'
    check (freeze_status in ('planned', 'active', 'exception_requested', 'exception_approved', 'released', 'cancelled')),
  freeze_starts_at timestamptz,
  freeze_ends_at timestamptz,
  approved_by_name text,
  approval_evidence_url text,
  exception_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, freeze_code)
);

create table if not exists public.production_go_no_go_access_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null references public.production_go_no_go_cycles(id) on delete cascade,
  review_code text not null,
  review_area text not null
    check (review_area in ('user_access', 'admin_access', 'external_auditor_access', 'service_role', 'storage_access', 'rls_boundary', 'confidentiality')),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'in_review', 'passed', 'failed', 'conditional', 'waived')),
  total_accounts integer not null default 0,
  exceptions_count integer not null default 0,
  revoked_count integer not null default 0,
  reviewer_name text,
  evidence_url text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, review_code)
);

create table if not exists public.production_go_no_go_confidentiality_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null references public.production_go_no_go_cycles(id) on delete cascade,
  check_code text not null,
  check_area text not null
    check (check_area in ('patient_data', 'employee_data', 'board_pack', 'audit_evidence', 'external_access', 'export_controls', 'screenshots')),
  check_status text not null default 'pending'
    check (check_status in ('pending', 'passed', 'failed', 'conditional', 'waived')),
  finding_summary text,
  mitigation_summary text,
  evidence_url text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, check_code)
);

create table if not exists public.production_go_no_go_board_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null references public.production_go_no_go_cycles(id) on delete cascade,
  pack_code text not null,
  pack_title text not null,
  pack_status text not null default 'draft'
    check (pack_status in ('draft', 'collecting', 'review_ready', 'issued', 'accepted', 'rejected', 'archived')),
  technical_proof_url text,
  uat_evidence_url text,
  risk_acceptance_url text,
  launch_plan_url text,
  rollback_plan_url text,
  executive_summary_url text,
  prepared_by_name text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, pack_code)
);

create table if not exists public.production_go_no_go_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null references public.production_go_no_go_cycles(id) on delete cascade,
  decision_code text not null,
  decision_type text not null default 'production_launch'
    check (decision_type in ('production_launch', 'data_cutover', 'accreditation_readiness', 'external_auditor_access', 'rollback')),
  decision_status text not null default 'pending'
    check (decision_status in ('pending', 'go', 'conditional_go', 'no_go', 'deferred', 'reopened')),
  decision_rationale text,
  conditions text,
  decided_by_name text,
  decided_at timestamptz,
  decision_evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, decision_code)
);

create table if not exists public.production_go_no_go_launch_monitoring_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null references public.production_go_no_go_cycles(id) on delete cascade,
  check_code text not null,
  monitoring_area text not null
    check (monitoring_area in ('availability', 'authentication', 'rls', 'errors', 'performance', 'backups', 'evidence_uploads', 'workflow_execution', 'user_support')),
  check_frequency text not null default 'daily'
    check (check_frequency in ('hourly', 'daily', 'weekly', 'one_time')),
  check_status text not null default 'not_started'
    check (check_status in ('not_started', 'green', 'amber', 'red', 'resolved', 'waived')),
  threshold_summary text,
  latest_result_summary text,
  latest_checked_at timestamptz,
  owner_name text,
  evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, check_code)
);

create index if not exists idx_prod_gng_cycles_org_status on public.production_go_no_go_cycles(organization_id, decision_status, target_launch_at);
create index if not exists idx_prod_gng_persona_org_status on public.production_go_no_go_staging_persona_runs(organization_id, run_status, persona_area);
create index if not exists idx_prod_gng_restore_org_status on public.production_go_no_go_restore_rollback_proofs(organization_id, proof_status, proof_type);
create index if not exists idx_prod_gng_freeze_org_status on public.production_go_no_go_change_freezes(organization_id, freeze_status, freeze_scope);
create index if not exists idx_prod_gng_access_org_status on public.production_go_no_go_access_reviews(organization_id, review_status, review_area);
create index if not exists idx_prod_gng_confidentiality_org_status on public.production_go_no_go_confidentiality_checks(organization_id, check_status, check_area);
create index if not exists idx_prod_gng_board_org_status on public.production_go_no_go_board_packs(organization_id, pack_status);
create index if not exists idx_prod_gng_decisions_org_status on public.production_go_no_go_decisions(organization_id, decision_status, decision_type);
create index if not exists idx_prod_gng_monitoring_org_status on public.production_go_no_go_launch_monitoring_checks(organization_id, check_status, monitoring_area);

alter table public.production_go_no_go_cycles enable row level security;
alter table public.production_go_no_go_staging_persona_runs enable row level security;
alter table public.production_go_no_go_restore_rollback_proofs enable row level security;
alter table public.production_go_no_go_change_freezes enable row level security;
alter table public.production_go_no_go_access_reviews enable row level security;
alter table public.production_go_no_go_confidentiality_checks enable row level security;
alter table public.production_go_no_go_board_packs enable row level security;
alter table public.production_go_no_go_decisions enable row level security;
alter table public.production_go_no_go_launch_monitoring_checks enable row level security;

drop policy if exists production_go_no_go_cycles_org_read on public.production_go_no_go_cycles;
create policy production_go_no_go_cycles_org_read on public.production_go_no_go_cycles for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_cycles_org_insert on public.production_go_no_go_cycles;
create policy production_go_no_go_cycles_org_insert on public.production_go_no_go_cycles for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_cycles_org_update on public.production_go_no_go_cycles;
create policy production_go_no_go_cycles_org_update on public.production_go_no_go_cycles for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists production_go_no_go_staging_persona_runs_org_read on public.production_go_no_go_staging_persona_runs;
create policy production_go_no_go_staging_persona_runs_org_read on public.production_go_no_go_staging_persona_runs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_staging_persona_runs_org_insert on public.production_go_no_go_staging_persona_runs;
create policy production_go_no_go_staging_persona_runs_org_insert on public.production_go_no_go_staging_persona_runs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_staging_persona_runs_org_update on public.production_go_no_go_staging_persona_runs;
create policy production_go_no_go_staging_persona_runs_org_update on public.production_go_no_go_staging_persona_runs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists production_go_no_go_restore_rollback_proofs_org_read on public.production_go_no_go_restore_rollback_proofs;
create policy production_go_no_go_restore_rollback_proofs_org_read on public.production_go_no_go_restore_rollback_proofs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_restore_rollback_proofs_org_insert on public.production_go_no_go_restore_rollback_proofs;
create policy production_go_no_go_restore_rollback_proofs_org_insert on public.production_go_no_go_restore_rollback_proofs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_restore_rollback_proofs_org_update on public.production_go_no_go_restore_rollback_proofs;
create policy production_go_no_go_restore_rollback_proofs_org_update on public.production_go_no_go_restore_rollback_proofs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists production_go_no_go_change_freezes_org_read on public.production_go_no_go_change_freezes;
create policy production_go_no_go_change_freezes_org_read on public.production_go_no_go_change_freezes for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_change_freezes_org_insert on public.production_go_no_go_change_freezes;
create policy production_go_no_go_change_freezes_org_insert on public.production_go_no_go_change_freezes for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_change_freezes_org_update on public.production_go_no_go_change_freezes;
create policy production_go_no_go_change_freezes_org_update on public.production_go_no_go_change_freezes for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists production_go_no_go_access_reviews_org_read on public.production_go_no_go_access_reviews;
create policy production_go_no_go_access_reviews_org_read on public.production_go_no_go_access_reviews for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_access_reviews_org_insert on public.production_go_no_go_access_reviews;
create policy production_go_no_go_access_reviews_org_insert on public.production_go_no_go_access_reviews for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_access_reviews_org_update on public.production_go_no_go_access_reviews;
create policy production_go_no_go_access_reviews_org_update on public.production_go_no_go_access_reviews for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists production_go_no_go_confidentiality_checks_org_read on public.production_go_no_go_confidentiality_checks;
create policy production_go_no_go_confidentiality_checks_org_read on public.production_go_no_go_confidentiality_checks for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_confidentiality_checks_org_insert on public.production_go_no_go_confidentiality_checks;
create policy production_go_no_go_confidentiality_checks_org_insert on public.production_go_no_go_confidentiality_checks for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_confidentiality_checks_org_update on public.production_go_no_go_confidentiality_checks;
create policy production_go_no_go_confidentiality_checks_org_update on public.production_go_no_go_confidentiality_checks for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists production_go_no_go_board_packs_org_read on public.production_go_no_go_board_packs;
create policy production_go_no_go_board_packs_org_read on public.production_go_no_go_board_packs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_board_packs_org_insert on public.production_go_no_go_board_packs;
create policy production_go_no_go_board_packs_org_insert on public.production_go_no_go_board_packs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_board_packs_org_update on public.production_go_no_go_board_packs;
create policy production_go_no_go_board_packs_org_update on public.production_go_no_go_board_packs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists production_go_no_go_decisions_org_read on public.production_go_no_go_decisions;
create policy production_go_no_go_decisions_org_read on public.production_go_no_go_decisions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_decisions_org_insert on public.production_go_no_go_decisions;
create policy production_go_no_go_decisions_org_insert on public.production_go_no_go_decisions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_decisions_org_update on public.production_go_no_go_decisions;
create policy production_go_no_go_decisions_org_update on public.production_go_no_go_decisions for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists production_go_no_go_launch_monitoring_checks_org_read on public.production_go_no_go_launch_monitoring_checks;
create policy production_go_no_go_launch_monitoring_checks_org_read on public.production_go_no_go_launch_monitoring_checks for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_launch_monitoring_checks_org_insert on public.production_go_no_go_launch_monitoring_checks;
create policy production_go_no_go_launch_monitoring_checks_org_insert on public.production_go_no_go_launch_monitoring_checks for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists production_go_no_go_launch_monitoring_checks_org_update on public.production_go_no_go_launch_monitoring_checks;
create policy production_go_no_go_launch_monitoring_checks_org_update on public.production_go_no_go_launch_monitoring_checks for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_production_go_no_go_summary
with (security_invoker = true) as
select
  c.organization_id,
  count(*)::integer as cycle_count,
  (count(*) filter (where c.decision_status in ('go', 'conditional_go')))::integer as go_ready_cycles,
  (count(*) filter (where c.decision_status in ('no_go', 'deferred')))::integer as blocked_or_deferred_cycles,
  coalesce(round(avg(c.readiness_score), 2), 0)::numeric(5,2) as avg_readiness_score,
  max(c.target_launch_at) as latest_target_launch_at
from public.production_go_no_go_cycles c
group by c.organization_id;

create or replace view public.v_production_go_no_go_evidence_queue
with (security_invoker = true) as
select
  c.organization_id,
  c.id as cycle_id,
  c.cycle_code,
  c.cycle_name,
  c.decision_status,
  coalesce(p.pending_persona_runs, 0)::integer as pending_persona_runs,
  coalesce(r.pending_restore_proofs, 0)::integer as pending_restore_proofs,
  coalesce(a.pending_access_reviews, 0)::integer as pending_access_reviews,
  coalesce(conf.pending_confidentiality_checks, 0)::integer as pending_confidentiality_checks,
  coalesce(d.pending_decisions, 0)::integer as pending_decisions,
  case
    when coalesce(p.failed_persona_runs, 0) > 0 or coalesce(r.failed_restore_proofs, 0) > 0 or coalesce(a.failed_access_reviews, 0) > 0 or coalesce(conf.failed_confidentiality_checks, 0) > 0 then 'danger'
    when coalesce(p.pending_persona_runs, 0) > 0 or coalesce(r.pending_restore_proofs, 0) > 0 or coalesce(a.pending_access_reviews, 0) > 0 or coalesce(conf.pending_confidentiality_checks, 0) > 0 or coalesce(d.pending_decisions, 0) > 0 then 'warning'
    when c.decision_status in ('go', 'conditional_go') then 'ready'
    else 'normal'
  end as readiness_signal
from public.production_go_no_go_cycles c
left join (
  select cycle_id,
    (count(*) filter (where run_status in ('pending', 'running')))::integer as pending_persona_runs,
    (count(*) filter (where run_status = 'failed'))::integer as failed_persona_runs
  from public.production_go_no_go_staging_persona_runs
  group by cycle_id
) p on p.cycle_id = c.id
left join (
  select cycle_id,
    (count(*) filter (where proof_status in ('pending')))::integer as pending_restore_proofs,
    (count(*) filter (where proof_status = 'failed'))::integer as failed_restore_proofs
  from public.production_go_no_go_restore_rollback_proofs
  group by cycle_id
) r on r.cycle_id = c.id
left join (
  select cycle_id,
    (count(*) filter (where review_status in ('pending', 'in_review')))::integer as pending_access_reviews,
    (count(*) filter (where review_status = 'failed'))::integer as failed_access_reviews
  from public.production_go_no_go_access_reviews
  group by cycle_id
) a on a.cycle_id = c.id
left join (
  select cycle_id,
    (count(*) filter (where check_status = 'pending'))::integer as pending_confidentiality_checks,
    (count(*) filter (where check_status = 'failed'))::integer as failed_confidentiality_checks
  from public.production_go_no_go_confidentiality_checks
  group by cycle_id
) conf on conf.cycle_id = c.id
left join (
  select cycle_id,
    (count(*) filter (where decision_status = 'pending'))::integer as pending_decisions
  from public.production_go_no_go_decisions
  group by cycle_id
) d on d.cycle_id = c.id;

create or replace view public.v_production_go_no_go_decision_queue
with (security_invoker = true) as
select
  d.organization_id,
  d.id,
  d.cycle_id,
  c.cycle_code,
  c.cycle_name,
  d.decision_code,
  d.decision_type,
  d.decision_status,
  d.decided_by_name,
  d.decided_at,
  d.decision_evidence_url,
  case
    when d.decision_status = 'no_go' then 'danger'
    when d.decision_status in ('pending', 'deferred') then 'warning'
    when d.decision_status in ('go', 'conditional_go') then 'ready'
    else 'normal'
  end as decision_signal
from public.production_go_no_go_decisions d
join public.production_go_no_go_cycles c on c.id = d.cycle_id;

create or replace view public.v_production_go_no_go_monitoring_dashboard
with (security_invoker = true) as
select
  m.organization_id,
  m.cycle_id,
  c.cycle_code,
  c.cycle_name,
  m.monitoring_area,
  m.check_frequency,
  m.check_status,
  m.owner_name,
  m.latest_checked_at,
  m.evidence_url,
  case
    when m.check_status = 'red' then 'danger'
    when m.check_status = 'amber' then 'warning'
    when m.check_status in ('green', 'resolved') then 'ready'
    else 'normal'
  end as monitoring_signal
from public.production_go_no_go_launch_monitoring_checks m
join public.production_go_no_go_cycles c on c.id = m.cycle_id;
