-- GRC v1.1 OVR Phase 2 P1 - relationship and conflict foundation.
-- Additive only: no v1.0.0 policy, workflow function, OVR status, or business
-- field is replaced. New objects are service-controlled until the later v1.1
-- enforcement migration.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create schema if not exists ovr_v11_private;
revoke all on schema ovr_v11_private from public, anon, authenticated, service_role;

-- Composite tenant keys allow every new reference to prove organization and
-- object identity in one foreign key. These constraints do not rewrite rows.
do $p1_composite_keys$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'profiles_organization_id_id_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_organization_id_id_key unique (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'ovr_reports_organization_id_id_key'
      and conrelid = 'public.ovr_reports'::regclass
  ) then
    alter table public.ovr_reports
      add constraint ovr_reports_organization_id_id_key unique (organization_id, id);
  end if;
end;
$p1_composite_keys$;

create table if not exists public.organization_reporting_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  employee_profile_id uuid not null,
  manager_profile_id uuid not null,
  relationship_type text not null check (relationship_type in ('direct', 'dotted_line')),
  is_primary boolean not null default false,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  provenance text not null check (provenance in (
    'hr_import', 'operator_confirmation', 'governance_confirmation',
    'migration_backfill', 'system_reconciliation'
  )),
  asserted_by uuid,
  confirmed_by uuid,
  confirmed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint organization_reporting_lines_employee_org_fkey
    foreign key (organization_id, employee_profile_id)
    references public.profiles(organization_id, id) on delete restrict,
  constraint organization_reporting_lines_manager_org_fkey
    foreign key (organization_id, manager_profile_id)
    references public.profiles(organization_id, id) on delete restrict,
  constraint organization_reporting_lines_asserted_by_org_fkey
    foreign key (organization_id, asserted_by)
    references public.profiles(organization_id, id) on delete restrict,
  constraint organization_reporting_lines_confirmed_by_org_fkey
    foreign key (organization_id, confirmed_by)
    references public.profiles(organization_id, id) on delete restrict,
  constraint organization_reporting_lines_no_self check (employee_profile_id <> manager_profile_id),
  constraint organization_reporting_lines_primary_type check (
    (is_primary and relationship_type = 'direct')
    or (not is_primary and relationship_type = 'dotted_line')
  ),
  constraint organization_reporting_lines_effective_dates check (
    valid_to is null or valid_to > valid_from
  ),
  constraint organization_reporting_lines_confirmation check (
    (confirmed_by is null and confirmed_at is null)
    or (confirmed_by is not null and confirmed_at is not null)
  ),
  constraint organization_reporting_lines_org_id_key unique (organization_id, id)
);

create unique index if not exists uq_organization_reporting_lines_active_primary
  on public.organization_reporting_lines (organization_id, employee_profile_id)
  where is_active and is_primary;
create index if not exists idx_organization_reporting_lines_employee_current
  on public.organization_reporting_lines (organization_id, employee_profile_id, valid_from, valid_to)
  where is_active;
create index if not exists idx_organization_reporting_lines_manager_current
  on public.organization_reporting_lines (organization_id, manager_profile_id, valid_from, valid_to)
  where is_active;
create index if not exists idx_organization_reporting_lines_asserted_by
  on public.organization_reporting_lines (organization_id, asserted_by)
  where asserted_by is not null;
create index if not exists idx_organization_reporting_lines_confirmed_by
  on public.organization_reporting_lines (organization_id, confirmed_by)
  where confirmed_by is not null;

