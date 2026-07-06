import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release/patch77');
const outPath = path.join(outDir, 'patch77-live-pilot-execution-issue-burndown-proof.json');

function read(relPath) {
  const fullPath = path.join(root, relPath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function gitDiff(paths) {
  try {
    return execSync(`git diff -- ${paths.join(' ')}`, { cwd: root, encoding: 'utf8' });
  } catch {
    return '';
  }
}

const migrationPath = 'supabase/migrations/119_patch77_live_pilot_execution_issue_burndown.sql';
const packageJson = read('package.json');
const migration = read(migrationPath);
const api = read('src/lib/productionReadinessApi.ts');
const page = read('src/pages/ProductionReadinessCenter.tsx');
const operatorConsole = read('src/pages/ProductionOperatorConsole.tsx');
const bridge = read('supabase/functions/privileged-action/index.ts');
const registry = read('src/lib/runtimeActionRegistry.ts');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');
const statusDoc = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbook = read('release/current-validation-runbook.md');
const patch75Proof = read('scripts/patch75-clinical-ux-navigation-simplification-proof.mjs');
const layout = read('src/components/Layout.tsx');
const authAccess = read('src/auth/authAccess.ts');
const app = read('src/App.tsx');
const activeFiles = `${migration}\n${api}\n${page}\n${operatorConsole}\n${bridge}\n${registry}`;
const operationalUi = `${page}\n${operatorConsole}`;
const diffText = gitDiff([
  'package.json',
  'src/lib/productionReadinessApi.ts',
  'src/pages/ProductionReadinessCenter.tsx',
  'src/pages/ProductionOperatorConsole.tsx',
  'supabase/functions/privileged-action/index.ts',
  'src/lib/runtimeActionRegistry.ts',
  'scripts/restore-generated-release-noise.mjs',
  migrationPath,
]);

const patch77Actions = [
  'create_live_pilot_session',
  'update_live_pilot_session_status',
  'create_live_pilot_issue',
  'update_live_pilot_issue_status',
  'record_live_pilot_department_acceptance',
];

const checks = [
  { name: 'Patch 77 migration exists', passed: exists(migrationPath) },
  { name: 'live_pilot_sessions table exists', passed: migration.includes('live_pilot_sessions') },
  { name: 'live_pilot_issues table exists', passed: migration.includes('live_pilot_issues') },
  { name: 'live_pilot_department_acceptances table exists', passed: migration.includes('live_pilot_department_acceptances') },
  { name: 'RLS enabled for Patch 77 tables', passed: /live_pilot_sessions enable row level security/i.test(migration) && /live_pilot_issues enable row level security/i.test(migration) && /live_pilot_department_acceptances enable row level security/i.test(migration) },
  { name: 'No broad public write policy was added', passed: !/for\s+(insert|update|delete|all)[\s\S]{0,160}(using|with check)\s*\(\s*true\s*\)/i.test(migration) },
  { name: 'Guarded role checks exist', passed: migration.includes('patch77_actor_authorized') && migration.includes("'super_admin'") && migration.includes("'executive'") && migration.includes("'governance_admin'") && migration.includes("'department_manager'") },
  { name: 'Allowed session states exist', passed: ['planned', 'active', 'issue_burndown', 'exit_review_required', 'accepted', 'blocked', 'deferred'].every(value => migration.includes(`'${value}'`)) },
  { name: 'Allowed issue severities exist', passed: ['low', 'medium', 'high', 'critical'].every(value => migration.includes(`'${value}'`)) },
  { name: 'Allowed issue statuses exist', passed: ['open', 'in_progress', 'retest_required', 'closed', 'deferred', 'accepted_limitation'].every(value => migration.includes(`'${value}'`)) },
  { name: 'Retest closure guard exists', passed: migration.includes('patch77_retest_closure_guard') && migration.includes('Retest evidence required') && migration.includes("retest_status in ('passed', 'not_required')") },
  { name: 'Session acceptance guard exists', passed: migration.includes('patch77_session_acceptance_guard') && migration.includes('Pilot blockers remain') && migration.includes('Pilot exit criteria must be met') },
  { name: 'Department acceptance guard exists', passed: migration.includes('patch77_department_acceptance_guard') && migration.includes('training and issue burn-down confirmation') },
  { name: 'Frontend API has Patch 77 read helpers', passed: api.includes('getLivePilotSessions') && api.includes('getLivePilotIssues') && api.includes('getLivePilotDepartmentAcceptances') },
  { name: 'Frontend API has Patch 77 summary helpers', passed: api.includes('getLivePilotIssueBurndownSummary') && api.includes('getLivePilotExitReadinessSummary') },
  { name: 'Frontend API uses authenticated bridge pattern for privileged calls', passed: patch77Actions.every(action => api.includes(`'${action}'`)) && api.includes('invokePrivilegedAction') },
  { name: 'Privileged bridge allowlist includes Patch 77 actions', passed: bridge.includes('patch77LivePilotActions') && patch77Actions.every(action => bridge.includes(action)) },
  { name: 'Runtime registry classifies Patch 77 actions', passed: patch77Actions.every(action => registry.includes(action)) && registry.includes("moduleName: 'Live Pilot Execution'") && registry.includes("classification: 'production_readiness'") },
  { name: 'UI includes Live pilot execution', passed: page.includes('Live pilot execution') },
  { name: 'UI includes Pilot issue burn-down', passed: page.includes('Pilot issue burn-down') },
  { name: 'UI includes Department pilot participation', passed: page.includes('Department pilot participation') },
  { name: 'UI includes Retest evidence required', passed: page.includes('Retest evidence required') },
  { name: 'UI includes Department pilot acceptance', passed: page.includes('Department pilot acceptance') },
  { name: 'UI includes Pilot exit criteria', passed: page.includes('Pilot exit criteria') },
  { name: 'UI includes Pilot exit review required', passed: page.includes('Pilot exit review required') },
  { name: 'UI includes Pilot blockers remain', passed: page.includes('Pilot blockers remain') },
  { name: 'UI includes Ready for pilot exit review', passed: page.includes('Ready for pilot exit review') },
  { name: 'UI includes pilot readiness caveat', passed: page.includes('Pilot readiness does not approve production launch') },
  { name: 'UI includes controlled authority caveat', passed: page.includes('Controlled production authority remains separate') },
  { name: 'Operator console mentions pilot issue burn-down', passed: operatorConsole.includes('pilot issue burn-down') },
  { name: 'Patch 76 controlled production authority remains', passed: page.includes('Controlled production authority') && page.includes('Controlled cutover decision') && page.includes('This decision record does not automatically launch the system') },
  { name: 'Patch 75 clinical navigation simplification remains', passed: patch75Proof.includes('Layout primaryNav cleanup') && !layout.includes("key: 'productionOperatorConsole'") && !layout.includes("key: 'productionEvidenceClosure'") && authAccess.includes("return 'dailyOperationsHub';") },
  { name: 'No production launched wording exists', passed: !/Production launched/i.test(activeFiles) },
  { name: 'No go-live complete wording exists', passed: !/Go-live complete/i.test(activeFiles) },
  { name: 'No system is production ready claim exists', passed: !/System is production ready/i.test(activeFiles) },
  { name: 'No transition_to_live_operations action exists', passed: !/transition_to_live_operations/i.test(activeFiles) },
  { name: 'No automatic launch or approval wording exists', passed: !/Live operations authorized automatically|Final launch complete|Auto-launch|Auto-approve/i.test(operationalUi) },
  { name: 'No executive production signoff RPC was added', passed: !/^\+.*record_executive_production_signoff/im.test(diffText) },
  { name: 'No service-role frontend exposure exists', passed: !/SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i.test(`${api}\n${page}\n${operatorConsole}`) },
  { name: 'No fake/demo records were added', passed: !/\b(fake|demo)\b/i.test(`${api}\n${page}\n${operatorConsole}\n${migration}`) },
  { name: 'No route/component deletion for production surfaces', passed: app.includes('productionReadiness') && page.includes('ProductionReadinessCenter') && operatorConsole.includes('ProductionOperatorConsole') },
  { name: 'Restore-noise covers Patch 76 proof JSON', passed: restoreNoise.includes('release/patch76/patch76-controlled-production-authority-cutover-gate-proof.json') },
  { name: 'package.json contains patch77:proof', passed: packageJson.includes('"patch77:proof": "node scripts/patch77-live-pilot-execution-issue-burndown-proof.mjs"') },
  { name: 'package.json contains patch77:all', passed: packageJson.includes('"patch77:all": "npm run validate:build && npm run validate:security && npm run patch77:proof"') },
  { name: 'validate:fast exists', passed: packageJson.includes('"validate:fast"') },
  { name: 'validate:build exists', passed: packageJson.includes('"validate:build"') },
  { name: 'validate:security exists', passed: packageJson.includes('"validate:security"') },
  { name: 'validate:release exists', passed: packageJson.includes('"validate:release"') },
  { name: 'proof:all exists', passed: packageJson.includes('"proof:all"') },
  { name: 'v700:runtime-security exists', passed: packageJson.includes('"v700:runtime-security"') },
  { name: 'release:restore-noise exists', passed: packageJson.includes('"release:restore-noise"') },
  { name: 'current platform status mentions Patch 77', passed: statusDoc.includes('Patch 77') && statusDoc.includes('live pilot execution and issue burn-down') },
  { name: 'production caveat remains', passed: statusDoc.includes('Real hospital-wide production still requires live department launch evidence') },
  { name: 'proof index mentions Patch 77', passed: proofIndex.includes('patch77:proof') },
  { name: 'runbook mentions Patch 76 proof JSON restore coverage', passed: runbook.includes('Patch 77 extends restore coverage to the Patch 76 generated proof JSON') },
  { name: 'No conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(`${packageJson}\n${migration}\n${api}\n${page}\n${operatorConsole}\n${bridge}\n${registry}\n${restoreNoise}\n${statusDoc}\n${proofIndex}\n${runbook}`) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '77',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\nPatch 77 live pilot execution and issue burn-down proof failed:');
  failed.forEach(check => console.error(`  - ${check.name}`));
  process.exit(1);
}

console.log(`\nPatch 77 live pilot execution and issue burn-down proof passed. (${checks.length} checks)`);
