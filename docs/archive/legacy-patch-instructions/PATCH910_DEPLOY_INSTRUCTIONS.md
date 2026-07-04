# Patch 9+10: Runtime Actions + Real Data UAT Readiness

## Purpose

This combined patch adds the next two operating layers after Patch 7+8:

1. **Patch 9 — Runtime Workflow Actions, Notifications, and Escalations**
   - Action catalog
   - Transition rules
   - Action requests
   - Action decisions
   - Bulk operations
   - Notification rules
   - Escalation rules
   - SLA calendars
   - Integration outbox
   - Runtime exceptions
   - Command log
   - GRC Hub tab: **Runtime Actions**

2. **Patch 10 — Real Data Activation and UAT Readiness**
   - Import batches
   - Import files
   - Validation rules/results
   - Mapping sets/items
   - Load approvals
   - UAT cycles/scenarios/runs/findings
   - Training records
   - Department signoffs
   - Go/no-go checklist
   - Admin Hub tab: **Real Data & UAT**

The patch does not load demo data or copyrighted standards text.

## Apply

```powershell
cd C:\Users\molte\Downloads

Remove-Item -Recurse -Force "C:\Users\molte\Downloads\patch910_grc_changes" -ErrorAction SilentlyContinue

Expand-Archive -Path "C:\Users\molte\Downloads\grc_patch910_runtime_actions_real_data_uat.zip" -DestinationPath "C:\Users\molte\Downloads" -Force

cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b patch-9-10-runtime-actions-real-data-uat

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch910_grc_changes\scripts\apply-patch910.ps1"
```

If you copied scripts into the repo `scripts` folder, this also works after extraction:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center\scripts\apply-patch910.ps1"
```

The script will still search for the extracted patch folder here:

```text
C:\Users\molte\Downloads\patch910_grc_changes
```

## Verify

```powershell
cd C:\Users\molte\Downloads\grc-control-center

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch910_grc_changes\scripts\verify-patch910.ps1"
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

## Commit

```powershell
git status
git diff --stat

git add supabase/migrations/070_patch9_runtime_workflow_actions_escalations.sql supabase/migrations/071_patch10_real_data_activation_uat_readiness.sql src/lib/runtimeWorkflowActionsApi.ts src/lib/realDataUatReadinessApi.ts src/pages/RuntimeWorkflowActionsCenter.tsx src/pages/RealDataUatReadinessCenter.tsx src/App.tsx README.md release/v66 release/v700 release/v64 release/v661

git commit -m "Patch 9-10: add runtime actions and real data UAT readiness"
git push -u origin patch-9-10-runtime-actions-real-data-uat
```

Open a PR into `main`.
