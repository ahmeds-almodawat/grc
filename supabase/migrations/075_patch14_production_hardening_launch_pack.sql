-- Patch 14: Production Hardening & Launch Pack
-- Purpose: close final hardening and launch governance records before production approval.
-- Scope: client warnings, v65 warning closure, staging persona SQL, backup/restore proof, change freeze, go/no-go pack, signoffs, launch decision, post-launch monitoring.
-- Important: this migration does not mark the platform production-ready. Production readiness still requires signed human approval and live evidence.

create extension if not exists pgcrypto;

create table if not exists public.patch14_client_warning_register (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  warning_code text not null,
  warning_source text not null default 'frontend'
    check (warning_source in ('frontend', 'supabase', 'browser', 'build', 'runtime', 'monitoring')),
  warning_title text not null,
  warning_details text,
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  warning_status text not null default 'open'
    check (warning_status in ('open', 'investigating', 'fixed_pending_verification', 'closed', 'accepted')),
  owner_id uuid,
  owner_name text,
  due_date date,
  verification_evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, warning_code)
);

create table if not exists public.patch14_v65_warning_closure (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  finding_code text not null,
  finding_title text not null,
  finding_file text,
  finding_severity text not null default 'medium'
    check (finding_severity in ('critical', 'high', 'medium', 'low')),
  closure_status text not null default 'open'
    check (closure_status in ('open', 'fixed_pending_capture', 'closed', 'accepted_risk')),
  closure_action text,
  capture_command text default 'npm run v672:capture && npm run v700:v65-audit',
  evidence_url text,
  owner_id uuid,
  owner_name text,
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, finding_code)
);

create table if not exists public.patch14_staging_persona_sql_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  run_code text not null,
  run_title text not null,
  sql_file_path text not null,
  environment_name text not null default 'staging'
    check (environment_name in ('local', 'staging', 'production_read_only')),
  run_status text not null default 'not_run'
    check (run_status in ('not_run', 'passed', 'failed', 'blocked', 'review_required')),
  persona_count integer not null default 0,
  scenario_count integer not null default 0,
  failed_count integer not null default 0,
  output_artifact_url text,
  executed_by uuid,
  executed_by_name text,
  executed_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, run_code)
);

create table if not exists public.patch14_backup_restore_proof_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  proof_code text not null,
  environment_name text not null default 'staging'
    check (environment_name in ('local', 'staging', 'production_read_only')),
  backup_artifact_url text,
  restore_artifact_url text,
  counts_matched boolean,
  evidence_tables_verified boolean,
  smoke_passed boolean,
  proof_status text not null default 'not_run'
    check (proof_status in ('not_run', 'passed', 'failed', 'blocked', 'review_required')),
  executed_by uuid,
  executed_by_name text,
  executed_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, proof_code)
);

create table if not exists public.patch14_change_freeze_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  freeze_code text not null,
  freeze_scope text not null
    check (freeze_scope in ('database', 'frontend', 'auth', 'rls', 'edge_functions', 'all')),
  freeze_status text not null default 'planned'
    check (freeze_status in ('planned', 'active', 'exception_requested', 'exception_approved', 'lifted', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  exception_reason text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, freeze_code)
);

create table if not exists public.patch14_board_go_no_go_pack (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pack_code text not null,
  pack_title text not null,
  pack_status text not null default 'draft'
    check (pack_status in ('draft', 'ready_for_review', 'approved', 'rejected', 'deferred')),
  summary_score numeric(5,2) not null default 0 check (summary_score >= 0 and summary_score <= 100),
  risk_summary text,
  launch_recommendation text not null default 'defer'
    check (launch_recommendation in ('go', 'conditional_go', 'defer', 'no_go')),
  evidence_url text,
  board_meeting_date date,
  prepared_by uuid,
  prepared_by_name text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, pack_code)
);

create table if not exists public.patch14_launch_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  signoff_code text not null,
  signoff_area text not null
    check (signoff_area in ('management', 'it', 'quality', 'audit', 'risk', 'compliance', 'board', 'external_auditor')),
  signer_id uuid,
  signer_name text,
  signer_role text,
  signoff_status text not null default 'pending'
    check (signoff_status in ('pending', 'signed', 'rejected', 'deferred', 'not_required')),
  decision_notes text,
  signed_at timestamptz,
  evidence_url text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, signoff_code)
);

create table if not exists public.patch14_launch_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  decision_code text not null,
  decision_title text not null,
  decision_status text not null default 'draft'
    check (decision_status in ('draft', 'approved_go', 'approved_conditional_go', 'deferred', 'rejected_no_go', 'rolled_back')),
  launch_window_start timestamptz,
  launch_window_end timestamptz,
  conditions text,
  rollback_trigger text,
  approved_by uuid,
  approved_by_name text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, decision_code)
);

