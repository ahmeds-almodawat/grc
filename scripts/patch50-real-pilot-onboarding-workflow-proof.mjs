import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/109_patch50_real_pilot_master_data_onboarding.sql');
const outDir = path.join(root, 'release/patch50');
const outPath = path.join(outDir, 'patch50-workflow-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();

const reviewStatuses = ['draft', 'in_progress', 'ready_for_review', 'approved', 'approved_with_limitations', 'blocked'];
const itemStatuses = ['pending', 'ready', 'blocked', 'not_applicable', 'evidence_required'];
const exceptionStatuses = ['open', 'in_review', 'resolved', 'accepted_with_limitation'];
const severities = ['low', 'medium', 'high', 'critical'];
const gapTypes = [
  'missing_department_owner',
  'missing_participant_role',
  'participant_not_confirmed',
  'training_not_confirmed',
  'signoff_owner_missing',
  'signoff_overdue',
  'inactive_or_unknown_user',
  'department_blocked',
  'duplicate_scope_review',
];
const requiredGapViews = [
  'v_patch50_missing_department_owner_register',
  'v_patch50_pilot_participant_setup_gap_register',
  'v_patch50_pilot_role_assignment_gap_register',
  'v_patch50_pilot_training_gap_register',
  'v_patch50_pilot_signoff_assignment_gap_register',
  'v_patch50_inactive_or_unconfirmed_participant_register',
  'v_patch50_real_pilot_launch_blocker_register',
];

const checks = [
  { name: 'review statuses represented', passed: reviewStatuses.every(status => lower.includes(status)) },
  { name: 'checklist item statuses represented', passed: itemStatuses.every(status => lower.includes(status)) },
  { name: 'exception statuses represented', passed: exceptionStatuses.every(status => lower.includes(status)) },
  { name: 'exception severities represented', passed: severities.every(status => lower.includes(status)) },
  { name: 'gap types represented', passed: gapTypes.every(token => lower.includes(token)) },
  ...requiredGapViews.map(view => ({ name: `gap view exists: ${view}`, passed: lower.includes(view) })),
  { name: 'departments missing owners are visible', passed: lower.includes('owner_user_id is null') && lower.includes('department owner must be assigned before pilot launch') },
  { name: 'blocked departments are visible', passed: lower.includes("pilot_status = 'blocked'") && lower.includes('department_blocked') },
  { name: 'participant confirmation gaps are visible', passed: lower.includes("participation_status in ('pending', 'declined', 'inactive', 'needs_training')") },
  { name: 'training gaps are visible', passed: lower.includes('training_required = true') && lower.includes('training_confirmed = false') },
  { name: 'signoff owner and overdue gaps are visible', passed: lower.includes('signer_user_id is null') && lower.includes('signoff_overdue') },
  { name: 'participant coverage gap is calculated', passed: lower.includes('participant_coverage_percentage') && lower.includes('required_participants') && lower.includes('confirmed_participants') },
  { name: 'high and critical exceptions block launch', passed: lower.includes("severity in ('critical', 'high')") && lower.includes('launch_blocker_count') },
  { name: 'ready setup items require evidence', passed: lower.includes('evidence reference is required before marking a real pilot setup checklist item ready') },
  { name: 'approvals require reviewer and limitations require summary', passed: lower.includes('reviewer is required before approving real pilot onboarding') && lower.includes('limitation summary is required') },
  { name: 'no blanket auto-approval', passed: !/default\s+'approved'/i.test(sql) && !/set\s+(review_status|item_status|exception_status)\s*=\s*'approved'/i.test(sql) },
  { name: 'event ledger records onboarding lifecycle', passed: ['onboarding_review_created', 'onboarding_review_status_updated', 'setup_checklist_item_created', 'master_data_exception_created'].every(token => lower.includes(token)) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '50',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  review_statuses: reviewStatuses,
  checklist_item_statuses: itemStatuses,
  exception_statuses: exceptionStatuses,
  severities,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
