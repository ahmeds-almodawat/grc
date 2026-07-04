# Current Platform Status

## Current Level

- Current patch level: Patch 57 after implementation.
- Patch 57 capability: Production Operator Console for the daily operating view across production readiness, hospital rollout, hypercare, access, recovery, adoption, policy/SOP, and executive action.
- Patch 56 scope: release, proof, and script consolidation only. It adds no platform workflow capability, database migration, RLS change, or runtime behavior change.
- Patch 55 remains the latest hospital operations readiness capability: department launch packs, support readiness, policy/SOP attestation, and adoption readiness.
- Current validation baseline: typecheck, build, Patch 55 chain, full proof suite, and runtime security.

## Before Pull Request

Run:

```powershell
npm run typecheck
npm run build
npm run patch57:all
npm run proof:all
npm run v700:runtime-security
npm run release:restore-noise
```

## After Merge

Run on `main` after pulling:

```powershell
npm run typecheck
npm run build
npm run patch57:all
npm run proof:all
npm run v700:runtime-security
npm run release:restore-noise
git status --short --branch
```

## Production Caveat

Real hospital-wide production still requires live department launch evidence, executive and department signoffs, user training adoption, policy/SOP attestations, support readiness confirmation, backup and restore evidence, DR restore evidence, and operational acceptance by Quality, Audit, IT/Admin, and executive sponsors.

`proof:all` and `v700:runtime-security` remain required gates. After validation, run `npm run release:restore-noise` to remove expected generated release artifact churn unless intentionally updating release evidence.

## Evidence Locations

- Technical validation artifacts: `release/v700/`, `release/v64/`, `release/v66/`, `release/v672/`, `release/v673/`, and `release/v674/`.
- Patch release evidence: `release/patch43/` through `release/patch55/`.
- Current production readiness, pilot/hypercare, and hospital operations evidence is surfaced in the Production Readiness Center.
- Current proof command index: `release/current-proof-command-index.md`.
- Current validation runbook: `release/current-validation-runbook.md`.
