import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.cwd();
const proofDir = path.join(repoRoot, 'release', 'patch80a');
const proofPath = path.join(proofDir, 'patch80a-performance-smoothness-optimization-proof.json');

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
const readinessApi = read('src/lib/productionReadinessApi.ts');
const restoreNoise = read('scripts/restore-generated-release-noise.mjs');
const platformStatus = read('release/current-platform-status.md');
const proofIndex = read('release/current-proof-command-index.md');
const runbook = read('release/current-validation-runbook.md');
const srcDiff = gitOutput('git diff -- src/pages/ProductionReadinessCenter.tsx src/pages/ProductionOperatorConsole.tsx src/lib/productionReadinessApi.ts src/App.tsx src/components/Layout.tsx');
const guardedDiff = gitOutput('git diff -- src package.json supabase/functions supabase/migrations');
const migrationFiles = existsSync(path.join(repoRoot, 'supabase', 'migrations'))
  ? readdirSync(path.join(repoRoot, 'supabase', 'migrations'))
  : [];

addCheck(checks, 'package.json contains patch80a:proof', packageJson.scripts?.['patch80a:proof'] === 'node scripts/patch80a-performance-smoothness-optimization-proof.mjs');
addCheck(checks, 'package.json contains patch80a:all', packageJson.scripts?.['patch80a:all'] === 'npm run validate:build && npm run validate:security && npm run patch80a:proof');
addCheck(checks, 'no migration file with patch80a was added', !migrationFiles.some(file => /patch80a/i.test(file)));
addCheck(checks, 'no new Supabase migration was added for Patch 80A', !migrationFiles.some(file => /80a|patch80a|performance_smoothness/i.test(file)));
addCheck(checks, 'no RLS wording weakened', !/disable\s+row\s+level\s+security|alter\s+table[\s\S]*disable\s+row\s+level\s+security|drop\s+policy/i.test(guardedDiff));
addCheck(checks, 'no service-role frontend exposure exists', !/(SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|service_role_key|createClient\([^)]*service[_-]?role)/i.test(readinessPage + operatorPage));
addCheck(checks, 'no transition_to_live_operations exists', !/transition_to_live_operations/i.test(readinessPage + operatorPage + readinessApi));
addCheck(checks, 'no production launched wording exists', !/production launched/i.test(readinessPage + operatorPage + readinessApi));
addCheck(checks, 'no go-live complete wording exists', !/go-live complete/i.test(readinessPage + operatorPage + readinessApi));
addCheck(checks, 'no system is production ready claim exists', !/system is production ready/i.test(readinessPage + operatorPage + readinessApi));
addCheck(checks, 'Patch 79 production operations wording remains', /Production Operations Governance/.test(readinessPage) && /Patch 79 scope/.test(platformStatus));
addCheck(checks, 'Patch 78 identity/role/data integrity wording remains', /Patch 78 scope/.test(platformStatus) && /identity, role, and data integrity/i.test(platformStatus));
addCheck(checks, 'Patch 77 live pilot execution wording remains', /Patch 77 scope/.test(platformStatus) && /live pilot execution/i.test(platformStatus));
addCheck(checks, 'Patch 76 controlled production authority wording remains', /Patch 76 scope/.test(platformStatus) && /controlled production authority/i.test(platformStatus));
addCheck(checks, 'restore-noise covers Patch 79 proof JSON', restoreNoise.includes('release/patch79/patch79-production-operations-hypercare-board-pack-proof.json'));
addCheck(checks, 'current platform status mentions Patch 80A', /Patch 80A/.test(platformStatus));
addCheck(checks, 'performance audit file exists', exists('release/patch80a/patch80a-performance-smoothness-audit.md'));
addCheck(checks, 'summary file exists', exists('release/patch80a/patch80a-performance-smoothness-summary.md'));
addCheck(checks, 'validation report exists', exists('release/patch80a/patch80a-validation-report.md'));
addCheck(checks, 'safe React performance primitive exists in optimized files', /\buseMemo\b|\buseCallback\b|\bmemo\b|\blazy\b/.test(readinessPage + operatorPage));
addCheck(checks, 'operator console uses memoized department lookup maps', /adoptionByDepartment/.test(operatorPage) && /supportByDepartment/.test(operatorPage) && /blockerByDepartment/.test(operatorPage));
addCheck(checks, 'production readiness summaries are memoized', /operationsGovernanceSummary = useMemo/.test(readinessPage) && /livePilotIssueBurndown = useMemo/.test(readinessPage));
addCheck(checks, 'Patch 79 operations API uses single-pass item summary', /summarizeProductionHypercareItems/.test(readinessApi) && /for \(const item of items\)/.test(readinessApi));
addCheck(checks, 'no fake/demo records were added', !/\b(fake|demo|mock)\b/i.test(srcDiff));
addCheck(checks, 'operational UI diff avoids banned technical wording', !/\b(patch|proof|rpc|schema|migration|edge bridge|scaffold|mock|demo|unknown_requires_review)\b/i.test(srcDiff));
addCheck(checks, 'validate:fast exists', Boolean(packageJson.scripts?.['validate:fast']));
addCheck(checks, 'validate:build exists', Boolean(packageJson.scripts?.['validate:build']));
addCheck(checks, 'validate:security exists', Boolean(packageJson.scripts?.['validate:security']));
addCheck(checks, 'validate:release exists', Boolean(packageJson.scripts?.['validate:release']));
addCheck(checks, 'proof:all exists', Boolean(packageJson.scripts?.['proof:all']));
addCheck(checks, 'v700:runtime-security exists', Boolean(packageJson.scripts?.['v700:runtime-security']));
addCheck(checks, 'release:restore-noise exists', Boolean(packageJson.scripts?.['release:restore-noise']));
addCheck(checks, 'proof index mentions Patch 80A', /patch80a:proof/.test(proofIndex) && /patch80a:all/.test(proofIndex));
addCheck(checks, 'validation runbook mentions performance patch validation', /Performance patches should run/.test(runbook) && /Patch 80A extends restore coverage/.test(runbook));
addCheck(checks, 'patch80a:all does not run validate:release', !String(packageJson.scripts?.['patch80a:all'] ?? '').includes('validate:release'));
addCheck(checks, 'no conflict markers', !/^(<<<<<<<|=======|>>>>>>>)$/m.test(packageText + readinessPage + operatorPage + readinessApi + restoreNoise + platformStatus + proofIndex + runbook));

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '80A',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  failed_count: failed.length,
  checks,
};

mkdirSync(proofDir, { recursive: true });
writeFileSync(proofPath, `${JSON.stringify(result, null, 2)}\n`);

if (failed.length) {
  console.error(`Patch 80A performance smoothness proof failed. (${failed.length} failures)`);
  for (const check of failed) {
    console.error(`- ${check.name}${check.details ? `: ${check.details}` : ''}`);
  }
  process.exit(1);
}

console.log(`Patch 80A performance smoothness proof passed. (${checks.length} checks)`);
