# Patch 83P Frontend Rollback Procedure

1. Set `VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED=false`.
2. Redeploy the same reviewed commit.
3. Verify preview remains available and execution is disabled.
4. Do not roll back migrations 168 or 169.

Changing the Vite variable requires redeployment. Do not change backend functions, database migrations, User Import, or credentials as part of this frontend rollback.
