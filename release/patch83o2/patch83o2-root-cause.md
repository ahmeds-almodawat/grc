# Patch 83O.2 Root Cause

- Migration 168 and the deployed `apply_department_import_batch(uuid, uuid, text, text, jsonb)` definition were selected for comparison.
- Migration 168 appends scalar text directly to `v_errors text[]` with `v_errors := v_errors || 'message'` in every validation-message branch.
- PostgreSQL resolves the array concatenation operator by treating the untyped scalar literal as an array input. Messages such as `invalid division` and `manager not found` are not valid array literals, producing `malformed array literal` instead of the intended structured rejection.
- The inspection covered all array variables: `v_errors`, `v_seen_codes`, `v_affected_ids`, `v_manager_ids`, and `v_existing_department_ids`.
- Unsafe self-concatenation also existed for `v_seen_codes` and `v_affected_ids`. Although those values may cast successfully in some paths, migration 169 uses explicit typed array appends for them as well.
- Runtime failures observed before this correction: invalid division returned HTTP 409 with `malformed array literal: "invalid division"`; missing manager returned HTTP 409 with `malformed array literal: "manager not found"`.

The defect is limited to array append expression typing. No schema, authentication, authorization, scoping, validation ordering, DML, audit mapping, or RPC contract change is required.
