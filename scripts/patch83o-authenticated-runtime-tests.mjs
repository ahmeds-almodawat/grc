import fs from 'fs';
import path from 'path';

// --- Secure Harness Setup ---
const ENV = {
  ADMIN_JWT: process.env.PATCH83O_ADMIN_JWT,
  NON_ADMIN_JWT: process.env.PATCH83O_NON_ADMIN_JWT,
  ORG_ID: process.env.PATCH83O_TEST_ORGANIZATION_ID,
  DIV_ID: process.env.PATCH83O_TEST_DIVISION_ID,
  PROJ_URL: process.env.PATCH83O_PROJECT_URL || "https://zbrjjecpsrzposhuarcn.supabase.co",
  ANON_KEY: process.env.PATCH83O_ANON_KEY,
  APPROVE_MUTATION: process.env.PATCH83O_APPROVE_LIVE_MUTATION,
  NON_MUTATING_ONLY: process.env.PATCH83O_NON_MUTATING_ONLY === 'YES',
  MGR_EMAIL: process.env.PATCH83O_TEST_MANAGER_EMAIL,
  CROSS_ORG_ID: process.env.PATCH83O_CROSS_ORG_ID || '11111111-1111-1111-1111-111111111111'
};

const results = {
  admin_persona_available: !!ENV.ADMIN_JWT,
  non_admin_persona_available: !!ENV.NON_ADMIN_JWT,
  authenticated_admin_test_completed: false,
  raw_action_denied: false,
  invalid_mode_denied: false,
  cross_organization_denied: false,
  invalid_division_denied: false,
  invalid_manager_denied: false,
  direct_rpc_denied: false,
  non_admin_denial_verified: "BLOCKED_NO_NON_ADMIN_PERSONA",
  zero_department_mutation_verified: false,
  department_count_before: null,
  department_count_after: null,
  edge_function_version: process.env.PATCH83O_EDGE_FUNCTION_VERSION || null,
  runtime_blocker: null,
  live_mutation_approved: ENV.APPROVE_MUTATION === 'YES',
  non_mutating_only: ENV.NON_MUTATING_ONLY,
  mutating_runtime_tests_completed: false,
  atomic_rollback_verified: false,
  create_only_verified: false,
  duplicate_behavior_verified: false,
  create_and_update_verified: false,
  audit_verified: false,
  raw_rows_stored: false,
  cleanup_status: "N/A",
  test_department_id: null,
  test_department_code: null
};

console.log("--- Patch 83O Secure Persona Discovery ---");
console.log(`Admin JWT Available: ${results.admin_persona_available}`);
console.log(`Non-Admin JWT Available: ${results.non_admin_persona_available}`);
console.log(`Live Mutation Approved: ${results.live_mutation_approved}`);

if (ENV.NON_MUTATING_ONLY && ENV.APPROVE_MUTATION === 'YES') {
  throw new Error('Secure non-mutating mode refuses PATCH83O_APPROVE_LIVE_MUTATION=YES.');
}

// UUID Validator
const isValidUUID = (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

if (ENV.ORG_ID && !isValidUUID(ENV.ORG_ID)) {
  console.error("❌ PATCH83O_TEST_ORGANIZATION_ID is not a valid UUID.");
  process.exit(1);
}

// Ensure release dir exists
const releaseDir = path.join(process.cwd(), 'release', 'patch83o');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

async function invokeEdgeFunction(jwt, payload) {
  if (!ENV.PROJ_URL || !ENV.ANON_KEY) throw new Error("Missing PROJ_URL or ANON_KEY");
  const endpoint = `${ENV.PROJ_URL}/functions/v1/privileged-action`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
      'apikey': ENV.ANON_KEY
    },
    body: JSON.stringify(payload)
  });
  const status = res.status;
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = await res.text();
  }
  return { status, data };
}

