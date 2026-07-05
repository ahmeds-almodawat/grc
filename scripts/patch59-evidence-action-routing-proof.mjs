import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const reportDir = path.join(root, 'release', 'patch59');
const reportPath = path.join(reportDir, 'patch59-evidence-action-routing-proof.json');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};

const pageSource = read('src/pages/ProductionEvidenceClosureCenter.tsx');
const apiSource = read('src/lib/productionEvidenceClosureApi.ts');
const operatorSource = read('src/pages/ProductionOperatorConsole.tsx');
const appSource = read('src/App.tsx');
const statusSource = read('release/current-platform-status.md');

const migrationDir = path.join(root, 'supabase', 'migrations');
const patch59Migrations = fs.readdirSync(migrationDir).filter((name) => /patch59|115_patch59/i.test(name));

const mutatingExportPattern = /export\s+async\s+function\s+(create|update|record|close|reopen|accept|request|mark|submit)[A-Za-z0-9_]*\s*\(/;
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
  const gitDir = path.join(root, '.git');
  if (!fs.existsSync(gitDir)) return [];
  const output = awaitableSpawnGitLsFiles();
  return output.split(/\r?\n/).filter(Boolean);
}

function awaitableSpawnGitLsFiles() {
  const result = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout;
}

function conflictMarkerFindings() {
  return gitTrackedFiles()
    .filter((file) => !file.startsWith('node_modules/') && !file.startsWith('dist/') && !file.startsWith('build/'))
    .filter((file) => {
      const abs = path.join(root, file);
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return false;
      const source = fs.readFileSync(abs, 'utf8');
      return /^(<<<<<<<|=======|>>>>>>>)$/m.test(source);
    });
}

const pageBannedTerms = containsBannedOperationalTerm(pageSource);
const operatorBannedTerms = containsBannedOperationalTerm(operatorSource);

const checks = [
  { name: 'no Patch 59 migration exists', passed: patch59Migrations.length === 0, findings: patch59Migrations },
  { name: 'no new backend write endpoint was added', passed: !mutatingExportPattern.test(apiSource) },
  { name: 'route /production-evidence-closure still exists', passed: appSource.includes("'/production-evidence-closure'") },
  { name: 'Production Evidence Closure page exists', passed: exists('src/pages/ProductionEvidenceClosureCenter.tsx') },
  { name: 'action routing helper exists', passed: apiSource.includes('getEvidenceClosureHandoff') },
  { name: 'action routing handoff wording exists', passed: pageSource.includes('Recommended next action') && pageSource.includes('Safe management destination') },
  { name: 'closure availability wording exists', passed: pageSource.includes('No closure action is available from this screen.') },
  { name: 'required evidence before closure wording exists', passed: pageSource.includes('Required evidence before closure') },
  { name: 'reviewer decision wording exists', passed: pageSource.includes('Reviewer decision') },
  { name: 'limitation decision wording exists', passed: pageSource.includes('Limitation / exception decision') },
  { name: 'Production Readiness Center link exists', passed: pageSource.includes("setPage(selectedHandoff.destinationPage)") && pageSource.includes('Production Readiness Center') },
  { name: 'Production Operator Console link exists', passed: pageSource.includes("setPage('productionOperatorConsole')") && pageSource.includes('Production Operator Console') },
  { name: 'operator console routes to evidence closure', passed: operatorSource.includes("setPage('productionEvidenceClosure')") && operatorSource.includes('Route evidence closure') },
  { name: 'no fake/demo records were added', passed: !/\b(fake|demo|mock)\b/i.test(pageSource) && !/\b(fake|demo|mock)\b/i.test(apiSource) },
  { name: 'operational UI avoids banned technical wording', passed: pageBannedTerms.length === 0 && operatorBannedTerms.length === 0, findings: { page: pageBannedTerms, operator: operatorBannedTerms } },
  { name: 'package patch59:proof exists', passed: scripts['patch59:proof'] === 'node scripts/patch59-evidence-action-routing-proof.mjs' },
  { name: 'package patch59:all exists', passed: scripts['patch59:all'] === 'npm run validate:build && npm run patch59:proof' },
  { name: 'validate:fast exists', passed: typeof scripts['validate:fast'] === 'string' },
  { name: 'validate:build exists', passed: scripts['validate:build'] === 'npm run typecheck && npm run build' },
  { name: 'validate:release exists', passed: typeof scripts['validate:release'] === 'string' },
  { name: 'proof:all exists', passed: scripts['proof:all'] === 'node scripts/v700-proof-suite.mjs all' },
  { name: 'v700:runtime-security exists', passed: scripts['v700:runtime-security'] === 'node scripts/v700-runtime-security-bridge-audit.mjs' },
  { name: 'release:restore-noise exists', passed: scripts['release:restore-noise'] === 'node scripts/restore-generated-release-noise.mjs' },
  { name: 'status doc mentions Patch 59', passed: statusSource.includes('Patch 59') && statusSource.includes('evidence action routing') },
  { name: 'production caveat remains', passed: statusSource.includes('Real hospital-wide production still requires live department launch evidence') },
  { name: 'no conflict markers', passed: conflictMarkerFindings().length === 0, findings: conflictMarkerFindings() },
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
