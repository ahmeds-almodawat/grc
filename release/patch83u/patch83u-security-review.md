# Patch 83U — Security Review

## Review conclusion and boundary

The local implementation is designed to authenticate first, keep migration 174 dormant on fresh installation, preserve existing passwords and role/profile lifecycle, and fail closed at the authenticated credential/data boundary. Migration 176 is already applied to staging and its repository SHA-256 remains `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`; forward-only migration 177 is not applied. Migrations 173, 174, and 175 are not modified by this remediation. No production Supabase, production Auth, Vercel, or production import action occurred.

The hosted facts in this review are supplied staging evidence from project `zghsgzrdwbqdrpuxanac`, not a new hosted test performed by this remediation. They establish the defect: a password update completed, database/Auth credential version reached `1`, session count later reached zero, but the only designated Super Admin remained `session_revocation_review_required` and ordinary reconciliation could not pass the credential-active Super Admin guard.

## Migrations 176–177 recovery and finalizer design

Migration 176 preserves ordinary `patch83u_require_super_admin` behavior. Its dedicated `patch83u_reconcile_last_super_admin_recovery` implementation is an owner-only `SECURITY DEFINER` routine with an explicit safe `search_path`; execution is revoked even from `service_role`. The service-role-only `patch83u_reconcile_credential_state` wrapper is its sole entry point during emergency suspension. `PUBLIC`, `anon`, and `authenticated` execution are revoked from the wrapper and the atomic required-password finalizer. No service-role secret is exposed to the client.

Migration 176 declared the atomic finalizer with a 67-byte unquoted identifier. PostgreSQL's 63-byte identifier ceiling stored it on staging as `patch83u_finalize_required_password_change_after_session_revoca`, so an RPC request using the intended full name cannot resolve that exact hosted catalog object. Migration 177 renames that exact object in place to the explicit 50-byte stable RPC name `patch83u_finalize_password_change_after_revocation`; it preserves the migration-176 body, reasserts `SECURITY DEFINER` and the safe `search_path`, and verifies unique service-role-only execution with no old source name remaining. Its preflight/postcondition blocks fail closed on a missing or structurally different source or a destination conflict.

The exception authorizes only designated-Super-Admin self-recovery and only while runtime is exactly `emergency_suspended`. It is deliberately not a browser or authenticated-user-session action: the required zero-session predicate would conflict with such a caller session. An authorized operator invokes the wrapper using a protected service-role context after independently confirming zero sessions. The helper fails closed unless all of the following are true in one protected database decision:

- actor, target, and `patch83u_runtime_control.designated_super_admin_id` are the same UUID;
- the target profile exists, is active, has active lifecycle, and is organization-consistent;
- exactly one target active `super_admin` assignment exists, it is valid global scope with null division/department/unit references, and it is also the organization's only valid active global Super Admin assignment;
- the Auth user exists, is confirmed, not deleted, not banned, and has an exact normalized email match to the protected credential;
- Auth and database credential versions are equal;
- identity mode is exactly `legacy_verified`;
- current credential state is exactly one of `recovery_required`, `reconciliation_required`, or `session_revocation_review_required`;
- no target row exists in `auth.sessions`;
- Employee ID confirmation is null-safe and exact;
- request ID, same-request idempotency, operation source, and previous-state proof are valid; and
- an append-only, password-free credential audit record can be written.

Any mismatch, missing row, duplicate/ambiguous role, remaining session, unexpected operation source, incompatible previous state, or replay conflict rejects without activating the credential. The exception cannot provision, reset another account, perform a normal administrative credential change, alter role/profile lifecycle, change the designated administrator, or transition runtime state.

The operation proof is also exact: `operation_source = 'password_change'`, `reconciliation_auth_changed = true`, previous lifecycle is `active`, the previous session cutoff is present, and previous credential state is one of `existing_password_change_required`, `initial_change_required`, `admin_reset_change_required`, or `reactivation_change_required`. Exactly one matching password-change operation must prove the current version/result state before the credential and operation ledger can move to `active`.

Emergency suspension remains a containment posture, not relaxed administration: a structurally valid `legacy_verified` user may authenticate under the documented emergency access rule, but provisioning, administrative reset/change, and ordinary protected mutations remain unavailable. Runtime does not automatically return to `prepared` or `enforced`; the only added mutation is the exact recovery path above.

## Hosted session defect and corrected flow

The prior flow treated a supported sign-out response too close to revocation proof. Hosted evidence showed why that is insufficient: the password update invalidated a temporary session, cleanup returned `session_not_found`, and a later frontend password grant created another Auth session. The database correctly refused active finalization while that session remained.

