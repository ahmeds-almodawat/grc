# Patch 83U staging reset proof — Run 004 workspace

This namespace is reserved for a future, separately authorized Run 004.
Preparing it does not authorize a hosted login, session, password reset, or
password change.

The harness accepts fresh SQL Editor evidence only from:

`release/patch83u/reset-proof-run-004/checkpoints`

The required files, in strict order, are:

1. `01-before-employee-sessions.json`
2. `02-immediately-before-reset.json`
3. `03-immediately-after-reset.json`
4. `04-before-required-password-change.json`
5. `05-immediately-after-password-change-finalization.json`
6. `06-after-fresh-employee-login.json`

No checkpoint from Run 003 is reusable. Each future checkpoint must be
created after the authorized Run 004 harness process starts and must pass the
existing strict UTF-8, size, schema, freshness, order, unique-hash, fixed-path,
Git-ignore, and non-symlink controls.

Run 004 uses the V4 freeze-bound confirmation contract. The exact operator
phrase is read only from the verified V4 freeze, is case-sensitive, has no CLI
override, and is requested immediately before the one-shot reset submission.
Execution evidence retains only the safe contract identifier and a boolean
match result.

The future output must use a previously unused path matching:

`release/patch83u/reset-proof-run-004/patch83u-staging-reset-final-results-attempt-NNN.json`

Passwords, tokens, cookies, authorization headers, browser storage, session
identifiers, and raw request or response bodies must never be written in this
directory.
