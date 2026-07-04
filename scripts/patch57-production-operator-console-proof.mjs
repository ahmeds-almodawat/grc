import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'release', 'patch57', 'patch57-production-operator-console-proof.json');

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

const pageRel = 'src/pages/ProductionOperatorConsole.tsx';
const apiRel = 'src/lib/productionOperatorConsoleApi.ts';
const appSource = read('src/App.tsx');
const layoutSource = read('src/components/Layout.tsx');
const accessSource = read('src/auth/authAccess.ts');
const i18nSource = read('src/i18n/I18nContext.tsx');
const pageSource = exists(pageRel) ? read(pageRel) : '';
const apiSource = exists(apiRel) ? read(apiRel) : '';
const pkg = JSON.parse(read('package.json'));
const statusDoc = read('release/current-platform-status.md');

const requiredSections = [
  'Today’s Operating Status',
  'Critical Blockers',
  'Department Rollout Readiness',
  'Hypercare and Support',
  'Access, Security, and Governance',
  'Backup, Restore, and DR Readiness',
  'Adoption, Training, and Policy/SOP',
  'Executive Action Queue',
  'Department-Level Register',
];

const requiredApiFunctions = [
  'getHospitalOperationsReadinessOverlay',
  'getProductionHypercareOverlay',
  'getRuntimeAccessReviewOverlay',
  'getBackupRestoreOperationsDashboard',
  'getPilotClosureGoLiveOverlay',
  'getHospitalDepartmentLaunchPacks',
  'getHospitalOperationsLaunchBlockers',
  'getHospitalAdoptionReadinessReviews',
  'getHospitalPolicyAttestationReadiness',
  'getHospitalSupportReadinessRecords',
];

const bannedUiTerms = [
  'patch',
  'proof',
  'rpc',
  'schema',
  'migration',
  'edge bridge',
  'scaffold',
  'mock',
  'demo',
  'unknown_requires_review',
];

function visibleStrings(source) {
  const strings = [];
  const pattern = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = pattern.exec(source))) strings.push(match[2]);
  return strings.map(value => value.trim()).filter(Boolean);
}

const uiTermFindings = visibleStrings(pageSource)
  .filter(value => /[A-Za-z]/.test(value))
  .map(value => ({ value, normalized: value.toLowerCase() }))
  .filter(({ normalized }) => bannedUiTerms.some(term => normalized.includes(term)));

const fakeRecordFindings = [pageRel, apiRel]
  .filter(exists)
  .filter(relPath => /\b(seed|insert)\b|\bfake\s+record\b|\bdemo\s+record\b|\bfallback\s+record\b/i.test(read(relPath)));

const conflictFiles = [
  'package.json',
  'src/App.tsx',
  'src/components/Layout.tsx',
  'src/auth/authAccess.ts',
  'src/i18n/I18nContext.tsx',
  apiRel,
  pageRel,
  'scripts/patch57-production-operator-console-proof.mjs',
  'release/current-platform-status.md',
  'release/patch57/patch57-implementation-summary.md',
  'release/patch57/patch57-validation-report.md',
].filter(exists).filter(relPath => /^(<<<<<<<|=======|>>>>>>>)$/m.test(read(relPath)));

const migrationFiles = listFiles('supabase/migrations', relPath => /patch57|114_patch57/i.test(relPath));
const scripts = pkg.scripts || {};

const checks = [
  { name: 'no Patch 57 migration exists', passed: migrationFiles.length === 0, findings: migrationFiles },
  { name: 'console page exists', passed: exists(pageRel) },
  { name: 'console API wrapper exists', passed: exists(apiRel) },
  { name: 'route /production-operator-console exists', passed: appSource.includes("'/production-operator-console'") },
  { name: 'navigation label Production Operator Console exists', passed: i18nSource.includes('Production Operator Console') },
  { name: 'page key added to layout', passed: layoutSource.includes('productionOperatorConsole') },
  { name: 'access control maps console to authorized group', passed: accessSource.includes("productionOperatorConsole: 'release'") },
  ...requiredSections.map(section => ({ name: `console section: ${section}`, passed: pageSource.includes(section) })),
  { name: 'professional empty/evidence states exist', passed: pageSource.includes('Evidence has not been recorded.') && pageSource.includes('Review required.') && pageSource.includes('Awaiting owner action.') && pageSource.includes('No blocker currently recorded.') },
  { name: 'console has no banned operational UI wording', passed: uiTermFindings.length === 0, findings: uiTermFindings },
  { name: 'console has no fake/demo records', passed: fakeRecordFindings.length === 0, findings: fakeRecordFindings },
  ...requiredApiFunctions.map(name => ({ name: `uses existing readiness API: ${name}`, passed: apiSource.includes(name) })),
  { name: 'package patch57:proof exists', passed: scripts['patch57:proof'] === 'node scripts/patch57-production-operator-console-proof.mjs' },
  { name: 'package patch57:all exists', passed: typeof scripts['patch57:all'] === 'string' && scripts['patch57:all'].includes('patch56:all') && scripts['patch57:all'].includes('proof:all') && scripts['patch57:all'].includes('v700:runtime-security') },
  { name: 'current platform status mentions Patch 57', passed: statusDoc.includes('Patch 57') },
  { name: 'current platform status keeps production caveat', passed: statusDoc.includes('live department launch evidence') && statusDoc.includes('user training adoption') && statusDoc.includes('policy/SOP attestations') && statusDoc.includes('support readiness') && statusDoc.includes('DR restore evidence') && statusDoc.includes('executive') },
  { name: 'proof:all remains present', passed: typeof scripts['proof:all'] === 'string' && scripts['proof:all'].includes('v700-proof-suite') },
  { name: 'v700:runtime-security remains present', passed: typeof scripts['v700:runtime-security'] === 'string' && scripts['v700:runtime-security'].includes('v700-runtime-security-bridge-audit') },
  { name: 'patch56:all remains present', passed: typeof scripts['patch56:all'] === 'string' && scripts['patch56:all'].includes('patch56:proof') },
  { name: 'release:restore-noise remains present', passed: scripts['release:restore-noise'] === 'node scripts/restore-generated-release-noise.mjs' },
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
