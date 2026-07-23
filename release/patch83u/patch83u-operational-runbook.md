# Patch 83U Operational Runbook

## Scope and operating principles

This runbook governs release and operation of Employee-ID login, post-authentication credential rotation, protected provisioning, Super Admin reset, session invalidation, and reconciliation. Never place a password, access/refresh token, service-role key, CAPTCHA secret, Auth response, or session identifier in tickets, source control, exports, telemetry, or audit JSON.

Use the authenticated privileged Edge bridge and protected database state machine. Do not work around a credential lock with direct profile, role, provisioning, Auth, or `auth.sessions` edits. Credential state controls whether a preserved role is effective; Patch 83U rotation/reset does not delete, duplicate, or deactivate the canonical role row and does not silently change profile lifecycle.

Migration 176 is already applied to staging and provides the forward correction for the hosted last-Super-Admin deadlock. Its repository SHA-256 must remain `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`; do not edit or replay it. Migration 177 is the sole pending forward correction for the truncated atomic-finalizer RPC identifier. Do not edit or replay migrations 173, 174, or 175, and do not use migration repair or database reset. Production is outside this remediation. Staging project `zghsgzrdwbqdrpuxanac` must remain `emergency_suspended` until migration 177, the matching Edge correction, exact recovery proof, and negative regression evidence are separately authorized and completed.

## Runtime states

- `disabled`: migration 174 is installed but dormant; stable existing access continues and new provisioning/reset/password transitions are unavailable.
- `prepared`: compatible Edge/frontend behavior can be tested; existing users are not yet forced to rotate and new provisioning remains unavailable.
- `enforced`: post-authentication rotation, credential-aware data boundaries, password transitions, reset, and managed provisioning are active.
- `emergency_suspended`: structurally valid `legacy_verified` users may authenticate under the documented emergency rule, while provisioning, reset, password-change administration, and ordinary protected mutations remain unavailable. Migration 176 permits only the exact designated-Super-Admin self-recovery proof; it does not reactivate the runtime or widen ordinary administration.

Every transition is service-role-only, request-idempotent, audited, and requires its exact phrase. A normal browser administrator cannot change runtime state.

## Login instructions

For an existing, new managed, or administratively reset user:

1. The user enters Employee ID or a legacy full email and their current/temporary password.
2. The application normalizes only the identifier and calls normal Supabase `signInWithPassword`, including a fresh CAPTCHA token when required.
3. Supabase Auth must return a real authenticated session.
4. Only then does the application request authenticated Patch 83U capabilities and credential state.
5. No profile, roles, navigation, dashboard, global search, or operational data is loaded before the credential decision.
6. The user is routed to active access, Forced Password Change, reconciliation, access denied, or authenticated deployment incompatibility.

If Auth fails, use the generic login error. If Auth succeeds but capability/state resolution fails, do not tell the user that the password is invalid and do not return to a normal sign-in form. The deployment screen must keep application data closed and offer bounded retry, hard refresh, and sign out.

## Existing users and first enforced login

Migration 174 does not reset, inspect, or invalidate an existing password. Safe active identities enter `existing_password_rotation_pending`; ambiguous identities enter `reconciliation_required`. Disabled/prepared runtime keeps stable access.

After enforcement, a user's first successful Auth login with the existing password precedes an atomic credential lookup transition to `existing_password_change_required`. The user then sees only the forced-change surface and sign out. The same flow permits the designated/last existing global Super Admin to change their own required password without approval from another administrator; their existing global role row remains preserved.

## First password change

