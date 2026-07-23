# Patch 83U staging reset execution freeze — 2026-07-18

## Decision

**NOT READY FOR HOSTED EXECUTION**

This is an execution freeze, not authorization. No hosted workflow was run. Two independent blockers remain:

1. No approved staging application origin is resolved. The active local `.env` resolves to the prohibited production project `zbrjjecpsrzposhuarcn`; its URL and keys were not recorded.
2. No operator-approved, non-secret staging `pg_service` definition is available for the read-only SQL evidence channel.

The harness now fails closed before credentials are entered unless the loaded frontend bundle proves the staging project and exact origin. The freeze must be regenerated after both blockers are resolved.

## Repository and toolchain

| Field | Frozen value |
|---|---|
| Branch | `patch83t-controlled-user-excel-import` |
| HEAD | `a9989b1e8d95a6bb775316a2d9e709ef84514c42` |
| Working tree | Dirty: 111 entries after these two manifests; 62 modified, 49 untracked |
| Staged files | `0` |
| Node | `v24.12.0` |
| npm | `11.17.0` |
| Playwright | `1.61.0` |
| Supabase CLI | `2.72.7` |
| OS | `Microsoft Windows NT 10.0.26200.0` |
| Capture time | `2026-07-18T17:05:32.0359485Z` |
| Staging ref | `zghsgzrdwbqdrpuxanac` |
| Prohibited production ref | `zbrjjecpsrzposhuarcn` |

Expected hosted contract: runtime `enforced`, state version `5` (or a deliberately reviewed newer version), Edge `patch83u-edge-auth-first-v1`, frontend `patch83u-frontend-auth-first-v1`, migrations `174`, `176`, and `177`, and stable finalizer `patch83u_finalize_password_change_after_revocation`.

## Migration 173–177 lineage

| Migration | Current SHA-256 | Bytes | Git | At HEAD | Applied-source equality |
|---|---|---:|---|---|---|
| 173 | `04cbe12e6226aff4eb3411512a6b2d0751b053d9ec04afb6b9ad3a15a04ba2a3` | 80,826 | ` M` | Yes | Not proven |
| 174 | `716e3a34ffc303b228d0707e2144a4056d85d83afd0f7013fd9c743184751855` | 276,188 | ` M` | Yes | Not proven |
| 175 | `7a83e3fcdf200bfc0027882667c82015f4fe448257fa5e69ff34d339ed5cd1f4` | 994 | `??` | No | Not proven |
| 176 | `e221c1c3ded23499d2ac69f33f4869a193ab333dc429719f190708cd142172bc` | 25,166 | `??` | No | Not proven |
| 177 | `22b3fd74254e4532e04187da2303fc2ff4ead95eac06296827f76156b77315f0` | 6,628 | `??` | No | Not proven |

Migration-history rows establish version presence, not source-content equality. The historical `patch83tu-staging-db-push.txt` records successful application of 173 and 174, and the current local file timestamps predate that recorded push. Later release evidence records the current hashes for 173–177. This is useful chronological evidence, but the push output contains no source hash and no cryptographically bound applied-source copy was found.

Historical review archives contain older exact copies that do not match the current files:

| Archive | Migration | SHA-256 | Bytes |
|---|---:|---|---:|
| `patch83t-review.zip` | 173 | `3b072a00f8ac8df0577c40c1e206cd6becbb7f9b41a72b0f500ccb1f5c118544` | 29,576 |
| `patch83tu-final-review.zip` | 173 | `a58af92ba609e5a6c0180440ecf22991774650555f34e35e98203d4a92a3ff49` | 39,390 |
| `patch83tu-final-review.zip` | 174 | `5bde79e53be699496d804ecee3de1bf409efdc01f513742883c5c9bf433b52ed` | 117,457 |

The source-lineage conclusion is therefore: **exact equality between the current local 173–177 files and the statements applied to staging cannot be proven**. This is high provenance/reproducibility risk. It may be treated only as explicitly documented, non-mutating historical drift after fresh hosted catalog behavior and security predicates are independently verified. It must not be silently ignored.

