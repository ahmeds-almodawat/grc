import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const apiPath = path.join(root, 'src/lib/evidenceBridgeApi.ts');
const pagePath = path.join(root, 'src/pages/EvidenceBridgeCenter.tsx');
const appPath = path.join(root, 'src/App.tsx');
const packagePath = path.join(root, 'package.json');
const outputDir = path.join(root, 'release/patch34');
const outputPath = path.join(outputDir, 'patch34-frontend-proof.json');

const requiredViews = [
  'v_patch33_clause_control_evidence_bridge',
  'v_patch33_live_evidence_gap_register',
  'v_patch33_evidence_collection_queue',
  'v_patch33_overdue_evidence_requests',
  'v_patch33_stale_expired_evidence_register',
  'v_patch33_evidence_review_queue',
  'v_patch33_department_evidence_readiness',
  'v_patch33_clause_evidence_readiness',
  'v_patch33_capa_training_sop_evidence_dependencies',
  'v_patch33_accreditation_live_readiness_summary',
  'v_patch33_evidence_exception_register',
  'v_patch33_executive_evidence_bridge_summary',
];

const requiredMethods = [
  'getClauseControlEvidenceBridge',
  'getLiveEvidenceGapRegister',
  'getEvidenceCollectionQueue',
  'getOverdueEvidenceRequests',
  'getStaleExpiredEvidenceRegister',
  'getEvidenceReviewQueue',
  'getDepartmentEvidenceReadiness',
  'getClauseEvidenceReadiness',
  'getEvidenceDependencies',
  'getAccreditationLiveReadinessSummary',
  'getEvidenceExceptionRegister',
  'getExecutiveEvidenceBridgeSummary',
];

const safeActionNames = [
  'create_evidence_bridge_link',
  'update_evidence_bridge_status',
  'create_evidence_collection_request',
  'submit_evidence_collection_request',
  'review_evidence_bridge_submission',
  'accept_evidence_bridge_submission',
  'reject_evidence_bridge_submission',
  'waive_evidence_collection_request',
  'reopen_evidence_collection_request',
  'mark_evidence_bridge_not_applicable',
  'refresh_evidence_freshness_status',
];

const requiredSections = [
  'Clause-control-evidence bridge',
  'Live evidence gap register',
  'Evidence collection queue',
  'Overdue evidence requests',
  'Stale and expired evidence register',
  'Evidence review queue',
  'Department evidence readiness',
  'Clause evidence readiness',
  'CAPA, training, SOP, risk, and audit dependencies',
  'Evidence exception register',
];

const findings = [];

function readIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    findings.push(`${label} missing: ${path.relative(root, filePath)}`);
    return false;
  }
  return true;
}

function requireContains(source, needle, label) {
  if (!source.includes(needle)) findings.push(`${label} missing: ${needle}`);
}

requireFile(apiPath, 'API file');
requireFile(pagePath, 'Page file');

const apiSource = readIfExists(apiPath);
const pageSource = readIfExists(pagePath);
const appSource = readIfExists(appPath);
const packageJson = JSON.parse(readIfExists(packagePath));

for (const view of requiredViews) requireContains(apiSource, view, 'Patch 33 view reference');
for (const method of requiredMethods) requireContains(apiSource, `function ${method}`, 'Read method');
for (const actionName of safeActionNames) requireContains(apiSource, actionName, 'Safe bridge action name');
for (const section of requiredSections) requireContains(pageSource, section, 'Operations center section');

requireContains(appSource, "import { EvidenceBridgeCenter } from './pages/EvidenceBridgeCenter';", 'App import');
requireContains(appSource, "id: 'evidenceBridge'", 'Quality hub tab');
requireContains(appSource, '<EvidenceBridgeCenter />', 'Quality hub tab content');

if (packageJson.scripts?.['patch34:frontend-proof'] !== 'node scripts/patch34-evidence-bridge-frontend-proof.mjs') {
  findings.push('package.json missing patch34:frontend-proof script');
}
if (packageJson.scripts?.['patch34:all'] !== 'npm run typecheck && npm run build && npm run patch34:frontend-proof && npm run v700:runtime-security') {
  findings.push('package.json missing patch34:all script');
}

const changedRuntimeSource = `${apiSource}\n${pageSource}`;
if (/\bsupabase\.rpc\s*\(/.test(changedRuntimeSource)) {
  findings.push('Direct browser RPC call found in Patch 34 frontend/API files');
}
if (/service[_-]?role/i.test(changedRuntimeSource)) {
  findings.push('Service-role reference found in Patch 34 frontend/API files');
}
if (/\b(mock|demo|sample)\b/i.test(changedRuntimeSource)) {
  findings.push('Non-live data wording found in Patch 34 frontend/API files');
}

let conflictMarkerCount = 0;
try {
  const grepOutput = execFileSync('git', ['grep', '-n', '-E', '^(<<<<<<<|=======|>>>>>>>)', '--', '.', ':!node_modules', ':!dist', ':!build'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  conflictMarkerCount = grepOutput.trim().split('\n').filter(Boolean).length;
} catch (error) {
  if (error.status !== 1) {
    findings.push(`Conflict marker scan failed: ${error.message}`);
  }
}
if (conflictMarkerCount > 0) findings.push(`Conflict markers found: ${conflictMarkerCount}`);

let runtimeSecurity = null;
try {
  const output = execFileSync('node', ['scripts/v700-runtime-security-bridge-audit.mjs'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  runtimeSecurity = output.includes('"status": "passed"') || output.includes('"status":"passed"') ? 'passed' : 'unknown';
  if (runtimeSecurity !== 'passed') findings.push('v700 runtime security did not report passed status');
} catch (error) {
  runtimeSecurity = 'failed';
  findings.push(`v700 runtime security failed: ${error.message}`);
}

fs.mkdirSync(outputDir, { recursive: true });
const report = {
  generated_at: new Date().toISOString(),
  api_file_exists: fs.existsSync(apiPath),
  page_file_exists: fs.existsSync(pagePath),
  required_view_count: requiredViews.length,
  required_method_count: requiredMethods.length,
  safe_action_count: safeActionNames.length,
  route_navigation_integrated: appSource.includes("id: 'evidenceBridge'") && appSource.includes('<EvidenceBridgeCenter />'),
  conflict_marker_count: conflictMarkerCount,
  runtime_security_status: runtimeSecurity,
  status: findings.length === 0 ? 'passed' : 'failed',
  finding_count: findings.length,
  findings,
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (findings.length > 0) process.exit(1);
