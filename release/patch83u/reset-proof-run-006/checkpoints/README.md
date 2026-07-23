# Run 006 checkpoint reservation

This directory is reserved for six operator-produced, read-only SQL Editor
checkpoint files during a future explicitly authorized Run 006.

No checkpoint evidence exists during source preparation. The six exact JSON
filenames are individually ignored by Git and may be generated only after the
future harness process starts. This README is not a checkpoint and is never
consumed by the harness.

Checkpoint 4 must prove exactly one disposable temporary-password login
session and one unrevoked refresh row. Checkpoint 5 must independently prove
zero sessions, zero unrevoked refresh rows, `password_changed_at_set=true`,
`sessions_revoked_at_set=true`, and `reconciliation_auth_changed=false`.
Checkpoint 6 must prove exactly one fresh-login session and one unrevoked
refresh row.
