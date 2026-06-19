# v6.4.1 Database Security Static Remediation

This pack responds to the v6.4 audit output:

- RLS: 31 critical, 7 high
- Functions: 5 high
- Views: 44 high

The remediation migration adds explicit RLS protection for high-risk tables, sets sensitive views to `security_invoker=true`, and adds fixed search paths to high-risk privileged functions.

## Conservative policy choice

Tables that had no safe scoped policy are given a deny-all authenticated policy:

```sql
USING (false) WITH CHECK (false)
```

This is intentional. It prevents accidental exposure until the next stage refines policies with real persona tests.

## Next proof step

Static pass is not enough. Run in staging:

```sql
-- apply migrations through 043
-- then execute:
\i supabase/tests/v64_persona_security_tests.sql
```

## Commands

```bash
npm run v64:strict-all
```

Expected static status:

```text
static_ready_pending_staging_persona_sql
```
