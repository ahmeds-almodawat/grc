# Patch 83H.8: Clean Local Baseline Design

## 1. Problem Statement
The local migration chain is permanently broken at `022_ultra_release_restore_admin_dictionary.sql` because the original migration `016_rollout_onboarding_user_guides.sql` (which created the table `restore_dry_run_jobs` and the `title` column) was renamed to `055_rollout_onboarding_user_guides_compat.sql`. As a result, fresh local `supabase db reset` commands fail because 055 executes too late to satisfy 022's dependencies.

## 2. Verified Remote Migration History
- `016_` is **missing remotely**.
- `022_` is **applied remotely**.
- `055_` is **applied remotely**.
- `166_` is **local-only** and unapplied remotely.

## 3. Why Restoring 016 is Unsafe
Restoring the original 016 from commit `f2271a3` would insert an unapplied migration chronologically earlier than the latest remote migration (`121_`). This out-of-order sequence risks breaking CI/CD pipelines during `supabase db push` by triggering strict out-of-order migration rejection errors or creating a duplicate execution state on the remote.

## 4. Why a Partial Pre-022 Stub is Unsafe
Creating a `021_5` compat migration to mock the `restore_dry_run_jobs` table would also be an out-of-order migration (older than 121 but unapplied remotely), thereby introducing the exact same CI/CD deployment risks as restoring 016.

## 5. Why Editing 022 is Unsafe
Editing the historical `022_` migration directly alters its checksum hash. Because `022_` is already applied remotely, any subsequent `supabase db push` will fail with a checksum mismatch error unless manually reconciled using `supabase migration repair`.

## 6. Why a High-Numbered Corrective Migration Fails
A high-numbered migration (e.g., `167_`) executes at the end of the chain. It cannot prevent `supabase db reset` from crashing halfway through the sequence when `022_` executes.

## 7. Baseline Architecture
To bypass the broken historical chain strictly locally, we will adopt **Design E**: Generate a schema dump from a verified non-production clone of the cloud database, sanitize it, and load it into a clean local Supabase container as a bootstrap baseline. This bypasses the historical migration files entirely on local startup without altering the remote history.

## 8. Local-only Safety Gate
A strict execution guard will be placed in the bootstrap script:
- Fail closed unless host is `localhost` or `127.0.0.1`.
- Reject any project ref containing `zbrjjecpsrzposhuarcn`.
- Do not execute if `SUPABASE_ENV` is set to production.

## 9. Baseline Generation Method
The baseline SQL will be extracted using `pg_dump` from a sanitized staging/dev clone of the remote database, omitting sensitive user data and credentials, ensuring only schema and seed configuration data are retained.

## 10. Schema Checksum Strategy
We will generate an MD5 checksum of the baseline SQL file. The local bootstrap loader will verify this hash before executing to ensure no silent manual tampering has occurred.

## 11. Drift Detection Strategy
The bootstrap script will compare a list of critical tables and RLS policies (e.g., `document_center_items`, `restore_dry_run_jobs`) between the baseline and the expected schema definitions.

## 12. Required Schema Verification After Load
After loading the baseline, the script must query the local `pg_class` and `pg_policies` to verify that `restore_dry_run_jobs` exists with the `title` column, and that `document_center_items` has its standard policies before `166_` applies.

## 13. How Migration 166 will be Applied Locally
Once the baseline schema is successfully bootstrapped, `supabase db reset` will NOT be used to apply migrations. Instead, `supabase migration up` will be used to explicitly apply only the pending local migrations (e.g., `166_`) on top of the baseline schema.

## 14. Persona Test Execution Path After Baseline Load
After `166_` applies, the local runtime safety harness (`patch83h1`) will run, executing persona-based queries (e.g., `executive`, `auditor`) against the local baseline to prove RLS remediation effectiveness.

## 15. Cleanup and Reset Behavior
The local container can be purged using `supabase stop --no-backup` and rebuilt cleanly from the baseline at any time.

## 16. CI Integration Option
The CI pipeline will ignore the local baseline and continue deploying normally, using `supabase db push`, because the remote environments already have the full intact schema and are not subject to the `db reset` bug.

## 17. Rollback Strategy
If the baseline approach fails, simply delete the bootstrap scripts. No remote environment or historical migration file has been altered, ensuring a zero-impact rollback.

## 18. Exact Implementation Sequence for Patch 83H.9
1. Generate/verify local baseline SQL (sanitized).
2. Create local bootstrap runner script (`scripts/bootstrap-local-baseline.sh` or `.mjs`).
3. Add safety gates (localhost only, checksum, reject production ref).
4. Run bootstrap script locally.
5. Apply migration 166 explicitly (`supabase migration up`).
6. Re-run Patch 83H.3 persona testing.

## 19. Stop/Go Gates
- **STOP:** If the script detects execution against a remote host or production ref.
- **GO:** If baseline applies cleanly, checksum matches, and `166_` executes without errors.

## 20. Patch 83I Gate
Patch 83I remains strictly **blocked**.

## 21. Explicit Statement
**No repair applied.** No changes were made to migration files or the cloud database.
