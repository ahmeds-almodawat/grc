# Patch 83U — Hosted Defect and Migrations 176–177 Remediation Proof

## Evidence boundary

This artifact records supplied staging evidence, including the already-applied migration 176, and the local forward correction. It does not authorize or claim migration-177 application, deployment of the matching Edge correction, a new runtime transition, a new password action, reconciliation, provisioning action, or production access.

- Environment: staging only
- Supabase project reference: `zghsgzrdwbqdrpuxanac`
- Runtime state: `emergency_suspended`
- Runtime state version: `3`
- Designated staging Super Admin: `83d92a59-6909-44e7-80f3-aff60a6734fb`
- Database credential version: `1`
- Auth credential version: `1`
- Auth session count after external global sign-out: `0`
- Current credential state: `session_revocation_review_required`
- Migration 176: applied to staging; repository SHA-256 unchanged
- Migration 177: not applied
- No-touch Employee ID: `11111`
- No-touch provisioning UUID: `46205a79-d012-4965-b246-0683dcace70c`

No password, token, session identifier, Auth response, or service credential is recorded here. Production Supabase is outside scope and must never be linked, queried, migrated, or deployed by this remediation.

## Hosted defect evidence

The supplied hosted sequence was:

1. A temporary password-verification sign-in created an Auth session.
2. The Auth password update succeeded.
3. Logout of the already-invalidated session returned `session_not_found`.
4. A later frontend password grant created another Auth session.
5. Database finalization correctly refused to mark the credential active while that session remained.
6. The credential entered `session_revocation_review_required`.
7. An external supported global sign-out reduced the target Auth session count to zero.
8. Reconciliation still failed because `patch83u_reconcile_credential_state` first called ordinary `patch83u_require_super_admin`, which required the only designated administrator to already be credential-active.

The first defect was treating a cleanup/sign-out outcome as too close to global-revocation proof while permitting a replacement session before database finalization. The second defect was an authorization cycle: the only actor able to reconcile the only designated Super Admin was the same non-active credential that ordinary reconciliation refused.

## Forward-only database correction

`supabase/migrations/176_patch83u_last_super_admin_recovery.sql` added the recovery and atomic-finalization body and is already applied to staging. Its repository SHA-256 remains `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`; it must not be edited or replayed. `supabase/migrations/177_patch83u_explicit_password_finalizer_rpc_name.sql` is the pending forward-only identifier correction. Migrations 173, 174, and 175 are not edited.

Migration 176 declared the atomic finalizer with the intended 67-byte unquoted identifier `patch83u_finalize_required_password_change_after_session_revocation`. PostgreSQL stores at most 63 bytes for an identifier (`NAMEDATALEN = 64`), so the actual catalog object is `patch83u_finalize_required_password_change_after_session_revoca`. An RPC caller using the intended 67-byte string therefore cannot resolve the hosted catalog object by that exact API name.

Migration 177 fails closed unless that exact truncated source object exists with the expected `SECURITY DEFINER` and safe-`search_path` contract, then renames it in place to the explicit 50-byte stable RPC name `patch83u_finalize_password_change_after_revocation`. It reasserts the safe `search_path`, revokes execution from `PUBLIC`, `anon`, and `authenticated`, grants execution only to `service_role`, and verifies the old name is gone and the destination is unique. It does not duplicate or replace the protected migration-176 function body.

Migration 176 supplies the owner-only `patch83u_reconcile_last_super_admin_recovery` implementation behind the service-role-only `patch83u_reconcile_credential_state` wrapper and the protected atomic-finalizer body. Migration 177 gives that existing finalizer the stable service-only name `patch83u_finalize_password_change_after_revocation`. Neither correction weakens ordinary `patch83u_require_super_admin`.

The emergency recovery is deliberately not a browser, authenticated-user-session, or Edge mutation. Its zero-`auth.sessions` precondition conflicts with an authenticated target session, so emergency Edge mutations remain blocked. An authorized operator may invoke only the service-role wrapper from a protected environment after independently verifying zero target sessions.

