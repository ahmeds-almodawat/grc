import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const proofPath = path.join(root, 'release', 'patch82g', 'patch82g-privileged-action-jwt-compatibility-proof.json');

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

function listFiles(dirRelPath) {
  const dir = path.join(root, dirRelPath);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir);
}

const results = [];
const packageJson = JSON.parse(read('package.json'));
const edgePath = 'supabase/functions/privileged-action/index.ts';
const edgeText = read(edgePath);
const helperPath = 'src/lib/privilegedAction.ts';
const helperText = read(helperPath);
const restoreNoiseText = read('scripts/restore-generated-release-noise.mjs');
const platformStatusText = read('release/current-platform-status.md');
const proofIndexText = read('release/current-proof-command-index.md');
const validationRunbookText = read('release/current-validation-runbook.md');
const summaryPath = 'release/patch82g/patch82g-privileged-action-jwt-compatibility-summary.md';
const validationPath = 'release/patch82g/patch82g-validation-report.md';

const migrationDiff = git(['diff', '--name-only', '--', 'supabase/migrations']);
const migrationChanged = migrationDiff.stdout.trim();
const patch82gMigrationExists = listFiles('supabase/migrations').some(name => /patch82g|82g/i.test(name));

record(results, 'package.json contains patch82g:proof', packageJson.scripts?.['patch82g:proof'] === 'node scripts/patch82g-privileged-action-jwt-compatibility-proof.mjs');
record(results, 'package.json contains patch82g:all', packageJson.scripts?.['patch82g:all'] === 'npm run validate:build && npm run validate:security && npm run patch82g:proof');
record(results, 'no Patch 82G migration was added', !patch82gMigrationExists);
record(results, 'no Supabase migration files modified', migrationChanged.length === 0, migrationChanged);
record(results, 'privileged-action no longer uses jose jwtVerify with TextEncoder raw secret for caller auth', !/jwtVerify|from ['"]jose['"]|new TextEncoder\(\)\.encode|TextEncoder\(\)/.test(edgeText));
record(results, 'privileged-action validates bearer token through Supabase auth.getUser', /authorization\.slice\('Bearer '\.length\)/.test(edgeText) && /authClient\.auth\.getUser\(token\)/.test(edgeText));
record(results, 'missing bearer token is rejected', edgeText.includes("!authorization?.startsWith('Bearer ')") && edgeText.includes('AUTH_TOKEN_REQUIRED') && /401/.test(edgeText));
record(results, 'invalid caller token is rejected', edgeText.includes('AUTH_TOKEN_INVALID') && /userError \|\| !userData\.user/.test(edgeText) && /401/.test(edgeText));
record(results, 'client-provided user_id is not trusted for authentication', edgeText.includes('p_actor_id: userData.user.id') && !/p_actor_id:\s*(payload|requestBody)/.test(edgeText) && !/actor_id:\s*(payload|requestBody)/.test(edgeText));
record(results, 'service-role key is used only server-side Edge Function', edgeText.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')") && !/SERVICE_ROLE|service[_-]?role/i.test(helperText));
record(results, 'frontend error handling surfaces safe JSON error when available', /body\.error/.test(helperText) && /body\.code/.test(helperText) && /body\.detail/.test(helperText));
record(results, 'structured JSON error includes error code and detail fields', /function errorResponse/.test(edgeText) && /code/.test(edgeText) && /detail/.test(edgeText));
record(results, 'no auth bypass wording or implementation in operational files', !/without password|skip password|passwordless|bypass authentication|auth bypass/i.test(`${edgeText}\n${helperText}\n${platformStatusText}\n${proofIndexText}\n${validationRunbookText}`));
record(results, 'no production launched wording', !/production launched/i.test(`${edgeText}\n${helperText}\n${platformStatusText}\n${proofIndexText}\n${validationRunbookText}`));
record(results, 'no go-live complete wording', !/go-live complete/i.test(`${edgeText}\n${helperText}\n${platformStatusText}\n${proofIndexText}\n${validationRunbookText}`));
record(results, 'no system is production ready claim', !/system is production ready/i.test(`${edgeText}\n${helperText}\n${platformStatusText}\n${proofIndexText}\n${validationRunbookText}`));
record(results, 'Patch 82G summary doc exists', exists(summaryPath));
record(results, 'Patch 82G validation report exists', exists(validationPath));
record(results, 'current-platform-status mentions Patch 82G', /Patch 82G/i.test(platformStatusText));
record(results, 'proof command index mentions Patch 82G', /patch82g:proof/i.test(proofIndexText));
record(results, 'validation runbook mentions Patch 82G', /patch82g:proof/i.test(validationRunbookText));
record(results, 'validate:build exists', Boolean(packageJson.scripts?.['validate:build']));
record(results, 'validate:security exists', Boolean(packageJson.scripts?.['validate:security']));
record(results, 'release:restore-noise exists', Boolean(packageJson.scripts?.['release:restore-noise']));
record(results, 'restore-noise covers Patch 82F proof JSON', restoreNoiseText.includes('release/patch82f/patch82f-employee-id-login-alias-proof.json'));

const conflictSearch = git(['grep', '-n', '-E', '^(<<<<<<<|=======|>>>>>>>)', '--', '.', ':!node_modules', ':!dist', ':!build']);
record(results, 'no conflict markers', conflictSearch.status === 1, conflictSearch.stdout.trim() || conflictSearch.stderr.trim());

const passed = results.every(result => result.passed);
const output = {
  patch: '82G',
  name: 'Privileged Action JWT Compatibility and Error Visibility',
  generated_at: new Date().toISOString(),
  passed,
  results,
};

fs.mkdirSync(path.dirname(proofPath), { recursive: true });
fs.writeFileSync(proofPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(JSON.stringify(output, null, 2));
if (!passed) process.exit(1);
