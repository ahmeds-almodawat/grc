# Post-Signoff Proof Runbook

After the approval files are filled by real approvers, run:

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```

Expected final result after valid signoff:

- `v674:signoff-check` strict passed.
- `v66:strict-proof` passed.
- `proof:all` fully passed.

If proof remains blocked, inspect the signoff-check messages and correct only the real human approval fields.
