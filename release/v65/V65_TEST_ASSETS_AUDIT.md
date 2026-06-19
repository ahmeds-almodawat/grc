# v6.5 Test Assets Audit

```json
{
  "generated_at": "2026-06-18T19:38:10.640Z",
  "checks_total": 6,
  "missing_count": 0,
  "strict_passed": true,
  "note": "This verifies test assets and proof artifacts exist. It does not replace running Vitest, Playwright, or Supabase SQL tests."
}
```

## Checks

- ✅ unit test asset: `tests/unit/v65-live-result.test.ts` (1366 bytes)
- ✅ browser auth smoke asset: `tests/e2e/v65-auth-navigation.spec.ts` (980 bytes)
- ✅ browser workflow smoke asset: `tests/e2e/v65-core-workflows.spec.ts` (878 bytes)
- ✅ SQL staging workflow asset: `tests/sql/v65_workflow_smoke_tests.sql` (1524 bytes)
- ✅ Supabase persona asset: `supabase/tests/v64_persona_security_tests.sql` (3132 bytes)
- ✅ v6.4 proof summary: `release/v64/v64-database-security-proof-summary.json` (367 bytes)
