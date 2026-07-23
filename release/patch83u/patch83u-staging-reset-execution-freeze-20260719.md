# Patch 83U staging reset execution freeze — 2026-07-19

## Decision

**READY FOR EXPLICITLY AUTHORIZED HOSTED EXECUTION**

This is a preparation/readiness decision only. It does not authorize `--execute-hosted-proof`, a login, reset, password change, token replay, database mutation, deployment, or migration.

## Frozen target and repository

- Allowed Supabase project: `zghsgzrdwbqdrpuxanac`
- Prohibited production project: `zbrjjecpsrzposhuarcn`
- Application target: `http://localhost:5173`
- Vite mode: `staging`
- Branch: `patch83t-controlled-user-excel-import`
- HEAD: `a9989b1e8d95a6bb775316a2d9e709ef84514c42`
- Staged files: `0`
- Frozen material files: `57`
- Frozen material bytes: `2,172,868`
- Aggregate SHA-256: `0a73e468fb11c148a1e13c4e42798d11ed993471c6bb30c21b30d5d65cdab1da`

The aggregate is SHA-256 over UTF-8 lines sorted by path using ordinal Unicode code-unit order in the form `path<TAB>sha256<TAB>bytes`, joined with LF and no trailing LF. The complete per-file inventory is in `patch83u-staging-reset-execution-freeze-20260719.json`.

Key execution hashes:

| File | SHA-256 | Bytes |
|---|---|---:|
| `scripts/patch83u-staging-multisession-reset-proof.mjs` | `7f670f2c7b53a54a86061b6d221bb5a6f5c361d52fd9c8a24aea379e1503ad15` | 69,953 |
| `scripts/patch83u-staging-sql-editor-evidence.sql` | `404c977560eee05af490f1a1e70afa6d140d0330781d3283a9f5ac5191987769` | 43,911 |
| `release/patch83u/patch83u-staging-reset-harness-schema.json` | `6c81c0be309c38930cc4b6657adf8a38db15cd71c265d8b412732b26a851aaf3` | 14,380 |
| `tests/unit/patch83uStagingMultisessionResetProof.test.ts` | `b3c97461debc139091041cf305ee439fc83b26adce422a80f61900f3aae36d1f` | 31,214 |
| `supabase/functions/privileged-action/index.ts` | `f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87` | 157,176 |

The ignored `.env.staging.local` was not hashed, copied, or included. The startup guard derived the staging project, a public browser key was present, and no key value was displayed.

## Approved read-only evidence channel

The manually operated staging Supabase SQL Editor is the approved evidence channel. `pg_service` remains prepared but not connection-validated and is not classified as ready. It is not required while the SQL Editor can provide every safe checkpoint.

The exact query pack is `scripts/patch83u-staging-sql-editor-evidence.sql`. Every block:

- begins with `BEGIN READ ONLY;`;
- emits one safe JSON cell;
- returns only states, versions, role/scope, counts, booleans, timestamps, UUIDs, catalog predicates, and deterministic request-ID hashes;
- returns no raw request ID, token, session ID, email, phone, password, Auth metadata, cookie, authorization header, or connection value;
- ends with `ROLLBACK;`.

The harness requires a hidden exact staging-project confirmation before accepting each result. PostgreSQL does not falsely claim to derive the Dashboard project reference. A result older than five minutes, more than 30 seconds in the future, mislabeled, out of sequence, non-read-only, secret-bearing, production-linked, or from an unconfirmed project is rejected.

### Exact operator sequence

Select and run only the named block requested by the harness; never run the whole query pack.

1. `before_employee_sessions`
   - Before any credential prompt or browser login.
   - Proves runtime `174.2-auth-first / enforced / 5`, exact contracts, migrations `174/176/177`, the finalizer and recovery catalog contract, target `active / 2`, target `employee / assigned_only`, same organization, no pending operation, and the designated administrator `active / 1 / super_admin / global`.
2. `immediately_before_reset`
   - After two isolated employee sessions refresh successfully, the original and secondary administrator contexts are identity-bound, Admin navigation is denied to the employee, and the reset modal is filled.
   - Must still prove the initial state plus at least two database sessions and two unrevoked refresh rows.
3. `immediately_after_reset`
   - Must prove `admin_reset_change_required`, database/Auth version `3`, zero sessions, zero unrevoked refresh rows, unchanged role/scope/lifecycle, no pending operation, and reset event/operation SHA-256 correlation to the one observed UI request.
4. `before_required_password_change`
   - After the temporary-password login proves the Forced Password Change-only gate.
   - Must prove state/version `admin_reset_change_required / 3`, unchanged authorization and lifecycle, no pending operation, and at least one current temporary-login session/refresh row. Zero sessions are not expected at this point; the real protected password-change action revokes this disposable session before finalization.
