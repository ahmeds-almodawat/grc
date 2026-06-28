# v11.0.1 Migration Hotfix

This hotfix replaces one invalid foreign key reference in:

`supabase/migrations/053_v110_enterprise_grc_program_suite.sql`

## Problem

The original v11.0 migration referenced:

`public.evidence_items(id)`

but the project schema uses:

`public.evidence_files(id)`

## Apply

Copy/replace the fixed file into the same path, then run:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
supabase db push --local
```

If Supabase still mentions an older-order local migration, use:

```powershell
supabase db push --local --include-all
```

Then validate:

```powershell
npm run pilot:v110-enterprise
npm run pilot:v100-foundation
npm run pilot:uat-readiness
npm run proof:all
```

Expected final proof remains failed only at `v66:strict-proof` until real manual approvals are completed.
