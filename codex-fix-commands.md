# Patch 3 Codex Fix Commands

Use Codex only for fixing after applying Patch 3.

## TypeScript errors

```powershell
codex exec "Fix TypeScript errors caused by Patch 3 only. Keep the live GRC operating core migration, liveGrcOperatingApi, LiveGrcOperatingCore page, and GRC hub Operating Core tab. Do not remove Patch 2 accreditation files. Do not add mock/demo data. Run npm run typecheck after fixing."
```

## Build errors

```powershell
codex exec "Fix build errors caused by Patch 3 only. Preserve the Patch 3 workflow model and do not weaken CI or proof gates. Run npm run build after fixing."
```

## Migration errors

```powershell
codex exec "Fix Supabase migration errors in supabase/migrations/064_patch3_live_grc_operating_core.sql only. Keep organization-scoped RLS, security_invoker views, and the closure packet rule requiring requirement, risk, control, test, evidence review, and approval before closure. Do not reference tables that may not exist outside this migration."
```

## App integration errors

```powershell
codex exec "Fix App.tsx integration caused by Patch 3 only. Ensure AccreditationCenter is available in the Quality/Safety hub if Patch 2 installed it, and ensure LiveGrcOperatingCore appears in the GRC hub as an Operating Core tab. Do not redesign navigation. Run npm run typecheck after fixing."
```

## Full Patch 3 cleanup

```powershell
codex exec "Review Patch 3 changes only. Ensure no fake production-ready claim is added, no mock/demo organization fallback is introduced, the new live GRC operating page uses LiveResult states, and README does not contain the old 16 passed / 1 failed proof expectation. Run npm run typecheck and npm run build."
```
