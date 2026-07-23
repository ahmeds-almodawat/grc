# Patch 83U staging reset execution freeze v2 — 2026-07-19

## Decision

**READY FOR NEW EXPLICIT HOSTED EXECUTION AUTHORIZATION**

This is a provenance and readiness decision only. The stopped authorization
cannot be reused. A later hosted run requires a new, explicit authorization and
must supply the exact SHA-256 of the v2 JSON freeze.

## Edge version 5 provenance

Classification:
`VERSION 5 SOURCE IDENTICAL TO FROZEN REVIEWED SOURCE`

- Project: `zghsgzrdwbqdrpuxanac`
- Function: `privileged-action`
- Active version: `5`
- Status: `ACTIVE`
- JWT verification: enabled
- Hosted metadata hash:
  `7fee99f2d77590f48026ddb0aaec5d540403d7c85fda462aece5154492852762`
- Updated at: `2026-07-17T22:00:47.5100000Z`
- Downloaded active `index.ts` SHA-256:
  `f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87`
- Reviewed local `index.ts` SHA-256:
  `f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87`
- Both files: `157,176` bytes
- Byte-for-byte equality: passed

The exact cause of the version counter advancing from 3 to 5 is not available
from the supported read-only active-function metadata or repository evidence.
The verified observation is limited to this: the version counter advanced
while the hosted metadata hash and active entry source remained unchanged.

The hosted `ezbr_sha256` is not equal to the raw `index.ts` SHA-256, and its
meaning as a raw-source hash is not proven. This audit proves the raw active
entrypoint equals the reviewed source. It does not cryptographically bind every
dependency, runtime artifact, or gateway setting in the complete deployed
bundle.

## Fail-closed execution binding

The harness previously had no executable Edge version gate; version 3 existed
only as passive evidence metadata. The corrected gate now:

- requires this explicit freeze file and its separately supplied SHA-256;
- rejects a CLI-controlled Edge version override;
- recomputes all frozen file hashes, sizes, total bytes, and the aggregate;
- requires the exact branch, HEAD, dirty-tree counts, and zero staged files;
- cross-binds the provenance schema, classification, project, function,
  version, status, JWT setting, timestamps, hosted hash, raw-source hash, and
  security markers;
- reads active metadata with an exact staging-only Supabase CLI command;
- runs before the first application request and again immediately before reset;
- propagates every Edge predicate into the reset readiness decision;
- reasserts the browser target guard immediately before the reset boundary.

The expected active version comes only from this hash-bound freeze. Version 3,
version 6, an unknown version, source drift, provenance drift, repository drift,
`verify_jwt=false`, an inactive function, or any frozen-file mismatch fails
closed.

## Frozen material

- Branch: `patch83t-controlled-user-excel-import`
- HEAD: `a9989b1e8d95a6bb775316a2d9e709ef84514c42`
- Staged files: `0`
- Frozen files: `58`
- Frozen bytes: `2,209,323`
- Aggregate SHA-256:
  `179a344f1d9b739e4bf973a401c9a8625345c851db3dc216c2817594f8222fd7`
- Freeze JSON SHA-256:
  `f7f4a8bdb8d41e906b2c5b0df47e4014c2cd7d970d8b8ce54ba3776683b77f85`

The aggregate is SHA-256 over UTF-8 lines sorted by path using ordinal Unicode
code-unit order in the form `path<TAB>sha256<TAB>bytes`, joined with LF and no
trailing LF. The full inventory is in the v2 JSON freeze.

The ignored `.env.staging.local` is not copied, hashed, or included.

## Runtime and catalog boundary

Approved manually operated staging SQL Editor evidence captured at
`2026-07-19T10:20:24.936Z`, after the Edge update timestamp, records:

- runtime `174.2-auth-first / enforced / 5`;
- Edge contract `patch83u-edge-auth-first-v1`;
- frontend contract `patch83u-frontend-auth-first-v1`;
- migrations `174`, `176`, and `177`;
- stable finalizer
  `patch83u_finalize_password_change_after_revocation`;
- `SECURITY DEFINER` and service-role-only execution.

No database query was performed during this audit. A fresh approved
`BEGIN READ ONLY` / `ROLLBACK` SQL Editor checkpoint remains mandatory before
any future reset boundary.

Exact equality between local migrations 173–177 and the SQL historically
applied to staging remains unproven. This is retained as high
provenance/reproducibility risk and documented non-mutating historical source
drift; it is not silently waived.

## Evidence isolation

The nine artifacts from the stopped run remain immutable at their recorded
hashes. The prior authorization is exhausted.

The unused namespace for a future separately authorized run is:

`release/patch83u/reset-proof-run-002/`

The reserved result is:

`release/patch83u/reset-proof-run-002/patch83u-staging-reset-final-results.json`

That result file does not exist. The harness uses exclusive-create semantics
and must refuse an overwrite. No success evidence was created.

## Validation and safety

- Harness JavaScript syntax: passed.
- Focused version-gate and harness tests: passed, mock-only.
- Focused Auth/frontend/harness suite: passed.
- TypeScript: passed.
- JSON parsing: passed.
- `git diff --check`: passed with line-ending advisories only.
- Application build: not run because application source was unchanged by this
  audit.

No credential was entered. No login, reset, password change, refresh replay,
deployment, migration, database mutation, production access, staging write,
file staging, commit, or push occurred.