create table if not exists public.patch14_post_launch_monitoring_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  check_code text not null,
  check_title text not null,
  check_domain text not null
    check (check_domain in ('availability', 'performance', 'auth', 'rls', 'audit_log', 'backup', 'integration', 'user_support')),
  check_status text not null default 'not_started'
    check (check_status in ('not_started', 'green', 'amber', 'red', 'resolved', 'accepted')),
  threshold_description text,
  current_observation text,
  owner_id uuid,
  owner_name text,
  last_checked_at timestamptz,
  evidence_url text,
  created_at timestamptz not null default now(),
  unique (organization_id, check_code)
);

create index if not exists idx_p14_client_warnings_org_status on public.patch14_client_warning_register(organization_id, warning_status, severity, due_date);
create index if not exists idx_p14_v65_org_status on public.patch14_v65_warning_closure(organization_id, closure_status, finding_severity);
create index if not exists idx_p14_persona_org_status on public.patch14_staging_persona_sql_runs(organization_id, run_status, environment_name);
create index if not exists idx_p14_restore_org_status on public.patch14_backup_restore_proof_runs(organization_id, proof_status, environment_name);
create index if not exists idx_p14_freeze_org_status on public.patch14_change_freeze_records(organization_id, freeze_status, freeze_scope);
create index if not exists idx_p14_gonogo_org_status on public.patch14_board_go_no_go_pack(organization_id, pack_status, launch_recommendation);
create index if not exists idx_p14_signoffs_org_status on public.patch14_launch_signoffs(organization_id, signoff_status, signoff_area, due_date);
create index if not exists idx_p14_decisions_org_status on public.patch14_launch_decisions(organization_id, decision_status, launch_window_start);
create index if not exists idx_p14_monitoring_org_status on public.patch14_post_launch_monitoring_checks(organization_id, check_status, check_domain);

alter table public.patch14_client_warning_register enable row level security;
alter table public.patch14_v65_warning_closure enable row level security;
alter table public.patch14_staging_persona_sql_runs enable row level security;
alter table public.patch14_backup_restore_proof_runs enable row level security;
alter table public.patch14_change_freeze_records enable row level security;
alter table public.patch14_board_go_no_go_pack enable row level security;
alter table public.patch14_launch_signoffs enable row level security;
alter table public.patch14_launch_decisions enable row level security;
alter table public.patch14_post_launch_monitoring_checks enable row level security;

