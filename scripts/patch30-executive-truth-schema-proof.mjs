import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch30');
const migrationPath = 'supabase/migrations/093_patch30_executive_dashboard_truth_layer.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'executive_truth_snapshots',
  'executive_truth_events',
];

const requiredViews = [
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
];

const requiredFunctions = [
  'create_executive_truth_snapshot',
  'refresh_executive_truth_snapshot',
  'record_executive_truth_event',
  'get_executive_truth_summary',
  'get_department_grc_scorecard',
];

const requiredRlsEnablement = [
  'alter table public.executive_truth_snapshots enable row level security',
  'alter table public.executive_truth_events enable row level security',
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
await writeFile(path.join(releaseDir, 'patch30-schema-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 30 Executive Truth schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 30 Executive Truth schema proof passed.');
}
