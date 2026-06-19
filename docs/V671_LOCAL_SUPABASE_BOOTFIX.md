# v6.7.1 Local Supabase Bootfix

This pack fixes the first local Supabase reset/start blocker found during `supabase start`.

## Fixes

1. Replaces `supabase/migrations/004_seed_reference_data.sql` with explicit enum casts for seeded risk, project, and compliance rows.
2. Adds a valid Supabase CLI migration filename:
   - `supabase/migrations/012_ovr_workflow_enum_values.sql`
3. Moves the invalid filename out of the migrations folder:
   - from `supabase/migrations/012a_ovr_workflow_enum_values.sql`
   - to `release/v671/disabled-invalid-migrations/012a_ovr_workflow_enum_values.sql.disabled`

## Why

Supabase local CLI skipped `012a_...` because migration names must start with a numeric timestamp/prefix followed by `_name.sql`.

Postgres also rejected the seed rows in migration 004 because a `UNION ALL` query inferred enum literals as text before insertion.

## Run

```powershell
node scripts/v671-install-local-supabase-bootfix-scripts.mjs
npm run v671:all
supabase stop --no-backup
supabase start
```

## Expected

- Migration 004 should no longer fail on `risk_category` text casts.
- Migration 012 should be applied instead of skipped.
- Local Supabase should continue past migration 004.

If a later migration fails, capture the new error and fix that specific migration next.
