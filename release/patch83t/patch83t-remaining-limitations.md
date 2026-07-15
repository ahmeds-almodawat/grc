# Patch 83T — Remaining Limitations and Release Gates

- Patch 83T does not create Supabase Auth accounts. A permitted `create` or unmatched `create_or_update` row creates only a protected provisioning record; Patch 83U requires a separate global-Super-Admin action to provision or reconcile it.
- Optional `contact_email` is profile contact data, not a login alias. Managed sign-in uses the synthetic Auth email derived from Employee ID. Existing legacy Auth identities are not rewritten automatically.
- Passwords are prohibited in the workbook, preview, exports, provisioning records, audit events, and API results.
- The workbook supports `global`, `department`, and `assigned_only` scopes. `division` and `unit` scope/reference pairs are not collected, so roles requiring them, including `division_head`, are rejected.
- The workbook is limited to 5 MB and 5,000 data rows. The UI renders the first 50 preview rows while retaining all validated rows in the controlled execution payload.
- Existing profiles with case-insensitive-but-not-exact Employee-ID collisions, ambiguous Auth/profile/provisioning identity, tenant mismatch, or active cross-organization role anomalies require explicit access-governance correction before import. Protected identity proof intentionally omits profile PII.
- Migration 173 and migration 174 are unapplied. The protected import, provisioning, credential, and reconciliation paths are unavailable until migrations 173 and 174, the matching Edge Function, and the frontend are released in that order.
- The new frontend intentionally fails closed with `UNSUPPORTED_PRIVILEGED_ACTION` when it reaches the old deployed Edge Function. There is no compatibility fallback.
- Real database transaction/RLS proof and hosted Supabase Auth proof have not been claimed or run. They require an explicitly authorized controlled environment; no migration, database mutation, hosted Auth operation, or deployment occurred during this work.
- Employee ID `11111` is accepted by local workbook and provisioning validation, but whether hosted Supabase accepts `11111` as an initial password remains unproven. A hosted policy rejection must leave the record retryable as `policy_blocked`, create no partial profile/role/credential state, and return the documented safe message without substituting a password.

## Controlled release requirement

After review, release in this order: migration 173, migration 174, matching `privileged-action` Edge Function, then frontend. Run the rollback-only SQL proofs and authorized browser/Auth tests in the controlled target before enabling production use. The old Edge deployment must remain fail closed with `UNSUPPORTED_PRIVILEGED_ACTION`; no compatibility fallback is allowed. Import execution, account provisioning, reconciliation, password reset, and permanent password change remain separate actions with separate confirmation and authorization boundaries.
