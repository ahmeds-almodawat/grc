# Patch 83U — Remaining Limitations and Operational Risks

## Unproven hosted behavior

- Migration 176 is already applied to staging and its repository SHA-256 remains `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`. Migration 177 remains unapplied and the matching corrected Edge code remains undeployed. No production Supabase, production Auth, production profile/role/credential/session, Vercel environment, import, or production configuration was accessed or changed by this remediation.
- Supplied staging evidence from project `zghsgzrdwbqdrpuxanac` proves the previously deployed flow reached `session_revocation_review_required` for the only designated Super Admin and that migration 176 is applied. It does not prove migration 177 or the corrected Edge call.
- The read-only database preflight is locally reviewed but was not run against the target database. Identity collisions, reconciliation population, active sessions, role/scope defects, eligible bootstrap administrators, runtime blockers, and the deterministic target preflight hash remain unknown.
- PostgreSQL 16 raw parsing and local PL/pgSQL parsing cover the migration/test grammar, and rollback-only SQL fixtures describe the lifecycle/credential proof, but no authorized database executed `CREATE FUNCTION` or those fixtures. Catalog-dependent function-body semantics remain a hosted/disposable-database gate.
- The GET-only Auth-settings preflight was not run. Hosted CAPTCHA, rate limits, password policy, leaked-password protection, JWT expiry, session lifetime/inactivity, and single-session settings remain unverified.
- Local inventory/contract tests do not prove live post-migration RLS, grants/default grants, security-invoker view options, storage policies, REST contract-header propagation, or stale-client data denial.
- Real Auth Admin password changes, app-metadata updates, global sign-out, session-row timing, single-session interaction, credential cutoff, stale-JWT denial, recovery, and idempotent retry require an explicitly authorized disposable/release environment.
- Hosted acceptance of short Employee IDs such as `11111` as initial/reset passwords is unknown. Code must preserve safe `policy_blocked` behavior, no generated fallback, and no partial activation.
- Vercel production environment selection, deploy alias, HTML/cache headers, CDN invalidation, and stale service-worker behavior were not inspected or changed. These are release gates, not local-test claims.

## Known hosted defect and pending correction

The hosted staging sequence established that password update success and a `session_not_found` cleanup response are not sufficient global-session proof. A later frontend password grant created another Auth session, and the database correctly refused active finalization while that session remained. After an external global sign-out reduced the session count to zero, ordinary reconciliation still failed because `patch83u_reconcile_credential_state` required a credential-active Super Admin and the only designated Super Admin was the locked target.

Migration 176 corrected the recovery/body logic but declared a 67-byte finalizer identifier. PostgreSQL stored the 63-byte truncated catalog name `patch83u_finalize_required_password_change_after_session_revoca`, so the intended full RPC string cannot resolve by exact hosted API name. Pending migration 177 renames that object in place to the explicit 50-byte stable name `patch83u_finalize_password_change_after_revocation` without replacing its protected body and reasserts service-role-only execution. Until migration 177 and the matching Edge correction are reviewed, applied/deployed, and exercised in staging:

- the staging credential remains `session_revocation_review_required`;
- runtime must remain `emergency_suspended`;
- no one may represent the designated administrator as recovered;
- no provisioning, reset, or ordinary administrative credential mutation may resume;
- Employee ID `11111` and provisioning record `46205a79-d012-4965-b246-0683dcace70c` must remain untouched; and
- production remains completely outside scope.

## Authentication and deployment risks

Authentication must succeed before Patch 83U capability/credential lookup. The implementation separates invalid credentials from authenticated deployment/state failures, but real latency, Auth event ordering, token refresh, tab lifecycle, and provider error mapping still need hosted browser exercise.

The new frontend requires the compatible Edge/database handshake. With feature flag true and an old/missing backend, the authenticated user receives a deployment-error screen with no application data. Under enforcement, cached incompatible clients are intended to be denied at privileged-action and REST/storage boundaries; that requires live verification with an intentionally stale bundle.

`VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED` is a build/deployment compatibility switch, not runtime authorization. A correct Vercel production value and fresh build must be proven. Do not compensate for a mismatch by weakening database or Edge credential gates.

## Initial-password risk

Employee ID is deterministic, may be short, and can be discoverable. A forced post-authentication change cannot prevent an unauthorized person who already knows the Employee ID from attempting the first login. Required compensating controls are just-in-time provisioning, independent employee verification, production CAPTCHA/rate limits, a short monitored claim window, rapid disable/revocation of unclaimed accounts, and incident response.

The system does not email, display after submission, export, log, audit, or store the initial password. Secure delivery of an administrator-selected temporary reset password remains an operational responsibility.

## Existing identity and lifecycle limitations

- Existing Auth IDs, emails, passwords, profile lifecycle, and role rows are preserved. Legacy users without a trusted Employee ID continue with their established full Auth email.
- Safe identities become `existing_password_rotation_pending`; ambiguous identity/provider evidence becomes `reconciliation_required`. A read-only preflight cannot prove the user's actual password, only usable Auth metadata.
- Runtime disabled/prepared preserves stable access. After enforcement, credential state makes preserved roles ineffective until required change completes. Patch 83U does not physically deactivate/delete/duplicate role rows for rotation/reset and does not activate an inactive/archived/locked profile.
- Administrative deactivate/archive intentionally deactivates and audits active roles. Reactivate/unarchive restores zero roles and requires credential recovery/reconciliation plus explicit reviewed role assignment. A blocked profile with any historical active role fails closed as drift and requires approved reconciliation before activation. Any open protected provisioning row blocks lifecycle administration until its own workflow is completed, cancelled, or reconciled.
- Identity-mode ambiguity, alias drift, tenant mismatch, case-insensitive Employee-ID collision, or unusable Auth identity requires explicit reconciliation. The system cannot safely infer the intended Auth user.

