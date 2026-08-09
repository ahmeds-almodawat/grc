import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'

const container = process.env.P1_DB_CONTAINER
const cleanupConfirmation = process.env.P1_DISPOSABLE_CONFIRM

if (!container || !/^supabase_db_[A-Za-z0-9_.-]+$/.test(container)) {
  throw new Error('P1_DB_CONTAINER must name the disposable local Supabase database container')
}
if (cleanupConfirmation !== 'DELETE_GENERATED_P1_FIXTURES') {
  throw new Error('P1_DISPOSABLE_CONFIRM must explicitly authorize scoped disposable-fixture cleanup')
}

function runProcess(command, args, { input, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) child.kill()
    }, timeoutMs)

    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', error => {
      clearTimeout(timer)
      settled = true
      reject(error)
    })
    child.on('close', code => {
      clearTimeout(timer)
      settled = true
      const redactedError = stderr.replaceAll(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DB_URL]')
      if (code !== 0) {
        reject(new Error(`${command} exited ${code}: ${redactedError || 'no stderr'}`))
        return
      }
      resolve(stdout.trim())
    })
    if (input !== undefined) child.stdin.end(input)
    else child.stdin.end()
  })
}

const psqlArgs = [
  'exec', '-i', container, 'psql', '-X', '-q', '-A', '-t',
  '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres',
]
const runSql = (sql, timeoutMs = 30_000) => runProcess('docker', psqlArgs, { input: sql, timeoutMs })
const lastLine = output => output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).at(-1)
const asJson = output => JSON.parse(lastLine(output))
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

const ids = Object.fromEntries([
  'org', 'actor', 'reporter', 'subject', 'reviewerA', 'reviewerB',
  'division', 'department', 'ovrRoute', 'ovrConflict',
  'cycleRouteA', 'cycleRouteB', 'stageRouteA', 'stageRouteB',
  'cycleConflict', 'stageConflict', 'membershipA', 'membershipADepartment', 'membershipB',
  'relatedPerson', 'reportingLine',
].map(key => [key, randomUUID()]))
const runToken = randomUUID().replaceAll('-', '').slice(0, 16)
const email = label => `p1-${runToken}-${label}@example.test`
const employeeNo = label => `P1-${runToken}-${label}`

const inspect = await runProcess('docker', [
  'inspect', '--format', '{{.Config.Image}}|{{.HostConfig.NetworkMode}}', container,
])
if (!inspect.toLowerCase().includes('supabase/postgres')) {
  throw new Error('Disposable proof failed: container image is not the Supabase Postgres runtime')
}

const sentinel = asJson(await runSql(`
select jsonb_build_object(
  'database', current_database(),
  'database_user', current_user,
  'migration_190_present', exists (
    select 1 from supabase_migrations.schema_migrations where version = '190'
  ),
  'migration_191_present', exists (
    select 1 from supabase_migrations.schema_migrations where version = '191'
  ),
  'migration_192_present', exists (
    select 1 from supabase_migrations.schema_migrations where version = '192'
  ),
  'routing_function_present', to_regprocedure(
    'public.ovr_v11_route_reviewer(uuid,uuid,uuid,text)'
  ) is not null,
  'fixture_absent', not exists (
    select 1 from public.organizations where id = '${ids.org}'
  )
)::text;
`))

if (
  sentinel.database !== 'postgres'
  || sentinel.database_user !== 'postgres'
  || !sentinel.migration_190_present
  || !sentinel.migration_191_present
  || !sentinel.migration_192_present
  || !sentinel.routing_function_present
  || !sentinel.fixture_absent
) {
  throw new Error('Disposable proof failed: exact local baseline/P1 sentinel did not match')
}

