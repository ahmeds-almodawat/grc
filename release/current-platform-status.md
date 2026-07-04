# Current Platform Status

## Current Level

- Current branch level: Patch 55 pending merge.
- Latest operating layer: hospital operations readiness, department launch packs, support readiness, policy/SOP attestation, and adoption readiness.
- Current validation baseline: typecheck, build, Patch 55 chain, full proof suite, and runtime security.

## Before Pull Request

Run:

```powershell
npm run typecheck
npm run build
npm run patch55:all
npm run proof:all
npm run v700:runtime-security
```

## After Merge

Run on `main` after pulling:

```powershell
npm run typecheck
npm run build
npm run patch55:all
npm run proof:all
npm run v700:runtime-security
```

## Production Caveat

Real hospital deployment still requires live department launch evidence, executive and department signoffs, training adoption, policy/SOP attestations, support readiness confirmation, backup and restore evidence, and operational acceptance by Quality, Audit, IT/Admin, and executive sponsors.

## Evidence Locations

- Technical validation artifacts: `release/v700/`, `release/v64/`, `release/v66/`, `release/v672/`, `release/v673/`, and `release/v674/`.
- Patch release evidence: `release/patch43/` through `release/patch55/`.
- Current production readiness, pilot/hypercare, and hospital operations evidence is surfaced in the Production Readiness Center.
