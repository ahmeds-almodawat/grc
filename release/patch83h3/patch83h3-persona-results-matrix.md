# Patch 83H.3: Persona Results Matrix

All tests failed due to local Supabase database reset failure (migration 022 error).

| Persona | Organization | Department | Ownership | Expected SELECT | Actual SELECT | Expected Write | Actual Write | Pass/Fail | Evidence Reference |
|---------|--------------|------------|-----------|-----------------|---------------|----------------|--------------|-----------|--------------------|
| Document owner | Org A | Dept A | owner_id = self | Read Success | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Same-department normal user | Org A | Dept A | None | Read Success | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Same-organization different-department user | Org A | Dept B | None | Denied (0 rows) | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Cross-organization user | Org B | Dept C | None | Denied (0 rows) | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Department manager | Org A | Dept A | None | Read Success | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Auditor | Org B | Dept C | None | Denied (Scoped) | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Executive | Org B | Dept C | None | Denied (Scoped) | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Compliance officer | Org B | Dept C | None | Denied (Scoped) | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Governance admin | Org B | Dept C | None | Denied (Scoped) | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Super_admin | Org B | Dept C | None | Read Success | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Anonymous user | N/A | N/A | None | Denied (0 rows) | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
| Service-role test path | N/A | N/A | None | Bypass RLS | BLOCKED | Unchanged | BLOCKED | FAIL | DB reset failed |
