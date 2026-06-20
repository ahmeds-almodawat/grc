# Post-Approval Proof Runbook v9.5

After real approvals are entered:

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```

Expected final controlled-pilot result after valid approvals:

```text
proof:all = fully passed
failed_count = 0
```

Production readiness remains separate and requires production-specific proof.
