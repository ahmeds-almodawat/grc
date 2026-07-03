import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch31');
const migrationPath = 'supabase/migrations/094_patch31_runtime_rpc_classification_signoff.sql';
const inventoryPath = 'release/v700/frontend-rpc-inventory.json';
const runtimeSecurityPath = 'release/v700/runtime-security-bridge-audit.json';

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function runNode(script) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

const runtimeRun = runNode('v700-runtime-security-bridge-audit.mjs');
const migration = await readFile(path.join(root, migrationPath), 'utf8');
const inventory = await readJson(inventoryPath);
const runtimeSecurity = await readJson(runtimeSecurityPath);
const findings = [];

if (runtimeRun.status !== 0) {
  findings.push(`v700-runtime-security-bridge-audit.mjs failed: ${runtimeRun.stderr || runtimeRun.stdout}`);
}

const uniqueRpcs = inventory.summary?.unique_rpcs || [];
const missingClassifications = uniqueRpcs
  .map((item) => item.rpc)
  .filter((rpc) => !migration.includes(`('${rpc}'`));

for (const rpc of missingClassifications) {
  findings.push(`${rpc} has no Patch 31 classification seed or explicit exception`);
}

const serviceRoleFunctions = [
  'patch31_actor_has_security_authority',
  'record_runtime_rpc_signoff_event',
  'classify_runtime_rpc',
  'mark_runtime_rpc_reviewed',
  'approve_runtime_rpc_for_production',
  'reject_runtime_rpc_for_production',
];

for (const fn of serviceRoleFunctions) {
  const marker = `function public.${fn}`;
  const start = migration.indexOf(marker);
  const slice = start >= 0 ? migration.slice(start, start + 4500) : '';
  if (start < 0) findings.push(`${fn} is missing`);
  if (!slice.includes('security definer')) findings.push(`${fn} is not security definer`);
  if (!slice.includes('set search_path = public, pg_temp')) findings.push(`${fn} is missing safe search_path`);
  if (!migration.includes(`revoke all on function public.${fn}`)) findings.push(`${fn} execute privileges are not revoked`);
  if (!migration.includes(`grant execute on function public.${fn}`) || !migration.includes('to service_role')) {
    findings.push(`${fn} is not service-role only`);
  }
  if (migration.includes(`grant execute on function public.${fn}`) && migration.includes(`grant execute on function public.${fn}`) && /grant execute on function public\.[^(]+\([^;]+to\s+(public|anon|authenticated)/i.test(slice)) {
    findings.push(`${fn} has broad execute exposure`);
  }
}

for (const view of [
  'v_patch31_runtime_rpc_classification_register',
  'v_patch31_unreviewed_runtime_rpcs',
  'v_patch31_privileged_rpc_review_queue',
  'v_patch31_frontend_rpc_signoff_summary',
  'v_patch31_runtime_rpc_production_readiness',
  'v_patch31_runtime_rpc_exception_register',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

for (const marker of [
  'runtime_rpc_signoff_events',
  "'classified'",
  "'reviewed'",
  "'approved'",
  "'rejected'",
  'PATCH31_SERVICE_ROLE_REQUIRED',
  'PATCH31_SECURITY_AUTHORITY_REQUIRED',
  'PATCH31_SIGNOFF_NOTES_REQUIRED',
  'PATCH31_REJECTION_REASON_REQUIRED',
]) {
  if (!migration.includes(marker)) findings.push(`${marker} marker is missing`);
}

if (Number(runtimeSecurity.service_role_only_rpc_called_by_frontend ?? 999) !== 0) {
  findings.push(`service_role_only_rpc_called_by_frontend is ${runtimeSecurity.service_role_only_rpc_called_by_frontend}`);
}

if (Number(runtimeSecurity.remaining_broad_security_definer_execute_grants ?? 999) !== 0) {
  findings.push(`remaining_broad_security_definer_execute_grants is ${runtimeSecurity.remaining_broad_security_definer_execute_grants}`);
}

const signoffStatusCounts = {};
const classificationCounts = {};
for (const item of uniqueRpcs) {
  const escapedRpc = item.rpc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const row = migration.match(new RegExp(`\\('${escapedRpc}'[^\\n]+`))?.[0] || '';
  const quotedTokens = [...row.matchAll(/'([^']*)'/g)].map((match) => match[1]);
  const classification = quotedTokens[2] || 'missing';
  const signoffStatus = quotedTokens[4] || 'missing';
  classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
  signoffStatusCounts[signoffStatus] = (signoffStatusCounts[signoffStatus] || 0) + 1;
}

const report = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  inventory_path: inventoryPath,
  runtime_security_path: runtimeSecurityPath,
  current_unique_rpc_count: uniqueRpcs.length,
  missing_classification_count: missingClassifications.length,
  missing_classifications: missingClassifications,
  classification_counts_from_seed: classificationCounts,
  signoff_status_counts_from_seed: signoffStatusCounts,
  service_role_only_rpc_called_by_frontend: runtimeSecurity.service_role_only_rpc_called_by_frontend,
  remaining_broad_security_definer_execute_grants: runtimeSecurity.remaining_broad_security_definer_execute_grants,
  runtime_security_status: runtimeSecurity.status,
  status: findings.length ? 'failed' : 'passed',
  finding_count: findings.length,
  findings,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch31-classification-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 31 runtime RPC classification proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 31 runtime RPC classification proof passed.');
}
