# Patch 83U — Employee ID Authentication and Credential Governance

## Status and safety boundary

Patch 83U remains an uncommitted release candidate on `patch83t-controlled-user-excel-import`. Migrations 173, 174, and 175 are not edited by this remediation. Migration 176 is already applied to staging and remains byte-for-byte unchanged at SHA-256 `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`. Forward-only migration 177 has not been applied and the matching Edge correction has not been deployed. No production Supabase resource, production Auth user, Vercel setting, production import, or production record was accessed or changed during this remediation. Local and mocked tests are not hosted proof.

The staging facts below predate this local corrective work and are recorded from the supplied hosted evidence, not from a new hosted action by this remediation:

- staging project reference `zghsgzrdwbqdrpuxanac`;
- runtime `emergency_suspended`, state version `3`;
- designated Super Admin `83d92a59-6909-44e7-80f3-aff60a6734fb`;
- database/Auth credential version `1`, zero remaining Auth sessions, and credential state `session_revocation_review_required`; and
- Employee ID `11111` and provisioning record `46205a79-d012-4965-b246-0683dcace70c` remain explicit no-touch evidence.

Migration 174 remains deliberately dormant on a fresh installation. Its runtime singleton starts with `enforcement_state = 'disabled'`; installing the schema does not change an existing password, deactivate a profile, or rewrite/deactivate an existing role assignment.

## Hosted defects and migrations 176–177 correction

Hosted staging evidence exposed two coupled release blockers:

1. Password verification created a temporary Auth session, the password update invalidated that session, and its later logout returned `session_not_found`. A subsequent frontend password grant created another session, so database finalization correctly refused to mark the credential active while an Auth session remained.
2. After an external global sign-out reduced `auth.sessions` to zero, `patch83u_reconcile_credential_state` still called ordinary `patch83u_require_super_admin`. That ordinary guard requires a credential-active administrator under enforcement. Because the only designated Super Admin was the locked target, no eligible administrator could authorize reconciliation: a last-Super-Admin recovery deadlock.

Migration 176 does not weaken `patch83u_require_super_admin`. It adds a dedicated service-role-only `patch83u_reconcile_credential_state` wrapper over the owner-only `patch83u_reconcile_last_super_admin_recovery` implementation for the exact designated administrator to reconcile only themself while runtime is `emergency_suspended`. This is an operator recovery RPC, not a browser/UI/Edge action: the required zero-session predicate precludes an authenticated target session, and emergency Edge mutations remain blocked. The exception is fail-closed unless all identity, lifecycle, global-role/scope, organization, Auth health/email, credential-version, `legacy_verified`, permitted previous-state/operation-source, zero-session, null-safe Employee-ID confirmation, request-ID, and idempotency predicates are proved. It writes append-only credential audit evidence and cannot provision a user, reset another user, change runtime state, or authorize any ordinary administrative action.

Migration 176's intended atomic-finalizer identifier was 67 UTF-8 bytes, but PostgreSQL stores at most 63 bytes for an identifier. The staging catalog therefore contains the truncated source name `patch83u_finalize_required_password_change_after_session_revoca`, while an RPC call using the intended full string cannot resolve it by that exact API name. Migration 177 renames that exact object in place to the explicit 50-byte stable name `patch83u_finalize_password_change_after_revocation`, preserves the migration-176 protected body, reasserts `SECURITY DEFINER` and the safe `search_path`, and re-proves service-role-only execution. It fails closed if the source security contract or destination uniqueness differs.

The corrected password-change sequence uses the already-authenticated request only to authorize the protected server workflow. It performs current-password verification before the password mutation, begins the protected operation, and requests supported Auth Admin global sign-out while the disposable verification session is still valid. Only then does it update the password/credential metadata and call `patch83u_finalize_password_change_after_revocation`. That service-only finalizer takes a short `SHARE` lock on `auth.sessions`, proves zero target sessions, and invokes the existing protected finalizer inside the same transaction, closing the insert race between proof and activation. Both an exact successful global sign-out result and this atomic zero-session finalization are required for `active`. It never signs the user in again after revocation and never creates a replacement browser session before finalization. A `session_not_found` result from an already-invalidated session is never global-revocation proof. Any ambiguous or nonzero session result remains `session_revocation_review_required`. The browser ends signed out; a fresh login is permitted only after finalization has returned terminal success.

