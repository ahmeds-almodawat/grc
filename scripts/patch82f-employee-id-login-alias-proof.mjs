import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const proofPath = path.join(root, 'release', 'patch82f', 'patch82f-employee-id-login-alias-proof.json');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function git(args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false });
}

function record(results, name, passed, details = '') {
  results.push({ name, passed: Boolean(passed), details });
}

const results = [];
const packageJson = JSON.parse(read('package.json'));
const loginPath = 'src/pages/LoginPage.tsx';
const loginText = read(loginPath);
const restoreNoiseText = read('scripts/restore-generated-release-noise.mjs');
const platformStatusText = read('release/current-platform-status.md');
const proofIndexText = read('release/current-proof-command-index.md');
const validationRunbookText = read('release/current-validation-runbook.md');
const summaryPath = 'release/patch82f/patch82f-employee-id-login-alias-summary.md';
const validationPath = 'release/patch82f/patch82f-validation-report.md';

const migrationDiff = git(['diff', '--name-only', '--', 'supabase/migrations']);
const migrationChanged = migrationDiff.stdout.trim();
const patch82fMigrationExists = fs.existsSync(path.join(root, 'supabase', 'migrations'))
  && fs.readdirSync(path.join(root, 'supabase', 'migrations')).some(name => /patch82f/i.test(name));

record(results, 'package.json contains patch82f:proof', packageJson.scripts?.['patch82f:proof'] === 'node scripts/patch82f-employee-id-login-alias-proof.mjs');
record(results, 'package.json contains patch82f:all', packageJson.scripts?.['patch82f:all'] === 'npm run validate:build && npm run validate:security && npm run patch82f:proof');
record(results, 'no Patch 82F migration was added', !patch82fMigrationExists);
record(results, 'no Supabase migration files modified', migrationChanged.length === 0, migrationChanged);
record(results, 'login UI supports Email or Employee ID wording', loginText.includes('Email or Employee ID'));
record(results, 'login UI includes employee ID helper text', loginText.includes('Use your employee ID or full email address.'));
record(results, 'login logic converts non-email identifier to @almodawat.sa', /includes\('@'\)[\s\S]*\`\$\{trimmed\}@\$\{EMPLOYEE_ID_LOGIN_DOMAIN\}\`/.test(loginText) && loginText.includes("const EMPLOYEE_ID_LOGIN_DOMAIN = 'almodawat.sa';"));
record(results, 'login logic trims identifier', loginText.includes('identifier.trim()'));
record(results, 'login logic lowercases identifier before auth', /\.toLowerCase\(\)/.test(loginText));
record(results, 'existing email login path is preserved', /trimmed\.includes\('@'\)\s*\?\s*trimmed\s*:/.test(loginText));
record(results, 'password remains required', /type="password"[\s\S]*required/.test(loginText));
record(results, 'password is still sent to existing auth.signIn call', /auth\.signIn\(normalizeLoginIdentifier\(loginIdentifier\), password\)/.test(loginText));
record(results, 'no auth bypass wording or implementation in login UI', !/bypass|without password|skip password|passwordless/i.test(loginText));
record(results, 'no service-role frontend exposure in login UI', !/service[_-]?role|SERVICE_ROLE/i.test(loginText));
record(results, 'no production launched wording in changed operational docs', !/production launched/i.test(`${loginText}\n${platformStatusText}\n${proofIndexText}\n${validationRunbookText}`));
record(results, 'no go-live complete wording in changed operational docs', !/go-live complete/i.test(`${loginText}\n${platformStatusText}\n${proofIndexText}\n${validationRunbookText}`));
record(results, 'no system is production ready claim in changed operational docs', !/system is production ready/i.test(`${loginText}\n${platformStatusText}\n${proofIndexText}\n${validationRunbookText}`));
record(results, 'Patch 82F summary doc exists', exists(summaryPath));
record(results, 'Patch 82F validation report exists', exists(validationPath));
record(results, 'current-platform-status mentions Patch 82F', /Patch 82F/i.test(platformStatusText));
record(results, 'proof command index mentions Patch 82F', /patch82f:proof/i.test(proofIndexText));
record(results, 'validation runbook mentions Patch 82F', /patch82f:proof/i.test(validationRunbookText));
record(results, 'validate:build exists', Boolean(packageJson.scripts?.['validate:build']));
record(results, 'validate:security exists', Boolean(packageJson.scripts?.['validate:security']));
record(results, 'release:restore-noise exists', Boolean(packageJson.scripts?.['release:restore-noise']));
record(results, 'restore-noise covers Patch 82E proof JSON', restoreNoiseText.includes('release/patch82e/patch82e-record-level-dashboard-drilldown-proof.json'));

const conflictSearch = git(['grep', '-n', '-E', '^(<<<<<<<|=======|>>>>>>>)', '--', '.', ':!node_modules', ':!dist', ':!build']);
record(results, 'no conflict markers', conflictSearch.status === 1, conflictSearch.stdout.trim() || conflictSearch.stderr.trim());

const passed = results.every(result => result.passed);
const output = {
  patch: '82F',
  name: 'Employee ID Login Alias',
  generated_at: new Date().toISOString(),
  passed,
  results,
};

fs.mkdirSync(path.dirname(proofPath), { recursive: true });
fs.writeFileSync(proofPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(JSON.stringify(output, null, 2));
if (!passed) process.exit(1);
