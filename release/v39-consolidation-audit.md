# v3.9 Full Consolidation Audit

Generated: 2026-06-18T07:26:34.131Z

Status: **needs_attention**

## Counts

- Migrations: 34
- Scripts: 29
- Docs: 45
- Pages: 60
- Lib files: 23

## Missing Required Files

None

## Duplicate Migration Prefixes

- 012: supabase/migrations/012a_ovr_workflow_enum_values.sql, supabase/migrations/012b_ovr_workflow_controls.sql

## Dead Risk Signals

None

## Next Actions

- Fix missing required files before staging.
- Resolve duplicate migration prefixes if any exist.
- Keep old routes hidden rather than deleted until pilot is complete.
- Run npm run typecheck and npm run build after applying each patch.
