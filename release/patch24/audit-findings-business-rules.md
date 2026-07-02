# Patch 24 Audit Findings Business Rules

1. Issued findings require management response unless explicitly waived.
2. Management response requires accountability and a due date.
3. Corrective action plans require an owner and due date before audit acceptance.
4. High or critical overdue findings require executive visibility.
5. Repeat or systemic findings require committee review or executive escalation.
6. Closure requires accepted response, accepted or completed corrective action, and auditor validation.
7. If evidence is required, closure also requires accepted current evidence or an approved non-expired Patch 23 waiver.
8. Rejected closure returns the finding to correction status.
9. Due date extension requires reason and approval.
10. Reopen requires reason and validation event.
11. Every governed transition writes `audit_finding_validation_events`.
12. Repeat findings can link back to the original finding.
13. Closure pack index includes finding, response status, action status, evidence status, validator and timestamp.

## Integration Rules
- Evidence Bridge: closure gate uses accepted evidence and approved waivers.
- Risk: findings can link to risks and trigger reassessment attention.
- Compliance: findings can link to compliance obligations or gaps.
- Projects/CAPA: corrective action ownership and due dates support project/task follow-up where existing schema links exist.
- OVR: findings can store source OVR references.
