import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const migrationPath = path.join(repoRoot, 'supabase/migrations/103_patch43_accreditation_evidence_assurance.sql');
const outDir = path.join(repoRoot, 'release/patch43');
const outPath = path.join(outDir, 'patch43-schema-proof.json');

const requiredTables = [
  'evidence_gate_rules',
  'evidence_gate_evaluations',
  'evidence_gate_waivers',
  'accreditation_war_room_snapshots',
  'survey_readiness_events',
];

const requiredViews = [
  'v_patch43_accreditation_war_room',
  'v_patch43_clause_readiness_register',
  'v_patch43_department_readiness_register',
  'v_patch43_evidence_gap_register',
  'v_patch43_evidence_gate_failure_register',
  'v_patch43_evidence_waiver_register',
  'v_patch43_mock_survey_finding_register',
  'v_patch43_incident_evidence_chain',
  'v_patch43_audit_evidence_chain',
  'v_patch43_capa_evidence_chain',
  'v_patch43_training_document_evidence_chain',
  'v_patch43_survey_blocker_summary',
  'v_patch43_executive_survey_readiness_summary',
  'v_patch43_queue_evidence_gate_overlay',
];

const requiredFunctions = [
  'evaluate_evidence_gate',
  'evaluate_evidence_gate_for_entity',
  'request_evidence_gate_waiver',
  'approve_evidence_gate_waiver',
  'reject_evidence_gate_waiver',
  'revoke_evidence_gate_waiver',
  'record_survey_readiness_event',
  'create_accreditation_war_room_snapshot',
  'get_accreditation_war_room',
  'get_evidence_gate_failure_register',
  'get_survey_blocker_summary',
  'get_executive_survey_readiness_summary',
];

const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = migration.toLowerCase();

function has(pattern) {
  return pattern.test(migration);
}

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...requiredTables.map(table => ({
    name: `table or extension present: ${table}`,
    passed: lower.includes(`create table if not exists public.${table}`) || lower.includes(`alter table public.${table}`),
  })),
  ...requiredTables.map(table => ({
    name: `RLS enabled: ${table}`,
    passed: lower.includes(`alter table public.${table} enable row level security`),
  })),
  ...requiredViews.map(view => ({
    name: `view exists: ${view}`,
    passed: lower.includes(`create or replace view public.${view}`),
  })),
  ...requiredViews.map(view => ({
    name: `security_invoker set: ${view}`,
    passed: lower.includes(`alter view if exists public.${view} set (security_invoker = true)`),
  })),
  ...requiredFunctions.map(fn => ({
    name: `function exists: ${fn}`,
    passed: lower.includes(`function public.${fn}`),
  })),
  { name: 'service-role bridge guard exists', passed: lower.includes('patch43_service_role_required') && lower.includes("auth.role() <> 'service_role'") },
  { name: 'no authenticated execute grants for Patch 43 RPCs', passed: !has(/grant\s+execute\s+on\s+function\s+public\.(evaluate_evidence_gate|request_evidence_gate_waiver|approve_evidence_gate_waiver).*authenticated/is) },
  { name: 'all gate status values present', passed: ['pass','fail_missing_evidence','fail_rejected_evidence','fail_expired_evidence','fail_superseded_evidence','waived','not_required','requires_review'].every(status => lower.includes(status)) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '43',
  migration: path.relative(repoRoot, migrationPath),
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  required_tables: requiredTables,
  required_views: requiredViews,
  required_functions: requiredFunctions,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
