# v4.1 Fresh Supabase Install Verifier

Purpose: prove the database can be created cleanly from zero.

Run offline scan:

```bash
node scripts/v41-fresh-supabase-install-verifier.mjs
```

Run online scan after setting Supabase environment variables:

```bash
set VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
set VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
node scripts/v41-fresh-supabase-install-verifier.mjs
```

Fresh Supabase install procedure:

1. Create a new staging Supabase project.
2. Apply migrations in filename order.
3. Run seed functions:
   - `select seed_v42_release_validation_defaults();`
   - plus previous seed functions where needed.
4. Confirm required tables/views/functions exist.
5. Confirm evidence storage bucket exists.
6. Confirm RLS is enabled on sensitive tables.
7. Run RLS persona lab.

Production blocker:

If migrations fail in a fresh Supabase project, do not proceed to pilot.
