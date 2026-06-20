# Supabase Staging Validation SOP

## Goal

Validate Supabase staging without touching production data.

## Checklist

- Confirm project is non-production.
- Confirm RLS is enabled on managed tables.
- Confirm broad `EXECUTE` grants are revoked for security definer functions.
- Confirm service-role-only RPCs are called only through approved bridges.
- Confirm synthetic test personas exist.
- Confirm no real patient or confidential OVR records exist.
- Run persona SQL tests in staging.
- Capture SQL evidence output.

## Evidence to capture

- Project identifier showing staging/non-production.
- SQL persona proof output.
- Security definer audit output.
- RLS validation output.
- Restore/snapshot readiness output.