The correction keeps current-password verification before the protected Auth mutation, begins the idempotent operation, explicitly requests supported global revocation while the disposable verification session is still valid, then performs the password update through the Auth Admin API and calls `patch83u_finalize_password_change_after_revocation`. That service-only RPC stabilizes session creation with a short `SHARE` lock on `auth.sessions`, takes fail-closed `auth.identities` and target-`auth.users` locks, proves zero rows, and invokes the existing finalizer in the same transaction. It performs no post-revocation `signInWithPassword` and creates no replacement browser session before database finalization. A `session_not_found` response cannot enter the atomic finalizer; it follows the existing false-proof path to session review. Any nonzero or ambiguous combined proof remains `session_revocation_review_required`. `active` is possible only after exact sign-out success and atomic zero-session finalization, and the browser always ends signed out before a fresh login.

## Authentication and authorization order

- The browser normalizes Employee ID/full email and calls normal `supabase.auth.signInWithPassword` before any Patch 83U action.
- A successful Auth result must contain a matching user and session. Only that authenticated session may call `patch83u_get_capabilities`, followed by `patch83u_get_credential_state`.
- Profile, roles, application routes, dashboard, global search, and operational data remain unloaded until the credential decision permits normal access.
- Invalid credentials, CAPTCHA failure, deployment mismatch, unavailable state, and reconciliation are separate outcomes. A governance failure after successful Auth never becomes an invalid-password response.
- The capability action validates JWT/getUser/getClaims before reading runtime or credential/application data and returns only non-sensitive contract/runtime fields.

## Deployment and runtime lockout protection

Migration 174 creates `patch83u_runtime_control` with default `disabled`; it does not activate enforcement as part of installation. Allowed states are `disabled`, `prepared`, `enforced`, and `emergency_suspended`.

- Disabled/prepared preserve stable existing access and do not force rotation or allow new managed provisioning, reset, or password transitions.
- Enforced enables the credential-aware RLS/data boundary and protected mutations.
- Emergency suspension disables protected mutations and can restore documented legacy access without deleting credential/audit evidence.

Transitions are service-role-only, exact-confirmation, idempotency-keyed, and audited. Preparation/enforcement require matching Edge/frontend contracts, deterministic preflight hash, zero blockers, and a designated eligible existing global Super Admin. Enforcement additionally requires prepared-state compatibility attestation by that administrator. Normal browser roles cannot activate or suspend enforcement.

Current contracts are Edge `patch83u-edge-auth-first-v1`, frontend `patch83u-frontend-auth-first-v1`, and installed schema `174`. The frontend deployment flag is exact-true only and is not an authorization bypass.

## Cached-client and data-boundary behavior

Authenticated Edge calls and the REST/storage boundary carry the frontend contract marker. Global search forwards that same pinned marker together with the caller JWT on its PostgREST/RLS second hop. Under enforcement, an old or incompatible client fails closed before application data. The authenticated deployment screen renders no profile/roles/navigation, uses a bounded retry with cooldown, and provides manual hard refresh and sign out without an automatic reload loop.

Production release still must prove Vercel environment selection, current deployment alias, HTML revalidation/no long immutable entry-point caching, reviewed immutable caching for content-hashed assets, and absence of stale CDN/service-worker responses.

## Existing-user and role preservation

- Migration 174 does not read, replace, reset, or invalidate an existing password.
- It preserves Auth user ID/email, profile identity/lifecycle, and canonical `user_roles` rows.
- A safe active identity is backfilled as `existing_password_rotation_pending`; ambiguous or unusable identity evidence becomes `reconciliation_required`.
- Disabled/prepared runtime remains operational. Under enforcement, the first authenticated credential lookup lazily changes a pending user to `existing_password_change_required`.
- Credential state makes a preserved role ineffective while access is locked. Rotation and reset do not delete, duplicate, or physically deactivate a role assignment and do not change the profile lifecycle merely to enforce credential change.

Last-Super-Admin protection remains active for role removal and lifecycle/reset operations. Password-change actions do not require normal application access or approval by another administrator. Ordinary successful completion therefore lets the designated administrator sign in fresh and regain the effect of the same preserved role. If a partial session outcome instead leaves that sole administrator non-active, ordinary Super Admin authority remains unavailable and migration 176's exact emergency self-recovery proof is the only exception.

## Strict actor and scope validation