const setupSql = `
set request.jwt.claim.role = 'service_role';
insert into public.organizations (id, name_en)
values ('${ids.org}', 'P1 concurrency ${runToken}');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
) values
  ('${ids.actor}', 'authenticated', 'authenticated', '${email('actor')}', '', now(), now(), now()),
  ('${ids.reporter}', 'authenticated', 'authenticated', '${email('reporter')}', '', now(), now(), now()),
  ('${ids.subject}', 'authenticated', 'authenticated', '${email('subject')}', '', now(), now(), now()),
  ('${ids.reviewerA}', 'authenticated', 'authenticated', '${email('reviewer-a')}', '', now(), now(), now()),
  ('${ids.reviewerB}', 'authenticated', 'authenticated', '${email('reviewer-b')}', '', now(), now(), now());

insert into public.profiles (
  id, organization_id, full_name_en, email, employee_no, is_active, user_status
) values
  ('${ids.actor}', '${ids.org}', 'P1 Actor', '${email('actor')}', '${employeeNo('ACTOR')}', true, 'active'),
  ('${ids.reporter}', '${ids.org}', 'P1 Reporter', '${email('reporter')}', '${employeeNo('REPORTER')}', true, 'active'),
  ('${ids.subject}', '${ids.org}', 'P1 Subject', '${email('subject')}', '${employeeNo('SUBJECT')}', true, 'active'),
  ('${ids.reviewerA}', '${ids.org}', 'P1 Reviewer A', '${email('reviewer-a')}', '${employeeNo('RA')}', true, 'active'),
  ('${ids.reviewerB}', '${ids.org}', 'P1 Reviewer B', '${email('reviewer-b')}', '${employeeNo('RB')}', true, 'active');

insert into public.user_credential_states (
  user_id, organization_id, auth_email, identity_mode, credential_state,
  requested_lifecycle, credential_version
)
select id, organization_id, email, 'legacy_verified', 'active', 'active', 1
from public.profiles where organization_id = '${ids.org}'
on conflict (user_id) do update
set organization_id = excluded.organization_id,
    auth_email = excluded.auth_email,
    identity_mode = excluded.identity_mode,
    credential_state = excluded.credential_state,
    requested_lifecycle = excluded.requested_lifecycle,
    credential_version = excluded.credential_version,
    session_valid_after = clock_timestamp();

insert into public.divisions (id, organization_id, name_en, code)
values ('${ids.division}', '${ids.org}', 'P1 Division', 'P1-${runToken}-DIV');
insert into public.departments (id, organization_id, division_id, name_en, code)
values ('${ids.department}', '${ids.org}', '${ids.division}', 'P1 Department', 'P1-${runToken}-DEPT');
update public.profiles
set division_id = '${ids.division}', department_id = '${ids.department}'
where organization_id = '${ids.org}';

insert into public.user_roles (user_id, role, scope, organization_id, is_active) values
  ('${ids.actor}', 'governance_admin', 'global', '${ids.org}', true),
  ('${ids.reviewerA}', 'governance_admin', 'global', '${ids.org}', true),
  ('${ids.reviewerB}', 'compliance_officer', 'global', '${ids.org}', true);

insert into public.ovr_reports (
  id, organization_id, ovr_number, brief_description, occurrence_category,
  department_id, division_id, reported_by, created_by, status, severity_level
) values
  ('${ids.ovrRoute}', '${ids.org}', 'OVR-P1-${runToken}-ROUTE',
   'P1 concurrent routing fixture', 'other', '${ids.department}', '${ids.division}',
   '${ids.reporter}', '${ids.reporter}', 'quality_validation', 'level_2'),
  ('${ids.ovrConflict}', '${ids.org}', 'OVR-P1-${runToken}-CONFLICT',
   'P1 route versus late conflict fixture', 'other', '${ids.department}', '${ids.division}',
   '${ids.reporter}', '${ids.reporter}', 'quality_validation', 'level_2');

insert into public.ovr_relationship_state (
  organization_id, ovr_report_id, sensitivity, routing_status
) values
  ('${ids.org}', '${ids.ovrRoute}', 'normal', 'ready'),
  ('${ids.org}', '${ids.ovrConflict}', 'normal', 'ready');

insert into public.ovr_related_persons (
  id, organization_id, ovr_report_id, profile_id, relationship_type,
  provenance, asserted_by, confirmation_status, confirmed_by, confirmed_at, is_active
) values (
  '${ids.relatedPerson}', '${ids.org}', '${ids.ovrConflict}', '${ids.subject}', 'subject',
  'quality_confirmation', '${ids.actor}', 'confirmed', '${ids.actor}', now(), true
);

insert into public.ovr_reviewer_pool_memberships (
  id, organization_id, profile_id, capability, scope, division_id, department_id, priority,
  confidential_clearance, retaliation_clearance, valid_from, is_active, created_by
) values
  ('${ids.membershipA}', '${ids.org}', '${ids.reviewerA}', 'quality_review', 'global', null, null, 10, true, true, now() - interval '1 day', true, '${ids.actor}'),
  ('${ids.membershipADepartment}', '${ids.org}', '${ids.reviewerA}', 'quality_review', 'department', null, '${ids.department}', 5, true, true, now() - interval '12 hours', true, '${ids.actor}'),
  ('${ids.membershipB}', '${ids.org}', '${ids.reviewerB}', 'quality_review', 'global', null, null, 20, true, true, now() - interval '1 day', true, '${ids.actor}');

insert into public.ovr_review_cycles (
  id, organization_id, ovr_report_id, cycle_number, status, opened_at, opened_by
) values ('${ids.cycleConflict}', '${ids.org}', '${ids.ovrConflict}', 1, 'active', now(), '${ids.actor}');
insert into public.ovr_stage_instances (
  id, organization_id, ovr_report_id, review_cycle_id, stage_type,
  sequence_number, lifecycle_status, opened_at, relationship_version
) values ('${ids.stageConflict}', '${ids.org}', '${ids.ovrConflict}', '${ids.cycleConflict}', 'quality_review', 1, 'pending', now(), 0);
`

