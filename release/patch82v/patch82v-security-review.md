# Patch 82V Security Review

This document provides a read-only inventory of potential security risks across the GRC platform, focusing on RLS policies, service-role usage, CORS headers, privileged actions, and frontend access gating.

## RLS policy review
- **Finding ID**: RLS-001
- **Severity**: High
- **File**: `supabase/migrations/*.sql`
- **Evidence**: `create policy ... for select to authenticated using (true);`
- **Why it matters**: Broad authenticated access allows any logged-in user to read sensitive data if RLS doesn't properly scope to `organization_id` or role.
- **Suggested Patch**: Replace `using (true)` with organization-scoped logic: `using (organization_id = auth.jwt()->>'organization_id')`.

## Service-role review
- **Finding ID**: SR-001
- **Severity**: Medium
- **File**: `supabase/functions/privileged-action/index.ts`
- **Evidence**: `createClient(supabaseUrl, serviceRoleKey)`
- **Why it matters**: The Edge Function uses the service role key to bypass RLS, executing RPCs on behalf of the user. If the custom role-validation logic is flawed, it could lead to privilege escalation.
- **Suggested Patch**: Ensure all service-role RPCs maintain strict secondary authorization checks within Postgres.

## CORS review
- **Finding ID**: CORS-001
- **Severity**: Low
- **File**: `supabase/functions/privileged-action/index.ts`
- **Evidence**: `'Access-Control-Allow-Origin': '*'`
- **Why it matters**: Wildcard CORS headers allow any origin to attempt requests against the Edge Function, increasing exposure to CSRF or automated probing.
- **Suggested Patch**: Restrict `Access-Control-Allow-Origin` to specific trusted domains.

## Privileged action review
- **Finding ID**: PA-001
- **Severity**: Informational
- **File**: `src/lib/privilegedAction.ts` and Edge Function
- **Evidence**: `allowedActions.has(action)`
- **Why it matters**: Action allowlist coverage relies on maintaining synchronization between frontend `privilegedAction.ts` and the Edge Function. Drift could lead to unsupported actions failing.
- **Suggested Patch**: Maintain strict synchronization and add audit logging inside the privileged action RPCs.

## Frontend access review
- **Finding ID**: FE-001
- **Severity**: Informational
- **File**: `src/auth/authAccess.ts`
- **Evidence**: `SUPER_ADMIN_ONLY_PAGES`
- **Why it matters**: Gating critical pages solely on the frontend (`super_admin`) means direct API access might still be possible if backend RLS is not equally strict.
- **Suggested Patch**: Enforce super_admin gating in RLS or RPCs, rather than relying exclusively on React Router gating.

## Recommended remediation sequence
1. Restrict CORS in Edge Functions to known domains.
2. Scope `using (true)` RLS policies to tenant organizations.
3. Align backend RLS with frontend `SUPER_ADMIN_ONLY_PAGES`.

*Note: This is an inventory review only.*
