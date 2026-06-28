import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'v140');
fs.mkdirSync(releaseDir, { recursive: true });

const requiredFiles = [
  'release/v140/v140-static-audit.json',
  'release/v140/v140-static-audit.md',
  'release/v140/v140-uat-scenario-report.json',
  'release/v140/v140-uat-scenario-report.md',
  'src/pages/ControlledUatWorkbench.tsx',
  'src/pages/UatIssueCapture.tsx',
  'src/lib/uatIssueApi.ts',
];

const expectedScripts = {
  'v140:uat-audit': 'node scripts/v140-uat-audit.mjs',
  'v140:uat-report': 'node scripts/v140-uat-scenario-report.mjs',
  'v140:final-proof': 'node scripts/v140-final-proof.mjs',
  'pilot:v140-uat-execution': 'npm run v140:uat-audit && npm run v140:uat-report && npm run v140:final-proof',
};

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

const failures = [];
const warnings = [];

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`${file} missing`);
}

let audit = null;
if (exists('release/v140/v140-static-audit.json')) {
  audit = readJson('release/v140/v140-static-audit.json');
  if (audit.status !== 'passed') failures.push('v140 static audit did not pass');
  if (audit.database_migration_included) warnings.push('v14.0 includes a migration; confirm it was absolutely required.');
}

let scenarioReport = null;
if (exists('release/v140/v140-uat-scenario-report.json')) {
  scenarioReport = readJson('release/v140/v140-uat-scenario-report.json');
  if (scenarioReport.total_scenarios !== 18) failures.push(`expected 18 Day 1 scenarios, found ${scenarioReport.total_scenarios}`);
  if (scenarioReport.uat_results_asserted !== false) failures.push('scenario report must not assert manual UAT results');
}

const packageJson = readJson('package.json');
for (const [name, command] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[name] !== command) {
    failures.push(`package script ${name} missing or incorrect`);
  }
}

if (exists('.github/workflows/ci.yml')) {
  const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  if (!ci.includes('npm run pilot:v140-uat-execution')) {
    failures.push('GitHub Actions CI does not include npm run pilot:v140-uat-execution');
  }
} else {
  failures.push('.github/workflows/ci.yml missing');
}

const result = {
  generated_at: new Date().toISOString(),
  status: failures.length === 0 ? 'passed' : 'failed',
  failed_count: failures.length,
  warning_count: warnings.length,
  failures,
  warnings,
  total_day_one_scenarios: scenarioReport?.total_scenarios ?? null,
  uat_results_asserted: false,
  production_readiness_asserted: false,
  database_migration_included: Boolean(audit?.database_migration_included),
  approval_json_modified_by_v140: false,
  proof_scope: 'v14.0 controlled UAT execution pack presence and wiring only; manual UAT execution remains human evidence.',
};

fs.writeFileSync(path.join(releaseDir, 'v140-final-proof.json'), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(
  path.join(releaseDir, 'v140-final-proof.md'),
  `# v14.0 Final Proof\n\nStatus: **${result.status}**\n\nFailed count: ${result.failed_count}\n\nWarnings: ${result.warning_count}\n\nManual UAT results asserted: **no**\n\nProduction readiness asserted: **no**\n\nDatabase migration included: **${result.database_migration_included ? 'yes' : 'no'}**\n\nScope: ${result.proof_scope}\n`,
);

console.log('v14.0 final proof complete.');
console.log(JSON.stringify({
  status: result.status,
  failed_count: result.failed_count,
  warning_count: result.warning_count,
  report: 'release/v140/v140-final-proof.json',
}, null, 2));

if (result.status !== 'passed') process.exit(1);
