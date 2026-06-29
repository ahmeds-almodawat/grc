# Codex commands for Patch 5

## Main TypeScript / integration fix

```powershell
codex exec "Fix TypeScript or App.tsx integration errors caused by Patch 5 only. Keep the workflow kernel migration, workflowKernelApi, WorkflowKernelCenter page, GRC hub Workflow Kernel tab, and Admin hub Audit & Evidence Integrity tab. Do not remove Patch 1, Patch 2, Patch 3, or Patch 4 files. Do not add mock/demo data. Run npm run typecheck and npm run build after fixing."
```

## If Workflow Kernel tab is missing

```powershell
codex exec "In src/App.tsx, add WorkflowKernelCenter as a visible GRC hub tab named 'Workflow Kernel'. Use the existing WorkflowKernelCenter page. Place it near Operating Core. Do not remove existing tabs. Run npm run typecheck after fixing."
```

## If Patch 4 Audit & Evidence tab is missing

```powershell
codex exec "In src/App.tsx, ensure AuditEvidenceGovernanceCenter is imported and add a visible Admin hub tab named 'Audit & Evidence Integrity'. Use the existing AuditEvidenceGovernanceCenter page. Place it near Production Proof. Do not remove existing tabs. Run npm run typecheck after fixing."
```

## If SQL migration fails

```powershell
codex exec "Fix SQL errors in supabase/migrations/066_patch5_workflow_kernel.sql only. Preserve org-scoped RLS, security_invoker views, no demo data, workflow templates, steps, instances, assignments, actions, comments, attachments, SLA, escalations, RACI, and notifications. Do not create broad public policies. Validate syntax and explain the fix."
```

## Full verification after fixing

```powershell
npm run typecheck
npm run build
npm run test:unit
npm run test:e2e
npm audit --audit-level=high
npm run proof:all
```
