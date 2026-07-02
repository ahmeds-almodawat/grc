# Patch 23 Evidence Business Rules

1. Evidence can be linked to multiple workflow items through `evidence_links`.
2. Closure, approval, acceptance, treatment and audit gates are satisfied only by accepted, current, non-expired evidence.
3. Missing or insufficient evidence leaves the gate pending, partially satisfied, or overdue.
4. Rejected evidence sets `revision_required = true` and cannot satisfy an active gate.
5. A superseded evidence record is no longer the current version.
6. Locked evidence cannot be modified through the governed bridge except by an authorized admin or owner path.
7. Sensitive or highly sensitive evidence must include a classification reason.
8. The uploader cannot accept their own evidence unless an explicit privileged role path allows it.
9. Expired evidence does not satisfy active gates unless a non-expired approved waiver exists.
10. Waivers require a reason, approver, audit note and optional expiry.
11. Every governed state transition writes an `evidence_review_events` row.
12. The pack index identifies linked item, evidence, review status, reviewer and timestamps for audit, board and regulatory packs.

## Integration Gate Examples
- OVR: containment proof, RCA proof, CAPA proof and closure proof.
- Risk: treatment completion, acceptance support, control effectiveness and closure approval.
- Audit findings: corrective action completion, management response proof and closure proof.
- Compliance: regulatory obligation proof, license or certificate renewal proof and policy acknowledgment proof.
- Projects and tasks: milestone completion, task closure and deliverable proof.
