# GRC platform baselines

`grc_platform_baseline_v1_through_184.sql` is a superseded Gate 11 candidate. It is retained for provenance and is not approved for deployment.

`grc_platform_baseline_v2_through_185.sql` is the immutable RC1 baseline. It remains release-approved for the post-185 catalog, but RC2 supersedes it for new environments.

`grc_platform_baseline_v3_through_187.sql` is the immutable RC2 baseline. It represents the stable converged catalog after migration 187, creates only a fail-closed runtime seed, creates no administrator or tenant data, and binds the first shared forward migration to 188. Its manifest is the authority for the SQL hash, catalog fingerprint, and bootstrap contract.

For a new empty environment, apply the currently approved baseline once to a Supabase-compatible PostgreSQL 17 project using the release baseline-workdir builder, then use forward migrations beginning at the manifest's `first_future_migration_number`. For an existing environment, never apply a baseline: validate lineage and catalog drift, then use the exact modern or production-bridge forward-migration workdir.

Do not edit a released baseline. Corrections require a new baseline version and forward migrations. Do not use manual migration-history writes, `migration repair`, or a baseline against an existing legacy environment.
