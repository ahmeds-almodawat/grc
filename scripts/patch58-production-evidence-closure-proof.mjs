import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'release', 'patch58', 'patch58-production-evidence-closure-proof.json');

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

const pageRel = 'src/pages/ProductionEvidenceClosureCenter.tsx';
const apiRel = 'src/lib/productionEvidenceClosureApi.ts';
const operatorRel = 'src/pages/ProductionOperatorConsole.tsx';
const pageSource = exists(pageRel) ? read(pageRel) : '';
const apiSource = exists(apiRel) ? read(apiRel) : '';
const operatorSource = exists(operatorRel) ? read(operatorRel) : '';
const appSource = read('src/App.tsx');
const layoutSource = read('src/components/Layout.tsx');
const accessSource = read('src/auth/authAccess.ts');
const i18nSource = read('src/i18n/I18nContext.tsx');
const pkg = JSON.parse(read('package.json'));
const statusDoc = read('release/current-platform-status.md');

const requiredSections = [
  'Evidence Closure Overview',
  'Evidence Intake Queue',
  'Evidence Detail',
  'Department Evidence Register',
  'Executive Closure Pack',
];

const requiredStates = [
  'Evidence has not been recorded.',
  'Review required.',
  'Awaiting owner action.',
  'No blocker currently recorded.',
  'No closure action is available from this screen.',
];

const requiredApiFunctions = [
  'getHospitalDepartmentLaunchPacks',
  'getHospitalOperationsLaunchBlockers',
  'getHospitalSupportReadinessRecords',
  'getHospitalPolicyAttestationReadiness',
  'getHospitalAdoptionReadinessReviews',
  'getBackupRestoreOperationsDashboard',
  'getRuntimeAccessReviewBlockers',
  'getProductionReadinessSignoffRegister',
  'getKnownLimitationsRegister',
  'getBlockingLimitations',
  'getPilotAcceptedLimitations',
  'getProductionGoLiveDecisions',
  'getProductionHypercareBlockers',
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
  operatorRel,
  apiRel,
  pageRel,
  'scripts/patch58-production-evidence-closure-proof.mjs',
  'release/current-platform-status.md',
  'release/patch58/patch58-implementation-summary.md',
  'release/patch58/patch58-validation-report.md',
].filter(exists).filter(relPath => /^(<<<<<<<|=======|>>>>>>>)$/m.test(read(relPath)));

const migrationFiles = listFiles('supabase/migrations', relPath => /patch58|114_patch58/i.test(relPath));
const scripts = pkg.scripts || {};

const checks = [
  { name: 'no Patch 58 migration exists', passed: migrationFiles.length === 0, findings: migrationFiles },
  { name: 'closure page exists', passed: exists(pageRel) },
  { name: 'closure API wrapper exists', passed: exists(apiRel) },
  { name: 'route /production-evidence-closure exists', passed: appSource.includes("'/production-evidence-closure'") },
  { name: 'navigation label Production Evidence Closure exists', passed: i18nSource.includes('Production Evidence Closure') },
  { name: 'page key added to layout', passed: layoutSource.includes('productionEvidenceClosure') },
  { name: 'access control maps closure page to authorized group', passed: accessSource.includes("productionEvidenceClosure: 'release'") },
  { name: 'operator console links to closure page', passed: operatorSource.includes('productionEvidenceClosure') && operatorSource.includes('Production Evidence Closure') },
  { name: 'closure page links to Production Readiness Center', passed: pageSource.includes("setPage('productionReadiness')") && pageSource.includes('Production Readiness Center') },
  { name: 'closure page links back to Production Operator Console', passed: pageSource.includes("setPage('productionOperatorConsole')") && pageSource.includes('Production Operator Console') },
  ...requiredSections.map(section => ({ name: `closure section: ${section}`, passed: pageSource.includes(section) })),
  { name: 'professional empty/evidence states exist', passed: requiredStates.every(state => pageSource.includes(state)) },
  { name: 'operational UI has no banned technical wording', passed: uiTermFindings.length === 0, findings: uiTermFindings },
  { name: 'page and API have no fake/demo/fallback records', passed: fakeRecordFindings.length === 0, findings: fakeRecordFindings },
  ...requiredApiFunctions.map(name => ({ name: `uses existing readiness/evidence API: ${name}`, passed: apiSource.includes(name) })),
  { name: 'package patch58:proof exists', passed: scripts['patch58:proof'] === 'node scripts/patch58-production-evidence-closure-proof.mjs' },
  { name: 'package patch58:all exists', passed: typeof scripts['patch58:all'] === 'string' && scripts['patch58:all'].includes('patch57:all') && scripts['patch58:all'].includes('proof:all') && scripts['patch58:all'].includes('v700:runtime-security') },
  { name: 'current platform status mentions Patch 58', passed: statusDoc.includes('Patch 58') && statusDoc.includes('Production Evidence Capture & Closure Workflow') },
  { name: 'current platform status keeps production caveat', passed: statusDoc.includes('live department launch evidence') && statusDoc.includes('user training adoption') && statusDoc.includes('policy/SOP attestations') && statusDoc.includes('support readiness') && statusDoc.includes('DR restore evidence') && statusDoc.includes('executive signoff') },
  { name: 'proof:all remains present', passed: typeof scripts['proof:all'] === 'string' && scripts['proof:all'].includes('v700-proof-suite') },
  { name: 'v700:runtime-security remains present', passed: typeof scripts['v700:runtime-security'] === 'string' && scripts['v700:runtime-security'].includes('v700-runtime-security-bridge-audit') },
  { name: 'patch57:all remains present', passed: typeof scripts['patch57:all'] === 'string' && scripts['patch57:all'].includes('patch57:proof') },
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
