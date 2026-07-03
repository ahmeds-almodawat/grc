import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch40');
const migrationPath = 'supabase/migrations/101_patch40_production_hardening_simplification_pack.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const migration = await read(migrationPath);
const findings = [];

const serviceRoleFunctions = [
  'create_production_readiness_signoff',
  'update_production_readiness_signoff_status',
  'create_known_limitation',
  'update_known_limitation_status',
  'create_backup_restore_operation',
  'update_backup_restore_operation_status',
  'create_bilingual_readiness_item',
  'update_bilingual_readiness_status',
  'create_navigation_simplification_item',
  'update_navigation_simplification_status',
  'record_production_hardening_event',
  'get_go_no_go_dashboard',
  'get_production_readiness_summary',
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
  'production_readiness_signoffs',
  'production_known_limitations',
  'backup_restore_operations',
  'bilingual_readiness_items',
  'navigation_simplification_items',
  'production_hardening_events',
]) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) {
    findings.push(`${table} RLS is not enabled`);
  }
}

for (const view of [
  'v_patch40_production_readiness_signoff_register',
  'v_patch40_go_no_go_dashboard',
  'v_patch40_known_limitations_register',
  'v_patch40_blocking_limitations',
  'v_patch40_backup_restore_operations_dashboard',
  'v_patch40_bilingual_readiness_dashboard',
  'v_patch40_missing_translation_register',
  'v_patch40_navigation_simplification_register',
  'v_patch40_runtime_rpc_signoff_dashboard',
  'v_patch40_proof_suite_readiness_summary',
  'v_patch40_controlled_pilot_readiness_summary',
  'v_patch40_executive_production_readiness_summary',
]) {
  if (!migration.includes(`alter view public.${view} set (security_invoker = true)`)) {
    findings.push(`${view} is missing security_invoker`);
  }
}

// Forbidden static mock keywords check in DB migration
const forbiddenKeywords = ['mock', 'fake', 'dummy', 'fallback'];
for (const word of forbiddenKeywords) {
  if (migration.toLowerCase().includes(`'${word}'`) || migration.toLowerCase().includes(`"${word}"`)) {
    findings.push(`DB migration introduces forbidden keyword: '${word}'`);
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
await writeFile(path.join(releaseDir, 'patch40-workflow-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (findings.length) {
  console.error(`Patch 40 Production Hardening workflow proof failed:\n- ${findings.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 40 Production Hardening workflow proof passed.');
}
