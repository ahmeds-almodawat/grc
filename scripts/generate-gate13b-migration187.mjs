import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const output = resolve(root, 'supabase/migrations/187_legacy_runtime_and_post185_reconciliation.sql');
const sources = [
  ['181', 'supabase/migrations/181_patch83tu_catalog_contract_attestation.sql'],
  ['182', 'supabase/migrations/182_legacy_public_table_rls_and_privilege_hardening.sql'],
  ['183', 'supabase/migrations/183_security_advisor_rls_reconciliation.sql'],
  ['184', 'supabase/migrations/184_security_definer_search_path_and_acl_hardening.sql'],
  ['185', 'supabase/migrations/185_pilot_go_no_go_anonymous_policy_reconciliation.sql'],
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// Split PostgreSQL text at top-level semicolons while preserving quoted strings,
// identifiers, comments, and dollar-quoted function/DO bodies. This generator is
// deliberately dependency-free so the committed migration can be reproduced by
// the release test suite without network access.
export function splitSqlStatements(sql) {
  const result = [];
  let start = 0;
  let quote = null;
  let dollar = null;
  let lineComment = false;
  let blockDepth = 0;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockDepth > 0) {
      if (ch === '/' && next === '*') { blockDepth += 1; i += 1; }
      else if (ch === '*' && next === '/') { blockDepth -= 1; i += 1; }
      continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) { i += dollar.length - 1; dollar = null; }
      continue;
    }
    if (quote) {
      if (ch === quote && next === quote) { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '-' && next === '-') { lineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { blockDepth = 1; i += 1; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) { dollar = match[0]; i += dollar.length - 1; continue; }
    }
    if (ch === ';') {
      const statement = sql.slice(start, i + 1).trim();
      if (statement) result.push(statement);
      start = i + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail) result.push(tail);
  return result;
}

const withoutLineComments = (statement) => statement
  .replace(/^\s*--.*$/gm, '')
  .trim()
  .toLowerCase();

