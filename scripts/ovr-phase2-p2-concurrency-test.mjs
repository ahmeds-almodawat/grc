import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const container = process.env.P2_DB_CONTAINER
const cleanupConfirmation = process.env.P2_DISPOSABLE_CONFIRM

if (!container || !/^supabase_db_[A-Za-z0-9_.-]+$/.test(container)) {
  throw new Error('P2_DB_CONTAINER must name the disposable local Supabase database container')
}
if (cleanupConfirmation !== 'P2_SCOPED_DISPOSABLE_FIXTURES_ONLY') {
  throw new Error('P2_DISPOSABLE_CONFIRM must explicitly authorize scoped disposable-fixture cleanup')
}

function runProcess(command, args, { input, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill(), timeoutMs)
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => {
      clearTimeout(timer)
      if (code === 0) return resolve(stdout)
      const redacted = stderr.replaceAll(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DB_URL]')
      reject(new Error(`process exited ${code}: ${redacted || stdout}`))
    })
    child.stdin.end(input)
  })
}

const psqlArgs = [
  'exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres',
  '-AtX', '-v', 'ON_ERROR_STOP=1'
]
const runSql = (sql, timeoutMs = 30_000) => runProcess('docker', psqlArgs, { input: sql, timeoutMs })
const lastLine = output => output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).at(-1)
const asJson = output => JSON.parse(lastLine(output))
const serviceSql = sql => `select pg_catalog.set_config('request.jwt.claim.role','service_role',false);\n${sql}`

const id = () => randomUUID()
const ids = {
  org: id(), reporter: id(), verdictActor: id(), closer: id(),
  division: id(), department: id(), verdictMembership: id(), closureMembership: id()
}
const labels = [
  'verdict', 'closure', 'ack', 'dispute', 'conflict', 'recuse',
  'verdictRecuse', 'verdictConflict', 'closureVerdict', 'disputeClosure'
]
const cases = Object.fromEntries(labels.map(label => [label, {
  ovr: id(), cycle: id(), verdictStage: id(), closureStage: id(),
  verdictAssignment: id(), closureAssignment: id(), evidence: id()
}]))
const runToken = randomUUID().replaceAll('-', '').slice(0, 16)
const email = label => `p2-${runToken}-${label}@example.test`

const ovrRows = labels.map((label, index) => {
  const c = cases[label]
  return `('${c.ovr}','${ids.org}','OVR-P2-RACE-${runToken}-${index + 1}',` +
    `'P2 ${label} concurrency fixture','other','${ids.division}','${ids.department}',` +
    `'${ids.reporter}','${ids.reporter}','quality_final_review','level_2',true)`
}).join(',\n')

const stateRows = labels.map(label =>
  `('${ids.org}','${cases[label].ovr}','normal','ready',null)`
).join(',\n')

const reporterRows = labels.map(label =>
  `('${ids.org}','${cases[label].ovr}','${ids.reporter}','reporter','report_submission',` +
  `'${ids.reporter}','confirmed','${ids.reporter}',now(),true)`
).join(',\n')

const cycleRows = labels.map(label =>
  `('${cases[label].cycle}','${ids.org}','${cases[label].ovr}',1,'active',now(),'${ids.verdictActor}')`
).join(',\n')

const stageRows = labels.flatMap(label => {
  const c = cases[label]
  return [
    `('${c.verdictStage}','${ids.org}','${c.ovr}','${c.cycle}','final_verdict',1,'assigned',0)`,
    `('${c.closureStage}','${ids.org}','${c.ovr}','${c.cycle}','governance_closure',2,'assigned',0)`
  ]
}).join(',\n')

