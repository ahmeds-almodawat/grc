-- GRC v1.1 OVR Phase 2 P3-R2
-- Privacy-safe Executive analytics with a fixed query family and immutable
-- daily snapshots. No browser role receives access to the aggregate RPC,
-- private facts, snapshot rows, request history, or analytics audit rows.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create unique index if not exists uq_runtime_workflow_sla_calendars_org_id
  on public.runtime_workflow_sla_calendars (organization_id, id);

create table if not exists public.organization_ovr_analytics_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  timezone_name text not null check (length(btrim(timezone_name)) between 1 and 100),
  sla_calendar_id uuid not null,
  minimum_cell_size integer not null default 5 check (minimum_cell_size between 5 and 1000),
  kpi_definition_version text not null default 'ovr-kpi-v2' check (
    kpi_definition_version = 'ovr-kpi-v2'
  ),
  effective_from timestamptz not null default statement_timestamp(),
  effective_until timestamptz,
  is_active boolean not null default false,
  configured_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint organization_ovr_analytics_config_calendar_org_fkey
    foreign key (organization_id, sla_calendar_id)
    references public.runtime_workflow_sla_calendars(organization_id, id)
    on delete restrict,
  constraint organization_ovr_analytics_config_actor_org_fkey
    foreign key (organization_id, configured_by)
    references public.profiles(organization_id, id)
    on delete restrict,
  constraint organization_ovr_analytics_config_effective_range check (
    effective_until is null or effective_until > effective_from
  )
);

create unique index if not exists uq_organization_ovr_analytics_config_active
  on public.organization_ovr_analytics_config (organization_id)
  where is_active;
create index if not exists idx_organization_ovr_analytics_config_effective
  on public.organization_ovr_analytics_config (
    organization_id, is_active, effective_from, effective_until
  );

-- Only privacy-safe, banded responses are persisted. Exact source counts and
-- raw fact rows never enter this table or its audit trail.
create table if not exists public.ovr_executive_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  snapshot_date date not null,
  generated_at timestamptz not null,
  timezone_name text not null,
  definition_version text not null,
  privacy_model text not null check (privacy_model = 'deterministic-bands-daily-v1'),
  minimum_cell_size integer not null check (minimum_cell_size >= 5),
  headline_response jsonb not null check (jsonb_typeof(headline_response) = 'object'),
  monthly_trend_response jsonb not null check (jsonb_typeof(monthly_trend_response) = 'object'),
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ovr_executive_analytics_snapshots_actor_org_fkey
    foreign key (organization_id, created_by)
    references public.profiles(organization_id, id)
    on delete restrict,
  constraint ovr_executive_analytics_snapshots_one_per_day
    unique (organization_id, snapshot_date, definition_version)
);

create index if not exists idx_ovr_executive_analytics_snapshots_latest
  on public.ovr_executive_analytics_snapshots (
    organization_id, definition_version, snapshot_date desc
  );

create table if not exists public.ovr_executive_analytics_requests (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (
    length(idempotency_key) between 1 and 128
    and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
  ),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null,
  snapshot_id uuid not null references public.ovr_executive_analytics_snapshots(id) on delete restrict,
  query_shape text not null check (query_shape in (
    'headline_current_period', 'monthly_trend_12'
  )),
  period_start timestamptz not null,
  period_end timestamptz not null,
  definition_version text not null,
  semantic_digest text not null check (semantic_digest ~ '^[0-9a-f]{64}$'),
  canonical_response jsonb not null check (jsonb_typeof(canonical_response) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  constraint ovr_executive_analytics_requests_actor_org_fkey
    foreign key (organization_id, actor_id)
    references public.profiles(organization_id, id)
    on delete restrict,
  constraint ovr_executive_analytics_requests_period check (period_end > period_start)
);

create index if not exists idx_ovr_executive_analytics_requests_actor
  on public.ovr_executive_analytics_requests (organization_id, actor_id, created_at desc);

create table if not exists public.ovr_executive_analytics_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ovr_executive_analytics_requests(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null,
  snapshot_id uuid not null references public.ovr_executive_analytics_snapshots(id) on delete restrict,
  query_shape text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  permitted_filters jsonb not null default '{}'::jsonb check (
    permitted_filters = '{}'::jsonb
  ),
  definition_version text not null,
  generated_at timestamptz not null,
  suppression_applied boolean not null,
  suppression_metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(suppression_metadata) = 'object'
  ),
  request_semantic_digest text not null check (request_semantic_digest ~ '^[0-9a-f]{64}$'),
  idempotency_key_digest text not null check (idempotency_key_digest ~ '^[0-9a-f]{64}$'),
  replayed boolean not null,
  accessed_at timestamptz not null default statement_timestamp(),
  constraint ovr_executive_analytics_audit_actor_org_fkey
    foreign key (organization_id, actor_id)
    references public.profiles(organization_id, id)
    on delete restrict
);

create index if not exists idx_ovr_executive_analytics_audit_actor
  on public.ovr_executive_analytics_audit (organization_id, actor_id, accessed_at desc);
create index if not exists idx_ovr_executive_analytics_audit_shape
  on public.ovr_executive_analytics_audit (organization_id, query_shape, accessed_at desc);

-- Composite and partial indexes match the fixed canonical projection. The
-- dashboard never repeats this projection; the controlled daily snapshot does.
create index if not exists idx_ovr_reports_analytics_org_status
  on public.ovr_reports (organization_id, status, id);
create index if not exists idx_ovr_reports_analytics_repeat
  on public.ovr_reports (
    organization_id, lower(btrim(occurrence_category)), department_id, occurrence_date, id
  ) where status not in ('rejected', 'cancelled');
create index if not exists idx_audit_logs_ovr_first_submitted_v2
  on public.audit_logs (organization_id, record_id, created_at)
  where table_name = 'ovr_reports'
    and (new_data ->> 'status') = 'submitted'
    and coalesce(old_data ->> 'status', '') <> 'submitted';
