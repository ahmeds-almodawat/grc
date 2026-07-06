import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release/patch79');
const outPath = path.join(outDir, 'patch79-production-operations-hypercare-board-pack-proof.json');

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

const migrationPath = 'supabase/migrations/121_patch79_production_operations_hypercare_board_pack.sql';
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
const activePatchFiles = `${migration}\n${api}\n${page}\n${operatorConsole}\n${bridge}\n${registry}`;
const frontendFiles = `${api}\n${page}\n${operatorConsole}`;
const diffText = gitDiff([
  'package.json',
  'src/lib/productionReadinessApi.ts',
  'src/lib/runtimeActionRegistry.ts',
  'src/pages/ProductionReadinessCenter.tsx',
  'src/pages/ProductionOperatorConsole.tsx',
  'supabase/functions/privileged-action/index.ts',
  'scripts/restore-generated-release-noise.mjs',
  migrationPath,
]);

const actions = [
  'create_production_hypercare_window',
  'update_production_hypercare_window_status',
  'record_production_hypercare_item',
  'update_production_hypercare_item_status',
  'create_executive_governance_board_pack',
  'update_executive_governance_board_pack_status',
];

const itemTypes = [
  'support_issue',
  'incident_trend',
  'department_launch_health',
  'known_limitation',
  'corrective_action',
  'evidence_pack_gap',
  'board_pack_gap',
  'training_gap',
  'dr_restore_gap',
  'access_review_gap',
];

