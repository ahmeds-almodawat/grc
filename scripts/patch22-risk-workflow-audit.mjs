import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release', 'patch22');
const findings = [];

function read(rel) {
  const filePath = path.join(root, rel);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function addCheck(name, passed, severity = 'high', detail = '') {
  findings.push({ name, passed: Boolean(passed), severity, detail });
}

function includesAll(source, terms, severity, prefix) {
  for (const term of terms) {
    addCheck(`${prefix}: ${term}`, source.includes(term), severity, `Missing required Patch 22 term: ${term}`);
  }
}

const migrationPath = 'supabase/migrations/084_patch22_risk_workflow_hardening.sql';
const migration = read(migrationPath);
const baselineRiskMigration = read('supabase/migrations/002_grc_layer.sql');
const domainTypes = read('src/types/domain.ts');
const grcApi = read('src/lib/grcApi.ts');
const risksPage = read('src/pages/Risks.tsx');
const bridge = read('supabase/functions/privileged-action/index.ts');
const packageJson = JSON.parse(read('package.json') || '{}');
const combinedRiskSchema = `${baselineRiskMigration}\n${migration}`;

const requiredFiles = [
  migrationPath,
  'src/types/domain.ts',
  'src/lib/grcApi.ts',
  'src/pages/Risks.tsx',
  'supabase/functions/privileged-action/index.ts',
  'release/patch22/risk-workflow-hardening-checklist.md',
  'release/patch22/risk-business-rules.md',
  'release/patch22/risk-migration-summary.md',
  'release/patch22/risk-ui-test-plan.md',
  'release/patch22/risk-security-review.md',
  'release/patch22/patch22-proof-summary.md',
];

for (const file of requiredFiles) {
  addCheck(`required file exists: ${file}`, exists(file), 'critical');
}

includesAll(migration, [
  'alter table public.risks',
  'add column if not exists lifecycle_status',
  'add column if not exists risk_owner_id',
  'add column if not exists control_owner_id',
  'add column if not exists treatment_owner_id',
  'add column if not exists executive_sponsor_id',
  'add column if not exists inherent_likelihood',
  'add column if not exists inherent_impact',
  'add column if not exists scoring_method',
  'add column if not exists score_last_changed_at',
  'add column if not exists score_last_changed_by',
  'add column if not exists appetite_level',
  'add column if not exists appetite_threshold',
  'add column if not exists appetite_breached',
  'add column if not exists appetite_breach_reason',
  'add column if not exists treatment_required',
  'add column if not exists treatment_status',
  'add column if not exists treatment_plan_summary',
  'add column if not exists treatment_due_date',
  'add column if not exists treatment_completed_at',
  'add column if not exists acceptance_required',
  'add column if not exists acceptance_status',
  'add column if not exists acceptance_requested_by',
  'add column if not exists acceptance_requested_at',
  'add column if not exists accepted_by',
  'add column if not exists accepted_at',
  'add column if not exists acceptance_expiry_date',
  'add column if not exists acceptance_reason',
  'add column if not exists review_overdue',
  'add column if not exists last_reviewed_by',
  'add column if not exists closure_requested_at',
  'add column if not exists closure_requested_by',
  'add column if not exists closure_approved_by',
  'add column if not exists closure_approved_at',
  'add column if not exists closure_reason',
  'add column if not exists closure_evidence_required',
  'add column if not exists closure_blocker',
  'add column if not exists escalation_required',
  'add column if not exists escalation_level',
  'add column if not exists escalated_at',
  'add column if not exists escalated_to',
  'add column if not exists executive_visible',
  'add column if not exists duplicate_of_risk_id',
  'add column if not exists related_risk_ids',
  'add column if not exists repeat_signal_flag',
  'add column if not exists source_ovr_id',
  'add column if not exists source_audit_finding_id',
  'add column if not exists source_compliance_id',
  'add column if not exists source_project_id',
], 'critical', 'risk additive field');

includesAll(combinedRiskSchema, [
  'inherent_score',
  'residual_likelihood',
  'residual_impact',
  'residual_score',
  'review_frequency',
  'next_review_date',
  'last_reviewed_at',
], 'critical', 'preserved risk schema field');

includesAll(migration, [
  'create table if not exists public.risk_kri_indicators',
  'create table if not exists public.risk_reassessment_history',
  'create table if not exists public.risk_workflow_events',
  'create index if not exists idx_patch22_risks_org',
  'create index if not exists idx_patch22_risks_risk_owner',
  'create index if not exists idx_patch22_risks_treatment_owner',
  'create index if not exists idx_patch22_risks_risk_level',
  'create index if not exists idx_patch22_risks_residual_score',
  'create index if not exists idx_patch22_risks_appetite',
  'create index if not exists idx_patch22_risks_treatment_required',
  'create index if not exists idx_patch22_risks_treatment_due',
  'create index if not exists idx_patch22_risks_next_review',
  'create index if not exists idx_patch22_risks_acceptance',
  'create index if not exists idx_patch22_risks_escalation',
], 'critical', 'risk workflow storage');

includesAll(migration, [
  'public.v_patch22_risk_workflow_queue',
  'public.v_patch22_risk_appetite_breaches',
  'public.v_patch22_risk_treatment_queue',
  'public.v_patch22_risk_kri_alerts',
  'public.v_patch22_executive_risk_escalations',
  'public.v_patch22_risk_closure_blockers',
], 'critical', 'risk workflow view');

const workflowActions = [
  'update_risk_assessment',
  'request_risk_acceptance',
  'approve_risk_acceptance',
  'reject_risk_acceptance',
  'update_risk_treatment',
  'complete_risk_treatment',
  'request_risk_closure',
  'approve_risk_closure',
  'reopen_risk_with_reason',
  'link_risk_source',
  'mark_duplicate_risk',
];
includesAll(migration, workflowActions, 'critical', 'database workflow action');
includesAll(bridge, workflowActions, 'critical', 'edge bridge workflow action');

includesAll(grcApi, [
  'getRiskWorkflowQueue',
  'getRiskAppetiteBreaches',
  'getRiskTreatmentQueue',
  'getRiskKriAlerts',
  'getExecutiveRiskEscalations',
  'getRiskClosureBlockers',
  'getRiskReassessmentHistory',
  'getRiskWorkflowEvents',
  'updateRiskAssessment',
  'requestRiskAcceptance',
  'approveRiskAcceptance',
  'rejectRiskAcceptance',
  'updateRiskTreatment',
  'completeRiskTreatment',
  'requestRiskClosure',
  'approveRiskClosure',
  'reopenRiskWithReason',
  'linkRiskSource',
  'markDuplicateRisk',
  'invokePrivilegedAction',
], 'critical', 'api function');

includesAll(domainTypes, [
  'RiskLifecycleStatus',
  'RiskWorkflowQueueRow',
  'RiskAppetiteBreachRow',
  'RiskTreatmentQueueRow',
  'RiskKriAlertRow',
  'ExecutiveRiskEscalationRow',
  'RiskClosureBlockerRow',
  'RiskReassessmentHistoryRow',
  'RiskWorkflowEventRow',
], 'critical', 'type definition');

includesAll(risksPage, [
  'Patch 22 workflow queues',
  'Appetite breaches',
  'Treatment queue',
  'KRI alerts',
  'Executive escalations',
  'Closure blockers',
  'Risk workflow detail',
  'Reassess risk',
  'Request acceptance',
  'Approve acceptance',
  'Reject acceptance',
  'Update treatment',
  'Complete treatment',
  'Request closure',
  'Approve closure',
  'Reopen with reason',
  'Mark duplicate',
], 'high', 'risk workflow UI');

addCheck('score changes write reassessment history', /insert into public\.risk_reassessment_history/i.test(migration), 'critical');
addCheck('workflow actions write event records', /patch22_write_risk_event/i.test(migration), 'critical');
addCheck('acceptance requires reason', migration.includes('PATCH22_RISK_ACCEPTANCE_REASON_REQUIRED'), 'critical');
addCheck('acceptance requires expiry', migration.includes('PATCH22_RISK_ACCEPTANCE_EXPIRY_REQUIRED'), 'critical');
addCheck('closure blockers are enforced', migration.includes('PATCH22_RISK_CLOSURE_BLOCKED'), 'critical');
addCheck('reopen requires reason', migration.includes('PATCH22_RISK_REOPEN_REASON_REQUIRED'), 'critical');
addCheck('high residual risks drive treatment', migration.includes('treatment_required = (v_residual_score >= 12'), 'critical');
addCheck('critical risks become executive visible', migration.includes('executive_visible = case') && migration.includes('v_residual_score >= 20'), 'high');
addCheck('Patch 22 all script exists', Boolean(packageJson.scripts?.['patch22:all']), 'critical');
addCheck('Patch 22 audit script exists', Boolean(packageJson.scripts?.['patch22:risk-audit']), 'critical');
addCheck('Patch 22 security script exists', Boolean(packageJson.scripts?.['patch22:risk-security']), 'critical');

const failed = findings.filter((finding) => !finding.passed);
const critical = failed.filter((finding) => finding.severity === 'critical').length;
const high = failed.filter((finding) => finding.severity === 'high').length;
const medium = failed.filter((finding) => finding.severity === 'medium').length;
const status = critical || high ? 'failed' : 'passed';
const report = {
  generated_at: new Date().toISOString(),
  patch: 'Patch 22',
  status,
  summary: {
    critical,
    high,
    medium,
    total: findings.length,
    passed: findings.filter((finding) => finding.passed).length,
    failed: failed.length,
  },
  findings,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'risk-workflow-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('Patch 22 risk workflow audit complete.');
console.log(report.summary);
if (status !== 'passed') {
  process.exitCode = 1;
}
