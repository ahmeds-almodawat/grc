# Patch 83H.1: RLS Runtime Validation Plan

## Statement of Intent
This plan outlines the testing requirements for the Patch 83H migration.
- Patch 83H migration has not been approved for production.
- Runtime testing must occur only locally or in dedicated staging.
- No production database change is authorized.
- No new migration is introduced.
- Migration 166 is not modified.
- Expansion to Patch 83I is blocked until all required 83H.1 tests pass.
- No production-readiness claim is made.

## Coverage Checklist
The runtime validation must cover:
1. Migration compilation test.
2. Policy existence check.
3. Old broad policy absence.
4. New scoped policy presence.
5. Owner read access.
6. Same-scope user read access.
7. Cross-department denial.
8. Cross-organization denial where supported.
9. Super-admin read access.
10. Auditor scope-controlled access.
11. Executive scope-controlled access.
12. Compliance/governance scope-controlled access.
13. Anonymous denial.
14. Write behavior unchanged.
15. Service-role behavior unchanged.
16. Application query compatibility.
17. Rollback test in an isolated environment.
18. Policy inventory before and after.
19. No unexpected table changes.
20. Final pass/fail evidence.
