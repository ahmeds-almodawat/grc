import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const reportDir = path.join(root, 'release', 'patch61');
const reportPath = path.join(reportDir, 'patch61-evidence-ownership-due-date-readiness-proof.json');

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
const patch61Migrations = fs.readdirSync(migrationDir).filter((name) => /patch61|117_patch61/i.test(name));

const mutatingExportPattern = /export\s+async\s+function\s+(create|update|record|close|reopen|accept|request|mark|submit)[A-Za-z0-9_]*\s*\(/;
const directClosureButtonPattern = />\s*(Close evidence|Close as verified|Mark verified|Accept evidence|Approve evidence|Reject evidence)\s*</i;
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
      const source = fs.readFileSync(abs, 'utf8');
      return /^(<<<<<<<|=======|>>>>>>>)$/m.test(source);
    });
}

const pageBannedTerms = containsBannedOperationalTerm(pageSource);
const operatorBannedTerms = containsBannedOperationalTerm(operatorSource);
const conflictMarkers = conflictMarkerFindings();

const checks = [
  { name: 'no Patch 61 migration exists', passed: patch61Migrations.length === 0, findings: patch61Migrations },
  { name: 'no new backend write endpoint was added', passed: !mutatingExportPattern.test(apiSource) },
  { name: 'no direct closure button wording exists', passed: !directClosureButtonPattern.test(pageSource) },
  { name: 'route /production-evidence-closure still exists', passed: appSource.includes("'/production-evidence-closure'") },
  { name: 'Production Evidence Closure page exists', passed: exists('src/pages/ProductionEvidenceClosureCenter.tsx') },
  { name: 'owner readiness helper exists', passed: apiSource.includes('getEvidenceOwnershipState') && apiSource.includes('getEvidenceOwnerDisplay') },
  { name: 'reviewer readiness helper exists', passed: apiSource.includes('Reviewer assigned') && apiSource.includes('Reviewer missing') },
  { name: 'due date readiness helper exists', passed: apiSource.includes('getEvidenceDueDateState') && apiSource.includes('Due date missing') },
  { name: 'escalation readiness helper exists', passed: apiSource.includes('getEvidenceEscalationReadiness') && apiSource.includes('Escalation may be required.') },
  { name: 'owner readiness wording exists', passed: pageSource.includes('Owner state') && pageSource.includes('Owner not assigned') },
  { name: 'reviewer readiness wording exists', passed: pageSource.includes('Reviewer state') && pageSource.includes('Reviewer not assigned') },
  { name: 'due date readiness wording exists', passed: pageSource.includes('Due date state') && pageSource.includes('Due date not recorded') },
  { name: 'overdue wording exists', passed: pageSource.includes('Overdue status') && apiSource.includes('Overdue.') },
  { name: 'blocked wording exists', passed: pageSource.includes('Blocked status') && apiSource.includes('Blocked.') },
  { name: 'escalation readiness wording exists', passed: pageSource.includes('Escalation readiness') && pageSource.includes('Escalation may be required') },
  { name: 'next accountable party wording exists', passed: pageSource.includes('Next accountable party') },
  { name: 'source workflow destination remains', passed: pageSource.includes('Safe source workflow destination') && apiSource.includes('Closure must be completed in the source workflow.') },
  { name: 'Production Readiness Center link remains', passed: pageSource.includes('Production Readiness Center') && pageSource.includes('destinationPage') },
  { name: 'Production Operator Console link remains', passed: pageSource.includes("setPage('productionOperatorConsole')") && pageSource.includes('Production Operator Console') },
  { name: 'operator console mentions ownership and due date readiness', passed: operatorSource.includes('ownership and due date readiness') && operatorSource.includes('Production Evidence Closure review readiness') },
  { name: 'no fake/demo records were added', passed: !/\b(fake|demo|mock)\b/i.test(pageSource) && !/\b(fake|demo|mock)\b/i.test(apiSource) },
  { name: 'operational UI avoids banned technical wording', passed: pageBannedTerms.length === 0 && operatorBannedTerms.length === 0, findings: { page: pageBannedTerms, operator: operatorBannedTerms } },
  { name: 'package patch61:proof exists', passed: scripts['patch61:proof'] === 'node scripts/patch61-evidence-ownership-due-date-readiness-proof.mjs' },
  { name: 'package patch61:all exists', passed: scripts['patch61:all'] === 'npm run validate:build && npm run patch61:proof' },
  { name: 'validate:fast exists', passed: typeof scripts['validate:fast'] === 'string' },
  { name: 'validate:build exists', passed: scripts['validate:build'] === 'npm run typecheck && npm run build' },
  { name: 'validate:release exists', passed: typeof scripts['validate:release'] === 'string' },
  { name: 'proof:all exists', passed: scripts['proof:all'] === 'node scripts/v700-proof-suite.mjs all' },
  { name: 'v700:runtime-security exists', passed: scripts['v700:runtime-security'] === 'node scripts/v700-runtime-security-bridge-audit.mjs' },
  { name: 'release:restore-noise exists', passed: scripts['release:restore-noise'] === 'node scripts/restore-generated-release-noise.mjs' },
  { name: 'status doc mentions Patch 61', passed: statusSource.includes('Patch 61') && statusSource.includes('evidence ownership and due-date readiness') },
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
