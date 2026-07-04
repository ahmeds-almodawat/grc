# Patch 11+12: Real Standards/Master Data + Real Workflow Execution

## Purpose

This combined update moves the platform from structural readiness into real operating activation:

- Patch 11: Real Standards & Master Data Pack
- Patch 12: Real Workflow Execution Pack

It does not load demo data and does not include copyrighted standards text. Licensed CBAHI/JCI/ISO content must be loaded only by the licensed owner.

## Files

```text
patch1112_grc_changes/
  PATCH1112_DEPLOY_INSTRUCTIONS.md
  codex-patch1112-fix-commands.md
  scripts/
    apply-patch1112.ps1
    verify-patch1112.ps1
  supabase/
    migrations/
      072_patch11_real_standards_master_data_pack.sql
      073_patch12_real_workflow_execution_pack.sql
  src/
    lib/
      realStandardsMasterDataApi.ts
      realWorkflowExecutionApi.ts
    pages/
      RealStandardsMasterDataCenter.tsx
      RealWorkflowExecutionCenter.tsx
```

## Apply

```powershell
cd C:\Users\molte\Downloads

Remove-Item -Recurse -Force "C:\Users\molte\Downloads\patch1112_grc_changes" -ErrorAction SilentlyContinue

Expand-Archive -Path "C:\Users\molte\Downloads\grc_patch1112_real_standards_workflow_execution.zip" -DestinationPath "C:\Users\molte\Downloads" -Force

cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b patch-11-12-real-standards-workflow-execution

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch1112_grc_changes\scripts\apply-patch1112.ps1"
```

If you copied scripts into the repo `scripts` folder, this also works after extraction:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center\scripts\apply-patch1112.ps1"
```

The script still expects the extracted patch folder here:

```text
C:\Users\molte\Downloads\patch1112_grc_changes
```

## Verify

```powershell
cd C:\Users\molte\Downloads\grc-control-center

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch1112_grc_changes\scripts\verify-patch1112.ps1"
```

Full gate:

```powershell
npm ci
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

## Supabase

Local:

```powershell
supabase db reset
```

Staging:

```powershell
supabase db push
```

## Expected UI

- Quality/Safety Hub → Standards & Master Data
- GRC Hub → Real Workflow Execution

## Commit

```powershell
git status
git diff --stat

git add supabase/migrations/072_patch11_real_standards_master_data_pack.sql supabase/migrations/073_patch12_real_workflow_execution_pack.sql src/lib/realStandardsMasterDataApi.ts src/lib/realWorkflowExecutionApi.ts src/pages/RealStandardsMasterDataCenter.tsx src/pages/RealWorkflowExecutionCenter.tsx src/App.tsx README.md release/v66 release/v700 release/v64 release/v661

git commit -m "Patch 11-12: add real standards master data and workflow execution"
git push -u origin patch-11-12-real-standards-workflow-execution
```

Then open a PR into `main`.