1. Require the user to re-enter the current/temporary password plus new and confirmation values. Never carry the login password into this form or browser storage.
2. Require a fresh CAPTCHA token when hosted CAPTCHA is enabled. A missing site key, unavailable provider, or missing/expired token remains fail closed, and the widget resets after every attempt, error, expiry, or completion.
3. The server validates JWT, trusted Auth email/Employee ID, required credential state/version, confirmation equality, and surrounding whitespace.
4. The server rejects a new password equal to the current password, trusted Employee ID when present, or trusted Auth-email local part.
5. Before any password mutation, a separate non-persistent anon Auth client verifies the current password with the CAPTCHA token. Its disposable session/tokens are not retained, returned, logged, or audited.
6. Only after verification does the server begin the idempotent database mutation.
7. While the disposable verification token is still valid, explicitly request supported global session revocation. Updating the password first can invalidate that token and make a later sign-out return `session_not_found`. Do not call `signInWithPassword` again after revocation and do not create a replacement browser session.
8. Update the password and credential-version metadata through the Auth Admin API, then call the service-only `patch83u_finalize_password_change_after_revocation` routine.
9. That routine holds `auth.sessions` under a short `SHARE` lock, proves zero target rows, and calls the existing protected finalizer in the same transaction. Finalization may return `active` only when the supported global sign-out returned exact success and this atomic proof succeeds. A `session_not_found`, other sign-out ambiguity, nonzero count, or malformed proof remains review even if another signal looks safe.
10. The browser closes the old local session in all outcomes, broadcasts invalidation, and requires a fresh login. Ordinary success displays `Password changed. Sign in again using your new password.`

Failure handling:

- Wrong current password: no database mutation and no Auth password update.
- Input/current-password/CAPTCHA failure before begin: retain the authenticated retry surface because no revocation or mutation occurred.
- Hosted password policy definitively rejects the new password after global revocation: retain required-change credential state, compare-clear the matching browser session, and instruct a fresh login with the unchanged current password and a different proposed new password. Do not create a replacement session automatically.
- Other Auth update failure: do not activate access or increment the authoritative version; close or recover according to whether the post-revocation result is definitive.
- Auth update succeeds but database finalization fails: keep `recovery_required`, revoke sessions, and require protected reconciliation; do not roll back the password automatically.
- Revocation or zero-session proof is nonzero/ambiguous: keep `session_revocation_review_required`; the cutoff/version gates continue to deny the old session.
- Response is lost/ambiguous after the operation may have begun: the browser clears the form and session, does not retry or sign in, and directs the user to protected administrator reconciliation. Preserve the operation evidence for controlled same-request idempotency inspection; do not submit a new browser password grant.

## Provisioning

Provisioning is permitted only when runtime is exactly `enforced`, authenticated capabilities advertise provisioning, and the actor is an active credential-valid canonical global Super Admin in the organization.

1. Require the approved Patch 83T workbook, fully valid preview, exact final import confirmation, and authorized actor.
2. Upload, parsing, validation, preview, queue read, and refresh must remain non-provisioning.
3. Confirm Employee ID and synthetic alias uniqueness case-insensitively.
4. The trusted server creates Auth email `<lowercase-employee-id>@almodawat.sa` with initial password exactly equal to the case-preserved Employee ID.
5. Never generate a fallback, store/return/log/audit the initial password, or create an account while runtime is disabled/prepared.
6. Treat hosted policy rejection as `policy_blocked`. Treat ambiguous Auth or incomplete database proof as reconciliation; do not create a duplicate or delete a possibly finalized Auth user.
7. Deliver claim instructions through an independently verified channel and monitor the unclaimed interval.

## User lifecycle actions

Use only the authenticated User Management actions backed by `patch83u_apply_user_lifecycle`. Each request requires the exact target, a non-empty reviewed reason of at most 500 characters, and one exact action: deactivate, reactivate, archive, or unarchive. The database requires a canonical same-organization global Super Admin or Governance Admin; only Super Admin may act on an active privileged target. Never use direct profile/role edits or the historical Patch 19 lifecycle bridge.

