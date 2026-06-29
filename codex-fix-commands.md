# Patch 2 Codex Fix Commands

Use Codex only for fixing compile/test issues after applying this patch.

## TypeScript errors

```powershell
codex exec "Fix TypeScript errors caused by Patch 2 only. Keep the accreditation standards engine, migration, AccreditationCenter page, and Quality hub tab. Do not add copyrighted CBAHI/JCI clause content. Run npm run typecheck after fixing."
```

## Build errors

```powershell
codex exec "Fix build errors caused by Patch 2 only. Do not remove the AccreditationCenter. Do not weaken CI/proof checks. Run npm run build after fixing."
```

## Migration SQL errors

```powershell
codex exec "Fix SQL migration errors in supabase/migrations/063_patch2_accreditation_standards_engine.sql only. Preserve the table purpose, RLS, views, and licensed-content warning. Do not add broad public write policies. Validate the SQL syntax and explain the fix."
```

## Unit/E2E test errors

```powershell
codex exec "Fix unit or E2E test failures caused by Patch 2 only. If a test needs to account for the new Accreditation tab, update the test expectation. Do not add fake runtime accreditation data. Run npm run test:unit and, if available, npm run test:e2e."
```

## README leftover inconsistency

```powershell
codex exec "Clean README.md truth-state wording only. Remove any remaining outdated statement that proof:all is expected to fail 16/1 if current proof passes. Keep production readiness blocked until real human approval, OVR confidentiality confirmation, live/staging RLS persona proof, live bridge/access review evidence, rollback, and pilot review are complete."
```
