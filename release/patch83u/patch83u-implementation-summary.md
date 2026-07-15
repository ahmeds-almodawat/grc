# Patch 83U — Employee ID Authentication and Credential Governance

## Status

Patch 83U is an uncommitted release candidate on `patch83t-controlled-user-excel-import`. Migrations 173 and 174 are authored but unapplied. Nothing described here was staged, committed, pushed, deployed, applied to a database, or run against hosted Auth. This document makes no hosted Auth, session-revocation, or database-transaction claim.

## Managed identity and login

An identifier without `@` is treated as an Employee ID and mapped to `lower(employee_id) + '@almodawat.sa'` for Supabase Auth. An identifier containing `@` continues through the existing full-email login path for legacy compatibility. Leading zeroes are preserved; existing legacy Auth identities are not silently rewritten.

The managed account stores these values separately:

- Employee Login ID: exact trimmed Employee ID in `profiles.employee_no`;
- Synthetic Auth Email: lowercase Employee ID plus `@almodawat.sa` in `profiles.email`;
- Contact Email: optional value in `profiles.contact_email`; and
- Phone: normalized profile phone.

The server, not browser input, derives or verifies the synthetic Auth email used for provisioning and retrieves Employee ID from trusted profile state for permanent password checks. Existing accounts use a three-state identity classification: `employee_id_managed`, `legacy_verified`, or fail-closed `unverified`. The protected credential roster supplies the canonical Auth email; the User Management UI labels managed and legacy identities separately and disables credential actions when that proof is absent or unverified.

## Login abuse-protection gate

Employee-ID and full-email sign-in use the same configurable Cloudflare Turnstile path supported by Supabase Auth. `VITE_AUTH_CAPTCHA_REQUIRED` accepts only the exact values `true` or `false`; an invalid production value, a required-but-missing public site key, an unavailable provider, or a missing/expired token fails closed before sign-in. Only the public `VITE_AUTH_CAPTCHA_SITE_KEY` is available to the frontend. The CAPTCHA token is passed through the installed Supabase SDK's `options.captchaToken`, is rechecked by the Auth provider, and is reset after each attempt or expiry. No provider secret is stored in browser code.

## Auth-surface and global-search gate

`search_grc_global` no longer has a direct-browser exception. The browser calls the authenticated `privileged-action` Edge bridge, which first applies the Patch 83U credential/session gate and then invokes the `SECURITY INVOKER` search routine with the caller JWT so dependent table RLS remains authoritative. Migration 174 also makes every authenticated-readable ordinary public view security-invoker, rejects authenticated-readable materialized views, and adds explicit credential/organization RLS evidence to the 29 audited legacy view-base tables. The automated inventory fails on a future direct RPC, unsafe exposed routine, owner-executed view, materialized view, unprotected base table, or unaudited future `SECURITY DEFINER` routine.

## Controlled provisioning

Patch 83T creates only a protected provisioning record. Opening or refreshing the queue is read-only. A separate global-Super-Admin-only action, exact Employee ID confirmation, and explicit click are required to create an Auth account.

Provisioning sets the initial Auth password to the exact, case-preserved Employee ID. It never generates a replacement password, returns the password, or stores it in SQL, an event, an audit snapshot, a result payload, an export, or a log. Profile, role, and credential records are created only after the Auth result is unambiguous and are held from normal access until the required password change completes.

Employee ID `11111` passes local validation and maps to `11111@almodawat.sa`; the code does not impose a six-character minimum. Hosted Supabase password-policy acceptance is not assumed. If Auth rejects the exact Employee ID for password policy, provisioning remains retryable as `policy_blocked`, no partial profile/role/credential state is created, and the safe response is:

> The current Supabase Auth password policy does not accept this Employee ID as the initial password.

If an Auth write may have succeeded but its result is lost or later profile/role work fails, the record enters a reconciliation/recovery state. Retry first resolves the canonical Auth identity and recorded metadata; it does not blindly create another Auth user. Once database finalization has been attempted, the Edge action never deletes the Auth user on a later error. It requires an exact finalization response proving the provisioning record, profile, credential version/state, and first-login-change requirement before reporting success; missing or mismatched proof remains reconciliation-required.

## Forced first-login password change

Managed users with `must_change_password` cannot reach dashboards, operational routes, normal role permissions, or other privileged actions. They may only read the minimal own credential state, complete the required password change, or log out.

The password-change request contains `current_password`, `new_password`, and `confirm_new_password`. The Edge action verifies authentication, confirmation match, current credential state/version, request limits, and accidental surrounding whitespace. It rejects a new password equal to the current temporary password or, case-insensitively where applicable, the trusted Employee ID or synthetic Auth-email local part.

The recoverable state machine marks `password_change_in_progress` and reserves the next credential version, updates Supabase Auth, proves the applied Auth metadata/session outcome, and only then finalizes the database credential as active. Finalization clears `must_change_password`, advances the database `credential_version`, restores only eligible roles, and writes a non-secret audit event. The Edge action validates the exact finalization response before reporting success. If Auth may have changed but database finalization fails or returns incomplete proof, access stays closed in `recovery_required` for controlled reconciliation.

## Super Admin password reset

