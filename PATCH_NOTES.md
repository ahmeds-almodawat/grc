# v6.7.1 Local Supabase Bootfix Pack

## Replace files

- `supabase/migrations/004_seed_reference_data.sql`

## Add files

- `supabase/migrations/012_ovr_workflow_enum_values.sql`
- `scripts/v671-install-local-supabase-bootfix-scripts.mjs`
- `scripts/v671-disable-invalid-012a-migration.mjs`
- `scripts/v671-local-supabase-migration-audit.mjs`
- `docs/V671_LOCAL_SUPABASE_BOOTFIX.md`
- `PATCH_NOTES.md`

## Manual deletion/disable handled by script

The install flow moves this invalid Supabase migration filename out of the migrations folder if it exists:

- `supabase/migrations/012a_ovr_workflow_enum_values.sql`

It is backed up to:

- `release/v671/disabled-invalid-migrations/012a_ovr_workflow_enum_values.sql.disabled`

## Commands

```powershell
node scripts/v671-install-local-supabase-bootfix-scripts.mjs
npm run v671:all
supabase stop --no-backup
supabase start
```

## Purpose

Fix local Supabase boot/reset blockers without changing runtime React app files, auth, tests, or evidence logic.
