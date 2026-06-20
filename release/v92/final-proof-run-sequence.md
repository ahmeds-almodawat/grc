# v9.2 Final Proof Run Sequence

Generated: 2026-06-20T17:21:40.406Z

| Step | Command | Condition |
| --- | --- | --- |
| 1 | npm run v674:signoff-check | Run after real approvals only |
| 2 | npm run v674:sync-manual-evidence | Run after real approvals only |
| 3 | npm run v66:strict-proof | Run after real approvals only |
| 4 | npm run proof:all | Run after real approvals only |

## Expected final outcome after valid real approvals

- v674:signoff-check strict_passed true
- v66:strict-proof passed
- proof:all fully passed

## Expected outcome before real approvals

- v66:strict-proof remains blocked
- proof:all remains failed_review_required
