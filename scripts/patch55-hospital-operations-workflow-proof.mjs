import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationRel = 'supabase/migrations/113_patch55_hospital_operations_readiness_pack.sql';
const migrationPath = path.join(root, migrationRel);
const reportPath = path.join(root, 'release', 'patch55', 'patch55-workflow-proof.json');
const source = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = source.toLowerCase();

const requiredTerms = [
  'in_progress',
  'ready',
  'ready_with_limitations',
  'evidence_required',
  'blocked',
  'complete',
  'incomplete',
  'not_applicable',
  'pending',
  'attested',
  'overdue',
  'waived',
  'on_track',
  'low_adoption',
  'training_needed',
  'failed_workflow_attempt_count',
  'critical_support_issue_count',
  'missing_owner',
  'support_owner',
  'policy_attestation',
  'launch_checklist',
];

const requiredBlockerSources = [
  'v_patch52_pilot_closure_blocker_register',
  'v_patch53_hypercare_blocker_register',
  'v_patch55_incomplete_launch_checklist_register',
  'v_patch55_support_readiness_blocker_register',
  'v_patch55_missing_policy_attestation_register',
  'v_patch55_low_adoption_department_register',
];

const requiredEventTypes = [
  'launch_pack_created',
  'launch_pack_status_updated',
  'launch_checklist_item_created',
  'launch_checklist_item_updated',
  'support_readiness_created',
  'support_readiness_updated',
  'policy_attestation_created',
  'policy_attestation_updated',
  'adoption_readiness_created',
  'adoption_readiness_updated',
];

const fakeRecordPatterns = [
  /\bseed\s+demo\b/i,
  /\bfake\s+record\b/i,
  /\bdemo\s+record\b/i,
  /\bauto-approve\b/i,
  /\bauto\s+approve\b/i,
  /\bmark\s+all\s+ready\b/i,
];

const checks = [
  { name: 'migration exists', passed: fs.existsSync(migrationPath), path: migrationRel },
  ...requiredTerms.map(term => ({ name: `workflow term present: ${term}`, passed: lower.includes(term.toLowerCase()) })),
  ...requiredBlockerSources.map(term => ({ name: `blocker source present: ${term}`, passed: lower.includes(term.toLowerCase()) })),
  ...requiredEventTypes.map(term => ({ name: `event type present: ${term}`, passed: lower.includes(term.toLowerCase()) })),
  { name: 'missing owners remain visible', passed: /owner_user_id\s+is\s+null/i.test(source) || lower.includes('missing_owner') },
  { name: 'low adoption remains visible', passed: lower.includes('low_adoption') },
  { name: 'support blockers remain visible', passed: lower.includes('critical_support_issue_count') && lower.includes('support_readiness_blocker') },
  { name: 'policy attestation gaps remain visible', passed: lower.includes('missing_policy_attestation') && lower.includes('required_attestation_count') },
  { name: 'no fake/demo/fallback readiness records inserted', passed: !fakeRecordPatterns.some(pattern => pattern.test(source)) },
];

const report = {
  generated_at: new Date().toISOString(),
  strict_passed: checks.every(check => check.passed),
  check_count: checks.length,
  failed_count: checks.filter(check => !check.passed).length,
  failed: checks.filter(check => !check.passed),
  checks,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.strict_passed) process.exit(1);