function sourceStatements(version, relativePath) {
  const source = readFileSync(resolve(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
  const statements = splitSqlStatements(source).filter((statement) => {
    const code = withoutLineComments(statement);
    if (code === 'begin;' || code === 'commit;' || code === 'rollback;') return false;
    if (code.startsWith('set local ')) return false;
    // Migration 181's original preflight requires an already-enforced runtime.
    // The legacy bridge truthfully establishes that runtime only after installing
    // and validating the 181-185 controls, so 187 performs an equivalent final
    // attestation instead of executing this ordering-incompatible preflight.
    if (version === '181' && code.startsWith('do $migration$')) return false;
    return true;
  });
  return { version, relativePath, source, statements };
}

function renderExecutions(source) {
  return source.statements.map((statement, index) => {
    const tag = `$patch13b_${source.version}_${String(index + 1).padStart(3, '0')}$`;
    return `  execute ${tag}\n${statement}\n${tag};`;
  }).join('\n\n');
}

export function generateMigration187() {
  const inputs = sources.map(([version, relativePath]) => sourceStatements(version, relativePath));
  const sourceBanner = inputs.map((entry) =>
    `--   ${entry.version}: ${entry.relativePath} sha256=${sha256(Buffer.from(entry.source, 'utf8'))}`
  ).join('\n');
  const embedded = inputs.map((entry) =>
    `\n  -- Exact migration-${entry.version} catalog/security effects.\n${renderExecutions(entry)}`
  ).join('\n');

  const sql = `-- Production Gate 13B: legacy runtime and post-185 reconciliation.
-- Generated deterministically by scripts/generate-gate13b-migration187.mjs.
-- Do not hand-edit the embedded migration 181-185 statements.
${sourceBanner}
--
-- Modern path: validates the existing post-185 controls and adds only the
-- common lineage/provenance contract. Legacy path: installs the exact source
-- statements from 181-185 without fabricating their migration-history rows,
-- then records a distinct migration-based runtime activation provenance.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '300s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('gate13b:migration:187:legacy-runtime-bridge', 0)
);

do $patch187_preflight$
declare
  v_path text;
  v_max_version integer;
  v_181_185_count integer;
  v_186_count integer;
  v_above_186_count integer;
  v_invalid_roles integer;
  v_bootstrap_admins integer;
  v_runtime_eligible_admins integer;
  v_transitional_admins integer;
  v_pending_operations integer;
  v_recovery_states integer;
  v_runtime record;
  v_expected_event text;
  v_table text;
  v_view text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception using errcode = 'P0001', message = 'PATCH187_MIGRATION_HISTORY_REQUIRED';
  end if;

  select
    max(case when version ~ '^[0-9]+$' then version::integer end),
    count(*) filter (where version in ('181','182','183','184','185')),
    count(*) filter (where version = '186'),
    count(*) filter (where version ~ '^[0-9]+$' and version::integer > 186)
  into v_max_version, v_181_185_count, v_186_count, v_above_186_count
  from supabase_migrations.schema_migrations;

  if v_max_version = 186 and v_181_185_count = 5
     and v_186_count = 1 and v_above_186_count = 0 then
    v_path := 'modern_legacy_lineage';
    v_expected_event := 'gate13b:186:modern-role-contract-validation';
  elsif v_max_version = 186 and v_181_185_count = 0
        and v_186_count = 1 and v_above_186_count = 0 then
    v_path := 'production_bridge_lineage';
    v_expected_event := 'gate13b:186:legacy-role-scope-reconciliation';
  else
    raise exception using errcode = 'P0001',
      message = 'PATCH187_UNKNOWN_OR_MIXED_MIGRATION_LINEAGE',
      detail = pg_catalog.format(
        'ceiling=%s migrations_181_185=%s migration_186=%s above_186=%s',
        coalesce(v_max_version::text, 'null'), v_181_185_count,
        v_186_count, v_above_186_count
      );
  end if;

  if not exists (
    select 1 from public.patch83b_release_migration_events e
    where e.event_key = v_expected_event
      and e.migration_version = 186
      and e.lineage = v_path
      and e.status = 'completed'
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_MIGRATION_186_ATTESTATION_MISSING';
  end if;

  select count(*)::integer into v_invalid_roles
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
  if v_invalid_roles <> 0 then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_INVALID_ACTIVE_ROLE_ASSIGNMENT_REMAINS';
  end if;

  select count(*)::integer into v_bootstrap_admins
  from public.profiles p
  where public.patch83u_bootstrap_super_admin_eligible(p.id);
  if v_bootstrap_admins <> 1 then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_BOOTSTRAP_SUPER_ADMIN_COUNT_MISMATCH',
      detail = pg_catalog.format('bootstrap_count=%s', v_bootstrap_admins);
  end if;

  select count(*)::integer into v_pending_operations
  from public.user_credential_states cs
  where cs.pending_operation_id is not null;
  if v_pending_operations <> 0 then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_PENDING_CREDENTIAL_OPERATION';
  end if;

  select count(*)::integer into v_recovery_states
  from public.user_credential_states cs
  where cs.credential_state in (
    'recovery_required', 'reconciliation_required',
    'session_revocation_review_required'
  ) or cs.reconciliation_auth_changed;
  if v_recovery_states <> 0 then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_CREDENTIAL_RECOVERY_STATE_PRESENT';
  end if;

  if to_regclass('public.runtime_action_reviews') is null
     or to_regclass('public.runtime_action_review_events') is null
     or to_regprocedure('public.patch83v_runtime_action_authorized(text,text)') is null then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_MIGRATION_180_RUNTIME_AUTHORIZER_MISSING';
  end if;

  select rc.enforcement_state, rc.state_version,
         rc.compatible_edge_contract_version, rc.compatible_frontend_contract_version,
         rc.designated_super_admin_id, rc.prepared_at, rc.activated_at
  into v_runtime
  from public.patch83u_runtime_control rc
  where rc.singleton;
  if not found then
    raise exception using errcode = 'P0001', message = 'PATCH187_RUNTIME_CONTROL_MISSING';
  end if;

  if v_path = 'modern_legacy_lineage' then
    select count(*)::integer into v_runtime_eligible_admins
    from public.profiles p
    where public.patch83u_runtime_super_admin_eligible(p.id, p.organization_id);
    if v_runtime.enforcement_state <> 'enforced' or v_runtime.state_version < 5
       or v_runtime.compatible_edge_contract_version <> 'patch83u-edge-auth-first-v1'
       or v_runtime.compatible_frontend_contract_version <> 'patch83u-frontend-auth-first-v1'
       or to_regprocedure('public.patch83tu_catalog_contract_attestation()') is null
       or (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean is distinct from true
       or v_runtime_eligible_admins <> 1 then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_MODERN_POST185_CONTRACT_INVALID';
    end if;
  else
    if v_runtime.enforcement_state <> 'disabled' or v_runtime.state_version <> 0
       or v_runtime.compatible_edge_contract_version is not null
       or v_runtime.compatible_frontend_contract_version is not null
       or to_regprocedure('public.patch83tu_catalog_contract_attestation()') is not null
       or v_runtime.designated_super_admin_id is not null
       or v_runtime.prepared_at is not null
       or v_runtime.activated_at is not null then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_LEGACY_RUNTIME_OR_CATALOG_PRESTATE_INVALID';
    end if;
    if exists (select 1 from public.patch83u_runtime_events) then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_LEGACY_RUNTIME_EVENT_PRESTATE_INVALID';
    end if;

    foreach v_table in array array[
      'company_rollout_waves','final_go_live_stop_rules','final_pilot_signoff_matrix',
      'final_validation_runs','i18n_translation_coverage_items','mock_data_allowlist',
      'phased_auto_test_cases','phased_auto_test_phases','phased_auto_test_results',
      'phased_auto_test_runs','pilot_execution_runs','pilot_feedback_items',
      'pilot_fix_sprint_items','production_data_switchovers','production_empty_state_checks',
      'production_exception_register_v58','rtl_visual_qa_items','v50_scale_test_results'
    ] loop
      if not exists (
        select 1 from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = v_table
          and c.relkind in ('r','p')
          and not c.relrowsecurity and not c.relforcerowsecurity
      ) or exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = v_table
      ) or (
        select count(*)
        from information_schema.role_table_grants g
        where g.table_schema = 'public'
          and g.table_name = v_table
          and g.grantee in ('anon', 'authenticated', 'service_role')
      ) <> 21 or exists (
        select 1
        from information_schema.role_table_grants g
        join pg_catalog.pg_class c
          on c.relnamespace = 'public'::regnamespace and c.relname = v_table
        join pg_catalog.pg_roles owner_role on owner_role.oid = c.relowner
        where g.table_schema = 'public'
          and g.table_name = v_table
          and g.grantee not in (
            'anon', 'authenticated', 'service_role', owner_role.rolname
          )
      ) then
        raise exception using errcode = 'P0001',
          message = 'PATCH187_LEGACY_PRE182_TABLE_OR_ACL_STATE_INVALID', detail = v_table;
      end if;
    end loop;

    foreach v_view in array array[
      'v_v38_final_readiness_scorecard','v_v46_language_rtl_readiness',
      'v_v46_production_hardening_scorecard','v_v58_overall_production_readiness',
      'v_v58_pilot_readiness_scorecard','v_v58_rollout_readiness_scorecard',
      'v_v59_latest_phase_results','v_v59_phase_test_scorecard',
      'v_v59_production_data_readiness','v_v60_empty_state_readiness'
    ] loop
      if not exists (
        select 1 from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = v_view and c.relkind = 'v'
      ) or (
        select count(*)
        from information_schema.role_table_grants g
        where g.table_schema = 'public'
          and g.table_name = v_view
          and g.grantee in ('anon', 'authenticated', 'service_role')
      ) <> 21 or exists (
        select 1
        from information_schema.role_table_grants g
        join pg_catalog.pg_class c
          on c.relnamespace = 'public'::regnamespace and c.relname = v_view
        join pg_catalog.pg_roles owner_role on owner_role.oid = c.relowner
        where g.table_schema = 'public'
          and g.table_name = v_view
          and g.grantee not in (
            'anon', 'authenticated', 'service_role', owner_role.rolname
          )
      ) then
        raise exception using errcode = 'P0001',
          message = 'PATCH187_LEGACY_PRE182_VIEW_OR_ACL_STATE_INVALID', detail = v_view;
      end if;
    end loop;

    if exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'public' and (
        p.policyname like 'patch183\\_%' escape '\\'
        or p.policyname in (
          'pilot_go_no_go_reviews_super_admin_read',
          'pilot_go_no_go_events_super_admin_read'
        )
      )
    ) or (
      select count(*) from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.policyname in (
          'pilot_go_no_go_reviews_select_all',
          'pilot_go_no_go_events_select_all'
        )
    ) <> 2 then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_LEGACY_PRE183_OR_PRE185_POLICY_STATE_INVALID';
    end if;

    -- This is the only accepted bridge credential state. It is deliberately
    -- narrower than bootstrap eligibility: the legacy administrator must still
    -- owe the first mandatory password rotation, must have matching zero
    -- credential versions, and must not have a live session or refresh token.
    select count(distinct p.id)::integer into v_transitional_admins
    from public.profiles p
    join public.user_credential_states cs on cs.user_id = p.id
    join auth.users au on au.id = p.id
    where public.patch83u_bootstrap_super_admin_eligible(p.id)
      and p.is_active = true
      and p.user_status = 'active'
      and cs.organization_id = p.organization_id
      and cs.identity_mode = 'legacy_verified'
      and cs.credential_state = 'existing_password_rotation_pending'
      and cs.requested_lifecycle = 'active'
      and cs.credential_version = 0
      and public.patch83u_auth_credential_version(au.raw_app_meta_data) = 0
      and cs.pending_operation_id is null
      and cs.pending_session_id is null
      and cs.pending_credential_version is null
      and cs.operation_source is null
      and cs.role_suspension_id is null
      and cs.reconciliation_auth_changed = false
      and cs.password_changed_at is null
      and not exists (select 1 from auth.sessions s where s.user_id = p.id)
      and not exists (
        select 1 from auth.refresh_tokens rt
        where rt.user_id = p.id::text and rt.revoked = false
      )
      and 1 = (
        select count(*) from public.user_roles ur
        where ur.user_id = p.id and ur.is_active = true
          and ur.role = 'super_admin' and ur.scope = 'global'
          and ur.organization_id = p.organization_id
          and ur.division_id is null and ur.department_id is null and ur.unit_id is null
      );
    if v_transitional_admins <> 1 then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_TRANSITIONAL_SUPER_ADMIN_CONTRACT_MISMATCH',
        detail = pg_catalog.format('transitional_count=%s', v_transitional_admins);
    end if;
  end if;

  perform pg_catalog.set_config('patch83b.migration_187_lineage', v_path, true);
end;
$patch187_preflight$;

-- Only the production bridge path executes the source-bound 181-185 effects.
-- Every statement remains within this migration transaction; any failure rolls
-- back the complete bridge and migration 181-185 history is never fabricated.
do $patch187_apply_legacy$
begin
  if current_setting('patch83b.migration_187_lineage', true) = 'production_bridge_lineage' then
${embedded}
  end if;
end;
$patch187_apply_legacy$;

-- Common, truthful activation provenance. The legacy branch deliberately does
-- not populate compatibility_attested_at/by and does not create a historical
-- compatibility_attested runtime event.
alter table public.patch83u_runtime_control
  add column if not exists activation_provenance text not null default 'edge_authenticated';
alter table public.patch83u_runtime_control
  add column if not exists legacy_bridge_id text;
alter table public.patch83u_runtime_control
  add column if not exists legacy_bridge_applied_at timestamptz;

alter table public.patch83u_runtime_control
  drop constraint if exists patch83b_runtime_activation_provenance_contract;
alter table public.patch83u_runtime_control
  add constraint patch83b_runtime_activation_provenance_contract check (
    (activation_provenance = 'edge_authenticated'
      and legacy_bridge_id is null and legacy_bridge_applied_at is null)
    or
    (activation_provenance = 'legacy_migration_bridge'
      and legacy_bridge_id is not null
      and legacy_bridge_id ~ '^[a-z0-9:._-]{1,160}$'
      and legacy_bridge_applied_at is not null)
  );

alter table public.patch83u_runtime_control
  drop constraint if exists patch83u_runtime_prepared_contract;
alter table public.patch83u_runtime_control
  add constraint patch83u_runtime_prepared_contract check (
    enforcement_state = 'disabled'
    or (
      preflight_hash is not null
      and designated_super_admin_id is not null
      and prepared_at is not null
      and (
        (activation_provenance = 'edge_authenticated' and prepared_by is not null)
        or
        (activation_provenance = 'legacy_migration_bridge' and prepared_by is null)
      )
    )
  );

alter table public.patch83u_runtime_control
  drop constraint if exists patch83u_runtime_enforced_contract;
alter table public.patch83u_runtime_control
  add constraint patch83u_runtime_enforced_contract check (
    enforcement_state <> 'enforced'
    or (
      activation_provenance = 'edge_authenticated'
      and activated_at is not null
      and activated_by is not null
      and compatibility_attested_at is not null
      and compatibility_attested_by = designated_super_admin_id
      and compatible_edge_contract_version = expected_edge_contract_version
      and compatible_frontend_contract_version = expected_frontend_contract_version
    )
    or (
      activation_provenance = 'legacy_migration_bridge'
      and state_version = 5
      and activated_at is not null
      and activated_by is null
      and compatibility_attested_at is null
      and compatibility_attested_by is null
      and compatible_edge_contract_version = expected_edge_contract_version
      and compatible_frontend_contract_version = expected_frontend_contract_version
    )
  );

create table if not exists public.patch83b_legacy_runtime_bridges (
  bridge_id text primary key check (
    length(bridge_id) between 1 and 160
    and bridge_id ~ '^[a-z0-9:._-]+$'
  ),
  lineage text not null check (lineage = 'production_bridge_lineage'),
  source_migration_ceiling integer not null check (source_migration_ceiling = 180),
  bridge_migration_version integer not null check (bridge_migration_version = 187),
  source_release_commit text not null check (source_release_commit ~ '^[0-9a-f]{40}$'),
  operator_classification text not null check (
    operator_classification = 'authorized_database_deployment_operator'
  ),
  controls_installed jsonb not null check (
    controls_installed = '[181, 182, 183, 184, 185]'::jsonb
  ),
  role_reconciliation_event_key text not null references
    public.patch83b_release_migration_events(event_key) on delete restrict,
  runtime_state_version integer not null check (runtime_state_version = 5),
  historical_edge_attestation_claimed boolean not null check (
    historical_edge_attestation_claimed = false
  ),
  historical_access_review_claimed boolean not null check (
    historical_access_review_claimed = false
  ),
  auth_rows_changed boolean not null check (auth_rows_changed = false),
  credential_or_session_rows_changed boolean not null check (
    credential_or_session_rows_changed = false
  ),
  mandatory_super_admin_password_rotation text not null check (
    mandatory_super_admin_password_rotation = 'required'
  ),
  transitional_credential_state text not null check (
    transitional_credential_state = 'existing_password_rotation_pending'
  ),
  transitional_database_credential_version integer not null check (
    transitional_database_credential_version = 0
  ),
  transitional_auth_credential_version integer not null check (
    transitional_auth_credential_version = 0
  ),
  transitional_session_count integer not null check (transitional_session_count = 0),
  transitional_unrevoked_refresh_token_count integer not null check (
    transitional_unrevoked_refresh_token_count = 0
  ),
  password_rotation_completed_claimed boolean not null check (
    password_rotation_completed_claimed = false
  ),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

comment on table public.patch83b_legacy_runtime_bridges is
  'Permanent identity-free provenance for the authorized Gate 13B database-migration bridge. It is not an Edge compatibility attestation or executive access-review signoff.';

create or replace function public.patch83b_reject_legacy_runtime_bridge_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  raise exception using errcode = 'P0001',
    message = 'PATCH83B_LEGACY_RUNTIME_BRIDGES_APPEND_ONLY';
end;
$function$;

revoke all on function public.patch83b_reject_legacy_runtime_bridge_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_patch83b_legacy_runtime_bridges_append_only
  on public.patch83b_legacy_runtime_bridges;
create trigger trg_patch83b_legacy_runtime_bridges_append_only
before update or delete on public.patch83b_legacy_runtime_bridges
for each row execute function public.patch83b_reject_legacy_runtime_bridge_mutation();

revoke all privileges on table public.patch83b_legacy_runtime_bridges
  from public, anon, authenticated, service_role;
grant select on table public.patch83b_legacy_runtime_bridges to service_role;
alter table public.patch83b_legacy_runtime_bridges enable row level security;
alter table public.patch83b_legacy_runtime_bridges force row level security;

create or replace function public.patch83b_guard_runtime_activation_provenance()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if old.activation_provenance = 'legacy_migration_bridge'
     and new.enforcement_state in ('disabled', 'prepared', 'emergency_suspended') then
    new.activation_provenance := 'edge_authenticated';
    new.legacy_bridge_id := null;
    new.legacy_bridge_applied_at := null;
  end if;

  if new.activation_provenance = 'legacy_migration_bridge' and (
    current_setting('patch83b.legacy_bridge_migration', true) <> '187'
    or old.enforcement_state <> 'disabled'
    or old.state_version <> 0
    or new.enforcement_state <> 'enforced'
    or new.state_version <> 5
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH83B_LEGACY_RUNTIME_PROVENANCE_TRANSITION_REFUSED';
  end if;
  return new;
end;
$function$;

revoke all on function public.patch83b_guard_runtime_activation_provenance()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_patch83b_runtime_activation_provenance
  on public.patch83u_runtime_control;
create trigger trg_patch83b_runtime_activation_provenance
before update on public.patch83u_runtime_control
for each row execute function public.patch83b_guard_runtime_activation_provenance();

do $patch187_activate_legacy$
declare
  v_admin_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_bridge_id constant text := 'gate13b:187:legacy-upgrade-bridge';
  v_existing public.patch83b_legacy_runtime_bridges%rowtype;
begin
  if current_setting('patch83b.migration_187_lineage', true) <> 'production_bridge_lineage' then
    return;
  end if;

  select p.id into strict v_admin_id
  from public.profiles p
  join public.user_credential_states cs on cs.user_id = p.id
  join auth.users au on au.id = p.id
  where public.patch83u_bootstrap_super_admin_eligible(p.id)
    and cs.credential_state = 'existing_password_rotation_pending'
    and cs.credential_version = 0
    and public.patch83u_auth_credential_version(au.raw_app_meta_data) = 0
    and not exists (select 1 from auth.sessions s where s.user_id = p.id)
    and not exists (
      select 1 from auth.refresh_tokens rt
      where rt.user_id = p.id::text and rt.revoked = false
    );

  perform pg_catalog.set_config('patch83b.legacy_bridge_migration', '187', true);

  update public.patch83u_runtime_control
  set enforcement_state = 'enforced',
      prepared_at = v_now,
      prepared_by = null,
      activated_at = v_now,
      activated_by = null,
      activation_reason = 'Gate 13B authorized legacy database-migration bridge',
      last_transition_reason = 'Controls represented by migrations 181-185 installed and validated by migration 187',
      compatible_edge_contract_version = expected_edge_contract_version,
      compatible_frontend_contract_version = expected_frontend_contract_version,
      compatibility_attested_at = null,
      compatibility_attested_by = null,
      preflight_hash = encode(extensions.digest(
        convert_to('gate13b-legacy-bridge-v1|source-ceiling-180|target-187', 'UTF8'),
        'sha256'
      ), 'hex'),
      designated_super_admin_id = v_admin_id,
      last_transition_request_id = v_bridge_id,
      state_version = 5,
      activation_provenance = 'legacy_migration_bridge',
      legacy_bridge_id = v_bridge_id,
      legacy_bridge_applied_at = v_now
  where singleton and enforcement_state = 'disabled' and state_version = 0;

  if not found then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_LEGACY_RUNTIME_ACTIVATION_PRESTATE_CHANGED';
  end if;

  select * into v_existing
  from public.patch83b_legacy_runtime_bridges b
  where b.bridge_id = v_bridge_id;
  if found then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_LEGACY_BRIDGE_ALREADY_RECORDED';
  end if;

  insert into public.patch83b_legacy_runtime_bridges (
    bridge_id, lineage, source_migration_ceiling, bridge_migration_version,
    source_release_commit, operator_classification, controls_installed,
    role_reconciliation_event_key, runtime_state_version,
    historical_edge_attestation_claimed, historical_access_review_claimed,
    auth_rows_changed, credential_or_session_rows_changed,
    mandatory_super_admin_password_rotation, transitional_credential_state,
    transitional_database_credential_version, transitional_auth_credential_version,
    transitional_session_count, transitional_unrevoked_refresh_token_count,
    password_rotation_completed_claimed, created_at
  ) values (
    v_bridge_id, 'production_bridge_lineage', 180, 187,
    '87074faa9476a6d158199426871167ae30cd5a55',
    'authorized_database_deployment_operator', '[181,182,183,184,185]'::jsonb,
    'gate13b:186:legacy-role-scope-reconciliation', 5,
    false, false, false, false,
    'required', 'existing_password_rotation_pending', 0, 0, 0, 0, false, v_now
  );

  insert into public.patch83b_release_migration_events (
    event_key, migration_version, lineage, event_type, status,
    affected_count, source_release_commit, details
  ) values (
    'gate13b:187:legacy-runtime-bridge', 187,
    'production_bridge_lineage', 'legacy_runtime_bridge', 'completed', 1,
    '87074faa9476a6d158199426871167ae30cd5a55',
    jsonb_build_object(
      'source_migration_ceiling', 180,
      'controls_installed', jsonb_build_array(181,182,183,184,185),
      'runtime_state_version', 5,
      'historical_edge_attestation_claimed', false,
      'historical_access_review_claimed', false,
      'mandatory_super_admin_password_rotation', 'required',
      'transitional_credential_state', 'existing_password_rotation_pending',
      'transitional_database_credential_version', 0,
      'transitional_auth_credential_version', 0,
      'transitional_session_count', 0,
      'transitional_unrevoked_refresh_token_count', 0,
      'password_rotation_completed_claimed', false,
      'identity_exposed', false
    )
  );
end;
$patch187_activate_legacy$;

create or replace function public.patch83b_release_lineage_attestation()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $function$
  with history as (
    select
      count(*) filter (where version in ('181','182','183','184','185')) as count_181_185,
      count(*) filter (where version = '186') as count_186,
      max(case when version ~ '^[0-9]+$' then version::integer end) as ceiling
    from supabase_migrations.schema_migrations
  ), runtime as (
    select schema_version, enforcement_state, state_version,
           activation_provenance, legacy_bridge_id is not null as legacy_bridge_bound,
           compatible_edge_contract_version = expected_edge_contract_version
             and compatible_frontend_contract_version = expected_frontend_contract_version
             as contracts_compatible
    from public.patch83u_runtime_control where singleton
  ), safe_counts as (
    select
      (select count(*) from public.user_roles ur join public.profiles p on p.id = ur.user_id
       where ur.is_active and (
         public.patch83u_role_scope_allowed(ur.role, ur.scope) is distinct from true
         or public.patch83u_role_assignment_valid(
           p.organization_id, ur.scope, ur.organization_id,
           ur.division_id, ur.department_id, ur.unit_id
         ) is distinct from true
       )) as invalid_active_roles,
      (select count(*) from public.profiles p
       where public.patch83u_runtime_super_admin_eligible(p.id, p.organization_id)) as eligible_super_admins,
      (select count(*) from public.user_credential_states cs
       where cs.pending_operation_id is not null) as pending_credential_operations,
      (select count(*) from public.user_credential_states cs
       where cs.credential_state in (
         'recovery_required','reconciliation_required','session_revocation_review_required'
       ) or cs.reconciliation_auth_changed) as recovery_or_reconciliation_states,
      (select count(*)
       from public.patch83u_runtime_control rc
       join public.profiles p on p.id = rc.designated_super_admin_id
       join public.user_credential_states cs on cs.user_id = p.id
       join auth.users au on au.id = p.id
       where rc.singleton
         and p.is_active and p.user_status = 'active'
         and cs.organization_id = p.organization_id
         and cs.identity_mode = 'legacy_verified'
         and cs.credential_state = 'existing_password_rotation_pending'
         and cs.requested_lifecycle = 'active'
         and cs.credential_version = 0
         and public.patch83u_auth_credential_version(au.raw_app_meta_data) = 0
         and cs.pending_operation_id is null
         and cs.pending_session_id is null
         and cs.pending_credential_version is null
         and cs.operation_source is null
         and cs.reconciliation_auth_changed = false
         and not exists (select 1 from auth.sessions s where s.user_id = p.id)
         and not exists (
           select 1 from auth.refresh_tokens rt
           where rt.user_id = p.id::text and rt.revoked = false
         )
      ) as transitional_rotation_required_admins,
      (select count(*)
       from public.patch83u_runtime_control rc
       join public.profiles p on p.id = rc.designated_super_admin_id
       join public.user_credential_states cs on cs.user_id = p.id
       join auth.users au on au.id = p.id
       where rc.singleton
         and public.patch83u_runtime_super_admin_eligible(p.id, p.organization_id)
         and cs.credential_state = 'active'
         and cs.credential_version >= 1
         and public.patch83u_auth_credential_version(au.raw_app_meta_data) = cs.credential_version
         and cs.password_changed_at is not null
         and cs.sessions_revoked_at is not null
         and cs.pending_operation_id is null
         and cs.reconciliation_auth_changed = false
      ) as completed_bridge_rotation_admins
  )
  select jsonb_build_object(
    'attestation_version', 'gate13br3-release-lineage-v2',
    'safe_metadata_only', true,
    'lineage', case
      when h.count_181_185 = 5 and h.count_186 = 1 then 'modern_legacy_lineage'
      when h.count_181_185 = 0 and h.count_186 = 1 then 'production_bridge_lineage'
      else 'unknown'
    end,
    'history', jsonb_build_object(
      'migrations_181_185_count', h.count_181_185,
      'migration_186_count', h.count_186,
      'ceiling_before_187_history_write', h.ceiling
    ),
    'runtime', to_jsonb(r),
    'safe_counts', to_jsonb(sc),
    'mandatory_super_admin_password_rotation', case
      when h.count_181_185 = 0 and h.count_186 = 1
        and sc.transitional_rotation_required_admins = 1 then 'required'
      when h.count_181_185 = 0 and h.count_186 = 1
        and sc.completed_bridge_rotation_admins = 1 then 'completed'
      else 'not_applicable'
    end,
    'patch83tu_attestation_pass',
      (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean,
    'overall_pass',
      r.enforcement_state = 'enforced'
      and r.state_version = 5
      and r.contracts_compatible
      and sc.invalid_active_roles = 0
      and sc.pending_credential_operations = 0
      and sc.recovery_or_reconciliation_states = 0
      and (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean
      and (
        (h.count_181_185 = 5 and h.count_186 = 1
          and r.activation_provenance = 'edge_authenticated'
          and not r.legacy_bridge_bound
          and sc.eligible_super_admins = 1
          and sc.transitional_rotation_required_admins = 0)
        or
        (h.count_181_185 = 0 and h.count_186 = 1
          and r.activation_provenance = 'legacy_migration_bridge'
          and r.legacy_bridge_bound
          and (
            (sc.eligible_super_admins = 0
              and sc.transitional_rotation_required_admins = 1
              and sc.completed_bridge_rotation_admins = 0)
            or
            (sc.eligible_super_admins = 1
              and sc.transitional_rotation_required_admins = 0
              and sc.completed_bridge_rotation_admins = 1)
          ))
      )
  )
  from history h cross join runtime r cross join safe_counts sc;
$function$;

revoke all on function public.patch83b_release_lineage_attestation()
  from public, anon, authenticated;
grant execute on function public.patch83b_release_lineage_attestation() to service_role;

comment on function public.patch83b_release_lineage_attestation() is
  'Service-role-only, schema-and-safe-count Gate 13B lineage attestation. Returns no identities, business rows, credentials, sessions, or tokens.';

do $patch187_postflight$
declare
  v_path text := current_setting('patch83b.migration_187_lineage', true);
  v_attestation jsonb;
  v_browser text;
  v_table text;
begin
  if to_regprocedure('public.patch83tu_catalog_contract_attestation()') is null
     or (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean is distinct from true then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_PATCH83TU_ATTESTATION_FAILED';
  end if;

  v_attestation := public.patch83b_release_lineage_attestation();
  if (v_attestation ->> 'overall_pass')::boolean is distinct from true
     or v_attestation ->> 'lineage' <> v_path then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_RELEASE_LINEAGE_ATTESTATION_FAILED';
  end if;

  foreach v_browser in array array['anon','authenticated'] loop
    if has_function_privilege(v_browser, 'public.patch83b_release_lineage_attestation()', 'EXECUTE') then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_BROWSER_ATTESTATION_EXECUTE_REMAINS', detail = v_browser;
    end if;
  end loop;
  if exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) a
    where p.oid = 'public.patch83b_release_lineage_attestation()'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_PUBLIC_ATTESTATION_EXECUTE_REMAINS';
  end if;

  foreach v_table in array array[
    'patch83b_release_migration_events', 'patch83b_legacy_runtime_bridges'
  ] loop
    if exists (
      select 1 from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = v_table
        and g.grantee in ('PUBLIC','anon','authenticated')
    ) or exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname = 'public' and p.tablename = v_table
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH187_BRIDGE_EVIDENCE_BROWSER_EXPOSURE', detail = v_table;
    end if;
  end loop;

  if v_path = 'production_bridge_lineage' and (
    exists (select 1 from public.patch83u_runtime_events)
    or not exists (
      select 1 from public.patch83b_legacy_runtime_bridges b
      where b.bridge_id = 'gate13b:187:legacy-upgrade-bridge'
        and not b.historical_edge_attestation_claimed
        and not b.historical_access_review_claimed
        and b.mandatory_super_admin_password_rotation = 'required'
        and b.transitional_credential_state = 'existing_password_rotation_pending'
        and b.transitional_database_credential_version = 0
        and b.transitional_auth_credential_version = 0
        and b.transitional_session_count = 0
        and b.transitional_unrevoked_refresh_token_count = 0
        and not b.password_rotation_completed_claimed
    )
    or v_attestation ->> 'mandatory_super_admin_password_rotation' <> 'required'
  ) then
    raise exception using errcode = 'P0001',
      message = 'PATCH187_TRUTHFUL_LEGACY_PROVENANCE_FAILED';
  end if;

  insert into public.patch83b_release_migration_events (
    event_key, migration_version, lineage, event_type, status,
    affected_count, source_release_commit, details
  ) values (
    'gate13b:187:' || replace(v_path, '_lineage', '') || ':catalog-attestation',
    187, v_path, 'post187_catalog_attestation', 'completed', 0,
    '87074faa9476a6d158199426871167ae30cd5a55',
    jsonb_build_object(
      'patch83tu_overall_pass', true,
      'release_lineage_overall_pass', true,
      'identity_exposed', false,
      'history_rows_fabricated', false
    )
  );
end;
$patch187_postflight$;

commit;
`;

  writeFileSync(output, sql.replace(/\r\n/g, '\n'), 'utf8');
  return {
    output,
    sha256: sha256(Buffer.from(sql.replace(/\r\n/g, '\n'), 'utf8')),
    bytes: Buffer.byteLength(sql.replace(/\r\n/g, '\n'), 'utf8'),
    sources: inputs.map((entry) => ({
      version: entry.version,
      path: entry.relativePath,
      sha256: sha256(Buffer.from(entry.source, 'utf8')),
      statements: entry.statements.length,
    })),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(generateMigration187())}\n`);
}