- Provisioning, reconciliation, and administrative reset require an active, credential-valid canonical global Super Admin. Governance Admin receives no such authority.
- Actor and target profiles, exact organization, verified identity mode, trusted canonical Auth email, active lifecycle, global scope, and null division/department/unit references are independently rechecked server-side.
- Reset is same-organization, non-self, exact-target, and last-eligible-Super-Admin protected.
- Generic role writes are constrained by one canonical role/scope matrix at Edge validation, service-only assignment, active-row triggers, and restrictive RLS. Existing invalid active pairs fail closed in the Auth provider and are reported by the read-only preflight. The generic matrix includes `division_head`/`division`; Patch 83T remains intentionally narrower and rejects division roles because its workbook has no division reference.
- Invalid or unknown role/scope/lifecycle shapes fail closed; browser-supplied role, organization, Employee ID, or Auth email is not accepted as canonical proof.
- Central runtime, capability, credential-state, role/scope, and lifecycle validators return total booleans or explicitly reject null input. PostgreSQL three-valued logic cannot turn a missing contract, state, action, role, or scope into an allowed branch.
- Service-role credentials and Auth Admin operations remain server-only.

## Canonical lifecycle and provisioning boundary

The four User Management lifecycle actions bypass the historical Patch 19 claim-rewriting bridge and enter the service-only `patch83u_apply_user_lifecycle` RPC. It rechecks the actor, organization, canonical global role, target lifecycle metadata, protected credential row, privileged-target authority, self action, and last-Super-Admin invariant. Any non-terminal provisioning row for the target rejects the request; the lifecycle RPC never mutates protected provisioning evidence.

Deactivate/archive atomically writes profile deactivation metadata, disables credentials with a fresh cutoff, deactivates active roles, and writes exact role/lifecycle audits. Reactivate/unarchive never restore roles: they require a later credential change or reconciliation and explicit role administration. If a blocked profile already has an active role, the database treats it as drift and rejects activation before mutation. Edge requires zero remaining active roles for activation as part of exact profile, credential, role, event, and audit proof. First managed password finalization uses a narrowly scoped service-only marker that preserves the already-proven active credential state while aligning only `requested_lifecycle`; the generic reactivation rewrite cannot create a second forced-change loop.

## Provisioning restriction and identity risk

Provisioning is available only in `enforced` state with compatible capability proof. Patch 83T upload, parsing, validation, preview, queue reads, and refresh do not create an account.

The server derives `lower(employee_id) + '@almodawat.sa'` and submits exact Employee ID as the initial password. No password is stored, returned, logged, audited, exported, or placed in the workbook. No local fallback or unrelated minimum is generated; hosted Auth policy remains authoritative. Ambiguous Auth/finalization results enter reconciliation instead of blind creation/deletion.

Employee ID is often discoverable and may be short. Forced change limits application access after Auth but does not eliminate the first-login takeover window. Production therefore requires CAPTCHA, hosted rate limits/policy review, just-in-time provisioning, independent employee verification, unclaimed-account monitoring, and rapid incident handling.

## CAPTCHA boundary

- Initial Employee-ID and legacy-email login use the same exact-true CAPTCHA configuration.
- Forced current-password reauthentication also forwards the fresh CAPTCHA token when required.
- Missing site key, unavailable provider, missing/expired token, and invalid configuration fail closed. Tokens reset after every Auth attempt, failure, expiry, or completion.
- Only the public site key is browser-visible. Provider/Supabase secret material remains outside frontend code.
- A separate anon client uses `persistSession = false` for current-password verification; its session/tokens are disposed and never returned/logged.

Local CAPTCHA tests prove frontend/Edge control flow, not target Supabase/Turnstile acceptance or hosted configuration.

## Password-change state machine

The protected action requires current password, new password, confirmation, trusted Auth identity/Employee ID, required credential state/version, exact request ID, and no surrounding-whitespace ambiguity. It rejects a new password equal to the submitted current password, trusted Employee ID when present, or trusted Auth-email local part.

A read-only preparation precedes current-password reauthentication. Wrong current password therefore causes no database mutation. Only after verification does the idempotent ledger begin. Supported global revocation is requested with the still-valid disposable token, Auth Admin then updates password/metadata, and the service-only atomic database finalizer verifies zero target Auth sessions in the same transaction that advances credential version exactly once and may return `active`.

- Input, current-password, CAPTCHA, or protected-lookup failure before global revocation causes no mutation and preserves the authenticated retry surface. After revocation begins, no result assumes that browser session remains usable.
- A definitive new-password policy rejection after global revocation leaves the credential in required-change state but compare-clears the matching browser session; the user must authenticate fresh with the unchanged current password and select a different new password.
- Auth success plus database-finalization failure yields `recovery_required`; access remains closed and the password is not rolled back automatically.
- A nonzero/ambiguous zero-session outcome, including cleanup `session_not_found`, yields `session_revocation_review_required`; cutoff/version gates deny the old session.
- The protected ledger remains same-request idempotent, but an ambiguous browser response closes the browser session and is not retried from the forced-change UI. Controlled reconciliation inspects the terminal non-secret operation evidence without a replacement password sign-in or second version increment.