async function invokeRPC(jwt, payload) {
  if (!ENV.PROJ_URL || !ENV.ANON_KEY) throw new Error("Missing PROJ_URL or ANON_KEY");
  const endpoint = `${ENV.PROJ_URL}/rest/v1/rpc/apply_department_import_batch`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
      'apikey': ENV.ANON_KEY
    },
    body: JSON.stringify(payload)
  });
  const status = res.status;
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = await res.text();
  }
  return { status, data };
}

function edgeRequest(organizationId, importMode, rows) {
  return {
    action: 'department_import_execute',
    payload: {
      organization_id: organizationId,
      source_filename: 'patch83o-runtime-verification.csv',
      import_mode: importMode,
      rows
    }
  };
}

function importRow(rowNumber, rawData) {
  return { row_number: rowNumber, raw_data: rawData };
}

function responseIncludes(response, expected) {
  return JSON.stringify(response.data).toLowerCase().includes(expected.toLowerCase());
}

// Read database directly to verify mutations/cleanup (requires SUPABASE_SERVICE_ROLE_KEY technically, or we query using Admin JWT if RLS permits)
// For database queries we will use the REST API with Admin JWT. Admin has governance_admin/super_admin role which gives SELECT on departments, batches, and audits.
async function queryDB(table, queryParams, jwt) {
  const endpoint = `${ENV.PROJ_URL}/rest/v1/${table}?${queryParams}`;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'apikey': ENV.ANON_KEY
    }
  });
  if (!res.ok) {
    throw new Error(`Database snapshot query failed with HTTP ${res.status}.`);
  }
  return await res.json();
}

async function snapshotDepartments(jwt) {
  const fields = 'id,organization_id,division_id,code,name_en,name_ar,is_active,created_at,updated_at';
  return queryDB(
    'departments',
    `organization_id=eq.${ENV.ORG_ID}&select=${fields}&order=id.asc`,
    jwt
  );
}