## Session and partial-failure limitations

- Supported global sign-out cannot be assumed to invalidate every issued JWT immediately. A cleanup `session_not_found` proves neither global revocation nor zero session rows. Credential state/version, password/reset cutoff, session evidence, lifecycle, role/scope, organization RLS, and data-boundary checks must remain enforced.
- Current-password verification uses a disposable anon Auth session. Hosted single-session enforcement may invalidate the original browser session during reauthentication; the state machine is designed to finish or enter recovery, but target behavior requires proof.
- Administrator reset never signs the target in with the temporary password for proof, because hosted CAPTCHA may require a user challenge. It instead requires exact Auth Admin success, a follow-up Auth ID/email/version read, and read-only proof of zero target session rows. If any result is ambiguous or sessions remain, the target stays locked in recovery/session-review rather than ordinary success.
- Auth update success followed by database finalization failure cannot be automatically rolled back safely. It requires `recovery_required`, session invalidation, and controlled reconciliation.
- Nonzero or uncertain server-side session proof produces `session_revocation_review_required`; `active` must never be returned, and the old session must remain ineffective by version/cutoff controls.
- The corrected flow must not perform a post-revocation `signInWithPassword` or create a replacement browser session before database finalization. The migration-176 atomic body, exposed only under migration 177's stable `patch83u_finalize_password_change_after_revocation` name, must hold `auth.sessions` stable while it proves zero and activates the credential. Hosted concurrency behavior remains a disposable/enforced-runtime proof gate.
- Lost network responses require retry with the same idempotency request ID. Operators must preserve that ID for an ambiguous attempt and must not generate a new request until the terminal ledger state is known.
- A concurrent hosted Auth ban/delete is outside the lifecycle database transaction. Local profile/credential/role locks cannot prove hosted Auth state remained unchanged during a lifecycle request; this requires controlled hosted concurrency evidence.

No recovery record may contain a password, password hash/digest, token, session secret, or raw Auth response.

## Capability and activation limitations

Migration 174 defaults `disabled`. New managed provisioning, reset, and password transitions are unavailable until runtime is `enforced`. Preparation/enforcement require exact contracts, deterministic preflight hash, zero blockers, and a designated existing eligible global Super Admin. Enforcement also requires the prepared compatibility attestation.

Emergency suspension is a controlled break-glass posture, not a rollback of schema or deletion of credential evidence. It disables protected mutations and may restore documented legacy access. It does not repair identity collisions, session uncertainty, or incompatible deployments; those still require remediation and a new prepared/attested release decision.

Migration 176 adds only one exceptional mutation under emergency suspension: controlled service-role-only self-recovery for the exact runtime-designated Super Admin after every profile/lifecycle, singleton global-role/scope, organization, Auth health/email, credential-version, `legacy_verified`, permitted previous-state/operation-source, zero-session, Employee-ID, request-ID/idempotency, and audit predicate passes. It is not exposed as a browser/user-session/Edge action; emergency Edge mutations remain blocked. Migration 177 changes only the atomic-finalizer RPC identifier and its explicit ACL postconditions; it does not widen the recovery exception. That exceptional path has not yet been proven to completion on staging. Ordinary `patch83u_require_super_admin` must remain unchanged.

## Controlled reconciliation procedure

1. A credential-valid canonical global Super Admin reviews the target organization, profile, protected provisioning/credential/operation evidence, preserved role rows, Employee ID when trusted, canonical Auth email/identity mode, request ID, and password-free audit history.
2. Resolve exactly zero or one compatible Auth identity. Any ambiguity or cross-organization evidence remains blocked.
3. If no Auth write could have succeeded, the protected operation may retry idempotently. If one compatible Auth user exists after a lost response, bind/prove that user rather than creating another.
4. Complete only the missing profile/credential/session evidence. Credential state keeps preserved roles ineffective until exact proof allows access; it does not physically rewrite roles.
5. Record actor, time, request/correlation ID, and safe before/after state. Uncertain outcomes remain recovery/reconciliation/session-review.

## Mandatory release gate

The coordinated fresh-release sequence is: keep current frontend; apply 173; apply 174 disabled; apply reviewed 175/176/177 in order; verify old login; deploy compatible Edge; authenticated designated-Super-Admin capability proof; deploy exact-true frontend; verify disabled runtime; transition prepared; repeat compatibility/attestation; controlled enforcement; then existing-password authentication followed by forced change.

For the current staging incident, do not repeat bootstrap or replay migration 176. Confirm migration 176 is already applied and still matches the recorded repository hash; verify migration 177 is the only intended pending migration; apply only migration 177 after authorization; confirm the exact final catalog name; re-prove zero sessions; invoke the exact recovery through a protected service-role RPC outside browser/Edge; deploy only the matching future-flow Edge correction to staging; complete the negative recovery and no-replacement-session proof while still emergency-suspended; and then make a separate audited decision about returning through `prepared`.

Do not enable production provisioning or enforcement until authorized hosted proof covers CAPTCHA, password policy, first/legacy/last-Super-Admin login, forced change and fresh login, reset with both Employee-ID and custom temporary password, global sign-out, stale-token denial, induced partial failure/replay, reconciliation, cross-organization/last-admin rejection, cached-client denial, Vercel cache behavior, and absence of password/token material in persisted/audit/log output.
