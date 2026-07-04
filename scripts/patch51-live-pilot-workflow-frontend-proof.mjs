import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'src/pages/ProductionReadinessCenter.tsx');
const apiPath = path.join(root, 'src/lib/productionReadinessApi.ts');
const packagePath = path.join(root, 'package.json');
const outDir = path.join(root, 'release/patch51');
const outPath = path.join(outDir, 'patch51-frontend-proof.json');
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
const api = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const pkg = fs.existsSync(packagePath) ? fs.readFileSync(packagePath, 'utf8') : '';
const combined = `${page}\n${api}\n${pkg}`;
const uiTokens = ['livePilotExecutionTitle', 'liveExecutionReadiness', 'criticalWorkflows', 'workflowsPassed', 'workflowsLimited', 'workflowsFailed', 'workflowsBlocked', 'pendingWalkthroughs', 'missingEvidence', 'evidenceNeedingReview', 'highCriticalIssues', 'livePilotBlockersTitle', 'pendingWalkthroughsTitle', 'failedWalkthroughsTitle'];
const apiViews = ['v_patch51_production_readiness_live_pilot_execution_overlay', 'v_patch51_workflow_execution_blocker_register', 'v_patch51_pending_workflow_walkthrough_register', 'v_patch51_failed_workflow_walkthrough_register'];
const labelValues = uiTokens.flatMap(token => [...page.matchAll(new RegExp(`${token}:\\s*'([^']*)'`, 'g'))].map(match => match[1])).join('\n');

const checks = [
  { name: 'ProductionReadinessCenter displays Live Pilot Execution overlay', passed: uiTokens.every(token => page.includes(token)) },
  { name: 'pending, failed, missing evidence, review evidence, blockers, and limitations visible', passed: ['workflows_pending', 'workflows_failed', 'missing_evidence_count', 'evidence_needing_review', 'workflow_blocker_count', 'workflows_passed_with_limitations'].every(token => page.includes(token)) },
  { name: 'API reads Patch 51 views', passed: apiViews.every(token => api.includes(token)) },
  { name: 'API treats missing walkthroughs as evidence required', passed: api.includes("live_execution_readiness_status: 'evidence_required'") && api.includes('Record live workflow walkthroughs and capture evidence before pilot approval') },
  { name: 'package scripts exist', passed: ['patch51:schema-proof', 'patch51:workflow-proof', 'patch51:frontend-proof', 'patch51:all'].every(token => pkg.includes(token)) },
  { name: 'patch50:all remains in patch51:all', passed: pkg.includes('npm run patch50:all') },
  { name: 'v700 runtime security remains in patch51:all', passed: pkg.includes('npm run v700:runtime-security') },
  { name: 'professional wording avoids technical terms in live pilot UI labels', passed: !/RPC|edge bridge|schema proof|migration|patch number|unknown_requires_review/i.test(labelValues) },
  { name: 'no service-role-only frontend exposure introduced', passed: !/service[_-]?role[_-]?key|supabase_service_role|service_role_secret/i.test(`${page}\n${api}`) },
  { name: 'no fake/demo data strings introduced in Patch 51 frontend/API', passed: !/\b(fake|demo|mock)\b/i.test(`${page}\n${api}`) },
  { name: 'no conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(combined) },
];
const failed = checks.filter(check => !check.passed);
const result = { patch: '51', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