const assignmentRows = labels.flatMap(label => {
  const c = cases[label]
  return [
    `('${c.verdictAssignment}','${ids.org}','${c.ovr}','${c.cycle}','${c.verdictStage}',` +
      `'${ids.verdictActor}','${ids.verdictMembership}','active','p2_concurrency',repeat('a',64),0,'p2-${runToken}-${label}-verdict-assignment')`,
    `('${c.closureAssignment}','${ids.org}','${c.ovr}','${c.cycle}','${c.closureStage}',` +
      `'${ids.closer}','${ids.closureMembership}','active','p2_concurrency',repeat('b',64),0,'p2-${runToken}-${label}-closure-assignment')`
  ]
}).join(',\n')

const evidenceRows = labels.map(label => {
  const c = cases[label]
  return `('${c.evidence}','${ids.org}','${c.ovr}','p2-${label}.pdf',` +
    `'p2/${runToken}/${label}.pdf','accepted','${ids.reporter}','accepted',true,current_date+30)`
}).join(',\n')

const setupSql = serviceSql(`
begin;
insert into public.organizations(id,name_en) values('${ids.org}','P2 Concurrency Organization');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
  ('${ids.reporter}','authenticated','authenticated','${email('reporter')}','',now(),now(),now()),
  ('${ids.verdictActor}','authenticated','authenticated','${email('verdict')}','',now(),now(),now()),
  ('${ids.closer}','authenticated','authenticated','${email('closer')}','',now(),now(),now());
insert into public.profiles(id,organization_id,full_name_en,email,employee_no,is_active,user_status) values
  ('${ids.reporter}','${ids.org}','P2 Reporter','${email('reporter')}','P2-${runToken}-R',true,'active'),
  ('${ids.verdictActor}','${ids.org}','P2 Verdict Actor','${email('verdict')}','P2-${runToken}-V',true,'active'),
  ('${ids.closer}','${ids.org}','P2 Closer','${email('closer')}','P2-${runToken}-C',true,'active');
insert into public.user_credential_states(user_id,organization_id,auth_email,identity_mode,credential_state,requested_lifecycle,credential_version)
select id,organization_id,email,'legacy_verified','active','active',1
from public.profiles where organization_id='${ids.org}'
on conflict(user_id) do update set organization_id=excluded.organization_id,
  auth_email=excluded.auth_email,identity_mode=excluded.identity_mode,
  credential_state=excluded.credential_state,requested_lifecycle=excluded.requested_lifecycle,
  credential_version=excluded.credential_version,session_valid_after=clock_timestamp();
insert into public.divisions(id,organization_id,name_en,code)
values('${ids.division}','${ids.org}','P2 Concurrency Division','P2-${runToken}-D');
insert into public.departments(id,organization_id,division_id,name_en,code)
values('${ids.department}','${ids.org}','${ids.division}','P2 Concurrency Department','P2-${runToken}-DEP');
update public.profiles set division_id='${ids.division}',department_id='${ids.department}' where organization_id='${ids.org}';
insert into public.user_roles(user_id,role,scope,organization_id,is_active) values
  ('${ids.reporter}','employee','assigned_only','${ids.org}',true),
  ('${ids.verdictActor}','governance_admin','global','${ids.org}',true),
  ('${ids.closer}','compliance_officer','global','${ids.org}',true);
insert into public.ovr_reviewer_pool_memberships(
 id,organization_id,profile_id,capability,scope,priority,confidential_clearance,
 retaliation_clearance,valid_from,is_active,created_by
) values
 ('${ids.verdictMembership}','${ids.org}','${ids.verdictActor}','final_verdict','global',10,true,true,now()-interval '1 day',true,'${ids.verdictActor}'),
 ('${ids.closureMembership}','${ids.org}','${ids.closer}','governance_closure','global',10,true,true,now()-interval '1 day',true,'${ids.verdictActor}');
insert into public.ovr_separation_policies(organization_id,allow_same_actor_ordinary,configured_by,configuration_reason)
values('${ids.org}',false,'${ids.verdictActor}','P2 concurrency distinct-actor policy');
insert into public.ovr_reports(
 id,organization_id,ovr_number,brief_description,occurrence_category,division_id,
 department_id,reported_by,created_by,status,severity_level,evidence_required
) values ${ovrRows};
insert into public.ovr_relationship_state(organization_id,ovr_report_id,sensitivity,routing_status,routing_block_reason)
values ${stateRows};
insert into public.ovr_related_persons(
 organization_id,ovr_report_id,profile_id,relationship_type,provenance,asserted_by,
 confirmation_status,confirmed_by,confirmed_at,is_active
) values ${reporterRows};
insert into public.ovr_review_cycles(id,organization_id,ovr_report_id,cycle_number,status,opened_at,opened_by)
values ${cycleRows};
insert into public.ovr_stage_instances(
 id,organization_id,ovr_report_id,review_cycle_id,stage_type,sequence_number,
 lifecycle_status,relationship_version
) values ${stageRows};
insert into public.ovr_reviewer_assignments(
 id,organization_id,ovr_report_id,review_cycle_id,stage_instance_id,
 reviewer_profile_id,reviewer_membership_id,status,assignment_reason,
 candidate_digest,conflict_version,idempotency_key
) values ${assignmentRows};
insert into public.evidence_files(
 id,organization_id,ovr_report_id,file_name,file_path,status,uploaded_by,
 review_status,is_current_version,expiry_date
) values ${evidenceRows};
commit;
`)

