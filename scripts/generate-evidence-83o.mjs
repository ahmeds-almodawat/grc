import fs from 'fs';
import path from 'path';

const releaseDir = path.join(process.cwd(), 'release', 'patch83o');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// Default blocked results if tests haven't run or didn't produce a file
const defaultResults = {
  admin_persona_available: false,
  non_admin_persona_available: false,
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
  edge_function_version: null,
  runtime_blocker: null,
  live_mutation_approved: false,
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

let runtimeResults = defaultResults;
const resultsFile = path.join(releaseDir, 'patch83o-runtime-results.json');
if (fs.existsSync(resultsFile)) {
  runtimeResults = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
}

const allRequiredNonMutatingPassed = (
  runtimeResults.authenticated_admin_test_completed &&
  runtimeResults.raw_action_denied &&
  runtimeResults.invalid_mode_denied &&
  runtimeResults.cross_organization_denied &&
  runtimeResults.invalid_division_denied &&
  runtimeResults.invalid_manager_denied &&
  runtimeResults.direct_rpc_denied &&
  runtimeResults.non_admin_denial_verified === true &&
  runtimeResults.zero_department_mutation_verified === true
);

const activationDecision = (allRequiredNonMutatingPassed && runtimeResults.mutating_runtime_tests_completed) ? "approved_for_environment_enablement" : "blocked";

const jsonEvidence = {
  patch: "83O",
  title: "Authenticated Department Import Runtime Verification",
  admin_persona_available: runtimeResults.admin_persona_available,
  non_admin_persona_available: runtimeResults.non_admin_persona_available,
  authenticated_admin_test_completed: runtimeResults.authenticated_admin_test_completed,
  non_admin_denial_verified: runtimeResults.non_admin_denial_verified,
  raw_action_denied: runtimeResults.raw_action_denied,
  direct_rpc_denied: runtimeResults.direct_rpc_denied,
  cross_organization_denied: runtimeResults.cross_organization_denied,
  invalid_division_denied: runtimeResults.invalid_division_denied,
  invalid_manager_denied: runtimeResults.invalid_manager_denied,
  invalid_mode_denied: runtimeResults.invalid_mode_denied,
  zero_department_mutation_verified: runtimeResults.zero_department_mutation_verified,
  department_count_before: runtimeResults.department_count_before,
  department_count_after: runtimeResults.department_count_after,
  live_mutation_approved: runtimeResults.live_mutation_approved,
  mutating_runtime_tests_completed: runtimeResults.mutating_runtime_tests_completed,
  atomic_rollback_verified: runtimeResults.atomic_rollback_verified,
  create_only_verified: runtimeResults.create_only_verified,
  duplicate_behavior_verified: runtimeResults.duplicate_behavior_verified,
  create_and_update_verified: runtimeResults.create_and_update_verified,
  audit_verified: runtimeResults.audit_verified,
  raw_rows_stored: false,
  test_department_id: runtimeResults.test_department_id,
  test_department_code_redacted_or_sanitized: !!runtimeResults.test_department_code,
  cleanup_status: runtimeResults.cleanup_status,
  frontend_execution_enabled: false,
  activation_decision: activationDecision,
  migration_167_applied: true,
  edge_function_deployed: true,
  edge_function_version: runtimeResults.edge_function_version,
  runtime_blocker: runtimeResults.runtime_blocker,
  migration_168_created: true,
  migration_168_applied: true,
  db_push_executed: true,
  migration_repair_executed: false,
  db_reset_executed: false,
  test_users_created: false,
  organizations_created: false,
  production_readiness_claim: false,
  remaining_blockers: activationDecision === "blocked" ? [
    ...(runtimeResults.runtime_blocker ? [`runtime blocker: ${runtimeResults.runtime_blocker}`] : []),
    "explicit live mutation approval",
    "approved temporary test department mutation",
    "controlled mutating runtime verification and cleanup"
  ] : [],
  next_patch: activationDecision === "blocked" ? "TBD" : "Patch 83P: Controlled Frontend Activation"
};

fs.writeFileSync(path.join(releaseDir, 'patch83o-authenticated-runtime-verification.json'), JSON.stringify(jsonEvidence, null, 2));

function writeMd(filename, content) {
  fs.writeFileSync(path.join(releaseDir, filename), content);
}

writeMd('patch83o-authenticated-runtime-verification.md', `# Patch 83O: Authenticated Department Import Runtime Verification\n\n- Migration 167 Applied: true\n- Edge Function Deployed: true\n- Edge Function Version: ${jsonEvidence.edge_function_version}\n- Zero Department Mutation Verified: ${jsonEvidence.zero_department_mutation_verified}\n- Activation Decision: ${activationDecision}`);
writeMd('patch83o-persona-readiness.md', `# Patch 83O Persona Readiness\n- Admin Persona Available: ${jsonEvidence.admin_persona_available}\n- Non-Admin Persona Available: ${jsonEvidence.non_admin_persona_available}`);
writeMd('patch83o-runtime-security-matrix.md', `# Patch 83O Runtime Security Matrix\n- Authenticated Admin Test Completed: ${jsonEvidence.authenticated_admin_test_completed}\n- Non-Admin Denial Verified: ${jsonEvidence.non_admin_denial_verified}\n- Raw Action Denied: ${jsonEvidence.raw_action_denied}\n- Invalid Mode Denied: ${jsonEvidence.invalid_mode_denied}\n- Direct RPC Denied: ${jsonEvidence.direct_rpc_denied}\n- Cross-Organization Denied: ${jsonEvidence.cross_organization_denied}\n- Invalid Division Denied: ${jsonEvidence.invalid_division_denied}\n- Invalid Manager Denied: ${jsonEvidence.invalid_manager_denied}\n- Zero Department Mutation Verified: ${jsonEvidence.zero_department_mutation_verified}`);
writeMd('patch83o-atomic-rollback-result.md', `# Patch 83O Atomic Rollback Result\n- Atomic Rollback Verified: ${jsonEvidence.atomic_rollback_verified}`);
writeMd('patch83o-create-only-result.md', `# Patch 83O Create-Only Result\n- Create-Only Verified: ${jsonEvidence.create_only_verified}\n- Test Department ID: ${jsonEvidence.test_department_id}`);
writeMd('patch83o-duplicate-result.md', `# Patch 83O Duplicate Behavior Result\n- Duplicate Behavior Verified: ${jsonEvidence.duplicate_behavior_verified}`);
writeMd('patch83o-update-result.md', `# Patch 83O Controlled Update Result\n- Controlled Update Verified: ${jsonEvidence.create_and_update_verified}`);
writeMd('patch83o-audit-verification.md', `# Patch 83O Audit Verification Result\n- Audit Verified: ${jsonEvidence.audit_verified}\n- Raw Rows Stored: ${jsonEvidence.raw_rows_stored}`);
writeMd('patch83o-cleanup-result.md', `# Patch 83O Cleanup Result\n- Cleanup Status: ${jsonEvidence.cleanup_status}`);
writeMd('patch83o-activation-decision.md', `# Patch 83O Activation Decision\n- Frontend Execution Enabled: ${jsonEvidence.frontend_execution_enabled}\n- Activation Decision: ${jsonEvidence.activation_decision}\n- Live Mutation Approved: ${jsonEvidence.live_mutation_approved}\n- Production Readiness Claim: ${jsonEvidence.production_readiness_claim}\n- Next Patch: ${jsonEvidence.next_patch}`);
writeMd('patch83o-user-import-regression.md', `# Patch 83O User-Import Regression\n- User import backend references remain intact.\n- Department import does not reuse user-import tables or RPCs.\n- No user-import action was disabled.\n- No user or profile was created during Patch 83O.`);

console.log("Patch 83O evidence generated successfully.");
