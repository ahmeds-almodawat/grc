# Patch 83U — Remaining Limitations and Operational Risks

## Release limitations

- Migrations 173 and 174 are unapplied and were not executed. No hosted Auth account, password, profile, role, credential state, database row, or session was changed by this implementation, and nothing was deployed.
- The read-only migration preflight was created and statically validated but was not run against any database. Its counts, collision findings, role defects, grant inventory, and estimated migration impact therefore remain unknown for the hosted project.
- The GET-only Auth-settings preflight was created but was not run. Hosted CAPTCHA enablement, endpoint rate limits, password requirements, leaked-password protection, JWT expiry, and session lifetime/inactivity/single-session values remain unverified and unchanged.
- The repository inventory proves the intended RPC/view/RLS migration contract, but live post-migration catalog ACLs, default grants, view options, and materialized-view exposure still require an authorized hosted read-only verification after migrations 173/174 are applied.
- Real Auth Admin, password-policy, transaction, RLS, session-revocation, and recovery behavior requires an explicitly authorized controlled environment. Static, unit, or mocked browser tests do not prove those hosted paths.
- Hosted acceptance of Employee ID `11111` as an initial or reset password is unknown. The local six-character rejection is removed, but Supabase remains authoritative. A policy rejection must remain `policy_blocked`, generate no replacement password, and create no partial profile/role/credential state.
- Employee ID as initial password is intentionally deterministic and may be short or discoverable. Forced first-login change reduces application access but does not eliminate takeover before the legitimate user's first successful change. Just-in-time provisioning, independent employee verification, monitoring, and rapid handling of unclaimed accounts are operational release requirements.
- Legacy users with an established verified Auth email keep that identity. The UI exposes managed, legacy-verified, and unverified identity states separately; missing proof, alias drift, case-insensitive Employee-ID collision, or ambiguity requires explicit review and disables credential actions rather than silently rewriting a legacy Auth user.
- Supabase global sign-out behavior and `auth.sessions` transitions require hosted validation. An issued JWT may remain cryptographically valid after sign-out, so credential state, version, lifecycle, ownership, and cutoff checks must remain enforced at frontend, Edge, RLS, and storage boundaries.
- Administrator reset depends on isolated target credential proof for global target sign-out. If Auth sign-in/sign-out or session-row proof is unavailable or ambiguous, the workflow must fail closed and enter recovery rather than report a successful reset.
- Interrupted Auth/profile/role/finalization work can require manual reconciliation. The system never guesses that an Auth write succeeded, never deletes an Auth user after database finalization has been attempted, and never restores normal roles while the credential is locked, in progress, or in `recovery_required`.
- Held lifecycle records (`inactive`, `archived`, or `locked`) are not silently activated by provisioning or reconciliation. Their lifecycle must be deliberately corrected under the normal role/organization protections.
- No password is emailed, exported, logged, stored, or displayed after submission. Secure delivery of an administrator-selected temporary reset password remains an operational responsibility. `password_reset_at` is a completion timestamp only; requested, failed, or aborted resets are represented by other protected state/evidence and do not advance it.
- The new frontend is incompatible with the old deployed Edge action set by design. `UNSUPPORTED_PRIVILEGED_ACTION` is a fail-closed deployment-version signal, not a condition for adding a fallback.
- CAPTCHA-required login remains disabled unless the exact public frontend flag and site key are supplied as part of an authorized deployment and the matching secret/provider is configured in Supabase. This work changed no Vercel or Supabase configuration and performed no hosted CAPTCHA request.

## Controlled reconciliation procedure

1. A canonical global Super Admin reviews the protected provisioning or credential record, organization, Employee ID, canonical Auth email and identity mode, safe error code, retry count, and audit history.
2. The protected action resolves the canonical Auth identity, case-insensitive Employee-ID evidence, tenant alignment, provisioning metadata, and protected role/credential proof. It must find no Auth user or exactly one compatible Auth user; ambiguity remains blocked.
3. When no prior Auth write can have succeeded, provisioning may retry idempotently. When one compatible Auth user exists after a lost response, reconciliation binds that user instead of creating another.
4. The workflow completes only the missing profile, role, credential, or session-finalization steps. Normal roles stay suspended until credential state is active and required password change is complete.
5. Every transition records actor, time, request/correlation data, and safe before/after state without password or token content. Any uncertain transition remains `recovery_required` or requires a fresh controlled reset.

## Coordinated release gate

After review, release in this order: migration 173, migration 174, matching `privileged-action` Edge Function, then frontend. Run rollback-only SQL proof and authorized hosted provisioning, forced-change, reset, reconciliation, version-denial, session, last-admin, and cross-organization tests before production enablement. Provisioning, reconciliation, reset, and import execution remain separate human-confirmed actions.
