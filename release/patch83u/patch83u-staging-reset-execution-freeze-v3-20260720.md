# Patch 83U staging reset execution freeze v3 — 2026-07-20

## Decision

**READY FOR NEW EXPLICIT HOSTED EXECUTION AUTHORIZATION**

This is a preparation/readiness decision only. It does not authorize Run 003.
Run 002 authorization is exhausted and may not be reused.

## Checkpoint-file channel

The fragile large-JSON hidden-terminal paste has been replaced with six fixed,
UTF-8 JSON checkpoint files under
`release/patch83u/reset-proof-run-003/checkpoints`. The harness accepts only
that exact non-symlinked directory and exact filenames. It validates strict
structure, project, read-only state, phase label, freshness, file time,
database capture time, order, size, uniqueness, and recursive secret safety.
Only a checkpoint hash, byte count, label, safe booleans, and timestamp enter
the final evidence.

Checkpoint 1 was freshly obtained from the verified staging SQL Editor using
`BEGIN READ ONLY` and explicit `ROLLBACK`, saved directly without clipboard
or terminal JSON transfer, and validated through the real harness loader.

- Checkpoint 1 SHA-256: `56887b42ae67d8efd319764636137f74f21cbe50370a1509f152f70e0564586d`
- Checkpoint 1 bytes: `2018`
- Checkpoint 1 captured at: `2026-07-19T22:51:16.627646+00:00`

It is preparation evidence only. A later authorized harness process requires a
new Checkpoint 1 whose file time and database `captured_at` both follow that
process start.

## Frozen material

- Branch: `patch83t-controlled-user-excel-import`
- HEAD: `a9989b1e8d95a6bb775316a2d9e709ef84514c42`
- Staged files: `0`
- Frozen files: `62`
- Frozen bytes: `2280970`
- Aggregate SHA-256: `b18baa86ff66fdec6a3ed91ca14c9cffc9528ff082adce82af4a6f54119952b2`
- Freeze JSON SHA-256: `23dd686e15e7334d58ccc774e2f3e6890aec27a23f9d738bd419f122301ad3e9`

The aggregate is SHA-256 over UTF-8 lines sorted by path using ordinal Unicode
code-unit order in the form `path<TAB>sha256<TAB>bytes`, joined with LF and no
trailing LF. The full inventory is in the V3 JSON freeze. Dynamic checkpoint
files and ignored local environment configuration are not frozen source.

## Edge and frontend lineage

- Active `privileged-action`: version 5, ACTIVE, `verify_jwt=true`
- Hosted metadata hash unchanged:
  `7fee99f2d77590f48026ddb0aaec5d540403d7c85fda462aece5154492852762`
- Downloaded/current local `index.ts` SHA-256:
  `f4a53ddfd0167ca62661c3c9acc6b7b320a0e43f4b96efc821308e1db73caf87`
- Byte-for-byte entry-source equality: passed
- Complete deployed-bundle cryptographic binding: not proven
- Frontend/Auth frozen files unchanged from V2: passed
- Migrations 173–177 unchanged from V2: passed

Historical migration source equality to staging remains unproven and is
retained as documented high provenance/reproducibility risk. Hosted behavior
must still be reverified by fresh read-only checkpoints.

## Attempt 005 and Run 003 isolation

Attempt 005 is stopped. Its output file does not exist. No credentials were
entered, no request ID exists, and no reset was submitted. Existing Run 002
artifacts remain preserved at their recorded hashes.

Run 003 is reserved at:
`release/patch83u/reset-proof-run-003`

No Run 003 execution/success output exists.

## Validation and safety

- Harness syntax: passed
- Focused checkpoint/harness tests: 72/72 passed, mock/local-only
- Real checkpoint loader: passed
- TypeScript: passed
- JSON/schema parsing: passed
- Secret-pattern scan: 0 hits
- `git diff --check`: passed with line-ending advisories only

No credential was entered. No GRC application login, employee session
creation, reset, password change, refresh replay, deployment, migration,
database mutation, production access, file staging, commit, or push occurred.
