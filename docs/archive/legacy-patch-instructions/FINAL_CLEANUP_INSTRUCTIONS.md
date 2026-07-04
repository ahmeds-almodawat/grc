# Final Cleanup Patch — Patch 4 UI Visibility + Verification

This final cleanup makes the Patch 4 Audit / Evidence Integrity workspace visible in the Admin hub and gives you a clean verification flow.

## Apply

Extract this ZIP to:

```text
C:\Users\molte\Downloads
```

Then run:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b final-cleanup-patch4-ui-verification

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\final_cleanup_grc_changes\scripts\apply-final-cleanup.ps1"
```

If you extracted the ZIP directly into the repo root, use:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\apply-final-cleanup.ps1"
```

## Verify

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\final_cleanup_grc_changes\scripts\verify-final-cleanup.ps1"
```

Or manually:

```powershell
npm run typecheck
npm run build
npm run test:unit
npm run test:e2e
npm audit --audit-level=high
npm run proof:all
npm run v672:capture
npm run v700:v65-audit
```

## Commit

```powershell
git status
git diff --stat

git add src/App.tsx release/v66 release/v700 release/v661
git commit -m "Final cleanup: expose audit evidence governance workspace"
git push -u origin final-cleanup-patch4-ui-verification
```

Open PR into `main`.
