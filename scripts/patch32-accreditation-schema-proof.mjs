import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch32');
const migrationPath = 'supabase/migrations/095_patch32_accreditation_traceability_matrix.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter((item) => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'create table if not exists public.accreditation_standards',
  'create table if not exists public.accreditation_clauses',
  'create table if not exists public.accreditation_clause_links',
  'create table if not exists public.accreditation_clause_assessments',
  'create table if not exists public.accreditation_traceability_events',
];

const requiredViews = [
  'v_patch32_accreditation_clause_register',
  'v_patch32_clause_traceability_matrix',
  'v_patch32_clause_evidence_gap_summary',
  'v_patch32_clause_sop_document_gap_summary',
  'v_patch32_clause_capa_risk_audit_summary',
  'v_patch32_clause_training_readiness_summary',
  'v_patch32_department_accreditation_readiness',
  'v_patch32_accreditation_executive_summary',
  'v_patch32_accreditation_exception_register',
  'v_patch32_accreditation_review_queue',
];

const requiredFunctions = [
  'create_accreditation_standard',
  'create_accreditation_clause',
  'link_accreditation_clause_entity',
  'unlink_accreditation_clause_entity',
  'assess_accreditation_clause',
  'mark_accreditation_clause_not_applicable',
  'reopen_accreditation_clause_assessment',
  'record_accreditation_traceability_event',
  'get_accreditation_clause_traceability',
  'get_accreditation_readiness_summary',
];

const requiredFields = [
  'standard_code text not null unique',
  'standard_name text not null',
  "framework text not null default 'CBAHI'",
  'clause_code text not null',
  'clause_title text not null',
  'department_id uuid',
  'owner_user_id uuid',
  "criticality text not null default 'medium'",
  'linked_entity_type text not null',
  "link_strength text not null default 'supporting'",
  "assessment_status text not null default 'not_assessed'",
  "evidence_status text not null default 'missing'",
  'event_type text not null',
  'event_summary text not null',
];

const requiredRls = [
  'alter table public.accreditation_standards enable row level security',
  'alter table public.accreditation_clauses enable row level security',
  'alter table public.accreditation_clause_links enable row level security',
  'alter table public.accreditation_clause_assessments enable row level security',
  'alter table public.accreditation_traceability_events enable row level security',
];

const requiredPolicies = [
  'accreditation_standards_read',
  'accreditation_standards_write',
  'accreditation_clauses_read',
  'accreditation_clauses_write',
  'accreditation_clause_links_read',
  'accreditation_clause_links_write',
  'accreditation_clause_assessments_read',
  'accreditation_clause_assessments_write',
  'accreditation_traceability_events_read',
  'accreditation_traceability_events_insert',
];

const report = {
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
  ...report.missing_tables,
  ...report.missing_views,
  ...report.missing_functions,
  ...report.missing_fields,
  ...report.missing_rls_enablement,
  ...report.missing_policies,
];

const proof = {
  ...report,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch32-schema-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 32 accreditation schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 32 accreditation schema proof passed.');
}
