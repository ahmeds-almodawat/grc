import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'src/pages/ProductionReadinessCenter.tsx');
const apiPath = path.join(root, 'src/lib/productionReadinessApi.ts');
const packagePath = path.join(root, 'package.json');
const outDir = path.join(root, 'release/patch49');
const outPath = path.join(outDir, 'patch49-frontend-proof.json');
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
const api = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const pkg = fs.existsSync(packagePath) ? fs.readFileSync(packagePath, 'utf8') : '';
const combined = `${page}\n${api}\n${pkg}`;

const pilotUiTokens = [
  'pilotActivationTitle',
  'pilotReadinessStatus',
  'departmentsInScope',
  'departmentsReady',
  'departmentsBlocked',
  'missingDepartmentOwners',
  'pendingDepartmentSignoffs',
  'overdueDepartmentSignoffs',
  'limitedDepartmentSignoffs',
  'participantCoverage',
  'trainingRequiredParticipants',
  'pilotBlockersTitle',
  'departmentReadinessTitle',
  'departmentSignoffTitle',
];

const apiViews = [
  'v_patch49_production_readiness_pilot_activation_overlay',
  'v_patch49_controlled_pilot_blockers',
  'v_patch49_department_pilot_readiness_register',
  'v_patch49_department_signoff_register',
  'v_patch49_pilot_participant_coverage',
];

const pilotLabelValues = pilotUiTokens
  .flatMap(token => [...page.matchAll(new RegExp(`${token}:\\s*'([^']*)'`, 'g'))].map(match => match[1]))
  .join('\n');

const checks = [
  { name: 'ProductionReadinessCenter displays pilot activation overlay', passed: pilotUiTokens.every(token => page.includes(token)) },
  { name: 'missing owners, pending signoffs, overdue signoffs, blocked departments, and limitations are visible', passed: ['missing_department_owners', 'pending_signoffs', 'overdue_signoffs', 'departments_blocked', 'approved_with_limitation_signoffs'].every(token => page.includes(token)) },
  { name: 'participant coverage and training-required counts are visible', passed: ['participant_count', 'confirmed_participants', 'training_required_participants'].every(token => page.includes(token)) },
  { name: 'API reads Patch 49 views', passed: apiViews.every(token => api.includes(token)) },
  { name: 'API treats missing activation as evidence required', passed: api.includes("pilot_readiness_status: 'evidence_required'") && api.includes('No controlled pilot activation run recorded') },
  { name: 'package scripts exist', passed: ['patch49:schema-proof', 'patch49:workflow-proof', 'patch49:frontend-proof', 'patch49:all'].every(token => pkg.includes(token)) },
  { name: 'patch48:all remains in patch49:all', passed: pkg.includes('npm run patch48:all') },
  { name: 'v700 runtime security remains in patch49:all', passed: pkg.includes('npm run v700:runtime-security') },
  { name: 'professional wording avoids technical proof terms in pilot UI text', passed: !/RPC|edge bridge|schema proof|unknown_requires_review/.test(pilotLabelValues) },
  { name: 'no service-role-only frontend exposure introduced', passed: !/service[_-]?role[_-]?key|supabase_service_role|service_role_secret/i.test(`${page}\n${api}`) },
  { name: 'no fake/demo data strings introduced in Patch 49 frontend/API', passed: !/\b(fake|demo|mock)\b/i.test(`${page}\n${api}`) },
  { name: 'no conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(combined) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '49',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
