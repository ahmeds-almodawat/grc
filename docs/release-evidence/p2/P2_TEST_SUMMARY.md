# P2 Test Summary

| Validation | Result |
| --- | --- |
| `npm run lint:types` | PASS |
| `npm run test:unit` | PASS - 109 files, 2199/2199 |
| SQL proofs | PASS - 9/9, transaction rollback where applicable |
| `npm run test:e2e` | PASS - 95/95 |
| `npm run build` | PASS |
| `npm run verify:migrations` | PASS through migration 222 |
| Patch83U Auth-surface audit | PASS |
| Strict RLS/view audits | PASS - no critical/high findings |
| Runtime security bridge | PASS |
| `npm run v62:static-strict` | PASS - 0 blocking findings |
| `npm audit --omit=dev --audit-level=high` | PASS - 0 vulnerabilities |
| `npm ci --ignore-scripts --dry-run` | PASS - lock consistent |
| Secret/credential scan | PASS after false-positive adjudication |
| Real local authenticated browser chain | PASS |
| `git diff --check` | PASS |

The focused desktop topbar test passed five repeated runs after the Linux CI
font-metric wrap was corrected; the complete UI-1 light/dark/mobile/RTL spec
also passed.

The Vite build reports only the existing large-chunk advisory; compilation and
asset emission complete successfully.
