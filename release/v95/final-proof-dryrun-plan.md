# v9.5 Final Proof Dry-Run Plan

Generated: 2026-06-20T20:00:45.210Z

Run this only after real approvers complete approval JSON files.

| Step | Command | Purpose |
| --- | --- | --- |
| 1 | npm run v674:signoff-check | Validate approval JSON files |
| 2 | npm run v674:sync-manual-evidence | Sync manual evidence flags after approval |
| 3 | npm run v66:strict-proof | Confirm controlled-pilot go/no-go gate |
| 4 | npm run proof:all | Run complete proof suite |

## Expected result after valid approval

proof:all should pass with zero failed commands.

## Boundary

This pack does not fill approvals, bypass v66:strict-proof, modify RLS, modify migrations, change runtime bridge logic, or mark production ready.

