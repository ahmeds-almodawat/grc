# Patch 15: Final Warning & Runtime Security Closure

## Purpose

Patch 15 is a focused hardening patch before real hospital data activation. It is not a new dashboard layer. It closes or tracks final runtime/security proof issues:

- Supabase multiple-client warning remediation through a singleton client pattern.
- v65/v700 medium warning closure register.
- RPC classification review register for unknown runtime-security classifications.
- Runtime-security exception register.
- Supabase client check register.
- Final hardening proof run archive.
- Admin hub page: **Final Runtime Security Closure**.

No demo data is loaded. No copyrighted CBAHI/JCI/ISO content is loaded.

## Apply

```powershell
cd C:\Users\molte\Downloads

Remove-Item -Recurse -Force "C:\Users\molte\Downloads\patch15_grc_changes" -ErrorAction SilentlyContinue

Expand-Archive -Path "C:\Users\molte\Downloads\grc_patch15_final_warning_runtime_security_closure.zip" -DestinationPath "C:\Users\molte\Downloads" -Force

cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b patch-15-final-warning-runtime-security-closure

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch15_grc_changes\scripts\apply-patch15.ps1"
```

If you copied scripts into the repo `scripts` folder, this also works after extraction:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center\scripts\apply-patch15.ps1"
```

The script still expects the extracted patch folder here:

```text
C:\Users\molte\Downloads\patch15_grc_changes
```

## Verify

```powershell
cd C:\Users\molte\Downloads\grc-control-center

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch15_grc_changes\scripts\verify-patch15.ps1"
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

## Supabase

Local:

```powershell
supabase db reset
```

Staging:

```powershell
supabase db push
```

## Commit

```powershell
git status
git diff --stat

git add supabase/migrations/076_patch15_final_warning_runtime_security_closure.sql src/lib/supabase.ts src/lib/finalRuntimeSecurityClosureApi.ts src/pages/FinalRuntimeSecurityClosureCenter.tsx src/App.tsx README.md release/v66 release/v700 release/v64 release/v661

git commit -m "Patch 15: close final runtime security warnings"
git push -u origin patch-15-final-warning-runtime-security-closure
```

Open PR into `main`.

## Important

After Patch 15 is clean, stop structural patching and move to real hospital master-data preparation for Patch 16.
