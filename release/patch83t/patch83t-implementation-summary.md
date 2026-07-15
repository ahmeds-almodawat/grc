# Patch 83T — Controlled User Excel Import

## Status

Patch 83T is an uncommitted release candidate on `patch83t-controlled-user-excel-import`. Migrations 173 and 174 are authored but unapplied. Nothing described here was staged, committed, pushed, deployed, applied to a database, or run against hosted Auth. Patch 83S Department Import and migration 172 remain unchanged.

## Workbook contract

The `.xlsx` workbook uses this exact column order:

1. `employee_id`
2. `english_name`
3. `arabic_name`
4. `contact_email`
5. `phone`
6. `department_code`
7. `job_title`
8. `role`
9. `role_scope`
10. `status`
11. `user_type`
12. `account_action`

`contact_email` is optional and is validated only when populated. It is a contact attribute, not a login identity. For a newly provisioned Employee-ID-managed account, the profile contract is:

- `profiles.employee_no`: the trimmed, case-preserved Employee ID;
- `profiles.email`: `lower(employee_id) + '@almodawat.sa'`;
- `profiles.contact_email`: the optional contact email; and
- `profiles.phone`: the normalized phone value.

The workbook, parser, preview, execution payload, exports, provisioning snapshots, and audit snapshots use `contact_email` consistently.

Employee ID and phone cells must be Excel Text cells. Surrounding whitespace is trimmed, but Employee ID content and leading zeroes are otherwise preserved. Employee IDs may contain only letters, digits, period, underscore, and hyphen. Formulas, numeric identity cells, password columns, unsupported columns, malformed workbooks, and ambiguous worksheets are rejected.

## Identity and account-action planning

`account_action` is required and accepts only `create`, `update`, or `create_or_update`.

- `create` rejects a row when its Employee ID, synthetic Auth email, profile identity, Auth identity, or open provisioning identity already exists.
- `update` requires one exact existing profile match. It rejects unknown or ambiguous identities and never creates an Auth account or provisioning record.
- `create_or_update` updates one exact existing profile; otherwise it creates a protected provisioning record for a later, separately confirmed account-provisioning action.

Preview and protected execution independently re-resolve the identity and revalidate the selected action. The preview shows the requested `account_action`, matched profile, matched Auth identity, matched open provisioning identity, and planned operation. Protected profile references report only non-PII identity-match booleans, organization alignment, and active cross-organization-role evidence. Exact Employee-ID matches may update only their one resolved profile; a case-insensitive-but-not-exact Employee-ID collision, Auth-alias collision, ambiguous profile, tenant mismatch, or active cross-organization role blocks every account action. A stale or changed identity/access plan blocks the whole execution rather than silently changing the requested action.

The synthetic Auth email is derived server-side as `lower(employee_id) + '@almodawat.sa'`. Existing legacy Auth identities are not silently rewritten. Optional contact email is never substituted for the managed Auth alias.

## Validation and lifecycle

Patch 83T validates the canonical role/scope compatibility matrix as an error boundary, not a warning. Global roles, department manager scope, and assigned-only roles must match the authorization model; unsupported combinations are rejected. `division_head` remains unsupported because this workbook does not carry the required division reference.

Lifecycle values are limited to `active`, `inactive`, `archived`, `invited`, and `locked`. Execution keeps `profiles.user_status`, `profiles.is_active`, deactivation metadata, review metadata, credential holds, and timestamps consistent. It validates actor and target tenant, canonical global-admin authority, scope/reference shape, requested role ownership, and profile/role locks. It rejects self-deactivation, last-eligible-Super-Admin loss, organization-crossing changes, active roles on inactive/locked credentials, active cross-organization assignments, and stale deactivation metadata after a valid activation.

Phone and optional contact email flow through Edit Profile, the protected profile-update action, details, roster search, Excel export, and non-secret audit snapshots. Employee login ID, synthetic Auth email, contact email, and phone remain separate fields.

## Protected execution

The browser can upload, parse, validate, preview, export errors, and enter confirmation without writing. Execute Import is available only to an authenticated, active, organization-aligned canonical global Super Admin or Governance Admin, and assigning privileged global roles remains Super-Admin-only. Execution requires `EXECUTE USER IMPORT` exactly at the UI, Edge, and database boundaries. Selecting a replacement workbook, removing the file, or closing the dialog clears the typed confirmation so approval cannot carry over to a different payload.

Migration `173_patch83t_controlled_user_excel_import.sql` defines the service-role-only import boundary. The database independently validates every row, locks the target plan, enforces organization and last-admin protections, applies the batch atomically, and returns database-derived batch/provisioning identifiers, row/provisioning/audit counts, and a canonical SHA-256 payload digest. The client accepts success only when the identifiers, uniqueness, counts, and digest shape match the validated preview; missing or inconsistent response proof is reported as unverified rather than converted into success.

Existing profiles are updated through the controlled lifecycle and role helpers. A permitted create plan records a complete non-secret snapshot in the protected `user_account_provisioning` queue. Patch 83T does not create a Supabase Auth user and does not execute account provisioning automatically.

Provisioning snapshots are protected by forced RLS, service-role isolation, immutable identity/import fields, deletion denial, open-identity uniqueness, and retry/reconciliation state. They may contain the imported identity and profile intent, but never a password, password hash, National ID, Iqama, token, or service-role credential.

## Coordinated release requirement

The compatible release order is mandatory:

1. migration 173;
2. migration 174;
3. the matching `privileged-action` Edge Function; and
4. the matching frontend.

Running the new frontend against the old deployed Edge Function fails closed with `UNSUPPORTED_PRIVILEGED_ACTION`. No fallback is permitted because it would bypass credential-state verification.

## Main implementation files

- `src/utils/userWorkbook.ts`
- `src/utils/userImportValidation.ts`
- `src/lib/userManagementApi.ts`
- `src/pages/UserManagementCenter.tsx`
- `src/styles.css`
- `supabase/functions/privileged-action/index.ts`
- `supabase/migrations/173_patch83t_controlled_user_excel_import.sql`
- `supabase/tests/patch83t_user_import_tests.sql`
- `tests/unit/userWorkbook.test.ts`
- `tests/unit/userImportValidation.test.ts`
- `tests/unit/userImportExecutionContract.test.ts`
- `tests/e2e/patch83t-user-excel-import.spec.ts`
