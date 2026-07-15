# Patch 83U — Validation Status

Documentation update: 2026-07-15 (Asia/Riyadh)

## Corrected-revision status

The corrected Patch 83T/83U integration changes the provisioning, password-reset, permanent-change, credential-state, and User Management contracts. The results below were recorded against the final uncommitted integrated worktree on 2026-07-15. No migration, hosted Auth action, deployment, or production import was run.

| Required validation | Corrected-revision status |
| --- | --- |
| `npm run typecheck` | Passed. `tsc --noEmit` exited 0. |
| `npm run test:unit` | Passed: 14 files, 222 tests. |
| `npx playwright test tests/e2e/patch83t-user-excel-import.spec.ts --workers=1` | Passed: 5/5 using the safe local fake-Supabase test configuration. |
| `npx playwright test tests/e2e/patch83u-credential-provisioning.spec.ts --workers=1` | Passed: 5/5 using the same controlled local test configuration. |
| `npx playwright test tests/e2e/patch83s-department-excel-import.spec.ts --workers=1` | Passed: 3/3 regression tests using the same controlled local test configuration. |
| `npx playwright test tests/e2e/patch83u-login-captcha-release-gate.spec.ts --workers=1` | Passed: 6/6 local CAPTCHA release-gate tests, including required, missing, unavailable, expired/retry, invalid/reset, and accepted-token behavior. No hosted provider request or setting change occurred. |
| `npm run build` | Passed. Vite transformed 1,998 modules and emitted the production bundle; only the existing non-blocking large-chunk advisory was reported. |
| `npm run validate:security` | Passed: zero frontend direct RPC calls, zero broad `SECURITY DEFINER` execute grants, zero frontend calls to service-role-only RPCs, and zero service-role-only RPCs without a bridge plan. Generated v700 reports were restored to `HEAD` afterward. |
| `npm run patch83u:auth-surface` | Passed: 0 direct browser RPCs, 353 browser-referenced views, 0 exposed materialized views, 0 unsafe surfaces, and all 29 legacy view-base tables covered by credential-gated RLS evidence. |
| Focused final-finding unit contracts | Passed: auth-surface proof 4/4, CAPTCHA release gate 7/7, and read-only preflight/governance contract 4/4. |
| Edge syntax/type validation | Passed: `npx --yes deno check supabase/functions/privileged-action/index.ts`. The repository `.env.local` was not edited or consumed. |
| `git diff --check` | Passed after the final documentation update. |

## Local contract proof covered

The completed local unit, contract, and browser suites cover:

- Employee ID login maps `11111` to `11111@almodawat.sa`, preserves leading zeroes, and retains full-email legacy login;
- unsupported/malformed credential-state responses and old-Edge `UNSUPPORTED_PRIVILEGED_ACTION` remain fail closed with no login or direct-RPC fallback;
- opening or refreshing the provisioning queue performs no write or Auth creation;
- provisioning requires a global Super Admin, exact Employee ID confirmation, and a separate click;
- protected credential proof distinguishes managed, legacy-verified, and unverified identities, supplies the canonical Auth email, and disables reset/reconciliation when proof is absent or unverified;
- Employee IDs `11111` and `001245` reach local provisioning and derive the correct Auth aliases;
- the exact Employee ID is sent as the initial Auth password inside the protected server action only, while no result, SQL table, audit event, or log contains it;
- blank optional `contact_email` remains provisionable and separate from synthetic Auth email;
- hosted password-policy errors map to `policy_blocked` and the exact safe message without a generated fallback password or partial profile/role/credential state;
- retry after a lost/ambiguous Auth response does not blindly create a duplicate user and partial failure enters reconciliation;
- case-insensitive Employee-ID, Auth-alias, protected-profile, tenant, and active cross-organization-role conflicts remain blocked without exposing protected profile PII;
- provisioning success requires an exact database finalization response, and no Auth deletion occurs after finalization has been attempted;
- reset defaults both password fields to the exact Employee ID and accepts that equality locally;
- reset also accepts a manually entered temporary password subject to hosted Auth policy;
- reset requires exact Employee ID, reason, matching password confirmation, typed `RESET USER PASSWORD`, and server code `PATCH83U_RESET_USER_PASSWORD`;
- Governance Admin and non-Super-Admin actors cannot reset or reconcile; organization, non-self, and last-Super-Admin protections remain enforced;
- reset-begin suspends access and reserves the next credential version without advancing the authoritative database version; only proven finalization advances it, invalidates sessions, and records no password content;
- `password_reset_at` advances only for a successfully finalized administrator reset, not begin, Auth failure, or abort;
- permanent change requires current/new/confirm values, rejects mismatch and surrounding whitespace, and rejects a new password equal to current temporary password, trusted Employee ID, or synthetic Auth local part;
- `must_change_password` clears and eligible roles restore only after Auth update and database finalization succeed; partial failure becomes `recovery_required`;
- credential lock permits only minimal own state read, required password change, and logout, blocking dashboards, direct navigation, normal permissions, and other privileged actions; and
- managed roster/details/edit/export keep Employee Login ID, canonical Auth email, synthetic alias when applicable, optional contact email, phone, identity mode/proof availability, credential state, password-change flag, completion-only reset date, and provisioning state separate;
- canonical global-admin authority, scope/hierarchy-reference consistency, same-tenant actor/target validation, lifecycle synchronization, protected role assignment/deactivation, non-self rules, and eligible last-Super-Admin protection remain enforced without applying the Patch 83T workbook persona matrix to generic role management; and
- reset fields and exact confirmations are cleared on close, target replacement, success, or a failure that requires a fresh authorization attempt.

## Static release-preflight proof

The read-only migration preflight and governance contract passed locally. The SQL was inspected as 19 `SELECT`/`WITH` result sets with no write, DDL, explicit lock, migration, repair, or reset statement. The Auth-settings preflight was not run; its local contract proves only a GET-only, sanitized evidence design that accepts the Management API token from process environment and does not contain a hosted mutation path.

## Database and hosted proof

Migrations 173 and 174 remain unapplied and were not executed. Rollback-only database proof has not been recorded for this corrected revision, and no hosted Auth Admin, password-policy, real-session-revocation, recovery, deployment, or hosted browser proof is claimed.

In particular, passing local tests for Employee ID `11111` proves only that browser/Edge/SQL code no longer rejects it because it is shorter than six characters. It does not prove that the target Supabase Auth password policy accepts it.

## Release verification still required

In an explicitly authorized controlled environment, verify real initial provisioning, first-login change, password reset with Employee ID and a manual temporary password, global sign-out/session cutoff, stale-token denial, reconciliation after an induced partial failure, last-admin protection, cross-organization rejection, and absence of secret material in database/audit/log outputs. Do not enable production until those release gates pass.
