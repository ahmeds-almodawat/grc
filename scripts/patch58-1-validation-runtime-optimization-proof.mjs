import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'release', 'patch58-1', 'patch58-1-validation-runtime-optimization-proof.json');

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function listFiles(dirRel, predicate = () => true) {
  const dir = path.join(root, dirRel);
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) stack.push(fullPath);
        continue;
      }
      const relPath = path.relative(root, fullPath).replaceAll(path.sep, '/');
      if (predicate(relPath)) files.push(relPath);
    }
  }
  return files;
}

const pkg = JSON.parse(read('package.json'));
const scripts = pkg.scripts || {};
const statusDoc = read('release/current-platform-status.md');
const appSource = read('src/App.tsx');
const layoutSource = read('src/components/Layout.tsx');
const proofSource = exists('scripts/patch58-1-validation-runtime-optimization-proof.mjs')
  ? read('scripts/patch58-1-validation-runtime-optimization-proof.mjs')
  : '';
const profileSource = exists('scripts/validation-profile.mjs') ? read('scripts/validation-profile.mjs') : '';

const conflictFiles = [
  'package.json',
  'scripts/validation-profile.mjs',
  'scripts/patch58-1-validation-runtime-optimization-proof.mjs',
  'scripts/patch58-production-evidence-closure-proof.mjs',
  'release/current-platform-status.md',
  'release/current-proof-command-index.md',
  'release/current-validation-runbook.md',
  'release/patch58-1/patch58-1-validation-runtime-optimization-summary.md',
  'release/patch58-1/patch58-1-validation-report.md',
].filter(exists).filter(relPath => /^(<<<<<<<|=======|>>>>>>>)$/m.test(read(relPath)));

const migrationFiles = listFiles('supabase/migrations', relPath => /patch58[-_]?1|patch59|115_patch58|116_patch59/i.test(relPath));
const patch59Files = listFiles('src', relPath => /patch59|Patch59|production.*59/i.test(relPath));
const fakeEvidenceFindings = [
  'package.json',
  'scripts/validation-profile.mjs',
  'release/current-platform-status.md',
  'release/patch58-1/patch58-1-validation-runtime-optimization-summary.md',
  'release/patch58-1/patch58-1-validation-report.md',
].filter(exists).filter(relPath => /\b(seed|insert|create)\b[\s\S]{0,80}\b(fake|demo)\b[\s\S]{0,80}\b(evidence|record)\b/i.test(read(relPath)));

const checks = [
  { name: 'no Patch 58.1 migration exists', passed: migrationFiles.length === 0, findings: migrationFiles },
  { name: 'no Patch 59 route exists', passed: !appSource.includes('patch59') && !appSource.includes('/patch59') },
  { name: 'no Patch 59 page key exists', passed: !layoutSource.includes('patch59') },
  { name: 'no Patch 59 source files exist', passed: patch59Files.length === 0, findings: patch59Files },
  { name: 'validate:fast exists', passed: typeof scripts['validate:fast'] === 'string' && scripts['validate:fast'].includes('typecheck') && scripts['validate:fast'].includes('patch58-1:proof') && !scripts['validate:fast'].includes('build') && !scripts['validate:fast'].includes('proof:all') && !scripts['validate:fast'].includes('v700:runtime-security') },
  { name: 'validate:build exists', passed: scripts['validate:build'] === 'npm run typecheck && npm run build' },
  { name: 'validate:proof exists', passed: scripts['validate:proof'] === 'npm run proof:all' },
  { name: 'validate:security exists', passed: scripts['validate:security'] === 'npm run v700:runtime-security' },
  { name: 'validate:release exists', passed: typeof scripts['validate:release'] === 'string' && scripts['validate:release'].includes('validate:build') && scripts['validate:release'].includes('patch58:proof') && scripts['validate:release'].includes('patch58-1:proof') && scripts['validate:release'].includes('proof:all') && scripts['validate:release'].includes('v700:runtime-security') },
  { name: 'validate:release avoids nested patch all chains', passed: typeof scripts['validate:release'] === 'string' && !/patch5[4-8]:all/.test(scripts['validate:release']) },
  { name: 'validate:profile:fast exists', passed: scripts['validate:profile:fast'] === 'node scripts/validation-profile.mjs fast' },
  { name: 'validate:profile:release exists', passed: scripts['validate:profile:release'] === 'node scripts/validation-profile.mjs release' },
  { name: 'validation profile helper exists', passed: exists('scripts/validation-profile.mjs') && profileSource.includes('fast') && profileSource.includes('release') },
  { name: 'patch58:proof still exists', passed: scripts['patch58:proof'] === 'node scripts/patch58-production-evidence-closure-proof.mjs' },
  { name: 'patch58:all still exists', passed: typeof scripts['patch58:all'] === 'string' && scripts['patch58:all'].includes('patch58:proof') && scripts['patch58:all'].includes('proof:all') && scripts['patch58:all'].includes('v700:runtime-security') && !scripts['patch58:all'].includes('patch57:all') },
  { name: 'patch57:all still exists', passed: typeof scripts['patch57:all'] === 'string' && scripts['patch57:all'].includes('patch57:proof') },
  { name: 'proof:all still exists', passed: typeof scripts['proof:all'] === 'string' && scripts['proof:all'].includes('v700-proof-suite') },
  { name: 'v700:runtime-security still exists', passed: typeof scripts['v700:runtime-security'] === 'string' && scripts['v700:runtime-security'].includes('v700-runtime-security-bridge-audit') },
  { name: 'release:restore-noise still exists', passed: scripts['release:restore-noise'] === 'node scripts/restore-generated-release-noise.mjs' },
  { name: 'patch58-1:proof exists', passed: scripts['patch58-1:proof'] === 'node scripts/patch58-1-validation-runtime-optimization-proof.mjs' },
  { name: 'patch58-1:all uses release lane without duplicate proof call', passed: scripts['patch58-1:all'] === 'npm run validate:release' },
  { name: 'status doc keeps production caveat', passed: statusDoc.includes('live department launch evidence') && statusDoc.includes('user training adoption') && statusDoc.includes('policy/SOP attestations') && statusDoc.includes('support readiness') && statusDoc.includes('DR restore evidence') && statusDoc.includes('executive signoff') },
  { name: 'status doc mentions Patch 58.1 validation optimization only', passed: statusDoc.includes('Patch 58.1') && statusDoc.includes('validation/runtime command structure only') },
  { name: 'no conflict markers', passed: conflictFiles.length === 0, findings: conflictFiles },
  { name: 'no fake/demo evidence records added', passed: fakeEvidenceFindings.length === 0, findings: fakeEvidenceFindings },
  { name: 'proof script does not mark gates passed artificially', passed: !/strict_passed:\s*true/.test(proofSource) },
];

const report = {
  generated_at: new Date().toISOString(),
  strict_passed: checks.every(check => check.passed),
  check_count: checks.length,
  failed_count: checks.filter(check => !check.passed).length,
  failed: checks.filter(check => !check.passed),
  checks,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.strict_passed) process.exit(1);
