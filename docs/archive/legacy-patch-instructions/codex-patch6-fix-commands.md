# Codex Patch 6 Fix Commands

## TypeScript / App Integration

```powershell
codex exec "Fix TypeScript or App.tsx integration errors caused by Patch 6 only. Keep the accreditation/quality operating migration, qualityAccreditationOperatingApi, QualityAccreditationOperatingCenter page, and Quality/Safety hub Quality Operating Layer tab. Keep Patch 5 Workflow Kernel and Patch 4 Audit & Evidence Integrity integration. Do not remove Patch 1, Patch 2, Patch 3, Patch 4, or Patch 5 files. Do not add mock/demo data. Run npm run typecheck and npm run build after fixing."
```

## SQL Migration

```powershell
codex exec "Fix SQL migration errors caused by supabase/migrations/067_patch6_accreditation_quality_operating_layer.sql only. Preserve licensed standards import governance, requirement operations, measurable element scoring, quality indicators, tracer rounds, RCA/CAPA cases, committee decisions, survey evidence packs, and explicit Patch 5 workflow-kernel RLS policies. Do not remove RLS. Do not embed copyrighted CBAHI/JCI standard text. Run supabase db reset or provide the corrected SQL if the local Supabase CLI is unavailable."
```

## RLS Static Audit

```powershell
codex exec "Fix v64:rls-strict static audit failures introduced by Patch 5 or Patch 6. Prefer explicit CREATE POLICY statements over dynamic SQL so the static audit can detect org-scoped RLS. Do not weaken RLS, do not disable the audit, and do not add broad public policies. Run npm run v64:rls-strict and npm run proof:all after fixing."
```

## E2E

```powershell
codex exec "Fix E2E failures caused by Patch 6 UI integration only. Ensure the app renders the Quality/Safety hub and Quality Operating Layer tab without crashing. Do not weaken or skip tests. Run npm run test:e2e after fixing."
```
