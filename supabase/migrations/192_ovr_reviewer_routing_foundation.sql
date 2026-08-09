-- GRC v1.1 OVR Phase 2 P1 - reviewer routing and assignment foundation.
-- Additive only. The released v98 workflow remains authoritative until the
-- separately reviewed v1.1 enforcement migration.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $p1_scope_keys$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'divisions_organization_id_id_key'
      and conrelid = 'public.divisions'::regclass
  ) then
    alter table public.divisions
      add constraint divisions_organization_id_id_key unique (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'departments_organization_id_id_key'
      and conrelid = 'public.departments'::regclass
  ) then
    alter table public.departments
      add constraint departments_organization_id_id_key unique (organization_id, id);
  end if;
end;
$p1_scope_keys$;

create table if not exists public.ovr_reviewer_pool_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  profile_id uuid not null,
  capability text not null check (capability in (
    'manager_review', 'quality_review', 'final_verdict',
    'evidence_governance', 'governance_closure'
  )),
  scope public.access_scope not null,
  division_id uuid,
  department_id uuid,
  priority smallint not null default 100 check (priority between 0 and 1000),
  confidential_clearance boolean not null default false,
  retaliation_clearance boolean not null default false,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  is_active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ovr_reviewer_pool_profile_org_fkey
    foreign key (organization_id, profile_id)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_reviewer_pool_created_by_org_fkey
    foreign key (organization_id, created_by)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_reviewer_pool_division_org_fkey
    foreign key (organization_id, division_id)
    references public.divisions(organization_id, id) on delete restrict,
  constraint ovr_reviewer_pool_department_org_fkey
    foreign key (organization_id, department_id)
    references public.departments(organization_id, id) on delete restrict,
  constraint ovr_reviewer_pool_scope_shape check (
    (scope = 'global' and division_id is null and department_id is null)
    or (scope = 'division' and division_id is not null and department_id is null)
    or (scope = 'department' and division_id is null and department_id is not null)
  ),
  constraint ovr_reviewer_pool_effective_dates check (
    valid_to is null or valid_to > valid_from
  )
);

create unique index if not exists uq_ovr_reviewer_pool_active_membership
  on public.ovr_reviewer_pool_memberships (
    organization_id,
    profile_id,
    capability,
    scope,
    coalesce(division_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where is_active;
create unique index if not exists uq_ovr_reviewer_pool_org_profile_id
  on public.ovr_reviewer_pool_memberships (organization_id, profile_id, id);
create index if not exists idx_ovr_reviewer_pool_route
  on public.ovr_reviewer_pool_memberships (
    organization_id, capability, scope, priority, profile_id
  ) where is_active;
create index if not exists idx_ovr_reviewer_pool_division
  on public.ovr_reviewer_pool_memberships (organization_id, division_id, capability)
  where is_active and division_id is not null;
create index if not exists idx_ovr_reviewer_pool_department
  on public.ovr_reviewer_pool_memberships (organization_id, department_id, capability)
  where is_active and department_id is not null;
create index if not exists idx_ovr_reviewer_pool_created_by
  on public.ovr_reviewer_pool_memberships (organization_id, created_by);

create table if not exists public.ovr_review_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  cycle_number integer not null check (cycle_number >= 1),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  cycle_reason text,
  opened_at timestamptz not null default statement_timestamp(),
  opened_by uuid not null,
  closed_at timestamptz,
  closed_by uuid,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ovr_review_cycles_ovr_org_fkey
    foreign key (organization_id, ovr_report_id)
    references public.ovr_reports(organization_id, id) on delete cascade,
  constraint ovr_review_cycles_opened_by_org_fkey
    foreign key (organization_id, opened_by)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_review_cycles_closed_by_org_fkey
    foreign key (organization_id, closed_by)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_review_cycles_close_contract check (
    (status = 'active' and closed_at is null and closed_by is null)
    or (status <> 'active' and closed_at is not null and closed_by is not null)
  ),
  constraint ovr_review_cycles_org_number_key unique (
    organization_id, ovr_report_id, cycle_number
  ),
  constraint ovr_review_cycles_org_ovr_id_key unique (
    organization_id, ovr_report_id, id
  )
);

create unique index if not exists uq_ovr_review_cycles_one_active
  on public.ovr_review_cycles (organization_id, ovr_report_id)
  where status = 'active';
create index if not exists idx_ovr_review_cycles_opened_by
  on public.ovr_review_cycles (organization_id, opened_by);
create index if not exists idx_ovr_review_cycles_closed_by
  on public.ovr_review_cycles (organization_id, closed_by)
  where closed_by is not null;

create table if not exists public.ovr_stage_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  review_cycle_id uuid not null,
  stage_type text not null check (stage_type in (
    'manager_review', 'quality_review', 'final_verdict',
    'evidence_governance', 'governance_closure'
  )),
  sequence_number integer not null check (sequence_number >= 1),
  lifecycle_status text not null default 'pending' check (
    lifecycle_status in ('pending', 'routing', 'assigned', 'blocked', 'completed', 'cancelled')
  ),
  due_at timestamptz,
  opened_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  relationship_version bigint not null default 0 check (relationship_version >= 0),
  routing_block_reason text,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ovr_stage_instances_cycle_org_fkey
    foreign key (organization_id, ovr_report_id, review_cycle_id)
    references public.ovr_review_cycles(organization_id, ovr_report_id, id) on delete cascade,
  constraint ovr_stage_instances_state_contract check (
    (lifecycle_status = 'completed' and completed_at is not null)
    or (lifecycle_status <> 'completed' and completed_at is null)
  ),
  constraint ovr_stage_instances_block_contract check (
    (lifecycle_status = 'blocked' and length(btrim(coalesce(routing_block_reason, ''))) between 1 and 200)
    or lifecycle_status <> 'blocked'
  ),
  constraint ovr_stage_instances_cycle_sequence_key unique (
    organization_id, review_cycle_id, sequence_number
  ),
  constraint ovr_stage_instances_org_ovr_cycle_id_key unique (
    organization_id, ovr_report_id, review_cycle_id, id
  )
);

