import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release/patch71');
const outPath = path.join(outDir, 'patch71-live-data-quality-role-integrity-proof.json');

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
  { name: 'Patch 71 live data quality helper exists', passed: api.includes('getLiveDataQualityRoleIntegrityReadiness') && api.includes('getLiveDataQualityState') },
  { name: 'Patch 71 role integrity helper exists', passed: api.includes('getRoleIntegrityState') && api.includes('getRoleIntegrityFindings') },
  { name: 'Live data quality findings helper exists', passed: api.includes('getLiveDataQualityFindings') },
  { name: 'Role integrity required actions helper exists', passed: api.includes('getRoleIntegrityRequiredActions') },
  { name: 'Live data quality and role integrity wording exists', passed: page.includes('Live Data Quality and Role Integrity') && page.includes('Live data quality and role integrity.') },
  { name: 'Safe state exists: Data blocked', passed: api.includes('Data blocked') && page.includes('Data blocked') },
  { name: 'Safe state exists: Role review required', passed: api.includes('Role review required') && page.includes('Role review required') },
  { name: 'Safe state exists: Data review required', passed: api.includes('Data review required') && page.includes('Data review required') },
  { name: 'Safe state exists: Accountability review required', passed: api.includes('Accountability review required') && page.includes('Accountability review required') },
  { name: 'Safe state exists: Ready for UAT data review', passed: api.includes('Ready for UAT data review') && page.includes('Ready for UAT data review') },
  { name: 'Required actions before UAT wording exists', passed: page.includes('Required actions before UAT') },
  { name: 'Inactive or archived users require reassignment wording exists', passed: page.includes('Inactive or archived users require reassignment') && api.includes('Inactive or archived users require reassignment.') },
  { name: 'Missing owner or reviewer requires assignment wording exists', passed: page.includes('Missing owner or reviewer requires assignment') && api.includes('Missing owner or reviewer requires assignment.') },
  { name: 'Data quality readiness caveat exists', passed: page.includes('Data quality readiness does not approve production launch.') && api.includes('Data quality readiness does not approve production launch.') },
  { name: 'Production launch separate authority wording exists', passed: page.includes('Production launch requires separate executive authority.') && api.includes('Production launch requires separate executive authority.') },
  { name: 'Patch 69 executive decision pack wording remains', passed: page.includes('Executive go/no-go decision pack.') && api.includes('getExecutiveGoNoGoDecisionPack') },
  { name: 'Patch 70 department launch final readiness wording remains', passed: page.includes('Department launch final readiness.') && api.includes('getDepartmentLaunchFinalReadinessWorkflow') },
  { name: 'No production launch action added', passed: !/Authorize Production Launch|Launch production now|Start production launch|Complete production launch/i.test(operationalUi) },
  { name: 'No transition_to_live_operations wording/action exists', passed: !/transition_to_live_operations/i.test(activeFiles) },
  { name: 'No Authorize Production Launch wording exists', passed: !/Authorize Production Launch/i.test(activeFiles) },
  { name: 'No executive production signoff RPC added', passed: !/executive[_A-Za-z]*production[_A-Za-z]*signoff|recordExecutiveProductionSignoff/i.test(activeFiles) },
  { name: 'No production-ready claim added', passed: !/Production ready|production-ready/i.test(operationalUi) },
  { name: 'No browser service-role exposure exists', passed: !/service[_-]?role|SUPABASE_SERVICE_ROLE/i.test(activeFiles) },
  { name: '/production-evidence-closure still exists', passed: app.includes("'/production-evidence-closure': 'productionEvidenceClosure'") },
  { name: 'Production Evidence Closure page exists', passed: exists('src/pages/ProductionEvidenceClosureCenter.tsx') },
  { name: 'Production Readiness Center link remains', passed: page.includes('Production Readiness Center') },
  { name: 'Production Operator Console link remains', passed: page.includes('Production Operator Console') },
  { name: 'No fake/demo records added', passed: !/\b(fake|demo)\b/i.test(activeFiles) },
  { name: 'Operational UI avoids banned technical wording', passed: bannedOperationalTerms.every(pattern => !pattern.test(operationalUi)) },
  { name: 'Restore-noise covers Patch 70 generated proof JSON', passed: restoreNoise.includes('release/patch70/patch70-department-launch-final-readiness-workflow-proof.json') },
  { name: 'package.json contains patch71:proof', passed: packageJson.includes('"patch71:proof": "node scripts/patch71-live-data-quality-role-integrity-proof.mjs"') },
  { name: 'package.json contains patch71:all', passed: packageJson.includes('"patch71:all": "npm run validate:build && npm run validate:security && npm run patch71:proof"') },
  { name: 'validate:fast exists', passed: packageJson.includes('"validate:fast"') },
  { name: 'validate:build exists', passed: packageJson.includes('"validate:build"') },
  { name: 'validate:security exists', passed: packageJson.includes('"validate:security"') },
  { name: 'validate:release exists', passed: packageJson.includes('"validate:release"') },
  { name: 'proof:all exists', passed: packageJson.includes('"proof:all"') },
  { name: 'v700:runtime-security exists', passed: packageJson.includes('"v700:runtime-security"') },
  { name: 'release:restore-noise exists', passed: packageJson.includes('"release:restore-noise"') },
  { name: 'current platform status mentions Patch 71', passed: statusDoc.includes('Patch 71') && statusDoc.includes('live data quality and role integrity readiness') },
  { name: 'production caveat remains', passed: statusDoc.includes('Real hospital-wide production still requires live department launch evidence') },
  { name: 'proof index mentions Patch 71', passed: proofIndex.includes('patch71:proof') },
  { name: 'runbook mentions Patch 70 proof JSON restore coverage', passed: runbook.includes('Patch 71 extends restore coverage to the Patch 70 generated proof JSON') },
  { name: 'No conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(`${packageJson}\n${api}\n${page}\n${operatorConsole}\n${statusDoc}\n${proofIndex}\n${runbook}`) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '71',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\nPatch 71 live data quality and role integrity proof failed:');
  failed.forEach(check => console.error(`  - ${check.name}`));
  process.exit(1);
}

console.log(`\nPatch 71 live data quality and role integrity proof passed. (${checks.length} checks)`);
