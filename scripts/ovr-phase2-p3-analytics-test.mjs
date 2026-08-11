import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { spawn } from 'node:child_process'

const container = process.env.P3_DB_CONTAINER
if (!container || !/^supabase_db_[A-Za-z0-9_.-]+$/.test(container)) {
  throw new Error('P3_DB_CONTAINER must name the disposable local Supabase database container')
}
if (process.env.P3_DISPOSABLE_CONFIRM !== 'P3_SCOPED_DISPOSABLE_FIXTURES_ONLY') {
  throw new Error('P3_DISPOSABLE_CONFIRM must authorize scoped disposable-fixture cleanup')
}

function runProcess(command, args, { input = '', timeoutMs = 60_000 } = {}) {
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
      if (code === 0) return resolve(stdout.trim())
      const safe = `${stderr}\n${stdout}`.replaceAll(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DB_URL]')
      reject(new Error(`process exited ${code}: ${safe}`))
    })
    child.stdin.end(input)
  })
}

const psqlArgs = ['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres']
const runSql = (sql, timeoutMs = 60_000) => runProcess('docker', psqlArgs, { input: sql, timeoutMs })
const serviceSql = sql => `select pg_catalog.set_config('request.jwt.claim.role','service_role',false);\n${sql}`
const lines = output => output.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
const oneJson = output => JSON.parse(lines(output).filter(value => value.startsWith('{')).at(-1))
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const id = () => randomUUID()
const token = randomUUID().replaceAll('-', '').slice(0, 16)

const scales = [
  { label: 'approx_12k', count: 12_000 },
  { label: 'approx_50k', count: 50_000 }
].map(scale => ({
  ...scale,
  org: id(), executiveA: id(), executiveB: id(), governance: id(), reporter: id(),
  division: id(), department: id(), calendar: id(), config: id()
}))

const image = await runProcess('docker', ['inspect', '--format', '{{.Config.Image}}', container])
if (!image.toLowerCase().includes('supabase/postgres')) throw new Error('Container is not a disposable Supabase Postgres runtime')

const sentinel = oneJson(await runSql(`
select jsonb_build_object(
  'database',current_database(),
  'lineage',(select jsonb_agg(version order by version::integer) from supabase_migrations.schema_migrations where version::integer between 187 and 194),
  'migration_194_count',(select count(*) from supabase_migrations.schema_migrations where version='194'),
  'rpc_present',to_regprocedure('public.ovr_executive_analytics_v1(uuid,text,uuid,text,text)') is not null,
  'fixtures_absent',not exists(select 1 from public.organizations where id in ('${scales[0].org}','${scales[1].org}'))
)::text;`))
if (sentinel.database !== 'postgres'
    || JSON.stringify(sentinel.lineage) !== JSON.stringify(['187','188','189','190','191','192','193','194'])
    || Number(sentinel.migration_194_count) !== 1 || !sentinel.rpc_present || !sentinel.fixtures_absent) {
  throw new Error('Exact disposable 187-194 lineage sentinel failed')
}

