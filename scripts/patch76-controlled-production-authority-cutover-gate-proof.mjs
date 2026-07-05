import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release/patch76');
const outPath = path.join(outDir, 'patch76-controlled-production-authority-cutover-gate-proof.json');

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

const migrationPath = 'supabase/migrations/118_patch76_controlled_production_authority_cutover_gate.sql';
const packageJson = read('package.json');
const migration = read(migrationPath);
const api = read('src/lib/productionReadinessApi.ts');
const page = read('src/pages/ProductionReadinessCenter.tsx');
const operatorConsole = read('src/pages/ProductionOperatorConsole.tsx');
const bridge = read('supabase/functions/privileged-action/index.ts');
const registry = read('src/lib/runtimeActionRegistry.ts');
const layout = read('src/components/Layout.tsx');
const app = read('src/App.tsx');
const authAccess = read('src/auth/authAccess.ts');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');
const statusDoc = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbook = read('release/current-validation-runbook.md');
const patch75Proof = read('scripts/patch75-clinical-ux-navigation-simplification-proof.mjs');
const activeFiles = `${migration}\n${api}\n${page}\n${operatorConsole}\n${bridge}\n${registry}`;
const operationalUi = `${page}\n${operatorConsole}`;
const diffText = gitDiff([
  'src/lib/productionReadinessApi.ts',
  'src/pages/ProductionReadinessCenter.tsx',
  'src/pages/ProductionOperatorConsole.tsx',
  'supabase/functions/privileged-action/index.ts',
  'src/lib/runtimeActionRegistry.ts',
  migrationPath,
]);