### Migration 173 exact diff classification

HEAD is 61,228 bytes at `977af984dede015475f1116970f4f65b662907cccfe9fef06f460a67544e209f`. The current diff is 453 insertions and 43 deletions; with all whitespace ignored it remains 451 insertions and 41 deletions. It is substantive, not formatting or line-ending-only.

| Changed section | Classification | Basis |
|---|---|---|
| Null-safe service-role validation in identity-reference and import paths | Later corrective content | Fail-closed service-role verification added after the original import body. |
| Runtime-control locking and Patch 83U-aware Super Admin eligibility inside `patch83t_apply_user_excel_import` | Later corrective content | Integrates Patch 83T execution with Patch 83U runtime/last-admin controls. |
| Auth/identity locking, projected replacement eligibility, and concurrency postconditions | Later corrective content | Strict identity and last-Super-Admin hardening. |
| Batch/application payload consistency changes | Known Patch 83T/83U implementation content | Maintains the real controlled import execution and proof payload. |
| Protected provisioning payload, role audit, controlled role assignment/reactivation, and strict postconditions | Known implementation plus later corrective content | Matches the tested protected provisioning and canonical role/lifecycle release work. |
| `patch83t_get_user_import_capabilities` RPC and deployment-compatibility behavior | Later corrective content | Matches the documented deployment compatibility correction. |
| Formatting/line-ending-only sections | None | Whitespace-ignored diff remains substantive. |
| Unexplained sections | None identified | Every thematic hunk maps to Patch 83T/83U implementation or documented corrections; hosted byte equality is nevertheless unproven. |

### Migration 174 exact diff classification

HEAD is 182,738 bytes at `2da606dec31d112057530fb13f3781a945762fec3ff8ff11f76a674b569c26d5`. The current diff is 3,105 insertions and 907 deletions; with all whitespace ignored it remains 3,080 insertions and 882 deletions. It is substantive, not formatting or line-ending-only.

| Changed section | Classification | Basis |
|---|---|---|
| Runtime-control/events tables, credential state/operation/audit structures, ACLs, and comments | Known Patch 83U implementation content | Core runtime and credential-governance model. |
| Null-safe service-role helper and expanded runtime/role/scope/activation helpers | Later corrective content | Fail-closed and canonical lifecycle/scope hardening. |
| Admin-reset begin, revocation, finalization, abort-state handling, and provisioning finalizers | Later corrective content | Auth-first, idempotency, zero-session, and terminal-state correction. |
| Protected provisioning claim/finalize/reconcile paths | Known implementation plus later corrective content | Protected records and reconciliation behavior. |
| Expected Auth email, strict administrator guards, role assignment/removal, and lifecycle transitions | Later corrective content | Employee-ID Auth identity and strict canonical role/scope enforcement. |
| Safe-failure, append-only audit triggers, profile/role/last-admin guards, credential lifecycle, RLS/access helpers and policies | Later corrective content | Security and fail-closed hardening. |
| Role-preservation/no-op suspension behavior and protected backfills | Later corrective content | Canonical lifecycle correction preserving live roles. |
| Credential-state/capability proof RPCs | Later corrective content | Server-verified readiness and UI compatibility proof. |
| Required-password-change prepare/begin/finalize/audit/abort/event flows | Later corrective content | Auth-first zero-session/version/session-review correction. |
| Documentation and contract comments | Known implementation documentation | Describes the corresponding reviewed controls; not standalone formatting. |
| Formatting/line-ending-only sections | None | Whitespace-ignored diff remains substantive. |
| Unexplained sections | None identified | Every thematic hunk maps to Patch 83U implementation or documented corrections; hosted byte equality is nevertheless unproven. |

## Application target resolution

No dedicated hosted staging frontend origin or Vercel project link was found. `package.json` uses the normal Vite development server, making `http://localhost:5173` the local candidate. Local Supabase config allows localhost/127.0.0.1 redirects, but that does not prove the hosted Auth allowlist.

