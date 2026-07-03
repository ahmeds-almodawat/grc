import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch42');
const migrationPath = 'supabase/migrations/102_patch42_unified_operations_spine.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredViews = [
  'v_patch42_unified_operations_queue',
  'v_patch42_my_operations_queue',
  'v_patch42_department_operations_queue',
  'v_patch42_overdue_operations_queue',
  'v_patch42_escalated_operations_queue',
  'v_patch42_blocked_operations_queue',
  'v_patch42_waiting_for_review_queue',
  'v_patch42_evidence_required_queue',
  'v_patch42_missing_owner_queue',
  'v_patch42_master_data_routing_exceptions',
  'v_patch42_executive_operations_summary',
  'v_patch42_user_operations_summary',
  'v_patch42_department_operations_summary',
  'v_patch42_queue_item_detail_context'
];

const report = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  migration_found: true,
  missing_views: missing(migration, requiredViews)
};

const blockers = [
  ...report.missing_views
];

const proof = {
  ...report,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch42-schema-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 42 Unified Operations Spine schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 42 Unified Operations Spine schema proof passed.');
}