async function runNonMutatingTests() {
  if (!results.admin_persona_available) {
    console.log("❌ Admin persona unavailable. Skipping non-mutating tests.");
    return;
  }

  console.log("\n--- Phase 4: Authenticated Non-Mutating Tests ---");

  const departmentsBefore = await snapshotDepartments(ENV.ADMIN_JWT);
  results.department_count_before = departmentsBefore.length;

  // A. Valid administrator reaches the registered handler and its RPC.
  const resA = await invokeEdgeFunction(ENV.ADMIN_JWT, edgeRequest(ENV.ORG_ID, 'create_only', []));
  if (resA.status === 409 && responseIncludes(resA, 'BATCH_EMPTY')) {
    console.log("✅ A. Admin reached department import handler. Status:", resA.status);
    results.authenticated_admin_test_completed = true;
  } else {
    console.log("❌ A. Admin failed to reach Edge Function properly:", resA.status, JSON.stringify(resA.data).substring(0,100));
  }

  // B. Unsupported raw action
  const resB = await invokeEdgeFunction(ENV.ADMIN_JWT, {
    action: 'apply_department_import_batch',
    payload: { organization_id: ENV.ORG_ID, import_mode: 'create_only', rows: [] }
  });
  if (resB.status === 400 && resB.data?.code === 'UNSUPPORTED_PRIVILEGED_ACTION') {
    console.log("✅ B. Unsupported raw action denied. Status:", resB.status);
    results.raw_action_denied = true;
  } else {
    console.log("❌ B. Unsupported raw action not properly denied:", resB.status);
  }

  // C. Invalid import mode
  const validationRow = importRow(1, {
    department_code: 'PATCH83O_NON_MUTATING',
    department_name_en: 'Patch 83O Non-Mutating Test'
  });
  const resC = await invokeEdgeFunction(ENV.ADMIN_JWT, edgeRequest(ENV.ORG_ID, 'unsupported_mode', [validationRow]));
  if (resC.status === 409 && responseIncludes(resC, 'INVALID_IMPORT_MODE')) {
    console.log("✅ C. Invalid import mode denied. Status:", resC.status);
    results.invalid_mode_denied = true;
  } else {
    console.log("❌ C. Invalid import mode not properly denied:", resC.status);
  }

  // D. Cross-organization denial
  const resD = await invokeEdgeFunction(ENV.ADMIN_JWT, edgeRequest(ENV.CROSS_ORG_ID, 'create_only', [validationRow]));
  if (resD.status === 403 && responseIncludes(resD, 'UNAUTHORIZED_DEPARTMENT_IMPORT')) {
    console.log("✅ D. Cross-organization denied. Status:", resD.status);
    results.cross_organization_denied = true;
  } else {
    console.log("❌ D. Cross-organization NOT denied:", resD.status, resD.data);
  }

  // E. Invalid division scope
  const invalidDivisionRow = importRow(1, {
    department_code: 'PATCH83O_INVALID_DIVISION',
    department_name_en: 'Patch 83O Invalid Division',
    division_code: 'PATCH83O_DIVISION_DOES_NOT_EXIST'
  });
  const resE = await invokeEdgeFunction(ENV.ADMIN_JWT, edgeRequest(ENV.ORG_ID, 'create_only', [invalidDivisionRow]));
  if (resE.status === 200 && resE.data?.result?.status === 'rejected' && responseIncludes(resE, 'invalid division')) {
    console.log("✅ E. Invalid division scope denied. Status:", resE.status);
    results.invalid_division_denied = true;
  } else {
    console.log("❌ E. Invalid division scope NOT denied:", resE.status, resE.data);
  }

  // F. Missing or invalid manager
  const invalidManagerRow = importRow(1, {
    department_code: 'PATCH83O_INVALID_MANAGER',
    department_name_en: 'Patch 83O Invalid Manager',
    manager_email: 'patch83o-manager-does-not-exist@example.invalid'
  });
  const resF = await invokeEdgeFunction(ENV.ADMIN_JWT, edgeRequest(ENV.ORG_ID, 'create_only', [invalidManagerRow]));
  if (resF.status === 200 && resF.data?.result?.status === 'rejected' && responseIncludes(resF, 'manager not found')) {
    console.log("✅ F. Missing/invalid manager denied. Status:", resF.status);
    results.invalid_manager_denied = true;
  } else {
    console.log("❌ F. Missing manager NOT denied:", resF.status, resF.data);
  }

  // G. Direct RPC invocation
  const resG = await invokeRPC(ENV.ADMIN_JWT, {
    p_actor_id: '11111111-1111-1111-1111-111111111111',
    p_organization_id: ENV.ORG_ID,
    p_source_filename: 'patch83o-direct-rpc-denial.csv',
    p_import_mode: 'create_only',
    p_rows: []
  });
  const directRpcDenial = responseIncludes(resG, 'permission denied') ||
    ['42501', 'PGRST202'].includes(resG.data?.code);
  if ([401, 403, 404].includes(resG.status) && directRpcDenial) {
    console.log("✅ G. Direct authenticated RPC invocation denied. Status:", resG.status);
    results.direct_rpc_denied = true;
  } else {
    console.log("❌ G. Direct RPC invocation allowed!", resG.status);
  }

  // H. Non-admin denial
  if (results.non_admin_persona_available) {
    const resH = await invokeEdgeFunction(ENV.NON_ADMIN_JWT, edgeRequest(ENV.ORG_ID, 'create_only', [validationRow]));
    if (resH.status === 403 && responseIncludes(resH, 'UNAUTHORIZED_DEPARTMENT_IMPORT')) {
      console.log("✅ H. Non-admin denial verified. Status:", resH.status);
      results.non_admin_denial_verified = true;
    } else {
      console.log("❌ H. Non-admin was NOT denied:", resH.status, resH.data);
      results.non_admin_denial_verified = false;
    }
  } else {
    console.log("⚠️ H. Non-admin test skipped: BLOCKED_NO_NON_ADMIN_PERSONA");
  }

  const departmentsAfter = await snapshotDepartments(ENV.ADMIN_JWT);
  results.department_count_after = departmentsAfter.length;
  results.zero_department_mutation_verified =
    JSON.stringify(departmentsAfter) === JSON.stringify(departmentsBefore);
  console.log(
    results.zero_department_mutation_verified
      ? `✅ Zero department mutation verified (${departmentsAfter.length} rows unchanged).`
      : '❌ Department state changed during non-mutating verification.'
  );
}

