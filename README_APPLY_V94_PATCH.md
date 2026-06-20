# v9.4 Final Gate Simulator / Approval Control Room Pack

This patch adds a safe final-gate simulation and approval control-room layer for the GRC Control Center controlled-pilot approval process.

## Safety boundary

This patch does **not**:

- fill or fake approvals
- bypass `v66:strict-proof`
- change RLS policies
- change migrations
- change runtime bridge logic
- change Supabase functions
- mark the system production ready

## Apply

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center-v9.4-final-gate-simulator-control-room-pack\apply-v9.4.ps1" -RepoPath "C:\Users\molte\Downloads\grc-control-center"
node .\scripts\v94-install-package-scripts.mjs
npm run pilot:final-gate-simulator
```

## Outputs

- `release/v94/approval-json-shape-audit.md`
- `release/v94/final-gate-simulator.md`
- `release/v94/approver-control-room.md`
- `release/v94/go-live-rehearsal.md`
- `release/v94/risk-acceptance-register.md`
- `release/v94/proof-readiness-scorecard.md`
- `release/v94/v94-review-pack.md`
