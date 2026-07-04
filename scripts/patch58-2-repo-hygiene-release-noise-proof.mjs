import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'release', 'patch58-2', 'patch58-2-repo-hygiene-release-noise-proof.json');

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
const restoreSource = read('scripts/restore-generated-release-noise.mjs');
const statusDoc = read('release/current-platform-status.md');
const appSource = read('src/App.tsx');
const layoutSource = read('src/components/Layout.tsx');

const rootFiles = fs.readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => entry.name);

const obsoleteCodexRootFiles = rootFiles.filter(name => /^codex-.*-commands\.md$/i.test(name));
const obsoleteDeployRootFiles = rootFiles.filter(name => /^PATCH.*_DEPLOY_INSTRUCTIONS\.md$/i.test(name));
const obsoleteOtherRootFiles = rootFiles.filter(name => [
  'FINAL_CLEANUP_INSTRUCTIONS.md',
  'README_CURRENT_STATUS_REPLACEMENT.md',
  'APPLY_V250.ps1',
].includes(name) || /^README_APPLY_V250_.*\.md$/i.test(name));

const conflictFiles = [
  'package.json',
  'scripts/restore-generated-release-noise.mjs',
  'scripts/patch58-2-repo-hygiene-release-noise-proof.mjs',
  'release/current-platform-status.md',
  'release/current-proof-command-index.md',
  'release/current-validation-runbook.md',
  'release/patch58-2/patch58-2-repo-hygiene-release-noise-summary.md',
  'release/patch58-2/patch58-2-validation-report.md',
  'docs/archive/legacy-patch-instructions/README.md',
].filter(exists).filter(relPath => /^(<<<<<<<|=======|>>>>>>>)$/m.test(read(relPath)));

const migrationFiles = listFiles('supabase/migrations', relPath => /patch58[-_]?2|patch59|116_patch58|117_patch59/i.test(relPath));
const patch59Files = listFiles('src', relPath => /patch59|Patch59/i.test(relPath));

const checks = [
  { name: 'no Patch 58.2 migration exists', passed: migrationFiles.length === 0, findings: migrationFiles },
  { name: 'no Patch 59 route exists', passed: !appSource.includes('patch59') && !appSource.includes('/patch59') },
  { name: 'no Patch 59 page key exists', passed: !layoutSource.includes('patch59') },
  { name: 'no Patch 59 source files exist', passed: patch59Files.length === 0, findings: patch59Files },
  { name: 'root no longer contains obsolete codex patch command markdown files', passed: obsoleteCodexRootFiles.length === 0, findings: obsoleteCodexRootFiles },
  { name: 'root no longer contains obsolete PATCH deploy instruction markdown files', passed: obsoleteDeployRootFiles.length === 0, findings: obsoleteDeployRootFiles },
  { name: 'root no longer contains obsolete one-time helper files', passed: obsoleteOtherRootFiles.length === 0, findings: obsoleteOtherRootFiles },
  { name: 'archive README exists', passed: exists('docs/archive/legacy-patch-instructions/README.md') },
  { name: 'archive README explains traceability only', passed: exists('docs/archive/legacy-patch-instructions/README.md') && read('docs/archive/legacy-patch-instructions/README.md').includes('traceability only') },
  { name: 'release:restore-noise exists', passed: scripts['release:restore-noise'] === 'node scripts/restore-generated-release-noise.mjs' },
  { name: 'restore covers Patch 56 generated proof JSON', passed: restoreSource.includes('release/patch56/patch56-proof-release-script-consolidation-proof.json') },
  { name: 'restore covers Patch 57 generated proof JSON', passed: restoreSource.includes('release/patch57/patch57-production-operator-console-proof.json') },
  { name: 'restore covers Patch 58 generated proof JSON', passed: restoreSource.includes('release/patch58/patch58-production-evidence-closure-proof.json') },
  { name: 'restore covers Patch 58.1 generated proof JSON', passed: restoreSource.includes('release/patch58-1/patch58-1-validation-runtime-optimization-proof.json') },
  { name: 'validate:fast exists', passed: typeof scripts['validate:fast'] === 'string' && scripts['validate:fast'].includes('patch58-2:proof') },
  { name: 'validate:release exists', passed: typeof scripts['validate:release'] === 'string' && scripts['validate:release'].includes('patch58-2:proof') && scripts['validate:release'].includes('proof:all') && scripts['validate:release'].includes('v700:runtime-security') },
  { name: 'proof:all exists', passed: typeof scripts['proof:all'] === 'string' && scripts['proof:all'].includes('v700-proof-suite') },
  { name: 'v700:runtime-security exists', passed: typeof scripts['v700:runtime-security'] === 'string' && scripts['v700:runtime-security'].includes('v700-runtime-security-bridge-audit') },
  { name: 'patch58-2:proof exists', passed: scripts['patch58-2:proof'] === 'node scripts/patch58-2-repo-hygiene-release-noise-proof.mjs' },
  { name: 'patch58-2:all is lightweight', passed: scripts['patch58-2:all'] === 'npm run validate:build && npm run patch58-2:proof' },
  { name: 'status doc keeps production caveat', passed: statusDoc.includes('live department launch evidence') && statusDoc.includes('user training adoption') && statusDoc.includes('policy/SOP attestations') && statusDoc.includes('support readiness') && statusDoc.includes('DR restore evidence') && statusDoc.includes('executive signoff') },
  { name: 'status doc mentions Patch 58.2 hygiene only', passed: statusDoc.includes('Patch 58.2') && statusDoc.includes('repository hygiene and release noise restore coverage only') },
  { name: 'no conflict markers', passed: conflictFiles.length === 0, findings: conflictFiles },
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