## Authenticate-first login contract

Patch 83U never uses credential governance as a pre-authentication password check. The required order is:

1. Normalize the visible identifier. An identifier without `@` maps to `lower(employee_id) + '@almodawat.sa'`; a full email remains a legacy-compatible Auth identifier. Leading zeroes are preserved.
2. Call `supabase.auth.signInWithPassword` with the submitted password and, when required, a fresh CAPTCHA token.
3. Require an explicit successful Supabase Auth result and authenticated session, then retain that session through the normal Supabase client.
4. If `VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED` is exactly `true`, call authenticated `patch83u_get_capabilities`.
5. After compatible capabilities are proved, call authenticated `patch83u_get_credential_state`.
6. Only after the credential decision allows normal access may the application load profile, roles, navigation, dashboard, global search, or other operational data.
7. Route the authenticated user to the active application, Forced Password Change, reconciliation, access denied, or the authenticated deployment-compatibility screen.

Invalid credentials remain an Auth failure. A successful login followed by a missing migration, old Edge action, version mismatch, unavailable credential state, or reconciliation condition remains an authenticated governance outcome and is never relabeled as an invalid password.

The Auth provider uses explicit transition states, monotonic operation generations, cancellation, per-session single-flight capability/credential pipelines, immediate prior-user authorization clearing, stale-response checks, bounded compatibility retries, focus/visibility rechecks, and cross-tab credential invalidation. Provider unmount increments both generation and Auth-event epoch, clears deferred/session/capability flights, and aborts pending work. A late successful sign-in after unmount removes only its exact token if that token is still persisted; it cannot start capability/data loading, publish authorization state, or erase a newer user's session.

## Feature, capability, and version gates

`VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED` defaults to off and only the exact string `true` enables it. Missing, blank, `TRUE`, `1`, `yes`, or `enabled` values remain off. When off, the frontend makes no Patch 83U credential-governance action call and continues the stable existing authentication path. The flag controls deployment compatibility; it is not an authorization bypass.

The capability action requires a valid authenticated JWT before it reads Patch 83U runtime state. It returns only the Edge contract version, installed schema version, runtime enforcement state, action-availability booleans, server time, and compatibility status. Current contract values are:

- Edge: `patch83u-edge-auth-first-v1`
- Frontend: `patch83u-frontend-auth-first-v1`
- Installed schema version: `174`
- Runtime schema marker: `174.2-auth-first`

The frontend contract version is also sent to the privileged Edge bridge and to the REST/storage data boundary. Global search's caller-JWT PostgREST second hop forwards the same already-validated pinned frontend-contract header, so its credential-aware RLS decision does not lose deployment compatibility context. An old cached client cannot obtain application data once enforcement is active merely because its Vite flag or bundle is stale.

If the authenticated handshake is unavailable or incompatible, the application shows:

> Your login was successful, but credential governance is not fully deployed. No application data has been opened. Contact the system administrator.

The screen provides a bounded/cooldown compatibility retry, manual hard refresh, and sign out. It does not render the normal login form or application shell and does not loop on automatic reload.

## Runtime activation states

Migration 174 creates a service-controlled, audited runtime singleton with four states:

- `disabled`: schema installed, existing stable access preserved, no forced rotation, and provisioning/reset/password-transition mutations unavailable.
- `prepared`: matching frontend and Edge behavior can be checked while existing access remains stable; provisioning and credential mutations remain unavailable.
- `enforced`: post-authentication credential rotation, credential-aware RLS/data-boundary enforcement, protected password actions, reset, and new managed provisioning are active.
- `emergency_suspended`: new provisioning, reset, and password transitions are disabled; legacy application access can be temporarily restored by the database's documented break-glass rule without deleting credential or audit evidence.