create unique index if not exists uq_ovr_stage_instances_active_stage
  on public.ovr_stage_instances (
    organization_id, ovr_report_id, review_cycle_id, stage_type
  ) where lifecycle_status in ('pending', 'routing', 'assigned', 'blocked');
create index if not exists idx_ovr_stage_instances_route
  on public.ovr_stage_instances (
    organization_id, lifecycle_status, stage_type, opened_at
  );
create index if not exists idx_ovr_stage_instances_due
  on public.ovr_stage_instances (organization_id, due_at)
  where lifecycle_status in ('pending', 'routing', 'assigned', 'blocked')
    and due_at is not null;

create table if not exists public.ovr_reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  review_cycle_id uuid not null,
  stage_instance_id uuid not null,
  reviewer_profile_id uuid not null,
  reviewer_membership_id uuid not null,
  status text not null default 'active' check (status in (
    'active', 'completed', 'recused', 'conflict_invalidated', 'ended', 'cancelled'
  )),
  assignment_reason text not null check (
    length(btrim(assignment_reason)) between 1 and 200
  ),
  candidate_digest text not null check (candidate_digest ~ '^[0-9a-f]{64}$'),
  conflict_version bigint not null check (conflict_version >= 0),
  assigned_at timestamptz not null default statement_timestamp(),
  ended_at timestamptz,
  termination_reason text,
  recusal_reason text,
  idempotency_key text not null check (
    length(idempotency_key) between 1 and 128
    and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
  ),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ovr_reviewer_assignments_stage_org_fkey
    foreign key (organization_id, ovr_report_id, review_cycle_id, stage_instance_id)
    references public.ovr_stage_instances(
      organization_id, ovr_report_id, review_cycle_id, id
    ) on delete cascade,
  constraint ovr_reviewer_assignments_reviewer_org_fkey
    foreign key (organization_id, reviewer_profile_id)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_reviewer_assignments_membership_org_fkey
    foreign key (organization_id, reviewer_profile_id, reviewer_membership_id)
    references public.ovr_reviewer_pool_memberships(
      organization_id, profile_id, id
    ) on delete restrict,
  constraint ovr_reviewer_assignments_status_contract check (
    (status = 'active' and ended_at is null and termination_reason is null)
    or (
      status <> 'active'
      and ended_at is not null
      and length(btrim(coalesce(termination_reason, ''))) between 1 and 500
    )
  ),
  constraint ovr_reviewer_assignments_recusal_contract check (
    (status = 'recused' and length(btrim(coalesce(recusal_reason, ''))) between 1 and 500)
    or (status <> 'recused' and recusal_reason is null)
  ),
  constraint ovr_reviewer_assignments_org_idempotency_key unique (
    organization_id, idempotency_key
  ),
  constraint ovr_reviewer_assignments_org_context_id_key unique (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id, id
  )
);

create unique index if not exists uq_ovr_reviewer_assignments_one_active
  on public.ovr_reviewer_assignments (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id
  ) where status = 'active';
create index if not exists idx_ovr_reviewer_assignments_workload
  on public.ovr_reviewer_assignments (
    organization_id, reviewer_profile_id, status, assigned_at desc
  );
create index if not exists idx_ovr_reviewer_assignments_reviewer_history
  on public.ovr_reviewer_assignments (
    organization_id, reviewer_profile_id, assigned_at desc
  );
create index if not exists idx_ovr_reviewer_assignments_membership
  on public.ovr_reviewer_assignments (reviewer_membership_id);
create index if not exists idx_ovr_reviewer_assignments_membership_org
  on public.ovr_reviewer_assignments (
    organization_id, reviewer_profile_id, reviewer_membership_id
  );
create index if not exists idx_ovr_reviewer_assignments_stage_history
  on public.ovr_reviewer_assignments (
    organization_id, stage_instance_id, assigned_at desc
  );

create table if not exists public.ovr_routing_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  review_cycle_id uuid not null,
  stage_instance_id uuid not null,
  assignment_id uuid,
  event_type text not null check (event_type in (
    'routing_requested', 'candidate_evaluated', 'assignment_created',
    'reassignment', 'existing_assignment', 'no_eligible_reviewer', 'conflict_invalidated',
    'recused', 'idempotent_replay'
  )),
  actor_id uuid not null,
  candidate_profile_id uuid,
  event_reason text not null check (length(btrim(event_reason)) between 1 and 500),
  candidate_digest text check (candidate_digest is null or candidate_digest ~ '^[0-9a-f]{64}$'),
  conflict_version bigint not null check (conflict_version >= 0),
  idempotency_key text check (
    idempotency_key is null
    or (
      length(idempotency_key) between 1 and 128
      and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
    )
  ),
  idempotency_operation text check (
    idempotency_operation is null
    or idempotency_operation in ('route_reviewer', 'recuse_assignment')
  ),
  idempotency_request_digest text check (
    idempotency_request_digest is null
    or idempotency_request_digest ~ '^[0-9a-f]{64}$'
  ),
  idempotency_response jsonb check (
    idempotency_response is null
    or jsonb_typeof(idempotency_response) = 'object'
  ),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint ovr_routing_events_stage_org_fkey
    foreign key (organization_id, ovr_report_id, review_cycle_id, stage_instance_id)
    references public.ovr_stage_instances(
      organization_id, ovr_report_id, review_cycle_id, id
    ) on delete cascade,
  constraint ovr_routing_events_actor_org_fkey
    foreign key (organization_id, actor_id)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_routing_events_candidate_org_fkey
    foreign key (organization_id, candidate_profile_id)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_routing_events_assignment_context_fkey
    foreign key (
      organization_id, ovr_report_id, review_cycle_id,
      stage_instance_id, assignment_id
    )
    references public.ovr_reviewer_assignments(
      organization_id, ovr_report_id, review_cycle_id,
      stage_instance_id, id
    ) on delete restrict,
  constraint ovr_routing_events_idempotency_contract check (
    (
      idempotency_key is null
      and idempotency_operation is null
      and idempotency_request_digest is null
      and idempotency_response is null
    )
    or (
      idempotency_key is not null
      and idempotency_operation is not null
      and idempotency_request_digest is not null
      and idempotency_response is not null
    )
  )
);

