# Patch 83O.2 Security Review

- The function remains `SECURITY DEFINER` with exact `search_path = pg_catalog, public, pg_temp`.
- `auth.role() = service_role` remains mandatory.
- The actor must remain an active profile in the requested organization with an active, global-scope `super_admin` or `governance_admin` role.
- Organization-scoped department, division, and manager validation remains enforced.
- Manager authority remains represented through department-scoped `user_roles`; profile affiliation is not changed.
- Both `create_only` and `create_and_update` remain enum-controlled.
- Every row is validated before any persistent DML, and execution remains atomic under PostgreSQL statement transaction semantics.
- Raw imported rows are not stored; canonical `audit_logs.table_name` and `record_id` mappings remain unchanged.
- Execute remains revoked from `PUBLIC`, `anon`, and `authenticated`, and granted only to `service_role`.
- Frontend department import execution remains disabled. Live mutation approval is absent.
- No authentication or authorization assertion is weakened, and no production-readiness claim is made.
