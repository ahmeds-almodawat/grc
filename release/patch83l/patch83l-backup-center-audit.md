# Patch 83L: Backup Center Audit
- The component `ScaleBackupRestoreCenter` is registered to the `admin` group.
- Exact valid roles that receive it: `super_admin`, `governance_admin`.
- Frontend navigation guard: dynamically filters tabs based on access.
- Route/page guard: Attempting manual navigation redirects to `UnauthorizedPage` for missing roles via `canAccessPage`.
- Backend authorization: Each backup action uses privileged server bridge.
