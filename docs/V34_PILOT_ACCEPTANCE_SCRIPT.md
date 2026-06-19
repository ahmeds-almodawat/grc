# v3.4 Pilot Acceptance Script

## Test 1 — Employee workspace
- Login as employee.
- Confirm user sees only own assigned tasks and own submitted OVRs.
- Confirm user cannot see executive dashboard data.

## Test 2 — Department manager
- Login as department manager.
- Confirm manager sees department projects/tasks/OVRs only.
- Confirm manager cannot close audit findings without audit/quality approval.

## Test 3 — OVR workflow
- Submit OVR.
- Supervisor adds investigation.
- Quality confirms severity.
- Create corrective action project.
- Upload evidence.
- Quality closes OVR.

## Test 4 — Evidence closure
- Try to close project without evidence.
- Expected: blocked.

## Test 5 — Export backup
- Create export package.
- Review JSON/CSV output.
- Record backup health status.