Only a canonical global Super Admin can reset another verified managed or legacy user's password. Governance Admin has no reset authority. The reset dialog displays the user name, Employee ID, and protected canonical Auth identity (synthetic alias for a managed user or verified Auth email for a legacy user) and defaults both temporary-password fields to the exact Employee ID. The administrator may keep that value or enter another temporary password accepted by the hosted Auth policy; Patch 83U does not impose an unrelated ten-character minimum and does not reject a temporary password merely because it equals Employee ID.

Reset requires all of the following:

- exact target Employee ID;
- matching temporary-password and confirmation fields;
- a mandatory reason;
- the administrator types `RESET USER PASSWORD` exactly; and
- the request sends `confirmation: PATCH83U_RESET_USER_PASSWORD`, which is required again by the Edge action and migration 174 reset-begin function.

The confirmation and password fields are reset when the dialog closes, the target changes, reset succeeds, or a failure requires fresh confirmation. Reset-begin enforces organization match, canonical global-Super-Admin role shape, non-self target, verified identity mode, and last-eligible-Super-Admin protection before suspending eligible roles and reserving the next credential version. Supabase Auth is then changed and target-session proof is obtained. The database `credential_version` advances, `password_reset_at` is recorded, and success is returned only by exact finalization proof; begin, failed Auth mutation, and abort do not advance either completion value. Ambiguous or partial completion remains fail closed in a recovery state with password-free audit events.

## Session and credential enforcement

Required change revokes the caller's sessions; administrator reset uses an isolated target credential proof to request global target sign-out. Database finalization requires the intended session cutoff/revocation state, and credential-version/state gates reject stale application access.

Server-side sign-out cannot be treated as proof that every already-issued JWT has instantly expired. The application therefore continues to enforce credential state, signed credential version, session cutoff, profile lifecycle, and session ownership at frontend, Edge, RLS, and storage boundaries. Real hosted session-revocation behavior remains a controlled-release test gate.

## User Management and reconciliation

Managed user details, roster search/export, and protected profile editing show Employee Login ID, protected canonical Auth email, synthetic Auth alias when applicable, optional contact email, phone, identity mode, credential-proof availability, credential state, Must Change Password, completion-only last password reset, and provisioning state separately. The UI treats `employee_id_managed`, `legacy_verified`, and `unverified` distinctly; unverified or missing protected proof disables reset and reconciliation. Passwords are never displayed.

Provisioning reconciliation is explicit, canonical-global-Super-Admin-only, organization-scoped, and audited. It requires exact Employee ID confirmation and may bind one uniquely resolved Auth user, complete recoverable profile/role/credential work, or leave the record blocked for review. Case-insensitive Employee-ID conflicts, Auth-alias ambiguity, tenant mismatch, and invalid scope/hierarchy-reference shapes remain blocked. Generic role management remains scope-driven; Patch 83U does not impose the narrower Patch 83T workbook persona matrix on all roles. Reconciliation never stores a password or guesses that an ambiguous Auth/session transition succeeded.

## Coordinated deployment requirement

Release order is mandatory:

1. migration 173;
2. migration 174;
3. the matching `privileged-action` Edge Function; and
4. the matching frontend.

A Patch 83U frontend calling the old Edge deployment fails closed with `UNSUPPORTED_PRIVILEGED_ACTION`. No fallback may bypass credential-state verification.

## Read-only release evidence

The migration preflight is a read-only SQL report for profile/Auth identity alignment, predicted identity classes and reconciliation, role/tenant/hierarchy defects, eligible Super Admin continuity, Employee-ID/Auth-alias collisions, RLS and browser grants, and estimated migration 174 row impact. The Auth-settings preflight performs one sanitized GET of project Auth configuration and records only the CAPTCHA state, rate-limit fields, password policy, leaked-password protection, JWT expiry, and session controls. Neither preflight changes hosted state; neither has been run against the hosted project in this uncommitted work.

## Main implementation files

- `src/pages/LoginPage.tsx`
- `src/auth/TurnstileLoginCaptcha.tsx`
- `src/auth/loginCaptcha.ts`
- `src/auth/AuthProvider.tsx`
- `src/auth/authTypes.ts`
- `src/lib/userCredentialApi.ts`
- `src/pages/ForcedPasswordChange.tsx`
- `src/pages/UserManagementCenter.tsx`
- `supabase/functions/privileged-action/index.ts`
- `supabase/migrations/174_patch83u_employee_id_auth_and_credential_governance.sql`
- `supabase/tests/patch83tu_release_preflight.sql`
- `supabase/tests/patch83u_credential_governance_tests.sql`
- `scripts/patch83u-auth-settings-preflight.mjs`
- `scripts/patch83u-auth-surface-proof.mjs`
- `release/patch83u/patch83u-auth-surface-inventory.md`
- `release/patch83u/patch83u-release-preflight-runbook.md`
- `release/patch83u/patch83u-operational-runbook.md`
- `release/patch83u/patch83u-risk-acceptance.md`
- `tests/unit/userCredentialApi.test.ts`
- `tests/unit/patch83uAuthGateContract.test.ts`
- `tests/unit/patch83uAuthSurfaceReleaseProof.test.ts`
- `tests/unit/patch83uLoginCaptchaReleaseGate.test.ts`
- `tests/unit/patch83tuReleasePreflightGovernanceContract.test.ts`
- `tests/unit/userCredentialGovernanceContract.test.ts`
- `tests/e2e/patch83u-credential-provisioning.spec.ts`
- `tests/e2e/patch83u-login-captcha-release-gate.spec.ts`
