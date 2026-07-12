# Patch 83O.1 Canonical Field Mapping

| Import concept | Canonical deployed target | Decision |
| --- | --- | --- |
| department identity | `departments.organization_id + lower(trim(departments.code))` | Preserve across active and inactive rows; reject ambiguity. |
| English name | `departments.name_en` | Required; controlled update. |
| Arabic name | `departments.name_ar` | Optional; blank does not erase an existing value. |
| division | `departments.division_id` resolved through `divisions.code` in the same organization | Set only on create; never change division identity on update. |
| status | `departments.is_active` | `active`/`inactive`; blank retains on update and defaults active on create. |
| department type | no canonical field or relationship | Reject every non-empty value with a controlled row error. Do not add a column. |
| manager | scoped row in `user_roles` for `department_manager` | Validate an active same-organization profile and ensure a department-scoped active role. Do not change `profiles.department_id` or remove existing managers. |
| source filename | `department_import_batches.source_filename` | Trim and cap at 255 characters. |
| batch rows | no storage target | Never persist raw rows. |
| audit record | `audit_logs.table_name` and `audit_logs.record_id` | Replace migration 167's incompatible audit column names. |

`real_department_master.department_type` and `manager_user_id` are intentionally not mapped because that table is a separate standards-master domain and has no verified identity relationship to core departments.
