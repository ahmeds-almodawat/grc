import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'src/pages/ProductionReadinessCenter.tsx');
const apiPath = path.join(root, 'src/lib/productionReadinessApi.ts');
const packagePath = path.join(root, 'package.json');
const outDir = path.join(root, 'release/patch53');
const outPath = path.join(outDir, 'patch53-frontend-proof.json');
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
const api = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const pkg = fs.existsSync(packagePath) ? fs.readFileSync(packagePath, 'utf8') : '';
const combined = `${page}\n${api}\n${pkg}`;

const uiTokens = [
  'hypercareTitle',
  'productionStability',
  'activeHypercare',
  'daysRemaining',
  'openHypercareIssues',
  'overdueIssues',
  'missedCadence',
  'missingFeedback',
  'lowAdoption',
  'supportNeeded',
  'trainingNeeded',
  'unresolvedPilotIssues',
  'inheritedRemediation',
  'hypercareBlockersTitle',
  'hypercareIssuesTitle',
  'operatingCadenceTitle',
  'adoptionFeedbackTitle',
];
const dataTokens = [
  'production_stability_status',
  'active_hypercare_periods',
  'days_remaining',
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
];
const apiViews = [
  'v_patch53_production_readiness_hypercare_overlay',
  'v_patch53_hypercare_blocker_register',
  'v_patch53_hypercare_issue_register',
  'v_patch53_operating_cadence_event_register',
  'v_patch53_department_adoption_feedback_register',
];
const labelValues = uiTokens.flatMap(token => [...page.matchAll(new RegExp(`${token}:\\s*'([^']*)'`, 'g'))].map(match => match[1])).join('\n');

const checks = [
  { name: 'ProductionReadinessCenter displays hypercare overlay', passed: uiTokens.every(token => page.includes(token)) },
  { name: 'active periods, blockers, issues, cadence, feedback, adoption, support, and training visible', passed: dataTokens.every(token => page.includes(token)) },
  { name: 'API reads Patch 53 views', passed: apiViews.every(token => api.includes(token)) },
  { name: 'API treats missing hypercare period as evidence required', passed: api.includes("production_stability_status: 'evidence_required'") && api.includes('Create a production hypercare period and begin operating cadence evidence capture') },
  { name: 'package scripts exist', passed: ['patch53:schema-proof', 'patch53:workflow-proof', 'patch53:frontend-proof', 'patch53:all'].every(token => pkg.includes(token)) },
  { name: 'patch52:all remains in patch53:all', passed: pkg.includes('npm run patch52:all') },
  { name: 'v700 runtime security remains in patch53:all', passed: pkg.includes('npm run v700:runtime-security') },
  { name: 'professional wording avoids technical terms in hypercare UI labels', passed: !/RPC|edge bridge|schema proof|migration|patch number|unknown_requires_review/i.test(labelValues) },
  { name: 'no service-role-only frontend exposure introduced', passed: !/service[_-]?role[_-]?key|supabase_service_role|service_role_secret/i.test(`${page}\n${api}`) },
  { name: 'no fake/demo/mock hypercare strings introduced in Patch 53 frontend/API', passed: !/\b(fake|demo|mock)\b/i.test(`${page}\n${api}`) },
  { name: 'no conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(combined) },
];

const failed = checks.filter(check => !check.passed);
const result = { patch: '53', checked_at: new Date().toISOString(), strict_passed: failed.length === 0, check_count: checks.length, failed_count: failed.length, failed };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
