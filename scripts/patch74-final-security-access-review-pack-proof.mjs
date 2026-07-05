import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release/patch74');
const outPath = path.join(outDir, 'patch74-final-security-access-review-pack-proof.json');

function read(relPath) {
  const fullPath = path.join(root, relPath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

const packageJson = read('package.json');
const api = read('src/lib/productionEvidenceClosureApi.ts');
const page = read('src/pages/ProductionEvidenceClosureCenter.tsx');
const operatorConsole = read('src/pages/ProductionOperatorConsole.tsx');
const app = read('src/App.tsx');
const statusDoc = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbook = read('release/current-validation-runbook.md');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');

const operationalUi = `${page}\n${operatorConsole}`;
const activeFiles = `${api}\n${page}\n${operatorConsole}`;
const bannedOperationalTerms = [
  /\bpatch\b/i,
  /\bproof\b/i,
  /\bRPC\b/,
  /\bschema\b/i,
  /\bmigration\b/i,
  /\bscaffold\b/i,
  /\bmock\b/i,
  /\bdemo\b/i,
  /\bfake\b/i,
  /unknown_requires_review/i,
];

const checks = [
  { name: 'No Patch 74 migration exists', passed: !exists('supabase/migrations/118_patch74_final_security_access_review_pack.sql') },
  { name: 'Patch 74 final security review helper exists', passed: api.includes('getFinalSecurityAccessReviewPack') && api.includes('getSecurityReviewState') },
  { name: 'Patch 74 access review helper exists', passed: api.includes('getAccessReviewState') && api.includes('getFinalAccessRequiredActions') },
  { name: 'Privileged access review helper exists', passed: api.includes('getPrivilegedAccessReviewSummary') },
  { name: 'Dormant/inactive account helper exists', passed: api.includes('getDormantInactiveAccountSummary') },
  { name: 'Archived user access helper exists', passed: api.includes('getArchivedUserAccessSummary') },
  { name: 'RLS bridge security helper exists', passed: api.includes('getRlsBridgeSecuritySummary') },
  { name: 'Department station access accountability helper exists', passed: api.includes('getDepartmentStationAccessAccountabilitySummary') },
  { name: 'Final security required actions helper exists', passed: api.includes('getFinalSecurityRequiredActions') },
  { name: 'Final access required actions helper exists', passed: api.includes('getFinalAccessRequiredActions') },
  { name: 'Final security and access review wording exists', passed: page.includes('Final Security and Access Review Pack') && page.includes('Final security and access review.') },
  { name: 'Safe state exists: Security review blocked', passed: api.includes('Security review blocked') && page.includes('Security review blocked') },
  { name: 'Safe state exists: Access review blocked', passed: api.includes('Access review blocked') && page.includes('Access review blocked') },
  { name: 'Safe state exists: Privileged access review required', passed: api.includes('Privileged access review required') && page.includes('Privileged access review required') },
  { name: 'Safe state exists: Account cleanup required', passed: api.includes('Account cleanup required') && page.includes('Account cleanup required') },
  { name: 'Safe state exists: Ready for final security review', passed: api.includes('Ready for final security review') && page.includes('Ready for final security review') },
  { name: 'Required actions before final security review wording exists', passed: page.includes('Required actions before final security review') },
  { name: 'Dormant or inactive accounts require review wording exists', passed: page.includes('Dormant or inactive accounts require review') && api.includes('Dormant or inactive accounts require review') },
  { name: 'Archived user access requires review wording exists', passed: page.includes('Archived user access requires review') && api.includes('Archived user access requires review') },
  { name: 'Security and access caveat exists', passed: page.includes('Security and access review does not approve production launch.') && api.includes('Security and access review does not approve production launch.') },
  { name: 'Production launch separate authority wording exists', passed: page.includes('Production launch requires separate executive authority.') && api.includes('Production launch requires separate executive authority.') },
  { name: 'Patch 69 executive decision pack wording remains', passed: page.includes('Executive go/no-go decision pack.') && api.includes('getExecutiveGoNoGoDecisionPack') },
  { name: 'Patch 70 department launch final readiness wording remains', passed: page.includes('Department launch final readiness.') && api.includes('getDepartmentLaunchFinalReadinessWorkflow') },
  { name: 'Patch 71 live data quality and role integrity wording remains', passed: page.includes('Live data quality and role integrity.') && api.includes('getLiveDataQualityRoleIntegrityReadiness') },
  { name: 'Patch 72 UAT pack and hospital pilot acceptance wording remains', passed: page.includes('UAT pack and hospital pilot acceptance.') && api.includes('getUatPackHospitalPilotAcceptanceReadiness') },
  { name: 'Patch 73 live support and incident readiness wording remains', passed: page.includes('Live support and incident readiness.') && api.includes('getLiveSupportIncidentReadiness') },
  { name: 'No production launch action added', passed: !/Authorize Production Launch|Launch production now|Start production launch|Complete production launch|Final production approval/i.test(operationalUi) },
  { name: 'No transition_to_live_operations wording/action exists', passed: !/transition_to_live_operations/i.test(activeFiles) },
  { name: 'No Authorize Production Launch wording exists', passed: !/Authorize Production Launch/i.test(activeFiles) },
  { name: 'No executive production signoff RPC added', passed: !/executive[_A-Za-z]*production[_A-Za-z]*signoff|recordExecutiveProductionSignoff/i.test(activeFiles) },
  { name: 'No production-ready claim added', passed: !/Production ready|production-ready/i.test(operationalUi) },
  { name: 'No browser service-role exposure exists', passed: !/service_role|SUPABASE_SERVICE_ROLE/i.test(activeFiles) },
  { name: '/production-evidence-closure still exists', passed: app.includes("'/production-evidence-closure': 'productionEvidenceClosure'") },
  { name: 'Production Evidence Closure page exists', passed: exists('src/pages/ProductionEvidenceClosureCenter.tsx') },
  { name: 'Production Readiness Center link remains', passed: page.includes('Production Readiness Center') },
  { name: 'Production Operator Console link remains', passed: page.includes('Production Operator Console') },
  { name: 'No fake/demo records added', passed: !/\b(fake|demo)\b/i.test(activeFiles) },
  { name: 'Operational UI avoids banned technical wording', passed: bannedOperationalTerms.every(pattern => !pattern.test(operationalUi)) },
  { name: 'Restore-noise covers Patch 73 generated proof JSON', passed: restoreNoise.includes('release/patch73/patch73-live-support-incident-readiness-proof.json') },
  { name: 'package.json contains patch74:proof', passed: packageJson.includes('"patch74:proof": "node scripts/patch74-final-security-access-review-pack-proof.mjs"') },
  { name: 'package.json contains patch74:all', passed: packageJson.includes('"patch74:all": "npm run validate:build && npm run validate:security && npm run patch74:proof"') },
  { name: 'validate:fast exists', passed: packageJson.includes('"validate:fast"') },
  { name: 'validate:build exists', passed: packageJson.includes('"validate:build"') },
  { name: 'validate:security exists', passed: packageJson.includes('"validate:security"') },
  { name: 'validate:release exists', passed: packageJson.includes('"validate:release"') },
  { name: 'proof:all exists', passed: packageJson.includes('"proof:all"') },
  { name: 'v700:runtime-security exists', passed: packageJson.includes('"v700:runtime-security"') },
  { name: 'release:restore-noise exists', passed: packageJson.includes('"release:restore-noise"') },
  { name: 'current platform status mentions Patch 74', passed: statusDoc.includes('Patch 74') && statusDoc.includes('final security and access review readiness') },
  { name: 'production caveat remains', passed: statusDoc.includes('Real hospital-wide production still requires live department launch evidence') },
  { name: 'proof index mentions Patch 74', passed: proofIndex.includes('patch74:proof') },
  { name: 'runbook mentions Patch 73 proof JSON restore coverage', passed: runbook.includes('Patch 74 extends restore coverage to the Patch 73 generated proof JSON') },
  { name: 'No conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(`${packageJson}\n${api}\n${page}\n${operatorConsole}\n${statusDoc}\n${proofIndex}\n${runbook}`) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '74',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\nPatch 74 final security and access review pack proof failed:');
  failed.forEach(check => console.error(`  - ${check.name}`));
  process.exit(1);
}

console.log(`\nPatch 74 final security and access review pack proof passed. (${checks.length} checks)`);
