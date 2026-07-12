import fs from 'node:fs';
import path from 'node:path';

let exitCode = 0;
function check(name, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'}: ${name}`);
  if (!condition) exitCode = 1;
}

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch83o3');
const resultsPath = path.join(releaseDir, 'patch83o3-live-mutation-results.json');
const patch83oEvidencePath = path.join(root, 'release', 'patch83o', 'patch83o-authenticated-runtime-verification.json');
const runnerPath = path.join(root, 'scripts', 'run-patch83o-live-secure.ps1');
const helperPath = path.join(root, 'scripts', 'patch83o3-live-mutation-tests.mjs');
const departmentsPath = path.join(root, 'src', 'pages', 'Departments.tsx');
const expectedMarkdown = [
  'patch83o3-live-mutation-summary.md',
  'patch83o3-atomic-rollback.md',
  'patch83o3-create-only.md',
  'patch83o3-duplicate.md',
  'patch83o3-update.md',
  'patch83o3-audit-verification.md',
  'patch83o3-cleanup.md',
  'patch83o3-activation-decision.md',
];

console.log('\n--- Running Patch 83O.3 Live Mutation Proof ---\n');

check('Secure interactive runner exists', fs.existsSync(runnerPath));
check('Live mutation helper exists', fs.existsSync(helperPath));
for (const filename of expectedMarkdown) check(`Evidence exists: ${filename}`, fs.existsSync(path.join(releaseDir, filename)));

