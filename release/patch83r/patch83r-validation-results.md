# Patch 83R validation results

Final validation completed on 2026-07-13.

| Command | Result |
| --- | --- |
| `git diff --check` | passed |
| `npm run validate:build` | passed; TypeScript and Vite production build completed |
| `npm run test:unit` | passed; 4 files and 26 tests |
| `npm run validate:security` | passed; one verified read-only browser RPC, zero broad public-schema SECURITY DEFINER grants, and zero service-role RPCs called directly by the browser |
| `npm run patch83p:proof` | passed |
| `npm run patch83q:proof` | passed |
| `npm run patch83q1:proof` | passed after replacing a bounded dynamic lifecycle RPC call with four literal RPC calls |
| `npm run patch83r:proof` | passed; 43 focused checks |
| `npx supabase db push --linked --dry-run` | passed; exactly migration 171 selected |
| `npx supabase migration list` | passed; local/remote aligned through 171 after deployment |
| `npx supabase functions list` | passed; `privileged-action` version 6 ACTIVE, JWT verification enabled |

The local Docker database has stale schema despite migration history through 170: it lacks Patch 19 `profiles.user_status` and its host port is not published. No reset or repair was run. Migration 171 was therefore executed inside the existing container in a transaction with temporary production-compatible `user_status` and `last_reviewed_at` columns, then rolled back. Every statement passed. Exact inspection inside the transaction found four lifecycle columns, three indexes, three triggers, four RPCs, and RPC ACLs limited to owner plus `service_role`.

`supabase/tests/patch83r_department_lifecycle_tests.sql` also passed inside rollback. It exercised authorized/unauthorized and cross-organization rename, immutable code, normalized duplicate rejection, archive reason, missing/self/archived successor denial, transactional active-user reassignment, archived historical view visibility, archived rename denial, restore conflict denial, successful restore, and lifecycle audit events. A temporary production-compatible `audit_findings.responsible_department_id` column was included because the stale local baseline also lacks that already-live Patch 24 field.

A read-only linked schema dump confirmed production already has the Patch 19 profile columns. Non-mutating post-deployment gateway probes returned HTTP 401 for both missing JWT (`UNAUTHORIZED_NO_AUTH_HEADER`) and invalid JWT (`UNAUTHORIZED_INVALID_JWT_FORMAT`).
