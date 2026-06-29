# Patch 7+8 Deploy Instructions

Patch 7 adds Professional Audit/Risk/Compliance Workbenches.
Patch 8 adds Assurance, Security, and Go-Live Pack.

This bundle is intentionally combined because both patches move the platform from structural GRC into operating workbenches and production assurance.

## Apply

```powershell
cd C:\Users\molte\Downloads

Remove-Item -Recurse -Force "C:\Users\molte\Downloads\patch78_grc_changes" -ErrorAction SilentlyContinue
Expand-Archive -Path "C:\Users\molte\Downloads\grc_patch78_professional_workbenches_assurance.zip" -DestinationPath "C:\Users\molte\Downloads" -Force

cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b patch-7-8-professional-workbenches-assurance

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch78_grc_changes\scripts\apply-patch78.ps1"
```

If you copied the scripts into the repo `scripts` folder, this command also works as long as the extracted patch folder remains at `C:\Users\molte\Downloads\patch78_grc_changes`:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center\scripts\apply-patch78.ps1"
```

## Verify

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch78_grc_changes\scripts\verify-patch78.ps1"
```

Full gate:

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

git add supabase/migrations/068_patch7_professional_audit_risk_compliance_workbenches.sql supabase/migrations/069_patch8_assurance_security_go_live_pack.sql src/lib/professionalWorkbenchesApi.ts src/lib/assuranceGoLiveApi.ts src/pages/ProfessionalWorkbenchesCenter.tsx src/pages/AssuranceGoLiveCenter.tsx src/App.tsx README.md release/v66 release/v700 release/v64 release/v661

git commit -m "Patch 7-8: add professional workbenches and assurance go-live pack"
git push -u origin patch-7-8-professional-workbenches-assurance
```

Then open a PR into `main`.
