# v6.7.1 Local Supabase reset next steps

Status: READY

## Commands

```powershell
supabase stop --no-backup
supabase start
```

After start succeeds, continue with the staging SQL/evidence workflow.

## Report

```json
{
  "generated_at": "2026-06-19T00:57:47.021Z",
  "migration_count": 46,
  "invalid_name_files": [],
  "has_fixed_012_migration": true,
  "has_invalid_012a_migration": false,
  "seed_004_enum_casts_missing": [],
  "local_supabase_ready_for_reset": true
}
```
