# Patch 83U Employee-ID Credential Risk Acceptance

## Decision status

This record is **not approved** until every decision field is completed by an authorized approver and each mandatory control has current target-environment evidence. A blank field means the risk is not accepted. Local tests and this document are not approval to apply, configure, deploy, or enforce Patch 83U.

## Explicit risk statement

- Employee ID is the initial password for a newly provisioned managed account.
- Five-digit Employee IDs may be accepted only if the hosted Supabase password policy allows them; no fallback password is generated.
- First-login takeover is possible when an Employee ID is predictable or known and another person reaches the account before the intended employee.
- Forced first-login password change reduces but does not eliminate the risk because it happens only after normal Supabase Auth succeeds.
- Existing users retain their existing Auth password until they authenticate normally and change it themselves.
- No National ID or Iqama is used as login ID, password, recovery value, confirmation, or identity proof.

Employee ID is an identifier, not a secret and not proof of identity. The organization explicitly accepts the residual risk only when the controls below are implemented and evidenced.

## Required compensating controls

1. Authentication precedes every Patch 83U capability/credential lookup. Profile, roles, navigation, dashboard, search, and application data remain closed until the authenticated credential decision allows access.
2. Production CAPTCHA protects both Employee-ID and full-email login and the forced current-password reauthentication path. Missing key/provider/token and expiry fail closed; the token resets after each attempt. The secret remains provider/Supabase-side.
3. Hosted Auth rate limits, password policy, leaked-password protection, JWT expiry, session lifetime/inactivity, and single-session settings are reviewed and recorded without secret material.
4. Hosted policy explicitly determines whether five-digit Employee IDs are accepted. Rejection produces `policy_blocked`, no replacement password, and no partial profile/role/credential activation.
5. Migration 174 installs with runtime `disabled`. The exact release order is current frontend, migration 173, migration 174 disabled, stable-login proof, compatible Edge, authenticated capability proof, exact-true frontend, disabled-runtime frontend proof, prepared transition, designated-Super-Admin compatibility attestation, controlled enforcement, then existing-password login/rotation.
6. Preparation/enforcement requires matching contracts, deterministic preflight hash, zero blockers, and a designated existing eligible global Super Admin. Runtime transitions are service-only, exact-confirmation, idempotent, and audited.
7. New provisioning remains disabled in `disabled`/`prepared` and is limited in `enforced` to a credential-valid canonical global Super Admin, approved import execution, exact organization, validated workbook, explicit confirmations, and protected proof. Upload/parsing/preview never creates an account.
8. The employee's identity is verified through an independent approved channel before claim instructions or a reset password are delivered.
9. Unclaimed/initial-change accounts have a short approved claim window, continuous monitoring, a named owner, and controlled disable/session revocation at expiry.
10. Permanent password change requires re-entered current/temporary password, confirmation, disposable non-persistent Auth reauthentication, CAPTCHA when required, and rejection of current password, trusted Employee ID, and trusted Auth-email local part. Success requires fresh login.
11. Existing Auth IDs/emails/passwords, profile lifecycle, and canonical role rows remain preserved. Credential state makes a role ineffective while locked; rotation/reset does not delete, duplicate, or physically deactivate roles.
12. Credential state/version, session cutoff/existence where required, profile lifecycle, exact role/scope, organization RLS, privileged actions, storage, and REST data boundaries independently reject stale access. Supported Admin sign-out is used; no direct `auth.sessions` mutation is allowed. A cleanup `session_not_found` is not global-revocation proof, and `active` requires the service-only atomic finalizer to hold `auth.sessions` stable, prove zero, and finalize in one transaction.
13. Super Admin reset requires a different same-organization active credential-valid canonical global Super Admin, exact target/Employee ID, a reason containing no exact temporary-password value, matching temporary confirmation, UI phrase `RESET USER PASSWORD`, backend phrase `PATCH83U_RESET_USER_PASSWORD`, idempotency ID, last-admin protection, exact Auth Admin update/read-back proof, and read-only proof of zero target session rows before ordinary success.
14. Partial Auth/database/revocation results remain retry, recovery, reconciliation, or session-review states. Same-request replay is terminal/idempotent. No password is rolled back automatically or stored in recovery evidence.
15. Vercel production environment, current deployment alias, HTML revalidation/cache headers, immutable content-hashed assets, CDN/service-worker state, authenticated deployment mismatch UX, and intentionally stale-client data denial are verified before enforcement.
16. A tested emergency-suspension process exists. It disables protected mutations, preserves credential/audit evidence, remains exact-confirmation/service-only/audited, and never weakens RLS, JWT, role/scope, tenant, or service-role controls.
17. Provisioning, credential, runtime, Auth, CAPTCHA/rate-limit, role/lifecycle, collision, recovery, reset, and reconciliation events are monitored with defined owners/retention and no password/token content.
18. Migration 176 leaves ordinary `patch83u_require_super_admin` unchanged. Its controlled service-role-only emergency exception permits only the exact designated Super Admin to reconcile themself while runtime is `emergency_suspended`, after all identity, lifecycle, singleton global-role/scope, organization, Auth health/email, credential-version, `legacy_verified`, permitted state/operation source, zero-session, Employee-ID, request-ID/idempotency, and append-only audit predicates pass. It is not a browser/user-session/Edge action; emergency Edge mutations remain blocked.
19. Migration 176 is already applied to staging and remains unchanged at repository SHA-256 `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`. Migration 177 must rename the exact PostgreSQL-truncated finalizer in place to the explicit 50-byte `patch83u_finalize_password_change_after_revocation`, preserve its protected body and safe `search_path`, revoke `PUBLIC`/`anon`/`authenticated`, grant only `service_role`, and fail closed on a missing source or destination conflict.
20. Forced password change performs no post-revocation `signInWithPassword`, creates no replacement browser session before database finalization, treats ambiguous revocation as `session_revocation_review_required`, and leaves the browser signed out for a fresh login only after terminal finalization.