const cleanupSql = `
begin;
set local session_replication_role = replica;
do $cleanup$
declare v_table record;
begin
  for v_table in
    select n.nspname,c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=c.oid
    where n.nspname='public' and c.relkind in ('r','p')
      and a.attname='organization_id' and not a.attisdropped
      and c.relname<>'organizations'
    order by c.relname
  loop
    execute format('delete from %I.%I where organization_id=$1',v_table.nspname,v_table.relname)
      using '${ids.org}'::uuid;
  end loop;
  delete from public.organizations where id='${ids.org}';
  delete from auth.users where id in ('${ids.reporter}','${ids.verdictActor}','${ids.closer}');
end;
$cleanup$;
commit;
select case when exists(select 1 from public.organizations where id='${ids.org}')
  then 'P2_SCOPED_CLEANUP_FAILED' else 'P2_SCOPED_CLEANUP_OK' end;
`

const issue = (label, key) => {
  const c = cases[label]
  return runSql(serviceSql(`select public.ovr_v11_issue_final_verdict(
    '${ids.verdictActor}','${c.ovr}','${c.verdictStage}',
    'confirmed_occurrence','level_2',false,'${key}',null
  )::text;`))
}
const close = (label, verdictId, key) => {
  const c = cases[label]
  return runSql(serviceSql(`select public.ovr_v11_perform_governance_closure(
    '${ids.closer}','${c.ovr}','${c.closureStage}','${verdictId}','${key}'
  )::text;`))
}
const count = async (table, ovr) => Number(lastLine(await runSql(
  `select count(*) from public.${table} where ovr_report_id='${ovr}';`
)))

