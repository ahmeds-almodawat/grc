import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/108_patch49_controlled_pilot_activation_department_signoff.sql');
const outDir = path.join(root, 'release/patch49');
const outPath = path.join(outDir, 'patch49-workflow-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();

const activationStatuses = ['planning', 'ready_for_review', 'approved', 'approved_with_limitations', 'blocked', 'paused', 'completed'];
const departmentStatuses = ['pending', 'ready', 'ready_with_limitations', 'blocked', 'not_in_scope'];
const signoffStatuses = ['pending', 'approved', 'approved_with_limitation', 'rejected', 'overdue', 'not_required'];
const participantStatuses = ['pending', 'confirmed', 'declined', 'inactive', 'needs_training'];
const workflowTokens = [
  'missing_department_owners',
  'pending_signoffs',
  'overdue_signoffs',
  'approved_with_limitation_signoffs',
  'participant_count',
  'confirmed_participants',
  'training_required_participants',
  'pilot_readiness_status',
  'evidence_required',
  'next_action_required',
  'signoff evidence required',
  'department owner is required',
  'participant training confirmation required',
];

const checks = [
  { name: 'activation statuses represented', passed: activationStatuses.every(status => lower.includes(status)) },
  { name: 'department statuses represented', passed: departmentStatuses.every(status => lower.includes(status)) },
  { name: 'signoff statuses represented', passed: signoffStatuses.every(status => lower.includes(status)) },
  { name: 'participant statuses represented', passed: participantStatuses.every(status => lower.includes(status)) },
  ...workflowTokens.map(token => ({ name: `workflow token exists: ${token}`, passed: lower.includes(token) })),
  { name: 'approved activation requires readiness summary', passed: lower.includes('readiness summary is required') && lower.includes("p_activation_status in ('approved', 'approved_with_limitations', 'completed')") },
  { name: 'ready department requires owner', passed: lower.includes('department owner is required before marking department pilot readiness as ready') },
  { name: 'approved signoff requires evidence', passed: lower.includes('evidence reference is required before approving a controlled pilot department signoff') },
  { name: 'approved-with-limitation requires limitation summary', passed: lower.includes('limitation summary is required for department signoff approval with limitation') },
  { name: 'rejected signoff requires rejection reason', passed: lower.includes('rejection reason is required for rejected department pilot signoff') },
  { name: 'blockers include owners, blocked departments, signoffs, and training', passed: ['missing_owner', 'department_blocked', 'signoff_required', 'participant_training'].every(token => lower.includes(token)) },
  { name: 'no auto-approval of departments or signoffs', passed: !/set\s+(pilot_status|signoff_status)\s*=\s*'approved'/i.test(sql) && !/default\s+'approved'/i.test(sql) },
  { name: 'event ledger records activation lifecycle', passed: lower.includes('controlled_pilot_activation_events') && ['activation_run_created', 'activation_status_updated', 'department_added', 'department_signoff_updated', 'participant_status_updated'].every(token => lower.includes(token)) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '49',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  activation_statuses: activationStatuses,
  department_statuses: departmentStatuses,
  signoff_statuses: signoffStatuses,
  participant_statuses: participantStatuses,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
