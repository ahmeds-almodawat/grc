# Patch 83U staging reset proof — Run 006 workspace

This namespace is reserved for a future, separately authorized Run 006. Its
creation does not authorize a hosted login, session, password reset, password
change, refresh replay, or any other hosted action. Run 005 authorization was
consumed by its safe pre-harness stop and cannot be reused.

The harness accepts fresh SQL Editor evidence only from:

`release/patch83u/reset-proof-run-006/checkpoints`

The required files, in strict order, are:

1. `01-before-employee-sessions.json`
2. `02-immediately-before-reset.json`
3. `03-immediately-after-reset.json`
4. `04-before-required-password-change.json`
5. `05-immediately-after-password-change-finalization.json`
6. `06-after-fresh-employee-login.json`

No checkpoint from Runs 001–005 is reusable. Each future checkpoint must be
created after an authorized Run 006 harness process starts and pass the strict
UTF-8, size, schema, freshness, order, unique-hash, fixed-path, Git-ignore, and
non-symlink controls.

Run 006 uses the V6 freeze-bound confirmation contract
`patch83u-run006-reset-confirmation-v1`. The exact phrase is
`EXECUTE RUN 006 RESET NOW`. Matching is case-sensitive, no CLI override is
supported, and evidence retains only the safe contract identifier and boolean
match result.

The final session contract is exact: Checkpoint 5 proves zero active sessions
and zero unrevoked refresh rows after finalization; one fresh nonpersistent
Employee login then requires Checkpoint 6 to report exactly one active session
and exactly one unrevoked refresh row. The operator cannot override those
counts.

Future output must use a previously unused path matching:

`release/patch83u/reset-proof-run-006/patch83u-staging-reset-final-results-attempt-NNN.json`

Passwords, tokens, cookies, authorization headers, browser storage, session
identifiers, email addresses, and raw request or response bodies must never be
written in this directory.