5. `immediately_after_password_change_finalization`
   - Must prove `active`, database/Auth version `4`, zero sessions, zero unrevoked refresh rows, unchanged role/scope/lifecycle, no pending operation, and password-change event/operation SHA-256 correlation.
6. `after_fresh_employee_login`
   - Must prove `active / 4`, `employee / assigned_only`, at least one fresh session and refresh row, with direct Admin navigation denied by the browser proof.

Any project, runtime, catalog, designated-administrator, role/scope, organization, lifecycle, version, pending-operation, session-count, audit-correlation, or chronology mismatch is an abort condition. The harness does not call an abort or reconciliation RPC and never automatically resubmits an ambiguous credential action.

## Hosted contract and Edge attestation

Operator-confirmed staging SQL Editor evidence records:

- runtime schema `174.2-auth-first`;
- enforcement `enforced`, state version `5`;
- Edge contract `patch83u-edge-auth-first-v1`;
- frontend contract `patch83u-frontend-auth-first-v1`;
- migrations `174`, `176`, `177`;
- `patch83u_finalize_password_change_after_revocation`, 50 bytes, `SECURITY DEFINER`, with execution denied to `authenticated`, `anon`, and `PUBLIC`, and available to `service_role`.

The active `privileged-action` metadata remains version `3`, `ACTIVE`, `verify_jwt=true`, hosted `ezbr_sha256=7fee99f2d77590f48026ddb0aaec5d540403d7c85fda462aece5154492852762`.

The downloaded hosted `index.ts` and current repository `index.ts` remain byte-identical at SHA-256 `f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87`. Complete deployed-bundle/dependency binding and the meaning of `ezbr_sha256` are not cryptographically proven.

## Migration source lineage

Exact equality between current local migrations 173–177 and the SQL statements historically applied to staging remains unproven. Migration-history rows prove versions, not source bytes. This remains a **high provenance/reproducibility risk**, explicitly classified as non-mutating historical source drift.

Current hashes:

| Migration | SHA-256 | Bytes | Git |
|---|---|---:|---|
| 173 | `04cbe12e6226aff4eb3411512a6b2d0751b053d9ec04afb6b9ad3a15a04ba2a3` | 80,826 | modified, tracked |
| 174 | `716e3a34ffc303b228d0707e2144a4056d85d83afd0f7013fd9c743184751855` | 276,188 | modified, tracked |
| 175 | `7a83e3fcdf200bfc0027882667c82015f4fe448257fa5e69ff34d339ed5cd1f4` | 994 | untracked |
| 176 | `e221c1c3ded23499d2ac69f33f4869a193ab333dc429719f190708cd142172bc` | 25,166 | untracked |
| 177 | `22b3fd74254e4532e04187da2303fc2ff4ead95eac06296827f76156b77315f0` | 6,628 | untracked |

This risk is not silently waived. The reset boundary remains fail-closed behind fresh hosted catalog checks for the exact finalizer signature, routine kind, unique destination, absence of old/truncated names, restricted search path and execute ACLs, plus the owner-only recovery implementation.

## Sole-Super-Admin safety gate

The later reset cannot cross the boundary unless all of these are freshly true:

- runtime-designated Super Admin is exactly `83d92a59-6909-44e7-80f3-aff60a6734fb`;
- profile and credential state/version are `active / 1`;
- role/scope are exactly `super_admin / global`;
- there is exactly one eligible Super Admin in the designated organization;
- there is no pending administrator operation;
- the administrator is not the reset target;
- the original administrator context remains available;
- a secondary isolated administrator context reauthenticates to the same UUID;
- runtime remains enforced and the emergency recovery wrapper/implementation contract remains available.

The sole eligible Super Admin must never be used as the reset/revocation target.

## Local validation

- Harness syntax: passed.
- Inert harness invocation: passed; printed the non-execution notice and made no hosted call.
- Focused Vitest: **5 files, 76 tests passed**.
- Clean-session Playwright: **3/3 passed** in a new nonpersistent browser; Login remained visible after reload, production legacy storage was not imported, and stale signed-out profile state was cleared.
- Staging startup guard: passed with only `Verified staging Supabase project: zghsgzrdwbqdrpuxanac`.
- Local HTTP smoke: `200`.
- TypeScript: passed.
- Production build: passed; the existing large-chunk advisory remained non-fatal.
- Harness schema parse: passed.
- SQL Editor static safety check: passed, six read-only/rollback blocks and no mutation.
- `git diff --check`: passed.

No credential was entered. No hosted login, reset, password change, refresh-token replay, PostgreSQL connection, deployment, migration, staging mutation, production access, staging, commit, or push occurred during this freeze refresh.

## Remaining conditions, not current preparation blockers

- A separately authorized execution window is still required.
- Every fresh SQL Editor and browser gate must pass at execution time.
- `pg_service` remains unvalidated and must not be described as ready.
- Migration source-byte lineage and complete Edge bundle binding remain unproven as documented above.
