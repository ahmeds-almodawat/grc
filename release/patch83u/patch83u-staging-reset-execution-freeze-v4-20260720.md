# Patch 83U staging reset execution freeze V4 — 2026-07-20

## Decision

**READY FOR NEW RUN 004 AUTHORIZATION**

This is a preparation/readiness decision only. It does not authorize Run 004.
Run 003 authorization is consumed and may not be reused.

## Corrected Run 004 execution contract

- Exact case-sensitive operator phrase: `EXECUTE RUN 004 RESET NOW`
- Contract ID: `patch83u-run004-reset-confirmation-v1`
- The phrase is derived from the verified V4 freeze; no CLI override exists.
- Checkpoint 2, runtime/governance/session gates, fresh Edge metadata, and browser
  target validation all precede reset-modal interaction and sensitive fields.
- A reset-action interceptor is installed before the modal is populated, and
  no reset request can pass before the final confirmation.
- Only exact HTTP 409
  `PATCH83U_PERMANENT_PASSWORD_POLICY_REJECTED` permits a bounded permanent
  password retry; it never retries the reset.
- Every reset submission attempt requires Checkpoint 3, including an ambiguous
  Edge response or local cleanup failure. Progression needs exact Edge and
  Checkpoint 3 success.
- Both Employee contexts independently prove refresh, permitted Home access,
  direct Admin denial, and protected-control absence. Both stale contexts must
  independently prove signed-out protected-route denial after reset.

## Frozen material

- Branch: `patch83t-controlled-user-excel-import`
- HEAD: `a9989b1e8d95a6bb775316a2d9e709ef84514c42`
- Tracked modified entries: `64`
- Untracked entries: `93`
- Staged files: `0`
- Frozen files: `70`
- Frozen bytes: `2405570`
- Aggregate SHA-256: `8c7746975ed75466275d1c2eef0bd8d74612d7939aad4f0ccbfdd719b375128a`
- Freeze JSON SHA-256: `8e81321e13460a69af61104d14ce486c2a103518375447f8f44907ccd3a69bd7`

The aggregate is SHA-256 over UTF-8 lines sorted by path using ordinal
code-unit order in the form `path<TAB>sha256<TAB>bytes`, joined with LF and
no trailing LF. V4 JSON/Markdown, ignored environment files, future checkpoint
files, and future result files are excluded to avoid circular or dynamic input.

## Edge, runtime, and lineage

- Active `privileged-action`: version 5, ACTIVE, `verify_jwt=true`
- Hosted metadata hash:
  `7fee99f2d77590f48026ddb0aaec5d540403d7c85fda462aece5154492852762`
- Downloaded/current local `index.ts`:
  `f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87` (157176 bytes)
- Byte-for-byte active entry-source equality: passed
- Complete deployed-bundle cryptographic binding: not proven
- V3 files compared: 62; expected changes:
  4; unexpected drift: 0
- Migrations 173–177 unchanged from V3: passed

Historical migration source equality to staging remains unproven and stays
classified as a high provenance/reproducibility risk. Fresh, read-only SQL
Editor checkpoints remain mandatory before any future reset boundary.

## Run 004 workspace and validation

Run 004 is reserved at:
`release/patch83u/reset-proof-run-004`

No checkpoint or success/output evidence exists. All six checkpoints must be
freshly generated after a future separately authorized harness process starts.

- Harness/checkpoint tests: 99/99 passed
- Relevant Auth/session tests: 63/63 passed
- JavaScript syntax: passed
- TypeScript: passed
- JSON/schema parsing: passed
- Secret scan: 2 deliberate nonsecret test fixtures reviewed; 0 actual hits
- `git diff --check`: passed with line-ending advisories only
- Build: not run because this task changed no application source

No credential was entered. No application login, session creation, reset,
password change, refresh replay, deployment, migration, database connection or
mutation, production access, staging, commit, or push occurred.
