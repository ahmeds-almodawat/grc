# v6.6.2 / v6.6.3 Staging Command Pack

This file is for staging evidence capture only. Do not run these steps against production.

## Current purpose

Convert the local technical readiness into real staging proof by applying migrations in a fresh staging Supabase project, running persona/workflow SQL tests, and saving the outputs as evidence.

## Safety rule

Use a fresh staging Supabase project or a disposable staging branch. Do not use live patient, MRN, national ID, or confidential OVR data.

A v6.6.1 run-order file is also available at `release/v661/V661_STAGING_RUN_ORDER.md`.

## Required evidence folder

Save final evidence files here:

```text
release/v66/evidence-attachments/
```

## Required evidence files

1. `staging-migration-log.txt`
2. `01-v64-persona-sql-output.txt`
3. `02-v65-workflow-sql-output.txt`
4. `03-v66-pilot-evidence-sql-output.txt`
5. `restore-dryrun-evidence.txt`
6. `pilot-signoff.md`

## SQL files prepared for staging

- ✅ `release/v662/staging-sql/01-v64-persona-security-tests.sql` from `release/v661/staging-sql/01_v64_persona_security_tests.sql`
- ✅ `release/v662/staging-sql/02-v65-workflow-smoke-tests.sql` from `release/v661/staging-sql/02_v65_workflow_smoke_tests.sql`
- ✅ `release/v662/staging-sql/03-v66-pilot-evidence-tests.sql` from `release/v661/staging-sql/03_v66_controlled_pilot_evidence_tests.sql`

## Staging run order

1. Create or reset a staging Supabase project.
2. Apply all migrations from `supabase/migrations` in order through `045_v66_controlled_pilot_evidence.sql`.
3. Save the migration output/log as:

```text
release/v66/evidence-attachments/staging-migration-log.txt
```

4. Run this SQL in staging and save the output as `01-v64-persona-sql-output.txt`:

```text
release/v662/staging-sql/01-v64-persona-security-tests.sql
```

5. Run this SQL in staging and save the output as `02-v65-workflow-sql-output.txt`:

```text
release/v662/staging-sql/02-v65-workflow-smoke-tests.sql
```

6. Run this SQL in staging and save the output as `03-v66-pilot-evidence-sql-output.txt`:

```text
release/v662/staging-sql/03-v66-pilot-evidence-tests.sql
```

7. Perform the restore dry-run and save the proof as:

```text
release/v66/evidence-attachments/restore-dryrun-evidence.txt
```

8. Complete IT / Quality / Admin approval and save as:

```text
release/v66/evidence-attachments/pilot-signoff.md
```

9. Run:

```powershell
npm run v662:strict-proof
```

## Expected final status

```text
quality_status: ready_for_controlled_pilot_evidence_review
strict_passed: true
```
