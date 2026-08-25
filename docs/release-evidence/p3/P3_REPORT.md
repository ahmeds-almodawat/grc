# P3/P3.5 Staging Release Report

## Decision

All non-human P3/P3.5 pre-production gates are complete. Staging remains
paused at the final real Cloudflare Turnstile authentication certification and
is not yet authorized for P4.

The hosted multi-persona, workflow, security-negative, responsive, dark, RTL,
console, network, and data-integrity campaigns passed. The remaining human
gate must use a fresh browser context, a real Turnstile challenge, normal
password authentication, Patch83U/profile/RBAC bootstrap, authorized route
access, logout, and a fresh challenge/remount check. No challenge solving or
session injection is automated.

## Repository

- P3-R2 starting correction RC: `bf748c4e6288337823492335b3a2478d401fd872`
- Frozen frontend product source: `3c87eeb8e05427f295111c5188b95003082dfdb2`
- Branch: `codex/v1.4-full-ui-implementation`
- PR: `#129`, open, mergeable, not merged
- Historical migration edits: none
- Migration-ledger manipulation: none
- Production changes: none

The final evidence-only closure commit may advance the PR head without changing
frontend product code. Its exact SHA and the matching Vercel deployment are
recorded in the PR description and verified through canonical GitHub/Vercel
metadata at the freeze gate.

## Staging Result

- Supabase project: `zghsgzrdwbqdrpuxanac`
- Migration source ceiling: 231
- Edge `privileged-action`: ACTIVE version 10, JWT required
- Dedicated Vercel project: `grc-staging`
- Canonical alias: `https://grc-staging-lilac.vercel.app`
- Supabase Auth CAPTCHA: enabled
- Frontend CAPTCHA requirement: enabled
- Turnstile provider/source remediation: deployed
- Production writes/config/Auth/deployment: none

## Validation

| Gate | Result |
| --- | --- |
| `npm run lint:types` | PASS |
| Unit | PASS - 121 files, 2251/2251 |
| Playwright | PASS - 97/97 |
| P3.5 focused closure | PASS - 149/149 focused unit assertions and 19/19 browser scenarios |
| Production build | PASS |
| Migration inventory | PASS - 186 files, source ceiling 231 |
| Patch83U Auth surface | PASS - 0 unsafe surfaces/findings |
| Strict RLS/functions/views | PASS - 0 critical/high findings |
| Runtime security bridge | PASS - 0 frontend direct RPC and 0 broad definer grants |
| Production-data/demo/live-result audits | PASS - 0 blocking findings |
| Dependency audit | PASS - 0 production vulnerabilities |
| GitHub PR checks | PASS - all canonical checks successful on the verified head |

## Non-Human Closure

- F19 closed: Vercel project/deployment metadata independently exposes the
  exact `gitCommitSha`, branch, commit message, immutable deployment ID, and
  READY target. The value matched local, origin, and PR head.
- F20 closed: this report, migration evidence, UAT/security matrices, staging
  manifest, discrepancy register, P4 handoff, and PR description were updated.
- F21 closed: canonical GitHub PR status reported every required check
  successful.
- F23 closed: imports are canonically default-disabled because both execution
  flags are absent; the disabled client makes zero Patch83T requests and an
  unauthenticated hosted execution attempt returned
  `401 UNAUTHORIZED_NO_AUTH_HEADER`. Notification delivery administration is
  not exposed in this release. Shared search/filter/reset/pagination and the
  release accessibility contract passed focused automated coverage.

## Remaining Gate

F22 remains open awaiting legitimate human Turnstile completion. CAPTCHA is
enabled and the application remains fail-closed without a valid challenge.
