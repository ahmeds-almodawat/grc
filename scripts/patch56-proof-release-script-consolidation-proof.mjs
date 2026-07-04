import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'release', 'patch56', 'patch56-proof-release-script-consolidation-proof.json');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
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

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts || {};
const restoreSource = exists('scripts/restore-generated-release-noise.mjs') ? read('scripts/restore-generated-release-noise.mjs') : '';
const statusDoc = exists('release/current-platform-status.md') ? read('release/current-platform-status.md') : '';
const proofIndex = exists('release/current-proof-command-index.md') ? read('release/current-proof-command-index.md') : '';
const runbook = exists('release/current-validation-runbook.md') ? read('release/current-validation-runbook.md') : '';

const requiredVPaths = [
  'release/v62',
  'release/v64',
  'release/v66',
  'release/v661',
  'release/v662',
  'release/v663',
  'release/v672',
  'release/v673',
  'release/v674',
  'release/v700',
  'release/v72',
];

const requiredPatchPaths = Array.from({ length: 13 }, (_, index) => `release/patch${43 + index}`);
const expectedProofScripts = [
  'scripts/v700-proof-suite.mjs',
  'scripts/v700-runtime-security-bridge-audit.mjs',
  'scripts/patch54-product-surface-proof.mjs',
  'scripts/patch55-hospital-operations-schema-proof.mjs',
  'scripts/patch55-hospital-operations-workflow-proof.mjs',
  'scripts/patch55-hospital-operations-frontend-proof.mjs',
];

function hasNoConflictMarkers(relPath) {
  if (!exists(relPath)) return false;
  return !/^(<<<<<<<|=======|>>>>>>>)$/m.test(read(relPath));
}

const newTextFiles = [
  'package.json',
  'scripts/restore-generated-release-noise.mjs',
  'scripts/patch56-proof-release-script-consolidation-proof.mjs',
  'release/current-platform-status.md',
  'release/current-proof-command-index.md',
  'release/current-validation-runbook.md',
  'release/patch56/patch56-implementation-summary.md',
  'release/patch56/patch56-validation-report.md',
];

const fakeRecordFindings = newTextFiles
  .filter(exists)
  .filter(relPath => /\binsert\s+into\b|\bseed\s+demo\b|\bdemo\s+record\b|\bfallback\s+record\b/i.test(read(relPath)));

const migrationFiles = listFiles('supabase/migrations', relPath => /patch56/i.test(relPath));

const checks = [
  { name: 'no Patch 56 migration exists', passed: migrationFiles.length === 0, findings: migrationFiles },
  { name: 'package release:restore-noise exists', passed: scripts['release:restore-noise'] === 'node scripts/restore-generated-release-noise.mjs' },
  { name: 'package patch56:proof exists', passed: scripts['patch56:proof'] === 'node scripts/patch56-proof-release-script-consolidation-proof.mjs' },
  { name: 'package patch56:all exists', passed: typeof scripts['patch56:all'] === 'string' && scripts['patch56:all'].includes('patch55:all') && scripts['patch56:all'].includes('proof:all') && scripts['patch56:all'].includes('v700:runtime-security') },
  { name: 'restore script exists', passed: exists('scripts/restore-generated-release-noise.mjs') },
  ...requiredVPaths.map(relPath => ({ name: `restore allowlists ${relPath}`, passed: restoreSource.includes(`'${relPath}'`) })),
  ...requiredPatchPaths.map(relPath => ({ name: `restore allowlists ${relPath}`, passed: restoreSource.includes(`'${relPath}'`) })),
  { name: 'restore script excludes release/patch56 folder', passed: !restoreSource.includes("'release/patch56'") && !restoreSource.includes('"release/patch56"') },
  { name: 'restore script excludes release/current-platform-status.md', passed: !restoreSource.includes('release/current-platform-status.md') },
  { name: 'restore script excludes release/current-proof-command-index.md', passed: !restoreSource.includes('release/current-proof-command-index.md') },
  { name: 'proof command index exists', passed: exists('release/current-proof-command-index.md') },
  { name: 'validation runbook exists', passed: exists('release/current-validation-runbook.md') },
  { name: 'proof command index references before PR checks', passed: proofIndex.includes('Before PR') && proofIndex.includes('npm run patch55:all') && proofIndex.includes('npm run release:restore-noise') },
  { name: 'validation runbook warns against git add dot', passed: runbook.includes('Never use `git add .`') },
  { name: 'current platform status mentions Patch 56', passed: statusDoc.includes('Patch 56') },
  { name: 'current platform status keeps hospital production caveat', passed: statusDoc.includes('live department launch evidence') && statusDoc.includes('training adoption') && statusDoc.includes('policy/SOP attestations') && statusDoc.includes('support readiness') && statusDoc.includes('backup and restore evidence') },
  { name: 'proof:all remains present', passed: typeof scripts['proof:all'] === 'string' && scripts['proof:all'].includes('v700-proof-suite') },
  { name: 'v700:runtime-security remains present', passed: typeof scripts['v700:runtime-security'] === 'string' && scripts['v700:runtime-security'].includes('v700-runtime-security-bridge-audit') },
  { name: 'patch55:all remains present', passed: typeof scripts['patch55:all'] === 'string' && scripts['patch55:all'].includes('patch55:schema-proof') },
  ...expectedProofScripts.map(relPath => ({ name: `existing proof script remains: ${relPath}`, passed: exists(relPath) })),
  ...newTextFiles.map(relPath => ({ name: `no conflict markers: ${relPath}`, passed: hasNoConflictMarkers(relPath) })),
  { name: 'no fake/demo records introduced', passed: fakeRecordFindings.length === 0, findings: fakeRecordFindings },
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
