# Patch 23 Evidence Security Review

## Controls Added
- RLS enabled for new evidence bridge tables.
- Views use `security_invoker = true` to preserve caller scope.
- State transitions run through the existing privileged action edge function.
- Browser API uses `invokePrivilegedAction`; it does not use service-role credentials.
- SQL bridge functions set `search_path = public, pg_temp`.
- Execute on SQL bridge functions is revoked from public/authenticated and granted only to `service_role`.
- Sensitive evidence requires classification reason.
- Accepted evidence requires reviewer separation unless a privileged role policy permits it.
- Closure gate status excludes expired evidence unless a valid approved waiver exists.

## Residual Manual Review
- Apply the migration in a staging database before production.
- Confirm organization-scoped RLS policies match local role expectations.
- Confirm reviewer separation behavior with real admin, reviewer and uploader accounts.
- Confirm pack index exports do not reveal evidence outside the signed-in user's organization scope.
