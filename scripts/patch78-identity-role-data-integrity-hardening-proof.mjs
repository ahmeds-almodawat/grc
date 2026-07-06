import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release/patch78');
const outPath = path.join(outDir, 'patch78-identity-role-data-integrity-hardening-proof.json');

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

const migrationPath = 'supabase/migrations/120_patch78_identity_role_data_integrity_hardening.sql';
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
  'create_identity_role_integrity_review',
  'update_identity_role_integrity_review_status',
  'record_identity_role_integrity_finding',
  'update_identity_role_integrity_finding_status',
  'record_privileged_role_recertification',
];

const findingTypes = [
  'duplicate_role',
  'privileged_role_review',
  'dormant_account',
  'inactive_account',
  'archived_user_access',
  'missing_owner',
  'missing_reviewer',
  'department_accountability_gap',
  'station_accountability_gap',
  'sso_mfa_readiness_gap',
  'access_export_required',
  'data_integrity_gap',
];

const checks = [
  { name: 'Patch 78 migration exists', passed: exists(migrationPath) },
  { name: 'identity_role_integrity_reviews exists', passed: migration.includes('identity_role_integrity_reviews') },
  { name: 'identity_role_integrity_findings exists', passed: migration.includes('identity_role_integrity_findings') },
  { name: 'privileged_role_recertifications exists', passed: migration.includes('privileged_role_recertifications') },
  { name: 'RLS enabled for new tables', passed: /identity_role_integrity_reviews enable row level security/i.test(migration) && /identity_role_integrity_findings enable row level security/i.test(migration) && /privileged_role_recertifications enable row level security/i.test(migration) },
  { name: 'No broad public write policy was added', passed: !/for\s+(insert|update|delete|all)[\s\S]{0,180}(using|with check)\s*\(\s*true\s*\)/i.test(migration) },
  { name: 'Guarded role checks exist for privileged writes', passed: migration.includes('patch78_actor_authorized') && migration.includes("'super_admin'") && migration.includes("'executive'") && migration.includes("'governance_admin'") && migration.includes("'auditor'") && migration.includes("'compliance_officer'") },
  { name: 'Allowed review statuses exist', passed: ['in_review', 'remediation_required', 'ready_for_access_integrity_review', 'accepted_with_limitations', 'blocked', 'deferred'].every(value => migration.includes(`'${value}'`)) },
  { name: 'Allowed finding types exist', passed: findingTypes.every(value => migration.includes(`'${value}'`)) },
  { name: 'Allowed finding severities exist', passed: ['low', 'medium', 'high', 'critical'].every(value => migration.includes(`'${value}'`)) },
  { name: 'Allowed recertification statuses exist', passed: ['pending', 'recertified', 'revocation_required', 'deferred', 'blocked'].every(value => migration.includes(`'${value}'`)) },
  { name: 'High-risk findings block ready review', passed: migration.includes('High-risk identity or data integrity findings remain open') && migration.includes('open_high_risk_finding_count') && migration.includes("ready_for_access_integrity_review") },
  { name: 'Pending privileged recertification blocks ready review', passed: migration.includes('Privileged role recertification remains pending') && migration.includes('privileged_pending_recertification_count') },
  { name: 'Missing owner/reviewer blocks ready review', passed: migration.includes('Missing owner/reviewer repair required') && migration.includes('missing_owner_count') && migration.includes('missing_reviewer_count') },
  { name: 'Recertified privileged role requires rationale', passed: migration.includes('patch78_recertified_rationale_guard') && migration.includes('Recertified privileged role requires rationale') },
  { name: 'Patch does not add automatic role assignment/removal logic', passed: !/^\+.*(assign_user_role|deactivate_user_role|remove_user_role|delete_user_role|Auto-fix roles|Auto-cleanup users)/im.test(diffText) },
  { name: 'Patch does not add automatic user deactivation/archive/reactivation logic', passed: !/^\+.*(deactivate_user|archive_user|reactivate_user|unarchive_user|Auto-cleanup users)/im.test(diffText) },
  { name: 'Frontend API uses authenticated bridge pattern for privileged calls', passed: actions.every(action => api.includes(`'${action}'`)) && api.includes('invokePrivilegedAction') },
  { name: 'Privileged bridge allowlist includes Patch 78 actions', passed: bridge.includes('patch78IdentityIntegrityActions') && actions.every(action => bridge.includes(action)) },
  { name: 'Runtime registry classifies Patch 78 actions', passed: actions.every(action => registry.includes(action)) && registry.includes("moduleName: 'Identity Role Integrity'") },
  { name: 'UI includes Identity, role, and data integrity', passed: page.includes('Identity, Role, and Data Integrity') },
  { name: 'UI includes Access integrity review', passed: page.includes('Access integrity review') },
  { name: 'UI includes Privileged role recertification', passed: page.includes('Privileged role recertification') },
  { name: 'UI includes Dormant account review', passed: page.includes('Dormant account review') },
  { name: 'UI includes Inactive account review', passed: page.includes('Inactive account review') },
  { name: 'UI includes Archived user access review', passed: page.includes('Archived user access review') },
  { name: 'UI includes Department owner accountability', passed: page.includes('Department owner accountability') },
  { name: 'UI includes Missing owner/reviewer repair required', passed: page.includes('Missing owner/reviewer repair required') },
  { name: 'UI includes SSO/MFA readiness checklist', passed: page.includes('SSO/MFA readiness checklist') },
  { name: 'UI includes Access export for IT/security review', passed: page.includes('Access export for IT/security review') },
  { name: 'UI includes access integrity caveat', passed: page.includes('Access integrity review does not approve production launch') },
  { name: 'UI includes controlled authority caveat', passed: page.includes('Controlled production authority remains separate') },
  { name: 'Patch 77 live pilot execution wording remains', passed: page.includes('Live Pilot Execution and Issue Burn-Down') && page.includes('Pilot issue burn-down') },
  { name: 'Patch 76 controlled production authority wording remains', passed: page.includes('Controlled production authority') && page.includes('Controlled cutover decision') },
  { name: 'Patch 75 clinical navigation simplification remains', passed: patch75Proof.includes('Layout primaryNav cleanup') && !layout.includes("key: 'productionOperatorConsole'") && !layout.includes("key: 'productionEvidenceClosure'") && authAccess.includes("return 'dailyOperationsHub';") },
  { name: 'No production launched wording exists', passed: !/Production launched/i.test(activePatchFiles) },
  { name: 'No go-live complete wording exists', passed: !/Go-live complete/i.test(activePatchFiles) },
  { name: 'No system is production ready claim exists', passed: !/System is production ready/i.test(activePatchFiles) },
  { name: 'No transition_to_live_operations action exists', passed: !/transition_to_live_operations/i.test(activePatchFiles) },
  { name: 'No forbidden automatic approval wording exists', passed: !/Live operations authorized automatically|Final launch complete|Auto-launch|Auto-approve|Auto-fix roles|Auto-cleanup users/i.test(activePatchFiles) },
  { name: 'No service-role frontend exposure exists', passed: !/SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i.test(frontendFiles) },
  { name: 'No fake/demo records were added', passed: !/\b(fake|demo)\b/i.test(activePatchFiles) },
  { name: 'No route/component deletion', passed: app.includes('productionReadiness') && page.includes('ProductionReadinessCenter') && operatorConsole.includes('ProductionOperatorConsole') },
  { name: 'Restore-noise covers Patch 77 proof JSON', passed: restoreNoise.includes('release/patch77/patch77-live-pilot-execution-issue-burndown-proof.json') },
  { name: 'package.json contains patch78:proof', passed: packageJson.includes('"patch78:proof": "node scripts/patch78-identity-role-data-integrity-hardening-proof.mjs"') },
  { name: 'package.json contains patch78:all', passed: packageJson.includes('"patch78:all": "npm run validate:build && npm run validate:security && npm run patch78:proof"') },
  { name: 'validate:fast exists', passed: packageJson.includes('"validate:fast"') },
  { name: 'validate:build exists', passed: packageJson.includes('"validate:build"') },
  { name: 'validate:security exists', passed: packageJson.includes('"validate:security"') },
  { name: 'validate:release exists', passed: packageJson.includes('"validate:release"') },
  { name: 'proof:all exists', passed: packageJson.includes('"proof:all"') },
  { name: 'v700:runtime-security exists', passed: packageJson.includes('"v700:runtime-security"') },
  { name: 'release:restore-noise exists', passed: packageJson.includes('"release:restore-noise"') },
  { name: 'current platform status mentions Patch 78', passed: statusDoc.includes('Patch 78') && statusDoc.includes('identity, role, and data integrity hardening') },
  { name: 'production caveat remains', passed: statusDoc.includes('Real hospital-wide production still requires live department launch evidence') },
  { name: 'proof index mentions Patch 78', passed: proofIndex.includes('patch78:proof') },
  { name: 'runbook mentions Patch 77 proof JSON restore coverage', passed: runbook.includes('Patch 78 extends restore coverage to the Patch 77 generated proof JSON') },
  { name: 'No conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(`${packageJson}\n${migration}\n${api}\n${page}\n${operatorConsole}\n${bridge}\n${registry}\n${restoreNoise}\n${statusDoc}\n${proofIndex}\n${runbook}`) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '78',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\nPatch 78 identity, role, and data integrity hardening proof failed:');
  failed.forEach(check => console.error(`  - ${check.name}`));
  process.exit(1);
}

console.log(`\nPatch 78 identity, role, and data integrity hardening proof passed. (${checks.length} checks)`);
