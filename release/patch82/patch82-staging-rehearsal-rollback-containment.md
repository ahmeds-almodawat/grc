# Patch 82 Staging Rehearsal Rollback and Containment

## If Migration Rehearsal Fails In Staging

1. Stop the rehearsal.
2. Preserve migration logs and staging database messages.
3. Capture the migration number, command, operator, timestamp, and error output.
4. Record the failed step in the blocker log.
5. Assign a rollback decision owner.
6. Use the approved staging snapshot or database backup process if rollback is required.
7. Do not proceed to production if blockers exist.

## Before Retry

- Capture failed migration logs.
- Capture current staging migration status.
- Capture application smoke test state.
- Capture RLS verification result.
- Capture privileged bridge verification result.
- Document remediation owner and reviewer.
- Confirm reviewer approval before retry.

## Escalation Path

- Database owner.
- Security owner.
- Application owner.
- Change approver.
- Executive sponsor if production planning is affected.

## Evidence Required Before Retry

- Failure log.
- Containment decision.
- Remediation notes.
- Retest plan.
- Reviewer decision.

Staging rehearsal does not approve production launch. Production deployment requires separate executive approval.