create table if not exists public.ovr_relationship_state (
  ovr_report_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sensitivity text not null default 'normal' check (
    sensitivity in ('normal', 'confidential', 'retaliation_sensitive')
  ),
  routing_status text not null default 'legacy_unresolved' check (
    routing_status in ('legacy_unresolved', 'ready', 'blocked')
  ),
  routing_block_reason text,
  relationship_version bigint not null default 0 check (relationship_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ovr_relationship_state_ovr_org_fkey
    foreign key (organization_id, ovr_report_id)
    references public.ovr_reports(organization_id, id) on delete cascade,
  constraint ovr_relationship_state_block_contract check (
    (routing_status = 'ready' and routing_block_reason is null)
    or (
      routing_status <> 'ready'
      and length(btrim(coalesce(routing_block_reason, ''))) between 1 and 200
    )
  )
);

create index if not exists idx_ovr_relationship_state_org_status
  on public.ovr_relationship_state (organization_id, routing_status, sensitivity);
create index if not exists idx_ovr_relationship_state_org_ovr
  on public.ovr_relationship_state (organization_id, ovr_report_id);

create table if not exists public.ovr_related_persons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  profile_id uuid,
  non_user_subject_key text,
  relationship_type text not null check (relationship_type in (
    'reporter', 'involved_person', 'subject', 'referred_party', 'witness', 'other'
  )),
  provenance text not null check (provenance in (
    'report_submission', 'quality_confirmation', 'referral', 'self_disclosure',
    'governance_determination', 'legacy_backfill', 'system_reconciliation'
  )),
  asserted_by uuid,
  confirmed_by uuid,
  confirmation_status text not null default 'asserted' check (
    confirmation_status in ('asserted', 'confirmed', 'disputed', 'rejected')
  ),
  confirmed_at timestamptz,
  conflict_actions text[] not null default '{}'::text[],
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  is_recused boolean not null default false,
  recused_by uuid,
  recused_at timestamptz,
  recusal_reason text,
  revision bigint not null default 1 check (revision >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ovr_related_persons_ovr_org_fkey
    foreign key (organization_id, ovr_report_id)
    references public.ovr_reports(organization_id, id) on delete cascade,
  constraint ovr_related_persons_profile_org_fkey
    foreign key (organization_id, profile_id)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_related_persons_asserted_by_org_fkey
    foreign key (organization_id, asserted_by)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_related_persons_confirmed_by_org_fkey
    foreign key (organization_id, confirmed_by)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_related_persons_recused_by_org_fkey
    foreign key (organization_id, recused_by)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_related_persons_subject_identity check (
    (profile_id is not null and non_user_subject_key is null)
    or (
      profile_id is null
      and length(btrim(coalesce(non_user_subject_key, ''))) between 1 and 128
      and non_user_subject_key ~ '^[A-Za-z0-9._:-]+$'
    )
  ),
  constraint ovr_related_persons_effective_dates check (
    valid_to is null or valid_to > valid_from
  ),
  constraint ovr_related_persons_confirmation check (
    (
      confirmation_status = 'confirmed'
      and confirmed_by is not null
      and confirmed_at is not null
    )
    or confirmation_status <> 'confirmed'
  ),
  constraint ovr_related_persons_recusal check (
    (
      not is_recused and recused_by is null and recused_at is null
      and recusal_reason is null
    )
    or (
      is_recused and recused_by is not null and recused_at is not null
      and length(btrim(coalesce(recusal_reason, ''))) between 1 and 500
    )
  ),
  constraint ovr_related_persons_conflict_actions check (
    conflict_actions <@ array[
      'manager_review', 'quality_review', 'final_verdict',
      'evidence_governance', 'governance_closure'
    ]::text[]
  ),
  constraint ovr_related_persons_org_ovr_id_key unique (
    organization_id, ovr_report_id, id
  )
);

create unique index if not exists uq_ovr_related_persons_active_identity
  on public.ovr_related_persons (
    organization_id,
    ovr_report_id,
    coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(non_user_subject_key, ''),
    relationship_type
  ) where is_active;
create index if not exists idx_ovr_related_persons_ovr_current
  on public.ovr_related_persons (
    organization_id, ovr_report_id, relationship_type, confirmation_status,
    valid_from, valid_to
  ) where is_active;
create index if not exists idx_ovr_related_persons_profile_current
  on public.ovr_related_persons (organization_id, profile_id, ovr_report_id)
  where is_active and profile_id is not null;
create index if not exists idx_ovr_related_persons_asserted_by
  on public.ovr_related_persons (organization_id, asserted_by)
  where asserted_by is not null;
create index if not exists idx_ovr_related_persons_confirmed_by
  on public.ovr_related_persons (organization_id, confirmed_by)
  where confirmed_by is not null;
create index if not exists idx_ovr_related_persons_recused_by
  on public.ovr_related_persons (organization_id, recused_by)
  where recused_by is not null;

create table if not exists public.ovr_conflict_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ovr_report_id uuid not null,
  related_person_id uuid,
  reporting_line_id uuid,
  affected_profile_id uuid,
  event_type text not null check (event_type in (
    'relationship_added', 'relationship_updated', 'relationship_deactivated',
    'relationship_recused', 'reporting_line_changed', 'conflict_detected'
  )),
  protected_action text check (
    protected_action is null or protected_action in (
      'manager_review', 'quality_review', 'final_verdict',
      'evidence_governance', 'governance_closure'
    )
  ),
  conflict_basis text not null,
  actor_id uuid,
  source_provenance text not null,
  prior_relationship_version bigint,
  current_relationship_version bigint not null check (current_relationship_version >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint ovr_conflict_events_ovr_org_fkey
    foreign key (organization_id, ovr_report_id)
    references public.ovr_reports(organization_id, id) on delete cascade,
  constraint ovr_conflict_events_affected_profile_org_fkey
    foreign key (organization_id, affected_profile_id)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_conflict_events_actor_org_fkey
    foreign key (organization_id, actor_id)
    references public.profiles(organization_id, id) on delete restrict,
  constraint ovr_conflict_events_related_person_context_fkey
    foreign key (organization_id, ovr_report_id, related_person_id)
    references public.ovr_related_persons(organization_id, ovr_report_id, id)
    on delete restrict,
  constraint ovr_conflict_events_reporting_line_org_fkey
    foreign key (organization_id, reporting_line_id)
    references public.organization_reporting_lines(organization_id, id)
    on delete restrict,
  constraint ovr_conflict_events_version_order check (
    prior_relationship_version is null
    or current_relationship_version >= prior_relationship_version
  ),
  constraint ovr_conflict_events_source_required check (
    num_nonnulls(related_person_id, reporting_line_id) between 1 and 2
  )
);

create index if not exists idx_ovr_conflict_events_ovr_time
  on public.ovr_conflict_events (organization_id, ovr_report_id, occurred_at desc);
create index if not exists idx_ovr_conflict_events_profile_action
  on public.ovr_conflict_events (
    organization_id, affected_profile_id, protected_action, occurred_at desc
  ) where affected_profile_id is not null;
create index if not exists idx_ovr_conflict_events_related_person
  on public.ovr_conflict_events (related_person_id)
  where related_person_id is not null;
create index if not exists idx_ovr_conflict_events_reporting_line
  on public.ovr_conflict_events (reporting_line_id)
  where reporting_line_id is not null;
create index if not exists idx_ovr_conflict_events_actor_org
  on public.ovr_conflict_events (organization_id, actor_id)
  where actor_id is not null;
create unique index if not exists uq_ovr_conflict_events_detected_version
  on public.ovr_conflict_events (
    organization_id, ovr_report_id, affected_profile_id, protected_action,
    current_relationship_version, conflict_basis
  ) where event_type = 'conflict_detected';

create or replace function ovr_v11_private.guard_append_only()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = case tg_table_name
    when 'ovr_conflict_events' then 'OVR_V11_CONFLICT_EVENTS_APPEND_ONLY'
    else 'OVR_V11_APPEND_ONLY'
  end;
end;
$$;

revoke all on function ovr_v11_private.guard_append_only()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_conflict_events_append_only on public.ovr_conflict_events;
create trigger trg_ovr_conflict_events_append_only
before update or delete on public.ovr_conflict_events
for each statement execute function ovr_v11_private.guard_append_only();

create or replace function ovr_v11_private.guard_reporting_line_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'OVR_V11_REPORTING_LINES_DELETE_DENIED';
  end if;
  if new.organization_id is distinct from old.organization_id
    or new.employee_profile_id is distinct from old.employee_profile_id
    or new.manager_profile_id is distinct from old.manager_profile_id
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_REPORTING_LINE_IDENTITY_IMMUTABLE';
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function ovr_v11_private.guard_reporting_line_change()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_reporting_line_guard on public.organization_reporting_lines;
create trigger trg_ovr_reporting_line_guard
before update or delete on public.organization_reporting_lines
for each row execute function ovr_v11_private.guard_reporting_line_change();

create or replace function ovr_v11_private.guard_related_person_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = 'P0001', message = 'OVR_V11_RELATED_PERSON_DELETE_DENIED';
  end if;
  if new.organization_id is distinct from old.organization_id
    or new.ovr_report_id is distinct from old.ovr_report_id
    or new.profile_id is distinct from old.profile_id
    or new.non_user_subject_key is distinct from old.non_user_subject_key
  then
    raise exception using errcode = 'P0001', message = 'OVR_V11_RELATED_PERSON_IDENTITY_IMMUTABLE';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function ovr_v11_private.guard_related_person_change()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_related_person_guard on public.ovr_related_persons;
create trigger trg_ovr_related_person_guard
before update or delete on public.ovr_related_persons
for each row execute function ovr_v11_private.guard_related_person_change();

create or replace function ovr_v11_private.record_related_person_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_prior bigint;
  v_current bigint;
  v_event_type text;
  v_actor uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'ovr-v11-route:' || new.organization_id::text || ':' || new.ovr_report_id::text,
      0
    )
  );

  select relationship_version into v_prior
  from public.ovr_relationship_state
  where organization_id = new.organization_id
    and ovr_report_id = new.ovr_report_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'OVR_V11_RELATIONSHIP_STATE_REQUIRED';
  end if;

  update public.ovr_relationship_state
  set relationship_version = relationship_version + 1,
      updated_at = statement_timestamp()
  where organization_id = new.organization_id
    and ovr_report_id = new.ovr_report_id
  returning relationship_version into v_current;

  v_event_type := case
    when tg_op = 'INSERT' then 'relationship_added'
    when new.is_recused and not old.is_recused then 'relationship_recused'
    when not new.is_active and old.is_active then 'relationship_deactivated'
    else 'relationship_updated'
  end;
  v_actor := coalesce(new.recused_by, new.confirmed_by, new.asserted_by);

  insert into public.ovr_conflict_events (
    organization_id, ovr_report_id, related_person_id, affected_profile_id,
    event_type, conflict_basis, actor_id, source_provenance,
    prior_relationship_version, current_relationship_version, metadata
  ) values (
    new.organization_id, new.ovr_report_id, new.id, new.profile_id,
    v_event_type, new.relationship_type, v_actor, new.provenance,
    v_prior, v_current,
    jsonb_build_object(
      'confirmation_status', new.confirmation_status,
      'is_active', new.is_active,
      'is_recused', new.is_recused,
      'revision', new.revision
    )
  );
  return new;
