# Patch 13+14 — UAT Evidence Pack + Production Hardening Launch Pack

## Purpose

This combined patch adds the final evidence and launch-readiness layer after Patch 11+12.

Patch 13 turns UAT and accreditation-readiness into real evidence work:

- role scenario scripts
- step-by-step scenario instructions
- screenshots / screen recording / SQL output / signed document evidence
- SQL proof runs
- signoff status by Quality, Risk, Compliance, Audit, IT, Executive, Department, External Auditor, and Board
- failed scenario tracking
- retest history
- readiness scoring
- accreditation evidence pack readiness matrix

Patch 14 adds final production hardening and launch governance:

- Supabase/frontend/runtime warning register
- v65/v700 warning closure register
- staging persona SQL run register
- backup/restore proof register
- change freeze records
- board go/no-go pack
- Management/IT/Quality/Audit/Board signoffs
- production launch decision register
- post-launch monitoring checks

This patch does **not** declare the platform production-ready. Production approval still requires real records, real evidence, and signed decisions.

## Apply

Extract this ZIP to:

```powershell
C:\Users\molte\Downloads
```

Then run:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b patch-13-14-uat-evidence-production-hardening

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch1314_grc_changes\scripts\apply-patch1314.ps1"
```

If you copied the scripts into the repo `scripts` folder, this also works after extraction:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center\scripts\apply-patch1314.ps1"
```

The script will still look for the extracted patch folder here:

```text
C:\Users\molte\Downloads\patch1314_grc_changes
```

## Verify

```powershell
cd C:\Users\molte\Downloads\grc-control-center

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch1314_grc_changes\scripts\verify-patch1314.ps1"
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

git add supabase/migrations/074_patch13_uat_accreditation_evidence_pack.sql supabase/migrations/075_patch14_production_hardening_launch_pack.sql src/lib/uatAccreditationEvidenceApi.ts src/lib/productionHardeningLaunchApi.ts src/pages/UatAccreditationEvidenceCenter.tsx src/pages/ProductionHardeningLaunchCenter.tsx src/App.tsx README.md release/v66 release/v700 release/v64 release/v661

git commit -m "Patch 13-14: add UAT evidence and production hardening launch pack"
git push -u origin patch-13-14-uat-evidence-production-hardening
```

Then open PR into `main`.