## Evidence checklist

- [ ] Read-only Patch 83T/83U preflight completed in the authorized environment; hash and zero activation blockers recorded.
- [ ] Eligible designated existing global Super Admin and every organization's bootstrap continuity verified.
- [ ] Migration 172 unchanged; migrations 173/174 reviewed; migration 174 default disabled proved.
- [ ] Migrations 173/174/175 unchanged by remediation; migration 176 confirmed already applied and repository hash unchanged; forward-only migration 177 reviewed; service-role-only grants proved; and ordinary Super Admin guard unchanged.
- [ ] Auth-surface/RLS/storage/REST inventory has no unsafe exception.
- [ ] Exact Edge/frontend/schema contracts and prepared compatibility attestation proved.
- [ ] Existing frontend login proved after migrations while enforcement remains disabled.
- [ ] Exact-true new frontend proved while disabled/prepared; incompatible/cached clients receive no application data.
- [ ] Vercel environment/alias/cache-control/CDN/service-worker evidence is current.
- [ ] Existing full-email/Employee-ID login, existing-password preservation, lazy rotation, last-Super-Admin self-change, and fresh login proved.
- [ ] Emergency-suspended designated-Super-Admin self-recovery and every fail-closed predicate are proved; the same exception is rejected under enforced runtime and for non-designated/mismatched actors.
- [ ] Current-password reauthentication and CAPTCHA required/missing/expired/accepted/reset paths proved in the authorized environment.
- [ ] Hosted policy outcome for short Employee IDs is recorded.
- [ ] Provisioning denial before enforcement and protected provisioning after enforcement are proved.
- [ ] Reset with Employee ID and custom temporary password, exact confirmations, strict role/scope, last-admin, cross-organization, session revocation, and target forced change are proved.
- [ ] Induced Auth/finalization/revocation/lost-response cases prove recovery and idempotent replay without password content.
- [ ] Stale JWT/session, multi-tab invalidation, and cached-client data denial are proved.
- [ ] Atomic locked zero-session finalization precedes `active`; no post-revocation replacement session is created; `session_not_found` alone never produces success; the browser ends signed out.
- [ ] Monitoring, claim-window SLA, incident response, emergency suspension, and return-to-prepared procedure are rehearsed.

## Mandatory decision record

| Field | Required entry |
| --- | --- |
| Approver |  |
| Decision | Accept / Reject / Defer |
| Scope | Named environment, organizations, account population, and release version |
| Risk owner |  |
| Security reviewer |  |
| Operations owner |  |
| Designated existing Super Admin |  |
| Preflight hash and evidence location | Restricted evidence; no credentials/secrets |
| Expected Edge/frontend contracts |  |
| Review date | YYYY-MM-DD |
| Expiry date | YYYY-MM-DD; acceptance must be time-bounded |
| Rollback trigger | Specific measurable emergency-suspension conditions |
| Exceptions and owners | Time-bounded exception, alternative control, owner, due date |

## Minimum emergency triggers

At minimum: suspected first-login takeover; Employee-ID enumeration above threshold; CAPTCHA fail-open; hosted policy drift; missing/invalid capability attestation; enforcement before compatible contracts; loss of eligible Super Admin; last-Super-Admin recovery outside the exact migration 176 predicates; migration-177 finalizer name/ACL/body drift; ordinary Super Admin guard weakening; credential/session/data-boundary bypass; post-revocation replacement session; `active` without zero-session proof; stale-client access; cross-organization access; identity collision; inability to prove session revocation; unauthorized role/profile mutation; provisioning outside enforced runtime or without final execution; reconciliation volume above threshold; or Vercel serving an incompatible build.

At a trigger, stop new provisioning/import execution and protected credential mutations, use the approved exact-confirmation emergency-suspension path when appropriate, revoke/lock affected sessions/accounts through controlled actions, preserve evidence, and invoke the recovery plan. The trigger does not authorize migration repair/reset, direct protected-table edits, role deletion, or weaker security controls.
