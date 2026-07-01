# Patch 20 Real Import Orchestrator

Patch 20 adds one staging-first import path for the reviewed GRC import-ready pack. It replaces one-file-at-a-time manual loading with a dry-run-first CLI workflow, report outputs, a staging ledger, and a visible Admin Hub runner.

## Input Pack

Default folder:

```powershell
C:\Users\molte\Downloads\grc_import_ready_pack_after_review
```

Expected files:

```text
01_departments.csv
02_committees.csv
03_role_matrix.csv
04_users_owners.csv
05_evidence_taxonomy.csv
06_control_library.csv
07_kpi_indicators.csv
08_tracer_templates.csv
09_audit_universe.csv
10_compliance_obligations.csv
11_document_register.csv
12_standards_metadata.csv
13_uat_scenarios.csv
14_go_no_go_signoffs.csv
15_payroll_department_map.csv
```

## Dry-Run

Run this from the repo root:

```powershell
node scripts/import-real-grc-pack.mjs --dry-run --folder "C:\Users\molte\Downloads\grc_import_ready_pack_after_review"
```

Dry-run does not write to the database. It validates required files, flexible column names, duplicate codes, duplicate emails, email formats, department/user/committee references, platform role names, status values, date formats, generated emails, payroll-discovered departments, import order, and long standards text risk.

If the folder is not visible to the current process, the dry-run writes an environment-precheck report with zero blocking errors and `can_apply: false`. Rerun dry-run after the folder is available.

## Apply

Default apply mode does not create Supabase Auth users:

```powershell
node scripts/import-real-grc-pack.mjs --apply --folder "C:\Users\molte\Downloads\grc_import_ready_pack_after_review" --organization-id <organization_uuid> --skip-auth-user-creation
```

Auth-user creation is opt-in and only works from the CLI/server environment with `SUPABASE_SERVICE_ROLE_KEY`:

```powershell
node scripts/import-real-grc-pack.mjs --apply --folder "C:\Users\molte\Downloads\grc_import_ready_pack_after_review" --organization-id <organization_uuid> --create-auth-users true
```

Production-looking Supabase URLs require an explicit `--confirm-production` flag after staging approval.

## Safety Boundaries

- No browser code uses the service-role key.
- No hard-delete path is added.
- No fake/demo/mock data is seeded.
- Payroll-sensitive fields such as salary, bank, IBAN, IQAMA, deductions, allowances, nationality, payroll amount, housing, transport, and basic pay are excluded from sanitized payloads and reports.
- Long copyrighted CBAHI, JCI, ISO, or other standard text is blocked. Load licensed metadata and references only.
- Missing status does not change existing record activity. Inactive, archived, or locked updates require an explicit CSV status and are reported in dry-run warnings.

## Pending Auth Users

Rows in `04_users_owners.csv` are matched by email first and employee number second. Existing profiles are updated without changing IDs. Existing auth users without profiles can receive profiles during apply. Missing auth users are written to:

- `release/import/patch20-pending-auth-users.csv`
- `release/import/patch20-pending-auth-users-after-apply.csv`
- `public.patch20_pending_auth_users`

Review generated-looking emails before creating accounts. The browser runner intentionally cannot create Supabase Auth users.

## Rollback And Reconciliation

Apply mode writes a pre-import snapshot before changes:

- `release/import/patch20-pre-import-snapshot.json`
- `release/import/patch20-pre-import-snapshot.csv`

It also writes created, updated, skipped, pending-auth, and post-import reports. Rollback is manual and report-driven so production data is not hard-deleted automatically. Use the pre-import snapshot plus created/updated CSVs to reverse specific rows through controlled admin SQL or approved maintenance tooling.

## Reports To Review Before Production

- `release/import/patch20-dry-run-summary.json`
- `release/import/patch20-validation-errors.csv`
- `release/import/patch20-validation-warnings.csv`
- `release/import/patch20-pending-auth-users.csv`
- `release/import/patch20-generated-email-review.csv`
- `release/import/patch20-payroll-discovered-departments-review.csv`
- `release/import/patch20-import-plan.json`
- `release/import/patch20-apply-summary.json`
- `release/import/patch20-created-records.csv`
- `release/import/patch20-updated-records.csv`
- `release/import/patch20-skipped-records.csv`
- `release/import/patch20-pending-auth-users-after-apply.csv`
- `release/import/patch20-post-import-checks.json`

## UI

The Admin Hub tab `Real Data Import Runner` displays the expected pack files, copyable dry-run/apply commands, latest report status when report files are available, and the handoff to Real Data Activation and Production Go/No-Go.