Runtime transitions are service-role-only, idempotency-keyed, append-only audited, and require the exact phrase for the target state:

- `PATCH83U_PREPARE_CREDENTIAL_GOVERNANCE`
- `PATCH83U_ENFORCE_CREDENTIAL_GOVERNANCE`
- `PATCH83U_DISABLE_CREDENTIAL_GOVERNANCE`
- `PATCH83U_EMERGENCY_SUSPEND_CREDENTIAL_GOVERNANCE`

Preparation/enforcement requires the migrations' structural contracts, matching Edge/frontend versions, the deterministic read-only preflight hash, zero activation blockers, and a designated existing eligible global Super Admin. During `prepared`, an authenticated capability read by that designated Super Admin records the narrow compatibility attestation required before `enforced` can be selected. Normal browser roles cannot activate or suspend runtime enforcement.

## Existing-user backfill and Super Admin continuity

Migration 174 preserves each existing Auth user ID, Auth email, password, profile identity/lifecycle, and role row. A uniquely verified, active legacy identity is backfilled as `existing_password_rotation_pending`; ambiguity, collision, unusable Auth identity, or unsafe profile match becomes `reconciliation_required`. Existing users without a trusted Employee ID can continue to use their existing full Auth email.

While runtime is `disabled` or `prepared`, pending rotation does not interrupt stable access. Once runtime is `enforced`, the first authenticated credential lookup lazily and atomically moves `existing_password_rotation_pending` to `existing_password_change_required`. The user then sees Forced Password Change before any application data is loaded.

Credential state makes an otherwise active role ineffective while enforcement is active. Patch 83U does not delete, duplicate, or set the existing `user_roles` row inactive for rotation or reset, and it does not change the profile's canonical lifecycle. Successful credential completion makes the already-preserved eligible role effective again through the credential gate.

Enforcement cannot activate without a designated existing global Super Admin whose Auth identity is usable, profile is active, role shape is exactly global, organization is consistent, and identity has no collision/reconciliation blocker. The normal path allows that administrator to authenticate with the existing password and complete mandatory change without another administrator. If a partial hosted Auth/session result instead leaves the only designated administrator in a review state, the ordinary administrator guard remains closed; only migration 176's exact emergency-suspended, service-role-only self-recovery path may reconcile the terminal proof. Migration 177 changes only the atomic-finalizer RPC identifier and does not widen that exception. Existing last-Super-Admin protections still apply to role removal, lifecycle deactivation/archive, and administrative reset.

## Canonical User Management lifecycle execution

Deactivate, reactivate, archive, and unarchive leave the legacy Patch 19 bridge before it can replace the service-role claim. The authenticated Edge bridge calls service-only `patch83u_apply_user_lifecycle` with the exact target, one of the four exact action names, and a required trimmed reason of at most 500 characters. The database revalidates a canonical same-organization global Super Admin or Governance Admin; privileged active targets require Super Admin. Null/unknown actions, inconsistent lifecycle metadata, self-deactivation/archive, cross-organization targets, the last eligible Super Admin, and any target with an open protected provisioning row fail closed before mutation.

Deactivate/archive writes canonical profile metadata, moves credential state to `disabled` with a new session cutoff, deactivates every active role, and records one role audit per row plus the lifecycle audit. Reactivate/unarchive sets the profile active and credential state to `reactivation_change_required` for managed/verified identities (otherwise reconciliation), clears deactivation metadata, records the credential/lifecycle evidence, and restores no role automatically. A blocked profile that still has any active role is rejected as lifecycle/role drift before mutation and must be reconciled explicitly. The Edge response is accepted only after exact profile, credential, role, event, and audit proof, including zero remaining active roles on activation.

## Managed provisioning

