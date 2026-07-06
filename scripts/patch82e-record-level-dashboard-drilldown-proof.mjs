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
const departments = read('src/pages/Departments.tsx');
const layout = read('src/components/Layout.tsx');
const app = read('src/App.tsx');
const i18n = read('src/i18n/I18nContext.tsx');
const styles = read('src/styles.css');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');
const statusDoc = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbook = read('release/current-validation-runbook.md');
const summary = read('release/patch82e/patch82e-record-level-dashboard-drilldown-summary.md');
const audit = read('release/patch82e/patch82e-ui-drilldown-audit.md');
const validation = read('release/patch82e/patch82e-validation-report.md');
const changedFiles = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean);
const sourceUiText = [departments, layout, app, i18n, styles].join('\n');
const docsText = [summary, audit, validation, statusDoc, proofIndex, runbook].join('\n');

check('package.json contains patch82e:proof', packageJson.includes('"patch82e:proof": "node scripts/patch82e-record-level-dashboard-drilldown-proof.mjs"'));
check('package.json contains patch82e:all', packageJson.includes('"patch82e:all": "npm run validate:build && npm run validate:security && npm run patch82e:proof"'));
check('no Patch 82E migration was added', !changedFiles.some(path => /supabase[\\/]migrations[\\/].*82e/i.test(path)));
check('no Supabase migration files modified', !changedFiles.some(path => path.replaceAll('\\', '/').startsWith('supabase/migrations/')));
check('Departments page still exists', exists('src/pages/Departments.tsx'));
check('Department Control Room title remains', /Department control room/i.test(departments) && /Master tracking across departments/i.test(departments));
check('non-zero metric drilldown/clickable implementation exists', /handleMetricClick/.test(departments) && /Open \$\{row\.critical_risks\} critical risks/.test(departments));
check('zero cells are guarded/non-clickable', /row\.overdue_projects \? <button[\s\S]*: '0'/.test(departments) && /row\.critical_risks \? <button[\s\S]*: '0'/.test(departments));
check('selected department drilldown exists', /Selected department drilldown/i.test(departments));
check('drawer/modal/detail wording exists', /<Modal open=\{!!drilldownContext\}/.test(departments) && /The count is calculated from department control indicators/.test(departments));
check('Critical risks drilldown exists', /handleMetricClick\('criticalRisks'/.test(departments));
check('Next action drilldown exists', /handleMetricClick\('nextAction'/.test(departments));
check('related workspace buttons or route actions exist', /Open Operations Center/.test(departments) && /Open Escalations/.test(departments) && /Open OVR Risk Indicators/.test(departments));
check('sidebar raw nav keys are not visible as labels', /nav\.workspace/.test(i18n) && /nav\.qualitySafety/.test(i18n) && /nav\.dashboards/.test(i18n));
check('top bar cleanup exists', !/topbar-pill">\{t\('app\.version'\)\}/.test(layout));
check('Patch 82E release summary exists', exists('release/patch82e/patch82e-record-level-dashboard-drilldown-summary.md'));
check('Patch 82E audit exists', exists('release/patch82e/patch82e-ui-drilldown-audit.md'));
check('Patch 82E validation report exists', exists('release/patch82e/patch82e-validation-report.md'));
check('current-platform-status mentions Patch 82E', /Patch 82E/.test(statusDoc));
check('proof command index mentions Patch 82E', /Patch 82E/.test(proofIndex));
check('validation runbook mentions Patch 82E', /Patch 82E/.test(runbook));
check('docs say frontend-only', /frontend-only/i.test(docsText));
check('docs say no Supabase migration applied', /No Supabase migration was applied/i.test(docsText));
check('docs say staging rehearsal remains pending', /staging rehearsal remains pending/i.test(docsText));
check('no production launched wording added', !/production launched/i.test(sourceUiText));
check('no go-live complete wording added', !/go-live complete/i.test(sourceUiText));
check('no system is production ready claim added', !/system is production ready/i.test(sourceUiText));
check('no transition_to_live_operations exists', !/transition_to_live_operations/i.test(sourceUiText));
check('no service-role frontend exposure exists', !/service[_ -]?role/i.test(sourceUiText));
check('no fake/demo success data added', !/fake success|demo success|seed data|synthetic success/i.test(sourceUiText));
check('restore-noise covers Patch 82C proof JSON', restoreNoise.includes('release/patch82c/patch82c-operational-dashboard-interactivity-proof.json'));
check('validate:fast exists', packageJson.includes('"validate:fast"'));
check('validate:build exists', packageJson.includes('"validate:build"'));
check('validate:security exists', packageJson.includes('"validate:security"'));
check('validate:release exists', packageJson.includes('"validate:release"'));
check('proof:all exists', packageJson.includes('"proof:all"'));
check('v700:runtime-security exists', packageJson.includes('"v700:runtime-security"'));
check('release:restore-noise exists', packageJson.includes('"release:restore-noise"'));
check('no conflict markers', !/^(<<<<<<<|=======|>>>>>>>)$/m.test([sourceUiText, docsText].join('\n')));

const failed = checks.filter(item => !item.passed);
const result = {
  patch: '82E',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks
};

const outPath = join(root, 'release/patch82e/patch82e-record-level-dashboard-drilldown-proof.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);

if (failed.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(`Patch 82E record-level dashboard drilldown proof passed. (${checks.length} checks)`);