const email = (scale, label) => `p3-${token}-${scale.label}-${label}@example.test`
const setupFor = scale => `
insert into public.organizations(id,name_en) values('${scale.org}','P3 ${scale.label} ${token}');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,created_at,updated_at) values
 ('${scale.executiveA}','authenticated','authenticated','${email(scale,'executive-a')}','',now(),'{"credential_version":1}',now(),now()),
 ('${scale.executiveB}','authenticated','authenticated','${email(scale,'executive-b')}','',now(),'{"credential_version":1}',now(),now()),
 ('${scale.governance}','authenticated','authenticated','${email(scale,'governance')}','',now(),'{"credential_version":1}',now(),now()),
 ('${scale.reporter}','authenticated','authenticated','${email(scale,'reporter')}','',now(),'{"credential_version":1}',now(),now());
insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at)
select gen_random_uuid(),id::text,id,jsonb_build_object('sub',id::text,'email',email),'email',now(),now()
from auth.users where id in ('${scale.executiveA}','${scale.executiveB}','${scale.governance}','${scale.reporter}');
insert into public.profiles(id,organization_id,full_name_en,email,employee_no,is_active,user_status) values
 ('${scale.executiveA}','${scale.org}','P3 Executive A','${email(scale,'executive-a')}','P3-${token}-${scale.label}-EA',true,'active'),
 ('${scale.executiveB}','${scale.org}','P3 Executive B','${email(scale,'executive-b')}','P3-${token}-${scale.label}-EB',true,'active'),
 ('${scale.governance}','${scale.org}','P3 Governance','${email(scale,'governance')}','P3-${token}-${scale.label}-G',true,'active'),
 ('${scale.reporter}','${scale.org}','P3 Reporter','${email(scale,'reporter')}','P3-${token}-${scale.label}-R',true,'active');
insert into public.user_credential_states(user_id,organization_id,auth_email,identity_mode,credential_state,requested_lifecycle,credential_version)
select id,organization_id,lower(email),'legacy_verified','active','active',1 from public.profiles where organization_id='${scale.org}'
on conflict(user_id) do update set organization_id=excluded.organization_id,auth_email=excluded.auth_email,
 identity_mode=excluded.identity_mode,credential_state=excluded.credential_state,
 requested_lifecycle=excluded.requested_lifecycle,credential_version=excluded.credential_version;
insert into public.divisions(id,organization_id,name_en,code) values('${scale.division}','${scale.org}','P3 Division','P3-${token}-${scale.label}-D');
insert into public.departments(id,organization_id,division_id,name_en,code) values('${scale.department}','${scale.org}','${scale.division}','P3 Department','P3-${token}-${scale.label}-DEP');
update public.profiles set division_id='${scale.division}',department_id='${scale.department}' where organization_id='${scale.org}';
insert into public.user_roles(user_id,role,scope,organization_id,is_active) values
 ('${scale.executiveA}','executive','global','${scale.org}',true),('${scale.executiveB}','executive','global','${scale.org}',true),
 ('${scale.governance}','governance_admin','global','${scale.org}',true),('${scale.reporter}','employee','assigned_only','${scale.org}',true);
insert into public.runtime_workflow_sla_calendars(id,organization_id,calendar_code,calendar_name,timezone_name,is_active)
values('${scale.calendar}','${scale.org}','P3-${token}-${scale.label}','P3 Calendar','Asia/Riyadh',true);
insert into public.organization_ovr_analytics_config(id,organization_id,timezone_name,sla_calendar_id,minimum_cell_size,kpi_definition_version,effective_from,is_active,configured_by)
values('${scale.config}','${scale.org}','Asia/Riyadh','${scale.calendar}',5,'ovr-kpi-v2',now()-interval '1 day',true,'${scale.governance}');
insert into public.ovr_reports(id,organization_id,ovr_number,brief_description,occurrence_category,occurrence_date,occurrence_time,division_id,department_id,reported_by,created_by,status,severity_level,corrective_action_required,supervisor_due_date,quality_due_date,closed_by,closed_at,created_at)
select gen_random_uuid(),'${scale.org}','OVR-P3-${scale.label}-${token}-'||lpad(g::text,6,'0'),'Disposable analytics fixture',
 (array['medication','infection','fall','documentation'])[(g%4)+1],current_date-(g%365),time '09:00','${scale.division}','${scale.department}','${scale.reporter}','${scale.reporter}',
 case when g%10=0 then 'closed'::public.ovr_status when g%29=0 then 'rejected'::public.ovr_status else 'under_supervisor_review'::public.ovr_status end,
 (array['level_1','level_2','level_3','level_4','sentinel'])[(g%5)+1]::public.ovr_severity_level,g%7=0,current_date-(g%3),current_date+(g%3),
 case when g%10=0 then '${scale.governance}'::uuid end,case when g%10=0 then now()-make_interval(days=>(g%30)) end,now()-make_interval(days=>(g%365)+45)
from generate_series(1,${scale.count}) g;
insert into public.audit_logs(organization_id,actor_id,action,table_name,record_id,old_data,new_data,created_at)
select organization_id,'${scale.reporter}','UPDATE','ovr_reports',id,'{"status":"draft"}'::jsonb,'{"status":"submitted"}'::jsonb,created_at+interval '45 days'
from public.ovr_reports where organization_id='${scale.org}';`

