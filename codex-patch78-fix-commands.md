# Codex Patch 7+8 Fix Commands

## TypeScript or App integration

```powershell
codex exec "Fix TypeScript or App.tsx integration errors caused by Patch 7+8 only. Keep the professional workbenches migration, assurance go-live migration, professionalWorkbenchesApi, assuranceGoLiveApi, ProfessionalWorkbenchesCenter page, AssuranceGoLiveCenter page, GRC hub Professional Workbenches tab, and Admin hub Assurance Go-Live Pack tab. Keep Patch 1 through Patch 6 files. Do not add mock/demo data. Run npm run typecheck and npm run build after fixing."
```

## RLS strict audit

```powershell
codex exec "Fix v64:rls-strict static audit failures caused by Patch 7+8 only. Prefer explicit CREATE POLICY statements so the static audit can detect org-scoped RLS. Do not weaken RLS, do not disable the audit, and do not add broad public policies. Run npm run v64:rls-strict and npm run proof:all after fixing."
```

## SQL migration

```powershell
codex exec "Fix SQL migration errors caused by supabase/migrations/068_patch7_professional_audit_risk_compliance_workbenches.sql or supabase/migrations/069_patch8_assurance_security_go_live_pack.sql only. Preserve audit/risk/compliance workbenches, issue/CAPA closure, go-live gates, external auditor packages, signoffs, rollback/restore exercises, monitoring checks, pilot signoff, production decisions, and RLS. Run supabase db reset if available, otherwise provide the corrected SQL."
```

## Tests

```powershell
codex exec "Fix tests failing because of Patch 7+8. Update tests only if they depended on the absence of the new Professional Workbenches or Assurance Go-Live tabs. Do not bypass or skip tests. Run npm run test:unit and npm run test:e2e after fixing."
```
