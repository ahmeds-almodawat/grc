import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch31');
const migrationPath = 'supabase/migrations/094_patch31_runtime_rpc_classification_signoff.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'create table if not exists public.runtime_rpc_classifications',
  'create table if not exists public.runtime_rpc_signoff_events',
];

const requiredViews = [
  'v_patch31_runtime_rpc_classification_register',
  'v_patch31_unreviewed_runtime_rpcs',
  'v_patch31_privileged_rpc_review_queue',
  'v_patch31_frontend_rpc_signoff_summary',
  'v_patch31_runtime_rpc_production_readiness',
  'v_patch31_runtime_rpc_exception_register',
];

const requiredFunctions = [
  'classify_runtime_rpc',
  'mark_runtime_rpc_reviewed',
  'approve_runtime_rpc_for_production',
  'reject_runtime_rpc_for_production',
  'record_runtime_rpc_signoff_event',
];

const requiredFields = [
  'rpc_name text not null unique',
  'frontend_transport text not null',
  'classification text not null',
  'risk_level text not null',
  'allowed_frontend_use boolean not null default false',
  'requires_authenticated_bridge boolean not null default true',
  'service_role_only boolean not null default false',
  'reviewed_by uuid',
  'reviewed_at timestamptz',
  "signoff_status text not null default 'pending_review'",
  'signoff_notes text',
  'event_type text not null',
  'event_summary text not null',
];

const requiredRls = [
  'alter table public.runtime_rpc_classifications enable row level security',
  'alter table public.runtime_rpc_signoff_events enable row level security',
];

const requiredPolicies = [
  'runtime_rpc_classifications_read_security_roles',
  'runtime_rpc_classifications_write_security_admins',
  'runtime_rpc_signoff_events_read_security_roles',
  'runtime_rpc_signoff_events_insert_security_admins',
];

const proof = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  migration_found: true,
  missing_tables: missing(migration, requiredTables),
  missing_views: missing(migration, requiredViews),
  missing_functions: missing(migration, requiredFunctions),
  missing_fields: missing(migration, requiredFields),
  missing_rls_enablement: missing(migration, requiredRls),
  missing_policies: missing(migration, requiredPolicies),
};

const blockers = [
  ...proof.missing_tables,
  ...proof.missing_views,
  ...proof.missing_functions,
  ...proof.missing_fields,
  ...proof.missing_rls_enablement,
  ...proof.missing_policies,
];

const report = {
  ...proof,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch31-schema-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 31 runtime RPC schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 31 runtime RPC schema proof passed.');
}
