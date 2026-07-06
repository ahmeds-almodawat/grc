import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.cwd();
const proofDir = path.join(repoRoot, 'release', 'patch82b');
const proofPath = path.join(proofDir, 'patch82b-interactive-dashboard-ui-polish-proof.json');

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function exists(relativePath) {
  return existsSync(path.join(repoRoot, relativePath));
}

function gitOutput(command) {
  try {
    return execSync(command, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
}

function addCheck(checks, name, passed, details = '') {
  checks.push({ name, passed: Boolean(passed), details });
}

const checks = [];
const packageJson = JSON.parse(read('package.json'));
const packageText = read('package.json');
const readinessPage = read('src/pages/ProductionReadinessCenter.tsx');
const operatorPage = read('src/pages/ProductionOperatorConsole.tsx');
const summary = read('release/patch82b/patch82b-interactive-dashboard-ui-polish-summary.md');
const audit = read('release/patch82b/patch82b-ui-polish-audit.md');
const validationReport = read('release/patch82b/patch82b-validation-report.md');
const platformStatus = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbook = read('release/current-validation-runbook.md');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');
const patch82Summary = read('release/patch82/patch82-staging-migration-rehearsal-evidence-summary.md');
const patch81Runbook = read('release/patch81/patch81-controlled-migration-deployment-runbook.md');
const guardedDiff = gitOutput('git diff -- src package.json supabase/functions supabase/migrations');
const migrationDiff = gitOutput('git diff --name-only -- supabase/migrations');
const uiDiff = gitOutput('git diff -- src/pages/ProductionReadinessCenter.tsx src/pages/ProductionOperatorConsole.tsx');
const docs = [summary, audit, validationReport, platformStatus, proofIndex, runbook].join('\n');
const migrationFiles = existsSync(path.join(repoRoot, 'supabase', 'migrations'))
  ? readdirSync(path.join(repoRoot, 'supabase', 'migrations'))
  : [];

addCheck(checks, 'package.json contains patch82b:proof', packageJson.scripts?.['patch82b:proof'] === 'node scripts/patch82b-interactive-dashboard-ui-polish-proof.mjs');
addCheck(checks, 'package.json contains patch82b:all', packageJson.scripts?.['patch82b:all'] === 'npm run validate:build && npm run validate:security && npm run patch82b:proof');
addCheck(checks, 'no Patch 82B migration was added', !migrationFiles.some(file => /patch82b|interactive_dashboard_ui_polish/i.test(file)));
addCheck(checks, 'no Supabase migration file was modified for Patch 82B', migrationDiff.trim() === '');
addCheck(checks, 'ProductionReadinessCenter still exists', exists('src/pages/ProductionReadinessCenter.tsx'));
addCheck(checks, 'ProductionOperatorConsole still exists', exists('src/pages/ProductionOperatorConsole.tsx'));
addCheck(checks, 'safe UI interaction primitive exists in optimized dashboard files', /\b(useMemo|useCallback|useState|selected|filter|active)\b/.test(readinessPage + operatorPage));
addCheck(checks, 'ProductionReadinessCenter has interactive focus cards', /dashboardFocusCards/.test(readinessPage) && /setActiveTab\(card\.tab\)/.test(readinessPage));
addCheck(checks, 'ProductionOperatorConsole has local filters and selected details', /activeFocus/.test(operatorPage) && /departmentSearch/.test(operatorPage) && /selectedDepartment/.test(operatorPage));
addCheck(checks, 'Patch 82B summary exists', exists('release/patch82b/patch82b-interactive-dashboard-ui-polish-summary.md'));
addCheck(checks, 'Patch 82B UI polish audit exists', exists('release/patch82b/patch82b-ui-polish-audit.md'));
addCheck(checks, 'Patch 82B validation report exists', exists('release/patch82b/patch82b-validation-report.md'));
addCheck(checks, 'current-platform-status mentions Patch 82B', /Patch 82B/.test(platformStatus));
addCheck(checks, 'docs say frontend-only', /Frontend-only patch/i.test(audit) && /frontend-only/i.test(summary));
addCheck(checks, 'docs say no Supabase migration applied', /No Supabase migration applied/i.test(audit + summary));
addCheck(checks, 'docs say staging rehearsal remains pending', /Staging rehearsal remains pending/i.test(summary) && /staging migration rehearsal/i.test(audit));
addCheck(checks, 'production caveat remains', /Production Caveat/.test(platformStatus) && /do not automatically launch the system/i.test(platformStatus));
addCheck(checks, 'no production launched wording exists', !/production launched/i.test(docs + guardedDiff));
addCheck(checks, 'no go-live complete wording exists', !/go-live complete/i.test(docs + guardedDiff));
addCheck(checks, 'no system is production ready claim exists', !/system is production ready/i.test(docs + guardedDiff));
addCheck(checks, 'no transition_to_live_operations exists', !/transition_to_live_operations/i.test(docs + guardedDiff));
addCheck(checks, 'no service-role frontend exposure exists', !/(SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|service_role_key|createClient\([^)]*service[_-]?role)/i.test(guardedDiff));
addCheck(checks, 'no fake/demo success data added', !/\b(fake|demo)\b/i.test(uiDiff + summary + audit));
addCheck(checks, 'Patch 82 staging rehearsal evidence wording remains', /staging migration rehearsal evidence/i.test(patch82Summary) && /Patch 82/.test(platformStatus));
addCheck(checks, 'Patch 81 controlled migration deployment runbook wording remains', /controlled migration deployment runbook/i.test(patch81Runbook) && /Patch 81/.test(platformStatus));
addCheck(checks, 'Patch 80A performance optimization wording remains', /Patch 80A/.test(platformStatus) && /performance/i.test(platformStatus));
addCheck(checks, 'Patch 79 production operations/hypercare wording remains', /Patch 79/.test(platformStatus) && /hypercare/i.test(platformStatus));
addCheck(checks, 'restore-noise covers Patch 82 proof JSON', restoreNoise.includes('release/patch82/patch82-staging-migration-rehearsal-evidence-proof.json'));
addCheck(checks, 'validate:fast exists', Boolean(packageJson.scripts?.['validate:fast']));
addCheck(checks, 'validate:build exists', Boolean(packageJson.scripts?.['validate:build']));
addCheck(checks, 'validate:security exists', Boolean(packageJson.scripts?.['validate:security']));
addCheck(checks, 'validate:release exists', Boolean(packageJson.scripts?.['validate:release']));
addCheck(checks, 'proof:all exists', Boolean(packageJson.scripts?.['proof:all']));
addCheck(checks, 'v700:runtime-security exists', Boolean(packageJson.scripts?.['v700:runtime-security']));
addCheck(checks, 'release:restore-noise exists', Boolean(packageJson.scripts?.['release:restore-noise']));
addCheck(checks, 'proof command index mentions Patch 82B', /patch82b:proof/.test(proofIndex) && /patch82b:all/.test(proofIndex));
addCheck(checks, 'validation runbook mentions frontend-only UI polish', /frontend-only UI polish/i.test(runbook) && /Patch 82B/.test(runbook));
addCheck(checks, 'patch82b:all does not run validate:release', !String(packageJson.scripts?.['patch82b:all'] ?? '').includes('validate:release'));
addCheck(checks, 'no conflict markers', !/^(<<<<<<<|=======|>>>>>>>)$/m.test(packageText + readinessPage + operatorPage + docs + restoreNoise));

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '82B',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

mkdirSync(proofDir, { recursive: true });
writeFileSync(proofPath, `${JSON.stringify(result, null, 2)}\n`);

if (failed.length) {
  console.error(`Patch 82B interactive dashboard UI polish proof failed. (${failed.length} failures)`);
  for (const check of failed) {
    console.error(`- ${check.name}${check.details ? `: ${check.details}` : ''}`);
  }
  process.exit(1);
}

console.log(`Patch 82B interactive dashboard UI polish proof passed. (${checks.length} checks)`);
