import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'release/patch73');
const outPath = path.join(outDir, 'patch73-live-support-incident-readiness-proof.json');

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
  { name: 'Patch 73 live support readiness helper exists', passed: api.includes('getLiveSupportIncidentReadiness') && api.includes('getSupportReadinessState') },
  { name: 'Patch 73 incident readiness helper exists', passed: api.includes('getIncidentReadinessState') && api.includes('getIncidentReadinessRequiredActions') },
  { name: 'Live support and incident readiness wording exists', passed: page.includes('Live Support and Incident Readiness') && page.includes('Live support and incident readiness.') },
  { name: 'Safe state exists: Support blocked', passed: api.includes('Support blocked') && page.includes('Support blocked') },
  { name: 'Safe state exists: Incident readiness blocked', passed: api.includes('Incident readiness blocked') && page.includes('Incident readiness blocked') },
  { name: 'Safe state exists: Support evidence required', passed: api.includes('Support evidence required') && page.includes('Support evidence required') },
  { name: 'Safe state exists: Escalation review required', passed: api.includes('Escalation review required') && page.includes('Escalation review required') },
  { name: 'Safe state exists: Ready for support readiness review', passed: api.includes('Ready for support readiness review') && page.includes('Ready for support readiness review') },
  { name: 'Required actions before support readiness review wording exists', passed: page.includes('Required actions before support readiness review') },
  { name: 'Support desk readiness required wording exists', passed: page.includes('Support desk readiness required') && api.includes('Support desk readiness required') },
  { name: 'Escalation owner review required wording exists', passed: page.includes('Escalation owner review required') && api.includes('Escalation owner review required') },
  { name: 'Known issue register review required wording exists', passed: page.includes('Known issue register review required') && api.includes('Known issue register review required') },
  { name: 'Downtime fallback readiness required wording exists', passed: page.includes('Downtime fallback readiness required') && api.includes('Downtime fallback readiness required') },
  { name: 'Support readiness caveat exists', passed: page.includes('Support readiness does not approve production launch.') && api.includes('Support readiness does not approve production launch.') },
  { name: 'Production launch separate authority wording exists', passed: page.includes('Production launch requires separate executive authority.') && api.includes('Production launch requires separate executive authority.') },
  { name: 'Patch 69 executive decision pack wording remains', passed: page.includes('Executive go/no-go decision pack.') && api.includes('getExecutiveGoNoGoDecisionPack') },
  { name: 'Patch 70 department launch final readiness wording remains', passed: page.includes('Department launch final readiness.') && api.includes('getDepartmentLaunchFinalReadinessWorkflow') },
  { name: 'Patch 71 live data quality and role integrity wording remains', passed: page.includes('Live data quality and role integrity.') && api.includes('getLiveDataQualityRoleIntegrityReadiness') },
  { name: 'Patch 72 UAT pack and hospital pilot acceptance wording remains', passed: page.includes('UAT pack and hospital pilot acceptance.') && api.includes('getUatPackHospitalPilotAcceptanceReadiness') },
  { name: 'No production launch action added', passed: !/Authorize Production Launch|Launch production now|Start production launch|Complete production launch|Final production approval/i.test(operationalUi) },
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
  { name: 'Restore-noise covers Patch 72 generated proof JSON', passed: restoreNoise.includes('release/patch72/patch72-uat-pack-hospital-pilot-acceptance-proof.json') },
  { name: 'package.json contains patch73:proof', passed: packageJson.includes('"patch73:proof": "node scripts/patch73-live-support-incident-readiness-proof.mjs"') },
  { name: 'package.json contains patch73:all', passed: packageJson.includes('"patch73:all": "npm run validate:build && npm run validate:security && npm run patch73:proof"') },
  { name: 'validate:fast exists', passed: packageJson.includes('"validate:fast"') },
  { name: 'validate:build exists', passed: packageJson.includes('"validate:build"') },
  { name: 'validate:security exists', passed: packageJson.includes('"validate:security"') },
  { name: 'validate:release exists', passed: packageJson.includes('"validate:release"') },
  { name: 'proof:all exists', passed: packageJson.includes('"proof:all"') },
  { name: 'v700:runtime-security exists', passed: packageJson.includes('"v700:runtime-security"') },
  { name: 'release:restore-noise exists', passed: packageJson.includes('"release:restore-noise"') },
  { name: 'current platform status mentions Patch 73', passed: statusDoc.includes('Patch 73') && statusDoc.includes('live support and incident readiness') },
  { name: 'production caveat remains', passed: statusDoc.includes('Real hospital-wide production still requires live department launch evidence') },
  { name: 'proof index mentions Patch 73', passed: proofIndex.includes('patch73:proof') },
  { name: 'runbook mentions Patch 72 proof JSON restore coverage', passed: runbook.includes('Patch 73 extends restore coverage to the Patch 72 generated proof JSON') },
  { name: 'No conflict markers', passed: !/^(<<<<<<<|=======|>>>>>>>)$/m.test(`${packageJson}\n${api}\n${page}\n${operatorConsole}\n${statusDoc}\n${proofIndex}\n${runbook}`) },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '73',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

if (failed.length > 0) {
  console.error('\nPatch 73 live support and incident readiness proof failed:');
  failed.forEach(check => console.error(`  - ${check.name}`));
  process.exit(1);
}

console.log(`\nPatch 73 live support and incident readiness proof passed. (${checks.length} checks)`);
