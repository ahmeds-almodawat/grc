import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const container = process.env.F1R2_DB_CONTAINER;
const database = process.env.F1R2_DB_NAME;
const cleanupConfirmation = process.env.F1R2_DISPOSABLE_CONFIRM;

if (!container || !/^supabase_db_[A-Za-z0-9_.-]+$/.test(container)) {
  throw new Error('F1R2_DB_CONTAINER must name a disposable local Supabase database container');
}
if (!database || !/^f1r2_[A-Za-z0-9_]+$/.test(database)) {
  throw new Error('F1R2_DB_NAME must name an isolated disposable F1-R2 database');
}
if (cleanupConfirmation !== 'DELETE_GENERATED_F1R2_FIXTURES') {
  throw new Error('F1R2_DISPOSABLE_CONFIRM must authorize scoped fixture cleanup');
}

function runProcess(command, args, { input, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) child.kill();
    }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timer);
      settled = true;
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      settled = true;
      const redacted = stderr.replaceAll(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DB_URL]');
      if (code !== 0) {
        reject(new Error(`${command} exited ${code}: ${redacted || 'no stderr'}`));
        return;
      }
      resolve(stdout.trim());
    });
    child.stdin.end(input ?? '');
  });
}

const psqlArgs = ['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database];
const runSql = (sql, timeoutMs = 30_000) => runProcess('docker', psqlArgs, { input: sql, timeoutMs });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const lastLine = output => output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).at(-1);
const asJson = output => JSON.parse(lastLine(output));
const serviceSql = sql => `set request.jwt.claim.role='service_role';\n${sql}`;

const ids = Object.fromEntries([
  'org', 'division', 'department', 'manager', 'owner', 'replacement',
  'statusFirst', 'reassignFirst', 'acceptFirst', 'reassignAcceptFirst',
  'declineFirst', 'reassignDeclineFirst',
].map(key => [key, randomUUID()]));
const token = randomUUID().replaceAll('-', '').slice(0, 14);
const email = label => `f1r2-${token}-${label}@example.test`;

const sentinel = asJson(await runSql(`select jsonb_build_object(
  'database',current_database(),
  'migration_196_function',to_regprocedure('public.f1r2_lock_work_item(text,uuid)') is not null,
  'fixture_absent',not exists(select 1 from public.organizations where id='${ids.org}')
)::text;`));
if (sentinel.database !== database || !sentinel.migration_196_function || !sentinel.fixture_absent) {
  throw new Error('Disposable F1-R2 concurrency sentinel did not match');
}

const acceptedProjects = [ids.statusFirst, ids.reassignFirst];
const pendingProjects = [ids.acceptFirst, ids.reassignAcceptFirst, ids.declineFirst, ids.reassignDeclineFirst];
const setupSql = serviceSql(`
begin;
insert into public.organizations(id,name_en) values('${ids.org}','F1-R2 concurrency ${token}');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
  ('${ids.manager}','authenticated','authenticated','${email('manager')}','',now(),now(),now()),
  ('${ids.owner}','authenticated','authenticated','${email('owner')}','',now(),now(),now()),
  ('${ids.replacement}','authenticated','authenticated','${email('replacement')}','',now(),now(),now());
insert into public.profiles(id,organization_id,employee_no,full_name_en,email,is_active,user_status) values
  ('${ids.manager}','${ids.org}','F1R2-${token}-M','Concurrency manager','${email('manager')}',true,'active'),
  ('${ids.owner}','${ids.org}','F1R2-${token}-O','Concurrency owner','${email('owner')}',true,'active'),
  ('${ids.replacement}','${ids.org}','F1R2-${token}-R','Concurrency replacement','${email('replacement')}',true,'active');
insert into public.user_credential_states(user_id,organization_id,auth_email,identity_mode,credential_state,requested_lifecycle,credential_version)
select id,organization_id,email,'legacy_verified','active','active',1 from public.profiles where organization_id='${ids.org}'
on conflict(user_id) do update set organization_id=excluded.organization_id,auth_email=excluded.auth_email,
  identity_mode=excluded.identity_mode,credential_state=excluded.credential_state,
  requested_lifecycle=excluded.requested_lifecycle,credential_version=excluded.credential_version;
insert into public.divisions(id,organization_id,name_en,code) values('${ids.division}','${ids.org}','Concurrency division','F1R2-${token}-D');
insert into public.departments(id,organization_id,division_id,name_en,code) values('${ids.department}','${ids.org}','${ids.division}','Concurrency department','F1R2-${token}-DEP');
update public.profiles set division_id='${ids.division}',department_id='${ids.department}' where organization_id='${ids.org}';
set local session_replication_role=replica;
insert into public.user_roles(user_id,role,scope,organization_id,is_active) values
  ('${ids.manager}','governance_admin','global','${ids.org}',true),
  ('${ids.owner}','project_owner','assigned_only','${ids.org}',true),
  ('${ids.replacement}','project_owner','assigned_only','${ids.org}',true);
set local session_replication_role=origin;
insert into public.projects(id,organization_id,title,category,source_type,division_id,department_id,owner_id,created_by,updated_by,status,progress_percent,evidence_required,closure_approval_required)
values
  ${acceptedProjects.map((id, index) => `('${id}','${ids.org}','Accepted race ${index + 1}','concurrency','manual','${ids.division}','${ids.department}','${ids.owner}','${ids.manager}','${ids.manager}','active',0,false,false)`).join(',\n  ')},
  ${pendingProjects.map((id, index) => `('${id}','${ids.org}','Pending race ${index + 1}','concurrency','manual','${ids.division}','${ids.department}',null,'${ids.manager}','${ids.manager}','draft',0,false,false)`).join(',\n  ')};
insert into public.work_item_assignments(organization_id,item_type,item_id,assignee_id,assigned_by,status,responded_by,responded_at)
select '${ids.org}','project',id,'${ids.owner}','${ids.manager}','accepted','${ids.owner}',statement_timestamp() from public.projects where id in (${acceptedProjects.map(id => `'${id}'`).join(',')});
insert into public.work_item_assignments(organization_id,item_type,item_id,assignee_id,assigned_by,status)
select '${ids.org}','project',id,'${ids.owner}','${ids.manager}','pending' from public.projects where id in (${pendingProjects.map(id => `'${id}'`).join(',')});
commit;
`);