create index if not exists idx_ovr_routing_events_ovr_time
  on public.ovr_routing_events (
    organization_id, ovr_report_id, occurred_at desc
  );
create index if not exists idx_ovr_routing_events_stage_time
  on public.ovr_routing_events (
    organization_id, stage_instance_id, occurred_at desc
  );
create index if not exists idx_ovr_routing_events_stage_org
  on public.ovr_routing_events (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id
  );
create index if not exists idx_ovr_routing_events_assignment
  on public.ovr_routing_events (assignment_id)
  where assignment_id is not null;
create index if not exists idx_ovr_routing_events_candidate
  on public.ovr_routing_events (organization_id, candidate_profile_id, occurred_at desc)
  where candidate_profile_id is not null;
create index if not exists idx_ovr_routing_events_actor_org
  on public.ovr_routing_events (organization_id, actor_id);
create unique index if not exists uq_ovr_routing_events_terminal_idempotency
  on public.ovr_routing_events (organization_id, idempotency_key)
  where idempotency_key is not null;

create or replace function ovr_v11_private.guard_routing_events_append_only()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = 'OVR_V11_ROUTING_EVENTS_APPEND_ONLY';
end;
$$;

revoke all on function ovr_v11_private.guard_routing_events_append_only()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_routing_events_append_only on public.ovr_routing_events;
create trigger trg_ovr_routing_events_append_only
before update or delete on public.ovr_routing_events
for each statement execute function ovr_v11_private.guard_routing_events_append_only();

create or replace function ovr_v11_private.guard_membership_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'OVR_V11_REVIEWER_MEMBERSHIP_DELETE_DENIED';
  end if;
  if new.organization_id is distinct from old.organization_id
    or new.profile_id is distinct from old.profile_id
    or new.capability is distinct from old.capability
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_REVIEWER_MEMBERSHIP_IDENTITY_IMMUTABLE';
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function ovr_v11_private.guard_membership_update()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_reviewer_membership_guard on public.ovr_reviewer_pool_memberships;
create trigger trg_ovr_reviewer_membership_guard
before update or delete on public.ovr_reviewer_pool_memberships
for each row execute function ovr_v11_private.guard_membership_update();

create or replace function ovr_v11_private.guard_cycle_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'OVR_V11_REVIEW_CYCLE_DELETE_DENIED';
  end if;
  if new.organization_id is distinct from old.organization_id
    or new.ovr_report_id is distinct from old.ovr_report_id
    or new.cycle_number is distinct from old.cycle_number
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_REVIEW_CYCLE_IDENTITY_IMMUTABLE';
  end if;
  if old.status <> 'active' and new is distinct from old then
    raise exception using errcode = 'P0001', message = 'OVR_V11_COMPLETED_REVIEW_CYCLE_IMMUTABLE';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function ovr_v11_private.guard_cycle_update()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_review_cycle_guard on public.ovr_review_cycles;
create trigger trg_ovr_review_cycle_guard
before update or delete on public.ovr_review_cycles
for each row execute function ovr_v11_private.guard_cycle_update();

create or replace function ovr_v11_private.guard_stage_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'OVR_V11_STAGE_DELETE_DENIED';
  end if;
  if new.organization_id is distinct from old.organization_id
    or new.ovr_report_id is distinct from old.ovr_report_id
    or new.review_cycle_id is distinct from old.review_cycle_id
    or new.stage_type is distinct from old.stage_type
    or new.sequence_number is distinct from old.sequence_number
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_STAGE_IDENTITY_IMMUTABLE';
  end if;
  if old.lifecycle_status in ('completed', 'cancelled') and new is distinct from old then
    raise exception using errcode = 'P0001', message = 'OVR_V11_TERMINAL_STAGE_IMMUTABLE';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function ovr_v11_private.guard_stage_update()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_stage_guard on public.ovr_stage_instances;
create trigger trg_ovr_stage_guard
before update or delete on public.ovr_stage_instances
for each row execute function ovr_v11_private.guard_stage_update();

create or replace function ovr_v11_private.assert_service_caller()
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('role', true), ''),
    session_user
  ) <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'OVR_V11_SERVICE_ROLE_REQUIRED';
  end if;
end;
$$;

revoke all on function ovr_v11_private.assert_service_caller()
from public, anon, authenticated, service_role;

create or replace function ovr_v11_private.actor_organization_for_routing(
  p_actor_id uuid
)
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_organization_id uuid;
  v_role_count integer;
begin
  select p.organization_id into v_organization_id
  from public.profiles p
  join public.user_credential_states cs
    on cs.user_id = p.id
   and cs.organization_id = p.organization_id
  where p.id = p_actor_id
    and p.organization_id is not null
    and p.is_active
    and p.user_status = 'active'
    and cs.credential_state = 'active'
    and cs.identity_mode in ('legacy_verified', 'employee_id_managed');

  if v_organization_id is null then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ACTIVE_ACTOR_REQUIRED';
  end if;

  select count(*)::integer into v_role_count
  from public.user_roles ur
  where ur.user_id = p_actor_id
    and ur.is_active
    and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
    and ur.scope = 'global'
    and public.patch83u_role_assignment_valid(
      v_organization_id, ur.scope, ur.organization_id,
      ur.division_id, ur.department_id, ur.unit_id
    );

  if v_role_count <> 1 then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ROUTING_ACTOR_ROLE_REQUIRED';
  end if;
  return v_organization_id;
end;
$$;

revoke all on function ovr_v11_private.actor_organization_for_routing(uuid)
from public, anon, authenticated, service_role;

