import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'src/pages/ProductionReadinessCenter.tsx');
const apiPath = path.join(root, 'src/lib/productionReadinessApi.ts');
const packagePath = path.join(root, 'package.json');
const outDir = path.join(root, 'release/patch52');
const outPath = path.join(outDir, 'patch52-frontend-proof.json');
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
const api = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const pkg = fs.existsSync(packagePath) ? fs.readFileSync(packagePath, 'utf8') : '';
const combined = `${page}\n${api}\n${pkg}`;

const uiTokens = [
  'pilotClosureTitle',
  'productionGoLiveReadiness',
  'missingGoLiveDecisions',
  'rejectedDeferredDecisions',
  'openRemediations',
  'overdueRemediations',
  'highCriticalRemediations',
  'acceptedLimitations',
  'pendingLimitationReviews',
  'failedBlockedWorkflows',
  'pilotClosureBlockersTitle',
  'remediationActionsTitle',
  'acceptedLimitationsTitle',
  'goLiveDecisionTitle',
];
const dataTokens = [
  'production_golive_readiness_status',
  'open_remediation_actions',
  'overdue_remediation_actions',
  'high_critical_remediation_actions',
  'accepted_limitations',
  'pending_limitation_reviews',
  'missing_golive_decisions',
  'failed_or_blocked_workflows',
  'missing_workflow_evidence_count',
  'open_high_critical_live_issues',
];
const apiViews = [
  'v_patch52_production_readiness_golive_decision_overlay',
  'v_patch52_pilot_closure_blocker_register',
  'v_patch52_pilot_remediation_action_register',
  'v_patch52_accepted_limitation_register',
  'v_patch52_production_golive_decision_register',
];
const labelValues = uiTokens.flatMap(token => [...page.matchAll(new RegExp(`${token}:\\s*'([^']*)'`, 'g'))].map(match => match[1])).join('\n');

const checks = [
  { name: 'ProductionReadinessCenter displays pilot closure overlay', passed: uiTokens.every(token => page.includes(token)) },
  { name: 'pending decisions, remediations, limitations, missing evidence, and blockers visible', passed: dataTokens.every(token => page.includes(token)) },
  { name: 'API reads Patch 52 views', passed: apiViews.every(token => api.includes(token)) },
  { name: 'API treats missing closure review as evidence required', passed: api.includes("production_golive_readiness_status: 'evidence_required'") && api.includes('Create a pilot closure review and record executive go-live decision evidence') },
  { name: 'package scripts exist', passed: ['patch52:schema-proof', 'patch52:workflow-proof', 'patch52:frontend-proof', 'patch52:all'].every(token => pkg.includes(token)) },
  { name: 'patch51:all remains in patch52:all', passed: pkg.includes('npm run patch51:all') },
  { name: 'v700 runtime security remains in patch52:all', passed: pkg.includes('npm run v700:runtime-security') },
  { name: 'professional wording avoids technical terms in pilot closure UI labels', passed: !/RPC|edge bridge|schema proof|migration|patch number|unknown_requires_review/i.test(labelValues) },
  { name: 'no service-role-only frontend exposure introduced', passed: !/service[_-]?role[_-]?key|supabase_service_role|service_role_secret/i.test(`${page}\n${api}`) },
  { name: 'no fake/demo/mock closure strings introduced in Patch 52 frontend/API', passed: !/\b(fake|demo|mock)\b/i.test(`${page}\n${api}`) },
  { name: 'no conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(combined) },
];

const failed = checks.filter(check => !check.passed);
const result = { patch: '52', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
