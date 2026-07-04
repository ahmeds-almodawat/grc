# Patch 4 Codex Fix Commands

Use Codex only for fixes caused by Patch 4.

## TypeScript errors

```powershell
codex exec "Fix TypeScript errors caused by Patch 4 only. Keep the audit/evidence governance migration, auditEvidenceGovernanceApi, AuditEvidenceGovernanceCenter page, and Admin hub tab integration. Do not remove Patch 1, Patch 2, or Patch 3 files. Do not add mock/demo data. Run npm run typecheck after fixing."
```

## Build errors

```powershell
codex exec "Fix build errors caused by Patch 4 only. Keep the AuditEvidenceGovernanceCenter page and App.tsx integration. Do not weaken CI, proof, audit, or RLS expectations. Run npm run build after fixing."
```

## Supabase migration errors

```powershell
codex exec "Fix SQL migration errors caused by supabase/migrations/065_patch4_audit_evidence_production_governance.sql only. Preserve audit universe, annual plan, engagement, workpaper, findings, evidence versioning, immutable audit event hash chain, external auditor sessions, and production governance gates. Do not remove RLS. Run supabase db reset or provide the corrected SQL if the local Supabase CLI is unavailable."
```

## App integration missing

```powershell
codex exec "Integrate Patch 4 UI into src/App.tsx only. Import AuditEvidenceGovernanceCenter and add an AdminReleaseHub tab named Audit & Evidence Integrity. Do not add a new route unless needed. Run npm run typecheck after fixing."
```

## Tests failing

```powershell
codex exec "Fix tests failing because of Patch 4. Update tests only if they depended on the absence of the new audit/evidence governance tab. Do not bypass or skip tests. Run npm run test:unit and npm run test:e2e after fixing."
```
