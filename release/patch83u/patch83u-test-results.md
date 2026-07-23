# Patch 83U — Validation Evidence

Remediation review opened: 2026-07-17 (Asia/Riyadh)

## Migration 177 explicit finalizer RPC-name correction

Migration 176 is a supplied applied-staging fact and remains unchanged in the repository at SHA-256 `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`. The current uncommitted tree adds forward-only `177_patch83u_explicit_password_finalizer_rpc_name.sql` at SHA-256 `22B3FD74254E4532E04187DA2303FC2FF4EAD95EAC06296827F76156B77315F0` and changes the Edge call to the final stable 50-byte RPC name `patch83u_finalize_password_change_after_revocation`. Migration 177 has not been applied to staging and the matching Edge correction has not been deployed.

PostgreSQL truncated migration 176's intended 67-byte unquoted identifier to the 63-byte catalog name `patch83u_finalize_required_password_change_after_session_revoca`. Migration 177 renames that exact object in place and reasserts its safe `search_path` and service-role-only execute contract. The historical migration-176 validation below exercised SQL/catalog resolution but did not exercise an exact PostgREST RPC lookup by the intended 67-byte API string, so it did not detect this compatibility defect.

| Required migration-177 validation | Current result |
| --- | --- |
| Migration 176 checksum/no-diff guard | PASS. SHA-256 is still `E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC`. |
| Deterministic Auth-surface replay through migration 177 | PASS. `node scripts/patch83u-auth-surface-proof.mjs` reported zero direct browser RPCs, zero unsafe surfaces, zero findings, authenticated Edge search transport, reviewed migration ceiling 177, and three explicitly inventoried restricted migration-176/177 routines including the stable finalizer. |
| Focused Auth-surface proof unit contract | PASS. `npx --no-install vitest run tests/unit/patch83uAuthSurfaceReleaseProof.test.ts` completed 1/1 file and 4/4 tests. |
| Migration 177 isolated PostgreSQL install/rename/postcondition proof | PASS on PostgreSQL 17.6. The checked-in migration preserved function OID `73577`, owner `postgres`, and body hash `md5(prosrc) = e0380df9cd60ab1f08632626248cd6fe`; left zero old-name functions and exactly one 50-byte destination; preserved `SECURITY DEFINER`; set `search_path` exactly to `pg_catalog, public, pg_temp`; retained only owner plus non-grantable `service_role` execution; and retained the explicit comment. The disposable database and dump were deleted and verified absent. |
| Patch 83U SQL/security proof after migration 177 | PASS. `supabase/tests/patch83u_credential_governance_tests.sql` completed `BEGIN`, all three `DO` blocks, and `ROLLBACK`; `supabase/tests/patch83tu_release_preflight.sql` passed inside a read-only transaction. Runtime remained `disabled`, and the disposable clone contained no Auth user, Employee ID `11111`, or provisioning row. |
| Exact RPC-name and Edge contract tests | PASS. The focused two-file Vitest run completed 10/10 tests. The final name is exactly 50 UTF-8 bytes; the Edge calls only that name; runtime source contains neither the 67-byte intended identifier nor the 63-byte hosted truncation; migration 176's recorded checksum is enforced; and migration 177's rename/ACL/catalog contract is covered. |
| `npm run typecheck` | PASS. TypeScript completed with no errors. |
| `npm run test:unit` | PASS. 19/19 files and 294/294 tests. The repository-wide Auth-surface scan has a scoped 15-second test budget; runtime code is unchanged by that test-only adjustment. |
| `npx --no-install deno check --no-config --no-lock supabase/functions/privileged-action/index.ts` | PASS. The Edge entry point type-checked and no lockfile was created. |
| Relevant Playwright regression | PASS. 37/37 Chromium tests with one worker: Patch 83U 24/24, Patch 83T 10/10, and Patch 83S 3/3. |
| `npm run build` | PASS. TypeScript and Vite 8.0.16 completed; 2,003 modules transformed. The existing `vendor-excel` chunk-size advisory remains non-blocking. |
| `npm run validate:security` | PASS. Zero frontend direct RPCs, zero broad Security Definer execute grants, zero frontend calls to service-role-only RPCs, and zero missing bridge plans. Current v700 evidence was regenerated. |
| Migration/security/proof and workspace hygiene | PASS. `npm run verify:migrations` found 132 files with migration 177 last. `npm run patch83u:auth-surface` reported zero direct browser RPCs, zero unsafe surfaces, zero findings, and reviewed migration ceiling 177. `git diff --check` passed and the Git index remained empty. |
| Staging migration-177 application, corrected Edge deployment, catalog-name proof, recovery, and hosted forced-change proof | NOT RUN. Requires separate staging authorization; production remains out of scope. |

