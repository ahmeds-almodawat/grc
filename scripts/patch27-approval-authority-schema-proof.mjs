import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch27');
const migrationPath = 'supabase/migrations/090_patch27_approval_authority_matrix.sql';

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter(item => !source.includes(item));
}

const migration = await read(migrationPath);

const requiredTables = [
  'create table if not exists public.approval_authority_rules',
  'create table if not exists public.approval_requests',
  'create table if not exists public.approval_decisions',
  'create table if not exists public.approval_authority_events',
  'create table if not exists public.approval_delegations',
  'create table if not exists public.approval_authority_overrides',
];

const requiredViews = [
  'v_patch27_active_authority_rules',
  'v_patch27_pending_approval_requests',
  'v_patch27_overdue_approval_requests',
  'v_patch27_approval_decision_history',
  'v_patch27_authority_rule_coverage',
  'v_patch27_executive_approval_queue',
  'v_patch27_approval_bottlenecks',
  'v_patch27_unmatched_approval_requests',
  'v_patch27_active_approval_delegations',
  'v_patch27_approval_override_register',
];

const requiredFields = [
  'workflow_type text not null',
  'action_type text not null',
  'requires_dual_approval boolean default false',
  'requires_executive_approval boolean default false',
  'allow_self_approval boolean default false',
  'conflict_of_interest_block boolean default true',
  'required_approval_count integer default 1',
  'received_approval_count integer default 0',
  'amount numeric',
  'authority_rule_id uuid references public.approval_authority_rules',
  'delegator_id uuid not null',
  'delegate_id uuid not null',
  'override_reason text not null',
  'decision text not null',
  'event_type text not null',
];

const requiredWorkflowTypes = [
  'ovr',
  'risk',
  'evidence',
  'audit_finding',
  'compliance_obligation',
  'document_control',
  'capa',
  'project',
  'access_control',
  'financial',
  'general',
];

const requiredActions = [
  'approve',
  'reject',
  'close',
  'reopen',
  'accept_risk',
  'approve_closure',
  'approve_waiver',
  'approve_extension',
  'approve_document',
  'approve_escalation',
  'owner_override',
  'approve_evidence',
  'approve_renewal',
  'approve_capa',
  'approve_access',
  'approve_financial',
];

const result = {
  generated_at: new Date().toISOString(),
  migration_path: migrationPath,
  migration_found: true,
  missing_tables: missing(migration, requiredTables),
  missing_views: missing(migration, requiredViews),
  missing_fields: missing(migration, requiredFields),
  missing_workflow_types: missing(migration, requiredWorkflowTypes),
  missing_actions: missing(migration, requiredActions),
};

const blockers = [
  ...result.missing_tables,
  ...result.missing_views,
  ...result.missing_fields,
  ...result.missing_workflow_types,
  ...result.missing_actions,
];

const report = {
  ...result,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch27-schema-proof.json'), `${JSON.stringify(report, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 27 schema proof failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 27 schema proof passed.');
}
