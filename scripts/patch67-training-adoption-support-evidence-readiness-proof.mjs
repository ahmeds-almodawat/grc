import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const reportDir = path.join(root, 'release', 'patch67');
const reportPath = path.join(reportDir, 'patch67-training-adoption-support-evidence-readiness-proof.json');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};

const pageSource = read('src/pages/ProductionEvidenceClosureCenter.tsx');
const apiSource = read('src/lib/productionEvidenceClosureApi.ts');
const operatorSource = read('src/pages/ProductionOperatorConsole.tsx');
const appSource = read('src/App.tsx');
const statusSource = read('release/current-platform-status.md');
const proofIndexSource = read('release/current-proof-command-index.md');
const runbookSource = read('release/current-validation-runbook.md');
const restoreSource = read('scripts/restore-generated-release-noise.mjs');

const migrationDir = path.join(root, 'supabase', 'migrations');
const patch67Migrations = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter((name) => /patch67|123_patch67/i.test(name))
  : [];

const mutatingExportPattern = /export\s+async\s+function\s+(create|update|record|close|reopen|accept|request|mark|submit)[A-Za-z0-9_]*\s*\(/;
const directClosureButtonPattern = />\s*(Close evidence|Close as verified|Mark verified|Mark production ready|Accept evidence|Approve evidence|Reject evidence)\s*</i;
const productionReadyClaimPattern = /\b(Production ready|Fully ready|Marked verified|Marked production ready)\b/i;
const bannedOperationalTerms = [
  'patch',
  'proof',
  'rpc',
  'schema',
  'migration',
  'scaffold',
  'mock',
  'demo',
  'fake',
  'unknown_requires_review',
];

function containsBannedOperationalTerm(source) {
  const normalized = source.toLowerCase();
  return bannedOperationalTerms.filter((term) => normalized.includes(term));
}

function gitTrackedFiles() {
  const result = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function conflictMarkerFindings() {
  return gitTrackedFiles()
    .filter((file) => !file.startsWith('node_modules/') && !file.startsWith('dist/') && !file.startsWith('build/'))
    .filter((file) => {
      const abs = path.join(root, file);
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return false;
      return /^(<<<<<<<|=======|>>>>>>>)$/m.test(fs.readFileSync(abs, 'utf8'));
    });
}

const pageBannedTerms = containsBannedOperationalTerm(pageSource);
const operatorBannedTerms = containsBannedOperationalTerm(operatorSource);
const operationalSource = `${pageSource}\n${operatorSource}`;
const conflictMarkers = conflictMarkerFindings();

const checks = [
  { name: 'no Patch 67 migration exists', passed: patch67Migrations.length === 0, findings: patch67Migrations },
  { name: 'no new backend write endpoint was added', passed: !mutatingExportPattern.test(apiSource) },
  { name: 'no direct closure button wording exists', passed: !directClosureButtonPattern.test(pageSource) },
  { name: 'no production-ready claim was added', passed: !productionReadyClaimPattern.test(operationalSource) },
  { name: 'route /production-evidence-closure still exists', passed: appSource.includes("'/production-evidence-closure'") },
  { name: 'Production Evidence Closure page exists', passed: exists('src/pages/ProductionEvidenceClosureCenter.tsx') },
  { name: 'training/adoption/support helper exists', passed: apiSource.includes('getTrainingAdoptionSupportEvidenceReadiness') && apiSource.includes('getTrainingAdoptionSupportGapSummary') },
  { name: 'training evidence wording exists', passed: pageSource.includes('Training evidence') },
  { name: 'adoption evidence wording exists', passed: pageSource.includes('Adoption evidence') },
  { name: 'support readiness evidence wording exists', passed: pageSource.includes('Support readiness evidence') },
  { name: 'training evidence required wording exists', passed: apiSource.includes('Training evidence required') && pageSource.includes('Training evidence required') },
  { name: 'adoption evidence required wording exists', passed: apiSource.includes('Adoption evidence required') && pageSource.includes('Adoption evidence required') },
  { name: 'support readiness evidence required wording exists', passed: apiSource.includes('Support readiness evidence required') && pageSource.includes('Support readiness evidence required') },
  { name: 'executive review required wording exists', passed: apiSource.includes('Executive review required') && pageSource.includes('Executive impact') },
  { name: 'source workflow destination wording remains', passed: pageSource.includes('Source workflow destination') && pageSource.includes('Manage adoption evidence in Production Readiness Center') },
  { name: 'operational adoption caveat wording exists', passed: apiSource.includes('Operational adoption readiness depends on recorded source evidence.') && pageSource.includes('Operational adoption readiness depends on recorded source evidence') },
  { name: 'Production Readiness Center link remains', passed: pageSource.includes('Production Readiness Center') && pageSource.includes('productionReadiness') },
  { name: 'Production Operator Console link remains', passed: pageSource.includes("setPage('productionOperatorConsole')") && pageSource.includes('Production Operator Console') },
  { name: 'operator console mentions training, adoption, and support evidence readiness', passed: operatorSource.includes('training, adoption, and support evidence readiness') },
  { name: 'no fake/demo records were added', passed: !/\b(fake|demo|mock)\b/i.test(pageSource) && !/\b(fake|demo|mock)\b/i.test(apiSource) },
  { name: 'operational UI avoids banned technical wording', passed: pageBannedTerms.length === 0 && operatorBannedTerms.length === 0, findings: { page: pageBannedTerms, operator: operatorBannedTerms } },
  { name: 'restore-noise covers Patch 66 generated proof JSON', passed: restoreSource.includes('release/patch66/patch66-access-review-security-evidence-readiness-proof.json') },
  { name: 'package patch67:proof exists', passed: scripts['patch67:proof'] === 'node scripts/patch67-training-adoption-support-evidence-readiness-proof.mjs' },
  { name: 'package patch67:all exists', passed: scripts['patch67:all'] === 'npm run validate:build && npm run patch67:proof' },
  { name: 'validate:fast exists', passed: typeof scripts['validate:fast'] === 'string' },
  { name: 'validate:build exists', passed: scripts['validate:build'] === 'npm run typecheck && npm run build' },
  { name: 'validate:release exists', passed: typeof scripts['validate:release'] === 'string' },
  { name: 'proof:all exists', passed: scripts['proof:all'] === 'node scripts/v700-proof-suite.mjs all' },
  { name: 'v700:runtime-security exists', passed: scripts['v700:runtime-security'] === 'node scripts/v700-runtime-security-bridge-audit.mjs' },
  { name: 'release:restore-noise exists', passed: scripts['release:restore-noise'] === 'node scripts/restore-generated-release-noise.mjs' },
  { name: 'status doc mentions Patch 67', passed: statusSource.includes('Patch 67') && statusSource.includes('training, adoption, and support evidence readiness') },
  { name: 'proof index mentions Patch 67 proof', passed: proofIndexSource.includes('patch67:proof') },
  { name: 'validation runbook mentions Patch 67 restore coverage', passed: runbookSource.includes('Patch 67') && runbookSource.includes('Patch 66 generated proof JSON') },
  { name: 'production caveat remains', passed: statusSource.includes('Real hospital-wide production still requires live department launch evidence') },
  { name: 'no conflict markers', passed: conflictMarkers.length === 0, findings: conflictMarkers },
];

const failed = checks.filter((check) => !check.passed);
const report = {
  generated_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  checks,
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exit(1);
