# Codex Patch 18 Fix Commands

## TypeScript / App integration

```powershell
codex exec "Fix TypeScript or App.tsx integration errors caused by Patch 18 only. Keep the Patch 18 migration, productionGoNoGoApi, ProductionGoNoGoCenter page, and Admin hub Production Go/No-Go tab. Keep Patch 1 through Patch 17 files. Do not add mock/demo data. Do not create fake approvals, fake signoffs, fake launch decisions, or fake evidence. Do not load copyrighted CBAHI, JCI, or ISO standards text. Run npm run typecheck and npm run build after fixing."
```

## RLS static audit

```powershell
codex exec "Fix v64:rls-strict static audit failures caused by Patch 18 only. Prefer explicit CREATE POLICY statements so the static audit can detect org-scoped RLS. Do not weaken RLS, do not disable the audit, do not add broad public policies, and do not add demo data. Run npm run v64:rls-strict and npm run proof:all after fixing."
```

## SQL migration

```powershell
codex exec "Fix SQL migration errors caused by supabase/migrations/079_patch18_production_go_no_go_pack.sql only. Preserve production go/no-go cycles, staging persona SQL runs, restore rollback proofs, change freeze records, access reviews, confidentiality checks, board packs, executive decisions, and launch monitoring checks. Preserve explicit org-scoped RLS policies and views. Do not add fake launch approval data. Run supabase db reset if available, otherwise provide corrected SQL."
```

## Final proof

```powershell
codex exec "Run the full final proof gate after Patch 18: npm run typecheck, npm run build, npm run test:unit, npm run test:e2e, npm audit --audit-level=high, npm run v64:rls-strict, npm run proof:all, npm run v672:capture, npm run v700:v65-audit, and npm run v700:runtime-security. Fix only Patch 18 issues. Do not skip or weaken tests."
```