The exceptional recovery path is permitted only when all of these are proved:

- runtime is exactly `emergency_suspended`;
- actor equals target and both equal `patch83u_runtime_control.designated_super_admin_id`;
- target profile exists, is active, and has active canonical lifecycle;
- exactly one target active `super_admin` assignment exists, it is a valid global assignment, and it is the organization's only valid active global Super Admin assignment;
- role organization matches the target organization, scope is global, and division/department/unit references are null;
- Auth user exists, is confirmed, not deleted, and not banned;
- Auth email exactly matches the managed credential email;
- Auth credential version exactly matches database credential version;
- identity mode is exactly `legacy_verified`;
- credential state is exactly one of `recovery_required`, `reconciliation_required`, or `session_revocation_review_required`;
- no target row exists in `auth.sessions`;
- exact null-safe Employee ID confirmation succeeds;
- request ID is valid and same-request idempotency proof is consistent;
- operation source is `password_change`, `reconciliation_auth_changed` is true, previous lifecycle is `active`, previous session cutoff is present, and previous credential state is exactly one of `existing_password_change_required`, `initial_change_required`, `admin_reset_change_required`, or `reactivation_change_required`;
- exactly one matching password-change operation proves the current credential version and protected result state; and
- append-only, password-free credential audit evidence is written.

All missing, conflicting, duplicate, ambiguous, cross-user, non-designated, non-global, unhealthy Auth, version-mismatch, remaining-session, wrong-confirmation, or unexpected-operation cases fail closed. The routines are `SECURITY DEFINER` only where privilege is required and set a safe `search_path`. The owner-only recovery implementation revokes execution even from `service_role`; the service wrapper is its sole entry point. The wrapper and atomic finalizer revoke `PUBLIC`, `anon`, and `authenticated` and grant only `service_role`. They do not expose service credentials or permit browser-direct invocation.

The exception cannot provision, reset another user, perform ordinary administrator password change, change a role/profile lifecycle, change the designated administrator, or transition runtime state.

## Edge and frontend correction

The corrected required-password flow has this order:

1. Validate caller JWT, protected credential state/version, exact request ID, password confirmation, and CAPTCHA where configured.
2. Perform read-only preparation.
3. Verify the current password before any password mutation using a non-persistent Auth client.
4. Begin the idempotent database operation.
5. While the disposable verification token is still valid, explicitly request supported global session revocation.
6. Update password and credential-version metadata through the supported Auth Admin API.
7. Do not call `signInWithPassword` again after revocation and do not create or grant a replacement browser session.
8. Call the atomic server-side finalizer, which stabilizes session creation with a short `SHARE` lock on `auth.sessions`, takes fail-closed identity/user row locks, proves zero rows, and invokes the existing protected finalizer before releasing the transaction locks.
9. Finalize `credential_state = 'active'` only when both the supported global sign-out returned exact success and the atomic zero-session finalization succeeds; otherwise retain `session_revocation_review_required` or `recovery_required`.
10. Clear browser Auth state and cross-tab authorization state. The browser remains signed out and may perform a fresh login only after terminal database finalization.

`session_not_found` from an already-invalid temporary/browser session is not global-revocation proof. It cannot enter the atomic-success path even when a later read observes zero rows; the exact sign-out result and locked zero-session finalization are both required.

A definitive hosted-policy rejection after global revocation proves the new password was not written, but the browser session is already revoked. The frontend therefore compare-clears the matching local session and instructs the user to sign in again with the unchanged current password before choosing a different new password; it never creates a replacement grant automatically.

## Required regression matrix

The evidence below was observed locally or in an isolated disposable PostgreSQL database. The supplied staging facts separately establish that migration 176 is applied; this matrix does not claim migration-177 application, corrected hosted Auth behavior, or production validation.

