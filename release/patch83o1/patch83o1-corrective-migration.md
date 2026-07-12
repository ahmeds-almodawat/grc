# Patch 83O.1 Corrective Migration

Migration: `168_patch83o_department_import_schema_compatibility.sql`

- Keeps the existing RPC signature, so the Edge Function requires no redeployment.
- Alters no tables and adds no speculative columns.
- Replaces only the RPC body and reapplies explicit execution grants.
- Uses canonical core department and audit columns.
- Performs authorization, payload bounds, mode validation, and full row validation before any DML.
- Rejects unsupported department type input instead of silently discarding it.
- Resolves manager email to an active same-organization profile and ensures the existing department-scoped role relationship.
- Preserves normalized organization/code identity, including inactive rows, and rejects ambiguous historical duplicates.
- Leaves division unchanged on updates and retains existing values for blank optional fields.
- Writes batch summaries and minimal audit metadata only; raw uploaded rows are never stored.
- Relies on PostgreSQL statement transaction semantics so an execution-phase error rolls back departments, roles, batch history, and audit records together.

Predeployment syntax verification loaded unchanged migration 167 followed by migration 168 inside a local transaction and completed with `ROLLBACK`.
