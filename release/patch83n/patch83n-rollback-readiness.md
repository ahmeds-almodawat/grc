# Patch 83N Rollback Readiness Plan

## Status
- **Date**: 2026-07-11

## Rollback Considerations & Plan
1. **Frontend**: The frontend activation relies on an environment variable (`VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED`). If rollback is necessary, simply ensure this variable is `false` or removed in the deployed cloud environment. No code rollback is strictly required to disable the feature.
2. **Edge Function**: If the `privileged-action` edge function causes side effects to other administrative actions, rollback by redeploying the previous state of the function.
3. **RPC Execution**: To block the backend from executing imports entirely, revoke execution privileges from the `service_role`:
   ```sql
   revoke execute on function public.apply_department_import_batch from service_role;
   ```
4. **Data Preservation**: Do not drop `department_import_batches` or `audit_logs` entries, as they contain compliance evidence of the actions performed.
5. **Migration 167 Removal**: If migration 167 must be physically removed, an explicit reviewed SQL rollback script must be prepared and tested. Do not use `migration repair` as a substitute for rollback.
