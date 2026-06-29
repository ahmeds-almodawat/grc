# Codex Fix Commands — Patch 16

## TypeScript or App integration fix

```powershell
codex exec "Fix TypeScript or App.tsx integration errors caused by Patch 16 only. Keep the Patch 16 migration, realDataActivationApi, RealDataActivationCenter page, and Admin hub Real Data Activation tab. Keep Patch 1 through Patch 15 files. Do not add mock/demo data. Do not load copyrighted CBAHI, JCI, or ISO standards text. Run npm run typecheck and npm run build after fixing."
```

## RLS static audit fix

```powershell
codex exec "Fix v64:rls-strict static audit failures caused by Patch 16 only. Prefer explicit CREATE POLICY statements so the static audit can detect org-scoped RLS. Do not weaken RLS, do not disable the audit, do not add broad public policies, and do not add demo data. Run npm run v64:rls-strict and npm run proof:all after fixing."
```

## v65 capture / stale generated SQL copy fix

```powershell
codex exec "If Patch 16 causes v700:v65-audit to show stale generated SQL copies, synchronize generated release/v661 staging SQL from the canonical supabase/tests/v65_workflow_smoke_tests.sql or run the repo capture process. Do not edit the v700 audit script to hide warnings. Run npm run v672:capture and npm run v700:v65-audit after fixing."
```