-- Explicit org-scoped RLS policies for static audit visibility.
drop policy if exists patch14_client_warning_register_org_read on public.patch14_client_warning_register;
create policy patch14_client_warning_register_org_read on public.patch14_client_warning_register for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_client_warning_register_org_insert on public.patch14_client_warning_register;
create policy patch14_client_warning_register_org_insert on public.patch14_client_warning_register for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_client_warning_register_org_update on public.patch14_client_warning_register;
create policy patch14_client_warning_register_org_update on public.patch14_client_warning_register for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch14_v65_warning_closure_org_read on public.patch14_v65_warning_closure;
create policy patch14_v65_warning_closure_org_read on public.patch14_v65_warning_closure for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_v65_warning_closure_org_insert on public.patch14_v65_warning_closure;
create policy patch14_v65_warning_closure_org_insert on public.patch14_v65_warning_closure for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_v65_warning_closure_org_update on public.patch14_v65_warning_closure;
create policy patch14_v65_warning_closure_org_update on public.patch14_v65_warning_closure for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch14_staging_persona_sql_runs_org_read on public.patch14_staging_persona_sql_runs;
create policy patch14_staging_persona_sql_runs_org_read on public.patch14_staging_persona_sql_runs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_staging_persona_sql_runs_org_insert on public.patch14_staging_persona_sql_runs;
create policy patch14_staging_persona_sql_runs_org_insert on public.patch14_staging_persona_sql_runs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_staging_persona_sql_runs_org_update on public.patch14_staging_persona_sql_runs;
create policy patch14_staging_persona_sql_runs_org_update on public.patch14_staging_persona_sql_runs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch14_backup_restore_proof_runs_org_read on public.patch14_backup_restore_proof_runs;
create policy patch14_backup_restore_proof_runs_org_read on public.patch14_backup_restore_proof_runs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_backup_restore_proof_runs_org_insert on public.patch14_backup_restore_proof_runs;
create policy patch14_backup_restore_proof_runs_org_insert on public.patch14_backup_restore_proof_runs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_backup_restore_proof_runs_org_update on public.patch14_backup_restore_proof_runs;
create policy patch14_backup_restore_proof_runs_org_update on public.patch14_backup_restore_proof_runs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch14_change_freeze_records_org_read on public.patch14_change_freeze_records;
create policy patch14_change_freeze_records_org_read on public.patch14_change_freeze_records for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_change_freeze_records_org_insert on public.patch14_change_freeze_records;
create policy patch14_change_freeze_records_org_insert on public.patch14_change_freeze_records for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_change_freeze_records_org_update on public.patch14_change_freeze_records;
create policy patch14_change_freeze_records_org_update on public.patch14_change_freeze_records for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch14_board_go_no_go_pack_org_read on public.patch14_board_go_no_go_pack;
create policy patch14_board_go_no_go_pack_org_read on public.patch14_board_go_no_go_pack for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_board_go_no_go_pack_org_insert on public.patch14_board_go_no_go_pack;
create policy patch14_board_go_no_go_pack_org_insert on public.patch14_board_go_no_go_pack for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_board_go_no_go_pack_org_update on public.patch14_board_go_no_go_pack;
create policy patch14_board_go_no_go_pack_org_update on public.patch14_board_go_no_go_pack for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch14_launch_signoffs_org_read on public.patch14_launch_signoffs;
create policy patch14_launch_signoffs_org_read on public.patch14_launch_signoffs for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_launch_signoffs_org_insert on public.patch14_launch_signoffs;
create policy patch14_launch_signoffs_org_insert on public.patch14_launch_signoffs for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_launch_signoffs_org_update on public.patch14_launch_signoffs;
create policy patch14_launch_signoffs_org_update on public.patch14_launch_signoffs for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch14_launch_decisions_org_read on public.patch14_launch_decisions;
create policy patch14_launch_decisions_org_read on public.patch14_launch_decisions for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_launch_decisions_org_insert on public.patch14_launch_decisions;
create policy patch14_launch_decisions_org_insert on public.patch14_launch_decisions for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_launch_decisions_org_update on public.patch14_launch_decisions;
create policy patch14_launch_decisions_org_update on public.patch14_launch_decisions for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

drop policy if exists patch14_post_launch_monitoring_checks_org_read on public.patch14_post_launch_monitoring_checks;
create policy patch14_post_launch_monitoring_checks_org_read on public.patch14_post_launch_monitoring_checks for select to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_post_launch_monitoring_checks_org_insert on public.patch14_post_launch_monitoring_checks;
create policy patch14_post_launch_monitoring_checks_org_insert on public.patch14_post_launch_monitoring_checks for insert to authenticated with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));
drop policy if exists patch14_post_launch_monitoring_checks_org_update on public.patch14_post_launch_monitoring_checks;
create policy patch14_post_launch_monitoring_checks_org_update on public.patch14_post_launch_monitoring_checks for update to authenticated using (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')) with check (organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id'));

create or replace view public.v_patch14_production_hardening_summary
with (security_invoker = true) as
select
  coalesce(w.organization_id, v.organization_id, p.organization_id, b.organization_id, f.organization_id, g.organization_id, s.organization_id, d.organization_id, m.organization_id) as organization_id,
  count(distinct w.id) filter (where w.warning_status not in ('closed', 'accepted'))::integer as open_client_warning_count,
  count(distinct v.id) filter (where v.closure_status not in ('closed', 'accepted_risk'))::integer as open_v65_warning_count,
  count(distinct p.id) filter (where p.run_status = 'passed')::integer as passed_persona_sql_count,
  count(distinct b.id) filter (where b.proof_status = 'passed')::integer as passed_restore_proof_count,
  count(distinct f.id) filter (where f.freeze_status = 'active')::integer as active_freeze_count,
  count(distinct g.id) filter (where g.pack_status = 'approved')::integer as approved_go_no_go_pack_count,
  count(distinct s.id) filter (where s.signoff_status = 'pending')::integer as pending_launch_signoff_count,
  count(distinct d.id) filter (where d.decision_status in ('approved_go', 'approved_conditional_go'))::integer as launch_decision_count,
  count(distinct m.id) filter (where m.check_status = 'red')::integer as red_monitoring_check_count
