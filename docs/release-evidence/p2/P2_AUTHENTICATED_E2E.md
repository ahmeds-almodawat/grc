# P2 Authenticated E2E Summary

## Authentication Chain

- Target: local Supabase CLI stack at `127.0.0.1` only.
- Principal: existing disposable review account reused; no user/profile created.
- Method: normal application login form and password grant; no session injection or mock.
- Auth, fresh session, Patch83U frontend contract, privileged capability,
  credential bootstrap, profile bootstrap, RBAC, and `authenticated_active`: PASS.
- Anonymous privileged-action request: HTTP 401.

No password, token, cookie, key, Auth UUID, or browser storage is included in
this evidence.

## Real Local Route Smoke

| Area | Result |
| --- | --- |
| Home / Executive | PASS - governed scoped widgets and executive access |
| Governance / Policy / SOP | PASS - catalogs, navigation, and exact-version contracts |
| Risk | PASS - 23 governed records visible for the review scope |
| Compliance | PASS - 18 governed obligations visible |
| Audit | PASS - 5 engagements and 12 findings; criteria contract fixed and retested |
| CAPA | PASS - route and governed provenance contracts |
| OVR | PASS - route plus rollback-only suggestion/decision/link proofs |
| Training | PASS - authenticated governed route |
| Projects / Evidence | PASS - authenticated governed routes |
| My Work / Approvals | PASS after migration 221 source ACL closure |
| Reports | PASS - route and drill-down contracts covered by full Playwright |
| Administration | PASS for Super Admin; unauthorized persona denial covered |
| Release/readiness routes | PASS for canonical accepted surfaces |

The live browser performed reads only. Mutation semantics were exercised with
rollback-only SQL and deterministic application tests, preserving review data.

## Persona Coverage

The full Playwright suite covers 12 deterministic personas, governed route
matrices, narrow viewport Arabic RTL, viewer/employee administration denials,
and action-scoped governance administration. SQL proofs cover authorized and
unauthorized roles, cross-organization, wrong division/department, and
read-only/inherited-link mutation denials.