const results = {}
let primaryError
try {
  await runSql(setupSql, 60_000)

  const verdictRace = await Promise.allSettled([
    issue('verdict', `p2-${runToken}-verdict-race-a`),
    issue('verdict', `p2-${runToken}-verdict-race-b`)
  ])
  results.two_verdict_attempts = {
    fulfilled: verdictRace.filter(item => item.status === 'fulfilled').length,
    verdict_count: await count('ovr_final_verdicts', cases.verdict.ovr)
  }

  const closureVerdict = asJson(await issue('closure', `p2-${runToken}-closure-verdict`))
  const closureRace = await Promise.allSettled([
    close('closure', closureVerdict.final_verdict_id, `p2-${runToken}-closure-race-a`),
    close('closure', closureVerdict.final_verdict_id, `p2-${runToken}-closure-race-b`)
  ])
  results.two_closure_attempts = {
    fulfilled: closureRace.filter(item => item.status === 'fulfilled').length,
    closure_count: await count('ovr_governance_closures', cases.closure.ovr)
  }

  const ackVerdict = asJson(await issue('ack', `p2-${runToken}-ack-verdict`))
  const ackClosure = asJson(await close('ack', ackVerdict.final_verdict_id, `p2-${runToken}-ack-closure`))
  const ackSql = serviceSql(`select public.ovr_v11_reporter_acknowledge(
    '${ids.reporter}','${cases.ack.ovr}','${ackClosure.governance_closure_id}',
    'p2-${runToken}-ack-retry'
  )::text;`)
  const [ackA, ackB] = await Promise.all([runSql(ackSql), runSql(ackSql)])
  results.acknowledgment_retries = {
    identical: lastLine(ackA) === lastLine(ackB),
    response_count: await count('ovr_reporter_responses', cases.ack.ovr)
  }

  const disputeVerdict = asJson(await issue('dispute', `p2-${runToken}-dispute-verdict`))
  const disputeClosure = asJson(await close('dispute', disputeVerdict.final_verdict_id, `p2-${runToken}-dispute-closure`))
  const disputeSql = serviceSql(`select public.ovr_v11_reporter_dispute(
    '${ids.reporter}','${cases.dispute.ovr}','${disputeClosure.governance_closure_id}',
    'Concurrent dispute retry','p2-${runToken}-dispute-retry'
  )::text;`)
  const [disputeA, disputeB] = await Promise.all([runSql(disputeSql), runSql(disputeSql)])
  results.dispute_retries = {
    identical: lastLine(disputeA) === lastLine(disputeB),
    response_count: await count('ovr_reporter_responses', cases.dispute.ovr),
    review_count: await count('ovr_post_closure_reviews', cases.dispute.ovr)
  }

  const conflictVerdict = asJson(await issue('conflict', `p2-${runToken}-conflict-verdict`))
  const lateConflictSql = serviceSql(`insert into public.ovr_related_persons(
    organization_id,ovr_report_id,profile_id,relationship_type,provenance,
    asserted_by,confirmation_status,confirmed_by,confirmed_at,is_active,conflict_actions
  ) values('${ids.org}','${cases.conflict.ovr}','${ids.closer}','subject',
    'quality_confirmation','${ids.verdictActor}','confirmed','${ids.verdictActor}',
    now(),true,array['governance_closure']::text[]);`)
  const conflictRace = await Promise.allSettled([
    close('conflict', conflictVerdict.final_verdict_id, `p2-${runToken}-conflict-close`),
    runSql(lateConflictSql)
  ])
  results.closure_vs_late_conflict = {
    fulfilled: conflictRace.filter(item => item.status === 'fulfilled').length,
    closure_count: await count('ovr_governance_closures', cases.conflict.ovr),
    assignment_status: lastLine(await runSql(`select status from public.ovr_reviewer_assignments where id='${cases.conflict.closureAssignment}';`)),
    conflict_count: Number(lastLine(await runSql(`select count(*) from ovr_v11_private.current_conflicts(
      '${ids.org}','${cases.conflict.ovr}','governance_closure',statement_timestamp()
    ) where affected_profile_id='${ids.closer}';`)))
  }

  const recuseVerdict = asJson(await issue('recuse', `p2-${runToken}-recuse-verdict`))
  const recuseSql = serviceSql(`select public.ovr_v11_recuse_assignment(
    '${ids.verdictActor}','${cases.recuse.closureAssignment}','Concurrent controlled recusal',
    'p2-${runToken}-recuse'
  )::text;`)
  const recuseRace = await Promise.allSettled([
    close('recuse', recuseVerdict.final_verdict_id, `p2-${runToken}-recuse-close`),
    runSql(recuseSql)
  ])
  results.closure_vs_recusal = {
    fulfilled: recuseRace.filter(item => item.status === 'fulfilled').length,
    closure_count: await count('ovr_governance_closures', cases.recuse.ovr),
    assignment_status: lastLine(await runSql(`select status from public.ovr_reviewer_assignments where id='${cases.recuse.closureAssignment}';`))
  }

  const verdictRecuseSql = serviceSql(`select public.ovr_v11_recuse_assignment(
    '${ids.verdictActor}','${cases.verdictRecuse.verdictAssignment}',
    'Concurrent verdict recusal','p2-${runToken}-verdict-recuse'
  )::text;`)
  const verdictRecuseRace = await Promise.allSettled([
    issue('verdictRecuse', `p2-${runToken}-verdict-recuse-issue`),
    runSql(verdictRecuseSql)
  ])
  results.verdict_vs_recusal = {
    fulfilled: verdictRecuseRace.filter(item => item.status === 'fulfilled').length,
    verdict_count: await count('ovr_final_verdicts', cases.verdictRecuse.ovr),
    assignment_status: lastLine(await runSql(`select status from public.ovr_reviewer_assignments where id='${cases.verdictRecuse.verdictAssignment}';`))
  }

  const lateVerdictConflictSql = serviceSql(`insert into public.ovr_related_persons(
    organization_id,ovr_report_id,profile_id,relationship_type,provenance,
    asserted_by,confirmation_status,confirmed_by,confirmed_at,is_active,conflict_actions
  ) values('${ids.org}','${cases.verdictConflict.ovr}','${ids.verdictActor}','subject',
    'quality_confirmation','${ids.closer}','confirmed','${ids.closer}',now(),true,
    array['final_verdict']::text[]);`)
  const verdictConflictRace = await Promise.allSettled([
    issue('verdictConflict', `p2-${runToken}-verdict-conflict-issue`),
    runSql(lateVerdictConflictSql)
  ])
  results.verdict_vs_late_conflict = {
    fulfilled: verdictConflictRace.filter(item => item.status === 'fulfilled').length,
    verdict_count: await count('ovr_final_verdicts', cases.verdictConflict.ovr),
    assignment_status: lastLine(await runSql(`select status from public.ovr_reviewer_assignments where id='${cases.verdictConflict.verdictAssignment}';`)),
    conflict_count: Number(lastLine(await runSql(`select count(*) from ovr_v11_private.current_conflicts(
      '${ids.org}','${cases.verdictConflict.ovr}','final_verdict',statement_timestamp()
    ) where affected_profile_id='${ids.verdictActor}';`)))
  }

  const closureVsVerdictInitial = asJson(await issue('closureVerdict', `p2-${runToken}-closure-verdict-initial`))
  const closureVerdictRace = await Promise.allSettled([
    close('closureVerdict', closureVsVerdictInitial.final_verdict_id, `p2-${runToken}-closure-verdict-close`),
    issue('closureVerdict', `p2-${runToken}-closure-verdict-second`)
  ])
  results.closure_vs_verdict = {
    fulfilled: closureVerdictRace.filter(item => item.status === 'fulfilled').length,
    verdict_count: await count('ovr_final_verdicts', cases.closureVerdict.ovr),
    closure_count: await count('ovr_governance_closures', cases.closureVerdict.ovr)
  }

  const disputeClosureVerdict = asJson(await issue('disputeClosure', `p2-${runToken}-dispute-closure-verdict`))
  const disputeClosureInitial = asJson(await close('disputeClosure', disputeClosureVerdict.final_verdict_id, `p2-${runToken}-dispute-closure-initial`))
  const disputeVsClosureSql = serviceSql(`select public.ovr_v11_reporter_dispute(
    '${ids.reporter}','${cases.disputeClosure.ovr}','${disputeClosureInitial.governance_closure_id}',
    'Concurrent dispute against immutable closure','p2-${runToken}-dispute-vs-closure'
  )::text;`)
  const disputeClosureRace = await Promise.allSettled([
    runSql(disputeVsClosureSql),
    close('disputeClosure', disputeClosureVerdict.final_verdict_id, `p2-${runToken}-dispute-closure-second`)
  ])
  results.dispute_vs_closure = {
    fulfilled: disputeClosureRace.filter(item => item.status === 'fulfilled').length,
    closure_count: await count('ovr_governance_closures', cases.disputeClosure.ovr),
    response_count: await count('ovr_reporter_responses', cases.disputeClosure.ovr),
    review_count: await count('ovr_post_closure_reviews', cases.disputeClosure.ovr)
  }

  // A late factual relationship may serialize after an already committed
  // terminal decision. In that ordering both statements are valid, but the
  // assignment must already be completed and immutable history must remain a
  // singleton. The opposite ordering leaves only the conflict/recusal action.
  const passed =
    results.two_verdict_attempts.fulfilled === 1 && results.two_verdict_attempts.verdict_count === 1 &&
    results.two_closure_attempts.fulfilled === 1 && results.two_closure_attempts.closure_count === 1 &&
    results.acknowledgment_retries.identical && results.acknowledgment_retries.response_count === 1 &&
    results.dispute_retries.identical && results.dispute_retries.response_count === 1 && results.dispute_retries.review_count === 1 &&
    ((results.closure_vs_late_conflict.fulfilled === 1 &&
      ((results.closure_vs_late_conflict.closure_count === 1 && results.closure_vs_late_conflict.conflict_count === 0) ||
       (results.closure_vs_late_conflict.closure_count === 0 && results.closure_vs_late_conflict.conflict_count === 1))) ||
     (results.closure_vs_late_conflict.fulfilled === 2 &&
      results.closure_vs_late_conflict.closure_count === 1 &&
      results.closure_vs_late_conflict.conflict_count === 1 &&
      results.closure_vs_late_conflict.assignment_status === 'completed')) &&
    results.closure_vs_recusal.fulfilled === 1 &&
    ((results.closure_vs_recusal.closure_count === 1 && results.closure_vs_recusal.assignment_status === 'completed') ||
     (results.closure_vs_recusal.closure_count === 0 && results.closure_vs_recusal.assignment_status === 'recused')) &&
    results.verdict_vs_recusal.fulfilled === 1 &&
    ((results.verdict_vs_recusal.verdict_count === 1 && results.verdict_vs_recusal.assignment_status === 'completed') ||
     (results.verdict_vs_recusal.verdict_count === 0 && results.verdict_vs_recusal.assignment_status === 'recused')) &&
    ((results.verdict_vs_late_conflict.fulfilled === 1 &&
      ((results.verdict_vs_late_conflict.verdict_count === 1 && results.verdict_vs_late_conflict.conflict_count === 0) ||
       (results.verdict_vs_late_conflict.verdict_count === 0 && results.verdict_vs_late_conflict.conflict_count === 1))) ||
     (results.verdict_vs_late_conflict.fulfilled === 2 &&
      results.verdict_vs_late_conflict.verdict_count === 1 &&
      results.verdict_vs_late_conflict.conflict_count === 1 &&
      results.verdict_vs_late_conflict.assignment_status === 'completed')) &&
    results.closure_vs_verdict.fulfilled === 1 &&
    results.closure_vs_verdict.verdict_count === 1 && results.closure_vs_verdict.closure_count === 1 &&
    results.dispute_vs_closure.fulfilled === 1 &&
    results.dispute_vs_closure.closure_count === 1 &&
    results.dispute_vs_closure.response_count === 1 &&
    results.dispute_vs_closure.review_count === 1

  if (!passed) throw new Error(`P2 concurrency contract failed: ${JSON.stringify(results)}`)
  console.log(JSON.stringify({ status: 'P2_CONCURRENCY_PASS', scenarios: results }, null, 2))
} catch (error) {
  primaryError = error
} finally {
  try {
    const cleanup = await runSql(cleanupSql, 60_000)
    if (lastLine(cleanup) !== 'P2_SCOPED_CLEANUP_OK') {
      throw new Error('P2 scoped cleanup did not verify')
    }
  } catch (cleanupError) {
    if (!primaryError) primaryError = cleanupError
    else primaryError = new Error(`${primaryError.message}; cleanup: ${cleanupError.message}`)
  }
}

if (primaryError) throw primaryError
