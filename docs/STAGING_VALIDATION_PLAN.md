# Staging Validation Plan

## Purpose

Define the future validation phase required after controlled pilot and before production readiness.

## Why staging matters

Local/static proof is valuable, but production readiness requires validation against a real deployed environment with real authentication, real network boundaries, real secrets management, and live database grants.

## Staging requirements

- Dedicated staging Supabase project.
- Dedicated staging frontend deployment.
- No production data.
- Synthetic seeded records.
- Staging secrets separated from local and production.
- Staging backup/restore test.
- Persona test suite run against staging.
- Edge bridge behavior tested with staging auth.

## Staging evidence to capture

| Evidence | Required output |
|---|---|
| Deployment log | Build/deploy success |
| Database migration log | Staging migration applied cleanly |
| Persona RLS tests | Passed result file |
| Runtime bridge tests | Passed result file |
| Backup/restore dry-run | Passed result file |
| UAT scenarios | Signed test log |
| Confidentiality confirmation | IT + Quality confirmation |

## Staging go/no-go

Staging may proceed to production-readiness review only if:

- No critical security findings.
- No unresolved access leakage.
- No real patient/confidential data used.
- Backup/restore proof is accepted.
- Management/Admin, IT, and Quality review the evidence.

## Not part of v7.5

v7.5 does not deploy staging and does not claim staging proof. This document defines the next phase.
