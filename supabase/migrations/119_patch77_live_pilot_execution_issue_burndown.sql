-- Patch 77: Live Pilot Execution and Issue Burn-Down
-- Adds controlled pilot sessions, pilot issues, retest evidence, and department acceptance.
-- Pilot readiness does not approve production launch.

create table if not exists public.live_pilot_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null default public.current_user_org_id(),
  session_title text not null,
  session_scope text not null default 'controlled_pilot',
  department_id uuid null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  session_status text not null default 'planned' check (
    session_status in ('planned', 'active', 'issue_burndown', 'exit_review_required', 'accepted', 'blocked', 'deferred')
  ),
  started_at timestamptz null,
  completed_at timestamptz null,
  participant_count integer not null default 0 check (participant_count >= 0),
  completed_participant_count integer not null default 0 check (completed_participant_count >= 0),
  critical_issue_count integer not null default 0 check (critical_issue_count >= 0),
  open_issue_count integer not null default 0 check (open_issue_count >= 0),
  retest_required_count integer not null default 0 check (retest_required_count >= 0),
  acceptance_required boolean not null default true,
  exit_criteria_met boolean not null default false,
  exit_review_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch77_session_title_required check (nullif(btrim(session_title), '') is not null),
  constraint patch77_session_acceptance_guard check (
    session_status <> 'accepted'
    or (
      critical_issue_count = 0
      and open_issue_count = 0
      and retest_required_count = 0
      and exit_criteria_met = true
    )
  )
);

create table if not exists public.live_pilot_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null default public.current_user_org_id(),
  pilot_session_id uuid not null references public.live_pilot_sessions(id) on delete cascade,
  issue_title text not null,
  issue_description text null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  issue_status text not null default 'open' check (
    issue_status in ('open', 'in_progress', 'retest_required', 'closed', 'deferred', 'accepted_limitation')
  ),
  owner_id uuid null references auth.users(id) on delete set null,
  department_id uuid null,
  due_date date null,
  retest_required boolean not null default true,
  retest_status text not null default 'not_started' check (retest_status in ('not_started', 'pending', 'passed', 'failed', 'not_required')),
  retest_evidence_summary text null,
  closure_summary text null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch77_issue_title_required check (nullif(btrim(issue_title), '') is not null),
  constraint patch77_retest_closure_guard check (
    issue_status <> 'closed'
    or retest_required = false
    or retest_status in ('passed', 'not_required')
  )
);

create table if not exists public.live_pilot_department_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null default public.current_user_org_id(),
  pilot_session_id uuid not null references public.live_pilot_sessions(id) on delete cascade,
  department_id uuid not null,
  acceptance_status text not null default 'pending' check (
    acceptance_status in ('pending', 'accepted', 'accepted_with_limitations', 'blocked', 'deferred')
  ),
  accepted_by uuid null references auth.users(id) on delete set null,
  accepted_at timestamptz null,
  acceptance_notes text null,
  open_blockers_count integer not null default 0 check (open_blockers_count >= 0),
  training_confirmed boolean not null default false,
  issue_burndown_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patch77_department_acceptance_guard check (
    acceptance_status <> 'accepted'
    or (
      open_blockers_count = 0
      and training_confirmed = true
      and issue_burndown_confirmed = true
    )
  )
);

create index if not exists idx_patch77_sessions_org on public.live_pilot_sessions(organization_id, created_at desc);
create index if not exists idx_patch77_sessions_status on public.live_pilot_sessions(session_status, created_at desc);
create index if not exists idx_patch77_issues_session on public.live_pilot_issues(pilot_session_id, created_at desc);
create index if not exists idx_patch77_issues_status on public.live_pilot_issues(issue_status, severity);
create index if not exists idx_patch77_acceptances_session on public.live_pilot_department_acceptances(pilot_session_id, created_at desc);
create index if not exists idx_patch77_acceptances_status on public.live_pilot_department_acceptances(acceptance_status);

alter table public.live_pilot_sessions enable row level security;
alter table public.live_pilot_issues enable row level security;
alter table public.live_pilot_department_acceptances enable row level security;

