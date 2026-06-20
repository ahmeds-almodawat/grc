# v9.5 Approval Execution Workspace Pack

This patch adds a final approval execution workspace for the controlled-pilot signoff process.

It does not modify approval values, RLS, migrations, runtime bridge logic, Supabase functions, or production gates.

## Apply

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center-v9.5-approval-execution-workspace-pack\apply-v9.5.ps1" -RepoPath "C:\Users\molte\Downloads\grc-control-center"
node .\scripts\v95-install-package-scripts.mjs
npm run pilot:approval-execution-workspace
```
