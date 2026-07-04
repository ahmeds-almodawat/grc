import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'src/pages/ProductionReadinessCenter.tsx');
const apiPath = path.join(root, 'src/lib/productionReadinessApi.ts');
const packagePath = path.join(root, 'package.json');
const outDir = path.join(root, 'release/patch50');
const outPath = path.join(outDir, 'patch50-frontend-proof.json');
const page = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
const api = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const pkg = fs.existsSync(packagePath) ? fs.readFileSync(packagePath, 'utf8') : '';
const combined = `${page}\n${api}\n${pkg}`;

const uiTokens = [
  'realPilotSetupTitle',
  'setupReadinessStatus',
  'requiredParticipants',
  'participantGaps',
  'trainingGaps',
  'launchBlockers',
  'realPilotLaunchBlockersTitle',
  'realPilotChecklistTitle',
  'realPilotExceptionsTitle',
  'realPilotParticipantGapsTitle',
  'realPilotTrainingGapsTitle',
];

const apiViews = [
  'v_patch50_production_readiness_real_pilot_setup_overlay',
  'v_patch50_real_pilot_launch_blocker_register',
  'v_patch50_department_setup_checklist_register',
  'v_patch50_pilot_participant_setup_gap_register',
  'v_patch50_pilot_training_gap_register',
  'v_patch50_real_pilot_master_data_exception_register',
];

const pilotLabelValues = uiTokens
  .flatMap(token => [...page.matchAll(new RegExp(`${token}:\\s*'([^']*)'`, 'g'))].map(match => match[1]))
  .join('\n');

const checks = [
  { name: 'ProductionReadinessCenter displays Real Pilot Setup overlay', passed: uiTokens.every(token => page.includes(token)) },
  { name: 'missing owners, participant gaps, training gaps, signoffs, exceptions, and blockers are visible', passed: ['departments_missing_owners', 'participant_gap_count', 'training_gap_count', 'pending_signoffs', 'overdue_signoffs', 'missing_signoff_owners', 'open_exception_count', 'launch_blocker_count'].every(token => page.includes(token)) },
  { name: 'API reads Patch 50 views', passed: apiViews.every(token => api.includes(token)) },
  { name: 'API treats missing setup as evidence required', passed: api.includes("setup_readiness_status: 'evidence_required'") && api.includes('Complete real department, owner, participant, role, training, and signoff setup before pilot launch') },
  { name: 'package scripts exist', passed: ['patch50:schema-proof', 'patch50:workflow-proof', 'patch50:frontend-proof', 'patch50:all'].every(token => pkg.includes(token)) },
  { name: 'patch49:all remains in patch50:all', passed: pkg.includes('npm run patch49:all') },
  { name: 'v700 runtime security remains in patch50:all', passed: pkg.includes('npm run v700:runtime-security') },
  { name: 'professional wording avoids technical terms in real pilot UI labels', passed: !/RPC|edge bridge|schema proof|migration|patch number|unknown_requires_review/i.test(pilotLabelValues) },
  { name: 'no service-role-only frontend exposure introduced', passed: !/service[_-]?role[_-]?key|supabase_service_role|service_role_secret/i.test(`${page}\n${api}`) },
  { name: 'no fake/demo data strings introduced in Patch 50 frontend/API', passed: !/\b(fake|demo|mock)\b/i.test(`${page}\n${api}`) },
  { name: 'no conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(combined) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '50',
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
