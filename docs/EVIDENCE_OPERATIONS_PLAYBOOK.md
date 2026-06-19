# Evidence Operations Playbook

## Purpose

The GRC Control Center uses evidence packs to distinguish technical readiness from human approval and production readiness.

## Evidence types

### Static evidence

- TypeScript checks.
- Build checks.
- Static RLS scans.
- Static function and view audits.

### Runtime/local evidence

- Local Supabase SQL evidence capture.
- Restore dry-run.
- Authenticated persona proof.
- Runtime bridge audit.

### Human evidence

- Management/Admin pilot approval.
- IT pilot approval.
- Quality pilot approval.
- IT confidentiality confirmation.
- Quality confidentiality confirmation.

## Current gate structure

The platform can be technically ready while still blocked by human approval.

That is the correct safety posture.

## Evidence refresh rules

Refresh evidence only when:

1. Runtime/security behavior changes.
2. Migration behavior changes.
3. Approval status changes.
4. A controlled release milestone is being prepared.

Avoid committing regenerated evidence from incidental local test runs.

## Final pre-pilot proof flow

After real approvals are completed:

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```

Expected final pilot readiness:

```text
proof:all = fully passed
```

## Production proof rule

Controlled-pilot readiness is not production readiness. Production proof requires staging/live validation, operational approval, and a rollback plan.
