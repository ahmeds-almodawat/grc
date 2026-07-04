# Codex Fix Commands — Patch 11+12

## TypeScript or App integration

```powershell
codex exec "Fix TypeScript or App.tsx integration errors caused by Patch 11+12 only. Keep the real standards/master data migration, real workflow execution migration, realStandardsMasterDataApi, realWorkflowExecutionApi, RealStandardsMasterDataCenter page, RealWorkflowExecutionCenter page, Quality/Safety hub Standards & Master Data tab, and GRC hub Real Workflow Execution tab. Keep Patch 1 through Patch 10 files. Do not add mock/demo data. Do not load copyrighted CBAHI, JCI, or ISO standards text. Run npm run typecheck and npm run build after fixing."
```

## RLS static audit

```powershell
codex exec "Fix v64:rls-strict static audit failures caused by Patch 11+12 only. Prefer explicit CREATE POLICY statements so the static audit can detect org-scoped RLS. Do not weaken RLS, do not disable the audit, do not add broad public policies, and do not add demo data. Run npm run v64:rls-strict and npm run proof:all after fixing."
```

## SQL migration reset

```powershell
codex exec "Fix SQL migration errors caused by supabase/migrations/072_patch11_real_standards_master_data_pack.sql and supabase/migrations/073_patch12_real_workflow_execution_pack.sql only. Preserve real standards/master data, licensed-content governance, hospital departments, committees, evidence taxonomy, control library, real workflow execution items, evidence submission/review, gap closure, CAPA, exceptions, management responses, audit findings, and explicit org-scoped RLS policies. Do not add copyrighted standards text and do not insert demo data. Run supabase db reset if available, otherwise provide the corrected SQL."
```

## Final gate

```powershell
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