create index if not exists idx_ovr_stage_instances_analytics_current
  on public.ovr_stage_instances (
    organization_id, ovr_report_id, review_cycle_id, lifecycle_status
  ) include (due_at);
create index if not exists idx_ovr_review_cycles_analytics_active
  on public.ovr_review_cycles (organization_id, status, ovr_report_id, id);

alter table public.organization_ovr_analytics_config enable row level security;
alter table public.organization_ovr_analytics_config force row level security;
alter table public.ovr_executive_analytics_snapshots enable row level security;
alter table public.ovr_executive_analytics_snapshots force row level security;
alter table public.ovr_executive_analytics_requests enable row level security;
alter table public.ovr_executive_analytics_requests force row level security;
alter table public.ovr_executive_analytics_audit enable row level security;
alter table public.ovr_executive_analytics_audit force row level security;

revoke all on table public.organization_ovr_analytics_config
  from public, anon, authenticated, service_role;
revoke all on table public.ovr_executive_analytics_snapshots
  from public, anon, authenticated, service_role;
revoke all on table public.ovr_executive_analytics_requests
  from public, anon, authenticated, service_role;
revoke all on table public.ovr_executive_analytics_audit
  from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.guard_analytics_history_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_HISTORY_IMMUTABLE';
end;
$$;

revoke all on function ovr_v11_private.guard_analytics_history_immutable()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_executive_analytics_snapshots_immutable
  on public.ovr_executive_analytics_snapshots;
create trigger trg_ovr_executive_analytics_snapshots_immutable
before update or delete on public.ovr_executive_analytics_snapshots
for each statement execute function ovr_v11_private.guard_analytics_history_immutable();

drop trigger if exists trg_ovr_executive_analytics_requests_immutable
  on public.ovr_executive_analytics_requests;
create trigger trg_ovr_executive_analytics_requests_immutable
before update or delete on public.ovr_executive_analytics_requests
for each statement execute function ovr_v11_private.guard_analytics_history_immutable();

drop trigger if exists trg_ovr_executive_analytics_audit_immutable
  on public.ovr_executive_analytics_audit;
create trigger trg_ovr_executive_analytics_audit_immutable
before update or delete on public.ovr_executive_analytics_audit
for each statement execute function ovr_v11_private.guard_analytics_history_immutable();

create or replace function ovr_v11_private.validate_analytics_config()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_calendar record;
begin
  new.timezone_name := btrim(new.timezone_name);
  if not exists (
    select 1 from pg_catalog.pg_timezone_names tz where tz.name = new.timezone_name
  ) then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_TIMEZONE_INVALID';
  end if;

  select c.organization_id, c.timezone_name, c.is_active
    into v_calendar
  from public.runtime_workflow_sla_calendars c
  where c.id = new.sla_calendar_id;

  if not found or v_calendar.organization_id is distinct from new.organization_id then
    return new;
  end if;
  if not v_calendar.is_active or v_calendar.timezone_name is distinct from new.timezone_name then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_TIMEZONE_CALENDAR_MISMATCH';
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function ovr_v11_private.validate_analytics_config()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_organization_ovr_analytics_config_validate
  on public.organization_ovr_analytics_config;
create trigger trg_organization_ovr_analytics_config_validate
before insert or update on public.organization_ovr_analytics_config
for each row execute function ovr_v11_private.validate_analytics_config();

create or replace function ovr_v11_private.executive_actor_organization(
  p_actor_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, ovr_v11_private, pg_temp
as $$
declare
  v_org uuid;
  v_entitlement_count integer;
begin
  select p.organization_id into v_org
  from public.profiles p
  join public.user_credential_states cs
    on cs.user_id = p.id and cs.organization_id = p.organization_id
  join auth.users au on au.id = p.id
  where p.id = p_actor_id
    and p.organization_id is not null
    and p.is_active
    and p.user_status = 'active'
    and cs.credential_state = 'active'
    and cs.requested_lifecycle = 'active'
    and cs.identity_mode in ('legacy_verified', 'employee_id_managed')
    and lower(btrim(au.email)) = cs.auth_email
    and au.email_confirmed_at is not null
    and au.deleted_at is null
    and (au.banned_until is null or au.banned_until <= statement_timestamp())
    and public.patch83u_auth_credential_version(au.raw_app_meta_data) = cs.credential_version
    and 1 = (
      select count(*)
      from auth.identities ai
      where ai.user_id = au.id
        and ai.provider = 'email'
        and lower(btrim(coalesce(ai.identity_data ->> 'email', ai.email, ''))) = cs.auth_email
    );

  if v_org is null then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_ACTIVE_ACTOR_REQUIRED';
  end if;

  select count(*)::integer into v_entitlement_count
  from public.user_roles ur
  where ur.user_id = p_actor_id
    and ur.role = 'executive'
    and ur.scope = 'global'
    and ur.is_active
    and public.patch83u_role_assignment_valid(
      v_org, ur.scope, ur.organization_id,
      ur.division_id, ur.department_id, ur.unit_id
    );

  if v_entitlement_count <> 1 then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_EXECUTIVE_ENTITLEMENT_REQUIRED';
  end if;
  return v_org;
end;
$$;

revoke all on function ovr_v11_private.executive_actor_organization(uuid)
  from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.analytics_config(
  p_organization_id uuid,
  p_as_of timestamptz
)
returns public.organization_ovr_analytics_config
language plpgsql
stable
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_count integer;
  v_config public.organization_ovr_analytics_config%rowtype;
begin
  select count(*)::integer into v_count
  from public.organization_ovr_analytics_config c
  join public.runtime_workflow_sla_calendars cal
    on cal.organization_id = c.organization_id
   and cal.id = c.sla_calendar_id
   and cal.is_active
   and cal.timezone_name = c.timezone_name
  where c.organization_id = p_organization_id
    and c.is_active
    and c.effective_from <= p_as_of
    and (c.effective_until is null or c.effective_until > p_as_of)
    and exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = c.timezone_name);

  if v_count <> 1 then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_CONFIG_REQUIRED';
  end if;

  select c.* into strict v_config
  from public.organization_ovr_analytics_config c
  join public.runtime_workflow_sla_calendars cal
    on cal.organization_id = c.organization_id
   and cal.id = c.sla_calendar_id
   and cal.is_active
   and cal.timezone_name = c.timezone_name
  where c.organization_id = p_organization_id
    and c.is_active
    and c.effective_from <= p_as_of
    and (c.effective_until is null or c.effective_until > p_as_of);
  return v_config;
