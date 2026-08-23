# P3 Staging Release Report

## Decision

P3 is PAUSED and staging is not certified for P4.

The database upgrade, correction train, authenticated Super Admin and Executive
smoke, and final local regression passed. Full hosted multi-persona UAT could
not finish because the required Cloudflare Turnstile challenge stopped
rendering for the next staging identity. The application remained fail-closed:
the Sign in control stayed disabled, the CAPTCHA gate was not changed, and no
authentication bypass was used.

This is the environmental hard stop defined by the original P3 authorization:
staging infrastructure remained unavailable long enough that required UAT
could not be completed.

## Repository

- Starting P3 RC: `e88712c52b947e0400775c946dfb867207143ecf`
- Current correction RC: `5f81c61ef1d084cbc61322bcebaa4c978af89d04`
- Correction commits: `a4d7ed7`, `5f81c61`
- Branch: `codex/v1.4-full-ui-implementation`
- PR: `#129`, open, mergeable, not merged
- Historical migration edits: none
- Migration-ledger manipulation: none

## Staging Result

- Supabase project: `zghsgzrdwbqdrpuxanac`
- Migration ceiling: 223
- Migration 223 ledger entries: 1
- Edge `privileged-action`: active version 6, JWT required
- Deployed frontend: READY at the dedicated `grc-staging` project
- Deployed source is the first P3 correction (`a4d7ed7`), not the ending
  correction RC. No final RC redeploy was performed after the UAT hard stop.

## Validation

| Gate | Result |
| --- | --- |
| `npm run lint:types` | PASS |
| Unit | PASS - 111 files, 2205/2205 |
| SQL/migration/RLS | PASS - 9/9 rollback-safe proofs |
| Playwright | PASS - 95/95 |
| Production build | PASS |
| Migration inventory | PASS - 178 files, ceiling 223 |
| Patch83U Auth surface | PASS - 0 unsafe surfaces/findings |
| Strict RLS/functions/views | PASS - 0 critical/high findings |
| Runtime security bridge | PASS - no frontend direct RPC or broad definer grants |
| Production-data audit | PASS - 0 blocking findings |
| Dependency audit | PASS - 0 production vulnerabilities |
| Lock consistency | PASS |

## Hard Stop

- Failure stage: CAPTCHA runtime before Auth submission
- Exact behavior: the Turnstile container remained blank and Sign in remained
  disabled; no application console error was emitted
- Staging app response: healthy
- Cloudflare endpoint/DNS: reachable during bounded retry
- Auth, profile, RBAC, migration, and source defect: not indicated
- Security response: fail-closed; CAPTCHA remained enabled
- Production writes: none
- P4 started: no

