import fs from 'fs';
import path from 'path';

const releaseDir = path.join(process.cwd(), 'release', 'patch83m');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const jsonEvidence = {
  patch: "83M",
  title: "Secure Department Import Backend",
  status: "prepared",
  backend_source_created: true,
  migration_created: true,
  migration_applied: false,
  edge_function_source_updated: true,
  edge_function_deployed: false,
  cloud_runtime_tested: false,
  execution_available: false,
  frontend_execution_enabled: false,
  direct_browser_department_write: false,
  dedicated_rpc: "apply_department_import_batch",
  privileged_action: "department_import_execute",
  authorization_model: "explicit approved administrative roles via profiles join",
  authorized_roles: "super_admin, governance_admin",
  valid_import_modes: ["create_only", "create_and_update"],
  transaction_model: "atomic",
  rejected_batch_persistence: "rolled back with transaction, structured error returned without history",
  composite_identity: "organization_id, lower(trim(code))",
  duplicate_preflight_status: "validated",
  audit_behavior: "structured jsonb log in audit_logs, plus department_import_batches",
  raw_file_stored: false,
  db_push_executed: false,
  migration_repair_executed: false,
  next_patch: "83N controlled cloud deployment",
  blockers: ["Patch 83N deployment and runtime testing"],
  no_production_readiness_claim: true
};

fs.writeFileSync(path.join(releaseDir, 'patch83m-secure-department-import-backend.json'), JSON.stringify(jsonEvidence, null, 2));

const mdContent = `# Patch 83M: Secure Department Import Backend

## Status: Prepared (Deployment Pending 83N)
- **Migration Applied**: false
- **Edge Function Deployed**: false
- **Cloud Runtime Tested**: false
- **Frontend Execution Enabled**: false
- **Next Patch**: 83N controlled cloud deployment
- **Blockers**: Patch 83N deployment and runtime testing

## Security Features
- **RPC**: apply_department_import_batch
- **Privileged Action**: department_import_execute
- **Authorization Model**: explicit approved administrative roles via profiles join with exact p_actor_id
- **Organization Scope Enforcement**: explicitly enforced for every actor and every row
- **Two-phase validation**: Validates all rows before mutation
- **Authorized Roles**: super_admin, governance_admin
- **Transaction Model**: atomic
- **Rejected Batch Persistence**: rolled back with transaction, structured error returned without history
- **Composite Identity**: organization_id, lower(trim(code))
- **Raw File Stored**: false
`;

fs.writeFileSync(path.join(releaseDir, 'patch83m-secure-department-import-backend.md'), mdContent);

console.log("Evidence files created successfully.");
