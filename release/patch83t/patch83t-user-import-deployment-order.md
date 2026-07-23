# Patch 83T User Excel Import deployment order

Use this order first in staging and then in production. User Excel Import is fail-closed during a partial deployment. The frontend must never be promoted with User Excel Import enabled before the authenticated capability check succeeds.

1. Keep `VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED=false`.
2. Apply migration 173.
3. If the full credential-governance release is included, apply migration 174 with runtime enforcement disabled.
4. Deploy the matching `privileged-action` Edge Function.
5. Authenticate a designated administrator.
6. Verify `patch83t_get_user_import_capabilities` returns `compatible=true`.
7. Deploy/build the frontend with `VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED=true`.
8. Test one disposable `.xlsx` user.
9. Enable no broader production rollout until hosted proof passes.

The feature flag is a deployment-compatibility gate, not an authorization bypass. Existing authenticated role, scope, organization, confirmation, allowlist, audit, and service-role controls remain mandatory throughout this sequence.
