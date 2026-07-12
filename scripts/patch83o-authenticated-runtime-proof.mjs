import fs from 'fs';
import path from 'path';

let exitCode = 0;

function check(name, condition) {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
  } else {
    console.log(`❌ FAIL: ${name}`);
    exitCode = 1;
  }
}

const releaseDir = path.join(process.cwd(), 'release', 'patch83o');
const jsonFile = path.join(releaseDir, 'patch83o-authenticated-runtime-verification.json');
const secureRunnerFile = path.join(process.cwd(), 'scripts', 'run-patch83o-secure.ps1');

console.log("\n--- Running Patch 83O Authenticated Runtime Proof ---\n");

check('Evidence file exists', fs.existsSync(jsonFile));
check('Secure runner exists', fs.existsSync(secureRunnerFile));

if (fs.existsSync(secureRunnerFile)) {
  const runner = fs.readFileSync(secureRunnerFile, 'utf8');
  check('Passwords are prompted as SecureString', (runner.match(/Read-Host[^\r\n]*-AsSecureString/g) ?? []).length === 2);
  check('Passwords are not accepted as command-line arguments', !/^\s*param\s*\(/i.test(runner));
  check('Secure runner explicitly blocks live mutation', /PATCH83O_APPROVE_LIVE_MUTATION\s*-ieq\s*'YES'[\s\S]*Refusing to run/i.test(runner));
  check('Secure runner forces non-mutating harness mode', runner.includes("$env:PATCH83O_NON_MUTATING_ONLY = 'YES'"));
  check('Access tokens are cleared in finally', /finally\s*\{[\s\S]*Remove-Item Env:PATCH83O_ADMIN_JWT[\s\S]*Remove-Item Env:PATCH83O_NON_ADMIN_JWT/i.test(runner));
  check('BSTR password allocation is zeroed', runner.includes('[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)'));
  check('Runner has no credential file-writing primitive', !/(?:Set-Content|Add-Content|Out-File|Export-Clixml|WriteAllText|WriteAllBytes|RedirectStandardOutput)/i.test(runner));
  check('Passwords are never written to files', !/(?:Set-Content|Add-Content|Out-File|Export-Clixml|WriteAllText|WriteAllBytes)[^\r\n]*(?:password|SecurePassword)/i.test(runner));
  check('JWTs and access tokens are never written to files', !/(?:Set-Content|Add-Content|Out-File|Export-Clixml|WriteAllText|WriteAllBytes)[^\r\n]*(?:JWT|AccessToken)/i.test(runner));
  check('Temporary authentication response files are deleted', /temporaryAuthenticationResponseFiles[\s\S]*Remove-Item -LiteralPath \$file/i.test(runner));
}

if (fs.existsSync(releaseDir)) {
  const evidenceText = fs.readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => fs.readFileSync(path.join(releaseDir, entry.name), 'utf8'))
    .join('\n');
  check('No Authorization headers are written to evidence', !/Authorization\s*:\s*(?:Bearer\s+)?[^\s"']+/i.test(evidenceText));
  check('No JWT-shaped access tokens are written to evidence', !/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(evidenceText));
}

if (fs.existsSync(jsonFile)) {
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

  // Phase 15 Check: No tokens/Authorization headers exist in evidence
  const rawJsonStr = fs.readFileSync(jsonFile, 'utf8');
  check('No Authorization headers exist in evidence', !rawJsonStr.includes('Bearer ') && !rawJsonStr.includes('Authorization:'));
  check('No test users were created', data.test_users_created === false);
  check('No organization or division was created', data.organizations_created === false);
  check('Frontend execution enabled is false', data.frontend_execution_enabled === false);
  check('No production-readiness claim', data.production_readiness_claim === false);
  check('Edge Function deployment version is recorded', /^\d+$/.test(String(data.edge_function_version)));
  if (data.authenticated_admin_test_completed) {
    check('Non-mutating runtime matrix passed',
      data.raw_action_denied === true &&
      data.invalid_mode_denied === true &&
      data.cross_organization_denied === true &&
      data.invalid_division_denied === true &&
      data.invalid_manager_denied === true &&
      data.direct_rpc_denied === true &&
      data.non_admin_denial_verified === true
    );
    check('Zero department mutation verified', data.zero_department_mutation_verified === true);
  }

  if (data.activation_decision === 'approved_for_environment_enablement') {
    check('Activation is approved -> all required mutating tests passed', data.mutating_runtime_tests_completed === true);
    check('Cleanup is verified', data.cleanup_status === 'INACTIVATED');
  } else {
    check('Activation is blocked -> required tests skipped or failed', data.mutating_runtime_tests_completed === false);
  }

  check('Migration 167 remains applied', data.migration_167_applied === true);
  check('Edge Function remains deployed', data.edge_function_deployed === true);
}

const depsCode = fs.readFileSync(path.join(process.cwd(), 'src/pages/Departments.tsx'), 'utf8');
const featureFlagsCode = fs.readFileSync(path.join(process.cwd(), 'src/config/featureFlags.ts'), 'utf8');
check(
  'Department execution uses the centralized exact-match frontend gate',
  depsCode.includes('isDepartmentImportExecutionEnabled()')
    && !depsCode.includes('import.meta.env.VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED')
    && featureFlagsCode.includes('value: unknown = import.meta.env.VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED')
    && featureFlagsCode.includes('return value === "true"'),
);

console.log("\n---------------------------------------------");
if (exitCode === 0) {
  console.log("Proof Passed. All Patch 83O requirements verified.");
} else {
  console.log("Proof Failed. Some requirements were not met.");
}
process.exit(exitCode);
