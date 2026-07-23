# Patch 83T/83U Release Preflight Runbook

## Purpose and boundary

Run `supabase/tests/patch83tu_release_preflight.sql` before any authorized application of the Patch 83T/83U migration chain and again before a controlled runtime transition to `prepared` or `enforced`. For the current staging incident, migration `176_patch83u_last_super_admin_recovery.sql` is already applied. Verify its repository SHA-256 remains `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`, separately review forward-only migration `177_patch83u_explicit_password_finalizer_rpc_name.sql`, prove migration 177 is the only intended pending staging migration, and keep runtime `emergency_suspended` throughout recovery validation. The preflight is read-only: it uses `SELECT`/`WITH` catalog and data inspection and does not apply migrations, update Auth, acquire an explicit write lock, repair migration history, reset a database, or change runtime state.

The results contain account identifiers and must be treated as restricted release evidence. Do not paste detail rows into tickets, chat, source control, build output, or general logs. The deterministic preflight hash is non-secret evidence; the underlying account-level report remains restricted.

## Preconditions

1. Obtain a change record and written authorization for the named environment. Local review does not authorize hosted access.
2. Verify migration 172 is unchanged; migrations 173, 174, and 175 are unchanged by the remediation; migration 176 matches the already-applied staging artifact; and migration 177 is the reviewed forward-only identifier correction.
3. Record the Git revision and checksums of migrations 173/174/175/176/177 and the preflight SQL.
4. Use an explicitly read-only database role with required catalog, `public`, `auth.users`, `auth.identities`, `auth.sessions`, and migration-history visibility. Prefer database-enforced `default_transaction_read_only`.
5. Do not expose a database password, service-role key, bearer token, session identifier, or connection string in command history or evidence.
6. Identify the database owner, release approver, security reviewer, remediation owners, and proposed designated existing global Super Admin before execution.
7. Confirm the proposed Edge/frontend contract versions are exactly `patch83u-edge-auth-first-v1` and `patch83u-frontend-auth-first-v1`.

## Capture every result group

A SQL error, truncated result, missing section, insufficient permission, or edited execution file is a failed preflight, not a zero finding. Capture the results in file order, including:

- population totals and profiles without matching Auth users;
- Auth email/identity health, including confirmation, ban, deletion, and provider-identity evidence;
- likely authenticatable existing users, explicitly understood as metadata/identity evidence rather than verification of a plaintext password;
- predicted identity modes and active reconciliation outcomes;
- users predicted to enter `existing_password_rotation_pending`, including legacy full-email users without a trusted Employee ID;
- invalid active role/scope/hierarchy shapes and roles lacking valid credential identity;
- role rows that become runtime-ineffective only when enforcement is active, with `role_rows_physically_deactivated_by_credential_backfill = 0`;
- eligible global Super Admins by organization, deterministic bootstrap candidates, the preferred designated candidate, organizations without a candidate, and organizations that would lose their last eligible Super Admin;
- case-insensitive Employee-ID and synthetic Auth-email collisions;
- active Auth-session summaries by user and organization, without selecting session IDs, access tokens, refresh tokens, or secrets;
- migration-history, runtime-table/default/constraint, routine, RLS, grant, RPC, and view readiness;
- estimated migration 174 rows and runtime-ineffective role counts; and
- runtime activation blocker detail/summary plus `patch83u_deterministic_preflight_hash` using the ordered non-secret projection.

Migration 174 preserves existing Auth IDs, emails, passwords, profile lifecycle, and role rows. The preflight predicts which roles would be ineffective under the credential gate; it does not predict a physical role deactivation.

## Blocking release conditions

Do not apply or activate while any of the following is true:

