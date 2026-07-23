# Patch 83U staging reset proof — Run 003 workspace

This namespace is reserved for a future, separately authorized Run 003. Creation
of this workspace does not authorize hosted execution or a password reset.

The harness accepts SQL Editor evidence only from:

`release/patch83u/reset-proof-run-003/checkpoints`

The six fixed filenames, in required order, are:

1. `01-before-employee-sessions.json`
2. `02-immediately-before-reset.json`
3. `03-immediately-after-reset.json`
4. `04-before-required-password-change.json`
5. `05-immediately-after-password-change-finalization.json`
6. `06-after-fresh-employee-login.json`

Each file must contain exactly one UTF-8 JSON object saved directly from the
single `patch83u_evidence` result cell of the corresponding read-only SQL
Editor block, without a clipboard or terminal-paste handoff. The file may be
compact or multiline JSON. The harness never writes, renames, deletes, or
prints a checkpoint file.

Each accepted checkpoint file must be created or replaced after the current
harness process starts, and its database `captured_at` must not predate that
process. A file left by an earlier invocation is not consumed; the harness
waits for a current-run replacement. This binds both the file and database
snapshot to the active attempt in addition to the existing five-minute SQL
capture freshness rule and in-process hash/order checks.

Checkpoint files are intentionally Git-ignored so that operator-created
read-only evidence does not alter the frozen repository-state gate. The
directory and filenames are fixed by the V3 freeze. Files from Run 002 or any
other location are refused.

For a future explicitly authorized run, the reviewed command must include:

```text
--checkpoint-dir release/patch83u/reset-proof-run-003/checkpoints
```

Passwords and tokens must never be written here. Credential entry remains
limited to the harness's hidden interactive terminal prompts. Missing files
cause the harness to wait before the corresponding phase. Malformed, stale,
oversized, secret-bearing, duplicated, out-of-order, symlinked, or
project-mismatched files stop the run fail-closed.

Before each checkpoint read, the harness requires a short hidden confirmation
of the project reference visibly shown in the Supabase SQL Editor. Only the
large JSON transfer moved to files; this independent project confirmation was
retained.

Checkpoint 1 created during readiness preparation is time-bounded evidence,
not frozen source. It must be freshly regenerated in the verified staging SQL
Editor for the future authorized execution window if its freshness expires.