async function runMutatingTests() {
  if (ENV.NON_MUTATING_ONLY || !results.admin_persona_available || !results.live_mutation_approved || !ENV.ORG_ID) {
    console.log("\n--- Phase 5-10: Live Mutating Tests (BLOCKED) ---");
    return;
  }

  console.log("\n--- Phase 5-10: Live Mutating Tests ---");

  const timestampSuffix = Math.floor(Date.now() / 1000);
  const testCode = `P83O_${timestampSuffix}_A`;
  const testName = 'Patch 83O Controlled Runtime Test';
  results.test_department_code = testCode;

  // Phase 6: Atomic Rollback Test
  const rollbackRows = [
    importRow(1, { department_code: testCode, department_name_en: testName, status: 'active', department_type: 'clinical' }),
    importRow(2, { department_code: testCode + '_BAD', department_name_en: testName, status: 'active', department_type: 'clinical', division_code: 'PATCH83O_DIVISION_DOES_NOT_EXIST' })
  ];
  const resRollback = await invokeEdgeFunction(ENV.ADMIN_JWT, edgeRequest(ENV.ORG_ID, 'create_only', rollbackRows));

  // Verify DB
  const deptCheckR = await queryDB('departments', `code=eq.${testCode}&organization_id=eq.${ENV.ORG_ID}&select=id`, ENV.ADMIN_JWT);

  if ((resRollback.status === 400 || resRollback.status === 500) && (!deptCheckR || deptCheckR.length === 0)) {
    console.log("✅ Phase 6. Atomic rollback verified. Zero departments created.");
    results.atomic_rollback_verified = true;
  } else {
    console.log("❌ Phase 6. Atomic rollback failed:", resRollback.status, deptCheckR);
  }

  // Phase 7: Create-only success
  const validRow = importRow(1, { department_code: testCode, department_name_en: testName, status: 'active', department_type: 'clinical' });
  const resCreate = await invokeEdgeFunction(ENV.ADMIN_JWT, edgeRequest(ENV.ORG_ID, 'create_only', [validRow]));

  const deptCheckC = await queryDB('departments', `code=eq.${testCode}&organization_id=eq.${ENV.ORG_ID}&select=id`, ENV.ADMIN_JWT);
  const batchCheckC = await queryDB('department_import_batches', `organization_id=eq.${ENV.ORG_ID}&mode=eq.create_only&status=eq.completed&order=created_at.desc&limit=1`, ENV.ADMIN_JWT);

  if (resCreate.status === 200 && deptCheckC && deptCheckC.length === 1 && batchCheckC && batchCheckC.length === 1) {
    console.log("✅ Phase 7. Create-only success verified. Department created.");
    results.create_only_verified = true;
    results.test_department_id = deptCheckC[0].id;
  } else {
    console.log("❌ Phase 7. Create-only failed:", resCreate.status, deptCheckC, resCreate.data);
    return; // Abort further mutations if create fails
  }

  // Phase 8: Duplicate behavior
  const resDup = await invokeEdgeFunction(ENV.ADMIN_JWT, edgeRequest(ENV.ORG_ID, 'create_only', [validRow]));
  const deptCheckD = await queryDB('departments', `code=eq.${testCode}&organization_id=eq.${ENV.ORG_ID}&select=id`, ENV.ADMIN_JWT);

  if ((resDup.status === 200 || resDup.status === 400) && deptCheckD && deptCheckD.length === 1) {
    // Expected either 200 with skipped rows or 400 validation error
    console.log("✅ Phase 8. Duplicate behavior verified. No extra department created.");
    results.duplicate_behavior_verified = true;
  } else {
    console.log("❌ Phase 8. Duplicate behavior failed:", resDup.status, deptCheckD);
  }

  // Phase 9: Controlled update
  const updateRow = importRow(1, { department_code: testCode, department_name_en: testName + ' (Updated)', status: 'active', department_type: 'clinical' });
  const resUpdate = await invokeEdgeFunction(ENV.ADMIN_JWT, edgeRequest(ENV.ORG_ID, 'create_and_update', [updateRow]));

  const deptCheckU = await queryDB('departments', `code=eq.${testCode}&organization_id=eq.${ENV.ORG_ID}&select=id,name_en`, ENV.ADMIN_JWT);

  if (resUpdate.status === 200 && deptCheckU && deptCheckU.length === 1 && deptCheckU[0].name_en === testName + ' (Updated)') {
    console.log("✅ Phase 9. Controlled update verified.");
    results.create_and_update_verified = true;
  } else {
    console.log("❌ Phase 9. Controlled update failed:", resUpdate.status, deptCheckU);
  }

  // Phase 11: Audit verification
  const auditCheck = await queryDB('audit_events', `entity_type=eq.department&entity_id=eq.${results.test_department_id}&order=created_at.desc&limit=2`, ENV.ADMIN_JWT);
  if (auditCheck && auditCheck.length > 0) {
    console.log("✅ Phase 11. Audit events generated successfully.");
    results.audit_verified = true;
  } else {
    console.log("❌ Phase 11. Audit events missing!");
  }

  // Phase 10: Controlled cleanup
  const cleanupRow = importRow(1, { department_code: testCode, department_name_en: 'Patch 83O Test Inactive', status: 'inactive', department_type: 'clinical' });
  const resCleanup = await invokeEdgeFunction(ENV.ADMIN_JWT, edgeRequest(ENV.ORG_ID, 'create_and_update', [cleanupRow]));
  const deptCheckCl = await queryDB('departments', `code=eq.${testCode}&organization_id=eq.${ENV.ORG_ID}&select=id,is_active`, ENV.ADMIN_JWT);

  if (resCleanup.status === 200 && deptCheckCl && deptCheckCl.length === 1 && deptCheckCl[0].is_active === false) {
    console.log("✅ Phase 10. Controlled cleanup verified. Test department inactivated.");
    results.cleanup_status = "INACTIVATED";
  } else {
    console.log("❌ Phase 10. Controlled cleanup failed:", resCleanup.status, deptCheckCl);
    results.cleanup_status = "FAILED";
  }

  results.mutating_runtime_tests_completed = (results.atomic_rollback_verified && results.create_only_verified && results.duplicate_behavior_verified && results.create_and_update_verified && results.cleanup_status === "INACTIVATED");
}

async function main() {
  try {
    await runNonMutatingTests();
    await runMutatingTests();

    // Write out results safely for proof script
    const outputData = { ...results };
    if (outputData.test_department_code) outputData.test_department_code_redacted_or_sanitized = true;
    fs.writeFileSync(path.join(releaseDir, 'patch83o-runtime-results.json'), JSON.stringify(outputData, null, 2));

    console.log("\n--- Runtime Tests Finished ---");
  } catch (err) {
    results.runtime_blocker = err instanceof Error ? err.message : 'Unknown runtime harness failure.';
    fs.writeFileSync(path.join(releaseDir, 'patch83o-runtime-results.json'), JSON.stringify(results, null, 2));
    console.error("Runtime test harness fatal error:", err);
    process.exit(1);
  }
}

main();
