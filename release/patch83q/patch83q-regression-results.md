# Patch 83Q regression results

Status after remote apply: live ACL verification passed; final static/build/proof suite is recorded below.

- Department Import transport remains `department_import_execute` through authenticated `privileged-action`; no browser call to `apply_department_import_batch` exists.
- `apply_department_import_batch(uuid, uuid, text, text, jsonb)` is already service-role-only live and is not targeted.
- Department Import feature flag remains exact-match fail-closed and disabled by default.
- User Import continues to use `patch19_apply_import_batch` through `privileged-action` and is not targeted.
- `search_grc_global(text, integer)` remains the sole direct browser RPC and is a stable read-only SECURITY INVOKER function.
- The four remediated write actions are represented as Edge transports in frontend/runtime registry, but the checked-in `privileged-action` allowlist does not register their names. This pre-existing mismatch is an activation blocker; the Edge Function was not changed or redeployed by Patch 83Q.

Live ACL checks:

- Direct anon/authenticated execution of the four remediated writes: denied by function ACL.
- `apply_department_import_batch`: remains service-role-only; direct authenticated execution remains denied.
- `search_grc_global`: unchanged stable SECURITY INVOKER direct read.
- No live users, organizations, divisions, departments, or other production rows were created or modified by regression testing.

Final validation:

- `git diff --check`: passed
- `npm run validate:build`: passed
- `npm run test:unit`: 22/22 passed
- `npm run validate:security`: passed with verified read-only and managed observations
- Patch 83M, 83N, 83O, 83O.1, 83O.2, 83O.3, 83P, and 83Q proofs: passed
- Department Import bridge and fail-closed configuration: Patch 83O/83P proofs passed; Edge Function source and deployment unchanged
- User Import bridge: Patch 83P proof passed; source and grants not targeted