| Case | Required result | Current evidence |
| --- | --- | --- |
| Designated Super Admin self-recovery in `emergency_suspended` | Exactly one audited active reconciliation | PASS — disposable rollback SQL |
| Same request while runtime is `enforced` | Reject, zero write | PASS — disposable rollback SQL |
| Actor/target mismatch | Reject, zero write | PASS — disposable rollback SQL |
| Non-designated Super Admin | Reject exceptional path | PASS — disposable rollback SQL |
| Missing/invalid/duplicate global role | Reject, zero write | PASS — disposable rollback SQL |
| Auth/database credential-version mismatch | Reject, zero write | PASS — disposable rollback SQL |
| Remaining target Auth session | Reject active finalization | PASS — disposable rollback SQL |
| Wrong/null-unsafe Employee ID confirmation | Reject, zero write | PASS — disposable rollback SQL |
| Duplicate request ID | Exact idempotent replay or consistent conflict rejection | PASS — disposable rollback SQL |
| Ordinary `patch83u_require_super_admin` | Behavior unchanged | PASS — catalog/body and static contracts |
| Forced password change | No post-revocation sign-in/replacement session | PASS — unit, Edge, and Playwright contracts |
| Active credential result | Only after zero-session proof | PASS — migration-176 atomic database proof |
| Explicit finalizer RPC name | Exact Edge/catalog name below PostgreSQL's 63-byte limit | PASS locally/disposable — Edge exact-name contract, migration-177 OID/body/owner-preserving rename, 50-byte catalog name, zero old-name routines, unique destination, restricted ACL/search path, and static Auth-surface replay through migration 177 |
| Browser after terminal password change | Signed out; fresh login required | PASS — Playwright |
| New-password policy rejection after revocation | Current password unchanged; browser signed out; no replacement grant | PASS — Playwright |
| Emergency suspension | Provisioning/reset/change administration unavailable | PASS — Edge/unit/Playwright contracts |
| Runtime state | No automatic transition | PASS — database and contract proof |

See `patch83u-test-results.md` for exact commands and observed results when validation completes.

## Remaining staging-only steps

Nothing in this section has been executed. Supabase CLI `2.107.0` help was inspected locally to confirm the command forms.

From the reviewed repository root, an authorized staging operator must:

```powershell
npx --no-install supabase link --project-ref zghsgzrdwbqdrpuxanac
$linkedProjectRef = (Get-Content supabase/.temp/project-ref -Raw).Trim()
if ($linkedProjectRef -ne 'zghsgzrdwbqdrpuxanac') {
  throw "Refusing non-staging project: $linkedProjectRef"
}
npx --no-install supabase migration list --linked
npx --no-install supabase db push --linked --dry-run
```

Stop unless the linked project is exactly `zghsgzrdwbqdrpuxanac`, the migration list confirms `176_patch83u_last_super_admin_recovery.sql` is already applied, and the dry run lists only the reviewed pending `177_patch83u_explicit_password_finalizer_rpc_name.sql` migration. Do not replay migration 176.

If and only if separately authorized:

```powershell
npx --no-install supabase db push --linked
npx --no-install supabase functions deploy privileged-action --project-ref zghsgzrdwbqdrpuxanac --use-api
```

After authorized migration-177 application, confirm the final catalog name is exactly `patch83u_finalize_password_change_after_revocation`, re-prove zero sessions, and invoke the exact recovery once through the protected service-role RPC wrapper; do not route it through the browser or Edge. Deploy only the matching `privileged-action` Edge correction to staging, keep runtime `emergency_suspended`, prove every browser/Edge mutation remains blocked, inspect browser network/console and Edge/Auth/database evidence, prove the browser is signed out and session count is zero, and verify the two no-touch records are unchanged. Exercise the corrected forced-change flow only in local/disposable tests or a later separately authorized enforced runtime; it is intentionally unavailable during this emergency. Returning to `prepared` or `enforced` is a separate audited decision and is not part of this remediation.
