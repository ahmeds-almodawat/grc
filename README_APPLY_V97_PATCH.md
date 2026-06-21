# v9.7 Approval Record Integrity / Evidence Lock Pack

This patch adds final approval record integrity, evidence lock, proof capture, and release-freeze support for the controlled-pilot approval gate.

Safety boundaries:

- Does not fill approval JSON files.
- Does not bypass `v66:strict-proof`.
- Does not mark production ready.
- Does not change RLS, migrations, Supabase functions, runtime bridges, or application runtime behavior.

Apply:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center-v9.7-approval-record-integrity-evidence-lock-pack\apply-v9.7.ps1" -RepoPath "C:\Users\molte\Downloads\grc-control-center"
node .\scripts\v97-install-package-scripts.mjs
npm run pilot:approval-record-integrity
```