const cleanupSql = `
begin;
set local session_replication_role = replica;
do $cleanup$
declare
  v_table record;
begin
  for v_table in
    select n.nspname, c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and a.attname = 'organization_id'
      and not a.attisdropped
      and c.relname <> 'organizations'
    order by c.relname
  loop
    execute format('delete from %I.%I where organization_id = $1', v_table.nspname, v_table.relname)
      using '${ids.org}'::uuid;
  end loop;
  delete from public.organizations where id = '${ids.org}';
  delete from auth.users where id in (
    '${ids.actor}', '${ids.reporter}', '${ids.subject}', '${ids.reviewerA}', '${ids.reviewerB}'
  );
end;
$cleanup$;
commit;

do $verify$
declare
  v_table record;
  v_count bigint;
begin
  if exists (select 1 from public.organizations where id = '${ids.org}')
     or exists (select 1 from auth.users where id in (
       '${ids.actor}', '${ids.reporter}', '${ids.subject}', '${ids.reviewerA}', '${ids.reviewerB}'
     ))
  then
    raise exception 'P1_SCOPED_CLEANUP_FAILED';
  end if;
  for v_table in
    select n.nspname, c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and a.attname = 'organization_id'
      and not a.attisdropped
    order by c.relname
  loop
    execute format('select count(*) from %I.%I where organization_id = $1', v_table.nspname, v_table.relname)
      into v_count using '${ids.org}'::uuid;
    if v_count <> 0 then
      raise exception 'P1_SCOPED_CLEANUP_FAILED: %.% has % rows', v_table.nspname, v_table.relname, v_count;
    end if;
  end loop;
end;
$verify$;
select 'P1_SCOPED_CLEANUP_OK';
`

