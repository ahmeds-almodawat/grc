# P1 Consolidated Platform Completion

## Status

P1 is complete and ready for P2 release-candidate certification. UI-1 through
UI-10 remain the accepted visual baseline; P1 made no redesign.

Starting commit: `45614aac9464062df1a1c32ef90b65164871be6f`

Implementation checkpoints:

- `b82050b` - governed backend read contracts
- `ebeacbf` - shared governance-link completion
- `d7f3f2b` - security and regression proof closure
- Final evidence commit: the commit containing this document

## Handoff Reconciliation

The UI-10 discrepancy register was treated as authoritative.

| UI-10 item | P1 disposition |
| --- | --- |
| `accreditation_clause_review_tasks` governed read | Corrected by migration 217 |
| Trusted accreditation readiness sources | Existing canonical sources retained; narrow RLS-backed reads restored |
| Recent Governed Activity | Added as `v_recent_governed_activity`; no synthetic activity |
| Release-authorization/readiness views | Deferred to P2 release certification; fail-closed behavior retained |
| Shared Policy/SOP governance linkage | Completed by extending migrations 212-214 through migration 218 |

Additional canonical defects corrected:

- `policySopApi` now filters profiles with `is_active`, not obsolete `active_flag`.
- `v_critical_attention_items` is restored as a security-invoker governed view.
- Risk, Audit Finding, Compliance, CAPA, management summary, approval, Policy,
  SOP, and accreditation read ACLs were reconciled only where RLS is the
  authorization layer.
- No active current database object requires `profiles.active_flag`.

## Canonical Architecture

P1 extended the shared model introduced by migrations 212-214 instead of
creating module-specific link tables. The canonical aggregate consists of:

- `governance_linkage_reviews`
- `governance_criteria_links`
- append-only `governance_criteria_link_decisions`
- exact controlled-document and `document_versions` references
- `policy_requirements` and `sop_procedure_steps`
- source/root/inherited lineage and evidence references
- current-truth, lineage, analytics, and redacted read views

Migration 218 adds first-class Compliance Finding sources and a monotonic
`decision_sequence`, making current truth deterministic when multiple decisions
are appended in one transaction. Exact Policy/SOP versions remain fixed; later
effective versions do not retarget historical links.

## Module Semantics

- OVR keeps Policy and SOP selectors separate, permits both/multiple/neither,
  records reporter uncertainty, and treats reporter links as suggestions.
- Authorized investigation decisions confirm or reject suggestions and retain
  classification, rationale, evidence, requirements, steps, and exact versions.
- Risk uses governance-context and treatment semantics, not violation labels;
  approved reviews retain version snapshots.
- Audit Findings preserve Criteria and Governance Basis across regulatory,
  Policy, Requirement, SOP, Step, and control targets.
- Compliance preserves the external obligation separately from internal
  implementation/evidence/remediation links; findings are first-class sources.
- CAPA inherits confirmed source links with root provenance and read-only
  inherited semantics; supplemental links remain separately governed.

## Analytics And Review Triggers

`v_governance_link_analytics_events` and
`v_governance_link_analytics_summary` expose RLS-scoped raw facts for:

- suggested versus confirmed links
- severity and organization department
- Policy/SOP, Requirement/Step, and version counts
- recurrence and root-event deduplication
- CAPA relationship/effectiveness and post-effectiveness recurrence
- training, document-gap, and execution-gap classifications

No normalized rate is emitted because no canonical exposure denominator exists.

The service-only `evaluate_governance_document_review_trigger` RPC may open a
`governance_pattern` review trigger for qualifying confirmed patterns. It cannot
revise, approve, or publish a controlled document. Browser roles cannot execute
the RPC directly; the authenticated Edge action injects the actor identity and
enforces the Patch83U capability contract.

## Migrations

Starting ceiling: 216. Ending local ceiling: 219.

- 217: governed read contracts, critical-attention view, activity feed, and
  narrow grants/security-invoker reconciliation
- 218: Compliance Finding linkage, deterministic decisions, analytics, review
  trigger, Edge action, and capability ceiling
- 219: ordered controlled-deny-all ACL reassertion for six existing internal
  credential/provisioning tables, restoring only their pre-existing minimal
  service-role privileges

Historical migrations were not edited. The installed CLI could not reconcile
the repository's older unpadded local ledger and stopped before writes; the
three forward migrations were therefore applied to the confirmed local Docker
database with the repository-established direct-PSQL convention and recorded in
the local migration ledger.

## Security Proof

- Patch83U auth-surface audit: PASS, 0 unsafe surfaces, 0 findings
- Strict SECURITY DEFINER audit: PASS, 0 critical/high/medium
- Strict view audit: PASS, 0 critical/high
- Strict RLS audit: PASS, 0 critical/high; 26 controlled-deny-all tables
- All new browser-facing views are security-invoker and authenticated-only.
- New privileged evaluation is service-role-only with a fixed search path.
- Anonymous governed-view and privileged Edge requests return 401 locally.
- SQL proves authorized operations plus anonymous, unauthorized-role,
  cross-organization, inherited-link mutation, and browser-RPC denials.

## Data Preservation

The before/after snapshot across 18 governed business tables remained 251 rows
with digest `-2436037550171164277`. Migration 219 changed ACL metadata only.
No review record, Auth user, profile, role, evidence record, or document was
deleted or rewritten. SQL fixtures ran inside transactions and rolled back.

## Local Integration

- Target: local CLI stack at `127.0.0.1`; no hosted endpoint was used.
- Database, Auth health, API, and Edge Runtime were reachable.
- Preview 4175 served the current production build with the ignored local env
  and Patch83U flag; a fresh load had zero console errors/warnings.
- Actual anonymous PostgREST and Edge denial paths passed.
- The preserved operator browser session was signed out and its password was
  intentionally not inspected, reset, or injected under P1. A separate legacy
  persona verifier was unusable because its unrelated pilot bootstrap dataset
  is absent; no bootstrap data was created.
- Authenticated workflow semantics were proven by rollback-only SQL/RLS tests
  and the full application/Playwright contracts. A fresh normal authenticated
  live-chain smoke remains mandatory in P2 before any production decision.

## Validation

| Gate | Result |
| --- | --- |
| `npm run lint:types` | PASS |
| Full unit suite | PASS - 105 files, 2188/2188 tests |
| SQL/migration/RLS proofs | PASS - six scripts through migration 219 |
| Patch83U and strict static security audits | PASS |
| Full Playwright suite | PASS - 95/95 tests |
| `npm run build` | PASS |
| Clean-browser runtime console | PASS - 0 errors/warnings |
| `git diff --check` | PASS |

The local PostgreSQL container reports a collation metadata warning (database
153.120 versus operating system 153.121). It did not affect compilation or
proofs and was not altered because a collation refresh is outside P1.

## Deferred To P2

| Item | Reason | Production blocker |
| --- | --- | --- |
| Release-authorization/readiness views | Separate UI10-11 release contract; outside P1 governance scope | YES |
| Fresh authenticated live-chain smoke | Operator credential unavailable; no reset/session injection authorized | YES |
| Normalized governance-link rates | No trustworthy exposure denominator | NO |
| Facility analytics dimension | Canonical facility scope is not available in the linkage capability | NO |
| Local collation metadata refresh | Environmental maintenance requiring a separate controlled window | NO |

Production, staging, Vercel, deployment, push, merge, and PR changes: **NONE**.
P2 release-candidate certification was not started.