const cleanupSql = `
begin; set local session_replication_role=replica;
do $cleanup$ declare t record; begin
  for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
    where n.nspname='public' and c.relkind in ('r','p') and a.attname='organization_id' and not a.attisdropped and c.relname<>'organizations' order by c.relname
  loop execute format('delete from %I.%I where organization_id = any($1)',t.nspname,t.relname) using array['${scales[0].org}'::uuid,'${scales[1].org}'::uuid]; end loop;
  delete from public.organizations where id in ('${scales[0].org}','${scales[1].org}');
  delete from auth.users where id in (${scales.flatMap(s => [s.executiveA,s.executiveB,s.governance,s.reporter]).map(v => `'${v}'`).join(',')});
end $cleanup$; commit;
select jsonb_build_object('organizations_remaining',(select count(*) from public.organizations where id in ('${scales[0].org}','${scales[1].org}')))::text;`

const elapsedSql = async (sql, timeoutMs) => {
  const start = performance.now()
  const output = await runSql(sql, timeoutMs)
  return { output, ms: Number((performance.now() - start).toFixed(2)) }
}
const metricPayload = response => response.metrics ?? response.buckets ?? response
const containsSensitiveExact = value => {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 && value < 5
  if (Array.isArray(value)) return value.some(containsSensitiveExact)
  if (value && typeof value === 'object') return Object.values(value).some(containsSensitiveExact)
  return false
}
const planSummary = plan => {
  const root = plan[0]
  const nodes = []
  const walk = node => { nodes.push(node['Node Type']); for (const child of node.Plans ?? []) walk(child) }
  walk(root.Plan)
  return {
    planning_ms: root['Planning Time'], execution_ms: root['Execution Time'],
    shared_hit_blocks: root.Plan['Shared Hit Blocks'] ?? 0,
    shared_read_blocks: root.Plan['Shared Read Blocks'] ?? 0,
    node_types: [...new Set(nodes)]
  }
}

