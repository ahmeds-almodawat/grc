# Patch 83R schema review

## Reused objects

- `public.departments.is_active` remains the lifecycle eligibility flag.
- `public.profiles.department_id` is the active user's primary department assignment.
- `public.user_roles` remains the scoped authorization assignment store.
- `public.audit_logs` is reused as the append-only lifecycle history.
- Existing department RLS policies and organization/role helpers remain enabled and unchanged.
- Existing foreign keys to departments remain unchanged; no referenced historical table is rewritten on archive.

## Added by migration 171

`public.departments` gains nullable `archived_at`, `archived_by`, `archive_reason`, and `successor_department_id`. Indexes support organization/lifecycle and normalized active-name lookups. The existing execution-summary view gains lifecycle metadata at the end of its existing column contract.

Four exact bridge RPCs are added: preview, rename, archive, and restore. Two trigger functions enforce immutable codes, block archived identity recreation, and reject new active profile or role assignments to archived departments.

No table, department, foreign key, policy, or historical reference is dropped or deleted.
