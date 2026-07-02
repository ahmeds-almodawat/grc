# Patch 22 Risk Business Rules

Patch 22 turns risk records into governed workflow items. The rules are enforced in `patch22_risk_workflow_bridge` and surfaced through Patch 22 views.

## Scoring

- Inherent score remains the existing generated score from likelihood x impact.
- Residual score remains the existing generated score from residual likelihood x residual impact.
- Score changes require a reason.
- Any score change writes `risk_reassessment_history`.
- Residual score changes recalculate risk level, appetite breach state, treatment need, escalation need, and executive visibility.

## Appetite and Treatment

- Risks above appetite are marked with `appetite_breached`.
- High residual risks require a treatment plan unless formally accepted.
- Treatment can be planned, moved in progress, completed, overdue, or accepted.
- Treatment overdue and treatment-required risks appear in workflow queues.

## Acceptance

- Risk acceptance requires a reason and expiry date.
- Acceptance approval is limited to authorized governance roles.
- Accepted risks return to review by the earlier of the requested expiry date or 90 days.
- Rejected acceptance returns the risk to review.

## Review and Escalation

- Overdue reviews remain visible in the workflow queue.
- High and critical risks are escalated automatically.
- Critical or very high residual risks become executive visible unless explicitly governed by override fields.

## Closure

Closure is blocked when any required governance item remains unresolved:

- Treatment is required and not completed or accepted.
- Acceptance is required and not approved.
- Closure evidence is required and no closure reason is recorded.
- A critical KRI alert is active.
- The risk review is overdue.

## Reopen and Duplicates

- Reopen requires a reason and writes a workflow event.
- Duplicate or related risk marking keeps the source risk intact and records the relationship.
- Source linkage supports OVR, audit finding, compliance item, and project ids without changing those modules.