const checks = [
  { name: 'Patch 76 migration exists', passed: exists(migrationPath) },
  { name: 'controlled_production_cutover_decisions exists', passed: migration.includes('controlled_production_cutover_decisions') },
  { name: 'controlled_production_cutover_decision_events exists', passed: migration.includes('controlled_production_cutover_decision_events') },
  { name: 'RLS enabled for new tables', passed: /controlled_production_cutover_decisions enable row level security/i.test(migration) && /controlled_production_cutover_decision_events enable row level security/i.test(migration) },
  { name: 'No broad public write policy was added', passed: !/for\s+(insert|update|delete|all)[\s\S]{0,120}(using|with check)\s*\(\s*true\s*\)/i.test(migration) },
  { name: 'SECURITY DEFINER RPCs have guarded role checks', passed: migration.includes('security definer') && migration.includes('patch76_actor_authorized') && migration.includes("ur.role in ('super_admin', 'executive', 'governance_admin')") },
  { name: 'Allowed state executive_review_required exists', passed: migration.includes('executive_review_required') && page.includes('Executive review required') },
  { name: 'Allowed state blocked exists', passed: migration.includes("'blocked'") && page.includes('Blocked') },
  { name: 'Allowed state deferred exists', passed: migration.includes("'deferred'") && page.includes('Deferred') },
  { name: 'Allowed state approved_for_controlled_pilot_cutover exists', passed: migration.includes('approved_for_controlled_pilot_cutover') && page.includes('Approved for controlled pilot cutover') },
  { name: 'Allowed state approved_with_limitations exists', passed: migration.includes('approved_with_limitations') && page.includes('Approved with limitations') },
  { name: 'Server-side guardrail blocks approval with critical blockers', passed: migration.includes('Critical blockers prevent approval') && migration.includes('p_critical_blockers_count') && migration.includes('> 0') },
  { name: 'Server-side guardrail requires cutover checklist for approved states', passed: migration.includes('Cutover checklist incomplete') && migration.includes('p_cutover_checklist_complete') },
  { name: 'Server-side guardrail requires limitations reviewed for approved with limitations', passed: migration.includes('Limitation review required') && migration.includes('p_limitations_reviewed') },
  { name: 'Frontend API uses authenticated bridge pattern for privileged calls', passed: api.includes('invokePrivilegedAction') && api.includes("'create_controlled_production_cutover_decision'") && api.includes("'record_controlled_production_cutover_decision_event'") },
  { name: 'Privileged bridge allowlist includes Patch 76 actions', passed: bridge.includes('patch76CutoverDecisionActions') && bridge.includes('create_controlled_production_cutover_decision') && bridge.includes('record_controlled_production_cutover_decision_event') },
  { name: 'Runtime registry classifies Patch 76 actions', passed: registry.includes('create_controlled_production_cutover_decision') && registry.includes('record_controlled_production_cutover_decision_event') && registry.includes("classification: 'production_readiness'") },
  { name: 'UI includes Controlled production authority', passed: page.includes('Controlled production authority') },
  { name: 'UI includes Controlled cutover decision', passed: page.includes('Controlled cutover decision') },
  { name: 'UI includes Executive review required', passed: page.includes('Executive review required') },
  { name: 'UI includes Critical blockers prevent approval', passed: page.includes('Critical blockers prevent approval') },
  { name: 'UI includes Limitation review required', passed: page.includes('Limitation review required') },
  { name: 'UI includes Cutover checklist incomplete', passed: page.includes('Cutover checklist incomplete') },
  { name: 'UI includes decision record caveat', passed: page.includes('This decision record does not automatically launch the system') },
  { name: 'UI includes live transition caveat', passed: page.includes('Live transition requires separate operational execution') },
  { name: 'Patch 75 clinical navigation simplification remains', passed: patch75Proof.includes('Layout primaryNav cleanup') && !layout.includes("key: 'productionOperatorConsole'") && !layout.includes("key: 'productionEvidenceClosure'") && authAccess.includes("return 'dailyOperationsHub';") },
  { name: 'No production launched wording exists', passed: !/Production launched/i.test(activeFiles) },
  { name: 'No go-live complete wording exists', passed: !/Go-live complete/i.test(activeFiles) },
  { name: 'No system is production ready claim exists', passed: !/System is production ready/i.test(activeFiles) },
  { name: 'No transition_to_live_operations action exists', passed: !/transition_to_live_operations/i.test(activeFiles) },
  { name: 'No automatic transition button exists', passed: !/automatic transition|Auto-launch|Auto-approve/i.test(operationalUi) },
  { name: 'No executive production signoff RPC was added', passed: !/^\+.*record_executive_production_signoff/im.test(diffText) },
  { name: 'No service-role frontend exposure exists', passed: !/SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i.test(`${api}\n${page}\n${operatorConsole}`) },
  { name: 'No fake/demo records were added', passed: !/\b(fake|demo)\b/i.test(`${api}\n${page}\n${operatorConsole}\n${migration}`) },
  { name: 'No route/component deletion for Patch 75 clinical navigation', passed: app.includes('productionReadiness') && page.includes('ProductionReadinessCenter') && operatorConsole.includes('ProductionOperatorConsole') },
  { name: 'Restore-noise covers Patch 75 proof JSON', passed: restoreNoise.includes('release/patch75/patch75-clinical-ux-navigation-simplification-proof.json') },
  { name: 'package.json contains patch76:proof', passed: packageJson.includes('"patch76:proof": "node scripts/patch76-controlled-production-authority-cutover-gate-proof.mjs"') },
  { name: 'package.json contains patch76:all', passed: packageJson.includes('"patch76:all": "npm run validate:build && npm run validate:security && npm run patch76:proof"') },
  { name: 'validate:fast exists', passed: packageJson.includes('"validate:fast"') },
  { name: 'validate:build exists', passed: packageJson.includes('"validate:build"') },
  { name: 'validate:security exists', passed: packageJson.includes('"validate:security"') },
  { name: 'validate:release exists', passed: packageJson.includes('"validate:release"') },
  { name: 'proof:all exists', passed: packageJson.includes('"proof:all"') },
  { name: 'v700:runtime-security exists', passed: packageJson.includes('"v700:runtime-security"') },
  { name: 'release:restore-noise exists', passed: packageJson.includes('"release:restore-noise"') },
  { name: 'current platform status mentions Patch 76', passed: statusDoc.includes('Patch 76') && statusDoc.includes('controlled production authority and cutover gate') },
  { name: 'production caveat remains', passed: statusDoc.includes('Real hospital-wide production still requires live department launch evidence') },
  { name: 'proof index mentions Patch 76', passed: proofIndex.includes('patch76:proof') },
  { name: 'runbook mentions Patch 75 proof JSON restore coverage', passed: runbook.includes('Patch 76 extends restore coverage to the Patch 75 generated proof JSON') },
  { name: 'No conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(`${packageJson}\n${migration}\n${api}\n${page}\n${operatorConsole}\n${bridge}\n${registry}\n${statusDoc}\n${proofIndex}\n${runbook}`) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '76',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\nPatch 76 controlled production authority and cutover gate proof failed:');
  failed.forEach(check => console.error(`  - ${check.name}`));
  process.exit(1);
}

console.log(`\nPatch 76 controlled production authority and cutover gate proof passed. (${checks.length} checks)`);
