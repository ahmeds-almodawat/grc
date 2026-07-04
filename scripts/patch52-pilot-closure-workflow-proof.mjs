import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/111_patch52_pilot_closure_remediation_golive_decision.sql');
const outDir = path.join(root, 'release/patch52');
const outPath = path.join(outDir, 'patch52-workflow-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const lower = sql.toLowerCase();

const closureStatuses = ['in_review', 'ready_for_decision', 'approved_for_golive', 'approved_with_limitations', 'blocked', 'deferred', 'cancelled'];
const remediationStatuses = ['open', 'in_progress', 'completed', 'overdue', 'accepted_risk', 'cancelled'];
const limitationStatuses = ['pending_review', 'accepted', 'rejected', 'expired', 'superseded'];
const decisionStatuses = ['pending', 'approved', 'approved_with_limitations', 'rejected', 'deferred', 'revoked'];
const decisionLevels = ['quality', 'audit', 'it_admin', 'executive', 'board'];
const visibilityTokens = [
  'missing_golive_decision',
  'open_remediation_actions',
  'overdue_remediation_actions',
  'high_critical_remediation_actions',
  'accepted_limitations',
  'pending_limitation_reviews',
  'failed_or_blocked_workflows',
  'missing_workflow_evidence_count',
  'open_high_critical_live_issues',
  'production_golive_readiness_status',
];

const checks = [
  { name: 'closure statuses represented', passed: closureStatuses.every(token => lower.includes(token)) },
  { name: 'remediation statuses represented', passed: remediationStatuses.every(token => lower.includes(token)) },
  { name: 'limitation statuses represented', passed: limitationStatuses.every(token => lower.includes(token)) },
  { name: 'decision statuses represented', passed: decisionStatuses.every(token => lower.includes(token)) },
  { name: 'decision levels represented', passed: decisionLevels.every(token => lower.includes(token)) },
  ...visibilityTokens.map(token => ({ name: `visibility token exists: ${token}`, passed: lower.includes(token) })),
  { name: 'closure decision status requires summary', passed: lower.includes('decision summary is required for closure decision status') },
  { name: 'blocked closure requires blocker summary', passed: lower.includes('blocker summary is required when closure is blocked') },
  { name: 'completed remediation requires evidence', passed: lower.includes('remediation summary and evidence reference are required before completion') },
  { name: 'accepted risk remediation requires reason', passed: lower.includes('risk acceptance reason is required for accepted risk remediation') },
  { name: 'accepted limitation requires approver and evidence', passed: lower.includes('accepted limitations require approver, mitigation plan, and evidence reference') },
  { name: 'go-live decision requires summary', passed: lower.includes('decision summary is required for go-live decision status') },
  { name: 'approval with limitations requires conditions', passed: lower.includes('conditions summary is required for go-live approval with limitations') },
  { name: 'Patch 51 failed workflows remain blockers', passed: lower.includes('v_patch51_failed_workflow_walkthrough_register') },
  { name: 'Patch 51 missing evidence remains visible', passed: lower.includes('v_patch51_missing_workflow_evidence_register') },
  { name: 'Patch 51 high-risk issues remain blockers', passed: lower.includes('v_patch51_live_pilot_execution_issue_register') && lower.includes("severity in ('high', 'critical')") },
  { name: 'no blanket approval defaults', passed: !/default\s+'approved'/i.test(sql) && !/set\s+(decision_status|closure_status)\s*=\s*'approved'/i.test(sql) },
];

const failed = checks.filter(check => !check.passed);
const result = { patch: '52', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed, closure_statuses: closureStatuses, remediation_statuses: remediationStatuses, limitation_statuses: limitationStatuses, decision_statuses: decisionStatuses };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