from public.patch14_client_warning_register w
full outer join public.patch14_v65_warning_closure v on v.organization_id = w.organization_id
full outer join public.patch14_staging_persona_sql_runs p on p.organization_id = coalesce(w.organization_id, v.organization_id)
full outer join public.patch14_backup_restore_proof_runs b on b.organization_id = coalesce(w.organization_id, v.organization_id, p.organization_id)
full outer join public.patch14_change_freeze_records f on f.organization_id = coalesce(w.organization_id, v.organization_id, p.organization_id, b.organization_id)
full outer join public.patch14_board_go_no_go_pack g on g.organization_id = coalesce(w.organization_id, v.organization_id, p.organization_id, b.organization_id, f.organization_id)
full outer join public.patch14_launch_signoffs s on s.organization_id = coalesce(w.organization_id, v.organization_id, p.organization_id, b.organization_id, f.organization_id, g.organization_id)
full outer join public.patch14_launch_decisions d on d.organization_id = coalesce(w.organization_id, v.organization_id, p.organization_id, b.organization_id, f.organization_id, g.organization_id, s.organization_id)
full outer join public.patch14_post_launch_monitoring_checks m on m.organization_id = coalesce(w.organization_id, v.organization_id, p.organization_id, b.organization_id, f.organization_id, g.organization_id, s.organization_id, d.organization_id)
group by coalesce(w.organization_id, v.organization_id, p.organization_id, b.organization_id, f.organization_id, g.organization_id, s.organization_id, d.organization_id, m.organization_id);

create or replace view public.v_patch14_hardening_queue
with (security_invoker = true) as
select organization_id, 'client_warning' as queue_type, warning_code as item_code, warning_title as item_title, warning_status as item_status, severity, owner_name, due_date,
  case when severity in ('critical', 'high') and warning_status not in ('closed', 'accepted') then 'danger' when warning_status in ('open', 'investigating') then 'warning' else 'normal' end as queue_signal
from public.patch14_client_warning_register
union all
select organization_id, 'v65_warning' as queue_type, finding_code as item_code, finding_title as item_title, closure_status as item_status, finding_severity as severity, owner_name, null::date as due_date,
  case when closure_status not in ('closed', 'accepted_risk') then 'warning' else 'normal' end as queue_signal
from public.patch14_v65_warning_closure
union all
select organization_id, 'launch_signoff' as queue_type, signoff_code as item_code, signoff_area as item_title, signoff_status as item_status, 'medium' as severity, signer_name as owner_name, due_date,
  case when signoff_status = 'rejected' then 'danger' when signoff_status = 'pending' then 'warning' else 'normal' end as queue_signal
from public.patch14_launch_signoffs
union all
select organization_id, 'monitoring' as queue_type, check_code as item_code, check_title as item_title, check_status as item_status, case when check_status = 'red' then 'high' when check_status = 'amber' then 'medium' else 'low' end as severity, owner_name, null::date as due_date,
  case when check_status = 'red' then 'danger' when check_status = 'amber' then 'warning' else 'normal' end as queue_signal
from public.patch14_post_launch_monitoring_checks;

create or replace view public.v_patch14_launch_readiness_dashboard
with (security_invoker = true) as
select
  g.organization_id,
  g.pack_code,
  g.pack_title,
  g.pack_status,
  g.summary_score,
  g.launch_recommendation,
  g.board_meeting_date,
  count(distinct s.id) filter (where s.signoff_status = 'signed')::integer as signed_count,
  count(distinct s.id) filter (where s.signoff_status = 'pending')::integer as pending_count,
  count(distinct s.id) filter (where s.signoff_status = 'rejected')::integer as rejected_count,
  max(d.decision_status) as latest_decision_status,
  case
    when count(distinct s.id) filter (where s.signoff_status = 'rejected') > 0 then 'danger'
    when g.launch_recommendation in ('go', 'conditional_go') and g.pack_status = 'approved' and count(distinct s.id) filter (where s.signoff_status = 'pending') = 0 then 'ready'
    when count(distinct s.id) filter (where s.signoff_status = 'pending') > 0 then 'warning'
    else 'normal'
  end as readiness_signal
from public.patch14_board_go_no_go_pack g
left join public.patch14_launch_signoffs s on s.organization_id = g.organization_id
left join public.patch14_launch_decisions d on d.organization_id = g.organization_id
group by g.organization_id, g.pack_code, g.pack_title, g.pack_status, g.summary_score, g.launch_recommendation, g.board_meeting_date;

comment on table public.patch14_client_warning_register is 'Patch 14 final hardening register for frontend/Supabase/runtime warning cleanup, including multiple-client warnings.';
comment on table public.patch14_v65_warning_closure is 'Patch 14 closure register for v65/v700 medium warning cleanup and evidence recapture.';
comment on table public.patch14_launch_decisions is 'Patch 14 production launch decision register. Records approval state only; it does not itself make the platform production-ready.';
