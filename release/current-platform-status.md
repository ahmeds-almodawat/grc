# Current Platform Status

## Current Level

- Current patch level: Patch 58 after implementation.
- Patch 58 capability: Production Evidence Capture & Closure Workflow for live hospital evidence gaps, owner follow-up, review state, limitations, recovery assurance, and executive closure readiness.
- Patch 57 capability: Production Operator Console for the daily operating view across production readiness, hospital rollout, hypercare, access, recovery, adoption, policy/SOP, and executive action.
- Patch 56 scope: release, proof, and script consolidation only. It adds no platform workflow capability, database migration, RLS change, or runtime behavior change.
- Patch 55 remains the latest hospital operations readiness capability: department launch packs, support readiness, policy/SOP attestation, and adoption readiness.
- Current validation baseline: typecheck, build, Patch 55 chain, full proof suite, and runtime security.

## Before Pull Request

Run:

```powershell
npm run typecheck
npm run build
npm run patch58:all
npm run proof:all
npm run v700:runtime-security
npm run release:restore-noise
```

## After Merge

Run on `main` after pulling:

```powershell
npm run typecheck
npm run build
npm run patch58:all
npm run proof:all
npm run v700:runtime-security
npm run release:restore-noise
git status --short --branch
```

## Production Caveat

Real hospital-wide production still requires live department launch evidence, user training adoption, policy/SOP attestations, support readiness, backup and restore evidence, DR restore evidence, and executive signoff.

`proof:all` and `v700:runtime-security` remain required gates. After validation, run `npm run release:restore-noise` to remove expected generated release artifact churn unless intentionally updating release evidence.

## Evidence Locations

- Technical validation artifacts: `release/v700/`, `release/v64/`, `release/v66/`, `release/v672/`, `release/v673/`, and `release/v674/`.
- Patch release evidence: `release/patch43/` through `release/patch58/`.
- Current production readiness, pilot/hypercare, hospital operations evidence, and closure follow-up are surfaced in the Production Readiness Center, Production Operator Console, and Production Evidence Closure page.
- Current proof command index: `release/current-proof-command-index.md`.
- Current validation runbook: `release/current-validation-runbook.md`.
