import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFileSync(join(root, path), 'utf8');
const exists = path => existsSync(join(root, path));

const checks = [];
function check(name, passed, details = '') {
  checks.push({ name, passed: Boolean(passed), details });
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const packageJson = read('package.json');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');
const statusDoc = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbook = read('release/current-validation-runbook.md');
const summary = read('release/patch82c/patch82c-operational-dashboard-interactivity-summary.md');
const audit = read('release/patch82c/patch82c-interactivity-audit.md');
const validation = read('release/patch82c/patch82c-validation-report.md');
const changedFiles = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean);
const changedText = changedFiles
  .filter(path => /\.(tsx?|jsx?|mjs|md|json)$/.test(path) && exists(path))
  .map(path => `${path}\n${read(path)}`)
  .join('\n');

const pageFiles = [
  'src/pages/OVR.tsx',
  'src/pages/OvrRiskIndicators.tsx',
  'src/pages/Departments.tsx',
  'src/pages/OperationsCenter.tsx',
  'src/pages/Escalations.tsx',
  'src/pages/Approvals.tsx'
];
const pageText = Object.fromEntries(pageFiles.map(path => [path, exists(path) ? read(path) : '']));
const pageInteractivityScore = pageFiles.filter(path => {
  const text = pageText[path];
  return /useState/.test(text)
    && /useMemo/.test(text)
    && /activeFilter|activeSignal/.test(text)
    && /selected/.test(text)
    && /search/i.test(text)
    && /filter/i.test(text);
}).length;

check('package.json contains patch82c:proof', packageJson.includes('"patch82c:proof": "node scripts/patch82c-operational-dashboard-interactivity-proof.mjs"'));
check('package.json contains patch82c:all', packageJson.includes('"patch82c:all": "npm run validate:build && npm run validate:security && npm run patch82c:proof"'));
check('no Patch 82C migration was added', !changedFiles.some(path => /supabase\/migrations\/.*82c|supabase\\migrations\\.*82c/i.test(path)));
check('no Supabase migration file was modified for Patch 82C', !changedFiles.some(path => path.replaceAll('\\', '/').startsWith('supabase/migrations/')));
check('OVR / Incident Management page still exists or equivalent title remains', pageText['src/pages/OVR.tsx'].includes("t('ovr.title')") || /OVR \/ Incident Management/i.test(pageText['src/pages/OVR.tsx']));
check('OVR Risk Indicators page still exists or equivalent title remains', pageText['src/pages/OvrRiskIndicators.tsx'].includes("t('ovrRisk.title')") || /OVR Risk Indicators/i.test(pageText['src/pages/OvrRiskIndicators.tsx']));
check('Department Control Room title remains', /Department control room|Master tracking across departments/i.test(pageText['src/pages/Departments.tsx']));
check('Operations & Notifications Center page remains', pageText['src/pages/OperationsCenter.tsx'].includes("t('ops.title')") || /Operations & Notifications Center/i.test(pageText['src/pages/OperationsCenter.tsx']));
check('Escalations governance follow-up title remains', /Escalations, missing delay reasons and overdue governance follow-up/i.test(pageText['src/pages/Escalations.tsx']));
check('Approvals page remains', /Pending approvals for closure, evidence, projects and governance actions/i.test(pageText['src/pages/Approvals.tsx']));
check('at least three target pages contain local interactivity primitives', pageInteractivityScore >= 3, `${pageInteractivityScore} pages`);
check('clickable KPI/filter wording exists', /dashboard filters|Risk signal filters|Active filter|Card filters/i.test(changedText));
check('reset filter wording exists', /Reset filters/i.test(changedText));
check('selected/detail panel wording exists', /Selected .*detail|drilldown|detail-panel/i.test(changedText));
check('Patch 82C summary exists', exists('release/patch82c/patch82c-operational-dashboard-interactivity-summary.md'));
check('Patch 82C audit exists', exists('release/patch82c/patch82c-interactivity-audit.md'));
check('Patch 82C validation report exists', exists('release/patch82c/patch82c-validation-report.md'));
check('current-platform-status mentions Patch 82C', /Patch 82C/.test(statusDoc));
check('proof command index mentions Patch 82C', /Patch 82C/.test(proofIndex));
check('validation runbook mentions Patch 82C', /Patch 82C/.test(runbook));
check('docs say frontend-only', /frontend-only/i.test(summary + audit + statusDoc));
check('docs say no Supabase migration applied', /No Supabase migration was applied/i.test(summary + audit + statusDoc));
check('docs say staging rehearsal remains pending', /staging rehearsal remains pending/i.test(summary + audit + statusDoc));
check('production caveat remains', /Production Caveat/i.test(statusDoc) && /do not automatically launch the system/i.test(statusDoc));
check('no production launched wording added', !/production launched/i.test(changedText));
check('no go-live complete wording added', !/go-live complete/i.test(changedText));
check('no system is production ready claim added', !/system is production ready/i.test(changedText));
check('no transition_to_live_operations exists', !/transition_to_live_operations/i.test(changedText));
check('no service-role frontend exposure exists', !/service[_ -]?role/i.test(Object.values(pageText).join('\n')));
check('no fake/demo success data added', !/fake success|demo success|seed data|synthetic success/i.test(changedText));
check('Patch 82B dashboard UI polish wording remains', /Patch 82B/.test(statusDoc));
check('Patch 82 staging rehearsal evidence wording remains', /Patch 82 scope: staging migration rehearsal evidence/i.test(statusDoc));
check('Patch 81 controlled migration deployment runbook wording remains', /Patch 81 scope: controlled Supabase migration and deployment runbook/i.test(statusDoc));
check('Patch 80A performance optimization wording remains', /Patch 80A scope: safe performance and smoothness optimization/i.test(statusDoc));
check('restore-noise covers Patch 82B proof JSON', restoreNoise.includes('release/patch82b/patch82b-interactive-dashboard-ui-polish-proof.json'));
check('validate:fast exists', packageJson.includes('"validate:fast"'));
check('validate:build exists', packageJson.includes('"validate:build"'));
check('validate:security exists', packageJson.includes('"validate:security"'));
check('validate:release exists', packageJson.includes('"validate:release"'));
check('proof:all exists', packageJson.includes('"proof:all"'));
check('v700:runtime-security exists', packageJson.includes('"v700:runtime-security"'));
check('release:restore-noise exists', packageJson.includes('"release:restore-noise"'));
check('no conflict markers', !/^(<<<<<<<|=======|>>>>>>>)$/m.test(changedText));

const failed = checks.filter(item => !item.passed);
const result = {
  patch: '82C',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks
};

const outPath = join(root, 'release/patch82c/patch82c-operational-dashboard-interactivity-proof.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);

if (failed.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(`Patch 82C operational dashboard interactivity proof passed. (${checks.length} checks)`);
