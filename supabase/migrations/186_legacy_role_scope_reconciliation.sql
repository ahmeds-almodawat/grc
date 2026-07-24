-- Production Gate 13B: deterministic legacy role/scope reconciliation.
--
-- This migration recognizes exactly two release lineages. The modern lineage
-- validates the post-185 role contract without changing application data. The
-- legacy bridge lineage corrects the single, pre-attested executive/department
-- assignment to the canonical executive/global contract. No identity is stored
-- in the audit evidence and no Auth, credential, password, or session row is
-- read or changed.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('gate13b:migration:186:role-scope-reconciliation', 0)
);

create table if not exists public.patch83b_release_migration_events (
  event_key text primary key check (
    length(event_key) between 1 and 160
    and event_key ~ '^[a-z0-9:._-]+$'
  ),
  migration_version integer not null check (migration_version >= 186),
  lineage text not null check (lineage in (
    'modern_legacy_lineage',
    'production_bridge_lineage',
    'baseline_v3_lineage'
  )),
  event_type text not null check (event_type in (
    'modern_role_contract_validation',
    'legacy_role_scope_reconciliation',
    'legacy_runtime_bridge',
    'post187_catalog_attestation'
  )),
  status text not null check (status = 'completed'),
  affected_count integer not null check (affected_count >= 0),
  source_release_commit text not null check (
    source_release_commit ~ '^[0-9a-f]{40}$'
  ),
  details jsonb not null check (
    jsonb_typeof(details) = 'object'
    and not (details ?| array[
      'user_id', 'email', 'employee_id', 'employee_no', 'session_id',
      'access_token', 'refresh_token', 'authorization', 'password'
    ])
  ),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

comment on table public.patch83b_release_migration_events is
  'Append-only, identity-free Gate 13B migration evidence. It records release lineage and safe aggregate outcomes only.';

create or replace function public.patch83b_reject_release_migration_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  raise exception using errcode = 'P0001',
    message = 'PATCH83B_RELEASE_MIGRATION_EVENTS_APPEND_ONLY';
end;
$function$;

revoke all on function public.patch83b_reject_release_migration_event_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_patch83b_release_migration_events_append_only
  on public.patch83b_release_migration_events;
create trigger trg_patch83b_release_migration_events_append_only
before update or delete on public.patch83b_release_migration_events
for each row execute function public.patch83b_reject_release_migration_event_mutation();

revoke all privileges on table public.patch83b_release_migration_events
  from public, anon, authenticated, service_role;
grant select on table public.patch83b_release_migration_events to service_role;

do $patch186$
declare
  v_path text;
  v_max_version integer;
  v_181_185_count integer;
  v_above_185_count integer;
  v_invalid_count integer;
  v_expected_invalid_count integer;
  v_changed_count integer := 0;
  v_event_key text;
  v_existing public.patch83b_release_migration_events%rowtype;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception using errcode = 'P0001',
      message = 'PATCH186_MIGRATION_HISTORY_REQUIRED';
  end if;

  select
    max(case when version ~ '^[0-9]+$' then version::integer end),
    count(*) filter (where version in ('181', '182', '183', '184', '185')),
    count(*) filter (where version ~ '^[0-9]+$' and version::integer > 185)
  into v_max_version, v_181_185_count, v_above_185_count
  from supabase_migrations.schema_migrations;

  if v_max_version = 185 and v_181_185_count = 5 and v_above_185_count = 0 then
    v_path := 'modern_legacy_lineage';
  elsif v_max_version = 180 and v_181_185_count = 0 and v_above_185_count = 0 then
    v_path := 'production_bridge_lineage';
  else
    raise exception using errcode = 'P0001',
      message = 'PATCH186_UNKNOWN_OR_MIXED_MIGRATION_LINEAGE',
      detail = pg_catalog.format(
        'ceiling=%s migrations_181_185=%s above_185=%s',
        coalesce(v_max_version::text, 'null'), v_181_185_count, v_above_185_count
      );
  end if;

  -- A table-level lock makes the count-and-correct operation deterministic
  -- while remaining bounded by lock_timeout. It does not block unrelated
  -- tables and is released with this transaction.
  lock table public.user_roles in share row exclusive mode;

  select count(*)::integer
  into v_invalid_count
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.is_active = true
    and (
      public.patch83u_role_scope_allowed(ur.role, ur.scope) is distinct from true
      or public.patch83u_role_assignment_valid(
        p.organization_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      ) is distinct from true
    );

  if v_path = 'modern_legacy_lineage' then
    if v_invalid_count <> 0 then
      raise exception using errcode = 'P0001',
        message = 'PATCH186_MODERN_ROLE_CONTRACT_INVALID',
        detail = pg_catalog.format('invalid_active_assignments=%s', v_invalid_count);
    end if;

    v_event_key := 'gate13b:186:modern-role-contract-validation';
    v_expected_invalid_count := 0;
  else
    select count(*)::integer
    into v_expected_invalid_count
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.is_active = true
      and ur.role::text = 'executive'
      and ur.scope::text = 'department'
      and ur.organization_id = p.organization_id
      and ur.department_id is not null
      and ur.division_id is null
      and ur.unit_id is null
      and public.patch83u_role_scope_allowed(ur.role, ur.scope) is distinct from true;

    if v_invalid_count <> 1 or v_expected_invalid_count <> 1 then
      raise exception using errcode = 'P0001',
        message = 'PATCH186_LEGACY_ROLE_PRESTATE_MISMATCH',
        detail = pg_catalog.format(
          'invalid_active_assignments=%s expected_shape=%s',
          v_invalid_count, v_expected_invalid_count
        );
    end if;

    update public.user_roles ur
    set scope = 'global'::public.access_scope,
        division_id = null,
        department_id = null,
        unit_id = null
    from public.profiles p
    where p.id = ur.user_id
      and ur.is_active = true
      and ur.role::text = 'executive'
      and ur.scope::text = 'department'
      and ur.organization_id = p.organization_id
      and ur.department_id is not null
      and ur.division_id is null
      and ur.unit_id is null;

    get diagnostics v_changed_count = row_count;
    if v_changed_count <> 1 then
      raise exception using errcode = 'P0001',
        message = 'PATCH186_LEGACY_ROLE_CORRECTION_COUNT_MISMATCH',
        detail = pg_catalog.format('changed=%s', v_changed_count);
    end if;

    select count(*)::integer
    into v_invalid_count
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.is_active = true
      and (
        public.patch83u_role_scope_allowed(ur.role, ur.scope) is distinct from true
        or public.patch83u_role_assignment_valid(
          p.organization_id, ur.scope, ur.organization_id,
          ur.division_id, ur.department_id, ur.unit_id
        ) is distinct from true
      );

    if v_invalid_count <> 0 then
      raise exception using errcode = 'P0001',
        message = 'PATCH186_LEGACY_ROLE_CORRECTION_POSTCONDITION_FAILED',
        detail = pg_catalog.format('invalid_active_assignments=%s', v_invalid_count);
    end if;

    v_event_key := 'gate13b:186:legacy-role-scope-reconciliation';
  end if;

  select * into v_existing
  from public.patch83b_release_migration_events
  where event_key = v_event_key;

  if found then
    if v_existing.migration_version <> 186
       or v_existing.lineage <> v_path
       or v_existing.event_type <> (case
         when v_path = 'modern_legacy_lineage' then 'modern_role_contract_validation'
         else 'legacy_role_scope_reconciliation'
       end)
       or v_existing.status <> 'completed'
       or v_existing.affected_count <> v_changed_count
       or v_existing.source_release_commit <> '87074faa9476a6d158199426871167ae30cd5a55'
       or v_existing.details <> jsonb_build_object(
         'canonical_role', 'executive',
         'canonical_scope', 'global',
         'hierarchy_references_cleared', v_path = 'production_bridge_lineage',
         'identity_exposed', false,
         'auth_rows_changed', false,
         'credential_rows_changed', false
       )
    then
      raise exception using errcode = 'P0001',
        message = 'PATCH186_EXISTING_AUDIT_EVENT_CONFLICT';
    end if;
  else
    insert into public.patch83b_release_migration_events (
      event_key, migration_version, lineage, event_type, status,
      affected_count, source_release_commit, details
    ) values (
      v_event_key,
      186,
      v_path,
      case
        when v_path = 'modern_legacy_lineage' then 'modern_role_contract_validation'
        else 'legacy_role_scope_reconciliation'
      end,
      'completed',
      v_changed_count,
      '87074faa9476a6d158199426871167ae30cd5a55',
      jsonb_build_object(
        'canonical_role', 'executive',
        'canonical_scope', 'global',
        'hierarchy_references_cleared', v_path = 'production_bridge_lineage',
        'identity_exposed', false,
        'auth_rows_changed', false,
        'credential_rows_changed', false
      )
    );
  end if;

  perform pg_catalog.set_config('patch83b.migration_186_lineage', v_path, true);
end;
$patch186$;

alter table public.patch83b_release_migration_events enable row level security;
alter table public.patch83b_release_migration_events force row level security;

commit;
