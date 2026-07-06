# Patch 81 Rollback and Containment Plan

This plan is conservative by design. Do not destructively drop tables automatically, including newly created tables.

## If Migration Apply Fails

1. Stop app deployment or environment promotion.
2. Preserve terminal logs, Supabase logs, and database error output.
3. Record the failed migration and timestamp.
4. Escalate to the database owner and security owner.
5. Use the approved backup restore, database snapshot restore, or DBA-led containment process.
6. Do not proceed to additional migrations until the failure is understood.

## If Post-Apply Verification Fails

1. Stop deployment promotion.
2. Roll back the application deployment if new UI access must be disabled.
3. Preserve audit logs and verification evidence.
4. Document affected tables, views, functions, and workflows.
5. Escalate to the database owner, security owner, and change approver.
6. Decide whether to restore from backup/snapshot or contain with an approved follow-up fix.

## Prohibited Shortcuts

- Do not automatically drop tables.
- Do not bypass RLS.
- Do not expose service-role secrets.
- Do not approve production launch through this containment plan.
- Do not insert sample records to make verification pass.

Migration deployment and rollback evidence are change-control artifacts only.