const cleanupSql = `
begin;
set local session_replication_role=replica;
do $cleanup$
declare v_table record;
begin
  for v_table in
    select n.nspname,c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=c.oid
    where n.nspname='public' and c.relkind in('r','p') and a.attname='organization_id'
      and not a.attisdropped and c.relname<>'organizations' order by c.relname
  loop
    execute format('delete from %I.%I where organization_id=$1',v_table.nspname,v_table.relname) using '${ids.org}'::uuid;
  end loop;
  delete from public.organizations where id='${ids.org}';
  delete from auth.users where id in('${ids.manager}','${ids.owner}','${ids.replacement}');
end;
$cleanup$;
commit;
select case when exists(select 1 from public.organizations where id='${ids.org}') then 'F1R2_CLEANUP_FAILED' else 'F1R2_CLEANUP_OK' end;
`;

const lockThen = (itemId, statement) => serviceSql(`begin; select public.f1r2_lock_work_item('project','${itemId}'); select pg_sleep(0.25); ${statement}; commit;`);
const race = async (firstSql, secondSql) => {
  const first = runSql(firstSql);
  await pause(40);
  const second = runSql(secondSql);
  return Promise.allSettled([first, second]);
};
const reassign = itemId => `select public.f1r2_assign_work_item('${ids.manager}','project','${itemId}','${ids.replacement}','concurrency handoff')::text`;
const status = itemId => `select public.acc_v13_update_work_item_status('${ids.owner}','project','${itemId}','at_risk',25,null)::text`;
const respond = (itemId, decision) => `select public.f1r2_respond_work_item_assignment('${ids.owner}',(select id from public.work_item_assignments where item_type='project' and item_id='${itemId}' and assignee_id='${ids.owner}' order by assigned_at desc,id desc limit 1),'${decision}',${decision === 'declined' ? "'concurrent decline'" : 'null'})::text`;
const state = itemId => runSql(`select jsonb_build_object(
  'status',(select status::text from public.projects where id='${itemId}'),
  'owner_id',(select owner_id::text from public.projects where id='${itemId}'),
  'current_assignee',(select assignee_id::text from public.work_item_assignments where item_type='project' and item_id='${itemId}' and status in('pending','accepted','declined','legacy_unverified') order by assigned_at desc,id desc limit 1),
  'assignment_status',(select status from public.work_item_assignments where item_type='project' and item_id='${itemId}' and status in('pending','accepted','declined','legacy_unverified') order by assigned_at desc,id desc limit 1)
)::text;`).then(asJson);

