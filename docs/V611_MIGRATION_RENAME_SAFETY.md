# Migration Rename Safety

Renaming migration files is safe only before those migrations are applied to a Supabase project.

If a migration was already applied, Supabase migration history may still refer to the original filename. In that case, do not rename silently. Instead, document the numbering issue in the manifest and fix numbering in the next migration sequence.

Recommended default for this project:

- Generate the plan now.
- Do not apply renames to a shared/staging/live database without confirming migration history.
- For a fresh local folder before Supabase deployment, it is acceptable to apply the rename plan.
