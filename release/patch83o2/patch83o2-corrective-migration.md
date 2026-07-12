# Patch 83O.2 Corrective Migration

Migration: `169_patch83o_validation_error_array_fix.sql`

- Replaces the existing RPC using its exact five-argument signature.
- Preserves the migration 168 function body except for the migration comment and array append expressions.
- Converts every validation-message append to `pg_catalog.array_append(v_errors, 'message')`.
- Converts seen-code and affected-department UUID appends to `pg_catalog.array_append`.
- Keeps invalid division and missing/invalid manager outcomes in the structured `status = rejected` response with row-level error arrays.
- Introduces no table, column, index, constraint, trigger, policy, or raw-row storage change.
- Leaves migrations 167 and 168 unchanged.

Predeployment checks passed, including a byte-for-byte preservation assertion for migrations 167 and 168, an exact transformation comparison between migrations 168 and 169, and rejection of self-concatenation on every declared array variable. Migrations 167, 168, and 169 also compiled successfully in sequence inside a local transaction that ended with `ROLLBACK`.
