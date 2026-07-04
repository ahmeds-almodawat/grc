import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/110_patch51_live_pilot_workflow_execution_evidence.sql');
const outDir = path.join(root, 'release/patch51');
const outPath = path.join(outDir, 'patch51-workflow-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();

const workflowKeys = ['ovr_rca_capa', 'audit_finding_closure', 'accreditation_evidence_gate', 'training_completion', 'access_review_signoff', 'backup_restore_dryrun', 'department_go_no_go'];
const runStatuses = ['not_started', 'scheduled', 'in_progress', 'passed', 'passed_with_limitations', 'failed', 'blocked', 'cancelled'];
const stepStatuses = ['pending', 'in_progress', 'passed', 'passed_with_limitation', 'failed', 'blocked', 'not_applicable'];
const evidenceStatuses = ['captured', 'accepted', 'rejected', 'needs_review'];
const issueStatuses = ['open', 'in_review', 'resolved', 'accepted_with_limitation'];
const visibilityTokens = ['pending_workflow_walkthrough', 'failed_workflow_walkthrough', 'missing_workflow_evidence', 'workflow_execution_blocker', 'missing_required_evidence', 'evidence_needs_attention', 'live_execution_readiness_status'];

const checks = [
  { name: 'workflow keys represented', passed: workflowKeys.every(token => lower.includes(token)) },
  { name: 'run statuses represented', passed: runStatuses.every(token => lower.includes(token)) },
  { name: 'step statuses represented', passed: stepStatuses.every(token => lower.includes(token)) },
  { name: 'evidence statuses represented', passed: evidenceStatuses.every(token => lower.includes(token)) },
  { name: 'issue statuses represented', passed: issueStatuses.every(token => lower.includes(token)) },
  ...visibilityTokens.map(token => ({ name: `visibility token exists: ${token}`, passed: lower.includes(token) })),
  { name: 'passed workflow requires evidence summary', passed: lower.includes('evidence summary is required before marking a workflow walkthrough passed') },
  { name: 'failed or blocked workflow requires blocker summary', passed: lower.includes('blocker summary is required for failed or blocked workflow walkthroughs') },
  { name: 'passed step requires evidence reference when required', passed: lower.includes('evidence reference is required before marking a workflow step passed') },
  { name: 'rejected or review-needed evidence requires notes', passed: lower.includes('review notes are required for rejected or review-needed evidence') },
  { name: 'open high/critical issues block readiness', passed: lower.includes("severity in ('critical', 'high')") && lower.includes('open_high_critical_issues') },
  { name: 'no blanket auto-pass', passed: !/default\s+'passed'/i.test(sql) && !/set\s+(run_status|step_status)\s*=\s*'passed'/i.test(sql) },
  { name: 'event ledger records execution lifecycle', passed: ['workflow_run_created', 'workflow_run_status_updated', 'workflow_step_created', 'evidence_captured', 'execution_issue_created'].every(token => lower.includes(token)) },
];

const failed = checks.filter(check => !check.passed);
const result = { patch: '51', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed, workflow_keys: workflowKeys, run_statuses: runStatuses, step_statuses: stepStatuses };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
