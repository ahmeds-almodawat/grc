# Patch 83U hosted-state evidence addendum — 2026-07-18

## Purpose

This addendum preserves the Patch 83U evidence history without overwriting it. Earlier artifacts accurately described staging at their capture time, when migration 177 was pending and the runtime was `emergency_suspended`. Later read-only hosted verification supersedes those statements for current-state decisions.

This addendum is evidence reconciliation only. It does not claim or authorize a password reset, password change, login, token replay, migration, deployment, runtime transition, reconciliation, provisioning action, or production access.

## Superseded current-state statements

The following files contain historical statements that migration 177 was pending or that staging remained `emergency_suspended`:

- `release/patch83u/patch83u-test-results.md`
- `release/patch83u/patch83u-security-review.md`
- `release/patch83u/patch83u-remaining-limitations.md`
- `release/patch83u/patch83u-release-preflight-runbook.md`
- `release/patch83u/patch83u-operational-runbook.md`
- `release/patch83u/patch83u-implementation-summary.md`
- `release/patch83u/patch83u-hosted-remediation-proof.md`

Those statements remain valid descriptions of the captured remediation phase. They must not be used as the current hosted starting state for a reset exercise.

## Later hosted verification that supersedes them

The completed read-only hosted reset preflight reported the following current staging facts:

- Project reference: `zghsgzrdwbqdrpuxanac`.
- Runtime: `enforced`.
- Runtime state version: `5`.
- Edge contract: `patch83u-edge-auth-first-v1`.
- Frontend contract: `patch83u-frontend-auth-first-v1`.
- Migrations 174, 176, and 177: applied.
- Stable finalizer: `patch83u_finalize_password_change_after_revocation`.
- Target `2a276bdb-cf51-4303-846e-6b7fecf38b0c`: active, database/Auth credential version 2, requested lifecycle active, role/scope `employee / assigned_only`, and no pending credential operation at capture.
- Designated Super Admin `83d92a59-6909-44e7-80f3-aff60a6734fb`: active, credential-active, role/scope `super_admin / global`.
- Eligible Super Admin count: exactly one.

Every fact must be re-read through the harness readiness gates immediately before a separately authorized reset. This addendum does not convert a point-in-time observation into permission to mutate hosted state.

## Evidence precedence

For current-state decisions, use a fresh output from `scripts/patch83u-staging-reset-evidence.sql` through the fail-closed harness. Use the older artifacts for chronology, design rationale, and proof of the prior incident only.

Production project `zbrjjecpsrzposhuarcn` remains prohibited and was not accessed for this addendum.