Patch 83T final import execution creates a protected provisioning record; upload, parsing, validation, preview, queue opening, and queue refresh do not create an Auth user. New managed provisioning is available only when runtime state is exactly `enforced`, the capability contract advertises provisioning, and the actor is a credential-valid canonical global Super Admin in the target organization.

The server derives the Auth email as `lower(employee_id) + '@almodawat.sa'` and uses the exact, case-preserved Employee ID as the initial Auth password. No fallback password is generated. The password is not persisted, logged, audited, exported, or returned. Hosted password policy remains authoritative; a policy rejection is safe and non-mutating. Ambiguous Auth results or incomplete finalization enter protected reconciliation rather than blind recreation or deletion.

After the first managed password change has proved the terminal credential state, an exact service-only transaction marker permits only the invited-to-active profile transition. Its trigger branch updates only the same-user/same-organization `requested_lifecycle` and returns before the generic reactivation state/cutoff/event rewrite. This prevents a successfully finalized first change from becoming a second forced password change. Ordinary lifecycle administration cannot use the marker.

## Forced password change

The forced form requires current/temporary password, new password, confirmation, and a CAPTCHA token when hosted CAPTCHA is configured. The login password is never carried into React state outside the login surface, context, storage, URL, logs, analytics, or the forced page; the user enters it again.

The Edge action first validates the caller JWT and reads trusted Auth email, Employee ID, credential state, and credential version. A read-only preparation step validates the request. It then verifies the submitted current password before the protected mutation with a separate anon-key Supabase client configured with `persistSession = false`, forwarding the CAPTCHA token when present. The disposable access/refresh tokens are neither returned nor logged.

Only after successful verification does the idempotent database mutation begin. The server requests supported global revocation using the still-valid disposable verification token, then uses the Auth Admin API to change the password and credential-version metadata, and finally calls the service-only atomic `patch83u_finalize_password_change_after_revocation` RPC. Database finalization can advance exactly one version and return `active` only when global sign-out succeeded and the locked transaction proves zero target `auth.sessions` rows. The Edge flow does not call `signInWithPassword` after revocation and does not grant a replacement browser session. The browser clears its old local state, broadcasts invalidation, and displays:

> Password changed. Sign in again using your new password.

Normal access never continues in the pre-change session.

Wrong current password, input, or CAPTCHA failure before the operation begins causes no mutation and preserves the normal retry surface. If hosted password policy definitively rejects the new password after global revocation but proves no password write, the credential returns to required-change state but the revoked browser session is compare-cleared; the user must sign in again with the unchanged current password and choose a different new password. Auth success followed by database-finalization failure becomes `recovery_required`; a sign-out error, `session_not_found`, nonzero session count, or otherwise ambiguous revocation becomes `session_revocation_review_required` unless both revocation proofs succeed. The protected ledger remains idempotent for controlled same-request inspection/replay, but the browser never signs in or resubmits after an ambiguous response: it clears the form/session and requires administrator reconciliation.

## Super Admin reset

Only an active, credential-valid, canonical global Super Admin may reset another user in the same organization. Governance Admin, self-reset, cross-organization reset, malformed role/scope/hierarchy references, unverified identities, and reset of the last eligible Super Admin are denied.

Reset requires exact target user and Employee ID, a manually reviewed temporary password and matching confirmation, mandatory reason that does not contain the exact temporary password, UI phrase `RESET USER PASSWORD`, backend confirmation `PATCH83U_RESET_USER_PASSWORD`, and an idempotency request ID. The temporary password may equal Employee ID when hosted Auth policy accepts it; Patch 83U adds no unrelated length rule.

Reset begins by making target access ineffective through credential state, while leaving profile lifecycle and role rows unchanged. Ordinary success requires an exact successful Auth Admin update response, a follow-up Auth read proving the same target/canonical email/new credential version, and a service-only read-only proof that zero target `auth.sessions` rows remain. Finalization rechecks session absence before advancing the version and setting `admin_reset_change_required`; otherwise it returns protected session review/recovery. The Edge action never signs the target in with the temporary password, so hosted CAPTCHA cannot turn the proof step into a false reset failure. Partial or ambiguous outcomes remain locked and are safe to replay by the same request ID. The target then follows the normal authenticate-first login path with the temporary password and must complete Forced Password Change.