drop policy if exists patch77_live_pilot_sessions_read on public.live_pilot_sessions;
create policy patch77_live_pilot_sessions_read on public.live_pilot_sessions
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer', 'department_manager']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

drop policy if exists patch77_live_pilot_issues_read on public.live_pilot_issues;
create policy patch77_live_pilot_issues_read on public.live_pilot_issues
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer', 'department_manager']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

drop policy if exists patch77_live_pilot_acceptances_read on public.live_pilot_department_acceptances;
create policy patch77_live_pilot_acceptances_read on public.live_pilot_department_acceptances
  for select to authenticated
  using (
    public.has_any_role(array['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer', 'department_manager']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

drop policy if exists patch77_live_pilot_sessions_no_direct_insert on public.live_pilot_sessions;
create policy patch77_live_pilot_sessions_no_direct_insert on public.live_pilot_sessions for insert to authenticated with check (false);
drop policy if exists patch77_live_pilot_sessions_no_direct_update on public.live_pilot_sessions;
create policy patch77_live_pilot_sessions_no_direct_update on public.live_pilot_sessions for update to authenticated using (false) with check (false);
drop policy if exists patch77_live_pilot_sessions_no_direct_delete on public.live_pilot_sessions;
create policy patch77_live_pilot_sessions_no_direct_delete on public.live_pilot_sessions for delete to authenticated using (false);

drop policy if exists patch77_live_pilot_issues_no_direct_insert on public.live_pilot_issues;
create policy patch77_live_pilot_issues_no_direct_insert on public.live_pilot_issues for insert to authenticated with check (false);
drop policy if exists patch77_live_pilot_issues_no_direct_update on public.live_pilot_issues;
create policy patch77_live_pilot_issues_no_direct_update on public.live_pilot_issues for update to authenticated using (false) with check (false);
drop policy if exists patch77_live_pilot_issues_no_direct_delete on public.live_pilot_issues;
create policy patch77_live_pilot_issues_no_direct_delete on public.live_pilot_issues for delete to authenticated using (false);

drop policy if exists patch77_live_pilot_acceptances_no_direct_insert on public.live_pilot_department_acceptances;
create policy patch77_live_pilot_acceptances_no_direct_insert on public.live_pilot_department_acceptances for insert to authenticated with check (false);
drop policy if exists patch77_live_pilot_acceptances_no_direct_update on public.live_pilot_department_acceptances;
create policy patch77_live_pilot_acceptances_no_direct_update on public.live_pilot_department_acceptances for update to authenticated using (false) with check (false);
drop policy if exists patch77_live_pilot_acceptances_no_direct_delete on public.live_pilot_department_acceptances;
create policy patch77_live_pilot_acceptances_no_direct_delete on public.live_pilot_department_acceptances for delete to authenticated using (false);

create or replace function public.patch77_service_role_required()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Patch 77 live pilot execution requires the authenticated service-role bridge.';
  end if;
end;
$$;

create or replace function public.patch77_actor_authorized(p_actor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_authorized boolean;
begin
  select p.organization_id into v_org_id
  from public.profiles p
  where p.id = p_actor_id
    and coalesce(p.is_active, true) = true;

  if v_org_id is null then
    raise exception 'An active actor profile and organization are required.';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and coalesce(ur.is_active, true) = true
      and (ur.organization_id is null or ur.organization_id = v_org_id)
      and ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer', 'department_manager')
  ) into v_authorized;

  if not coalesce(v_authorized, false) then
    raise exception 'Live pilot execution requires an authorized governance, executive, audit, compliance, or department role.';
  end if;

  return v_org_id;
end;
$$;

create or replace function public.patch77_refresh_session_counts(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_pilot_sessions s
  set
    critical_issue_count = (
      select count(*)::integer from public.live_pilot_issues i
      where i.pilot_session_id = p_session_id
        and i.severity = 'critical'
        and i.issue_status not in ('closed', 'deferred', 'accepted_limitation')
    ),
    open_issue_count = (
      select count(*)::integer from public.live_pilot_issues i
      where i.pilot_session_id = p_session_id
        and i.issue_status in ('open', 'in_progress', 'retest_required')
    ),
    retest_required_count = (
      select count(*)::integer from public.live_pilot_issues i
      where i.pilot_session_id = p_session_id
        and i.retest_required = true
        and i.issue_status <> 'closed'
        and i.retest_status not in ('passed', 'not_required')
    ),
    updated_at = now()
  where s.id = p_session_id;
end;
$$;

create or replace function public.create_live_pilot_session(
  p_actor_id uuid,
  p_session_title text,
  p_department_id uuid default null,
  p_participant_count integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_session_id uuid;
begin
  perform public.patch77_service_role_required();
  v_org_id := public.patch77_actor_authorized(p_actor_id);

  if nullif(btrim(coalesce(p_session_title, '')), '') is null then
    raise exception 'Pilot session title is required.';
  end if;

  insert into public.live_pilot_sessions (
    organization_id,
    session_title,
    department_id,
    owner_id,
    participant_count
  ) values (
    v_org_id,
    btrim(p_session_title),
    p_department_id,
    p_actor_id,
    greatest(coalesce(p_participant_count, 0), 0)
  ) returning id into v_session_id;

  return jsonb_build_object('id', v_session_id, 'message', 'Live pilot session recorded.');
end;
$$;

create or replace function public.update_live_pilot_session_status(
  p_actor_id uuid,
  p_session_id uuid,
  p_session_status text,
  p_exit_review_notes text default null,
  p_exit_criteria_met boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_session_org_id uuid;
  v_critical integer;
  v_open integer;
  v_retest integer;
begin
  perform public.patch77_service_role_required();
  v_org_id := public.patch77_actor_authorized(p_actor_id);

  select organization_id into v_session_org_id
  from public.live_pilot_sessions
  where id = p_session_id;

  if v_session_org_id is null or v_session_org_id <> v_org_id then
    raise exception 'Pilot session is not available for this organization.';
  end if;

  if p_session_status not in ('planned', 'active', 'issue_burndown', 'exit_review_required', 'accepted', 'blocked', 'deferred') then
    raise exception 'Unsupported pilot session status.';
  end if;

  perform public.patch77_refresh_session_counts(p_session_id);
  select critical_issue_count, open_issue_count, retest_required_count
    into v_critical, v_open, v_retest
  from public.live_pilot_sessions
  where id = p_session_id;

  if p_session_status = 'accepted' then
    if coalesce(v_critical, 0) > 0 or coalesce(v_open, 0) > 0 then
      raise exception 'Pilot blockers remain.';
    end if;
    if coalesce(v_retest, 0) > 0 then
      raise exception 'Retest evidence required.';
    end if;
    if coalesce(p_exit_criteria_met, false) is not true then
      raise exception 'Pilot exit criteria must be met before acceptance.';
    end if;
  end if;

  update public.live_pilot_sessions
  set
    session_status = p_session_status,
    started_at = case when p_session_status in ('active', 'issue_burndown') and started_at is null then now() else started_at end,
    completed_at = case when p_session_status = 'accepted' then now() else completed_at end,
    exit_review_notes = nullif(btrim(coalesce(p_exit_review_notes, '')), ''),
    exit_criteria_met = coalesce(p_exit_criteria_met, false),
    updated_at = now()
  where id = p_session_id;

  return jsonb_build_object('id', p_session_id, 'session_status', p_session_status, 'message', 'Live pilot session status updated.');
end;
$$;

create or replace function public.create_live_pilot_issue(
  p_actor_id uuid,
  p_pilot_session_id uuid,
  p_issue_title text,
  p_issue_description text default null,
  p_severity text default 'medium',
  p_owner_id uuid default null,
  p_department_id uuid default null,
  p_due_date date default null,
  p_retest_required boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_session_org_id uuid;
  v_issue_id uuid;
begin
  perform public.patch77_service_role_required();
  v_org_id := public.patch77_actor_authorized(p_actor_id);

  select organization_id into v_session_org_id
  from public.live_pilot_sessions
  where id = p_pilot_session_id;

  if v_session_org_id is null or v_session_org_id <> v_org_id then
    raise exception 'Pilot session is not available for this organization.';
  end if;

  if nullif(btrim(coalesce(p_issue_title, '')), '') is null then
    raise exception 'Pilot issue title is required.';
  end if;

  if p_severity not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Unsupported pilot issue severity.';
  end if;

  insert into public.live_pilot_issues (
    organization_id,
    pilot_session_id,
    issue_title,
    issue_description,
    severity,
    owner_id,
    department_id,
    due_date,
    retest_required,
    created_by
  ) values (
    v_org_id,
    p_pilot_session_id,
    btrim(p_issue_title),
    nullif(btrim(coalesce(p_issue_description, '')), ''),
    p_severity,
    p_owner_id,
    p_department_id,
    p_due_date,
    coalesce(p_retest_required, true),
    p_actor_id
  ) returning id into v_issue_id;

  perform public.patch77_refresh_session_counts(p_pilot_session_id);
  update public.live_pilot_sessions set session_status = 'issue_burndown' where id = p_pilot_session_id and session_status in ('planned', 'active', 'exit_review_required');

  return jsonb_build_object('id', v_issue_id, 'message', 'Pilot issue recorded. Retest evidence required where applicable.');
end;
$$;

create or replace function public.update_live_pilot_issue_status(
  p_actor_id uuid,
  p_issue_id uuid,
  p_issue_status text,
  p_retest_status text default null,
  p_retest_evidence_summary text default null,
  p_closure_summary text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_issue_org_id uuid;
  v_session_id uuid;
  v_retest_required boolean;
  v_retest_status text;
begin
  perform public.patch77_service_role_required();
  v_org_id := public.patch77_actor_authorized(p_actor_id);

  select organization_id, pilot_session_id, retest_required
    into v_issue_org_id, v_session_id, v_retest_required
  from public.live_pilot_issues
  where id = p_issue_id;

  if v_issue_org_id is null or v_issue_org_id <> v_org_id then
    raise exception 'Pilot issue is not available for this organization.';
  end if;

  if p_issue_status not in ('open', 'in_progress', 'retest_required', 'closed', 'deferred', 'accepted_limitation') then
    raise exception 'Unsupported pilot issue status.';
  end if;

  v_retest_status := coalesce(p_retest_status, 'not_started');
  if v_retest_status not in ('not_started', 'pending', 'passed', 'failed', 'not_required') then
    raise exception 'Unsupported retest status.';
  end if;

  if p_issue_status = 'closed' and coalesce(v_retest_required, true) = true and v_retest_status not in ('passed', 'not_required') then
    raise exception 'Retest evidence required.';
  end if;

  update public.live_pilot_issues
  set
    issue_status = p_issue_status,
    retest_status = v_retest_status,
    retest_evidence_summary = nullif(btrim(coalesce(p_retest_evidence_summary, '')), ''),
    closure_summary = nullif(btrim(coalesce(p_closure_summary, '')), ''),
    updated_at = now()
  where id = p_issue_id;

  perform public.patch77_refresh_session_counts(v_session_id);

  return jsonb_build_object('id', p_issue_id, 'issue_status', p_issue_status, 'message', 'Pilot issue status updated.');
end;
$$;

create or replace function public.record_live_pilot_department_acceptance(
  p_actor_id uuid,
  p_pilot_session_id uuid,
  p_department_id uuid,
  p_acceptance_status text,
  p_acceptance_notes text default null,
  p_open_blockers_count integer default 0,
  p_training_confirmed boolean default false,
  p_issue_burndown_confirmed boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_session_org_id uuid;
  v_acceptance_id uuid;
begin
  perform public.patch77_service_role_required();
  v_org_id := public.patch77_actor_authorized(p_actor_id);

  select organization_id into v_session_org_id
  from public.live_pilot_sessions
  where id = p_pilot_session_id;

  if v_session_org_id is null or v_session_org_id <> v_org_id then
    raise exception 'Pilot session is not available for this organization.';
  end if;

  if p_acceptance_status not in ('pending', 'accepted', 'accepted_with_limitations', 'blocked', 'deferred') then
    raise exception 'Unsupported department pilot acceptance status.';
  end if;

  if p_acceptance_status = 'accepted' then
    if coalesce(p_open_blockers_count, 0) > 0 then
      raise exception 'Pilot blockers remain.';
    end if;
    if coalesce(p_training_confirmed, false) is not true or coalesce(p_issue_burndown_confirmed, false) is not true then
      raise exception 'Department pilot acceptance requires training and issue burn-down confirmation.';
    end if;
  end if;

  insert into public.live_pilot_department_acceptances (
    organization_id,
    pilot_session_id,
    department_id,
    acceptance_status,
    accepted_by,
    accepted_at,
    acceptance_notes,
    open_blockers_count,
    training_confirmed,
    issue_burndown_confirmed
  ) values (
    v_org_id,
    p_pilot_session_id,
    p_department_id,
    p_acceptance_status,
    case when p_acceptance_status in ('accepted', 'accepted_with_limitations') then p_actor_id else null end,
    case when p_acceptance_status in ('accepted', 'accepted_with_limitations') then now() else null end,
    nullif(btrim(coalesce(p_acceptance_notes, '')), ''),
    greatest(coalesce(p_open_blockers_count, 0), 0),
    coalesce(p_training_confirmed, false),
    coalesce(p_issue_burndown_confirmed, false)
  ) returning id into v_acceptance_id;

  return jsonb_build_object('id', v_acceptance_id, 'acceptance_status', p_acceptance_status, 'message', 'Department pilot acceptance recorded.');
end;
$$;

create or replace function public.get_live_pilot_sessions()
returns setof public.live_pilot_sessions
language sql
security invoker
set search_path = public
as $$
  select * from public.live_pilot_sessions order by created_at desc limit 100;
$$;

create or replace function public.get_live_pilot_issues()
returns setof public.live_pilot_issues
language sql
security invoker
set search_path = public
as $$
  select * from public.live_pilot_issues order by created_at desc limit 200;
$$;

create or replace function public.get_live_pilot_department_acceptances()
returns setof public.live_pilot_department_acceptances
language sql
security invoker
set search_path = public
as $$
  select * from public.live_pilot_department_acceptances order by created_at desc limit 200;
$$;

revoke all on function public.patch77_service_role_required() from public, anon, authenticated;
revoke all on function public.patch77_actor_authorized(uuid) from public, anon, authenticated;
revoke all on function public.patch77_refresh_session_counts(uuid) from public, anon, authenticated;
revoke all on function public.create_live_pilot_session(uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.update_live_pilot_session_status(uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.create_live_pilot_issue(uuid, uuid, text, text, text, uuid, uuid, date, boolean) from public, anon, authenticated;
revoke all on function public.update_live_pilot_issue_status(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_live_pilot_department_acceptance(uuid, uuid, uuid, text, text, integer, boolean, boolean) from public, anon, authenticated;

grant execute on function public.patch77_service_role_required() to service_role;
grant execute on function public.patch77_actor_authorized(uuid) to service_role;
grant execute on function public.patch77_refresh_session_counts(uuid) to service_role;
grant execute on function public.create_live_pilot_session(uuid, text, uuid, integer) to service_role;
grant execute on function public.update_live_pilot_session_status(uuid, uuid, text, text, boolean) to service_role;
grant execute on function public.create_live_pilot_issue(uuid, uuid, text, text, text, uuid, uuid, date, boolean) to service_role;
grant execute on function public.update_live_pilot_issue_status(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.record_live_pilot_department_acceptance(uuid, uuid, uuid, text, text, integer, boolean, boolean) to service_role;

comment on table public.live_pilot_sessions is 'Patch 77 live pilot execution sessions. Pilot readiness does not approve production launch.';
comment on table public.live_pilot_issues is 'Patch 77 live pilot issue burn-down and retest evidence register.';
comment on table public.live_pilot_department_acceptances is 'Patch 77 department pilot acceptance register with training and issue burn-down guardrails.';