Success always clears the browser session, broadcasts invalidation, and requires a fresh login. No pre-change session receives ordinary application access.

## Administrator reset

Reset requires exact target user/Employee ID, matching manually entered temporary password and confirmation, mandatory reason that cannot contain the exact temporary password, UI phrase `RESET USER PASSWORD`, backend confirmation `PATCH83U_RESET_USER_PASSWORD`, and idempotency ID. Temporary password may equal Employee ID if hosted policy permits it.

The database first changes credential state to make access ineffective while preserving profile lifecycle and role rows. The Edge action requires an exact successful Auth Admin update response and a follow-up Auth read proving target ID, canonical email, and the next credential version. It does not sign the target in with the temporary password, which avoids a CAPTCHA-required proof dead end. A service-only read-only RPC then reports whether zero target `auth.sessions` rows remain, and finalization independently rechecks that absence. Only proven absence produces `admin_reset_change_required`; remaining sessions or ambiguous Auth/database proof produce session review/recovery. No password is returned, persisted, logged, or audited.

## Session enforcement and hosted limitation

Patch 83U uses supported Supabase Admin sign-out where a verified user JWT is available and never directly manipulates `auth.sessions`. Required password change revokes before its disposable token can be invalidated by the Auth password update, then atomically proves session absence and finalizes under one database lock; administrator reset retains its Auth Admin update/read-back plus session proof. No post-revocation password sign-in is used as proof. Because an issued JWT can remain cryptographically valid, state/version, session cutoff, session ownership/existence where required, profile lifecycle, exact role/scope, organization RLS, privileged-action, and storage/data-boundary checks are independent security controls.

Hosted global sign-out, single-session behavior, session-row timing, stale-token denial, password policy, CAPTCHA, and Auth Admin results remain unproven until an explicitly authorized disposable/release environment test records them. Uncertainty is a recovery/review result, not success.

## Race and stale-response controls

The Auth provider uses monotonic operation generations and Auth-event epochs, AbortController cancellation, serialized password sign-in, per-session capability/credential/pipeline single-flight, stale user/session response rejection, immediate profile/role clearing, bounded retry, focus/visibility revalidation, and BroadcastChannel invalidation. `SIGNED_OUT` is processed immediately; other Auth callbacks raised during `signInWithPassword` are deferred, and their session snapshot is used only if its event epoch and generation remain current. Provider unmount advances both counters, aborts and clears all flights, and invalidates deferred snapshots. A late completion synchronously removes only its exact still-persisted token and cannot start the capability/data pipeline, set authorization state, sign out, or erase a newer session. Previous-user authorization is never rendered while a newer pipeline is unresolved.

## Browser RPC, view, and secret boundary

- `search_grc_global` is behind the authenticated Edge bridge and caller-token RLS path.
- Migration 174 retains credential-aware restrictive RLS, security-invoker view hardening, explicit grants/revokes, safe `search_path`, service-only mutations, and protected evidence tables.
- No current/new/confirmation/temporary/initial password, password hash/digest, access/refresh token, session secret, service-role key, or raw Auth response belongs in SQL state, event JSON, audit, export, response, or logs.
- Existing RLS, JWT validation, actor verification, organization scoping, role checks, last-admin controls, audit controls, and service-role isolation are not weakened.

## Required deployment order

Fresh release must follow: current frontend; migration 173; migration 174 disabled; migrations 175, 176, and 177 where required by the reviewed chain; stable-login proof; compatible Edge; authenticated capability proof; new exact-true frontend; disabled-runtime frontend proof; prepared transition; repeated designated-Super-Admin compatibility/attestation; controlled enforcement; then existing-password login followed by rotation. Activating enforcement before both contracts are live and attested is prohibited.

The existing staging incident has a narrower forward-only remediation order: keep runtime `emergency_suspended`; confirm migration 176 is already applied and its repository hash remains unchanged; verify migration 177 is the sole intended pending staging database change; apply only migration 177; confirm the exact stable finalizer catalog name; re-prove zero sessions; invoke the exact designated self-recovery through the protected service-role RPC outside browser/Edge; deploy only the corrected future-flow Edge call to the same staging environment; verify every browser/Edge mutation remains blocked and complete nonmutating recovery checks; and only then consider a separately authorized audited return through `prepared`. The corrected password-change session flow cannot execute while emergency suspension remains active, so hosted proof of that future path requires a later separately authorized enforced-runtime test. This local remediation did not apply migration 177, invoke recovery, deploy the Edge correction, or change runtime state; migration-176 application is a supplied staging fact.
