import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch40');
const migrationPath = 'supabase/migrations/101_patch40_production_hardening_simplification_pack.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'production_readiness_signoffs',
  'production_known_limitations',
  'backup_restore_operations',
  'bilingual_readiness_items',
  'navigation_simplification_items',
  'production_hardening_events',
];

const requiredViews = [
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
];

const requiredFunctions = [
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

const requiredRlsEnablement = [
  'alter table public.production_readiness_signoffs enable row level security',
  'alter table public.production_known_limitations enable row level security',
  'alter table public.backup_restore_operations enable row level security',
  'alter table public.bilingual_readiness_items enable row level security',
  'alter table public.navigation_simplification_items enable row level security',
  'alter table public.production_hardening_events enable row level security',
];

const report = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  migration_found: true,
  missing_tables: missing(migration, requiredTables),
  missing_views: missing(migration, requiredViews),
  missing_functions: missing(migration, requiredFunctions),
  missing_rls_enablement: missing(migration, requiredRlsEnablement),
};

const blockers = [
  ...report.missing_tables,
  ...report.missing_views,
  ...report.missing_functions,
  ...report.missing_rls_enablement,
];

const proof = {
  ...report,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch40-schema-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 40 Production Hardening schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 40 Production Hardening schema proof passed.');
}
