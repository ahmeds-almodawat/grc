# Codex Patch 17 Fix Commands

## TypeScript/App integration fix

```powershell
codex exec "Fix TypeScript or App.tsx integration errors caused by Patch 17 only. Keep the Patch 17 migration, realUatExecutionApi, RealUatExecutionCenter page, and Quality/Safety hub Real UAT Execution tab. Keep Patch 1 through Patch 16 files. Do not add mock/demo data. Do not load copyrighted CBAHI, JCI, or ISO standards text. Run npm run typecheck and npm run build after fixing."
```

## RLS/static audit fix

```powershell
codex exec "Fix v64:rls-strict static audit failures caused by Patch 17 only. Prefer explicit CREATE POLICY statements so the static audit can detect org-scoped RLS. Do not weaken RLS, do not disable the audit, do not add broad public policies, and do not add demo data. Run npm run v64:rls-strict and npm run proof:all after fixing."
```

## Migration SQL fix

```powershell
codex exec "Fix SQL migration errors in supabase/migrations/078_patch17_real_uat_execution_evidence_pack.sql only. Preserve the Patch 17 purpose: real UAT cycles, persona scripts, runs, evidence artifacts, SQL proof, findings, retests, signoffs, and evidence pack readiness. Do not seed fake evidence or copyrighted standards content. Run npm run v64:rls-strict after fixing."
```
