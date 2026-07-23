# Patch 83U staging reset proof — Run 007 workspace

This namespace is reserved for a future, separately authorized Run 007. Its
creation does not authorize a hosted login, session, password reset, password
change, refresh replay, or any other hosted action. Every earlier freeze and
evidence workspace remains historical and is not reusable for this run.

The harness accepts fresh SQL Editor evidence only from:

`release/patch83u/reset-proof-run-007/checkpoints`

The required files, in strict order, are:

1. `01-before-employee-sessions.json`
2. `02-immediately-before-reset.json`
3. `03-immediately-after-reset.json`
4. `04-before-required-password-change.json`
5. `05-immediately-after-password-change-finalization.json`
6. `06-after-fresh-employee-login.json`

No checkpoint from Runs 001–006 is reusable. Each future checkpoint must be
created after an authorized Run 007 harness process starts and pass the strict
UTF-8, size, schema, freshness, order, unique-hash, fixed-path, Git-ignore, and
non-symlink controls.

Run 007 uses the V7 freeze-bound confirmation contract
`patch83u-run007-reset-confirmation-v1`. The exact phrase is
`EXECUTE RUN 007 RESET NOW`. Matching is case-sensitive, no CLI override is
supported, and evidence retains only the safe contract identifier and boolean
match result.

The credential transition is exact: initial active database/Auth version 4/4,
post-reset `admin_reset_change_required` version 5/5, and final active version
6/6. Checkpoint 1 requires exactly zero sessions and zero unrevoked refresh
rows before the two controlled Employee sessions are established.

The final session contract is exact: Checkpoint 5 proves zero active sessions
and zero unrevoked refresh rows after finalization; one fresh nonpersistent
Employee login then requires Checkpoint 6 to report exactly one active session
and exactly one unrevoked refresh row. The operator cannot override those
counts.

Future output must use a previously unused path matching:

`release/patch83u/reset-proof-run-007/patch83u-staging-reset-final-results-attempt-NNN.json`

Passwords, tokens, cookies, authorization headers, browser storage, session
identifiers, email addresses, and raw request or response bodies must never be
written in this directory.