end;
$$;

revoke all on function ovr_v11_private.record_related_person_change()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_related_person_record_change on public.ovr_related_persons;
create trigger trg_ovr_related_person_record_change
after insert or update on public.ovr_related_persons
for each row execute function ovr_v11_private.record_related_person_change();

create or replace function ovr_v11_private.record_reporting_line_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_relation record;
  v_prior bigint;
  v_current bigint;
  v_actor uuid;
begin
  v_actor := coalesce(new.confirmed_by, new.asserted_by);
  for v_relation in
    select distinct rp.organization_id, rp.ovr_report_id
    from public.ovr_related_persons rp
    where rp.organization_id = new.organization_id
      and rp.profile_id = new.employee_profile_id
      and rp.relationship_type in ('reporter', 'involved_person', 'subject', 'referred_party')
      and rp.is_active
      and rp.confirmation_status <> 'rejected'
    order by rp.organization_id, rp.ovr_report_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'ovr-v11-route:' || v_relation.organization_id::text || ':' || v_relation.ovr_report_id::text,
        0
      )
    );

    select relationship_version into v_prior
    from public.ovr_relationship_state
    where organization_id = v_relation.organization_id
      and ovr_report_id = v_relation.ovr_report_id
    for update;

    update public.ovr_relationship_state
    set relationship_version = relationship_version + 1,
        updated_at = statement_timestamp()
    where organization_id = v_relation.organization_id
      and ovr_report_id = v_relation.ovr_report_id
    returning relationship_version into v_current;

    insert into public.ovr_conflict_events (
      organization_id, ovr_report_id, reporting_line_id, affected_profile_id,
      event_type, conflict_basis, actor_id, source_provenance,
      prior_relationship_version, current_relationship_version, metadata
    ) values (
      v_relation.organization_id, v_relation.ovr_report_id, new.id,
      new.manager_profile_id, 'reporting_line_changed',
      'manager_relationship_changed', v_actor, new.provenance,
      v_prior, v_current,
      jsonb_build_object(
        'relationship_type', new.relationship_type,
        'is_primary', new.is_primary,
        'is_active', new.is_active
      )
    );
  end loop;
  return new;
