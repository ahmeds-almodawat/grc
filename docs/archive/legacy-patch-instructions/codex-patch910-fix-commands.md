# Codex Fix Commands — Patch 9+10

## TypeScript / App integration

```powershell
codex exec "Fix TypeScript or App.tsx integration errors caused by Patch 9+10 only. Keep the runtime workflow actions migration, real data UAT readiness migration, runtimeWorkflowActionsApi, realDataUatReadinessApi, RuntimeWorkflowActionsCenter page, RealDataUatReadinessCenter page, GRC hub Runtime Actions tab, and Admin hub Real Data & UAT tab. Keep Patch 1 through Patch 8 files. Do not add mock/demo data. Run npm run typecheck and npm run build after fixing."
```

## RLS static audit

```powershell
codex exec "Fix v64:rls-strict static audit failures caused by Patch 9+10 only. Prefer explicit CREATE POLICY statements so the static audit can detect org-scoped RLS. Do not weaken RLS, do not disable the audit, and do not add broad public policies. Run npm run v64:rls-strict and npm run proof:all after fixing."
```

## SQL migration

```powershell
codex exec "Fix SQL migration errors caused by supabase/migrations/070_patch9_runtime_workflow_actions_escalations.sql and supabase/migrations/071_patch10_real_data_activation_uat_readiness.sql only. Preserve runtime action requests, action decisions, notification rules, escalation rules, integration outbox, real data import batches, validation results, mapping approvals, UAT cycles, UAT runs, training records, department signoffs, and go/no-go checklists. Do not remove RLS. Run supabase db reset if available, otherwise provide the corrected SQL."
```

## Tests

```powershell
codex exec "Fix tests failing because of Patch 9+10. Update tests only if they depended on the absence of the new Runtime Actions or Real Data & UAT tabs. Do not bypass or skip tests. Run npm run test:unit and npm run test:e2e after fixing."
```
