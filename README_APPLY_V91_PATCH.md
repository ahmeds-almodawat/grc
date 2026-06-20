# v9.1 Manual Approval Evidence Finalization Pack

This patch adds final manual approval evidence support for the controlled-pilot gate.

It does **not** fill approvals automatically, bypass signoff, modify RLS, change migrations, alter runtime bridge logic, or mark production ready.

## Apply

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center-v9.1-manual-approval-evidence-finalization-pack\apply-v9.1.ps1" -RepoPath "C:\Users\molte\Downloads\grc-control-center"
node .\scripts\v91-install-package-scripts.mjs
npm run pilot:approval-finalization
```

## Expected

- `ci:static` passes.
- `v91:all` passes.
- `v91:approval-lint` may report `manual_approval_pending` until real approvers fill the approval JSON files.
- Production ready remains `false`.
