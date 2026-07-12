# Patch 83O.1 Security Review

- Caller JWT validation remains in `privileged-action`; actor identity still comes from `auth.getUser()`.
- RPC requires `auth.role() = service_role`.
- Actor must be an active profile in the requested organization.
- Actor must have an active, global-scope `super_admin` or `governance_admin` role whose organization is null or matches the requested organization.
- Cross-organization department, division, and manager resolution is denied.
- Function remains `SECURITY DEFINER` with exact `search_path = pg_catalog, public, pg_temp` and fully qualified application objects.
- Execution is explicitly revoked from `PUBLIC`, `anon`, and `authenticated`; only `service_role` receives `EXECUTE`.
- Manager relationship changes are limited to ensuring an explicit `department_manager` role for the validated manager and department. Existing managers and profile affiliation are not modified.
- Raw rows, JWTs, keys, and authorization headers are not stored.
- User import actions, tables, and RPCs are unchanged.
- Frontend execution remains gated by `VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED === "true"` and is disabled for this patch.
- No production-readiness claim is made.