const results = { lineage: sentinel.lineage, scales: {}, concurrency: {}, plans: {} }
let failure
try {
  await runSql(serviceSql(`begin; ${scales.map(setupFor).join('\n')} commit;`), 300_000)
  // Bulk fixture insertion bypasses the production autovacuum cadence. Refresh
  // planner statistics before timing so the benchmark compares query design,
  // not the known no-statistics state of a newly loaded disposable database.
  await runSql(`analyze public.ovr_reports; analyze public.audit_logs; analyze public.ovr_final_verdicts;
    analyze public.ovr_governance_closures; analyze public.ovr_stage_instances; analyze public.ovr_review_cycles;`, 180_000)

  for (const scale of scales) {
    const exactRows = Number(lines(await runSql(`select count(*) from public.ovr_reports where organization_id='${scale.org}';`)).at(-1))
    if (exactRows !== scale.count) throw new Error(`${scale.label} fixture count mismatch`)

    const factPlan = JSON.parse(await runSql(`explain(analyze,buffers,format json) select count(*) from ovr_v11_private.ovr_kpi_facts_v2('${scale.org}',statement_timestamp(),'Asia/Riyadh');`, 180_000))
    results.plans[`${scale.label}_canonical_facts`] = planSummary(factPlan)

    const refresh = await elapsedSql(serviceSql(`select public.refresh_ovr_executive_analytics_snapshot_v1('${scale.executiveA}')::text;`), 180_000)
    const snapshot = oneJson(refresh.output)
    if (snapshot.definition_version !== 'ovr-kpi-v2') throw new Error(`${scale.label} snapshot definition mismatch`)

    const readTimes = { headline: [], trend: [] }
    let headline
    let trend
    for (let i=0;i<5;i++) {
      const h = await elapsedSql(serviceSql(`select public.ovr_executive_analytics_v1('${scale.executiveA}','headline_current_period',null,null,'p3-${token}-${scale.label}-h-${i}')::text;`), 30_000)
      const t = await elapsedSql(serviceSql(`select public.ovr_executive_analytics_v1('${scale.executiveA}','monthly_trend_12',null,null,'p3-${token}-${scale.label}-t-${i}')::text;`), 30_000)
      headline = oneJson(h.output); trend = oneJson(t.output)
      readTimes.headline.push(h.ms); readTimes.trend.push(t.ms)
    }
    if (Math.max(...readTimes.headline,...readTimes.trend) >= 5_000) throw new Error(`${scale.label} aggregate read exceeded 5-second hard SLA`)
    if (containsSensitiveExact(metricPayload(headline)) || containsSensitiveExact(metricPayload(trend))) throw new Error(`${scale.label} leaked a sensitive exact 1-4 value`)
    if (JSON.stringify(headline).match(/ovr_report_id|reported_by|brief_description|employee_no|email/i)) throw new Error(`${scale.label} aggregate contains a prohibited raw identifier key`)

    results.scales[scale.label] = {
      report_rows: exactRows,
      refresh_ms: refresh.ms,
      headline_read_ms: readTimes.headline,
      trend_read_ms: readTimes.trend,
      max_read_ms: Math.max(...readTimes.headline,...readTimes.trend),
      sub_5s_hard_sla: true,
      sub_2s_target: Math.max(...readTimes.headline,...readTimes.trend) < 2_000,
      privacy_exact_1_to_4_absent: true
    }
  }

  const large = scales[1]
  const sameKey = `p3-${token}-same-key`
  const sameResponses = await Promise.all([0,1].map(() => runSql(serviceSql(`select public.ovr_executive_analytics_v1('${large.executiveA}','headline_current_period',null,null,'${sameKey}')::text;`), 30_000)))
  results.concurrency.same_key_same_response = JSON.stringify(oneJson(sameResponses[0])) === JSON.stringify(oneJson(sameResponses[1]))
  results.concurrency.same_key_one_request_row = Number(lines(await runSql(`select count(*) from public.ovr_executive_analytics_requests where organization_id='${large.org}' and idempotency_key='${sameKey}';`)).at(-1)) === 1

  const reader = runSql(serviceSql(`begin; show transaction_isolation;
select public.ovr_executive_analytics_v1('${large.executiveB}','headline_current_period',null,null,'p3-${token}-rc-before')::text;
select pg_sleep(1); select public.ovr_executive_analytics_v1('${large.executiveB}','headline_current_period',null,null,'p3-${token}-rc-after')::text; commit;`), 60_000)
  await pause(250)
  await runSql(`insert into public.ovr_reports(id,organization_id,ovr_number,brief_description,occurrence_category,occurrence_date,occurrence_time,division_id,department_id,reported_by,created_by,status,severity_level,created_at)
    values(gen_random_uuid(),'${large.org}','OVR-P3-${token}-CONCURRENT','Concurrent raw change','medication',current_date,time '10:00','${large.division}','${large.department}','${large.reporter}','${large.reporter}','submitted','level_2',now());`)
  const readerLines = lines(await reader)
  const readerJson = readerLines.filter(value => value.startsWith('{')).map(JSON.parse)
  results.concurrency.default_isolation = readerLines.includes('read committed')
  results.concurrency.immutable_snapshot_consistent_during_raw_write = readerJson.length === 2 && JSON.stringify(readerJson[0]) === JSON.stringify(readerJson[1])

  const denied = await runProcess('docker', psqlArgs, { input: serviceSql(`select public.ovr_executive_analytics_v1('${large.executiveA}','department_summary',null,null,'p3-${token}-denied');`), timeoutMs: 30_000 }).then(() => false, error => /OVR_ANALYTICS_QUERY_SHAPE_DENIED/.test(error.message))
  results.approved_fixed_shapes_only = denied

  const snapshotPlan = JSON.parse(await runSql(`explain(analyze,buffers,format json) select headline_response from public.ovr_executive_analytics_snapshots where organization_id='${large.org}' and snapshot_date=(now() at time zone 'Asia/Riyadh')::date and definition_version='ovr-kpi-v2';`))
  results.plans.approx_50k_snapshot_read = planSummary(snapshotPlan)
  const submissionPlan = JSON.parse(await runSql(`explain(analyze,buffers,format json)
    select record_id,min(created_at) from public.audit_logs where organization_id='${large.org}' and table_name='ovr_reports'
      and record_id is not null and new_data->>'status'='submitted' and coalesce(old_data->>'status','')<>'submitted' group by record_id;`, 30_000))
  results.plans.approx_50k_first_submission = planSummary(submissionPlan)

  if (!Object.values(results.concurrency).every(Boolean) || !results.approved_fixed_shapes_only) {
    throw new Error(`Concurrency/fixed-shape proof failed: ${JSON.stringify(results.concurrency)}`)
  }
} catch (error) {
  failure = error
} finally {
  const cleanup = oneJson(await runSql(cleanupSql, 300_000))
  if (Number(cleanup.organizations_remaining) !== 0) throw new Error('Scoped disposable fixture cleanup failed')
}

if (failure) throw failure
console.log(JSON.stringify({ result: 'P3_R2_ANALYTICS_PRIVACY_CONCURRENCY_PERFORMANCE_PASSED', ...results }, null, 2))