- The preflight is incomplete, changed for execution, stale for the proposed release, or does not produce the deterministic SHA-256 hash.
- Migration 173 is absent or the migration 174 structural/runtime contract is not the reviewed version.
- Any organization lacks an eligible existing global Super Admin, the proposed designated Super Admin is not eligible, or last-Super-Admin continuity is uncertain.
- Any Auth identity needed for bootstrap is missing, unconfirmed, banned, deleted, ambiguous, or colliding.
- Any case-insensitive Employee-ID or synthetic Auth-email collision remains unresolved.
- Any active role has a malformed canonical scope/hierarchy shape or organization mismatch.
- Any active profile predicted for `reconciliation_required` lacks an approved user-by-user remediation owner and access decision.
- Browser RPC/view/catalog output differs from the reviewed Auth-surface inventory.
- Runtime activation blockers are nonzero.
- The estimated migration/operational impact exceeds the approved maintenance, evidence, backup, or rollback capacity.
- The expected Edge or frontend contract differs from the reviewed constants.
- Any runtime/capability/action/role/scope contract accepts a null or unknown value instead of failing closed.
- User lifecycle execution still reaches the historical Patch 19 claim-rewriting bridge, can mutate an open provisioning row, can restore roles automatically, permits activation while any historical role is active, or lacks exact profile/credential/role/audit proof.
- The controlled invited-to-active finalization marker can be reached outside its exact service-only transaction or can rewrite credential state/cutoff/events and create a second forced-change loop.
- Migration 176 changes ordinary `patch83u_require_super_admin`, grants its recovery wrapper or atomic required-password finalizer to `PUBLIC`, `anon`, or `authenticated`, or permits recovery outside `emergency_suspended`.
- Migration 177 does anything other than rename the exact 63-byte truncated finalizer in place to `patch83u_finalize_password_change_after_revocation`, changes the migration-176 protected body, leaves the old name present, accepts a destination conflict, or fails to preserve the safe `search_path` and service-role-only execute contract.
- The recovery path permits actor/target/designated-ID mismatch; anything other than exactly one valid active global Super Admin role; invalid organization/scope/hierarchy; unhealthy/mismatched Auth identity; credential-version mismatch; non-`legacy_verified` identity; an unapproved previous state/operation source; any remaining Auth session; wrong/null-unsafe Employee ID confirmation; invalid/conflicting request ID; or missing append-only audit evidence.
- The corrected password-change flow signs in again after revocation, creates a replacement browser session before finalization, treats `session_not_found` as global proof, or can return `active` without the atomic locked zero-session finalizer.

Preflight does not inspect or validate existing passwords. `likely_authenticatable_existing_users` means the account has usable Auth identity metadata; only a normal Supabase Auth login can validate the user's existing password.

## Runtime preparation and activation gates

Migration 174 must finish with `enforcement_state = 'disabled'`. Do not alter that default in the migration or activate it in the same database change.

The service-role-only transition RPC requires an idempotency request ID, mandatory reason, exact contract versions, designated existing Super Admin, deterministic preflight hash, zero blockers, and an exact phrase:

- prepare: `PATCH83U_PREPARE_CREDENTIAL_GOVERNANCE`
- enforce: `PATCH83U_ENFORCE_CREDENTIAL_GOVERNANCE`
- disable: `PATCH83U_DISABLE_CREDENTIAL_GOVERNANCE`
- emergency suspend: `PATCH83U_EMERGENCY_SUSPEND_CREDENTIAL_GOVERNANCE`

`enforced` additionally requires prior `prepared` state and compatibility attestation by the same designated Super Admin. A normal browser role cannot invoke a runtime transition.

## Mandatory coordinated release sequence

1. Keep the current frontend live.
2. Apply migration 173.
3. Apply migration 174 with enforcement `disabled`.
4. Apply reviewed migration 175 when it is part of the pending chain.
5. Apply migration 176 before deploying the corrected recovery/session flow.
6. Apply migration 177 so the Edge and catalog use the exact stable finalizer RPC name.
7. Verify the existing frontend login still works.
8. Deploy the compatible `privileged-action` Edge Function.
9. Verify authenticated `patch83u_get_capabilities` using the designated existing Super Admin.
10. Deploy the new frontend with credential governance enabled by exact-true configuration.
11. Verify the new frontend authenticates the Super Admin and reads capabilities while enforcement remains `disabled`/`prepared`.
12. Move runtime state to `prepared` with the reviewed hash and exact confirmation.
13. Repeat the authenticated compatibility checks and verify prepared attestation.
14. During a controlled maintenance window, move runtime state to `enforced`.
15. Existing users authenticate with their existing passwords and are then routed to required password change.

