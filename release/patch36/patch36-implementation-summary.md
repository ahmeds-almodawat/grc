# Patch 36 Accreditation Operations Completion

Patch 36 exposes Patch 35 accreditation workflow views and workflow RPC actions through a live frontend/API layer.

## Added

- `src/lib/accreditationWorkflowApi.ts`
- `src/pages/AccreditationWorkflowCenter.tsx`
- Quality/Safety hub tab: `Accreditation Workflow`
- `scripts/patch36-accreditation-operations-frontend-proof.mjs`
- Package scripts: `patch36:frontend-proof`, `patch36:all`

## Live Areas

- Executive accreditation workflow summary cards
- Accreditation operations dashboard cards
- Clause owner register
- Active review cycles
- Owner task queue
- Overdue clause tasks
- Reviewer signoff queue
- Department accreditation workload
- Clause blocker summary
- Clause signoff register
- Escalation register
- Ready-for-survey review queue

## Security

- Read access uses Patch 35 security-invoker views through the existing Supabase client.
- State-changing actions are wrapped through the existing privileged action bridge.
- No direct browser RPC calls were added.
- No service-role browser usage was added.
- No migration was required.