## Historical migration 176 remediation validation

The results in this section were observed against the settled migration-176 local remediation tree on 2026-07-17, before migration 177 and the exact stable RPC-name correction. They are preserved as historical local/disposable evidence and are not the current migration-177 validation result.

| Required remediation validation | Current result |
| --- | --- |
| Migration 173/174/175 checksum/no-diff guard | PASS. SHA-256 remained `04CBE12E6226AFF4EB3411512A6B2D0751B053D9EC04AFB6B9AD3A15A04BA2A3`, `716E3A34FFC303B228D0707E2144A4056D85D83AFD0F7013FD9C743184751855`, and `7A83E3FCDF200BFC0027882667C82015F4FE448257FA5E69FF34D339ED5CD1F4` throughout this remediation. |
| Migration 176 SQL grammar and PL/pgSQL body validation | PASS. The exact migration installed successfully on PostgreSQL 17.6 in an isolated disposable database; both public entry points resolved, the atomic finalizer was executable by `service_role` and not by `authenticated`, and runtime remained `disabled`. |
| Patch 83U database/security tests, including the designated self-recovery success case and every negative predicate | PASS. `supabase/tests/patch83u_credential_governance_tests.sql` completed all three rollback-only proof blocks and ended with `ROLLBACK`; the read-only Patch 83T/U release preflight also executed successfully. |
| Ordinary `patch83u_require_super_admin` unchanged regression | PASS. Database catalog/body proof plus focused static review confirmed the original guard remains in the owner-only standard reconciliation implementation and is not used as the exceptional authorization branch. |
| Required-password session proof: no post-revocation sign-in, atomic locked zero-session finalization before `active`, ambiguous revocation remains review, post-revocation policy rejection signs out safely | PASS locally. Database proof, unit contracts, independent review, and browser cases all passed; no hosted Auth claim is made. |
| `npm run typecheck` | PASS. TypeScript completed with no errors. |
| `npm run test:unit` | PASS. 19/19 files and 293/293 tests. The two intentionally heavy Excel tests have explicit 15-second budgets; product workbook code is unchanged by that adjustment. |
| `npx --no-install deno check --no-config --no-lock supabase/functions/privileged-action/index.ts` | PASS. The Edge entry point type-checked and no lockfile was created. |
| Relevant Patch 83U Playwright suites | PASS. 24/24 Chromium tests across existing-user rotation, credential provisioning, deployment compatibility, and login/CAPTCHA gates. |
| Patch 83T User Import regression suites | PASS. 10/10 Chromium tests across the full import workflow and deployment compatibility, including exact execution payload/database proof and no preview write. |
| Patch 83S Department Import regression suite | PASS. 3/3 Chromium tests, including the selected 27-row workbook revalidation path. |
| `npm run build` | PASS. Vite 8.0.16 transformed 2,003 modules. The existing `vendor-excel` chunk-size advisory remains non-blocking. |
| `npm run validate:security` | PASS. Zero frontend direct RPCs, zero broad Security Definer execute grants, zero frontend calls to service-role-only RPCs, and zero missing bridge plans. Current v700 evidence was regenerated. |
| `npm run patch83u:auth-surface` | PASS. Zero direct browser RPCs, zero unsafe surfaces, zero findings, authenticated Edge search transport, and reviewed migration ceiling 176. |
| Existing proof/security suites and `git diff --check` | PASS. Migration filename verification found 131 files with migration 176 last; focused migration/static contracts passed 44/44, independent security contracts passed 40/40, and `git diff --check` found no whitespace error. The index remained empty. |

