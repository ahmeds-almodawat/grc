# Patch 83U staging clean-session fix — 2026-07-19

## Result

**FIXED**

- Branch: `patch83t-controlled-user-excel-import`
- HEAD: `a9989b1e8d95a6bb775316a2d9e709ef84514c42`
- Staging project reference: `zghsgzrdwbqdrpuxanac`
- Staged-file count: `0`
- Diagnose-fix-test iterations: `3`

## Root cause

The application overrode Supabase's project-scoped Auth namespace with the shared
browser key `grc-control-center-auth`. The same namespace was therefore reused
by staging and production on the localhost origin, including Supabase Auth
cross-tab messages.

There was no custom storage adapter before this correction. Missing native
storage already returned `null`; an `undefined` adapter result was not the
cause. The installed Auth client accepted a structurally session-shaped
persisted object without binding it to the configured project. Once accepted,
`AuthProvider` correctly entered its authenticated pipeline and the missing
profile result correctly rendered the existing fail-closed reconciliation
screen.

Removing browser storage in the same document did not emit an Auth state event.
The provider retained its in-memory session and profile-denial state, while its
focus path reconciled only an active authorized user and reused that retained
session. This is why clearing the key did not clear the screen.

URL session detection was also enabled although this repository has no OAuth,
OTP, recovery-link, or code-exchange flow that requires it.

## Safe storage-key names

- Legacy shared key: `grc-control-center-auth`
- Staging-scoped key: `grc-control-center-auth:zghsgzrdwbqdrpuxanac`
- Staging verifier key:
  `grc-control-center-auth:zghsgzrdwbqdrpuxanac-code-verifier`

No browser-storage values were captured.

## Controlled before/after evidence

Before the fix:

- A genuinely empty nonpersistent context rendered `login`.
- A synthetic session-shaped value under the legacy shared key was accepted,
  and an intercepted missing-profile response rendered
  `profile_reconciliation`.
- Removing the legacy key in that same document and dispatching focus left the
  screen at `profile_reconciliation`.

After the fix:

- A brand-new nonpersistent context rendered `login`.
- Reload in the same clean context still rendered `login`.
- The profile-reconciliation message was absent in signed-out state.
- Production-project legacy data was not imported into the staging namespace.
- A structurally current-project synthetic session with no profile still
  rendered `profile_reconciliation`, preserving fail-closed behavior.
- Removing that accepted session in the same document changed the screen to
  `login`.
- No production request occurred. Browser proof routes blocked every HTTPS
  destination before dispatch; the one missing-profile response used by the
  controlled regression case was fulfilled inside Playwright.

## Files changed by this correction

- `src/lib/supabaseAuthStorage.ts`
- `src/lib/supabase.ts`
- `src/auth/AuthProvider.tsx`
- `src/App.tsx`
- `tests/unit/supabaseAuthStorage.test.ts`
- `tests/unit/authSessionRace.test.ts`
- `tests/unit/patch83uAuthGateContract.test.ts`
- `playwright.staging-clean.config.ts`
- `tests/e2e/patch83u-staging-clean-session.playwright.ts`
- `release/patch83u/patch83u-staging-clean-session-fix-20260719.md`
- `release/patch83u/patch83u-staging-clean-session-fix-20260719.json`

## Correction

- Auth persistence and Auth cross-tab messaging now use a deterministic
  full-project-reference namespace.
- The storage adapter returns exactly `string | null`.
- Missing, malformed, expired, structurally unusable, and wrong-project
  persisted sessions fail to signed-out state.
- A valid active legacy session is migrated only when its issuer, subject,
  audience, expiry, and user identity bind it to the configured project.
- Production-project legacy data is ignored and is never imported into staging.
- URL session detection is disabled.
- Bootstrap, Auth events, focus, reload, and explicit sign-in validate the
  current session before entering the authenticated pipeline.
- Null current session clears the in-memory session, profile, roles,
  credential state, loading state, and active operations together.
- Authenticated-only screens additionally require a real current session.
- A real authenticated user with no profile continues to receive the existing
  fail-closed reconciliation screen.

## Validation

- `npm run dev:staging`
  - Pass.
  - Guard output:
    `Verified staging Supabase project: zghsgzrdwbqdrpuxanac`
- `npx vitest run tests/unit/supabaseAuthStorage.test.ts tests/unit/authSessionRace.test.ts tests/unit/patch83uAuthGateContract.test.ts tests/unit/patch83uStagingFrontendTarget.test.ts`
  - Pass: `4` files, `39` tests.
- `npx playwright test --config playwright.staging-clean.config.ts`
  - Pass: `3` tests.
  - Tracing, HAR, video, screenshots, storage-state export, and service workers
    were disabled or absent.
- `npm run typecheck`
  - Pass.
- Staging-isolated `npm run build -- --mode staging`
  - Pass: `2,004` modules transformed.
  - One existing chunk-size advisory was emitted; there was no build error.
- `git diff --check`
  - Pass. Git emitted line-ending notices only.

## Safety confirmation

- No credential was entered.
- No login or Auth action was performed.
- No browser-storage value was printed or persisted as evidence.
- No hosted data was read or changed.
- No database connection was opened.
- No password reset or password change occurred.
- No deployment or migration occurred.
- No production access occurred.
- No file was staged, committed, or pushed.

Captured at `2026-07-19T00:38:11Z`.
