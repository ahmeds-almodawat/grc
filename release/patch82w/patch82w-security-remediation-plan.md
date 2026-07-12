# Patch 82W: Targeted Security Remediation Plan

This remediation plan translates the findings from the Patch 82V security review into a sequence of targeted, safe patches. This plan addresses high-risk areas—including broad RLS policies, Edge Function CORS, allowlist drift, and access parity—without introducing broad rewrites or schema changes.

## Prioritized remediation sequence

1. **Patch 82X**: RLS organization/role scoping review and safe migration plan
2. **Patch 82Y**: Edge Function CORS and auth hardening plan
3. **Patch 82Z**: Privileged action allowlist/payload/audit hardening plan
4. **Patch 83A**: Frontend/backend access parity verification

---

## Patch 82X: RLS organization/role scoping review and safe migration plan
- **Objective**: Remediate broad `using (true)` authenticated policies by introducing organization and role constraints.
- **Affected Areas**: `supabase/migrations/*.sql`
- **Risk Level**: High
- **Pre-checks**: Verify existing RLS coverage; audit all tables containing `using (true)`.
- **Implementation Boundaries**: Only modify specific select policies for authenticated users; do not alter table schemas or relationships.
- **Proof Requirements**: Proof script ensuring `using (true)` is removed for sensitive tables; tests verifying data isolation by `organization_id`.
- **Rollback Plan**: Revert the specific migration file containing the new RLS policies.
- **Manual QA Steps**: Log in as two distinct users across different organizations and verify record isolation.

---

## Patch 82Y: Edge Function CORS and auth hardening plan
- **Objective**: Restrict wildcard CORS headers and ensure robust token validation in the privileged-action Edge Function.
- **Affected Areas**: `supabase/functions/privileged-action/index.ts`
- **Risk Level**: Medium
- **Pre-checks**: Review allowed origins in production; verify current token validation logic.
- **Implementation Boundaries**: Limit changes to CORS headers and auth verification lines only; do not alter the service-role client instantiation unless addressing explicit leaks.
- **Proof Requirements**: Proof script testing preflight OPTIONS requests reject unauthorized origins; tests verifying missing/invalid tokens are rejected.
- **Rollback Plan**: Deploy previous version of the Edge Function code.
- **Manual QA Steps**: Invoke Edge Function from localhost (allowed) vs external curl (denied); invoke with expired token.

---

## Patch 82Z: Privileged action allowlist/payload/audit hardening plan
- **Objective**: Prevent allowlist drift and introduce audit logging for sensitive privileged actions executed via service role.
- **Affected Areas**: `supabase/functions/privileged-action/index.ts`, `src/lib/privilegedAction.ts`, `supabase/migrations/*.sql`
- **Risk Level**: Medium
- **Pre-checks**: Compare frontend allowlist with Edge Function allowlist; identify high-risk actions missing audit logs.
- **Implementation Boundaries**: Only add logging calls or strict type validations; do not change payload contracts or action names.
- **Proof Requirements**: Proof script verifying allowlist parity; integration tests checking audit log insertion on execution.
- **Rollback Plan**: Revert Edge Function changes and any new audit logging SQL functions.
- **Manual QA Steps**: Trigger a privileged action via UI and verify audit log appears in database.

---

## Patch 83A: Frontend/backend access parity verification
- **Objective**: Ensure backend RLS and RPC constraints match the frontend `SUPER_ADMIN_ONLY_PAGES` gating.
- **Affected Areas**: `supabase/migrations/*.sql`, `src/auth/authAccess.ts`
- **Risk Level**: Low
- **Pre-checks**: List all frontend `super_admin` pages and their corresponding API calls; verify backend RLS for related tables.
- **Implementation Boundaries**: Only add RLS constraints reflecting `super_admin` requirement; do not change frontend routing logic.
- **Proof Requirements**: Proof script verifying direct API requests to `super_admin` tables fail for non-admins.
- **Rollback Plan**: Revert the RLS migration file.
- **Manual QA Steps**: Attempt to directly fetch internal readiness data via Supabase JS client as a normal hospital user.

---

## Stop/go gates
- **Before 82X**: Verify all existing integration tests pass on staging.
- **After 82X**: Confirm no regressions in standard hospital data access.
- **After 82Y**: Confirm UI can still connect to Edge Functions without CORS errors.
- **Before 83A**: Ensure complete mapping of frontend routes to backend tables.

---

## Rollback plan
- Code rollbacks will be executed by reverting the relevant Git commits.
- Database rollbacks will be executed by rolling back the applied migration.
- Edge Function rollbacks will require re-deploying the prior known-good version of `privileged-action/index.ts`.

---

## Do not do
- No broad RLS rewrite
- No service-role exposure
- No schema reset
- No production-readiness claim
- No weaken-auth shortcut

*Note: This plan outlines future targeted patches based on the Patch 82V security review.*
