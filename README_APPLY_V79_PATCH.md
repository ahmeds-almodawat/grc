# Apply v7.9 Runtime Pilot Console Pack

This patch adds the v7.9 Runtime Pilot Console / Operator Pack.

It does **not** fill approvals, mark production ready, bypass `v66:strict-proof`, change RLS, change migrations, or use real patient/confidential OVR data.

## Apply and validate

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center-v7.9-runtime-pilot-console-pack\apply-v7.9.ps1" -RepoPath "C:\Users\molte\Downloads\grc-control-center"
node .\scripts\v79-install-package-scripts.mjs
npm run pilot:ops-readiness
```

Expected status remains `technical_ready_pending_human_approval` until real Management/Admin, IT, Quality, and OVR confidentiality approvals are completed.
