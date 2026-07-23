# GRC platform baselines

`grc_platform_baseline_v1_through_184.sql` is a Gate 11 candidate captured outside `supabase/migrations`, so normal `supabase db push` cannot apply it to an existing environment.

It is **not approved for release**. Although it bootstraps cleanly and reproduces the normalized staging catalog exactly, that catalog contains two unrestricted anonymous read policies. Gate 11 therefore remains blocked. The manifest deliberately sets `candidate_only: true` and `immutable: false`.

For a new empty environment, a future approved baseline must be applied once to a Supabase-compatible PostgreSQL 17 project before forward migrations. For an existing environment, never apply a baseline: validate drift and apply reviewed forward migrations only.

Do not edit a released baseline. Corrections require a new baseline version and forward migrations. Migration-history initialization is also unresolved for this candidate; do not use manual migration-history writes or `migration repair` without a separate reviewed procedure and authorization.
