# Final Acceptance Test Script

Run these tests before any real company rollout.

## Persona 1 — Employee
Expected:
- Can open My Work.
- Can see assigned tasks only.
- Can submit own OVR.
- Cannot see executive dashboards, other departments, access control, or confidential OVR queues.

## Persona 2 — Department Manager
Expected:
- Can see department projects, milestones, tasks, and OVRs.
- Cannot see unrelated departments.
- Cannot close audit findings without Audit/Governance closure.

## Persona 3 — Quality Reviewer
Expected:
- Can review OVRs.
- Can return OVR for clarification.
- Can request corrective action.
- Can close OVR only after accepted evidence and closure comments.

## Persona 4 — Auditor
Expected:
- Can create and review audit findings.
- Department cannot self-close findings.
- Evidence rejection reopens follow-up.

## Persona 5 — Executive
Expected:
- Can see global command center, critical OVRs, risks, escalations, and pending approvals.
- Cannot bypass self-approval/evidence rules.

## Workflow tests
- Close task without evidence: must block.
- Delay without reason: must block.
- Self-approval: must block.
- Major OVR without Quality closure: must block.
- Export package: must generate CSV/JSON.
- Restore dry-run: must be documented.
