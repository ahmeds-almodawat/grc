# Codex Fix Commands — Final Cleanup

## Main command

```powershell
codex exec "Fix final Patch 4 UI visibility only. In src/App.tsx, ensure AuditEvidenceGovernanceCenter is imported and add a visible Admin hub tab named 'Audit & Evidence Integrity' or 'Audit Evidence Governance'. Use the already existing AuditEvidenceGovernanceCenter component. Do not remove any existing tabs. Do not change migrations, APIs, liveResult.ts, or test files. Run npm run typecheck and npm run build after fixing."
```

## If typecheck/build fails

```powershell
codex exec "Fix only the TypeScript/build errors caused by the final Patch 4 UI tab integration. Do not remove Patch 1-4 features. Do not add mock/demo data. Run npm run typecheck and npm run build after fixing."
```

## If unit tests fail

```powershell
codex exec "Fix unit test failures without weakening the tests. Keep the enhanced v6.5 liveResult contract and Patch 2/3/4 APIs intact. Do not remove Patch 4. Run npm run test:unit after fixing."
```

## If E2E body remains hidden

```powershell
codex exec "Fix Playwright E2E failures where body remains hidden. Confirm npm run typecheck and npm run build pass first. Inspect global CSS and app startup for rules or loading state that keep body hidden. Do not weaken tests. Ensure the app visibly renders login or workspace for /, /unauthorized, /ovr, /approvals, /evidence, and /projects. Run npm run test:e2e after fixing."
```

## If v65 stale generated copy remains

```powershell
codex exec "Resolve the v65-strength-audit stale_generated_v65_copy warning by synchronizing generated staging SQL copies from the canonical supabase/tests/v65_workflow_smoke_tests.sql or by running the appropriate local evidence capture workflow. Do not edit canonical test intent. Run npm run v700:v65-audit after fixing."
```
