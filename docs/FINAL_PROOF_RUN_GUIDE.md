# Final Proof Run Guide

After real approvals are completed, run:

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```

Expected final result after valid approvals:

```text
v674:signoff-check = strict_passed true
v66:strict-proof = passed
proof:all = fully passed
```

If `proof:all` still fails, inspect `release/v700/proof-suite-all.json` and the failing command output.