Those local validation commands did not apply a migration to the repository's running local Supabase database, staging, or production; migration execution was limited to the isolated disposable validation database. Supplied evidence now records migration 176 as already applied to staging outside that local validation run. No migration-177 application, corrected Edge deployment, new runtime transition, provisioning action, hosted credential action, or production action was executed by the current remediation. The supplied staging evidence is recorded in `patch83u-hosted-remediation-proof.md`; it proves the hosted defect and migration-176 state, not the corrected migration-177 flow.

The disposable database was cloned from the running local Supabase database and never used a reset. The repository's full historical chain is not clean-install proof: unrelated pre-existing migrations 57, 76, 77, and 105 required disposable-only compatibility scaffolding, and migration 87 contains a separate invalid `GET DIAGNOSTICS` assignment. None of those migration files was edited. Patch 83T/U migrations 172–176 and the Patch 83U rollback proof did execute successfully after the required schema prerequisites were present.

## Historical 2026-07-16 integrated baseline

The results below were captured from the then-settled uncommitted `patch83t-controlled-user-excel-import` worktree before migration 176 remediation. Nothing in that baseline run targeted hosted Supabase, hosted Auth, Vercel, production, or a deployed Edge Function. Migrations 173/174 and both rollback-only SQL proof files were parsed but not applied or executed against a database.

### Baseline validation

| Validation | Settled-tree result |
| --- | --- |
| `npm run typecheck` | PASS. TypeScript completed with no errors. |
| `npm run test:unit` | PASS. 15/15 files and 239/239 tests. The final rerun followed the exact lifecycle-drift assertion correction. |
| `npx playwright test tests/e2e/patch83u-existing-user-password-rotation.spec.ts --workers=1` | PASS. 4/4 Chromium tests. |
| `npx playwright test tests/e2e/patch83u-deployment-compatibility.spec.ts --workers=1` | PASS. 7/7 Chromium tests. |
| `npx playwright test tests/e2e/patch83u-credential-provisioning.spec.ts --workers=1` | PASS. 5/5 Chromium tests. |
| `npx playwright test tests/e2e/patch83u-login-captcha-release-gate.spec.ts --workers=1` | PASS. 7/7 Chromium tests. |
| `npx playwright test tests/e2e/patch83t-user-excel-import.spec.ts --workers=1` | PASS. 5/5 Chromium tests. |
| `npx playwright test tests/e2e/patch83s-department-excel-import.spec.ts --workers=1` | PASS. 3/3 Chromium tests. |
| Combined six-spec Playwright check | PASS. 31/31 tests with one worker. This extra aggregate run preceded the six exact-command reruns. |
| `npm run build` | PASS. Vite 8.0.16 transformed 2,001 modules. The only advisory was the existing `vendor-excel` chunk at 929.91 kB, above the 650 kB warning threshold. |
| `npm run validate:security` | PASS. Runtime security bridge audit reported zero frontend direct RPCs, zero broad Security Definer execute grants, zero browser calls to service-role-only RPCs, and zero missing bridge plans. The five timestamped v700 reports were restored afterward. |
| `npx --yes deno check --no-config --no-lock supabase/functions/privileged-action/index.ts` | PASS. The Edge entry point type-checked without creating a lockfile. |
| `npm run patch83u:auth-surface` | PASS. Zero direct browser RPCs, zero unsafe surfaces, zero findings, authenticated Edge search transport, credential-gate target present, and caller-JWT forwarding proof retained in the reviewed inventory. |
| PostgreSQL/PL/pgSQL grammar proof | PASS as local grammar evidence only. PostgreSQL 16 raw parser: migration 173 = 25 statements, migration 174 = 189, credential rollback proof = 4, release preflight = 42. PL/pgSQL: migration 173 = 3/3 bodies and credential rollback proof = 2/2 bodies without substitution; migration 174 = 56/56 bodies after three in-memory masks limited to catalog-dependent `%rowtype` field assignments. This is not catalog installation or live execution proof. |
| Read-only preflight/governance and feature-flag contracts | PASS within the 239 unit tests. Exact feature enablement accepts only lowercase string `true`; false/missing/blank/`TRUE`/`1`/`yes`/`enabled` make no Patch 83U credential call. |
| Conflict, secret/log, migration 172, diff/index, and artifact hygiene checks | PASS. No anchored conflict marker, forbidden password/token logging/storage pattern, migration 172 difference, staged entry, `deno.lock`, v700 change, or Playwright result noise remained. `git diff --check` reported no whitespace error. |

