# v9.6 Approval Closure Control Pack

This pack adds final approval-closure controls for the GRC Control Center controlled-pilot gate.

It does not fill approvals, bypass strict proof, change RLS, change migrations, change runtime bridge logic, or mark production ready.

## Apply

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center-v9.6-approval-closure-control-pack\apply-v9.6.ps1" -RepoPath "C:\Users\molte\Downloads\grc-control-center"
node .\scripts\v96-install-package-scripts.mjs
npm run pilot:approval-closure-control
```
