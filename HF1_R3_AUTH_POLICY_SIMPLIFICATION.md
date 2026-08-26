# HF-1-R3 Authentication Policy Simplification

## Authorization

The platform owner permanently retired CAPTCHA and Cloudflare Turnstile from the authentication contract and approved one complete password-strength policy:

- Minimum 8 characters
- At least one letter
- At least one number

Uppercase letters, symbols, leaked-password rejection, dictionary checks, and comparisons with Employee ID or Auth-email local part are not requirements. Password change still requires matching confirmation and a new password that differs from the current password. The technical maximum remains 256 characters.

## Runtime Changes

- Removed the Turnstile component and browser configuration module.
- Removed challenge state, loading, retry, token, and error handling from login.
- Removed challenge handling from forced password change and Patch83U current-password verification.
- Removed the retired browser environment-variable contract.
- Added one shared application password validator and live visible requirements component.
- Applied the policy to protected account provisioning, administrator reset, and forced password change.
- Replaced server-side Employee-ID initial passwords with an explicitly entered governed temporary password.
- Removed permanent-password Employee-ID and Auth-email-local-part rejection.
- Removed Cloudflare traffic from the Staging browser harness allowlist.

Patch83U credential state, forced temporary-password change, versioning, idempotency, session revocation, reconciliation, ambiguous-transition fail-closed behavior, privileged-action JWT verification, RBAC, RLS, lifecycle controls, and organization isolation remain unchanged.

## Staging Configuration

Target: Supabase project `zghsgzrdwbqdrpuxanac` and dedicated Vercel project `grc-staging` only.

- Supabase Auth CAPTCHA: disabled, expected and compliant
- Minimum password length: 8
- Password requirements: Letters and digits
- Leaked-password protection: disabled
- `VITE_AUTH_CAPTCHA_REQUIRED`: removed from the dedicated Staging project
- `VITE_AUTH_CAPTCHA_SITE_KEY`: removed from the dedicated Staging project
- Sign-in rate limits: unchanged
- Other Auth and Attack Protection settings: unchanged

The hosted Management API represents the dashboard's **Letters and digits** option as two required character groups: the ASCII letter set and the digit set. No undocumented value was used.

## Validation Evidence

Application validator acceptance:

- `office123`
- `hospital8`
- `modawat99`
- `test2026a`

Application validator rejection:

- `abcdefgh`: missing number
- `12345678`: missing letter
- `abc123`: fewer than 8 characters

Additional proof covers matching confirmation, new password differing from current, no uppercase or symbol requirement, no identifier comparison, no leaked-password application check, password-only login, forced-change UX, protected provisioning/reset payloads, and no Cloudflare browser request.

No real account password, token, key, cookie, or authorization header is recorded in this evidence.

## Files Changed

The implementation changes the authentication provider and pages, shared password policy/UX, credential API, User Management provisioning/reset UX, Patch83U privileged Edge action, active auth readiness/browser harnesses, focused unit and Playwright contracts, Vite environment typings, styles, i18n copy, and runtime action registry. CAPTCHA-era focused tests and components are removed; historical release evidence remains unchanged.

## Boundaries

- Database migration added: no
- Migration 235 created: no
- Production changes: none
- PR #130 merge: not authorized and not performed
