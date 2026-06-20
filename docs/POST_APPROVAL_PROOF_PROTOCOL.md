# Post-Approval Proof Protocol

After real approvals are completed, run:

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```

Expected final status after valid real approvals:

```text
v674:signoff-check = strict_passed true
v66:strict-proof = passed
proof:all = 17 passed / 0 failed
```

If proof fails, do not edit proof scripts to force success. Fix the approval content or evidence gap.
