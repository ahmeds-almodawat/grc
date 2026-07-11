# Patch 83H.4: Migration 022 Blocker Analysis

## Statement of Intent
This document provides an analysis of the local migration chain failure caused by migration `022_ultra_release_restore_admin_dictionary.sql`. No fix has been applied. Patch 83H runtime testing remains blocked.

## Root Cause Analysis
- **Exact table creation source:** `supabase/migrations/022_ultra_release_restore_admin_dictionary.sql` (Line 82).
- **Exact columns present immediately before migration 022:** None. The table `restore_dry_run_jobs` does not exist prior to migration 022 in the current local repository state. Migration 016 is missing from the repository history.
- **Exact failing SQL:** 
  ```sql
  update restore_dry_run_jobs
  set
    scenario_name = coalesce(scenario_name, title, 'Restore dry-run'),
    result_summary = coalesce(result_summary, findings),
    started_by = coalesce(started_by, tested_by, created_by),
    finished_at = coalesce(finished_at, completed_at)
  where scenario_name is null
     or result_summary is null
     or started_by is null
     or finished_at is null;
  ```
- **Why PostgreSQL rejects it:** The column `title` does not exist on the table.
- **Whether `title` ever existed:** `title` does not exist in the current migration history prior to 022. It was likely introduced in the missing "Migration 016" referenced in the comments, but that migration has been removed or squashed, causing schema drift between the historical file and the repository state.
- **Whether `scenario_name` already existed:** Yes, `scenario_name` is explicitly created on line 86 of migration 022 within the `CREATE TABLE` statement.

## Production Risks
If migration 022 has already been applied to production, modifying the historical `022_ultra_release_restore_admin_dictionary.sql` file will change its checksum. This can cause `supabase db push` or CI/CD pipelines to fail due to migration history mismatch.

## Remediation Options

### Option A: Modify historical migration 022
Directly delete or comment out the `title`, `findings`, `tested_by`, `created_by`, and `completed_at` references in the `UPDATE` statement.
*Pros:* Cleanest codebase.
*Cons:* Changes historical checksum, potentially breaking `db push` on existing environments unless `supabase migration repair` is run.

### Option B: Create a compatibility migration before 022
Create a migration named `0215_restore_dry_run_compat.sql` that creates the table with the legacy columns.
*Pros:* Does not modify historical files.
*Cons:* Supabase orders migrations lexicographically. A new `0215_` migration would be treated as "unapplied" in production and would execute on the next deployment. It must be written defensively (`CREATE TABLE IF NOT EXISTS`) to avoid failing in production.

### Option C: Create a new clean baseline migration/snapshot
Squash all migrations from 001 to 022 into a single new baseline.
*Pros:* Fixes all historical drift.
*Cons:* High effort, disruptive to all environments, requires resetting migration history everywhere.

### Option D: Use a guarded procedural block inside 022
Wrap the `UPDATE` statement in a `DO $$ BEGIN IF EXISTS...` block.
*Pros:* Makes the migration robust regardless of prior state.
*Cons:* Still requires modifying the historical 022 file, resulting in the same checksum mismatch risk as Option A.

### Option E: Local-only bootstrap compatibility mechanism
Provide a local seed or pre-migration script to mock the table before running `supabase db reset`.
*Pros:* No changes to production migration history.
*Cons:* Hacky, does not fix the broken standard `supabase db reset` command permanently.

## Recommended Safest Option
**Option B (Compatibility Migration Before 022) or Option A (with team alignment on repair).**
If modifying historical migrations is strictly forbidden, **Option B** is the safest. By creating `021_5_restore_dry_run_compat.sql` using `CREATE TABLE IF NOT EXISTS restore_dry_run_jobs (title text, findings text, tested_by uuid, created_by uuid, completed_at timestamptz);`, local environments will correctly build the legacy schema, allowing 022 to pass. When deployed to production, the `IF NOT EXISTS` will gracefully skip execution without modifying the deployed table.

## Stop/Go Gates Before Any Fix
- Confirm whether migration 022 is already applied to production.
- Confirm whether `supabase migration repair` is an acceptable action for production if Option A is chosen.
- Select the authorized remediation path.

## Rollback Strategy
If a fix is applied and causes issues, revert the repository commit to this state. For Option B, delete the `0215` file.

## Impact on Patch 83H and Patch 83I
Patch 83H runtime validation is strictly **BLOCKED** until this migration chain issue is resolved. Therefore, Patch 83I remains strictly blocked as well.

## Explicit Statement
**No fix was applied in Patch 83H.4.** The migration 022 remains unchanged and the local migration chain is still broken.
