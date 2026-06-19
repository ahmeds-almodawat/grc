# v6.6.1 Staging Run Order

Generated: 2026-06-18T21:32:28.382Z

## Migration status

- Migration count: **45**
- Latest migration: **045_v66_controlled_pilot_evidence.sql**
- Required latest migration present: **yes**

## Required SQL proof files

- ✅ `supabase/tests/v64_persona_security_tests.sql`
- ✅ `supabase/tests/v65_workflow_smoke_tests.sql`
- ✅ `supabase/tests/v66_controlled_pilot_evidence_tests.sql`

## Staging execution order

1. Create or reset a staging Supabase project.
2. Apply all migrations in supabase/migrations in filename order.
3. Run seed functions only if the migration/runbook explicitly requires them for non-production staging setup.
4. Run v64 persona SQL tests.
5. Run v65 workflow smoke SQL tests.
6. Run v66 controlled pilot evidence SQL tests.
7. Attach screenshots/log exports under release/v66/evidence-attachments/.
8. Run npm run v661:strict-proof.

## Evidence capture rule

Do not mark controlled pilot ready until the SQL output, restore dry-run evidence, and named signoff files are attached in `release/v66/evidence-attachments/`.