The active local `.env` was inspected without printing keys or URLs. Its derived project reference is the prohibited production ref. Therefore:

- Approved application origin: unresolved.
- Local/hosted: neither approved; the local candidate is refused.
- Derived project ref for the local candidate: production, refused.
- Hosted Auth origin allowlist: not verified.
- CAPTCHA: the frontend supports Turnstile when configured; hosted settings were not verified, so manual interaction may be required.
- Source match: local Vite would use the frozen source, but its current backend target is prohibited.

Abort any later run until a staging-only origin and bundle project reference are independently proved. The harness now downloads and scans same-origin frontend scripts before filling any credential field, and refuses a production or unproved bundle.

## Read-only evidence mechanism

The intended mechanism is:

```text
psql service=<operator-approved-staging-service>
```

The harness rejects `PGPASSWORD`, `DATABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; runs `\conninfo`; requires the staging project reference in the verified connection metadata; then executes `scripts/patch83u-staging-reset-evidence.sql`.

The SQL begins `BEGIN READ ONLY`, selects only safe states, versions, counts, booleans, roles/scopes and timestamps, and ends with explicit `ROLLBACK`. It does not select token strings, password data, authorization headers, cookies, or Auth session IDs.

No approved `pg_service.conf`, `PGSERVICEFILE`, or `PGSERVICE` value was found. The mechanism is therefore **not ready**. No connection was opened and no credential was requested.

## Harness static integrity

Concrete safety defects were reported before correction and then fixed locally:

1. Loaded frontend staging attestation now happens before any credential field is filled.
2. The administrator gate now requires exact active/version `1`, no pending operation, a still-available original administrator context, a separately reauthenticated administrator context, target/admin inequality, and fresh catalog proof of the emergency recovery wrapper/implementation security contract.
3. Both controlled employee refresh values must successfully refresh before reset; rotated values replace the originals in memory.
4. Employee direct Admin navigation must be denied before reset.

Static controls:

- `--execute-hosted-proof` is required; inert mode returns before `runHostedProof` (`scripts/patch83u-staging-multisession-reset-proof.mjs:501`, `:518`, `:1197`).
- Recursive production refusal and browser routing guards are enforced (`:69-96`, `:571-647`, `:732-758`).
- Password/token/cookie/header arguments are refused and credentials use hidden TTY prompts (`:31-40`, `:244`, `:494`, `:783-788`).
- `ResetSubmissionController` permits one submission and permanently locks ambiguous results (`:457-489`, `:975-985`).
- Refresh values are wrapped in memory-only `SecretValue` objects, rotated in memory, and cleared in `finally` (`:652-727`, `:885-895`, `:1188`).
- Recursive evidence key/value checks and JSON Schema validation reject secrets (`:40-138`, `:213`, `:842`).
- HAR, video, trace, storage-state export, automatic screenshots and verbose network logging are disabled (`:22-29`, `:853-858`).
- Browser contexts are nonpersistent (`:732-758`).
- Reset and required password change use the real User Management and Forced Password Change UI (`:949-980`, `:1084-1117`) for actions `patch83u_admin_reset_password` and `patch83u_change_required_password`.
- Read-only database evidence is required before browser setup, before reset, after reset, and after password change (`:850`, `:911`, `:997`, `:1118`).
- Runtime, contract, migration, finalizer, recovery, identity, role/scope, lifecycle, version, pending-operation, admin-context, session, refresh, and route-denial drift block execution (`:309-374`).
- Runtime source calls no abort or reconciliation RPC automatically. Protected recovery remains operator-only.

No remaining static harness safety defect was found after these corrections. Readiness remains blocked by target/evidence-channel resolution, not by permission to execute.

## Sole-Super-Admin operator gate

Do not cross the reset boundary unless every predicate is freshly true:

1. Administrator UUID is exactly `83d92a59-6909-44e7-80f3-aff60a6734fb` and differs from target `2a276bdb-cf51-4303-846e-6b7fecf38b0c`.
2. Profile and credential state are active; database/Auth credential versions are exactly `1`.
3. Role/scope are exactly `super_admin / global`, with one active role and exactly one eligible Super Admin.
4. No administrator credential operation is pending.
5. An original administrator context remains authenticated and available.
6. A second isolated administrator context reauthenticates.
7. Runtime remains enforced at version `5` or a deliberately reviewed newer version.
8. Hosted catalog proof confirms the restricted service-role reconcile wrapper and owner-only emergency recovery implementation remain available.
9. The operator acknowledges the only eligible Super Admin must never be the reset/revocation target.

No reauthentication was performed in this audit.

## Fresh pre-reset checklist and abort conditions

1. Confirm staging project and approved application origin. Abort on production, unknown project, or origin mismatch.
2. Recompute every frozen hash and size. Abort on any byte difference.
3. Confirm runtime enforced, reviewed state version, and exact contracts. Abort on drift.
4. Confirm migrations 174/176/177 and finalizer/recovery catalog security predicates. Abort on any missing object, ACL, or search path; do not treat version rows as source-byte proof.
5. Confirm the full administrator gate. Abort on any mismatch.
6. Preserve the original administrator context and reauthenticate the secondary isolated context. Abort if either is unavailable.
7. Confirm Employee 11111 is active at database/Auth version `2`. Abort on drift.
8. Confirm exactly `employee / assigned_only`. Abort on drift or role cardinality other than one.
9. Confirm no pending employee operation. Abort on any prepared/in-progress/Auth-changed operation.
10. Establish two isolated employee sessions. Abort if fewer than two authenticate.
11. Confirm database session count is at least two. Abort if lower or unavailable.
12. Prove both controlled refresh values can refresh and retain only rotated values in memory. Abort on either failure or leakage.
13. Confirm direct Admin navigation is denied. Abort on access or ambiguity.
14. Pause for the exact hidden operator confirmation. Abort on any mismatch.
15. Only then permit the single reset submission. Never retry an ambiguous submission or create a replacement request ID.

## Edge source attestation

The existing read-only attestation records `privileged-action` version `3`, `ACTIVE`, `verify_jwt=true`, hosted `ezbr_sha256` `7fee99f2d77590f48026ddb0aaec5d540403d7c85fda462aece5154492852762`, and downloaded hosted `index.ts` SHA-256 `f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87`.

The downloaded entry source is byte-equal to the frozen local `index.ts`. Complete bundle binding is **not proven**: dependency bytes and the exact semantic relationship of `ezbr_sha256` to the complete deployable source were not cryptographically established. See `patch83u-staging-edge-deployment-attestation.json`.

## Frozen execution files

The canonical machine-readable file list, sizes, Git status and SHA-256 values are in `patch83u-staging-reset-execution-freeze-20260718.json`. It includes the harness, read-only SQL, focused unit test, evidence schema, Edge source/config, migrations 173–177, package metadata/lockfile, and the frontend authentication, credential, reset, forced-change, authorization, CAPTCHA, routing and Supabase client sources.

## Local validation

| Command | Result |
|---|---|
| `node --check scripts/patch83u-staging-multisession-reset-proof.mjs` | PASS |
| Freeze JSON and evidence-schema parse | PASS |
| `npm run test:unit -- tests/unit/patch83uStagingMultisessionResetProof.test.ts` | PASS — 1 file, 21/21 tests |
| `npm run typecheck` | PASS |
| `git diff --check` | PASS — existing LF-to-CRLF conversion warnings only; no whitespace error |

The hosted harness command was not run.

## Audit safety confirmation

- Credentials entered: no.
- Login or administrator reauthentication: no.
- Password reset/change or global sign-out: no.
- Refresh-token replay: no.
- Database connection: no.
- Hosted mutation or staging action: no.
- Production access: no.
- Deployment or migration application: no.
- Stage, commit, or push: no.
