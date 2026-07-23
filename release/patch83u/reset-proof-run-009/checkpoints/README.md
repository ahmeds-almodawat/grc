# Run 009 SQL checkpoints

The six checkpoint files are created only during a separately authorized hosted execution. Preparation and pre-credential readiness do not create or consume SQL checkpoint evidence.

Every checkpoint must be newly captured from the staging SQL Editor using `BEGIN READ ONLY` and explicit `ROLLBACK`. The harness binds each checkpoint to the exact validated staging project reference supplied by `--sql-editor-project-ref`.
