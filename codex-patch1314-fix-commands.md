# Codex Fix Commands — Patch 13+14

## TypeScript / App integration fix

```powershell
codex exec "Fix TypeScript or App.tsx integration errors caused by Patch 13+14 only. Keep the UAT/accreditation evidence migration, production hardening launch migration, uatAccreditationEvidenceApi, productionHardeningLaunchApi, UatAccreditationEvidenceCenter page, ProductionHardeningLaunchCenter page, Quality/Safety hub UAT Evidence Pack tab, and Admin hub Production Hardening Launch tab. Keep Patch 1 through Patch 12 files. Do not add mock/demo data. Do not load copyrighted CBAHI, JCI, or ISO standards text. Run npm run typecheck and npm run build after fixing."
```

## RLS/static audit fix

```powershell
codex exec "Fix v64:rls-strict static audit failures caused by Patch 13+14 only. Prefer explicit CREATE POLICY statements so the static audit can detect org-scoped RLS. Do not weaken RLS, do not disable the audit, do not add broad public policies, and do not add demo data. Run npm run v64:rls-strict and npm run proof:all after fixing."
```

## SQL migration fix

```powershell
codex exec "Fix SQL migration errors caused by supabase/migrations/074_patch13_uat_accreditation_evidence_pack.sql and supabase/migrations/075_patch14_production_hardening_launch_pack.sql only. Preserve UAT scenario scripts, evidence capture, SQL proof, signoffs, failed scenario retests, accreditation evidence packs, client warning closure, v65 warning closure, staging persona SQL, backup restore proof, change freeze, board go/no-go, launch signoffs, decisions, and monitoring checks. Do not remove RLS. Run supabase db reset if available, otherwise provide corrected SQL."
```

## Full verification

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch1314_grc_changes\scripts\verify-patch1314.ps1"
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
