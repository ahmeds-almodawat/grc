# v6.5 Real Test + Pilot Readiness Pack

This pack is intentionally add-only. It avoids the previous mistakes of replacing working runtime files or using aggressive automated rewrites.

## What v6.5 proves automatically

- TypeScript still compiles.
- Production build still works.
- No-mock production audit has no blocking findings.
- v6.4 database security static proof still passes.
- Auth/protected-route files are present and production bypass is disabled in the production env example.
- Workflow contract signals exist for projects, evidence, approvals, and OVR.
- Unit/browser/SQL test assets exist for the next real test stage.

## What v6.5 does not claim

It does not claim production readiness by itself. The pilot gate intentionally keeps these as manual requirements:

- Run persona SQL tests in staging.
- Perform restore dry-run and verify table/storage samples.
- Get IT, Quality, and Admin signoff before entering confidential data.

## Commands

```bash
node scripts/v65-install-real-test-scripts.mjs
npm run v65:all
```

Optional real unit/browser tests:

```bash
npm run v65:install-test-deps
npm run test:unit
npm run test:e2e
```

For local browser tests, use the dev bypass only locally:

```env
VITE_AUTH_BYPASS_LOCAL=true
VITE_ALLOW_DEMO_DATA=false
```

Production must keep:

```env
VITE_AUTH_BYPASS_LOCAL=false
VITE_ALLOW_DEMO_DATA=false
```

## Pilot rule

Use the system for controlled internal testing only until staging persona SQL and restore dry-run evidence are complete. Do not enter patient identifiers or confidential OVR details before those proof steps pass.
