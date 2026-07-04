# Patch 17 — Real UAT Execution Evidence Pack

This patch adds the controlled execution layer for real UAT and accreditation evidence. It does **not** seed fake UAT evidence, fake signoffs, screenshots, SQL outputs, or copyrighted standards text.

## Apply

```powershell
cd C:\Users\molte\Downloads

Remove-Item -Recurse -Force "C:\Users\molte\Downloads\patch17_grc_changes" -ErrorAction SilentlyContinue

Expand-Archive -Path "C:\Users\molte\Downloads\grc_patch17_real_uat_execution_evidence_pack.zip" -DestinationPath "C:\Users\molte\Downloads" -Force

cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b patch-17-real-uat-execution-evidence

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch17_grc_changes\scripts\apply-patch17.ps1"
```

If the script was copied into repo `scripts`, use:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center\scripts\apply-patch17.ps1"
```

The script can auto-extract the ZIP from Downloads if `patch17_grc_changes` is missing.

## Verify

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch17_grc_changes\scripts\verify-patch17.ps1"
```

## Full Gate

```powershell
npm ci
npm run typecheck
npm run build
npm run test:unit
npm run test:e2e
npm audit --audit-level=high
npm run v64:rls-strict
npm run proof:all
npm run v672:capture
npm run v700:v65-audit
npm run v700:runtime-security
```

## Commit

```powershell
git status
git diff --stat

git add supabase/migrations/078_patch17_real_uat_execution_evidence_pack.sql src/lib/realUatExecutionApi.ts src/pages/RealUatExecutionCenter.tsx src/App.tsx README.md release/v66 release/v700 release/v64 release/v661

git commit -m "Patch 17: add real UAT execution evidence pack"
git push -u origin patch-17-real-uat-execution-evidence
```
