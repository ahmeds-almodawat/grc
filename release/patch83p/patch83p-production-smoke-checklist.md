# Patch 83P Post-Deployment Smoke Checklist

Use only after a separately approved controlled Vercel deployment. Completion of this checklist does not establish production readiness.

- [ ] Confirm the deployed commit is the reviewed commit.
- [ ] Confirm the intended environment has exact lowercase `VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED=true` and was redeployed after the change.
- [ ] As an authorized administrator, open Department Import and confirm the preview states that it does not modify data.
- [ ] Validate a safe sample and confirm execution stays unavailable until an organization, at least one valid row, no blocking errors, and an allowed mode are present.
- [ ] Confirm an authorized `super_admin` or `governance_admin` can reach the final execution control.
- [ ] Confirm a non-admin cannot execute even while the deployment flag is true.
- [ ] Confirm the request uses privileged action `department_import_execute` and does not call `apply_department_import_batch` directly.
- [ ] Confirm User Import remains available and behaves as before.
- [ ] Confirm no service-role key, JWT, password, or Patch 83O test credential is present in client configuration.
- [ ] Record observed results through the approved operational evidence channel without secrets.
- [ ] If any check fails, follow the Patch 83P rollback procedure.