end;
$$;

revoke all on function ovr_v11_private.analytics_config(uuid,timestamptz)
  from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.analytics_snapshot_v2(
  p_organization_id uuid,
  p_snapshot_date date,
  p_definition_version text
)
returns public.ovr_executive_analytics_snapshots
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_snapshot public.ovr_executive_analytics_snapshots;
begin
  begin
    select s.* into strict v_snapshot
    from public.ovr_executive_analytics_snapshots s
    where s.organization_id = p_organization_id
      and s.snapshot_date = p_snapshot_date
      and s.definition_version = p_definition_version;
  exception
    when no_data_found then
      raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_SNAPSHOT_REQUIRED';
    when too_many_rows then
      raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_SNAPSHOT_AMBIGUOUS';
  end;
  return v_snapshot;
end;
$$;

revoke all on function ovr_v11_private.analytics_snapshot_v2(uuid,date,text)
  from public, anon, authenticated, service_role;

-- One private fact projection remains the sole semantic source for all eight
-- KPIs. It is evaluated once by the controlled daily snapshot, never once per
-- dashboard shape.
create or replace function ovr_v11_private.ovr_kpi_facts_v2(
  p_organization_id uuid,
  p_as_of timestamptz,
  p_timezone_name text
)
returns table (
  ovr_report_id uuid,
  organization_id uuid,
  department_id uuid,
  category_key text,
  occurrence_at timestamptz,
  first_submitted_at timestamptz,
  created_at_compatibility_marker timestamptz,
  governance_closed_at timestamptz,
  closure_sla_due_at timestamptz,
  current_due_at timestamptz,
  current_due_source text,
  due_measurable boolean,
  is_open boolean,
  is_overdue boolean,
  effective_severity public.ovr_severity_level,
  corrective_action_required boolean,
  closure_duration_seconds numeric,
  closure_within_sla boolean,
  potential_repeat boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_ambiguous integer;
begin
  if p_organization_id is null or p_as_of is null or p_timezone_name is null
     or not exists (
       select 1 from pg_catalog.pg_timezone_names tz where tz.name = p_timezone_name
     ) then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_FACT_CONTEXT_INVALID';
  end if;

  with leaves as (
    select v.ovr_report_id, count(*)::integer n
    from public.ovr_final_verdicts v
    left join public.ovr_final_verdicts successor
      on successor.organization_id = v.organization_id
     and successor.ovr_report_id = v.ovr_report_id
     and successor.supersedes_verdict_id = v.id
    where v.organization_id = p_organization_id
      and successor.id is null
    group by v.ovr_report_id
    having count(*) <> 1
  ) select count(*)::integer into v_ambiguous from leaves;
  if v_ambiguous <> 0 then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_CURRENT_VERDICT_AMBIGUOUS';
  end if;

  with current_stages as (
    select s.ovr_report_id, count(*)::integer n
    from public.ovr_stage_instances s
    join public.ovr_review_cycles c
      on c.organization_id = s.organization_id
     and c.ovr_report_id = s.ovr_report_id
     and c.id = s.review_cycle_id
     and c.status = 'active'
    where s.organization_id = p_organization_id
      and s.lifecycle_status in ('pending', 'routing', 'assigned', 'blocked')
    group by s.ovr_report_id
    having count(*) > 1
  ) select count(*)::integer into v_ambiguous from current_stages;
  if v_ambiguous <> 0 then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_CURRENT_STAGE_AMBIGUOUS';
  end if;

  return query
  with current_verdict as (
    select v.organization_id, v.ovr_report_id, v.id, v.effective_severity,
           v.corrective_action_required
    from public.ovr_final_verdicts v
    left join public.ovr_final_verdicts successor
      on successor.organization_id = v.organization_id
     and successor.ovr_report_id = v.ovr_report_id
     and successor.supersedes_verdict_id = v.id
    where v.organization_id = p_organization_id
      and successor.id is null
  ),
  current_closure as (
    select c.organization_id, c.ovr_report_id, c.closed_at, s.due_at
    from public.ovr_governance_closures c
    join current_verdict v
      on v.organization_id = c.organization_id
     and v.ovr_report_id = c.ovr_report_id
     and v.id = c.final_verdict_id
    join public.ovr_stage_instances s
      on s.organization_id = c.organization_id
     and s.ovr_report_id = c.ovr_report_id
     and s.id = c.stage_instance_id
    where c.organization_id = p_organization_id
  ),
  first_submission as (
    select a.organization_id, a.record_id as ovr_report_id, min(a.created_at) as submitted_at
    from public.audit_logs a
    where a.organization_id = p_organization_id
      and a.table_name = 'ovr_reports'
      and a.record_id is not null
      and a.new_data ->> 'status' = 'submitted'
      and coalesce(a.old_data ->> 'status', '') <> 'submitted'
    group by a.organization_id, a.record_id
  ),
  active_stage as (
    select s.organization_id, s.ovr_report_id, s.due_at
    from public.ovr_stage_instances s
    join public.ovr_review_cycles c
      on c.organization_id = s.organization_id
     and c.ovr_report_id = s.ovr_report_id
     and c.id = s.review_cycle_id
     and c.status = 'active'
    where s.organization_id = p_organization_id
      and s.lifecycle_status in ('pending', 'routing', 'assigned', 'blocked')
  ),
  base as (
    select o.id, o.organization_id, o.department_id,
      lower(btrim(o.occurrence_category)) as category_key,
      ((o.occurrence_date + coalesce(o.occurrence_time, time '00:00')) at time zone p_timezone_name) as occurrence_at,
      fs.submitted_at as first_submitted_at,
      o.created_at as created_marker,
      case when cv.id is not null then cc.closed_at
           when o.status = 'closed' then o.closed_at end as authoritative_closed_at,
      case when cv.id is not null then cc.due_at
           when o.status = 'closed' and o.quality_due_date is not null
             then ((o.quality_due_date + time '23:59:59.999999') at time zone p_timezone_name)
      end as authoritative_closure_due,
      case when ast.ovr_report_id is not null then ast.due_at
           when o.status in ('submitted', 'under_supervisor_review') and o.supervisor_due_date is not null
             then ((o.supervisor_due_date + time '23:59:59.999999') at time zone p_timezone_name)
           when o.status in ('under_quality_review', 'returned_for_clarification', 'evidence_submitted', 'quality_closure_review') and o.quality_due_date is not null
             then ((o.quality_due_date + time '23:59:59.999999') at time zone p_timezone_name)
           when o.status in ('action_plan_required', 'corrective_action_in_progress') and o.corrective_action_due_date is not null
             then ((o.corrective_action_due_date + time '23:59:59.999999') at time zone p_timezone_name)
      end as authoritative_current_due,
      case when ast.ovr_report_id is not null then 'p1_stage_due_at'
           when o.supervisor_due_date is not null
             or o.quality_due_date is not null
             or o.corrective_action_due_date is not null then 'legacy_persisted_date'
           else 'unknown' end as due_source,
      coalesce(cv.effective_severity, o.final_severity_level, o.severity_level) as effective_severity,
      coalesce(cv.corrective_action_required, o.corrective_action_required) as corrective_required,
      o.status
    from public.ovr_reports o
    left join current_verdict cv
      on cv.organization_id = o.organization_id and cv.ovr_report_id = o.id
    left join current_closure cc
      on cc.organization_id = o.organization_id and cc.ovr_report_id = o.id
    left join first_submission fs
      on fs.organization_id = o.organization_id and fs.ovr_report_id = o.id
    left join active_stage ast
      on ast.organization_id = o.organization_id and ast.ovr_report_id = o.id
    where o.organization_id = p_organization_id
  ),
  qualified as (
    select b.*,
      (b.authoritative_closed_at is null and b.status not in ('rejected', 'cancelled')) as open_fact
    from base b
  ),
  repeat_ordered as (
    select q.id, q.occurrence_at,
      lag(q.occurrence_at, 2) over w as previous_2,
      lag(q.occurrence_at, 1) over w as previous_1,
      lead(q.occurrence_at, 1) over w as next_1,
      lead(q.occurrence_at, 2) over w as next_2
    from qualified q
    where q.status not in ('rejected', 'cancelled')
    window w as (
      partition by q.organization_id, q.category_key, q.department_id
      order by q.occurrence_at, q.id
    )
  ),
  repeat_members as (
    select r.id
    from repeat_ordered r
    where (r.previous_2 is not null and r.occurrence_at - r.previous_2 <= interval '30 days')
       or (r.previous_1 is not null and r.next_1 is not null and r.next_1 - r.previous_1 <= interval '30 days')
       or (r.next_2 is not null and r.next_2 - r.occurrence_at <= interval '30 days')
  )
  select q.id, q.organization_id, q.department_id, q.category_key, q.occurrence_at,
    q.first_submitted_at, q.created_marker, q.authoritative_closed_at,
    q.authoritative_closure_due, q.authoritative_current_due, q.due_source,
    q.authoritative_current_due is not null,
    q.open_fact,
    q.open_fact and q.authoritative_current_due is not null
      and q.authoritative_current_due < p_as_of,
    q.effective_severity, q.corrective_required,
    case when q.authoritative_closed_at is not null and q.first_submitted_at is not null
              and q.authoritative_closed_at >= q.first_submitted_at
      then extract(epoch from (q.authoritative_closed_at - q.first_submitted_at))::numeric end,
    case when q.authoritative_closed_at is not null and q.authoritative_closure_due is not null
      then q.authoritative_closed_at <= q.authoritative_closure_due end,
    rm.id is not null
  from qualified q
  left join repeat_members rm on rm.id = q.id;
end;
$$;

revoke all on function ovr_v11_private.ovr_kpi_facts_v2(uuid,timestamptz,text)
  from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.count_band_v2(
  p_value bigint,
  p_threshold integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_lower bigint;
  v_upper bigint;
begin
  if p_value is null or p_value < 0 or p_threshold < 5 then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_BAND_INPUT_INVALID';
  end if;
  if p_value = 0 then
    return jsonb_build_object('state', 'zero', 'label', '0', 'suppressed', false);
  end if;
  if p_value < p_threshold then
    return jsonb_build_object(
      'state', 'suppressed', 'label', '<' || p_threshold::text, 'suppressed', true
    );
  end if;

  if p_value < p_threshold * 2 then
    v_lower := p_threshold; v_upper := p_threshold * 2 - 1;
  elsif p_value < p_threshold * 4 then
    v_lower := p_threshold * 2; v_upper := p_threshold * 4 - 1;
  elsif p_value < p_threshold * 10 then
    v_lower := p_threshold * 4; v_upper := p_threshold * 10 - 1;
  elsif p_value < p_threshold * 20 then
    v_lower := p_threshold * 10; v_upper := p_threshold * 20 - 1;
  elsif p_value < p_threshold * 50 then
    v_lower := p_threshold * 20; v_upper := p_threshold * 50 - 1;
  elsif p_value < p_threshold * 100 then
    v_lower := p_threshold * 50; v_upper := p_threshold * 100 - 1;
  else
    v_lower := (p_value / (p_threshold * 100)) * (p_threshold * 100);
    v_upper := v_lower + (p_threshold * 100) - 1;
  end if;

  return jsonb_build_object(
    'state', 'banded',
    'label', v_lower::text || '-' || v_upper::text,
    'lower_bound', v_lower,
    'upper_bound', v_upper,
    'suppressed', false
  );
end;
$$;

revoke all on function ovr_v11_private.count_band_v2(bigint,integer)
  from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.duration_band_v2(
  p_average_seconds numeric,
  p_denominator bigint,
  p_threshold integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_days numeric;
  v_label text;
begin
  if p_denominator < p_threshold then
    return jsonb_build_object(
      'state', case when p_denominator = 0 then 'unavailable' else 'suppressed' end,
      'label', case when p_denominator = 0 then 'not_available' else '<' || p_threshold::text end,
      'denominator', ovr_v11_private.count_band_v2(p_denominator, p_threshold),
      'suppressed', p_denominator > 0
    );
  end if;
  v_days := p_average_seconds / 86400.0;
  v_label := case
    when v_days < 1 then '<1d'
    when v_days < 3 then '1-2d'
    when v_days < 7 then '3-6d'
    when v_days < 14 then '7-13d'
    when v_days < 30 then '14-29d'
    else '30d+'
  end;
  return jsonb_build_object(
    'state', 'banded', 'label', v_label,
    'denominator', ovr_v11_private.count_band_v2(p_denominator, p_threshold),
    'suppressed', false
  );
end;
$$;

revoke all on function ovr_v11_private.duration_band_v2(numeric,bigint,integer)
  from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.percentage_band_v2(
  p_numerator bigint,
  p_denominator bigint,
  p_threshold integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_percentage numeric;
  v_lower integer;
  v_upper integer;
begin
  if p_denominator < p_threshold then
    return jsonb_build_object(
      'state', case when p_denominator = 0 then 'unavailable' else 'suppressed' end,
      'label', case when p_denominator = 0 then 'not_available' else '<' || p_threshold::text end,
      'denominator', ovr_v11_private.count_band_v2(p_denominator, p_threshold),
      'suppressed', p_denominator > 0
    );
  end if;
  v_percentage := 100.0 * p_numerator / p_denominator;
  v_lower := least(90, floor(v_percentage / 10.0)::integer * 10);
  v_upper := case when v_lower = 90 then 100 else v_lower + 9 end;
  return jsonb_build_object(
    'state', 'banded', 'label', v_lower::text || '-' || v_upper::text || '%',
    'lower_bound', v_lower, 'upper_bound', v_upper,
    'denominator', ovr_v11_private.count_band_v2(p_denominator, p_threshold),
    'suppressed', false
  );
end;
$$;

revoke all on function ovr_v11_private.percentage_band_v2(bigint,bigint,integer)
  from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.validate_analytics_shape_v2(
  p_query_shape text,
  p_department_filter_id uuid,
  p_category_filter text
)
returns text
language plpgsql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_query_shape not in ('headline_current_period', 'monthly_trend_12') then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_QUERY_SHAPE_DENIED';
  end if;
  if p_department_filter_id is not null or p_category_filter is not null then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_FILTER_COMBINATION_DENIED';
  end if;
  return p_query_shape;
end;
$$;

revoke all on function ovr_v11_private.validate_analytics_shape_v2(text,uuid,text)
  from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.validate_analytics_idempotency_key_v2(
  p_idempotency_key text
)
returns text
language plpgsql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_idempotency_key is null
     or length(p_idempotency_key) not between 1 and 128
     or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_IDEMPOTENCY_KEY_INVALID';
  end if;
  return p_idempotency_key;
end;
$$;

revoke all on function ovr_v11_private.validate_analytics_idempotency_key_v2(text)
  from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.assert_request_match_v2(
  p_matches boolean
)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not coalesce(p_matches, false) then
    raise exception using errcode = 'P0001', message = 'OVR_ANALYTICS_IDEMPOTENCY_KEY_REUSE_DENIED';
  end if;
  return true;
end;
$$;

revoke all on function ovr_v11_private.assert_request_match_v2(boolean)
  from public, anon, authenticated, service_role;

-- One controlled refresh per organization/local day. The unique key makes the
-- daily publication immutable and prevents repeated fresh queries from exposing
-- singleton temporal changes.
create or replace function public.refresh_ovr_executive_analytics_snapshot_v1(
  p_actor_id uuid
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog, public, auth, ovr_v11_private, extensions, pg_temp
as $$
with service_guard as materialized (
  select ovr_v11_private.assert_service_caller() as allowed
), actor_context as materialized (
  select ovr_v11_private.executive_actor_organization(p_actor_id) as organization_id,
         statement_timestamp() as generated_at
  from service_guard
), configured as materialized (
  select cfg.*, a.generated_at
  from actor_context a
  cross join lateral ovr_v11_private.analytics_config(
    a.organization_id, a.generated_at
  ) cfg
), facts as materialized (
  select f.*
  from configured c
  cross join lateral ovr_v11_private.ovr_kpi_facts_v2(
    c.organization_id, c.generated_at, c.timezone_name
  ) f
), exact_headline as materialized (
  select
    count(*) filter (where f.is_open)::bigint as open_ovr,
    count(*) filter (
      where f.first_submitted_at >= date_trunc('month', c.generated_at at time zone c.timezone_name) at time zone c.timezone_name
        and f.first_submitted_at < (date_trunc('month', c.generated_at at time zone c.timezone_name) + interval '1 month') at time zone c.timezone_name
    )::bigint as new_this_month,
    count(*) filter (where f.is_overdue)::bigint as overdue_ovr,
    count(*) filter (where f.is_open and not f.due_measurable)::bigint as unknown_due,
    count(*) filter (where f.is_open and f.effective_severity in ('level_4', 'sentinel'))::bigint as major_sentinel,
    avg(f.closure_duration_seconds) filter (
      where f.governance_closed_at >= date_trunc('month', c.generated_at at time zone c.timezone_name) at time zone c.timezone_name
        and f.governance_closed_at < (date_trunc('month', c.generated_at at time zone c.timezone_name) + interval '1 month') at time zone c.timezone_name
        and f.closure_duration_seconds is not null
    ) as average_closure_seconds,
    count(f.closure_duration_seconds) filter (
      where f.governance_closed_at >= date_trunc('month', c.generated_at at time zone c.timezone_name) at time zone c.timezone_name
        and f.governance_closed_at < (date_trunc('month', c.generated_at at time zone c.timezone_name) + interval '1 month') at time zone c.timezone_name
    )::bigint as closure_duration_denominator,
    count(*) filter (
      where f.governance_closed_at >= date_trunc('month', c.generated_at at time zone c.timezone_name) at time zone c.timezone_name
        and f.governance_closed_at < (date_trunc('month', c.generated_at at time zone c.timezone_name) + interval '1 month') at time zone c.timezone_name
        and f.closure_within_sla
    )::bigint as sla_numerator,
    count(f.closure_within_sla) filter (
      where f.governance_closed_at >= date_trunc('month', c.generated_at at time zone c.timezone_name) at time zone c.timezone_name
        and f.governance_closed_at < (date_trunc('month', c.generated_at at time zone c.timezone_name) + interval '1 month') at time zone c.timezone_name
    )::bigint as sla_denominator,
    count(*) filter (where f.potential_repeat)::bigint as potential_repeat,
    count(*) filter (where f.is_open and f.corrective_action_required)::bigint as corrective_action_required
  from facts f
  cross join configured c
  group by c.generated_at, c.timezone_name
), month_axis as materialized (
  select generate_series(
    date_trunc('month', c.generated_at at time zone c.timezone_name) - interval '11 months',
    date_trunc('month', c.generated_at at time zone c.timezone_name),
    interval '1 month'
  ) as local_month
  from configured c
), new_monthly as materialized (
  select date_trunc('month', f.first_submitted_at at time zone c.timezone_name) as local_month,
         count(*)::bigint as value
  from facts f cross join configured c
  where f.first_submitted_at >= (
    date_trunc('month', c.generated_at at time zone c.timezone_name) - interval '11 months'
  ) at time zone c.timezone_name
    and f.first_submitted_at < (
      date_trunc('month', c.generated_at at time zone c.timezone_name) + interval '1 month'
    ) at time zone c.timezone_name
  group by 1
), closed_monthly as materialized (
  select date_trunc('month', f.governance_closed_at at time zone c.timezone_name) as local_month,
         count(*)::bigint as value
  from facts f cross join configured c
  where f.governance_closed_at >= (
    date_trunc('month', c.generated_at at time zone c.timezone_name) - interval '11 months'
  ) at time zone c.timezone_name
    and f.governance_closed_at < (
      date_trunc('month', c.generated_at at time zone c.timezone_name) + interval '1 month'
    ) at time zone c.timezone_name
  group by 1
), safe_headline as materialized (
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'open_ovr', ovr_v11_private.count_band_v2(h.open_ovr, c.minimum_cell_size),
      'new_this_month', ovr_v11_private.count_band_v2(h.new_this_month, c.minimum_cell_size),
      'overdue_ovr', jsonb_build_object(
        'count', ovr_v11_private.count_band_v2(h.overdue_ovr, c.minimum_cell_size),
        'unknown_due', ovr_v11_private.count_band_v2(h.unknown_due, c.minimum_cell_size)
      ),
      'major_sentinel', ovr_v11_private.count_band_v2(h.major_sentinel, c.minimum_cell_size),
      'average_closure_time', ovr_v11_private.duration_band_v2(
        h.average_closure_seconds, h.closure_duration_denominator, c.minimum_cell_size
      ),
      'closure_within_sla', ovr_v11_private.percentage_band_v2(
        h.sla_numerator, h.sla_denominator, c.minimum_cell_size
      ),
      'potential_repeat', ovr_v11_private.count_band_v2(h.potential_repeat, c.minimum_cell_size),
      'corrective_action_required', ovr_v11_private.count_band_v2(
        h.corrective_action_required, c.minimum_cell_size
      )
    ),
    'privacy', jsonb_build_object(
      'model', 'deterministic-bands-daily-v1',
      'minimum_cell_size', c.minimum_cell_size,
      'exact_values_returned', false,
      'arbitrary_filters_allowed', false,
      'dimension_drilldown_allowed', false,
      'daily_snapshot_immutable', true,
      'suppression_applied', (
        h.open_ovr between 1 and c.minimum_cell_size - 1
        or h.new_this_month between 1 and c.minimum_cell_size - 1
        or h.overdue_ovr between 1 and c.minimum_cell_size - 1
        or h.unknown_due between 1 and c.minimum_cell_size - 1
        or h.major_sentinel between 1 and c.minimum_cell_size - 1
        or h.closure_duration_denominator between 1 and c.minimum_cell_size - 1
        or h.sla_denominator between 1 and c.minimum_cell_size - 1
        or h.potential_repeat between 1 and c.minimum_cell_size - 1
        or h.corrective_action_required between 1 and c.minimum_cell_size - 1
      )
    )
  ) as response
  from exact_headline h cross join configured c
), safe_trend as materialized (
  select jsonb_build_object(
    'buckets', jsonb_agg(
      jsonb_build_object(
        'bucket_key', to_char(m.local_month, 'YYYY-MM'),
        'new_reports', ovr_v11_private.count_band_v2(coalesce(n.value, 0), c.minimum_cell_size),
        'closed_reports', ovr_v11_private.count_band_v2(coalesce(cl.value, 0), c.minimum_cell_size)
      ) order by m.local_month
    ),
    'privacy', jsonb_build_object(
      'model', 'deterministic-bands-daily-v1',
      'minimum_cell_size', c.minimum_cell_size,
      'exact_values_returned', false,
      'arbitrary_filters_allowed', false,
      'dimension_drilldown_allowed', false,
      'daily_snapshot_immutable', true,
      'suppression_applied', bool_or(
        coalesce(n.value, 0) between 1 and c.minimum_cell_size - 1
        or coalesce(cl.value, 0) between 1 and c.minimum_cell_size - 1
      )
    )
  ) as response
  from month_axis m
  cross join configured c
  left join new_monthly n on n.local_month = m.local_month
  left join closed_monthly cl on cl.local_month = m.local_month
  group by c.minimum_cell_size
), inserted as (
  insert into public.ovr_executive_analytics_snapshots(
    organization_id, snapshot_date, generated_at, timezone_name,
    definition_version, privacy_model, minimum_cell_size,
    headline_response, monthly_trend_response, created_by
  )
  select c.organization_id,
         (c.generated_at at time zone c.timezone_name)::date,
         c.generated_at, c.timezone_name, c.kpi_definition_version,
         'deterministic-bands-daily-v1', c.minimum_cell_size,
         h.response, t.response, p_actor_id
  from configured c cross join safe_headline h cross join safe_trend t
  on conflict (organization_id, snapshot_date, definition_version) do nothing
  returning *
), chosen as (
  select * from inserted
  union all
  select s.*
  from public.ovr_executive_analytics_snapshots s
  cross join configured c
  where s.organization_id = c.organization_id
    and s.snapshot_date = (c.generated_at at time zone c.timezone_name)::date
    and s.definition_version = c.kpi_definition_version
    and not exists (select 1 from inserted)
)
select jsonb_build_object(
  'snapshot_id', id,
  'snapshot_date', snapshot_date,
  'generated_at', generated_at,
  'definition_version', definition_version,
  'privacy_model', privacy_model,
  'headline_current_period', headline_response,
  'monthly_trend_12', monthly_trend_response
)
from chosen
limit 1;
$$;

revoke all on function public.refresh_ovr_executive_analytics_snapshot_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.refresh_ovr_executive_analytics_snapshot_v1(uuid)
  to service_role;

-- The aggregate read, authorization revalidation, configuration lookup,
-- snapshot selection, idempotency decision, and audit append all occur in one
-- SQL statement snapshot at the production default isolation level.
create or replace function ovr_v11_private.execute_analytics_request_v2(
  p_actor_id uuid,
  p_query_shape text,
  p_department_filter_id uuid,
  p_category_filter text,
  p_idempotency_key text
)
returns jsonb
language sql
volatile
security definer
set search_path = pg_catalog, public, auth, ovr_v11_private, extensions, pg_temp
as $$
with service_guard as materialized (
  select ovr_v11_private.assert_service_caller() as allowed,
         ovr_v11_private.validate_analytics_shape_v2(
           p_query_shape, p_department_filter_id, p_category_filter
         ) as query_shape
), actor_context as materialized (
  select ovr_v11_private.executive_actor_organization(p_actor_id) as organization_id,
         g.query_shape,
         statement_timestamp() as accessed_at
  from service_guard g
), configured as materialized (
  select cfg.*, a.query_shape, a.accessed_at
  from actor_context a
  cross join lateral ovr_v11_private.analytics_config(
    a.organization_id, a.accessed_at
  ) cfg
), selected_snapshot as materialized (
  select s.*, c.query_shape, c.accessed_at,
         date_trunc('month', s.generated_at at time zone s.timezone_name)
           at time zone s.timezone_name as period_start,
         (date_trunc('month', s.generated_at at time zone s.timezone_name) + interval '1 month')
           at time zone s.timezone_name as period_end,
         case c.query_shape
           when 'headline_current_period' then s.headline_response
           when 'monthly_trend_12' then s.monthly_trend_response
         end
         || jsonb_build_object(
           'definition_version', s.definition_version,
           'query_shape', c.query_shape,
           'generated_at', s.generated_at,
           'snapshot_date', s.snapshot_date,
           'timezone', s.timezone_name,
           'scope', 'organization',
           'allowed_filters', '{}'::jsonb
         ) as response
  from configured c
  cross join lateral ovr_v11_private.analytics_snapshot_v2(
    c.organization_id,
    (c.accessed_at at time zone c.timezone_name)::date,
    c.kpi_definition_version
  ) s
), request_material as materialized (
  select s.*,
         ovr_v11_private.validate_analytics_idempotency_key_v2(p_idempotency_key)
           as validated_idempotency_key,
         ovr_v11_private.semantic_digest(jsonb_build_object(
           'actor_id', p_actor_id,
           'organization_id', s.organization_id,
           'snapshot_id', s.id,
           'query_shape', s.query_shape,
           'definition_version', s.definition_version
         )) as semantic_digest
  from selected_snapshot s
), inserted as (
  insert into public.ovr_executive_analytics_requests(
    idempotency_key, organization_id, actor_id, snapshot_id, query_shape,
    period_start, period_end, definition_version, semantic_digest, canonical_response
  )
  select r.validated_idempotency_key, r.organization_id, p_actor_id, r.id, r.query_shape,
         r.period_start, r.period_end, r.definition_version, r.semantic_digest, r.response
  from request_material r
  on conflict (idempotency_key) do nothing
  returning *, false as replayed
), chosen as materialized (
  select * from inserted
  union all
  select existing.*, true as replayed
  from public.ovr_executive_analytics_requests existing
  cross join request_material r
  where existing.idempotency_key = p_idempotency_key
    and not exists (select 1 from inserted)
    and ovr_v11_private.assert_request_match_v2(
      existing.organization_id = r.organization_id
      and existing.actor_id = p_actor_id
      and existing.snapshot_id = r.id
      and existing.query_shape = r.query_shape
      and existing.period_start = r.period_start
      and existing.period_end = r.period_end
      and existing.definition_version = r.definition_version
      and existing.semantic_digest = r.semantic_digest
    )
), audited as (
  insert into public.ovr_executive_analytics_audit(
    request_id, organization_id, actor_id, snapshot_id, query_shape,
    period_start, period_end, permitted_filters, definition_version,
    generated_at, suppression_applied, suppression_metadata,
    request_semantic_digest, idempotency_key_digest, replayed
  )
  select c.id, c.organization_id, c.actor_id, c.snapshot_id, c.query_shape,
         c.period_start, c.period_end, '{}'::jsonb, c.definition_version,
         (c.canonical_response ->> 'generated_at')::timestamptz,
         coalesce((c.canonical_response #>> '{privacy,suppression_applied}')::boolean, false),
         coalesce(c.canonical_response -> 'privacy', '{}'::jsonb),
         c.semantic_digest,
         encode(extensions.digest(convert_to(c.idempotency_key, 'UTF8'), 'sha256'), 'hex'),
         c.replayed
  from chosen c
  returning request_id
)
select c.canonical_response
from chosen c
join audited a on a.request_id = c.id;
$$;

revoke all on function ovr_v11_private.execute_analytics_request_v2(uuid,text,uuid,text,text)
  from public, anon, authenticated, service_role;

-- Serialize one semantic idempotency key before entering the statement that
-- reads/inserts request history. Under the production READ COMMITTED default,
-- the inner statement therefore receives a fresh snapshot after a competing
-- transaction commits instead of returning an empty race result.
create or replace function public.ovr_executive_analytics_v1(
  p_actor_id uuid,
  p_query_shape text,
  p_department_filter_id uuid,
  p_category_filter text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, auth, ovr_v11_private, extensions, pg_temp
as $$
begin
  perform ovr_v11_private.assert_service_caller();
  perform ovr_v11_private.validate_analytics_shape_v2(
    p_query_shape, p_department_filter_id, p_category_filter
  );
  perform ovr_v11_private.validate_analytics_idempotency_key_v2(p_idempotency_key);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::text || ':' || p_idempotency_key, 0)
  );

  return ovr_v11_private.execute_analytics_request_v2(
    p_actor_id,
    p_query_shape,
    p_department_filter_id,
    p_category_filter,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.ovr_executive_analytics_v1(uuid,text,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.ovr_executive_analytics_v1(uuid,text,uuid,text,text)
  to service_role;

-- Close the legacy organization-wide Executive raw OVR branch while preserving
-- reporters, assigned workflow actors, scoped managers, and operational Quality,
-- Governance, Audit, and Compliance access.
drop policy if exists ovr_reports_read_related on public.ovr_reports;
create policy ovr_reports_read_related on public.ovr_reports
for select to authenticated
using (
  reported_by = (select auth.uid())
  or owner_id = (select auth.uid())
  or supervisor_id = (select auth.uid())
  or quality_reviewer_id = (select auth.uid())
  or quality_manager_id = (select auth.uid())
  or referred_user_id = (select auth.uid())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.is_active
      and ur.role = 'department_manager'
      and ur.organization_id is not distinct from ovr_reports.organization_id
      and (
        ur.scope = 'global'
        or (
          ur.scope = 'department'
          and (
            ur.department_id is not distinct from ovr_reports.department_id
            or ur.department_id is not distinct from ovr_reports.referred_department_id
          )
        )
      )
  )
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.is_active
      and ur.role in ('super_admin', 'governance_admin', 'auditor', 'compliance_officer')
      and (
        ur.organization_id is null
        or ur.organization_id is not distinct from ovr_reports.organization_id
      )
  )
);

-- These legacy browser views must execute with caller permissions. This makes
-- the OVR RLS cutover authoritative and prevents view-owner bypass.
alter view public.v_ovr_summary set (security_invoker = true);
alter view public.v_ovr_quality_queue set (security_invoker = true);
alter view public.v_ovr_workflow_queue set (security_invoker = true);
alter view public.v_ovr_workflow_control_summary set (security_invoker = true);
alter view public.v_ovr_risk_indicator_feed set (security_invoker = true);
alter view public.v_ovr_repeated_category_alerts set (security_invoker = true);
alter view public.v_ovr_risk_indicators_by_department set (security_invoker = true);
alter view public.v_ovr_risk_indicator_summary set (security_invoker = true);
alter view public.v_ovr_risk_attention_items set (security_invoker = true);

alter function ovr_v11_private.guard_analytics_history_immutable() owner to postgres;
alter function ovr_v11_private.validate_analytics_config() owner to postgres;
alter function ovr_v11_private.executive_actor_organization(uuid) owner to postgres;
alter function ovr_v11_private.analytics_config(uuid,timestamptz) owner to postgres;
alter function ovr_v11_private.analytics_snapshot_v2(uuid,date,text) owner to postgres;
alter function ovr_v11_private.ovr_kpi_facts_v2(uuid,timestamptz,text) owner to postgres;
alter function ovr_v11_private.count_band_v2(bigint,integer) owner to postgres;
alter function ovr_v11_private.duration_band_v2(numeric,bigint,integer) owner to postgres;
alter function ovr_v11_private.percentage_band_v2(bigint,bigint,integer) owner to postgres;
alter function ovr_v11_private.validate_analytics_shape_v2(text,uuid,text) owner to postgres;
alter function ovr_v11_private.validate_analytics_idempotency_key_v2(text) owner to postgres;
alter function ovr_v11_private.assert_request_match_v2(boolean) owner to postgres;
alter function ovr_v11_private.execute_analytics_request_v2(uuid,text,uuid,text,text) owner to postgres;
alter function public.refresh_ovr_executive_analytics_snapshot_v1(uuid) owner to postgres;
alter function public.ovr_executive_analytics_v1(uuid,text,uuid,text,text) owner to postgres;

comment on function ovr_v11_private.ovr_kpi_facts_v2(uuid,timestamptz,text) is
  'P3-R2 private canonical OVR KPI facts with inclusive 30-day repeat semantics; evaluated only during controlled daily snapshot publication.';
comment on function public.refresh_ovr_executive_analytics_snapshot_v1(uuid) is
  'P3-R2 service-only immutable daily analytics publication. Persists privacy-safe deterministic bands only.';
comment on function public.ovr_executive_analytics_v1(uuid,text,uuid,text,text) is
  'P3-R2 service-only fixed-shape Executive analytics read. No arbitrary filters, dimensions, raw rows, or exact sensitive counts.';

commit;