Never activate migration enforcement first and use user lockout as the deployment window. New managed provisioning remains unavailable until step 13 succeeds.

## Current staging remediation gate

The current staging project is `zghsgzrdwbqdrpuxanac`, runtime state is `emergency_suspended`, and state version is `3` in the supplied evidence. The designated Super Admin is `83d92a59-6909-44e7-80f3-aff60a6734fb`. Database/Auth credential version is `1`, session count is `0`, and credential state is `session_revocation_review_required`.

Before any authorized staging application:

1. Confirm the linked project reference is exactly `zghsgzrdwbqdrpuxanac`; stop on any production or unknown reference.
2. Confirm migration 176 is recorded as applied and its repository SHA-256 is exactly `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`; record migration 177, Edge, frontend, and test checksums.
3. Run the linked migration list and database-push dry run. Stop unless only `177_patch83u_explicit_password_finalizer_rpc_name.sql` is unapplied. Do not replay migration 176.
4. Confirm runtime remains `emergency_suspended`; do not combine migration application with a runtime transition.
5. Confirm Employee ID `11111` and provisioning UUID `46205a79-d012-4965-b246-0683dcace70c` are outside the test targets and remain untouched.
6. After authorized migration-177 application, prove the catalog contains only the exact stable finalizer name `patch83u_finalize_password_change_after_revocation`, re-prove zero sessions, and run the exact designated self-recovery through a protected service-role RPC invocation, not a browser/user-session/Edge call. Emergency Edge mutations must remain blocked.
7. Run every negative recovery predicate in an isolated rollback/disposable proof: enforced runtime, actor/target mismatch, non-designated actor, missing/invalid global role, Auth/database version mismatch, remaining session, wrong Employee ID, duplicate request ID, and unchanged ordinary Super Admin guard.
8. After the matching Edge staging deployment, prove provisioning/reset/change/reconciliation browser actions remain unavailable during emergency suspension and runtime does not transition automatically.
9. Validate the corrected forced-password flow locally or in a separately authorized disposable/enforced-runtime environment: no post-revocation replacement session, `active` only after exact sign-out success plus atomic locked zero-session finalization, and a signed-out browser. Do not try to obtain this proof by enabling the current emergency-suspended staging incident.

## Compatibility and cache proof

Before enforcement, record all of the following:

- authenticated capability response contains installed schema `174`, Edge contract `patch83u-edge-auth-first-v1`, compatible frontend contract, and the intended runtime state;
- disabled/prepared runtime preserves stable existing access and does not force rotation;
- prepared capability check by the designated Super Admin records the expected attestation;
- enforcement refuses mismatched/missing contracts or a different preflight hash;
- an incompatible cached client receives no application data at the enforced REST/storage/privileged-action boundary;
- the deployment-mismatch screen provides bounded retry, manual hard refresh, and sign out without loading profile/roles/navigation;
- Vercel serves the intended build/environment, the HTML entry point revalidates, hashed assets use the reviewed immutable policy, and no stale CDN/service-worker response survives the release; and
- emergency suspension is service-only, exact-confirmation, idempotent, audited, and does not delete credential/audit evidence.

## Remediation and rerun

Remediation is a separate authorized change. Do not edit data from the read-only preflight session. Correct identity, lifecycle, organization, role, hierarchy, or collision findings through an approved administrative path. Then open a new read-only session, rerun the complete unchanged preflight, and use only the new result and hash for activation.

## Evidence sign-off

Record:

- environment and project reference;
- Git revision and all file checksums;
- execution time, operator, and read-only role;
- restricted archive location for every result set;
- deterministic preflight hash;
- designated existing Super Admin;
- expected Edge/frontend contracts;
- activation blockers and remediation owners;
- Vercel/cache evidence owner;
- hosted Auth/CAPTCHA/session proof owner;
- security reviewer and database owner; and
- release approver, decision, expiry, and rollback trigger.

This runbook does not prove hosted password policy, CAPTCHA enforcement, Auth Admin mutation, session revocation, RLS/storage behavior, Vercel caching, migration execution, or Edge deployment. Each requires separately authorized evidence in the target release environment.
