# Patch 24 Audit Findings UI Test Plan

## Smoke Tests
1. Open the existing Audit route.
2. Confirm the Audit Findings Workflow Center loads.
3. Confirm the existing New Finding form still opens and closes.
4. Confirm empty states render when the Patch 24 migration is not yet applied.

## Panels
1. Register shows code, title, department, owner, due date, lifecycle and severity.
2. Workflow queue shows response, action plan, evidence and due status.
3. Overdue panel shows overdue response, action, validation or finding due dates.
4. Repeat/systemic panel shows recurrence and systemic markers.
5. Closure gate status shows accepted evidence, waivers, blockers and can-close status.
6. Executive escalation panel shows high/critical, overdue, repeat, systemic and committee-required items.
7. Closure pack index shows response/action/evidence/validator status.
8. Detail modal shows response, action plan, linked risk/compliance, source OVR, closure pack and validation events.

## Actions
Use non-production findings:
1. Issue finding.
2. Submit and accept/reject management response.
3. Submit and accept/reject corrective action plan.
4. Request and approve/reject extension.
5. Request closure.
6. Validate closure with accepted evidence or approved waiver.
7. Reject closure and confirm returned-for-correction status.
8. Reopen with reason.
9. Escalate.
10. Mark repeat/systemic.
11. Link risk and compliance.
12. Generate closure pack index.