- Deactivate/archive records canonical profile metadata, disables credential access with a new cutoff, deactivates every active role, and writes exact credential, role, and lifecycle audits.
- Reactivate is only for inactive/locked profiles; unarchive is only for archived profiles. Both require password change or reconciliation and restore zero roles automatically. If the blocked profile still has any active role row, the request fails before mutation; reconcile and deactivate that drift through an approved path before retrying.
- An open provisioning record blocks every lifecycle action. Complete, cancel, or reconcile that protected workflow through its own approved path; never mutate the queue implicitly.
- After reactivation/unarchive, complete required credential recovery first, then assign only the reviewed canonical role/scope through the protected role action.
- A first managed password finalization may activate an invited profile through the internal controlled marker. Operators cannot invoke that marker, and successful finalization must not prompt for a second immediate password change.

## Super Admin reset

1. Require a different active, credential-valid, canonical global Super Admin in the same organization. Governance Admin, self-reset, malformed scope, cross-organization reset, and last-eligible-Super-Admin reset remain denied.
2. Independently verify the target. Require exact target user and Employee ID, a mandatory reason that contains no exact temporary-password value, temporary password plus confirmation, UI phrase `RESET USER PASSWORD`, backend confirmation `PATCH83U_RESET_USER_PASSWORD`, and a new idempotency request ID unless safely retrying an ambiguous result.
3. The temporary password may equal Employee ID if hosted Auth policy accepts it; no hidden fallback or unrelated local length rule is allowed.
4. Reset-begin changes credential state to make target access ineffective. It preserves the target profile lifecycle and all role rows.
5. Auth Admin changes the password. Require its exact successful response plus a follow-up Auth read proving target ID, canonical email, and new credential version. Do not sign the target in as proof: hosted CAPTCHA may reject such a server-side password login.
6. Call the service-only read-only reset session-proof RPC. Database finalization advances credential version once and sets `admin_reset_change_required` only when both that RPC and the finalizer see zero target `auth.sessions` rows. Existing rows produce `session_revocation_review_required`.
7. Do not report ordinary success when Auth/database/session proof is ambiguous. Preserve the request ID and follow its terminal recovery or session-review result.
8. Deliver the manually selected temporary password only through the approved secure channel. The target signs in normally with it, passes CAPTCHA when configured, passes the authenticated capability/state checks, and completes Forced Password Change.

## Session revocation

Use supported Supabase Admin global sign-out only where a verified user JWT is available; do not directly manipulate `auth.sessions`. For required password change, request global sign-out before the password update invalidates the disposable verification token, then require Auth read-back and the atomic zero-session finalizer. Administrator reset retains its update/read-back plus zero-session proof. A UI response, `session_not_found`, local-storage removal, or JWT expiry is not proof of global revocation. Require exact supported sign-out success where applicable and a locked zero-session/finalization transaction before treating revocation as fully proved. Require hosted evidence that no target `auth.sessions` rows remain before treating revocation as fully proved. Credential state/version, password/reset cutoff, session existence/ownership where required, profile lifecycle, exact role/scope, organization RLS, privileged actions, and storage/data-boundary gates must independently reject stale access.

If hosted revocation cannot be proved, leave the account in `session_revocation_review_required` or recovery. Do not restore ordinary access merely because the browser signed out.

## Reconciliation

1. Use reconciliation for ambiguous Auth creation/update, failed finalization, unresolved session proof, identity collision/mismatch, stale operation, or credential-version divergence.
2. Identify the exact profile, organization, preserved role rows, Employee ID when trusted, canonical Auth email, Auth user ID, provisioning record, request ID, and non-secret operation state.
3. Normally require the protected credential-active canonical-global-Super-Admin action, exact Employee ID confirmation where applicable, strict same-organization scope, and idempotency. The only exception is migration 176's service-role-only recovery authorization while runtime is `emergency_suspended`, and only when actor, target, and designated Super Admin are identical and every documented identity/role/Auth/version/session/operation predicate passes.
4. Resolve zero or one canonical Auth identity. Never guess, accept browser-supplied canonical identity, or recreate solely because a response was lost.
5. Complete only the missing non-secret state step. Access remains ineffective until exact credential/session proof permits it; role/profile lifecycle rows remain preserved.

