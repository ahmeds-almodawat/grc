# Patch 20 Real Data Import Center

Patch 20 provides a professional Admin Hub control center plus a CLI/server-side import orchestrator for the complete reviewed GRC import pack. The browser page shows readiness, dry-run status, warnings, report outputs, pending account creation, rollback evidence, and production handoff. Database apply remains in `scripts/import-real-grc-pack.mjs`.

## Admin Hub Location

Open Admin Hub, then select **Real Data Import Center**.

The page includes these sections:

- Overview
- File Checklist
- Dry Run
- Validation Errors
- Warnings
- Pending Auth Users
- Apply Results
- Rollback / Snapshot
- Production Readiness

## Input Pack

Default folder:

```powershell
C:\Users\molte\Downloads\grc_import_ready_pack_after_review
```

Required files:

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

## Dry Run

Run from the repository root:

```powershell
$env:GRC_IMPORT_FOLDER = "C:\Users\molte\Downloads\grc_import_ready_pack_after_review"
node scripts/import-real-grc-pack.mjs --dry-run --folder "$env:GRC_IMPORT_FOLDER"
```

Dry-run reads every CSV file, validates UTF-8/BOM handling, required files and columns, duplicate codes, duplicate emails, invalid emails, department/user/committee references, AppRole values, statuses, dates, long standards-text risk, generated emails, payroll-discovered departments, and dependency order. Dry-run does not change database data.

## Apply

Apply without creating Supabase Auth users:

```powershell
$env:GRC_IMPORT_FOLDER = "C:\Users\molte\Downloads\grc_import_ready_pack_after_review"
$env:GRC_ORGANIZATION_ID = "paste-real-organization-uuid-here"
node scripts/import-real-grc-pack.mjs --apply --folder "$env:GRC_IMPORT_FOLDER" --organization-id "$env:GRC_ORGANIZATION_ID" --skip-auth-user-creation
```

Apply with explicit account creation only after email review and only from CLI/server environment:

```powershell
$env:GRC_IMPORT_FOLDER = "C:\Users\molte\Downloads\grc_import_ready_pack_after_review"
$env:GRC_ORGANIZATION_ID = "paste-real-organization-uuid-here"
node scripts/import-real-grc-pack.mjs --apply --folder "$env:GRC_IMPORT_FOLDER" --organization-id "$env:GRC_ORGANIZATION_ID" --create-auth-users true
```

Do not paste angle-bracket placeholders into PowerShell. PowerShell treats the opening angle bracket as an operator.

## Browser Safety

- The UI does not store or expose server-only database keys.
- The UI does not create Supabase Auth users directly.
- The UI does not bypass RLS.
- The UI reads generated report files and RLS-scoped Patch 20 report tables when available.
- The UI shows copyable commands only; apply operations stay in CLI/server tooling.

## Apply Order

The CLI applies in this order after a clean dry-run:

1. Departments
2. Users/profiles matching existing auth users
3. Pending account creation queue for missing auth users
4. Committees
5. Role matrix / role assignments
6. Evidence taxonomy
7. Control library
8. KPI indicators
9. Tracer templates
10. Audit universe
11. Compliance obligations
12. Document register
13. Standards metadata
14. UAT scenarios
15. Go/no-go signoffs
16. Payroll department map

## Safety Rules

- No hard deletes.
- No fake, demo, or mock data.
- No salary, bank account, IQAMA, deductions, allowances, nationality, or payroll-sensitive fields are imported.
- No copyrighted CBAHI, JCI, ISO, or other standards text is imported.
- Missing status does not deactivate records. Existing records are deactivated only when the CSV explicitly marks inactive, archived, or locked and dry-run reports it.
- Organization scope is required. If one active organization exists, the CLI can detect it; multiple organizations require `--organization-id`.
- RLS remains strict and browser code does not weaken policies.

## Reports

Dry-run reports:

- `release/import/patch20-dry-run-summary.json`
- `release/import/patch20-dry-run-summary.csv`
- `release/import/patch20-validation-errors.csv`
- `release/import/patch20-validation-warnings.csv`
- `release/import/patch20-pending-auth-users.csv`
- `release/import/patch20-generated-email-review.csv`
- `release/import/patch20-payroll-discovered-departments-review.csv`
- `release/import/patch20-import-plan.json`

Apply reports:

- `release/import/patch20-apply-summary.json`
- `release/import/patch20-apply-summary.csv`
- `release/import/patch20-created-records.csv`
- `release/import/patch20-updated-records.csv`
- `release/import/patch20-skipped-records.csv`
- `release/import/patch20-pending-auth-users-after-apply.csv`
- `release/import/patch20-post-import-checks.json`
- `release/import/patch20-pre-import-snapshot.json`

## Pending Auth Users

Default apply does not create Supabase Auth users. Missing users are written to pending account creation reports and `patch20_pending_auth_users`. Review generated-looking emails before running apply with explicit account creation.

## Rollback / Snapshot

Apply writes a pre-import snapshot before any database changes. Rollback is manual and report-driven: use the pre-import snapshot plus created/updated/skipped reports to reverse specific rows through approved maintenance tooling. No hard-delete rollback is generated.

## Production Handoff

Review the dry-run, apply, pending auth, generated email, payroll department, snapshot, and post-import reports before production import. Attach the evidence to Real Data Activation, Real UAT Execution, and Production Go/No-Go.
