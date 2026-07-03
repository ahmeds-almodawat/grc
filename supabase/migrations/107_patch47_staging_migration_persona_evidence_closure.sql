-- Patch 47: Staging Migration & Persona Security Evidence Closure
-- Captures operational evidence for migration replay, persona SQL, static DB security checks, and restore dry-run readiness.

create table if not exists public.staging_migration_evidence_runs (
  id uuid primary key default gen_random_uuid(),
  run_label text not null,
  run_status text not null default 'pending'
    check (run_status in ('pending', 'running', 'passed', 'failed', 'blocked', 'evidence_required')),
  environment_type text not null default 'local_clean'
    check (environment_type in ('local_clean', 'staging', 'production_shadow')),
  migration_count integer null,
  migrations_replayed boolean not null default false,
  persona_sql_executed boolean not null default false,
  rls_check_passed boolean not null default false,
  function_check_passed boolean not null default false,
  view_check_passed boolean not null default false,
  restore_dryrun_passed boolean not null default false,
  failure_count integer not null default 0,
  evidence_path text null,
  run_notes text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.staging_migration_evidence_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid null references public.staging_migration_evidence_runs(id) on delete set null,
  event_type text not null,
  event_summary text not null,
  evidence_path text null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_patch47_evidence_runs_status on public.staging_migration_evidence_runs(run_status, created_at desc);
create index if not exists idx_patch47_evidence_runs_environment on public.staging_migration_evidence_runs(environment_type, created_at desc);
create index if not exists idx_patch47_evidence_runs_completed on public.staging_migration_evidence_runs(completed_at desc);
create index if not exists idx_patch47_evidence_events_run on public.staging_migration_evidence_events(run_id, created_at desc);
create index if not exists idx_patch47_evidence_events_type on public.staging_migration_evidence_events(event_type, created_at desc);

alter table public.staging_migration_evidence_runs enable row level security;
alter table public.staging_migration_evidence_events enable row level security;

drop policy if exists patch47_staging_migration_evidence_runs_read on public.staging_migration_evidence_runs;
create policy patch47_staging_migration_evidence_runs_read on public.staging_migration_evidence_runs
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch47_staging_migration_evidence_runs_write on public.staging_migration_evidence_runs;
create policy patch47_staging_migration_evidence_runs_write on public.staging_migration_evidence_runs
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

drop policy if exists patch47_staging_migration_evidence_events_read on public.staging_migration_evidence_events;
create policy patch47_staging_migration_evidence_events_read on public.staging_migration_evidence_events
  for select to authenticated
  using (public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer']));

drop policy if exists patch47_staging_migration_evidence_events_write on public.staging_migration_evidence_events;
create policy patch47_staging_migration_evidence_events_write on public.staging_migration_evidence_events
  for all to authenticated
  using (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']))
  with check (public.has_any_role(array['super_admin', 'governance_admin', 'compliance_officer']));

create or replace view public.v_patch47_staging_migration_evidence_register
with (security_invoker = true)
as
select
  r.id,
  r.run_label,
  r.run_status,
  r.environment_type,
  r.migration_count,
  r.migrations_replayed,
  r.persona_sql_executed,
  r.rls_check_passed,
  r.function_check_passed,
  r.view_check_passed,
  r.restore_dryrun_passed,
  r.failure_count,
  r.evidence_path,
  r.run_notes,
  r.started_at,
  r.completed_at,
  r.created_by,
  r.created_at,
  case
    when r.run_status = 'passed'
      and r.migrations_replayed
      and r.persona_sql_executed
      and r.rls_check_passed
      and r.function_check_passed
      and r.view_check_passed
      and r.restore_dryrun_passed
      and r.failure_count = 0 then 'ready'
    when r.run_status in ('failed', 'blocked') or r.failure_count > 0 then 'blocked'
    else 'evidence_required'
  end as staging_evidence_readiness_status
from public.staging_migration_evidence_runs r;

create or replace view public.v_patch47_latest_staging_migration_evidence
with (security_invoker = true)
as
select *
from public.v_patch47_staging_migration_evidence_register
order by coalesce(completed_at, created_at) desc
limit 1;

create or replace view public.v_patch47_staging_persona_sql_evidence
with (security_invoker = true)
as
select
  id,
  run_label,
  environment_type,
  run_status,
  persona_sql_executed,
  evidence_path,
  run_notes,
  completed_at,
  case
    when persona_sql_executed and run_status = 'passed' then 'ready'
    when run_status in ('failed', 'blocked') then 'blocked'
    else 'evidence_required'
  end as persona_sql_status
from public.staging_migration_evidence_runs;

create or replace view public.v_patch47_staging_security_blockers
with (security_invoker = true)
as
select
  id,
  run_label,
  environment_type,
  run_status,
  failure_count,
  evidence_path,
  run_notes,
  created_at,
  case
    when not migrations_replayed then 'migration replay evidence required'
    when not persona_sql_executed then 'persona SQL execution evidence required'
    when not rls_check_passed then 'RLS strict proof evidence required'
    when not function_check_passed then 'function grant proof evidence required'
    when not view_check_passed then 'view security proof evidence required'
    when not restore_dryrun_passed then 'restore dry-run evidence required'
    when failure_count > 0 then 'staging evidence run contains failures'
    when run_status in ('failed', 'blocked') then 'staging evidence run blocked or failed'
    else null
  end as blocker_reason
from public.staging_migration_evidence_runs
where run_status <> 'passed'
  or failure_count > 0
  or not migrations_replayed
  or not persona_sql_executed
  or not rls_check_passed
  or not function_check_passed
  or not view_check_passed
  or not restore_dryrun_passed;

create or replace view public.v_patch47_staging_evidence_summary
with (security_invoker = true)
as
with latest as (
  select * from public.v_patch47_latest_staging_migration_evidence
),
counts as (
  select
    count(*)::integer as evidence_run_count,
    count(*) filter (where run_status = 'passed')::integer as passed_run_count,
    count(*) filter (where run_status in ('failed', 'blocked'))::integer as blocked_run_count,
    count(*) filter (where run_status in ('pending', 'running', 'evidence_required'))::integer as evidence_required_run_count
  from public.staging_migration_evidence_runs
)
select
  c.evidence_run_count,
  c.passed_run_count,
  c.blocked_run_count,
  c.evidence_required_run_count,
  l.id as latest_run_id,
  l.run_label as latest_run_label,
  coalesce(l.environment_type, 'local_clean') as latest_environment_type,
  coalesce(l.run_status, 'evidence_required') as latest_run_status,
  coalesce(l.migration_count, 0) as latest_migration_count,
  coalesce(l.migrations_replayed, false) as migrations_replayed,
  coalesce(l.persona_sql_executed, false) as persona_sql_executed,
  coalesce(l.rls_check_passed, false) as rls_check_passed,
  coalesce(l.function_check_passed, false) as function_check_passed,
  coalesce(l.view_check_passed, false) as view_check_passed,
  coalesce(l.restore_dryrun_passed, false) as restore_dryrun_passed,
  coalesce(l.failure_count, 0) as failure_count,
  l.evidence_path,
  l.run_notes,
  l.completed_at,
  case
    when l.staging_evidence_readiness_status = 'ready' then 'ready'
    when coalesce(l.run_status, 'evidence_required') in ('failed', 'blocked') or coalesce(l.failure_count, 0) > 0 then 'blocked'
    else 'evidence_required'
  end as staging_evidence_readiness_status
from counts c
left join latest l on true;

create or replace view public.v_patch47_production_readiness_staging_overlay
with (security_invoker = true)
as
select
  *,
  case
    when staging_evidence_readiness_status = 'ready' then 'Staging migration replay and persona SQL evidence are complete.'
    when staging_evidence_readiness_status = 'blocked' then 'Resolve failed or blocked staging evidence run before production readiness signoff.'
    else 'Run local-clean or staging migration/persona SQL evidence capture before production readiness signoff.'
  end as next_action_required
from public.v_patch47_staging_evidence_summary;

alter view if exists public.v_patch47_staging_migration_evidence_register set (security_invoker = true);
alter view if exists public.v_patch47_latest_staging_migration_evidence set (security_invoker = true);
alter view if exists public.v_patch47_staging_persona_sql_evidence set (security_invoker = true);
alter view if exists public.v_patch47_staging_security_blockers set (security_invoker = true);
alter view if exists public.v_patch47_staging_evidence_summary set (security_invoker = true);
alter view if exists public.v_patch47_production_readiness_staging_overlay set (security_invoker = true);

grant select on public.v_patch47_staging_migration_evidence_register to authenticated;
grant select on public.v_patch47_latest_staging_migration_evidence to authenticated;
grant select on public.v_patch47_staging_persona_sql_evidence to authenticated;
grant select on public.v_patch47_staging_security_blockers to authenticated;
grant select on public.v_patch47_staging_evidence_summary to authenticated;
grant select on public.v_patch47_production_readiness_staging_overlay to authenticated;

create or replace function public.patch47_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 47 staging evidence mutations require the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.record_staging_migration_evidence_event(
  p_run_id uuid,
  p_event_type text,
  p_event_summary text,
  p_evidence_path text default null,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch47_service_role_required();

  insert into public.staging_migration_evidence_events(run_id, event_type, event_summary, evidence_path, actor_user_id)
  values (p_run_id, p_event_type, p_event_summary, p_evidence_path, p_actor_user_id)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_staging_migration_evidence_run(
  p_run_label text,
  p_environment_type text default 'local_clean',
  p_evidence_path text default null,
  p_run_notes text default null,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.patch47_service_role_required();

  if nullif(p_run_label, '') is null then
    raise exception 'Run label is required for staging migration evidence run.';
  end if;

  if p_environment_type not in ('local_clean', 'staging', 'production_shadow') then
    raise exception 'Invalid staging evidence environment type: %', p_environment_type;
  end if;

  insert into public.staging_migration_evidence_runs(
    run_label,
    run_status,
    environment_type,
    evidence_path,
    run_notes,
    started_at,
    created_by
  )
  values (
    p_run_label,
    'pending',
    p_environment_type,
    p_evidence_path,
    p_run_notes,
    now(),
    p_actor_user_id
  )
  returning id into v_id;

  perform public.record_staging_migration_evidence_event(
    v_id,
    'run_created',
    'Staging migration/persona evidence run created and awaiting proof execution.',
    p_evidence_path,
    p_actor_user_id
  );

  return v_id;
end;
$$;

create or replace function public.update_staging_migration_evidence_run_status(
  p_run_id uuid,
  p_run_status text,
  p_migration_count integer default null,
  p_migrations_replayed boolean default false,
  p_persona_sql_executed boolean default false,
  p_rls_check_passed boolean default false,
  p_function_check_passed boolean default false,
  p_view_check_passed boolean default false,
  p_restore_dryrun_passed boolean default false,
  p_failure_count integer default 0,
  p_evidence_path text default null,
  p_run_notes text default null,
  p_actor_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.patch47_service_role_required();

  if p_run_status not in ('pending', 'running', 'passed', 'failed', 'blocked', 'evidence_required') then
    raise exception 'Invalid staging evidence run status: %', p_run_status;
  end if;

  if p_run_status = 'passed'
     and not (
       coalesce(p_migrations_replayed, false)
       and coalesce(p_persona_sql_executed, false)
       and coalesce(p_rls_check_passed, false)
       and coalesce(p_function_check_passed, false)
       and coalesce(p_view_check_passed, false)
       and coalesce(p_restore_dryrun_passed, false)
       and coalesce(p_failure_count, 0) = 0
       and nullif(coalesce(p_evidence_path, ''), '') is not null
     ) then
    raise exception 'Passed staging evidence requires migration replay, persona SQL, security checks, restore dry-run, zero failures, and evidence path.';
  end if;

  update public.staging_migration_evidence_runs
  set
    run_status = p_run_status,
    migration_count = p_migration_count,
    migrations_replayed = coalesce(p_migrations_replayed, false),
    persona_sql_executed = coalesce(p_persona_sql_executed, false),
    rls_check_passed = coalesce(p_rls_check_passed, false),
    function_check_passed = coalesce(p_function_check_passed, false),
    view_check_passed = coalesce(p_view_check_passed, false),
    restore_dryrun_passed = coalesce(p_restore_dryrun_passed, false),
    failure_count = coalesce(p_failure_count, 0),
    evidence_path = coalesce(p_evidence_path, evidence_path),
    run_notes = coalesce(p_run_notes, run_notes),
    completed_at = case when p_run_status in ('passed', 'failed', 'blocked', 'evidence_required') then now() else completed_at end
  where id = p_run_id;

  if not found then
    raise exception 'Staging migration evidence run not found: %', p_run_id;
  end if;

  perform public.record_staging_migration_evidence_event(
    p_run_id,
    'run_status_updated',
    'Staging migration/persona evidence run status updated to ' || p_run_status,
    p_evidence_path,
    p_actor_user_id
  );

  return p_run_id;
end;
$$;

create or replace function public.get_staging_evidence_summary()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce((select to_jsonb(v) from public.v_patch47_staging_evidence_summary v limit 1), '{}'::jsonb);
$$;

create or replace function public.get_production_readiness_staging_overlay()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce((select to_jsonb(v) from public.v_patch47_production_readiness_staging_overlay v limit 1), '{}'::jsonb);
$$;

revoke all on function public.patch47_service_role_required() from public, anon, authenticated;
revoke all on function public.record_staging_migration_evidence_event(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.create_staging_migration_evidence_run(text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.update_staging_migration_evidence_run_status(uuid, text, integer, boolean, boolean, boolean, boolean, boolean, boolean, integer, text, text, uuid) from public, anon, authenticated;

grant execute on function public.patch47_service_role_required() to service_role;
grant execute on function public.record_staging_migration_evidence_event(uuid, text, text, text, uuid) to service_role;
grant execute on function public.create_staging_migration_evidence_run(text, text, text, text, uuid) to service_role;
grant execute on function public.update_staging_migration_evidence_run_status(uuid, text, integer, boolean, boolean, boolean, boolean, boolean, boolean, integer, text, text, uuid) to service_role;
grant execute on function public.get_staging_evidence_summary() to authenticated;
grant execute on function public.get_production_readiness_staging_overlay() to authenticated;

comment on table public.staging_migration_evidence_runs is 'Patch 47 operational evidence for local-clean/staging migration replay, persona SQL, security proof, and restore dry-run closure.';
comment on table public.staging_migration_evidence_events is 'Patch 47 event ledger for staging migration and persona security evidence runs.';
