# v6.1 Production Baseline Reset Runbook

## Purpose

v6.1 stops feature expansion and establishes one truthful production-hardening baseline.

This pack does **not** claim the system is production-ready. It creates the evidence structure needed to move from prototype/staging candidate to controlled pilot readiness.

## What v6.1 validates

1. TypeScript still compiles.
2. Production build still succeeds.
3. Dependency version risks are visible.
4. The migration manifest is regenerated from the real `supabase/migrations` folder.
5. Runtime version labels are inventoried.
6. Capabilities are separated into implemented artifacts versus production-verified evidence.
7. Generated reports are marked as generated/unverified until backed by real staging proof.

## Install

From project root:

```bash
node scripts/v61-install-baseline-scripts.mjs
npm run v61:all
```

## Optional dependency pinning

Review the package pin audit first:

```bash
npm run v61:pin-check
```

Then, if acceptable:

```bash
npm run v61:pin-from-lock
npm install
npm run v61:pin-strict
npm run typecheck
npm run build
```

Do not pin blindly if package-lock is stale.

## Outputs

- `supabase/_consolidated/migration-manifest.json`
- `supabase/_consolidated/MIGRATION_MANIFEST.md`
- `release/v61/v61-package-pin-audit.json`
- `release/v61/v61-version-baseline-audit.json`
- `release/v61/v61-capability-register.json`
- `release/v61/v61-generated-evidence-audit.json`

## Exit criteria

v6.1 is complete when:

- `npm run v61:all` passes.
- The migration manifest shows all current migrations.
- The team chooses one runtime version label.
- Package dependency ranges are either pinned or formally accepted as a temporary risk.
- Generated readiness reports are not treated as production proof.
- The capability register is reviewed and accepted as the baseline for v6.2–v6.5.

## Next hardening sequence

1. v6.2 Real No-Mock Data Layer
2. v6.3 Authentication + Protected Routes
3. v6.4 RLS Security Rewrite + Persona SQL Tests
4. v6.5 Real Automated Test Suite
