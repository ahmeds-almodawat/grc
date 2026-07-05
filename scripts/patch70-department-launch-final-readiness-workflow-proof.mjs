import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release/patch70');
const outPath = path.join(outDir, 'patch70-department-launch-final-readiness-workflow-proof.json');

function read(relPath) {
  const fullPath = path.join(root, relPath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function includesAll(source, values) {
  return values.every(value => source.includes(value));
}

const packageJson = read('package.json');
const api = read('src/lib/productionEvidenceClosureApi.ts');
const page = read('src/pages/ProductionEvidenceClosureCenter.tsx');
const operatorConsole = read('src/pages/ProductionOperatorConsole.tsx');
const app = read('src/App.tsx');
const layout = read('src/components/Layout.tsx');
const statusDoc = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbook = read('release/current-validation-runbook.md');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');

const operationalUi = `${page}\n${operatorConsole}`;
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
  { name: 'No new Patch 70 department readiness migration exists', passed: !exists('supabase/migrations/118_patch70_department_launch_final_readiness_workflow.sql') },
  { name: 'Production Evidence Closure page exists', passed: exists('src/pages/ProductionEvidenceClosureCenter.tsx') },
  { name: 'Production Evidence Closure route remains available', passed: app.includes("'/production-evidence-closure': 'productionEvidenceClosure'") },
  { name: 'Production Evidence Closure navigation remains available', passed: layout.includes('productionEvidenceClosure') },
  { name: 'Department launch readiness helper exists', passed: api.includes('getDepartmentLaunchFinalReadinessWorkflow') },
  { name: 'Department launch state helper exists', passed: api.includes('getDepartmentLaunchReadinessState') },
  { name: 'Department launch blocker helper exists', passed: api.includes('getDepartmentLaunchBlockerSummary') },
  { name: 'Department launch required actions helper exists', passed: api.includes('getDepartmentLaunchRequiredActions') },
  { name: 'Department launch evidence closure summary helper exists', passed: api.includes('getDepartmentLaunchEvidenceClosureSummary') },
  {
    name: 'Safe department launch states are present',
    passed: includesAll(api, [
      'Launch blocked',
      'Evidence required',
      'Review required',
      'Limitation review required',
      'Ready for executive decision review',
    ]),
  },
  { name: 'Department launch final readiness section exists', passed: page.includes('Department Launch Final Readiness') && page.includes('Department launch final readiness.') },
  { name: 'Required actions before executive decision visible', passed: page.includes('Required actions before executive decision') },
  { name: 'Controlled evidence closure action summary visible', passed: page.includes('Controlled closure action summary') || page.includes('controlledClosureActionSummary') },
  { name: 'Training/adoption/support summary visible', passed: page.includes('Training/adoption/support summary') },
  { name: 'Policy/SOP attestation summary visible', passed: page.includes('Policy/SOP attestation summary') },
  { name: 'Backup/restore/DR summary visible', passed: page.includes('Backup/restore/DR summary') },
  { name: 'Access/security summary visible', passed: page.includes('Access/security summary') },
  { name: 'Department readiness caveat visible', passed: page.includes('Department readiness does not approve production launch.') },
  { name: 'Separate executive authority caveat visible', passed: page.includes('Production launch requires separate executive authority.') },
  { name: 'Operator console links to department launch readiness workflow', passed: operatorConsole.includes('department launch final readiness workflow') || operatorConsole.includes('Department launch evidence readiness') },
  { name: 'Production Readiness Center link remains', passed: page.includes('Production Readiness Center') },
  { name: 'Production Operator Console link remains', passed: page.includes('Production Operator Console') },
  { name: 'No production launch action added', passed: !/Authorize Production Launch|Launch production now|Start production launch|Complete production launch/i.test(operationalUi) },
  { name: 'No live operations transition added', passed: !/transition_to_live_operations/i.test(`${api}\n${page}\n${operatorConsole}`) },
  { name: 'No executive production signoff RPC added', passed: !/executive[_A-Za-z]*production[_A-Za-z]*signoff|recordExecutiveProductionSignoff/i.test(`${api}\n${page}\n${operatorConsole}`) },
  { name: 'No production-ready claim added', passed: !/Production ready|production-ready/i.test(operationalUi) },
  { name: 'No browser service-role exposure added', passed: !/service[_-]?role|SUPABASE_SERVICE_ROLE/i.test(`${api}\n${page}\n${operatorConsole}`) },
  { name: 'No fake/demo/fallback records in operational UI', passed: !/\b(fake|demo|mock|fallback)\b/i.test(operationalUi) },
  { name: 'Operational UI avoids banned technical wording', passed: bannedOperationalTerms.every(pattern => !pattern.test(operationalUi)) },
  { name: 'Package contains patch70 proof script', passed: packageJson.includes('"patch70:proof": "node scripts/patch70-department-launch-final-readiness-workflow-proof.mjs"') },
  { name: 'Package contains patch70 all script', passed: packageJson.includes('"patch70:all": "npm run validate:build && npm run validate:security && npm run patch70:proof"') },
  { name: 'validate:fast remains present', passed: packageJson.includes('"validate:fast"') },
  { name: 'validate:build remains present', passed: packageJson.includes('"validate:build"') },
  { name: 'validate:security remains present', passed: packageJson.includes('"validate:security"') },
  { name: 'release:restore-noise remains present', passed: packageJson.includes('"release:restore-noise"') },
  { name: 'Restore-noise covers Patch 69 generated proof JSON', passed: restoreNoise.includes('release/patch69/patch69-executive-go-no-go-decision-pack-proof.json') },
  { name: 'Current platform status mentions Patch 70', passed: statusDoc.includes('Patch 70') },
  { name: 'Current platform status keeps production caveat', passed: statusDoc.includes('Real hospital-wide production still requires live department launch evidence') },
  { name: 'Proof command index mentions Patch 70 proof', passed: proofIndex.includes('patch70:proof') },
  { name: 'Validation runbook mentions validate:security for security-adjacent patches', passed: runbook.includes('validate:security') && runbook.includes('security-adjacent') },
  { name: 'No conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(`${packageJson}\n${api}\n${page}\n${operatorConsole}\n${statusDoc}\n${proofIndex}\n${runbook}`) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '70',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\nPatch 70 department launch final readiness proof failed:');
  failed.forEach(check => console.error(`  - ${check.name}`));
  process.exit(1);
}

console.log(`\nPatch 70 department launch final readiness proof passed. (${checks.length} checks)`);
