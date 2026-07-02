import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch24');

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function missing(source, items) {
  return items.filter(item => !source.includes(item));
}

const migration = await read('supabase/migrations/086_patch24_audit_findings_workflow_hardening.sql');
const domain = await read('src/types/domain.ts');
const api = await read('src/lib/grcApi.ts');
const auditPage = await read('src/pages/Audit.tsx');

const migrationChecks = [
  'finding_status',
  'workflow_stage',
  'management_response_status',
  'corrective_action_status',
  'repeat_finding_flag',
  'evidence_gate_status',
  'audit_finding_due_date_extensions',
  'audit_finding_validation_events',
  'v_patch24_audit_finding_workflow_queue',
  'v_patch24_overdue_audit_findings',
  'v_patch24_repeat_audit_findings',
  'v_patch24_audit_closure_gate_status',
  'v_patch24_audit_executive_escalations',
  'v_patch24_audit_closure_pack_index',
  'patch24_audit_finding_workflow_bridge',
];

const typeChecks = [
  'AuditFindingWorkflowStatus',
  'AuditFindingWorkflowStage',
  'AuditFindingSeverityLevel',
  'AuditFindingManagementResponseStatus',
  'AuditFindingCorrectiveActionStatus',
  'AuditFindingClosureValidationStatus',
  'AuditFindingWorkflowQueueRow',
  'OverdueAuditFindingRow',
  'RepeatAuditFindingRow',
  'AuditClosureGateStatusRow',
  'AuditExecutiveEscalationRow',
  'AuditClosurePackIndexRow',
  'AuditFindingValidationEventRow',
  'AuditFindingDueDateExtensionRow',
];

const apiChecks = [
  'getAuditFindings',
  'getAuditFindingWorkflowQueue',
  'getOverdueAuditFindings',
  'getRepeatAuditFindings',
  'getAuditClosureGateStatus',
  'getAuditExecutiveEscalations',
  'getAuditClosurePackIndex',
  'getAuditFindingValidationEvents',
  'issueAuditFinding',
  'submitManagementResponse',
  'acceptManagementResponse',
  'rejectManagementResponse',
  'submitCorrectiveActionPlan',
  'acceptCorrectiveActionPlan',
  'rejectCorrectiveActionPlan',
  'requestAuditFindingExtension',
  'approveAuditFindingExtension',
  'rejectAuditFindingExtension',
  'requestAuditFindingClosure',
  'validateAuditFindingClosure',
  'rejectAuditFindingClosure',
  'reopenAuditFindingWithReason',
  'escalateAuditFinding',
  'markRepeatAuditFinding',
  'linkAuditFindingToRisk',
  'linkAuditFindingToCompliance',
  'generateAuditClosurePackIndex',
];

const uiChecks = [
  'Audit Findings Workflow Center',
  'Audit findings register',
  'Workflow queue',
  'Overdue findings',
  'Repeat/systemic findings',
  'Closure gate status',
  'Executive escalations',
  'Closure pack index',
  'Validation events',
  'Management response',
  'Corrective action plan',
];

const result = {
  generated_at: new Date().toISOString(),
  migration_missing: missing(migration, migrationChecks),
  type_missing: missing(domain, typeChecks),
  api_missing: missing(api, apiChecks),
  ui_missing: missing(auditPage, uiChecks),
};

const blockers = [
  ...result.migration_missing,
  ...result.type_missing,
  ...result.api_missing,
  ...result.ui_missing,
];

const report = {
  ...result,
  status: blockers.length ? 'failed' : 'passed',
  blocking_count: blockers.length,
};

await mkdir(releaseDir, { recursive: true });
await writeFile(path.join(releaseDir, 'patch24-audit-findings-workflow-audit.json'), `${JSON.stringify(report, null, 2)}\n`);

if (blockers.length) {
  console.error(`Patch 24 audit findings workflow audit failed: ${blockers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Patch 24 audit findings workflow audit passed.');
}
