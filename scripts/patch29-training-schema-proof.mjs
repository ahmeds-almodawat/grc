import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch29');
const migrationPath = 'supabase/migrations/092_patch29_training_acknowledgment_governance.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'training_programs',
  'training_assignments',
  'training_acknowledgments',
  'competency_assessments',
  'training_events',
];

const requiredViews = [
  'v_patch29_training_program_register',
  'v_patch29_training_assignment_queue',
  'v_patch29_overdue_training_assignments',
  'v_patch29_sop_acknowledgment_gap',
  'v_patch29_competency_gap_dashboard',
  'v_patch29_training_evidence_index',
  'v_patch29_training_executive_summary',
  'v_patch29_accreditation_training_readiness',
];

const requiredFunctions = [
  'create_training_program',
  'assign_training_program_to_user',
  'assign_training_program_to_department',
  'start_training_assignment',
  'complete_training_assignment',
  'acknowledge_training_assignment',
  'waive_training_assignment_with_reason',
  'cancel_training_assignment_with_reason',
  'record_competency_assessment',
  'reopen_training_assignment_with_reason',
  'link_training_evidence',
];

const requiredRlsEnablement = [
  'alter table public.training_programs enable row level security',
  'alter table public.training_assignments enable row level security',
  'alter table public.training_acknowledgments enable row level security',
  'alter table public.competency_assessments enable row level security',
  'alter table public.training_events enable row level security',
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
await writeFile(path.join(releaseDir, 'patch29-schema-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 29 Training schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 29 Training schema proof passed.');
}