const result = {};
let primaryError;
try {
  await runSql(setupSql, 60_000);

  const statusFirst = await race(lockThen(ids.statusFirst, status(ids.statusFirst)), serviceSql(reassign(ids.statusFirst)));
  result.status_before_reassignment = { fulfilled: statusFirst.filter(row => row.status === 'fulfilled').length, state: await state(ids.statusFirst) };

  const reassignFirst = await race(lockThen(ids.reassignFirst, reassign(ids.reassignFirst)), serviceSql(status(ids.reassignFirst)));
  result.reassignment_before_status = {
    fulfilled: reassignFirst.filter(row => row.status === 'fulfilled').length,
    stale_mutation_commits: reassignFirst[1].status === 'fulfilled' ? 1 : 0,
    denied_with_current_state: reassignFirst[1].status === 'rejected' && reassignFirst[1].reason.message.includes('F1R2_STATUS_UPDATE_DENIED'),
    state: await state(ids.reassignFirst),
  };

  const acceptFirst = await race(lockThen(ids.acceptFirst, respond(ids.acceptFirst, 'accepted')), serviceSql(reassign(ids.acceptFirst)));
  result.accept_before_reassignment = { fulfilled: acceptFirst.filter(row => row.status === 'fulfilled').length, state: await state(ids.acceptFirst) };

  const reassignAcceptFirst = await race(lockThen(ids.reassignAcceptFirst, reassign(ids.reassignAcceptFirst)), serviceSql(respond(ids.reassignAcceptFirst, 'accepted')));
  result.reassignment_before_accept = {
    fulfilled: reassignAcceptFirst.filter(row => row.status === 'fulfilled').length,
    old_response_denied: reassignAcceptFirst[1].status === 'rejected' && reassignAcceptFirst[1].reason.message.includes('F1R2_ASSIGNMENT_NOT_RESPONDABLE'),
    state: await state(ids.reassignAcceptFirst),
  };

  const declineFirst = await race(lockThen(ids.declineFirst, respond(ids.declineFirst, 'declined')), serviceSql(reassign(ids.declineFirst)));
  result.decline_before_reassignment = { fulfilled: declineFirst.filter(row => row.status === 'fulfilled').length, state: await state(ids.declineFirst) };

  const reassignDeclineFirst = await race(lockThen(ids.reassignDeclineFirst, reassign(ids.reassignDeclineFirst)), serviceSql(respond(ids.reassignDeclineFirst, 'declined')));
  result.reassignment_before_decline = {
    fulfilled: reassignDeclineFirst.filter(row => row.status === 'fulfilled').length,
    old_response_denied: reassignDeclineFirst[1].status === 'rejected' && reassignDeclineFirst[1].reason.message.includes('F1R2_ASSIGNMENT_NOT_RESPONDABLE'),
    state: await state(ids.reassignDeclineFirst),
  };

  const finalPendingReplacement = entry => entry.state.owner_id === null && entry.state.current_assignee === ids.replacement && entry.state.assignment_status === 'pending';
  const passed =
    result.status_before_reassignment.fulfilled === 2 && result.status_before_reassignment.state.status === 'at_risk' && finalPendingReplacement(result.status_before_reassignment) &&
    result.reassignment_before_status.fulfilled === 1 && result.reassignment_before_status.stale_mutation_commits === 0 && result.reassignment_before_status.denied_with_current_state && result.reassignment_before_status.state.status === 'active' && finalPendingReplacement(result.reassignment_before_status) &&
    result.accept_before_reassignment.fulfilled === 2 && finalPendingReplacement(result.accept_before_reassignment) &&
    result.reassignment_before_accept.fulfilled === 1 && result.reassignment_before_accept.old_response_denied && finalPendingReplacement(result.reassignment_before_accept) &&
    result.decline_before_reassignment.fulfilled === 2 && finalPendingReplacement(result.decline_before_reassignment) &&
    result.reassignment_before_decline.fulfilled === 1 && result.reassignment_before_decline.old_response_denied && finalPendingReplacement(result.reassignment_before_decline);
  if (!passed) throw new Error(`F1-R2 concurrency contract failed: ${JSON.stringify(result)}`);
  console.log(JSON.stringify({ status: 'F1R2_CONCURRENCY_PASS', stale_authorization_commits: 0, scenarios: result }, null, 2));
} catch (error) {
  primaryError = error;
} finally {
  try {
    const cleanup = await runSql(cleanupSql, 60_000);
    if (lastLine(cleanup) !== 'F1R2_CLEANUP_OK') throw new Error('F1-R2 scoped cleanup did not verify');
  } catch (cleanupError) {
    primaryError = primaryError ? new Error(`${primaryError.message}; cleanup: ${cleanupError.message}`) : cleanupError;
  }
}

if (primaryError) throw primaryError;
