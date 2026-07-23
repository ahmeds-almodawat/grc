# Run 008 SQL checkpoints

The six checkpoint files are created only during a separately authorized hosted execution. Preparation and pre-credential readiness do not create or consume SQL checkpoint evidence.

Every checkpoint must be newly captured from the staging SQL Editor using `BEGIN READ ONLY` and explicit `ROLLBACK`.