## Unclaimed accounts

1. Monitor managed users that remain in `initial_change_required`, incomplete provisioning, recovery, or overdue claim state.
2. Contact the employee and manager only through independently verified channels. Do not confirm a valid Employee ID to an unverified caller.
3. At the approved deadline, disable access and revoke sessions through protected lifecycle/credential actions; retain provisioning, credential, operation, and audit evidence.
4. Re-enable only after identity verification and, where needed, a protected Super Admin reset followed by normal authenticate-first forced change.

## Last designated Super Admin recovery

Use this procedure only for the exact migration 176 deadlock; it is not a general break-glass administrator bypass.

1. Confirm runtime is still `emergency_suspended` and record its current state version. Do not transition runtime as part of recovery.
2. Confirm actor and target are the same UUID and exactly equal the runtime-designated Super Admin.
3. Prove the target profile is active with active lifecycle; the target has exactly one active `super_admin` role; that role is valid global scope with matching organization and null division/department/unit references; and it is the organization's only valid active global Super Admin assignment.
4. Prove the Auth user exists, is confirmed, not deleted or banned, and its exact normalized email and credential version match the protected credential row.
5. Require identity mode `legacy_verified`, an explicitly permitted recovery/reconciliation state, the expected operation source and previous-state evidence, and zero target `auth.sessions` rows.
6. Require the exact null-safe Employee ID confirmation and a safe request ID. Replay only the same request ID after an ambiguous response; a conflicting duplicate remains rejected.
7. From an approved protected operator environment, invoke only the service-role RPC wrapper `patch83u_reconcile_credential_state`. It delegates to the owner-only `patch83u_reconcile_last_super_admin_recovery` implementation. Do not use the browser, an authenticated user session, or the Edge reconciliation action: zero target sessions is a required predicate, and emergency Edge mutations remain blocked. Never expose or paste the service credential.
8. Accept success only when the response, credential row, idempotency ledger, and append-only audit prove the same target, request, previous state, new active state, and credential version. The browser must still be signed out.
9. Perform a fresh normal login. Provisioning and other protected administration remain unavailable while emergency suspension continues.

If any predicate is missing or ambiguous, stop. Do not alter the role, profile, credential, Auth user, sessions, runtime designation, or operation evidence manually.

## Suspected takeover

1. Open an incident and record non-secret user/organization/timestamps/detection evidence.
2. Make access ineffective through the controlled lifecycle/credential path and request supported global session revocation.
3. Preserve Auth, credential, runtime, role/lifecycle, provisioning, CAPTCHA/rate-limit, and application audit evidence. Do not edit protected evidence or role rows ad hoc.
4. Verify the employee out of band. If reset is approved, use a different eligible Super Admin and the exact protected reset contract.
5. Return access only after credential/session proof and fresh login; ambiguous state goes to reconciliation/session review.

## Failed login

1. Do not reveal whether an Employee ID exists. Distinguish generic Auth failure from an already-authenticated deployment/credential outcome in authorized diagnostics only.
2. Check service health, CAPTCHA provider/key/token state, rate limits, Auth logs, runtime capability/version, credential state, and profile lifecycle without asking for the user's password.
3. A required CAPTCHA failure needs a fresh challenge; do not bypass it or reuse a token.
4. If the password is forgotten, use the protected Super Admin reset path. Do not weaken hosted policy, runtime gates, or organization/role controls as support workarounds.

## Race and multi-tab operations

- On sign-out, user switch, reset, password completion, or reconciliation, invalidate the current operation generation immediately and clear profile/role state before asynchronous cleanup.
- Ignore every response that no longer matches current generation, user, and session token.
- Serialize password sign-in attempts. Process `SIGNED_OUT` immediately; defer other Auth callbacks emitted during `signInWithPassword`, then accept a deferred session snapshot only if both the Auth-event epoch and operation generation are still unchanged.
- Do not start concurrent compatibility retries or duplicate capability/credential requests for one session.
- On focus/visibility return, recheck credential state before continuing access.
- Use cross-tab invalidation to close another tab after credential change/sign-out. A tab that cannot prove freshness must return to the closed/authentication state.
- If the provider unmounts, all pending/deferred flights are invalid. A late successful Auth response may remove only its exact still-persisted token and must never open capability, profile, role, or application data.
- Never render the prior user's profile or roles during transition.

