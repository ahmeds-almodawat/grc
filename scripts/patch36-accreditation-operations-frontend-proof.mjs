import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const apiPath = path.join(root, 'src/lib/accreditationWorkflowApi.ts');
const pagePath = path.join(root, 'src/pages/AccreditationWorkflowCenter.tsx');
const appPath = path.join(root, 'src/App.tsx');
const packagePath = path.join(root, 'package.json');
const outputDir = path.join(root, 'release/patch36');
const outputPath = path.join(outputDir, 'patch36-frontend-proof.json');
const findings = [];

const requiredViews = [
  'v_patch35_clause_owner_register',
  'v_patch35_active_review_cycles',
  'v_patch35_clause_owner_task_queue',
  'v_patch35_overdue_clause_tasks',
  'v_patch35_clause_reviewer_signoff_queue',
  'v_patch35_department_accreditation_workload',
  'v_patch35_clause_blocker_summary',
  'v_patch35_clause_signoff_register',
  'v_patch35_escalation_register',
  'v_patch35_accreditation_operations_dashboard',
  'v_patch35_executive_accreditation_workflow_summary',
  'v_patch35_ready_for_survey_review_queue',
];

const requiredMethods = [
  'getClauseOwnerRegister',
  'getActiveReviewCycles',
  'getClauseOwnerTaskQueue',
  'getOverdueClauseTasks',
  'getClauseReviewerSignoffQueue',
  'getDepartmentAccreditationWorkload',
  'getClauseBlockerSummary',
  'getClauseSignoffRegister',
  'getEscalationRegister',
  'getAccreditationOperationsDashboard',
  'getExecutiveAccreditationWorkflowSummary',
  'getReadyForSurveyReviewQueue',
];

const actionNames = [
  'assign_accreditation_clause_owner',
  'transfer_accreditation_clause_owner',
  'create_accreditation_review_cycle',
  'start_accreditation_review_cycle',
  'complete_accreditation_review_cycle',
  'create_accreditation_clause_review_task',
  'submit_accreditation_clause_task',
  'approve_accreditation_clause_task',
  'reject_accreditation_clause_task',
  'reopen_accreditation_clause_task',
  'signoff_accreditation_clause',
  'reject_accreditation_clause_signoff',
  'escalate_accreditation_clause_task',
  'acknowledge_accreditation_escalation',
  'resolve_accreditation_escalation',
];

const requiredSections = [
  'Clause owner register',
  'Active review cycles',
  'Owner task queue',
  'Overdue clause tasks',
  'Reviewer signoff queue',
  'Department accreditation workload',
  'Clause blocker summary',
  'Clause signoff register',
  'Escalation register',
  'Ready-for-survey review queue',
];

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function requireContains(source, needle, label) {
  if (!source.includes(needle)) findings.push(`${label} missing: ${needle}`);
}

if (!fs.existsSync(apiPath)) findings.push('API file missing: src/lib/accreditationWorkflowApi.ts');
if (!fs.existsSync(pagePath)) findings.push('Page file missing: src/pages/AccreditationWorkflowCenter.tsx');

const apiSource = readIfExists(apiPath);
const pageSource = readIfExists(pagePath);
const appSource = readIfExists(appPath);
const packageJson = JSON.parse(readIfExists(packagePath));

for (const view of requiredViews) requireContains(apiSource, view, 'Patch 35 view reference');
for (const method of requiredMethods) requireContains(apiSource, `function ${method}`, 'Read method');
for (const action of actionNames) requireContains(apiSource, action, 'Safe bridge action name');
for (const section of requiredSections) requireContains(pageSource, section, 'Operations page section');

requireContains(appSource, "import { AccreditationWorkflowCenter } from './pages/AccreditationWorkflowCenter';", 'App import');
requireContains(appSource, "id: 'accreditationWorkflow'", 'Quality hub tab');
requireContains(appSource, '<AccreditationWorkflowCenter />', 'Quality hub content');

if (packageJson.scripts?.['patch36:frontend-proof'] !== 'node scripts/patch36-accreditation-operations-frontend-proof.mjs') {
  findings.push('package.json missing patch36:frontend-proof script');
}
if (packageJson.scripts?.['patch36:all'] !== 'npm run typecheck && npm run build && npm run patch36:frontend-proof && npm run v700:runtime-security') {
  findings.push('package.json missing patch36:all script');
}

const changedRuntimeSource = `${apiSource}\n${pageSource}`;
if (/\bsupabase\.rpc\s*\(/.test(changedRuntimeSource)) findings.push('Direct browser RPC call found in Patch 36 frontend/API files');
if (/service[_-]?role/i.test(changedRuntimeSource)) findings.push('Service-role reference found in Patch 36 frontend/API files');
if (/\b(mock|demo|sample)\b/i.test(changedRuntimeSource)) findings.push('Non-live data wording found in Patch 36 frontend/API files');

let conflictMarkerCount = 0;
try {
  const grepOutput = execFileSync('git', ['grep', '-n', '-E', '^(<<<<<<<|=======|>>>>>>>)', '--', '.', ':!node_modules', ':!dist', ':!build'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  conflictMarkerCount = grepOutput.trim().split('\n').filter(Boolean).length;
} catch (error) {
  if (error.status !== 1) findings.push(`Conflict marker scan failed: ${error.message}`);
}
if (conflictMarkerCount > 0) findings.push(`Conflict markers found: ${conflictMarkerCount}`);

let runtimeSecurity = null;
let runtimeReport = {};
try {
  const output = execFileSync('node', ['scripts/v700-runtime-security-bridge-audit.mjs'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  runtimeSecurity = output.includes('"status": "passed"') || output.includes('"status":"passed"') ? 'passed' : 'unknown';
  const runtimePath = path.join(root, 'release/v700/runtime-security-bridge-audit.json');
  if (fs.existsSync(runtimePath)) runtimeReport = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
  if (runtimeSecurity !== 'passed') findings.push('v700 runtime security did not report passed status');
} catch (error) {
  runtimeSecurity = 'failed';
  findings.push(`v700 runtime security failed: ${error.message}`);
}

if (Number(runtimeReport.remaining_broad_security_definer_execute_grants ?? 999) !== 0) {
  findings.push(`remaining_broad_security_definer_execute_grants is ${runtimeReport.remaining_broad_security_definer_execute_grants}`);
}
if (Number(runtimeReport.service_role_only_rpc_called_by_frontend ?? 999) !== 0) {
  findings.push(`service_role_only_rpc_called_by_frontend is ${runtimeReport.service_role_only_rpc_called_by_frontend}`);
}

fs.mkdirSync(outputDir, { recursive: true });
const report = {
  generated_at: new Date().toISOString(),
  api_file_exists: fs.existsSync(apiPath),
  page_file_exists: fs.existsSync(pagePath),
  required_view_count: requiredViews.length,
  required_method_count: requiredMethods.length,
  safe_action_count: actionNames.length,
  route_navigation_integrated: appSource.includes("id: 'accreditationWorkflow'") && appSource.includes('<AccreditationWorkflowCenter />'),
  conflict_marker_count: conflictMarkerCount,
  runtime_security_status: runtimeSecurity,
  remaining_broad_security_definer_execute_grants: runtimeReport.remaining_broad_security_definer_execute_grants,
  service_role_only_rpc_called_by_frontend: runtimeReport.service_role_only_rpc_called_by_frontend,
  status: findings.length === 0 ? 'passed' : 'failed',
  finding_count: findings.length,
  findings,
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (findings.length > 0) process.exit(1);