end;
$$;

revoke all on function ovr_v11_private.record_reporting_line_change()
from public, anon, authenticated, service_role;

drop trigger if exists trg_ovr_reporting_line_record_change on public.organization_reporting_lines;
create trigger trg_ovr_reporting_line_record_change
after insert or update on public.organization_reporting_lines
for each row execute function ovr_v11_private.record_reporting_line_change();

create or replace function ovr_v11_private.current_conflicts(
  p_organization_id uuid,
  p_ovr_report_id uuid,
  p_protected_action text,
  p_as_of timestamptz default statement_timestamp()
)
returns table (
  affected_profile_id uuid,
  conflict_basis text,
  related_person_id uuid,
  reporting_line_id uuid,
  relationship_version bigint
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, ovr_v11_private, pg_temp
as $$
declare
  v_version bigint;
begin
  if p_protected_action not in (
    'manager_review', 'quality_review', 'final_verdict',
    'evidence_governance', 'governance_closure'
  ) then
    raise exception using errcode = 'P0001', message = 'OVR_V11_PROTECTED_ACTION_INVALID';
  end if;

  select s.relationship_version into v_version
  from public.ovr_relationship_state s
  where s.organization_id = p_organization_id
    and s.ovr_report_id = p_ovr_report_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'OVR_V11_RELATIONSHIP_STATE_REQUIRED';
  end if;

  return query
  with effective_related as (
    select rp.*
    from public.ovr_related_persons rp
    where rp.organization_id = p_organization_id
      and rp.ovr_report_id = p_ovr_report_id
      and rp.profile_id is not null
      and rp.is_active
      and rp.confirmation_status <> 'rejected'
      and rp.valid_from <= p_as_of
      and (rp.valid_to is null or rp.valid_to > p_as_of)
  ), direct_conflicts as (
    select
      rp.profile_id as affected_profile_id,
      rp.relationship_type as conflict_basis,
      rp.id as related_person_id,
      null::uuid as reporting_line_id
    from effective_related rp
    where (
      rp.relationship_type in ('reporter', 'involved_person', 'subject', 'referred_party')
      or (
        rp.relationship_type = 'witness'
        and p_protected_action in (
          'quality_review', 'final_verdict', 'evidence_governance', 'governance_closure'
        )
      )
      or p_protected_action = any(rp.conflict_actions)
    )
  ), manager_conflicts as (
    select
      rl.manager_profile_id as affected_profile_id,
      case rp.relationship_type
        when 'reporter' then 'manager_of_reporter'
        when 'involved_person' then 'manager_of_involved_person'
        when 'subject' then 'manager_of_subject'
        when 'referred_party' then 'manager_of_referred_party'
      end as conflict_basis,
      rp.id as related_person_id,
      rl.id as reporting_line_id
    from effective_related rp
    join public.organization_reporting_lines rl
      on rl.organization_id = rp.organization_id
     and rl.employee_profile_id = rp.profile_id
     and rl.is_active
     and rl.confirmed_at is not null
     and rl.valid_from <= p_as_of
     and (rl.valid_to is null or rl.valid_to > p_as_of)
    where (
      rp.relationship_type in ('involved_person', 'subject', 'referred_party')
      or (
        rp.relationship_type = 'reporter'
        and p_protected_action <> 'manager_review'
      )
    )
  )
  select distinct
    c.affected_profile_id,
    c.conflict_basis,
    c.related_person_id,
    c.reporting_line_id,
    v_version
  from (
    select * from direct_conflicts
    union all
    select * from manager_conflicts
  ) c;
end;
$$;

revoke all on function ovr_v11_private.current_conflicts(uuid, uuid, text, timestamptz)
from public, anon, authenticated, service_role;

-- Fail-closed table surface. P1 grants no raw browser read policy; future
-- governed operations must use narrow service RPCs.
alter table public.organization_reporting_lines enable row level security;
alter table public.organization_reporting_lines force row level security;
alter table public.ovr_relationship_state enable row level security;
alter table public.ovr_relationship_state force row level security;
alter table public.ovr_related_persons enable row level security;
alter table public.ovr_related_persons force row level security;
alter table public.ovr_conflict_events enable row level security;
alter table public.ovr_conflict_events force row level security;

revoke all on table public.organization_reporting_lines from public, anon, authenticated, service_role;
revoke all on table public.ovr_relationship_state from public, anon, authenticated, service_role;
revoke all on table public.ovr_related_persons from public, anon, authenticated, service_role;
revoke all on table public.ovr_conflict_events from public, anon, authenticated, service_role;

grant select, insert, update on table public.organization_reporting_lines to service_role;
grant select, insert, update on table public.ovr_relationship_state to service_role;
grant select, insert, update on table public.ovr_related_persons to service_role;
grant select, insert on table public.ovr_conflict_events to service_role;

-- Legacy backfill is deliberately conservative. Only canonical UUID fields are
-- copied. No manager is inferred from department membership, no legacy OVR row
-- is updated, and all cases remain v1.1-routing unresolved until reviewed.
insert into public.ovr_relationship_state (
  organization_id, ovr_report_id, sensitivity, routing_status,
  routing_block_reason, relationship_version
)
select
  o.organization_id,
  o.id,
  'normal',
  'legacy_unresolved',
  'legacy_relationships_require_confirmation',
  0
from public.ovr_reports o
on conflict (ovr_report_id) do nothing;

insert into public.ovr_related_persons (
  organization_id, ovr_report_id, profile_id, relationship_type,
  provenance, asserted_by, confirmed_by, confirmation_status, confirmed_at,
  valid_from, is_active
)
select
  o.organization_id,
  o.id,
  o.reported_by,
  'reporter',
  'legacy_backfill',
  o.reported_by,
  o.reported_by,
  'confirmed',
  coalesce(o.created_at, statement_timestamp()),
  coalesce(o.created_at, statement_timestamp()),
  true
from public.ovr_reports o
join public.profiles p
  on p.id = o.reported_by
 and p.organization_id = o.organization_id
where o.reported_by is not null
on conflict do nothing;

insert into public.ovr_related_persons (
  organization_id, ovr_report_id, profile_id, relationship_type,
  provenance, asserted_by, confirmed_by, confirmation_status, confirmed_at,
  valid_from, is_active
)
select
  o.organization_id,
  o.id,
  o.referred_user_id,
  'referred_party',
  'legacy_backfill',
  o.referred_user_id,
  o.referred_user_id,
  'confirmed',
  coalesce(o.updated_at, statement_timestamp()),
  coalesce(o.updated_at, statement_timestamp()),
  true
from public.ovr_reports o
join public.profiles p
  on p.id = o.referred_user_id
 and p.organization_id = o.organization_id
where o.referred_user_id is not null
on conflict do nothing;

comment on table public.organization_reporting_lines is
  'GRC v1.1 authoritative confirmed reporting lines. One active primary direct manager; zero or more dotted-line relationships; never inferred from department membership.';
comment on table public.ovr_relationship_state is
  'GRC v1.1 OVR sensitivity, normalized relationship version, and fail-closed routing readiness. Existing OVR business rows are not altered.';
comment on table public.ovr_related_persons is
  'GRC v1.1 case relationships only. Workflow reviewer, evidence reviewer, and closer assignments are intentionally excluded.';
comment on table public.ovr_conflict_events is
  'GRC v1.1 append-only relationship and conflict evidence. Raw browser access is denied.';
comment on function ovr_v11_private.current_conflicts(uuid, uuid, text, timestamptz) is
  'Authoritative normalized conflict evaluation. Conflict denial overrides later positive role or scope eligibility.';

commit;
