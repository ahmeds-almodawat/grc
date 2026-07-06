import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.cwd();
const proofDir = path.join(repoRoot, 'release', 'patch81');
const proofPath = path.join(proofDir, 'patch81-controlled-migration-deployment-runbook-proof.json');

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
const runbook = read('release/patch81/patch81-controlled-migration-deployment-runbook.md');
const preflight = read('release/patch81/patch81-preflight-checklist.md');
const postApply = read('release/patch81/patch81-post-apply-verification-checklist.md');
const rollback = read('release/patch81/patch81-rollback-containment-plan.md');
const evidence = read('release/patch81/patch81-evidence-capture-template.md');
const validationReport = read('release/patch81/patch81-validation-report.md');
const summary = read('release/patch81/patch81-summary.md');
const platformStatus = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbookIndex = read('release/current-validation-runbook.md');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');
const srcDiff = gitOutput('git diff -- src package.json supabase/functions supabase/migrations');
const allPatchText = [runbook, preflight, postApply, rollback, evidence, validationReport, summary, platformStatus, proofIndex, runbookIndex].join('\n');
const migrationFiles = existsSync(path.join(repoRoot, 'supabase', 'migrations'))
  ? readdirSync(path.join(repoRoot, 'supabase', 'migrations'))
  : [];

addCheck(checks, 'package.json contains patch81:proof', packageJson.scripts?.['patch81:proof'] === 'node scripts/patch81-controlled-migration-deployment-runbook-proof.mjs');
addCheck(checks, 'package.json contains patch81:all', packageJson.scripts?.['patch81:all'] === 'npm run validate:build && npm run validate:security && npm run patch81:proof');
addCheck(checks, 'no Patch 81 migration was added', !migrationFiles.some(file => /patch81|controlled_migration_deployment_runbook/i.test(file)));
addCheck(checks, 'migration 118 exists', exists('supabase/migrations/118_patch76_controlled_production_authority_cutover_gate.sql'));
addCheck(checks, 'migration 119 exists', exists('supabase/migrations/119_patch77_live_pilot_execution_issue_burndown.sql'));
addCheck(checks, 'migration 120 exists', exists('supabase/migrations/120_patch78_identity_role_data_integrity_hardening.sql'));
addCheck(checks, 'migration 121 exists', exists('supabase/migrations/121_patch79_production_operations_hypercare_board_pack.sql'));
addCheck(checks, 'runbook file exists', exists('release/patch81/patch81-controlled-migration-deployment-runbook.md'));
addCheck(checks, 'preflight checklist exists', exists('release/patch81/patch81-preflight-checklist.md'));
addCheck(checks, 'post-apply verification checklist exists', exists('release/patch81/patch81-post-apply-verification-checklist.md'));
addCheck(checks, 'rollback containment plan exists', exists('release/patch81/patch81-rollback-containment-plan.md'));
addCheck(checks, 'evidence capture template exists', exists('release/patch81/patch81-evidence-capture-template.md'));
addCheck(checks, 'validation report exists', exists('release/patch81/patch81-validation-report.md'));
addCheck(checks, 'summary exists', exists('release/patch81/patch81-summary.md'));
addCheck(checks, 'migration order mentions 118, 119, 120, 121', /118_patch76[\s\S]*119_patch77[\s\S]*120_patch78[\s\S]*121_patch79/.test(runbook));
addCheck(checks, 'staging-first plan exists', /Staging-First Plan/.test(runbook) && /staging first/i.test(runbook));
addCheck(checks, 'backup requirement exists', /Backup first/i.test(runbook) && /Database backup is complete/i.test(preflight));
addCheck(checks, 'post-apply verification includes RLS checks', /RLS is enabled on all new tables/i.test(postApply));
addCheck(checks, 'post-apply verification includes privileged bridge checks', /Privileged bridge checks passed/i.test(postApply) && /Privileged RPCs are not callable directly by browser clients/i.test(postApply));
addCheck(checks, 'rollback plan avoids destructive automatic drops', /Do not destructively drop tables automatically/i.test(rollback) && /Do not automatically drop tables/i.test(rollback));
addCheck(checks, 'evidence template states deployment evidence does not equal production launch approval', /Deployment evidence does not equal production launch approval/i.test(evidence));
addCheck(checks, 'current platform status mentions Patch 81', /Patch 81/.test(platformStatus));
addCheck(checks, 'current validation runbook mentions Patch 81', /Patch 81/.test(runbookIndex));
addCheck(checks, 'proof command index mentions Patch 81', /patch81:proof/.test(proofIndex) && /patch81:all/.test(proofIndex));
addCheck(checks, 'restore-noise covers Patch 80A proof JSON', restoreNoise.includes('release/patch80a/patch80a-performance-smoothness-optimization-proof.json'));
addCheck(checks, 'no transition_to_live_operations exists', !/transition_to_live_operations/i.test(allPatchText + srcDiff));
addCheck(checks, 'no production launched wording exists', !/production launched/i.test(allPatchText + srcDiff));
addCheck(checks, 'no go-live complete wording exists', !/go-live complete/i.test(allPatchText + srcDiff));
addCheck(checks, 'no system is production ready claim exists', !/system is production ready/i.test(allPatchText + srcDiff));
addCheck(checks, 'no service-role frontend exposure exists', !/(SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|service_role_key|createClient\([^)]*service[_-]?role)/i.test(srcDiff));
addCheck(checks, 'no fake/demo records were added', !/\b(fake|demo)\b/i.test(srcDiff));
addCheck(checks, 'validate:build exists', Boolean(packageJson.scripts?.['validate:build']));
addCheck(checks, 'validate:security exists', Boolean(packageJson.scripts?.['validate:security']));
addCheck(checks, 'validate:release exists', Boolean(packageJson.scripts?.['validate:release']));
addCheck(checks, 'proof:all exists', Boolean(packageJson.scripts?.['proof:all']));
addCheck(checks, 'release:restore-noise exists', Boolean(packageJson.scripts?.['release:restore-noise']));
addCheck(checks, 'patch81:all does not run validate:release', !String(packageJson.scripts?.['patch81:all'] ?? '').includes('validate:release'));
addCheck(checks, 'no conflict markers', !/^(<<<<<<<|=======|>>>>>>>)$/m.test(packageText + allPatchText + restoreNoise));

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '81',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

mkdirSync(proofDir, { recursive: true });
writeFileSync(proofPath, `${JSON.stringify(result, null, 2)}\n`);

if (failed.length) {
  console.error(`Patch 81 controlled migration deployment runbook proof failed. (${failed.length} failures)`);
  for (const check of failed) {
    console.error(`- ${check.name}${check.details ? `: ${check.details}` : ''}`);
  }
  process.exit(1);
}

console.log(`Patch 81 controlled migration deployment runbook proof passed. (${checks.length} checks)`);