## Covered local behavior

The current local browser/contract work is intended to prove these code paths without claiming hosted effects:

- `signInWithPassword` completes with a matching session before capability or credential lookup;
- capability lookup precedes credential state, and profile/roles/data do not load for password-change, reconciliation, access-denied, or deployment-incompatible outcomes;
- invalid credentials remain generic Auth failures while a post-Auth deployment mismatch remains an authenticated closed screen;
- auth generations, event epochs, aborts, single-flight lookups, focus/visibility rechecks, and cross-tab invalidation prevent late sign-in/lookup/unmount responses or a prior user's profile/roles from reopening access;
- runtime disabled/prepared preserves stable existing access, while provisioning/reset/password-transition availability is limited to enforced state;
- contract mismatch prevents enforcement and cached/incompatible frontend behavior fails closed at the modeled data boundary;
- existing full-email login, Employee-ID mapping, leading zero preservation, and existing-password rotation are retained;
- the existing/last Super Admin completes required change without role deletion/duplication or another administrator's approval;
- forced change requires re-entered current password, matching new confirmation, and CAPTCHA when required; wrong current password causes no mutation;
- successful change closes the old session and requires a fresh login; old-password/new-password behavior is modeled by the controlled test server;
- partial Auth/database/revocation outcomes produce retry, recovery, or session-review states and same-request replay is idempotent;
- reset requires exact user/Employee ID, matching temporary confirmation, a mandatory reason containing no exact temporary-password value, exact UI/backend phrases, strict global role/scope, organization, non-self, and last-admin checks;
- reset proof uses exact Auth Admin success plus Auth ID/email/version read-back, never a target password sign-in, and reaches ordinary success only after read-only zero-session proof;
- reset/provisioning make access ineffective by credential state while preserving canonical role/profile lifecycle rows;
- provisioning is denied before enforcement and requires exact protected proof after enforcement;
- lifecycle actions use the actor-bound service RPC, never mutate an open provisioning record, deactivate and audit roles on block, restore no roles on activation, and reject active-role drift with an exact rollback-only zero-write proof;
- the controlled first-password activation marker preserves the terminal active credential state and cannot cause a second forced-change loop;
- authenticated global search forwards the caller bearer and exact frontend contract header through its Edge-to-Edge hop;
- CAPTCHA exact-true, missing-key/provider/token/expiry/reset/accepted-token behavior remains fail closed; and
- Patch 83T workbook generation/parser/text preservation/validation/preview/export/User Management behavior and Patch 83S Department Import regressions remain covered by their dedicated suites.

## Required hosted proof

Local type, unit, static, Deno, build, and Playwright results cannot prove:

- migration 177 application, the exact stable finalizer name in the staging catalog, or the designated last-Super-Admin recovery predicates after that correction;
- corrected hosted session revocation, zero-session proof, absence of a post-revocation replacement session, or the final signed-out browser state;
- migration-177 application or any new live runtime transition;
- real existing-password authentication after backfill;
- target hosted password policy, including Employee ID `11111`;
- Turnstile/Supabase CAPTCHA acceptance and secret configuration;
- Auth Admin password/app-metadata mutation;
- global sign-out, session-row timing, single-session effects, or stale-JWT denial;
- live RLS/storage/REST/Edge contract-header behavior;
- compatibility attestation/enforcement races under real concurrency;
- induced recovery/reconciliation and same-request replay against hosted Auth;
- Vercel environment, deploy alias, HTML/cache headers, CDN/service-worker behavior, or intentionally stale-client denial; or
- absence of password/token material in hosted logs/audit/data.

Those checks require explicit authorization and a disposable or controlled release environment. No corrected migration-177 flow or production proof is claimed here.
