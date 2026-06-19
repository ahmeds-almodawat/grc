# Security Review Guide

## Purpose

This guide helps IT and technical reviewers verify the controlled-pilot security posture without confusing static readiness, local proof, staging proof, and production proof.

## Current evidence types

| Evidence | Meaning | Limitation |
|---|---|---|
| Typecheck/build | Frontend compiles successfully | Does not prove security. |
| Static RLS audit | Scans migrations and policy patterns | Does not replace live DB verification. |
| Security definer audit | Confirms broad execute grants are controlled | Live database grants remain authoritative. |
| Runtime bridge audit | Checks frontend/service-role risk pattern | Does not replace penetration testing. |
| Persona proof | Authenticated test personas passed | Synthetic/local scope only unless run in staging. |
| Restore dry-run | Local restore evidence passed | Production restore requires separate proof. |

## Required review areas

### 1. Browser-to-database access

Confirm service-role-only operations are not directly callable from browser/frontend code.

### 2. Edge bridge access

Confirm privileged actions go through authenticated bridge logic and are auditable.

### 3. RLS enforcement

Confirm role/persona access is enforced in database policies and not only in frontend UI.

### 4. Confidentiality

Confirm no real patient identifiers or confidential OVR details are used.

### 5. Restore and rollback

Confirm restore proof exists and operational recovery steps are understood.

### 6. Audit trail

Confirm approval, evidence, and proof outputs are stored in release folders.

## Recommended commands

```powershell
npm run ci:static
npm run v673:security-definer-audit
npm run v700:runtime-security
npm run v72:persona-proof
npm run v674:restore-dryrun
npm run v75:all
```

## Staging warning

Static/local evidence is not final production proof. Production readiness requires a staging/live environment validation with the same security assumptions.

## Review decision

IT may approve controlled pilot only when:

- Scope is controlled.
- Data is synthetic/non-confidential.
- Evidence has been reviewed.
- Known limitations are accepted.
- No production use is implied.