## Monitoring

Alert on authentication and CAPTCHA failures, enumeration patterns, rate-limit events, overdue unclaimed/change-required accounts, runtime transitions, capability mismatches, cached-client errors, `policy_blocked`, recovery/reconciliation/session-review states, repeated idempotency conflicts, last-admin guard denials, cross-organization attempts, and discrepancies among provisioning/profile/Auth/credential/role evidence. Telemetry must contain no password, token, session secret, or raw Auth response.

## Coordinated migration, Edge, and frontend deployment order

1. Keep the current frontend live.
2. Apply migration 173.
3. Apply migration 174 with enforcement `disabled`.
4. Apply migration 175 if it is part of the reviewed pending chain.
5. Apply migration 176 before enabling the corrected recovery/session flow.
6. Apply migration 177 so the Edge and catalog use the exact stable finalizer RPC name.
7. Verify existing frontend login still works.
8. Deploy the compatible privileged-action Edge Function.
9. Verify authenticated `patch83u_get_capabilities` using the designated existing Super Admin.
10. Deploy the new frontend with `VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED=true` exactly.
11. Verify authentication and capability read while enforcement remains `disabled`/`prepared`.
12. Transition to `prepared` with the reviewed preflight hash and exact phrase `PATCH83U_PREPARE_CREDENTIAL_GOVERNANCE`.
13. Repeat checks as the designated Super Admin and verify compatibility attestation.
14. In the controlled maintenance window, transition to `enforced` with `PATCH83U_ENFORCE_CREDENTIAL_GOVERNANCE`.
15. Existing users authenticate with existing passwords and are then required to change them.

Before steps 7–11, verify Vercel uses the intended production environment, deploy alias, and build. HTML must revalidate rather than carry a long immutable cache; content-hashed assets may use immutable caching. Confirm cache headers and stale CDN/service-worker behavior. Do not rely on an automatic reload loop; the authenticated compatibility screen provides manual hard refresh and sign out.

## Emergency disablement

If enforcement causes a lockout or integrity incident, stop provisioning/reset/password-transition traffic and use the service-only audited transition to `emergency_suspended` with exact phrase `PATCH83U_EMERGENCY_SUSPEND_CREDENTIAL_GOVERNANCE`, approved reason, designated Super Admin evidence, matching contracts, and idempotency request ID. Do not delete credential/audit state or weaken RLS, JWT validation, organization scope, role checks, or service-role isolation. Recheck preflight and contracts before returning through `prepared` to `enforced`.

For the current staging incident, remain emergency-suspended. Apply/deploy nothing until review authorizes the exact project, checksum, and command set. Before database push, confirm `176_patch83u_last_super_admin_recovery.sql` is already applied and still matches SHA-256 `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`; run migration-list and dry-run checks and abort unless `177_patch83u_explicit_password_finalizer_rpc_name.sql` is the only intended unapplied migration. Do not replay migration 176. After authorized migration-177 application, confirm the catalog exposes exactly `patch83u_finalize_password_change_after_revocation`, obtain a fresh zero-session check, and perform the one controlled service-role recovery RPC outside the browser/Edge path. Deploy only the matching future-flow Edge correction to staging, then prove every emergency browser/Edge mutation remains blocked. Exercise the corrected forced-change flow only in local/disposable tests or a later separately authorized enforced runtime. Do not provision Employee ID `11111` or mutate provisioning record `46205a79-d012-4965-b246-0683dcace70c`.

This runbook authorizes no deployment, migration, Vercel/Supabase configuration, direct protected-table change, migration repair, or database reset by itself.
