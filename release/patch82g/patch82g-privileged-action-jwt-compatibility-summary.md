# Patch 82G Privileged Action JWT Compatibility Summary

Patch 82G fixes local privileged admin action authentication compatibility for current Supabase session tokens.

## Scope

- Privileged Edge Function caller verification now relies on Supabase Auth token validation through `auth.getUser(token)`.
- The old local-runtime failure mode from manual JWT verification is avoided.
- Missing or invalid bearer tokens are rejected with structured JSON errors.
- Frontend privileged-action calls surface safe server JSON errors when available.
- No migrations were added.
- No Supabase migrations were modified.
- No RLS, backend contract, Patch 20 import logic, payroll-sensitive field, or production launch behavior was changed.

## Security posture

- Requests still require a valid `Authorization: Bearer <token>` header.
- Caller identity is taken from the Supabase-validated session user.
- Client-provided user identifiers are not trusted for authentication.
- Service-role usage remains server-side inside the Edge Function.
- Existing action routing and role checks remain in place.
