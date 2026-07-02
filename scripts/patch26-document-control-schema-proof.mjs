import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch26');
const migrationPath = 'supabase/migrations/089_patch26_document_control_sop_governance.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter(item => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'create table if not exists public.controlled_documents',
  'create table if not exists public.document_versions',
  'create table if not exists public.document_review_events',
  'create table if not exists public.document_links',
  'create table if not exists public.document_acknowledgment_requirements',
  'create table if not exists public.document_acknowledgments',
];

const requiredViews = [
  'v_patch26_document_control_register',
  'v_patch26_active_sops',
  'v_patch26_documents_due_for_review',
  'v_patch26_expired_documents',
  'v_patch26_pending_document_reviews',
  'v_patch26_pending_document_approvals',
  'v_patch26_superseded_documents',
  'v_patch26_staff_acknowledgment_gaps',
  'v_patch26_document_link_index',
];

const requiredFields = [
  'document_code text unique',
  'document_title text not null',
  'document_type text not null',
  'document_status text not null default',
  'current_version_id uuid',
  'version_number integer not null',
  'content_hash text',
  'event_type text not null',
  'linked_item_type text not null',
  'requirement_scope text',
  'acknowledged_at timestamptz default now()',
];

const requiredCompatibility = [
  'compliance_obligation',
  'risk',
  'ovr',
  'audit_finding',
  'evidence',
  'control',
  'department',
  'project',
  'capa',
  'accreditation_clause',
];

const result = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  migration_found: true,
  missing_tables: missing(migration, requiredTables),
  missing_views: missing(migration, requiredViews),
  missing_fields: missing(migration, requiredFields),
  missing_link_types: missing(migration, requiredCompatibility),
  duplicate_088_avoided: migration.includes('version 088 already exists in main'),
};

const blockers = [
  ...result.missing_tables,
  ...result.missing_views,
  ...result.missing_fields,
  ...result.missing_link_types,
];

const report = {
  ...result,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch26-schema-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 26 schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 26 schema proof passed.');
}
