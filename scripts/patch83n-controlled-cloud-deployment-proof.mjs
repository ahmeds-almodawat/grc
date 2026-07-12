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

const releaseDir = path.join(process.cwd(), 'release', 'patch83n');
const jsonFile = path.join(releaseDir, 'patch83n-controlled-cloud-deployment.json');

console.log("\n--- Running Patch 83N Controlled Cloud Deployment Proof ---\n");

check('Evidence file exists', fs.existsSync(jsonFile));

if (fs.existsSync(jsonFile)) {
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  check(`Migration 167 applied`, data.migration_167_applied === true);
  check(`Edge function deployed`, data.edge_function_deployed === true);
  check(`Cloud schema verified`, data.cloud_schema_verified === true);
  check(`RPC exists`, data.rpc_exists === true);
  check(`RPC execute public is false`, data.rpc_execute_public === false);
  check(`RPC execute service_role is true`, data.rpc_execute_service_role === true);

  check(`No-Authorization gateway test returned 401`, data.no_authorization_result === 401);
  check(`No-Authorization error code is UNAUTHORIZED_NO_AUTH_HEADER`, data.no_authorization_error_code === "UNAUTHORIZED_NO_AUTH_HEADER");
  check(`Invalid-JWT gateway test returned 401`, data.invalid_token_result === 401);
  check(`Invalid-JWT error code is UNAUTHORIZED_INVALID_JWT_FORMAT`, data.invalid_token_error_code === "UNAUTHORIZED_INVALID_JWT_FORMAT");
  check(`Non-mutating runtime testing status is partial`, data.non_mutating_runtime_tests_status === "partial");
  check(`Authenticated runtime tests remain blocked`, data.authenticated_function_runtime_test === 'BLOCKED_NO_SAFE_PERSONA');
  check(`Mutating runtime tests remain blocked`, data.mutating_runtime_tests_completed === false);
  check(`Frontend execution remains disabled`, data.frontend_execution_enabled === false);
  check(`Activation decision remains blocked`, data.activation_decision === 'blocked');
  check(`Deno check is documented as unavailable`, data.deno_check_status === 'unavailable');
  check(`No production-readiness claim`, data.production_readiness_claim === false);

  check(`Raw rows stored is false`, data.raw_rows_stored === false);
  check(`Frontend activation gate implemented`, data.frontend_source_activation_gate === true);
  check(`DB push executed is true`, data.db_push_executed === true);
  check(`Migration repair is false`, data.migration_repair_executed === false);
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
  console.log("Proof Passed. All Patch 83N requirements verified.");
} else {
  console.log("Proof Failed. Some requirements were not met.");
}
process.exit(exitCode);