if (fs.existsSync(runnerPath)) {
  const runner = fs.readFileSync(runnerPath, 'utf8');
  check('Runner has no command-line parameter block', !/^\s*param\s*\(/i.test(runner));
  check('Only one password is securely prompted', (runner.match(/Read-Host[^\r\n]*-AsSecureString/g) ?? []).length === 1);
  check('Only existing administrator credentials are requested', /Existing administrator email/.test(runner) && /Administrator password/.test(runner) && !/non-admin password|create user/i.test(runner));
  check('Three-part JWT validation is present', /parts\.Count -ne 3/.test(runner));
  check('Issuer, subject, expiry, and auth user acceptance are validated', /token issuer/.test(runner) && /token has no subject/.test(runner) && /token is expired/.test(runner) && /\/auth\/v1\/user/.test(runner));
  check('Approved division is fixed and organization-scoped', runner.includes("$approvedDivisionId = '0c1aaf03-b795-4dc0-acb7-c496cb917e8a'") && /organization_id=eq\.\$organizationFilter/.test(runner));
  check('Administrator role and active profile are verified', /user_status -ne 'active'/.test(runner) && /super_admin/.test(runner) && /governance_admin/.test(runner) && /scope=eq\.global/.test(runner));
  check('Exact interactive confirmation phrase is required', runner.includes("$requiredConfirmation = 'RUN PATCH 83O LIVE MUTATION'") && /Read-Host \"Type exactly: \$requiredConfirmation\"/.test(runner) && /-cne \$requiredConfirmation/.test(runner));
  check('Approval is set only after interactive confirmation', runner.indexOf("$env:PATCH83O_APPROVE_LIVE_MUTATION = 'YES'") > runner.indexOf('$confirmation = Read-Host'));
  check('Approval and JWT are cleared from process environment', /finally\s*\{[\s\S]*Remove-Item Env:PATCH83O_ADMIN_JWT[\s\S]*Remove-Item Env:PATCH83O_APPROVE_LIVE_MUTATION/i.test(runner));
  check('BSTR password allocation is zeroed', runner.includes('[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)'));
  check('Runner has no credential file-writing primitive', !/(?:Set-Content|Add-Content|Out-File|Export-Clixml|WriteAllText|WriteAllBytes|RedirectStandardOutput)/i.test(runner));
}

if (fs.existsSync(helperPath)) {
  const helper = fs.readFileSync(helperPath, 'utf8');
  check('Randomized safe department codes are generated', /crypto\.randomBytes\(4\)/.test(helper) && /p83o3_/.test(helper));
  check('Atomic rollback verifies no department, batch, or create audit', /Atomic rollback created a department/.test(helper) && /Atomic rollback recorded a completed batch/.test(helper) && /Atomic rollback recorded a successful create audit/.test(helper));
  check('Manager input is omitted and null manager state is verified', !/manager_email\s*:/.test(helper) && /unexpectedly assigned a manager/.test(helper));
  check('Cleanup uses create_and_update and inactive status', /filenames\.cleanup, 'create_and_update'/.test(helper) && /status: 'inactive'/.test(helper));
  check('No hard delete is implemented', !/method:\s*['"]DELETE['"]|delete\s+from\s+public\.departments/i.test(helper));
  check('No user, organization, or division creation is implemented', !/action:\s*['"]create_(?:user|organization|division)['"]|insert\s+into\s+public\.(?:profiles|organizations|divisions)/i.test(helper));
}

check('Runtime results exist', fs.existsSync(resultsPath));
if (fs.existsSync(resultsPath)) {
  const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  check('Mutation approval was explicit', data.live_mutation_approved === true && data.mutation_approval_method === 'EXACT_INTERACTIVE_CONFIRMATION_PHRASE');
  check('Atomic rollback passed', data.atomic_rollback_verified === true);
  check('Create-only passed', data.create_only_verified === true && data.manager_preserved_null === true);
  check('Duplicate behavior passed', data.duplicate_behavior_verified === true);
  check('Controlled update passed', data.create_and_update_verified === true && data.blank_values_preserved === true);
  check('Audit verification passed', data.audit_verified === true && data.all_mutations_auditable === true);
  check('Cleanup completed by inactivation', data.cleanup_status === 'INACTIVATED' && data.test_department_inactive === true);
  check('No active test department remains', data.no_active_test_department_remains === true && data.original_active_department_count_restored === true);
  check('Raw rows were not stored', data.raw_rows_stored === false && data.raw_rows_not_stored_verified === true);
  check('No users, organizations, or divisions were created', data.test_users_created === false && data.organizations_created === false && data.divisions_created === false);
  check('No unrelated department, profile, or role changed', data.no_unrelated_department_changed === true && data.profile_department_ids_unchanged === true && data.unrelated_user_roles_unchanged === true);
  check('Frontend remains disabled', data.frontend_execution_enabled === false);
  check('Activation decision is limited to environment enablement', data.activation_decision === 'approved_for_environment_enablement');
  check('No production-readiness claim exists', data.production_readiness_claim === false);
}

if (fs.existsSync(patch83oEvidencePath)) {
  const data = JSON.parse(fs.readFileSync(patch83oEvidencePath, 'utf8'));
  check('Patch 83O evidence records completed live verification', data.live_mutation_approved === true && data.mutating_runtime_tests_completed === true && data.atomic_rollback_verified === true && data.create_only_verified === true && data.duplicate_behavior_verified === true && data.create_and_update_verified === true && data.audit_verified === true && data.cleanup_status === 'INACTIVATED');
  check('Patch 83O evidence keeps frontend disabled and avoids readiness claim', data.frontend_execution_enabled === false && data.activation_decision === 'approved_for_environment_enablement' && data.production_readiness_claim === false);
}

const evidenceText = fs.existsSync(releaseDir)
  ? fs.readdirSync(releaseDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => fs.readFileSync(path.join(releaseDir, entry.name), 'utf8')).join('\n')
  : '';
check('No credentials or Authorization headers exist in evidence', !/Authorization\s*:\s*|Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:password|anon_key|service_role_key)\s*[:=]\s*\S+/i.test(evidenceText));

const departmentsPage = fs.readFileSync(departmentsPath, 'utf8');
check('Frontend execution remains gated and disabled by default', departmentsPage.includes('import.meta.env.VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED === "true"'));

console.log('\n---------------------------------------------');
console.log(exitCode === 0 ? 'Proof Passed.' : 'Proof Failed. Run the secure interactive live mutation runner to produce completed evidence.');
process.exit(exitCode);
