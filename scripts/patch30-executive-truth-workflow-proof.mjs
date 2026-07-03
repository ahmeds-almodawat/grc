import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch30');
const migrationPath = 'supabase/migrations/093_patch30_executive_dashboard_truth_layer.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const migration = await read(migrationPath);
const findings = [];

const serviceRoleFunctions = [
  'create_executive_truth_snapshot',
  'refresh_executive_truth_snapshot',
  'record_executive_truth_event',
  'get_executive_truth_summary',
  'get_department_grc_scorecard',
];

for (const fn of serviceRoleFunctions) {
  const marker = `function public.${fn}`;
  const start = migration.indexOf(marker);
  const slice = start >= 0 ? migration.slice(start, start + 4500) : '';
  if (start < 0) {
    findings.push(`${fn} is missing`);
    continue;
  }
  if (!slice.includes('security definer')) findings.push(`${fn} is not security definer`);
  if (!slice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute privileges are not revoked`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) {
    findings.push(`${fn} is not service-role only`);
  }
}

for (const fn of serviceRoleFunctions) {
  const start = migration.indexOf(`function public.${fn}`);
  const slice = start >= 0 ? migration.slice(start, start + 4500) : '';
  if (!slice.includes("current_setting('request.jwt.claim.role'")) {
    findings.push(`${fn} is missing service-role guard`);
  }
}

for (const table of [
  'executive_truth_snapshots',
  'executive_truth_events',
]) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) {
    findings.push(`${table} RLS is not enabled`);
  }
}

for (const view of [
  'v_patch30_executive_truth_summary',
  'v_patch30_module_health_scorecard',
  'v_patch30_open_executive_risk_register',
  'v_patch30_overdue_governance_items',
  'v_patch30_evidence_gap_summary',
  'v_patch30_workflow_bottleneck_summary',
  'v_patch30_accreditation_readiness_summary',
  'v_patch30_department_grc_scorecard',
  'v_patch30_governance_exception_register',
  'v_patch30_board_pack_truth_snapshot',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const eventType of [
  'snapshot_created',
  'snapshot_refreshed',
]) {
  if (!migration.includes(`'${eventType}'`)) {
    findings.push(`event type ${eventType} is not logged/referenced`);
  }
}

const proof = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  findings,
  status: findings.length ? 'failed' : 'passed',
  blocking_count: findings.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch30-workflow-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 30 Executive Truth workflow proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 30 Executive Truth workflow proof passed.');
}
