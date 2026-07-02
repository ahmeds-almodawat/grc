# Patch 22 Risk UI Test Plan

## Smoke Tests

1. Open the Risk page through the existing Risk route.
2. Confirm the Risk register still renders existing records.
3. Confirm the Patch 22 workflow queues panel renders.
4. Confirm appetite breaches, treatment queue, KRI alerts, executive escalations, and closure blockers render without blocking the page when the migration is not applied yet.
5. Open a risk workflow detail modal.
6. Confirm score, appetite, owners, linked sources, treatment, acceptance, review dates, reassessment history, and workflow events are visible.

## Action Tests

Run these with an authorized governance role:

1. Reassess risk with a change reason.
2. Request acceptance with reason and expiry date.
3. Approve acceptance.
4. Reject acceptance on another test record.
5. Update treatment plan.
6. Complete treatment.
7. Request closure with reason.
8. Attempt closure while a blocker exists and confirm a clear error is shown.
9. Approve closure after blockers are resolved.
10. Reopen a closed risk with reason.
11. Link an OVR, audit finding, compliance item, or project source.
12. Mark a duplicate or related risk.

## Role Tests

- Authorized governance roles can run workflow actions through the Edge bridge.
- Risk, control, treatment, and executive owners can perform owner-scoped actions.
- Unauthorized users can read only records permitted by RLS and cannot execute privileged workflow actions.

## Compatibility Tests

- Existing Risk creation still works.
- Existing v170 risk panels still render.
- Existing OVR, audit, compliance, and project routes are not changed by source linking.