## Session and data-boundary enforcement

Supported Supabase Admin sign-out is used where a verified user JWT exists, including self password change; Patch 83U never directly edits `auth.sessions`. Required password change performs global sign-out before the password update invalidates its disposable verification session, then requires Auth read-back and atomic zero-session/finalization under a database lock. Administrator reset uses its existing Auth Admin update/read-back plus zero-session proof. `session_not_found` does not prove global revocation, and zero sessions without a successful sign-out result is not promoted to ordinary success. Because sign-out or session-row absence does not prove that every issued JWT has instantly expired, stale access is independently denied by credential state/version, password/reset cutoff, session ownership/existence checks where required, active profile lifecycle, exact role/scope, organization RLS, privileged-action gates, and storage/data-boundary checks.

Hosted global sign-out and session-table behavior still require authorized disposable-project proof. If revocation cannot be proved, the operation reports review/recovery rather than ordinary active access.

## Coordinated release sequence

For a fresh installation, the documented release order is:

1. Keep the current frontend live.
2. Apply migration 173.
3. Apply migration 174 with enforcement still `disabled`.
4. Apply reviewed migrations 175, 176, and 177 in order when they are part of the pending chain.
5. Verify the existing frontend login remains usable.
6. Deploy the compatible `privileged-action` Edge Function.
7. Verify authenticated `patch83u_get_capabilities` using the designated existing Super Admin.
8. Deploy the new frontend with `VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED=true` exactly.
9. Verify that frontend authenticates the Super Admin and reads compatible capabilities while enforcement remains `disabled`/`prepared` (before the prepared attestation is used for enforcement).
10. Transition runtime to `prepared` using the reviewed preflight hash and exact confirmation.
11. Repeat compatibility checks as the designated existing Super Admin and verify that prepared attestation is recorded.
12. During a controlled maintenance window, transition runtime to `enforced` with the exact confirmation.
13. Existing users authenticate with their existing passwords and are then forced to change them.

Vercel release controls must ensure the current HTML entry point is revalidated rather than retained with a long immutable cache, while content-hashed assets may remain immutable. The release owner must verify the intended production environment variable, deployment alias, response cache headers, and absence of a stale service-worker/CDN copy. Users receive a manual hard-refresh action; there is no destructive automatic reload loop.

No part of this local work executed that sequence or changed hosted configuration.

For the already emergency-suspended staging environment, do not repeat bootstrap or provision a user. Migration 176 is already applied and must not be replayed; first verify its repository SHA-256 is still `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`. The remaining correction order is: verify migration 177's reviewed checksum `22B3FD74254E4532E04187DA2303FC2FF4EAD95EAC06296827F76156B77315F0`; prove it is the only intended pending staging migration; apply only `177_patch83u_explicit_password_finalizer_rpc_name.sql` to project `zghsgzrdwbqdrpuxanac`; confirm the final catalog RPC name is exactly `patch83u_finalize_password_change_after_revocation`; re-prove zero target sessions; invoke the exact controlled service-role reconciliation RPC outside browser/Edge; deploy only the matching future-flow `privileged-action` Edge correction; verify emergency-suspended mutations remain blocked and complete the nonmutating recovery checks; then make a separate audited decision about returning through `prepared` to `enforced`. Migration-177 local/disposable, Edge-contract, SQL, unit, browser, build, and security validation has passed; hosted application and deployment remain separately authorized work. The corrected forced-change flow requires a later separately authorized enforced-runtime hosted exercise and cannot run during emergency suspension. Migration 177, the matching Edge change, recovery RPC invocation, and runtime changes were not applied or deployed by this remediation.
