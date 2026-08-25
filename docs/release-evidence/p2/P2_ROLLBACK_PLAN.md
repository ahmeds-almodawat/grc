# P2 Rollback And Recovery Plan

| Component | Recovery model |
| --- | --- |
| Frontend | Redeploy the previous immutable artifact; verify Auth/bootstrap and route smoke |
| Edge Function | Redeploy the previous versioned function; keep privileged RPCs unavailable until contract parity is restored |
| Migrations 220-222 | Prefer forward-fix. They change ACL/view metadata; restore prior explicit grants/view definition only from reviewed SQL if immediate containment is required |
| P1 governance-link objects | Preserve governed data and append-only history; use forward-fix migrations, never destructive table rollback |
| RLS/grants | Fail closed first, then apply a reviewed forward grant/policy correction with positive and negative scope proofs |
| Readiness objects | Revoke browser access to the affected view while preserving underlying data, then forward-fix the trusted contract |

Before any recovery action, capture the migration ledger, failing request/error,
current artifact/function versions, and data-preservation snapshot. Never use a
review-database reset, delete volumes, rewrite migration history, or weaken RLS
as rollback. Escalate any business-data inconsistency as a release stop.

