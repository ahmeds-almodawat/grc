# P2 Release Candidate Certification

## Decision

P2 is complete for an upgrade-path release candidate. The two accepted P1
production blockers are closed: the canonical release-readiness surfaces are
available through governed authenticated reads, and a fresh normal local Auth
login completed the Patch83U, profile, RBAC, and authenticated application
chain.

RC functional freeze source commit: `46ae4370b1df6ce676a059c753a050df38b36432`.
The certification-evidence commit is the commit containing this document; the
exact pushed RC HEAD is recorded by the PR and the final P2 gate report.

## Scope Delivered

- Migration 220 restores authenticated read privileges for 23 existing
  RLS-protected sources and publishes 24 accepted release/readiness views as
  security-invoker, authenticated-only surfaces.
- Migration 221 restores the 12 RLS-backed source reads required by the
  accepted My Work queue.
- Migration 222 keeps the Audit criterion helper service-role-only and derives
  the browser criterion gate inside an RLS-scoped security-invoker view.
- The desktop topbar explicitly retains a single action row across platform
  font metrics, closing the Linux CI geometry failure without changing mobile.
- No P2 migration creates business data, broad browser DML, anonymous access,
  or a security-definer browser oracle.

## Live Certification

A fresh password login reused the existing local review principal. The normal
application path established Auth, session, Patch83U capability and credential
contracts, profile, RBAC, and `authenticated_active`. Authenticated local reads
rendered Home/Executive, Governance, Policy, SOP, Risk, Compliance, Audit,
CAPA, OVR, Training, Projects, Evidence, My Work, Approvals, Reports,
Administration, and the accepted production-readiness routes without a render
crash or a new authentication/profile failure.

The browser did not receive a service-role credential and did not call
privileged RPCs directly. Anonymous privileged-action access returned `401`.

## Governance Certification

Rollback-only SQL and application tests prove suggested, confirmed, rejected,
multiple, Policy-plus-SOP, no-link/unsure, requirement/step, exact-version,
inheritance, supplemental-link, recurrence, and review-trigger behavior. Risk
uses governance context; Compliance keeps external obligations distinct from
internal implementation; Audit uses formal criteria/basis; CAPA preserves root
provenance and immutable inherited links. Analytics expose raw facts only.
Review triggers open a review and cannot revise, approve, or publish content.

## Validation

| Gate | Result |
| --- | --- |
| Type/lint | PASS |
| Unit | PASS - 108 files, 2197/2197 tests |
| SQL/migration/RLS | PASS - 9 rollback-safe scripts |
| Full Playwright | PASS - 95/95 tests |
| Production build | PASS |
| Patch83U surface audit | PASS - 0 unsafe surfaces/findings |
| Strict RLS/view audits | PASS - 0 critical/high findings |
| Dependency audit | PASS - 0 production vulnerabilities |
| Lock consistency | PASS |
| Secret scan | PASS - no real credential exposure |
| Data preservation | PASS - 251 rows, digest `-2436037550171164277` |

## Qualification

The accepted upgrade database applied migrations 220-222 and reached ceiling
222. A disposable raw zero-install chain remains nonblocking for this upgrade
RC because unchanged historical migration 022 fails before P1/P2, while the
authoritative baseline path later encounters unchanged 216/217 ordering and
type drift. Historical files were not edited to conceal this. P3 must verify
the target staging ledger and drift before applying the forward migrations.

No staging, Production, hosted Supabase, or Vercel operation was performed.
