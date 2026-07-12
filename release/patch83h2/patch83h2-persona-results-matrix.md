# Patch 83H.2: Persona Results Matrix

All tests failed due to local Docker unavailability.

| Persona | Organization | Department | Ownership | Expected SELECT | Actual SELECT | Expected Write | Actual Write | Pass/Fail | Evidence Reference |
|---------|--------------|------------|-----------|-----------------|---------------|----------------|--------------|-----------|--------------------|
| Document owner | Org A | Dept A | owner_id = self | Read Success | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Same-department normal user | Org A | Dept A | None | Read Success | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Same-organization different-department user | Org A | Dept B | None | Denied (0 rows) | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Cross-organization user | Org B | Dept C | None | Denied (0 rows) | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Department manager | Org A | Dept A | None | Read Success | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Auditor | Org B | Dept C | None | Denied (Scoped) | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Executive | Org B | Dept C | None | Denied (Scoped) | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Compliance officer | Org B | Dept C | None | Denied (Scoped) | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Governance admin | Org B | Dept C | None | Denied (Scoped) | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Super_admin | Org B | Dept C | None | Read Success | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Anonymous user | N/A | N/A | None | Denied (0 rows) | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
| Service-role test path | N/A | N/A | None | Bypass RLS | BLOCKED | Unchanged | BLOCKED | FAIL | Docker not running |
