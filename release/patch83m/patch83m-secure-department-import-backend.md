# Patch 83M: Secure Department Import Backend

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