let primaryError
try {
  await runSql(setupSql)

  const cycleSql = proposedId => `
    insert into public.ovr_review_cycles (
      id, organization_id, ovr_report_id, cycle_number, status, opened_at, opened_by
    ) values (
      '${proposedId}', '${ids.org}', '${ids.ovrRoute}', 1, 'active', now(), '${ids.actor}'
    ) on conflict do nothing;
    select id::text from public.ovr_review_cycles
    where organization_id = '${ids.org}' and ovr_report_id = '${ids.ovrRoute}'
      and cycle_number = 1;
  `
  const [cycleResultA, cycleResultB] = await Promise.all([
    runSql(cycleSql(ids.cycleRouteA)),
    runSql(cycleSql(ids.cycleRouteB)),
  ])
  const canonicalCycleA = lastLine(cycleResultA)
  const canonicalCycleB = lastLine(cycleResultB)
  if (!canonicalCycleA || canonicalCycleA !== canonicalCycleB) {
    throw new Error('Concurrent cycle creation did not converge on one canonical cycle')
  }

  const stageSql = proposedId => `
    insert into public.ovr_stage_instances (
      id, organization_id, ovr_report_id, review_cycle_id, stage_type,
      sequence_number, lifecycle_status, opened_at, relationship_version
    ) values (
      '${proposedId}', '${ids.org}', '${ids.ovrRoute}', '${canonicalCycleA}',
      'quality_review', 1, 'pending', now(), 0
    ) on conflict do nothing;
    select id::text from public.ovr_stage_instances
    where organization_id = '${ids.org}' and ovr_report_id = '${ids.ovrRoute}'
      and review_cycle_id = '${canonicalCycleA}' and stage_type = 'quality_review'
      and lifecycle_status in ('pending', 'routing', 'assigned', 'blocked');
  `
  const [stageResultA, stageResultB] = await Promise.all([
    runSql(stageSql(ids.stageRouteA)),
    runSql(stageSql(ids.stageRouteB)),
  ])
  const canonicalStageA = lastLine(stageResultA)
  const canonicalStageB = lastLine(stageResultB)
  if (!canonicalStageA || canonicalStageA !== canonicalStageB) {
    throw new Error('Concurrent stage creation did not converge on one canonical stage')
  }

  const routeSql = (ovrId, stageId, key) => `
    set request.jwt.claim.role = 'service_role';
    select public.ovr_v11_route_reviewer(
      '${ids.actor}', '${ovrId}', '${stageId}', '${key}'
    )::text;
  `
  const [routeA, routeB] = await Promise.all([
    runSql(routeSql(ids.ovrRoute, canonicalStageA, `p1-${runToken}-route-a`)),
    runSql(routeSql(ids.ovrRoute, canonicalStageA, `p1-${runToken}-route-b`)),
  ])
  const routeResultA = JSON.parse(lastLine(routeA))
  const routeResultB = JSON.parse(lastLine(routeB))
  if (!routeResultA.assignment_id || routeResultA.assignment_id !== routeResultB.assignment_id) {
    throw new Error('Independent routing callers did not resolve to the same assignment ID')
  }

  const routeHistory = asJson(await runSql(`
    select jsonb_build_object(
      'cycle_count', (select count(*) from public.ovr_review_cycles where organization_id = '${ids.org}' and ovr_report_id = '${ids.ovrRoute}'),
      'stage_count', (select count(*) from public.ovr_stage_instances where organization_id = '${ids.org}' and ovr_report_id = '${ids.ovrRoute}'),
      'assignment_count', (select count(*) from public.ovr_reviewer_assignments where stage_instance_id = '${canonicalStageA}'),
      'active_count', (select count(*) from public.ovr_reviewer_assignments where stage_instance_id = '${canonicalStageA}' and status = 'active'),
      'routing_requested', (select count(*) from public.ovr_routing_events where stage_instance_id = '${canonicalStageA}' and event_type = 'routing_requested'),
      'candidate_evaluated', (select count(*) from public.ovr_routing_events where stage_instance_id = '${canonicalStageA}' and event_type = 'candidate_evaluated'),
      'assignment_created', (select count(*) from public.ovr_routing_events where stage_instance_id = '${canonicalStageA}' and event_type = 'assignment_created'),
      'existing_assignment', (select count(*) from public.ovr_routing_events where stage_instance_id = '${canonicalStageA}' and event_type = 'existing_assignment'),
      'reviewer_profile_id', (select reviewer_profile_id::text from public.ovr_reviewer_assignments where stage_instance_id = '${canonicalStageA}' and status = 'active'),
      'reviewer_membership_id', (select reviewer_membership_id::text from public.ovr_reviewer_assignments where stage_instance_id = '${canonicalStageA}' and status = 'active'),
      'effective_candidate_count', (
        select (metadata->>'candidate_count')::integer
        from public.ovr_routing_events
        where stage_instance_id = '${canonicalStageA}' and event_type = 'candidate_evaluated'
      ),
      'terminal_membership_id', (
        select metadata->>'membership_id'
        from public.ovr_routing_events
        where stage_instance_id = '${canonicalStageA}' and event_type = 'assignment_created'
      ),
      'contradictory_terminal_events', (
        select count(*) from public.ovr_routing_events
        where stage_instance_id = '${canonicalStageA}'
          and event_type in ('reassignment', 'no_eligible_reviewer', 'conflict_invalidated')
      )
    )::text;
  `))
  const expectedRouteHistory = {
    cycle_count: 1,
    stage_count: 1,
    assignment_count: 1,
    active_count: 1,
    routing_requested: 1,
    candidate_evaluated: 1,
    assignment_created: 1,
    existing_assignment: 1,
    reviewer_profile_id: ids.reviewerA,
    reviewer_membership_id: ids.membershipADepartment,
    effective_candidate_count: 2,
    terminal_membership_id: ids.membershipADepartment,
    contradictory_terminal_events: 0,
  }
  for (const [field, expected] of Object.entries(expectedRouteHistory)) {
    if (routeHistory[field] !== expected) {
      throw new Error(`Concurrent route history mismatch for ${field}: expected ${expected}, got ${routeHistory[field]}`)
    }
  }

  // Start routing first, then introduce a genuinely late relationship conflict
  // from an independent session while the per-OVR advisory lock is held.
  const conflictRoutePromise = runSql(
    routeSql(ids.ovrConflict, ids.stageConflict, `p1-${runToken}-late-route`),
    30_000,
  )
  await pause(75)
  const lateConflictPromise = runSql(`
    insert into public.organization_reporting_lines (
      id, organization_id, employee_profile_id, manager_profile_id,
      relationship_type, is_primary, provenance, asserted_by, confirmed_by,
      confirmed_at, is_active
    ) values (
      '${ids.reportingLine}', '${ids.org}', '${ids.subject}', '${ids.reviewerA}',
      'direct', true, 'governance_confirmation', '${ids.actor}', '${ids.actor}',
      now(), true
    );
    select 'LATE_CONFLICT_COMMITTED';
  `, 30_000)
  await Promise.all([conflictRoutePromise, lateConflictPromise])

  const conflictOutcome = asJson(await runSql(`
    select jsonb_build_object(
      'active_count', (select count(*) from public.ovr_reviewer_assignments where stage_instance_id = '${ids.stageConflict}' and status = 'active'),
      'reviewer_a_active', exists (select 1 from public.ovr_reviewer_assignments where stage_instance_id = '${ids.stageConflict}' and reviewer_profile_id = '${ids.reviewerA}' and status = 'active'),
      'reviewer_b_active', exists (select 1 from public.ovr_reviewer_assignments where stage_instance_id = '${ids.stageConflict}' and reviewer_profile_id = '${ids.reviewerB}' and status = 'active'),
      'reviewer_a_invalidated', exists (select 1 from public.ovr_reviewer_assignments where stage_instance_id = '${ids.stageConflict}' and reviewer_profile_id = '${ids.reviewerA}' and status = 'conflict_invalidated'),
      'stage_status', (select lifecycle_status from public.ovr_stage_instances where id = '${ids.stageConflict}'),
      'lineage_event_count', (
        select count(*) from public.ovr_conflict_events
        where ovr_report_id = '${ids.ovrConflict}'
          and event_type = 'conflict_detected'
          and conflict_basis = 'manager_of_subject'
          and related_person_id = '${ids.relatedPerson}'
          and reporting_line_id = '${ids.reportingLine}'
      ),
      'routing_terminal_count', (
        select count(*) from public.ovr_routing_events
        where stage_instance_id = '${ids.stageConflict}'
          and event_type in ('assignment_created', 'reassignment')
      ),
      'invalidation_event_count', (
        select count(*) from public.ovr_routing_events
        where stage_instance_id = '${ids.stageConflict}'
          and event_type = 'conflict_invalidated'
      )
    )::text;
  `))

  const routedAfterConflict = conflictOutcome.active_count === 1
    && conflictOutcome.reviewer_b_active
    && !conflictOutcome.reviewer_a_active
    && conflictOutcome.stage_status === 'assigned'
    && conflictOutcome.invalidation_event_count === 0
  const invalidatedAfterRoute = conflictOutcome.active_count === 0
    && conflictOutcome.reviewer_a_invalidated
    && !conflictOutcome.reviewer_a_active
    && conflictOutcome.stage_status === 'blocked'
    && conflictOutcome.invalidation_event_count === 1
  if (
    (!routedAfterConflict && !invalidatedAfterRoute)
    || conflictOutcome.lineage_event_count !== 1
    || conflictOutcome.routing_terminal_count !== 1
  ) {
    throw new Error(`Route-versus-conflict final state was inconsistent: ${JSON.stringify(conflictOutcome)}`)
  }

  process.stdout.write(
    `P1 concurrency proof passed (${runToken}): canonical cycle/stage, same assignment, complete history, no deadlock.\n`,
  )
} catch (error) {
  primaryError = error
} finally {
  try {
    const cleanupResult = await runSql(cleanupSql)
    if (!cleanupResult.includes('P1_SCOPED_CLEANUP_OK')) {
      throw new Error('Scoped cleanup did not return its completion sentinel')
    }
  } catch (cleanupError) {
    if (primaryError) {
      primaryError = new AggregateError([primaryError, cleanupError], 'P1 proof and scoped cleanup both failed')
    } else {
      primaryError = cleanupError
    }
  }
}

if (primaryError) throw primaryError
