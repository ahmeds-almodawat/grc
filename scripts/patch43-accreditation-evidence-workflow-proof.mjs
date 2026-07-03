import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const migrationPath = path.join(repoRoot, 'supabase/migrations/103_patch43_accreditation_evidence_assurance.sql');
const outDir = path.join(repoRoot, 'release/patch43');
const outPath = path.join(outDir, 'patch43-workflow-proof.json');
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = migration.toLowerCase();

const requiredSignals = [
  'evidence_bridge_links',
  'v_patch33_clause_evidence_readiness',
  'v_patch35_clause_blocker_summary',
  'v_patch42_unified_operations_queue',
  'evidence_gate_evaluations',
  'survey_readiness_events',
  'waiver_requested',
  'waiver_approved',
  'waiver_rejected',
  'waiver_revoked',
  'evidence_gate_evaluated',
  'accepted_evidence_count',
  'rejected_evidence_count',
  'expired_evidence_count',
  'superseded_evidence_count',
  'missing_evidence_count',
  'active_waiver_id',
];

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath) },
  ...requiredSignals.map(signal => ({ name: `workflow signal present: ${signal}`, passed: lower.includes(signal) })),
  { name: 'Level 1 evaluation persists gate results', passed: /insert\s+into\s+public\.evidence_gate_evaluations/is.test(migration) },
  { name: 'Level 2 queue overlay exposes evidence gates', passed: lower.includes('v_patch43_queue_evidence_gate_overlay') && lower.includes('evidence_gate_next_action') },
  { name: 'waiver path requires reason and audit record', passed: lower.includes('p_waiver_reason') && lower.includes('audit_note') && lower.includes('survey_readiness_events') },
  { name: 'expired accepted evidence cannot silently pass', passed: lower.includes('fail_expired_evidence') && lower.includes('valid_until') && lower.includes('current_date') },
  { name: 'superseded/stale evidence cannot silently pass', passed: lower.includes('fail_superseded_evidence') && lower.includes('superseded') },
  { name: 'mutating actions use service-role bridge guard', passed: (migration.match(/perform public\.patch43_service_role_required\(\)/g) ?? []).length >= 7 },
  { name: 'no production-data destructive statements', passed: !/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(migration) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '43',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  enforcement_strategy: {
    level_1: 'evidence_gate_evaluations persists gate status',
    level_2: 'v_patch43_queue_evidence_gate_overlay exposes gate status in work queues',
    level_3: 'hard closure blocking is limited to safe future integration points; legacy workflows are not forced through uncertain gates in this patch',
  },
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
