# Patch 83H.1: Persona Test Matrix

| Persona | Organization | Division | Department | Ownership Relationship | Expected SELECT Result | Expected Write Result | Actual Result | Pass/Fail | Evidence Reference |
|---------|--------------|----------|------------|------------------------|------------------------|-----------------------|---------------|-----------|--------------------|
| Document owner | Org A | Div A | Dept A | owner_id = self | Success (Can Read) | Unchanged (Policy unaffected) | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Same-department normal user | Org A | Div A | Dept A | None | Success (Can Read) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Same-organization different-department user | Org A | Div A | Dept B | None | Denied (0 rows) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Cross-organization user | Org B | Div B | Dept C | None | Denied (0 rows) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Department manager | Org A | Div A | Dept A | None | Success (Can Read) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Auditor | Org B | Div B | Dept C | None | Denied (Scope Controlled) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Executive | Org B | Div B | Dept C | None | Denied (Scope Controlled) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Compliance officer | Org B | Div B | Dept C | None | Denied (Scope Controlled) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Governance admin | Org B | Div B | Dept C | None | Denied (Scope Controlled) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Super_admin | Org B | Div B | Dept C | None | Success (Global Bypass) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Anonymous user | N/A | N/A | N/A | None | Denied (0 rows / Auth required) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| Service-role test path | N/A | N/A | N/A | None | Success (Bypass RLS) | Unchanged | `[PENDING]` | `[PENDING]` | `[PENDING]` |