const checks = [
  { name: 'Patch 79 migration exists', passed: exists(migrationPath) },
  { name: 'production_hypercare_windows exists', passed: migration.includes('production_hypercare_windows') },
  { name: 'production_hypercare_items exists', passed: migration.includes('production_hypercare_items') },
  { name: 'executive_governance_board_packs exists', passed: migration.includes('executive_governance_board_packs') },
  { name: 'RLS enabled for new tables', passed: /production_hypercare_windows enable row level security/i.test(migration) && /production_hypercare_items enable row level security/i.test(migration) && /executive_governance_board_packs enable row level security/i.test(migration) },
  { name: 'No broad public write policy was added', passed: !/for\s+(insert|update|delete|all)[\s\S]{0,180}(using|with check)\s*\(\s*true\s*\)/i.test(migration) },
  { name: 'Guarded role checks exist for privileged writes', passed: migration.includes('patch79_actor_authorized') && migration.includes("'super_admin'") && migration.includes("'executive'") && migration.includes("'governance_admin'") && migration.includes("'auditor'") && migration.includes("'compliance_officer'") },
  { name: 'Allowed hypercare statuses exist', passed: ['planned', 'active', 'monitoring', 'exit_review_required', 'blocked', 'deferred', 'closed_with_limitations'].every(value => migration.includes(`'${value}'`)) },
  { name: 'Allowed hypercare item types exist', passed: itemTypes.every(value => migration.includes(`'${value}'`)) },
  { name: 'Allowed board pack statuses exist', passed: ['draft', 'review_required', 'ready_for_board_review', 'accepted_with_limitations', 'blocked', 'deferred'].every(value => migration.includes(`'${value}'`)) },
  { name: 'Critical incidents block hypercare exit review', passed: migration.includes('Critical incidents block hypercare exit review') && migration.includes('critical_incident_count') },
  { name: 'Open support issues block hypercare exit review unless limitations accepted', passed: migration.includes('Open support issues block hypercare exit review unless limitations are accepted') && migration.includes('open_support_issue_count') },
  { name: 'Incomplete/blocked evidence pack blocks hypercare exit review', passed: migration.includes('Incomplete or blocked evidence pack blocks hypercare exit review') && migration.includes('evidence_pack_status') },
  { name: 'Board pack draft/blocked blocks hypercare exit review', passed: migration.includes('Board pack draft or blocked status blocks hypercare exit review') && migration.includes('board_pack_status') },
  { name: 'High/critical items cannot close without closure summary', passed: migration.includes('patch79_high_critical_closure_guard') && migration.includes('High/critical hypercare governance items cannot close without closure summary') },
  { name: 'Evidence gaps cannot close without evidence summary', passed: migration.includes('patch79_evidence_gap_closure_guard') && migration.includes('Evidence pack gaps cannot close without evidence summary') },
  { name: 'Board pack ready_for_board_review requires blocker checks', passed: migration.includes('High/critical open items block board pack ready for board review') && migration.includes('ready_for_board_review') },
  { name: 'Frontend API uses authenticated bridge pattern for privileged calls', passed: actions.every(action => api.includes(`'${action}'`)) && api.includes('invokePrivilegedAction') },
  { name: 'Privileged bridge allowlist includes Patch 79 actions', passed: bridge.includes('patch79OperationsGovernanceActions') && actions.every(action => bridge.includes(action)) },
  { name: 'Runtime registry classifies Patch 79 actions', passed: actions.every(action => registry.includes(action)) && registry.includes("moduleName: 'Production Operations Governance'") },
  { name: 'UI includes Production operations governance', passed: page.includes('Production Operations Governance') },
  { name: 'UI includes Hypercare command center', passed: page.includes('Hypercare command center') },
  { name: 'UI includes 30/60/90 operating view', passed: page.includes('30/60/90 operating view') },
  { name: 'UI includes Support and incident trend summary', passed: page.includes('Support and incident trend summary') },
  { name: 'UI includes Department launch health', passed: page.includes('Department launch health') },
  { name: 'UI includes Known limitations register', passed: page.includes('Known limitations register') },
  { name: 'UI includes Post-cutover corrective action queue', passed: page.includes('Post-cutover corrective action queue') },
  { name: 'UI includes Executive monthly governance report', passed: page.includes('Executive monthly governance report') },
  { name: 'UI includes Accreditation/evidence pack tracking', passed: page.includes('Accreditation/evidence pack tracking') },
  { name: 'UI includes Board closure pack', passed: page.includes('Board closure pack') },
  { name: 'UI includes board closure caveat', passed: page.includes('Board closure does not approve production launch') },
  { name: 'UI includes controlled authority caveat', passed: page.includes('Controlled production authority remains separate') },
  { name: 'UI includes live transition caveat', passed: page.includes('Live transition requires separate operational execution') },
  { name: 'UI includes real execution caveat', passed: page.includes('Real hospital execution evidence is still required') },
  { name: 'Patch 78 identity/role/data integrity wording remains', passed: page.includes('Identity, Role, and Data Integrity') && page.includes('Access integrity review') },
  { name: 'Patch 77 live pilot execution wording remains', passed: page.includes('Live Pilot Execution and Issue Burn-Down') && page.includes('Pilot issue burn-down') },
  { name: 'Patch 76 controlled production authority wording remains', passed: page.includes('Controlled production authority') && page.includes('Controlled cutover decision') },
  { name: 'Patch 75 clinical navigation simplification remains', passed: patch75Proof.includes('Layout primaryNav cleanup') && !layout.includes("key: 'productionOperatorConsole'") && !layout.includes("key: 'productionEvidenceClosure'") && authAccess.includes("return 'dailyOperationsHub';") },
  { name: 'No production launched wording exists', passed: !/Production launched/i.test(activePatchFiles) },
  { name: 'No go-live complete wording exists', passed: !/Go-live complete/i.test(activePatchFiles) },
  { name: 'No system is production ready claim exists', passed: !/System is production ready/i.test(activePatchFiles) },
  { name: 'No full production achieved claim exists', passed: !/Full production achieved/i.test(activePatchFiles) },
  { name: 'No transition_to_live_operations action exists', passed: !/transition_to_live_operations/i.test(activePatchFiles) },
  { name: 'No forbidden automatic closure wording exists', passed: !/Live operations authorized automatically|Final launch complete|Auto-launch|Auto-approve|Auto-close hypercare|Auto-close board pack/i.test(activePatchFiles) },
  { name: 'No service-role frontend exposure exists', passed: !/SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i.test(frontendFiles) },
  { name: 'No fake/demo records were added', passed: !/\b(fake|demo)\b/i.test(activePatchFiles) },
  { name: 'Patch does not add automatic launch/transition logic', passed: !/^\+.*(transition_to_live_operations|production_launch|auto_launch)/im.test(diffText) },
  { name: 'Restore-noise covers Patch 78 proof JSON', passed: restoreNoise.includes('release/patch78/patch78-identity-role-data-integrity-hardening-proof.json') },
  { name: 'package.json contains patch79:proof', passed: packageJson.includes('"patch79:proof": "node scripts/patch79-production-operations-hypercare-board-pack-proof.mjs"') },
  { name: 'package.json contains patch79:all', passed: packageJson.includes('"patch79:all": "npm run validate:build && npm run validate:security && npm run patch79:proof"') },
  { name: 'validate:fast exists', passed: packageJson.includes('"validate:fast"') },
  { name: 'validate:build exists', passed: packageJson.includes('"validate:build"') },
  { name: 'validate:security exists', passed: packageJson.includes('"validate:security"') },
  { name: 'validate:release exists', passed: packageJson.includes('"validate:release"') },
  { name: 'proof:all exists', passed: packageJson.includes('"proof:all"') },
  { name: 'v700:runtime-security exists', passed: packageJson.includes('"v700:runtime-security"') },
  { name: 'release:restore-noise exists', passed: packageJson.includes('"release:restore-noise"') },
  { name: 'current platform status mentions Patch 79', passed: statusDoc.includes('Patch 79') && statusDoc.includes('production operations governance') },
  { name: 'production caveat remains', passed: statusDoc.includes('Real hospital-wide production still requires live department launch evidence') },
  { name: 'proof index mentions Patch 79', passed: proofIndex.includes('patch79:proof') },
  { name: 'runbook mentions Patch 78 proof JSON restore coverage', passed: runbook.includes('Patch 79 extends restore coverage to the Patch 78 generated proof JSON') },
  { name: 'No conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(`${packageJson}\n${migration}\n${api}\n${page}\n${operatorConsole}\n${bridge}\n${registry}\n${restoreNoise}\n${statusDoc}\n${proofIndex}\n${runbook}`) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '79',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\nPatch 79 production operations, hypercare, and board pack proof failed:');
  failed.forEach(check => console.error(`  - ${check.name}`));
  process.exit(1);
}

console.log(`\nPatch 79 production operations, hypercare, and board pack proof passed. (${checks.length} checks)`);
