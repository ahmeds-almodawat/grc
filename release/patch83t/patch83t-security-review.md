# Patch 83T — Security Review

## Authorization and isolation

- The browser sends validated workbook rows through the authenticated `privileged-action` Edge bridge. There is no browser database-write or Auth Admin fallback.
- The service-role key remains server-only. The protected import, identity-reference, profile-update, and provisioning functions are revoked from `public`, `anon`, and `authenticated` and independently require the service role.
- The database rechecks the verified actor, active profile and credential, organization, canonical global-admin role shape, requested workbook role hierarchy/scope references, target organization, self-change rules, and eligible last-Super-Admin protection.
- Import execution is restricted to organization-aligned global Super Admin or Governance Admin users. Governance Admin cannot assign privileged global roles and receives no password-reset or reconciliation authority.
- RLS, JWT verification, organization scoping, role checks, audit logging, safe `search_path`, and service-role isolation are preserved.

## Identity and account-action controls

- The exact Employee ID is the managed login identity. The server derives the Auth alias as `lower(employee_id) + '@almodawat.sa'`; optional `contact_email` is never treated as an Auth identity.
- Leading zeroes are preserved. Unsupported Employee-ID characters are rejected instead of being encoded or silently altered.
- The preview and database independently evaluate `create`, `update`, or `create_or_update` against profiles, Auth identities, and open provisioning identities.
- `create` is fail-closed on any existing identity; `update` requires one exact profile and cannot provision; `create_or_update` updates one exact profile or records one protected provisioning snapshot.
- Exact and case-insensitive Employee-ID evidence, synthetic Auth-email evidence, open provisioning evidence, and protected profile identity evidence are evaluated separately. A case-insensitive-but-not-exact Employee-ID collision never becomes an update.
- Ambiguous or cross-user matches, duplicate workbook Employee IDs, multiple rows targeting one profile, changed target plans, tenant mismatch, and active cross-organization-role anomalies reject every account action. Protected identity-reference responses expose match/alignment booleans rather than profile PII.
- Resolved profiles and organization-level execution are locked during preflight. All business writes occur in one database transaction, so any rejected row rolls back the batch.

## Execution and lifecycle controls

- Upload, parsing, validation, preview, error export, and confirmation entry do not write business data.
- Execute Import requires the exact phrase `EXECUTE USER IMPORT` in the frontend, Edge bridge, and service-role database function before any business write. Replacing/removing the workbook or closing the import dialog clears the confirmation.
- The database recomputes canonical row, provisioning, and audit counts and returns database-derived batch/provisioning IDs plus a SHA-256 digest of its canonical payload; browser-supplied summary counts are not accepted as proof. The frontend validates identifier shape/uniqueness, exact counts, and digest shape before presenting the write as proven.
- Role/scope compatibility is enforced as an error, never reduced to a warning.
- Lifecycle changes keep status, active flag, deactivation metadata, review metadata, credential holds, and role activation consistent. Locked/inactive profiles cannot retain active roles; activation clears stale deactivation metadata. Tenant alignment and scope/hierarchy-reference integrity are rechecked at execution.
- Self-deactivation, batch-wide last-Super-Admin loss, organization-crossing changes, and privileged-role assignment by a Governance Admin remain blocked.

## Protected data and reconciliation

- New managed profiles use synthetic Auth email in `profiles.email` and optional contact email in nullable `profiles.contact_email`. Existing legacy Auth identities are not rewritten.
- Phone and optional contact email changes use the protected profile-update path and appear only as non-secret profile/audit data.
- Unknown identities are stored in the forced-RLS, service-role-only `user_account_provisioning` queue. Imported identity/intent fields are immutable, open identities are unique, and records cannot be deleted through a browser path.
- A queue record can advance only through explicit provisioning or Super-Admin reconciliation. Retries re-resolve the canonical Auth identity so a lost Auth response cannot blindly create a duplicate account.
- Provisioning records, execution rows, audit events, API responses, exports, and logs never contain a plaintext password, password hash, temporary password, Auth/session token, or service-role secret.
- Patch 83T itself performs no Supabase Auth create/update and activates no normal role before Patch 83U completes the required password-change workflow.

## Deployment boundary

Migrations 173 and 174, the matching Edge Function, and the matching frontend form one coordinated security contract and must be released in that order. A Patch 83T/83U frontend calling the old Edge deployment receives `UNSUPPORTED_PRIVILEGED_ACTION` and remains fail closed. The error must not be hidden with a direct-RPC, legacy-write, or credential-state bypass.

Neither migration was applied or executed, no database proof transaction was run, and no Edge Function or frontend was deployed as part of this work. Database transaction proof and real hosted Auth behavior remain controlled-release gates; this review does not claim hosted proof.

## Existing controls unchanged

- Migration 172 and Patch 83S Department Import behavior are unchanged.
- No historical migration, `.env`, or `.env.local` file is modified.
- Existing permissive RLS policies are not broadened.
- JWT and credential-state verification are not weakened for local compatibility.
