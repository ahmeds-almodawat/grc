# Codex fallback commands for Patch 15

## TypeScript or App integration fix

```powershell
codex exec "Fix TypeScript or App.tsx integration errors caused by Patch 15 only. Keep the Patch 15 migration, src/lib/supabase.ts singleton remediation, finalRuntimeSecurityClosureApi, FinalRuntimeSecurityClosureCenter page, and Admin hub Final Runtime Security Closure tab. Keep Patch 1 through Patch 14 files. Do not add mock/demo data. Do not load copyrighted CBAHI, JCI, or ISO standards text. Run npm run typecheck and npm run build after fixing."
```

## Supabase multiple-client warning fix

```powershell
codex exec "Fix the non-fatal Supabase multiple-client warning caused by duplicate browser client creation. Prefer a safe singleton in src/lib/supabase.ts using globalThis and a stable auth storageKey. Do not create multiple createClient calls. Do not change auth behavior except to prevent duplicate client instantiation. Run npm run typecheck, npm run build, and npm run test:e2e after fixing."
```

## v65 medium warning closure

```powershell
codex exec "Close the remaining v700:v65-audit medium warning about stale release/v661/staging-sql/02_v65_workflow_smoke_tests.sql. Synchronize it from the canonical supabase/tests/v65_workflow_smoke_tests.sql or run the repo capture process. Do not edit the v700 audit script to hide the warning. Run npm run v672:capture and npm run v700:v65-audit after fixing."
```

## Runtime-security/RPC classification cleanup

```powershell
codex exec "Reduce unknown RPC classifications without weakening runtime security. Review release/v700/runtime-security-bridge-audit.json and release/v700/rpc-inventory.json if present. Prefer documenting safe classifications or bridge plans in generated evidence/registry files rather than weakening audits. Do not grant broad execute privileges. Run npm run v700:runtime-security and npm run proof:all after fixing."
```

## RLS static audit fix

```powershell
codex exec "Fix v64:rls-strict static audit failures caused by Patch 15 only. Prefer explicit CREATE POLICY statements so the static audit can detect org-scoped RLS. Do not weaken RLS, do not disable the audit, and do not add broad public policies. Run npm run v64:rls-strict and npm run proof:all after fixing."
```
