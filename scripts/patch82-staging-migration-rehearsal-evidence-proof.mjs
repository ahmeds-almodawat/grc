import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.cwd();
const proofDir = path.join(repoRoot, 'release', 'patch82');
const proofPath = path.join(proofDir, 'patch82-staging-migration-rehearsal-evidence-proof.json');

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
const summary = read('release/patch82/patch82-staging-migration-rehearsal-evidence-summary.md');
const checklist = read('release/patch82/patch82-staging-rehearsal-checklist.md');
const resultsTemplate = read('release/patch82/patch82-staging-rehearsal-results-template.md');
const sqlSnippets = read('release/patch82/patch82-staging-sql-verification-snippets.sql');
const rollback = read('release/patch82/patch82-staging-rehearsal-rollback-containment.md');
const validationReport = read('release/patch82/patch82-validation-report.md');
const platformStatus = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbook = read('release/current-validation-runbook.md');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');
const patch81Runbook = read('release/patch81/patch81-controlled-migration-deployment-runbook.md');
const guardedDiff = gitOutput('git diff -- src package.json supabase/functions supabase/migrations');
const allDocs = [summary, checklist, resultsTemplate, sqlSnippets, rollback, validationReport, platformStatus, proofIndex, runbook].join('\n');
const migrationFiles = existsSync(path.join(repoRoot, 'supabase', 'migrations'))
  ? readdirSync(path.join(repoRoot, 'supabase', 'migrations'))
  : [];

addCheck(checks, 'package.json contains patch82:proof', packageJson.scripts?.['patch82:proof'] === 'node scripts/patch82-staging-migration-rehearsal-evidence-proof.mjs');
addCheck(checks, 'package.json contains patch82:all', packageJson.scripts?.['patch82:all'] === 'npm run validate:build && npm run validate:security && npm run patch82:proof');
addCheck(checks, 'no Patch 82 migration was added', !migrationFiles.some(file => /patch82|staging_migration_rehearsal/i.test(file)));
addCheck(checks, 'migration 118 still exists', exists('supabase/migrations/118_patch76_controlled_production_authority_cutover_gate.sql'));
addCheck(checks, 'migration 119 still exists', exists('supabase/migrations/119_patch77_live_pilot_execution_issue_burndown.sql'));
addCheck(checks, 'migration 120 still exists', exists('supabase/migrations/120_patch78_identity_role_data_integrity_hardening.sql'));
addCheck(checks, 'migration 121 still exists', exists('supabase/migrations/121_patch79_production_operations_hypercare_board_pack.sql'));
addCheck(checks, 'migrations 118-121 were not modified', !/supabase\/migrations\/(118|119|120|121)_/.test(gitOutput('git diff --name-only')));
addCheck(checks, 'patch82 summary exists', exists('release/patch82/patch82-staging-migration-rehearsal-evidence-summary.md'));
addCheck(checks, 'staging checklist exists', exists('release/patch82/patch82-staging-rehearsal-checklist.md'));
addCheck(checks, 'staging results template exists', exists('release/patch82/patch82-staging-rehearsal-results-template.md'));
addCheck(checks, 'SQL verification snippets exist', exists('release/patch82/patch82-staging-sql-verification-snippets.sql'));
addCheck(checks, 'rollback/containment doc exists', exists('release/patch82/patch82-staging-rehearsal-rollback-containment.md'));
addCheck(checks, 'validation report exists', exists('release/patch82/patch82-validation-report.md'));
addCheck(checks, 'all Patch 82 docs use staging-only wording', /staging-only/i.test(summary) && /Staging/.test(checklist) && /staging/i.test(resultsTemplate) && /staging-only/i.test(sqlSnippets));
addCheck(checks, 'production deployment is explicitly out of scope', /Production is explicitly out of scope/i.test(summary));
addCheck(checks, 'no fake success wording exists', !/successful staging result|staging succeeded|pre-filled success|fake success/i.test(allDocs));
addCheck(checks, 'no staging passed claim exists', !/staging passed/i.test(allDocs));
addCheck(checks, 'no production launched wording exists', !/production launched/i.test(allDocs + guardedDiff));
addCheck(checks, 'no go-live complete wording exists', !/go-live complete/i.test(allDocs + guardedDiff));
addCheck(checks, 'no system is production ready claim exists', !/system is production ready/i.test(allDocs + guardedDiff));
addCheck(checks, 'no transition_to_live_operations exists', !/transition_to_live_operations/i.test(allDocs + guardedDiff));
addCheck(checks, 'no service-role frontend exposure exists', !/(SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|service_role_key|createClient\([^)]*service[_-]?role)/i.test(guardedDiff));
addCheck(checks, 'no RLS weakening wording exists', !/disable\s+rls|disable\s+row\s+level\s+security|bypass\s+rls/i.test(allDocs + guardedDiff));
addCheck(checks, 'Patch 81 controlled migration deployment runbook wording remains', /controlled migration deployment runbook/i.test(patch81Runbook) && /Patch 81/.test(platformStatus));
addCheck(checks, 'Patch 80A performance optimization wording remains', /Patch 80A/.test(platformStatus) && /performance/i.test(platformStatus));
addCheck(checks, 'Patch 79 production operations/hypercare wording remains', /Patch 79/.test(platformStatus) && /hypercare/i.test(platformStatus));
addCheck(checks, 'restore-noise covers Patch 80A proof JSON', restoreNoise.includes('release/patch80a/patch80a-performance-smoothness-optimization-proof.json'));
addCheck(checks, 'current platform status mentions Patch 82', /Patch 82/.test(platformStatus));
addCheck(checks, 'production caveat remains', /Production Caveat/.test(platformStatus) && /do not automatically launch the system/i.test(platformStatus));
addCheck(checks, 'validate:fast exists', Boolean(packageJson.scripts?.['validate:fast']));
addCheck(checks, 'validate:build exists', Boolean(packageJson.scripts?.['validate:build']));
addCheck(checks, 'validate:security exists', Boolean(packageJson.scripts?.['validate:security']));
addCheck(checks, 'validate:release exists', Boolean(packageJson.scripts?.['validate:release']));
addCheck(checks, 'proof:all exists', Boolean(packageJson.scripts?.['proof:all']));
addCheck(checks, 'v700:runtime-security exists', Boolean(packageJson.scripts?.['v700:runtime-security']));
addCheck(checks, 'release:restore-noise exists', Boolean(packageJson.scripts?.['release:restore-noise']));
addCheck(checks, 'proof command index mentions Patch 82', /patch82:proof/.test(proofIndex) && /patch82:all/.test(proofIndex));
addCheck(checks, 'validation runbook mentions staging migration rehearsal evidence', /staging migration rehearsal evidence/i.test(runbook) && /Patch 82/.test(runbook));
addCheck(checks, 'patch82:all does not run validate:release', !String(packageJson.scripts?.['patch82:all'] ?? '').includes('validate:release'));
addCheck(checks, 'no conflict markers', !/^(<<<<<<<|=======|>>>>>>>)$/m.test(packageText + allDocs + restoreNoise));

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '82',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

mkdirSync(proofDir, { recursive: true });
writeFileSync(proofPath, `${JSON.stringify(result, null, 2)}\n`);

if (failed.length) {
  console.error(`Patch 82 staging migration rehearsal evidence proof failed. (${failed.length} failures)`);
  for (const check of failed) {
    console.error(`- ${check.name}${check.details ? `: ${check.details}` : ''}`);
  }
  process.exit(1);
}

console.log(`Patch 82 staging migration rehearsal evidence proof passed. (${checks.length} checks)`);
