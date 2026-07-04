# Patch 16 — Real Data Activation Pack

## Purpose
Patch 16 prepares the GRC platform for controlled loading of real hospital master data and licensed standards metadata.

It adds governance for:
- licensed standards metadata source files
- hospital department/committee/role/evidence/control/KPI/tracer/audit universe/document owner datasets
- source file hash and privacy/license review
- mapping sets and mapping items
- validation rules and validation findings
- load approvals
- reconciliation checks
- cutover rehearsal/production runs
- readiness signoffs

No demo data is seeded. No copyrighted CBAHI/JCI/ISO text is included.

## Apply

```powershell
cd C:\Users\molte\Downloads

Remove-Item -Recurse -Force "C:\Users\molte\Downloads\patch16_grc_changes" -ErrorAction SilentlyContinue

Expand-Archive -Path "C:\Users\molte\Downloads\grc_patch16_real_data_activation_pack.zip" -DestinationPath "C:\Users\molte\Downloads" -Force

cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b patch-16-real-data-activation

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch16_grc_changes\scripts\apply-patch16.ps1"
```

If you copy the script into repo `scripts`, this also works after the ZIP is in Downloads; the script will auto-extract the ZIP if needed:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center\scripts\apply-patch16.ps1"
```

## Verify

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch16_grc_changes\scripts\verify-patch16.ps1"
```

## Full gate

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

git add supabase/migrations/077_patch16_real_data_activation_pack.sql src/lib/realDataActivationApi.ts src/pages/RealDataActivationCenter.tsx src/App.tsx README.md release/v66 release/v700 release/v64 release/v661

git commit -m "Patch 16: add real data activation pack"
git push -u origin patch-16-real-data-activation
```
