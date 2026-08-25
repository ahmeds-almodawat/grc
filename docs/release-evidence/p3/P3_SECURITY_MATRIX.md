# P3/P3.5 Staging Security Matrix

| Control | Result | Evidence |
| --- | --- | --- |
| Patch83U frontend contract | PASS | Six-persona authenticated bootstrap and protected headers |
| Browser direct RPC | PASS | 0 direct RPC calls; authenticated Edge bridge used |
| Privileged Edge | PASS | `privileged-action` v10 ACTIVE, JWT required |
| Unauthenticated privileged Edge | PASS | Import execution probe returned `401 UNAUTHORIZED_NO_AUTH_HEADER` |
| Critical view | PASS | Canonical text projection, security invoker, anonymous denied |
| Public-table RLS | PASS | Every exposed public table has RLS enabled |
| Anonymous governed reads | PASS | Governed data inaccessible anonymously |
| Governance linkage | PASS | Required views/RPCs and hosted workflows passed |
| Read-only mutation denial | PASS | Read-only persona denied governed mutations/import |
| Division/department isolation | PASS | Positive and negative scoped route/data matrix passed |
| Cross-scope denial | PASS | Unauthorized module routes redirected/denied |
| Last-Super-Admin protection | PASS | SQL/E2E contract; no destructive hosted attempt |
| Service-role browser exposure | PASS | No browser service-role key or direct privileged DML |
| Import deployment gate | PASS | Flags absent, zero client calls, backend Auth/contract gates |
| CAPTCHA final posture | PASS PENDING HUMAN | Enabled and fail-closed; real challenge certification remains |
| Critical/high static findings | PASS | 0 critical/high; strict proof passed |

## Reviewed Nonblocking Observations

- 61 medium static RLS observations remain reviewed, nonblocking inventory
  entries rather than strict failures.
- Five managed-schema observations remain informational.
- The secret scan matches two explicit synthetic rejection fixtures only.
- The staging-only legacy `admin-create-user` Edge Function is nonblocking
  legacy state and must not propagate to Production.
- The existing build chunk-size advisory is nonblocking debt.

## CAPTCHA Boundary

Supabase staging Auth CAPTCHA and
`VITE_AUTH_CAPTCHA_REQUIRED` are enabled. The real Cloudflare Turnstile
provider and corrected source are deployed. Final certification requires human
challenge completion; automated solving, bypass, and session injection remain
prohibited. Production CAPTCHA/Auth configuration was not modified.
