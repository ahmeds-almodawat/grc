import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/112_patch53_golive_hypercare_operating_cadence.sql');
const outDir = path.join(root, 'release/patch53');
const outPath = path.join(outDir, 'patch53-workflow-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();

const hypercareStatuses = ['planned', 'active', 'stable', 'at_risk', 'blocked', 'completed', 'extended', 'cancelled'];
const issueStatuses = ['open', 'in_progress', 'resolved', 'overdue', 'accepted_risk', 'cancelled'];
const cadenceTypes = ['daily_huddle', 'weekly_review', 'executive_review', 'department_checkin', 'issue_triage', 'stabilization_review', 'closure_review'];
const eventStatuses = ['scheduled', 'completed', 'missed', 'cancelled'];
const feedbackStatuses = ['pending', 'submitted', 'reviewed', 'action_required', 'closed'];
const adoptionStatuses = ['not_assessed', 'adopted', 'partially_adopted', 'low_adoption', 'blocked'];
const visibilityTokens = [
  'active_hypercare_periods',
  'at_risk_or_blocked_periods',
  'open_hypercare_issues',
  'overdue_hypercare_issues',
  'high_critical_hypercare_issues',
  'missed_cadence_events',
  'departments_missing_feedback',
  'low_adoption_departments',
  'support_needed_feedback_count',
  'training_needed_feedback_count',
  'inherited_unresolved_live_pilot_issues',
  'inherited_high_critical_remediation_count',
  'production_stability_status',
];

const checks = [
  { name: 'hypercare statuses represented', passed: hypercareStatuses.every(token => lower.includes(token)) },
  { name: 'issue statuses represented', passed: issueStatuses.every(token => lower.includes(token)) },
  { name: 'cadence types represented', passed: cadenceTypes.every(token => lower.includes(token)) },
  { name: 'cadence statuses represented', passed: eventStatuses.every(token => lower.includes(token)) },
  { name: 'feedback statuses represented', passed: feedbackStatuses.every(token => lower.includes(token)) },
  { name: 'adoption statuses represented', passed: adoptionStatuses.every(token => lower.includes(token)) },
  ...visibilityTokens.map(token => ({ name: `visibility token exists: ${token}`, passed: lower.includes(token) })),
  { name: 'stable hypercare requires stability summary', passed: lower.includes('stability summary is required before marking hypercare stable or complete') },
  { name: 'at-risk hypercare requires blocker summary', passed: lower.includes('blocker summary is required for at-risk, blocked, or extended hypercare') },
  { name: 'issue closure requires evidence', passed: lower.includes('resolution summary and evidence reference are required before closing or accepting a hypercare issue') },
  { name: 'completed cadence requires summary', passed: lower.includes('summary is required before completing an operating cadence event') },
  { name: 'missed cadence requires action summary', passed: lower.includes('action summary is required for missed operating cadence events') },
  { name: 'low adoption requires issue reference', passed: lower.includes('issue reference is required for low adoption or blocked departments') },
  { name: 'Patch 51 open live pilot issues remain visible', passed: lower.includes('v_patch51_live_pilot_execution_issue_register') },
  { name: 'Patch 52 high critical remediation remains visible', passed: lower.includes('v_patch52_open_high_critical_remediation_register') },
  { name: 'no blanket stability defaults', passed: !/default\s+'stable'/i.test(sql) && !/set\s+(hypercare_status|issue_status|event_status)\s*=\s*'(stable|resolved|completed)'/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = { patch: '53', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed, hypercare_statuses: hypercareStatuses, issue_statuses: issueStatuses, cadence_types: cadenceTypes, feedback_statuses: feedbackStatuses, adoption_statuses: adoptionStatuses };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