create or replace function public.ovr_v11_route_reviewer(
  p_actor_id uuid,
  p_ovr_report_id uuid,
  p_stage_instance_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, extensions, pg_temp
as $$
declare
  v_actor_org uuid;
  v_ovr public.ovr_reports%rowtype;
  v_state public.ovr_relationship_state%rowtype;
  v_cycle public.ovr_review_cycles%rowtype;
  v_stage public.ovr_stage_instances%rowtype;
  v_cycle_id uuid;
  v_existing public.ovr_reviewer_assignments%rowtype;
  v_idempotent_event public.ovr_routing_events%rowtype;
  v_primary_manager_count integer := 0;
  v_candidates jsonb := '[]'::jsonb;
  v_candidate_count integer := 0;
  v_selected jsonb;
  v_reviewer_id uuid;
  v_membership_id uuid;
  v_candidate_digest text;
  v_assignment_reason text;
  v_assignment public.ovr_reviewer_assignments%rowtype;
  v_block_reason text;
  v_request_digest text;
  v_response jsonb;
begin
  perform ovr_v11_private.assert_service_caller();
  if p_actor_id is null or p_ovr_report_id is null or p_stage_instance_id is null then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ROUTING_IDENTIFIERS_REQUIRED';
  end if;
  if p_idempotency_key is null
    or length(p_idempotency_key) not between 1 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ROUTING_IDEMPOTENCY_KEY_INVALID';
  end if;

  v_actor_org := ovr_v11_private.actor_organization_for_routing(p_actor_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'ovr-v11-route:' || v_actor_org::text || ':' || p_ovr_report_id::text,
      0
    )
  );

  select * into v_ovr
  from public.ovr_reports
  where id = p_ovr_report_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'OVR_V11_OVR_NOT_FOUND';
  end if;
  if v_ovr.organization_id is distinct from v_actor_org then
    raise exception using errcode = 'P0001', message = 'OVR_V11_CROSS_ORGANIZATION_DENIED';
  end if;
  select review_cycle_id into v_cycle_id
  from public.ovr_stage_instances
  where id = p_stage_instance_id
    and organization_id = v_actor_org
    and ovr_report_id = p_ovr_report_id;
  if v_cycle_id is null then
    raise exception using errcode = 'P0001', message = 'OVR_V11_STAGE_NOT_FOUND';
  end if;

  select * into v_cycle
  from public.ovr_review_cycles
  where id = v_cycle_id
    and organization_id = v_actor_org
    and ovr_report_id = p_ovr_report_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ACTIVE_REVIEW_CYCLE_REQUIRED';
  end if;

  select * into v_state
  from public.ovr_relationship_state
  where organization_id = v_actor_org
    and ovr_report_id = p_ovr_report_id
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'OVR_V11_RELATIONSHIP_STATE_REQUIRED';
  end if;

  -- Canonical P1 lock order for overlapping resources:
  -- advisory -> OVR -> cycle -> relationship state -> assignment -> stage.
  perform 1
  from public.ovr_reviewer_assignments a
  where a.organization_id = v_actor_org
    and a.ovr_report_id = p_ovr_report_id
    and a.review_cycle_id = v_cycle.id
    and a.stage_instance_id = p_stage_instance_id
  order by a.id
  for update;

  select * into v_stage
  from public.ovr_stage_instances
  where id = p_stage_instance_id
    and organization_id = v_actor_org
    and ovr_report_id = p_ovr_report_id
    and review_cycle_id = v_cycle.id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'OVR_V11_STAGE_NOT_FOUND';
  end if;
  v_request_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'operation', 'route_reviewer',
          'organization_id', v_actor_org,
          'ovr_report_id', p_ovr_report_id,
          'review_cycle_id', v_cycle.id,
          'stage_instance_id', p_stage_instance_id,
          'actor_id', p_actor_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select * into v_idempotent_event
  from public.ovr_routing_events e
  where e.organization_id = v_actor_org
    and e.idempotency_key = p_idempotency_key;
  if found then
    if v_idempotent_event.idempotency_operation is distinct from 'route_reviewer'
      or v_idempotent_event.ovr_report_id is distinct from p_ovr_report_id
      or v_idempotent_event.review_cycle_id is distinct from v_cycle.id
      or v_idempotent_event.stage_instance_id is distinct from p_stage_instance_id
      or v_idempotent_event.actor_id is distinct from p_actor_id
      or v_idempotent_event.idempotency_request_digest is distinct from v_request_digest
    then
      raise exception using errcode = 'P0001', message = 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED';
    end if;
    return v_idempotent_event.idempotency_response
      || jsonb_build_object('idempotent_replay', true);
  end if;

  -- Only a new operation is subject to the current mutable lifecycle state.
  -- A validated exact retry above replays its immutable original response even
  -- after the assignment, stage, cycle, or OVR has advanced.
  if v_ovr.status::text in ('closed', 'rejected', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'OVR_V11_TERMINAL_OVR_ROUTING_DENIED';
  end if;
  if v_cycle.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ACTIVE_REVIEW_CYCLE_REQUIRED';
  end if;
  if v_stage.lifecycle_status in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'OVR_V11_TERMINAL_STAGE_ROUTING_DENIED';
  end if;

  select * into v_existing
  from public.ovr_reviewer_assignments a
  where a.organization_id = v_actor_org
    and a.ovr_report_id = p_ovr_report_id
    and a.review_cycle_id = v_cycle.id
    and a.stage_instance_id = v_stage.id
    and a.status = 'active'
  limit 1;
  if found then
    v_response := jsonb_build_object(
      'status', 'assigned',
      'assignment_id', v_existing.id,
      'reviewer_profile_id', v_existing.reviewer_profile_id,
      'assignment_reason', v_existing.assignment_reason,
      'existing_assignment', true,
      'idempotent_replay', false
    );
    insert into public.ovr_routing_events (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      assignment_id, event_type, actor_id, candidate_profile_id,
      event_reason, candidate_digest, conflict_version, idempotency_key,
      idempotency_operation, idempotency_request_digest,
      idempotency_response, metadata
    ) values (
      v_actor_org, p_ovr_report_id, v_cycle.id, v_stage.id,
      v_existing.id, 'existing_assignment', p_actor_id,
      v_existing.reviewer_profile_id, 'stage_already_assigned',
      v_existing.candidate_digest, v_state.relationship_version,
      p_idempotency_key, 'route_reviewer', v_request_digest,
      v_response, '{}'::jsonb
    );
    return v_response;
  end if;

  insert into public.ovr_routing_events (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    event_type, actor_id, event_reason, conflict_version, metadata
  ) values (
    v_actor_org, p_ovr_report_id, v_cycle.id, v_stage.id,
    'routing_requested', p_actor_id, 'routing_requested',
    v_state.relationship_version,
    jsonb_build_object(
      'stage_type', v_stage.stage_type,
      'sensitivity', v_state.sensitivity
    )
  );

  if v_state.routing_status <> 'ready' then
    v_block_reason := coalesce(v_state.routing_block_reason, 'relationship_state_not_ready');
  elsif v_stage.stage_type = 'manager_review'
    and v_state.sensitivity <> 'retaliation_sensitive'
  then
    select count(*)::integer into v_primary_manager_count
    from public.organization_reporting_lines rl
    where rl.organization_id = v_actor_org
      and rl.employee_profile_id = v_ovr.reported_by
      and rl.relationship_type = 'direct'
      and rl.is_primary
      and rl.is_active
      and rl.confirmed_at is not null
      and rl.valid_from <= statement_timestamp()
      and (rl.valid_to is null or rl.valid_to > statement_timestamp());
    if v_primary_manager_count = 0 then
      v_block_reason := 'missing_primary_manager';
    elsif v_primary_manager_count > 1 then
      v_block_reason := 'ambiguous_primary_manager';
    end if;
  end if;

  if v_block_reason is not null then
    v_response := jsonb_build_object(
      'status', 'blocked',
      'reason', v_block_reason,
      'idempotent_replay', false
    );
    update public.ovr_stage_instances
    set lifecycle_status = 'blocked',
        routing_block_reason = v_block_reason,
        relationship_version = v_state.relationship_version
    where id = v_stage.id;
    insert into public.ovr_routing_events (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      event_type, actor_id, event_reason, conflict_version,
      idempotency_key, idempotency_operation, idempotency_request_digest,
      idempotency_response, metadata
    ) values (
      v_actor_org, p_ovr_report_id, v_cycle.id, v_stage.id,
      'no_eligible_reviewer', p_actor_id, v_block_reason,
      v_state.relationship_version, p_idempotency_key,
      'route_reviewer', v_request_digest, v_response,
      jsonb_build_object('candidate_count', 0)
    );
    return v_response;
  end if;

  insert into public.ovr_conflict_events (
    organization_id, ovr_report_id, related_person_id, reporting_line_id,
    affected_profile_id, event_type, protected_action, conflict_basis,
    actor_id, source_provenance, prior_relationship_version,
    current_relationship_version, metadata
  )
  select
    v_actor_org, p_ovr_report_id, c.related_person_id, c.reporting_line_id,
    c.affected_profile_id, 'conflict_detected', v_stage.stage_type,
    c.conflict_basis, p_actor_id, 'system_reconciliation',
    c.relationship_version, c.relationship_version,
    jsonb_build_object('stage_instance_id', v_stage.id)
  from ovr_v11_private.current_conflicts(
    v_actor_org, p_ovr_report_id, v_stage.stage_type, statement_timestamp()
  ) c
  on conflict do nothing;

  with eligible_memberships as (
    select
      m.id as membership_id,
      m.profile_id,
      m.scope,
      m.priority,
      m.valid_from,
      coalesce(workload.active_workload, 0)::integer as active_workload,
      history.last_assigned_at,
      role_proof.role_count
    from public.ovr_reviewer_pool_memberships m
    join public.profiles p
      on p.id = m.profile_id
     and p.organization_id = m.organization_id
     and p.is_active
     and p.user_status = 'active'
    join public.user_credential_states cs
      on cs.user_id = p.id
     and cs.organization_id = p.organization_id
     and cs.credential_state = 'active'
     and cs.identity_mode in ('legacy_verified', 'employee_id_managed')
    join lateral (
      select count(*)::integer as role_count
      from public.user_roles ur
      where ur.user_id = m.profile_id
        and ur.is_active
        and (
          (
            v_stage.stage_type = 'manager_review'
            and v_state.sensitivity <> 'retaliation_sensitive'
            and ur.role = 'department_manager'
            and ur.scope = 'department'
            and ur.organization_id = v_actor_org
            and ur.department_id = v_ovr.department_id
            and ur.division_id is null
            and ur.unit_id is null
          )
          or (
            not (
              v_stage.stage_type = 'manager_review'
              and v_state.sensitivity <> 'retaliation_sensitive'
            )
            and ur.role in ('super_admin', 'governance_admin', 'compliance_officer')
            and ur.scope = 'global'
            and public.patch83u_role_assignment_valid(
              v_actor_org, ur.scope, ur.organization_id,
              ur.division_id, ur.department_id, ur.unit_id
            )
          )
        )
    ) role_proof on role_proof.role_count = 1
    left join lateral (
      select count(*)::integer as active_workload
      from public.ovr_reviewer_assignments a
      where a.organization_id = m.organization_id
        and a.reviewer_profile_id = m.profile_id
        and a.status = 'active'
    ) workload on true
    left join lateral (
      select max(a.assigned_at) as last_assigned_at
      from public.ovr_reviewer_assignments a
      where a.organization_id = m.organization_id
        and a.reviewer_profile_id = m.profile_id
    ) history on true
    where m.organization_id = v_actor_org
      and m.is_active
      and m.valid_from <= statement_timestamp()
      and (m.valid_to is null or m.valid_to > statement_timestamp())
      and (
        (m.scope = 'global' and m.division_id is null and m.department_id is null)
        or (m.scope = 'division' and m.division_id = v_ovr.division_id)
        or (m.scope = 'department' and m.department_id = v_ovr.department_id)
      )
      and (v_state.sensitivity <> 'confidential' or m.confidential_clearance)
      and (v_state.sensitivity <> 'retaliation_sensitive' or m.retaliation_clearance)
      and (
        (
          v_stage.stage_type = 'manager_review'
          and v_state.sensitivity <> 'retaliation_sensitive'
          and m.capability = 'manager_review'
          and m.scope = 'department'
          and m.department_id = v_ovr.department_id
          and m.profile_id = (
            select rl.manager_profile_id
            from public.organization_reporting_lines rl
            where rl.organization_id = v_actor_org
              and rl.employee_profile_id = v_ovr.reported_by
              and rl.relationship_type = 'direct'
              and rl.is_primary
              and rl.is_active
              and rl.confirmed_at is not null
              and rl.valid_from <= statement_timestamp()
              and (rl.valid_to is null or rl.valid_to > statement_timestamp())
            limit 1
          )
        )
        or (
          v_stage.stage_type = 'manager_review'
          and v_state.sensitivity = 'retaliation_sensitive'
          and m.capability = 'quality_review'
          and m.retaliation_clearance
        )
        or (
          v_stage.stage_type <> 'manager_review'
          and m.capability = v_stage.stage_type
        )
      )
      and not exists (
        select 1
        from ovr_v11_private.current_conflicts(
          v_actor_org, p_ovr_report_id, v_stage.stage_type,
          statement_timestamp()
        ) conflict
        where conflict.affected_profile_id = m.profile_id
      )
      and not exists (
        select 1 from public.ovr_reviewer_assignments prior
        where prior.organization_id = v_actor_org
          and prior.stage_instance_id = v_stage.id
          and prior.reviewer_profile_id = m.profile_id
          and prior.status in ('recused', 'conflict_invalidated')
      )
  ), ranked_memberships as (
    select
      eligible_memberships.*,
      row_number() over (
        partition by profile_id
        order by
          case scope
            when 'department' then 1
            when 'division' then 2
            when 'global' then 3
            else 4
          end,
          priority,
          valid_from desc,
          membership_id
      ) as membership_rank
    from eligible_memberships
  ), candidate_memberships as (
    select *
    from ranked_memberships
    where membership_rank = 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'membership_id', membership_id,
        'profile_id', profile_id,
        'membership_scope', scope,
        'priority', priority,
        'membership_valid_from', valid_from,
        'active_workload', active_workload,
        'last_assigned_at', last_assigned_at
      ) order by priority, active_workload, last_assigned_at nulls first, profile_id
    ),
    '[]'::jsonb
  ) into v_candidates
  from candidate_memberships;

  v_candidate_count := jsonb_array_length(v_candidates);
  v_candidate_digest := encode(
    extensions.digest(convert_to(v_candidates::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.ovr_routing_events (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    event_type, actor_id, event_reason, candidate_digest,
    conflict_version, metadata
  ) values (
    v_actor_org, p_ovr_report_id, v_cycle.id, v_stage.id,
    'candidate_evaluated', p_actor_id, 'candidate_set_evaluated',
    v_candidate_digest, v_state.relationship_version,
    jsonb_build_object('candidate_count', v_candidate_count)
  );

  if v_candidate_count = 0 then
    v_block_reason := 'no_eligible_reviewer';
    v_response := jsonb_build_object(
      'status', 'blocked',
      'reason', v_block_reason,
      'candidate_digest', v_candidate_digest,
      'idempotent_replay', false
    );
    update public.ovr_stage_instances
    set lifecycle_status = 'blocked',
        routing_block_reason = v_block_reason,
        relationship_version = v_state.relationship_version
    where id = v_stage.id;
    insert into public.ovr_routing_events (
      organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
      event_type, actor_id, event_reason, candidate_digest,
      conflict_version, idempotency_key, idempotency_operation,
      idempotency_request_digest, idempotency_response, metadata
    ) values (
      v_actor_org, p_ovr_report_id, v_cycle.id, v_stage.id,
      'no_eligible_reviewer', p_actor_id, v_block_reason,
      v_candidate_digest, v_state.relationship_version, p_idempotency_key,
      'route_reviewer', v_request_digest, v_response,
      jsonb_build_object('candidate_count', 0)
    );
    return v_response;
  end if;

  v_selected := v_candidates->0;
  v_reviewer_id := (v_selected->>'profile_id')::uuid;
  v_membership_id := (v_selected->>'membership_id')::uuid;
  v_assignment_reason := case
    when v_stage.stage_type = 'manager_review'
      and v_state.sensitivity = 'retaliation_sensitive'
      then 'retaliation_sensitive_quality_bypass'
    when v_stage.stage_type = 'manager_review'
      then 'confirmed_primary_direct_manager'
    else 'cleared_reviewer_pool'
  end;

  insert into public.ovr_reviewer_assignments (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    reviewer_profile_id, reviewer_membership_id, status, assignment_reason,
    candidate_digest, conflict_version, assigned_at, idempotency_key
  ) values (
    v_actor_org, p_ovr_report_id, v_cycle.id, v_stage.id,
    v_reviewer_id, v_membership_id, 'active', v_assignment_reason,
    v_candidate_digest, v_state.relationship_version,
    statement_timestamp(), p_idempotency_key
  ) returning * into v_assignment;

  update public.ovr_stage_instances
  set lifecycle_status = 'assigned',
      routing_block_reason = null,
      relationship_version = v_state.relationship_version
  where id = v_stage.id;

  v_response := jsonb_build_object(
    'status', 'assigned',
    'assignment_id', v_assignment.id,
    'reviewer_profile_id', v_reviewer_id,
    'assignment_reason', v_assignment_reason,
    'candidate_digest', v_candidate_digest,
    'conflict_version', v_state.relationship_version,
    'idempotent_replay', false
  );

  insert into public.ovr_routing_events (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    assignment_id, event_type, actor_id, candidate_profile_id,
    event_reason, candidate_digest, conflict_version, idempotency_key,
    idempotency_operation, idempotency_request_digest,
    idempotency_response, metadata
  ) values (
    v_actor_org, p_ovr_report_id, v_cycle.id, v_stage.id,
    v_assignment.id,
    case when exists (
      select 1
      from public.ovr_reviewer_assignments prior
      where prior.organization_id = v_actor_org
        and prior.stage_instance_id = v_stage.id
        and prior.id <> v_assignment.id
        and prior.status in ('recused', 'conflict_invalidated')
    ) then 'reassignment' else 'assignment_created' end,
    p_actor_id, v_reviewer_id,
    v_assignment_reason, v_candidate_digest, v_state.relationship_version,
    p_idempotency_key, 'route_reviewer', v_request_digest, v_response,
    jsonb_build_object(
      'candidate_count', v_candidate_count,
      'membership_id', v_membership_id,
      'membership_scope', v_selected->>'membership_scope',
      'membership_priority', (v_selected->>'priority')::integer,
      'membership_valid_from', v_selected->>'membership_valid_from',
      'membership_selection_basis', 'scope_specificity_priority_valid_from_membership_uuid'
    )
  );

  return v_response;
end;
$$;

revoke all on function public.ovr_v11_route_reviewer(uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.ovr_v11_route_reviewer(uuid, uuid, uuid, text)
to service_role;

create or replace function public.ovr_v11_recuse_assignment(
  p_actor_id uuid,
  p_assignment_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_actor_org uuid;
  v_assignment public.ovr_reviewer_assignments%rowtype;
  v_stage public.ovr_stage_instances%rowtype;
  v_existing public.ovr_routing_events%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request_digest text;
  v_response jsonb;
begin
  perform ovr_v11_private.assert_service_caller();
  if v_reason is null or length(v_reason) > 500 then
    raise exception using errcode = 'P0001', message = 'OVR_V11_RECUSAL_REASON_REQUIRED';
  end if;
  if p_idempotency_key is null
    or length(p_idempotency_key) not between 1 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$'
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ROUTING_IDEMPOTENCY_KEY_INVALID';
  end if;

  v_actor_org := ovr_v11_private.actor_organization_for_routing(p_actor_id);

  select * into v_assignment
  from public.ovr_reviewer_assignments
  where id = p_assignment_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ASSIGNMENT_NOT_FOUND';
  end if;
  if v_assignment.organization_id is distinct from v_actor_org then
    raise exception using errcode = 'P0001', message = 'OVR_V11_CROSS_ORGANIZATION_DENIED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'ovr-v11-route:' || v_actor_org::text || ':' || v_assignment.ovr_report_id::text,
      0
    )
  );

  select * into v_assignment
  from public.ovr_reviewer_assignments
  where id = p_assignment_id
  for update;

  select * into v_stage
  from public.ovr_stage_instances
  where id = v_assignment.stage_instance_id
  for update;

  v_request_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'operation', 'recuse_assignment',
          'organization_id', v_actor_org,
          'ovr_report_id', v_assignment.ovr_report_id,
          'review_cycle_id', v_assignment.review_cycle_id,
          'stage_instance_id', v_assignment.stage_instance_id,
          'assignment_id', p_assignment_id,
          'actor_id', p_actor_id,
          'reason', v_reason
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select * into v_existing
  from public.ovr_routing_events
  where organization_id = v_actor_org
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.idempotency_operation is distinct from 'recuse_assignment'
      or v_existing.ovr_report_id is distinct from v_assignment.ovr_report_id
      or v_existing.review_cycle_id is distinct from v_assignment.review_cycle_id
      or v_existing.stage_instance_id is distinct from v_assignment.stage_instance_id
      or v_existing.assignment_id is distinct from p_assignment_id
      or v_existing.actor_id is distinct from p_actor_id
      or v_existing.idempotency_request_digest is distinct from v_request_digest
    then
      raise exception using errcode = 'P0001', message = 'OVR_V11_IDEMPOTENCY_KEY_REUSE_DENIED';
    end if;
    return v_existing.idempotency_response
      || jsonb_build_object('idempotent_replay', true);
  end if;

  if v_assignment.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'OVR_V11_ACTIVE_ASSIGNMENT_REQUIRED';
  end if;

  update public.ovr_reviewer_assignments
  set status = 'recused',
      ended_at = statement_timestamp(),
      termination_reason = v_reason,
      recusal_reason = v_reason,
      updated_at = statement_timestamp()
  where id = p_assignment_id;

  update public.ovr_stage_instances
  set lifecycle_status = 'pending',
      routing_block_reason = null
  where id = v_stage.id;

  v_response := jsonb_build_object(
    'status', 'recused',
    'assignment_id', p_assignment_id,
    'reviewer_profile_id', v_assignment.reviewer_profile_id,
    'idempotent_replay', false
  );

  insert into public.ovr_routing_events (
    organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
    assignment_id, event_type, actor_id, candidate_profile_id,
    event_reason, candidate_digest, conflict_version,
    idempotency_key, idempotency_operation, idempotency_request_digest,
    idempotency_response, metadata
  ) values (
    v_actor_org, v_assignment.ovr_report_id, v_assignment.review_cycle_id,
    v_assignment.stage_instance_id, v_assignment.id, 'recused', p_actor_id,
    v_assignment.reviewer_profile_id, v_reason,
    v_assignment.candidate_digest, v_assignment.conflict_version,
    p_idempotency_key, 'recuse_assignment', v_request_digest,
    v_response, '{}'::jsonb
  );

  return v_response;
end;
$$;

revoke all on function public.ovr_v11_recuse_assignment(uuid, uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.ovr_v11_recuse_assignment(uuid, uuid, text, text)
to service_role;

create or replace function ovr_v11_private.invalidate_conflicted_assignments()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_assignment record;
  v_conflict record;
begin
  if new.relationship_version <= old.relationship_version then
    return new;
  end if;

  for v_assignment in
    select a.*, s.stage_type
    from public.ovr_reviewer_assignments a
    join public.ovr_stage_instances s on s.id = a.stage_instance_id
    where a.organization_id = new.organization_id
      and a.ovr_report_id = new.ovr_report_id
      and a.status = 'active'
    order by a.stage_instance_id, a.id
    for update of a
  loop
    select * into v_conflict
    from ovr_v11_private.current_conflicts(
      new.organization_id, new.ovr_report_id,
      v_assignment.stage_type, statement_timestamp()
    ) c
    where c.affected_profile_id = v_assignment.reviewer_profile_id
    order by c.conflict_basis, c.related_person_id nulls last
    limit 1;

    if found then
      update public.ovr_reviewer_assignments
      set status = 'conflict_invalidated',
          ended_at = statement_timestamp(),
          termination_reason = 'relationship_conflict:' || v_conflict.conflict_basis,
          updated_at = statement_timestamp()
      where id = v_assignment.id;

      update public.ovr_stage_instances
      set lifecycle_status = 'blocked',
          routing_block_reason = 'assigned_reviewer_conflict',
          relationship_version = new.relationship_version
      where id = v_assignment.stage_instance_id;

      insert into public.ovr_conflict_events (
        organization_id, ovr_report_id, related_person_id, reporting_line_id,
        affected_profile_id, event_type, protected_action, conflict_basis,
        actor_id, source_provenance, prior_relationship_version,
        current_relationship_version, metadata
      ) values (
        new.organization_id, new.ovr_report_id,
        v_conflict.related_person_id, v_conflict.reporting_line_id,
        v_assignment.reviewer_profile_id, 'conflict_detected',
        v_assignment.stage_type, v_conflict.conflict_basis,
        null, 'system_reconciliation', old.relationship_version,
        new.relationship_version,
        jsonb_build_object('assignment_id', v_assignment.id)
      ) on conflict do nothing;

      insert into public.ovr_routing_events (
        organization_id, ovr_report_id, review_cycle_id, stage_instance_id,
        assignment_id, event_type, actor_id, candidate_profile_id,
        event_reason, candidate_digest, conflict_version, metadata
      ) values (
        new.organization_id, new.ovr_report_id,
        v_assignment.review_cycle_id, v_assignment.stage_instance_id,
        v_assignment.id, 'conflict_invalidated',
        coalesce(
          (
            select rp.asserted_by from public.ovr_related_persons rp
            where rp.id = v_conflict.related_person_id
          ),
          v_assignment.reviewer_profile_id
        ),
        v_assignment.reviewer_profile_id,
        'relationship_conflict:' || v_conflict.conflict_basis,
        v_assignment.candidate_digest, new.relationship_version,
        jsonb_build_object(
          'previous_conflict_version', v_assignment.conflict_version,
          'conflict_basis', v_conflict.conflict_basis
        )
      );
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function ovr_v11_private.invalidate_conflicted_assignments()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_relationship_state_invalidate_assignments
on public.ovr_relationship_state;
create trigger trg_ovr_relationship_state_invalidate_assignments
after update of relationship_version on public.ovr_relationship_state
for each row execute function ovr_v11_private.invalidate_conflicted_assignments();

-- Fail-closed table surface. No app role receives raw access in P1.
alter table public.ovr_reviewer_pool_memberships enable row level security;
alter table public.ovr_reviewer_pool_memberships force row level security;
alter table public.ovr_review_cycles enable row level security;
alter table public.ovr_review_cycles force row level security;
alter table public.ovr_stage_instances enable row level security;
alter table public.ovr_stage_instances force row level security;
alter table public.ovr_reviewer_assignments enable row level security;
alter table public.ovr_reviewer_assignments force row level security;
alter table public.ovr_routing_events enable row level security;
alter table public.ovr_routing_events force row level security;

revoke all on table public.ovr_reviewer_pool_memberships from public, anon, authenticated, service_role;
revoke all on table public.ovr_review_cycles from public, anon, authenticated, service_role;
revoke all on table public.ovr_stage_instances from public, anon, authenticated, service_role;
revoke all on table public.ovr_reviewer_assignments from public, anon, authenticated, service_role;
revoke all on table public.ovr_routing_events from public, anon, authenticated, service_role;

grant select, insert, update on table public.ovr_reviewer_pool_memberships to service_role;
grant select, insert, update on table public.ovr_review_cycles to service_role;
grant select, insert, update on table public.ovr_stage_instances to service_role;
grant select, insert, update on table public.ovr_reviewer_assignments to service_role;
grant select, insert on table public.ovr_routing_events to service_role;

comment on table public.ovr_reviewer_pool_memberships is
  'GRC v1.1 explicit reviewer capabilities and clearances. Membership does not create a broad app role and role alone does not create reviewer authority.';
comment on table public.ovr_review_cycles is
  'GRC v1.1 revision-aware review-cycle identity. Existing v98 OVR state remains unchanged until later cutover.';
comment on table public.ovr_stage_instances is
  'GRC v1.1 persistent controlled-stage instance with due time and relationship version used for routing.';
comment on table public.ovr_reviewer_assignments is
  'GRC v1.1 workflow assignments. Assignments are intentionally not represented in ovr_related_persons.';
comment on table public.ovr_routing_events is
  'GRC v1.1 append-only deterministic reviewer-routing evidence.';
comment on function public.ovr_v11_route_reviewer(uuid, uuid, uuid, text) is
  'Service-role-only deterministic routing with tenant proof, advisory locking, current conflict evaluation, exact role proof, clearance checks, idempotency, and no implicit fallback.';
comment on function public.ovr_v11_recuse_assignment(uuid, uuid, text, text) is
  'Service-role-only assignment recusal. Ends the active assignment and preserves append-only routing evidence.';

commit;
