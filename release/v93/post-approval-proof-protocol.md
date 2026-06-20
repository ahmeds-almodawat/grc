# v9.3 Post-Approval Proof Protocol

| Step | Command | Purpose |
| --- | --- | --- |
| 1 | npm run v674:signoff-check | Validates real approval and confidentiality files |
| 2 | npm run v674:sync-manual-evidence | Syncs manual evidence status |
| 3 | npm run v66:strict-proof | Runs strict go/no-go gate |
| 4 | npm run proof:all | Confirms final proof suite status |

## Expected after valid real approval

- `v674:signoff-check` strict passed.
- `v66:strict-proof` passed.
- `proof:all` fully passed.

If these do not pass, fix the approval or evidence issue. Do not weaken the gate.

