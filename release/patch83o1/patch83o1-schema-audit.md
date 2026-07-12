# Patch 83O.1 Schema Audit

Audit date: 2026-07-12

## Sources

- Local migrations and application database types/usages.
- Data-free `supabase db dump --linked --schema public` output.
- Read-only REST projection checks for canonical department columns.
- Remote migration list aligned through migration 167 before this patch.

No table data, credentials, tokens, or authorization headers are included.

## Deployed `departments`

| Column | Type | Null | Default | Generated |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` | no |
| `organization_id` | `uuid` | no | none | no |
| `division_id` | `uuid` | yes | none | no |
| `name_en` | `text` | no | none | no |
| `name_ar` | `text` | yes | none | no |
| `code` | `text` | yes | none | no |
| `is_active` | `boolean` | no | `true` | no |
| `created_at` | `timestamptz` | no | `now()` | no |
| `updated_at` | `timestamptz` | no | `now()` | no |

- Primary key: `departments_pkey (id)`.
- Foreign keys: `organization_id -> organizations(id) ON DELETE CASCADE`; `division_id -> divisions(id) ON DELETE SET NULL`.
- Partial unique index: `uq_departments_active_code_norm` on `(organization_id, lower(trim(code)))` where `is_active = true and code is not null`.
- Trigger: `trg_departments_updated_at`, before update, calls `public.set_updated_at()`.
- RLS enabled. Read policy uses `can_access_org(organization_id)`; write policy requires global `super_admin` or `governance_admin`.
- There is no `type`, `department_type`, `manager_id`, or other direct manager column.

## Related Objects

- `organizations`: `id`, bilingual names, `is_active`, timestamps; primary key on `id`; no organization code column.
- `divisions`: canonical code column is `code`; organization foreign key; active normalized-code partial unique index; active flag and timestamps.
- `profiles`: canonical manager lookup fields are `id`, `organization_id`, `email`, `is_active`, and `user_status`. `department_id` is user affiliation, not a unique department-manager designation.
- `user_roles`: manager authority is represented by `role = department_manager`, `scope = department`, `organization_id`, and `department_id`. Role rows reference profiles and departments.
- `department_import_batches`: stores summary counts, mode, filename, actor, affected department IDs, and timestamps. It has no raw-row or token column. RLS permits scoped admin reads.
- Relevant enums: `department_import_mode = {create_only, create_and_update}`, `app_role` includes `super_admin`, `governance_admin`, and `department_manager`; `access_scope` includes `department`.
- `audit_logs`: canonical target columns are `action`, `table_name`, `record_id`, `actor_id`, `organization_id`, `old_data`, and `new_data`.

## RPC Audit

The deployed signature is:

`public.apply_department_import_batch(uuid, uuid, text, text, jsonb) returns jsonb`

Migration 167 correctly enforces service-role calling, explicit actor authorization, organization scope, two-phase row validation, and summary-only batch storage. Its execution phase is incompatible with the deployed schema because it references:

- nonexistent `departments.type`;
- nonexistent `departments.manager_id`;
- nonexistent `audit_logs.entity_type` and `audit_logs.entity_id` instead of `table_name` and `record_id`.

The function is revoked from `PUBLIC`; only `service_role` has execution in the pre-168 dump.

## Repository Audit

- `src/types/database.ts`, `createDepartment`, user-management lookups, and core migrations consistently use `departments.code`, `name_en`, `name_ar`, `division_id`, and `is_active`.
- `real_department_master.department_type` and `manager_user_id` belong to a separate standards-master table with no canonical relationship to `departments`; they are not valid substitutes.
- `profiles.department_id` and scoped `user_roles` establish affiliation/authority. The singular manager field expected by migration 167 does not exist.
- The disabled import preview still contains legacy projections (`department_code`, `division_code`, `organization_code`) and a payload-shaping mismatch. These remain blockers before frontend activation or live mutation testing.
