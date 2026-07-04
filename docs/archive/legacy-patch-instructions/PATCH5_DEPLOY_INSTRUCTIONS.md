# Patch 5 — Workflow Kernel

## Purpose

Patch 5 adds the shared workflow engine needed before building deeper accreditation, quality, audit, risk, and compliance workbenches.

It creates one operating backbone for:

- Owner / reviewer / approver routing
- Status, priority, due dates, and SLA
- Assignments and delegation
- RACI
- Comments and attachments
- Activity / approval history
- Escalations and notifications
- Module-wide workflow coverage

It also exposes the Patch 4 Audit & Evidence Integrity page in the Admin hub if it is still missing.

## Apply

Extract this ZIP to:

```text
C:\Users\molte\Downloads
```

Then run:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b patch-5-workflow-kernel

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch5_grc_changes\scripts\apply-patch5.ps1"
```

## Verify

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch5_grc_changes\scripts\verify-patch5.ps1"
```

Full manual check:

```powershell
npm ci
npm run typecheck
npm run build
npm run test:unit
npx playwright install --with-deps
npm run test:e2e
npm audit --audit-level=high
npm run proof:all
npm run v672:capture
npm run v700:v65-audit
```

## Supabase

For local reset:

```powershell
supabase db reset
```

For linked staging:

```powershell
supabase db push
```

## Commit

```powershell
git status
git diff --stat

git add supabase/migrations/066_patch5_workflow_kernel.sql src/lib/workflowKernelApi.ts src/pages/WorkflowKernelCenter.tsx src/App.tsx release/v66 release/v700 release/v661

git commit -m "Patch 5: add shared workflow kernel"
git push -u origin patch-5-workflow-kernel
```

Open PR into `main`.

## Expected result

- Typecheck passes.
- Build passes.
- Unit tests pass.
- `proof:all` remains passing.
- GRC hub shows **Workflow Kernel**.
- Admin hub shows **Audit & Evidence Integrity**.

## Important limitation

Patch 5 is infrastructure. It does not automatically create professional workflows inside every module. Patch 6 and Patch 7 should use this kernel to build the real accreditation, quality, audit, risk, and compliance workbenches.
